# Money Nest

## v2-291

- Fixed effective-date recurrence expansion: recurring items moved earlier than their original scheduled date (for example weekend previous-Friday moves or explicit occurrence/date overrides) now count in Account Actual, Safe to Spend, reports, and other through-date calculations on the date they actually land.
- Prevents the Accounts/Calendar disagreement where a moved Sept 7 paycheck/transfer set was visible on Sept 4–5 in Calendar but omitted from Account Actual until Sept 7.
- Keeps look-ahead bounded: ordinary future occurrences are not returned early; only occurrences whose effective date is at or before the requested cutoff are admitted from the look-ahead window.

## v2-290

- Fixed stale Accounts balance cards after saving, deleting, or toggling transaction status. Transaction mutations now immediately re-render the active view, keeping Accounts `Actual`/Safe metrics in sync with the Calendar cleared balance.
- No balance math, recurrence, cloud format, schema, or storage-key changes.

## v2-289

### Startup local-data hydration safety

- Fixed the startup-order regression that could run spending-bucket normalization before the bucket-id constant existed. A normal page load now hydrates the existing `moneyNest.v2.113` browser copy correctly instead of falling back to starter/default data.
- If startup normalization ever fails again, Money Nest preserves the existing raw localStorage copy rather than replacing it with starter data. Local saves are blocked for that failed session until an explicit cloud/JSON restore succeeds.
- Backup Health now reports **Local data not loaded** instead of **Backed up** when the session failed to hydrate the browser copy.
- Cloud/JSON restores clear the startup protection after successful normalization.
- Schema remains 225 and the storage key remains `moneyNest.v2.113`.

## v2-288

### Dynamic monthly budget targets

- Budgets now support three **Amount methods**: **Fixed monthly**, **Per occurrence (weekly)**, and **Per paycheck**. Existing budgets/backups default to Fixed monthly, so old target amounts keep their prior meaning.
- **Per occurrence** treats the stored budget `amount` as the amount per selected weekday. Budget Performance counts how many of that weekday fall in the viewed month and calculates the monthly target automatically (for example, `$60 × 5 Wednesdays`).
- **Per paycheck** treats `amount` as the amount per Mak or Ty paycheck. Money Nest reuses the person's existing scheduled paycheck occurrences for the viewed month rather than creating a second paycheck cadence inside Budgets.
- Each budget can store an optional **month-specific override** keyed by `YYYY-MM`. An override wins only for that month; clearing it returns the budget to its normal fixed/occurrence/paycheck rule.
- Dynamic targets are used consistently by **How you did vs budget**, Monthly targets totals, budget details, and the Budget Manager. Non-fixed rows show the calculation so a target change is explainable instead of appearing arbitrary.
- Spending buckets/category ownership from v2-286 and Spending-view filter boundaries from v2-287 are unchanged. Dynamic amount rules change only the budget target, not which transactions belong to a budget.
- Editable Budgets CSVs preserve `amountMethod`, `occurrenceWeekday`, `paycheckOwner`, and `monthlyAmountOverridesJSON`; older CSVs safely import as Fixed monthly. JSON/cloud data remain backward-compatible.
- Schema remains 225; storage key and recurrence/transaction formats are unchanged.

## v2-287

### Stable budget performance + filter-only spending analysis

- **How you did vs budget** now always evaluates the full selected month against every configured budget using that budget's own category, Spending bucket, and account scope. The Bills/Extra and Mak/Ty/Joint spending-view controls no longer change budget rows, amounts used, remaining amounts, or over-budget status.
- Opening a budget from Budget performance uses the same full-month budget membership, so its detail total now stays consistent with the performance row regardless of the current spending view.
- Spending-view controls remain useful for analysis: Spending by Category, spending totals, month comparison, and trends can still be filtered by Bills/Extra and account.
- Spending by Category is now intentionally category-only analysis. It no longer shows “spent of category budget” or forces a slice to stay visible merely because a category budget exists. This matters after personal Spending buckets: a Mak/Ty bucketed Food or Beauty purchase remains visible under its true category without implying it also consumes a category-only budget.
- Personal bucket ownership from v2-286 is unchanged. Bucketed transactions still belong only to matching bucket budgets; Category remains descriptive/reporting data. Bills/Extra classification logic itself is unchanged.
- Schema remains 225; storage key, JSON/CSV/cloud compatibility, recurrence, and financial calculations are unchanged.

## v2-286

### Exclusive personal spending budget ownership

- Fixed personal **Spending bucket** budget precedence so a transaction assigned to **Mak Spending** or **Ty Spending** is owned by budgets that explicitly target that same bucket. Ordinary category-only budgets can no longer also claim the same personal purchase.
- Category remains the purchase-purpose dimension for Spending by Category, pie charts, budget-detail category breakdowns, search, and reporting. A salon purchase can therefore stay **Beauty** while only the **Mak Spending** budget receives its budget usage.
- Bucket-targeted budgets may still optionally narrow themselves with category and account selectors. Transactions with no personal bucket continue using the existing category/account budget matching rules.
- Legacy transactions whose category is literally `mak-spending` or `ty-spending` retain their effective bucket behavior without rewriting history.
- Overall Budget Review spending totals remain transaction-based and are not duplicated. Bills/Extra classification precedence, Savings handling, recurrence, JSON/CSV/cloud data, schema 225, and the storage key are unchanged.

## v2-285

### Personal spending buckets

