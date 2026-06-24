# Money Nest

Money Nest is a personal budgeting, debt, calendar, and cashflow planning app built for real-life paycheck-to-paycheck money management.

Current version: `money-nest-v2-171`

## Important Project Notes

* App is hosted with GitHub Pages.
* Desktop layout should mostly stay the same unless specifically requested.
* iPhone/mobile layout can look different and more app-like.
* Data is saved locally in browser storage.
* Supabase manual cloud save/load works.
* Auto-sync should be treated carefully and not rushed without conflict protection.
* Keep JSON backup/import/export available as the safety backup.
* Keep CSV import/export compatibility when adding new fields.
* Always package updates as the next versioned zip.

## Data Storage

Money Nest data is saved per:

* device
* browser
* website URL

Closing the browser or shutting down the computer should not delete data.

Data may be lost if browser/site storage is cleared.

## GitHub vs Data

GitHub Pages hosts the app files:

* `index.html`
* `app.js`
* `styles.css`
* `manifest.webmanifest`
* `favicon`
* `icons/`

Updating GitHub updates the app code. It does not automatically update or erase the user’s budget data.

## Backup Rule

Before updating the GitHub Pages app files, export a JSON backup from Settings.

The JSON backup is the full restore file and may contain sensitive financial information. Do not upload JSON backups to a public GitHub repo.

## Supabase Cloud Sync

Supabase manual save/load is working.

Current sync approach:

* Manual save/load works.
* Supabase stores one Money Nest JSON blob per logged-in user.
* JSON backup/export should remain available.
* Auto-sync should only be added later with safety features.

Recommended future auto-sync protections:

* visible local/cloud timestamps
* warning if cloud copy is newer
* pause sync button
* manual save/load still available
* conflict handling before overwrite
* possibly cloud snapshot history

## Important Current Behaviors

### Calendar

Calendar supports:

* planned and cleared transactions
* recurring transactions
* occurrence overrides
* category colors
* account filters
* category highlight filters
* highest/lowest projected balance day highlights
* today highlight
* mobile app-style layout

Recurring transaction status changes should apply only to the clicked occurrence, not the whole recurring series.

### Mobile / iPhone

Mobile layout is allowed to be different from desktop.

Current mobile behavior:

* bottom app-style navigation
* emoji nav icons
* floating `+` transaction button
* condensed account/dashboard cards
* calendar top controls should not scroll weirdly with the calendar

Desktop layout should remain mostly unchanged.

### Accounts

Accounts support:

* cash accounts
* account reordering
* safe-to-spend
* savings goals
* transfers
* reimbursements/IOUs
* forecast/history views

Transfers should display by account routing, such as:

* `Ty → Joint`
* `Savings → Joint`
* `Mak → Joint`

### Bills

Bills page shows recurring/planned bills and supports filtering/sorting.

### Debts

Debts are grouped by:

* type
* company
* account

Debt types include:

* Credit Cards
* Loans
* Buy Now, Pay Later
* Medical

Credit cards track:

* current balance
* statement balance
* credit limit
* available credit
* statement date
* next statement
* monthly payment
* payment status
* utilization by owner
* payoff simulation

Credit utilization simulator supports:

* per-owner simulation
* per-card utilization
* target utilization percent
* payment needed to reach target utilization
* temporary balances that do not change real data

BNPL/Klarna behaves like installment loans.

BNPL notes:

* Do not use editable “Next payment due” in Edit Debt.
* BNPL payment dates are created when BNPL is added.
* Original installment due dates should be preserved in transaction notes.

Medical debts behave like interest-free payment plans.

Loans/auto loans support:

* statement/current balance baselines
* principal/interest/fee breakdowns
* forecast-only payment history
* fee timing
* estimated payoff dates
* balance adjustments

Current Balance should generally use statement/current balance baseline plus cleared transactions after that date, not blindly use starting balance.

Starting Balance is mainly original/history/progress only.

### Paychecks

Paychecks use hourly estimators.

Mak paycheck:

* paid on 7th and 22nd
* if payday falls on weekend, moves to previous Friday
* variable based on pay-period weekdays

Ty paycheck:

* weekly
* default hours: 38
* editable hours override

Paycheck occurrence edits should save to that occurrence only when selected.

