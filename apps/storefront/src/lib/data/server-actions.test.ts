import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Every export of a "use server" file is an HTTP endpoint anyone can call with
 * any arguments. So only form actions that validate their own input live in
 * such files; reads and unvalidated helpers live in server-only modules.
 * Adding an action means adding it here, on purpose.
 */
const ACTIONS: Record<string, string[]> = {
  "lib/consent/actions.ts": ["saveConsent"],
  "lib/data/account-actions.ts": [
    "confirmEmailVerificationAction",
    "createAccountAfterOrderAction",
    "deleteAddressAction",
    "forgotPasswordAction",
    "loginAction",
    "registerAction",
    "resetPasswordAction",
    "saveAddressAction",
    "signoutAction",
    "transferCartAction",
    "updateProfileAction",
  ],
  "lib/data/basket-actions.ts": ["addToBasket", "changeLineQuantity", "removeLine"],
  "lib/data/checkout-actions.ts": ["saveContact", "saveDelivery"],
  "lib/data/order-actions.ts": ["acceptTransferAction", "declineTransferAction"],
  "lib/data/repair-actions.ts": ["submitRepairBooking"],
  "lib/data/trade-actions.ts": ["submitTradeApplication"],
  "modules/checkout/payment/actions.ts": ["completeOrder", "preparePaymentSession"],
}

const SRC = join(__dirname, "..", "..")

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : []
  )

const rel = (file: string) => relative(SRC, file).split(sep).join("/")
const firstStatement = (src: string) => src.replace(/^(\s|\/\/.*\n|\/\*[\s\S]*?\*\/)*/, "").slice(0, 14)
const isServerActionFile = (src: string) => /^["']use server["']/.test(firstStatement(src))
const isClientFile = (src: string) => /^["']use client["']/.test(firstStatement(src))

const files = sourceFiles(SRC).map((file) => ({ path: rel(file), src: readFileSync(file, "utf8") }))

function exportedValues(src: string): string[] {
  const names = new Set<string>()
  for (const m of Array.from(src.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/gm))) names.add(m[1])
  for (const m of Array.from(src.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm))) names.add(m[1])
  for (const m of Array.from(src.matchAll(/^export\s+\{([^}]*)\}/gm))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()
      if (name && !part.trim().startsWith("type ")) names.add(name)
    }
  }
  return Array.from(names).sort()
}

describe("server actions", () => {
  it("only the known form-action files are 'use server'", () => {
    const found = files.filter((f) => isServerActionFile(f.src)).map((f) => f.path).sort()
    expect(found).toEqual(Object.keys(ACTIONS).sort())
  })

  it.each(Object.entries(ACTIONS))("%s exports exactly its form actions", (path, actions) => {
    const file = files.find((f) => f.path === path)
    expect(file, `${path} is missing`).toBeTruthy()
    expect(exportedValues(file!.src)).toEqual([...actions].sort())
  })

  it("browser components import data modules only for their types (or through an action file)", () => {
    const actionModules = new Set(Object.keys(ACTIONS).map((p) => p.replace(/\.ts$/, "")))
    const offenders: string[] = []
    for (const f of files.filter((f) => isClientFile(f.src))) {
      const lines = f.src.split(/\r?\n/)
      lines.forEach((line, n) => {
        const from = line.match(/from\s+["'](?:@lib|@\/lib)\/(data\/[\w-]+)["']/)
        if (!from) return
        // the statement starts at the nearest line above (or this one) that begins with "import"
        let start = n
        while (start > 0 && !/^import\b/.test(lines[start])) start--
        const typeOnly = /^import\s+type\b/.test(lines[start])
        if (!typeOnly && !actionModules.has(`lib/${from[1]}`)) offenders.push(`${f.path} -> ${from[1]}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it("the modules that read with the visitor's cookies cannot be bundled for the browser", () => {
    for (const name of ["cart", "customer", "orders", "account", "basket", "payment", "fulfillment", "cookies", "trade"]) {
      const file = files.find((f) => f.path === `lib/data/${name}.ts`)
      expect(file, `lib/data/${name}.ts is missing`).toBeTruthy()
      expect(file!.src, `lib/data/${name}.ts`).toMatch(/^import "server-only"/m)
    }
  })
})
