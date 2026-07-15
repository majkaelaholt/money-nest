# Money Nest

Money Nest is a personal budgeting, debt, and cashflow planning app built for paycheck-to-paycheck money management.

Current version: `money-nest-v2-237`

## Important Notes

### Data is saved locally first

Money Nest saves data in browser storage first.

This means local data is tied to the same:

* device
* browser
* website URL

Closing the browser or shutting down the computer should not delete data. However, clearing browser/site data can remove saved Money Nest data.

Money Nest also supports manual Supabase cloud sync. Manual Save to cloud / Load from cloud can move the current Money Nest JSON blob between logged-in devices, but JSON backup/export should still be treated as the safety backup.

### GitHub hosts the app files, not the safety backup

GitHub Pages hosts the app files, such as:

* `index.html`
* `app.js`
* `styles.css`
* `manifest.webmanifest`
* `favicon`
* `icons/`

Updating GitHub updates the app code. It does not upload your budget data to GitHub. Use Money Nest Settings for JSON backup/export and manual Supabase save/load.

### Always export a JSON backup before updating

Before replacing the app files on GitHub, export a JSON backup from Money Nest Settings.

The JSON backup is the full restore file and may include sensitive financial information. Do not upload JSON backups to a public GitHub repository.

### Moving data to another device

To use the same data on another device or browser, use either:

1. Export a JSON backup from the current device.
2. Open Money Nest on the other device/browser.
3. Import the JSON backup in Settings.

Or, when logged in with Supabase:

1. Save to cloud from the device with the correct data.
2. Open Money Nest on the other device/browser.
3. Load from cloud.

## Codex / AI Editing Notes

Future Codex chats should read `CODEX.md` and `README.md` before editing Money Nest.

`CODEX.md` contains the project rules for AI/code-agent work, including data safety, Supabase cloud sync, localStorage, JSON/CSV import/export compatibility, versioning, README updates, mobile layout rules, and behaviors that should not be broken.

When starting a new Codex chat, use:

```text
Before editing, read CODEX.md and README.md. Follow CODEX.md as the project rules/source of truth.
```

## Updating the GitHub Pages App

Safest update process:

1. Export a JSON backup.
2. Download/unzip the newest Money Nest version.
3. Upload the new app files to GitHub.
4. Commit the changes.
5. Wait for GitHub Pages to deploy.
6. Hard refresh the app.
7. Confirm existing data still loads.

Usually re-upload:

* `index.html`
* `app.js`
* `styles.css`

Also upload these if they changed:

* `manifest.webmanifest`
* `favicon`
* `icons/`

## App Behavior Notes

### Planned vs cleared transactions

Planned transactions affect forecasts, but cleared transactions represent what actually happened.

Recurring transactions should usually remain planned by default, with individual occurrences marked cleared as needed.

### Current balances

Debt current balances should generally use the most recent statement/current balance as the baseline, then count cleared transactions after that date.

Starting balance is mainly for history/progress and should not always be used as the current balance baseline.

### Credit card payments

Credit card purchases should count as the real spending category.

Credit card payments should usually behave like transfers/payments, not new spending. This avoids double-counting categories like groceries, gas, or shopping.

### Reimbursements / IOUs

IOU / reimbursement transactions are used when one account temporarily covers money for another account.

These now behave like normal planned transfers in forecasts and Safe to Spend, while still keeping the IOU label for tracking.

### JSON vs CSV exports

Use JSON for full backup/restore.

Use CSV for reviewing or batch-editing data.

## Planned Updates / Issues

### Bugs

* [ ]
* [ ]
* [ ]

### Feature Ideas

* [ ]
* [ ]
* [ ]

### Data Cleanup

* [ ]
* [ ]
* [ ]

### Questions / Review Later

* [ ]
* [ ]
* [ ]

## Version Notes


### v2-223
- Moved the desktop Search button into the Recent Places card beside the quick transaction controls; the compact topbar Search button remains available on mobile.
- Removed the separate Original palette option.
- Custom now starts from the original Money Nest colors and remains fully editable. Existing Original selections migrate to Custom without losing category role assignments.

### v2-221

