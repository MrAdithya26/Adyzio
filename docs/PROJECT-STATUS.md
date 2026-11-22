# Project status

**Updated:** 2026-11-22 · **Project version:** 0.7.0

## Where things stand

| Area | Status |
|---|---|
| Website | WordPress installed on Hostinger cloud server at adyzio.com; Kadence theme; Adyzio Core plugin up to version 1.6 installed from zips (homepage design, 726 categories, Excel/Google Sheet import, SEO tool) |
| Website plan | 7-day build plan (4 Nov) is current: Day 1 = Adyzio Core 1.7.0 with "Clean up categories" and the split into separate plugins |
| Link tools | Link tool and deal collector in `apps/link-tools/` (tests pass) |
| Deals design | Deals page v2 prototype in `website/deals-v2/` |
| Master sheet | Google Sheet "Adyzio Deals Hub" (Drive › 04 Adyzio › data). Empty so far |
| Scraper extension | **1.7.0** in `apps/scraper-extension/` (Wishlink profiles, dashboard, Live tab, phone queue) |
| Social | Platform descriptions written (31 Oct); Telegram bot plan agreed |

## Live site audit (22 Nov 2026)

215 products (Flipkart 155, Amazon 45), newest from 4 Nov. 210 product pages work, 5 crash (posts 715, 615, 579, 485, 479). No affiliate disclosure on any product page or in the footer. 796 categories, 710 empty, 34 main categories instead of 20. 45 Amazon products use img.extrape.com photos. Not ready for AdSense yet. Full findings and plan: [Site Audit and Growth Plan](https://claude.ai/artifact/XrTepsEBaT4y5cfjqw7v4Y).

## Open items

- [x] Adyzio Core 1.6.0 code added to GitHub (22 Nov).
- [x] Extension 1.7.0 found and saved (22 Nov).
- [ ] Adyzio Core 1.7.0 (phase 1): disclosure on every product, fix 5 crashing pages, footer, multi-store buttons, AdSense field, use only the 726 categories (never create new ones), map store categories, hide Amazon prices/images from the sheet, read the Live tab.
- [ ] Deals Hub: add the 726-category list as a new tab (old 20-category tab stays).
- [ ] Build Adyzio Core 1.7.0 ("Clean up categories") and the Storefront / Import & Sync split — Day 1 of the 7-day plan.
- [ ] Finish ThirstyAffiliates setup (wizard showed an error; retry was planned for 4 Nov).
- [ ] Policy pages: fill in every [VERIFY] (email, address, Grievance Officer, partner terms links) before publishing.
- [ ] Telegram: create the BotFather bot; decide on a second account only if channel reading is needed.
- [ ] Decide whether the GitHub repo stays **public** or becomes **private**.
