import {
  ExternalLink,
  Pending,
  ShopAddress,
  ShopEmail,
  ShopPhone,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

const accessibility: LegalContentFn = () => ({
  summary: (
    <p>
      We want everyone to be able to shop with us, whatever their age, ability or device.
      This statement explains how accessible the website is and how to get help.
    </p>
  ),
  sections: [
    {
      id: "our-aim",
      heading: "What we aim for",
      body: (
        <>
          <p>
            We build this website to meet the Web Content Accessibility Guidelines (WCAG) 2.2
            at level AA. That means you should be able to:
          </p>
          <ul>
            <li>use the whole site with a keyboard, including checkout;</li>
            <li>use a screen reader such as VoiceOver, TalkBack or NVDA;</li>
            <li>zoom the page to 400% without text disappearing or overlapping;</li>
            <li>read text at 16 pixels or larger, with strong colour contrast;</li>
            <li>tap buttons and links that are at least 44 pixels in size;</li>
            <li>turn off animation using your device&rsquo;s reduced-motion setting.</li>
          </ul>
          <p>
            Our forms never use picture puzzles (CAPTCHAs). We use a background check from
            Cloudflare instead.
          </p>
        </>
      ),
    },
    {
      id: "status",
      heading: "How accessible the site is",
      body: (
        <>
          <p>
            Every page is tested automatically with the axe accessibility checker on a phone
            and a desktop screen size before we publish changes. We also test by hand with a
            keyboard.
          </p>
          <p>
            Known issues: <Pending label="results of the pre-launch manual audit" />. If you
            find a problem not listed here, please tell us.
          </p>
        </>
      ),
    },
    {
      id: "help",
      heading: "Getting help or another format",
      body: (
        <>
          <p>If you have difficulty using the site, we are happy to help. You can:</p>
          <ul>
            <li>
              call us on <ShopPhone /> and we will help you find what you need;
            </li>
            <li>
              email <ShopEmail />;
            </li>
            <li>
              visit the shop at <ShopAddress />. Step-free access:{" "}
              <Pending label="yes or no" />.
            </li>
          </ul>
          <p>
            We can send any of our policies in another format, such as large print, if you
            ask.
          </p>
        </>
      ),
    },
    {
      id: "feedback",
      heading: "Reporting a problem",
      body: (
        <p>
          Tell us the page and what went wrong by phone or email, or in the shop, and we will
          reply as soon as we can.
        </p>
      ),
    },
    {
      id: "enforcement",
      heading: "If you are not happy with our response",
      body: (
        <p>
          The Equality Advisory and Support Service can give free advice on discrimination
          and accessibility:{" "}
          <ExternalLink href="https://www.equalityadvisoryservice.com/">
            equalityadvisoryservice.com
          </ExternalLink>
          .
        </p>
      ),
    },
    {
      id: "about",
      heading: "About this statement",
      body: (
        <p>
          This statement was prepared on 30 September 2026, before the site launched. We will
          review it after the launch audit and at least once a year.
        </p>
      ),
    },
  ],
})

export default accessibility
