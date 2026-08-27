import { archiveRecord, DID_PATTERN, isPublicRoom, readArchive, sha256, type ProofRecord } from '@/db/archive';

const TECHNOCORE = 'https://technocore.chat';
type RoomSummary = { room?: unknown };
type TechnocoreMessage = { from?: unknown; text?: unknown; seq?: unknown; nonce?: unknown; ts?: unknown };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
async function getText(url: string) {
  const result = await fetch(url, { headers: { Accept: 'text/plain' }, cache: 'no-store' });
  if (!result.ok) return null;
  return result.text();
}
async function getJson(url: string) {
  const result = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!result.ok) throw new Error(`Technocore returned ${result.status}`);
  return result.json() as Promise<Record<string, unknown>>;
}

export async function GET(request: Request) {
  const did = new URL(request.url).searchParams.get('did')?.trim() || '';
  if (!DID_PATTERN.test(did)) return response({ error: 'Invalid did:key format.' }, 400);
  try {
    const fingerprint = (await sha256(did)).slice(0, 16);
    const shardUrl = `${TECHNOCORE}/kv/did-${fingerprint.slice(0, 2)}/${fingerprint.slice(2)}`;
    const legacyUrl = `${TECHNOCORE}/kv/did/${fingerprint}`;
    let noteUrl = shardUrl;
    let noteValue = await getText(shardUrl);
    if (noteValue === null) { noteUrl = legacyUrl; noteValue = await getText(legacyUrl); }

    const roomsPayload = await getJson(`${TECHNOCORE}/rooms?format=json&limit=18`);
    const summaries = Array.isArray(roomsPayload.rooms) ? roomsPayload.rooms as RoomSummary[] : [];
    const roomNames = [...new Set(['technocore', 'lobby', ...summaries
      .map((item) => typeof item.room === 'string' ? item.room : '')
      .filter(isPublicRoom)])].slice(0, 20);
    const roomPayloads = await Promise.all(roomNames.map(async (room) => {
      try {
        const payload = await getJson(`${TECHNOCORE}/r/${encodeURIComponent(room)}?format=json&limit=200`);
        return { room, messages: Array.isArray(payload.messages) ? payload.messages as TechnocoreMessage[] : [] };
      } catch { return { room, messages: [] as TechnocoreMessage[] }; }
    }));

    const activities = roomPayloads.flatMap(({ room, messages }) => messages
      .filter((message) => message.from === did && typeof message.text === 'string' && typeof message.seq === 'number')
      .map((message) => ({ room, seq: message.seq as number, nonce: typeof message.nonce === 'number' ? String(message.nonce) : null, ts: typeof message.ts === 'string' ? message.ts : null, text: message.text as string })))
      .sort((a, b) => (b.ts || '').localeCompare(a.ts || '') || b.seq - a.seq);

    const artifactMap = new Map<string, { url: string; kind: 'github'; room: string; seq: number }>();
    for (const activity of activities) {
      const matches = activity.text.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s<>"']*)?/g) || [];
      for (const match of matches) {
        const url = match.replace(/[),.;:!?]+$/, '');
        artifactMap.set(url, { url, kind: 'github', room: activity.room, seq: activity.seq });
      }
    }
    const checkedAt = new Date().toISOString();
    const liveRecord: ProofRecord = {
      did, fingerprint,
      note: { found: noteValue !== null, url: noteUrl, value: noteValue?.trim() || null },
      activities, artifacts: [...artifactMap.values()], roomsScanned: roomNames.length, checkedAt,
    };
    const stored = await archiveRecord(liveRecord, 'live-technocore');
    const archived = await readArchive(did);
    return response({
      ...(archived || liveRecord),
      note: liveRecord.note,
      roomsScanned: roomNames.length,
      checkedAt,
      source: 'live',
      archive: archived?.archive || { found: true, liveCount: stored.activitiesStored, importedCount: 0, totalActivities: stored.activitiesStored, oldestArchivedAt: stored.archivedAt },
    });
  } catch {
    try {
      const archived = await readArchive(did);
      if (archived) return response({ ...archived, source: 'archive' });
    } catch { /* D1 unavailable too */ }
    return response({ error: 'Technocore source is temporarily unavailable and no archived proof was found.' }, 502);
  }
}
