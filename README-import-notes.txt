Money Nest v2.7 - Imported Data

Imported:
- 856 CalendarBudget rows after ignoring After-Move Budget / moving-budget entries
- 310 Money Nest transactions after pairing transfers and reducing clean repeating series
- 22 debt accounts from the screenshots + Klarna items inferred from remaining scheduled payments
- 18 categories

Important assumptions:
- Cash account starting balances were set from the CalendarBudget screenshot:
  - Mak Checking: $6.07
  - Ty Checking: $39.42
  - Joint Checking: $60.32
  - Savings: $0.00 because no current balance was visible
- All imported transactions are marked Planned so your actual balances start from the screenshot balances.
- Clean repeat patterns were converted into recurrence rules.
- Irregular pre-expanded repeating schedules were kept as planned occurrences rather than forcing a wrong recurrence rule.
- After-Move Budget entries were ignored.

Update in v2.10 fixed:
- Rebuilt from stable v2.7 imported version.
- Updated 5/31 starting balances.
- Added duplicate transaction button.
- Added quick planned/cleared toggles and right-click menu.

Update in v2.11:
- Fixed personal safe-to-spend to use the lowest projected balance before the next paycheck.
- Improved calendar transaction chips so titles wrap instead of getting cut off as ellipses.

Update in v2.12:
- Added Paycheck transaction type.
- Safe-to-spend now uses only Paycheck transactions, not general Income.
- Existing Mak/Ty Paycheck entries were converted to Paycheck type.

Update in v2.13:
- Replaced Projected on Accounts with Bills Until Payday for personal accounts.
- Joint Checking now shows Bills Before Low Day.
- Dashboard summary now shows Bills Coming Up instead of Projected Cash.

Update in v2.14:
- Account cards now show next paycheck date for Bills Until Payday.
- Joint shows the lowest day date for Bills Before Low Day.
- Account detail and dashboard safe-to-spend rows include those dates too.

Update in v2.15:
- Fixed Dashboard Upcoming layout so long titles/accounts do not stack weirdly.
- Made calendar more compact, closer to CalendarBudget-style chips.
- Added filters/sorting to account and debt transaction ledgers.
- Default ledger view shows upcoming 90 days instead of jumping into 2027.

Update in v2.16:
- Fixed Dashboard Upcoming layout with compact two-column rows.
- Removed visible Planned/Cleared buttons from calendar/dashboard compact views; right-click still works.
- Made calendar more compact again.
- Added Bills recurrence filter so you can show monthly/yearly/biweekly/etc.
- Rebuilt account/debt transaction filters with inline controls so sorting/filtering works.

Update in v2.17:
- Replaced Dashboard render block to fix empty dashboard/runtime issue.
- Fixed day-popup transaction rows so amounts stay inside the modal.
- Closing day popup before opening transaction prevents the frozen stacked-modal behavior.
- Added an error banner if a future runtime error happens.

Update in v2.18:
- Calendar now fits the full month into the available desktop page height.
- Calendar days show up to 3 transactions, then a + more indicator; click the day to see all transactions.

Update in v2.19:
- Fixed dashboard render defensively so one bad row cannot blank the dashboard.
- Fixed day popup close buttons and click-outside close.
- Day popup rows now keep amounts inside the modal.
- Calendar now shows + more and expands the day on hover/focus to show all transactions.

Update in v2.20:
- Fixed right-click menu actions and close behavior.
- Right-click menu now updates label based on cleared/planned status.
- + more on calendar is now clickable and opens the day popup.
- Calendar hover expansion is no longer clipped by the calendar grid.

Update in v2.21:
- Removed unreliable hover-expanded calendar overlay.
- Calendar now shows up to 3 items plus a visible +more line inside each day.
- Clicking +more opens the full day popup.

Update in v2.24:
- Fixed dashboard startup boot using normal setView render.
- Day popup close buttons directly call dialog.close().
- Added/kept Bills repeat-type filter.
- Improved debts section with current balance, credit line, utilization, and inferred recurring/min payment text.

Update in v2.25:
- Added editable debt fields: statement date, due date, statement balance, minimum due, manual extra payment, payment status, frozen/locked, notes.
- Debt list now shows current balance, statement balance, credit line/utilization, due/min due, and status.
- Debt detail now has metric cards for all key credit-card/loan tracking fields.

Update in v2.26:
- Fixed day popup close button escaping issue.
- Added persistent dashboard startup retry until cards populate.
- Restored visible +more badge plus hover list for hidden calendar transactions.

Update in v2.27:
- Added editable emoji/color for accounts and debts.
- Calendar transactions are draggable between days; repeating transactions move only that occurrence via date overrides.
- Recurring transactions can move weekend dates to Monday or back to Friday.

Update in v2.28:
- Account/debt colors now tint the whole card with a stronger colored edge.
- Debt top-level type groups are collapsed by default and show type total + count.
- Accounts and debt accounts are draggable to reorder.

Update in v2.29:
- Replaced confusing total cash/bills dashboard cards with attention-focused cards.
- Added Action Center with Needs Attention and Debt Payments Due Soon.
- Debt due dates estimate future monthly due dates from the due day saved on each debt.
- Added original credit card screenshot due dates/minimum payments/payment status to the imported debt data where visible.

Update in v2.30:
- Added editable CSV export for Accounts, Debts, and Transactions.
- Added CSV import for edited Accounts/Debts/Transactions CSVs.
- Added quick due/minimum update action on debt detail and debt cards.

