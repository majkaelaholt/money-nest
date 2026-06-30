# CODEX.md — Money Nest Developer Rules

This file is the working guide for Codex or any AI coding agent editing **Money Nest**.

Money Nest is a custom static GitHub Pages app for personal budgeting, debts, bills, calendar cashflow, budgets, and paycheck-to-paycheck planning.

## Current expected version

Latest known version: `money-nest-v2-188`

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

## Compatibility rules

Preserve backward compatibility whenever possible.

If adding or changing data fields:

1. Add safe defaults for old data.
2. Update any normalization/migration logic.
3. Update JSON import/export behavior.
4. Update CSV export/import if the new fields should be editable or preserved.
5. Explain the schema change in the final summary and `README.md`.

Never silently break existing saved browser data.

## Storage and sync

Money Nest uses multiple data safety layers:

1. localStorage for normal browser saving
2. JSON backup/export/import for full restore
3. CSV export/import for reviewing or batch editing
4. Supabase manual cloud saving/loading/sync

Do not treat any one of these as disposable.

When touching data logic, verify that:

- local data still loads
- JSON export still produces a full restore file
- JSON import validates and restores data
- CSV export/import still works for affected entities
- Supabase settings and sync behavior are not removed or broken

## Important product behavior

### Planned vs cleared transactions

Planned transactions affect forecasts. Cleared transactions represent what actually happened.

Recurring transactions generally remain planned by default, with individual occurrences marked cleared as needed.

### Forecasts

Forecasts should include planned/pending transactions that still affect projected cash.

Past planned/pending transactions should not be hidden from forecast views if they still matter to the user.

### Safe to Spend

Safe to Spend is important and should not be changed casually.

Current behavior expectation:

- Personal accounts generally look through the next paycheck window.
- Joint Checking generally uses the next lowest projected balance day.
- Savings should generally not show Safe to Spend.
- Negative projected balances should be visible, not hidden as `$0.00`.

If changing Safe to Spend, clearly explain the exact rule change.

### IOU / reimbursement transactions

IOU/reimbursement transactions should behave like normal planned transfers in projected balances and Safe to Spend.

The IOU label/tracking is still useful, but it should not hide the receiving side of the transfer until cleared.

### Credit card purchases and payments

Credit card purchases should count as the real spending category.

Credit card payments should usually behave like transfers/payments, not new spending. This avoids double-counting categories like groceries, gas, or shopping.

### Debts

Debt areas include credit cards, loans, BNPL/Klarna-style accounts, medical debts, and payment plans.

Be careful with:

- statement/current balances
- available credit
- current balance vs starting balance
- planned vs cleared debt payments
- payoff estimates
- utilization calculations

### Budgets

Budget Review and Monthly Budgets by Account should stay conceptually different.

- Budget Review = how the selected month/account is going
- Monthly Budgets by Account = the saved monthly target and related context

Avoid duplicating identical "how am I doing" cards in both places.

### Transaction templates

Transaction templates support:

- multiple templates with the same title
- per-template field controls
- category, notes, type, status, account routing, debt/card fields, transfer destination, and payment debt options

Example: `Shell` can have separate templates for gas and food.

Do not reduce templates back to one template per title unless the user explicitly asks.

### Settings

Settings sections should default closed unless the user asks otherwise.

Backup/Reports, Cloud Sync, Recent Changes, Customize, and Reference sections should remain understandable and not visually overwhelming.

### Mobile/iPhone

Mobile/iPhone layout is a high priority.

For mobile:

- Use bottom navigation when already implemented.
- Respect safe areas.
- Avoid buttons/cards being too close to phone edges.
- Avoid fixed elements covering content.
- Avoid giant blank top gaps.
- Avoid desktop-style cramped tables on mobile.
- Calendar can be scrollable and show fuller day cards on mobile.
- Desktop can retain a more compact calendar layout.

## UI preferences

Overall vibe:

- cozy
- earthy
- planner-like
- compact
- clean
- app-like on iPhone

Avoid:

- corporate dashboard vibes
- huge empty spaces
- confusing duplicate cards
- hidden critical info
- overly dense mobile screens
- making desktop worse to fix mobile

## Existing page areas

Money Nest commonly includes these pages/areas:

- Dashboard
- Calendar
- Accounts
- Bills
- Debts
- Budgets
- Settings

Do not remove pages unless explicitly requested.

## Common checks before finalizing

At minimum, run:

```bash
node --check app.js
```

Also manually review likely impacted flows in code:

- adding/editing transactions
- planned vs cleared behavior
- recurring transaction handling
- account balances
- Safe to Spend
- JSON backup/import
- CSV export/import
- Supabase settings/sync if touched
- mobile CSS if layout changed

## GitHub workflow

Preferred workflow:

1. Create a branch for changes when appropriate.
2. Make changes.
3. Run checks.
4. Commit with a clear message.
5. Open a PR or push according to the user's instruction.

Good commit message examples:

- `Fix mobile calendar today scroll`
- `Improve transaction template controls`
- `Update safe-to-spend IOU handling`
- `Polish settings collapsible sections`

## How to respond to the user

Keep the response practical and clear.

Always include:

- what changed
- which files changed
- checks/tests run
- whether schema changed
- whether import/export compatibility changed
- any limitations or follow-up needed

If no files were changed, say so.

## If unsure

If a request could affect financial calculations, saved data, Supabase sync, or import/export, stop and ask for clarification instead of guessing.

When in doubt, preserve data and existing behavior.
