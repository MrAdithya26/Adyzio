# Deal Scraper & Affiliate Converter (Chrome extension)

Scrape products from Amazon, Flipkart, Myntra, Ajio, Meesho, Shopsy, Nykaa, Tata CLiQ, Snapdeal, JioMart, Croma, Reliance Digital, FirstCry, Purplle, Bewakoof, Lenskart, Pepperfry, Mamaearth, boAt, ExtraPe deal pages and almost any other shop into Excel. Product images go to your Google Drive **product images** folder (named after the product), and rows go into your Google Sheet using your deals template. Then convert every link into an affiliate link: **Amazon via SiteStripe (amzn.to)**, **all other stores via ExtraPe**.

## What it does

| Where | What |
|---|---|
| **Floating "₹ Affiliate" button** on every official store page | **Convert this link** (copied to clipboard) or **Scrape page → Excel** |
| **Popup → top card** | Convert the current page link directly |
| **Popup → Option 1: Scrape page** | Reads every product on the page (search/category/listing or a single product page), auto-scrolls to load more, saves images to Drive, adds rows to your Google Sheet, downloads Excel |
| **Popup → Option 2: Convert links** | Converts every scraped product link to an affiliate link and fills the **Affiliate Link** column in your Google Sheet (matched by Product Link) |
| **Popup → Upload your Excel / CSV of links** | Opens a page where you drop your own .xlsx/.xls/.csv. It finds the product-link column and converts every link. By default the output file is in the **deals template** format: your columns are matched by name (Title/Name → Product Title, Price, MRP, Image, Category…), and Store and Sr No are filled in. Choose "Keep my file's own columns" to write into your original layout instead. Rows that already have an affiliate link are skipped. Download the filled file, or also save it to your Drive Excel folder |
| **Popup → W: Wishlink profile → Excel** | Paste one or more Wishlink profile links (`https://www.wishlink.com/username`, one per line). **Export to Excel** reads *every* product in the profile through Wishlink's storefront API (not only what is on screen), follows each Wishlink link to the real store page, and writes one Excel per profile in the deals template. **Export with affiliate links** does the same and then converts every product link (Amazon → SiteStripe, others → ExtraPe) and downloads `..._affiliate.xlsx`. "Scrape this page" on an open Wishlink profile also works. |
| **Popup → Paste links or deal text** | Paste a WhatsApp/Telegram deal message; every link in it is replaced by its affiliate link |
| **Right-click menu** | "Convert link to affiliate link" on any link, "Convert this page", "Scrape products on this page" |

Excel/Sheet columns follow your deals template (see below).

## Install

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. Click **Load unpacked** and select this folder (`affiliate-scraper-extension`).
3. Pin the extension (puzzle icon → pin). Click the ⚙ in the popup to open **Settings**.

## Setup 1: Google Drive + Google Sheet (links only, no sign-in in the extension)

Google does not let any app upload files to Drive with only a shared link, even "anyone with the link can edit". So you add a small script to your own Google account once. It saves the images and writes the sheet rows.

