# CODEX

## v2-269

- Dashboard palette hierarchy: major Dashboard panels map to Main panels, nested sections map to Secondary panels, and inner rows/metrics map to Soft panels. Keep this role separation when adding future Dashboard UI.
- Dashboard palette work is presentation-only; do not change financial calculations merely to achieve visual hierarchy.

- Transaction palette hierarchy is literal and must not use a blended derived input color: `#transactionModal .transaction-modal-card` = `var(--panel)` (Main panels); `.form-details`, `.auto-paycheck-box`, and `.amount-calculator-panel` = `var(--panel-secondary)` (Secondary panels); transaction inputs/selects/textareas = `var(--soft-panel)` (Soft panels).
- Keep the iPhone `.mobile-quick-add .form-details` override aligned to `var(--panel-secondary)` so older higher-specificity mobile rules cannot reintroduce color mixing.
- Presentation-only; no transaction/palette data-shape changes. Schema remains 225.

## v2-267
- Add/Edit Transaction Amount and Date must render at the same visual field height. Because the historical `#transactionModal #txDate` rule has higher specificity than newer shared input rules, keep an explicit late date-field override: 38px on compact desktop, 44px on iPhone quick entry, while iPad retains its existing 46px touch sizing.
- This is presentation-only; do not change transaction date storage or schema behavior. Schema remains 225.

## v2-266
- Calendar day headers show the smaller muted cleared-only balance (`✓`) only on the cell for `todayISO()`. Today must show it even if cleared and projected totals are equal; do not repeat cleared balances on other days.

## v2-265
- Calendar day headers may show two balances: the existing primary projected end-of-day balance and a smaller muted cleared-only balance (`✓`) when the values differ. The cleared balance must be calculated with the same calendar account perspective/filter and only `status === "cleared"` activity.
- Do not replace or reinterpret the primary Calendar balance; lowest/highest day highlighting continues to use the projected balance. Suppress the secondary cleared amount when it equals the projected amount to avoid duplicate visual noise.
- No schema/data-shape changes; schema remains 225.

## v2-264
- New transaction-template title families are opt-in. Before `rememberTransactionTemplate()` creates the first active family for a title, transaction save asks whether the user wants that shortcut saved. Declining must never block or undo the financial transaction save. Existing active title families may continue lightweight auto-learning/variant behavior. Recurring series/occurrences remain excluded.
- Add/Edit Transaction keeps Amount and Date as equal-width paired fields and suppresses native number spinners on Amount.
- Edit-only actions (Delete, Duplicate, Create card payment when eligible) are direct footer buttons; do not reintroduce a redundant More actions disclosure while the footer has room.
- No schema/data-shape changes; schema remains 225.

## v2-263
- Add/Edit Transaction uses a compact UI order: Title, Category, Amount/Date, Type/Account. Keep the stored transaction `status` field exactly as before; `#txCleared` is UI-only and synchronizes to the hidden `#txStatus` select (`checked = cleared`, unchecked = planned) so backups, CSVs, templates, recurring logic, and older data stay compatible.
- The Amount calculator is a compact helper opened from the `−/+` button inside the Amount field. It must not alter transaction data until Use/Enter is applied; applying sets Amount and closes the helper.
- Preserve the progressive-disclosure sections and viewport-bounded scrolling. Desktop uses the slimmer transaction dialog; iPhone quick entry and iPad behavior remain responsive.
- No schema/data-shape changes; schema remains 225.

## v2-262
- Appearance app surfaces now have three distinct roles: `app.panel` = Main panels, `app.panelSecondary` = Secondary/nested panels, and the existing `app.panel2` = Soft/innermost panels. Preserve `panel2` semantics for backward compatibility; do not rename or repurpose it.
- Older palette data may omit `panelSecondary`. `paletteSecondaryPanelColor()` / palette snapshot merging derives a safe midpoint from Main + Soft until the user saves an explicit Secondary value. Palette/reset-default JSON remains backward compatible and schema stays 225.
- Use Main panels for outer cards/modals, Secondary panels for nested section containers, and Soft panels for rows/items/controls inside those containers. Exceptions may be intentional when a screen has only two nesting levels (for example Add/Edit Transaction uses Main outer + Soft options).
- Quick Actions specifically uses Secondary for the container and Soft for recent-place/search items.
- No financial, transaction, template, recurring, JSON/CSV, or Supabase behavior changed.

