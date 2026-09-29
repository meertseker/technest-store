# Plan: packages/emails (E2)

Goal: one shared, tested place for every Tech Nest email. Each email has an HTML and a plain-text version, and there is a local preview.

## Design
- `packages/emails` (`@technest/emails`): React Email components, compiled by `tsc` to CommonJS in `dist/`. Medusa's backend loads it at runtime from the workspace link. Turbo's `^build` builds it before the backend.
- Public API: `renderEmail(template, data) → Promise<{ subject, html, text }>`. The template registry maps template ids (see `docs/contracts/emails.md`) to `{ subject(data), Component }`. An unknown id throws.
- `Layout`: logo wordmark, accent `#D6001C` (brand red, used as an accent only), body text 16px, and a footer with the legal name, address, phone and a returns link (`STOREFRONT_URL` + `/returns`). No shop photos 01–04, ever.
- Plain text comes from `render(el, { plainText: true })`.
- Preview: `pnpm --filter @technest/emails preview` renders every template with its fixture data to `packages/emails/.preview/<id>.html|.txt` (gitignored). We don't use the React Email dev server: it's a Next app, and disk space is tight.
- The `smtp` provider calls `renderEmail(template, data)` when a notification has no pre-rendered `content`.
- Tests use `node --test` on the compiled output (no new test framework).

## Steps (TDD)
1. Test: `renderEmail("welcome", …)` returns a subject, HTML with the accent colour and the footer address, and text with the address. Unknown template → rejects. RED, then scaffold the package, Layout and the welcome template. GREEN.
2. Test (backend unit): the smtp provider renders through `@technest/emails` when `content` is missing. RED → GREEN.
3. The preview script, plus a README.
4. Heads-up to E4: the backend Docker build must copy and build `packages/emails` before `apps/backend`.