Update in v2.31:
- Added Clear Everything with multiple confirmations and required typed phrase.
- CSV export now includes Categories and Budgets in addition to Accounts, Debts, and Transactions.
- Transaction CSV now includes recurrence weekday, ordinal, weekend handling, and date overrides JSON.
- CSV import supports Categories/Budgets and fuller recurring transaction options.

Update in v2.32:
- Fixed first-load dashboard render by calling renderDashboard directly after DOM ready and again after paint.
- Redesigned Action Center into cleaner responsive sections so it does not look cramped.

Update in v2.33:
- Fixed transaction ledger date sorting so oldest first/newest first behave correctly.
- Default upcoming transaction sort is now oldest first.

Update in v2.34:
- Dragging transactions from the hover-expanded day list now works.
- Cleaned up hover-expanded calendar overlay so underlying transactions don't visually peek through.

Update in v2.35:
- Fixed calendar drag/drop target handling so transactions can drop onto another day again.
- Added missing moveTransactionOccurrence helper for moved occurrences.
- Redesigned Action Center into cleaner responsive rows/cards.

Update in v2.36:
- Debt type sections and company groups remember whether they were expanded/collapsed when navigating into accounts and back.

Update in v2.37:
- Added editable display labels for top-level debt categories.
- Default Klarna type label now displays as Buy Now, Pay Later while Klarna remains a company/subcategory.

Update in v2.38:
- Rebuilt Action Center as clean full-width stacked sections with responsive card rows.
- Kept editable debt category labels from v2.37.

Update in v2.39:
- Debt cards now show statement balance with statement date.
- Debt cards/detail can show estimated amount left after minimum/manual extra payment.
- Debt detail includes a Plan min payment quick action when minimum due and due date are set.

Update in v2.40:
- Savings accounts are excluded from safe-to-spend warnings and dashboard safe-to-spend list.
- Savings account cards show Reserve instead of Safe.

Update in v2.41:
- Plan min payment now asks for the source checking account and creates a linked transfer from that account to the debt.
- The planned payment now affects both the cash account balance and the debt balance.

Update in v2.42:
- Fixed calendar hover dimming so single-transaction days no longer gray out.
- Days only dim visible chips when there are hidden transactions/hover-expanded list.

Update in v2.43:
- Savings accounts now replace Reserve with savings goal info.
- Added editable savings goal name and goal amount to account editor.
- Savings card shows Left to Goal, progress percent, and goal amount when set.
- CSV accounts export/import includes savings goal name and goal amount.

Update in v2.44:
- Added custom Money Nest favicon/browser icon.
- Added Apple touch icon for iPhone home screen.
- Added PWA manifest for install/home-screen support.

Update in v2.45:
- Fixed transaction ledger date sorting with numeric date comparison.
- Oldest first now uses ascending date order; newest first uses descending date order.
- Upcoming 90 days defaults to oldest first.

Update in v2.46:
- Renamed transaction date sort labels to Date: soonest first / Date: farthest first to better match upcoming bill planning.
- Sort logic remains: soonest first = earliest date first, farthest first = latest date first.

Update in v2.47:
- Replaced favicon, Apple touch icon, manifest icons, and in-app brand mark with the chosen app icon.

Update in v2.48:
- Added BNPL purchase workflow.
- Creates a new Buy Now, Pay Later/Klarna-style debt account.
- Auto-splits purchase total into editable planned payments.
- Planned payments link to the selected checking account and the BNPL debt account.

Update in v2.49:
- BNPL is now treated as a true top-level debt type: Buy Now, Pay Later.
- Providers like Klarna remain company/subcategory groups underneath BNPL.
- Each BNPL purchase remains its own debt account/loan.
- Existing Klarna-type debts are normalized into Buy Now, Pay Later while keeping company/provider as Klarna.

Update in v2.50:
- Moved backup/import/export CSV controls from the page header into Settings.
- Page headers are cleaner and shorter.

Update in v2.51:
- Moved calendar month/view controls into the top-right page header.
- Calendar controls only show on the Calendar page.
- Page headers are more compact and space-saving.

Update in v2.52:
- Replaced default categories with CalendarBudget-style categories/colors from the screenshot.
- Added emojis to each category.
- Added category migration so old paycheck/transfer/unassigned categories map into the new set.

Update in v2.53:
- Restored Paycheck, Transfer, and Unassigned as distinct categories.
- Removed category migration that mapped Paycheck to Income, Transfer to Banking, and Unassigned to Banking.
- Paycheck remains available for paycheck visuals/rules; Transfer and Unassigned remain separate.

Update in v2.54:
- Added Mak paycheck auto-calculation option for paycheck transactions.
- Calculates paycheck amount based on weekday count in the matching pay period.
- Uses 10 days = $1,560, 11 days = $1,700, 12 days = $1,845; fallback prorates from 11-day amount.
- Paycheck dates follow the 7th/22nd rule with weekend dates moved back to Friday.
- Manual edits are supported by unchecking auto-calculation.

Update in v2.55:
- Added Medical as a top-level debt type/section.
- AccessOne and medical-like debts are normalized into Medical instead of Loan.
- Medical debt payments use the Medical category when planning a minimum payment.
- Debt editor now includes Medical as a debt type option.

Update in v2.56:
- Replaced sample/current data with CalendarBudget_Accounts_v2.xlsx import.
- Added 75 transactions from Mak, Joint, Ty, and Debts sheets.
- Added recurring rules parsed from notes/repeats where provided.
- Mak variable paychecks use autoMakPaycheck.
- Budgets are blank because the workbook did not include budget amounts.

