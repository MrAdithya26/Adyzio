# Adyzio – complete launch and implementation plan

*Version 1 · 31 Oct 2026 · ABD Innovations · www.adyzio.com*

This is the one plan for taking Adyzio from zero to a live deals site with products in every category, every store and every social platform. It covers how a link goes from a store page to a sale, what to build, what to do each day, and what has to be true before you call it launched.

---

## 1. Where things stand today

| Part | Status |
|---|---|
| Website | Plain PHP 8 site, v1.1.1, ready to deploy on Hostinger (code: `apps/adyzio` in the ABD repo, `deploy/adyzio` branch). Not live yet. |
| Website features already built | Admin panel, products, 20 categories + subcategories, banners, CSV import/export, tracked `/go/{id}` links, click dashboard, "no tag" warnings, wishlist, sitemap, disclosure on every page |
| Affiliate accounts | Amazon Associates (SiteStripe links). ExtraPe for Flipkart, Myntra, AJIO and other stores. |
| Social profiles | Descriptions written for Instagram, Facebook, X, Threads, Telegram, WhatsApp, YouTube, LinkedIn, Pinterest |
| This repo | Link tool, category map, store list, link sheet template and this plan (added today) |
| Products live | 0 |

---

## 2. How the whole system works

```
 1 FIND          2 CONVERT              3 LINK SHEET        4 CHECK        5 IMPORT
 deal on store → affiliate link       → one row per      → validate   → adyzio.com
 (you browse)    Amazon: tool/SiteStripe  product          (tool)        Admin → Import
                 Others: ExtraPe                                              │
                                                                              ▼
 8 LEARN       ←  7 TRACK            ←  6 SHARE
 what sells       site clicks +          Telegram, WhatsApp, Insta, FB, X,
                  Associates/ExtraPe     Threads, Pinterest, YouTube, LinkedIn
                  reports                (links go to adyzio.com, not the store)
```

**The golden rule:** every link you share points to **your product page on adyzio.com** (or `/go/{id}`), never straight to the store. Then you can change an affiliate link once and every old post still works, and the dashboard counts every click.

---

## 3. "Scraping" – what is allowed and what is not

You asked for scraping links. Here is the safe line, because breaking it can close your Amazon account and cancel commission:

| Allowed | Not allowed |
|---|---|
| You open the store page or app, copy the product link, and paste it in the Link Sheet | A bot that downloads store pages to copy titles, prices, ratings or photos |
| The link tool cleans the link and adds **your own** Amazon tracking ID (the same thing SiteStripe does) | Copying product photos to your own server |
| Amazon images through **SiteStripe → Image / Text+Image** (paste the image URL) | Showing a price you did not check that day |
| ExtraPe's own converter (app, website or Chrome extension) | Guessing or building an ExtraPe/Flipkart link by hand |
| Amazon **Creators API** for product data, once you qualify | Amazon PA-API: retired in 2026, replaced by the Creators API |

**About the Creators API:** it is Amazon's official feed of titles, prices and images. Reports from developers say it needs a fully approved Associates account and about **10 qualifying sales in the last 30 days** – VERIFY the exact rule in Associates Central → Tools. So at launch you work by hand; once sales reach that level (Phase 5), the site can pull Amazon data automatically and keep prices fresh.

**Amazon's first-sales rule:** new Associates accounts must make qualifying sales within the first 180 days or the account is closed – VERIFY the date for your account in Associates Central. This is why launch and the first sales matter more than polish.

---

## 4. Stores and how to make each link

Full list in [`data/stores.csv`](../data/stores.csv).

| Store | Route | How to make the link |
|---|---|---|
| Amazon | Amazon Associates | Link tool adds your tag automatically, or SiteStripe → Get link → Short link |
| Flipkart | ExtraPe | ExtraPe app/site/Chrome extension: paste link → copy converted link |
| Myntra | ExtraPe | same |
| AJIO | ExtraPe | same |
| Meesho, Nykaa, Tata CLiQ, Croma | ExtraPe – VERIFY each is in ExtraPe's current store list | same |

**Tip for ExtraPe:** the Chrome extension converts on desktop in one click. Convert a whole batch at once, then paste the results into the `affiliate_url` column.

**One check before launch:** convert one Flipkart link in ExtraPe, look at the domain of the short link it gives you, and tell Claude. The website's "no tag" warning may need that domain added so ExtraPe links are not flagged (upgrade U5 below).

---

## 5. Categories – all 20, with targets

