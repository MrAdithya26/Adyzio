# Adyzio deals page – v2 design

New homepage design for adyzio.com: store offer cards with the festive light string, product cards with store logos, Buy Now and share buttons (WhatsApp, Telegram, email, copy link), a 272-store directory, filters, wishlist and an English/Telugu switch.

Open `index.html` in a browser to see it. Products and offers in it are **samples**; the store list and logos are real (from the ExtraPe "All Stores" page, 2 Nov 2026).

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Edit the `EDIT HERE` block in the script for products, `OFFERS` for store offers, `STORE_LINKS` for each store's affiliate link, `CONFIG` for Telegram/WhatsApp links. |
| `assets/stores.js` | All 272 stores: key, name, group (shopping / travel / finance / services), network (amazon / extrape) and logo (inlined). |
| `assets/stores/*.png` | The same logos as separate PNG files, for the PHP site (`/assets/stores/<key>.png`). |
| `../../data/extrape-stores.csv` | Store list as a spreadsheet, with an empty `affiliate_link` column to fill. |

## Product fields

`t` title · `s` store key · `cat` category · `price` / `mrp` (null → "Check latest price") · `type` loot / today / drop · `ends` ISO end time · `good` who it suits · `check` things to verify · `link` your affiliate link · `img` product image URL · `slug` matches `/product/<slug>` on adyzio.com.

## Rules kept in the design

- Affiliate disclosure (English + Telugu) in the footer and in every Details pop-up; all buy links use `rel="sponsored nofollow"`.
- Shared links point to adyzio.com pages with `?src=whatsapp|telegram|email|copy`, never to raw Amazon affiliate links.
- ExtraPe commission ("Earn up to X%") is never shown to shoppers.
- ExtraPe forbids Google Ads and brand bidding on its stores.

## Next step

Move this layout into the PHP site templates (deploy/adyzio branch) so products and offers come from the admin panel.