- Expanded preset palettes into broader coordinated color families so category roles are more visibly distinct (for example pink + purple, blue + teal + indigo, and red + orange + gold).
- Added a new Red, Orange & Gold preset.
- Made every preset palette editable, including category role colors and app background/panel/accent/text colors.
- Added per-preset saved overrides and a Reset this palette action. Palette adjustments are stored in app settings and preserved by JSON/cloud backups.
- Existing category palette roles, custom category overrides, legacy colors, and CSV compatibility remain unchanged.

### v2-220

- Removed Calendar density controls and restored the original comfortable calendar spacing.
- Moved the Calendar title into the calendar control bar to reclaim vertical space.
- Kept Calendar account and category filters intact.


### v2-219

- Fixed a startup runtime crash caused by saved data loading before the color-palette constants were initialized.
- Palette settings and bulk category color editing remain available; no palette rollback was required.
- Added versioned asset references to prevent GitHub Pages from mixing cached HTML, CSS, and JavaScript files.
- Verified dashboard rendering and navigation across Dashboard, Calendar, Accounts, Budgets, Bills, and Settings in a browser-like runtime test.
- No saved data, JSON backup, or CSV compatibility changes.

### v2-216
- Fixed Calendar density controls so Compact, Comfortable, and Detailed visibly change day sizing, chip sizing, metadata, and the number of transactions shown before “+ more.”
- Moved Needs Review onto the Dashboard and removed the standalone Review navigation/page.
- Combined Smart Cleanup & Data Health with Needs Review into one Dashboard panel.
- Removed the duplicate Smart Cleanup card from Settings.



### v2-214

- Added transaction linking for related purchases, payments, reimbursements, transfers, and planned/cleared records. Links are reciprocal and preserved in JSON and transaction CSV import/export.
- Added a centralized Needs Review inbox for past planned transactions, broken references, possible unlinked bills, duplicates, and stale recurring rules. Findings can be reviewed or dismissed.
- Added Compact, Comfortable, and Detailed calendar density controls, saved as a browser UI preference.
- Added a backup health indicator showing the last JSON backup, last cloud save, and whether local edits are newer than the newest saved copy.

### v2-213
- Simplified Budget Review by replacing the four large summary cards with one compact summary strip.
- Moved month-over-month comparison, biggest category change, and the six-month trend into a collapsed **More insights** section so the primary review is easier to scan.
- Kept spending-by-category and budget-performance drill-downs visible as the main review tools.
- Smart Cleanup & Data Health in Settings now starts collapsed like the other Settings sections.
- No saved data fields, calculations, JSON backups, or CSV formats changed.


### v2-212
- Combined the former Accounts and Debts pages into one **Accounts** page.
- Cash accounts appear first, with credit cards, loans, BNPL, medical debts, and other debt accounts directly below.
- Removed the separate Debts navigation item to reduce page clutter.
- Preserved all account/debt data, detail views, editing, reordering, payoff tools, imports, exports, and old internal Debts links (which now redirect to Accounts).

### v2-211
- Made Budget Review Quick Views combinable across spending type and accounts.
- **All spending**, **Extra spending**, and **Bills** act as the spending-mode choices, while **Mak**, **Ty**, and **Joint** can be toggled independently or combined.
- Removed the separate Budget Review Account dropdown and Include recurring bills checkbox. With no account buttons selected, the review uses all accounts; selecting one or more account buttons limits the review to those accounts.
- Budget summaries, charts, trends, comparisons, performance rows, calculation explanations, and category drill-downs now respect combined account selections.

### v2-210
- Removed the pie chart drop shadow and clipped all slices to the outer circle so hover/focus borders cannot overlap neighboring slices or extend outside the chart.
- Tightened slice separators for cleaner rendering at desktop and mobile sizes.
- Strengthened Bills card grid sizing for both active and Ended / Archived cards so Archive, Restore, and Reactivate buttons cannot push amounts off-screen.

### v2-204

* Moved the Last 6 months spending chart into a compact full-width section above the category chart.
* Expanded the Spending by category card so the pie chart has more room on desktop.
* Removed slice scaling on hover/focus so SVG slices no longer visually overlap or cover neighboring slices; hover now uses a stronger outline/brightness treatment.
* Kept the mobile layout compact and responsive.

### v2-202

- Fixed **Include recurring bills** so occurrence-only edits remain recognized as bills after their date or other details are changed.
- Added backward-compatible loose matching for older one-time replacement rows that lost their recurrence link, using the same routing/category/title/amount logic as the Bills page plus a nearby scheduled-date check.
- New one-time recurring replacements now preserve explicit recurring-source metadata for future filtering.