- Added an optional **Spending bucket** to transactions so personal allowance ownership is separate from the purchase category. A salon charge can now remain **Beauty** while also counting toward **Mak Spending**; Ty purchases can similarly use **Ty Spending**.
- Existing legacy transactions categorized directly as Mak Spending / Ty Spending remain compatible: when no explicit bucket exists, those legacy category ids act as the effective personal bucket without rewriting history.
- Transaction templates can remember/apply Spending bucket alongside Category. Automatic lightweight templates now remember title + category + bucket; Template Manager and editable template CSVs support the field.
- Budgets can optionally target a Spending bucket. A bucket-only budget may leave categories unchecked to include every category in that personal allowance, or combine bucket + categories for an AND filter. Bucket budget details add a **Category breakdown** so the user can see what personal spending was actually for.
- Budget Review unbudgeted-spending math now checks actual budget membership, which supports bucket-only targets without pretending every category in that bucket has its own budget.
- Editable Transactions and Budgets CSVs preserve `spendingBucketId`; older CSV/JSON backups default safely to no explicit bucket. Card-routing/payment helpers preserve the bucket when a purchase is moved through a card.
- Mak Spending / Ty Spending remain as stable category records because their ids anchor the bucket labels; Category Cleanup treats them as protected while still allowing their name/emoji/color to be edited.
- No existing transactions/categories are migrated or deleted. Schema remains 225 and the storage key is unchanged.

## v2-284

### Dismissible recurring-health amount changes

- Recurring Health **Amount changed** findings now include **Mark reviewed** directly on the Bills row and inside the bill detail health panel. This lets intentional changes stop appearing as unresolved warnings without editing or deleting transaction history.
- A reviewed amount stores the acknowledged observed amount in `settings.recurringHealthReviews`. If later cleared payments keep repeating around that reviewed amount, the warning stays quiet; if a materially different amount repeats later, Money Nest can flag the new change again.
- Marking a warning reviewed does **not** rewrite the recurring series amount or future planned transaction amounts. The existing Edit series workflow remains the place to change the actual scheduled amount when desired.
- Reviewed warning state is part of normal settings data, so it travels with JSON backups and cloud sync. Bills shows a reviewed-count chip plus **Restore reviewed**, and each bill detail can restore its own reviewed warnings.
- No transaction history, recurrence rules, budget behavior, CSV formats, schema version, or storage key changed. Schema remains 225.

## v2-283

### Possible recurring-charge detection

- Bills now detects conservative **unscheduled monthly charge patterns** from cleared one-off expenses. A two-month pattern must have the same normalized title, route/account/category, exact amount, and roughly the same monthly position; 3+ observations may tolerate only a small amount drift.
- Detection ignores transactions that already belong to a recurring series and suppresses matches when an active recurring series already represents the same charge. Recent patterns only are considered so old historic habits do not create permanent warnings.
- Possible matches appear above the Bills list with **Review**, **Schedule**, and **Dismiss**. Schedule opens a new planned recurring transaction for the predicted next date without rewriting cleared history; month-end patterns prefill Last day of month. Dismissals are local UI state and automatically become a new finding if another matching charge posts later.
- Recurring Health includes possible recurring-charge counts and Show review only keeps these candidates visible. Bills filters also apply to the inferred candidate cadence.
- No transaction history, recurrence rules, JSON/CSV formats, cloud sync, schema version, or storage key changed. Schema remains 225.

## v2-282

### Bills: monthly/non-monthly grouping + schedule-date sorting

- Active recurring items are grouped into **Monthly bills** (monthly, last-day-of-month, and nth-weekday schedules) and **Non-monthly bills** instead of Coming up / Later. Recurring-health warnings stay on the rows and the review-only control still works without pulling bills into a separate group.
- Bills sorting now distinguishes **Schedule date** from **Next date**. Schedule date keeps monthly bills in their recurring day-of-month order even after the current occurrence clears; Next date remains the dynamic upcoming occurrence sort.
- Fixed ended recurring series whose final occurrence was cleared being left in the active list with a stale historical “Next” date. Fully handled series with a past `recurrenceUntil` now move to Ended / Archived; genuinely unresolved past occurrences can still surface as Due.
- No recurrence data, cleared history, filters, JSON/CSV formats, cloud sync, schema version, or storage key changed.

## v2-281

### Category spending-view overrides
- Added an optional **Spending view** to each category: **Auto**, **Bills**, or **Extra spending**. This controls Bills vs Extra classification inside Budget Quick Views even when the category has no budget target.
- Classification priority is **explicit matching budget override → category override → automatic recurring detection**. Existing equal-specificity budget conflicts still fall back directly to Auto recurring detection, preserving v2-276 behavior; otherwise non-budgeted categories such as Savings can now be classified consistently.
- Category spending-view overrides affect only Budget Review/Quick Views. They do not create a budget, alter transaction/recurring data, or change the Bills page.
- Category CSV export/import now preserves optional `spendingType`; older category CSVs and JSON backups safely default to **Auto**. Schema remains 225.

## v2-280

