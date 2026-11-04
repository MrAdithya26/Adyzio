# Decisions

Important decisions about Adyzio, newest first. Each one says what was decided and why, so nobody has to re-argue it later.

| Date | Decision | Why | Source |
|---|---|---|---|
| 2026-11-04 | GitHub is the master copy; your computer (`D:\ABD Innovations\Adyzio`) and Google Drive hold matching copies. Versions follow MAJOR.MINOR.PATCH with tags and a CHANGELOG. | One place with full history; copies for offline use and easy reading. | [chat note](chat-log/2026-11-04_project-organisation.md) |
| 2026-11-04 | The website is split into parts: Kadence theme + Adyzio Core, Storefront, Import & Sync, SEO, Legal, Social plugins, each with its own version. Next: Adyzio Core 1.7.0 with "Clean up categories". | A fix to one part never touches the others. | [chat note](chat-log/2026-11-02_adyzio-website-launch-plan.md) |
| 2026-11-03 | Adyzio uses the full 726-category list (20 main › sub › child). The importer never creates new main categories. | Stops duplicate categories such as "Fashion" vs "Fashion - Men". | [chat note](chat-log/2026-11-02_adyzio-website-launch-plan.md) |
| 2026-11-02 | Platform: **WordPress on the Hostinger cloud server**, Kadence theme, plus the custom Adyzio Core plugin. Replaces the earlier plain-PHP package plan. | Easy daily posting, ready affiliate/SEO plugins, WooCommerce later for own products. | [chat note](chat-log/2026-11-02_adyzio-website-launch-plan.md) |
| 2026-11-02 | Amazon prices show for 24 hours after they were checked, then "Check latest price". Amazon prices and images are never sent to the site from the collector. | Amazon Associates rules. | [chat note](chat-log/2026-11-02_website-clone-and-upgrade.md) |
| 2026-10-31 | No scraping bots for Amazon/Flipkart titles, prices or photos. You copy product links; the tool and ExtraPe make the affiliate links. | Scraping breaks Amazon Associates rules and can close the account. | [chat note](chat-log/2026-10-31_affiliate-link-upgrade-plan.md) |
| 2026-10-31 | Telegram automation never runs on your main Telegram account. Posting is done by a BotFather bot; reading channels, if ever, by a separate account. | Protects your main account from restriction or ban. | [chat note](chat-log/2026-10-31_telegram-auto-forward.md) |
| 2026-10-31 | All Adyzio code, apps and updates go into GitHub `MrAdithya26/Adyzio`. | One home for every technical change. | [chat note](chat-log/2026-10-31_github-repo-setup.md) |
