// Renders every template with its fixture to .preview/<id>.html and .txt.
// Usage: pnpm --filter @technest/emails preview   (then open the .html files)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { renderEmail, templateIds } from "./index"
import { fixtures } from "./fixtures"

async function main() {
  const out = join(__dirname, "..", ".preview")
  mkdirSync(out, { recursive: true })
  for (const id of templateIds) {
    const email = await renderEmail(id, fixtures[id])
    writeFileSync(join(out, `${id}.html`), email.html)
    writeFileSync(join(out, `${id}.txt`), `Subject: ${email.subject}\n\n${email.text}`)
    console.log(`${id}: ${email.subject}`)
  }
  console.log(`Wrote ${templateIds.length} template(s) to ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