Update in v2.57:
- Fixed account editor Save button by restoring missing savings goal fields.
- Added editable savings goal name and goal amount to account editor.
- Made account save logic safer when optional fields are missing.

Update in v2.58:
- Restored the Calendar account selector/filter for All, Mak, Ty, and Joint.
- Calendar toolbar is visible again after the compact header cleanup.

Update in v2.59:
- Moved Calendar month/view controls into the same top header row as the Calendar title.
- Removed the extra toolbar row above the calendar to give the calendar more vertical room.

Update in v2.60:
- Account detail now shows cleared balance, projected 30-day balance, and projected 90-day balance.
- Account transaction ledger now shows running/projected balance after each transaction.
- Account detail defaults to all dates and newest/farthest first for easier recent-transaction review.

Update in v2.61:
- Fixed Balance After for recurring/generated transactions by using occurrence-specific running-balance keys.
- Account detail is locked to chronological/s soonest-first order so running balances remain accurate.
- Removed the Sort dropdown from account detail while keeping other filters.
- Restored the Calendar account selector/header controls.

Update in v2.62:
- Added Bank View and Forecast View tabs to account detail.
- Bank View shows cleared transactions only, newest first, with bank-style balance.
- Forecast View shows planned/cleared timeline chronologically with projected balance after each transaction.
- Added transaction search box.
- Calendar account selector moved back into the Calendar page as a local toolbar so it does not disappear.

Update in v2.63:
- Forecast View now has a forecast range selector: Today forward, This month, Through next paycheck, Next 30/60/90 days, All forecast.
- Forecast View calculates hidden starting balances before the visible range so Balance After stays accurate even when June is hidden.
- Bank View remains cleared-only and newest-first.

Update in v2.64:
- Forecast running balances now order same-day transactions so income/transfers in apply before expenses/transfers out.
- Account ledger display uses the same same-day ordering, preventing temporary false negatives when income and bills happen on the same date.

Update in v2.65:
- Through next paycheck now skips cleared paycheck transactions and uses the next uncleared/planned paycheck.
- Future generated recurring transactions are planned even if the base recurring transaction was cleared, preventing future paychecks/bills from all becoming cleared.

Update in v2.66:
- Fixed Bills page crash by restoring the missing Repeats filter element and guarding Bills filter event listeners.
- Bills rendering now handles bad/partial recurring transaction data without crashing the full site.

Update in v2.67:
- Added loan payoff table details for LendingClub, Mak AccessOne, Mak Auto Loan, and Ty Auto Loan.
- AccessOne is kept as Medical debt.
- Added starting balance/payoff-date fields to debt editor where supported.
- Debt cards show estimated payoff date/months when available.

Update in v2.68:
- Fixed Bills page freeze/crash by replacing expensive next-occurrence logic.
- Bills no longer calls expandedTransactions repeatedly for every recurring item.
- Restored/guarded Repeats filter and Bills filter event listeners.
- Added safer Bills render fallback so one bad recurring item cannot crash the site.

Update in v2.69:
- Redid credit card debt records from the 6/3/26 screenshot.
- Updated current balances, statement balances/dates, due dates, APRs, limits, minimums, payment statuses, manual extra, and notes.

Update in v2.70:
- Added recurring transaction save scope: This occurrence only or This and future occurrences / recurring series.
- Editing a single occurrence creates a one-time replacement and skips the original occurrence.
- Editing future occurrences from a generated occurrence starts a new recurring series from the edited occurrence while skipping that occurrence in the old series.

Update in v2.71:
- Fixed Mak paycheck auto-calculation for 7th/22nd paydays.
- Mak paycheck recurring rules now use monthly-by-date instead of nth-weekday.
- Restored/imported backups with old Mak paycheck recurrence rules are normalized automatically.
- July 7 uses the June 16–30 pay period and calculates 11 weekdays = $1,700.

Update in v2.72:
- Added Calendar category highlight multi-select.
- Defaults to All categories.
- Selecting one or more categories keeps those colorful and greys/mutes non-selected categories instead of hiding them.

Update in v2.73:
- Added recurring delete scope: delete this occurrence only or delete the whole recurring series.
- Auto-calc Mak paycheck is confirmed/restored and made more visible when Type=Paycheck and Account=Mak Checking.
- Saving an auto-calc Mak paycheck now stores the calculated amount even if the amount field was 0.

Update in v2.74:
- Fixed Mak paycheck weekday count by making date formatting/counting local-date safe.
- June 16–30, 2026 should now count as 11 weekdays and calculate July 7 paycheck as $1,700.
- Updated start/end-of-month helpers to avoid midnight timezone edge cases.

Update in v2.75:
- Moved Clear everything out of the sidebar Quick Add area and into Settings only.
- Moved Reset sample data into Settings only.
- Sidebar Quick Add now only contains + Transaction.

Update in v2.76:
- Replaced sidebar Quick Add card with Recent places.
- Sidebar still keeps + Transaction as the only action button.
- Recent places tracks recently opened accounts, debts, calendar, bills, budgets, accounts, and debts pages.

Update in v2.79:
- Recovery build from v2.76 to fix broken click/navigation behavior from template/autocomplete changes.
- Cleaned setView and startup handling so navigation should work again.
- Updated CSV export/import for newer debt payoff fields and transaction auto-paycheck fields.
- Transaction templates/autocomplete are intentionally held back from this recovery build until they can be added safely.

