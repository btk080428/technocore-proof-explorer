# Contributing

Thank you for helping make public contribution evidence easier to inspect.

## Principles

- Preserve provenance. Never present imported claims as fresh live verification.
- Archive public data only. Private rooms and secret key material are out of scope.
- Keep the explorer independent. Do not imply official FLOP endorsement or reward eligibility.
- Prefer small, reviewable changes with a clear user-facing purpose.

## Development workflow

1. Create a focused branch.
2. Install dependencies with `pnpm install`.
3. Run the local explorer with `pnpm dev`.
4. Run `pnpm build` and `pnpm lint` before submitting a pull request.
5. Explain any trust-model, schema, or migration change in the pull request description.

Schema changes must include an inspected Drizzle migration under `drizzle/`. Do not commit `.env` files, local database state, receipts containing personal data, seeds, private keys, or deployment credentials.

## Pull requests

A useful pull request includes:

- the problem being solved;
- the trust or privacy impact;
- validation performed;
- screenshots only when the interface changed;
- migration and rollback notes when storage changed.

By contributing, you agree that your contribution is licensed under the MIT License.
