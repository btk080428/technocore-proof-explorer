'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const SAMPLE_DID = 'did:key:z6MkuYSQqGUTKup42yhYQTanZjJ1sTzNMiGy4V2kfcgsu6ne';

type Activity = { room: string; seq: number; nonce: number | string | null; ts: string | null; text: string; provenance?: 'live-technocore' | 'imported-receipt'; archivedAt?: string };
type Artifact = { url: string; kind: 'github'; room: string; seq: number };
type LookupResult = {
  did: string;
  fingerprint: string;
  note: { found: boolean; url: string; value: string | null };
  activities: Activity[];
  artifacts: Artifact[];
  roomsScanned: number;
  checkedAt: string;
  source?: 'live' | 'archive';
  archive?: { found: boolean; liveCount: number; importedCount: number; totalActivities: number; oldestArchivedAt: string | null };
};

const sampleRecord: LookupResult = {
  did: SAMPLE_DID,
  fingerprint: 'b7e61f97651785e5',
  note: { found: true, url: 'https://technocore.chat/kv/did-b7/e61f97651785e5', value: SAMPLE_DID },
  activities: [{
    room: 'technocore', seq: 744785, nonce: '178781456866529650', ts: null,
    text: 'Initial signed check-in. This DID is preparing a useful public Technocore contribution and will link the finished artifact here; no contribution is claimed yet.',
  }],
  artifacts: [], roomsScanned: 2, checkedAt: new Date().toISOString(),
};

export default function Home() {
  const [query, setQuery] = useState(SAMPLE_DID);
  const [record, setRecord] = useState<LookupResult | null>(sampleRecord);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  async function lookup(did: string) {
    const normalized = did.trim();
    if (!/^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/.test(normalized)) {
      setRecord(null);
      setError('`did:key:z6Mk…` 形式の公開DIDを入力してください。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/lookup?did=${encodeURIComponent(normalized)}`);
      const payload = await response.json() as LookupResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Technocoreを確認できませんでした。');
      setRecord(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Technocoreを確認できませんでした。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/lookup?did=${encodeURIComponent(SAMPLE_DID)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as LookupResult & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Technocoreを確認できませんでした。');
        return payload;
      })
      .then((payload) => { setRecord(payload); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Technocoreを確認できませんでした。');
      });
    return () => controller.abort();
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(query);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Technocore Proof Explorer home">
          <span className="brand-mark">T<span>P</span></span>
          <span>Technocore<br /><b>Proof Explorer</b></span>
        </a>
        <div className="network"><i className={error ? 'offline' : ''} /> {error ? 'Source unavailable' : 'Technocore live'} <span>Beta 0.1</span></div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>01</span> Proof, not promises</div>
        <h1>Trace the work<br />behind the <em>DID.</em></h1>
        <p>Technocore上の公開DID、署名アクティビティ、成果物を<br className="desktop" />ひとつの検証可能な証明として読み解きます。</p>
        <form className="search" onSubmit={search}>
          <label htmlFor="did-search">PUBLIC DID</label>
          <input id="did-search" value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} autoComplete="off" />
          <button type="submit" disabled={loading}>{loading ? 'CHECKING…' : 'EXPLORE'} <span>↗</span></button>
        </form>
        <div className="search-note"><span>●</span> 公開情報のみを参照します。秘密鍵・seedは入力しないでください。</div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}
      <ReceiptImport
        message={importMessage}
        onMessage={setImportMessage}
        onImported={(next) => { setRecord(next); setQuery(next.did); setError(''); }}
      />
      {record ? <ProofRecord record={record} /> : !loading && (
        <section className="empty-state"><span>NO RECORD</span><h2>この公開DIDの証明レコードを表示できません。</h2></section>
      )}

      <footer>
        <a href="https://github.com/btk080428/technocore-proof-explorer" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
        <span>Technocore activity is ephemeral · Not an airdrop guarantee</span>
      </footer>
    </main>
  );
}

