# 24 Nov 2026 – adyziostore account, deals sheet and plugin template

- Adithya asked whether the plugin has a deals template: yes, Tools → Adyzio Import → "Download the template" (adyzio-deals-template.csv, 24 columns, one store per row). Multi-store columns come in plugin 1.7.0.
- He set up, on **adyziostore@gmail.com**: the deals sheet "adyzio-deals-template" (template tab + Category Map, Queue, Job Log, Live made by the extension), the Apps Script web app (dashboard + extension bridge) and a "Product Images" Drive folder (anyone with link can view).
- Checked: the uploaded Code.gs and Dashboard.html are identical to `apps/scraper-extension/apps-script/` (VERSION 3). No code change.
- Saved: the template as `data/templates/adyzio-deals-template.csv`. The sheet, web-app and folder links are kept privately in `D:\ABD Innovations\Adyzio\private\accounts\adyzio-store-links.md`, the Claude project and memory (this repo is public).
- Open: plugin 1.6 on adyzio.com still reads the old sheet link until its Tools → Adyzio Import → Google Sheet link is changed to the new sheet's Live tab (do it after plugin 1.7.0, so 3-store products are not split into 3 pages).