The website already ships with these 20 categories and their subcategories (full map with slugs in [`data/categories.csv`](../data/categories.csv)). Use the **slug** in the `category` column; the link tool stops anything that is not in this list, so you never get stray categories.

| # | Category | Main stores | Launch (first 30) | By 30 Nov | By 31 Dec |
|---|---|---|---|---|---|
| 1 | Mobiles | Amazon, Flipkart, Croma | 3 | 12 | 27 |
| 2 | Electronics | Amazon, Flipkart, Croma | 3 | 12 | 27 |
| 3 | Laptops & Computers | Amazon, Flipkart | 2 | 6 | 15 |
| 4 | TVs & Appliances | Amazon, Flipkart, Croma | 1 | 5 | 15 |
| 5 | Men's Fashion | Myntra, AJIO, Flipkart | 2 | 6 | 15 |
| 6 | Women's Fashion | Myntra, AJIO, Meesho | 2 | 6 | 15 |
| 7 | Footwear | Myntra, AJIO, Amazon | 1 | 4 | 12 |
| 8 | Watches & Jewellery | Amazon, Myntra | 1 | 3 | 10 |
| 9 | Bags & Luggage | Amazon, Flipkart | 1 | 3 | 10 |
| 10 | Home & Kitchen | Amazon, Flipkart | 3 | 9 | 20 |
| 11 | Furniture | Amazon, Flipkart | 1 | 2 | 8 |
| 12 | Beauty & Personal Care | Nykaa, Amazon, Myntra | 1 | 4 | 12 |
| 13 | Health & Fitness | Amazon | 1 | 3 | 10 |
| 14 | Sports & Outdoors | Amazon, Flipkart | 1 | 3 | 10 |
| 15 | Baby & Kids | Amazon, Flipkart | 1 | 3 | 10 |
| 16 | Toys & Games | Amazon | 1 | 3 | 8 |
| 17 | Books & Stationery | Amazon, Flipkart | 3 | 10 | 26 |
| 18 | Grocery & Gourmet | Amazon | 1 | 2 | 8 |
| 19 | Automotive | Amazon, Flipkart | 1 | 3 | 8 |
| 20 | Pet Supplies | Amazon | 0 | 1 | 4 |
| | **Total** | | **30** | **100** | **270** |

**Why this mix:** your Telugu audience from Adithya Info Hub is students and job seekers, so exam books, budget phones, earbuds, study lamps, bags and interview clothes come first. Every category gets at least one product before launch so no menu item opens empty (Pet Supplies can be hidden until it has products).

---

## 6. Platforms – where each deal goes

Every shared link is `https://www.adyzio.com/product/<slug>?src=<platform>` so you can see which platform brings clicks. (The site needs upgrade U3 to record `src`; until then the link still works.)

| Platform | Account | What to post | How often | Disclosure |
|---|---|---|---|---|
| **Telegram** channel | Adyzio Deals | Every new deal, loot deals first | 5–15 a day | Line at the end of every post |
| **WhatsApp** channel | Adyzio Deals | Best 3–5 deals of the day | 1–2 posts a day | Line at the end |
| **Instagram** | @adyzio | Reels and carousels: "Top 5 under ₹999", unboxing of things you bought | 1 a day + stories | #ad and "affiliate link" in caption |
| **Facebook** page | Adyzio | Same as Instagram + link posts | 1–2 a day | #ad + line |
| **X** | @adyzio | Short deal posts | 3–5 a day | #ad |
| **Threads** | @adyzio | Short deal posts | 1–3 a day | #ad |
| **Pinterest** | Adyzio | Pins for each product page (great for search) | 5 a day | "Affiliate link" in description |
| **YouTube** | Adyzio | Shorts: deal of the day; later reviews | 3 a week | Description + spoken line |
| **LinkedIn** | Adyzio page | Brand and partnership posts only | 1 a week | – |

The link tool writes ready captions for all of these from your site's product export (section 8).

**Platform rules to respect:** Amazon does not allow its affiliate links in WhatsApp/Telegram messages sent to people privately, emails or offline material – sending them to your adyzio.com page first keeps you on the safe side. VERIFY the current Associates Operating Agreement rules for social and messaging apps.

---

## 7. Accounts and set-up checklist (do once)