### iPhone Calendar-first overhaul
- Reworked the phone-only navigation around actual daily use: **Calendar, Home, Accounts, More**. The dedicated **Future** tab is removed from the iPhone dock; desktop/iPad navigation is unchanged.
- iPhone now opens to **Calendar** by default, including after a backup/cloud load or Clear Everything. Desktop/iPad still open to Dashboard.
- Added a horizontally scrollable account-balance strip above the iPhone Calendar. Checking cards show current balance plus Safe to Spend; Savings shows current balance plus goal context. Tapping a checking card switches the Calendar account filter; tapping Savings opens that account.
- The floating **+ Transaction** button now inherits the selected Calendar account on iPhone when one specific checking account is being viewed. Day-level Add Transaction already keeps the selected date/account behavior.
- Rebuilt the iPhone Home dashboard around **all cash accounts**, showing current balance and Safe to Spend/goal context for each instead of centering the page on one lowest account. Quick actions are now Transaction, Transfer, and Search, with Calendar replacing Future links.
- No desktop/iPad layout, account calculations, Safe to Spend logic, transaction data, JSON/CSV compatibility, Supabase behavior, or schema fields changed. Schema remains 225.

## v2-279

### Cloud Sync controls render immediately
- Fixed Cloud Sync sometimes appearing blank with the summary pill stuck on the HTML placeholder **Off** when the Supabase auth check was slow, blocked, or unavailable.
- Cloud Sync controls now render immediately from local configuration; Supabase sign-in status refreshes asynchronously afterward.
- A slow/failed auth refresh no longer hides the URL/key/mode/login/save/load controls, and the background refresh does not overwrite an email the user has already started typing.
- No cloud data format, Supabase project configuration, sync safety checks, financial data, or schema fields changed. Schema remains 225.

## v2-278

### Transaction template option popover fix
- Fixed the transaction-title template **options** menu getting trapped inside the compact suggestion list's tiny internal scroll area.
- Opening **N options** now lets the variant popover escape the outer suggestion scroller on desktop/iPad, so a few variants display at their natural height.
- The variant list itself only scrolls when there are enough options to exceed a sensible viewport-based maximum height; phone behavior keeps the existing fixed/mobile-friendly treatment.
- Only one option disclosure can remain open at a time. No template data, matching logic, transaction data, or schema fields changed. Schema remains 225.

## v2-277

### Budget review + editor cleanup
- Removed the separate **Monthly Budget Targets** card from the Budgets page so every budget is not listed twice.
- **How you did vs budget** remains the single on-page performance list, with spending, target usage, progress, and remaining/over-budget amount.
- Added **Edit budgets** to Budget Review. It opens a dedicated Budget Manager for adding, editing, or deleting targets without mixing setup controls into the monthly review.
- Budget Manager shows each target's amount, account scope, included categories, and **Auto / Bills / Extra spending** view; tapping a row opens the existing budget editor and returns to the manager when closed.
- No transaction-level budget assignment was added. Existing category/account matching and v2-276 spending-view override rules remain unchanged.
- No existing budget/category data, calculations, JSON/CSV compatibility, Supabase behavior, or schema fields changed. Schema remains 225.

## v2-276

### Budget spending-view overrides
- Added an optional **Spending view** setting to each budget: **Auto**, **Bills**, or **Extra spending**.
- **Auto** preserves the existing behavior: transactions recognized as recurring belong to Bills; other cleared budget outflows belong to Extra spending.
- **Bills** / **Extra spending** override only the Budget Quick View classification for transactions matching that budget's categories and included accounts. They do not change transaction data, recurring-series identity, or the Bills page.
- When a transaction matches multiple budgets, the most specific explicit override wins: fewer categories first, then narrower account scope. Equally specific conflicting overrides fall back to Auto recurring detection instead of silently choosing one.
- This supports card-backed/category-preserving purchases such as One Pay groceries: a dedicated Groceries budget can be marked **Bills** even though the cleared cash transaction itself is not recurring.
- Budget CSV export/import now includes optional `spendingType`; older budget CSVs and older JSON backups default safely to **Auto**. Schema remains 225.

## v2-275

### Maintenance & privacy cleanup
- Removed the large embedded real/sample Money Nest dataset from `app.js`. A fresh install now starts with empty accounts/debts/budgets/transactions plus the generic starter category list instead of bundled personal financial records.
- Removed **Reset sample data** from Settings. **Clear everything**, JSON backup/import, CSV import/export, and cloud sync remain unchanged.
- Removed the unused historical `README-import-notes.txt` file, which contained old import assumptions and starting-balance details and was not used by the app.
- Retired the unused transaction-to-transaction linking UI and link-manager/detail modal. Current data showed no transaction-to-transaction links in use. Legacy `linkedTransactionIds` fields remain preserved through normalization, transaction edits, JSON backups, and CSV import/export for backward compatibility.
- Removed the retired Calendar Density preference, render wrapper, and Compact/Detailed CSS. Calendar keeps the existing v2-220 comfortable layout and current adaptive viewport behavior.
- Removed verified-dead helper functions left from older Forecast, Budget, Template, Bills/recurrence, and schema-banner iterations.
- Loan forecast settings/calculation behavior were intentionally left unchanged. No financial calculations or schema fields changed; schema remains 225.

## v2-274

- Card-payment IOU repayment dates now follow the selected **From / paying later** cash account. Changing that account immediately recalculates the repayment date from that account's next planned paycheck (for example, Ty Checking follows Ty's weekly Wednesday paycheck series).
- Global Search now stays open behind transaction editing. Closing or saving the transaction returns to the same query/results instead of closing Search and forcing a restart; results refresh after the editor closes.
- Removed the browser dialog's transparent rectangular padding/halo around rounded read-only/detail modals. Modal-card shadows remain intact and Search keeps its dedicated dialog shadow.
- No financial calculations, transaction fields, JSON/CSV formats, recurring behavior, Supabase behavior, or schema fields changed. Schema remains 225.