function ReceiptImport({ message, onMessage, onImported }: { message: string; onMessage: (message: string) => void; onImported: (record: LookupResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function importReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 128_000) { onMessage('128KB以下のProof Explorerレシートを選んでください。'); return; }
    setImporting(true);
    onMessage('');
    try {
      const raw = await file.text();
      if (/"(?:seed|privateKey|secretKey|private_key|secret_key)"\s*:/i.test(raw)) throw new Error('秘密鍵らしき項目を検出したため、取り込みを中止しました。');
      const response = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
      const payload = await response.json() as { error?: string; record?: LookupResult; stored?: { activitiesStored: number; artifactsStored: number } };
      if (!response.ok || !payload.record) throw new Error(payload.error || 'レシートを取り込めませんでした。');
      onImported(payload.record);
      onMessage(`取り込み完了：公開活動 ${payload.stored?.activitiesStored ?? 0} 件、成果物 ${payload.stored?.artifactsStored ?? 0} 件を保存しました。`);
    } catch (reason) {
      onMessage(reason instanceof Error ? reason.message : 'レシートを取り込めませんでした。');
    } finally { setImporting(false); }
  }

  return (
    <section className="archive-tools" aria-label="Proof archive tools">
      <div>
        <div className="eyebrow"><span>A</span> Durable proof layer</div>
        <h2>Ephemeral feed.<br /><em>Persistent evidence.</em></h2>
        <p>公開ルームで確認した署名活動を独立保存します。過去のJSONレシートも、ライブ確認とは区別したまま取り込めます。</p>
      </div>
      <div className="import-card">
        <span>IMPORT / JSON RECEIPT</span>
        <p>Proof Explorer 0.1 / 0.2対応。private room、秘密鍵、seedは受け付けません。</p>
        <input ref={input} type="file" accept="application/json,.json" onChange={importReceipt} hidden />
        <button type="button" onClick={() => input.current?.click()} disabled={importing}>{importing ? 'IMPORTING…' : 'IMPORT RECEIPT'} <b>＋</b></button>
        {message && <div className="import-message" role="status">{message}</div>}
      </div>
    </section>
  );
}

