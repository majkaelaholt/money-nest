# Money Nest

Money Nest is a personal budgeting, debt, and cashflow planning app built for paycheck-to-paycheck money management.

Current version: `money-nest-v2-200`

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