## v2-273

### Adaptive desktop Calendar viewport
- Desktop Calendar no longer hard-locks the document to `overflow:hidden`. It still has no page scroll when the Calendar naturally fits, but shorter browser viewports can scroll normally instead of clipping the top or bottom.
- Calendar now uses dynamic viewport height (`100dvh`) for its desktop shell so it adapts better to different laptop/browser heights.
- Entering Calendar on desktop resets the document to the top, preventing a scroll position preserved from a longer page (such as Bills or Settings) from opening Calendar partially off-screen.
- iPad/iPhone Calendar scrolling behavior is unchanged. No calendar calculations, transactions, data formats, schema, JSON/CSV compatibility, or Supabase behavior changed. Schema remains 225.

## v2-272

### Targeted Accounts, Budgets, and Calendar polish
- Built from the preferred **v2-270** baseline; the rejected v2-271 Budgets/Accounts palette overhaul is intentionally not carried forward.
- Cash-account records now sit on one connected **Soft panels** list surface instead of visually blending into the Main account panel.
- Credit Utilization keeps its nested section surface while each owner (Mak/Ty) now has a distinct **Soft panels** inner card, so the existing border is visually meaningful.
- Debt company/dropdown headers use **Secondary panels** while the opened debt-account list uses **Soft panels**; individual debt rows remain flat and connected.
- Budget Review keeps its v2-270 flat layout, but Spending by Category, How You Did vs Budget, and Monthly Budget Targets now place their existing flat rows/content on a **Soft panels** surface rather than the Main panel color.
- Fixed Calendar rounded corners without disabling transaction overflow/popovers by rounding the grid's edge cells themselves.
- Desktop Calendar no longer has the tiny unnecessary page scroll when the calendar already fits the viewport. Tablet/iPhone scrolling behavior is unchanged.
- Visual-only changes. No account/budget/calendar calculations, data formats, schema, JSON/CSV compatibility, or Supabase behavior changed. Schema remains 225.

## v2-270

### Palette hierarchy cleanup
- App background now controls the page backdrop directly. The page gradient is derived only from **App background** instead of blending **Main panels** into the page, so strongly colored cards stay visually separate from the workspace behind them.
- Settings now consistently uses **Main panels** for the four parent groups, **Secondary panels** for nested setting cards, and **Soft panels** for fields, status cards, paycheck cards, template/category rows, palette swatches, and ordinary ghost controls.
- Bills now consistently uses **Main panels** for the page card, **Secondary panels** for Recurring Health / Filters / archived containers, and **Soft panels** for filter controls, health chips, bill lists, and bill rows.
- This is a visual-only palette-role correction. No financial calculations, transaction/recurring behavior, saved-data shape, JSON/CSV compatibility, Supabase behavior, or schema version changed. Schema remains 225.

## v2-269

### Dashboard palette hierarchy
- Dashboard now follows the same three-level palette surface system as the rest of Money Nest.
- Major Dashboard cards use **Main panels**.
- Nested/highlight sections use **Secondary panels**.
- Inner metric tiles, transaction/account lists, counters, and review content use **Soft panels**.
- This is a visual-only change; Dashboard calculations and alert logic are unchanged.

- Made Add/Edit Transaction use the palette surface roles literally: the outer transaction modal uses `Main panels`, disclosure/helper sections such as Payment / routing, Repeat, Linked transactions, Notes, and the compact amount calculator use `Secondary panels`, and transaction inputs/selects/textareas use `Soft panels`.
- Removed the previous blended transaction-input color so extreme/custom palettes now map directly to the selected panel colors on desktop and iPhone quick entry.
- No transaction, palette-storage, JSON/CSV, Supabase, or schema behavior changed. Schema remains 225.

## v2-267
- Fixed Add/Edit Transaction date-field sizing so the native date control now matches the Amount field height on desktop instead of inheriting the older 44px date-only override. Mobile keeps the same height as its neighboring quick-entry controls, and iPad remains on its existing touch-sized field height.
- No transaction, date, JSON/CSV, Supabase, or schema behavior changed. Schema remains 225.

## v2-266
- Calendar cleared-only balance now appears only on today's date. It always shows on today, even when cleared and projected balances are identical; all other calendar days show only the projected balance.

## v2-265
- Added a subtle cleared-only balance beneath each Calendar day’s projected balance when planned transactions make the two totals differ. The main balance remains the existing projected end-of-day amount; the smaller `✓` amount reflects only cleared activity through that day.
- Cleared-only calendar balances use the same visible account/transfer perspective as the existing Calendar and respect the selected Calendar account filter. Days where projected and cleared balances are identical do not repeat the same number.
- No transaction, balance, recurring, JSON/CSV, Supabase, or schema behavior changed. Schema remains 225.

## v2-264
- Polished Add/Edit Transaction so Amount and Date use explicitly equal paired widths, and removed the browser spinner arrows from the Amount number field.
- Replaced the edit-only `More actions` menu with direct footer buttons for Delete, Duplicate, and Create card payment when those actions are available; Cancel and Save remain in the same footer row.
- Changed automatic template learning for brand-new title families: when a saved transaction does not match an active template title family, Money Nest asks whether to save it as a template. Declining saves only the transaction. Existing template families may still learn/update their lightweight title+category variants normally, while recurring series remain excluded from transaction-template learning.
- No transaction/template schema, JSON/CSV format, recurring behavior, Supabase behavior, or financial calculations changed. Schema remains 225.

