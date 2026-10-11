# Script 11: Closing a trade account

- **Length:** about 2 minutes
- **You need:** an approved test trade application (script 6, Part A).
- **Where:** menu → **Orders** → **Trade** tab → **Approved** → open the application (address `/app/trade-applications/<id>`).
- **Status:** checked against the admin code on 2026-10-11.
- **Goal:** take trade prices away from a business that should no longer have them, tell them why, and let them apply again later.

---

### Scene 1 (0:00-0:30) Find the account

**Tap:** menu → **Orders** → **Trade** → **Approved**. Open the business.

**You'll see:** the company name with a green **Approved** badge, the details, and at the bottom: "Approved. This customer sees trade prices when logged in.", "Closing the account takes trade prices away straight away; the customer is emailed and can apply again later.", and a **Close trade account** button.

**Say:** "A business closes, stops trading with us, or turned out not to be a business at all. Then I close the trade account. From that moment they pay the same prices as everyone else."

### Scene 2 (0:30-1:30) Close it

**Tap:** **Close trade account**.

**You'll see:** a panel "Close the trade account for Acme Phones Ltd?", a note that they go back to retail prices as soon as you confirm and get an email, a **Reason (optional)** box, and the buttons **Keep it open** and **Close account and email**.

**Tap:** write a short, polite reason if you want one in the email, e.g. "The business has closed" or "No trade orders in the last year". Then **Close account and email**.

**You'll see:** "Trade account for Acme Phones Ltd closed." The badge is now grey: **Trade account closed**. Below the details, "Reason given" shows what you wrote, and "Trade account closed. The customer pays retail prices and can apply again."

**Say:** "The customer gets a plain email: the account is closed, the reason if I gave one, and that they can apply again. Their basket, if they had one open, is priced at retail too."

### Scene 3 (1:30-2:00) Where closed accounts are

**Tap:** back to **All trade applications** → **Closed**.

**You'll see:** every closed account. A closed application has no buttons: if the business should get trade prices again, they apply again on the website and you approve the new application (script 6).

---

## What can go wrong

| On the screen | What it means and what to do |
|---|---|
| No **Close trade account** button | Only an approved application has one. A waiting one is rejected instead (script 6); a rejected or closed one needs no action. |
| An error in the panel after pressing | Nothing changed. Read the message; press **Keep it open**, refresh the page and look at the badge. If it still says **Approved**, try again. |
| You closed the wrong account | There is no undo. Ask the business to apply again on the website (two minutes) and approve it. Tell them it was your mistake. |

## Rules to remember

- Closing is immediate and emails the customer. Decide first, then press.
- The reason goes to the customer word for word. Keep it short and polite.
- A closed business can apply again; a rejected one too.
