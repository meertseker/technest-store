import {
  ExternalLink,
  Pending,
  ShopAddress,
  ShopHours,
  ShopPhone,
  TextLink,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"
import { siteConfig } from "@/lib/site-config"

const delivery: LegalContentFn = ({ freeDeliveryThreshold }) => ({
  summary: (
    <p>
      Choose free Click &amp; Collect from our shop in Bermondsey, or have your order
      delivered. You always see the delivery price on the product page and in your basket,
      before you pay.
    </p>
  ),
  sections: [
    {
      id: "options",
      heading: "Delivery options",
      body: (
        <>
          <ul>
            <li>
              <strong>Click &amp; Collect</strong>: free. Collect from our shop at{" "}
              <ShopAddress />.
            </li>
            <li>
              <strong>Standard delivery</strong>: usually arrives in{" "}
              <Pending label="standard delivery time, e.g. 2–3 working days" />.{" "}
              {freeDeliveryThreshold
                ? `Free when your basket is ${freeDeliveryThreshold} or more.`
                : "Free above the amount shown in your basket."}
            </li>
            <li>
              <strong>Next-day delivery</strong>: order by{" "}
              <Pending label="next-day cut-off time" /> on a working day for delivery the
              next working day.
            </li>
          </ul>
          <p>
            The price of each option is shown in your basket and at checkout. Delivery prices
            include VAT.
          </p>
        </>
      ),
    },
    {
      id: "where",
      heading: "Where we deliver",
      body: (
        <p>
          We deliver to addresses in <Pending label="delivery area, e.g. UK mainland only" />.
          We use <Pending label="courier or Royal Mail service" /> and will email you tracking
          details when your order is dispatched.
        </p>
      ),
    },
    {
      id: "add-on-items",
      heading: "£1 and add-on items",
      body: (
        <p>
          Add-on items, including our £1 range, can be added to any order. A delivery order
          cannot contain add-on items only, because the delivery would cost more than the
          items. Add something else, or choose free Click &amp; Collect.
        </p>
      ),
    },
    {
      id: "click-and-collect",
      heading: "How Click & Collect works",
      body: (
        <>
          <ol>
            <li>Choose &ldquo;Collect from shop&rdquo; at checkout. It is free.</li>
            <li>
              We email you when your order is ready. Please wait for this email before you
              come in.
            </li>
            <li>
              Bring the email (on your phone is fine). We may ask for the collection code in it
              and for your name.
            </li>
            <li>
              Your card is only charged when you collect. Until then the amount is just
              reserved.
            </li>
          </ol>
          <p>
            We keep your order for 7 days. We send a reminder after 3 days. If it is not
            collected within 7 days, we cancel the order and the reserved amount is released.
          </p>
          <p>Our opening hours:</p>
          <ShopHours />
          <p>
            <ExternalLink href={siteConfig.mapsUrl}>Find us on Google Maps</ExternalLink>
          </p>
        </>
      ),
    },
    {
      id: "problems",
      heading: "Late, missing or damaged deliveries",
      body: (
        <p>
          If your order has not arrived by the expected date, or arrives damaged, call us on{" "}
          <ShopPhone />. The goods are our responsibility until they reach you. You can also
          return an item you no longer want; see{" "}
          <TextLink href="/legal/returns">returns and cancellations</TextLink>.
        </p>
      ),
    },
  ],
})

export default delivery
