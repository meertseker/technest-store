# Script 9: Delivery orders, "Packed & shipped"

- **Length:** about 3 minutes
- **You need:** a test delivery order (place one on the website with a delivery option, paid with a test card), and your phone logged in to admin.technestlondon.co.uk.
- **Where:** menu → **Orders** → **Delivery** tab (address `/app/shop-orders?tab=delivery`). The same cards also show on **Today** under "delivery orders to pack".
- **Status:** checked against the admin code on 2026-10-11.
- **Goal:** pack the parcel, hand it to the carrier, press one button; the customer gets the "on its way" email, with the tracking number if you typed one.

---

### Scene 1 (0:00-0:30) The Delivery tab

**Tap:** menu → **Orders** → **Delivery**.

**You'll see:** "Delivery orders", "Pack the parcel, hand it to the carrier, then press Packed & shipped. Updates every minute.", a **Refresh** button, and two buttons: **To pack** (with a number) and **Shipped**.

**Say:** "Delivery orders are paid by card the moment they are placed; I never press anything for the money. My job is to pack them and tell the system when the parcel has left."

### Scene 2 (0:30-1:15) Read a card

**You'll see:** cards, oldest first. Each card shows **Order #1043**, "Placed 2 hours ago", the customer's name and postcode, the items ("2 x USB-C cable (1 m)"), **Total £24.98 inc. VAT and delivery**, and the **Packed & shipped** button.

Some cards carry a badge:

- **Payment not taken** (red): the card was not charged yet. The button is switched off and the card says why. Don't send the parcel. The shop retries the payment by itself; if the badge is still there after an hour, open the order and take the payment there, or call the customer.
- **Refunded** (grey): the money went back in full. Nothing to send.
- **Part of this order has left**: some items were already sent (from Medusa's order page). The button sends the rest.

**Say:** "Oldest at the top. Red badge means the money isn't in: that one waits."

### Scene 3 (1:15-2:15) Pack it and press the button

**Tap:** pack the parcel. Hand it to the carrier. Then **Packed & shipped**.

**You'll see:** a box "Mark order #1043 as shipped?", "Only press this once the parcel is with the carrier…", two optional fields, **Tracking number (optional)** and **Tracking link (optional)**, and the buttons **Not yet** and **Yes, it's shipped**.

**Tap:** type the carrier's tracking number if there is one (letters, numbers, spaces and dashes), paste the tracking link if the carrier gave one (it must start with `https://`), then **Yes, it's shipped**.

**You'll see:** "Order #1043 is on its way. The customer has been emailed." The card moves to **Shipped** with a green "Shipped …" badge.

**Say:** "The customer gets the 'your order is on its way' email straight away, with the tracking number and link if I typed them. If I press the button twice by mistake, nothing happens the second time: one parcel, one email."

### Scene 4 (2:15-3:00) Anything else about the order

**Tap:** **open the order** at the bottom of a card.

**Say:** "Address changes, refunds, cancelling: all of that is on the order page, script 8. The Delivery tab is only for packing and sending."

---

## What can go wrong

| On the screen | What it means and what to do |
|---|---|
| **Payment not taken** badge; button off; "The payment hasn't been taken yet, so this can't be sent…" | The card was not charged. Wait (the shop retries), or open the order and take the payment there. Don't send the parcel. |
| **Refunded** badge; button off | Refunded in full. Nothing to send. If that is wrong, open the order. |
| "Order … is being updated. Refresh in a moment." | Someone (or the payment) is working on the same order right now. Wait a few seconds and press **Refresh**. |
| "A tracking number has only letters, numbers, spaces and dashes (up to 64)." | Check the number; remove anything else. |
| "The tracking link must start with https:// and be under 500 characters." | Paste the full link from the carrier, or leave the link empty and keep only the number. |
| "Add the tracking number as well, or clear the link." | A link on its own is not enough. |
| "… is a Click & Collect order. Use the Collect tab." | Wrong tab: that order is collected in the shop (script 3). |
| The card is still in **To pack** after pressing | Press **Refresh**. If it is still there, the message above the button says why. |

## Rules to remember

- Press **Packed & shipped** only once the parcel is with the carrier. The email goes out at once and cannot be unsent.
- Never send a parcel whose card shows **Payment not taken**.
- Tracking is optional, but if you have a number, type it: it saves a "where is my order?" call.
- Refunds, cancelling and address changes: the order page (script 8), never Stripe.
