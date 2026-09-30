# Script 6: Trade applications and repair bookings

- **Length:** about 5 minutes
- **You need:** your phone, logged in to admin.technest.co.uk; two **test** trade applications (sent from the website's trade form with two test customer accounts) and one **test** repair booking (sent from the website's repair form with your own phone number).
- **Where:** menu → **Trade applications** (`/app/trade-applications`) and **Repair bookings** (`/app/repair-bookings`).
- **Status:** checked against the finished admin code on 2026-09-30. Steps marked ⚠ use Medusa's own screens.

---

## Part A: Trade applications (0:00-2:30)

### Scene 1 (0:00-0:30) The list

**Tap:** menu → **Trade applications**.

**You'll see:** "Businesses asking for trade prices…", and the buttons **Waiting**, **Approved**, **Rejected**, **All**. **Waiting** is open, oldest first.

**Say:** "Businesses, like other repair shops, apply for a trade account on the website. I also get an email for each one. Once I approve them, they see trade prices, ex VAT, when they're logged in."

### Scene 2 (0:30-1:15) Check an application

**Tap:** open the first application.

**You'll see:** the company name, a badge **Waiting for review**, and **Business type**, **VAT number**, **Companies House number**, **Contact**, **Phone**, **Email**, **Customer account**.

**Say:** "I check it's a real business. I can look up the Companies House number on the government website."

### Scene 3 (1:15-1:45) Approve

**Tap:** **Approve** → "Approve …? They will see trade prices when they log in, and we'll email them to say so." → **Approve**.

**You'll see:** "… approved." and "Approved. This customer sees trade prices when logged in."

### Scene 4 (1:45-2:30) Reject, with a reason

**Tap:** open the second application → **Reject**.

**You'll see:** "Reject …" with a **Reason** box and the hint "The customer sees this in their email…".

**Tap:** type "We couldn't find your company on Companies House. Please check the number and apply again." → **Reject and email**.

**You'll see:** "… rejected." and "Rejected. The customer can send a new application."

## Part B: Repair bookings (2:30-4:30)

### Scene 5 (2:30-3:00) The list

**Tap:** menu → **Repair bookings**.

**You'll see:** "Repair requests from the website. Call the customer back, then mark it booked in." and the buttons **To call back**, **Booked in**, **Done**, **All**. **To call back** is open, longest-waiting first. The list refreshes every minute.

### Scene 6 (3:00-4:00) Call and book in

**Tap:** open the test booking.

**You'll see:** the device as the title, "Sent … (2 hours ago)", **Name**, **Phone**, **Email**, **Device**, **What's wrong**, **Best time to call**, then **Status** with three big buttons (**To call back**, **Booked in**, **Done**) and **Staff notes**.

**Tap:** the phone number: your phone starts the call. Agree a price and a time. Back in the admin, type in **Staff notes** "Screen £89, Sat 11:00", tap **Save notes** ("Notes saved."). Tap **Booked in** ("Marked as booked in.").

**Say:** "Only staff see the notes. The customer never does."

### Scene 7 (4:00-4:30) Done

**Tap:** when the repair is finished and collected, tap **Done**. If you pressed it by mistake, tap **Booked in** again.

### Scene 8 (4:30-5:00) Wrap up

**Say:** "Check both lists every day. Approve real businesses; always give a clear reason when rejecting. Call repair customers back the same day if possible."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| Reject won't go through | The reason is empty. Write one. |
| Approve or Reject is refused | Someone already approved or rejected it. Reload the page. |
| Approved the wrong business | There is no undo button. Remove the customer from the **Trade** customer group (menu → **Customers** → the customer → groups) ⚠, then tell the lead. |
| An approved trade customer sees no trade prices | Trade prices exist only for products that have them in the **Trade** price list (menu → **Pricing**) ⚠. Trade prices there are entered **VAT included, in pounds**; the website shows them ex VAT. [LEAD?] who enters them |
| Tap-to-call does nothing on a laptop | Use your phone, or type the number. |
| A customer says nobody called | Look in **To call back**. Move everyone you called to **Booked in**. |
| No repair bookings arrive at all | The website form checks for robots (Cloudflare Turnstile). If it's not set up on the server, every booking is refused. Tell the lead. |

## Rules to remember

- Approve is one tap plus a confirm. Rejecting always needs a reason, and the customer gets it by email.
- Trade customers see prices ex VAT, clearly labelled.
- Repair bookings: To call back → Booked in → Done. Notes are for staff only.
- Never share a customer's phone number or email outside the shop.
