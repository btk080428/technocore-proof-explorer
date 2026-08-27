import { archiveRecord, DID_PATTERN, isPublicRoom, readArchive, sha256, type ProofRecord, type PublicActivity, type PublicArtifact } from '@/db/archive';

const MAX_BODY_BYTES = 128_000;
const MAX_ACTIVITIES = 50;
const MAX_ARTIFACTS = 25;

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max ? value : null;
}
function technocoreUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'technocore.chat' ? url.toString() : '';
  } catch { return ''; }
}
function githubUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.split('/').filter(Boolean).length >= 2 ? url.toString() : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > MAX_BODY_BYTES) return response({ error: 'Receipt is too large.' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return response({ error: 'Receipt is too large.' }, 413);
  if (/"(?:seed|privateKey|secretKey|private_key|secret_key)"\s*:/i.test(raw)) {
    return response({ error: 'Receipt appears to contain secret key material. Nothing was stored.' }, 400);
  }

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return response({ error: 'Receipt is not valid JSON.' }, 400); }
  const root = object(payload);
  const evidence = object(root?.evidence);
  const note = object(evidence?.didNote);
  const did = text(root?.subject, 80) || '';
  const receiptVersion = text(root?.receiptVersion, 80) || '';
  if (!['technocore-proof-explorer/0.1', 'technocore-proof-explorer/0.2'].includes(receiptVersion)) {
    return response({ error: 'Unsupported receipt version.' }, 400);
  }
  if (!DID_PATTERN.test(did)) return response({ error: 'Receipt subject is not a valid did:key.' }, 400);
  const fingerprint = (await sha256(did)).slice(0, 16);
  if (root?.fingerprint !== fingerprint) return response({ error: 'Receipt fingerprint does not match its DID.' }, 400);

  const rawActivities = evidence?.serverAttributedSignedActivity;
  if (!Array.isArray(rawActivities) || rawActivities.length > MAX_ACTIVITIES) return response({ error: 'Receipt activity list is invalid or too large.' }, 400);
  const activities: PublicActivity[] = [];
  for (const candidate of rawActivities) {
    const item = object(candidate);
    const room = text(item?.room, 96) || '';
    const body = text(item?.text, 4_000);
    const seq = item?.seq;
    if (!isPublicRoom(room) || body === null || typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0) {
      return response({ error: 'Receipt contains an invalid or private-room activity.' }, 400);
    }
    const nonce = typeof item?.nonce === 'string' || typeof item?.nonce === 'number' ? String(item.nonce) : null;
    const ts = item?.ts === null || item?.ts === undefined ? null : text(item.ts, 80);
    if (item?.ts !== null && item?.ts !== undefined && ts === null) return response({ error: 'Receipt timestamp is invalid.' }, 400);
    activities.push({ room, seq, nonce, ts, text: body });
  }

  const activityKeys = new Set(activities.map((item) => `${item.room}|${item.seq}`));
  const rawArtifacts = evidence?.signedMessageLinkedArtifacts;
  if (!Array.isArray(rawArtifacts) || rawArtifacts.length > MAX_ARTIFACTS) return response({ error: 'Receipt artifact list is invalid or too large.' }, 400);
  const artifacts: PublicArtifact[] = [];
  for (const candidate of rawArtifacts) {
    const item = object(candidate);
    const room = text(item?.room, 96) || '';
    const seq = item?.seq;
    const url = githubUrl(item?.url);
    if (!url || !isPublicRoom(room) || typeof seq !== 'number' || !Number.isSafeInteger(seq) || !activityKeys.has(`${room}|${seq}`)) {
      return response({ error: 'Receipt artifact is not linked to a valid public activity.' }, 400);
    }
    artifacts.push({ url, kind: 'github', room, seq });
  }

  const checkedAtRaw = text(root?.checkedAt, 80);
  const checkedAt = checkedAtRaw && !Number.isNaN(Date.parse(checkedAtRaw)) ? new Date(checkedAtRaw).toISOString() : null;
  if (!checkedAt) return response({ error: 'Receipt checkedAt is invalid.' }, 400);
  const roomsScanned = evidence?.roomsScanned;
  const record: ProofRecord = {
    did, fingerprint,
    note: {
      found: note?.found === true,
      url: technocoreUrl(note?.url),
      value: text(note?.value, 500),
    },
    activities, artifacts,
    roomsScanned: typeof roomsScanned === 'number' && Number.isSafeInteger(roomsScanned) && roomsScanned >= 0 && roomsScanned <= 200 ? roomsScanned : 0,
    checkedAt,
  };
  const stored = await archiveRecord(record, 'imported-receipt');
  const archived = await readArchive(did);
  return response({ ok: true, stored, record: archived ? { ...archived, source: 'archive' } : record }, 201);
}