### v2-201
- Replaced the Budget Review “Include transfers/card payments” filter with **Include recurring bills**. Turning it off excludes recurring/bill transactions from review totals, charts, trends, budget performance, and drill-down transaction lists so extra spending is easier to isolate.
- Added multi-category monthly budgets. A single budget can now combine categories such as Rent, Phone, and Utilities while still respecting its selected account scope.
- Budget target cards, performance rows, averages, and drill-downs now total all categories selected for that budget.
- Preserved old budgets by converting their legacy `categoryId` into a one-item `categoryIds` list during normalization.
- Extended budget CSV export/import with `categoryIdsJSON` while retaining `categoryId` as a legacy fallback. JSON backup compatibility remains intact.

### v2-200
- Excluded the Banking category from all budget totals, charts, reviews, targets, and new-budget category choices. Banking remains available for normal transaction categorization.
- Savings-category cash transfers now use net contribution math: transfers into a savings account increase Savings spending, while transfers out reduce it.
- Budget detail totals, transaction amounts, merchant breakdowns, account breakdowns, and trend calculations now use the same signed budget amount logic.
- Existing Banking budgets remain preserved in saved data/backups but are ignored by the budgeting interface.

### v2-199

* Fixed the grouped “smaller categories” item in Spending by Category so selecting a category opens its transaction review instead of the budget editor.
* Updated the grouped-category prompt wording from budgeting to reviewing.

### v2-198
- Budget transaction reviews now exclude entries that are not tied to a current cash account, preventing credit-card/debt ledger activity from appearing as “Unknown account.”
- Monthly Budget Targets rows now open the budget editor directly. Transaction drill-down remains available from Spending by Category and Budget Performance.

### v2-195

* Added cloud sync safety checks before Save to cloud / Load from cloud so stale devices warn before overwriting newer cloud data or loading an older cloud copy over newer local edits.
* Added an amount calculator inside the Add/Edit Transaction modal for quick fee/split/conversion math.
* Added a BNPL payment schedule option for monthly installments on the same date, alongside the existing every-N-days schedule.
* No JSON/CSV schema changes needed.

### v2-194

* Improved Bills recurring-date logic so moved, dragged, or separately planned/cleared matching payments can satisfy an older recurrence occurrence.
* Bills now uses looser matching based on account routing, transfer/debt target, category, amount, and similar title text to avoid stale June due cards when a payment was handled elsewhere.
* Ended recurring series now show as ended/cleared instead of being labeled due.
* No JSON/CSV schema changes needed.

### v2-193

* Bills page now shows the next upcoming recurring occurrence instead of anchoring recurring rows to stale past June dates.
* Recurring bill status now treats future occurrences as Planned even if an older occurrence/template was cleared, so the recurring list is less misleading.
* Ended/expired recurring items still fall back to their latest occurrence instead of disappearing.
* No JSON/CSV schema changes needed.

### v2-192

* Dashboard payment detection now counts planned payments made early within the payment window, not just cleared early payments.
* Needs Attention and Debt Payments Due Soon now ignore paid-off cards/debts with no active amount due, so $0-due cards do not ask for missing minimums or payments.
* Debt payment matching is more flexible for older/manual payment rows by checking stable debt links first, then matching clear debt names in payment titles/notes.
* Removed the misleading Today forward option from Account Forecast View and added Custom date ranges with From/To date inputs.
* No JSON/CSV schema changes needed.

### v2-191

* Needs Attention cards now include account/routing context so past planned items and due-soon debt alerts show where the money is coming from or going.
* Debt/card/BNPL due-soon alerts now use smarter planned-payment matching based on linked debt IDs and actual installment/payment rows.
* BNPL/Klarna due dates now prefer the next planned installment transaction, so valid planned installments are not incorrectly marked as missing.
* Planned-payment matching now recognizes early cleared payments within the payment window.
* No JSON/CSV schema changes needed.

### v2-190

* Dashboard Upcoming now excludes cleared transactions, including cleared recurring occurrence overrides.
* Calendar now initializes to the current local month on app load instead of a stale hard-coded month.
* Today uses the local date helper before scrolling to today's calendar card on mobile.
* No JSON/CSV schema changes needed.

### v2-189

