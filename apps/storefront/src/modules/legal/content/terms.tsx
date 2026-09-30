import {
  CompanyNumber,
  LegalName,
  ShopAddress,
  ShopEmail,
  ShopPhone,
  TextLink,
  VatNumber,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

const terms: LegalContentFn = ({ klarnaMinimum }) => ({
  summary: (
    <p>
      These terms apply when you order from this website, for delivery or for Click &amp;
      Collect. They do not take away any of your legal rights as a consumer.
    </p>
  ),
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      body: (
        <>
          <p>
            This website is run by <LegalName />, trading as Tech Nest (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;). Our shop is at <ShopAddress />.
          </p>
          <ul>
            <li>
              Company number: <CompanyNumber />
            </li>
            <li>
              VAT number: <VatNumber />
            </li>
            <li>
              Phone: <ShopPhone />
            </li>
            <li>
              Email: <ShopEmail />
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "ordering",
      heading: "Placing an order",
      body: (
        <>
          <p>
            The contract between us starts when we email you to confirm your order. If we
            then find we cannot supply an item (for example, it has sold out in the shop) or
            the price shown was an obvious mistake, we will contact you, cancel that item and
            refund you in full, or release the amount reserved on your card.
          </p>
          <p>
            You must be 18 or over to place an order. We sell to customers in the United
            Kingdom only.
          </p>
        </>
      ),
    },
    {
      id: "prices",
      heading: "Prices and payment",
      body: (
        <>
          <p>
            Prices are in pounds sterling and include VAT. Delivery costs are shown on the
            product page, in your basket and at checkout before you pay. Approved trade
            customers see prices without VAT, clearly labelled &ldquo;ex VAT&rdquo;; VAT is
            added at checkout.
          </p>
          <p>
            We take payment by card, Apple Pay and Google Pay, and by Klarna on baskets of{" "}
            {klarnaMinimum ?? "the minimum shown at checkout"} or more. Payments are handled by our payment provider, Stripe; we never see or store
            your full card number.
          </p>
          <p>
            When you order, your bank reserves the amount. For delivery orders we take the
            payment straight after we confirm the order. For Click &amp; Collect orders we take the
            payment when you collect. If a Click &amp; Collect order is not collected within 7
            days, we cancel it and the reserved amount is released.
          </p>
        </>
      ),
    },
    {
      id: "add-on-items",
      heading: "£1 and add-on items",
      body: (
        <p>
          Items marked &ldquo;add-on item&rdquo; (including our £1 range) can be bought with
          any order, but a delivery order cannot be made up of add-on items only. You can
          always buy add-on items on their own with free Click &amp; Collect, or in our shop.
        </p>
      ),
    },
    {
      id: "delivery",
      heading: "Delivery and collection",
      body: (
        <p>
          Delivery options, timescales and Click &amp; Collect are explained on our{" "}
          <TextLink href="/legal/delivery">delivery page</TextLink>. The goods are your
          responsibility once they are delivered to you (or to someone you named) or once you
          collect them. They become yours once we have received full payment.
        </p>
      ),
    },
    {
      id: "cancel-and-return",
      heading: "Your right to cancel and returns",
      body: (
        <p>
          You can cancel most online orders within 14 days of receiving them, without giving
          a reason. How to cancel, the exceptions and how refunds work are on our{" "}
          <TextLink href="/legal/returns">returns page</TextLink>, which also has a
          cancellation form you can use.
        </p>
      ),
    },
    {
      id: "faulty-goods",
      heading: "If something is faulty",
      body: (
        <>
          <p>
            By law, goods must be of satisfactory quality, fit for purpose and as described
            (Consumer Rights Act 2015). If they are not:
          </p>
          <ul>
            <li>within 30 days of delivery or collection, you can reject them for a full refund;</li>
            <li>
              after 30 days, you can ask for a repair or replacement, and if that does not
              work, a refund or price reduction;
            </li>
            <li>
              within 6 months, we will assume the fault was there when you received the item,
              unless we can show otherwise.
            </li>
          </ul>
          <p>
            Please contact us or bring the item to the shop. This is a summary of your rights;
            Citizens Advice has more detail.
          </p>
        </>
      ),
    },
    {
      id: "compatibility",
      heading: "Device compatibility",
      body: (
        <p>
          We show which devices each accessory fits based on the manufacturer&rsquo;s
          information and our own checks. If an item we said fits your device does not fit,
          that counts as the item not being as described, and you can return it for a full
          refund including delivery costs.
        </p>
      ),
    },
    {
      id: "trade",
      heading: "Trade customers",
      body: (
        <p>
          If you buy through a trade account for your business, the consumer rights above
          and on our returns page do not apply by law. We will still
          accept faulty goods back within 30 days for a replacement or refund, and we will
          discuss other returns case by case. Nothing here limits our liability for death or
          personal injury caused by our negligence, or for fraud.
        </p>
      ),
    },
    {
      id: "liability",
      heading: "Our responsibility to you",
      body: (
        <p>
          If we break these terms, we are responsible for loss or damage you suffer that is a
          foreseeable result of that. We are not responsible for loss that was not foreseeable,
          or for business losses when you buy as a consumer. We do not exclude or limit our
          liability where it would be unlawful to do so, including for death or personal
          injury caused by our negligence, for fraud, or for breach of your legal rights in
          relation to the goods.
        </p>
      ),
    },
    {
      id: "law",
      heading: "Complaints and the law that applies",
      body: (
        <>
          <p>
            If you have a problem, please call us on <ShopPhone /> or visit the shop and we
            will try to put it right quickly.
          </p>
          <p>
            These terms are governed by the law of England and Wales. You can bring
            proceedings in the courts of England and Wales, or, if you live in Scotland or
            Northern Ireland, in the courts where you live.
          </p>
          <p>
            We may update these terms. The terms that apply to your order are the ones shown
            on this page when you placed it.
          </p>
        </>
      ),
    },
  ],
})

export default terms