## v2-261
- Manage Templates includes a `Uses field` view filter driven by normalized template application flags. Preserve this filter in `templateManagerState` across edit/save/cancel return flows.
- `templateUsesFilteredField()` treats dormant values as not in use. Notes require an active notes flag plus nonblank note; Cash account requires an active account flag plus an account ID; routing fields may count with an empty saved value because an active routing field can intentionally clear that destination/debt.
- No schema/data-shape changes; schema remains 225.


## v2-260
- Template notes must support an intentional blank. In `simpleTemplate()`, never use the previous saved note as a fallback when the Saved note textarea exists but has been cleared. A blank saved note should also leave `fields.notes` disabled because template application does not use a blank note to clear transaction notes.
- Transaction templates and recurring Bills series are separate records. `templateRecurringInfo()` / `templateRecurringMatches()` are reference-only presentation helpers. Editing, deleting, archiving, bulk-editing, or simplifying a transaction template must never mutate `data.transactions` or any recurring series/occurrence. Recurring bill note/amount/schedule/account/routing changes belong only to Bills → Edit Series.
- No schema/JSON/CSV/Supabase changes; schema remains 225.

## v2-259
- Bills now includes computed Recurring Health. Keep these checks conservative and review-only: >7-day past-planned occurrences, two consecutive stable cleared amounts that materially differ from the saved series estimate, and possible exact-route/schedule duplicate recurring series. Never auto-edit/archive/merge a series because of a health finding.
- Active Bills are organized into Needs review, Coming up, and Later. The health-only toggle is UI state only; no schema field is saved. Bill Details shows the same computed findings.
- Preserve the existing 7-day grace principle for uncleared planned activity. Preserve same-title/different-schedule recurring series as valid independent series; duplicate health requires the same core route/schedule plus amount.
- No JSON/CSV/Supabase/schema changes; schema remains 225.

## v2-258
- Appearance now supports optional per-palette reset baselines in `settings.appearance.paletteResetDefaults`. Missing baselines must always fall back to the existing built-in palette defaults; do not require a migration or schema bump.
- `Set current as reset default` saves the on-screen palette state and makes it the future Reset target for only the active palette. `Use built-in reset default` deletes only that saved baseline and must not alter the currently active colors.
- `Reset this palette` resets colors/app palette values only; preserve editable palette-role labels as before. Reset baselines are preference data and remain covered by normal JSON/cloud backup behavior.
- Appearance color inputs use full-bleed native swatches without the browser's white inset. Schema remains 225.

## v2-257
- Template Manager is the return destination when `simpleTemplate()` is opened from a manager row. Preserve manager query/filter/family/hide-recurring state and scroll position across Save, Cancel, Delete, and close; do not route back to Settings.
- `templateRecurringInfo()` / `templateRecurringMatches()` are presentation helpers only. They identify recurring-linked shortcuts by exact normalized title plus any template-applied category/account/routing fields. Do not persist a new recurring flag on templates.
- Template Manager includes a runtime-only `Hide recurring-linked` filter and Recurring badges/details. Recurrence configuration continues to live exclusively in Bills.
- Schema remains 225; no JSON/CSV/Supabase/template payload migration is introduced.

## v2-256
- Transaction modal visual correction only: keep the progressive-disclosure structure from v2-250+, but use compact desktop proportions closer to the earlier Money Nest form.
- Desktop `#transactionModal` must remain viewport-bounded and vertically scrollable through `.transaction-modal-card`; long recurring/paycheck/loan edits must never become unreachable below the viewport.
- Calculator remains inline with the Amount label but must stay visually quiet and must not increase the Amount/Date row height.
- Preserve iPhone full-screen quick entry and iPad modal overrides. No transaction payload, template data, JSON/CSV, cloud, or schema changes; schema remains 225.