## v2-263
- Reworked Add/Edit Transaction back toward the slimmer pre-overhaul proportions while keeping progressive disclosure for routing, repeat, links, notes, and edit-only actions.
- Reordered the common transaction fields to Title, Category, Amount/Date, then Type/Account. Replaced the visible Status dropdown with a compact `Cleared` checkbox beside Title; unchecked continues to mean Planned and the existing saved `status` field remains unchanged for compatibility.
- Replaced the wordy Calculator control with a small `−/+` button inside the Amount field. The calculator is now a single compact expression row; Enter or Use applies the result, closes the helper, and returns focus to Amount.
- Kept iPhone quick-entry behavior and existing transaction/template/recurring logic intact. No JSON/CSV/Supabase/schema changes; schema remains 225.

## v2-262
- Added a third editable app-surface color, `Secondary panels`, so Appearance now has a deliberate three-level hierarchy: Main panels for outer cards/modals, Secondary panels for nested section containers, and Soft panels for the innermost rows/items.
- Preserved the existing `panel2`/Soft panels setting for backward compatibility. Older palettes/backups with no Secondary panels value derive a midpoint from their saved Main + Soft colors, so existing palette edits remain safe and immediately gain a usable middle surface.
- Applied the hierarchy to the places where nesting is most visible: Settings master/inner cards, Quick Actions and recent-place/search items, Template Manager controls/rows, Bills nested controls, transaction-detail sections, and Add/Edit Transaction. Transaction modals remain Main panels with their disclosure/options and field surfaces using Soft panels as requested.
- Quick Actions now uses Secondary panels for its container and Soft panels for recent places/search. Palette reset defaults include the new Secondary panels value while older saved reset defaults remain compatible.
- No financial data, transaction/template schema, JSON/CSV format, Supabase behavior, or calculations changed. Schema remains 225.

## v2-261
- Added a `Uses field` filter to Manage Templates so cleanup can isolate shortcuts that actively autofill Notes, Status, Type, Cash account, Card/debt, Transfer destination, Payment debt, Category, or any extra autofill field.
- Field filtering follows the template's application flags rather than dormant legacy values; Notes and Cash account require a real saved value, while routing fields still count when intentionally configured to clear a routing value.
- The selected field filter is preserved when editing a template and returning to Manage Templates, alongside the existing search/filter/scroll context.
- No template/transaction schema, JSON/CSV format, Supabase behavior, recurring-bill data, or financial calculation changes. Schema remains 225.

## v2-260
- Fixed Edit Template so intentionally clearing the Saved note persists as blank instead of restoring the template's previous note. A blank note also disables note autofill because there is no saved note to apply.
- Clarified and reinforced the separation between transaction templates and recurring Bills series. A recurring-linked template is only detected for reference/display; editing or deleting the template changes only `settings.transactionTemplates` and never edits the matching recurring bill. Recurring bill notes, amounts, schedules, accounts, and routing remain editable only through Bills → Edit Series.
- No transaction/recurring/template schema, JSON/CSV format, Supabase behavior, or financial calculation changes. Schema remains 225.

## v2-259
- Added computed Recurring Health to Bills. Active recurring series are checked conservatively for uncleared planned occurrences more than 7 days overdue, a likely stale amount estimate when the two newest cleared payments agree with each other but materially differ from the saved series amount, and possible duplicate active series with the same title/route/schedule/category/amount. Findings are review-only and never change financial data automatically.
- Added a compact Recurring Health summary with issue counts and a Show review only toggle. Each Bill Details screen now explains any health findings for that specific series.
- Reorganized active recurring items into Needs review, Coming up (through the next 7 days, including recent bank-clearing grace-period items), and Later sections. Ended/Archived remains separately collapsed.
- No transaction/recurring schema, JSON/CSV format, Supabase behavior, or financial calculation changes. Schema remains 225.

## v2-258
- Added per-palette user-defined reset defaults in Appearance. `Set current as reset default` saves the current palette colors as that palette's reset baseline; `Reset this palette` returns to the saved baseline when present, otherwise the built-in default. `Use built-in reset default` removes the custom baseline without changing the current colors.
- Palette reset baselines are optional Appearance preferences included automatically in JSON/cloud backups. Older data with no reset baseline safely falls back to the built-in palette; schema remains 225.
- Removed the browser-native white inset around Appearance color pickers so palette swatches render full-bleed inside their existing border.

## v2-257
- Template edits launched from Manage Templates now return to the Template Manager after Save, Cancel, Delete, or close instead of dropping back to Settings. Search text, Active/Archived/Unused filter, family filter, recurring filter, and scroll position are preserved.
- Added a `Hide recurring-linked` Template Manager filter. It hides shortcuts that match a recurring Bills series by title plus any template-applied category/account/routing fields.
- Recurring-linked templates now show a Recurring badge and recurrence description in Manage Templates, and Edit Template explains when the shortcut matches a Bills recurrence. Recurrence rules themselves remain managed only in Bills.
- No template/transaction schema, JSON/CSV, Supabase, recurring schedule behavior, or saved financial records changed. Schema remains 225.

