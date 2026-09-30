# Script 4: Devices, and "Fits these devices"

- **Length:** about 5 minutes
- **You need:** your phone or laptop, logged in to admin.technest.co.uk; a test product (for example a phone case); a made-up test device to add and delete afterwards.
- **Where:** menu → **Devices** (address `/app/devices`), and the **Fits these devices** box on each product page.
- **Status:** checked against the finished admin code on 2026-09-30.

---

### Scene 1 (0:00-0:30) Why devices matter

**Tap:** open the website, pick a phone in the device picker.

**Say:** "Customers pick their phone or console once, then only see things that fit it. That only works if two lists are right: the list of devices, and the devices linked to each product."

### Scene 2 (0:30-1:15) The Devices page

**Tap:** menu → **Devices**.

**You'll see:** "Devices" with an **Add device** button, a **Search** box ("Model, web address name or model number"), and buttons **All**, **Phone**, **Tablet**, **Games console**, **Laptop**. Each row shows the model (for example "iPhone 16 Pro"), then "Apple · iPhone 16 · 2024", and "Also: 16 pro, A3102" for the other names.

**Tap:** type "a3102" in Search to show that model numbers work too.

### Scene 3 (1:15-2:30) Add a device

**Tap:** **Add device**.

**You'll see:** "Add a device" with the fields **Brand**, **Series**, **Model**, **Kind of device**, **Other names (optional)**, **Year released (optional)**, **Web address name (optional)**, **Picture web address (optional)**.

**Tap:** fill Brand `Apple`, Series `iPhone 16`, Model `iPhone 16 Pro`, Kind `Phone`, Other names `16 pro, A3102`, Year `2024`. Leave the web address name empty. Tap **Add device**.

**You'll see:** "iPhone 16 Pro added."

**Say:** "Use the maker's exact model name. In Other names I put what customers might type, separated by commas, including the model number from the box. The web address name is made for me."

### Scene 4 (2:30-3:15) Edit or delete

**Tap:** the device in the list.

**You'll see:** "Edit iPhone 16 Pro", the same fields, a list **Products that fit**, and **Delete device** at the bottom.

**Tap:** change an other name, tap **Save** ("… saved."). Then, for the test device only: **Delete device** → "Delete …? It is linked to 3 products. Those links are removed too. This can't be undone." → **Delete**.

**Say:** "Deleting a device also removes it from every product. Only delete one you added by mistake. And don't change the web address name of a real device: old links to it stop working."

### Scene 5 (3:15-4:30) "Fits these devices" on a product

**Tap:** **Products** → open the test case → find the **Fits these devices** box (on a laptop it's in the right-hand column).

**You'll see:** the linked devices with a **Remove** button each, or "No devices linked. Customers won't see this product when they pick a device."

**Tap:** **Add**. In "Link devices to …", search "16", tick **iPhone 16** and **iPhone 16 Plus**. In **Note for customers (optional)** type "Not compatible with MagSafe". Tap **Link 2 devices**.

**You'll see:** "2 devices linked." Both appear in the box with the note under them.

**Tap:** **Remove** next to one of them ("… removed.").

**Say:** "The note goes on every device I tick in that go, and customers see it next to the device. Ticking a device that is already linked replaces its note. If I'm not sure a product fits, I don't tick it: a wrong fit means a return."

### Scene 6 (4:30-5:00) Wrap up

**Say:** "When a new phone comes out, add it under Devices with its model number. On each product, link only what it really fits. Quick add suggests devices too, so most of the time it's already done."

---

## What can go wrong

| You see | What it means / what to do |
|---|---|
| "A device with slug iphone-16-pro already exists" | That device is already there. Search for it first. |
| "Use lowercase letters, numbers and dashes only…" | Leave **Web address name** empty; it's made for you. |
| "No devices match. Add new ones under Devices." (in the product box) | The device isn't in the list yet. Add it on the Devices page first. |
| A customer can't find their phone | Add the words they typed (often a model number) to **Other names**. |
| A product doesn't show for a phone | Check **Fits these devices** on the product, and that the product is published. |
| Deleted a device by mistake | Add it again, then link it again on each product. Links don't come back by themselves. |

## Rules to remember

- Only link devices the product really fits.
- Maker's model name in **Model**; other names and model numbers in **Other names**.
- Deleting a device removes it from all products.