- [ ] **Amazon Associates:** add `adyzio.com` and every social profile under Account Settings → Websites and Mobile Apps (task adz-09). Copy your **tracking ID** (ends in `-21`).
- [ ] **ExtraPe:** install the Chrome extension; check the store list and commission rates; note the short-link domain.
- [ ] **Telegram:** create the channel "Adyzio Deals"; create a bot with @BotFather for auto-posting later (Phase 5); add the bot as channel admin.
- [ ] **WhatsApp:** create the channel "Adyzio Deals" from WhatsApp Business.
- [ ] **Instagram, Facebook, X, Threads, Pinterest, YouTube, LinkedIn:** create with handle `adyzio` (or the closest free one); paste the descriptions written on 31 Oct; put `adyzio.com` in the bio link.
- [ ] **Google:** Search Console (paste verification tag in Admin → Settings → Extra code in head), submit `sitemap.xml`; Google Analytics ID in Settings.
- [ ] **Google Sheet "Adyzio Link Sheet"** in the Drive Adyzio folder (created with this plan) – your daily working sheet.
- [ ] **Computer:** install Python 3 (python.org) and download this repo once (GitHub → Code → Download ZIP) so you can run the link tool.

---

## 8. The daily workflow (60–90 minutes)

**Morning – find (20 min).** Open Amazon Today's Deals, Flipkart offers and ExtraPe's deal feed. For each good deal, copy the product link and paste it into a new row of the Link Sheet: `source_url`, `title`, `category` (slug), `brand`, 3–5 `features` separated by `|`, one-line `short_desc`. Leave price empty unless you are filling it right now from the store page.

**Convert (10 min).**

1. Download the Link Sheet as CSV (File → Download → CSV) and save it as `linksheet.csv`.
2. Run:
   ```
   python3 apps/link-tools/adyzio_links.py convert linksheet.csv --amazon-tag YOURTAG-21
   ```
   Amazon rows get your affiliate link automatically. Other rows are marked `CONVERT_IN_EXTRAPE`.
3. Convert those links in ExtraPe and paste them into `affiliate_url`.

**Check and import (10 min).**
```
python3 apps/link-tools/adyzio_links.py validate linksheet.csv
python3 apps/link-tools/adyzio_links.py export linksheet.csv -o import-today.csv
```
`validate` writes READY / ERROR into the `status` column and explains every problem (no tag, wrong category, old price, price higher than MRP…). `export` writes only READY rows, in exactly the columns adyzio.com expects. Upload `import-today.csv` in **adyzio.com/admin → Import / Export**. Open 2–3 new product pages and click Buy once to see they land on the right product.

**Share (20–30 min).**

1. In Admin → Import / Export, download the full export (it has each product's id and page address).
2. Run:
   ```
   python3 apps/link-tools/adyzio_links.py captions export.csv --ids 31,32,33 -o captions.txt
   ```
   (add `--telugu` for the Telugu disclosure line)
3. Copy each caption into Telegram, WhatsApp, Instagram, Facebook, X, Threads and Pinterest. Write the platforms in the `posted_channels` column.

**Evening – clean up (10 min).** Mark sold-out or ended deals `is_active = 0` (Admin → Products → bulk hide). Look at the dashboard: which products and stores got clicks.

**Weekly (Sunday, 30 min).** Compare site clicks with Amazon Associates and ExtraPe reports. More products in what sells; drop what never gets clicks. Write one buying guide (adz-11).

---

## 9. Phases and dates

| Phase | Dates | What gets done | Done when |
|---|---|---|---|
| **0 · Go live** | 1–2 Nov | adz-01 Hostinger site + database · adz-02 deploy from GitHub + installer (coming-soon on, demo off) · adz-03 SSL · adz-04 settings, pages, disclosure (English + Telugu) | adyzio.com opens over https with the coming-soon page |
| **1 · First 30 products** | 2–5 Nov | Link Sheet set up · first 30 products across 19 categories through the full workflow · banners | 30 READY products imported, every Buy button tested |
| **2 · Channels** | 3–6 Nov | All 9 platforms created and linked · adz-05 Telegram · adz-06 WhatsApp · adz-09 site and profiles added in Amazon Associates | Every platform has its bio and adyzio.com link |
| **3 · Launch** | 6 Nov (Fri) | adz-08 Search Console + sitemap · switch coming-soon **off** · launch posts on every platform | Site public, first clicks on the dashboard |
| **4 · Grow** | 7–30 Nov | adz-10 to 100 products · daily workflow · first buying guide (adz-11) · website upgrades U1–U6 | 100 products, 5+ posts a day on Telegram |
| **5 · Automate** | Dec 2026 – Mar 2027 | Telegram auto-post from the site · Creators API once eligible (auto titles, images, prices) · 270+ products · weekly guides | First commission through adyzio.com by **Mar 2027** |
| **6 · Own products** | after Mar 2027 | Dropshipping and Adyzio's own products (the site's store field and product pages are ready to extend) | Decided after Phase 5 numbers |