## v2-256
- Restored the Add/Edit Transaction dialog to a more compact desktop scale while keeping the newer progressive-disclosure layout. Fields, disclosure rows, action buttons, and the paycheck auto-calc row use tighter spacing instead of oversized card/button proportions.
- Fixed long transaction edits that could extend below the viewport without scrolling. The desktop transaction dialog now has a viewport-bounded scroll container, so recurring/paycheck/loan fields and Save/Cancel remain reachable.
- Kept the Amount calculator available as a quiet inline control without letting it increase the Amount row height or misalign Date.
- iPhone task-first transaction entry and iPad-specific modal sizing remain unchanged. No transaction logic, saved data, JSON/CSV, Supabase behavior, or schema changes. Schema remains 225.

## v2-255
- Simplified transaction-template suggestion metadata: category is no longer repeated as “Applies category” because category is a core template field and is already represented by the option/category label. Only extra autofill behavior such as notes, status, account, or routing is called out.
- No template data, ranking, application, transaction behavior, CSV/JSON, Supabase, or schema changes. Schema remains 225.

## v2-254
- Fixed transaction-template autocomplete family option controls. Opening “N options” now keeps the suggestion popover open so a specific variant can be selected instead of the title-field blur dismissing the whole menu.
- Template application/ranking/data are unchanged; this is an interaction-only fix. Schema remains 225.

## v2-253
- Removed the interrupting older-schema startup banner entirely. Older-schema upgrade information remains available in Settings/Data & Backup without appearing every time Money Nest opens.
- Removed the Template Manager's blank skinny family-filter strip when no title family is being filtered.
- Restyled More bulk actions as a normal rounded Money Nest control instead of a square summary box.
- Reworked the Amount + Date row so Calculator sits beside the Amount label rather than underneath the amount input, keeping both fields and the next row aligned.
- No transaction/template data fields, JSON/CSV formats, Supabase behavior, or schema version changed. Schema remains 225.

## v2-252
- Fixed Template Manager opening with an accidental `[object PointerEvent]` family filter when launched from Settings. It now opens directly to the normal Active templates view, with all active templates visible immediately.
- Added defensive argument handling so click/pointer events can never be mistaken for a template-family filter again.
- Standardized label sizes, input/select heights, spacing, and alignment across Add/Edit Transaction, Add/Edit Template, and the bulk Template Manager.
- Fixed the Advanced autofill header so its title, Optional hint, and expand control align cleanly instead of running together.

## v2-251
- Fixed Add/Edit Transaction horizontal overflow introduced in v2-250: the transaction dialog and card now share the same responsive width, form grid children may shrink correctly, and the modal no longer forces a 720px card inside the older 560px dialog shell.
- Replaced the nested Transaction Templates settings UI with a scan-first one-row-per-title library. Selecting a title opens the new Template Manager rather than exposing every variant and destructive control in Settings.
- Rebuilt Template Cleanup as a bulk Template Manager with search, Active/All/Archived/Unused filters, Select All Shown, multi-select, exact-duplicate cleanup, deliberate same-title merge, archive/restore/delete, and bulk field editing.
- Bulk template editing can change Status (Planned/Cleared), Category, Type, cash account, card/debt routing, transfer destination, or payment debt across many selected templates at once; “Don't autofill this field” disables only that application flag while preserving its dormant saved value.
- Added a bulk “Keep title + category only” action for quickly simplifying messy/legacy templates. Templates intentionally edited through the editor or bulk manager become Custom/manual so later automatic learning will not silently overwrite those custom rules.
- Automatic lightweight templates still remember title + category only, recurring transactions still do not create template clutter, title families are never merged solely because their names match, and JSON/CSV/Supabase formats remain unchanged. Schema remains 225.

## v2-250
- Simplified Add/Edit Transaction without changing transaction fields or save behavior: Account and Category now live in the primary form, while card/debt routing, repeat settings, links, notes, and edit-only actions are tucked into compact disclosures.
- Transaction suggestions now show one best/context-aware option per title family. Extra variants remain available behind a small options control instead of filling the autocomplete list.
- Transaction template Settings now render as collapsed title-family rows. Variant management, archived variants, and less-used actions only appear after opening a family.
- Simplified the template editor around Title, optional option name, Category, and Default. Type/status/routing/note autofill moved into Advanced autofill with explicit “Don't change” choices; dormant legacy values remain preserved when a field is not applied.
- Template Cleanup now uses compact summary pills and collapsed family review sections instead of showing every family and control at once.
- Recurring schedules remain Bills-only; automatic lightweight templates still remember title + category; no template/transaction schema, JSON/CSV, or Supabase format changes. Schema remains 225.

## v2-249
- Dashboard Past planned warnings now wait until a planned transaction is more than 7 days overdue, giving bank-clearing delays a grace period. The integrated Needs Review past-planned count uses the same rule.
- Credit Card payment status is now automatic: $0 statement + $0 minimum due = Paid; an active linked recurring payment series = Autopay; a linked one-time planned payment in the statement due cycle = Scheduled; a linked cleared payment = Paid; otherwise the card is Unpaid.
- Credit-card due-cycle matching is tied to the saved statement date when available, so a genuinely missed statement payment can remain overdue instead of silently rolling to the next month.
- Unpaid credit cards are flagged in Dashboard Needs Attention when due within 7 days or already overdue. Cards with $0 statement/$0 due are excluded from payment-planning warnings even if newer post-statement charges exist.
- Credit-card status controls are now presented as automatic in debt/update forms; the legacy saved paymentStatus field remains preserved for JSON/CSV backward compatibility and continues to apply to other debt types.
- No schema, transaction, JSON/CSV, or Supabase format changes. Schema remains 225.