Update in v2.80:
- Fixed app-wide click/navigation break caused by startup ReferenceErrors.
- Recent Places now loads after its variable exists.
- Added compatibility shim for browsers that do not expose element IDs as globals.
- Verified startup and Dashboard/Calendar/Accounts/Bills/Debts/Settings navigation with a mocked runtime test.

Update in v2.81:
- Recent Places now only tracks specific account/debt detail pages.
- Top-level pages like Calendar, Bills, Debts, Budgets, Accounts, and Settings are no longer tracked.
- Recent Places is capped to the 3 most recent detail pages.

Update in v2.82:
- Added Transaction Templates safely after v2.80/v2.81 stability fixes.
- Settings now includes Transaction Templates list with add/edit/delete.
- Transaction title field now suggests matching templates while typing.
- Saving a transaction automatically creates/updates its template.
- CSV export/import now includes transaction templates CSV.

Update in v2.83:
- Moved recurring save/delete scope choices out of the transaction form.
- Saving a recurring transaction now opens a popup asking whether to save this occurrence only or the series/future occurrences.
- Deleting a recurring transaction now opens a popup asking whether to delete this occurrence only or the whole series.

Update in v2.84:
- Calendar now displays transfers from the viewed account's perspective.
- In a from-account view, transfers show as negative.
- In a to-account view, transfers show as positive.
- In All checking accounts view, internal transfers show both outgoing and incoming sides.

Update in v2.85:
- Fixed transaction templates not refreshing reliably in Settings after auto-save.
- Recurring delete now stops this-and-future occurrences without deleting past occurrences.
- Added recurrenceUntil support so ended recurring series can preserve history.
- Added recurrenceUntil to transaction CSV export/import.
- Note: All checking account calendar balances stay unchanged for internal transfers because money moved between checking accounts is neutral to the combined total.

Update in v2.86:
- Fixed Calendar day balances not updating on days with visible transactions.
- Calendar balances now advance using the same account-perspective entries shown on the calendar, including transfers, paychecks, and expenses.

Update in v2.87:
- Reworked Settings to reduce scrolling.
- Backup/import tools are now at the top.
- Categories, Transaction Templates, and How This Version Works are collapsible sections.
- Fixed Settings render so Transaction Templates list/count refresh correctly.

Update in v2.88:
- Monthly recurring transactions set for the 29th/30th/31st now fall on the last day of shorter months.
- This prevents end-of-month recurring bills from disappearing in February.
- Bills page next-occurrence logic uses the same rule.

Update in v2.89:
- Added simple hourly paycheck estimator profiles for Mak and Ty in Settings.
- Mak defaults to $24/hr, 8 hours per workday, and 18.51% estimated deductions based on provided $1,920 gross / $1,564.55 net example.
- Ty defaults to $22/hr, 38 hours per check, and 18.51% estimated deductions as a starting estimate.
- Paycheck transactions can auto-calculate using the owner/account profile.
- Added optional hours override per paycheck transaction, useful for Ty's variable hours.
- Transaction CSV export/import now includes autoPaycheck and paycheckHoursOverride.

Update in v2.90:
- Savings account cards now show Planned Transfers In instead of Bills Next 30 Days.
- Planned Transfers In totals planned/uncleared transfers into that savings account over the next 30 days.
- The savings transfer metric is shown as positive/green.

Update in v2.91:
- Added multi-select category filter to the Bills page.
- Bills can now be filtered by one or more categories, such as Subscription, Insurance, or Utilities.
- Defaults to All categories.

Update in v2.92:
- Replaced the Bills native multi-select category dropdown with a custom checkbox dropdown.
- Category filtering no longer requires Ctrl/Cmd-click.
- You can click categories normally; All categories works as a reset/default.

Update in v2.93:
- Paycheck transactions no longer force the category to Paycheck during auto-calc.
- Auto-calc now updates the amount only and preserves the selected category.
- Paycheck transactions that are blank/unassigned default to Income.

Update in v2.94:
- Settings backup/import card no longer sticks while scrolling.
- Categories now display alphabetically by name in Settings and dropdowns.
- Adding/editing a category now keeps the underlying category list sorted.

Update in v2.95:
- Bills page status is now based on the next actionable occurrence, not the recurring rule's base status.
- Future recurring bills show Planned even if the base rule was marked cleared.
- Due/today or overdue unpaid occurrences show Due.
- Cleared only shows for a specifically cleared current/base occurrence.

Update in v2.96:
- Bills page now advances cleared recurring items to the next planned occurrence.
- Cleared recurring bills no longer stay stuck at the cleared occurrence in the Bills list.
- Unpaid past/today occurrences still show Due.

Update in v2.97:
- Fixed Bills page cleared recurring items still showing the paid occurrence date as Planned.
- Cleared recurring bills now search for the first future occurrence after today and show that as Planned.
- If no future occurrence exists, the paid item stays Cleared instead of becoming Planned.

Update in v2.98:
- Fixed editing/deleting recurring transactions from the Bills page.
- Bills page now opens the specific displayed occurrence instead of only the base recurring rule date.
- Right-click/context edit/delete on Bills rows also carries the displayed occurrence date.

Update in v2.99:
- Fixed deleting a recurring bill from Bills removing it from Calendar but not advancing/removing it from Bills.
- Delete occurrence now skips both the displayed date and the matching original recurring source date.
- Bills and next-occurrence logic now ignore explicitly skipped occurrences.

Update in v2.100:
- Calendar planned/uncleared transaction chips now use a lighter dashed style by default, similar to the previous hover look.
- Cleared chips remain more solid and now get a small check marker.
- Planned chips get a small open-circle marker for quick scanning.

