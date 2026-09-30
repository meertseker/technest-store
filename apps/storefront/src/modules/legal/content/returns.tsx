import {
  LegalName,
  Pending,
  ShopAddress,
  ShopEmail,
  ShopHours,
  ShopPhone,
  TextLink,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

/** The model cancellation form, Consumer Contracts Regulations 2013, Schedule 3 Part B */
function ModelCancellationForm() {
  return (
    <div className="mt-4 rounded border border-border-strong p-4 sm:p-6">
      <h3 className="!mt-0">Model cancellation form</h3>
      <p>(Complete and return this form only if you wish to cancel the contract.)</p>
      <p>
        To: <LegalName />, trading as Tech Nest, <ShopAddress />. Email: <ShopEmail />
      </p>
      <p>
        I/We [*] hereby give notice that I/We [*] cancel my/our [*] contract of sale of the
        following goods [*]/for the supply of the following service [*],
      </p>
      <p>Ordered on [*]/received on [*],</p>
      <p>Name of consumer(s),</p>
      <p>Address of consumer(s),</p>
      <p>Signature of consumer(s) (only if this form is notified on paper),</p>
      <p>Date</p>
      <p>[*] Delete as appropriate.</p>
    </div>
  )
}

const returns: LegalContentFn = () => ({
  summary: (
    <p>
      Changed your mind? You can cancel most online orders within 14 days of receiving them.
      Return the item by post, or bring it to our shop. Faulty items are covered separately
      and for longer.
    </p>
  ),
  sections: [
    {
      id: "right-to-cancel",
      heading: "Your 14-day right to cancel",
      body: (
        <>
          <p>
            If you bought online as a consumer, you can cancel your order without giving a
            reason. You have 14 days, starting the day after you receive the goods (or collect
            them from our shop). If your order came in more than one delivery, the 14 days
            start the day after the last item arrives. You can also cancel before the goods
            arrive.
          </p>
          <p>
            This right comes from the Consumer Contracts Regulations 2013. It applies to
            orders placed on this website, including Click &amp; Collect orders. It does not
            apply to things you buy in person in our shop, but see &ldquo;Returning an item to
            our shop&rdquo; below.
          </p>
        </>
      ),
    },
    {
      id: "how-to-cancel",
      heading: "How to cancel",
      body: (
        <>
          <p>Tell us clearly that you want to cancel, before the 14 days end. You can:</p>
          <ul>
            <li>
              call us on <ShopPhone />;
            </li>
            <li>
              email us at <ShopEmail />;
            </li>
            <li>tell us in the shop; or</li>
            <li>use the model cancellation form below (you do not have to).</li>
          </ul>
          <p>Please give your name and your order number.</p>
        </>
      ),
    },
    {
      id: "sending-back",
      heading: "Sending the goods back",
      body: (
        <>
          <p>
            Return the goods within 14 days of telling us you are cancelling. Post them to{" "}
            <ShopAddress />, or bring them to the shop. You pay the cost of posting them back,
            unless the item is faulty or not what you ordered. Please keep your proof of
            postage.
          </p>
          <p>
            You can handle the item as you would in a shop to see if it suits you. If it has
            been used more than that, or is damaged, we may reduce your refund to reflect the
            loss in value.
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      heading: "Your refund",
      body: (
        <>
          <p>
            We refund the price you paid and the cost of standard delivery, to your original
            payment method. If you chose a more expensive delivery option, such as next-day,
            we refund the cost of standard delivery only.
          </p>
          <p>
            We refund you within 14 days of receiving the goods back, or of you showing us
            proof you sent them, whichever is sooner. If you cancel before the goods are sent
            or collected, we refund you within 14 days of you telling us, or simply release
            the amount reserved on your card.
          </p>
        </>
      ),
    },
    {
      id: "exceptions",
      heading: "Items you cannot cancel",
      body: (
        <>
          <p>The right to cancel does not apply to:</p>
          <ul>
            <li>
              sealed items that are not suitable for return for health or hygiene reasons,
              once you have unsealed them (for example in-ear headphones and earbuds);
            </li>
            <li>items made or personalised to your specification.</li>
          </ul>
          <p>
            These items are still covered if they are faulty. Repairs are covered by our{" "}
            <TextLink href="/legal/repair-terms">repair terms</TextLink>.
          </p>
        </>
      ),
    },
    {
      id: "in-store",
      heading: "Returning an item to our shop",
      body: (
        <>
          <p>
            You can return online orders in person at <ShopAddress />. Bring the item and
            your order confirmation email. We will check the item and refund you to your
            original payment method.
          </p>
          <p>
            For things you bought in the shop, we will exchange or refund unwanted items
            returned unused within <Pending label="in-store returns period, e.g. 14 days" />{" "}
            with proof of purchase. This is our own policy, in addition to your legal rights.
          </p>
          <p>Our opening hours:</p>
          <ShopHours />
        </>
      ),
    },
    {
      id: "faulty",
      heading: "Faulty items",
      body: (
        <p>
          If an item is faulty or not as described, you have rights under the Consumer Rights
          Act 2015 that last longer than 14 days: a full refund within 30 days, then a repair
          or replacement. We pay the cost of returning faulty items. See &ldquo;If something is faulty&rdquo; in our{" "}
          <TextLink href="/legal/terms#faulty-goods">terms and conditions</TextLink>.
        </p>
      ),
    },
    {
      id: "cancellation-form",
      heading: "Model cancellation form",
      body: (
        <>
          <p>
            You can copy, print or email this form, but you do not have to use it. Any clear
            statement that you are cancelling is enough.
          </p>
          <ModelCancellationForm />
        </>
      ),
    },
  ],
})

export default returns
