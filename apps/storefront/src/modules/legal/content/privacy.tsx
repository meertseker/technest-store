import {
  ExternalLink,
  IcoNumber,
  LegalName,
  Pending,
  ShopAddress,
  ShopEmail,
  ShopPhone,
  TextLink,
} from "@modules/legal/components/facts"
import type { LegalContentFn } from "@modules/legal/types"

const privacy: LegalContentFn = () => ({
  summary: (
    <p>
      We only collect what we need to sell you things, repair your devices and run a trade
      account. We never sell your data, and we do not use advertising or tracking cookies.
    </p>
  ),
  sections: [
    {
      id: "who-we-are",
      heading: "Who is responsible for your data",
      body: (
        <p>
          <LegalName />, trading as Tech Nest, <ShopAddress />, is the controller of your
          personal data under UK data protection law (the UK GDPR and the Data Protection Act
          2018). Our ICO registration number is <IcoNumber />. Contact us about your data by
          email at <ShopEmail />, by phone on <ShopPhone />, or by post at the address above.
        </p>
      ),
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      body: (
        <ul>
          <li>
            <strong>Orders</strong>: your name, email, phone number, delivery and billing
            address, what you bought and how you chose to receive it.
          </li>
          <li>
            <strong>Payments</strong>: handled by Stripe. We receive a payment reference and may see
            the card type and last four digits, never your full card number.
          </li>
          <li>
            <strong>Your account</strong>: your login email, a securely hashed password,
            saved addresses and the devices you told us you own.
          </li>
          <li>
            <strong>Trade applications</strong>: your business name and details, VAT number
            if you have one, and contact details.
          </li>
          <li>
            <strong>Repair bookings</strong>: your contact details, the device, the fault and
            your preferred time.
          </li>
          <li>
            <strong>Technical data</strong>: your IP address and browser details in our
            server and security logs, and the cookies described in our{" "}
            <TextLink href="/legal/cookies">cookie policy</TextLink>.
          </li>
        </ul>
      ),
    },
    {
      id: "why",
      heading: "Why we use it, and our legal basis",
      body: (
        <ul>
          <li>
            To take, deliver and support your order, run your account, handle a repair
            booking or trade application, and deal with returns: <em>to perform our contract
            with you</em>, or to take steps you asked for before one.
          </li>
          <li>
            To keep accounting and tax records: <em>legal obligation</em>.
          </li>
          <li>
            To prevent fraud and keep the website secure: <em>our legitimate interests</em>.
          </li>
          <li>
            To send order and account emails (confirmations, collection reminders, password
            resets): <em>contract</em>. We do not send marketing emails.
          </li>
          <li>
            Any optional cookies: <em>your consent</em>, which you can withdraw at any time.
          </li>
        </ul>
      ),
    },
    {
      id: "sharing",
      heading: "Who we share it with",
      body: (
        <>
          <p>
            We share only what each service needs, under contracts that protect your data:
          </p>
          <ul>
            <li>Stripe, which processes card, Apple Pay and Google Pay payments;</li>
            <li>
              Klarna, if you choose to pay with Klarna. Klarna is responsible for the data it
              uses for its own checks;
            </li>
            <li>
              <Pending label="courier or Royal Mail" />, to deliver your order (name, address,
              and phone or email for delivery updates);
            </li>
            <li>Hetzner, which hosts our website and database in the EU;</li>
            <li>
              Cloudflare, which protects and speeds up the website and runs the Turnstile
              check on our forms.
            </li>
            <li>
              Sentry, which receives reports when part of the website breaks, so we can fix
              it. Names, emails, addresses, phone numbers and payment details are removed
              before a report is sent, and it is never used on the checkout page. Reports are
              stored in <Pending label="Sentry data region (EU or US)" />.
            </li>
          </ul>
          <p>
            We send our emails from our own mail server. We may also share data where the law
            requires it, for example with HMRC or the police.
          </p>
        </>
      ),
    },
    {
      id: "transfers",
      heading: "Transfers outside the UK",
      body: (
        <p>
          Hetzner stores our data in the EU, which the UK recognises as giving adequate
          protection. Stripe and Cloudflare may process data in the United States; they do so
          under the UK&rsquo;s data bridge with the US or the ICO&rsquo;s international data
          transfer agreement.
        </p>
      ),
    },
    {
      id: "how-long",
      heading: "How long we keep it",
      body: (
        <ul>
          <li>Orders and invoices: 6 years after the end of the tax year, as HMRC requires.</li>
          <li>Your account: until you ask us to close it.</li>
          <li>
            Repair bookings: <Pending label="retention period, e.g. 2 years" /> after the
            repair.
          </li>
          <li>
            Trade applications that are not approved:{" "}
            <Pending label="retention period, e.g. 12 months" />.
          </li>
          <li>
            Server and security logs: <Pending label="log retention, e.g. 30 days" />.
          </li>
        </ul>
      ),
    },
    {
      id: "your-rights",
      heading: "Your rights",
      body: (
        <>
          <p>You have the right to:</p>
          <ul>
            <li>get a copy of your data;</li>
            <li>have wrong data corrected;</li>
            <li>have your data deleted, where we do not have to keep it by law;</li>
            <li>restrict or object to how we use it;</li>
            <li>receive your data in a portable format;</li>
            <li>withdraw consent at any time, where we rely on consent.</li>
          </ul>
          <p>
            Contact us to use any of these rights. We will reply within one month. It is
            free.
          </p>
        </>
      ),
    },
    {
      id: "complaints",
      heading: "Complaints",
      body: (
        <p>
          If you are unhappy with how we use your data, please tell us first. You can also
          complain to the Information Commissioner&rsquo;s Office on 0303 123 1113 or at{" "}
          <ExternalLink href="https://ico.org.uk/make-a-complaint/">ico.org.uk</ExternalLink>.
        </p>
      ),
    },
  ],
})

export default privacy
