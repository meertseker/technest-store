import { getLocale } from "@lib/data/locale"

export async function getLocaleHeader() {
  const locale = await getLocale()
  return {
    "x-medusa-locale": locale,
  } as const
}
