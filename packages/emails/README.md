# @technest/emails

All Tech Nest email templates (React Email). Each one renders to a subject, HTML and plain text.

- `renderEmail(templateId, data)`: used by the backend `smtp` notification provider when a notification has no pre-rendered `content`.
- Template ids and the event that triggers each one: `docs/contracts/emails.md`.
- Shared layout (logo, #D6001C accent, footer with the legal name, address, phone and returns link): `src/components/layout.tsx`. Shop facts: `src/brand.ts`.

```bash
pnpm --filter @technest/emails test      # build + node --test
pnpm --filter @technest/emails preview   # writes .preview/<id>.html and .txt
```

To add a template: create `src/templates/<id>.tsx` exporting `subject(data)` and `Email`, register it in `src/index.ts`, add a fixture in `src/fixtures/index.ts`, and add the id to the contract.

Links use `STOREFRONT_URL` (default `https://technest.co.uk`).