## v2-255
- Template suggestion metadata must not redundantly say “Applies category.” Category is a core shortcut field and is already conveyed by the option/category label; `templateFieldSummary()` should surface only additional autofill fields beyond title/category.
- Preserve template data/ranking/application behavior and all CSV/JSON/Supabase compatibility. Schema remains 225.

## v2-254
- Transaction-template autocomplete must remain open when focus moves from `txTitle` into `#txTemplateSuggestions`, including the `<summary>` used to open a family’s option list. Do not hide suggestions solely because the title input blurred when the new active element is inside the suggestion popover.
- Selecting a concrete template option still applies that template and closes the popover normally. No template ranking, application, persistence, CSV/JSON, or schema changes. Schema remains 225.

## v2-253
- Do not show the older-schema upgrade notice as a startup banner. Keep the existing schema-upgrade information available in Settings/Data & Backup instead of interrupting app launch.
- Keep `templateManagerFamilyFilter` truly hidden when no family filter is active; author CSS must not override its `hidden` attribute.
- Keep `template-bulk-more > summary` visually consistent with rounded Money Nest buttons.
- Amount and Date must remain vertically aligned: Calculator belongs in the Amount label row, not underneath the amount input.
- Schema remains 225; do not change transaction/template payloads or JSON/CSV/Supabase formats for these UI fixes.

## v2-252
- Fixed the Template Manager launch path so DOM click/pointer events cannot become a bogus family filter (`[object PointerEvent]`). The manager now opens to the normal Active view with all active templates visible.
- Standardized visual sizing/rhythm for transaction and template editor fields and bulk-manager controls; no template schema or transaction-save behavior changed.

## v2-251
- Transaction modal fit: `#transactionModal` and `.transaction-modal-card` must remain width-compatible. Do not reintroduce a fixed/wider inner card that can force horizontal scrolling; transaction grid children/selects must be allowed to shrink with `min-width:0`.
- Template Settings is intentionally scan-first: one compact row per active normalized title family. Clicking a family opens `openTemplateCleanup(familyKey)`, which is now the bulk Template Manager.
- Template Manager supports multi-select across visible templates, search/filtering, bulk changes to status/category/type/account/routing fields, simplify-to-title+category, archive/restore/delete, exact duplicate merge, and deliberate same-title merge. Bulk edits must never alter saved transactions.
- A bulk value of “Don't autofill this field” disables only the matching `fields.*` application flag and preserves the dormant saved field value for backward compatibility. Applying a value enables that field.
- Any template intentionally edited through `simpleTemplate()` or the bulk manager becomes `source:"manual"`; this prevents later automatic learning from overwriting custom rules. Automatic learning still creates title+category-only shortcuts and recurring series/occurrences still create no template clutter.
- Never merge templates merely because titles match. Only exact-signature cleanup or an explicit selected same-title merge may remove variants.
- Preserve existing template family/variant/default/archive fields and CSV columns. No JSON/CSV/Supabase/schema changes; schema remains 225.

## v2-250
- Transaction entry is now progressive-disclosure UI only. Preserve all existing transaction IDs/fields and save semantics: primary fields are title, amount/date, account/category, type/status; routing, recurrence, links, notes, loan breakdown, and edit actions remain available behind contextual disclosures.
- `txAccount` moved into the primary form; `txRoutingDetails` now contains only optional card/debt and transfer/payment destinations. Do not move routing data or change transaction payload semantics.
- Template autocomplete should show one best/context-aware variant per title family first; extra variants stay selectable through the compact options control. Never collapse/merge saved variants merely because titles match.
- Template Settings families start collapsed. Archived variants and destructive/default/archive controls remain available after opening a family or Cleanup, but should not dominate the scan view.
- `simpleTemplate()` uses explicit “Don't change” values for optional fields. When a field is not applied, preserve its dormant saved value for backward compatibility; only its `fields.*` application flag is disabled.
- Automatic lightweight templates still store title + category only, recurring series still do not generate template clutter, and template CSV family/variant metadata remains compatible. Schema remains 225.