Update in v2.101:
- Fixed planned calendar chips becoming oversized after v2.100.
- Removed bulky pseudo-marker layout from calendar chips.
- Planned chips now remain compact with a subtle dashed inset outline.

Update in v2.102:
- Restored category colors on planned calendar chips while keeping them compact.
- Planned chips now use a subtle dashed inset outline based on the category color.
- Removed the v2.101 flattening effect that made planned chips look grey/uncolored.

Update in v2.103:
- Rolled back calendar chip styling to the original compact look from before the planned/cleared visual experiments.
- Planned chips are compact again and keep the original opacity/dashed style.
- Removed oversized/dotted inset styling overrides.

Update in v2.104:
- Fully removed the dashed/dotted full-box styling from calendar planned chips.
- Calendar chips now use compact category-colored backgrounds with only the left category color bar.
- Planned vs cleared no longer changes chip size or adds dotted outlines.

Update in v2.105:
- Calendar planned/uncleared chips now match the compact dashed-outline look requested.
- Planned chips keep category-colored backgrounds and a solid category color bar on the left.
- Cleared chips stay compact with solid borders.

Update in v2.106:
- Made calendar transaction chips slightly smaller/more compact while keeping the dashed planned style.
- Reduced chip padding, margin, gap, font size, and left color bar width slightly.

Update in v2.107:
- Fixed category emoji/color edits not reliably updating existing transactions in Calendar.
- Category lookup now handles duplicate category IDs safely.
- Adding a category with an existing name/id updates the existing category instead of creating a duplicate.
- Saving/deleting categories now forces selectors and visible pages to refresh.
- Deleting a category now explicitly reassigns existing transactions/templates to Unassigned.

Update in v2.108:
- Cleared calendar transactions now keep their category color/background.
- Cleared chips remain solid, while planned/uncleared chips keep the dashed style.

Update in v2.109:
- Added a clear Delete whole recurring series option in the recurring delete popup.
- Whole-series delete now removes the recurring rule and matching orphaned bill entries.
- Bills hides recurring items with no remaining actionable occurrence instead of showing stale stuck bills.

Update in v2.110:
- Buy Now, Pay Later/Klarna debt detail pages now use installment-loan language.
- BNPL detail cards show Remaining Balance, Original Purchase, Paid So Far, Next Due, and Installment Status.
- BNPL remaining balance is now calculated from unpaid/uncleared linked installment payment transactions.
- BNPL original purchase total is calculated from all linked installment payments, with statement/starting balance fallback.
- BNPL debt list text now shows original amount/next due instead of statement/minimum wording where applicable.

Update in v2.111:
- Debt edit modal now changes labels/visible fields when Type is Buy Now, Pay Later.
- BNPL edit fields use Remaining Balance, Original Purchase/Total, Next Payment Due, and Next Payment Amount language.
- BNPL hides statement date, statement balance, APR, manual extra, payment status, and frozen/locked fields.
- BNPL save keeps hidden credit-card-only fields neutral while preserving fallback/reference BNPL values.

Update in v2.112:
- Medical debts now behave more like interest-free payment plans.
- Medical detail metrics show Remaining Balance, Starting Balance, Monthly Payment, Next Due, and Payment Status.
- Medical edit form hides Credit Line/Limit, Statement fields, APR, Manual Extra, and Frozen/Locked.
- Medical edit form uses Monthly Payment instead of Minimum Due and keeps APR/limit neutral.

Update in v2.113:
- Added separate Starting Balance and Current Balance tracking for loans, medical debts, and BNPL/installment debts.
- Current balance/total left uses the entered Current Balance as the amount still owed now.
- Starting Balance is stored separately for history/progress/payoff tracking and does not change total left.
- Loan edit forms hide Credit Line/Limit and use Starting/Current Balance plus APR/monthly payment.
- Medical/BNPL forms keep payment-plan language while preserving starting/current balance info.

Update in v2.114:
- Fixed BNPL debt edit labels so Original Purchase / Total is not overwritten by the generic Starting Balance label.
- Added Starting Balance to newly-created BNPL purchases so imports/exports preserve original purchase history separately from Current Balance.
- Normalized debt imports/backups to preserve Current Balance from balance/currentBalance while keeping Starting Balance as history/progress only.
- Updated quick debt payment editing so BNPL and Medical debts show payment-plan language and hide credit-card-only statement fields.

Update in v2.115:
- Added the missing isMedicalDebt helper so Medical debts/payment plans load correctly.

Update in v2.116:
- Added missing Medical payment-plan detail helpers so opening a Medical account no longer crashes.
- Medical detail cards now calculate Current Balance, Starting Balance, Paid So Far, Next Due, and payment-plan status safely.

Update in v2.117:
- Debt type/company expansion state is now session-only so all debt groups start collapsed by default on page load.
- Legacy openDebtTypes/openDebtCompanies fields are preserved for backup/import compatibility but no longer force groups open from saved data.


Update in v2.118:
- Medical and loan detail/list Current Balance displays now use the saved Remaining/Current Balance field instead of subtracting upcoming planned payments.
- Medical Paid So Far now calculates as Starting Balance minus Current/Remaining Balance, matching the progress/history rule.
- Import/export field compatibility is unchanged.


Version v2-119 notes:
- Debt monthly payment displays now use minimum/monthly due + manual extra by default.
- Added/used the existing totalMonthlyPayment field as an editable override for all non-BNPL debts while preserving import/export compatibility.
- Plan payment now defaults to the monthly payment total instead of minimum due only.

