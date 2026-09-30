import {
  ExternalLink,
  Pending,
  ShopAddress,
  ShopHours,
  ShopPhone,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

const weee: LegalContentFn = () => ({
  summary: (
    <p>
      Old chargers, cables, headphones and other electricals should never go in your
      household bin. When you buy a new electrical item from us, you can give us the old one
      to recycle, free.
    </p>
  ),
  sections: [
    {
      id: "why",
      heading: "Why electricals need recycling",
      body: (
        <p>
          Electrical items and batteries contain materials that can harm the environment and
          valuable materials that can be reused. Items marked with the crossed-out wheeled bin
          symbol must be collected separately from household waste. This is required by the
          Waste Electrical and Electronic Equipment (WEEE) Regulations 2013.
        </p>
      ),
    },
    {
      id: "take-back",
      heading: "Free take-back at our shop",
      body: (
        <>
          <p>
            When you buy a new electrical item from us, online or in the shop, you can bring
            us an old item of the same type that does the same job, and we will recycle it
            free of charge. For example, an old charger when you buy a new charger.
          </p>
          <ul>
            <li>
              Bring it to <ShopAddress /> within 28 days of buying the new item.
            </li>
            <li>Bring your receipt or order confirmation email.</li>
            <li>You do not have to buy anything else.</li>
          </ul>
          <p>Our opening hours:</p>
          <ShopHours />
          <p>
            Please remove your personal data from phones, tablets and computers before you
            hand them in. Questions? Call <ShopPhone />.
          </p>
        </>
      ),
    },
    {
      id: "batteries",
      heading: "Old batteries and power banks",
      body: (
        <p>
          We accept small waste batteries and power banks for recycling at the shop,{" "}
          <Pending label="free and without purchase: yes or no" />. Tape over the ends of
          lithium batteries, and never put a swollen or damaged battery in any bin. Bring it
          to us or to your local recycling centre.
        </p>
      ),
    },
    {
      id: "other-options",
      heading: "Other ways to recycle",
      body: (
        <p>
          Your local council recycling centre accepts electricals and batteries for free. Find
          your nearest one on{" "}
          <ExternalLink href="https://www.recyclenow.com/recycle-an-item/electrical-items">
            Recycle Now
          </ExternalLink>
          .
        </p>
      ),
    },
  ],
})

export default weee