### Recent Changes / Undo

Recent Changes supports:

* detailed transaction summaries
* added/edited/deleted transaction details
* per-item undo
* full batch undo

### Transaction Templates / Autofill

Transaction title autofill/templates should only affect basic fields:

* title
* category
* notes

Autofill should not change:

* account
* debt/card account
* transfer-to account
* linked debt/payment account
* type
* status

Title suggestions have an inline `×` to delete unwanted templates.

Deleting a suggestion only deletes the saved template, not existing transactions.

### Credit Card Workflows

Create Card Payment:

* works on existing credit card purchases
* should default to planned status
* creates missing cash-account payment
* can optionally create reimbursement/IOU

Use Card Instead:

* used when a planned cash expense is actually paid with a card
* creates card spend and payment flow
* supports different purchase date and payment date

### Reimbursements / IOUs

Pending reimbursements are used when one account temporarily covers money for another account.

Expected reimbursement money should not count as available until cleared.

Normal Mark Cleared should clear reimbursement status too.

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

### v2-171

* Tightened iPhone/mobile layout.
* Made dashboard summary cards more compact on mobile.
* Made account cards shorter and more app-like on mobile.
* Calendar top controls are fixed on mobile so they should not scroll weirdly with the calendar.
* Desktop layout unchanged.

### v2-170

* Reworked iPhone/mobile bottom nav to feel more like an app.
* Mobile nav uses emoji icons instead of full word labels.
* Made bottom nav more compact and rounded.
* Floating `+` button made more app-like.
* Desktop nav/layout unchanged.

### v2-169

* Added mobile bottom app-style navigation.
* Floating `+ Transaction` button added on mobile.
* Calendar month/filter controls pinned at top while scrolling.
* Calendar day cards made more compact on mobile.

### v2-168

* Made iPhone/mobile spacing tighter overall.
* Switched sidebar/nav into compact mobile header.
* Reduced card/panel padding and font sizes on mobile.
* Improved mobile modals/forms.

### v2-167

* Added Settings → Cloud Sync.
* Added Supabase URL/key fields.
* Added email/password login, create login, logout.
* Added Save to cloud and Load from cloud.
* Added sync modes: Manual only, Auto-save after changes, Off/paused.
* Manual Supabase save/load confirmed working.

### v2-166

* Added inline delete buttons to transaction title suggestions/templates.
* Typo/old templates can be removed from the suggestion dropdown.
* Deleting a suggestion removes only the saved template, not existing transactions.

### v2-165

* Added target utilization calculator to credit utilization simulator.
* Simulator calculates payment needed to bring a card to target utilization.
* Create Card Payment now defaults to planned status.
* Transfer labels now show account routing, such as `Ty → Joint`.

### v2-164

* Added per-card utilization details in payoff simulator.
* Card utilization updates immediately when simulated balances/payments change.

### v2-163

* Fixed Simulate Payoff button issue in credit utilization section.

### v2-162

* Fixed local date handling so app uses local browser date instead of UTC.
* Added credit utilization payoff simulator by owner.

### v2-161

* Dashboard credit card statement labels distinguish Upcoming vs Check Statement.
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

* Recent Changes now shows detailed transaction summaries.
* Added before/after details for edited transactions.

### v2-153

* Autofill templates no longer change transaction type, status, or account routing.
* Added Settings → Recent Changes with Undo Last Change.

### v2-152

* Removed extra TODAY text from calendar.
* Kept bold border/date highlight for today.

### v2-151

* Calendar now highlights today with a bold border/date highlight.

### v2-150

* Replaced Calendar Highlight multi-select with checkbox dropdown.
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

* Auto/loan current balance now uses statement balance and statement date as lender baseline when provided.
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

* Calendar highlights lowest and highest projected balance days of the month.

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

* Added expand/collapse controls on Debts page.

### v2-126

* Credit card rows on Debts page now show Available Credit.

### v2-125

* Credit card detail pages now show Available Credit.

### v2-124

* Removed manual Current Balance editing for regular debt accounts.
* Current Balance calculates from baseline plus cleared activity.
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

* Monthly payment supports Minimum Due + Manual Extra.
* Plan Payment defaults to monthly payment total.

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
