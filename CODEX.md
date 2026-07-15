# CODEX.md — Money Nest Developer Rules

This file is the working guide for Codex or any AI coding agent editing **Money Nest**.

Money Nest is a custom static GitHub Pages app for personal budgeting, debts, bills, calendar cashflow, budgets, and paycheck-to-paycheck planning.

## Current expected version

Latest known version: `money-nest-v2-206`

Before editing, always inspect `README.md` and confirm the current version in the repository. If `README.md` shows a different version, continue from the repo version and mention the mismatch in your summary.

## App type

Money Nest is a static front-end app. It should remain GitHub Pages friendly.

Typical files:

- `index.html`
- `app.js`
- `styles.css`
- `README.md`
- `manifest.webmanifest`
- icons/favicon files
- any other static assets already present in the repo

Do not introduce a build system, framework, backend, server dependency, or package manager unless the user explicitly asks for it.

## Non-negotiable preservation rules

When making changes, do not remove, rename, disable, or break:

- localStorage saving/loading
- JSON backup/export/import
- CSV export/import
- Supabase manual cloud saving/loading/sync
- Supabase settings/config fields
- Supabase sync buttons or save/load behavior
- existing user data handling
- GitHub Pages compatibility
- PWA/mobile install support
- existing app pages unless explicitly requested

Supabase cloud sync is an additional manual cloud-save option. It does **not** replace localStorage or JSON backups.

Never create, commit, upload, or request real personal finance JSON backups or private user financial data.

## Data safety rules

Money Nest user data may contain sensitive financial information.

The app code belongs in GitHub. User backup/data files do not.

Do not commit:

- real JSON backups
- exported financial reports
- CSVs containing real user data
- Supabase secrets/private keys
- personal financial screenshots
- private account information

If sample data is needed, use clearly fake/sample data only.

## Required workflow for every change

Before editing:

1. Inspect the relevant files.
2. Confirm the current version from `README.md`.
3. Briefly identify the likely files to touch.
4. If the request is vague or risky, ask for clarification before editing.

When editing:

1. Make the smallest safe change that solves the request.
2. Preserve existing behavior unless the user explicitly asks to change it.
3. Avoid broad rewrites.
4. Keep desktop layout mostly the same unless the user asks for desktop changes.
5. Mobile/iPhone layout may be more app-like and can differ from desktop.

After editing:

1. Bump the app version to the next version.
2. Update `README.md` with version notes.
3. Run a JavaScript syntax check if possible, such as:
   ```bash
   node --check app.js
   ```
4. If there are other lightweight checks available, run them.
5. Summarize:
   - files changed
   - exact user-facing changes
   - tests/checks run
   - whether any data schema changed
   - whether JSON/CSV import/export compatibility was affected
6. Commit changes or open a PR according to the user's chosen GitHub workflow.

## Versioning rules

Money Nest uses versioned releases like:

- `money-nest-v2-188`
- `money-nest-v2-189`
- `money-nest-v2-190`
- `money-nest-v2-191`

For each completed change:

1. Increment the version by one.
2. Update the "Current version" line in `README.md`.
3. Add a new entry at the top of `README.md` Version Notes.
4. Mention whether there were JSON/CSV schema changes.

Example README note:

```md
### v2-189

* Fixed [issue].
* Improved [behavior].
* No JSON/CSV schema changes needed.
```



### v2-204

* Budget Review uses a compact full-width six-month trend card above a larger category pie chart.
* Pie slices do not scale on hover/focus, preventing SVG paint-order overlap between neighboring slices.

### v2-202

- Budget recurring-bill exclusion recognizes edited occurrence-only replacements, including older rows that lost direct recurrence metadata.
- One-time replacements preserve recurring-source metadata.

### v2-201
- Budget Review now has an `Include recurring bills` toggle instead of the older transfer/payment toggle. Recurring transactions are excluded consistently from summaries, pie/category review, trends, budget performance, and budget detail when disabled.
- Budgets support `categoryIds` for one or multiple categories. `categoryId` remains populated with the first selected category for backward compatibility.
- CSV budgets include `categoryIdsJSON`; older CSV/JSON data using only `categoryId` imports as a single-category budget.

### v2-200
- Banking is excluded from budgeting. Savings transfers net contributions by direction.

- Current version: money-nest-v2-206. Includes budget presets/groups, comparisons, calculation inspector, global search, mobile quick review, recurring cleanup, smart matching, and data-health scanning.


### v2-205
- Global search modal polish, account quick-view selected states, and recurring bill duplicate suppression.


### v2-206
- Smart Cleanup duplicate detection is stricter and now provides Review 1, Review 2, Dismiss, and Restore dismissed actions.
