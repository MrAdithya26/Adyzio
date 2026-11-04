# 2026-11-04 — Project organisation

**Chat:** this session (Claude, linked to your computer)

**Asked:** Use `D:\ABD Innovations\Adyzio` as the project folder. Store all Adyzio data (past and future chats, plans, documents, apps, repos) in three places — your computer, Google Drive and GitHub — with clear version control and an easy-to-understand layout.

**Done:**
- Merged the two finished branches into `main`: `deal-collector` (v0.2.0) and `website-deals-v2` (v0.3.0). Tagged the earlier work v0.1.0.
- New folder layout for all three places; `VERSION`, `CHANGELOG.md`, `docs/HOW-WE-WORK.md`, `docs/PROJECT-STATUS.md`, `docs/DECISIONS.md`, plans index, this chat log (8 notes). Released as **v0.4.0**.
- Copied everything to your computer and the documents to Google Drive.

**Decided:** GitHub is the master copy; the computer and Drive hold matching copies. Versions use MAJOR.MINOR.PATCH with tags.

**Open:** Adyzio Core plugin code is not in GitHub yet (see PROJECT-STATUS). Repo is public — decide public or private. Delete the first numbered folders (`00_Admin` … `99_Archive`) made earlier today on your computer.