* Added Codex / AI Editing Notes to the README.
* Documented that future Codex chats should read CODEX.md and README.md before editing.
* Documentation-only update; no app behavior or import/export schema changes.

### v2-188

* Settings sections now default closed when opening Settings.
* Transaction templates now support multiple saved templates with the same title.
* Each transaction template can choose which fields it applies, including category, notes, type, status, cash account, debt/card account, cash transfer destination, and payment debt.
* Template suggestions now show the saved variant and fields so similar titles like `Shell` can be separated by category/type.
* Transaction template CSV export/import now includes template field-toggle columns while preserving older template CSV compatibility.

### v2-187

* IOU / reimbursement transactions now behave like normal planned transfers in projected balances and Safe to Spend.
* The IOU option still exists when creating card payments, but receiving accounts now count the planned payback immediately in forecasts.
* Updated account-detail labels so planned IOUs are described as included in projected balance instead of “not available yet.”
* No import/export schema changes needed.

### v2-186

* Forecast View now includes past planned/pending transactions through the selected range instead of hiding old pending items.
* Safe to Spend now shows the actual lowest projected balance, including negative amounts, instead of clamping overdraw risk to $0.
* Fixed the mobile date field layout in the Add/Edit Transaction modal.
* Added a small Today-button scroll retry so iPhone has more time to render before scrolling to today.
* No import/export schema changes needed.

### v2-185

* Made Backup & reports collapsible on Settings.
* Changed Monthly budgets by account to show the set monthly budget and recent average spending instead of duplicating the Budget Performance progress bar.
* Removed iPhone tap highlight flash so taps look cleaner.
* iPhone calendar now shows all transactions on each day card instead of +N more.
* Today button now scrolls the Calendar page down to today's day card after switching to the current month.

### v2-184

* Tightened iPhone top spacing so pages start closer to the status area.
* Reworked the iPhone bottom navigation dock to stay compact, centered, and clear of the phone edges.
* Reduced the floating add button offset to match the corrected dock size.
* No import/export schema changes needed.

### v2-183

* Reduced excess iPhone top safe-area whitespace by using full viewport safe-area handling.
* Enlarged and re-centered the iPhone bottom navigation dock so it has more edge breathing room.
* Adjusted the floating add button position to sit above the larger bottom dock.
* No import/export schema changes needed.

### v2-182

* Clarified the difference between Budget Review and Monthly Budget Targets.
* Budget Review now includes helper text explaining it is a read-only snapshot for the selected month/account.
* Budget cards now display the category as the main label and the account as smaller secondary text.
* Applied the category-first layout to both Budget Performance and Monthly Budget Targets.
* No JSON/CSV schema changes needed.

### v2-181

* Made Budget Review pie grouping smarter.
* Categories now show as their own pie slices when they are budgeted, at least $100, or at least 3% of the month’s reviewed spending.
* The Other slice now only groups tiny categories by default, with a cap to keep the chart readable.
* Tapping Other now offers the exact grouped categories from the current chart instead of using the old top-six split.
* No JSON/CSV schema changes needed.

### v2-180

* Made Budget Review spending pie interactive.
* Hovering or long-pressing chart slices/legend rows shows account, percent, and amount details.
* The Other slice now summarizes the smaller grouped categories.
* Tapping a slice or legend row opens Add Budget with that account/category preselected.
* Added an Include transfers/card payments option so account review can show where money moved, including card-paid spending categories.
* Budget performance now counts card-paid category payments, such as groceries paid back to a credit card.
* No import/export schema changes needed.

### v2-179

* Changed Budget Review category visualization so bars are only used for set budget progress.
* Replaced unbudgeted relative category bars with a spending-by-category pie chart.
* Spending pie chart groups smaller categories into Other and uses cleared expense transactions only.
* Added compact iPhone-friendly pie chart and legend styling.
* No JSON/CSV schema changes needed.

### v2-178

* Added a Budget Review section to the Budgets page.
* Budget Review shows monthly cleared spending, cleared income, total budgeted, unbudgeted spending, and budget status.
* Added top category spending bars, a 6-month spending trend chart, and budget-vs-actual review rows.
* Added month and account filters for budget review.
* Added iPhone-friendly compact Budget Review layout.
* No JSON/CSV schema changes needed.

### v2-177

