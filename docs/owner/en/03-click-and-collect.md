# Script 3: The Click & Collect board

- **Length:** about 5 minutes
- **You need:** your phone, logged in to admin.technest.co.uk; a **test** Click & Collect order (place one on the website with a test card before recording, choosing Click & Collect at checkout). Never use a real customer's order.
- **Where:** menu → **Click & Collect** (address `/app/click-collect`).
- **Status:** checked against the finished admin code on 2026-09-30.

---

### Scene 1 (0:00-0:30) What the board is for

**Tap:** menu → **Click & Collect**.

**You'll see:** "Updates every minute. Last updated …", a **Refresh** button, and three buttons on a phone: **To pick**, **Ready**, **Collected**, each with a number. (On a laptop the three are side by side.)

**Say:** "Customers who choose Click & Collect pay nothing for delivery and pick up here. Every order goes To pick, then Ready, then Collected. The board refreshes itself every minute."

### Scene 2 (0:30-1:15) Read an order card

**Tap:** **To pick**.

**You'll see:** cards, oldest first. Each card shows **Order #1042**, "Placed 2 hours ago", "The collection code is made when you press Mark ready.", the customer's name, the items (for example "2 x USB-C cable (1 m)"), and **Total £9.98 inc. VAT**.

**Say:** "Start with the oldest at the top. Pick the items from the shelf. Check the colour and the model: a case for a 16 Pro is not a case for a 16."

### Scene 3 (1:15-2:15) Mark ready

**Tap:** pack the bag, then tap **Mark ready** on the card.

**You'll see:** "Order #1042 is ready. Code K7MQ2X." The card moves to **Ready** and shows the **Collection code** in big letters.

**Say:** "The customer now gets an email: your order is ready, with the code, our address and today's opening hours. I write the order number and name on the bag and put it behind the counter. If I tap Mark ready twice, nothing bad happens: one code, one email."

### Scene 4 (2:15-3:30) The customer arrives

**Tap:** **Ready**. Find the order. Ask the customer for their name and code.

**Tap:** **Collected**.

**You'll see:** a question: "Hand over order #1042?" "Check the code K7MQ2X with the customer first. Pressing Collected takes the payment of £9.98 from their card." Buttons: **Not yet** and **Yes, collected**.

**Tap:** **Yes, collected**.

**You'll see:** "Order #1042 collected. Payment taken." The card moves to **Collected**.

**Say:** "This matters: the card is only charged when I press Collected. Until then the money is only held. So I press it when the bag leaves the shop, not before, and I never forget it."

### Scene 5 (3:30-4:30) Orders nobody collects

**You'll see:** on a Ready card: **Reminder: Not sent yet (sent 3 days after ready)**, or later **Sent …** and an orange badge "Reminder sent. Cancelled automatically 7 days after ready."

**Say:** "Three days after Ready the customer gets a reminder email by itself. After seven days the order is cancelled by itself, the hold on the card is released, and the customer gets a cancellation email. They're not charged. Cancelled orders disappear from the board: I put the items back on the shelf."

### Scene 6 (4:30-5:00) Wrap up

**Say:** "To pick, pack, Mark ready. At the counter: check the code, then Collected. I look at this board every morning and again during the day."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "Payment could not be captured…" | The card company refused the payment. Nothing was taken; the order stays in Ready. Ask the customer to pay at the till, or press **Collected** again later. The shop gets a copy of the "payment failed" email. |
| A message that starts "Payment captured but…" | The money **was** taken, but a later step failed. **Nothing is refunded.** Press **Collected** again: it finishes the rest without charging twice. If it keeps happening, show the message to the lead. |
| A red box and "Refresh the board and try again." | Someone else (or a double tap) was working on the same order. Tap **Refresh**, then try again. |
| Collected is refused ("not allowed") | The order is cancelled, not marked ready yet, or the card hold has ended (for example after 7 days). Don't hand over goods unpaid: take payment at the till or ask them to order again. |
| The code doesn't match | Don't hand over the bag. Check the name and order number, and ask to see the email. |
| Pressed Collected too early | The card was charged. Don't press anything else. If the customer never takes the goods, refund from the order page (script 8). |
| An order is missing from the board | Cancelled orders never show here. Look under **Orders**. |
| **Collected** shows only the latest 20 | "Showing the latest 20 of …". Older ones are under **Orders**. |

## Rules to remember

- Payment is taken only when you press **Collected**.
- Always check the collection code at the counter.
- Reminder email 3 days after Ready. Automatic cancel and card hold released 7 days after Ready.
- Click & Collect is always free. £1 add-on items on their own are fine for Click & Collect.
- Refunds are made from the admin order page, never from the Stripe website (script 8).
