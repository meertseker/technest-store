import { Metadata } from "next"
import Link from "next/link"
import { siteConfig } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "How do I find my phone model?",
  description: "Where to find your phone, tablet or console model, step by step.",
}

const GUIDES = [
  {
    id: "apple",
    title: "iPhone and iPad",
    steps: [
      "Open Settings",
      "Tap General, then About",
      "Look at Model Name (for example, iPhone 15 Pro)",
    ],
  },
  {
    id: "samsung",
    title: "Samsung Galaxy",
    steps: [
      "Open Settings",
      "Tap About phone",
      "Look at Model name (for example, Galaxy S24 Ultra)",
    ],
  },
  {
    id: "android",
    title: "Google Pixel and other Android phones",
    steps: ["Open Settings", "Tap About phone", "The model is shown near the top"],
  },
  {
    id: "consoles",
    title: "PlayStation, Xbox and Nintendo Switch",
    steps: [
      "Look at the label on the console, usually underneath or on the back",
      "On a PlayStation you can also open Settings, then System, then Console Information",
    ],
  },
]

export default function DeviceHelpPage() {
  return (
    <div className="content-container max-w-3xl py-8 lg:py-12">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight lg:text-4xl">
        How do I find my model?
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        It only takes a few seconds. Then choose it on the device page.
      </p>
      <div className="mt-8 grid gap-6">
        {GUIDES.map((g) => (
          <section
            key={g.id}
            aria-labelledby={`guide-${g.id}`}
            className="rounded border border-border p-4"
          >
            <h2 id={`guide-${g.id}`} className="text-xl font-semibold">
              {g.title}
            </h2>
            <ol className="mt-2 list-decimal pl-6">
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="mt-8">
        Still not sure? Call us on{" "}
        <a
          href={`tel:${siteConfig.phone.e164}`}
          className="font-semibold underline underline-offset-4"
        >
          {siteConfig.phone.display}
        </a>{" "}
        or bring your phone into the shop and we&apos;ll check it for you.
      </p>
      <p className="mt-6">
        <Link
          href="/devices"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Back to choosing your device
        </Link>
      </p>
    </div>
  )
}
