# Money Nest

Money Nest is a personal budgeting, debt, and cashflow planning app built for paycheck-to-paycheck money management.

Current version: `money-nest-v2-176`

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

Pending reimbursements are used when one account temporarily covers money for another account.

Expected reimbursement money should not be treated as available until the reimbursement is cleared.

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