Festival season matters: Diwali has passed, but the year-end, Republic Day (Jan) and Valentine sales are the next big deal windows – have the 100 products ready by then.

---

## 10. Website upgrades (v1.2) – to build and commit

These go into the website code and are deployed with Hostinger's Redeploy button.

| # | Upgrade | Why |
|---|---|---|
| U1 | Hide Product schema when a product has no price | From the 27 Oct test report – Google flags it |
| U2 | Login-attempt limit stored per IP, not per session | Test report – security |
| U3 | Record `?src=` on product pages and `/go/` clicks; show clicks by platform on the dashboard | Know which platform earns |
| U4 | Deal type (Today's Deal / Loot / Price drop) and deal end date with auto-hide | Ended deals vanish on their own; the Link Sheet already has the columns |
| U5 | Recognise ExtraPe short links as tagged (no false "no tag" warning) and keep the store from the CSV | Needs the ExtraPe domain from section 4 |
| U6 | Up to 4 stores per product (compare prices across Amazon / Flipkart / Croma) | Higher conversion |
| U7 | Telegram auto-post when a product is published (bot token in config) | Saves 20 min a day |
| U8 | Creators API connection (when eligible) | Fresh Amazon prices and images, legally |
| U9 | Fix "updated daily" wording in the announcement bar; remove untagged demo products | Test report |

The old adyzio-core WordPress plugin already has working code for U3, U4, U6 and U7 and is the reference for porting them.

---

## 11. Rules that never change

- Disclosure on every page and every post. Amazon pages also show: "As an Amazon Associate, Adyzio earns from qualifying purchases." Telugu line: "ఈ post లో affiliate links ఉన్నాయి. మీరు కొంటే మాకు చిన్న commission వస్తుంది, మీకు extra cost ఉండదు."
- No invented prices, discounts, ratings, specs or "only 2 left". No price without the date you checked it; otherwise "Check latest price".
- No copied store photos. SiteStripe images, brand creatives from the affiliate dashboard, or your own photos.
- No fake reviews or "I used this" unless you did.
- Affiliate links stay in the database; shared links go to adyzio.com.
- All Buy buttons carry `rel="nofollow sponsored"` (already built).

---

## 12. Where everything lives

| Place | What |
|---|---|
| **GitHub `MrAdithya26/Adyzio`** | `docs/LAUNCH-PLAN.md` (this plan) · `apps/link-tools/` (link tool + tests) · `data/categories.csv` · `data/stores.csv` · `data/affiliate-links/link-sheet-template.csv` · future website upgrades |
| **Google Drive → 04 Adyzio – adyzio.com** | This plan as a Google Doc · **Adyzio Link Sheet** (Google Sheet with Link Sheet + Categories tabs) · older launch guide, README and test report |
| **Hostinger** | The live site and database. Back up weekly (database + `uploads/`) and download a CSV export. |

Newer versions of this plan get a new dated copy in Drive and a commit in GitHub.

---

## 13. Launch-ready checklist

- [ ] adyzio.com loads over https on phone and desktop
- [ ] Disclosure visible on home, product and footer; Disclosure, Privacy, Terms, About and Contact pages filled
- [ ] Demo products removed; 30+ real products; every category in the menu has at least one product (or is hidden)
- [ ] Every product: affiliate link tested by clicking once; no "⚠ no tag" warnings on the dashboard
- [ ] No price older than one day; others show "Check latest price"
- [ ] Telegram, WhatsApp and at least Instagram + Facebook live with bio links
- [ ] adyzio.com and all profiles listed in Amazon Associates
- [ ] Search Console verified and sitemap submitted
- [ ] `config.php` backed up; first database backup taken
- [ ] Coming-soon switched off

---

## 14. Decisions needed from Adithya

1. **Amazon tracking ID** – put it in `apps/link-tools/config.json` on your computer (never commit it; it is already ignored by git).
2. **ExtraPe short-link domain** – convert one link and share the domain (for U5).
3. **Website code home** – the site code is in the ABD repo (`deploy/adyzio` branch), which Hostinger deploys from. Keep it there and copy releases here, or move deployment to this repo? Moving means changing the Git source in Hostinger once.
4. **Launch date** – this plan uses **Fri 6 Nov 2026**. The planner said 31 Oct (today), but the site is not deployed yet and needs products and channels first, so move the milestone in the planner.
