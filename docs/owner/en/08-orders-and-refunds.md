# Script 8: Delivery orders, cancelling and refunds

- **Length:** about 4 minutes
- **You need:** your phone or laptop, logged in to admin.technestlondon.co.uk; a **test** delivery order placed with a test card before recording.
- **Where:** menu → **Orders** → **Delivery** tab → **open the order** on a card; or **All orders** (top right) for any order. The order page itself is Medusa's own.
- **Status:** navigation checked against the admin code on 2026-10-11. ⚠ Scenes 3 onwards use Medusa's own order page, which is not ours: the rules (who charges the card, where refunds are made) are checked against the code; the button names there are Medusa's and may differ slightly.

---

### Scene 1 (0:00-0:40) A new delivery order

**You'll see:** an email "New order #1043 · Delivery · £24.98" at hello@technestlondon.co.uk. (Click & Collect orders say "CLICK & COLLECT" in the subject: those go on the board, script 3.)

**Tap:** menu → **Orders** → **Delivery**. The order is on a card; tap **open the order** (or **All orders** at the top right, then #1043).

**Say:** "For delivery orders the card is charged by itself, right after the order is placed. I don't press anything for the payment."

### Scene 2 (0:40-1:45) Pack and ship

**Tap:** back on **Orders** → **Delivery**: pack the parcel, hand it to the carrier, press **Packed & shipped** on the card and type the tracking number if you have one (script 9). Medusa's **Fulfill items** and **Mark as shipped** on the order page still work, but the card is the quick way and refuses an order whose payment was not taken.

**Say:** "When I mark it as shipped, the customer gets the 'your order is on its way' email."

### Scene 3 (1:45-2:30) Cancelling an order ⚠

**Tap:** the order's menu (⋯) → **Cancel order**. ⚠

**Say:** "If a Click & Collect order hasn't been collected yet, the card was never charged: cancelling just releases the hold, and the customer gets a cancellation email. Uncollected orders are cancelled by themselves after 7 days anyway."

### Scene 4 (2:30-3:30) Refunds: only from the admin ⚠

**Tap:** in the order's **Payments** section, the payment's menu (⋯) → **Refund** → type the amount in pounds (for a part refund) or leave the full amount → confirm. ⚠

**You'll see:** the refund on the order. The customer gets an email with the amount and "5–10 working days".

**Say:** "Always refund here, in the admin. **Never** refund from the Stripe website: a Stripe refund doesn't reach our shop system, so the order would still look paid and the customer gets no email."

### Scene 5 (3:30-4:00) Wrap up

**Say:** "Delivery: the card is charged by itself; I pack, then mark as shipped. Click & Collect: the card is charged when I press Collected. Refunds: only from the order page in the admin."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "You cannot refund more than what is captured on the payment." | The card was never charged (for example a Click & Collect order not collected yet). Cancel the order instead: that releases the hold. |
| Refund refused, amount too high | You can refund at most what was paid, minus earlier refunds. |
| A "payment failed" email for a delivery order | The card was not charged. **Don't ship.** Contact the customer. [LEAD?] how to take payment again |
| A refund was made in Stripe by mistake | Tell the lead. The admin won't show it and the customer got no email from us. |

## Rules to remember

- Delivery orders: charged automatically after the order. Click & Collect: charged when you press **Collected**.
- Only the payment company's signed message marks an order as paid, never the customer's browser.
- Refunds: always from the admin order page, never from the Stripe dashboard.