1. Open <https://script.google.com> → **New project**.
2. In the extension's Settings, click **Copy script**. Paste it over everything in the editor, then press **Save**. (The same file is `apps-script/Code.gs`.)
3. **Deploy → New deployment** → gear icon → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → **Authorize access** → choose your Google account → allow. (If Google shows "app isn't verified": **Advanced → Go to project**. It's your own script.)
5. Copy the **Web app URL** (ends in `/exec`) into Settings.
6. Paste your **product images** folder link and your **Google Sheet** link. Add a tab name and an Excel folder link if you want them.
7. Click **Save & test links**. It shows the folder and sheet names when everything works.

You only edit links in the extension. To change folder or sheet later, just paste new links. The script never needs editing.

**How images and products are linked**
- Each image is saved with the **product title as the file name**, e.g. `boAt Airdopes 141.jpg`. The same name appears in the sheet's *Product Title* column.
- The image's Drive description holds the product link, so you can find the product from the image.
- The sheet's *Drive Image Link* column opens the matching image.
- If two products share a title, the second image becomes `Title (2).jpg`. Scraping the same product again reuses its image.

**Sheet columns** follow your deals template: Sr No, Store, Product Title, Brand, Price (₹), MRP (₹), Discount %, Rating, Reviews, Product Link, Affiliate Link, Conversion, Image URL, Drive Image Link, Scraped At, Source Page, Category, Subcategory, Child Category, Deal Type, Good For, Check List, Description, Ends.
- Columns are matched by header name, so your sheet can keep its own column order.
- Sr No keeps counting across scrapes.
- Category / Subcategory / Child Category come from the store's category path when available (e.g. Mobiles & Tablets › Smartphones › 5G Smartphones).
- Description comes from product pages.
- Deal Type, Good For, Check List and Ends come from the popup's **Deal details for this scrape** box, and apply to every row of that scrape.

## Dashboard web app (PC + phone) and Adyzio

The same Apps Script also serves a dashboard. Everything lives in your Google Sheet:

| Tab | What it holds |
|---|---|
| your products tab | Every product, **one row per product** (re-scraping updates the row, never duplicates it). Extra columns: Product ID, Status, Viral, Clicks, Published On, Job ID, Updated At. |
| **Live** | Only products with Status = Live, newest first. **Point the Adyzio website plugin at this tab.** |
| **Queue** | Links you add from the dashboard / phone for the extension to scrape. |
| **Job Log** | Every scrape, conversion and Excel export (shown under Activity). |

**Status** of a product: `Scraped` → `Converted` (has your affiliate link) → `Live` (on adyzio.com). Also `Convert failed` and `Not placed` (you decided not to publish it). Re-scraping never changes Status, Viral, Clicks or Published On.

### One sheet for everything: "Adyzio Deals Hub"

Your Drive has a Google Sheet named **Adyzio Deals Hub** that both sides use:

| Tab | Used by |
|---|---|
| Deals | Chrome extension + dashboard (every product) |
| Link Sheet | adyzio.com plugin (filled automatically from Live products) |
| Categories | adyzio.com plugin + category matching |
| Category Map | you: map scraped categories to Adyzio slugs |
| Live, Queue, Job Log | dashboard |

- Extension Settings → Google Sheet link = this sheet, tab name `Deals`.
- Website plugin → this sheet, tab `Link Sheet` (same columns as before).
- Because the Link Sheet tab is in the same spreadsheet, nothing needs to be entered under "Adyzio Link Sheet link" on the dashboard; the sync finds it by itself.

### Set up (10 minutes, once)

1. Settings → section 1: **Copy script (Code.gs)** → paste into Code.gs at script.google.com. Then **+ → HTML**, name it `Dashboard`, **Copy dashboard (Dashboard.html)** → paste. Save.
   - Already had the old script? Paste both, then **Deploy → Manage deployments → ✎ → Version: New version → Deploy** (URL stays the same).
2. Deploy as Web app (Execute as: Me, Who has access: Anyone) and paste the `/exec` URL into Settings.
3. **Open that URL in your browser.** That is your dashboard. The first time it asks you to choose an **access key** (at least 6 characters). Do this right after deploying.
4. Enter the same key in Settings → **Access key**, press **Save & test links**. It should say Connected ✓ and create the Queue / Job Log / Live tabs.
5. On your phone, open the same URL, enter the key, then browser menu → **Add to Home screen**. It now opens like an app.
6. Dashboard → ⚙ Settings → **Adyzio Link Sheet link**: paste your *Adyzio Link Sheet* (tab `Link Sheet`). From then on every product you mark **Live** is written into it automatically (see below), and the adyzio.com plugin picks it up at its next refresh.

### Adyzio Link Sheet mapping

| Adyzio column | Filled from |
|---|---|
| status | `READY`, `READY_CHECK` or `ERROR`, the same checks as `adyzio_links.py validate`; the reason is in `notes` |
| source_url | Product Link (clean store link) |
| store | amazon, flipkart, myntra, meesho, ajio, nykaa, tatacliq, croma, shopsy, jiomart, decathlon, pepperfry, snapdeal, firstcry, lenskart, boat, or `other` |
| affiliate_url | Affiliate Link |
| title, brand, description | Product Title (max 255), Brand, Description |
| category | a slug from your **Categories** tab: exact name/slug match first, then your **Category Map** tab, then a keyword guess (marked READY_CHECK). Unmatched ones are listed in the master sheet's **Category Map** tab: fill column B once (name or slug) and they are remembered |
| price, mrp, price_checked_on, image | from the scrape, with the scrape date. **Empty for Amazon** (your Amazon rule: prices/images only from Amazon's API; the site shows "Check latest price") |
| is_deal / is_featured / is_active | 1 if a deal type or discount / 1 if ★ Viral / 1 while Live, **0 when you take it off Live** (rows are never deleted) |
| deal_type, deal_ends, added_on | Deal Type, Ends, Published On |
| notes | `[DS:<Product ID>]` marker + issues |

Rows you typed in the Adyzio sheet yourself are never changed: if a Live product's `source_url` is already there without the `[DS:…]` marker, it is skipped. `posted_channels`, `gallery`, `video_url`, `features` and `short_desc` are yours to edit there; the sync never overwrites them. The dashboard's **adyzio.com sync** card shows the last sync and has **Sync now**.

### Dashboard

- **Overview**: products, converted links, live on adyzio.com, not placed yet, viral deals, waiting conversion, failed, phone queue; pipeline and last-14-days chart.
- **Platforms**: a card per store (Flipkart, Myntra, Amazon, Meesho, Nykaa…) with Live / Not placed / Viral / Failed.
- **Categories**: number of categories, subcategories and child categories, and the full tree with counts.
- **Products**: search and filter; select products → **Mark Live**, **Not placed**, **★ Viral**; copy affiliate links; **Export** the filtered list (CSV, opens in Excel).
- **Add links**: paste links (or import a CSV/TXT) from your phone; choose whether to convert them too.
- **Activity**: every import/export job.
- **⚙ Settings**: when a deal counts as viral (marked ★, or discount ≥ 60%, clicks ≥ 100, or deal type loot/lightning; all changeable), theme, change key.

### Phone queue

Links added on the dashboard wait in the Queue tab. In the extension popup press **📱 Process** (Option 2 card), or tick Settings → *Process links added on the dashboard / phone automatically* to check every 15 minutes while Chrome is open. Each link is opened in a background tab, scraped like "Scrape this page" (Wishlink profiles via the API), saved to the sheet and, if chosen, converted. Stop works here too.

Why the PC is still needed: ExtraPe and Amazon SiteStripe only work inside your logged-in Chrome. Google's servers can't log in to them for you.

### Security

The web app URL is public by design (so the extension and your phone can reach it), so keep the **access key** private. Without it, nobody can read the dashboard or write to your sheet. If you deployed before choosing a key, open the dashboard and choose one straight away.

## Setup 2: Amazon (SiteStripe)

1. Enter your Associates tracking ID (e.g. `yourtag-21`) in Settings.
2. In the same Chrome profile, log in to Amazon with your Associates account and make sure **SiteStripe** is enabled (the bar at the top of Amazon pages).
3. Conversions call SiteStripe's short-link service with your session and return an `amzn.to` link. If that fails (logged out), you still get the full link with your tag, and the Conversion column says why.

## Setup 3: ExtraPe (Flipkart, Myntra, Ajio, Meesho and all other stores)

ExtraPe has no public API, so the extension uses **your ExtraPe login** and drives ExtraPe's link-converter page in a background tab.

1. Log in to ExtraPe in Chrome (popup → **Open ExtraPe link converter**).
2. Nothing else to set: `https://www.extrape.com/link-converter` is built in. If the address in Settings is blank, old, or stops working, the built-in page is used automatically and the Conversion column says so.
3. Use **Test a link** at the bottom of Settings with a Flipkart link.

If auto-detection can't find the box or button, open *Advanced: page selectors* and enter CSS selectors (right-click the element → Inspect → Copy selector).

**API mode (faster, optional):** on the ExtraPe converter, open DevTools (F12) → Network, convert a link, find the request that returns the converted link, and copy its URL, headers and body into Settings → *Custom API endpoint*, using `{{url}}` where the product link goes.

**Conversion per store (Settings → 5):** choose how each store's links are converted:
- **Auto**: Amazon → your tag + SiteStripe, every other store → ExtraPe.
- **My link pattern**: your own affiliate ID, e.g. Flipkart Affiliate `{{url}}&affid=yourid` (`{{url_enc}}` = encoded link).
- **My converter page**: your own affiliate network's page where you paste a link and press Convert (works like ExtraPe).
- **ExtraPe**, **Amazon tag + SiteStripe**, **Custom API**, or **Don't convert** (keeps the clean store link).
- **Other shops** covers every store that is not listed.

## Daily use

1. Open a store search/category page (or a product page).
2. Optional: open **Deal details for this scrape** and fill in Deal Type, Ends, etc.
3. Popup → **Scrape this page**. Wait for "Scraped N product(s)". Rows appear in your Google Sheet, images in the Drive folder, Excel in `Downloads/DealScraper/`.
4. Popup → **Convert N scraped link(s)**. The Affiliate Link column in the sheet is filled in, and `..._affiliate.xlsx` is downloaded.

You can close the popup during a job; it keeps running and the icon badge shows progress.

**Stop:** every running job (page scrape, Wishlink export, conversion, uploaded-file conversion) shows **■ Stop & download what's done**. The current link finishes, then:
- Scraping / Wishlink reading → Excel with the products read so far (`..._partial.xlsx`).
- Conversion → Excel with only the rows converted so far (`..._affiliate_partial.xlsx`); their Google Sheet rows are filled too.
- Uploaded file → the file with the links converted so far downloads automatically.

**Resume:** after a stopped conversion, Option 2 shows **Convert remaining N link(s)**. It converts only rows still missing an affiliate link (and retries failed ones), then downloads the complete `_affiliate.xlsx`.

## Wishlink profiles

- **Product Link** = the store's own product link (Nykaa, Myntra, Amazon, Zara, Tira…) with the creator's Wishlink tracking removed (their `tag=wishlink_…`, `affiliate_id`, `atgSessionId`, AppsFlyer parameters), so conversion uses *your* affiliate IDs.
- **Source Page** = the product's Wishlink link. **Store** = the store the link leads to.
- Price, MRP, Discount %, Rating, Subcategory, Description and Image come from Wishlink. Coupons and out-of-stock notes are added to Description.
- If a Wishlink link does not lead to a store, the row keeps the Wishlink link and Description says so.
- Stores ExtraPe doesn't support (e.g. Zara, H&M) will show the ExtraPe error in the Conversion column.
- Pasting a single Wishlink product link (`wishlink.com/share/…`) into "Paste links or deal text" converts it to your affiliate link too.

## Notes and limits

- Uploaded files are saved back as .xlsx (or .csv if you uploaded a .csv). Values, sheets and links are kept. Cell colours and fonts may be lost, because the free Excel library can't write styles.

- Store websites change their layout often. The scraper uses store-specific selectors first, then falls back to structured data (JSON-LD) and a generic product-card detector, so most pages keep working. If a store stops working, its selectors are in `content/scraper.js` (`LIST` and `DETAIL`).
- Infinite-scroll pages load more items through auto-scroll (Settings → Max scroll steps).
- Images already uploaded are remembered and not uploaded twice.
- Respect each site's terms of use and Amazon Associates / ExtraPe program rules.

## Files

```
manifest.json            extension definition (Manifest V3)
background.js            jobs: scrape → images → Excel → Drive; convert → update Excel/Sheet; right-click menu
bg/gdrive.js             sends images/rows to your Apps Script web app
apps-script/Code.gs      the script you paste into script.google.com (bridge + dashboard data)
apps-script/Dashboard.html  the dashboard web app (paste as HTML file "Dashboard")
bg/excel.js              Excel layout (SheetJS)
bg/converter.js          Amazon SiteStripe + ExtraPe + templates
bg/wishlink.js           Wishlink profile export (API + store-link resolving)
common/stores.js         store detection, link cleaning, image upscaling
common/settings.js       default settings
content/scraper.js       page scraper (listing + product pages)
content/floating.js      floating button on store pages
content/extrape_bridge.js fills ExtraPe's converter page and reads the result
popup.*, options.*       UI
convert-file.*           upload your own Excel/CSV and fill in affiliate links
lib/xlsx.full.min.js     SheetJS 0.18.5 (Apache-2.0)
```