## v2-249
- Dashboard/Needs Review past-planned findings use `pastPlannedNeedsAttention(tx, 7)` and must not flag a transaction until it is more than 7 days past its planned date.
- Credit Card `paymentStatus` is now presentation-derived through `automaticCreditCardPaymentInfo()` / `debtDisplayPaymentStatus()`. Preserve the legacy saved `paymentStatus` field for imports/exports and non-credit debt types; do not migrate or delete it.
- Automatic Credit Card status precedence: statement balance ≈ $0 AND minimum due ≈ $0 => Paid; active non-archived recurring linked payment series => Autopay; linked planned payment in the relevant statement due cycle => Scheduled; linked cleared payment in that cycle => Paid; otherwise Unpaid.
- `creditCardRelevantDueDate()` anchors the payment due cycle to the saved statement date when available so missed payments remain detectable after the calendar due day passes.
- Dashboard Needs Attention flags automatic Unpaid cards when their relevant due date is within 7 days or past due. $0 statement/$0 minimum cards do not count as needing payment planning even if newer charges increased current balance.
- Credit-card edit/update UIs show payment status as automatic; the manual status selector remains for loans, medical debts, and BNPL as before.
- Schema remains 225. No JSON/CSV/Supabase shape changes.

## v2-248
- Calendar drag/drop must work for cleared recurring occurrences, not only planned occurrences.
- `moveTransactionOccurrence()` updates both `dateOverrides[originalDate]` and an existing non-deleted `occurrenceOverrides[originalDate].date`; otherwise the cleared occurrence override wins during `applyOccurrenceOverride()` and makes the transaction appear not to move.
- This is a date-editing fix only. Preserve cleared status, recurrence lineage, linked transaction/payment metadata, storage/export formats, and schema 225.

## v2-247
- iPhone now has a task-first presentation layer: Home, Future, Accounts, and More. Desktop/iPad navigation and management workflows remain intact.
- `renderMobileHome()` is presentation-only and uses existing `safeToSpend()`, transaction expansion, and attention calculations. Full Dashboard review/action tools are still present and can be revealed on phone.
- `renderMobileFuture()` uses existing account balance/forecast helpers and a runtime-only account/horizon selection. The What-if preview subtracts a temporary hypothetical spend from projected daily balances and never saves a transaction or changes data.
- Mobile Add Transaction uses CSS/runtime dialog classes only; the existing transaction form, field IDs, validation, templates, save logic, recurrence, links, loan breakdowns, and exports remain unchanged.
- No schema migration or saved field is introduced; schema remains 225.

## v2-246
- Bills rendering bug fix: recurring dedupe must retain prepared render fields such as `nextDate` and `billInfo`; do not replace prepared rows with raw canonical transactions.
- `billCardHTML()` has a defensive display-date fallback, but recurring schedule/date calculation logic itself is unchanged.
- Schema remains 225 and no saved-data format changes are introduced.

## v2-245
- Visual/UX overhaul pass 3 simplifies Accounts without changing account/debt math, storage, or schema.
- Cash-account reorder controls are runtime-only Arrange mode UI; account ordering still uses the existing `order` field and reorder helpers.
- Debt tools are collapsed by default; per-row due/min Update was removed only from list presentation and remains available in debt detail.
- Detail action menus are presentation-only and keep existing edit/payment/adjustment functions intact.

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

Latest known version: `money-nest-v2-273`

### v2-273 adaptive desktop Calendar rule
- Do not hard-lock the desktop Calendar page with `overflow:hidden`. Keep the page scroll-free when the calendar naturally fits, but allow normal document scrolling on shorter desktop/laptop viewports.
- When entering Calendar on desktop, reset the document scroll position to the top so scroll preserved from a longer page cannot clip the calendar.
- Preserve iPad/iPhone Calendar scrolling behavior.

### v2-272 targeted surface rules
- This version intentionally starts from v2-270; do not reintroduce the rejected broad v2-271 Budgets/Accounts remap.
- Accounts: connected cash-account list surface = Soft; Credit Utilization container = Secondary and each owner card = Soft; debt company header = Secondary and its opened debt-account list = Soft. Keep rows flat/connected.
- Budgets: preserve the v2-270 flat sections. Only the actual Spending by Category content, Budget Performance list, and Monthly Budget Targets list get a Soft backing surface; do not box every row into a separate card.
- Desktop Calendar should fill the viewport without a few pixels of document scrolling. Because calendar overflow must remain visible for popovers, round edge cells directly instead of restoring `overflow:hidden` on the grid.

