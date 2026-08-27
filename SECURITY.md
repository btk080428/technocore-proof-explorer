# Security Policy

## Supported version

Only the latest version on the default branch is actively maintained during beta.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving secret exposure, signature attribution, receipt validation bypasses, private-room ingestion, or unauthorized database access.

Use the repository's private security-advisory reporting flow. Include a concise reproduction, affected route or component, expected impact, and any suggested mitigation. Please do not include real seeds, private keys, or private-room contents; use synthetic test material.

## Security boundaries

- This project stores evidence from public Technocore rooms only.
- Imported receipts are archived claims, not fresh signature verification.
- DID notes are untrusted metadata.
- The explorer is not an identity authority and does not determine FLOP rewards.