## v2-248
- Calendar drag/drop now supports cleared recurring occurrences as well as planned ones.
- Moving a cleared recurring occurrence keeps its saved occurrence override date synchronized with the recurring date override, so the transaction stays cleared and actually appears on the new day.
- No transaction fields, recurrence rules, linked-payment metadata, JSON/CSV formats, Supabase behavior, or schema version changed. Schema remains 225.

## v2-247
- Added a task-first iPhone mode focused on quick transaction entry, Safe to Spend, near-term cashflow, and fast money-movement decisions.
- Replaced the crowded iPhone bottom navigation with four primary destinations: Home, Future, Accounts, and More. Calendar, Bills, Budgets, Settings, and Search remain available from the mobile More sheet. Desktop and iPad navigation are unchanged.
- Added a dedicated iPhone Home view with a Safe-to-Spend hero, per-account cash cushions, quick Transaction/Transfer/Future/Search actions, the next four planned transactions, and a compact attention indicator. Full Dashboard review tools stay hidden until explicitly opened on phone.
- Added a mobile Future view with selectable cash account, 14/30/60/90-day horizons, current balance, lowest projected balance/date, Safe to Spend, planned cashflow, other account cushions, and a non-saving “What if I have to spend?” preview.
- Streamlined Add Transaction on iPhone into a full-screen quick-entry layout with the primary fields and account/payment section emphasized while repeat, links, notes, and other secondary sections remain available but tucked away. Existing transaction fields and behavior are preserved.
- No financial formulas, transaction fields, recurring logic, storage schema, JSON/CSV formats, or Supabase behavior changed. Schema remains 225.

## v2-246
- Fixed Bills rows showing `Next undefined` after the compact-list overhaul.
- Recurring-series deduplication now preserves the already-calculated `nextDate` and `billInfo` display fields instead of replacing each prepared row with the raw canonical transaction.
- Bill rows include a defensive date fallback so an unavailable derived date displays safely rather than leaking `undefined`.
- No recurring schedule calculations, financial data, saved fields, JSON/CSV formats, cloud behavior, or schema version changed.

## v2-245
- Overhaul pass 3 simplifies Accounts into scan-first cash/debt rows with less persistent button clutter.
- Cash-account ordering controls now appear only in an explicit Arrange mode; normal rows open details with a quiet chevron.
- Debt tools are collapsed by default, debt type sections use one contextual expand/collapse control, and per-row Update buttons were removed because the same control remains in debt details.
- Cash/debt detail action bars keep the primary actions visible and move maintenance actions into a More menu.
- iPhone/iPad account layouts are tightened for touch, and iPad Search/+ quick actions now share one quieter floating control.
- No finance calculations, saved-data fields, JSON/CSV formats, recurring/debt logic, or schema version changed.

## v2-244
- Action Center groups now always start collapsed, including Needs Attention; warning counts remain visible in the Dashboard summary strip.
- Overhaul pass 2 simplifies Bills into compact, category-accented rows with amount/status/date visible at a glance; Archive/Restore/Reactivate actions now live in the bill detail modal instead of every list row.
- Bills filters and uncommon recurring-series repair tools are tucked into a collapsed Filters & recurring tools section, while archived series remain separately collapsed.
- Budget Review uses flatter section separators instead of nested insight cards, with shorter helper text and cleaner performance rows.
- Monthly Budget Targets are flatter clickable rows with the budget amount emphasized on the right; the redundant Edit button was removed because the whole row already opens the editor.
- No finance calculations, saved-data fields, JSON/CSV formats, recurring-series rules, or schema version changed.

## v2-243
- Started the visual/UX overhaul with a calmer shared surface system: lighter shadows, slightly tighter card radii, and less visual weight without changing finance logic or saved data.
- Reworked Dashboard hierarchy so Safe to Spend and Upcoming are the primary working areas while alert counts become a compact summary strip.
- Safe to Spend now highlights the lowest cash cushion first and uses flatter account rows instead of nested mini-cards.
- Upcoming previews six transactions and links to the Calendar for the remainder instead of making the Dashboard grow indefinitely.
- Action Center is now organized into collapsible Needs Attention, Debt Payments Due Soon, and Credit Card Statements groups; large statement/debt lists stay tucked away until opened.
- iPhone Today at a Glance is more compact and appears before alert counters; desktop, iPad, and phone keep the same underlying calculations and navigation behavior.


Money Nest is a personal budgeting, debt, and cashflow planning app built for paycheck-to-paycheck money management.

Current version: `money-nest-v2-269`

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


### v2-240
- Added an iPad/tablet-only modal layout for coarse-pointer devices wider than phones.
- Transaction and small update dialogs use a wider, better-proportioned card with tighter internal spacing on iPad.
- Desktop and iPhone breakpoints remain unchanged.


### v2-253
- Removed the repeating older-schema startup banner while keeping schema-upgrade information in Settings/Data & Backup; also removed the false empty Template Manager filter strip, normalized the More bulk actions control, and aligned Amount/Date by moving Calculator into the Amount label row.
- Data schema remains 225 and all financial/template storage formats are unchanged.

### v2-252
- Fixed Template Manager startup filtering caused by click events being treated as family keys.
- Normalized transaction/template form field sizing and Advanced autofill summary alignment.

