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

## Setup 2: Amazon (SiteStripe)

1. Enter your Associates tracking ID (e.g. `yourtag-21`) in Settings.
2. In the same Chrome profile, log in to Amazon with your Associates account and make sure **SiteStripe** is enabled (the bar at the top of Amazon pages).
3. Conversions call SiteStripe's short-link service with your session and return an `amzn.to` link. If that fails (logged out), you still get the full link with your tag, and the Conversion column says why.

## Setup 3: ExtraPe (Flipkart, Myntra, Ajio, Meesho and all other stores)

ExtraPe has no public API, so by default the extension uses **your ExtraPe login** and drives ExtraPe's own link-converter page in a background tab:

1. Log in to ExtraPe in Chrome.
2. Open ExtraPe's link-converter page (where you paste a product link to get your earning link) and copy its address into Settings → *ExtraPe link-converter page URL*.
3. Use **Test a link** at the bottom of Settings with a Flipkart link.

If auto-detection can't find the box or button, open *Advanced: page selectors* and enter CSS selectors (right-click the element → Inspect → Copy selector).

**API mode (faster, optional):** on the ExtraPe converter, open DevTools (F12) → Network, convert a link, find the request that returns the converted link, and copy its URL, headers and body into Settings → *Custom API endpoint*, using `{{url}}` where the product link goes.

**Per-store templates (optional):** for stores where you have your own affiliate ID, add e.g. `{"flipkart": "{{url}}&affid=yourid"}`; that store then skips ExtraPe.

## Daily use

1. Open a store search/category page (or a product page).
2. Optional: open **Deal details for this scrape** and fill in Deal Type, Ends, etc.
3. Popup → **Scrape this page**. Wait for "Scraped N product(s)". Rows appear in your Google Sheet, images in the Drive folder, Excel in `Downloads/DealScraper/`.
4. Popup → **Convert N scraped link(s)**. The Affiliate Link column in the sheet is filled in, and `..._affiliate.xlsx` is downloaded.

You can close the popup during a job; it keeps running and the icon badge shows progress.

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
apps-script/Code.gs      the script you paste into script.google.com
bg/excel.js              Excel layout (SheetJS)
bg/converter.js          Amazon SiteStripe + ExtraPe + templates
common/stores.js         store detection, link cleaning, image upscaling
common/settings.js       default settings
content/scraper.js       page scraper (listing + product pages)
content/floating.js      floating button on store pages
content/extrape_bridge.js fills ExtraPe's converter page and reads the result
popup.*, options.*       UI
convert-file.*           upload your own Excel/CSV and fill in affiliate links
lib/xlsx.full.min.js     SheetJS 0.18.5 (Apache-2.0)
```