Version v2-120 notes:
- Added an Estimated Payoff card to debt detail metrics for BNPL, medical, loans, and credit cards.
- BNPL payoff uses the last unpaid installment date from the linked payment schedule.
- Debts with recurring linked payments estimate payoff from the generated payment schedule, including weekly/biweekly/custom recurrence dates.
- Debts without a recurring schedule estimate payoff from Monthly payment total and APR when available.
- No import/export field changes were required; existing payoffDate remains preserved for compatibility.


v2-121
- Fixed credit card Current Balance displays so they use the saved Current balance field.
- Planned/recurring payments no longer reduce the Current Balance card or debt list totals before they actually happen.
- Estimated payoff still uses scheduled/recurring payments to forecast payoff dates.

v2-122
- Current Balance now starts from the editable Current/Remaining Balance field and applies cleared debt transactions only.
- Cleared card/debt spend increases the amount owed now; cleared debt payments reduce it.
- Planned/recurring future payments still do not affect Current Balance until they are entered/cleared.
- Import/export compatibility is unchanged.

v2-123
- Fixed a debts-page freeze/crash caused by calculating Current Balance through year 2999, which expanded recurring transactions too far.
- Current Balance now calculates through today only, while Estimated Payoff can still use future recurring schedules for forecasting.
- Import/export compatibility is unchanged.


v2-124
- Removed manual Current Balance editing for regular debt accounts; Current Balance is now calculated from Starting Balance plus cleared debt transactions/payments.
- Added trackingStartDate for debts so statement reconciliation can reset the balance baseline without older cleared transactions continuing to affect Current Balance.
- Added a quick-update checkbox to reset a credit-card tracking baseline to the entered statement balance/date.
- Debt CSV import/export now includes trackingStartDate while preserving the legacy balance field for compatibility.

v2-125
- Credit card detail pages now show Available Credit on the Credit Line card.
- Available Credit is calculated as Credit Line minus calculated Current Balance.
- No import/export field changes required.

v2-126
- Credit card account rows on the Debts page now also show Available Credit under Credit Line.
- Available Credit uses Credit Line minus calculated Current Balance, matching the debt detail card.
- No import/export field changes required.

v2-127
- Added Expand all and Collapse all controls to the Debts page.
- Buttons open/close every debt type and company section for the current session without changing import/export data.
- No import/export field changes required.

v2-128
- Updated the Debts page Expand/Collapse controls to apply only to top-level debt type sections.
- Expanding all debt types no longer opens every company/account section underneath them.
- No import/export changes needed.

v2-129
- Debt detail transaction ledgers now display payments linked to that debt as positive/green amounts, because they reduce the amount owed.
- Card/debt spending in a debt detail ledger still displays as negative/red because it increases what is owed.
- This is display-only; balance math and import/export fields are unchanged.


v2-130
- Added “Use card instead” for planned cash expenses from the transaction right-click menu.
- The helper converts the selected cash expense into a cash payment/transfer linked to the chosen card while keeping the original category for cash planning.
- It also creates a separate card/debt spend transaction on the purchase date so the card balance and debt ledger stay accurate.
- Purchase date and payment date can be different, which supports workflows like buying groceries Sunday and paying the card Wednesday.
- No new import/export fields are required; the feature uses existing transaction fields.


v2-131
- Added pending reimbursement / IOU planning between cash accounts.
- Pending reimbursements subtract from the paying account forecast but do not increase the receiving account's projected/available balance until cleared.
- Account detail pages now have an IOU / reimbursement action and show expected reimbursements separately when present.
- Transaction right-click menu can mark a pending reimbursement cleared.
- CSV import/export for transactions now includes pendingReimbursement and reimbursementToAccountId.


v2-132
- Reworked Debts page expand/collapse controls so they live on each debt type section.
- Expand accounts / Collapse accounts now affect only the companies/accounts inside that one debt type, such as Credit Cards or Medical.
- Removed the page-level expand/collapse debt type buttons to avoid opening the wrong level.
- No import/export changes needed.


v2-133
- Added a reverse credit-card workflow for purchases that were entered on the card first.
- Right-click an existing Credit Card expense and choose Create card payment to add the cash-account payment linked to that card.
- The helper works for all debts labeled Credit Card, keeps the purchase category for cash planning, and can optionally create a pending reimbursement / IOU when another cash account fronted the card payment.
- No import/export field changes required.

v2-134
- Transaction title autofill/templates now remember only the Basics box fields: title, type, category, and notes.
- Autofill no longer saves or applies account, card/debt, transfer-to, or linked-debt routing fields.
- Existing templates with older account-routing fields remain import-compatible, but those fields are ignored by autofill going forward.
- No import/export file format changes required.

v2-135
- Saved UI preferences for filter/sort dropdowns across Calendar, Bills, transaction ledgers, and account detail forecast controls.
- Preferences are stored locally in the browser as UI state, separate from JSON/CSV backup data, so import/export compatibility is unchanged.
- Search boxes remain temporary and are not saved, so an old search term will not hide transactions later.
- No import/export field changes required.

v2-136
- Added a Dashboard credit card statement reminder section using the previous statement date to estimate the next statement pull date.
- The Dashboard now shows upcoming credit card statements expected in the next 45 days and links each row to the card detail page.
- Statement estimates use existing credit card statementDate/statementBalance fields, so no import/export changes are required.

