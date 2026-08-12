# CODEX

## v2-244
- Visual/UX overhaul pass 2 keeps Dashboard Action Center groups closed by default and reduces Bills/Budgets visual clutter without changing finance calculations or saved data.
- Bills use compact category-accented list rows; Archive/Restore/Reactivate moved into the bill detail modal, while filters/repair tools are collapsed until needed.
- Budget Review and Monthly Budget Targets use flatter rows/section separators with less redundant UI.

## v2-243
- Visual/UX overhaul pass 1 reduces shared card/panel visual weight and restructures Dashboard hierarchy without changing saved data or finance calculations.
- Dashboard uses a compact alert metric strip, a lowest-cushion Safe to Spend focus, shorter Upcoming preview, and collapsible Action Center groups.
- Action Center still surfaces the same attention/debt/statement data; preview limits are presentation-only and link back to Calendar/Accounts for the remainder.

Money Nest Developer Rules

This file is the working guide for Codex or any AI coding agent editing **Money Nest**.

Money Nest is a custom static GitHub Pages app for personal budgeting, debts, bills, calendar cashflow, budgets, and paycheck-to-paycheck planning.

## Current expected version

Latest known version: `money-nest-v2-244`

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

- Current version: money-nest-v2-244. Includes the first visual/UX overhaul pass with a calmer Dashboard hierarchy, plus completed cleared-loan breakdown sampling across recurring occurrences, Dashboard breakdown completeness alerts, in-place recurring bill series replacement, cleared-history preservation, split-series repair, combinable Budget Review filters, global search, and data-health scanning.


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





### v2-223
- Desktop Search moved into the Recent Places card; mobile keeps the compact topbar search control.
- Original palette was merged into Custom. Legacy `paletteId: "legacy"` data migrates to editable Custom using the original colors.

### v2-221

- Preset palettes now use broader coordinated color families and include a Red/Orange/Gold option.
- All preset palettes can be adjusted and reset. Saved edits live under `settings.appearance.paletteOverrides` and must remain JSON/cloud compatible.
- Category roles and per-category custom overrides remain the source of category color assignment; CSV fields are unchanged.

### v2-220

- Removed Calendar density controls and restored comfortable density.
- Calendar title is integrated into the toolbar to save vertical space.

### v2-219

- Fixed app startup ordering so `data = loadData()` runs only after the palette constants and normalization helpers are initialized.
- This prevents the `Cannot access MONEY_NEST_PALETTES before initialization` runtime failure that blocked rendering and navigation.
- Palette and bulk category color features remain enabled; saved-data and import/export schemas are unchanged.

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

## v2-223
- Consolidated the sidebar into a Quick Actions card with Search, recent places, and Add Transaction.
- Grouped Settings into Appearance, Data & Backup, Automation, and App Preferences.
- Added recurring-management guidance and shortcuts to Bills.
- Added a unified transaction detail screen before editing from calendar, search, bills, accounts, and review findings.
- Added app version, schema version, and last local save status in Settings.
- Added an automatic warning when substantially older saved data is normalized to the current schema.
- Added editable per-palette labels for each category color role.

### v2-224
- Made major cards, rows, forms, calendar cells, and sidebar surfaces follow the selected app palette instead of retaining hard-coded beige backgrounds.
- Reworked the palette editor into wider, roomier cards so role labels, editable names, and color controls no longer feel cramped.


### v2-226
- Unified cash and debt account transaction-filter UI. Cash accounts now use one timeline with Status filtering rather than separate Bank/Forecast views.
- Account balances use a compact summary row and ledger filters are collapsed until requested.


### v2-226
- Transaction modal date field height/alignment fix; no data model changes.

### v2-228
- Existing transaction selections now open the editor directly again; the v2-223 intermediate detail screen is bypassed.
- Transaction-linking data and editor controls remain supported.


### v2-228
- Dashboard list-card surfaces now consistently use palette variables.


### v2-229
- Settings grouping order now starts with Data & Backup, followed by Appearance, Automation, and App Preferences. The Settings Map remains above all grouped cards.


### v2-230
- Bill-series transaction lists now use chronological soonest-first ordering.


