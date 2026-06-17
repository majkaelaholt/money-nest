# Money Nest

Money Nest is a personal budgeting, debt, and calendar-based cashflow app built for paycheck-to-paycheck planning, debt tracking, recurring bills, and short-term financial visibility.

It is designed as a cozy money command center for managing:

* cash accounts
* planned and cleared transactions
* recurring bills
* paycheck estimates
* credit cards
* loans
* BNPL/installment plans
* medical payment plans
* savings goals
* reimbursements/IOUs
* upcoming debt payments
* projected balances

## Current Version

Current app version: `money-nest-v2-160`

## How the App Works

Money Nest runs as a static web app. It can be hosted with GitHub Pages using these files:

* `index.html`
* `app.js`
* `styles.css`
* `manifest.webmanifest`
* `favicon`
* `icons/`

The app data is stored locally in the browser using browser storage. Updating the app files on GitHub updates the app code, but does not automatically move or sync budget data between devices.

## Important Data Notes

Money Nest data is saved per:

* device
* browser
* website URL

Data should remain available when closing/reopening the browser on the same device and same browser, unless browser/site storage is cleared.

To move data to another device or browser, use:

1. Settings → Export JSON backup
2. Open Money Nest on the other device/browser
3. Settings → Import JSON backup

## Backup Reminder

Before updating the hosted GitHub Pages files, export a JSON backup from Settings.

The JSON backup is the full restore file and may include sensitive financial information such as:

* account names
* balances
* debts
* transactions
* bills
* income/paychecks
* planned payments
* notes
* categories

Do not upload JSON backups to a public GitHub repository.

## Updating the GitHub Pages App

When updating to a new Money Nest version, replace the app files in GitHub with the newest version.

Usually re-upload:

* `index.html`
* `app.js`
* `styles.css`

Also upload these if they changed:

* `manifest.webmanifest`
* `favicon`
* `icons/`

Safest update method:

1. Export a JSON backup from the live app.
2. Download/unzip the newest Money Nest version.
3. Upload the new app files to GitHub.
4. Commit the changes.
5. Wait for GitHub Pages to deploy.
6. Hard refresh the app.
7. Confirm existing data still loads.

## Core Features

### Dashboard

The dashboard shows a quick overview of:

* safe-to-spend amounts
* upcoming transactions
* action center items
* debt payments due soon
* credit card statements to check
* savings goal progress

### Calendar

The calendar supports:

* planned and cleared transactions
* recurring transactions
* account filters
* category highlight filters
* projected daily balances
* highest balance day highlight
* lowest balance day highlight
* today highlight
* right-click transaction actions

### Accounts

Accounts support:

* cash account balances
* forecast and history views
* planned and cleared transactions
* savings goals
* planned transfers
* pending reimbursements/IOUs

### Bills

Bills are based on recurring and planned transactions and support filtering/sorting.

### Debts

Debt tracking supports:

* credit cards
* loans
* auto loans
* BNPL/installment plans
* Klarna-style purchases
* medical payment plans
* payment status
* monthly payment totals
* manual extra payments
* estimated payoff dates
* credit line and available credit
* statement/current balance baselines
* loan principal/interest/fee breakdowns
* loan forecast estimates

### Paychecks

Money Nest supports paycheck estimating for:

* Mak paycheck schedule
* Ty weekly paycheck schedule
* optional hours override
* one-off occurrence edits

## Special Workflows

### Credit Card Rewards Workflow

For planned cash expenses that are paid with a card:

1. Plan the expense in the cash account.
2. After using the card, right-click the planned expense.
3. Choose `Use card instead`.
4. Select the card, purchase date, payment account, and payment date.

This creates a card spend transaction while still preserving the cashflow plan.

### Existing Card Charge → Create Payment

For card charges already entered first:

1. Right-click the card transaction.
2. Choose `Create card payment`.
3. Select the cash account paying the card.
4. Optionally create a reimbursement/IOU if another account fronted the money.

### Reimbursements / IOUs

Pending reimbursements allow one account to plan money leaving while another account shows expected money without treating it as available until cleared.

When the reimbursement transaction is marked cleared, it becomes a normal cleared transfer.

## Export Options

Money Nest includes multiple export options:

* JSON backup: full restore file
* CSV exports: batch editing/reference
* Financial picture report: readable short-term overview
* 12-month financial picture report: longer-range overview

## Pending Updates / Issues to Fix

Use this section to track things that need to be fixed or added later.

### Bugs

- when using "create card payment", the created payment should default to "planned" status and not "cleared".
- "today" highlight/box on calendar is off, e.g. it's 7pm mountain time on 6/16/26 but the calender is highlighting 6/17/26 as today.
- transactions for transfering from savings to another cash account, it shows as "Savings -> Savings" because it uses the transaction title, it should show "account to account", depending on the chosen accouts. another example would be Ty moving money to Joint should show as "Ty -> Joint" instead of "Ty to Joint -> Joint".

### Feature ideas / Updates

- In the "Credit Card Statements" portion of the "Action Center" card in the Dashboard, instead of all of the cards saying "Check Statement", the statements that likely haven't pulled yet (so tomorrow or after) should say "Upcoming", since I can't check those statements yet.
- In the "Needs Attention" portion of the "Action Center" card in the Dashboard, I don't want to see when the "safe to spend is low" on any of the accounts, only if it's less than or equal to $0.

## Version Notes

### v2-160

* Fixed edited recurring occurrences reopening as Add Transaction instead of Edit Transaction.
* Calendar and account detail should now reopen the correct edited occurrence.
* Applies to edited groceries, paychecks, car payments, and other recurring transactions.

### Recent major updates

* Added recurring occurrence overrides.
* Added recent changes with undo and per-item undo.
* Added reimbursement/IOU tracking.
* Added card-first and cash-plan-first credit card workflows.
* Added loan principal/interest/fee breakdowns.
* Added loan payoff forecast settings.
* Added financial picture exports.
* Added dashboard statement reminders.
* Added calendar high/low/today highlighting.
* Added saved filters/sorts.
* Improved debt current balance logic using statement/current balance baselines.
