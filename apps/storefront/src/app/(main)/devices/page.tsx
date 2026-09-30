import { Metadata } from "next"
import Link from "next/link"
import { HelpCircle } from "lucide-react"
import { clearDevice } from "@lib/data/device-actions"
import { getCurrentDevice, listDevices } from "@lib/data/devices"
import { safeReturnPath } from "@/lib/devices/cookie"
import { searchDevices } from "@/lib/devices/tree"
import DeviceBrowser from "@modules/devices/components/device-browser"
import DeviceOptions from "@modules/devices/components/device-options"
import DeviceSearch from "@modules/devices/components/device-search"

export const metadata: Metadata = {
  title: "Choose your device",
  description:
    "Pick your phone or console once and we'll only show accessories that fit it.",
  robots: { index: false, follow: true },
}

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function DevicesPage(props: { searchParams: Promise<SP> }) {
  const sp = await props.searchParams
  const q = (one(sp.q) ?? "").slice(0, 60)
  const returnTo = safeReturnPath(one(sp.returnTo))
  const [tree, current] = await Promise.all([listDevices(), getCurrentDevice()])
  const results = q.trim() ? searchDevices(tree, q, 24) : null

  return (
    <div className="content-container max-w-3xl py-8 lg:py-12">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight lg:text-4xl">
        Choose your device
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        We&apos;ll only show you accessories that fit it. You can change it at any time.
      </p>

      {current && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded border border-success bg-success-subtle p-4">
          <p>
            Shopping for: <strong>{current.model}</strong>
          </p>
          <form action={clearDevice}>
            {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
            <button
              type="submit"
              className="min-h-11 cursor-pointer px-2 font-semibold underline underline-offset-4"
            >
              Show all devices instead
            </button>
          </form>
        </div>
      )}

      {tree.count === 0 ? (
        <p className="mt-8 rounded bg-surface p-4">
          We can&apos;t load the list of devices right now. Please try again in a moment,
          or call us and we&apos;ll help you find the right accessory.
        </p>
      ) : (
        <div className="mt-8 grid gap-10">
          <DeviceSearch
            tree={tree}
            returnTo={returnTo}
            currentSlug={current?.slug}
            defaultQuery={q}
          />

          {results && (
            <section aria-labelledby="search-results">
              <h2 id="search-results" className="text-xl font-semibold">
                {results.length
                  ? `${results.length} ${results.length === 1 ? "device matches" : "devices match"} “${q}”`
                  : `No device matches “${q}”`}
              </h2>
              <div className="mt-3">
                {results.length ? (
                  <DeviceOptions
                    devices={results}
                    returnTo={returnTo}
                    currentSlug={current?.slug}
                    showBrand
                  />
                ) : (
                  <p>Try fewer words, or choose your brand below.</p>
                )}
              </div>
            </section>
          )}

          <DeviceBrowser
            tree={tree}
            brand={one(sp.brand)}
            series={one(sp.series)}
            returnTo={returnTo}
            currentSlug={current?.slug}
          />
        </div>
      )}

      <p className="mt-10">
        <Link
          href="/devices/help"
          className="inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4"
        >
          <HelpCircle aria-hidden className="size-5" />
          How do I find my model?
        </Link>
      </p>
    </div>
  )
}
