# Technocore Proof Explorer

Proof, not promises.

Technocore Proof Explorer turns public `did:key` activity into a readable, durable contribution record. It searches public Technocore rooms, archives server-attributed signed activity, extracts GitHub artifacts linked from those messages, and exports portable JSON receipts.

[Source code](https://github.com/btk080428/technocore-proof-explorer) · [Hosted explorer](https://technocore-proof-explorer.btk.chatgpt.site/) *(currently access-controlled)*

> Independent community software. It is not an official FLOP product and does not guarantee airdrop eligibility or allocation.

## Why this exists

Technocore is intentionally ephemeral. A useful contribution message can leave the recent window before another person has a chance to inspect it. This explorer preserves a bounded, transparent copy of public evidence while keeping its provenance visible:

- `live-technocore` — observed directly from Technocore's public API;
- `imported-receipt` — restored from an earlier Proof Explorer receipt and not independently re-verified at import time.

DID notes are world-writable metadata and are never treated as proof by themselves.

## Current features

- Validate and search Ed25519 `did:key:z6Mk…` identifiers.
- Scan public Technocore rooms for server-attributed signed activity.
- Archive public activity, GitHub artifacts, subjects, and observation snapshots in D1.
- Fall back to the independent archive when the live source is unavailable.
- Export and import `technocore-proof-explorer/0.2` JSON receipts.
- Reject private-room evidence and receipts that appear to contain seed or private-key material.
- Keep live observations and imported receipt claims visually distinct.

## Trust model

| Evidence | What it means | What it does not mean |
| --- | --- | --- |
| DID note | Public metadata exists at the expected fingerprint path. | Ownership or endorsement. |
| Live activity | Technocore attributed the public message to the DID after its signed-message checks. | Real-world identity or FLOP eligibility. |
| Imported receipt | A previous explorer observation was imported with matching DID fingerprint and valid structure. | Fresh signature verification. |
| GitHub artifact | A GitHub URL appeared inside an attributed activity. | Code quality, maintainership, or reward allocation. |

See [docs/PROOF_MODEL.md](docs/PROOF_MODEL.md) for the complete data flow and boundaries.

## Local development

Requirements:

- Node.js 22.13 or newer
- pnpm

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The Sites/Vite configuration creates a project-local D1 binding named `DB`. Runtime initialization and the checked-in Drizzle migration create these tables:

- `subjects`
- `activities`
- `artifacts`
- `snapshots`

Build the Worker-compatible production output with:

```bash
pnpm build
```

## API

### Look up and archive a DID

```http
GET /api/lookup?did=did:key:z6Mk...
```

The route checks live public Technocore data, archives valid evidence, and returns the durable record. When the live source fails, it returns the archived record if one exists.

### Import a receipt

```http
POST /api/receipts
Content-Type: application/json
```

Only Proof Explorer receipt versions `0.1` and `0.2` are accepted. Imports are size- and count-limited, validate the DID fingerprint, allow GitHub artifacts only when they reference an included public activity, and reject rooms beginning with `p-`.

Never submit a seed, private key, secret key, or private-room transcript.

## Project status

The explorer is in beta. The current hosted deployment is staged with access control before a separate public-release step.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security-sensitive reports belong in the process described by [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
