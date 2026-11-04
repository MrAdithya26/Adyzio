# How we work: versions, saving and syncing

Simple rules so every change is saved, numbered and easy to find later.

## 1. The three places

1. **GitHub (master).** Every change is committed here first, with a one-line message that says what changed and why.
2. **Your computer** (`D:\ABD Innovations\Adyzio`). After each piece of work, Claude copies the changed files here, in the same folders.
3. **Google Drive** (`ABCD › 04 Adyzio – adyzio.com`). Documents you read or edit (plans, guides, the Link Sheet, notes) are saved here in the same folder names.

If the three ever differ, **GitHub is correct**.

## 2. Version numbers: MAJOR.MINOR.PATCH

| Part | Goes up when | Example |
|---|---|---|
| MAJOR | Adyzio changes in a big way (launch, new platform) | 0.x → **1.0.0** at public launch |
| MINOR | A new feature, tool, plan or page set is added | 0.4.0 → **0.5.0** |
| PATCH | A fix or small change to something that exists | 0.5.0 → **0.5.1** |

- The project number is in [`VERSION`](../VERSION). Each release gets a GitHub tag (`v0.5.0`) and a CHANGELOG entry.
- **Each part has its own version too.** For example the WordPress plugin `adyzio-core` has its own number (1.6, 1.7.0…) and its own changelog inside its folder. The project CHANGELOG mentions it when it changes.
- Old versions are never lost: GitHub → **Tags** → pick a version → download.

## 3. What happens after every piece of work

1. Files are saved in the right folder (see the README folder map).
2. Commit to GitHub with a clear message.
3. If it's a new feature, fix or plan: bump `VERSION`, add a CHANGELOG entry, add a tag.
4. Add or update the chat note in `docs/chat-log/` (date, what was asked, what was built, decisions, open items).
5. Record any important decision in `docs/DECISIONS.md`.
6. Update `docs/PROJECT-STATUS.md` if the status changed.
7. Copy the changed files to your computer and to Google Drive.

## 4. Branches (for bigger changes)

- `main` always holds the latest finished version.
- Bigger work can be built on a separate branch (for example `website-deals-v2`) and merged into `main` when it's done and tested. The merge is then tagged as a new version.

## 5. Naming files

- Dated files: `YYYY-MM-DD_short-name.ext` — for example `2026-11-04_project-organisation.md`.
- Small letters and hyphens, no spaces.
- Never overwrite an old plan with a new one. Save the new one with today's date; the plans index marks which one is current.

## 6. What never goes to GitHub

Passwords, API keys, bot tokens, bank or account details, earnings. These stay in `private/` on your computer (and Drive if you want), and `.gitignore` blocks them from GitHub.