v2-137
- Dashboard debt payment list is now capped to the first 6 upcoming items, with a shortcut row when more are due soon, so the Dashboard stays more compact.
- Dashboard credit card statement reminders now show only cards that are past due to check or expected in the next 7 days.
- Credit card statement reminders no longer auto-roll forward if the card statement date has not been updated yet, so stale statement dates show as needing attention instead of disappearing.
- Credit card rows on the Debts page now show Next statement instead of After payment in the Current section.
- No import/export changes required.

v2-138
- Calendar now highlights the lowest and highest projected balance days within the currently viewed month.
- Low-balance days get a subtle red tint; high-balance days get a subtle green tint.
- Highlights are display-only and use the same visible account/filter balance calculation already shown on the calendar.
- No import/export changes required.

v2-139
- Fixed paycheck-account Safe to Spend on payday.
- When today is payday, Safe to Spend now looks through the following paycheck instead of treating today as the next paycheck and showing only today’s leftover/projected balance.
- Bills Until Payday uses the same payday-aware horizon.
- No import/export changes required.


v2-140
- Removed the All Forecast option from account detail Forecast View because expanding recurring schedules indefinitely could crash/freeze the Accounts page.
- Existing saved UI preferences using All Forecast are automatically reset to Next 90 days.
- No import/export changes required.

v2-141
- Added loan payment breakdown fields for loan payments: principal paid, interest paid, and fees paid.
- Loan balances now decrease by the principal portion of cleared loan payments instead of always subtracting the full cash payment when a breakdown is entered.
- If principal is left blank but interest/fees are entered, Money Nest estimates principal as total payment minus interest and fees; if no breakdown is entered, old payments still count the full payment as principal for compatibility.
- Added Adjust balance on loan detail pages to match the lender balance with a non-cash balance adjustment.
- Transaction CSV import/export now includes loanPrincipalAmount, loanInterestAmount, loanFeeAmount, and loanBalanceAdjustment.

v2-142
- Fixed BNPL/Klarna status display so the Debts page account row uses the same installment status logic as the account detail view.
- BNPL accounts now infer Planned/Complete from linked installment payments when no manual payment status is set.
- Added Payment/Installment Status editing for BNPL accounts in Edit debt and Update payment plan.
- No import/export changes required; this uses the existing paymentStatus field.

v2-143
- Added loan payoff forecast settings for auto/loan accounts.
- Future recurring loan payments can now estimate principal, interest, and fees from recent cleared payments that have a payment breakdown.
- Added per-loan forecast controls: Auto from cleared breakdowns, Manual percentages, or Off/full payment; and fee timing options including first payment each month.
- Actual loan payment breakdown fields still override estimates payment-by-payment.
- Loan projected balances and estimated payoff dates use principal-only reductions when an estimated or manual breakdown is available.
- Debt CSV import/export now includes loanForecastBreakdownMode, loanFeeTiming, loanEstPrincipalPct, loanEstInterestPct, and loanEstFeePct.

v2-144
- Loan Current Balance now uses Statement Balance/Date as the lender baseline when provided, then counts only cleared loan transactions/payments after that statement date.
- This helps auto loans stay accurate when older lender-side interest/fee activity or payments were not entered in Money Nest.
- Planned/recurring loan payments with no manual breakdown now auto-estimate principal/interest/fees from recent cleared payment breakdowns.
- Blank cleared recurring loan payments can use the same estimate instead of assuming the full payment lowers principal.
- Manual principal/interest/fee entries still override the estimate.
- No import/export changes required.

v2-145
- Added history-only auto-loan forecast samples from Book1 for Mak/Ty auto loans.
- Loan payoff estimates can now use saved forecast history without creating visible transactions.
- Future loan payment estimates can use balance-based interest/fee rates so estimates change as the projected balance drops instead of using one flat split forever.
- Debt CSV export/import now includes loanForecastHistoryJSON for preserving history-only forecast samples.

v2-146
- Medical debts/payment plans now include Statement/Current Balance and Statement/Current Date fields in Edit debt and Update payment plan.
- Medical Current Balance can now use that provider baseline instead of always starting from Starting Balance.
- When Statement/Current Balance + Date are set, medical balances only count cleared payments/transactions after that date.
- Starting Balance remains the original/history amount for progress.
- No import/export changes required; this uses the existing statementBalance and statementDate fields.


v2-150
- Replaced the Calendar category highlight native multi-select with the same checkbox dropdown style used elsewhere.
- Calendar category highlights can now be clicked/toggled normally without the browser dropdown swallowing selections.
- Saved highlight preferences are preserved; no import/export schema changes needed.

v2-149
- Savings account cards now show total planned transfers in instead of only next-30-day transfers.
- The same card still shows the next-30-day planned transfer amount in the subtext for short-term context.
- One-time planned transfers beyond 12 months are included; recurring transfer series are counted through the next 12 months to avoid infinite totals.
- No import/export schema changes needed.

v2-148
- Added Export 12-month picture in Settings for a longer readable financial report.
- The 12-month report extends upcoming planned transactions, debt due dates, statements to check, and category cashflow to 365 days.
- No import/export schema changes needed.

v2-147
- Added Export financial picture in Settings.
- The new report downloads a readable HTML snapshot with account balances, safe-to-spend, debts, debt payments due soon, credit card statements to check, recurring bills, upcoming planned transactions, and planned cashflow by category.
- This is a readable/shareable report only; JSON backup remains the full restore format and CSVs remain the batch-edit format.
- No import/export data schema changes needed.


v2-151
- Calendar now highlights today with a bold border and Today label.
- Today highlighting stacks with existing lowest/highest balance day highlights.
- No import/export changes needed.