### v2-231
- Bills **Edit series** uses `replaceBillSeriesInPlace()` rather than the generic recurring “this and future” split behavior. It keeps one active recurring template and materializes cleared occurrences before replacing future schedule data.
- Exact legacy split fragments are identified when an older recurring template ends one day before a matching replacement starts. `repairSplitRecurringSeriesData()` consolidates those fragments conservatively.
- Bills rendering and bill details resolve the canonical active fragment so old split templates do not appear as separate active/ended cards.
- Bill-series deletion from bill details or the explicit series editor keeps cleared history as non-recurring rows and removes the rule plus uncleared linked rows.
- `billOccurrenceInfo()` tracks used loose matches and does not stop on an already-handled occurrence, preventing a single payment from skipping multiple weekly/monthly due dates.
- Transaction CSV recurring linkage columns: `recurringSourceId`, `recurrenceSourceId`, `originalDate`, and `wasRecurringOccurrence`. All are optional on import.


### v2-232
- `billOccurrenceInfo()` now treats loose matched planned rows as the active upcoming occurrence. Only cleared loose matches set `handled=true`, preventing the displayed Next date from skipping over a visible planned transaction.


### v2-233
- Bills page cards resolve their displayed `nextDate` through `billDisplayedNextDate()`, which selects the earliest non-cleared linked occurrence on or after today.
- The same resolved date is used for card text, Bills sorting, card occurrence metadata, and status context.


### v2-234
- Budgets now support an optional custom `emoji` field.
- `budgetCategoryLabel()` uses the saved budget emoji first, then falls back to the category or multi-category default icon.
- Budget CSV import/export includes an optional `emoji` column; old CSV and JSON data remain valid.


### v2-235
- Budget target and performance lists now sort alphabetically by displayed budget title.


### v2-236
- `billSeriesEditOccurrence()` resolves the first non-cleared linked occurrence in chronological order and supplies its effective/original dates to the series editor.
- `openBillSeriesEditor()` and its direct-editor override now use that helper, ensuring `replaceBillSeriesInPlace()` starts regeneration from the earliest uncleared occurrence and leaves cleared history unchanged.


### v2-237
- Recurring template IDs are the primary series identity. `dedupeRecurringBillRows()` no longer collapses independent rows based on matching title/content.
- `recurringScheduleSignature()` distinguishes monthly day, yearly month/day, weekly weekday, nth-weekday position, every-N-days anchor, interval, and weekend handling.
- Legacy split-lineage inference requires both compatible content/routing and the same schedule signature.
- `deleteRecurringSeriesAndOrphans()` deletes only the canonical lineage and rows explicitly linked to it.
- Loose payment matching excludes rows linked to another recurring lineage.


### v2-240
- Added tablet-only responsive modal sizing and spacing using a coarse-pointer media query, preserving desktop and phone layouts.


### v2-244
- Dashboard Action Center sections are collapsed on every render.
- Bills rows are compact; list-level Archive/Restore controls were moved to bill details, with return values added to archive/restore helpers only to support closing the modal after successful confirmation.
- Bills filter/repair controls are inside a collapsed disclosure; existing IDs and event bindings remain unchanged.
- Budget Review and Monthly Budget Targets are visually flattened; budget calculations and editor behavior are unchanged.
- Data schema remains 225.

### v2-243
- Dashboard markup keeps the existing `summaryCards`, `mobileQuickReview`, `safeSpendList`, `upcomingList`, `needsReviewSummary`, `needsReviewList`, and `debtSnapshot` IDs so existing render/event hooks remain compatible.
- `renderDashboard()` keeps the same Safe to Spend, attention, debt-due, statement, and budget calculations; only presentation/order/preview length changed.
- Action Center groups use native `<details>` disclosure elements. Needs Attention opens automatically only when findings exist; debt and statement groups start collapsed.
- Shared panel/card shadow/radius adjustments are CSS-only. No schema, storage, import/export, Supabase, recurring-series, budget, or loan-calculation changes.


### v2-242
- `loanBreakdownSamples()` reads expanded cleared occurrences so occurrence-level loan breakdowns contribute to forecasting.
- Only complete Principal/Interest/Fees samples train forecasts; matching history-only samples are skipped when a real transaction exists.
- `clearedLoanPaymentsMissingBreakdown()` powers a persistent Action Center warning and per-payment Needs Review findings.
- No schema change was required; existing JSON/CSV fields and older backups remain compatible.


### v2-241
- Transaction templates are grouped by normalized title into families; variants have custom labels, default/archive state, and independent field-application rules.
- Automatic template remembering stores title/category only and ignores recurring series/occurrences.
- Template cleanup supports exact duplicate consolidation and deliberate selected-variant merge/archive/delete.
- Category cleanup reports transaction counts, last use, configured references, and supports safe category merge or unused deletion.
- Template CSV includes variantLabel, isDefault, archived, source, and createdAt.