* Removed the delete/edit "whole recurring series" option so past/cleared history is not accidentally changed.
* Delete recurring transaction choices are now only "this occurrence only" or "this and future occurrences."
* Edit recurring transaction choices are now only "this occurrence only" or "this and future occurrences."
* Fixed "delete this and future occurrences" so it stops the recurring series before the selected date and removes future generated occurrences.
* Fixed skipped recurring occurrences so old `9999-12-31` skip markers do not show as real future transactions.
* No import/export schema changes needed.

### v2-176

* Fixed iPhone transaction ledger rows so account detail transactions behave like compact cards instead of overflowing like desktop tables.
* Added extra bottom spacing on mobile calendar pages so the final days are not hidden behind the bottom navigation dock.
* Tightened calendar day-number positioning inside mobile day cards.
* Applied the same mobile overflow protection to similar row/card layouts.
* No import/export schema changes needed.

### v2-175

* Cleaned up Settings into clearer sections with emoji headers: Cloud sync, Backup & reports, Recent changes, Customize, and Reference.
* Clarified that Recent Changes is local browser undo history and does not necessarily match the latest cloud save/load date.
* Made Recent Changes storage more reliable on iPhone/browser localStorage by saving compact change details and trimming history if storage gets tight.
* Recent Changes now shows a storage-limited note instead of silently looking stale if undo snapshots cannot be saved.
* No JSON/CSV import/export schema changes needed.

### v2-174

* Changed iPhone Calendar header/controls back to normal top-of-page content instead of fixed/sticky overlays.
* Fixed mobile Calendar day headers/date numbers so they sit inside each day card correctly.
* Further tightened Dashboard mobile cards/lists across similar sections, including Needs Attention, Debt Payments Due Soon, Credit Card Statements, Safe to Spend, and Upcoming Transactions.
* No import/export schema changes needed.

### v2-173

* Fixed the iPhone Calendar header stack so the page title stays pinned at the top with the calendar controls directly underneath.
* Removed the weird mobile Calendar overlap where the controls could cover the Calendar heading while scrolling.
* Tightened iPhone account cards by moving reorder/edit controls into the card corner and reducing empty vertical space.
* Tightened iPhone debt and credit utilization cards so they use compact mobile grids instead of tall single-column cards.
* No import/export schema changes needed.

### v2-172

* Added `README.md` as the main GitHub project README file.
* Updated the README current version and recent version history.
* Documented manual-first Supabase cloud sync while keeping JSON backup/export as the safety backup.
* No app data/import/export schema changes needed.

### v2-171

* Tightened iPhone/mobile layout.
* Made account and dashboard cards more compact on mobile.
* Changed mobile calendar controls to a fixed top bar so they do not scroll with the calendar.
* Desktop layout remains mostly unchanged.

### v2-169

* Made the iPhone/mobile layout more app-like with bottom navigation and a floating add-transaction button.
* Fixed Calendar mobile controls so the month/filter header stays pinned while scrolling the calendar.
* Desktop layout remains unchanged.

### v2-168

* Added an iPhone/mobile compact layout pass.
* Mobile view uses tighter spacing, smaller cards/buttons, horizontal top navigation, compact panels, and better modal scrolling.
* Desktop layout remains unchanged.

### v2-167

* Added Supabase Cloud Sync settings.
* Supports login/logout, Save to cloud, Load from cloud, and optional auto-save.
* Cloud sync can be paused/off and JSON backups remain recommended.

### v2-166

* Added inline delete buttons to transaction title suggestions/templates.
* Typo/old templates can now be removed directly from the suggestion dropdown.
* Deleting a suggestion removes only the saved template, not existing transactions.
* No import/export schema changes needed.

### v2-165

* Added target utilization calculator to the credit utilization simulator.
* The simulator can calculate how much payment is needed to bring a card down to a target utilization percent.
* Create card payment now defaults to planned status.
* Transfer labels now show account routing, such as `Ty → Joint`.

### v2-164

* Added per-card utilization details in the payoff simulator.
* Card utilization updates immediately when simulated balances/payments change.

### v2-163

* Fixed the Simulate Payoff button issue in the credit utilization section.

### v2-162

* Fixed local date handling so the app uses the local browser date instead of UTC.
* Added credit utilization payoff simulator by owner.

### v2-161

