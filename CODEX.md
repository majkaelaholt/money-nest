# CODEX.md — Money Nest Developer Rules

This file is the working guide for Codex or any AI coding agent editing **Money Nest**.

Money Nest is a custom static GitHub Pages app for personal budgeting, debts, bills, calendar cashflow, budgets, and paycheck-to-paycheck planning.

## Current expected version

Latest known version: `money-nest-v2-217`

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

- Current version: money-nest-v2-217. Includes combinable Budget Review spending/account filters, budget presets/groups, comparisons, calculation inspector, global search, mobile quick review, recurring cleanup, smart matching, and data-health scanning.


### v2-205
- Global search modal polish, account quick-view selected states, and recurring bill duplicate suppression.


### v2-206
- Smart Cleanup duplicate detection is stricter and now provides Review 1, Review 2, Dismiss, and Restore dismissed actions.


### v2-208

- Bills cards reserve separate columns for status/archive controls and transaction amounts so totals remain aligned and visible.

### v2-207
- Bills page now separates active rules from a collapsed Ended / Archived section.
- `billArchived`, `billArchivedAt`, and `billArchivedPreviousRecurrenceUntil` are optional backward-compatible transaction fields and are included in transaction CSV import/export.
- Archive preserves cleared history, suppresses future generation, and removes non-cleared/future linked occurrence rows; Restore re-enables the stored recurrence rule.




### v2-217

- Added bulk category color editing for palette roles and custom color overrides.
- Bulk category editing does not alter category IDs, names, emojis, or transaction assignments.

### v2-216
- Calendar density controls now visibly alter the calendar; Needs Review and Smart Cleanup/Data Health are unified in a collapsible Dashboard panel, and the standalone Review page was removed.

### v2-214

- Transaction records may include `linkedTransactionIds`, an array of related transaction IDs. Link editing must keep links reciprocal and remove missing/self references.
- Needs Review is a UI inbox built from existing transactions and health scans; dismissals are local browser preferences and do not delete data.
- Calendar density is a local UI preference with compact, comfortable, and detailed modes.
- Backup health uses local metadata timestamps and must not replace JSON export or manual Supabase safety warnings.

### v2-213
- Budget Review uses a compact four-metric summary strip instead of four separate mini-cards.
- Secondary comparison and trend information lives in a collapsed `budget-more-insights` details section.
- Smart Cleanup & Data Health is collapsed by default; no data model or import/export changes were made.

### v2-212
- Accounts and Debts are now combined into one Accounts page. Cash accounts render first and the unchanged debt grouping/tools render below.
- The standalone Debts navigation item and view were removed. Legacy `setView("debts")` calls redirect to Accounts for compatibility.
- Debt detail pages return to Accounts. No saved data fields or import/export formats changed.

### v2-211
- Budget Review Quick Views now use two combinable dimensions: one spending mode (`all`, `extra`, or `bills`) plus zero or more cash-account buttons (`Mak`, `Ty`, `Joint`).
- An empty account selection means all accounts. Multiple selected account IDs are stored in runtime state and applied consistently to review totals, income, charts, trends, comparisons, budget performance, and category drill-downs.
- The older Account dropdown and Include recurring bills checkbox were removed from the Budget Review UI; recurring inclusion is derived from the selected spending mode.

### v2-210
- Removed pie shadow/edge bleed and aligned archived bill action/amount columns.

### v2-209
- Bills cards now open a bill detail/history view instead of directly opening one transaction.
- Bill details show linked cleared history plus upcoming/generated occurrences, with each row available for individual editing.
- Added Edit series inside bill details; it starts at the next occurrence and updates only that occurrence and future uncleared occurrences while preserving cleared history.


## v2-216
- Added app-wide Original, Rose, Blue, Green, Purple, Warm Neutral, and Custom color palettes.
- Added stable category palette roles so bills/essentials can stay light and flexible spending can stay dark across palette changes.
- Added optional per-category custom color overrides and preserved legacy colors for backward compatibility.
- Added palette role/custom color fields to category CSV import/export.