### v2-251
- Fixed the transaction modal width mismatch that caused horizontal scrolling/cut-off fields after the v2-250 form redesign.
- Settings shows one compact row per active template title; advanced template management moved into a dedicated bulk manager.
- Template Manager supports search/filtering, Select All Shown, bulk status/category/type/routing changes, simplify-to-title+category, archive/restore/delete, exact duplicate merge, and deliberate selected same-title merge.
- Manual/bulk edits convert learned templates to Custom so automatic title+category learning cannot overwrite intentional advanced rules. Disabled bulk fields preserve dormant values and only switch off the corresponding `fields.*` flag.
- Transaction/template CSV columns, JSON backup shape, Supabase blob shape, and schema remain unchanged at 225.

### v2-250
- Overhauled transaction entry around the common path: title, amount/date, account/category, and type/status are primary; routing/repeat/links/notes are progressive disclosures.
- Edit-only Duplicate/Delete/Create card payment actions are grouped under More actions instead of crowding the main Save/Cancel row.
- Transaction template autocomplete presents one best match per title family, with additional variants still selectable on demand.
- Template Settings and Cleanup are collapsed, scan-first views; the simplified editor replaces the old duplicated field-value + apply-checkbox matrix with explicit optional autofill choices.
- Existing template family IDs/variants/default/archive/source metadata and CSV compatibility remain intact. Schema remains 225.

### v2-249
- Added a 7-day grace period before planned transactions become Dashboard/Needs Review past-planned findings.
- Credit Card status is derived from live Money Nest data instead of the manual status field: zero statement/minimum = Paid, active recurring payment = Autopay, one-time planned payment = Scheduled, cleared payment = Paid, otherwise Unpaid.
- Unpaid cards surface in Needs Attention when the relevant statement due date is within 7 days or overdue; $0-due cards do not generate payment-planning alerts.
- Saved legacy status fields and all backup/export formats remain compatible.


### v2-248
- Fixed calendar drag/drop for cleared recurring occurrences.
- Cleared occurrence overrides now move their stored display date together with the recurrence date override, preventing the cleared override from snapping the occurrence back to its old day.
- Status, recurrence lineage, links, payment metadata, storage/export formats, and schema remain unchanged.


### v2-247
- Introduced the iPhone task-first Home and Future views instead of squeezing the full desktop management experience into the phone layout.
- iPhone bottom nav is now Home / Future / Accounts / More; secondary management pages remain accessible through More.
- Mobile Future includes a temporary what-if spending preview and cash-cushion comparison without creating or changing financial records.
- iPhone Add Transaction uses a full-screen quick-entry presentation while keeping the same underlying form fields and save logic.
- Desktop/iPad behavior and data schema remain unchanged.


### v2-246
- Fixed the Bills list regression that displayed `Next undefined` after v2-244/v2-245 visual changes.
- `dedupeRecurringBillRows()` now keeps the prepared render row so computed `nextDate` / `billInfo` fields survive lineage deduplication.
- `billCardHTML()` defensively resolves a display date from prepared bill data before falling back to occurrence/source dates.
- Data schema remains unchanged; this is a rendering-only bug fix.


### v2-245
- Reworked Accounts into flatter scan-first cash/debt rows while preserving all account and debt calculations.
- Added opt-in cash-account Arrange mode so reorder arrows no longer occupy every row by default.
- Moved BNPL/category-label utilities into a collapsed Debt tools disclosure and replaced paired debt expand/collapse buttons with one contextual control.
- Removed debt-row Update buttons because Update due/min remains available from debt details; primary detail actions stay visible while maintenance actions live under More.
- Refined iPhone/iPad account spacing and consolidated iPad Search/+ into a quieter paired floating control.
- Data schema remains unchanged; JSON/CSV/cloud compatibility is unaffected.


### v2-244
- Kept all Dashboard Action Center groups closed by default.
- Simplified Bills list density and moved series-management actions into bill details.
- Collapsed Bills filters/tools by default and flattened Budget Review / Monthly Budget Targets presentation.
- Data schema remains unchanged; this is a presentation-only overhaul pass.

### v2-243
- Began the visual overhaul with lower-weight shared panels/cards and a calmer Dashboard information hierarchy.
- Replaced four separate top Dashboard cards with one compact metric strip.
- Added a lowest-cash-cushion Safe to Spend hero plus flat account rows, and capped the Upcoming preview at six rows with a Calendar continuation link.
- Converted Action Center into collapsible groups and capped debt/statement previews at six rows each, keeping the full data available from Accounts.
- No financial calculations, schema fields, JSON/CSV formats, recurring logic, or cloud-sync behavior changed.


### v2-242
- Loan forecasting now learns from fully completed cleared loan-payment occurrences, including recurring occurrence overrides.
- Forecast samples with blank Principal, Interest, or Fees fields are excluded until completed; entered zeroes remain valid.
- Matching history-only samples are de-duplicated when the same payment now exists as a real cleared transaction.
- Dashboard Action Center shows a persistent aggregate warning for incomplete cleared loan breakdowns, with per-payment findings in Needs Review & Data Health.


### v2-241
- Transaction templates are grouped into title families with editable variant labels and per-variant field controls.
- Added default/archive state, context-aware suggestions, usage/last-use details, exact duplicate consolidation, and selected-variant merge/archive/delete tools.
- Automatic templates now save title + category only and skip recurring series/occurrences.
- Added Category Cleanup with usage statistics, configuration references, category merge, and unused deletion.
- Template CSV preserves `variantLabel`, `isDefault`, `archived`, `source`, and `createdAt`; older CSV files remain compatible.