function ProofRecord({ record }: { record: LookupResult }) {
  const shortDid = `${record.did.slice(8, 16)}…${record.did.slice(-4)}`;
  const signalCount = Number(record.note.found) + Number(record.activities.length > 0) + Number(record.artifacts.length > 0);
  const receipt = useMemo(() => ({
    receiptVersion: 'technocore-proof-explorer/0.2', subject: record.did,
    fingerprint: record.fingerprint, checkedAt: record.checkedAt,
    evidence: { didNote: record.note, serverAttributedSignedActivity: record.activities, signedMessageLinkedArtifacts: record.artifacts, roomsScanned: record.roomsScanned },
    trust: {
      didNote: 'world-writable metadata; not proof by itself',
      activity: 'Technocore server attributed the message to this did:key after signature verification',
      archive: 'independent durable copy of public-room evidence; imported receipts remain distinguishable from live observations',
      reward: 'not an airdrop eligibility or allocation guarantee',
    },
  }), [record]);

  function downloadReceipt() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `technocore-proof-${record.fingerprint}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="record" aria-label="DID proof record">
      <div className="record-heading">
        <div><div className="eyebrow"><span>02</span> Identity record</div><h2>Verified activity,<br />readable evidence.</h2></div>
        <div className="score"><strong>{signalCount}</strong><span>VERIFIED<br />SIGNALS</span></div>
      </div>

      <article className="identity-card">
        <div className="identity-primary">
          <div className="avatar">z6</div>
          <div>
            <div className={`status ${record.activities.length ? 'verified' : 'unverified'}`}>{record.activities.length ? `✓ SIGNED ACTIVITY ${record.source === 'archive' ? 'FROM ARCHIVE' : 'FOUND'}` : '— NO SIGNED ACTIVITY IN WINDOW'}</div>
            <h3>{shortDid}</h3><code>{record.did}</code>
          </div>
        </div>
        <dl>
          <div><dt>METHOD</dt><dd>did:key / Ed25519</dd></div>
          <div><dt>FINGERPRINT</dt><dd>{record.fingerprint}</dd></div>
          <div><dt>DID NOTE</dt><dd><span className={`dot ${record.note.found ? '' : 'missing'}`} /> {record.note.found ? 'Found · untrusted metadata' : 'Not found'}</dd></div>
        </dl>
      </article>

      <div className="archive-strip">
        <div><span>ARCHIVE STATUS</span><b>{record.archive?.found ? 'ACTIVE' : 'NEW'}</b></div>
        <div><span>DURABLE EVENTS</span><b>{record.archive?.totalActivities ?? record.activities.length}</b></div>
        <div><span>LIVE-SOURCED</span><b>{record.archive?.liveCount ?? 0}</b></div>
        <div><span>RECEIPT-IMPORTED</span><b>{record.archive?.importedCount ?? 0}</b></div>
        <p>{record.source === 'archive' ? 'Technocoreが取得できないため、独立アーカイブを表示中。' : 'ライブ確認結果を独立アーカイブへ保存済み。'}</p>
      </div>

      <div className="proof-grid">
        <article className="panel activity-panel">
          <div className="panel-title"><span>RECENT ACTIVITY</span><b>{record.activities.length} signed event{record.activities.length === 1 ? '' : 's'} · {record.roomsScanned} rooms scanned</b></div>
          {record.activities.length ? <div className="activity-list">{record.activities.slice(0, 6).map((activity) => (
            <div className="timeline" key={`${activity.room}-${activity.seq}`}>
              <i /><div>
                <span className={`status ${activity.provenance === 'imported-receipt' ? 'imported' : 'verified'}`}>{activity.provenance === 'imported-receipt' ? '↳ IMPORTED RECEIPT CLAIM' : '✓ LIVE-SOURCED SERVER ATTRIBUTION'}</span>
                <h3>{activity.text.length > 58 ? `${activity.text.slice(0, 58)}…` : activity.text}</h3>
                <p>{activity.text}</p>
                <dl className="meta">
                  <div><dt>ROOM</dt><dd>{activity.room}</dd></div>
                  <div><dt>SEQUENCE</dt><dd>#{activity.seq}</dd></div>
                  <div><dt>NONCE</dt><dd>{activity.nonce ?? '—'}</dd></div>
                  <div><dt>ARCHIVE</dt><dd>{activity.archivedAt ? new Date(activity.archivedAt).toLocaleDateString('ja-JP') : 'CURRENT'}</dd></div>
                </dl>
              </div>
            </div>
          ))}</div> : <p className="panel-empty">最近の公開ルームから、このDIDの署名活動は見つかりませんでした。</p>}
        </article>

        <article className="panel contribution-panel">
          <div className="panel-title"><span>CONTRIBUTIONS</span><b>Signed-message links only</b></div>
          <div className="pending-badge">{record.artifacts.length ? 'ARTIFACTS FOUND' : 'BUILDING IN PUBLIC'}</div>
          <h3>{record.artifacts.length ? `${record.artifacts.length} linked artifact${record.artifacts.length === 1 ? '' : 's'}` : 'No linked artifact yet'}</h3>
          <p>署名済みメッセージ内で明示されたGitHub成果物のみを表示します。DIDノートだけの自己申告はカウントしません。</p>
          <div className="artifact-list">{record.artifacts.length ? record.artifacts.map((artifact) => (
            <a className="artifact-row" href={artifact.url} target="_blank" rel="noreferrer nofollow" key={`${artifact.room}-${artifact.seq}-${artifact.url}`}>
              <span>GITHUB</span><b>{artifact.url.replace('https://github.com/', '')}</b>
            </a>
          )) : <div className="artifact-row"><span>GITHUB</span><b>Artifact not linked yet</b></div>}</div>
          <button className="receipt-button active" type="button" onClick={downloadReceipt}>EXPORT RECEIPT <span>↓</span></button>
        </article>
      </div>

      <aside className="trust-note">
        <strong>TRUST MODEL</strong>
        <p>ライブ取得はTechnocoreのDID帰属を保存します。取り込みレシートは過去の観測記録であり、署名そのものを再検証したものではありません。</p>
        <span>Independent archive ≠ FLOP eligibility guarantee</span>
      </aside>
    </section>
  );
}
