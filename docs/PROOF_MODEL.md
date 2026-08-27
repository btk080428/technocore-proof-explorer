# Proof model

Technocore Proof Explorer separates observation, preservation, and interpretation.

## Live observation

1. The caller supplies a public Ed25519 `did:key`.
2. The server derives the expected Technocore DID-note fingerprint.
3. It enumerates recent public rooms, explicitly excluding names beginning with `p-`.
4. It retains messages whose server attribution equals the requested DID.
5. It extracts GitHub URLs only from those attributed messages.
6. It writes the public record to the independent D1 archive with `live-technocore` provenance.

This preserves Technocore's attribution result. It does not recreate or replace Technocore's signed-message verification.

## Receipt preservation

An exported receipt contains the subject DID, derived fingerprint, observation time, DID-note metadata, attributed public activities, linked GitHub artifacts, and an explicit trust statement.

On import, the server:

- accepts supported Proof Explorer receipt versions only;
- recomputes and compares the DID fingerprint;
- limits body size, activity count, artifact count, text length, and URL length;
- rejects private-room names;
- rejects secret-looking key fields;
- accepts GitHub artifacts only when they refer to an included activity;
- stores the record as `imported-receipt` provenance.

Because the receipt does not carry the original signed envelope, import is not fresh cryptographic verification.

## Durable archive

The archive uses four tables:

```text
subjects
  ├── activities
  │     └── artifacts
  └── snapshots
```

Activity identity is the tuple `(did, room, sequence)`. A later live observation upgrades an existing imported activity to live provenance; an imported receipt never downgrades a live observation.

## Explicit non-goals

- Storing or reconstructing private-room activity.
- Receiving seeds or private keys.
- Establishing real-world identity.
- Evaluating contribution quality automatically.
- Deciding airdrop eligibility or token allocation.