v2-152
- Removed the extra TODAY label from calendar cells while keeping the today border/date highlight.

v2-153 notes
- Transaction autofill templates now apply only title/category/notes. They no longer change transaction type/status or any account/card/debt/transfer routing.
- Added Settings > Recent changes with an Undo last change button for future saved edits.
- Recent changes are local to the browser and are separate from JSON/CSV export/import.


v2-154
- Recent changes now shows detailed before/after summaries instead of only counts.
- Transaction history entries list added, edited, and deleted transactions with date, amount, type, status, category, and routing details.
- Latest change opens by default and still supports one-click undo.

v2-155
- Recent changes now supports undoing a single transaction inside a batch change.
- Added per-transaction buttons for Remove this, Undo this edit, and Restore this.
- Full Undo last change is still available when the entire batch should be reverted.
- No JSON/CSV import/export schema changes needed.

v2-156
- Fixed recurring paycheck occurrence-only edits, including hours override, so saving "This occurrence only" now stores that specific occurrence instead of silently falling back to the base recurring paycheck.
- Added per-occurrence override storage for recurring transactions. This preserves custom edits to one date while keeping the original recurring series intact.
- Transaction CSV import/export now includes occurrenceOverridesJSON so occurrence-only edits are preserved during batch export/import.

v2-157
- Reimbursement transactions now clear through the normal Mark cleared action. The separate Mark reimbursement cleared context-menu item was removed.
- When a pending reimbursement is marked cleared, it becomes a regular cleared transfer and leaves the expected reimbursement bucket.
- Calendar chip status styling now normalizes cleared/planned classes so cleared transactions should not keep planned/dashed styling.
- No import/export schema changes needed.

v2-158
- Fixed Mark cleared / Mark planned for recurring transactions so it saves an occurrence-only override instead of changing the whole recurring series/template.
- Generated recurring occurrences now default to Planned unless that specific date has its own saved override.
- Calendar/right-click and ledger status buttons now read the clicked occurrence status, so cleared one-off occurrences should display correctly without making every recurrence cleared.
- No import/export schema changes needed.


v2-159
- Fixed JSON backup import so it uses a guarded importer instead of throwing a generic Script error.
- Backup imports no longer create giant Recent changes before/after snapshots, which could make browser storage/import unreliable.
- If import fails, Money Nest now shows a specific import error instead of only the global script-error toast.
- No import/export schema changes needed.

v2-161
- Fixed edited recurring occurrence rows reopening as Add transaction instead of Edit transaction.
- Generated/overridden recurring occurrences now keep their originalId pointed at the real recurring template, even when the displayed row uses a generated occurrence id.
- This should let edited grocery/paycheck/car-payment occurrences reopen correctly from Calendar and Account detail.
- No import/export schema changes needed.


v2-161
- Dashboard statement pills now say Upcoming for future statement dates and Check statement for today/past due.
- Needs Attention only flags safe-to-spend when the account is at or below $0.
- Added account reorder controls on account cards.
- Removed BNPL next payment due from Edit Debt and preserves original BNPL due dates in installment notes.
- Added Settings > Dropdown defaults with reset/apply controls for account/debt transaction filters.
- Added credit utilization summary by owner in Debts using statement and current balances.


v2-162
- Fixed local date handling so Money Nest uses the browser/local date instead of UTC. This prevents the app from thinking it is tomorrow late at night.
- Added a credit utilization payoff simulator from the Debts page utilization cards.
- The simulator is scoped to the selected owner and lets you temporarily edit each card's current/statement balances or apply a test payment without changing real app data.
- No import/export schema changes needed.

v2-163
- Fixed Simulate payoff button on Credit utilization cards. The owner name is now passed safely from the inline button handler, so opening the simulator should no longer throw Unexpected end of input.
- No import/export schema changes needed.

v2-164
- Credit utilization simulator now shows current and statement utilization for each individual card, not just the owner total.
- Per-card utilization updates immediately when simulated balances/payments change.
- No import/export schema changes needed.

v2-165
- Credit utilization simulator now lets you enter a target current utilization percent for each card and shows the payment needed to reach that utilization.
- Added an Apply target payment button for each card simulator row.
- Create card payment now defaults the new payment to Planned instead of Cleared.
- Transfer labels now use actual account-to-account routing, like Ty → Joint or Savings → Joint, instead of repeating the transaction title.
- No import/export schema changes needed.

v2-166
- Transaction title suggestions now show an inline × delete button beside each saved template.
- Deleting a suggestion from the title autocomplete removes that saved template immediately without going to Settings.
- Template deletion still only affects the saved suggestion; it does not delete any existing transactions.
- No import/export schema changes needed.

Update in v2.167:
- Added Supabase Cloud Sync settings.
- Supports login/logout, Save to cloud, Load from cloud, and optional auto-save.
- Cloud sync can be paused/off and JSON backups remain recommended.

v2-168
- Added an iPhone/mobile compact layout pass.
- Mobile view now uses tighter spacing, smaller cards/buttons, horizontal top navigation, compact panels, and better modal scrolling.
- Desktop layout remains unchanged.

v2-169
- Made the iPhone/mobile layout more app-like with bottom navigation and a floating + Transaction button.
- Fixed the Calendar mobile controls so the month/filter header stays pinned at the top while scrolling the calendar.
- Kept desktop layout unchanged.


v2-171: tightened iPhone/mobile layout, made account/dashboard cards more compact, and changed mobile calendar controls to a fixed top bar so they do not scroll with the calendar.
