# Script 1: Quick add, a new product from a photo

- **Length:** about 5 minutes
- **You need:** your phone, logged in to admin.technest.co.uk; one real accessory in its packet (a charger is best, so you can show the safety mark); a plain, light surface; good light. You can delete the test product afterwards.
- **Where:** menu → **Quick add** (address `/app/quick-add`).
- **Status:** checked against the finished admin code on 2026-09-30. Steps marked ⚠ use Medusa's own product page: check them once on the live admin before recording.
- **Goal:** photo to saved draft in about a minute, then publish from the product page.

---

### Scene 1 (0:00-0:30) What Quick add does

**Tap:** the menu button (top left), then **Quick add**.

**You'll see:** the title "Quick add", a big **Take photo** button, **Choose a photo**, and **Add without a photo**.

**Say:** "This is Quick add. I take one photo of a product. The system reads the photo and suggests the title, category, the phones it fits and the safety mark. I check everything, type the price, and save it as a draft. Nothing goes on the website until I publish it."

### Scene 2 (0:30-1:00) Take the photo

**Tap:** **Take photo**. The camera opens. Put the product on the plain surface, label facing you, and take the photo.

**You'll see:** your photo at the top, and a blue box: "Reading the photo… this takes up to half a minute. You can start typing meanwhile."

**Say:** "Whole product in the picture, label readable, plain background. The photo is uploaded as it is. That original is always kept."

### Scene 3 (1:00-2:00) Check the suggestion

**You'll see:** a purple **AI suggestion** badge, a **Confidence** badge (high, medium or low), the sentence "Check every field. The AI can be wrong…", maybe orange warnings, and the fields filled in: **Title**, **Description**, **Category**, **Product type**, **Fits these devices**.

**Tap:** change one word in the title. In **Fits these devices**, tap a wrong phone to remove it (it has a ✕), or type "16 pro" in the search and tap **+ Apple iPhone 16 Pro** to add one.

**Say:** "These are only suggestions. Low confidence means: read everything twice. The category decides where it shows in the shop. The devices decide who sees it after picking their phone, so only keep phones it really fits."

### Scene 4 (2:00-2:45) Price and safety mark

**You'll see:** **Price (£, incl. VAT)** is empty. Under it: "Suggested: £14.99 (an AI guess, not a rule)" and a **Use £14.99** button.

**Tap:** type your price, for example `12.99` (or tap **Use £…** if you agree). In **Safety marking**, read "AI saw: …", then look at the box yourself. Pick **UKCA**, **CE** or **No mark**. If you pick UKCA or CE, tick **I have checked the label: it shows the UKCA mark** (or CE).

**Say:** "The price is never filled in for me. I type it in pounds, VAT included. For the safety mark the system only guesses. I check the real label and tick the box. Chargers and power banks without UKCA or CE can be saved as a draft, but they can't be published."

### Scene 5 (2:45-3:15) Stock and SKU

**Tap:** open **More details (SKU, stock, connectors)**. Set **Stock in the shop** (it starts at 1). Add your **SKU** if you use one. Connectors and wattage are optional.

**Tap:** **Save as draft**.

**You'll see:** a message "… saved as a draft".

### Scene 6 (3:15-4:00) The clean photo

**You'll see:** "Saved as a draft. Now the photo…", your original on one side and "Cleaning up the background…" on the other, then the white-background photo (usually 5 to 15 seconds).

**Tap:** check the edges of the product in the clean photo. If it's right, tap **Use this photo**. If not, tap **Skip for now** (you can do it later on the product page, script 2).

**Say:** "Only the background changes. The product is never drawn or changed, and my original is kept."

### Scene 7 (4:00-4:45) Publish ⚠

**You'll see:** "… is saved as a draft. Check it on the product page, then publish it there when it is ready." and two buttons: **Open product** and **Add another product**.

**Tap:** **Open product**. On the product page, open the menu (⋯) at the top, tap **Edit**, set **Status** to **Published**, and **Save**. ⚠

**Say:** "Now it's on the website. If it's a charger without a safety mark, publishing is refused with a message that says why."

### Scene 8 (4:45-5:00) Wrap up

**Say:** "Photo, check the suggestion, price, safety mark, stock, save. Then the photo, then publish. About a minute per product."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "AI suggestions are switched off (ANTHROPIC_API_KEY is not set). You can still add products by hand." | The AI key is not set on the server. Type the details yourself. Tell the lead. |
| An orange box after the photo (for example "too many requests", "busy", "timed out") | The AI didn't answer. The form stays. Type the details yourself, or try again later. Each person can have about 60 photos read per hour. |
| "This looks like a vape product. Vapes are never sold online, so it can't be added." | Correct: vapes are never sold online. |
| "Enter the selling price in pounds, e.g. 12.99." / "Use at most 2 decimals…" | Type pounds, not pence: `12.99`, not `1299`. |
| "Check the UKCA mark on the label, then tick the box." | You chose UKCA or CE but didn't tick the box. |
| "This photo is larger than 25 MB…" | Lower the camera resolution, or send a smaller photo. |
| "Photo too small, please retake closer" / "The product is too small in the photo, please retake closer" | Move closer and take it again. |
| "No product found in the photo, please retake it against a plain background" | Use a plain, light background. |
| The product saves but the clean photo fails | The product is safe as a draft. Tap **Try again**, or **Skip for now** and use the photo box later. |
| Publishing a charger is refused: "… needs a safety marking (UKCA or CE) before it can be published…" | Check the box for the mark. Fix it with a CSV import (script 7), then publish. |
| SKU refused | That SKU is already used by another product. |

## Rules to remember

- Quick add always saves a **draft**. You publish on the product page.
- Prices are in pounds and include VAT. The suggested price is only a guess.
- You confirm the safety mark by looking at the label. Chargers and power products need UKCA or CE to be published.
- Vapes are never sold online.
- Quick add has no "add-on item" switch. £1 add-ons are set with a CSV import (script 7). [LEAD?]