* Dashboard credit card statement labels now distinguish upcoming statements from statements ready to check.
* Needs Attention safe-to-spend alerts only show when safe-to-spend is $0 or below.
* Added account reorder controls.
* Removed incorrect BNPL next payment due editing.
* Added dropdown default settings.
* Added credit utilization summary by owner.

### v2-160

* Fixed edited recurring occurrences reopening as Add Transaction instead of Edit Transaction.
* Calendar and account detail now reopen the correct edited occurrence.

### v2-159

* Fixed JSON backup import issues.
* Backup imports no longer create huge Recent Changes snapshots.
* Import errors should now show more specific messages.

### v2-158

* Mark cleared / mark planned on recurring transactions now applies only to the clicked occurrence.
* Recurring templates stay planned by default.
* Individual cleared recurring dates are saved as occurrence overrides.

### v2-157

* Removed separate Mark Reimbursement Cleared action.
* Normal Mark Cleared now clears reimbursement status too.
* Adjusted calendar styling for planned/cleared transaction chips.

### v2-156

* Fixed recurring paycheck “This occurrence only” edits.
* Hours overrides now save for one paycheck occurrence.
* Added occurrence override export/import support.

### v2-155

* Recent Changes now supports per-item undo.
* Added options to remove one added item, undo one edit, or restore one deleted item.

### v2-154

* Recent Changes now shows more detailed transaction summaries.
* Added before/after details for edited transactions.

### v2-153

* Autofill templates no longer change transaction type, status, or account routing.
* Added Settings → Recent Changes with Undo Last Change.

### v2-152

* Removed the extra TODAY text from the calendar.
* Kept the bold border/date highlight for today.

### v2-151

* Calendar now highlights today with a bold border/date highlight.

### v2-150

* Replaced Calendar Highlight multi-select with a checkbox dropdown.
* Category highlight choices are easier to click/toggle.

### v2-149

* Savings account cards now show all planned transfers in as the main amount.
* Next 30 days amount remains as short-term context.

### v2-148

* Added Export 12-month picture.
* Longer report includes upcoming transactions, planned cashflow, debt payments, statements, and projected cash.

### v2-147

* Added Export financial picture.
* Report includes accounts, balances, debts, upcoming payments, statements, bills, and cashflow.

### v2-146

* Added statement/current balance fields for Medical debts.
* Medical current balance can use statement/current balance plus cleared transactions after that date.

### v2-145

* Added forecast-only auto-loan payment history from Book1.
* Future auto-loan payments can estimate more realistically as balance changes.

### v2-144

* Auto/loan current balance now uses statement balance and statement date as the lender baseline when provided.
* Planned/recurring loan payments can auto-estimate principal, interest, and fees.

### v2-143

* Added loan payoff forecast settings.
* Future recurring loan payments can estimate principal, interest, and fees.
* Added fee timing options.

### v2-142

* BNPL/Klarna rows now reflect installment status correctly.
* Added installment status editing for BNPL accounts.

### v2-141

* Added loan payment breakdown fields for principal, interest, and fees.
* Added loan balance adjustments.

### v2-140

* Removed All Forecast option from Accounts because it could crash the site.
* Old saved All Forecast preferences now fall back safely.

### v2-139

* Safe to Spend now handles payday correctly.
* On payday, paycheck accounts look toward the following paycheck.

### v2-138

* Calendar highlights the lowest and highest projected balance days of the month.

### v2-137

* Dashboard Debt Payments Due Soon now shows fewer items.
* Credit card statement reminders only show past due/today/next 7 days.
* Debts page credit card rows show Next Statement instead of After Payment.

### v2-136

* Added Dashboard Credit Card Statements section.

### v2-135

* Saved last filter/sort dropdown choices across major views.
* Search boxes remain temporary.

### v2-134

* Transaction autofill only applies title, category, and notes.
* Autofill no longer saves or applies account routing fields.

### v2-133

* Added Create Card Payment for existing credit card charges.
* Optional reimbursement/IOU creation added.

### v2-132

* Added Expand Accounts / Collapse Accounts buttons inside each debt type section.

### v2-131

* Added IOU / reimbursement tracking.
* Expected reimbursements do not count as available until cleared.

### v2-130

* Added Use Card Instead workflow for planned cash expenses paid with a credit card.

### v2-129

* Debt detail transactions show debt/card payments as positive because they reduce debt.

### v2-128

* Expand/collapse debt controls now affect debt types only.

