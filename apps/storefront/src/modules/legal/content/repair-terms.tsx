import { LegalName, Pending, ShopAddress, ShopPhone, TextLink } from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

const repairTerms: LegalContentFn = () => ({
  summary: (
    <p>
      These terms apply when <LegalName /> (Tech Nest) repairs your phone, tablet, console or
      computer. We always agree the price with you before we start.
    </p>
  ),
  sections: [
    {
      id: "booking",
      heading: "Booking a repair",
      body: (
        <p>
          When you send a repair request on this website, we call you back to talk about the
          fault and give you a price and an estimated time. A request is not a contract and
          you do not pay anything online. The repair contract starts when you hand the device
          over in the shop and agree the quote.
        </p>
      ),
    },
    {
      id: "quote",
      heading: "Quotes and diagnosis",
      body: (
        <>
          <p>
            We give you a quote before we start. If we find another problem once we open the
            device, we will contact you and will not do extra work or charge more without
            your agreement.
          </p>
          <p>
            Diagnosis: <Pending label="free, or a fixed diagnostic fee" />. If you decide not
            to go ahead, we return the device in the condition you gave it to us, as far as
            the fault allows.
          </p>
        </>
      ),
    },
    {
      id: "before-you-hand-over",
      heading: "Before you hand over your device",
      body: (
        <ul>
          <li>
            Back up your data. Repairs do not normally affect your data, but some faults and
            repairs can erase it, and we cannot be responsible for data that was not backed
            up.
          </li>
          <li>
            Remove your SIM and memory cards, and any case or screen protector you want to
            keep.
          </li>
          <li>
            We may need to test the device after the repair. We will ask you to unlock it in
            front of us, or for a passcode only if you are happy to give it. We never access
            your photos, messages or accounts.
          </li>
        </ul>
      ),
    },
    {
      id: "parts",
      heading: "Parts",
      body: (
        <p>
          We will tell you before the repair whether we are using an original manufacturer
          part or a compatible part, and the price of each where both are available. Some
          phones show a message such as &ldquo;unknown part&rdquo; after a screen or battery
          is replaced by an independent repairer. This does not affect how the part works.
          Parts we replace are recycled responsibly unless you ask to keep them.
        </p>
      ),
    },
    {
      id: "guarantee",
      heading: "Our repair guarantee",
      body: (
        <>
          <p>
            We guarantee the parts we fit and our work for{" "}
            <Pending label="repair guarantee period, e.g. 90 days" />. If the same fault comes
            back in that time, we will fix it free.
          </p>
          <p>
            The guarantee does not cover new damage after the repair, such as drops, cracks
            or liquid, or repairs by someone else. Liquid-damaged devices can develop new
            faults, so we cannot guarantee them beyond the part we replaced.
          </p>
          <p>
            By law, we must carry out the repair with reasonable care and skill (Consumer
            Rights Act 2015). If we do not, you can ask us to redo the work, or for a price
            reduction if that is not possible. Our guarantee is in addition to these rights.
          </p>
        </>
      ),
    },
    {
      id: "warranty",
      heading: "Manufacturer warranty",
      body: (
        <p>
          Opening a device can affect a manufacturer&rsquo;s warranty or insurance. If your
          device is still under warranty, check with the manufacturer or your insurer first.
        </p>
      ),
    },
    {
      id: "collection",
      heading: "Collecting your device and paying",
      body: (
        <>
          <p>
            We call or message you when your device is ready. You pay when you collect it, at{" "}
            <ShopAddress />.
          </p>
          <p>
            Please collect within <Pending label="collection period, e.g. 30 days" />. If you
            do not, we will contact you at least twice. After{" "}
            <Pending label="final period, e.g. 90 days" /> and a final written notice, we may
            sell or recycle the device to cover the repair cost, as the Torts (Interference
            with Goods) Act 1977 allows, after wiping any data on it.
          </p>
        </>
      ),
    },
    {
      id: "questions",
      heading: "Questions and complaints",
      body: (
        <p>
          Call <ShopPhone /> or visit the shop. See our{" "}
          <TextLink href="/legal/privacy">privacy notice</TextLink> for how we handle the
          details you give us.
        </p>
      ),
    },
  ],
})

export default repairTerms