### v2-270 palette surface rules
- `App background` (`--bg`) controls the page/workspace backdrop. Do not mix `Main panels` into the body background; this is what keeps strongly colored Main cards distinct from the page.
- Settings hierarchy: master groups/overview = Main panels; nested settings cards = Secondary panels; fields, summary/status cards, paycheck cards, rows, and ordinary ghost controls = Soft panels.
- Bills hierarchy: page panel = Main panels; Recurring Health, Filters/tools, archived containers, and bill-health detail containers = Secondary panels; filter controls, health chips, bill lists/rows = Soft panels.
- Keep the three palette surface roles semantically distinct instead of creating derived/blended replacements unless the blend is only a hover state.

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

- Current version: money-nest-v2-269. Includes the iPhone task-first Home/Future experience and streamlined mobile transaction entry, plus the Bills next-date rendering fix, visual/UX overhaul passes, completed cleared-loan breakdown sampling across recurring occurrences, Dashboard breakdown completeness alerts, in-place recurring bill series replacement, cleared-history preservation, split-series repair, combinable Budget Review filters, global search, and data-health scanning.


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


### v2-250
- Keep the transaction modal common-path-first. `transactionPayloadFromForm()` and recurrence/link/payment logic remain the source of truth; the overhaul is presentation and disclosure only.
- `matchingTransactionTemplateFamilies()` ranks a best option for each title family using the existing default/context/usage scoring. Additional variants must remain reachable and independently selectable.
- Main template management is scan-first: families closed by default, archived versions nested, and destructive/default/archive operations behind secondary controls.
- The simplified template editor must preserve saved values for disabled optional fields while setting only their `fields.*` application flags to false.
- No schema, JSON/CSV, localStorage, or Supabase shape changes. Schema remains 225.

### v2-249
- Use the shared 7-day grace helper for both Dashboard and integrated Needs Review past-planned findings.
- Credit Card statuses must be derived from linked payment evidence, not manually edited `paymentStatus`. The old field remains serialized for compatibility.
- Relevant card due dates should stay tied to the current saved statement cycle when `statementDate` is present; this is required for overdue-card detection.
- Automatic Unpaid status only becomes a Dashboard alert when the relevant due date is within 7 days or already overdue.

### v2-248
- `moveTransactionOccurrence()` keeps cleared recurring occurrence overrides synchronized with calendar drag/drop date changes.
- Do not remove or recreate the occurrence override when moving it; update its `date` in place so cleared status and any loan/payment/link metadata remain attached to the same occurrence.
- Schema remains 225.

### v2-247
- Phone-only Home/Future rendering is intentionally separate from desktop/iPad management views. Keep the mobile UI task-first rather than re-expanding hidden management surfaces by default.
- The mobile Future What-if calculator is non-persistent. Do not save hypothetical amounts into transactions unless the user explicitly creates one.
- The four-item iPhone nav hides Calendar/Bills/Budgets/Settings only at the phone breakpoint; those pages must remain reachable through the More sheet and must remain visible in desktop/iPad navigation.
- Transaction quick-entry classes must not remove form fields or change save semantics; they are presentation-only.
- Data schema remains 225.

### v2-246
- `dedupeRecurringBillRows()` groups by canonical recurring-series identity but returns the prepared render row so derived `nextDate` / `billInfo` values are not discarded.
- `billCardHTML()` resolves `displayDate` defensively and never intentionally renders an undefined date label.
- Recurrence generation, bill next-date selection, storage, exports, Supabase, and schema remain unchanged.

### v2-245
- `accountReorderMode` is an unsaved runtime UI state; it does not alter backup/schema formats.
- `renderAccounts()` keeps existing balance/Safe-to-Spend/savings calculations and only changes row presentation plus when existing reorder helpers are exposed.
- `renderDebts()` keeps debt totals/status/utilization/due calculations; list-level Update is removed because `quickDebtDue()` remains in debt detail.
- Cash/debt detail secondary actions are grouped under native `<details>` menus but call the same existing functions.
- No JSON/CSV/schema/Supabase changes.

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