### v2-127

* Added expand/collapse controls on the Debts page.

### v2-126

* Credit card rows on the Debts page now show Available Credit.

### v2-125

* Credit card detail pages now show Available Credit.

### v2-124

* Removed manual Current Balance editing for regular debt accounts.
* Current Balance now calculates from baseline plus cleared activity.
* Added tracking start date support.

### v2-123

* Fixed Debts page crash caused by recurring transaction expansion too far into the future.

### v2-122

* Current Balance now updates from cleared card/debt transactions.
* Planned future payments do not affect Current Balance early.

### v2-121

* Credit card Current Balance now matches saved/editable Current Balance field.
* Planned payments no longer reduce current balance early.

### v2-120

* Added Estimated Payoff card to debt detail pages.

### v2-119

* Monthly payment now supports Minimum Due + Manual Extra.
* Plan payment defaults to monthly payment total.

### v2-118

* Medical/loan Current Balance now uses saved Current/Remaining Balance field.
* Medical Paid So Far calculates from Starting Balance minus Current Balance.

### v2-117

* Debt groups/accounts start collapsed by default.
* Expansion state is session-only.

### v2-116

* Fixed Medical account detail crash by adding missing medical payment plan helpers.

### v2-115

* Fixed Debts page crash from missing Medical debt helper.

### v2-114

* Improved BNPL and Medical balance labels/normalization.
* BNPL purchases now save starting balance separately from current balance.


## Version history


### v2-197
- Fixed the Budget transaction review modal so it fits the viewport, avoids sideways overflow, and always has accessible close controls.
- Spending-by-category pie slices and legend rows now open a category transaction review for the selected month/account instead of opening the Add Budget form.
- Simplified budget account selection by removing the Account scope dropdown. Checked account boxes now automatically represent one, multiple, or all accounts while preserving the existing saved scope fields for compatibility.

### v2-196
- Added budget drill-downs from Budget Performance and Monthly Budget Targets.
- Budget details show included transactions, date, merchant/title, account, category, amount, and status.
- Added merchant/place and account spending breakdowns with top-place and top-account summary cards.
- Added budget account scopes: one account, all accounts, or selected multiple accounts.
- Preserved old budgets as single-account budgets during data normalization.
- Extended budget CSV export/import with `accountScope` and `accountIdsJSON` while keeping legacy `accountId` compatibility.
- Added an iPhone-friendly bottom-sheet-style budget detail layout with compact transaction cards.


## v2-204
- Added Budget Review quick presets for all spending, extra spending, bills-only, and personal/joint account views.
- Added named budget groups for multi-category budgets.
- Added month-over-month spending comparisons and biggest category movement.
- Added a “Why these totals?” inspector for budget calculations and active filters.
- Added Smart Cleanup & Data Health tools for broken references, likely duplicates, stale recurring rules, and unlinked recurring bill suggestions.
- Added one-click linking for transactions that appear to belong to a recurring bill.
- Added a compact mobile “Today at a glance” dashboard section.
- Added global transaction search across title, merchant, category, account, date, amount, type, and status.
- Recent Changes continues to show detailed before/after collection summaries with per-item undo.


### v2-205
- Polished the global search dialog layout and close button placement.
- Added selected-state styling for Mak, Ty, and Joint budget quick views.
- Deduplicated obsolete recurring bill series on the Bills page, preferring the active/future series over an ended replacement.


### v2-206
- Tightened Smart Cleanup duplicate matching to compare category, type, status, transfer routing, and debt routing in addition to date/title/amount/account.
- Possible duplicate findings now show both matching saved records with separate Review buttons.
- Added Dismiss and Restore dismissed controls for duplicate cleanup findings. Dismissals are stored locally and do not modify transaction data.


### v2-208

- Fixed Bills row alignment after adding Archive/Restore actions.
- Status and archive controls now have their own action column, while amounts keep a dedicated right-aligned column and no longer get pushed off-screen.
- Preserved responsive two-column and mobile card layouts.

### v2-207
- Added a collapsed **Ended / Archived bills** section on the Bills page.
- Added **Archive** for active recurring bills. Archiving removes future and non-cleared linked occurrences while preserving cleared history and the recurring rule.
- Added **Restore** for archived bills and **Reactivate** for naturally ended recurring rules.
- Archived recurring templates no longer contribute planned/future occurrences to calendars, forecasts, balances, or budget review.
- Transaction CSV import/export now preserves archive metadata. Older JSON and CSV backups remain compatible.


### v2-210
- Pie rendering cleanup and archived Bills action/amount alignment.

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
- Simplified cash-account details into one transaction timeline controlled by the same Status, Category, Type, Date range, and Sort filters used on debt accounts.
- Removed Bank View / Forecast View mode tabs.
- Replaced the three large cash balance cards with one compact summary row.
- Added a shared Filters / Hide filters control to cash and debt transaction ledgers.
- Tightened cash and debt account context headers for a more consistent layout.


### v2-226
- Fixed the Add/Edit Transaction date input so it matches the amount field height and aligns cleanly in the Basics grid.
- Preserved the existing mobile date picker behavior and all transaction data compatibility.

### v2-228
- Restored direct transaction editing: selecting an existing transaction now opens the Edit Transaction form immediately instead of the intermediate transaction detail screen.
- Transaction linking remains available inside the editor.
- No saved-data or import/export fields changed.


## v2-228
- Standardized Dashboard Safe to Spend, Upcoming, Needs Attention, and Debt Payments Due Soon cards to use the same palette-aware surface color.
- Removed leftover hard-coded card fills that made some Dashboard rows appear darker than others.


### v2-229
- Reordered the four grouped Settings sections so **Data & Backup** is the first card directly below the Settings Map.
- The Settings Map remains at the top, and all section contents and saved data behavior are unchanged.


### v2-230
- Bill-series details now sort associated transactions by date with the soonest occurrence first.


### v2-231
- Reworked **Edit series** on the Bills page so it replaces the active recurring rule in place instead of leaving a visible ended fragment and creating a second series.
- Cleared bill history is materialized as normal linked cleared transactions before a series is replaced or deleted; only uncleared/planned occurrences are regenerated or removed.
- Added a conservative **Repair split series** tool on Bills and a one-time automatic repair for exact old-series/new-series splits created by earlier Money Nest versions.
- Fixed loose bill-payment matching so one cleared payment cannot satisfy multiple recurring dates; handled occurrences are skipped and the next truly unpaid date is shown.
- Added a direct **Delete series** action in bill details; deleting a series removes the recurring rule and all uncleared occurrences while preserving cleared history.
- Transaction CSV import/export now preserves recurring-source linkage fields used by repaired bill history. Older CSV and JSON backups remain compatible.


### v2-232
- Fixed recurring bill **Next** dates so a saved planned occurrence remains the current upcoming bill instead of being treated as already handled.
- Only cleared matching transactions advance a recurring series to its following date.
- Bill cards and bill-series detail headers now stay aligned with the first planned transaction shown in the associated transaction list.


### v2-233
- Fixed Bills page recurring-series cards so **Next** uses the earliest actual linked planned occurrence, matching the bill detail list and header.
- Bills sorting and card occurrence metadata now use that same displayed date.


### v2-234
- Added an optional editable emoji/icon field to Add/Edit Budget.
- Custom budget emojis appear in Monthly Budget Targets, Budget Performance, and budget transaction detail headings.
- Existing budgets safely fall back to their category emoji (or the multi-category basket icon) when no custom emoji is saved.
- Added the optional `emoji` column to budget CSV export/import while preserving older CSV compatibility.


### v2-235
- Sorts Monthly Budget Targets alphabetically by displayed budget title.
- Sorts How You Did vs Budget alphabetically by the same displayed title.


### v2-236
- Fixed **Edit series** so the editor loads the earliest uncleared occurrence shown in the bill history, rather than a later calculated recurrence date.
- Series changes now start at that earliest uncleared date and regenerate every later planned occurrence while preserving all cleared history.
- If no uncleared linked occurrence exists, the editor safely falls back to the next calculated recurrence date.


### v2-237
- Recurring series are now identified by their unique template/lineage ID rather than by title, route, or amount.
- Bills with the same title can coexist as separate schedules, including monthly rules on different dates such as the 7th and 22nd.
- Legacy split-series matching now also requires a matching recurrence schedule, preventing unrelated same-title rules from being merged or hidden.
- Deleting a recurring series now removes only that exact series and its linked occurrences; similarly named recurring rules remain untouched.
- Loose bill-payment matching will not borrow a transaction already linked to another recurring series.
