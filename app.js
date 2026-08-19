const STORAGE_KEY = "moneyNest.v2.113";
const APP_VERSION = "2-250";
const CURRENT_SCHEMA_VERSION = 225;
const UI_PREFS_KEY = `${STORAGE_KEY}.uiPrefs`;

// v2-239: reliably detect iPad/tablet Safari and touch-capable layouts.
const MONEY_NEST_IS_IPAD = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const MONEY_NEST_HAS_TOUCH = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
document.documentElement.classList.toggle("money-nest-ipad", MONEY_NEST_IS_IPAD);
document.documentElement.classList.toggle("money-nest-touch", MONEY_NEST_HAS_TOUCH);
function moneyNestIsPhone(){
  return !MONEY_NEST_IS_IPAD && !!window.matchMedia?.("(max-width: 700px)").matches;
}
let mobileFutureAccountId = "";
let mobileFutureHorizonDays = 30;

// v2.167: Supabase cloud sync helpers. This stores the full Money Nest JSON as one
// per-user row in public.money_nest_data. RLS should restrict each row to auth.uid().
const CLOUD_CONFIG_KEY = `${STORAGE_KEY}.cloudSync`;
const DEFAULT_SUPABASE_URL = "https://phhfsoodpayvcblobmyn.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_A0TLai1FSSYQMCfAd6JNEw_W8TWCkfl";
let cloudClient = null;
let cloudUser = null;
let cloudAutoSaveTimer = null;
let cloudSavingNow = false;

function loadCloudConfig(){
  try{
    const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
    return {
      url: saved.url || DEFAULT_SUPABASE_URL,
      key: saved.key || DEFAULT_SUPABASE_KEY,
      mode: saved.mode || "manual", // manual | auto | off
      lastCloudSave: saved.lastCloudSave || "",
      lastCloudLoad: saved.lastCloudLoad || ""
    };
  } catch(err){
    return {url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY, mode:"manual", lastCloudSave:"", lastCloudLoad:""};
  }
}
function saveCloudConfig(patch={}){
  const next = {...loadCloudConfig(), ...patch};
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(next));
  return next;
}
function cloudConfigReady(config=loadCloudConfig()){
  return !!(config.url && config.key && String(config.url).startsWith("https://"));
}
function cloudLibReady(){ return !!(window.supabase && typeof window.supabase.createClient === "function"); }
function getCloudClient(){
  const config = loadCloudConfig();
  if(!cloudConfigReady(config)) throw new Error("Add your Supabase project URL and publishable key first.");
  if(!cloudLibReady()) throw new Error("Supabase library did not load. Check your internet connection, then refresh.");
  if(!cloudClient || cloudClient.__moneyNestUrl !== config.url || cloudClient.__moneyNestKey !== config.key){
    cloudClient = window.supabase.createClient(config.url, config.key);
    cloudClient.__moneyNestUrl = config.url;
    cloudClient.__moneyNestKey = config.key;
  }
  return cloudClient;
}
async function getCloudUser(refresh=false){
  if(cloudUser && !refresh) return cloudUser;
  const client = getCloudClient();
  const {data: userData, error} = await client.auth.getUser();
  if(error && !String(error.message || "").toLowerCase().includes("auth session missing")) console.warn("Cloud user check", error);
  cloudUser = userData?.user || null;
  return cloudUser;
}
function fmtCloudTime(iso){
  if(!iso) return "Never";
  try{ return new Date(iso).toLocaleString(); } catch(err){ return iso; }
}
function cloudStatusText(config=loadCloudConfig()){
  if(config.mode === "off") return "Off";
  if(!cloudConfigReady(config)) return "Setup needed";
  if(cloudUser?.email) return config.mode === "auto" ? `Auto • ${cloudUser.email}` : `Manual • ${cloudUser.email}`;
  return config.mode === "auto" ? "Auto • not logged in" : "Manual • not logged in";
}
async function renderCloudSyncSettings(){
  const wrap = document.getElementById("cloudSyncPanel");
  const pill = document.getElementById("cloudSyncSummary");
  if(!wrap) return;
  const config = loadCloudConfig();
  try{ await getCloudUser(true); } catch(err){ cloudUser = null; }
  if(pill) pill.textContent = cloudStatusText(config);
  wrap.innerHTML = `
    <div class="cloud-status-card">
      <div>
        <p class="eyebrow">Status</p>
        <div class="value small-value">${cloudUser?.email ? "Signed in" : "Not signed in"}</div>
        <p class="sub">${cloudUser?.email ? cloudUser.email : "Log in before saving/loading cloud data."}</p>
      </div>
      <div>
        <p class="eyebrow">Last cloud save</p>
        <div class="value small-value">${fmtCloudTime(config.lastCloudSave)}</div>
        <p class="sub">Last cloud load: ${fmtCloudTime(config.lastCloudLoad)}</p>
      </div>
    </div>
    <div class="two-col">
      <label>Supabase project URL
        <input id="cloudSupabaseUrl" type="url" value="${escapeAttr(config.url || "")}" placeholder="https://your-project.supabase.co">
      </label>
      <label>Supabase publishable/anon key
        <input id="cloudSupabaseKey" type="password" value="${escapeAttr(config.key || "")}" placeholder="sb_publishable... or anon key">
      </label>
    </div>
    <div class="two-col">
      <label>Cloud sync mode
        <select id="cloudSyncMode">
          <option value="manual" ${config.mode === "manual" ? "selected" : ""}>Manual only</option>
          <option value="auto" ${config.mode === "auto" ? "selected" : ""}>Auto-save after changes</option>
          <option value="off" ${config.mode === "off" ? "selected" : ""}>Off / paused</option>
        </select>
      </label>
      <label>Email
        <input id="cloudEmail" type="email" value="${escapeAttr(cloudUser?.email || "")}" placeholder="you@example.com">
      </label>
    </div>
    <div class="two-col">
      <label>Password
        <input id="cloudPassword" type="password" placeholder="Supabase login password">
      </label>
      <div class="cloud-button-column">
        <button class="ghost small" type="button" onclick="saveCloudSettingsFromForm()">Save cloud settings</button>
        <button class="ghost small" type="button" onclick="toggleCloudKeyVisibility()">Show/hide key</button>
      </div>
    </div>
    <div class="inline-actions cloud-actions">
      <button class="primary small" type="button" onclick="cloudSignUpFromForm()">Create login</button>
      <button class="primary small" type="button" onclick="cloudLoginFromForm()">Log in</button>
      <button class="ghost small" type="button" onclick="cloudLogout()">Log out</button>
      <button class="ghost small" type="button" onclick="cloudSaveNow()">Save to cloud</button>
      <button class="ghost small" type="button" onclick="cloudLoadNow()">Load from cloud</button>
    </div>
    <p class="hint"><b>Safety:</b> Manual only is safest while testing. Money Nest warns before saving over newer cloud data or loading an older cloud copy over newer local edits. Keep JSON backups as your emergency save file.</p>
  `;
}
window.saveCloudSettingsFromForm = ()=>{
  const old = loadCloudConfig();
  const url = document.getElementById("cloudSupabaseUrl")?.value.trim() || "";
  const key = document.getElementById("cloudSupabaseKey")?.value.trim() || "";
  const mode = document.getElementById("cloudSyncMode")?.value || "manual";
  saveCloudConfig({url, key, mode});
  if(old.url !== url || old.key !== key){ cloudClient = null; cloudUser = null; }
  renderCloudSyncSettings();
  alert(mode === "off" ? "Cloud sync paused." : "Cloud settings saved.");
};
window.toggleCloudKeyVisibility = ()=>{
  const input = document.getElementById("cloudSupabaseKey");
  if(input) input.type = input.type === "password" ? "text" : "password";
};
async function cloudEmailPasswordFromForm(){
  const old = loadCloudConfig();
  const url = document.getElementById("cloudSupabaseUrl")?.value.trim() || "";
  const key = document.getElementById("cloudSupabaseKey")?.value.trim() || "";
  const mode = document.getElementById("cloudSyncMode")?.value || "manual";
  saveCloudConfig({url, key, mode});
  if(old.url !== url || old.key !== key){ cloudClient = null; cloudUser = null; }
  const email = document.getElementById("cloudEmail")?.value.trim();
  const password = document.getElementById("cloudPassword")?.value || "";
  if(!email || !password) throw new Error("Enter your email and password first.");
  return {email, password};
}
window.cloudSignUpFromForm = async()=>{
  try{
    const {email, password} = await cloudEmailPasswordFromForm();
    const client = getCloudClient();
    const {data: authData, error} = await client.auth.signUp({email, password});
    if(error) throw error;
    cloudUser = authData?.user || null;
    await renderCloudSyncSettings();
    alert("Cloud login created. If Supabase asks for email confirmation, check your email before logging in.");
  } catch(err){ alert(`Cloud signup failed: ${err.message || err}`); }
};
window.cloudLoginFromForm = async()=>{
  try{
    const {email, password} = await cloudEmailPasswordFromForm();
    const client = getCloudClient();
    const {data: authData, error} = await client.auth.signInWithPassword({email, password});
    if(error) throw error;
    cloudUser = authData?.user || null;
    await renderCloudSyncSettings();
    alert("Logged in to cloud sync.");
  } catch(err){ alert(`Cloud login failed: ${err.message || err}`); }
};
window.cloudLogout = async()=>{
  try{
    const client = getCloudClient();
    await client.auth.signOut();
    cloudUser = null;
    await renderCloudSyncSettings();
    alert("Logged out of cloud sync.");
  } catch(err){ alert(`Cloud logout failed: ${err.message || err}`); }
};
async function requireCloudUser(){
  const user = await getCloudUser(true);
  if(!user) throw new Error("Log in to cloud sync first.");
  return user;
}
const LOCAL_META_KEY = `${STORAGE_KEY}.localMeta`;
function loadLocalMeta(){
  try{ return JSON.parse(localStorage.getItem(LOCAL_META_KEY) || "{}"); }
  catch(err){ return {}; }
}
function saveLocalMeta(patch={}){
  const next = {...loadLocalMeta(), ...patch};
  try{ localStorage.setItem(LOCAL_META_KEY, JSON.stringify(next)); }
  catch(err){ console.warn("Could not save local Money Nest metadata", err); }
  return next;
}
function touchLocalMoneyNestData(){
  saveLocalMeta({lastLocalChange:new Date().toISOString()});
}
function markCloudSeen(iso){
  if(iso) saveLocalMeta({lastCloudSeen:iso});
}
function isoTimeValue(iso){
  const value = Date.parse(iso || "");
  return Number.isFinite(value) ? value : 0;
}
function newestISO(...values){
  return values.filter(Boolean).sort((a,b)=>isoTimeValue(b)-isoTimeValue(a))[0] || "";
}
function isoIsAfter(a,b){
  return !!a && isoTimeValue(a) > isoTimeValue(b);
}
function latestKnownCloudTimestamp(config=loadCloudConfig()){
  const meta = loadLocalMeta();
  return newestISO(config.lastCloudSave, config.lastCloudLoad, meta.lastCloudSeen);
}
function cloudPayload(){
  // Keep undo history and local-only metadata out of the Supabase data blob.
  return JSON.parse(JSON.stringify(data));
}
async function fetchCloudDataRow(client, user){
  const {data: row, error} = await client.from("money_nest_data").select("data, updated_at").eq("user_id", user.id).maybeSingle();
  if(error) throw error;
  return row;
}
async function confirmCloudOverwriteIfNeeded(client, user, config, {silent=false}={}){
  const row = await fetchCloudDataRow(client, user);
  const knownCloud = latestKnownCloudTimestamp(config);
  if(row?.updated_at && isoIsAfter(row.updated_at, knownCloud)){
    const message = `Cloud data was updated at ${fmtCloudTime(row.updated_at)}, which is newer than this browser last saw (${fmtCloudTime(knownCloud)}). Saving now may overwrite changes from another device. Save to cloud anyway?`;
    if(silent) throw new Error(`Cloud save skipped: the cloud copy is newer (${fmtCloudTime(row.updated_at)}). Load from cloud or save manually after reviewing.`);
    if(!confirm(message)) return false;
  }
  return true;
}
function confirmCloudLoadIfNeeded(row, config){
  const meta = loadLocalMeta();
  const localChange = meta.lastLocalChange || "";
  const knownCloud = latestKnownCloudTimestamp(config);
  let message = `Load cloud data from ${fmtCloudTime(row.updated_at)}? This will replace the data currently in this browser. Export a JSON backup first if you are unsure.`;
  if(localChange && row?.updated_at && isoIsAfter(localChange, row.updated_at)){
    message = `This cloud save looks older than your local edits.

Local edits: ${fmtCloudTime(localChange)}
Cloud save: ${fmtCloudTime(row.updated_at)}

Loading may replace newer local work with older cloud data. Load anyway?`;
  } else if(row?.updated_at && knownCloud && isoIsAfter(knownCloud, row.updated_at)){
    message = `This cloud save looks older than the cloud version this browser last saw.

Last seen cloud: ${fmtCloudTime(knownCloud)}
Selected cloud save: ${fmtCloudTime(row.updated_at)}

Load anyway?`;
  }
  return confirm(message);
}
async function saveDataToCloud({silent=false}={}){
  const config = loadCloudConfig();
  if(config.mode === "off") throw new Error("Cloud sync is paused/off.");
  const user = await requireCloudUser();
  const client = getCloudClient();
  cloudSavingNow = true;
  try{
    const okToSave = await confirmCloudOverwriteIfNeeded(client, user, config, {silent});
    if(!okToSave){ cloudSavingNow = false; return false; }
    const now = new Date().toISOString();
    const {error} = await client.from("money_nest_data").upsert({user_id:user.id, data:cloudPayload(), updated_at:now}, {onConflict:"user_id"});
    if(error) throw error;
    saveCloudConfig({lastCloudSave: now});
    markCloudSeen(now);
    if(!silent){ await renderCloudSyncSettings(); alert("Saved Money Nest data to Supabase."); }
    return true;
  } finally {
    cloudSavingNow = false;
  }
}
window.cloudSaveNow = async()=>{
  try{ await saveDataToCloud(); }
  catch(err){ cloudSavingNow = false; alert(`Cloud save failed: ${err.message || err}`); }
};
window.cloudLoadNow = async()=>{
  try{
    const config = loadCloudConfig();
    if(config.mode === "off") throw new Error("Cloud sync is paused/off.");
    const user = await requireCloudUser();
    const client = getCloudClient();
    const row = await fetchCloudDataRow(client, user);
    if(!row?.data) throw new Error("No cloud backup found yet. Use Save to cloud first.");
    const ok = confirmCloudLoadIfNeeded(row, config);
    if(!ok) return;
    suppressChangeHistory = true;
    data = normalizeData(row.data);
    repairSplitRecurringSeriesData();
    saveImportedBackupData(data);
    suppressChangeHistory = false;
    saveCloudConfig({lastCloudLoad: new Date().toISOString()});
    markCloudSeen(row.updated_at);
    saveLocalMeta({lastLocalChange: row.updated_at || new Date().toISOString()});
    currentView = "dashboard";
    setView("dashboard");
    await renderCloudSyncSettings();
    alert("Loaded Money Nest data from Supabase.");
  } catch(err){ suppressChangeHistory = false; alert(`Cloud load failed: ${err.message || err}`); }
};
function maybeQueueCloudAutoSave(){
  const config = loadCloudConfig();
  if(config.mode !== "auto" || cloudSavingNow) return;
  clearTimeout(cloudAutoSaveTimer);
  cloudAutoSaveTimer = setTimeout(async()=>{
    try{ await saveDataToCloud({silent:true}); }
    catch(err){ console.warn("Auto cloud save failed", err); }
  }, 1500);
}



// v2.80: compatibility shim for browsers that do not expose element IDs as global variables.
(function bindDomIdGlobals(){
  const ids = ['accountDetail', 'accountDetailContent', 'accountList', 'accounts', 'addAccountBtn', 'addBillBtn', 'addBudgetBtn', 'addCategoryBtn', 'addDayTransactionBtn', 'addDebtBtn', 'autoPaycheckHint', 'autoPaycheckLabel', 'backupBtn', 'financialPictureBtn', 'extendedFinancialPictureBtn', 'billAccountFilter', 'billCategoryFilter', 'billRecurrenceFilter', 'billSort', 'billTypeFilter', 'bills', 'billsList', 'budgetList', 'budgetReview', 'bulkEditCategoriesBtn', 'budgets', 'calendar', 'calendarAccountFilter', 'calendarCategoryHighlight', 'calendarCategoryHighlightDropdown', 'calendarCategoryHighlightBtn', 'calendarCategoryHighlightMenu', 'calendarGrid', 'cancelDayModal', 'cancelSimple', 'cancelTxBtn', 'categoryList', 'clearRecentBtn', 'closeDayModal', 'closeModal', 'closeSimple', 'csvExportBtn', 'csvImportInput', 'ctxDelete', 'ctxDuplicate', 'ctxEdit', 'ctxCreateCardPayment', 'ctxMarkReimbursed', 'ctxToggleCleared', 'ctxUseCardInstead', 'dashboard', 'dayModal', 'dayModalSub', 'dayModalTitle', 'dayModalTransactions', 'debtDetail', 'debtDetailContent', 'debtGroups', 'debtSnapshot', 'debts', 'deleteSimpleBtn', 'deleteTxBtn', 'duplicateTxBtn', 'importInput', 'modalTitle', 'monthLabel', 'nextMonth', 'prevMonth', 'quickAddBtn', 'recentPlacesList', 'recentChangesList', 'undoLastChangeBtn', 'clearChangeHistoryBtn', 'recurrenceDetails', 'repeatIntervalUnitLabel', 'safeSpendList', 'saveTxBtn', 'settings', 'settingsClearAllBtn', 'settingsSampleResetBtn', 'simpleFields', 'simpleForm', 'simpleModal', 'simpleTitle', 'summaryCards', 'todayBtn', 'transactionForm', 'transactionModal', 'txAccount', 'txAmount', 'txAutoPaycheck', 'txCategory', 'txContextMenu', 'txDate', 'txDebt', 'txDebtAccount', 'txLoanBreakdownWrap', 'txLoanPrincipal', 'txLoanInterest', 'txLoanFees', 'txLoanBreakdownHint', 'txDeleteAll', 'txDeleteOne', 'txDeleteScopeWrap', 'txId', 'txNotes', 'txRepeatInterval', 'txRepeatIntervalUnit', 'txRepeatOrdinal', 'txRepeatRule', 'txRepeatWeekday', 'txSaveScopeHint', 'txSaveScopeWrap', 'txScopeFuture', 'txScopeOne', 'txStatus', 'txTitle', 'txTransferTo', 'txType', 'txWeekendHandling', 'upcomingList', 'viewTitle', 'settingsPaycheckCount', 'paycheckProfileList', 'makHourlyRate', 'makHoursPerWorkday', 'makDeductionPercent', 'makFixedDeduction', 'tyHourlyRate', 'tyDefaultHours', 'tyDeductionPercent', 'tyFixedDeduction', 'paycheckHoursWrap', 'txPaycheckHoursOverride', 'billCategoryDropdown', 'billCategoryDropdownBtn', 'billCategoryDropdownMenu'];
  ids.forEach(id=>{
    if(!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id)) return;
    try{
      if(!(id in window)){
        Object.defineProperty(window, id, {
          configurable:true,
          get(){ return document.getElementById(id); }
        });
      }
    } catch(err){}
  });
})();


function escapeAttr(v){
  return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch] || ch));
}
function uid(){ return Math.random().toString(36).slice(2,10); }
function money(n){ return (n < 0 ? "-" : "") + "$" + Math.abs(n || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
function jsString(v){ return JSON.stringify(String(v ?? "")); }
function todayISO(){
  // Use the browser's local date, not UTC. toISOString() can roll the app into tomorrow
  // at night for Mountain/Pacific/etc. time zones.
  const d = new Date();
  return toISO(d);
}
function parseDate(s){ return new Date(s + "T12:00:00"); }
function toISO(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 12); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
function monthlyTargetDay(start, cursor){
  // If a monthly recurrence is set for the 29th/30th/31st and that day
  // does not exist in the current month, use the month's last day.
  return Math.min(start.getDate(), endOfMonth(cursor).getDate());
}
function addMonths(date, n){ const d = new Date(date); d.setMonth(d.getMonth()+n); return d; }
function groupBy(arr,key){ return arr.reduce((m,x)=>((m[x[key]] ||= []).push(x),m),{}); }
function sameDay(a,b){ return toISO(a) === toISO(b); }
function addDays(date,n){ const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function daysBetween(a,b){ return Math.floor((parseDate(toISO(b)) - parseDate(toISO(a))) / 86400000); }
function monthDiff(a,b){ return (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()); }
function nthWeekdayOfMonth(year, month, weekday, ordinal){
  if(Number(ordinal) === -1){
    const d = new Date(year, month + 1, 0, 12);
    while(d.getDay() !== Number(weekday)) d.setDate(d.getDate()-1);
    return d;
  }
  const d = new Date(year, month, 1, 12);
  while(d.getDay() !== Number(weekday)) d.setDate(d.getDate()+1);
  d.setDate(d.getDate() + (Number(ordinal)-1)*7);
  return d.getMonth() === month ? d : null;
}
function recurrenceDescription(tx){
  const r = tx.recurrence || (tx.repeat ? {type:"monthly", interval:1} : {type:"none"});
  if(!r || r.type === "none") return "One-time";
  if(r.type === "weekly") return `Every ${r.interval || 1} week(s) on ${weekdayName(r.weekday ?? parseDate(tx.date).getDay())}`;
  if(r.type === "biweekly") return "Every 2 weeks";
  if(r.type === "monthly") return `Monthly on day ${parseDate(tx.date).getDate()} (or last day if shorter month)`;
  if(r.type === "last-day-month") return "Monthly on the last day of the month";
  if(r.type === "yearly") return `Yearly on ${parseDate(tx.date).toLocaleDateString(undefined,{month:"short", day:"numeric"})}`;
  if(r.type === "every-x-days") return `Every ${r.interval || 1} day(s)`;
  if(r.type === "nth-weekday") return `Every ${ordinalName(r.ordinal || 1)} ${weekdayName(r.weekday ?? parseDate(tx.date).getDay())} of the month`;
  return "Repeats";
}
function weekdayName(n){ return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][Number(n)] || "day"; }
function ordinalName(n){ return String(n) === "-1" ? "last" : ({1:"1st",2:"2nd",3:"3rd",4:"4th"}[Number(n)] || `${n}th`); }
function isRecurring(tx){ return tx?.recurrence?.type && tx.recurrence.type !== "none" || tx.repeat; }

const sampleData = {
  "settings": {
    "buffer": 50,
    "importNotes": {
      "source": "CalendarBudgetData (1).csv + debt screenshots",
      "ignoredAccount": "After-Move Budget",
      "irregularRecurringGroupsKeptAsPlannedOccurrences": [
        {
          "title": "Grocery 💳",
          "count": 46
        },
        {
          "title": "Leesa",
          "count": 22
        },
        {
          "title": "Mak to Joint",
          "count": 11
        },
        {
          "title": "AccessOne",
          "count": 12
        },
        {
          "title": "LendingClub",
          "count": 12
        },
        {
          "title": "Mak Paycheck",
          "count": 17
        },
        {
          "title": "Gas",
          "count": 21
        },
        {
          "title": "Mak Car",
          "count": 11
        },
        {
          "title": "AT&T",
          "count": 12
        },
        {
          "title": "StateFarm",
          "count": 12
        },
        {
          "title": "Auto Life Insurance",
          "count": 12
        },
        {
          "title": "ChatGPT Plus",
          "count": 12
        },
        {
          "title": "Dental Insurance",
          "count": 12
        },
        {
          "title": "Apple Music",
          "count": 12
        },
        {
          "title": "Mak to Joint",
          "count": 11
        }
      ]
    },
    "openDebtTypes": [],
    "openDebtCompanies": [],
    "debtTypeLabels": {
      "Credit Card": "Credit Cards",
      "Loan": "Loans",
      "Medical": "Medical",
      "Buy Now, Pay Later": "Buy Now, Pay Later",
      "Klarna": "Buy Now, Pay Later"
    }
  },
  "categories": [
    {
      "id": "banking",
      "name": "Banking",
      "emoji": "↔️",
      "color": "#b28d4a"
    },
    {
      "id": "car",
      "name": "Car",
      "emoji": "🚗",
      "color": "#7c8ea3"
    },
    {
      "id": "credit-card-payment",
      "name": "Credit Card Payment",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "food",
      "name": "Food",
      "emoji": "🍔",
      "color": "#e6a15d"
    },
    {
      "id": "gas",
      "name": "Gas",
      "emoji": "⛽",
      "color": "#7fa2d6"
    },
    {
      "id": "groceries",
      "name": "Groceries",
      "emoji": "🛒",
      "color": "#c9cf52"
    },
    {
      "id": "household",
      "name": "Household",
      "emoji": "🏠",
      "color": "#9c7f63"
    },
    {
      "id": "income",
      "name": "Income",
      "emoji": "💰",
      "color": "#59745a"
    },
    {
      "id": "insurance",
      "name": "Insurance",
      "emoji": "🛡️",
      "color": "#8aa36f"
    },
    {
      "id": "klarna",
      "name": "Klarna",
      "emoji": "🩷",
      "color": "#f09aa5"
    },
    {
      "id": "loan-payment",
      "name": "Loan Payment",
      "emoji": "📄",
      "color": "#d4625b"
    },
    {
      "id": "medical",
      "name": "Medical",
      "emoji": "🩺",
      "color": "#b978d6"
    },
    {
      "id": "phone",
      "name": "Phone",
      "emoji": "📱",
      "color": "#85a7c7"
    },
    {
      "id": "rent",
      "name": "Rent",
      "emoji": "🏡",
      "color": "#b98362"
    },
    {
      "id": "savings",
      "name": "Savings",
      "emoji": "🏦",
      "color": "#4f8b66"
    },
    {
      "id": "subscription",
      "name": "Subscription",
      "emoji": "🔁",
      "color": "#e5d48c"
    },
    {
      "id": "unassigned",
      "name": "Unassigned",
      "emoji": "▫️",
      "color": "#d4c5b4"
    },
    {
      "id": "utilities",
      "name": "Utilities",
      "emoji": "🔌",
      "color": "#6fa6a0"
    }
  ],
  "accounts": [
    {
      "id": "mak-checking",
      "name": "Mak Checking",
      "type": "cash",
      "owner": "Mak",
      "startingBalance": 309.11,
      "paycheckAccount": true,
      "emoji": "💵",
      "color": "#8c6f4d",
      "order": 0
    },
    {
      "id": "ty-checking",
      "name": "Ty Checking",
      "type": "cash",
      "owner": "Ty",
      "startingBalance": 44.57,
      "paycheckAccount": true,
      "emoji": "💵",
      "color": "#8c6f4d",
      "order": 1
    },
    {
      "id": "joint-checking",
      "name": "Joint Checking",
      "type": "cash",
      "owner": "Joint",
      "startingBalance": 179.31,
      "paycheckAccount": false,
      "emoji": "🤝",
      "color": "#8c6f4d",
      "order": 2
    },
    {
      "id": "savings",
      "name": "Savings",
      "type": "cash",
      "owner": "Joint",
      "startingBalance": 0.0,
      "paycheckAccount": false,
      "emoji": "🌱",
      "color": "#218f50",
      "order": 3,
      "goalName": "",
      "goalAmount": 0
    }
  ],
  "debts": [
    {
      "id": "klarna-amazon",
      "type": "Buy Now, Pay Later",
      "company": "Klarna",
      "name": "Amazon Klarna",
      "owner": "Mak",
      "balance": 165.7,
      "apr": 0,
      "limit": null,
      "minDue": 55.23,
      "dueDate": "2026-06-11",
      "order": 0
    },
    {
      "id": "klarna-ring",
      "type": "Buy Now, Pay Later",
      "company": "Klarna",
      "name": "Ring Klarna",
      "owner": "Ty",
      "balance": 46.88,
      "apr": 0,
      "limit": null,
      "minDue": 46.88,
      "dueDate": "2026-06-11",
      "order": 1
    },
    {
      "id": "klarna-ulta",
      "type": "Buy Now, Pay Later",
      "company": "Klarna",
      "name": "Ulta Klarna",
      "owner": "Mak",
      "balance": 89.67,
      "apr": 0,
      "limit": null,
      "minDue": 52.06,
      "dueDate": "2026-06-06",
      "order": 2
    },
    {
      "id": "ty-avant5286",
      "type": "Credit Card",
      "company": "Avant",
      "name": "Ty Avant5286",
      "owner": "Ty",
      "balance": 371.16,
      "apr": 35.99,
      "limit": 1000.0,
      "dueDate": "2026-06-01",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-05",
      "statementBalance": 396.16,
      "order": 3,
      "manualExtra": 0.0,
      "notes": "$25 every 1st",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-quicksilver6597",
      "type": "Credit Card",
      "company": "Capital One",
      "name": "Mak Quicksilver6597",
      "owner": "Mak",
      "balance": 116.52,
      "apr": 30.24,
      "limit": 800.0,
      "dueDate": "2026-06-02",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-08",
      "statementBalance": 141.52,
      "order": 4,
      "manualExtra": 0.0,
      "notes": "$35 every 2nd",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-quicksilver9246",
      "type": "Credit Card",
      "company": "Capital One",
      "name": "Mak Quicksilver9246",
      "owner": "Mak",
      "balance": 237.6,
      "apr": 28.24,
      "limit": 500.0,
      "dueDate": "2026-06-02",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-08",
      "statementBalance": 82.6,
      "order": 5,
      "manualExtra": 0.0,
      "notes": "$35 every 2nd",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-savor9707",
      "type": "Credit Card",
      "company": "Capital One",
      "name": "Mak Savor9707",
      "owner": "Mak",
      "balance": 0.0,
      "apr": 28.24,
      "limit": 300.0,
      "dueDate": "2026-06-14",
      "minDue": 21.73,
      "paymentStatus": "paid",
      "statementDate": "2026-05-20",
      "statementBalance": 21.73,
      "order": 6,
      "manualExtra": 0.0,
      "notes": "",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-playstation6229",
      "type": "Credit Card",
      "company": "PlayStation",
      "name": "Ty PlayStation6229",
      "owner": "Ty",
      "balance": 2613.6,
      "apr": 28.49,
      "limit": 3950.0,
      "dueDate": "2026-06-07",
      "minDue": 30.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-13",
      "statementBalance": 1486.92,
      "order": 7,
      "manualExtra": 0.0,
      "notes": "$50 every 7th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-quicksilver4899",
      "type": "Credit Card",
      "company": "Capital One",
      "name": "Ty Quicksilver4899",
      "owner": "Ty",
      "balance": 125.93,
      "apr": 28.24,
      "limit": 300.0,
      "dueDate": "2026-06-02",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-07",
      "statementBalance": 134.3,
      "order": 8,
      "manualExtra": 15.0,
      "notes": "$35 every 2nd",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-quicksilver5070",
      "type": "Credit Card",
      "company": "Capital One",
      "name": "Ty Quicksilver5070",
      "owner": "Ty",
      "balance": 285.17,
      "apr": 28.24,
      "limit": 300.0,
      "dueDate": "2026-06-09",
      "minDue": 28.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-15",
      "statementBalance": 83.7,
      "order": 9,
      "manualExtra": 0.0,
      "notes": "$35 every 9th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-clarity3384",
      "type": "Credit Card",
      "company": "Clarity",
      "name": "Ty Clarity3384",
      "owner": "Ty",
      "balance": 976.84,
      "apr": 13.5,
      "limit": 1000.0,
      "dueDate": "2026-05-28",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-04-30",
      "statementBalance": 987.88,
      "order": 10,
      "manualExtra": 0.0,
      "notes": "$25 every 28th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-creditone2367",
      "type": "Credit Card",
      "company": "CreditOne",
      "name": "Ty CreditOne2367",
      "owner": "Ty",
      "balance": 1031.98,
      "apr": 29.74,
      "limit": 3000.0,
      "dueDate": "2026-06-14",
      "minDue": 48.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-18",
      "statementBalance": 948.99,
      "order": 11,
      "manualExtra": 0.0,
      "notes": "$50 every 14th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "ty-creditone5247",
      "type": "Credit Card",
      "company": "CreditOne",
      "name": "Ty CreditOne5247",
      "owner": "Ty",
      "balance": 493.34,
      "apr": 27.49,
      "limit": 1050.0,
      "dueDate": "2026-06-14",
      "minDue": 30.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-18",
      "statementBalance": 493.34,
      "order": 12,
      "manualExtra": 0.0,
      "notes": "$35 every 14th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-discover8627",
      "type": "Credit Card",
      "company": "Discover",
      "name": "Mak Discover8627",
      "owner": "Mak",
      "balance": 354.74,
      "apr": 26.49,
      "limit": 500.0,
      "dueDate": "2026-06-13",
      "minDue": 0.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-04-17",
      "statementBalance": 0.0,
      "order": 13,
      "manualExtra": 0.0,
      "notes": "$30 every 13th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "les-schwab100962814",
      "type": "Credit Card",
      "company": "Les Schwab",
      "name": "Les Schwab100962814",
      "owner": "Mak",
      "balance": 655.2,
      "apr": 18.0,
      "limit": 2450.0,
      "dueDate": "2026-06-15",
      "minDue": 25.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-31",
      "statementBalance": 191.97,
      "order": 14,
      "manualExtra": 0.0,
      "notes": "$100 every 15th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-macu5979",
      "type": "Credit Card",
      "company": "MACU",
      "name": "Mak MACU5979",
      "owner": "Mak",
      "balance": 1446.22,
      "apr": 15.49,
      "limit": 1500.0,
      "dueDate": "2026-06-30",
      "minDue": 36.0,
      "paymentStatus": "autopay",
      "statementDate": "2026-05-31",
      "statementBalance": 958.91,
      "order": 15,
      "manualExtra": 0.0,
      "notes": "$50 every 15th",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "one-pay-walmart",
      "type": "Credit Card",
      "company": "One Pay",
      "name": "One Pay (Walmart)",
      "owner": "Mak",
      "balance": 0.0,
      "apr": 30.74,
      "limit": 500.0,
      "dueDate": "2026-05-28",
      "minDue": 30.0,
      "paymentStatus": "paid",
      "statementDate": "2026-05-05",
      "statementBalance": 184.6,
      "order": 16,
      "manualExtra": 0.0,
      "notes": "",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "target9751",
      "type": "Credit Card",
      "company": "Target",
      "name": "Target9751",
      "owner": "Ty",
      "balance": 0.0,
      "apr": 26.4,
      "limit": 300.0,
      "dueDate": "2026-06-10",
      "minDue": 29.0,
      "paymentStatus": "paid",
      "statementDate": "2026-05-13",
      "statementBalance": 37.05,
      "order": 17,
      "manualExtra": 0.0,
      "notes": "",
      "emoji": "💳",
      "color": "#e36b5d"
    },
    {
      "id": "mak-auto-loan",
      "type": "Loan",
      "company": "Auto Loan",
      "name": "Mak Auto Loan",
      "owner": "Mak",
      "balance": 6463.64,
      "apr": 8.74,
      "limit": null,
      "minDue": 222.0,
      "dueDate": "2026-06-22",
      "order": 18,
      "startingBalance": 9360.5,
      "manualExtra": 0,
      "totalMonthlyPayment": 222.0,
      "monthsToPayoffStarting": 50.6,
      "monthsToPayoffCurrent": 32.8,
      "payoffDate": "2029-03",
      "emoji": "🚗",
      "color": "#5469b8"
    },
    {
      "id": "ty-auto-loan",
      "type": "Loan",
      "company": "Auto Loan",
      "name": "Ty Auto Loan",
      "owner": "Ty",
      "balance": 11780.0,
      "apr": 6.74,
      "limit": null,
      "minDue": 276.0,
      "dueDate": "2026-06-03",
      "order": 19,
      "startingBalance": 15161.64,
      "manualExtra": 0,
      "totalMonthlyPayment": 276.0,
      "monthsToPayoffStarting": 65.9,
      "monthsToPayoffCurrent": 48.9,
      "payoffDate": "2030-07",
      "emoji": "🚗",
      "color": "#5469b8"
    },
    {
      "id": "lendingclub",
      "type": "Loan",
      "company": "LendingClub",
      "name": "LendingClub",
      "owner": "Joint",
      "balance": 5461.73,
      "apr": 18.49,
      "limit": null,
      "minDue": 391.26,
      "dueDate": "2026-06-11",
      "order": 20,
      "startingBalance": 7800.0,
      "manualExtra": 0,
      "totalMonthlyPayment": 391.26,
      "monthsToPayoffStarting": 24.0,
      "monthsToPayoffCurrent": 15.8,
      "payoffDate": "2027-10",
      "emoji": "📄",
      "color": "#8c6f4d"
    },
    {
      "id": "mak-accessone",
      "type": "Medical",
      "company": "AccessOne",
      "name": "Mak AccessOne",
      "owner": "Mak",
      "balance": 6075.58,
      "apr": 0.0,
      "limit": null,
      "minDue": 216.99,
      "emoji": "🩺",
      "color": "#8936ff",
      "dueDate": "2026-06-10",
      "order": 21,
      "startingBalance": 7811.5,
      "manualExtra": 0,
      "totalMonthlyPayment": 216.99,
      "monthsToPayoffStarting": 36.0,
      "monthsToPayoffCurrent": 28.0,
      "payoffDate": "2028-10"
    },
    {
      "id": "west-valley-medical-center",
      "type": "Medical",
      "company": "West Valley Medical Center",
      "name": "West Valley Medical Center",
      "owner": "Mak",
      "balance": 153.33,
      "apr": 0,
      "limit": null,
      "dueDate": "2026-06-25",
      "minDue": 76.67,
      "paymentStatus": "not-set",
      "statementDate": "",
      "statementBalance": 153.33,
      "emoji": "🩺",
      "color": "#8936ff",
      "order": 22
    }
  ],
  "budgets": [],
  "transactions": [
    {
      "id": "tx-2026-06-01-albertons-joint-checking",
      "title": "Albertons",
      "amount": 9.49,
      "date": "2026-06-01",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "ty-spending",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-01-health-insurance-mak-checking",
      "title": "Health Insurance",
      "amount": 273.04,
      "date": "2026-06-01",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "insurance",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 1st",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-01-mcdonalds-ty-checking",
      "title": "McDonalds",
      "amount": 5.15,
      "date": "2026-06-01",
      "type": "expense",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "food",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-01-shell-joint-checking",
      "title": "Shell",
      "amount": 24.53,
      "date": "2026-06-01",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "food",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-01-storage-joint-checking",
      "title": "Storage",
      "amount": 85.0,
      "date": "2026-06-01",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 1st",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-02-albertsons-ty-checking",
      "title": "Albertsons",
      "amount": 4.01,
      "date": "2026-06-02",
      "type": "expense",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "food",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-02-burlington-joint-checking",
      "title": "Burlington",
      "amount": 37.09,
      "date": "2026-06-02",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "shopping",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-02-from-savings-savings-to-joint",
      "title": "From Savings",
      "amount": 28.1,
      "date": "2026-06-02",
      "type": "transfer",
      "status": "planned",
      "accountId": "savings",
      "transferToAccountId": "joint-checking",
      "categoryId": "transfer",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "",
      "debtAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-02-middleton-smiles-mak-checking",
      "title": "Middleton Smiles",
      "amount": 30.0,
      "date": "2026-06-02",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "medical",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-02-netflix-joint-checking",
      "title": "Netflix",
      "amount": 8.99,
      "date": "2026-06-02",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 2nd",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-02-pokemon-ty-checking",
      "title": "Pokemon",
      "amount": 28.56,
      "date": "2026-06-02",
      "type": "expense",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "shopping",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-02-ty-avant-joint-checking-ty-avant5286",
      "title": "Ty Avant",
      "amount": 25.0,
      "date": "2026-06-02",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-avant5286",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 1st",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-03-ty-car-partial-ty-checking-ty-auto-loan",
      "title": "Ty Car (partial)",
      "amount": 70.0,
      "date": "2026-06-03",
      "type": "transfer",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "loan-payment",
      "linkedDebtId": "ty-auto-loan",
      "recurrence": {
        "type": "weekly",
        "interval": 1,
        "weekday": 3,
        "weekendHandling": "none"
      },
      "notes": "weekly on Wednesdays",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-03-ty-paycheck-ty-checking",
      "title": "Ty Paycheck",
      "amount": 556.84,
      "date": "2026-06-03",
      "type": "paycheck",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "paycheck",
      "recurrence": {
        "type": "weekly",
        "interval": 1,
        "weekday": 3,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "weekly on Wednesdays",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-03-ty-to-joint-ty-checking-joint",
      "title": "Ty to Joint",
      "amount": 400.0,
      "date": "2026-06-03",
      "type": "transfer",
      "status": "planned",
      "accountId": "ty-checking",
      "transferToAccountId": "joint-checking",
      "categoryId": "transfer",
      "recurrence": {
        "type": "weekly",
        "interval": 1,
        "weekday": 3,
        "weekendHandling": "none"
      },
      "notes": "weekly on Wednesdays",
      "debtAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-04-internet-joint-checking",
      "title": "Internet",
      "amount": 135.84,
      "date": "2026-06-04",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 4th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-05-leesa-joint-checking",
      "title": "Leesa",
      "amount": 460.0,
      "date": "2026-06-05",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "rent",
      "recurrence": {
        "type": "monthly",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "autoMakPaycheck": false,
      "notes": "7th & 22nd, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-06-ulta-5-6-mak-checking-klarna-ulta",
      "title": "Ulta (5/6)",
      "amount": 52.06,
      "date": "2026-06-06",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-ulta",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due August 22",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-07-gas-mak-checking",
      "title": "Gas",
      "amount": 150.0,
      "date": "2026-06-07",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "gas",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 7th, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-07-grocery-joint-checking",
      "title": "Grocery",
      "amount": 150.0,
      "date": "2026-06-07",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "groceries",
      "recurrence": {
        "type": "weekly",
        "interval": 1,
        "weekday": 0,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "weekly on Sunday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-07-mak-paycheck-mak-checking",
      "title": "Mak Paycheck",
      "amount": 1560,
      "date": "2026-06-07",
      "type": "paycheck",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "paycheck",
      "recurrence": {
        "type": "monthly",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "autoMakPaycheck": true,
      "notes": "monthly on the 7th, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-07-mak-to-joint-mak-checking-joint",
      "title": "Mak to Joint",
      "amount": 1100.0,
      "date": "2026-06-07",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "transferToAccountId": "joint-checking",
      "categoryId": "transfer",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "notes": "monthly on the 7th, move weekend to Friday",
      "debtAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-07-oakley-kibble-joint-checking",
      "title": "Oakley Kibble",
      "amount": 40.0,
      "date": "2026-06-07",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "groceries",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekday": 0,
        "ordinal": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly, on the first Sunday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-07-ty-playstation-card-joint-checking-ty-playstation62",
      "title": "Ty Playstation Card",
      "amount": 50.0,
      "date": "2026-06-07",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-playstation6229",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 7th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-08-amazon-prime-joint-checking",
      "title": "Amazon Prime",
      "amount": 15.89,
      "date": "2026-06-08",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 8th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-09-audible-mak-checking",
      "title": "Audible",
      "amount": 15.85,
      "date": "2026-06-09",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 9th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-09-ty-quicksilver5070-joint-checking-ty-quicksilver507",
      "title": "Ty Quicksilver5070",
      "amount": 35.0,
      "date": "2026-06-09",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-quicksilver5070",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 9th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-10-accessone-mak-checking-mak-accessone",
      "title": "AccessOne",
      "amount": 216.99,
      "date": "2026-06-10",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "medical",
      "linkedDebtId": "mak-accessone",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 10th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-10-gas-ty-checking",
      "title": "Gas",
      "amount": 55.0,
      "date": "2026-06-10",
      "type": "expense",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "gas",
      "recurrence": {
        "type": "weekly",
        "interval": 1,
        "weekday": 3,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "weekly on Wednesdays",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-11-amazon-2-4-joint-checking-klarna-amazon",
      "title": "Amazon (2/4)",
      "amount": 55.23,
      "date": "2026-06-11",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-amazon",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due June 14",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-11-lendingclub-joint-checking-lendingclub",
      "title": "LendingClub",
      "amount": 391.26,
      "date": "2026-06-11",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "loan-payment",
      "linkedDebtId": "lendingclub",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 11th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-11-ring-3-3-ty-checking-klarna-ring",
      "title": "Ring (3/3)",
      "amount": 46.88,
      "date": "2026-06-11",
      "type": "transfer",
      "status": "planned",
      "accountId": "ty-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-ring",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due july 4",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-13-mak-discover8627-joint-checking-mak-discover8627",
      "title": "Mak Discover8627",
      "amount": 30.0,
      "date": "2026-06-13",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "mak-discover8627",
      "recurrence": {
        "type": "monthly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "$30 every 13th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-14-ticktick-mak-checking",
      "title": "TickTick",
      "amount": 4.03,
      "date": "2026-06-14",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 14th. $4.03",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-14-ty-creditone2367-joint-checking-ty-creditone2367",
      "title": "Ty CreditOne2367",
      "amount": 50.0,
      "date": "2026-06-14",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-creditone2367",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 14th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-14-ty-creditone5247-joint-checking-ty-creditone5247",
      "title": "Ty CreditOne5247",
      "amount": 35.0,
      "date": "2026-06-14",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-creditone5247",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 14th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-14-xbox-game-pass-joint-checking",
      "title": "Xbox Game Pass",
      "amount": 31.79,
      "date": "2026-06-14",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 14th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-15-les-schwab-joint-checking-les-schwab100962814",
      "title": "Les Schwab",
      "amount": 100.0,
      "date": "2026-06-15",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "car",
      "linkedDebtId": "les-schwab100962814",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 15th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-15-mak-macu-card-joint-checking-mak-macu5979",
      "title": "Mak MACU Card",
      "amount": 50.0,
      "date": "2026-06-15",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "mak-macu5979",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 15th, due the 15th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-16-walmart-joint-checking",
      "title": "Walmart+",
      "amount": 6.47,
      "date": "2026-06-16",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 16th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-16-youtube-premium-mak-checking",
      "title": "YouTube Premium",
      "amount": 8.99,
      "date": "2026-06-16",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 16th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-17-mak-planet-fitness-joint-checking",
      "title": "Mak Planet Fitness",
      "amount": 21.23,
      "date": "2026-06-17",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 17th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-17-mak-planet-fitness-annual-fee-joint-checking",
      "title": "Mak Planet Fitness Annual Fee",
      "amount": 51.94,
      "date": "2026-06-17",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-17-ty-planet-fitness-joint-checking",
      "title": "Ty Planet Fitness",
      "amount": 26.25,
      "date": "2026-06-17",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 17th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-18-kindle-unlimited-mak-checking",
      "title": "Kindle Unlimited",
      "amount": 12.71,
      "date": "2026-06-18",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 18th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-22-gas-mak-checking",
      "title": "Gas",
      "amount": 150.0,
      "date": "2026-06-22",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "gas",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 22nd, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-22-leesa-joint-checking-second",
      "title": "Leesa",
      "amount": 460.0,
      "date": "2026-06-22",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "rent",
      "recurrence": {
        "type": "monthly",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "notes": "Second monthly rent payment from 7th & 22nd rule",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-06-22-mak-car-mak-checking-mak-auto-loan",
      "title": "Mak Car",
      "amount": 225.0,
      "date": "2026-06-22",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "loan-payment",
      "linkedDebtId": "mak-auto-loan",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "notes": "monthly on the 22nd, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-22-mak-paycheck-mak-checking",
      "title": "Mak Paycheck",
      "amount": 1700,
      "date": "2026-06-22",
      "type": "paycheck",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "paycheck",
      "recurrence": {
        "type": "monthly",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "autoMakPaycheck": true,
      "notes": "monthly on the 22nd, move weekend to Friday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-22-mak-to-joint-mak-checking-joint",
      "title": "Mak to Joint",
      "amount": 700.0,
      "date": "2026-06-22",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "transferToAccountId": "joint-checking",
      "categoryId": "transfer",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "previous-friday"
      },
      "notes": "monthly on the 22nd, move weekend to Friday",
      "debtAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-24-nexus-mods-mak-checking",
      "title": "Nexus Mods",
      "amount": 8.99,
      "date": "2026-06-24",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 24th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-24-ulta-6-6-mak-checking-klarna-ulta",
      "title": "Ulta (6/6)",
      "amount": 37.61,
      "date": "2026-06-24",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-ulta",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due September 22",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-24-icloud-mak-checking",
      "title": "iCloud+",
      "amount": 2.99,
      "date": "2026-06-24",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 24th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-25-at-t-joint-checking",
      "title": "AT&T",
      "amount": 195.02,
      "date": "2026-06-25",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "phone",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 25th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-25-amazon-subscribe-save-mak-checking",
      "title": "Amazon Subscribe & Save",
      "amount": 50.0,
      "date": "2026-06-25",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "household",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 25th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-25-amazon-subscribe-save-joint-checking",
      "title": "Amazon Subscribe & Save",
      "amount": 36.87,
      "date": "2026-06-25",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "household",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-25-auto-life-insurance-mak-checking",
      "title": "Auto Life Insurance",
      "amount": 15.4,
      "date": "2026-06-25",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "insurance",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "next-monday"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 25th, move weekend to Monday",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-25-statefarm-joint-checking",
      "title": "StateFarm",
      "amount": 300.97,
      "date": "2026-06-25",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "insurance",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 25th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-25-west-valley-medical-center-2-3-mak-checking-west-va",
      "title": "West Valley Medical Center (2/3)",
      "amount": 76.67,
      "date": "2026-06-25",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "medical",
      "linkedDebtId": "west-valley-medical-center",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-26-my-bee-balm-mak-checking",
      "title": "My Bee Balm",
      "amount": 10.0,
      "date": "2026-06-26",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 26th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-06-28-ty-clarity-card-joint-checking-ty-clarity3384",
      "title": "Ty Clarity Card",
      "amount": 25.0,
      "date": "2026-06-28",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-clarity3384",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 28th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-06-29-chatgpt-plus-mak-checking",
      "title": "ChatGPT Plus",
      "amount": 20.0,
      "date": "2026-06-29",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 29th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-29-dental-insurance-mak-checking",
      "title": "Dental Insurance",
      "amount": 38.27,
      "date": "2026-06-29",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "insurance",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 29th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-06-30-apple-music-mak-checking",
      "title": "Apple Music",
      "amount": 16.99,
      "date": "2026-06-30",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "monthly on the 30th",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "debtpay-2026-07-02-mak-quicksilver6597-joint-checking-mak-quicksilver6",
      "title": "Mak Quicksilver6597",
      "amount": 35.0,
      "date": "2026-07-02",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "mak-quicksilver6597",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 2nd",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-07-02-mak-quicksilver9246-joint-checking-mak-quicksilver9",
      "title": "Mak Quicksilver9246",
      "amount": 35.0,
      "date": "2026-07-02",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "mak-quicksilver9246",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 2nd",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-07-02-ty-quicksilver4899-joint-checking-ty-quicksilver489",
      "title": "Ty Quicksilver4899",
      "amount": 35.0,
      "date": "2026-07-02",
      "type": "transfer",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "credit-card-payment",
      "linkedDebtId": "ty-quicksilver4899",
      "recurrence": {
        "type": "nth-weekday",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "monthly on the 2nd",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-07-08-amazon-3-4-mak-checking-klarna-amazon",
      "title": "Amazon (3/4)",
      "amount": 55.23,
      "date": "2026-07-08",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-amazon",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due July 14",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-07-23-amazon-4-4-mak-checking-klarna-amazon",
      "title": "Amazon (4/4)",
      "amount": 55.24,
      "date": "2026-07-23",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "klarna",
      "linkedDebtId": "klarna-amazon",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "due August 14",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "debtpay-2026-07-25-west-valley-medical-center-3-3-mak-checking-west-va",
      "title": "West Valley Medical Center (3/3)",
      "amount": 76.66,
      "date": "2026-07-25",
      "type": "transfer",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "medical",
      "linkedDebtId": "west-valley-medical-center",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "weekendHandling": "none"
      },
      "notes": "",
      "debtAccountId": "",
      "transferToAccountId": "",
      "repeat": false,
      "dateOverrides": {},
      "autoMakPaycheck": false
    },
    {
      "id": "tx-2026-09-20-calenderbudget-mak-checking",
      "title": "CalenderBudget",
      "amount": 64.99,
      "date": "2026-09-20",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-09-22-aarp-membership-joint-checking",
      "title": "AARP Membership",
      "amount": 20.0,
      "date": "2026-09-22",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2026-11-02-ty-planet-fitness-annual-fee-joint-checking",
      "title": "Ty Planet Fitness Annual Fee",
      "amount": 51.94,
      "date": "2026-11-02",
      "type": "expense",
      "status": "planned",
      "accountId": "joint-checking",
      "categoryId": "utilities",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2027-02-13-bearable-mak-checking",
      "title": "Bearable",
      "amount": 34.99,
      "date": "2027-02-13",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    },
    {
      "id": "tx-2027-04-17-dynamic-lyrics-mak-checking",
      "title": "Dynamic Lyrics",
      "amount": 4.99,
      "date": "2027-04-17",
      "type": "expense",
      "status": "planned",
      "accountId": "mak-checking",
      "categoryId": "subscription",
      "recurrence": {
        "type": "yearly",
        "interval": 1,
        "weekendHandling": "none"
      },
      "autoMakPaycheck": false,
      "notes": "annual",
      "debtAccountId": "",
      "transferToAccountId": "",
      "linkedDebtId": "",
      "repeat": false,
      "dateOverrides": {}
    }
  ]
};

let data;
const CHANGE_HISTORY_KEY = `${STORAGE_KEY}.changeHistory`;
let suppressChangeHistory = false;
let currentView = "dashboard";
let selectedAccountId = null;
let selectedDebtId = null;
let accountDetailSortInitialized = false;
let ledgerFiltersOpen = false;
let accountReorderMode = false;

const defaultUiPrefs = {
  calendarFilter: "all",
  calendarHighlightCategories: ["all"],
  billFilters: { account:"all", categories:["all"], type:"all", recurrence:"all", sort:"date" },
  transactionFilters: { status:"all", category:"all", type:"all", sort:"date-asc", dateRange:"upcoming-90", search:"" },
  transactionFilterDefaults: { status:"all", category:"all", type:"all", sort:"date-asc", dateRange:"upcoming-90" },
  accountDetailMode: "bank",
  accountForecastRange: "next-90",
  accountForecastCustomStart: "",
  accountForecastCustomEnd: "",
  calendarDensity: "comfortable"
};
const allowedAccountForecastRanges = new Set(["this-month", "next-paycheck", "next-30", "next-60", "next-90", "custom"]);
function cleanAccountForecastRange(range){
  if(range === "today-forward") return "next-90";
  return allowedAccountForecastRanges.has(range) ? range : "next-90";
}
function cloneUiPrefs(obj){ return JSON.parse(JSON.stringify(obj)); }
function loadUiPrefs(){
  try{
    const saved = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || "{}");
    const prefs = cloneUiPrefs(defaultUiPrefs);
    if(saved.calendarFilter) prefs.calendarFilter = saved.calendarFilter;
    if(Array.isArray(saved.calendarHighlightCategories) && saved.calendarHighlightCategories.length) prefs.calendarHighlightCategories = saved.calendarHighlightCategories;
    if(saved.billFilters) prefs.billFilters = {...prefs.billFilters, ...saved.billFilters};
    if(Array.isArray(saved.billFilters?.categories)) prefs.billFilters.categories = saved.billFilters.categories;
    if(saved.transactionFilters) prefs.transactionFilters = {...prefs.transactionFilters, ...saved.transactionFilters};
    if(saved.transactionFilterDefaults) prefs.transactionFilterDefaults = {...prefs.transactionFilterDefaults, ...saved.transactionFilterDefaults};
    if(saved.accountDetailMode) prefs.accountDetailMode = saved.accountDetailMode;
    if(saved.accountForecastRange) prefs.accountForecastRange = cleanAccountForecastRange(saved.accountForecastRange);
    if(saved.accountForecastCustomStart) prefs.accountForecastCustomStart = saved.accountForecastCustomStart;
    if(saved.accountForecastCustomEnd) prefs.accountForecastCustomEnd = saved.accountForecastCustomEnd;
    if(["compact","comfortable","detailed"].includes(saved.calendarDensity)) prefs.calendarDensity = saved.calendarDensity;
    return prefs;
  } catch(err){
    console.warn("Could not load Money Nest UI preferences", err);
    return cloneUiPrefs(defaultUiPrefs);
  }
}
function saveUiPrefs(){
  try{
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      calendarFilter,
      calendarHighlightCategories,
      billFilters,
      transactionFilters: {...transactionFilters, search:""},
      transactionFilterDefaults,
      accountDetailMode,
      accountForecastRange,
      accountForecastCustomStart,
      accountForecastCustomEnd,
      calendarDensity
    }));
  } catch(err){
    console.warn("Could not save Money Nest UI preferences", err);
  }
}
const uiPrefs = loadUiPrefs();
let accountDetailMode = uiPrefs.accountDetailMode || "bank";
let accountForecastRange = cleanAccountForecastRange(uiPrefs.accountForecastRange || "next-90");
let accountForecastCustomStart = uiPrefs.accountForecastCustomStart || "";
let accountForecastCustomEnd = uiPrefs.accountForecastCustomEnd || "";
let accountBackTarget = "accounts";
let selectedDayISO = null;
let calendarDate = parseDate(todayISO());
let calendarFilter = uiPrefs.calendarFilter || "all";
let calendarHighlightCategories = Array.isArray(uiPrefs.calendarHighlightCategories) ? uiPrefs.calendarHighlightCategories : ["all"];
let recentPlaces = [];
let suppressRecentTracking = false;
loadRecentPlaces();
let billFilters = {...defaultUiPrefs.billFilters, ...(uiPrefs.billFilters || {})};
if(!Array.isArray(billFilters.categories)) billFilters.categories = [billFilters.category || "all"];
let transactionFilterDefaults = {...defaultUiPrefs.transactionFilterDefaults, ...(uiPrefs.transactionFilterDefaults || {})};
let transactionFilters = {...defaultUiPrefs.transactionFilters, ...(uiPrefs.transactionFilters || {})};
let calendarDensity = "comfortable";
let budgetReviewMonth = todayISO().slice(0,7);
let budgetReviewAccountIds = [];
let budgetReviewIncludeRecurringBills = true;
let budgetReviewMode = "all";


function standardCategories(){
  return [
    {id:"income", name:"Income", emoji:"💰", color:"#31d136"},
    {id:"paycheck", name:"Paycheck", emoji:"💵", color:"#19b51f"},
    {id:"transfer", name:"Transfer", emoji:"↔️", color:"#b28d4a"},
    {id:"unassigned", name:"Unassigned", emoji:"▫️", color:"#111111"},
    {id:"banking", name:"Banking", emoji:"🏦", color:"#9b9b9b"},
    {id:"car", name:"Car", emoji:"🚗", color:"#5469b8"},
    {id:"credit-card-payment", name:"Credit Card Payment", emoji:"💳", color:"#ff1717"},
    {id:"entertainment", name:"Entertainment", emoji:"🎬", color:"#f0bc12"},
    {id:"food", name:"Food", emoji:"🍔", color:"#fff86a"},
    {id:"gas", name:"Gas", emoji:"⛽", color:"#6f99e8"},
    {id:"gifts", name:"Gifts", emoji:"🎁", color:"#b59b3b"},
    {id:"groceries", name:"Groceries", emoji:"🛒", color:"#e4f227"},
    {id:"household", name:"Household", emoji:"🏠", color:"#efe6a8"},
    {id:"insurance", name:"Insurance", emoji:"🛡️", color:"#12a9e6"},
    {id:"klarna", name:"Klarna", emoji:"💗", color:"#f6a7b8"},
    {id:"loan-payment", name:"Loan Payment", emoji:"📄", color:"#ee6d6d"},
    {id:"mak-spending", name:"Mak Spending", emoji:"🛍️", color:"#ffa94d"},
    {id:"medical", name:"Medical", emoji:"🩺", color:"#8936ff"},
    {id:"new-house", name:"New House", emoji:"🏡", color:"#ec14d4"},
    {id:"phone", name:"Phone", emoji:"📱", color:"#1246ff"},
    {id:"rent", name:"Rent", emoji:"🏘️", color:"#2d21ef"},
    {id:"savings", name:"Savings", emoji:"🌱", color:"#218f50"},
    {id:"shopping", name:"Shopping", emoji:"🛒", color:"#ffd1a1"},
    {id:"subscription", name:"Subscription", emoji:"🔁", color:"#f2de83"},
    {id:"ty-spending", name:"Ty Spending", emoji:"🧢", color:"#c59427"},
    {id:"utilities", name:"Utilities", emoji:"💡", color:"#4f77c8"}
  ];
}


// v2-216: app-wide color palettes with stable category roles and optional overrides.
const MONEY_NEST_PALETTES = {
  legacy:{name:"Original", app:{bg:"#f5efe6",panel:"#fffaf3",panel2:"#f1e3d0",ink:"#2e2a24",muted:"#766b5d",line:"#dfd0bd",accent:"#8c6f4d",accent2:"#b7835a"},roles:{light1:"#f4d9b8",light2:"#d9e6b8",medium1:"#91b8b3",medium2:"#8fa7cf",dark1:"#c97755",dark2:"#805c8f",accent1:"#d5ad3f",accent2:"#6b8d59"}},
  rose:{name:"Pink & purple", app:{bg:"#fff1f7",panel:"#fff9fc",panel2:"#f5dceb",ink:"#3b2534",muted:"#806174",line:"#edc7db",accent:"#a84f7e",accent2:"#8660ad"},roles:{light1:"#f9dce8",light2:"#ead9f7",medium1:"#efa7c5",medium2:"#c6a0e8",dark1:"#d45f91",dark2:"#8252a8",accent1:"#f08aae",accent2:"#68408f"}},
  red:{name:"Red, orange & gold", app:{bg:"#fff3ee",panel:"#fffaf7",panel2:"#f9dfd3",ink:"#412820",muted:"#82665b",line:"#eccbbd",accent:"#b84d3f",accent2:"#d47a2f"},roles:{light1:"#f8ddd2",light2:"#f7e7b8",medium1:"#f4a37f",medium2:"#e9b64f",dark1:"#d75b48",dark2:"#a83d32",accent1:"#ee7f38",accent2:"#bd7b20"}},
  blue:{name:"Blue, teal & indigo", app:{bg:"#eef6fb",panel:"#f8fcff",panel2:"#dcecf4",ink:"#223442",muted:"#607687",line:"#c5dce8",accent:"#397ca3",accent2:"#4474b8"},roles:{light1:"#d9edf8",light2:"#d4f0ed",medium1:"#83c5d8",medium2:"#7da9e6",dark1:"#347fa5",dark2:"#465aa8",accent1:"#45a7a2",accent2:"#2e4f86"}},
  green:{name:"Green, teal & yellow", app:{bg:"#f1f7ef",panel:"#fbfdf9",panel2:"#e1edd8",ink:"#29382a",muted:"#667766",line:"#cadcc5",accent:"#5d8659",accent2:"#4f9a85"},roles:{light1:"#e3efd6",light2:"#f1edbd",medium1:"#a8cf8d",medium2:"#83c9b2",dark1:"#5d9458",dark2:"#397767",accent1:"#c5b843",accent2:"#2f6047"}},
  purple:{name:"Purple, blue & berry", app:{bg:"#f6f1fb",panel:"#fcf9ff",panel2:"#e9ddf3",ink:"#35283e",muted:"#78677f",line:"#ddcae9",accent:"#76558f",accent2:"#795ea8"},roles:{light1:"#eadcf3",light2:"#dce4fa",medium1:"#c49bd8",medium2:"#8fa9e3",dark1:"#82549a",dark2:"#554d9d",accent1:"#c3619b",accent2:"#49356d"}},
  neutral:{name:"Warm earth tones",app:{bg:"#f5efe6",panel:"#fffaf3",panel2:"#eee0cf",ink:"#2e2a24",muted:"#766b5d",line:"#dfd0bd",accent:"#806548",accent2:"#a46f4c"},roles:{light1:"#eee1d2",light2:"#e3e1bd",medium1:"#c8aa89",medium2:"#a7ad82",dark1:"#a86848",dark2:"#624830",accent1:"#b58b45",accent2:"#6f7650"}}
};
const CATEGORY_PALETTE_ROLES=["light1","light2","medium1","medium2","dark1","dark2","accent1","accent2"];
function defaultCategoryPaletteRole(category={}){
  const id=String(category.id||"").toLowerCase();
  const light1=["rent","utilities","phone","insurance","subscription","household","medical","loan-payment","credit-card-payment"];
  const light2=["groceries","gas","car","savings","klarna"];
  const dark1=["shopping","mak-spending","ty-spending","entertainment","food","gifts"];
  if(light1.includes(id)) return "light1";
  if(light2.includes(id)) return "light2";
  if(dark1.includes(id)) return "dark1";
  if(["income","paycheck"].includes(id)) return "accent1";
  if(["banking","transfer","unassigned"].includes(id)) return "medium1";
  const idx=Math.abs([...id].reduce((n,ch)=>n+ch.charCodeAt(0),0))%CATEGORY_PALETTE_ROLES.length;
  return CATEGORY_PALETTE_ROLES[idx];
}
function normalizePaletteSettings(d){
  d.settings ||= {}; d.settings.appearance ||= {}; d.settings.appearance.paletteRoleLabels ||= {};

  d.settings ||= {};
  d.settings.appearance ||= {};
  const a=d.settings.appearance;
  const originalCustomDefault = JSON.parse(JSON.stringify(MONEY_NEST_PALETTES.legacy));
  originalCustomDefault.name = "Custom";
  // v2-222: Original is now the editable Custom preset. Existing Original selections migrate safely.
  if(!a.paletteId || a.paletteId === "legacy"){
    a.paletteId = "custom";
    a.customPalette = originalCustomDefault;
  }else if(!MONEY_NEST_PALETTES[a.paletteId] && a.paletteId!=="custom"){
    a.paletteId="custom";
    a.customPalette ||= originalCustomDefault;
  }
  // Older builds pre-filled an unused Custom preset with Rose. Replace that hidden default,
  // while preserving a Custom palette the user is actively using or has edited.
  if(!a.customPalette || (a.paletteId!=="custom" && !a.customPaletteOriginalV222)){
    a.customPalette = originalCustomDefault;
  }
  a.customPaletteOriginalV222 = true;
  a.customPalette.name="Custom";
  a.paletteOverrides ||= {};
  (d.categories||[]).forEach(c=>{
    c.legacyColor ||= c.color || "#8c6f4d";
    c.paletteRole ||= defaultCategoryPaletteRole(c);
    c.customColorOverride = c.customColorOverride === true || String(c.customColorOverride).toLowerCase()==="true";
    c.customColor ||= c.customColorOverride ? (c.color||c.legacyColor) : "";
  });
}
function paletteForId(id){
  const a=data?.settings?.appearance||{};
  if(id==="custom") return a.customPalette || {...JSON.parse(JSON.stringify(MONEY_NEST_PALETTES.legacy)),name:"Custom"};
  const base=MONEY_NEST_PALETTES[id]||MONEY_NEST_PALETTES.legacy;
  const override=a.paletteOverrides?.[id];
  if(!override) return base;
  return {name:base.name, app:{...base.app,...(override.app||{})}, roles:{...base.roles,...(override.roles||{})}};
}
function activePalette(){
  const a=data?.settings?.appearance||{};
  return paletteForId(a.paletteId||"custom");
}
function effectiveCategoryColor(c){
  if(!c) return "#8c6f4d";
  if(c.customColorOverride && c.customColor) return c.customColor;
  const a=data?.settings?.appearance||{};
  if((a.paletteId||"legacy")==="legacy" && !a.paletteOverrides?.legacy) return c.legacyColor||c.color||"#8c6f4d";
  return activePalette()?.roles?.[c.paletteRole] || c.legacyColor || c.color || "#8c6f4d";
}
function syncPaletteCategoryColors(){(data.categories||[]).forEach(c=>{c.color=effectiveCategoryColor(c);});}
function applyMoneyNestPalette(){
  if(!data) return;
  normalizePaletteSettings(data); syncPaletteCategoryColors();
  const p=activePalette()||MONEY_NEST_PALETTES.legacy, app=p.app||MONEY_NEST_PALETTES.legacy.app, root=document.documentElement;
  const vars={"--bg":app.bg,"--panel":app.panel,"--panel-2":app.panel2,"--ink":app.ink,"--muted":app.muted,"--line":app.line,"--accent":app.accent,"--accent-2":app.accent2,"--accent-soft":app.panel2};
  Object.entries(vars).forEach(([k,v])=>v&&root.style.setProperty(k,v));
  document.body.style.background=`linear-gradient(135deg, ${app.panel}, ${app.bg})`;
}
const DEFAULT_PALETTE_ROLE_LABELS={light1:"Bills",light2:"Essentials",medium1:"Everyday 1",medium2:"Everyday 2",dark1:"Flexible spending",dark2:"Flexible 2",accent1:"Accent 1",accent2:"Accent 2"};
function paletteRoleLabel(role,paletteId=data?.settings?.appearance?.paletteId){
  const labels=data?.settings?.appearance?.paletteRoleLabels?.[paletteId]||{};
  const name=labels[role]||DEFAULT_PALETTE_ROLE_LABELS[role]||role;
  const slot=({light1:"Light 1",light2:"Light 2",medium1:"Medium 1",medium2:"Medium 2",dark1:"Dark 1",dark2:"Dark 2",accent1:"Accent 1",accent2:"Accent 2"})[role]||role;
  return `${slot} • ${name}`;
}
function renderAppearanceSettings(){
  const el=document.getElementById("appearancePalettePanel"); if(!el)return;
  normalizePaletteSettings(data); const a=data.settings.appearance, p=activePalette();
  const choices=[{id:"custom",name:"Custom"},...Object.entries(MONEY_NEST_PALETTES).filter(([id])=>id!=="legacy").map(([id,x])=>({id,name:x.name}))];
  const selectedName=a.paletteId==="custom"?"Custom":(MONEY_NEST_PALETTES[a.paletteId]?.name||"Custom");
  el.innerHTML=`<div class="palette-choice-grid">${choices.map(x=>{const preview=paletteForId(x.id);return `<button type="button" class="palette-choice ${a.paletteId===x.id?'active':''}" onclick="selectMoneyNestPalette('${x.id}')"><span class="palette-swatches">${CATEGORY_PALETTE_ROLES.map(r=>`<i style="background:${preview?.roles?.[r]||'#ddd'}"></i>`).join('')}</span><b>${x.name}</b>${a.paletteOverrides?.[x.id]?'<small>Adjusted</small>':''}</button>`}).join('')}</div>
  <p class="hint">Each preset uses a broader family of coordinated colors, while category roles preserve the difference between bills, essentials, flexible spending, and accents.</p>
  <div class="palette-editor-head"><div><b>Adjust ${selectedName}</b><small>Changes are saved with this preset and included in JSON/cloud backups.</small></div></div>
  <div class="custom-palette-grid">${CATEGORY_PALETTE_ROLES.map(r=>`<label class="palette-role-editor"><span class="palette-slot-title">${paletteRoleLabel(r)}</span><input type="text" class="palette-role-name" data-palette-label="${r}" value="${escapeAttr(a.paletteRoleLabels?.[a.paletteId]?.[r]||DEFAULT_PALETTE_ROLE_LABELS[r]||r)}" aria-label="Label for ${r}"><input type="color" data-palette-role="${r}" value="${p.roles?.[r]||'#8c6f4d'}" aria-label="Color for ${r}"></label>`).join('')}<label class="palette-app-editor"><span>App accent</span><input type="color" data-palette-app="accent" value="${p.app?.accent||'#8c6f4d'}"></label><label class="palette-app-editor"><span>Secondary accent</span><input type="color" data-palette-app="accent2" value="${p.app?.accent2||'#b7835a'}"></label><label class="palette-app-editor"><span>App background</span><input type="color" data-palette-app="bg" value="${p.app?.bg||'#f5efe6'}"></label><label class="palette-app-editor"><span>Main panels</span><input type="color" data-palette-app="panel" value="${p.app?.panel||'#fffaf3'}"></label><label class="palette-app-editor"><span>Soft panels</span><input type="color" data-palette-app="panel2" value="${p.app?.panel2||'#f1e3d0'}"></label><label class="palette-app-editor"><span>Borders</span><input type="color" data-palette-app="line" value="${p.app?.line||'#dfd0bd'}"></label><label class="palette-app-editor"><span>Main text</span><input type="color" data-palette-app="ink" value="${p.app?.ink||'#2e2a24'}"></label><label class="palette-app-editor"><span>Muted text</span><input type="color" data-palette-app="muted" value="${p.app?.muted||'#766b5d'}"></label></div>
  <div class="inline-actions"><button type="button" class="primary small" onclick="saveActiveMoneyNestPalette()">Save palette changes</button><button type="button" class="ghost small" onclick="resetActiveMoneyNestPalette()">Reset this palette</button></div>`;
}
window.selectMoneyNestPalette=id=>{data.settings.appearance.paletteId=id;applyMoneyNestPalette();saveData();renderAppearanceSettings();};
window.saveActiveMoneyNestPalette=()=>{
  const a=data.settings.appearance; normalizePaletteSettings(data);
  const edited={name:a.paletteId==="custom"?"Custom":(MONEY_NEST_PALETTES[a.paletteId]?.name||"Adjusted"),roles:{},app:{}};
  document.querySelectorAll('[data-palette-role]').forEach(i=>edited.roles[i.dataset.paletteRole]=i.value);
  document.querySelectorAll('[data-palette-app]').forEach(i=>edited.app[i.dataset.paletteApp]=i.value);
  a.paletteRoleLabels ||= {}; a.paletteRoleLabels[a.paletteId] = {}; document.querySelectorAll('[data-palette-label]').forEach(i=>a.paletteRoleLabels[a.paletteId][i.dataset.paletteLabel]=i.value.trim()||DEFAULT_PALETTE_ROLE_LABELS[i.dataset.paletteLabel]);
  if(a.paletteId==="custom") a.customPalette=edited;
  else a.paletteOverrides[a.paletteId]=edited;
  applyMoneyNestPalette();saveData();renderAppearanceSettings();
};
window.resetActiveMoneyNestPalette=()=>{
  const a=data.settings.appearance; normalizePaletteSettings(data);
  if(a.paletteId==="custom") a.customPalette={...JSON.parse(JSON.stringify(MONEY_NEST_PALETTES.legacy)),name:"Custom"};
  else delete a.paletteOverrides[a.paletteId];
  applyMoneyNestPalette();saveData();renderAppearanceSettings();
};
window.saveCustomMoneyNestPalette=window.saveActiveMoneyNestPalette;

// v2-219: load saved data only after palette constants exist, preventing startup TDZ errors.
data = loadData();

function normalizeCategoryId(id){
  return id || "unassigned";
}


function isMedicalDebtLike(debt){
  const text = `${debt?.type || ""} ${debt?.company || ""} ${debt?.name || ""}`.toLowerCase();
  return text.includes("medical") || text.includes("accessone") || text.includes("access one") || text.includes("middleton") || text.includes("smiles");
}
function isMedicalDebt(debt){
  const label = typeof debtTypeLabel === "function" ? debtTypeLabel(debt?.type) : debt?.type;
  return debt?.type === "Medical" || label === "Medical" || isMedicalDebtLike(debt);
}
function debtPaymentCategoryId(debt){
  if(!debt) return "unassigned";
  if(debt.type === "Credit Card") return "credit-card-payment";
  if(debt.type === "Buy Now, Pay Later") return "klarna";
  if(debt.type === "Medical") return "medical";
  if(debt.type === "Loan") return "loan-payment";
  return "unassigned";
}


function normalizeLoanForecastHistory(history){
  if(!Array.isArray(history)) return [];
  return history.map(item=>({
    date:item.date || "",
    balanceBefore:item.balanceBefore === "" || item.balanceBefore === undefined ? "" : Number(item.balanceBefore),
    amount:item.amount === "" || item.amount === undefined ? 0 : Number(item.amount || 0),
    fees:item.fees === "" || item.fees === undefined ? 0 : Number(item.fees || item.feeAmount || 0),
    interest:item.interest === "" || item.interest === undefined ? 0 : Number(item.interest || item.interestAmount || 0),
    principal:item.principal === "" || item.principal === undefined ? "" : Number(item.principal || item.principalAmount || 0),
    source:item.source || "history"
  })).filter(item=>item.amount > 0);
}
function defaultLoanForecastHistoryForDebt(debt){
  const type = debt?.type === "Klarna" ? "Buy Now, Pay Later" : debt?.type;
  const label = `${debt?.owner || ""} ${debt?.company || ""} ${debt?.name || ""}`.toLowerCase();
  if(type !== "Loan" || !(label.includes("auto") || label.includes("car"))) return [];
  if(label.includes("ty")){
    return normalizeLoanForecastHistory([
      {date:"2026-06-03", balanceBefore:11780.00, amount:70.00, fees:39.46, interest:15.23, principal:15.31, source:"Book1"},
      {date:"2026-05-27", balanceBefore:11834.70, amount:70.00, fees:0.00, interest:15.30, principal:54.70, source:"Book1"},
      {date:"2026-05-20", balanceBefore:11889.33, amount:70.00, fees:0.00, interest:15.37, principal:54.63, source:"Book1"},
      {date:"2026-05-13", balanceBefore:11943.89, amount:70.00, fees:0.00, interest:15.44, principal:54.56, source:"Book1"},
      {date:"2026-05-06", balanceBefore:11943.89, amount:70.00, fees:40.07, interest:13.25, principal:16.68, source:"Book1"},
      {date:"2026-04-30", balanceBefore:12012.82, amount:70.00, fees:0.00, interest:17.75, principal:52.25, source:"Book1"}
    ]);
  }
  if(label.includes("mak")){
    return normalizeLoanForecastHistory([
      {date:"2026-05-08", balanceBefore:6807.29, amount:222.00, fees:22.80, interest:47.27, principal:151.93, source:"Book1"},
      {date:"2026-04-09", balanceBefore:6952.73, amount:222.00, fees:23.29, interest:53.27, principal:145.44, source:"Book1"},
      {date:"2026-03-08", balanceBefore:7101.63, amount:222.00, fees:23.79, interest:49.31, principal:148.90, source:"Book1"}
    ]);
  }
  return [];
}

function normalizeData(raw){
  const incoming = raw || JSON.parse(JSON.stringify(sampleData));
  const inferredSchema = Number(incoming.schemaVersion || (incoming.settings?.appearance ? 215 : incoming.settings ? 175 : 100));
  if(inferredSchema < 200) saveLocalMeta({olderSchemaWarning:{from:inferredSchema,to:CURRENT_SCHEMA_VERSION,at:new Date().toISOString()}});
  const d = incoming;
  d.schemaVersion = CURRENT_SCHEMA_VERSION;
  if(!Array.isArray(d.categories)) d.categories = JSON.parse(JSON.stringify(sampleData.categories));

  // v1 stored categories as plain strings. v2 stores full category objects.
  if(typeof d.categories[0] === "string"){
    d.categories = d.categories.map((name,i)=>({
      id: slug(name),
      name,
      emoji: sampleData.categories[i % sampleData.categories.length]?.emoji || "",
      color: sampleData.categories[i % sampleData.categories.length]?.color || "#8c6f4d"
    }));
  }

  // Local helper that uses the in-progress normalized data object,
  // not the global `data` variable, which does not exist yet during startup.
  const localFindCategoryId = (name) => {
    return d.categories.find(c => c.name === name)?.id || d.categories[0]?.id || "income";
  };

  d.transactions = (d.transactions || []).map(tx => {
    if(!tx.categoryId && tx.category) tx.categoryId = localFindCategoryId(tx.category);
    if(tx.accountId === undefined) tx.accountId = "";
    if(tx.debtAccountId === undefined) tx.debtAccountId = "";
    if(tx.linkedDebtId === undefined) tx.linkedDebtId = "";
    if(tx.transferToAccountId === undefined) tx.transferToAccountId = "";
    tx.pendingReimbursement = tx.pendingReimbursement === true || String(tx.pendingReimbursement).toLowerCase() === "true";
    if(tx.reimbursementToAccountId === undefined) tx.reimbursementToAccountId = tx.pendingReimbursement ? (tx.transferToAccountId || "") : "";
    if(!tx.recurrence){
      tx.recurrence = tx.repeat ? { type:"monthly", interval:1 } : { type:"none", interval:1 };
    }
    if(tx.type === "income" && /paycheck/i.test(tx.title || "")){
      tx.type = "paycheck";
    }
    if(tx.type === "paycheck" && (!tx.categoryId || tx.categoryId === "unassigned")){
      tx.categoryId = "income";
    }
    if(tx.type === "paycheck" && tx.accountId === "mak-checking" && tx.autoMakPaycheck){
      if(!tx.categoryId || tx.categoryId === "unassigned") tx.categoryId = "income";
      tx.recurrence = {type:"monthly", interval:1, weekendHandling:"previous-friday"};
      const day = parseDate(tx.date || todayISO()).getDate();
      if(day <= 12){
        tx.date = (tx.date || todayISO()).slice(0,8) + "07";
        tx.notes = tx.notes || "monthly on the 7th, move weekend to Friday";
      } else {
        tx.date = (tx.date || todayISO()).slice(0,8) + "22";
        tx.notes = tx.notes || "monthly on the 22nd, move weekend to Friday";
      }
    }
    return tx;
  });

  d.budgets = (d.budgets || []).map(b => {
    if(!b.categoryId && b.category) b.categoryId = localFindCategoryId(b.category);
    b.emoji = typeof b.emoji === "string" ? b.emoji.trim() : "";
    b.categoryIds = Array.isArray(b.categoryIds) ? [...new Set(b.categoryIds.filter(Boolean))] : [];
    if(!b.categoryIds.length && b.categoryId) b.categoryIds = [b.categoryId];
    b.categoryIds = b.categoryIds.filter(id => id && !isBudgetExcludedCategory(id));
    b.categoryId = b.categoryIds[0] || b.categoryId || ""; // legacy fallback for older versions
    const legacyAccountId = b.accountId || "";
    const requestedScope = ["single","all","selected"].includes(b.accountScope) ? b.accountScope : (legacyAccountId ? "single" : "all");
    b.accountScope = requestedScope;
    b.accountIds = Array.isArray(b.accountIds) ? [...new Set(b.accountIds.filter(Boolean))] : [];
    if(requestedScope === "single"){
      b.accountId = legacyAccountId || b.accountIds[0] || "";
      b.accountIds = b.accountId ? [b.accountId] : [];
      if(!b.accountId) b.accountScope = "all";
    } else if(requestedScope === "selected"){
      if(!b.accountIds.length && legacyAccountId) b.accountIds = [legacyAccountId];
      b.accountId = b.accountIds[0] || ""; // legacy fallback for older app versions
      if(!b.accountIds.length) b.accountScope = "all";
    } else {
      b.accountId = "";
      b.accountIds = [];
    }
    return b;
  });

  // Keep category IDs stable and remove accidental duplicate IDs.
  const byCategoryId = new Map();
  (d.categories || []).forEach(c=>{
    if(!c || !c.id) return;
    byCategoryId.set(c.id, {...(byCategoryId.get(c.id) || {}), ...c});
  });
  d.categories = [...byCategoryId.values()].sort((a,b)=>String(a.name || "").localeCompare(String(b.name || "")));

  d.settings ||= {buffer:50};
  normalizePaletteSettings(d);
  d.settings.transactionTemplates ||= [];
  d.settings.paycheckProfiles ||= {};
  d.settings.paycheckProfiles.Mak ||= {
    enabled:true,
    hourlyRate:24,
    hoursPerWorkday:8,
    deductionPercent:18.51,
    fixedDeduction:0,
    mode:"pay-period-weekdays"
  };
  d.settings.paycheckProfiles.Ty ||= {
    enabled:true,
    hourlyRate:22,
    defaultHours:38,
    deductionPercent:18.51,
    fixedDeduction:0,
    mode:"fixed-hours"
  };
  d.settings.openDebtTypes ||= [];
  d.settings.openDebtCompanies ||= [];
  d.settings.debtTypeLabels ||= {
    "Credit Card": "Credit Cards",
    "Loan": "Loans",
    "Medical": "Medical",
    "Klarna": "Buy Now, Pay Later",
    "Buy Now, Pay Later": "Buy Now, Pay Later"
  };
  d.accounts ||= [];
  d.debts ||= [];

  d.accounts = d.accounts.map((account, index) => ({
    ...account,
    emoji: account.emoji || (account.name?.toLowerCase().includes("savings") ? "🏦" : "💵"),
    color: account.color || "#8c6f4d",
    order: account.order ?? index,
    goalAmount: account.goalAmount ?? 0,
    goalName: account.goalName || ""
  }));

  d.debts = d.debts.map((debt, index) => {
    const normalizedType = debt.type === "Klarna"
      ? "Buy Now, Pay Later"
      : (isMedicalDebtLike(debt) ? "Medical" : debt.type);
    return {
    ...debt,
    type: normalizedType,
    emoji: debt.emoji || (normalizedType === "Medical" ? "🩺" : normalizedType === "Loan" ? "📄" : normalizedType === "Buy Now, Pay Later" ? "🩷" : "💳"),
    color: debt.color || (normalizedType === "Medical" ? "#8936ff" : "#8c6f4d"),
    startingBalance: debt.startingBalance ?? debt.originalBalance ?? debt.statementBalance ?? debt.balance ?? 0,
    // Legacy/currentBalance imports are preserved, but live Current Balance is now calculated from Starting Balance + cleared debt transactions.
    balance: debt.balance ?? debt.currentBalance ?? debt.statementBalance ?? debt.startingBalance ?? debt.originalBalance ?? 0,
    trackingStartDate: debt.trackingStartDate || debt.balanceStartDate || debt.currentBalanceStartDate || "",
    statementDate: debt.statementDate || "",
    dueDate: debt.dueDate || "",
    statementBalance: debt.statementBalance ?? debt.startingBalance ?? debt.balance ?? 0,
    minDue: debt.minDue ?? 0,
    manualExtra: debt.manualExtra ?? 0,
    paymentStatus: debt.paymentStatus || "not-set",
    loanForecastBreakdownMode: debt.loanForecastBreakdownMode || debt.loanEstimateMode || "auto",
    loanFeeTiming: debt.loanFeeTiming || "auto",
    loanEstPrincipalPct: debt.loanEstPrincipalPct ?? debt.loanPrincipalPct ?? "",
    loanEstInterestPct: debt.loanEstInterestPct ?? debt.loanInterestPct ?? "",
    loanEstFeePct: debt.loanEstFeePct ?? debt.loanFeePct ?? "",
    loanForecastHistory: normalizeLoanForecastHistory((debt.loanForecastHistory && debt.loanForecastHistory.length) ? debt.loanForecastHistory : defaultLoanForecastHistoryForDebt({...debt, type: normalizedType})),
    frozenLocked: debt.frozenLocked || false,
    notes: debt.notes || "",
    order: debt.order ?? index
  };
  });

  d.transactions = d.transactions.map(tx => ({
    ...tx,
    categoryId: normalizeCategoryId(tx.categoryId || "unassigned"),
    autoMakPaycheck: !!tx.autoMakPaycheck,
    recurrence: {
      ...(tx.recurrence || {type:"none", interval:1}),
      weekendHandling: tx.recurrence?.weekendHandling || "none"
    },
    loanPrincipalAmount: tx.loanPrincipalAmount === undefined || tx.loanPrincipalAmount === "" ? "" : Number(tx.loanPrincipalAmount),
    loanInterestAmount: tx.loanInterestAmount === undefined || tx.loanInterestAmount === "" ? "" : Number(tx.loanInterestAmount),
    loanFeeAmount: tx.loanFeeAmount === undefined || tx.loanFeeAmount === "" ? "" : Number(tx.loanFeeAmount),
    loanBalanceAdjustment: tx.loanBalanceAdjustment === undefined || tx.loanBalanceAdjustment === "" ? "" : Number(tx.loanBalanceAdjustment),
    dateOverrides: tx.dateOverrides || {},
    occurrenceOverrides: tx.occurrenceOverrides || {},
    linkedTransactionIds: Array.isArray(tx.linkedTransactionIds) ? [...new Set(tx.linkedTransactionIds.filter(Boolean).map(String))] : [],
    recurringSourceId: tx.recurringSourceId || "",
    recurrenceSourceId: tx.recurrenceSourceId || "",
    originalDate: tx.originalDate || "",
    wasRecurringOccurrence: !!tx.wasRecurringOccurrence
  }));

  return d;
}
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") || uid(); }
function loadData(){
  try{
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) return normalizeData(JSON.parse(saved));
    const old = localStorage.getItem("moneyNest.v1");
    if(old) return normalizeData(JSON.parse(old));
  } catch(err){
    console.warn("Money Nest startup data issue. Loading sample data instead.", err);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
  return normalizeData(JSON.parse(JSON.stringify(sampleData)));
}
function loadChangeHistory(){
  try{ return JSON.parse(localStorage.getItem(CHANGE_HISTORY_KEY) || "[]"); }
  catch(err){ return []; }
}
function saveChangeHistory(history){
  // Recent Changes stores full before-snapshots so Undo can work. On iPhone/Safari,
  // localStorage can fill up quickly, so save fewer items before giving up instead of
  // silently letting history get stale.
  const normalized = (history || []).filter(Boolean);
  const attempts = [5, 3, 1];
  for(const limit of attempts){
    try{
      localStorage.setItem(CHANGE_HISTORY_KEY, JSON.stringify(normalized.slice(0, limit)));
      return;
    } catch(err){
      if(limit === attempts[attempts.length - 1]) console.warn("Could not save undoable change history", err);
    }
  }
  // Last-resort: keep a tiny non-undoable breadcrumb so the list still reflects
  // that a change happened, even if storage is too tight for restore snapshots.
  try{
    const tiny = normalized.slice(0, 5).map(item=>({
      id:item.id || uid(),
      at:item.at || new Date().toISOString(),
      label:item.label || "Changed Money Nest data",
      storageLimited:true
    }));
    localStorage.setItem(CHANGE_HISTORY_KEY, JSON.stringify(tiny));
  } catch(err){}
}

function snapshotCategoryLabel(snapshot, categoryId){
  const cat = (snapshot?.categories || []).find(c=>c.id === categoryId);
  return cat ? `${cat.emoji || ""} ${cat.name || "Unassigned"}`.trim() : (categoryId || "Unassigned");
}
function snapshotAccountLabel(snapshot, accountId){
  const acc = (snapshot?.accounts || []).find(a=>a.id === accountId);
  return acc ? `${acc.emoji || ""} ${acc.name || "Account"}`.trim() : (accountId || "None");
}
function snapshotDebtLabel(snapshot, debtId){
  const debt = (snapshot?.debts || []).find(d=>d.id === debtId);
  if(!debt) return debtId || "None";
  return `${debt.emoji || ""} ${debt.company ? debt.company + " • " : ""}${debt.name || "Debt"}`.trim();
}
function moneyBrief(value){
  const n = Number(value || 0);
  try{ return n.toLocaleString(undefined, {style:"currency", currency:"USD"}); }
  catch(err){ return `$${n.toFixed(2)}`; }
}
function txRouteLabel(tx, snapshot){
  if(!tx) return "";
  const parts = [];
  if(tx.accountId) parts.push(`From ${snapshotAccountLabel(snapshot, tx.accountId)}`);
  if(tx.transferToAccountId) parts.push(`To ${snapshotAccountLabel(snapshot, tx.transferToAccountId)}`);
  if(tx.debtAccountId) parts.push(`Card/debt ${snapshotDebtLabel(snapshot, tx.debtAccountId)}`);
  if(tx.linkedDebtId && tx.linkedDebtId !== tx.debtAccountId) parts.push(`Linked ${snapshotDebtLabel(snapshot, tx.linkedDebtId)}`);
  return parts.join(" • ");
}
function txOneLine(tx, snapshot){
  if(!tx) return "Unknown transaction";
  const cat = snapshotCategoryLabel(snapshot, tx.categoryId || "unassigned");
  const route = txRouteLabel(tx, snapshot);
  const bits = [
    `${tx.date || "no date"}`,
    `${tx.type || "transaction"}`,
    `${tx.status || "status unknown"}`,
    cat,
    route
  ].filter(Boolean);
  return `${tx.title || "Untitled"} • ${moneyBrief(tx.amount)} • ${bits.join(" • ")}`;
}
function txFieldValue(field, tx, snapshot){
  if(!tx) return "";
  switch(field){
    case "amount": return moneyBrief(tx.amount);
    case "categoryId": return snapshotCategoryLabel(snapshot, tx.categoryId || "unassigned");
    case "accountId": return snapshotAccountLabel(snapshot, tx.accountId);
    case "transferToAccountId": return snapshotAccountLabel(snapshot, tx.transferToAccountId);
    case "debtAccountId": return snapshotDebtLabel(snapshot, tx.debtAccountId);
    case "linkedDebtId": return snapshotDebtLabel(snapshot, tx.linkedDebtId);
    case "loanPrincipalAmount": return tx.loanPrincipalAmount === "" || tx.loanPrincipalAmount === undefined ? "blank" : moneyBrief(tx.loanPrincipalAmount);
    case "loanInterestAmount": return tx.loanInterestAmount === "" || tx.loanInterestAmount === undefined ? "blank" : moneyBrief(tx.loanInterestAmount);
    case "loanFeeAmount": return tx.loanFeeAmount === "" || tx.loanFeeAmount === undefined ? "blank" : moneyBrief(tx.loanFeeAmount);
    default: return tx[field] === undefined || tx[field] === "" ? "blank" : String(tx[field]);
  }
}
function txDiffLine(beforeTx, afterTx, beforeSnapshot, afterSnapshot){
  const fields = [
    ["title","Title"], ["date","Date"], ["amount","Amount"], ["type","Type"], ["status","Status"], ["categoryId","Category"],
    ["accountId","Cash account"], ["transferToAccountId","Transfer to"], ["debtAccountId","Debt/card account"], ["linkedDebtId","Linked debt"],
    ["loanPrincipalAmount","Principal"], ["loanInterestAmount","Interest"], ["loanFeeAmount","Fees"]
  ];
  const changed = [];
  fields.forEach(([field,label])=>{
    const a = JSON.stringify(beforeTx?.[field] ?? "");
    const b = JSON.stringify(afterTx?.[field] ?? "");
    if(a !== b){
      changed.push(`${label}: ${txFieldValue(field, beforeTx, beforeSnapshot)} → ${txFieldValue(field, afterTx, afterSnapshot)}`);
    }
  });
  return changed.length ? changed.join("; ") : "Transaction details changed";
}
function changeActionLabel(kind){
  if(kind === "added") return "Remove this";
  if(kind === "edited") return "Undo this edit";
  if(kind === "deleted") return "Restore this";
  return "Undo this";
}
function changeTxItemHTML(t, snapshot, className, historyIndex, kind, extraHTML=""){
  const id = String(t?.id || "").replace(/'/g, "\\'");
  return `<li class="${className || ""}"><div class="change-tx-line"><span>${txOneLine(t, snapshot)}${extraHTML}</span><button type="button" class="ghost tiny" onclick="event.preventDefault(); event.stopPropagation(); undoSingleTransactionChange(${historyIndex}, '${kind}', '${id}')">${changeActionLabel(kind)}</button></div></li>`;
}
function buildCompactChangeDetails(before, after){
  const beforeTx = before.transactions || [];
  const afterTx = after.transactions || [];
  const beforeMap = new Map(beforeTx.map(t=>[t.id,t]));
  const afterMap = new Map(afterTx.map(t=>[t.id,t]));
  const added = afterTx.filter(t=>!beforeMap.has(t.id));
  const removed = beforeTx.filter(t=>!afterMap.has(t.id));
  const edited = afterTx
    .filter(t=>beforeMap.has(t.id) && JSON.stringify(beforeMap.get(t.id)) !== JSON.stringify(t))
    .map(t=>({before:beforeMap.get(t.id), after:t, diff:txDiffLine(beforeMap.get(t.id), t, before, after)}));
  return {
    added: added.slice(0, 12),
    edited: edited.slice(0, 12),
    removed: removed.slice(0, 12),
    addedCount: added.length,
    editedCount: edited.length,
    removedCount: removed.length,
    debtChanged: JSON.stringify(before.debts || []) !== JSON.stringify(after.debts || []),
    accountChanged: JSON.stringify(before.accounts || []) !== JSON.stringify(after.accounts || []),
    settingsChanged: JSON.stringify(before.settings || {}) !== JSON.stringify(after.settings || {}),
    afterSnapshotLite: {
      accounts: after.accounts || [],
      debts: after.debts || [],
      categories: after.categories || []
    },
    beforeSnapshotLite: {
      accounts: before.accounts || [],
      debts: before.debts || [],
      categories: before.categories || []
    }
  };
}
function compactChangeDetailsHTML(details, historyIndex=0){
  if(!details) return "";
  const chunks = [];
  const afterSnap = details.afterSnapshotLite || {};
  const beforeSnap = details.beforeSnapshotLite || {};
  const added = details.added || [];
  const edited = details.edited || [];
  const removed = details.removed || [];
  if(added.length){
    chunks.push(`<div><b>Added</b><ul>${added.map(t=>changeTxItemHTML(t, afterSnap, "added-change", historyIndex, "added")).join("")}${(details.addedCount || added.length) > added.length ? `<li>+${(details.addedCount || 0) - added.length} more</li>` : ""}</ul></div>`);
  }
  if(edited.length){
    chunks.push(`<div><b>Edited</b><ul>${edited.map(pair=>changeTxItemHTML(pair.after, afterSnap, "", historyIndex, "edited", `<br><small>${pair.diff || "Transaction details changed"}</small>`)).join("")}${(details.editedCount || edited.length) > edited.length ? `<li>+${(details.editedCount || 0) - edited.length} more</li>` : ""}</ul></div>`);
  }
  if(removed.length){
    chunks.push(`<div><b>Deleted</b><ul>${removed.map(t=>changeTxItemHTML(t, beforeSnap, "deleted-change", historyIndex, "deleted")).join("")}${(details.removedCount || removed.length) > removed.length ? `<li>+${(details.removedCount || 0) - removed.length} more</li>` : ""}</ul></div>`);
  }
  if(!chunks.length && details.debtChanged) chunks.push(`<div><b>Debt/account settings changed</b><small> Open a JSON backup if you need the exact audit trail.</small></div>`);
  if(!chunks.length && details.accountChanged) chunks.push(`<div><b>Cash account settings changed</b><small> Open a JSON backup if you need the exact audit trail.</small></div>`);
  if(!chunks.length && details.settingsChanged) chunks.push(`<div><b>Settings/templates changed</b><small> This may include filters, templates, paycheck settings, or app preferences.</small></div>`);
  return chunks.join("");
}
function changeDetailsHTML(item, historyIndex=0){
  if(item?.storageLimited){
    return `<small>Recorded, but undo details were not saved because browser storage was tight. Export a JSON backup before big edits.</small>`;
  }
  if(item?.details){
    return compactChangeDetailsHTML(item.details, historyIndex) || `<small>No detail summary available for this change.</small>`;
  }
  try{
    const before = JSON.parse(item.before || "{}");
    const after = JSON.parse(item.after || "{}");
    const beforeTx = before.transactions || [];
    const afterTx = after.transactions || [];
    const beforeMap = new Map(beforeTx.map(t=>[t.id,t]));
    const afterMap = new Map(afterTx.map(t=>[t.id,t]));
    const added = afterTx.filter(t=>!beforeMap.has(t.id));
    const removed = beforeTx.filter(t=>!afterMap.has(t.id));
    const edited = afterTx.filter(t=>beforeMap.has(t.id) && JSON.stringify(beforeMap.get(t.id)) !== JSON.stringify(t));
    const chunks = [];
    const listItems = (items, snapshot, className="", kind="edited") => items.slice(0,8).map(t=>changeTxItemHTML(t, snapshot, className, historyIndex, kind)).join("") + (items.length > 8 ? `<li>+${items.length - 8} more</li>` : "");
    if(added.length) chunks.push(`<div><b>Added</b><ul>${listItems(added, after, "added-change", "added")}</ul></div>`);
    if(edited.length) chunks.push(`<div><b>Edited</b><ul>${edited.slice(0,8).map(t=>changeTxItemHTML(t, after, "", historyIndex, "edited", `<br><small>${txDiffLine(beforeMap.get(t.id), t, before, after)}</small>`)).join("")}${edited.length > 8 ? `<li>+${edited.length - 8} more</li>` : ""}</ul></div>`);
    if(removed.length) chunks.push(`<div><b>Deleted</b><ul>${listItems(removed, before, "deleted-change", "deleted")}</ul></div>`);

    const debtChanged = JSON.stringify(before.debts || []) !== JSON.stringify(after.debts || []);
    const accountChanged = JSON.stringify(before.accounts || []) !== JSON.stringify(after.accounts || []);
    const settingsChanged = JSON.stringify(before.settings || {}) !== JSON.stringify(after.settings || {});
    if(!chunks.length && debtChanged) chunks.push(`<div><b>Debt/account settings changed</b><small> Open the before/after JSON backup if you need an exact audit trail.</small></div>`);
    if(!chunks.length && accountChanged) chunks.push(`<div><b>Cash account settings changed</b><small> Open the before/after JSON backup if you need an exact audit trail.</small></div>`);
    if(!chunks.length && settingsChanged) chunks.push(`<div><b>Settings/templates changed</b><small> This may include filters, templates, paycheck settings, or app preferences.</small></div>`);
    return chunks.join("") || `<small>No detail summary available for this change.</small>`;
  } catch(err){
    return `<small>Could not read detail summary for this change.</small>`;
  }
}
function undoSingleTransactionChange(historyIndex, kind, txId){
  const history = loadChangeHistory();
  const item = history[historyIndex];
  if(!item){ alert("That recent change is no longer available."); return; }
  if(item.storageLimited){
    alert("That entry was saved without undo details because browser storage was tight.");
    return;
  }
  let before, after, beforeTx, afterTx;
  try{
    before = item.before ? JSON.parse(item.before || "{}") : {};
    after = item.after ? JSON.parse(item.after || "{}") : {};
    if(item.details){
      const editedPair = (item.details.edited || []).find(pair=>pair?.before?.id === txId || pair?.after?.id === txId);
      beforeTx = (item.details.removed || []).find(t=>t.id === txId) || editedPair?.before || (before.transactions || []).find(t=>t.id === txId);
      afterTx = (item.details.added || []).find(t=>t.id === txId) || editedPair?.after || (after.transactions || []).find(t=>t.id === txId);
    } else {
      beforeTx = (before.transactions || []).find(t=>t.id === txId);
      afterTx = (after.transactions || []).find(t=>t.id === txId);
    }
  } catch(err){
    alert("Could not read that change snapshot.");
    return;
  }
  let label = "Undo this transaction change";
  if(kind === "added") label = `Remove added transaction: ${(afterTx?.title || "Untitled")}?`;
  if(kind === "edited") label = `Undo edit to transaction: ${(afterTx?.title || beforeTx?.title || "Untitled")}?`;
  if(kind === "deleted") label = `Restore deleted transaction: ${(beforeTx?.title || "Untitled")}?`;
  if(!confirm(label)) return;

  data.transactions ||= [];
  const currentIndex = data.transactions.findIndex(t=>t.id === txId);
  if(kind === "added"){
    if(currentIndex === -1){ alert("That added transaction is already gone."); return; }
    data.transactions.splice(currentIndex, 1);
  } else if(kind === "edited"){
    if(!beforeTx){ alert("Could not find the previous version for that transaction."); return; }
    if(currentIndex === -1){ alert("That transaction is currently missing, so I cannot undo only its edit. Try restoring it from the deleted section if available."); return; }
    data.transactions[currentIndex] = JSON.parse(JSON.stringify(beforeTx));
  } else if(kind === "deleted"){
    if(!beforeTx){ alert("Could not find the deleted transaction snapshot."); return; }
    if(currentIndex !== -1){ alert("That transaction already exists again."); return; }
    data.transactions.push(JSON.parse(JSON.stringify(beforeTx)));
  } else {
    alert("Unknown undo action.");
    return;
  }

  saveData();
  alert("That one transaction change was undone.");
}
window.undoSingleTransactionChange = undoSingleTransactionChange;
function summarizeDataChange(beforeRaw, afterRaw){
  try{
    const before = JSON.parse(beforeRaw || "{}");
    const after = JSON.parse(afterRaw || "{}");
    const beforeTx = before.transactions || [];
    const afterTx = after.transactions || [];
    const beforeMap = new Map(beforeTx.map(t=>[t.id,t]));
    const afterMap = new Map(afterTx.map(t=>[t.id,t]));

    const added = afterTx.filter(t=>!beforeMap.has(t.id));
    const removed = beforeTx.filter(t=>!afterMap.has(t.id));
    const edited = afterTx.filter(t=>beforeMap.has(t.id) && JSON.stringify(beforeMap.get(t.id)) !== JSON.stringify(t));

    if(added.length === 1) return `Added transaction: ${added[0].title || "Untitled"}`;
    if(removed.length === 1) return `Deleted transaction: ${removed[0].title || "Untitled"}`;
    if(edited.length === 1) return `Edited transaction: ${edited[0].title || "Untitled"}`;
    if(added.length || removed.length || edited.length) return `Changed transactions (${added.length} added, ${edited.length} edited, ${removed.length} deleted)`;

    const beforeDebts = before.debts || [];
    const afterDebts = after.debts || [];
    if(JSON.stringify(beforeDebts) !== JSON.stringify(afterDebts)) return "Changed debt accounts";

    const beforeAccounts = before.accounts || [];
    const afterAccounts = after.accounts || [];
    if(JSON.stringify(beforeAccounts) !== JSON.stringify(afterAccounts)) return "Changed cash accounts";

    const beforeSettings = before.settings || {};
    const afterSettings = after.settings || {};
    if(JSON.stringify(beforeSettings) !== JSON.stringify(afterSettings)) return "Changed settings/templates";

    return "Changed Money Nest data";
  } catch(err){
    return "Changed Money Nest data";
  }
}
function recordChangeSnapshot(beforeRaw, afterRaw){
  if(suppressChangeHistory || !beforeRaw || !afterRaw || beforeRaw === afterRaw) return;
  const history = loadChangeHistory();
  let details = null;
  try{ details = buildCompactChangeDetails(JSON.parse(beforeRaw || "{}"), JSON.parse(afterRaw || "{}")); }
  catch(err){ details = null; }
  history.unshift({
    id: uid(),
    at: new Date().toISOString(),
    label: summarizeDataChange(beforeRaw, afterRaw),
    before: beforeRaw,
    // v2-175: keep compact details instead of a second full after-snapshot so
    // Recent Changes keeps saving reliably on iPhone/localStorage-limited browsers.
    details
  });
  saveChangeHistory(history);
}
function saveData(){
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  const beforeRaw = localStorage.getItem(STORAGE_KEY);
  const afterRaw = JSON.stringify(data);
  recordChangeSnapshot(beforeRaw, afterRaw);
  localStorage.setItem(STORAGE_KEY, afterRaw);
  touchLocalMoneyNestData();
  try {
    render();
    maybeQueueCloudAutoSave();
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML("afterbegin", `<div style="margin:12px;padding:12px;border-radius:14px;background:#fff3f0;border:1px solid #d66;color:#5b2620;font-family:system-ui">
      <b>Money Nest hit a render issue.</b><br>
      Send Mak's debugging goblin this error: ${err.message}
    </div>`);
  }
}

window.addEventListener("error", event => {
  console.error(event.error || event.message);
  if(document.querySelector(".money-nest-error-toast")) return;
  document.body.insertAdjacentHTML("afterbegin", `<div class="money-nest-error-toast" style="position:fixed;left:12px;right:12px;top:12px;z-index:99999;padding:12px;border-radius:14px;background:#fff3f0;border:1px solid #d66;color:#5b2620;font-family:system-ui">
    <b>Money Nest hit an error:</b> ${event.message}
  </div>`);
});
function categoryById(id){
  const matches = (data.categories || []).filter(c=>c.id===id);
  return matches[matches.length - 1] || {id:"uncat", name:"Unassigned", emoji:"", color:"#ddd"};
}
function sortedCategories(){
  return [...(data.categories || [])].sort((a,b)=>String(a.name || "").localeCompare(String(b.name || "")));
}
function normalizeCategories(){
  const byId = new Map();
  (data.categories || []).forEach(c=>{
    if(!c || !c.id) return;
    byId.set(c.id, {...(byId.get(c.id) || {}), ...c});
  });
  data.categories = [...byId.values()].sort((a,b)=>String(a.name || "").localeCompare(String(b.name || "")));
}
function findCategoryId(name){ return data.categories.find(c=>c.name===name)?.id || data.categories[0]?.id || "income"; }
function accountById(id){ return data.accounts.find(a=>a.id===id); }
function debtById(id){ return data.debts.find(d=>d.id===id); }


function accountVisual(account){
  return `${account?.emoji || "💵"} ${account?.name || "Account"}`;
}
function debtVisual(debt){
  return `${debt?.emoji || "💳"} ${debt?.name || "Debt"}`;
}
function moveWeekendDate(date, handling){
  const d = new Date(date);
  if(!handling || handling === "none") return d;
  const day = d.getDay();
  if(handling === "next-monday"){
    if(day === 6) d.setDate(d.getDate()+2);
    if(day === 0) d.setDate(d.getDate()+1);
  }
  if(handling === "previous-friday"){
    if(day === 6) d.setDate(d.getDate()-1);
    if(day === 0) d.setDate(d.getDate()-2);
  }
  return d;
}
const RECURRENCE_SKIP_DATE = "9999-12-31";
function isSkippedOccurrenceDate(value){
  return value === RECURRENCE_SKIP_DATE || value === "__deleted__";
}
function occurrenceDateFor(tx, dateObj){
  const originalISO = toISO(dateObj);
  const overrideDate = tx.dateOverrides?.[originalISO];
  if(isSkippedOccurrenceDate(overrideDate)) return RECURRENCE_SKIP_DATE;
  if(overrideDate) return overrideDate;
  const moved = moveWeekendDate(dateObj, tx.recurrence?.weekendHandling || "none");
  return toISO(moved);
}
function displayDateWithOverride(tx){
  return tx.overrideFrom ? `${tx.date} (moved from ${tx.overrideFrom})` : tx.date;
}


function isMakAccountId(accountId){
  const a = accountById(accountId);
  return !!a && a.name.toLowerCase().includes("mak");
}
function adjustedFridayBeforeWeekend(year, month, day){
  const d = new Date(year, month, day, 12);
  if(d.getDay() === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
  if(d.getDay() === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
  return d;
}
function weekdaysBetweenInclusive(start, end){
  let count = 0;
  let d = parseDate(toISO(start));
  const final = parseDate(toISO(end));

  while(d <= final){
    const day = d.getDay();
    if(day >= 1 && day <= 5) count++;
    d = addDays(d, 1);
  }

  return count;
}
function makPayPeriodForPayDate(dateISO){
  const d = parseDate(dateISO);
  const y = d.getFullYear();
  const m = d.getMonth();

  // Actual paydays are scheduled on the 7th and 22nd.
  // If they land on a weekend, the actual deposit moves back to Friday.
  // We compare the entered/occurrence date against the adjusted paydays first.
  const pay7 = adjustedFridayBeforeWeekend(y, m, 7);
  const pay22 = adjustedFridayBeforeWeekend(y, m, 22);

  const isSeventhPay = sameDay(d, pay7) || d.getDate() === 7;
  const isTwentySecondPay = sameDay(d, pay22) || d.getDate() === 22;

  if(isTwentySecondPay){
    return {
      label: `1st–15th`,
      start: new Date(y, m, 1, 12),
      end: new Date(y, m, 15, 12)
    };
  }

  if(isSeventhPay){
    const prev = new Date(y, m - 1, 1, 12);
    return {
      label: `16th–last day`,
      start: new Date(prev.getFullYear(), prev.getMonth(), 16, 12),
      end: endOfMonth(prev)
    };
  }

  // Fallback for manually-entered dates near the early-month payday.
  if(d.getDate() <= 12){
    const prev = new Date(y, m - 1, 1, 12);
    return {
      label: `16th–last day`,
      start: new Date(prev.getFullYear(), prev.getMonth(), 16, 12),
      end: endOfMonth(prev)
    };
  }

  return {
    label: `1st–15th`,
    start: new Date(y, m, 1, 12),
    end: new Date(y, m, 15, 12)
  };
}
function accountOwnerName(accountId){
  return accountById(accountId)?.owner || "";
}
function paycheckProfileForAccount(accountId){
  const owner = accountOwnerName(accountId);
  return data.settings?.paycheckProfiles?.[owner] ? {owner, profile:data.settings.paycheckProfiles[owner]} : null;
}
function estimatePaycheckFromProfile(owner, profile, dateISO, hoursOverride=""){
  let hours = Number(hoursOverride || 0);
  let days = null;
  let periodLabel = "";
  let periodStart = "";
  let periodEnd = "";

  if(!hours && owner === "Mak"){
    const period = makPayPeriodForPayDate(dateISO);
    days = weekdaysBetweenInclusive(period.start, period.end);
    hours = days * Number(profile.hoursPerWorkday || 8);
    periodLabel = period.label;
    periodStart = toISO(period.start);
    periodEnd = toISO(period.end);
  }

  if(!hours){
    hours = Number(profile.defaultHours || 0);
  }

  const hourlyRate = Number(profile.hourlyRate || 0);
  const gross = hours * hourlyRate;
  const deductionPercent = Number(profile.deductionPercent || 0);
  const fixedDeduction = Number(profile.fixedDeduction || 0);
  const estimatedDeductions = Math.max(0, (gross * (deductionPercent / 100)) + fixedDeduction);
  const amount = Math.max(0, Math.round((gross - estimatedDeductions) * 100) / 100);

  return {
    amount,
    owner,
    hours,
    days,
    hourlyRate,
    gross: Math.round(gross * 100) / 100,
    deductionPercent,
    fixedDeduction,
    estimatedDeductions: Math.round(estimatedDeductions * 100) / 100,
    periodLabel,
    periodStart,
    periodEnd
  };
}
function paycheckAmountForTransaction(tx, dateISOOverride=""){
  const prof = paycheckProfileForAccount(tx.accountId);
  if(!prof) return null;
  return estimatePaycheckFromProfile(prof.owner, prof.profile, dateISOOverride || tx.date || todayISO(), tx.paycheckHoursOverride || "");
}
function shouldAutoCalcPaycheck(tx){
  return !!(tx.autoPaycheck || tx.autoMakPaycheck) && tx.type === "paycheck" && !!paycheckProfileForAccount(tx.accountId);
}
function applyAutoPaycheckAmount(tx){
  if(!shouldAutoCalcPaycheck(tx)) return tx;
  const info = paycheckAmountForTransaction(tx, tx.date);
  if(!info) return tx;
  return {
    ...tx,
    amount: info.amount,
    autoPaycheck:true,
    autoMakPaycheck: !!isMakAccountId(tx.accountId),
    autoPaycheckInfo: info
  };
}
// Backward-compatible helper name used by older UI code.
function makPaycheckAmountForDate(dateISO){
  const profile = data.settings?.paycheckProfiles?.Mak || {hourlyRate:24, hoursPerWorkday:8, deductionPercent:18.51, fixedDeduction:0};
  return estimatePaycheckFromProfile("Mak", profile, dateISO, "");
}


function occurrenceOverrideFor(tx, originalISO){
  return tx?.occurrenceOverrides?.[originalISO] || null;
}

function applyOccurrenceOverride(tx, originalISO, occurrenceISO){
  if(isSkippedOccurrenceDate(occurrenceISO)) return null;
  const override = occurrenceOverrideFor(tx, originalISO);
  const base = {
    ...tx,
    date: occurrenceISO,
    originalDate: originalISO,
    overrideFrom: occurrenceISO !== originalISO ? originalISO : ""
  };
  if(!override) return applyAutoPaycheckAmount(base);
  if(override.deleted) return null;

  const merged = {
    ...base,
    ...override,
    id: base.id,
    // Generated occurrence rows may have display ids like templateId-YYYY-MM-DD.
    // Keep originalId pointed at the real recurring template so edits reopen
    // the existing occurrence instead of opening a blank Add Transaction form.
    originalId: tx.originalId || tx.id,
    originalDate: originalISO,
    generated: originalISO !== (tx.originalId ? originalISO : tx.date) || !!base.generated,
    recurrence: tx.recurrence || {type:"none", interval:1},
    repeat:false,
    dateOverrides: tx.dateOverrides || {},
    occurrenceOverrides: tx.occurrenceOverrides || {}
  };
  return applyAutoPaycheckAmount(merged);
}

function saveRecurringOccurrenceOverride(baseTx, formTx, occurrenceOriginalDate, occurrenceDate){
  if(!baseTx) return;
  const originalISO = occurrenceOriginalDate || baseTx.date;
  baseTx.occurrenceOverrides ||= {};
  baseTx.occurrenceOverrides[originalISO] = {
    title: formTx.title,
    amount: formTx.amount,
    date: formTx.date || occurrenceDate || originalISO,
    type: formTx.type,
    status: formTx.status,
    accountId: formTx.accountId,
    debtAccountId: formTx.debtAccountId,
    categoryId: formTx.categoryId,
    transferToAccountId: formTx.transferToAccountId,
    linkedDebtId: formTx.linkedDebtId,
    loanPrincipalAmount: formTx.loanPrincipalAmount,
    loanInterestAmount: formTx.loanInterestAmount,
    loanFeeAmount: formTx.loanFeeAmount,
    loanBalanceAdjustment: formTx.loanBalanceAdjustment,
    pendingReimbursement: !!formTx.pendingReimbursement,
    reimbursementToAccountId: formTx.reimbursementToAccountId || "",
    autoPaycheck: !!formTx.autoPaycheck,
    autoMakPaycheck: !!formTx.autoMakPaycheck,
    paycheckHoursOverride: formTx.paycheckHoursOverride ?? "",
    notes: formTx.notes || ""
  };
}

function transactionForOccurrenceForm(tx, originalISO, occurrenceISO){
  if(!tx) return null;
  const baseOccurrence = applyOccurrenceOverride(tx, originalISO || tx.date, occurrenceISO || originalISO || tx.date);
  return baseOccurrence || {...tx, date: occurrenceISO || tx.date, originalDate: originalISO || tx.date};
}

function expandedTransactions(untilISO){
  const out = [];
  const until = parseDate(untilISO);

  data.transactions.forEach(tx => {
    const baseDate = occurrenceDateFor(tx, parseDate(tx.date));
    const baseOccurrence = applyOccurrenceOverride(tx, tx.date, baseDate);
    // Archived bills preserve cleared history but stop contributing planned/future
    // occurrences to calendars, forecasts, balances, and bill review totals.
    if(baseOccurrence && (!tx.billArchived || baseOccurrence.status === "cleared")) out.push(baseOccurrence);

    const r = tx.recurrence || (tx.repeat ? { type:"monthly", interval:1 } : { type:"none" });
    if(!r || r.type === "none") return;

    const start = parseDate(tx.date);
    let cursor = addDays(start, 1);

    while(cursor <= until){
      let occurs = false;

      if(r.type === "weekly"){
        const interval = Number(r.interval || 1);
        occurs = cursor.getDay() === Number(r.weekday ?? start.getDay()) && daysBetween(start, cursor) % (interval * 7) === 0;
      }

      if(r.type === "biweekly"){
        occurs = cursor.getDay() === start.getDay() && daysBetween(start, cursor) % 14 === 0;
      }

      if(r.type === "monthly"){
        const interval = Number(r.interval || 1);
        occurs = cursor.getDate() === monthlyTargetDay(start, cursor) && monthDiff(start, cursor) % interval === 0;
      }

      if(r.type === "last-day-month"){
        const interval = Number(r.interval || 1);
        occurs = cursor.getDate() === endOfMonth(cursor).getDate() && monthDiff(start, cursor) % interval === 0;
      }

      if(r.type === "yearly"){
        const interval = Number(r.interval || 1);
        occurs = cursor.getMonth() === start.getMonth() && cursor.getDate() === start.getDate() && ((cursor.getFullYear() - start.getFullYear()) % interval === 0);
      }

      if(r.type === "every-x-days"){
        const interval = Number(r.interval || 1);
        occurs = daysBetween(start, cursor) % interval === 0;
      }

      if(r.type === "nth-weekday"){
        const interval = Number(r.interval || 1);
        const nth = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), r.weekday ?? start.getDay(), r.ordinal || 1);
        occurs = nth && sameDay(cursor, nth) && monthDiff(start, cursor) % interval === 0;
      }

      if(occurs){
        const originalISO = toISO(cursor);
        if(tx.recurrenceUntil && originalISO > tx.recurrenceUntil){
          cursor = addDays(cursor, 1);
          continue;
        }
        const occurrenceISO = occurrenceDateFor(tx, cursor);
        const generatedOccurrence = applyOccurrenceOverride({
          ...tx,
          id: tx.id + "-" + originalISO,
          originalId:tx.id,
          // A recurring transaction is a template. Future/past generated
          // occurrences should start as planned unless that exact date has
          // its own saved override. Otherwise marking one occurrence cleared
          // makes every generated occurrence look cleared.
          status: "planned",
          generated:true
        }, originalISO, occurrenceISO);
        if(generatedOccurrence && (!tx.billArchived || generatedOccurrence.status === "cleared")) out.push(generatedOccurrence);
      }

      cursor = addDays(cursor, 1);
    }
  });

  return out.sort((a,b)=>a.date.localeCompare(b.date));
}

function isPendingReimbursementTx(tx){
  return !!tx?.pendingReimbursement && tx.status !== "cleared" && tx.type === "transfer" && !!tx.transferToAccountId;
}
function pendingReimbursementsToAccount(accountId, throughISO="2999-12-31"){
  return expandedTransactions(throughISO)
    .filter(tx => isPendingReimbursementTx(tx) && tx.transferToAccountId === accountId && tx.date <= throughISO)
    .reduce((sum, tx)=>sum + Number(tx.amount || 0), 0);
}
function pendingReimbursementsFromAccount(accountId, throughISO="2999-12-31"){
  return expandedTransactions(throughISO)
    .filter(tx => isPendingReimbursementTx(tx) && tx.accountId === accountId && tx.date <= throughISO)
    .reduce((sum, tx)=>sum + Number(tx.amount || 0), 0);
}
function txEffectOnCash(tx, accountId, projected=true){
  if(!projected && tx.status !== "cleared") return 0;

  // Transfers between cash accounts behave like normal planned/cleared money movement.
  // IOU / reimbursement transactions are still labeled for tracking, but they no
  // longer hide the receiving side from projected balances or Safe to Spend.
  if(tx.type === "transfer" && tx.transferToAccountId === accountId){
    return tx.amount;
  }

  if(tx.accountId !== accountId) return 0;
  if(tx.type === "income" || tx.type === "paycheck") return tx.amount;
  return -tx.amount;
}
function accountBalance(accountId, projected=true, throughISO="2999-12-31"){
  const acc = accountById(accountId);
  if(!acc) return 0;
  return acc.startingBalance + expandedTransactions(throughISO).filter(tx=>tx.date <= throughISO).reduce((sum,tx)=>sum + txEffectOnCash(tx, accountId, projected),0);
}

function debtStartingBalance(d){
  return Number(d?.startingBalance ?? d?.originalBalance ?? d?.statementBalance ?? d?.balance ?? 0);
}
function debtStatementBaselineEnabled(d){
  if(!d) return false;
  // Auto/regular loans and medical payment plans often have lender/provider activity
  // that is not entered in Money Nest. When a statement balance/date exists, treat
  // that as the live baseline and only count cleared activity after that date.
  return (isLoanDebt(d) || isMedicalDebt(d)) && !!d.statementDate && d.statementBalance !== "" && d.statementBalance !== undefined && d.statementBalance !== null;
}
function debtCurrentSeed(d){
  // BNPL can still use a remaining-balance fallback because installments may not all exist yet.
  if(isBNPLDebt(d)) return Number(d?.balance ?? d?.startingBalance ?? 0);
  if(debtStatementBaselineEnabled(d)) return Number(d.statementBalance || 0);
  // For credit cards, loans, and medical payment plans, Current Balance is calculated
  // from the selected baseline plus cleared debt transactions/payments.
  return Number(d?.startingBalance ?? d?.balance ?? d?.statementBalance ?? 0);
}
function debtTrackingStartDate(d){
  if(debtStatementBaselineEnabled(d)) return d.statementDate || "";
  return d?.trackingStartDate || d?.balanceStartDate || d?.currentBalanceStartDate || "";
}
function debtTransactionCountsForBalance(d, tx){
  const start = debtTrackingStartDate(d);
  // A tracking start date means: the selected baseline is the balance at the end of that day;
  // only cleared debt activity after that date changes Current Balance.
  return !start || String(tx.date || "") > start;
}
function isLoanDebt(d){
  return d?.type === "Loan" || debtTypeLabel(d?.type) === "Loan";
}
function isBalanceTrackingDebt(d){
  return isLoanDebt(d) || isMedicalDebt(d) || isBNPLDebt(d);
}

function loanPaymentHasManualBreakdown(tx){
  return !!(tx && (
    (tx.loanPrincipalAmount !== "" && tx.loanPrincipalAmount !== undefined) ||
    Number(tx.loanInterestAmount || 0) ||
    Number(tx.loanFeeAmount || 0)
  ));
}
function loanBreakdownFieldIsEntered(value){
  return value !== "" && value !== undefined && value !== null && Number.isFinite(Number(value));
}
function loanPaymentBreakdownComplete(tx){
  return !!(tx &&
    loanBreakdownFieldIsEntered(tx.loanPrincipalAmount) &&
    loanBreakdownFieldIsEntered(tx.loanInterestAmount) &&
    loanBreakdownFieldIsEntered(tx.loanFeeAmount)
  );
}
function loanPaymentMissingBreakdownFields(tx){
  const fields=[];
  if(!loanBreakdownFieldIsEntered(tx?.loanPrincipalAmount)) fields.push("Principal");
  if(!loanBreakdownFieldIsEntered(tx?.loanInterestAmount)) fields.push("Interest");
  if(!loanBreakdownFieldIsEntered(tx?.loanFeeAmount)) fields.push("Fees");
  return fields;
}
function loanPrincipalReductionForPayment(tx){
  const amount = Number(tx?.amount || 0);
  const explicitPrincipal = tx?.loanPrincipalAmount === "" || tx?.loanPrincipalAmount === undefined ? null : Number(tx.loanPrincipalAmount);
  const interest = Number(tx?.loanInterestAmount || 0);
  const fees = Number(tx?.loanFeeAmount || 0);

  // If principal is entered, trust it. Otherwise, if interest/fees are entered,
  // principal is whatever remains from the total cash payment. If nothing is
  // entered, preserve old behavior and treat the whole payment as principal.
  if(explicitPrincipal !== null && !Number.isNaN(explicitPrincipal)) return Math.max(0, explicitPrincipal);
  if(interest || fees) return Math.max(0, amount - interest - fees);
  return amount;
}
function loanBreakdownSamples(d){
  if(!d) return [];
  // Use expanded transactions so cleared recurring occurrences (whose actual
  // breakdown lives in occurrenceOverrides) teach the forecast too. Only fully
  // entered breakdowns are training samples; blanks should not silently become $0.
  const txSamples = expandedTransactions(todayISO())
    .filter(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && tx.status === "cleared" && Number(tx.amount || 0) > 0 && loanPaymentBreakdownComplete(tx))
    .map(tx => {
      const amount = Number(tx.amount || 0);
      const principal = loanPrincipalReductionForPayment(tx);
      const interest = Number(tx.loanInterestAmount || 0);
      const fees = Number(tx.loanFeeAmount || 0);
      return {tx, date:tx.date || "", amount, principal, interest, fees, balanceBefore:"", source:"transaction"};
    });

  // If an older history-only sample was later entered as a real transaction,
  // prefer the transaction so the same payment is not counted twice.
  const transactionKeys = new Set(txSamples.map(s => `${s.date}|${Number(s.amount || 0).toFixed(2)}`));
  const historySamples = normalizeLoanForecastHistory(d.loanForecastHistory || []).map(item => {
    const principal = item.principal === "" || item.principal === undefined
      ? Math.max(0, Number(item.amount || 0) - Number(item.interest || 0) - Number(item.fees || 0))
      : Number(item.principal || 0);
    return {
      tx:{id:`history-${d.id}-${item.date}-${item.amount}`, linkedDebtId:d.id, type:"transfer", status:"cleared", amount:item.amount, date:item.date},
      date:item.date || "",
      amount:Number(item.amount || 0),
      principal,
      interest:Number(item.interest || 0),
      fees:Number(item.fees || 0),
      balanceBefore:item.balanceBefore === "" ? "" : Number(item.balanceBefore),
      source:item.source || "history"
    };
  }).filter(s => !transactionKeys.has(`${s.date}|${Number(s.amount || 0).toFixed(2)}`));

  // Keep the most recent window so changing loan behavior is not drowned out by
  // very old payments while still learning from all recent completed breakdowns.
  return [...historySamples, ...txSamples]
    .filter(s => Number(s.amount || 0) > 0)
    .sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-18);
}
function avg(nums){
  const valid = nums.filter(n => Number.isFinite(n));
  return valid.length ? valid.reduce((a,b)=>a+b,0) / valid.length : 0;
}
function loanInferredFeeTimingFromSamples(samples){
  const withFees = samples.filter(s => Number(s.fees || 0) > 0.005);
  if(!withFees.length) return "none";
  if(withFees.length === samples.length) return "every-payment";
  // If fees only appear sometimes, Mak's real-world auto-loan case is usually
  // a monthly fee on the first payment made that month.
  return "first-payment-month";
}
function loanForecastSettings(d){
  const mode = d?.loanForecastBreakdownMode || "auto";
  const samples = loanBreakdownSamples(d);
  const manualPrincipal = d?.loanEstPrincipalPct === "" || d?.loanEstPrincipalPct === undefined ? null : Number(d.loanEstPrincipalPct);
  const manualInterest = d?.loanEstInterestPct === "" || d?.loanEstInterestPct === undefined ? null : Number(d.loanEstInterestPct);
  const manualFee = d?.loanEstFeePct === "" || d?.loanEstFeePct === undefined ? null : Number(d.loanEstFeePct);

  if(mode === "off") return null;

  let interestPct = null;
  let feePct = null;
  let principalPct = null;
  let source = "manual";

  if(mode === "manual"){
    interestPct = manualInterest ?? 0;
    feePct = manualFee ?? 0;
    principalPct = manualPrincipal;
    if(principalPct === null) principalPct = Math.max(0, 100 - interestPct - feePct);
  } else {
    source = samples.length ? `auto from ${samples.length} payment${samples.length === 1 ? "" : "s"}` : "auto";
    if(samples.length){
      interestPct = avg(samples.map(s => s.amount ? (s.interest / s.amount) * 100 : 0));
      // Fee percent is averaged only across payments that actually had fees, then
      // applied according to the fee timing setting. That handles Ty's weekly
      // payments where only the first payment of the month has the fee.
      const feeSamples = samples.filter(s => s.fees > 0.005);
      feePct = feeSamples.length ? avg(feeSamples.map(s => s.amount ? (s.fees / s.amount) * 100 : 0)) : 0;
      principalPct = avg(samples.map(s => s.amount ? (s.principal / s.amount) * 100 : 0));
    } else {
      interestPct = manualInterest;
      feePct = manualFee;
      principalPct = manualPrincipal;
      if(interestPct === null && feePct === null && principalPct === null) return null;
      interestPct = interestPct ?? 0;
      feePct = feePct ?? 0;
      principalPct = principalPct ?? Math.max(0, 100 - interestPct - feePct);
      source = "manual fallback";
    }
  }

  const balanceSamples = samples.filter(s => Number(s.balanceBefore || 0) > 0);
  const feeBalanceSamples = balanceSamples.filter(s => Number(s.fees || 0) > 0.005);
  const interestBalancePct = balanceSamples.length ? avg(balanceSamples.map(s => (Number(s.interest || 0) / Number(s.balanceBefore || 1)) * 100)) : null;
  const feeBalancePct = feeBalanceSamples.length ? avg(feeBalanceSamples.map(s => (Number(s.fees || 0) / Number(s.balanceBefore || 1)) * 100)) : null;

  const requestedTiming = d?.loanFeeTiming || "auto";
  const inferredTiming = mode === "auto" ? loanInferredFeeTimingFromSamples(samples) : "every-payment";
  const feeTiming = requestedTiming === "auto" ? inferredTiming : requestedTiming;
  return {
    mode,
    source,
    samples: samples.length,
    principalPct: Math.max(0, Number(principalPct || 0)),
    interestPct: Math.max(0, Number(interestPct || 0)),
    feePct: Math.max(0, Number(feePct || 0)),
    interestBalancePct: interestBalancePct === null ? null : Math.max(0, Number(interestBalancePct || 0)),
    feeBalancePct: feeBalancePct === null ? null : Math.max(0, Number(feeBalancePct || 0)),
    feeTiming
  };
}
function loanIsFirstPaymentInMonth(tx, allPayments){
  if(!tx?.date) return false;
  const month = String(tx.date).slice(0,7);
  const sameMonth = (allPayments || [])
    .filter(p => p.linkedDebtId === tx.linkedDebtId && p.type === "transfer" && String(p.date || "").slice(0,7) === month)
    .sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")) || String(a.id || "").localeCompare(String(b.id || "")));
  return !!sameMonth.length && sameMonth[0].id === tx.id;
}
function loanEstimatedFeeApplies(settings, tx, context={}){
  if(!settings || !settings.feePct) return false;
  const timing = settings.feeTiming || "auto";
  if(timing === "none") return false;
  if(timing === "every-payment") return true;
  if(timing === "monthly-only") return tx?.recurrence?.type === "monthly" || tx?.recurrence?.type === "last-day-month";
  if(timing === "first-payment-month") return loanIsFirstPaymentInMonth(tx, context.allPayments || []);
  return true;
}
function loanForecastBreakdownForPayment(d, tx, context={}){
  const amount = Number(tx?.amount || 0);
  if(!amount) return {principal:0, interest:0, fees:0, estimated:false, source:"none"};

  if(loanPaymentHasManualBreakdown(tx)){
    const principal = loanPrincipalReductionForPayment(tx);
    return {
      principal,
      interest:Number(tx.loanInterestAmount || 0),
      fees:Number(tx.loanFeeAmount || 0),
      estimated:false,
      source:"manual"
    };
  }

  const settings = loanForecastSettings(d);

  // If a loan has forecast settings from prior breakdowns, use those estimates for
  // planned/recurring/generated payments and for cleared payments that still have no
  // manual breakdown. This keeps auto-loan balances/payoff dates realistic when a
  // recurring payment is simply marked cleared.
  if(!settings){
    return {principal:amount, interest:0, fees:0, estimated:false, source:"full payment"};
  }

  const currentBalanceBefore = Number(context.currentBalanceBefore || 0);
  const useBalanceBasedInterest = currentBalanceBefore > 0 && settings.interestBalancePct !== null && settings.interestBalancePct !== undefined;
  const useBalanceBasedFee = currentBalanceBefore > 0 && settings.feeBalancePct !== null && settings.feeBalancePct !== undefined;
  const interest = useBalanceBasedInterest
    ? Math.min(amount, currentBalanceBefore * (settings.interestBalancePct / 100))
    : amount * (settings.interestPct / 100);
  const fees = loanEstimatedFeeApplies(settings, tx, context)
    ? (useBalanceBasedFee ? Math.min(amount, currentBalanceBefore * (settings.feeBalancePct / 100)) : amount * (settings.feePct / 100))
    : 0;
  const byRemainder = Math.max(0, amount - interest - fees);
  const byPrincipalPct = amount * (settings.principalPct / 100);
  // Remainder usually behaves better when interest/fee timing changes by payment.
  const principal = Math.min(amount, Math.max(0, byRemainder || byPrincipalPct));
  const source = useBalanceBasedInterest || useBalanceBasedFee ? `${settings.source}, balance-based` : settings.source;
  return {principal, interest, fees, estimated:true, source, settings};
}
function loanPrincipalReductionForDebtPayment(d, tx, context={}){
  return loanForecastBreakdownForPayment(d, tx, context).principal;
}
function loanForecastSummaryText(d){
  const settings = loanForecastSettings(d);
  if(!settings) return "No future breakdown estimate";
  const feeText = settings.feePct ? ` • fees ${settings.feePct.toFixed(1)}% (${loanFeeTimingLabel(settings.feeTiming).toLowerCase()})` : "";
  const balanceText = settings.interestBalancePct !== null || settings.feeBalancePct !== null
    ? ` • balance-based as the loan drops`
    : "";
  return `Forecast uses ${settings.source}: interest ${settings.interestPct.toFixed(1)}%${feeText}${balanceText}`;
}
function loanFeeTimingLabel(value){
  const labels = {
    "auto":"Auto",
    "every-payment":"Every payment",
    "first-payment-month":"First payment each month",
    "monthly-only":"Monthly payments only",
    "none":"No fees in forecast"
  };
  return labels[value] || labels.auto;
}
function loanProjectedBalanceBeforePayment(d, targetTx){
  if(!d || !targetTx) return debtAmountLeftNow(d);
  let bal = debtCurrentSeed(d);
  const throughISO = targetTx.date || todayISO();
  const expanded = expandedTransactions(throughISO)
    .filter(tx => tx.date <= throughISO)
    .sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")) || String(a.id || "").localeCompare(String(b.id || "")));
  const loanPaymentsForEstimate = expanded.filter(tx => tx.linkedDebtId === d.id && tx.type === "transfer");
  for(const tx of expanded){
    if(!debtTransactionCountsForBalance(d, tx)) continue;
    const isTarget = tx.id === targetTx.id;
    if(isTarget) break;
    if(tx.date === throughISO && String(tx.id || "") > String(targetTx.id || "")) continue;
    if(tx.debtAccountId === d.id && tx.type === "expense") bal += Number(tx.amount || 0);
    if(tx.linkedDebtId === d.id && tx.type === "debt-adjustment") bal += Number(tx.loanBalanceAdjustment || 0);
    if(tx.linkedDebtId === d.id && tx.type === "transfer"){
      bal -= loanPrincipalReductionForDebtPayment(d, tx, {estimateFuture:true, allPayments:loanPaymentsForEstimate, currentBalanceBefore:bal});
    }
  }
  return Math.max(0, bal);
}
function loanForecastHistoryCountText(d){
  const count = normalizeLoanForecastHistory(d?.loanForecastHistory || []).length;
  if(!count) return "No saved history-only samples yet.";
  return `${count} saved history-only sample${count === 1 ? "" : "s"} included in auto estimates.`;
}

function loanPaymentBreakdownText(tx, debt=null){
  const linked = debt || debtById(tx?.linkedDebtId);
  const hasBreakdown = loanPaymentHasManualBreakdown(tx);
  if(hasBreakdown){
    const interest = Number(tx?.loanInterestAmount || 0);
    const fees = Number(tx?.loanFeeAmount || 0);
    const principal = loanPrincipalReductionForPayment(tx);
    return `Principal ${money(principal)}${interest ? ` • interest ${money(interest)}` : ""}${fees ? ` • fees ${money(fees)}` : ""}`;
  }
  if(linked && isLoanDebt(linked)){
    const sameLoanPayments = expandedTransactions(tx?.date || todayISO()).filter(p => p.linkedDebtId === linked.id && p.type === "transfer");
    const estimate = loanForecastBreakdownForPayment(linked, tx, {estimateFuture:true, allPayments:sameLoanPayments, currentBalanceBefore:loanProjectedBalanceBeforePayment(linked, tx)});
    if(estimate.estimated){
      return `Est. principal ${money(estimate.principal)} • interest ${money(estimate.interest)}${estimate.fees ? ` • fees ${money(estimate.fees)}` : ""}`;
    }
  }
  return "";
}

function debtBalance(debtId, projected=true, throughISO=(projected ? "2999-12-31" : todayISO())){
  const debt = debtById(debtId);
  if(!debt) return 0;

  // BNPL/Klarna installment accounts are best represented by remaining unpaid installments.
  if(isBNPLDebt(debt)){
    if(projected){
      const unpaid = expandedTransactions(throughISO)
        .filter(tx => tx.linkedDebtId === debtId && tx.type === "transfer" && tx.status !== "cleared")
        .reduce((sum,tx)=>sum + Number(tx.amount || 0),0);
      return Math.max(0, unpaid || debtCurrentSeed(debt));
    }
    return Math.max(0, debtCurrentSeed(debt));
  }

  // Loans/medical/regular debt can use linked transactions for projected payoff views.
  // For "amount left now" displays, use debtAmountLeftNow() so planned payments do not
  // make Current Balance look lower than the saved Remaining/Current Balance field.
  let bal = debtCurrentSeed(debt);
  const expanded = expandedTransactions(throughISO)
    .sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")) || String(a.id || "").localeCompare(String(b.id || "")));
  const loanPaymentsForEstimate = isLoanDebt(debt) ? expanded.filter(tx => tx.linkedDebtId === debtId && tx.type === "transfer") : [];
  expanded.forEach(tx=>{
    if(tx.date > throughISO) return;
    if(!debtTransactionCountsForBalance(debt, tx)) return;
    if(!projected && tx.status !== "cleared") return;
    if(tx.debtAccountId === debtId && tx.type === "expense") bal += Number(tx.amount || 0);
    if(tx.linkedDebtId === debtId && tx.type === "debt-adjustment") bal += Number(tx.loanBalanceAdjustment || 0);
    if(tx.linkedDebtId === debtId && tx.type === "transfer"){
      const reduction = isLoanDebt(debt)
        ? loanPrincipalReductionForDebtPayment(debt, tx, {estimateFuture: projected && tx.status !== "cleared", allPayments: loanPaymentsForEstimate, currentBalanceBefore: bal})
        : Number(tx.amount || 0);
      bal -= reduction;
    }
  });
  return Math.max(0, bal);
}

function debtAmountLeftNow(d, throughISO=todayISO()){
  if(!d) return 0;
  if(isBNPLDebt(d)) return Math.max(0, bnplRemainingBalance(d.id, toISO(addMonths(new Date(),24))) || debtCurrentSeed(d));

  // Current Balance starts from the editable Current/Remaining Balance field,
  // then applies only real/cleared debt transactions. Planned or recurring future
  // payments should not lower the balance early, but entered cleared card spend
  // and cleared debt payments should update what is owed now.
  return Math.max(0, debtBalance(d.id, false, throughISO));
}
function nextPaycheckDate(accountId, includeToday=true){
  const now = todayISO();
  const futureIncome = expandedTransactions(toISO(addMonths(new Date(), 6)))
    .filter(tx => {
      if(tx.accountId !== accountId || tx.type !== "paycheck" || tx.status === "cleared") return false;
      return includeToday ? tx.date >= now : tx.date > now;
    })
    .sort((a,b)=>a.date.localeCompare(b.date));
  return futureIncome[0]?.date || toISO(addMonths(new Date(),1));
}

function isSavingsAccount(account){
  return account?.name?.toLowerCase().includes("savings");
}
function savingsGoalAmount(account){
  return Number(account?.goalAmount || 0);
}
function savingsGoalRemaining(account){
  const goal = savingsGoalAmount(account);
  if(!goal) return null;
  return Math.max(0, goal - accountBalance(account.id,false,todayISO()));
}
function savingsGoalProgress(account){
  const goal = savingsGoalAmount(account);
  if(!goal) return null;
  return Math.min(100, Math.round((accountBalance(account.id,false,todayISO()) / goal) * 100));
}


function safeToSpend(account){
  if(isSavingsAccount(account)){
    return { amount: null, label:"Savings / not for spending" };
  }
  const now = todayISO();

  // Joint: protect the lowest projected balance over the next 30 days.
  if(account.id === "joint-checking"){
    const horizon = toISO(addMonths(new Date(), 1));
    let min = Infinity, minDate = now;
    let cursor = new Date(now + "T12:00:00");
    while(toISO(cursor) <= horizon){
      const bal = accountBalance(account.id, true, toISO(cursor));
      if(bal < min){ min = bal; minDate = toISO(cursor); }
      cursor.setDate(cursor.getDate()+1);
    }
    return { amount: Number(min), label:`lowest day: ${minDate} (${money(min)})` };
  }

  // Personal paycheck accounts: safe-to-spend is the LOWEST balance BEFORE the next paycheck.
  // On payday, use the following paycheck as the horizon so today's paycheck day
  // does not collapse the window to today's leftover balance.
  if(account.paycheckAccount){
    const next = nextPaycheckDate(account.id, false);
    const dayBeforeNext = toISO(addDays(parseDate(next), -1));

    let min = Infinity, minDate = now;
    let cursor = new Date(now + "T12:00:00");
    const end = parseDate(dayBeforeNext);

    // If payday is today, use today's pre-payday projected balance as the practical floor.
    if(end < cursor){
      const bal = accountBalance(account.id, true, now);
      return { amount: Number(bal), label:`before next paycheck: ${next}` };
    }

    while(cursor <= end){
      const iso = toISO(cursor);
      const bal = accountBalance(account.id, true, iso);
      if(bal < min){ min = bal; minDate = iso; }
      cursor.setDate(cursor.getDate()+1);
    }
    return { amount: Number(min), label:`lowest before paycheck: ${minDate} (${money(min)})` };
  }

  const projected = accountBalance(account.id, true, toISO(addMonths(new Date(),1)));
  return { amount: Number(projected), label:"next 30 days" };
}
function visibleTransactionsForAccount(accountId, untilISO="2999-12-31"){
  return expandedTransactions(untilISO).filter(tx=>tx.accountId===accountId || tx.transferToAccountId===accountId);
}
function visibleTransactionsForDebt(debtId, untilISO="2999-12-31"){
  return expandedTransactions(untilISO).filter(tx=>tx.debtAccountId===debtId || tx.linkedDebtId===debtId);
}


function accountOutflowBetween(accountId, startISO, endISO){
  return expandedTransactions(endISO)
    .filter(tx => tx.date >= startISO && tx.date <= endISO)
    .reduce((sum, tx) => {
      if(tx.accountId === accountId && tx.type !== "income" && tx.type !== "paycheck"){
        return sum + Number(tx.amount || 0);
      }
      return sum;
    }, 0);
}


function accountPlannedTransfersInBetween(accountId, startISO, endISO){
  return expandedTransactions(endISO)
    .filter(tx =>
      tx.type === "transfer" &&
      tx.transferToAccountId === accountId &&
      tx.date >= startISO &&
      tx.date <= endISO &&
      tx.status !== "cleared"
    )
    .reduce((sum,tx)=>sum + Number(tx.amount || 0),0);
}

function isRecurringTransaction(tx){
  const r = tx?.recurrence || (tx?.repeat ? { type:"monthly", interval:1 } : { type:"none" });
  return !!r && r.type !== "none";
}

function accountPlannedTransfersInSummary(accountId){
  const now = todayISO();
  const next30End = toISO(addMonths(new Date(), 1));
  const recurringHorizon = toISO(addMonths(new Date(), 12));
  const next30 = accountPlannedTransfersInBetween(accountId, now, next30End);

  // "All planned" can be truly all for one-time transfers. Recurring transfers are
  // open-ended, so include the next 12 months unless a series ends sooner.
  const generatedThroughHorizon = expandedTransactions(recurringHorizon)
    .filter(tx =>
      tx.type === "transfer" &&
      tx.transferToAccountId === accountId &&
      tx.date >= now &&
      tx.status !== "cleared"
    )
    .reduce((sum, tx)=>sum + Number(tx.amount || 0), 0);

  const farOneTime = (data.transactions || [])
    .filter(tx =>
      tx.type === "transfer" &&
      tx.transferToAccountId === accountId &&
      tx.status !== "cleared" &&
      !isRecurringTransaction(tx) &&
      tx.date > recurringHorizon
    )
    .reduce((sum, tx)=>sum + Number(tx.amount || 0), 0);

  return { all: generatedThroughHorizon + farOneTime, next30 };
}

function billsMetricForAccount(account){
  const now = todayISO();

  if(isSavingsAccount(account)){
    const planned = accountPlannedTransfersInSummary(account.id);
    return {
      label: "Planned Transfers In",
      amount: planned.all,
      sub: `${money(planned.next30)} next 30 days`
    };
  }

  if(account.id === "joint-checking"){
    const horizon = toISO(addMonths(new Date(), 1));
    let min = Infinity, minDate = now;
    let cursor = new Date(now + "T12:00:00");

    while(toISO(cursor) <= horizon){
      const iso = toISO(cursor);
      const bal = accountBalance(account.id, true, iso);
      if(bal < min){
        min = bal;
        minDate = iso;
      }
      cursor.setDate(cursor.getDate()+1);
    }

    return {
      label: "Bills Before Low Day",
      amount: accountOutflowBetween(account.id, now, minDate),
      sub: `lowest day: ${minDate}`
    };
  }

  if(account.paycheckAccount){
    const next = nextPaycheckDate(account.id, false);
    const dayBeforeNext = toISO(addDays(parseDate(next), -1));
    const end = parseDate(dayBeforeNext) < parseDate(now) ? now : dayBeforeNext;

    return {
      label: "Bills Until Payday",
      amount: accountOutflowBetween(account.id, now, end),
      sub: `next paycheck: ${next}`
    };
  }

  const horizon = toISO(addMonths(new Date(), 1));
  return {
    label: "Bills Next 30 Days",
    amount: accountOutflowBetween(account.id, now, horizon),
    sub: "next 30 days"
  };
}



function recentPlaceKey(place){
  return `${place.view || ""}:${place.id || ""}:${place.extra || ""}`;
}
function recentPlaceTitle(place){
  if(place.title) return place.title;
  if(place.view === "accountDetail") return accountById(place.id)?.name || "Account";
  if(place.view === "debtDetail") return debtById(place.id)?.name || "Debt";
  if(place.view === "calendar") return `Calendar`;
  if(place.view === "bills") return "Bills";
  if(place.view === "accounts") return "Accounts";
  if(place.view === "debts") return "Debts";
  if(place.view === "budgets") return "Budgets";
  return place.view ? place.view[0].toUpperCase() + place.view.slice(1) : "Place";
}
function recentPlaceIcon(place){
  if(place.view === "accountDetail") return accountById(place.id)?.emoji || "💵";
  if(place.view === "debtDetail") return debtById(place.id)?.emoji || "💳";
  if(place.view === "calendar") return "📅";
  if(place.view === "bills") return "🔁";
  if(place.view === "accounts") return "💵";
  if(place.view === "debts") return "💳";
  if(place.view === "budgets") return "📊";
  return "📍";
}
function recentPlaceSub(place){
  if(place.view === "accountDetail"){
    const a = accountById(place.id);
    return a ? `${a.owner} • account` : "account";
  }
  if(place.view === "debtDetail"){
    const d = debtById(place.id);
    return d ? `${d.type} • ${d.owner}` : "debt";
  }
  if(place.view === "calendar"){
    return `${calendarDate.toLocaleString(undefined,{month:"long", year:"numeric"})}${calendarFilter !== "all" ? ` • ${accountById(calendarFilter)?.name || ""}` : ""}`;
  }
  return "page";
}
function currentPlaceForView(view){
  // Recent Places should only track specific detail pages.
  // Top-level pages are already one click away in the sidebar.
  if(view === "accountDetail" && selectedAccountId){
    return {view, id:selectedAccountId, title:accountById(selectedAccountId)?.name || "Account"};
  }
  if(view === "debtDetail" && selectedDebtId){
    return {view, id:selectedDebtId, title:debtById(selectedDebtId)?.name || "Debt"};
  }
  return null;
}
function trackRecentPlace(view){
  if(suppressRecentTracking) return;
  const place = currentPlaceForView(view);
  if(!place) return;

  const key = recentPlaceKey(place);
  recentPlaces = [place, ...recentPlaces.filter(p=>recentPlaceKey(p)!==key)].slice(0,3);
  try{ localStorage.setItem(`${STORAGE_KEY}.recentPlaces`, JSON.stringify(recentPlaces)); } catch(err){}
  renderRecentPlaces();
}
function loadRecentPlaces(){
  try{
    recentPlaces = JSON.parse(localStorage.getItem(`${STORAGE_KEY}.recentPlaces`) || "[]")
      .filter(p => p && (p.view === "accountDetail" || p.view === "debtDetail") && p.id)
      .slice(0,3);
  } catch(err){
    recentPlaces = [];
  }
}
function goRecentPlace(index){
  const place = recentPlaces[index];
  if(!place) return;

  suppressRecentTracking = true;
  if(place.view === "accountDetail"){
    selectedAccountId = place.id;
    setView("accountDetail");
  } else if(place.view === "debtDetail"){
    selectedDebtId = place.id;
    setView("debtDetail");
  } else {
    setView(place.view);
  }
  suppressRecentTracking = false;
}
function renderRecentPlaces(){
  try{
  if(typeof recentPlaces === "undefined") return;
  const list = document.getElementById("recentPlacesList");
  if(!list) return;

  if(!recentPlaces.length){
    list.innerHTML = `<div class="recent-empty">No recent places yet.</div>`;
    return;
  }

  list.innerHTML = recentPlaces.map((place,index)=>`
    <button type="button" class="recent-place" onclick="goRecentPlace(${index})">
      <span class="recent-icon">${recentPlaceIcon(place)}</span>
      <span class="recent-copy">
        <b>${recentPlaceTitle(place)}</b>
        <small>${recentPlaceSub(place)}</small>
      </span>
    </button>
  `).join("");
  } catch(err){
    console.warn("Recent places could not render", err);
  }
}

function setView(view){
  try{
    // v2-212: Debts is now part of Accounts. Keep old internal links/back targets working.
    if(view === "debts") view = "accounts";
    currentView = view;
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id===view));
    document.body.classList.remove("money-nest-view-dashboard", "money-nest-view-future", "money-nest-view-calendar", "money-nest-view-accounts", "money-nest-view-budgets", "money-nest-view-bills", "money-nest-view-debts", "money-nest-view-settings", "money-nest-view-accountDetail", "money-nest-view-debtDetail");
    document.body.classList.add(`money-nest-view-${view}`);
    const navView = ["accountDetail","debtDetail"].includes(view) ? "accounts" : view;
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.view===navView));
    const mobileMore=document.getElementById("mobileMoreNavBtn");
    if(mobileMore) mobileMore.classList.toggle("active", ["calendar","budgets","bills","settings"].includes(view));
    const titles = {accountDetail: accountById(selectedAccountId)?.name || "Account", debtDetail: debtById(selectedDebtId)?.name || "Debt"};
    const titleEl = document.getElementById("viewTitle");
    if(titleEl) titleEl.textContent = titles[view] || view[0].toUpperCase()+view.slice(1);
    render();
    trackRecentPlace(view);
  } catch(err){
    console.error("View render failed:", view, err);
    const titleEl = document.getElementById("viewTitle");
    if(titleEl) titleEl.textContent = "Error";
    alert(`This page hit an error: ${err.message || err}`);
  }
}

function setupContextMenuEvents(){
  document.addEventListener("click", (e)=>{
    const menu = document.getElementById("txContextMenu");
    if(menu && !menu.contains(e.target)) hideTxContextMenu();
  });
  document.addEventListener("keydown", e=>{ if(e.key === "Escape") hideTxContextMenu(); });

  const menu = document.getElementById("txContextMenu");
  if(menu){
    menu.addEventListener("click", e=>e.stopPropagation());
    menu.addEventListener("mousedown", e=>e.stopPropagation());
  }

  const toggle = document.getElementById("ctxToggleCleared");
  if(toggle) toggle.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    const meta = {...contextTxMeta};
    if(id){ hideTxContextMenu(); toggleCleared(id, meta); }
  };

  const useCard = document.getElementById("ctxUseCardInstead");
  if(useCard) useCard.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    const meta = {...contextTxMeta};
    if(id){ hideTxContextMenu(); useCardInstead(id, meta); }
  };

  const createCardPayment = document.getElementById("ctxCreateCardPayment");
  if(createCardPayment) createCardPayment.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    const meta = {...contextTxMeta};
    if(id){ hideTxContextMenu(); createCardPaymentForCharge(id, meta); }
  };

  const markReimbursed = document.getElementById("ctxMarkReimbursed");
  if(markReimbursed) markReimbursed.style.display = "none";

  const duplicate = document.getElementById("ctxDuplicate");
  if(duplicate) duplicate.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    if(id){ hideTxContextMenu(); duplicateTransaction(id); }
  };

  const edit = document.getElementById("ctxEdit");
  if(edit) edit.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    const meta = {...contextTxMeta};
    if(id){
      hideTxContextMenu();
      openTransaction(id, meta.originalDate || meta.occurrenceDate ? {
        generated:true,
        occurrenceOriginalDate: meta.originalDate || meta.occurrenceDate,
        occurrenceDate: meta.occurrenceDate || meta.originalDate
      } : {});
    }
  };

  const del = document.getElementById("ctxDelete");
  if(del) del.onclick = (e)=>{
    e.stopPropagation();
    const id = contextTxId;
    if(id){ hideTxContextMenu(); deleteTransactionById(id); }
  };
}


function render(){
  renderSelectors();
  renderRecentPlaces();
  if(currentView==="dashboard") renderDashboard();
  if(currentView==="future") renderMobileFuture();
  if(currentView==="calendar") renderCalendar();
  if(currentView==="accounts") renderAccounts();
  if(currentView==="accountDetail") renderAccountDetail();
  if(currentView==="budgets") renderBudgets();
  if(currentView==="bills") renderBills();
  if(currentView==="debtDetail") renderDebtDetail();
  if(currentView==="settings") renderSettings();
}


function nextDebtDueDate(d, fromISO=todayISO()){
  if(!d.dueDate) return "";
  const from = parseDate(fromISO);
  const original = parseDate(d.dueDate);
  let candidate = new Date(from.getFullYear(), from.getMonth(), original.getDate(), 12);

  // Handles due dates like the 31st in shorter months by using last day of month.
  const maxDay = endOfMonth(candidate).getDate();
  candidate.setDate(Math.min(original.getDate(), maxDay));

  if(candidate < from){
    candidate = addMonths(candidate, 1);
    const maxNext = endOfMonth(candidate).getDate();
    candidate.setDate(Math.min(original.getDate(), maxNext));
  }
  return toISO(candidate);
}
function debtDashboardDueDate(d, fromISO=todayISO()){
  // BNPL/Klarna installments should use the actual next planned installment
  // transaction instead of a manually-entered debt due day. Otherwise the
  // dashboard can claim "no planned payment found" while the installment
  // rows clearly exist on the debt detail page.
  if(isBNPLDebt(d)){
    const next = bnplNextPayment(d.id);
    if(next?.date) return next.date;
  }
  if(isMedicalDebt(d)){
    const next = medicalNextPayment(d);
    if(next?.date) return next.date;
  }
  return nextDebtDueDate(d, fromISO);
}
function normalizeMatchText(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function debtPaymentMatches(d, tx){
  if(!d || !tx || tx.type !== "transfer") return false;
  if(tx.linkedDebtId === d.id || tx.debtAccountId === d.id) return true;

  // Fallback for older/manual payments that were entered as transfers but did not
  // keep a stable linkedDebtId. This lets early planned payments like
  // "Ty PlayStation6229" count as handled for the matching card/debt without
  // requiring an exact due-date match.
  const haystack = normalizeMatchText([tx.title, tx.notes, tx.linkedDebtId, tx.debtAccountId].filter(Boolean).join(" "));
  const debtNames = [d.id, d.name, `${d.owner || ""} ${d.name || ""}`]
    .map(normalizeMatchText)
    .filter(Boolean);
  return !!haystack && debtNames.some(name => name.length >= 4 && haystack.includes(name));
}
function debtPaymentSearchWindow(d, dueISO){
  const dueDate = parseDate(dueISO);
  const beforeDays = isBNPLDebt(d) ? 60 : 35;
  const afterDays = isBNPLDebt(d) ? 7 : 0;
  return {
    start: toISO(addDays(dueDate, -beforeDays)),
    end: toISO(addDays(dueDate, afterDays))
  };
}
function plannedDebtPaymentInfo(d, dueISO){
  if(!d || !dueISO) return null;
  const window = debtPaymentSearchWindow(d, dueISO);
  const today = todayISO();
  const candidates = expandedTransactions(window.end)
    .filter(tx =>
      debtPaymentMatches(d, tx) &&
      tx.date >= window.start &&
      tx.date <= window.end &&
      ["planned", "cleared"].includes(tx.status)
    )
    .sort((a,b)=>{
      const aPlanned = a.status !== "cleared" ? 0 : 1;
      const bPlanned = b.status !== "cleared" ? 0 : 1;
      const aFuture = a.status !== "cleared" && a.date >= today ? 0 : 1;
      const bFuture = b.status !== "cleared" && b.date >= today ? 0 : 1;
      return aPlanned - bPlanned || aFuture - bFuture || a.date.localeCompare(b.date);
    });
  return candidates[0] || null;
}
function hasPlannedDebtPayment(d, dueISO){
  return !!plannedDebtPaymentInfo(d, dueISO);
}
function pastPlannedNeedsAttention(tx, graceDays=7){
  if(!tx || tx.status !== "planned" || !tx.date) return false;
  const cutoff = toISO(addDays(parseDate(todayISO()), -Math.max(0, Number(graceDays || 0))));
  return tx.date < cutoff;
}
function creditCardRelevantDueDate(d, fromISO=todayISO()){
  if(!d || d.type !== "Credit Card" || !d.dueDate) return "";
  // When a statement date is known, keep the due date tied to that statement cycle.
  // This lets a genuinely missed payment stay overdue instead of silently rolling to next month.
  if(d.statementDate) return nextDebtDueDate(d, d.statementDate);
  return nextDebtDueDate(d, fromISO);
}
function activeRecurringDebtPaymentSeries(d, asOfISO=todayISO()){
  if(!d) return null;
  return (data.transactions || []).find(tx =>
    isRecurring(tx) &&
    debtPaymentMatches(d, tx) &&
    !tx.billArchived &&
    (!tx.recurrenceUntil || tx.recurrenceUntil >= asOfISO)
  ) || null;
}
function creditCardPaymentForDue(d, dueISO){
  if(!d || d.type !== "Credit Card" || !dueISO) return null;
  const previousDue = toISO(addMonthsClamped(parseDate(dueISO), -1));
  const cycleStart = toISO(addDays(parseDate(previousDue), 1));
  const candidates = expandedTransactions(dueISO)
    .filter(tx =>
      debtPaymentMatches(d, tx) &&
      tx.date >= cycleStart &&
      tx.date <= dueISO &&
      ["planned", "cleared"].includes(tx.status)
    )
    .sort((a,b)=>{
      const aPlanned = a.status === "planned" ? 0 : 1;
      const bPlanned = b.status === "planned" ? 0 : 1;
      return aPlanned - bPlanned || String(a.date || "").localeCompare(String(b.date || ""));
    });
  return candidates[0] || null;
}
function automaticCreditCardPaymentInfo(d){
  if(!d || d.type !== "Credit Card") return {status:d?.paymentStatus || "not-set", dueDate:"", paymentTx:null, recurringTx:null};
  const statementBalance = Number(d.statementBalance || 0);
  const minDue = Number(d.minDue || 0);
  const dueDate = creditCardRelevantDueDate(d);

  if(statementBalance <= 0.005 && minDue <= 0.005){
    return {status:"paid", dueDate, paymentTx:null, recurringTx:null, reason:"zero-due"};
  }

  const recurringTx = activeRecurringDebtPaymentSeries(d);
  if(recurringTx){
    return {status:"autopay", dueDate, paymentTx:null, recurringTx, reason:"recurring"};
  }

  const paymentTx = creditCardPaymentForDue(d, dueDate);
  if(paymentTx?.status === "planned") return {status:"scheduled", dueDate, paymentTx, recurringTx:null, reason:"planned"};
  if(paymentTx?.status === "cleared") return {status:"paid", dueDate, paymentTx, recurringTx:null, reason:"cleared"};

  return {status:"unpaid", dueDate, paymentTx:null, recurringTx:null, reason:dueDate ? "no-payment" : "missing-due-date"};
}
function debtPaymentsDueSoon(days=30){
  const start = todayISO();
  const end = toISO(addDays(parseDate(start), days));
  return data.debts
    .map(d => ({...d, nextDue: d.type === "Credit Card" ? creditCardRelevantDueDate(d, start) : debtDashboardDueDate(d, start)}))
    .filter(d => d.nextDue && d.nextDue >= start && d.nextDue <= end && debtDashboardNeedsPaymentPlanning(d))
    .sort((a,b)=>a.nextDue.localeCompare(b.nextDue));
}

function nextCreditCardStatementDate(d, fromISO=todayISO()){
  if(!d || d.type !== "Credit Card" || !d.statementDate) return "";
  // A statement reminder should mean "the next statement after the statement date you entered."
  // Do not roll this forward automatically forever, because if the user has not updated the
  // statement date yet, the dashboard should show it as past due / needs checking.
  return toISO(addMonths(parseDate(d.statementDate), 1));
}

function creditCardStatementsToCheck(days=7){
  const start = todayISO();
  const end = toISO(addDays(parseDate(start), days));
  return data.debts
    .filter(d => d.type === "Credit Card" && d.statementDate)
    .map(d => ({...d, nextStatementDate: nextCreditCardStatementDate(d, start)}))
    .filter(d => d.nextStatementDate && d.nextStatementDate <= end)
    .sort((a,b)=>a.nextStatementDate.localeCompare(b.nextStatementDate) || (a.name || "").localeCompare(b.name || ""));
}

function debtDashboardAmountDue(d){
  if(!d) return 0;
  if(isBNPLDebt(d)) return bnplRemainingBalance(d.id, toISO(addMonths(new Date(),24)));
  return debtAmountLeftNow(d);
}
function debtDashboardNeedsPaymentPlanning(d){
  if(!d) return false;
  if(isBNPLDebt(d)) return !!bnplNextPayment(d.id);
  if(isMedicalDebt(d)) return !!medicalNextPayment(d) || debtDashboardAmountDue(d) > 0.005;
  if(d.type === "Credit Card" && Number(d.statementBalance || 0) <= 0.005 && Number(d.minDue || 0) <= 0.005) return false;
  return debtDashboardAmountDue(d) > 0.005 || Number(d.minDue || 0) > 0.005;
}
function debtDashboardPaymentHandled(d, dueISO){
  if(!d || !dueISO) return false;
  if(d.type === "Credit Card") return ["paid", "autopay", "scheduled"].includes(debtDisplayPaymentStatus(d));
  if(["paid", "autopay", "scheduled", "skip"].includes(d.paymentStatus)) return true;
  return !!plannedDebtPaymentInfo(d, dueISO);
}
function clearedLoanPaymentsMissingBreakdown(){
  return expandedTransactions(todayISO())
    .filter(tx => tx.status === "cleared" && tx.type === "transfer" && Number(tx.amount || 0) > 0)
    .filter(tx => {
      const debt=debtById(tx.linkedDebtId);
      return debt && isLoanDebt(debt) && !loanPaymentBreakdownComplete(tx);
    })
    .sort((a,b)=>String(b.date || "").localeCompare(String(a.date || "")) || String(a.id || "").localeCompare(String(b.id || "")));
}
function loanPaymentReviewAction(tx){
  const id=tx.originalId || tx.id;
  const originalDate=tx.originalDate || tx.date || "";
  const occurrenceDate=tx.date || originalDate;
  return `openTransaction('${id}',{generated:${!!tx.generated}, occurrenceOriginalDate:'${originalDate}', occurrenceDate:'${occurrenceDate}'})`;
}

function dashboardNeedsAttention(){
  const items = [];
  const today = todayISO();

  data.accounts.filter(a=>!isSavingsAccount(a)).forEach(a=>{
    const safe = safeToSpend(a);
    if(safe.amount <= 0){
      items.push({level:"bad", title:`${a.name} safe to spend is ${money(safe.amount)}`, sub:safe.label, action:`openAccountDetail('${a.id}', 'dashboard')`});
    }
  });

  expandedTransactions(today)
    .filter(tx => pastPlannedNeedsAttention(tx, 7))
    .slice(0,5)
    .forEach(tx=>{
      items.push({level:"warn", title:`Past planned: ${tx.title}`, sub:`${tx.date} • ${money(tx.amount)} • ${transactionAccountText(tx)}`, action:`openTransaction('${tx.originalId || tx.id}')`});
    });

  const missingLoanBreakdowns=clearedLoanPaymentsMissingBreakdown();
  if(missingLoanBreakdowns.length){
    const first=missingLoanBreakdowns[0];
    items.push({
      level:"warn",
      title:`${missingLoanBreakdowns.length} cleared loan payment${missingLoanBreakdowns.length === 1 ? "" : "s"} missing breakdown`,
      sub:"Enter Principal, Interest, and Fees (use 0 when applicable) so future loan estimates can learn from the payment.",
      action:loanPaymentReviewAction(first)
    });
  }

  data.debts.forEach(d=>{
    const debtRoute = debtAttentionAccountText(d);
    const needsPaymentPlanning = debtDashboardNeedsPaymentPlanning(d);
    if((d.type === "Credit Card" || d.type === "Klarna") && !d.dueDate && !isBNPLDebt(d) && needsPaymentPlanning){
      items.push({level:"warn", title:`${d.name} missing due date`, sub:`${debtRoute} • Add a due date for reminders`, action:`openDebtDetail('${d.id}')`});
    }
    if((d.type === "Credit Card" || d.type === "Klarna") && !Number(d.minDue || 0) && !isBNPLDebt(d) && needsPaymentPlanning){
      items.push({level:"warn", title:`${d.name} missing minimum due`, sub:`${debtRoute} • Add min due for payment planning`, action:`openDebtDetail('${d.id}')`});
    }
    const due = d.type === "Credit Card" ? creditCardRelevantDueDate(d) : debtDashboardDueDate(d);
    const autoCardStatus = d.type === "Credit Card" ? debtDisplayPaymentStatus(d) : "";
    if(d.type === "Credit Card"){
      if(due && due <= toISO(addDays(parseDate(today), 7)) && needsPaymentPlanning && autoCardStatus === "unpaid"){
        const overdue = due < today;
        items.push({level:"bad", title:`${d.name} unpaid`, sub:`${debtRoute} • ${overdue ? "Was due" : "Due"} ${due} • no scheduled payment found`, action:`openDebtDetail('${d.id}')`});
      }
    } else if(due && due <= toISO(addDays(parseDate(today), 7)) && needsPaymentPlanning && !debtDashboardPaymentHandled(d, due)){
      items.push({level:"bad", title:`${d.name} due soon`, sub:`${debtRoute} • Due ${due} • no planned payment found`, action:`openDebtDetail('${d.id}')`});
    }
  });

  return items.slice(0,8);
}

function mobileCashAccounts(){
  return orderedAccounts().filter(a=>!isSavingsAccount(a));
}
function mobileFriendlyDate(iso){
  if(!iso) return "—";
  if(iso===todayISO()) return "Today";
  if(iso===toISO(addDays(parseDate(todayISO()),1))) return "Tomorrow";
  try{return parseDate(iso).toLocaleDateString(undefined,{month:"short",day:"numeric"});}
  catch(err){return iso;}
}
function mobileTransactionDateLabel(tx){
  if(!tx) return "—";
  return tx.overrideFrom ? `${mobileFriendlyDate(tx.date)} • moved from ${mobileFriendlyDate(tx.overrideFrom)}` : mobileFriendlyDate(tx.date);
}
function mobileForecastFloor(accountId, days=30, spendAmount=0, spendDate=todayISO()){
  const start=todayISO();
  const end=toISO(addDays(parseDate(start), Number(days || 30)));
  let min=Infinity, minDate=start;
  let cursor=parseDate(start);
  while(toISO(cursor) <= end){
    const iso=toISO(cursor);
    let bal=accountBalance(accountId, true, iso);
    if(Number(spendAmount || 0) > 0 && iso >= (spendDate || start)) bal -= Number(spendAmount || 0);
    if(bal < min){ min=bal; minDate=iso; }
    cursor=addDays(cursor,1);
  }
  return {amount:Number.isFinite(min)?Number(min):0,date:minDate,end};
}
function mobileFutureAccount(){
  const accounts=mobileCashAccounts();
  if(!accounts.length) return null;
  if(!mobileFutureAccountId || !accounts.some(a=>a.id===mobileFutureAccountId)){
    mobileFutureAccountId = accounts.find(a=>a.id === "joint-checking")?.id || accounts[0].id;
  }
  return accountById(mobileFutureAccountId) || accounts[0];
}
function setMobileFutureAccount(id){
  mobileFutureAccountId=id || "";
  renderMobileFuture();
}
window.setMobileFutureAccount=setMobileFutureAccount;
function setMobileFutureHorizon(days){
  mobileFutureHorizonDays=[14,30,60,90].includes(Number(days)) ? Number(days) : 30;
  renderMobileFuture();
}
window.setMobileFutureHorizon=setMobileFutureHorizon;
function updateMobileWhatIf(){
  const result=document.getElementById("mobileWhatIfResult");
  const amount=Number(document.getElementById("mobileWhatIfAmount")?.value || 0);
  const date=document.getElementById("mobileWhatIfDate")?.value || todayISO();
  const account=mobileFutureAccount();
  if(!result || !account) return;
  if(!(amount > 0)){
    result.innerHTML='<span>Enter an amount to preview the impact without saving anything.</span>';
    result.className="mobile-whatif-result";
    return;
  }
  const floor=mobileForecastFloor(account.id, mobileFutureHorizonDays, amount, date);
  const currentFloor=mobileForecastFloor(account.id, mobileFutureHorizonDays);
  const level=floor.amount < 0 ? "bad" : floor.amount < 75 ? "warn" : "good";
  result.className=`mobile-whatif-result ${level}`;
  result.innerHTML=`<span>After spending <b>${money(amount)}</b> from ${escapeAttr(account.name)} on ${escapeAttr(mobileFriendlyDate(date))}:</span><strong>${money(floor.amount)}</strong><small>lowest projected balance on ${escapeAttr(mobileFriendlyDate(floor.date))} • ${money(Math.max(0,currentFloor.amount-floor.amount))} less cushion</small>`;
}
window.updateMobileWhatIf=updateMobileWhatIf;
function renderMobileHome({attention=[],cashSafe=[],lowestSafe=null}={}){
  const el=document.getElementById("mobileHome");
  if(!el) return;
  const accounts=mobileCashAccounts();
  const defaultAccount=lowestSafe?.a || accounts[0] || null;
  const upcoming=expandedTransactions(toISO(addDays(parseDate(todayISO()),14)))
    .filter(tx=>tx.date>=todayISO() && tx.status!=="cleared")
    .sort((a,b)=>a.date.localeCompare(b.date) || String(a.title||"").localeCompare(String(b.title||"")))
    .slice(0,4);
  const safeChips=cashSafe.map(({a,s})=>`<button type="button" class="mobile-safe-chip" onclick="setMobileFutureAccount('${a.id}');setView('future')"><span>${a.emoji||"💵"} ${escapeAttr(a.name)}</span><b class="${s.amount>75?'good':s.amount>0?'warn':'bad'}">${money(s.amount)}</b></button>`).join("");
  el.innerHTML=`
    <section class="mobile-home-hero ${lowestSafe?.s.amount<=0?'has-alert':''}">
      <div class="mobile-home-hero-top"><span><small>SAFE TO SPEND</small><b>${lowestSafe?.a ? `${lowestSafe.a.emoji||"💵"} ${escapeAttr(lowestSafe.a.name)}` : "No cash account"}</b></span><button type="button" class="mobile-text-btn" onclick="setView('future')">View future →</button></div>
      <strong class="mobile-safe-amount ${lowestSafe?.s.amount>75?'good':lowestSafe?.s.amount>0?'warn':'bad'}">${lowestSafe?money(lowestSafe.s.amount):'—'}</strong>
      <p>${lowestSafe ? escapeAttr(lowestSafe.s.label) : 'Add a cash account to start forecasting.'}</p>
      ${safeChips ? `<div class="mobile-safe-chips">${safeChips}</div>` : ""}
    </section>

    <section class="mobile-home-actions" aria-label="Quick actions">
      <button type="button" class="primary" onclick="openTransaction(null,{accountId:'${defaultAccount?.id||''}'})"><span>＋</span><b>Transaction</b></button>
      <button type="button" onclick="openTransaction(null,{type:'transfer',accountId:'${defaultAccount?.id||''}'})"><span>↔</span><b>Transfer</b></button>
      <button type="button" onclick="setView('future')"><span>🔮</span><b>Future</b></button>
      <button type="button" onclick="openGlobalSearch()"><span>⌕</span><b>Search</b></button>
    </section>

    <section class="mobile-home-section">
      <div class="mobile-home-section-head"><div><small>COMING UP</small><h3>Next transactions</h3></div><button type="button" class="mobile-text-btn" onclick="setView('future')">See future</button></div>
      <div class="mobile-home-list">${upcoming.length ? upcoming.map(tx=>{
        const cat=categoryById(tx.categoryId);
        const positive=tx.type==="income"||tx.type==="paycheck"||(tx.type==="transfer"&&tx.transferToAccountId&&!tx.accountId);
        return `<button type="button" onclick="openTransaction('${tx.originalId||tx.id}',{generated:${!!tx.generated},occurrenceOriginalDate:'${tx.originalDate||tx.date}',occurrenceDate:'${tx.date}'})"><span><b>${cat.emoji||"•"} ${escapeAttr(tx.title||"Untitled")}</b><small>${escapeAttr(mobileTransactionDateLabel(tx))} • ${escapeAttr(transactionAccountText(tx))}</small></span><strong class="${positive?'good':'bad'}">${positive?'+':'-'}${money(tx.amount)}</strong></button>`;
      }).join("") : '<div class="mobile-home-empty">Nothing planned in the next 14 days.</div>'}</div>
    </section>

    ${attention.length ? `<button type="button" class="mobile-attention-strip" onclick="toggleMobileDashboardDetails()"><span>⚠️</span><span><b>${attention.length} item${attention.length===1?'':'s'} need attention</b><small>Tap to show the full review tools</small></span><span>›</span></button>` : ""}
  `;
}
function toggleMobileDashboardDetails(){
  document.getElementById("dashboard")?.classList.toggle("mobile-dashboard-details-open");
}
window.toggleMobileDashboardDetails=toggleMobileDashboardDetails;
function renderMobileFuture(){
  const el=document.getElementById("mobileFutureContent");
  if(!el) return;
  const accounts=mobileCashAccounts();
  const account=mobileFutureAccount();
  if(!account){
    el.innerHTML='<div class="panel"><div class="empty">Add a cash account before using Future.</div></div>';
    return;
  }
  const floor=mobileForecastFloor(account.id,mobileFutureHorizonDays);
  const current=accountBalance(account.id,false,todayISO());
  const safe=safeToSpend(account);
  const end=floor.end;
  const planned=forecastWindowTransactions(account.id,end)
    .filter(tx=>tx.status!=="cleared")
    .sort((a,b)=>{
      const aPast=a.date<todayISO(), bPast=b.date<todayISO();
      if(aPast !== bPast) return aPast ? -1 : 1;
      if(aPast && bPast) return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date) || accountTransactionSortRank(a,account.id)-accountTransactionSortRank(b,account.id);
    })
    .slice(0,12);
  const accountOptions=accounts.map(a=>`<option value="${a.id}" ${a.id===account.id?'selected':''}>${escapeAttr(a.emoji||"💵")} ${escapeAttr(a.name)}</option>`).join("");
  const cushions=accounts.map(a=>{const s=safeToSpend(a);return `<button type="button" class="mobile-cushion-row ${a.id===account.id?'active':''}" onclick="setMobileFutureAccount('${a.id}')"><span><b>${a.emoji||"💵"} ${escapeAttr(a.name)}</b><small>${escapeAttr(s.label)}</small></span><strong class="${s.amount>75?'good':s.amount>0?'warn':'bad'}">${money(s.amount)}</strong></button>`}).join("");
  el.innerHTML=`
    <section class="mobile-future-hero">
      <div class="mobile-future-controls">
        <label>Account<select onchange="setMobileFutureAccount(this.value)">${accountOptions}</select></label>
        <div class="mobile-horizon-tabs" role="group" aria-label="Forecast range">${[14,30,60,90].map(d=>`<button type="button" class="${mobileFutureHorizonDays===d?'active':''}" onclick="setMobileFutureHorizon(${d})">${d}d</button>`).join("")}</div>
      </div>
      <div class="mobile-future-floor"><span><small>LOWEST PROJECTED</small><b>${escapeAttr(mobileFriendlyDate(floor.date))}</b></span><strong class="${floor.amount>75?'good':floor.amount>0?'warn':'bad'}">${money(floor.amount)}</strong></div>
      <div class="mobile-future-stats"><div><span>Current</span><b>${money(current)}</b></div><div><span>Safe to spend</span><b class="${safe.amount>75?'good':safe.amount>0?'warn':'bad'}">${money(safe.amount)}</b></div></div>
      <div class="mobile-future-actions"><button type="button" class="primary" onclick="openTransaction(null,{accountId:'${account.id}'})">+ Transaction</button><button type="button" onclick="openTransferFromAccount('${account.id}')">↔ Move money</button></div>
    </section>

    <details class="mobile-whatif" open>
      <summary><span><b>What if I have to spend?</b><small>Preview it without creating a transaction.</small></span><span>⌄</span></summary>
      <div class="mobile-whatif-body"><div class="mobile-whatif-fields"><label>Amount<input id="mobileWhatIfAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" oninput="updateMobileWhatIf()"></label><label>Date<input id="mobileWhatIfDate" type="date" value="${todayISO()}" min="${todayISO()}" max="${end}" onchange="updateMobileWhatIf()"></label></div><div id="mobileWhatIfResult" class="mobile-whatif-result"><span>Enter an amount to preview the impact without saving anything.</span></div></div>
    </details>

    <section class="mobile-home-section mobile-future-timeline">
      <div class="mobile-home-section-head"><div><small>PLANNED CASHFLOW</small><h3>Through ${escapeAttr(mobileFriendlyDate(end))}</h3></div></div>
      <div class="mobile-home-list">${planned.length ? planned.map(tx=>{
        const incoming=tx.type==="income"||tx.type==="paycheck"||(tx.type==="transfer"&&tx.transferToAccountId===account.id);
        const outgoing=(tx.accountId===account.id && tx.type!=="income"&&tx.type!=="paycheck");
        const sign=incoming?'+':outgoing?'-':'';
        return `<button type="button" onclick="openTransaction('${tx.originalId||tx.id}',{generated:${!!tx.generated},occurrenceOriginalDate:'${tx.originalDate||tx.date}',occurrenceDate:'${tx.date}'})"><span><b>${escapeAttr(tx.title||"Untitled")}</b><small>${tx.date<todayISO()?'Past planned • ':''}${escapeAttr(mobileFriendlyDate(tx.date))} • ${escapeAttr(transactionAccountText(tx))}</small></span><strong class="${incoming?'good':outgoing?'bad':''}">${sign}${money(tx.amount)}</strong></button>`;
      }).join("") : '<div class="mobile-home-empty">No planned activity in this range.</div>'}</div>
    </section>

    <details class="mobile-cushions">
      <summary><span><b>Other cash cushions</b><small>See where money has room before moving it.</small></span><span>⌄</span></summary>
      <div>${cushions}</div>
    </details>
  `;
}
function openMobileMore(){
  const modal=document.getElementById("mobileMoreModal");
  if(modal && !modal.open) modal.showModal();
}
function closeMobileMore(){ document.getElementById("mobileMoreModal")?.close(); }
window.openMobileMore=openMobileMore;
window.closeMobileMore=closeMobileMore;

function renderDashboard(){
  try{
    const attention = dashboardNeedsAttention();
    const dueSoon = debtPaymentsDueSoon(30);
    const dueSoonRows = dueSoon.slice(0, 6);
    const dueSoonExtra = Math.max(0, dueSoon.length - dueSoonRows.length);
    const statementsToCheck = creditCardStatementsToCheck(7);
    const statementRows = statementsToCheck.slice(0, 6);
    const statementExtra = Math.max(0, statementsToCheck.length - statementRows.length);
    const cashAccounts = orderedAccounts().filter(a=>!isSavingsAccount(a));
    const cashSafe = cashAccounts.map(a=>({a,s:safeToSpend(a)}));
    const lowestSafe = cashSafe.slice().sort((x,y)=>x.s.amount-y.s.amount)[0];
    const overdrawCount = cashSafe.filter(x=>x.s.amount <= 0).length;

    document.getElementById("summaryCards").innerHTML = `
      <article class="dashboard-metric ${attention.length ? "has-alert" : ""}">
        <span class="dashboard-metric-icon" aria-hidden="true">⚠️</span>
        <div><p class="eyebrow">Needs attention</p><div class="value">${attention.length}</div><p class="sub">${attention.length ? "item(s) to review" : "nothing urgent"}</p></div>
      </article>
      <article class="dashboard-metric">
        <span class="dashboard-metric-icon" aria-hidden="true">💳</span>
        <div><p class="eyebrow">Debt due soon</p><div class="value">${dueSoon.length}</div><p class="sub">next 30 days</p></div>
      </article>
      <article class="dashboard-metric ${overdrawCount ? "has-alert" : ""}">
        <span class="dashboard-metric-icon" aria-hidden="true">📉</span>
        <div><p class="eyebrow">Overdraw risk</p><div class="value">${overdrawCount}</div><p class="sub">accounts at $0 or less safe</p></div>
      </article>
      <article class="dashboard-metric">
        <span class="dashboard-metric-icon" aria-hidden="true">📄</span>
        <div><p class="eyebrow">Statements to check</p><div class="value">${statementsToCheck.length}</div><p class="sub">past due + next 7 days</p></div>
      </article>`;

    const quick=document.getElementById("mobileQuickReview");
    if(quick){
      const next=expandedTransactions(toISO(addDays(parseDate(todayISO()),14))).filter(t=>t.date>=todayISO()&&t.status!=="cleared"&&isBudgetReviewOutflow({...t,status:"cleared"})).sort((a,b)=>a.date.localeCompare(b.date))[0];
      const bs=budgetReviewStats(todayISO().slice(0,7),"all");
      quick.innerHTML=`<button onclick="setView('accounts')"><span>Safe to spend</span><b>${lowestSafe?money(lowestSafe.s.amount):'—'}</b><small>${lowestSafe?.a.name||'No cash account'}</small></button><button onclick="setView('bills')"><span>Next bill</span><b>${next?money(next.amount):'—'}</b><small>${next?`${next.title} • ${next.date}`:'Nothing upcoming'}</small></button><button onclick="setView('budgets')"><span>Month spending</span><b>${money(bs.totalSpent)}</b><small>${bs.overBudgetCount} budget(s) over</small></button>`;
    }

    renderMobileHome({attention,cashSafe,lowestSafe});

    const safeList = cashSafe.filter(({a})=>a.id !== lowestSafe?.a.id).map(({a,s})=>`<button type="button" class="dashboard-list-row dashboard-safe-row" onclick="openAccountDetail('${a.id}', 'dashboard')">
      <span class="dashboard-list-main"><b>${a.emoji || "💵"} ${a.name}</b><small>${s.label}</small></span>
      <strong class="amount ${s.amount>75?'good':s.amount>0?'warn':'bad'}">${money(s.amount)}</strong>
    </button>`).join("");
    document.getElementById("safeSpendList").innerHTML = lowestSafe ? `
      <button type="button" class="dashboard-safe-hero" onclick="openAccountDetail('${lowestSafe.a.id}', 'dashboard')">
        <span><small>Lowest cash cushion</small><b>${lowestSafe.a.emoji || "💵"} ${lowestSafe.a.name}</b><em>${lowestSafe.s.label}</em></span>
        <strong class="amount ${lowestSafe.s.amount>75?'good':lowestSafe.s.amount>0?'warn':'bad'}">${money(lowestSafe.s.amount)}</strong>
      </button>
      ${safeList ? `<div class="dashboard-flat-list">${safeList}</div>` : ""}` : `<div class="empty">No cash accounts yet.</div>`;

    const upcomingEnd = toISO(addDays(parseDate(todayISO()), 14));
    const allUpcoming = expandedTransactions(toISO(addMonths(parseDate(todayISO()), 1)))
      .filter(tx => tx.date >= todayISO() && tx.date <= upcomingEnd && tx.status !== "cleared");
    const upcoming = allUpcoming.slice(0,6);
    const upcomingExtra = Math.max(0, allUpcoming.length - upcoming.length);

    document.getElementById("upcomingList").innerHTML = upcoming.length ? `<div class="dashboard-flat-list">${upcoming.map(tx=>{
      const cat = categoryById(tx.categoryId);
      const acctText = transactionAccountText(tx);
      const isPositive = tx.type === "income" || tx.type === "paycheck";
      return `<button type="button" class="dashboard-list-row dashboard-upcoming-row" data-tx="${tx.originalId || tx.id}" data-generated="${!!tx.generated}" data-original-date="${tx.originalDate || tx.date}" data-occurrence-date="${tx.date}" onclick="openTransaction('${tx.originalId || tx.id}',{generated:${!!tx.generated}, occurrenceOriginalDate:'${tx.originalDate || tx.date}', occurrenceDate:'${tx.date}'})">
        <span class="dashboard-list-main"><b>${cat.emoji} ${tx.title}</b><small>${displayDateWithOverride(tx)} • ${cat.name} • ${acctText}</small></span>
        <strong class="amount ${isPositive?'good':'bad'}">${isPositive?'+':'-'}${money(tx.amount)}</strong>
      </button>`;
    }).join("")}</div>${upcomingExtra ? `<button type="button" class="dashboard-more-link" onclick="setView('calendar')">View ${upcomingExtra} more upcoming transaction${upcomingExtra===1?'':'s'} →</button>` : ""}` : `<div class="empty">No upcoming transactions in the next 14 days.</div>`;

    document.getElementById("debtSnapshot").innerHTML = `
      <div class="dashboard-action-groups">
        <details class="dashboard-action-group attention-group">
          <summary><span><b>⚠️ Needs attention</b><small>${attention.length ? "Items that may need a decision or correction" : "Nothing urgent right now"}</small></span><span class="dashboard-action-count">${attention.length}</span></summary>
          <div class="dashboard-action-body">
            <div class="action-list-v2 dashboard-flat-list">
              ${attention.length ? attention.map(item=>`<button type="button" class="action-row-v2 dashboard-action-row ${item.level}" onclick="${item.action}">
                <span class="action-left"><span class="action-symbol">${item.level==="bad" ? "🚨" : "⚠️"}</span><span><b class="row-title">${item.title}</b><small class="row-sub">${item.sub}</small></span></span>
              </button>`).join("") : `<div class="empty">Nothing needs attention right now.</div>`}
            </div>
          </div>
        </details>

        <details class="dashboard-action-group">
          <summary><span><b>💳 Debt payments due soon</b><small>Next 30 days${dueSoonExtra ? ` • ${dueSoonExtra} more beyond the preview` : ""}</small></span><span class="dashboard-action-count">${dueSoon.length}</span></summary>
          <div class="dashboard-action-body">
            <div class="action-list-v2 dashboard-flat-list">
              ${dueSoonRows.length ? dueSoonRows.map(d=>{
                const isCard = d.type === "Credit Card";
                const autoInfo = isCard ? automaticCreditCardPaymentInfo(d) : null;
                const plannedTx = isCard ? autoInfo?.paymentTx : plannedDebtPaymentInfo(d, d.nextDue);
                const planned = !!plannedTx;
                const paidEarly = plannedTx?.status === "cleared";
                const plannedEarly = plannedTx?.status !== "cleared" && plannedTx?.date && d.nextDue && plannedTx.date < d.nextDue;
                const displayStatus = isCard ? autoInfo.status : (planned ? (paidEarly ? "paid" : "scheduled") : debtDisplayPaymentStatus(d));
                const route = debtAttentionAccountText(d, plannedTx || autoInfo?.recurringTx);
                const label = isCard ? debtPaymentStatusLabel(displayStatus) : (planned ? (paidEarly ? "Paid early" : plannedEarly ? "Planned early" : "Planned") : debtPaymentStatusLabel(displayStatus));
                return `<button type="button" class="action-row-v2 dashboard-action-row debt-due" onclick="openDebtDetail('${d.id}')">
                  <span class="action-left"><span class="action-symbol">${d.emoji || "💳"}</span><span><b class="row-title">${d.name}</b><small class="row-sub">Due ${d.nextDue} • Min ${debtMinDueText(d)}</small><small class="row-sub">${route}</small></span></span>
                  <span class="debt-status-pill ${debtPaymentStatusClass(displayStatus)}">${label}</span>
                </button>`;
              }).join("") : `<div class="empty">No debt due dates in the next 30 days.</div>`}
            </div>
            ${dueSoonExtra ? `<button type="button" class="dashboard-more-link" onclick="setView('accounts')">Review ${dueSoonExtra} more in Accounts →</button>` : ""}
          </div>
        </details>

        <details class="dashboard-action-group">
          <summary><span><b>📄 Credit card statements</b><small>Past due + next 7 days${statementExtra ? ` • ${statementExtra} more beyond the preview` : ""}</small></span><span class="dashboard-action-count">${statementsToCheck.length}</span></summary>
          <div class="dashboard-action-body">
            <div class="action-list-v2 dashboard-flat-list">
              ${statementRows.length ? statementRows.map(d=>{
                const statementUpcoming = d.nextStatementDate > todayISO();
                return `<button type="button" class="action-row-v2 dashboard-action-row" onclick="openDebtDetail('${d.id}')">
                  <span class="action-left"><span class="action-symbol">${d.emoji || "💳"}</span><span><b class="row-title">${d.name}</b><small class="row-sub">${d.nextStatementDate < todayISO() ? "Past due / check" : "Expected around"} ${d.nextStatementDate}${d.statementBalance ? ` • previous ${money(d.statementBalance)}` : ""}</small></span></span>
                  <span class="debt-status-pill ${statementUpcoming ? "warn" : "bad"}">${statementUpcoming ? "Upcoming" : "Check"}</span>
                </button>`;
              }).join("") : `<div class="empty">No credit card statements past due or expected in the next 7 days.</div>`}
            </div>
            ${statementExtra ? `<button type="button" class="dashboard-more-link" onclick="setView('accounts')">Review ${statementExtra} more in Accounts →</button>` : ""}
          </div>
        </details>
      </div>`;

    attachTransactionContextMenus();
  } catch(err){
    console.error("Dashboard render failed", err);
    document.getElementById("summaryCards").innerHTML = `<div class="empty">Dashboard hit an error: ${err.message}</div>`;
    document.getElementById("safeSpendList").innerHTML = "";
    document.getElementById("upcomingList").innerHTML = "";
    document.getElementById("debtSnapshot").innerHTML = "";
  }
}

function moveTransactionOccurrence(id, originalDate, newDate){
  let tx = data.transactions.find(t => t.id === id);

  // Generated repeating occurrence IDs are baseId-YYYY-MM-DD.
  // Base IDs can contain hyphens, so use the longest matching base id.
  if(!tx){
    tx = data.transactions
      .filter(t => id === t.id || id.startsWith(t.id + "-"))
      .sort((a,b)=>b.id.length - a.id.length)[0];
  }

  if(!tx) return;

  const isRepeating = tx.recurrence?.type && tx.recurrence.type !== "none";
  const occurrenceOriginalDate = originalDate || tx.date;

  if(isRepeating){
    tx.dateOverrides ||= {};
    tx.dateOverrides[occurrenceOriginalDate] = newDate;

    // A cleared recurring occurrence has its own occurrence override. That override
    // stores the cleared transaction's displayed date, so update it together with
    // dateOverrides or it would overwrite the newly dragged date during expansion.
    const occurrenceOverride = tx.occurrenceOverrides?.[occurrenceOriginalDate];
    if(occurrenceOverride && !occurrenceOverride.deleted){
      occurrenceOverride.date = newDate;
    }
  } else {
    tx.date = newDate;
  }

  saveData();
  renderCalendar();
}


function isCalendarHighlightAll(){
  return !calendarHighlightCategories.length || calendarHighlightCategories.includes("all");
}
function calendarHighlightMatches(tx){
  return isCalendarHighlightAll() || calendarHighlightCategories.includes(tx.categoryId);
}
function calendarHighlightSelectLabel(){
  if(isCalendarHighlightAll()) return "All categories";
  if(calendarHighlightCategories.length === 1){
    return categoryById(calendarHighlightCategories[0]).name;
  }
  return `${calendarHighlightCategories.length} categories`;
}


function calendarDisplayEntries(rawTxs){
  const checkingAccountIds = data.accounts
    .filter(a => a.name.toLowerCase().includes("checking") && !a.name.toLowerCase().includes("savings"))
    .map(a => a.id);

  const entries = [];

  rawTxs.forEach(tx=>{
    if(tx.type === "transfer" && tx.transferToAccountId){
      const fromIsChecking = checkingAccountIds.includes(tx.accountId);
      const toIsChecking = checkingAccountIds.includes(tx.transferToAccountId);

      if(calendarFilter === "all"){
        if(fromIsChecking){
          entries.push({...tx, calendarSide:"out", calendarAccountId:tx.accountId, calendarAmountSign:-1});
        }
        if(toIsChecking){
          entries.push({...tx, calendarSide:"in", calendarAccountId:tx.transferToAccountId, calendarAmountSign:1});
        }
        return;
      }

      if(tx.accountId === calendarFilter){
        entries.push({...tx, calendarSide:"out", calendarAccountId:tx.accountId, calendarAmountSign:-1});
        return;
      }

      if(tx.transferToAccountId === calendarFilter){
        entries.push({...tx, calendarSide:"in", calendarAccountId:tx.transferToAccountId, calendarAmountSign:1});
        return;
      }

      return;
    }

    if(calendarFilter === "all"){
      if(checkingAccountIds.includes(tx.accountId)){
        const sign = (tx.type === "income" || tx.type === "paycheck") ? 1 : -1;
        entries.push({...tx, calendarSide:"normal", calendarAccountId:tx.accountId, calendarAmountSign:sign});
      }
      return;
    }

    if(tx.accountId === calendarFilter){
      const sign = (tx.type === "income" || tx.type === "paycheck") ? 1 : -1;
      entries.push({...tx, calendarSide:"normal", calendarAccountId:tx.accountId, calendarAmountSign:sign});
    }
  });

  return entries;
}
function calendarEntryLabel(tx){
  if(tx.type === "transfer"){
    return transactionTransferLabel(tx);
  }
  return tx.title;
}
function calendarEntryIsPositive(tx){
  return Number(tx.calendarAmountSign || 0) > 0;
}

function renderCalendar(){
  renderCalendarFilter();
  const monthStart = startOfMonth(calendarDate);
  document.getElementById("monthLabel").textContent = monthStart.toLocaleString(undefined,{month:"long", year:"numeric"});
  const first = new Date(monthStart); first.setDate(first.getDate() - first.getDay());
  const last = new Date(first); last.setDate(first.getDate()+41);
  const heads = ["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=>`<div class="day-head">${d}</div>`).join("");
  const checkingAccountIds = data.accounts
    .filter(a => a.name.toLowerCase().includes("checking") && !a.name.toLowerCase().includes("savings"))
    .map(a => a.id);
  const rawTxs = expandedTransactions(toISO(addMonths(monthStart,2))).filter(tx =>
    calendarFilter==="all"
      ? (checkingAccountIds.includes(tx.accountId) || checkingAccountIds.includes(tx.transferToAccountId))
      : (tx.accountId===calendarFilter || tx.transferToAccountId===calendarFilter)
  );
  const txs = calendarDisplayEntries(rawTxs);

  const renderChip = (tx, extraClass="")=>{
    const cat = categoryById(tx.categoryId);
    const highlighted = calendarHighlightMatches(tx);
    const softColor = hexToSoft(cat.color);
    const style = highlighted
      ? `--chip-bg:${softColor}; --chip-outline:${cat.color}; border-left-color:${cat.color}; background:${softColor}`
      : `--chip-bg:rgba(160,150,140,.14); --chip-outline:#b8b1a8; border-left-color:#b8b1a8; background:rgba(160,150,140,.14)`;
    const isPositive = calendarEntryIsPositive(tx);
    const chipStatus = tx.status === "cleared" ? "cleared" : "planned";
    return `<div class="tx-chip ${extraClass} ${chipStatus} ${highlighted ? "" : "muted-category"}" draggable="true" style="${style}" data-tx="${tx.originalId || tx.id}" data-generated="${!!tx.generated}" data-original-date="${tx.originalDate || tx.date}" data-occurrence-date="${tx.date}" data-calendar-side="${tx.calendarSide || ""}" data-calendar-account="${tx.calendarAccountId || ""}">
      <span class="tx-name">${highlighted ? cat.emoji : "◦"} ${calendarEntryLabel(tx)}<small class="chip-meta">${accountById(tx.calendarAccountId || tx.accountId)?.name || "Unknown account"} • ${tx.status === "cleared" ? "Cleared" : "Planned"}</small></span>
      <span class="tx-chip-amount">${isPositive?'+':'-'}${money(tx.amount)}</span>
      <button type="button" class="tx-touch-actions" aria-label="Transaction quick actions" onclick="event.preventDefault();event.stopPropagation();showTxActionsFromButton(this)">•••</button>
    </div>`;
  };

  const checkingAccounts = data.accounts.filter(a => a.name.toLowerCase().includes("checking") && !a.name.toLowerCase().includes("savings"));
  const priorISO = toISO(addDays(first, -1));
  let runningCalendarBalance = calendarFilter==="all"
    ? checkingAccounts.reduce((s,a)=>s+accountBalance(a.id,true,priorISO),0)
    : accountBalance(calendarFilter,true,priorISO);

  const calendarDays = [];
  let cursor = new Date(first);
  while(cursor <= last){
    const iso = toISO(cursor);
    const dayTx = txs.filter(tx=>tx.date===iso);

    // Calendar balances now advance from the same visible account-perspective entries
    // shown on the calendar. This prevents recurring transfer/paycheck display from
    // disagreeing with the day balance.
    const dayDelta = dayTx.reduce((sum,tx)=>sum + (Number(tx.calendarAmountSign || 0) * Number(tx.amount || 0)), 0);
    runningCalendarBalance += dayDelta;
    const projectedTotal = runningCalendarBalance;
    calendarDays.push({date:new Date(cursor), iso, dayTx, projectedTotal});
    cursor.setDate(cursor.getDate()+1);
  }

  const currentMonthDays = calendarDays.filter(day => day.date.getMonth() === monthStart.getMonth());
  const monthBalances = currentMonthDays.map(day => Number(day.projectedTotal || 0));
  const lowestMonthBalance = monthBalances.length ? Math.min(...monthBalances) : null;
  const highestMonthBalance = monthBalances.length ? Math.max(...monthBalances) : null;

  let html = heads;
  calendarDays.forEach(day => {
    const mobileCalendar = window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
    const densityLimit = 3;
    const visibleTx = mobileCalendar ? day.dayTx : day.dayTx.slice(0,densityLimit);
    const hiddenCount = mobileCalendar ? 0 : Math.max(0, day.dayTx.length - visibleTx.length);
    const isCurrentMonth = day.date.getMonth() === monthStart.getMonth();
    const isLowestBalance = isCurrentMonth && lowestMonthBalance !== null && Number(day.projectedTotal || 0) === lowestMonthBalance;
    const isHighestBalance = isCurrentMonth && highestMonthBalance !== null && Number(day.projectedTotal || 0) === highestMonthBalance && highestMonthBalance !== lowestMonthBalance;
    const isToday = day.iso === todayISO();
    const dayClasses = ["day"];
    if(!isCurrentMonth) dayClasses.push("other");
    if(isLowestBalance) dayClasses.push("lowest-balance-day");
    if(isHighestBalance) dayClasses.push("highest-balance-day");
    if(isToday) dayClasses.push("today-day");

    html += `<div class="${dayClasses.join(" ")}" data-day="${day.iso}" tabindex="0">
      <div class="day-top"><span class="day-num">${day.date.getDate()}</span><span class="day-balance">${money(day.projectedTotal)}</span></div>
      ${visibleTx.map(tx=>renderChip(tx)).join("")}
      ${hiddenCount ? `<button type="button" class="more-chip more-badge" onclick="event.stopPropagation(); openDayModal('${day.iso}')">+${hiddenCount} more</button>
        <div class="day-hover-list">
          ${day.dayTx.map(tx=>renderChip(tx, "hover-chip")).join("")}
        </div>` : ""}
    </div>`;
  });

  document.getElementById("calendarGrid").innerHTML = html;
  document.querySelectorAll(".tx-chip").forEach(chip=>chip.addEventListener("click",(e)=>{
    e.stopPropagation();
    openTransaction(chip.dataset.tx,{
      generated: chip.dataset.generated === "true",
      occurrenceOriginalDate: chip.dataset.originalDate || "",
      occurrenceDate: chip.dataset.occurrenceDate || ""
    });
  }));
  document.querySelectorAll(".day[data-day]").forEach(day=>day.addEventListener("click",(e)=>{
    if(e.target.closest(".tx-chip") || e.target.closest(".more-chip") || e.target.closest(".day-hover-list")) return;
    openDayModal(day.dataset.day);
  }));

  document.querySelectorAll(".tx-chip").forEach(chip=>{
    chip.addEventListener("dragstart",(e)=>{
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({
        id: chip.dataset.tx,
        originalDate: chip.dataset.originalDate || chip.closest(".day")?.dataset.day || "",
        date: chip.closest(".day")?.dataset.day || ""
      }));
      document.body.classList.add("dragging-tx");
    });
    chip.addEventListener("dragend",()=>{
      document.body.classList.remove("dragging-tx");
      document.querySelectorAll(".day.drop-target").forEach(d=>d.classList.remove("drop-target"));
    });
  });

  const handleDragOver = (e)=>{
    const day = e.target.closest(".day[data-day]");
    if(!day) return;
    e.preventDefault();
    if(e.dataTransfer) e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".day.drop-target").forEach(d=>{ if(d!==day) d.classList.remove("drop-target"); });
    day.classList.add("drop-target");
  };

  const handleDrop = (e)=>{
    const day = e.target.closest(".day[data-day]");
    if(!day) return;
    e.preventDefault();
    e.stopPropagation();
    try{
      const payload = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveTransactionOccurrence(payload.id, payload.originalDate || payload.date, day.dataset.day);
    } catch(err){
      console.error("Drop failed", err);
    } finally {
      document.body.classList.remove("dragging-tx");
      document.querySelectorAll(".day.drop-target").forEach(d=>d.classList.remove("drop-target"));
    }
  };

  document.querySelectorAll(".day[data-day], .day-hover-list").forEach(el=>{
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("drop", handleDrop);
    el.addEventListener("dragleave", e=>{
      const day = e.target.closest(".day[data-day]");
      if(day && !day.contains(e.relatedTarget)) day.classList.remove("drop-target");
    });
  });
  const calGrid = document.getElementById("calendarGrid");
  calGrid.addEventListener("dragover", handleDragOver);
  calGrid.addEventListener("drop", handleDrop);

  attachTransactionContextMenus();
}

function renderCalendarFilter(){
  const select = document.getElementById("calendarAccountFilter");
  const highlightSelect = document.getElementById("calendarCategoryHighlight");
  const highlightBtn = document.getElementById("calendarCategoryHighlightBtn");
  const highlightMenu = document.getElementById("calendarCategoryHighlightMenu");

  const calendarAccounts = data.accounts.filter(a => {
    const name = a.name.toLowerCase();
    return name.includes("checking") && !name.includes("savings");
  });

  if(select){
    const opts = [`<option value="all">All checking accounts</option>`]
      .concat(calendarAccounts.map(a=>`<option value="${a.id}">${a.name}</option>`));
    select.innerHTML = opts.join("");

    if(calendarFilter !== "all" && !calendarAccounts.some(a => a.id === calendarFilter)){
      calendarFilter = "all";
      saveUiPrefs();
    }
    select.value = calendarFilter;
  }

  const normalizeCalendarHighlightCategories = ()=>{
    const validIds = data.categories.map(c=>c.id);
    const normalizedHighlightCategories = calendarHighlightCategories.filter(id => id === "all" || validIds.includes(id));
    if(normalizedHighlightCategories.join("|") !== calendarHighlightCategories.join("|")){
      calendarHighlightCategories = normalizedHighlightCategories.length ? normalizedHighlightCategories : ["all"];
      saveUiPrefs();
    }
    if(!calendarHighlightCategories.length) calendarHighlightCategories = ["all"];
  };

  normalizeCalendarHighlightCategories();

  if(highlightBtn && highlightMenu){
    highlightBtn.textContent = calendarHighlightSelectLabel();
    highlightBtn.title = calendarHighlightSelectLabel();

    const rows = [
      `<label class="check-row"><input type="checkbox" value="all" ${isCalendarHighlightAll() ? "checked" : ""}> <span>All categories</span></label>`,
      ...sortedCategories().map(c=>`<label class="check-row"><input type="checkbox" value="${c.id}" ${calendarHighlightCategories.includes(c.id) ? "checked" : ""}> <span>${c.emoji} ${c.name}</span></label>`)
    ];
    highlightMenu.innerHTML = rows.join("");

    highlightMenu.querySelectorAll("input[type='checkbox']").forEach(input=>{
      input.onchange = ()=>{
        let selected = [...highlightMenu.querySelectorAll("input[type='checkbox']:checked")].map(i=>i.value);

        if(input.value === "all" && input.checked){
          selected = ["all"];
        } else {
          selected = selected.filter(v=>v !== "all");
        }

        calendarHighlightCategories = selected.length ? selected : ["all"];
        saveUiPrefs();
        renderCalendar();
        document.getElementById("calendarCategoryHighlightDropdown")?.classList.add("open");
      };
    });
  }

  // Legacy fallback if an older index.html still has the native multi-select.
  if(highlightSelect){
    highlightSelect.innerHTML = [`<option value="all">All categories</option>`]
      .concat(sortedCategories().map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`))
      .join("");
    [...highlightSelect.options].forEach(opt=>{
      opt.selected = calendarHighlightCategories.includes(opt.value);
    });
    highlightSelect.title = calendarHighlightSelectLabel();
  }
}
function hexToSoft(hex){
  const h = hex.replace("#","");
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},.20)`;
}


function orderedAccounts(){
  return [...data.accounts].sort((a,b)=>(a.order ?? 0) - (b.order ?? 0));
}
function orderedDebts(list=data.debts){
  return [...list].sort((a,b)=>(a.order ?? 0) - (b.order ?? 0));
}
function reorderItems(collection, draggedId, targetId){
  const items = collection.sort((a,b)=>(a.order ?? 0) - (b.order ?? 0));
  const from = items.findIndex(x=>x.id === draggedId);
  const to = items.findIndex(x=>x.id === targetId);
  if(from < 0 || to < 0 || from === to) return;
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  items.forEach((item, index)=>item.order = index);
  saveData();
}
function setupReorder(selector, kind){
  document.querySelectorAll(selector).forEach(card=>{
    card.addEventListener("dragstart", e=>{
      e.dataTransfer.setData("text/plain", JSON.stringify({kind, id:card.dataset.id}));
    });
    card.addEventListener("dragover", e=>e.preventDefault());
    card.addEventListener("drop", e=>{
      e.preventDefault();
      try{
        const payload = JSON.parse(e.dataTransfer.getData("text/plain"));
        if(payload.kind !== kind) return;
        if(kind === "account") reorderItems(data.accounts, payload.id, card.dataset.id);
        if(kind === "debt") reorderItems(data.debts, payload.id, card.dataset.id);
      } catch(err){
        console.error("Reorder failed", err);
      }
    });
  });
}


window.moveAccount = (id, direction)=>{
  const ordered = orderedAccounts();
  const index = ordered.findIndex(a=>a.id === id);
  const target = index + Number(direction || 0);
  if(index < 0 || target < 0 || target >= ordered.length) return;
  const [moved] = ordered.splice(index, 1);
  ordered.splice(target, 0, moved);
  ordered.forEach((a, i)=>a.order = i);
  saveData();
  renderAccounts();
};

window.toggleAccountReorderMode = ()=>{
  accountReorderMode = !accountReorderMode;
  renderAccounts();
};

function renderAccounts(){
  const reorderBtn = document.getElementById("toggleAccountReorderBtn");
  if(reorderBtn){
    reorderBtn.textContent = accountReorderMode ? "Done arranging" : "Arrange";
    reorderBtn.classList.toggle("active", accountReorderMode);
  }
  const ordered = orderedAccounts();
  document.getElementById("accountList").innerHTML = ordered.map((a,index)=>`
    <div class="account-card tinted-card ${accountReorderMode ? "is-arranging" : ""}" draggable="${accountReorderMode ? "true" : "false"}" data-id="${a.id}" style="--card-color:${a.color || "#8c6f4d"}; background:${hexToSoft(a.color || "#8c6f4d")}" onclick="${accountReorderMode ? "event.preventDefault(); event.stopPropagation();" : `openAccountDetail('${a.id}', 'accounts')`}">
      <div class="account-card-main"><div class="row-title">${a.emoji || "💵"} ${a.name}</div><div class="row-sub">${a.owner} • ${a.paycheckAccount ? "personal/paycheck" : "shared/other"}</div></div>
      <div class="account-metric account-metric-actual"><div class="label">Actual</div><div class="amount">${money(accountBalance(a.id,false,todayISO()))}</div></div>
      <div class="account-metric account-metric-secondary"><div class="label">${billsMetricForAccount(a).label}</div><div class="amount ${isSavingsAccount(a) ? "good" : "bad"}">${money(billsMetricForAccount(a).amount)}</div><div class="row-sub">${billsMetricForAccount(a).sub}</div></div>
      ${isSavingsAccount(a)
        ? `<div class="account-metric account-metric-tertiary">
            <div class="label">${savingsGoalAmount(a) ? "Left to Goal" : "Goal"}</div>
            <div class="amount">${savingsGoalAmount(a) ? money(savingsGoalRemaining(a)) : "Not set"}</div>
            <div class="row-sub">${savingsGoalAmount(a) ? `${savingsGoalProgress(a)}% of ${money(savingsGoalAmount(a))}${a.goalName ? ` • ${a.goalName}` : ""}` : "set a savings goal"}</div>
          </div>`
        : `<div class="account-metric account-metric-tertiary"><div class="label">Safe</div><div class="amount good">${money(safeToSpend(a).amount)}</div></div>`}
      ${accountReorderMode ? `<div class="inline-actions account-reorder-actions">
        <button class="ghost tiny" ${index===0 ? "disabled" : ""} onclick="event.stopPropagation(); moveAccount('${a.id}', -1)" aria-label="Move ${escapeAttr(a.name)} up">↑</button>
        <button class="ghost tiny" ${index===ordered.length-1 ? "disabled" : ""} onclick="event.stopPropagation(); moveAccount('${a.id}', 1)" aria-label="Move ${escapeAttr(a.name)} down">↓</button>
      </div>` : `<span class="account-row-chevron" aria-hidden="true">›</span>`}
    </div>`).join("");
  if(accountReorderMode) setupReorder(".account-card[data-id]", "account");
  renderDebts();
}

window.openAccountDetail = (id, backTarget="accounts")=>{
  selectedAccountId=id;
  accountBackTarget = backTarget;
  setView("accountDetail");
};


function txOccurrenceKey(tx){
  return `${tx.originalId || tx.id}::${tx.originalDate || tx.date}::${tx.date}`;
}



function forecastRangeDates(range){
  const today = todayISO();
  const now = parseDate(today);

  if(range === "this-month"){
    return {start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)), label:"this month"};
  }

  if(range === "next-paycheck" && selectedAccountId){
    const acc = accountById(selectedAccountId);
    if(acc?.paycheckAccount){
      const next = nextPaycheckDate(selectedAccountId);
      return {start: today, end: next, label:`through next uncleared paycheck: ${next}`};
    }
  }

  if(range === "next-30"){
    return {start: today, end: toISO(addDays(now, 30)), label:"next 30 days"};
  }

  if(range === "next-60"){
    return {start: today, end: toISO(addDays(now, 60)), label:"next 60 days"};
  }

  if(range === "next-90"){
    return {start: today, end: toISO(addDays(now, 90)), label:"next 90 days"};
  }

  if(range === "custom"){
    const start = accountForecastCustomStart || today;
    const fallbackEnd = toISO(addDays(now, 90));
    let end = accountForecastCustomEnd || fallbackEnd;
    if(end < start) end = start;
    return {start, end, label:`custom: ${start} to ${end}`};
  }

  return {start: today, end: toISO(addDays(now, 90)), label:"next 90 days"};
}

function forecastWindowTransactions(accountId, untilISO){
  return visibleTransactionsForAccount(accountId, untilISO);
}

function forecastTxInRange(tx, rangeInfo){
  if(!tx || !rangeInfo) return false;
  if(tx.date > rangeInfo.end) return false;
  // Forecast view should not hide old still-planned items.
  // A past planned/pending bill is still part of the future cash problem until Mak clears, edits, or deletes it.
  if(tx.status !== "cleared" && tx.date < todayISO()) return true;
  return tx.date >= rangeInfo.start && tx.date <= rangeInfo.end;
}

function forecastVisibleStart(txs, rangeInfo){
  const dates = txs.map(tx => tx.date).filter(Boolean).sort();
  return dates[0] || rangeInfo.start;
}

function setAccountForecastRange(range){
  accountForecastRange = cleanAccountForecastRange(range);
  if(accountForecastRange === "custom"){
    const today = todayISO();
    if(!accountForecastCustomStart) accountForecastCustomStart = today;
    if(!accountForecastCustomEnd) accountForecastCustomEnd = toISO(addDays(parseDate(today), 90));
  }
  saveUiPrefs();
  renderAccountDetail();
}
window.setAccountForecastRange = setAccountForecastRange;
window.setAccountForecastCustomStart = (value)=>{
  accountForecastCustomStart = value || todayISO();
  if(accountForecastCustomEnd && accountForecastCustomEnd < accountForecastCustomStart) accountForecastCustomEnd = accountForecastCustomStart;
  saveUiPrefs();
  renderAccountDetail();
};
window.setAccountForecastCustomEnd = (value)=>{
  accountForecastCustomEnd = value || toISO(addDays(parseDate(todayISO()), 90));
  if(accountForecastCustomStart && accountForecastCustomEnd < accountForecastCustomStart) accountForecastCustomStart = accountForecastCustomEnd;
  saveUiPrefs();
  renderAccountDetail();
};

function renderForecastRangeControl(accountId){
  accountForecastRange = cleanAccountForecastRange(accountForecastRange);
  const acc = accountById(accountId);
  const today = todayISO();
  const customStart = accountForecastCustomStart || today;
  const customEnd = accountForecastCustomEnd || toISO(addDays(parseDate(today), 90));
  const customFields = accountForecastRange === "custom" ? `
    <div class="forecast-custom-dates">
      <label>From<input type="date" value="${escapeAttr(customStart)}" onchange="setAccountForecastCustomStart(this.value)"></label>
      <label>To<input type="date" value="${escapeAttr(customEnd)}" onchange="setAccountForecastCustomEnd(this.value)"></label>
    </div>` : "";
  return `<div class="forecast-range-control">
    <label class="forecast-range-label">Forecast range
      <select onchange="setAccountForecastRange(this.value)">
        <option value="this-month" ${accountForecastRange==="this-month"?"selected":""}>This month</option>
        ${acc?.paycheckAccount ? `<option value="next-paycheck" ${accountForecastRange==="next-paycheck"?"selected":""}>Through next paycheck</option>` : ""}
        <option value="next-30" ${accountForecastRange==="next-30"?"selected":""}>Next 30 days</option>
        <option value="next-60" ${accountForecastRange==="next-60"?"selected":""}>Next 60 days</option>
        <option value="next-90" ${accountForecastRange==="next-90"?"selected":""}>Next 90 days</option>
        <option value="custom" ${accountForecastRange==="custom"?"selected":""}>Custom dates</option>
      </select>
    </label>
    ${customFields}
  </div>`;
}


function accountTransactionSortRank(tx, accountId){
  // Same-day order for running balances:
  // 1) money coming in, 2) neutral/other, 3) money leaving.
  if(tx.type === "income" || tx.type === "paycheck") return 0;
  if(tx.type === "transfer" && tx.transferToAccountId === accountId) return 0;
  if(tx.type === "transfer" && tx.accountId === accountId) return 2;
  if(tx.accountId === accountId && tx.type === "expense") return 2;
  return 1;
}
function accountChronologicalSort(a,b,accountId){
  const d = txSortDateValue(a) - txSortDateValue(b);
  if(d) return d;
  const rank = accountTransactionSortRank(a, accountId) - accountTransactionSortRank(b, accountId);
  if(rank) return rank;
  return String(a.title || "").localeCompare(String(b.title || ""));
}
function accountReverseChronologicalSort(a,b,accountId){
  const d = txSortDateValue(b) - txSortDateValue(a);
  if(d) return d;
  const rank = accountTransactionSortRank(a, accountId) - accountTransactionSortRank(b, accountId);
  if(rank) return rank;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function accountBankBalanceMap(accountId, untilISO=todayISO()){
  const currentCleared = accountBalance(accountId, false, todayISO());
  let bal = currentCleared;
  const map = {};
  const txs = visibleTransactionsForAccount(accountId, untilISO)
    .filter(tx=>tx.status === "cleared" && tx.date <= todayISO())
    .sort((a,b)=>accountReverseChronologicalSort(a,b,accountId));

  txs.forEach(tx=>{
    map[txOccurrenceKey(tx)] = bal;
    bal -= txEffectOnCash(tx, accountId, false);
  });

  return map;
}

function accountRunningBalanceMap(accountId, untilISO="2999-12-31", visibleStartISO="1900-01-01"){
  const acc = accountById(accountId);
  if(!acc) return {};
  let bal = Number(acc.startingBalance || 0);
  const map = {};
  const txs = visibleTransactionsForAccount(accountId, untilISO)
    .sort((a,b)=>accountChronologicalSort(a,b,accountId));

  txs.forEach(tx=>{
    bal += txEffectOnCash(tx, accountId, true);
    if(tx.date >= visibleStartISO){
      map[txOccurrenceKey(tx)] = bal;
    }
  });

  return map;
}

function accountClearedBalance(accountId){
  return accountBalance(accountId, false, todayISO());
}

function accountProjectedBalance(accountId, throughISO="2999-12-31"){
  return accountBalance(accountId, true, throughISO);
}

function renderAccountBalanceCards(accountId){
  const cleared = accountClearedBalance(accountId);
  const projected30 = accountProjectedBalance(accountId, toISO(addDays(parseDate(todayISO()), 30)));
  const projected90 = accountProjectedBalance(accountId, toISO(addDays(parseDate(todayISO()), 90)));
  const expectedIn90 = pendingReimbursementsToAccount(accountId, toISO(addDays(parseDate(todayISO()), 90)));

  return `<div class="account-summary-row">
    <div><span>Current</span><strong>${money(cleared)}</strong></div>
    <div><span>30-day projected</span><strong class="${projected30 < 0 ? "bad" : ""}">${money(projected30)}</strong></div>
    <div><span>90-day projected</span><strong class="${projected90 < 0 ? "bad" : ""}">${money(projected90)}</strong></div>
    ${expectedIn90 ? `<div><span>Planned IOUs in</span><strong class="good">${money(expectedIn90)}</strong></div>` : ""}
  </div>`;
}

function renderAccountDetail(){
  const a = accountById(selectedAccountId);
  if(!a){ setView("accounts"); return; }

  const throughISO = toISO(addMonths(parseDate(todayISO()), 12));
  const txs = visibleTransactionsForAccount(a.id, throughISO);
  const filtered = filteredLedgerTransactions(txs);
  const balances = transactionFilters.status === "cleared"
    ? accountBankBalanceMap(a.id, todayISO())
    : accountRunningBalanceMap(a.id, throughISO, "1900-01-01");
  const metric = billsMetricForAccount(a);

  document.getElementById("accountDetailContent").innerHTML = `
    <div class="detail-head compact-detail-head">
      <div class="compact-account-context">
        <button class="ghost small" onclick="setView(accountBackTarget)">← Back</button>
        <div>
          <h3><span class="visual-dot" style="background:${a.color || "#8c6f4d"}"></span>${a.emoji || "💵"} ${a.name}</h3>
          <p class="hint">${a.owner}${isSavingsAccount(a)
            ? ` • Savings${savingsGoalAmount(a) ? ` • ${money(savingsGoalRemaining(a))} left to goal` : ""}`
            : ` • ${metric.label} ${money(metric.amount)} • Safe ${money(safeToSpend(a).amount)}`}</p>
        </div>
      </div>
      <div class="detail-actions detail-actions-v245">
        <button class="primary" onclick="openTransaction(null,{accountId:'${a.id}'})">+ Transaction</button>
        <button class="ghost" onclick="openTransferFromAccount('${a.id}')">↔ Transfer</button>
        <details class="detail-more-actions">
          <summary class="ghost">More</summary>
          <div class="detail-more-menu">
            <button class="ghost" onclick="openPendingReimbursement('${a.id}'); this.closest('details').removeAttribute('open')">IOU / reimbursement</button>
            <button class="ghost" onclick="simpleAccount('${a.id}'); this.closest('details').removeAttribute('open')">Edit account</button>
          </div>
        </details>
      </div>
    </div>

    ${renderAccountBalanceCards(a.id)}

    <section class="panel ledger-panel">
      <div class="panel-head ledger-panel-head">
        <div><h3>Transactions</h3><span class="hint">${filtered.length} shown of ${txs.length}</span></div>
        <button type="button" class="ghost small" onclick="toggleLedgerFilters()">${ledgerFiltersOpen ? "Hide filters" : "Filters"}</button>
      </div>
      ${ledgerFiltersOpen ? renderTransactionFilters() : ""}
      ${renderLedger(filtered, {accountId:a.id, runningBalances:balances, mode:"timeline"})}
    </section>`;
  attachTransactionContextMenus();
}

function shortAccountName(account){
  if(!account) return "account";
  const name = account.name || "account";
  if(account.owner && /checking/i.test(name)) return account.owner;
  return name.replace(/\s+checking$/i, "").trim() || name;
}
function transactionTransferLabel(tx){
  const from = tx.accountId ? shortAccountName(accountById(tx.accountId)) : tx.debtAccountId ? (debtById(tx.debtAccountId)?.name || "debt") : "No account";
  const to = tx.transferToAccountId ? shortAccountName(accountById(tx.transferToAccountId)) : tx.linkedDebtId ? (debtById(tx.linkedDebtId)?.name || "debt") : "";
  return to ? `${from} → ${to}` : from;
}
function transactionAccountText(tx){
  if(tx.type === "transfer") return transactionTransferLabel(tx);
  const fromAccount = tx.accountId ? accountById(tx.accountId)?.name : tx.debtAccountId ? debtById(tx.debtAccountId)?.name : "No account";
  const toAccount = tx.transferToAccountId ? ` → ${accountById(tx.transferToAccountId)?.name || "account"}` : tx.linkedDebtId ? ` → ${debtById(tx.linkedDebtId)?.name || "debt"}` : "";
  return `${fromAccount}${toAccount}`;
}
function debtAttentionAccountText(d, paymentTx=null){
  if(paymentTx) return transactionAccountText(paymentTx);
  const owner = d?.owner || "Unassigned";
  const company = d?.company && d.company !== d.name ? ` • ${d.company}` : "";
  return `${owner}${company} • ${d?.name || "Debt"}`;
}


function txSortDateValue(tx){
  return new Date((tx.date || "1900-01-01") + "T12:00:00").getTime();
}

function filteredLedgerTransactions(txs){
  const today = todayISO();
  let list = [...txs];

  list = list.filter(tx => {
    const statusMatch = transactionFilters.status === "all" || tx.status === transactionFilters.status;
    const categoryMatch = transactionFilters.category === "all" || tx.categoryId === transactionFilters.category;
    const typeMatch = transactionFilters.type === "all" || tx.type === transactionFilters.type;
    const searchTerm = (transactionFilters.search || "").trim().toLowerCase();
    const searchMatch = !searchTerm || `${tx.title || ""} ${tx.notes || ""} ${categoryById(tx.categoryId).name || ""}`.toLowerCase().includes(searchTerm);

    let dateMatch = true;
    if(transactionFilters.dateRange === "upcoming-90"){
      const end = toISO(addDays(parseDate(today), 90));
      dateMatch = tx.date >= today && tx.date <= end;
    } else if(transactionFilters.dateRange === "past-90"){
      const start = toISO(addDays(parseDate(today), -90));
      dateMatch = tx.date >= start && tx.date <= today;
    } else if(transactionFilters.dateRange === "this-month"){
      const start = toISO(startOfMonth(new Date()));
      const end = toISO(endOfMonth(new Date()));
      dateMatch = tx.date >= start && tx.date <= end;
    } else if(transactionFilters.dateRange === "all"){
      dateMatch = true;
    }

    return statusMatch && categoryMatch && typeMatch && searchMatch && dateMatch;
  });

  list.sort((a,b)=>{
    const aDate = txSortDateValue(a);
    const bDate = txSortDateValue(b);

    if(transactionFilters.sort === "date-asc"){
      if(currentView === "accountDetail" && selectedAccountId) return accountChronologicalSort(a,b,selectedAccountId);
      return aDate - bDate;
    }
    if(transactionFilters.sort === "date-desc"){
      if(currentView === "accountDetail" && selectedAccountId) return accountReverseChronologicalSort(a,b,selectedAccountId);
      return bDate - aDate;
    }
    if(transactionFilters.sort === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0);
    if(transactionFilters.sort === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0);
    if(transactionFilters.sort === "category") return categoryById(a.categoryId).name.localeCompare(categoryById(b.categoryId).name);

    return aDate - bDate;
  });

  return list;
}

function setTransactionFilter(key, value){
  transactionFilters[key] = value;
  if(key !== "search") saveUiPrefs();
  render();
}
window.setTransactionFilter = setTransactionFilter;
function resetTransactionFiltersToDefaults(){
  transactionFilters = {...defaultUiPrefs.transactionFilters, ...transactionFilterDefaults, search:""};
  saveUiPrefs();
  render();
}
window.resetTransactionFiltersToDefaults = resetTransactionFiltersToDefaults;

function toggleLedgerFilters(){
  ledgerFiltersOpen = !ledgerFiltersOpen;
  render();
}
window.toggleLedgerFilters = toggleLedgerFilters;

function renderTransactionFilters(options={}){
  const hideSort = !!options.hideSort;
  return `<div class="transaction-filters">
    <label>Search
      <input value="${transactionFilters.search || ""}" placeholder="Search transactions" oninput="setTransactionFilter('search', this.value)">
    </label><label>Status
      <select onchange="setTransactionFilter('status', this.value)">
        <option value="all" ${transactionFilters.status==="all"?"selected":""}>All statuses</option>
        <option value="planned" ${transactionFilters.status==="planned"?"selected":""}>Planned</option>
        <option value="cleared" ${transactionFilters.status==="cleared"?"selected":""}>Cleared</option>
      </select>
    </label>
    <label>Category
      <select onchange="setTransactionFilter('category', this.value)">
        <option value="all" ${transactionFilters.category==="all"?"selected":""}>All categories</option>
        ${data.categories.map(c=>`<option value="${c.id}" ${transactionFilters.category===c.id?"selected":""}>${c.emoji} ${c.name}</option>`).join("")}
      </select>
    </label>
    <label>Type
      <select onchange="setTransactionFilter('type', this.value)">
        <option value="all" ${transactionFilters.type==="all"?"selected":""}>All types</option>
        <option value="expense" ${transactionFilters.type==="expense"?"selected":""}>Expenses</option>
        <option value="income" ${transactionFilters.type==="income"?"selected":""}>Income</option>
        <option value="paycheck" ${transactionFilters.type==="paycheck"?"selected":""}>Paychecks</option>
        <option value="transfer" ${transactionFilters.type==="transfer"?"selected":""}>Transfers / payments</option>
      </select>
    </label>
    <label>Date range
      <select onchange="setTransactionFilter('dateRange', this.value)">
        <option value="upcoming-90" ${transactionFilters.dateRange==="upcoming-90"?"selected":""}>Upcoming 90 days</option>
        <option value="this-month" ${transactionFilters.dateRange==="this-month"?"selected":""}>This month</option>
        <option value="past-90" ${transactionFilters.dateRange==="past-90"?"selected":""}>Past 90 days</option>
        <option value="all" ${transactionFilters.dateRange==="all"?"selected":""}>All dates</option>
      </select>
    </label>    ${hideSort ? "" : `<label>Sort
      <select onchange="setTransactionFilter('sort', this.value)">
        <option value="date-asc" ${transactionFilters.sort==="date-asc"?"selected":""}>Date: soonest first</option>
        <option value="date-desc" ${transactionFilters.sort==="date-desc"?"selected":""}>Date: newest / farthest first</option>
        <option value="amount-desc" ${transactionFilters.sort==="amount-desc"?"selected":""}>Amount: high to low</option>
        <option value="amount-asc" ${transactionFilters.sort==="amount-asc"?"selected":""}>Amount: low to high</option>
        <option value="category" ${transactionFilters.sort==="category"?"selected":""}>Category A-Z</option>
      </select>
    </label>`}
    <label class="filter-reset-label">Reset
      <button type="button" class="ghost small" onclick="resetTransactionFiltersToDefaults()">Reset filters</button>
    </label>
  </div>`;
}

function renderLedger(txs, options={}){
  if(!txs.length) return `<div class="empty">No transactions yet.</div>`;
  const showBalance = !!options.accountId;
  return `<div class="ledger ${showBalance ? "with-balance" : ""}">
    <div class="ledger-row header">
      <div>Date</div><div>Title</div><div>Category</div><div>Status</div><div>Amount</div>${showBalance ? `<div>${options.mode === "bank" ? "Balance" : "Balance after"}</div>` : ""}
    </div>
    ${txs.map(tx=>{
      const cat = categoryById(tx.categoryId);
      let sign = (tx.type === "income" || tx.type === "paycheck") ? "+" : "-";
      let amountClass = (tx.type === "income" || tx.type === "paycheck") ? "good" : "bad";
      let context = isRecurring(tx) ? recurrenceDescription(tx) : "";

      if(currentView === "debtDetail" && selectedDebtId && tx.linkedDebtId === selectedDebtId && tx.type === "debt-adjustment"){
        const adj = Number(tx.loanBalanceAdjustment || 0);
        sign = adj >= 0 ? "+" : "-";
        amountClass = adj >= 0 ? "bad" : "good";
        context = `Balance adjustment${tx.notes ? ` • ${tx.notes}` : ""}`;
      } else if(currentView === "debtDetail" && selectedDebtId && tx.linkedDebtId === selectedDebtId && tx.type === "transfer"){
        sign = "+";
        amountClass = "good";
        context = `Payment from ${accountById(tx.accountId)?.name || "cash account"}${loanPaymentBreakdownText(tx) ? ` • ${loanPaymentBreakdownText(tx)}` : ""}`;
      } else if(currentView === "debtDetail" && selectedDebtId && tx.debtAccountId === selectedDebtId && tx.type === "expense"){
        sign = "-";
        amountClass = "bad";
        context = `Card/debt spend${tx.accountId ? ` from ${accountById(tx.accountId)?.name || "account"}` : ""}`;
      } else if(showBalance && isPendingReimbursementTx(tx) && tx.transferToAccountId === options.accountId){
        sign = "+";
        amountClass = "good";
        context = `Planned reimbursement from ${accountById(tx.accountId)?.name || "account"}`;
      } else if(showBalance && isPendingReimbursementTx(tx) && tx.accountId === options.accountId){
        context = `Planned reimbursement to ${accountById(tx.transferToAccountId)?.name || "account"}`;
      } else if(showBalance && tx.type === "transfer" && tx.transferToAccountId === options.accountId){
        sign = "+";
        amountClass = "good";
        context = `Transfer in from ${accountById(tx.accountId)?.name || "account"}`;
      } else if(showBalance && tx.type === "transfer" && tx.accountId === options.accountId && tx.transferToAccountId){
        context = `Transfer out to ${accountById(tx.transferToAccountId)?.name || "account"}`;
      } else if(tx.linkedDebtId){
        const linkedDebt = debtById(tx.linkedDebtId);
        if(tx.type === "debt-adjustment"){
          const adj = Number(tx.loanBalanceAdjustment || 0);
          context = `Balance adjustment for ${linkedDebt?.name || "debt"}: ${adj >= 0 ? "+" : ""}${money(adj)}`;
        } else {
          const breakdown = isLoanDebt(linkedDebt) ? loanPaymentBreakdownText(tx) : "";
          context = `Payment to ${linkedDebt?.name || "debt"}${breakdown ? ` • ${breakdown}` : ""}`;
        }
      }

      const editId = tx.originalId || tx.id;
      const balanceKey = txOccurrenceKey(tx);
      const balanceAfter = showBalance ? options.runningBalances?.[balanceKey] : null;

      return `<div class="ledger-row" data-tx="${editId}" onclick="openTransaction('${editId}',{generated:${!!tx.generated}, occurrenceOriginalDate:'${tx.originalDate || tx.date}', occurrenceDate:'${tx.date}'})">
        <div>${tx.date}</div><div><b>${tx.title}</b><div class="row-sub">${context}</div></div>
        <div><span class="cat-preview" style="background:${hexToSoft(cat.color)}">${cat.emoji} ${cat.name}</span></div>
        <div class="ledger-status-cell">${statusButton(tx)}</div>
        <div class="amount ${amountClass}">${sign}${money(tx.amount)}</div>
        ${showBalance ? `<div class="amount projected">${balanceAfter === null || balanceAfter === undefined ? "—" : money(balanceAfter)}</div>` : ""}
      </div>`;
    }).join("")}
  </div>`;
}

function budgetMonthRange(monthValue){
  const safe = /^\d{4}-\d{2}$/.test(monthValue || "") ? monthValue : todayISO().slice(0,7);
  const start = `${safe}-01`;
  return {month:safe, start, end:toISO(endOfMonth(parseDate(start))), label:parseDate(start).toLocaleString(undefined,{month:"long", year:"numeric"})};
}
function isBudgetReviewExpense(tx){
  if(!tx || tx.status !== "cleared") return false;
  if(tx.type !== "expense") return false;
  if(isPendingReimbursementTx(tx)) return false;
  return Number(tx.amount || 0) > 0;
}
function isCardBackedCategorySpend(tx){
  if(!tx || tx.status !== "cleared") return false;
  if(tx.type !== "transfer") return false;
  if(isPendingReimbursementTx(tx)) return false;
  if(!(tx.linkedDebtId || tx.debtAccountId)) return false;
  if(["banking","credit-card-payment","loan-payment"].includes(tx.categoryId || "")) return false;
  return Number(tx.amount || 0) > 0;
}
function isBudgetReviewTransferOutflow(tx){
  if(!tx || tx.status !== "cleared") return false;
  if(tx.type !== "transfer") return false;
  if(isPendingReimbursementTx(tx)) return false;
  return Number(tx.amount || 0) > 0;
}
function isBudgetExcludedCategory(categoryId){
  // Banking is only for cash-account movement and should never affect budgets.
  return categoryId === "banking";
}
function isBudgetReviewOutflow(tx){
  // Budgets are cash-account based. Debt/credit-card ledger entries may carry a
  // debt id (or no current cash account id) in accountId, so never count those
  // directly in budget totals or drill-downs.
  if(!tx || !accountById(tx.accountId)) return false;
  if(isBudgetExcludedCategory(tx.categoryId)) return false;
  if(isBudgetReviewExpense(tx)) return true;
  if(isCardBackedCategorySpend(tx)) return true;
  if(isBudgetReviewTransferOutflow(tx)) return true;
  return false;
}
function transactionBelongsToRecurringBill(tx){
  if(!tx) return false;
  if(isRecurring(tx)) return true;

  // Preserve the recurring identity on occurrence-only replacements created by
  // older/newer save paths whenever that metadata is available.
  const sourceId = tx.recurringSourceId || tx.originalId || tx.recurrenceSourceId || "";
  if(sourceId){
    const source = data.transactions.find(item => item?.id === sourceId);
    if(source && isRecurring(source)) return true;
  }
  if(tx.wasRecurringOccurrence || tx.fromRecurringBill) return true;

  // Older occurrence-only edits may have been saved as ordinary one-time rows
  // with no recurrence metadata. Match those rows back to a recurring bill by
  // routing/category/title/amount and a nearby scheduled occurrence. This uses
  // the same loose bill matching rules as the Bills page, while keeping the
  // date window narrow enough to avoid hiding unrelated purchases.
  try{
    const txDate = parseDate(tx.date || todayISO());
    return data.transactions.some(template => {
      if(!template || template.id === tx.id || !isRecurring(template)) return false;
      if(!billRouteMatches(template, tx)) return false;
      const seriesStart = parseDate(template.date);
      for(let offset=-7; offset<=7; offset++){
        const cursor = addDays(txDate, offset);
        if(cursor < seriesStart) continue;
        if(recurrenceOccursOn(template, cursor, seriesStart)) return true;
      }
      return false;
    });
  } catch(err){
    console.warn("Could not determine recurring-bill membership for budget review", tx?.title, err);
    return false;
  }
}
function budgetIncludesTransaction(tx, includeRecurringBills=budgetReviewIncludeRecurringBills){
  if(!isBudgetReviewOutflow(tx)) return false;
  const recurring = transactionBelongsToRecurringBill(tx);
  if(budgetReviewMode === "extra" && recurring) return false;
  if(budgetReviewMode === "bills" && !recurring) return false;
  if(!includeRecurringBills && recurring) return false;
  return true;
}
function budgetCategoryIds(budget){
  if(!budget) return [];
  const ids = Array.isArray(budget.categoryIds) && budget.categoryIds.length
    ? budget.categoryIds
    : (budget.categoryId ? [budget.categoryId] : []);
  return [...new Set(ids.filter(id => id && !isBudgetExcludedCategory(id)))];
}
function txMatchesBudgetCategories(tx, budget){
  return budgetCategoryIds(budget).includes(tx?.categoryId);
}
function budgetCategoryLabel(budget){
  const cats = budgetCategoryIds(budget).map(categoryById).filter(Boolean);
  const customName = String(budget?.name || "").trim();
  const customEmoji = String(budget?.emoji || "").trim();
  if(!cats.length) return {text:"Unassigned", emoji:customEmoji || "🏷️", color:"#8c6f4d", cats:[]};
  if(cats.length === 1) return {text:customName || cats[0].name, emoji:customEmoji || cats[0].emoji || "🏷️", color:cats[0].color || "#8c6f4d", cats};
  return {text:customName || cats.map(c=>c.name).join(" + "), emoji:customEmoji || "🧺", color:cats[0].color || "#8c6f4d", cats};
}
function compareBudgetsByTitle(a,b){
  const aTitle = String(budgetCategoryLabel(a)?.text || "").trim();
  const bTitle = String(budgetCategoryLabel(b)?.text || "").trim();
  return aTitle.localeCompare(bTitle, undefined, {sensitivity:"base", numeric:true});
}
function budgetTransactionAmount(tx){
  const amount = Number(tx?.amount || 0);
  if(!amount || isBudgetExcludedCategory(tx?.categoryId)) return 0;

  // Savings-category transfers are net contributions: money moved into a
  // savings account counts positive, while money moved back out reduces the
  // month's Savings spending. Transfers between two savings accounts net to 0.
  if(tx.type === "transfer" && tx.categoryId === "savings"){
    const fromSavings = isSavingsAccount(accountById(tx.accountId));
    const toSavings = isSavingsAccount(accountById(tx.transferToAccountId));
    if(toSavings && !fromSavings) return amount;
    if(fromSavings && !toSavings) return -amount;
    if(fromSavings && toSavings) return 0;
  }
  return amount;
}
function isBudgetReviewIncome(tx){
  if(!tx || tx.status !== "cleared") return false;
  return (tx.type === "income" || tx.type === "paycheck") && Number(tx.amount || 0) > 0;
}
function normalizedBudgetReviewAccountIds(accountIds=budgetReviewAccountIds){
  if(Array.isArray(accountIds)) return [...new Set(accountIds.filter(Boolean))];
  if(!accountIds || accountIds === "all") return [];
  return [accountIds];
}
function txMatchesBudgetAccount(tx, accountIds=budgetReviewAccountIds){
  const ids = normalizedBudgetReviewAccountIds(accountIds);
  return !ids.length || ids.includes(tx.accountId);
}
function budgetScopeAccountIds(budget){
  if(!budget) return [];
  if(budget.accountScope === "all") return [];
  if(budget.accountScope === "selected") return [...new Set((budget.accountIds || []).filter(Boolean))];
  return budget.accountId ? [budget.accountId] : [];
}
function txMatchesBudgetScope(tx, budget){
  if(!budget || budget.accountScope === "all" || (!budget.accountScope && !budget.accountId)) return true;
  return budgetScopeAccountIds(budget).includes(tx.accountId);
}
function budgetMatchesReviewAccount(budget, accountIds=budgetReviewAccountIds){
  const ids = normalizedBudgetReviewAccountIds(accountIds);
  if(!ids.length) return true;
  if(!budget || budget.accountScope === "all" || (!budget.accountScope && !budget.accountId)) return true;
  return budgetScopeAccountIds(budget).some(id=>ids.includes(id));
}
function budgetScopeLabel(budget){
  if(!budget || budget.accountScope === "all" || (!budget.accountScope && !budget.accountId)) return "🌐 All accounts";
  const ids = budgetScopeAccountIds(budget);
  const accounts = ids.map(accountById).filter(Boolean);
  if((budget.accountScope || "single") === "single"){
    const a = accounts[0];
    return a ? `${a.emoji || "💵"} ${a.name}` : "💵 Unknown account";
  }
  if(!accounts.length) return "👥 Selected accounts";
  return `👥 ${accounts.map(a=>a.name).join(" + ")}`;
}
function budgetReviewAccountLabel(accountIds=budgetReviewAccountIds){
  const ids = normalizedBudgetReviewAccountIds(accountIds);
  if(!ids.length) return "All accounts";
  const names = ids.map(id=>accountById(id)?.name).filter(Boolean);
  return names.length ? names.join(" + ") : "Selected accounts";
}
function piePoint(cx, cy, r, pct){
  const angle = ((pct * 3.6) - 90) * Math.PI / 180;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}
function pieSlicePath(startPct, endPct, r=20){
  const cx = 21, cy = 21;
  const [sx, sy] = piePoint(cx, cy, r, startPct);
  const [ex, ey] = piePoint(cx, cy, r, endPct);
  const largeArc = (endPct - startPct) > 50 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx.toFixed(3)} ${sy.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(3)} ${ey.toFixed(3)} Z`;
}
function spendingPieTooltip(item, pieTotal){
  const pct = pieTotal ? Math.round((item.amount / pieTotal) * 100) : 0;
  const account = budgetReviewAccountLabel();
  if(item.categoryId === "other" && item.children?.length){
    const parts = item.children.map(c=>`${c.cat.emoji} ${c.cat.name}: ${money(c.amount)}`).join("\n");
    return `${account}\nOther: ${pct}% • ${money(item.amount)}\n${parts}`;
  }
  return `${account}\n${item.cat.emoji} ${item.cat.name}: ${pct}% • ${money(item.amount)}`;
}
function budgetReviewPieData(stats){
  const total = Math.max(0, Number(stats?.totalSpent || 0));
  const categories = Array.isArray(stats?.categories) ? stats.categories : [];
  const minStandaloneAmount = 100;
  const minStandalonePct = 0.03;
  const maxSlicesBeforeOther = 12;

  let visible = [];
  let grouped = [];
  categories.forEach(item=>{
    const pct = total ? Number(item.amount || 0) / total : 0;
    const hasBudget = Number(item.budgetAmount || 0) > 0;
    const isMeaningful = hasBudget || Number(item.amount || 0) >= minStandaloneAmount || pct >= minStandalonePct;
    (isMeaningful ? visible : grouped).push(item);
  });

  if(visible.length > maxSlicesBeforeOther){
    grouped = visible.slice(maxSlicesBeforeOther).concat(grouped);
    visible = visible.slice(0, maxSlicesBeforeOther);
  }

  const otherAmount = grouped.reduce((s,c)=>s+Number(c.amount || 0),0);
  const data = visible.concat(otherAmount > 0.005 ? [{
    categoryId:"other",
    cat:{name:"Other", emoji:"➕", color:"#9c7a54"},
    amount:otherAmount,
    budgetAmount:0,
    children:grouped
  }] : []);

  return {
    data,
    grouped,
    cutoff:minStandaloneAmount,
    maxSlices:maxSlicesBeforeOther,
    note:`Categories $${minStandaloneAmount}+ or 3%+ of spending show separately; tiny categories roll into Other.`
  };
}
function budgetActualSpent(budget, monthRange, reviewAccountIds=null){
  return expandedTransactions(monthRange.end)
    .filter(tx => tx.date >= monthRange.start && tx.date <= monthRange.end)
    .filter(tx => budgetIncludesTransaction(tx, budgetReviewIncludeRecurringBills))
    .filter(tx => txMatchesBudgetCategories(tx, budget))
    .filter(tx => txMatchesBudgetScope(tx, budget))
    .filter(tx => reviewAccountIds === null || txMatchesBudgetAccount(tx, reviewAccountIds))
    .reduce((sum, tx)=>sum + budgetTransactionAmount(tx), 0);
}

function budgetAverageMonthlySpent(budget, months=6){
  const selectedStart = parseDate(`${budgetReviewMonth}-01`);
  const values = [];
  for(let i=months-1; i>=0; i--){
    const month = toISO(addMonths(selectedStart, -i)).slice(0,7);
    values.push(budgetActualSpent(budget, budgetMonthRange(month)));
  }
  const active = values.filter(v => Math.abs(Number(v || 0)) > 0.005);
  const divisor = active.length || values.length || 1;
  return {
    average: values.reduce((sum,v)=>sum+Number(v||0),0) / divisor,
    months: values.length,
    activeMonths: active.length
  };
}
function budgetReviewStats(monthValue=budgetReviewMonth, accountIds=budgetReviewAccountIds){
  const range = budgetMonthRange(monthValue);
  const monthTx = expandedTransactions(range.end).filter(tx => tx.date >= range.start && tx.date <= range.end);
  const expenses = monthTx.filter(tx => budgetIncludesTransaction(tx, budgetReviewIncludeRecurringBills)).filter(tx => txMatchesBudgetAccount(tx, accountIds));
  const income = monthTx.filter(isBudgetReviewIncome).filter(tx => txMatchesBudgetAccount(tx, accountIds));
  const budgets = (data.budgets || []).filter(b => budgetCategoryIds(b).length).filter(b => budgetMatchesReviewAccount(b, accountIds));

  const byCategory = new Map();
  expenses.forEach(tx=>{
    const key = tx.categoryId || "uncat";
    byCategory.set(key, (byCategory.get(key) || 0) + budgetTransactionAmount(tx));
  });
  const categories = [...byCategory.entries()].filter(([, amount])=>amount > 0.005).map(([categoryId, amount])=>{
    const cat = categoryById(categoryId);
    const budgetAmount = budgets.filter(b=>budgetCategoryIds(b).length === 1 && budgetCategoryIds(b)[0] === categoryId).reduce((s,b)=>s+Number(b.amount || 0),0);
    return {categoryId, cat, amount, budgetAmount, over:Math.max(0, amount-budgetAmount)};
  }).sort((a,b)=>b.amount-a.amount);

  const budgetRows = budgets.map(b=>{
    const spent = budgetActualSpent(b, range, accountIds);
    const amount = Number(b.amount || 0);
    return {
      budget:b,
      account:accountById(b.accountId),
      scopeLabel:budgetScopeLabel(b),
      cat:budgetCategoryLabel(b),
      spent,
      amount,
      left: amount - spent,
      pct: amount ? Math.round((spent / amount) * 100) : 0
    };
  }).sort((a,b)=>compareBudgetsByTitle(a.budget,b.budget));

  const totalSpent = expenses.reduce((s,tx)=>s+budgetTransactionAmount(tx),0);
  const totalIncome = income.reduce((s,tx)=>s+Number(tx.amount || 0),0);
  const totalBudgeted = budgets.reduce((s,b)=>s+Number(b.amount || 0),0);
  const budgetedCategoryIds = new Set(budgets.flatMap(b=>budgetCategoryIds(b)));
  const spentInBudgetedCategories = categories.filter(c=>budgetedCategoryIds.has(c.categoryId)).reduce((s,c)=>s+c.amount,0);
  const unbudgetedSpent = Math.max(0, totalSpent - spentInBudgetedCategories);
  const overBudgetCount = budgetRows.filter(r=>r.left < -0.005).length;

  return {range, monthTx, expenses, income, budgets, categories, budgetRows, totalSpent, totalIncome, totalBudgeted, unbudgetedSpent, overBudgetCount};
}
function budgetTrendMonths(count=6, accountIds=budgetReviewAccountIds){
  const selectedStart = parseDate(`${budgetReviewMonth}-01`);
  return Array.from({length:count}, (_,i)=>{
    const d = addMonths(selectedStart, i-(count-1));
    const range = budgetMonthRange(toISO(d).slice(0,7));
    const spent = expandedTransactions(range.end)
      .filter(tx => tx.date >= range.start && tx.date <= range.end)
      .filter(tx => budgetIncludesTransaction(tx, budgetReviewIncludeRecurringBills))
      .filter(tx => txMatchesBudgetAccount(tx, accountIds))
      .reduce((s,tx)=>s+budgetTransactionAmount(tx),0);
    return {month:range.month, label:parseDate(range.start).toLocaleString(undefined,{month:"short"}), spent};
  });
}
function setBudgetReviewMonth(value){
  budgetReviewMonth = /^\d{4}-\d{2}$/.test(value || "") ? value : todayISO().slice(0,7);
  renderBudgets();
}
window.setBudgetReviewMonth = setBudgetReviewMonth;

function setBudgetReviewMode(mode){
  budgetReviewMode = ["all","extra","bills"].includes(mode) ? mode : "all";
  budgetReviewIncludeRecurringBills = budgetReviewMode !== "extra";
  renderBudgets();
}
window.setBudgetReviewMode=setBudgetReviewMode;
function toggleBudgetReviewAccount(name){
  const match=orderedAccounts().find(a=>String(a.name||"").toLowerCase().includes(name));
  if(!match) return;
  const selected=new Set(budgetReviewAccountIds);
  if(selected.has(match.id)) selected.delete(match.id); else selected.add(match.id);
  budgetReviewAccountIds=[...selected];
  renderBudgets();
}
window.toggleBudgetReviewAccount=toggleBudgetReviewAccount;
function applyBudgetPreset(name){
  if(["all","extra","bills"].includes(name)){ setBudgetReviewMode(name); return; }
  toggleBudgetReviewAccount(name);
}
window.applyBudgetPreset=applyBudgetPreset;
function budgetAccountPresetActive(name){
  const match=orderedAccounts().find(a=>String(a.name||"").toLowerCase().includes(name));
  return !!match && budgetReviewAccountIds.includes(match.id);
}
function renderBudgetPresetBar(){
 const el=document.getElementById("budgetPresetBar"); if(!el)return;
 el.innerHTML=`<div class="budget-preset-heading"><div><b>Quick views</b><small>Choose one spending view, then combine any account buttons.</small></div></div><div class="budget-preset-buttons">
 <button class="${budgetReviewMode==='all'?'active':''}" onclick="applyBudgetPreset('all')">All spending</button>
 <button class="${budgetReviewMode==='extra'?'active':''}" onclick="applyBudgetPreset('extra')">Extra spending</button>
 <button class="${budgetReviewMode==='bills'?'active':''}" onclick="applyBudgetPreset('bills')">Bills</button>
 <span class="budget-preset-divider" aria-hidden="true"></span>
 <button class="${budgetAccountPresetActive('mak')?'active':''}" onclick="applyBudgetPreset('mak')">Mak</button>
 <button class="${budgetAccountPresetActive('ty')?'active':''}" onclick="applyBudgetPreset('ty')">Ty</button>
 <button class="${budgetAccountPresetActive('joint')?'active':''}" onclick="applyBudgetPreset('joint')">Joint</button></div>`;
}
function budgetMonthComparison(){
 const current=budgetReviewStats(); const prevMonth=toISO(addMonths(parseDate(`${budgetReviewMonth}-01`),-1)).slice(0,7); const previous=budgetReviewStats(prevMonth,budgetReviewAccountIds);
 const delta=current.totalSpent-previous.totalSpent; const pct=previous.totalSpent?Math.round(delta/previous.totalSpent*100):null;
 const currentMap=new Map(current.categories.map(c=>[c.categoryId,c.amount])); const previousMap=new Map(previous.categories.map(c=>[c.categoryId,c.amount]));
 const changes=[...new Set([...currentMap.keys(),...previousMap.keys()])].map(id=>({id,delta:(currentMap.get(id)||0)-(previousMap.get(id)||0)})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 return {previous,delta,pct,biggest:changes[0]};
}
function explainBudgetTotals(){
 const stats=budgetReviewStats(); const comp=budgetMonthComparison(); const modal=document.getElementById('budgetDetailModal'); const content=document.getElementById('budgetDetailContent');
 document.getElementById('budgetDetailTitle').textContent='🧮 Why these totals?'; document.getElementById('budgetDetailSub').textContent=`${stats.range.label} • ${budgetReviewAccountLabel()}`;
 content.innerHTML=`<section class="budget-insight-card"><h4>Spending includes</h4><p>Cleared cash-account expenses and categorized cash transfers, excluding Banking. Savings transfers are netted by direction.</p><h4>Current filters</h4><p><b>View:</b> ${budgetReviewMode==='extra'?'Extra spending only':budgetReviewMode==='bills'?'Recurring bills only':'All spending'}<br><b>Account:</b> ${budgetReviewAccountLabel()}</p><h4>Counted activity</h4><p>${stats.expenses.length} transactions total ${money(stats.totalSpent)}. Income is displayed separately and does not reduce spending totals.</p></section>`;
 if(!modal.open)modal.showModal();
}
window.explainBudgetTotals=explainBudgetTotals;

function renderBudgetReview(){
  const el = document.getElementById("budgetReview");
  if(!el) return;
  renderBudgetPresetBar();
  const stats = budgetReviewStats();
  const monthCompare = budgetMonthComparison();
  const trend = budgetTrendMonths(6, budgetReviewAccountIds);
  const maxTrend = Math.max(1, ...trend.map(t=>t.spent));
  const monthOptions = [];
  const selectedStart = parseDate(`${budgetReviewMonth}-01`);
  for(let i=-12; i<=3; i++){
    const d = addMonths(selectedStart, i);
    const value = toISO(d).slice(0,7);
    const label = parseDate(`${value}-01`).toLocaleString(undefined,{month:"short", year:"numeric"});
    monthOptions.push(`<option value="${value}" ${value===budgetReviewMonth?"selected":""}>${label}</option>`);
  }
  const budgetMood = stats.overBudgetCount
    ? `${stats.overBudgetCount} over budget`
    : (stats.budgetRows.length ? "all tracked budgets okay" : "no budgets set yet");
  const pieGroup = budgetReviewPieData(stats);
  const pieData = pieGroup.data;
  const pieTotal = Math.max(0, stats.totalSpent);
  let pieCursor = 0;
  const pieSlices = pieData.map((item, index)=>{
    const start = pieTotal ? (pieCursor / pieTotal) * 100 : 0;
    pieCursor += item.amount;
    const end = pieTotal ? (pieCursor / pieTotal) * 100 : 0;
    const title = spendingPieTooltip(item, pieTotal);
    const click = item.categoryId === "other" ? `chooseOtherBudgetCategory()` : `openCategoryBudgetDetail('${escapeAttr(item.categoryId)}')`;
    if(end - start >= 99.9){
      return `<circle cx="21" cy="21" r="20" fill="${escapeAttr(item.cat.color)}" class="spending-pie-slice" tabindex="0" role="button" onclick="${click}"><title>${escapeAttr(title)}</title></circle>`;
    }
    return `<path d="${pieSlicePath(start, end)}" fill="${escapeAttr(item.cat.color)}" class="spending-pie-slice" tabindex="0" role="button" onclick="${click}"><title>${escapeAttr(title)}</title></path>`;
  }).join("");
  const spendingPie = pieData.length ? `<div class="spending-pie-wrap">
      <svg class="spending-pie" viewBox="0 0 42 42" aria-label="Interactive spending by category pie chart"><defs><clipPath id="spendingPieClip"><circle cx="21" cy="21" r="20"></circle></clipPath></defs><g class="spending-pie-slices">${pieSlices}</g><circle cx="21" cy="21" r="9" class="spending-pie-hole"></circle></svg>
      <div class="spending-legend">
        ${pieData.map(item=>{
          const pct = pieTotal ? Math.round((item.amount / pieTotal) * 100) : 0;
          const budgetNote = item.categoryId === "other" && item.children?.length
            ? `${money(item.amount)} across ${item.children.length} smaller categories`
            : (item.budgetAmount ? `${money(item.amount)} of ${money(item.budgetAmount)}` : `${money(item.amount)} spent`);
          const click = item.categoryId === "other" ? `chooseOtherBudgetCategory()` : `openCategoryBudgetDetail('${escapeAttr(item.categoryId)}')`;
          const title = spendingPieTooltip(item, pieTotal);
          return `<button type="button" class="spending-legend-row" title="${escapeAttr(title)}" onclick="${click}">
            <span class="legend-dot" style="background:${item.cat.color}"></span>
            <span class="legend-name">${item.cat.emoji} ${item.cat.name}</span>
            <b>${pct}%</b>
            <small>${budgetNote} • tap to review</small>
          </button>`;
        }).join("")}
      </div>
    </div>` : `<div class="empty-state">No cleared outflow for ${stats.range.label} yet.</div>`;

  const budgetRows = stats.budgetRows.map(r=>{
    const pct = Math.min(140, Math.max(0, r.pct));
    const status = r.left < -0.005 ? `Over by ${money(Math.abs(r.left))}` : `${money(r.left)} left`;
    return `<button type="button" class="budget-review-row budget-drill-row ${r.left < -0.005 ? "over" : ""}" onclick="openBudgetDetail('${r.budget.id}')">
      <div class="budget-review-main budget-target-main">
        <div class="budget-category-title"><span class="cat-preview" style="background:${hexToSoft(r.cat.color)}">${r.cat.emoji} ${r.cat.text}</span></div>
        <div class="budget-account-sub">${escapeAttr(r.scopeLabel)}</div>
        <div class="row-sub">${money(r.spent)} spent of ${money(r.amount)} • ${r.pct}% used</div>
        <div class="progress"><span style="width:${Math.min(100,pct)}%"></span></div>
      </div>
      <div class="amount ${r.left < -0.005 ? "bad" : "good"}">${status}</div>
    </button>`;
  }).join("") || `<div class="empty-state">Add budgets below to compare targets against real spending.</div>`;

  const trendBars = trend.map(t=>`<div class="trend-bar-item" title="${t.label}: ${money(t.spent)}">
      <span class="trend-bar" style="height:${Math.max(6, Math.round((t.spent / maxTrend) * 100))}%"></span>
      <small>${t.label}</small>
    </div>`).join("");

  el.innerHTML = `
    <div class="budget-review-controls">
      <label>Month<select onchange="setBudgetReviewMonth(this.value)">${monthOptions.join("")}</select></label>
      <button type="button" class="ghost small" onclick="explainBudgetTotals()">ⓘ Why these totals?</button>
    </div>
    <section class="budget-summary-strip" aria-label="Budget review summary">
      <article><span>💸 Spending</span><b>${money(stats.totalSpent)}</b></article>
      <article><span>💰 Income</span><b>${money(stats.totalIncome)}</b></article>
      <article><span>🎯 Budgeted</span><b>${money(stats.totalBudgeted)}</b><small>${budgetMood}</small></article>
      <article><span>🕵️ Unbudgeted</span><b>${money(stats.unbudgetedSpent)}</b></article>
    </section>
    <details class="budget-more-insights">
      <summary><span><b>More insights</b><small>Month comparison and six-month trend</small></span><span aria-hidden="true">⌄</span></summary>
      <div class="budget-more-insights-body">
        <section class="budget-month-compare">
          <article class="mini-card"><span>Vs. last month</span><b class="${monthCompare.delta>0?'bad':'good'}">${monthCompare.delta>0?'+':''}${money(monthCompare.delta)}</b><small>${monthCompare.pct===null?'No prior-month baseline':`${monthCompare.pct>0?'+':''}${monthCompare.pct}% change`}</small></article>
          <article class="mini-card"><span>Biggest category change</span><b>${monthCompare.biggest ? `${categoryById(monthCompare.biggest.id)?.emoji || '🏷️'} ${categoryById(monthCompare.biggest.id)?.name || 'Unknown category'}` : '—'}</b><small>${monthCompare.biggest ? `${monthCompare.biggest.delta>0?'+':''}${money(monthCompare.biggest.delta)}` : 'No comparison data'}</small></article>
        </section>
        <section class="budget-trend-compact">
          <div class="budget-trend-heading">
            <div><div class="section-kicker">Monthly pattern</div><h4>Last 6 months spending</h4></div>
          </div>
          <div class="budget-trend-chart">${trendBars}</div>
        </section>
      </div>
    </details>
    <section class="budget-review-section spending-pie-section">
      <div class="budget-section-head"><div><div class="section-kicker">Where money went</div><h4>Spending by category</h4></div><small>Tap a category to review transactions</small></div>
      ${spendingPie}
      <p class="budget-section-note">Cleared spending for the selected view. ${pieGroup.note}</p>
    </section>
    <section class="budget-review-section budget-performance-section">
      <div class="budget-section-head"><div><div class="section-kicker">Budget performance</div><h4>How you did vs budget</h4></div><small>Tap a budget for details</small></div>
      <div class="budget-review-list">${budgetRows}</div>
    </section>`;
}
function renderBudgets(){
  renderBudgetReview();
  const monthRange = budgetMonthRange(budgetReviewMonth);
  document.getElementById("budgetList").innerHTML = (data.budgets || []).filter(b=>budgetCategoryIds(b).length).sort(compareBudgetsByTitle).map(b=>{
    const spent = budgetActualSpent(b, monthRange);
    const avg = budgetAverageMonthlySpent(b, 6);
    const cat = budgetCategoryLabel(b);
    const avgLabel = avg.activeMonths ? `${money(avg.average)} avg/month over ${avg.activeMonths} active month${avg.activeMonths === 1 ? "" : "s"}` : "No spending history yet";
    return `<div class="row budget-target-row budget-set-row" role="button" tabindex="0" onclick="simpleBudget('${b.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();simpleBudget('${b.id}');}">
      <div class="budget-target-main">
        <div class="budget-category-title"><span class="cat-preview" style="background:${hexToSoft(cat.color)}">${cat.emoji} ${cat.text}</span></div>
        <div class="budget-account-sub">${escapeAttr(budgetScopeLabel(b))}</div>
        <div class="budget-set-meta"><span>${avgLabel}</span><span>${money(spent)} spent in ${monthRange.label}</span></div>
      </div>
      <div class="budget-target-side"><strong>${money(b.amount)}</strong><small>monthly</small><span class="budget-row-chevron" aria-hidden="true">›</span></div>
    </div>`;
  }).join("") || `<div class="empty-state">No budgets yet. Add one to start tracking monthly targets.</div>`;
}


function budgetDetailTransactions(budget, monthRange=budgetMonthRange(budgetReviewMonth)){
  return expandedTransactions(monthRange.end)
    .filter(tx=>tx.date >= monthRange.start && tx.date <= monthRange.end)
    .filter(tx=>budgetIncludesTransaction(tx, budgetReviewIncludeRecurringBills))
    .filter(tx=>txMatchesBudgetCategories(tx, budget))
    .filter(tx=>txMatchesBudgetScope(tx, budget))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(a.title || "").localeCompare(String(b.title || "")));
}
function budgetBreakdown(items, keyFn, labelFn){
  const totals = new Map();
  items.forEach(tx=>{
    const key = keyFn(tx) || "unknown";
    totals.set(key, (totals.get(key) || 0) + budgetTransactionAmount(tx));
  });
  return [...totals.entries()].map(([key, amount])=>({key, label:labelFn(key), amount})).sort((a,b)=>b.amount-a.amount);
}
function renderBudgetBreakdown(items, emptyText){
  if(!items.length) return `<div class="empty-state">${emptyText}</div>`;
  const max = Math.max(1, ...items.map(x=>Math.abs(x.amount)));
  return `<div class="budget-detail-breakdown">${items.map((item,index)=>`<div class="budget-detail-breakdown-row">
    <div><b>${index+1}. ${escapeAttr(item.label)}</b><span>${money(item.amount)}</span></div>
    <div class="budget-detail-meter"><span style="width:${Math.max(4,Math.round(Math.abs(item.amount)/max*100))}%"></span></div>
  </div>`).join("")}</div>`;
}
function openBudgetDetailView({categoryId, categoryIds=null, budget=null, accountId=budgetReviewAccountIds}){
  const modal = document.getElementById("budgetDetailModal");
  const content = document.getElementById("budgetDetailContent");
  const selectedCategoryIds = budget ? budgetCategoryIds(budget) : (Array.isArray(categoryIds) ? categoryIds : [categoryId]).filter(Boolean);
  if(!selectedCategoryIds.length || !modal || !content) return;
  const range = budgetMonthRange(budgetReviewMonth);
  const cat = budget ? budgetCategoryLabel(budget) : budgetCategoryLabel({categoryIds:selectedCategoryIds});
  const txs = expandedTransactions(range.end)
    .filter(tx=>tx.date >= range.start && tx.date <= range.end)
    .filter(tx=>budgetIncludesTransaction(tx, budgetReviewIncludeRecurringBills))
    .filter(tx=>selectedCategoryIds.includes(tx.categoryId))
    .filter(tx=>budget ? txMatchesBudgetScope(tx, budget) : txMatchesBudgetAccount(tx, accountId))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(a.title || "").localeCompare(String(b.title || "")));
  const total = txs.reduce((sum,tx)=>sum+budgetTransactionAmount(tx),0);
  const amount = budget ? Number(budget.amount || 0) : null;
  const remaining = amount === null ? null : amount-total;
  const accounts = budgetBreakdown(txs, tx=>tx.accountId || "unknown", id=>{
    const a=accountById(id); return a ? `${a.emoji || "💵"} ${a.name}` : "Unknown account";
  });
  const merchants = budgetBreakdown(txs, tx=>String(tx.title || "Untitled").trim().toLowerCase(), key=>{
    const match=txs.find(tx=>String(tx.title || "Untitled").trim().toLowerCase()===key); return match?.title || "Untitled";
  });
  const topAccount = accounts[0]?.label || "No spending yet";
  const topMerchant = merchants[0]?.label || "No spending yet";
  document.getElementById("budgetDetailTitle").textContent = `${cat.emoji || "📊"} ${cat.text || cat.name}${budget ? " budget" : " spending"}`;
  document.getElementById("budgetDetailSub").textContent = `${range.label} • ${budget ? budgetScopeLabel(budget) : budgetReviewAccountLabel(accountId)}`;
  content.innerHTML = `
    <div class="budget-detail-summary ${budget ? "" : "category-only"}">
      <article class="mini-card"><span>Total spent</span><b>${money(total)}</b><small>${txs.length} included transaction${txs.length===1?"":"s"}</small></article>
      ${budget ? `<article class="mini-card"><span>Budget amount</span><b>${money(amount)}</b><small>Monthly target</small></article>
      <article class="mini-card"><span>${remaining < -0.005 ? "Over budget" : "Remaining"}</span><b class="${remaining < -0.005 ? "bad" : "good"}">${money(Math.abs(remaining))}</b><small>${amount ? Math.round(total/amount*100) : 0}% used</small></article>` : ""}
      <article class="mini-card"><span>Top account</span><b>${escapeAttr(topAccount)}</b><small>${accounts[0] ? money(accounts[0].amount) : "—"}</small></article>
      <article class="mini-card"><span>Top place</span><b>${escapeAttr(topMerchant)}</b><small>${merchants[0] ? money(merchants[0].amount) : "—"}</small></article>
    </div>
    <div class="budget-detail-grid">
      <section class="budget-insight-card"><div class="section-kicker">By place</div><h4>Merchant/place breakdown</h4>${renderBudgetBreakdown(merchants,"No merchant spending in this category yet.")}</section>
      <section class="budget-insight-card"><div class="section-kicker">By account</div><h4>Account breakdown</h4>${renderBudgetBreakdown(accounts,"No account spending in this category yet.")}</section>
    </div>
    <section class="budget-insight-card budget-detail-transactions">
      <div class="section-kicker">Included activity</div><h4>Transactions in this total</h4>
      ${txs.length ? `<div class="budget-detail-tx-list">${txs.map(tx=>{
        const a=accountById(tx.accountId), c=categoryById(tx.categoryId);
        return `<article class="budget-detail-tx-card">
          <div class="budget-detail-tx-top"><div><b>${escapeAttr(tx.title || "Untitled")}</b><span>${parseDate(tx.date).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</span></div><strong>${money(budgetTransactionAmount(tx))}</strong></div>
          <div class="budget-detail-tx-meta"><span>${a?.emoji || "💵"} ${escapeAttr(a?.name || "Unknown account")}</span><span>${c?.emoji || "🏷️"} ${escapeAttr(c?.name || "Unassigned")}</span><span class="status-pill ${tx.status || "planned"}">${tx.status === "cleared" ? "✓ Cleared" : "○ Planned"}</span></div>
        </article>`;
      }).join("")}</div>` : `<div class="empty-state">No included transactions for ${range.label}.</div>`}
    </section>`;
  if(!modal.open) modal.showModal();
}
window.openBudgetDetail = (budgetId)=>{
  const budget = (data.budgets || []).find(b=>b.id===budgetId);
  if(budget) openBudgetDetailView({categoryIds:budgetCategoryIds(budget), budget});
};
window.openCategoryBudgetDetail = (categoryId)=>openBudgetDetailView({categoryId, accountId:budgetReviewAccountIds});


function debtUtilization(d){
  if(!d.limit) return null;
  const bal = debtAmountLeftNow(d);
  return Math.round((bal / Number(d.limit)) * 100);
}
function debtCreditLineText(d){
  if(isBNPLDebt(d)) return `Original ${money(bnplOriginalPurchaseAmount(d.id, toISO(addMonths(new Date(),24))))}`;
  if(isMedicalDebt(d)) return "Interest-free plan";
  if(isLoanDebt(d)) return `Start ${money(debtStartingBalance(d))}`;
  return d.limit ? `Limit ${money(Number(d.limit))}` : "No credit line";
}
function debtAvailableCredit(d, currentBal=debtAmountLeftNow(d)){
  if(!d?.limit) return null;
  return Number(d.limit || 0) - Number(currentBal || 0);
}
function debtCreditLineSubText(d, currentBal=debtAmountLeftNow(d), util=debtUtilization(d)){
  if(!d?.limit) return "No limit set";
  const available = debtAvailableCredit(d, currentBal);
  const utilText = util !== null ? `${util}% used` : "Usage not calculated";
  const availableText = available >= 0 ? `${money(available)} available` : `${money(Math.abs(available))} over limit`;
  return `${utilText} • ${availableText}`;
}
function debtMinimumDueText(d){
  if(isBNPLDebt(d)){
    const next = bnplNextPayment(d.id);
    return next ? `Next due ${money(next.amount)}` : "Complete";
  }
  if(isMedicalDebt(d)){
    const next = medicalNextPayment(d);
    if(next) return `Next due ${money(next.amount)}`;
  }
  const linked = data.transactions.find(tx => tx.linkedDebtId === d.id && isRecurring(tx));
  if(linked) return `Recurring ${money(linked.amount)}`;
  return isMedicalDebt(d) ? "Payment not set" : "Min due not set";
}


function debtPaymentStatusLabel(status){
  const labels = {
    "not-set": "Not set",
    "unpaid": "Unpaid",
    "scheduled": "Scheduled",
    "planned": "Planned",
    "autopay": "Autopay",
    "paid": "Paid",
    "skip": "Skip/Ignore"
  };
  return labels[status] || "Not set";
}
function debtPaymentStatusClass(status){
  if(status === "paid" || status === "autopay") return "good";
  if(status === "scheduled" || status === "planned") return "warn";
  if(status === "unpaid") return "bad";
  return "";
}
function debtDisplayPaymentStatus(d){
  if(d?.type === "Credit Card") return automaticCreditCardPaymentInfo(d).status;
  if(isBNPLDebt(d)){
    const explicit = d?.paymentStatus || "not-set";
    if(explicit && explicit !== "not-set") return explicit;
    return bnplNextPayment(d.id) ? "planned" : "paid";
  }
  return d?.paymentStatus || "not-set";
}

function debtMinDueText(d){
  if(isBNPLDebt(d)){
    const next = bnplNextPayment(d.id);
    return next ? money(next.amount) : "Complete";
  }
  const direct = Number(d.minDue || 0);
  if(direct) return money(direct);
  const linked = data.transactions.find(tx => tx.linkedDebtId === d.id && isRecurring(tx));
  if(linked) return `${money(linked.amount)} recurring`;
  return "Not set";
}

function debtMonthlyPaymentAmount(d){
  if(!d) return 0;
  if(isBNPLDebt(d)){
    const next = bnplNextPayment(d.id);
    return next ? Number(next.amount || 0) : Number(d.minDue || 0);
  }

  const min = Number(d.minDue || 0);
  const extra = Number(d.manualExtra || 0);
  const sum = min + extra;
  const stored = Number(d.totalMonthlyPayment || 0);
  const linkedRecurring = data.transactions.find(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && isRecurring(tx));
  const linkedAmount = Number(linkedRecurring?.amount || 0);

  // Old versions sometimes kept totalMonthlyPayment equal to the minimum due,
  // even after a manual extra amount was added. In that common case, prefer
  // min + extra. If Mak intentionally enters a different total, keep it.
  if(stored && Math.abs(stored - min) > 0.005 && Math.abs(stored - sum) > 0.005) return stored;
  return sum || stored || min || linkedAmount;
}
function debtMonthlyPaymentText(d){
  const amount = debtMonthlyPaymentAmount(d);
  return amount ? money(amount) : "Not set";
}
function debtMonthlyPaymentSubText(d){
  if(isBNPLDebt(d)) return debtDueText(d);
  const min = Number(d.minDue || 0);
  const extra = Number(d.manualExtra || 0);
  const stored = Number(d.totalMonthlyPayment || 0);
  const sum = min + extra;
  const linkedRecurring = data.transactions.find(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && isRecurring(tx));
  if(extra) return `Min ${money(min)} + extra ${money(extra)}`;
  if(stored && Math.abs(stored - sum) > 0.005) return "Custom total";
  if(linkedRecurring && !(sum || stored)) return `Recurring ${recurrenceDescription(linkedRecurring).toLowerCase()}`;
  return d.dueDate || "No due date";
}

function debtNextScheduledPayment(d){
  const now = todayISO();
  const horizon = toISO(addMonths(new Date(), 24));
  const nextTx = visibleTransactionsForDebt(d.id, horizon)
    .filter(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && tx.status !== "cleared" && tx.date >= now)
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(nextTx) return {date:nextTx.date, amount:Number(nextTx.amount || 0), source:"scheduled"};
  if(d?.dueDate && Number(debtMonthlyPaymentAmount(d) || 0)){
    return {date:d.dueDate, amount:Number(debtMonthlyPaymentAmount(d) || 0), source:"debt settings"};
  }
  return null;
}
function formatDebtPayoffDate(dateISO){
  if(!dateISO) return "—";
  return parseDate(dateISO).toLocaleDateString(undefined,{month:"short", year:"numeric"});
}
function debtEstimatedPayoff(d){
  const balance = debtAmountLeftNow(d);
  if(balance <= 0.005) return {value:"Paid off", sub:"No balance remaining", status:"good"};

  if(isBNPLDebt(d)){
    const unpaid = bnplPaymentTransactions(d.id, toISO(addMonths(new Date(), 120)))
      .filter(tx => tx.status !== "cleared")
      .sort((a,b)=>a.date.localeCompare(b.date));
    if(unpaid.length){
      const last = unpaid[unpaid.length - 1];
      return {value:formatDebtPayoffDate(last.date), sub:`${unpaid.length} installment${unpaid.length === 1 ? "" : "s"} left`, status:"warn"};
    }
    return {value:"Unknown", sub:"No unpaid installment schedule found", status:""};
  }

  const payment = Number(debtMonthlyPaymentAmount(d) || 0);
  if(!payment) return {value:"Unknown", sub:"Add a monthly/recurring payment", status:""};

  const apr = Math.max(0, Number(d.apr || 0));
  const loanForecast = isLoanDebt(d) ? loanForecastSettings(d) : null;
  const interestNote = loanForecast ? `, ${loanForecast.source} split est.` : (apr ? `, ${apr.toFixed(2)}% APR est.` : ", no interest");
  const scheduledPayments = visibleTransactionsForDebt(d.id, toISO(addMonths(new Date(), 120)))
    .filter(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && tx.status !== "cleared" && tx.date >= todayISO())
    .sort((a,b)=>a.date.localeCompare(b.date));
  const hasRecurringSchedule = data.transactions.some(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && isRecurring(tx));

  // If Mak has an actual recurring payment schedule, use those generated dates first.
  // For loans, future planned payments can use estimated principal/interest/fee
  // splits instead of pretending the whole payment lowers principal.
  if(hasRecurringSchedule && scheduledPayments.length){
    let remaining = balance;
    let lastDate = parseDate(todayISO());
    let payments = 0;
    for(const tx of scheduledPayments){
      const payDate = parseDate(tx.date);
      if(apr && !loanForecast){
        const days = Math.max(0, Math.floor((payDate - lastDate) / 86400000));
        remaining += remaining * (apr / 100 / 365) * days;
      }
      const reduction = isLoanDebt(d)
        ? loanPrincipalReductionForDebtPayment(d, tx, {estimateFuture:true, allPayments:scheduledPayments, currentBalanceBefore:remaining})
        : Number(tx.amount || 0);
      remaining -= reduction;
      payments += 1;
      lastDate = payDate;
      if(remaining <= 0.005){
        return {
          value:formatDebtPayoffDate(tx.date),
          sub:`≈ ${payments} scheduled payment${payments === 1 ? "" : "s"}${interestNote}`,
          status: payments <= 12 ? "good" : "warn"
        };
      }
    }
    return {value:"10+ years", sub:`Recurring payments found, but payoff is beyond the estimate window${interestNote}`, status:"warn"};
  }

  const monthlyRate = apr / 100 / 12;
  let firstDateForFallback = debtNextScheduledPayment(d)?.date || toISO(addMonths(new Date(), 1));
  let fallbackPaymentTx = {
    id:`forecast-${d.id}`,
    linkedDebtId:d.id,
    type:"transfer",
    status:"planned",
    amount:payment,
    date:firstDateForFallback,
    recurrence:{type:"monthly", interval:1}
  };
  const fallbackPrincipal = isLoanDebt(d)
    ? loanPrincipalReductionForDebtPayment(d, fallbackPaymentTx, {estimateFuture:true, allPayments:[fallbackPaymentTx], currentBalanceBefore:balance})
    : payment;

  if(loanForecast){
    if(fallbackPrincipal <= 0.005) return {value:"Not decreasing", sub:"Estimated principal is $0 after interest/fees", status:"bad"};
  } else if(monthlyRate && payment <= balance * monthlyRate){
    return {value:"Not decreasing", sub:`${money(payment)} does not cover estimated monthly interest`, status:"bad"};
  }

  let remaining = balance;
  let payments = 0;
  while(remaining > 0.005 && payments < 600){
    if(loanForecast){
      const paymentDate = toISO(addMonths(parseDate(firstDateForFallback), payments));
      const tx = {...fallbackPaymentTx, id:`forecast-${d.id}-${paymentDate}`, date:paymentDate};
      remaining -= loanPrincipalReductionForDebtPayment(d, tx, {estimateFuture:true, allPayments:[tx], currentBalanceBefore:remaining});
    } else {
      if(monthlyRate) remaining += remaining * monthlyRate;
      remaining -= payment;
    }
    payments += 1;
  }
  if(remaining > 0.005) return {value:"600+ months", sub:"Payment is too low for a useful estimate", status:"bad"};

  const firstDate = parseDate(firstDateForFallback);
  const payoffDate = toISO(addMonths(firstDate, Math.max(0, payments - 1)));
  return {
    value:formatDebtPayoffDate(payoffDate),
    sub:`≈ ${payments} payment${payments === 1 ? "" : "s"} at ${money(payment)}${interestNote}`,
    status: payments <= 12 ? "good" : "warn"
  };
}
function debtEstimatedPayoffCardHTML(d){
  const estimate = debtEstimatedPayoff(d);
  return `<div class="card mini"><p class="eyebrow">Estimated payoff</p><div class="value">${estimate.value}</div><p class="sub">${estimate.sub}</p></div>`;
}

function debtStatementLine(d){
  if(isBNPLDebt(d)){
    return `Original ${money(bnplOriginalPurchaseAmount(d.id, toISO(addMonths(new Date(),24))))}`;
  }
  const bal = debtStatementBalanceText(d);
  const date = d.statementDate ? ` • ${d.statementDate}` : "";
  return `Stmt ${bal}${date}`;
}
function debtAfterPaymentText(d){
  const stmt = Number(d.statementBalance || 0);
  if(!stmt) return "";
  const after = Math.max(0, stmt - Number(d.minDue || 0) - Number(d.manualExtra || 0));
  return `After pymt ${money(after)}`;
}
function debtNextStatementText(d){
  if(!d || d.type !== "Credit Card") return "";
  const next = nextCreditCardStatementDate(d);
  if(!next) return "Next statement not set";
  return `${next < todayISO() ? "Next statement overdue" : "Next statement"} ${next}`;
}
function debtUtilAfterPaymentText(d){
  if(!d.limit || !Number(d.statementBalance || 0)) return "";
  const after = Math.max(0, Number(d.statementBalance || 0) - Number(d.minDue || 0) - Number(d.manualExtra || 0));
  return `${Math.round((after / Number(d.limit)) * 100)}% after pymt`;
}

function debtStatementBalanceText(d){
  const val = Number(d.statementBalance || 0);
  return val ? money(val) : "Not set";
}
function debtDueText(d){
  if(isBNPLDebt(d)){
    const next = bnplNextPayment(d.id);
    return next ? next.date : "No upcoming payment";
  }
  return d.dueDate || "No due date";
}
function debtFrozenText(d){
  return d.frozenLocked ? "Frozen/locked" : "Active";
}
function debtLeftOver(d){
  const left = Number(d.statementBalance || 0) - Number(d.minDue || 0) - Number(d.manualExtra || 0);
  return Math.max(0, left);
}


const debtOpenState = {
  openDebtTypes: new Set(),
  openDebtCompanies: new Set()
};

function isDebtExpanded(listName, key){
  return debtOpenState[listName]?.has(key) || false;
}

function rememberExpanded(listName, key, isOpen){
  if(!debtOpenState[listName]) debtOpenState[listName] = new Set();
  if(isOpen) debtOpenState[listName].add(key);
  if(!isOpen) debtOpenState[listName].delete(key);

  // Keep the legacy settings fields for backup/import compatibility,
  // but do not persist expansion state. Debt groups should start collapsed
  // whenever the app/page loads unless Mak expands them manually.
  data.settings[listName] ||= [];
}
function debtCompanyKey(type, company){
  return `${type}::${company}`;
}

function expandDebtTypeAccounts(type){
  // Expand one top-level debt type plus all company/account groups inside it.
  // This is intentionally scoped to the clicked type only, not every debt group.
  debtOpenState.openDebtTypes.add(type);
  const debts = orderedDebts().filter(d => d.type === type);
  Object.keys(groupBy(debts, "company")).forEach(company=>{
    debtOpenState.openDebtCompanies.add(debtCompanyKey(type, company));
  });
  renderDebts();
}

function collapseDebtTypeAccounts(type){
  // Collapse only the account/company groups inside this debt type.
  const debts = orderedDebts().filter(d => d.type === type);
  Object.keys(groupBy(debts, "company")).forEach(company=>{
    debtOpenState.openDebtCompanies.delete(debtCompanyKey(type, company));
  });
  renderDebts();
}


function debtTypeLabel(type){
  return data.settings.debtTypeLabels?.[type] || type;
}
function editDebtTypes(){
  simpleTitle.textContent = "Edit debt category labels";
  const types = Array.from(new Set(data.debts.map(d=>d.type))).sort();
  simpleFields.innerHTML = `
    <p class="hint">These are display labels only. The underlying debt type stays the same for filtering/calculations.</p>
    ${types.map(type=>`
      <label>${type}
        <input class="debt-type-label-input" data-type="${type}" value="${debtTypeLabel(type)}">
      </label>
    `).join("")}`;
  simpleSubmit = ()=>{
    data.settings.debtTypeLabels ||= {};
    document.querySelectorAll(".debt-type-label-input").forEach(input=>{
      data.settings.debtTypeLabels[input.dataset.type] = input.value || input.dataset.type;
    });
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
}


function isBNPLDebt(d){
  return d?.type === "Buy Now, Pay Later" || d?.type === "Klarna" || debtTypeLabel(d?.type) === "Buy Now, Pay Later";
}
function splitAmount(total, count){
  const cents = Math.round(Number(total || 0) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({length:count}, (_,i)=>((base + (i < remainder ? 1 : 0)) / 100));
}
function addMonthsClamped(date, months){
  const source = new Date(date);
  const day = source.getDate();
  const candidate = new Date(source.getFullYear(), source.getMonth() + Number(months || 0), 1, 12);
  candidate.setDate(Math.min(day, endOfMonth(candidate).getDate()));
  return candidate;
}
function bnplPaymentDateForIndex(first, index, frequencyValue, scheduleMode="days"){
  if(scheduleMode === "monthly-same-day"){
    return toISO(addMonthsClamped(first, index * Math.max(1, Number(frequencyValue || 1))));
  }
  return toISO(addDays(first, index * Math.max(1, Number(frequencyValue || 14))));
}
function bnplPaymentRowsHTML(total, count, firstDate, frequencyValue, scheduleMode="days"){
  const amounts = splitAmount(total, count);
  const first = parseDate(firstDate || todayISO());
  return amounts.map((amt, i)=>{
    const due = bnplPaymentDateForIndex(first, i, frequencyValue, scheduleMode);
    return `<div class="bnpl-payment-row">
      <label>Payment ${i+1} date<input class="bnpl-date" type="date" value="${due}"></label>
      <label>Amount<input class="bnpl-amount" type="number" step="0.01" value="${amt.toFixed(2)}"></label>
    </div>`;
  }).join("");
}


function creditCardUtilizationSummariesHTML(){
  const cards = data.debts.filter(d => d.type === "Credit Card" && Number(d.limit || 0) > 0);
  if(!cards.length) return "";
  const owners = [...new Set(cards.map(d=>d.owner || "Unassigned"))].sort();
  const rows = owners.map(owner=>{
    const ownerCards = cards.filter(d=>(d.owner || "Unassigned") === owner);
    const limit = ownerCards.reduce((s,d)=>s+Number(d.limit || 0),0);
    const current = ownerCards.reduce((s,d)=>s+Math.max(0, debtAmountLeftNow(d)),0);
    const statement = ownerCards.reduce((s,d)=>s+Math.max(0, Number(d.statementBalance || 0)),0);
    const currentPct = limit ? Math.round((current / limit) * 100) : 0;
    const statementPct = limit ? Math.round((statement / limit) * 100) : 0;
    return `<div class="utilization-card">
      <div>
        <div class="row-title">${owner}</div>
        <div class="row-sub">${ownerCards.length} card${ownerCards.length === 1 ? "" : "s"} • limit ${money(limit)}</div>
        <button class="ghost tiny" onclick='event.stopPropagation(); openCreditUtilizationSimulator(${jsString(owner)})'>Simulate payoff</button>
      </div>
      <div><div class="label">Current util.</div><div class="amount ${currentPct <= 30 ? "good" : currentPct <= 50 ? "warn" : "bad"}">${currentPct}%</div><div class="row-sub">${money(current)} current</div></div>
      <div><div class="label">Statement util.</div><div class="amount ${statementPct <= 30 ? "good" : statementPct <= 50 ? "warn" : "bad"}">${statementPct}%</div><div class="row-sub">${money(statement)} statements</div></div>
    </div>`;
  }).join("");
  return `<section class="credit-util-summary">
    <div class="panel-head compact-head"><div><h3>Credit utilization</h3><p class="hint">By owner, using credit card limits, current balances, and statement balances.</p></div></div>
    <div class="utilization-grid">${rows}</div>
  </section>`;
}


function openCreditUtilizationSimulator(owner){
  const cards = data.debts.filter(d => d.type === "Credit Card" && (d.owner || "Unassigned") === owner && Number(d.limit || 0) > 0);
  if(!cards.length){ alert(`No credit cards found for ${owner}.`); return; }
  simpleTitle.textContent = `${owner} credit utilization simulator`;
  simpleFields.innerHTML = `
    <p class="hint">Temporary what-if math only. Edit balances here to test payoff ideas; this will not save to your real card balances.</p>
    <div id="utilSimSummary" class="util-sim-summary"></div>
    <div class="stack">
      ${cards.map((d,i)=>{
        const current = Math.max(0, debtAmountLeftNow(d));
        const statement = Math.max(0, Number(d.statementBalance || 0));
        const limit = Number(d.limit || 0);
        return `<div class="card compact-card util-sim-card" data-limit="${limit}">
          <div class="panel-head compact-head">
            <div>
              <b>${d.emoji || "💳"} ${d.name}</b>
              <p class="hint">Limit ${money(limit)} • current ${money(current)} • statement ${money(statement)}</p>
            </div>
            <button type="button" class="ghost tiny" onclick="setUtilSimCardBalance(${i},0,0)">Pay off</button>
          </div>
          <div id="utilSimCardSummary${i}" class="util-sim-card-summary"></div>
          <div class="two-col">
            <label>Sim current balance<input id="utilSimCurrent${i}" class="util-sim-input" type="number" step="0.01" value="${current.toFixed(2)}"></label>
            <label>Sim statement balance<input id="utilSimStatement${i}" class="util-sim-input" type="number" step="0.01" value="${statement.toFixed(2)}"></label>
            <label>Payment amount<input id="utilSimPayment${i}" type="number" step="0.01" placeholder="0.00"></label>
            <label>&nbsp;<button type="button" class="ghost" onclick="applyUtilSimPayment(${i})">Apply payment to current</button></label>
            <label>Target current utilization %<input id="utilSimTargetPct${i}" class="util-sim-target" type="number" step="0.1" min="0" max="100" placeholder="30"></label>
            <label>&nbsp;<button type="button" class="ghost" onclick="applyUtilTargetPayment(${i})">Apply target payment</button></label>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  simpleSubmit = ()=>{};
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
  document.querySelectorAll(".util-sim-input").forEach(input=>input.addEventListener("input", updateUtilSimSummary));
  document.querySelectorAll(".util-sim-target").forEach(input=>input.addEventListener("input", updateUtilSimSummary));
  updateUtilSimSummary();
}

function setUtilSimCardBalance(index, current, statement){
  const cur = document.getElementById(`utilSimCurrent${index}`);
  const stmt = document.getElementById(`utilSimStatement${index}`);
  if(cur) cur.value = Number(current || 0).toFixed(2);
  if(stmt) stmt.value = Number(statement || 0).toFixed(2);
  updateUtilSimSummary();
}

function applyUtilSimPayment(index){
  const cur = document.getElementById(`utilSimCurrent${index}`);
  const pay = document.getElementById(`utilSimPayment${index}`);
  if(!cur || !pay) return;
  const next = Math.max(0, Number(cur.value || 0) - Number(pay.value || 0));
  cur.value = next.toFixed(2);
  pay.value = "";
  updateUtilSimSummary();
}

function utilTargetPaymentNeeded(index){
  const card = document.querySelectorAll(".util-sim-card")[index];
  const cur = document.getElementById(`utilSimCurrent${index}`);
  const target = document.getElementById(`utilSimTargetPct${index}`);
  if(!card || !cur || !target || target.value === "") return null;
  const limit = Number(card.dataset.limit || 0);
  const current = Math.max(0, Number(cur.value || 0));
  const targetPct = Math.max(0, Math.min(100, Number(target.value || 0)));
  const targetBalance = Math.max(0, limit * (targetPct / 100));
  return Math.max(0, current - targetBalance);
}
function applyUtilTargetPayment(index){
  const cur = document.getElementById(`utilSimCurrent${index}`);
  const needed = utilTargetPaymentNeeded(index);
  if(!cur || needed === null) return;
  cur.value = Math.max(0, Number(cur.value || 0) - needed).toFixed(2);
  updateUtilSimSummary();
}

function updateUtilSimSummary(){
  const cards = Array.from(document.querySelectorAll(".util-sim-card"));
  cards.forEach((card, i)=>{
    const limit = Number(card.dataset.limit || 0);
    const current = Math.max(0, Number(document.getElementById(`utilSimCurrent${i}`)?.value || 0));
    const statement = Math.max(0, Number(document.getElementById(`utilSimStatement${i}`)?.value || 0));
    const currentPct = limit ? (current / limit) * 100 : 0;
    const statementPct = limit ? (statement / limit) * 100 : 0;
    const cardSummary = document.getElementById(`utilSimCardSummary${i}`);
    const targetInput = document.getElementById(`utilSimTargetPct${i}`);
    const needed = utilTargetPaymentNeeded(i);
    const targetLine = needed === null ? "" : `<div class="util-sim-target-line"><span>Payment needed for ${Number(targetInput?.value || 0)}% current util.</span><b>${money(needed)}</b></div>`;
    if(cardSummary){
      cardSummary.innerHTML = `<div class="util-sim-mini-grid">
        <div><div class="label">Card current util.</div><b class="${currentPct <= 30 ? "good" : currentPct <= 50 ? "warn" : "bad"}">${Math.round(currentPct)}%</b><span>${money(current)} / ${money(limit)}</span></div>
        <div><div class="label">Card statement util.</div><b class="${statementPct <= 30 ? "good" : statementPct <= 50 ? "warn" : "bad"}">${Math.round(statementPct)}%</b><span>${money(statement)} / ${money(limit)}</span></div>
      </div>${targetLine}`;
    }
  });
  const limit = cards.reduce((s,card)=>s + Number(card.dataset.limit || 0), 0);
  const current = cards.reduce((s,_,i)=>s + Math.max(0, Number(document.getElementById(`utilSimCurrent${i}`)?.value || 0)), 0);
  const statement = cards.reduce((s,_,i)=>s + Math.max(0, Number(document.getElementById(`utilSimStatement${i}`)?.value || 0)), 0);
  const currentPct = limit ? (current / limit) * 100 : 0;
  const statementPct = limit ? (statement / limit) * 100 : 0;
  const el = document.getElementById("utilSimSummary");
  if(!el) return;
  el.innerHTML = `<div class="utilization-card sim-result">
    <div><div class="label">Total limit</div><div class="amount">${money(limit)}</div></div>
    <div><div class="label">Sim current util.</div><div class="amount ${currentPct <= 30 ? "good" : currentPct <= 50 ? "warn" : "bad"}">${Math.round(currentPct)}%</div><div class="row-sub">${money(current)} current</div></div>
    <div><div class="label">Sim statement util.</div><div class="amount ${statementPct <= 30 ? "good" : statementPct <= 50 ? "warn" : "bad"}">${Math.round(statementPct)}%</div><div class="row-sub">${money(statement)} statements</div></div>
  </div>`;
}

function renderDebts(){
  const groupedType = groupBy(orderedDebts(), "type");
  const debtTools = `<details class="account-tools-disclosure">
    <summary><span><b>Debt tools</b><small>BNPL purchases and category-label maintenance.</small></span><span class="account-tools-chevron" aria-hidden="true">⌄</span></summary>
    <div class="account-tools-body"><button class="primary small" onclick="addBNPLPurchase()">+ BNPL purchase</button><button class="ghost small" onclick="editDebtTypes()">Edit debt category labels</button></div>
  </details>`;
  document.getElementById("debtGroups").innerHTML = creditCardUtilizationSummariesHTML() + debtTools + Object.entries(groupedType).map(([type,debts])=>{
    const typeTotal = debts.reduce((s,d)=>s+debtAmountLeftNow(d),0);
    const byCompany = groupBy(orderedDebts(debts), "company");
    const companies = Object.keys(byCompany);
    const allCompaniesOpen = companies.length > 0 && companies.every(company=>isDebtExpanded("openDebtCompanies", debtCompanyKey(type, company)));
    return `<details class="debt-type-section" ${isDebtExpanded("openDebtTypes", type) ? "open" : ""} ontoggle="rememberExpanded('openDebtTypes','${type}',this.open)">
      <summary class="debt-type-summary">
        <span class="debt-type-name">${debtTypeLabel(type)}</span>
        <span class="debt-type-summary-actions">
          <button class="ghost tiny debt-company-toggle" onclick="event.preventDefault(); event.stopPropagation(); ${allCompaniesOpen ? "collapseDebtTypeAccounts" : "expandDebtTypeAccounts"}('${type}')">${allCompaniesOpen ? "Collapse accounts" : "Expand accounts"}</button>
          <span class="debt-type-total">${money(typeTotal)} • ${debts.length} account${debts.length === 1 ? "" : "s"} <span aria-hidden="true">⌄</span></span>
        </span>
      </summary>
      <div class="debt-type-body">
        ${Object.entries(byCompany).map(([company,cards])=>`
          <div class="debt-company ${isDebtExpanded("openDebtCompanies", debtCompanyKey(type, company)) ? "open" : ""}" onclick="this.classList.toggle('open'); rememberExpanded('openDebtCompanies', debtCompanyKey('${type}', '${company.replaceAll("'", "\'")}'), this.classList.contains('open'))">
            <strong>${company}</strong>
            <span>${money(cards.reduce((s,d)=>s+debtAmountLeftNow(d),0))} <span aria-hidden="true">⌄</span></span>
          </div>
          <div class="debt-cards ${isDebtExpanded("openDebtCompanies", debtCompanyKey(type, company)) ? "open" : ""}">
            ${orderedDebts(cards).map(d=>{
              const util = debtUtilization(d);
              const bal = debtAmountLeftNow(d);
              const displayStatus = debtDisplayPaymentStatus(d);
              const statusClass = debtPaymentStatusClass(displayStatus);
              return `<div class="debt-account-card tinted-card clickable ${d.frozenLocked ? "debt-frozen" : ""}" draggable="true" data-id="${d.id}" style="--card-color:${d.color || "#8c6f4d"}; background:${hexToSoft(d.color || "#8c6f4d")}" onclick="openDebtDetail('${d.id}')">
                <div class="debt-card-main">
                  <div class="row-title">${d.frozenLocked ? "🔒 " : ""}${d.emoji || "💳"} ${d.name}</div>
                  <div class="row-sub">${d.owner} • ${debtFrozenText(d)}${d.apr ? ` • ${d.apr}% APR` : ""}</div>
                </div>
                <div class="debt-card-metric debt-card-current">
                  <div class="label">Current</div>
                  <div class="amount bad">${money(bal)}</div>
                  <div class="row-sub">${debtStatementLine(d)}</div>
                  ${debtNextStatementText(d) ? `<div class="row-sub">${debtNextStatementText(d)}</div>` : (debtAfterPaymentText(d) ? `<div class="row-sub">${debtAfterPaymentText(d)}</div>` : "")}
                </div>
                <div class="debt-card-metric debt-card-credit">
                  <div class="label">Credit line</div>
                  <div class="row-sub">${debtCreditLineText(d)}</div>
                  ${d.limit && !isBNPLDebt(d) && !isMedicalDebt(d) && !isLoanDebt(d) ? `<div class="row-sub">${debtCreditLineSubText(d, bal, util)}</div>` : (util !== null ? `<div class="row-sub">${util}% used</div>` : "")}
                </div>
                <div class="debt-card-metric debt-card-due">
                  <div class="label">Due / Payment</div>
                  <div class="row-sub">${debtDueText(d)}</div>
                  <div class="row-sub">${debtMonthlyPaymentText(d)}</div>
                </div>
                <div class="debt-card-status">
                  <div class="label">Status</div>
                  <div class="debt-status-pill ${statusClass}">${debtPaymentStatusLabel(displayStatus)}</div>
                </div>
                <span class="debt-row-chevron" aria-hidden="true">›</span>
              </div>`;
            }).join("")}
          </div>`).join("")}
      </div>
    </details>`;
  }).join("");
  setupReorder(".debt-account-card[data-id]", "debt");
}

window.openDebtDetail = (id)=>{ selectedDebtId=id; setView("debtDetail"); };

function bnplPaymentTransactions(debtId, untilISO="2999-12-31"){
  return visibleTransactionsForDebt(debtId, untilISO)
    .filter(tx => tx.linkedDebtId === debtId && tx.type === "transfer")
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function bnplRemainingBalance(debtId, untilISO="2999-12-31"){
  return bnplPaymentTransactions(debtId, untilISO)
    .filter(tx => tx.status !== "cleared")
    .reduce((sum,tx)=>sum + Number(tx.amount || 0),0);
}
function bnplOriginalPurchaseAmount(debtId, untilISO="2999-12-31"){
  const d = debtById(debtId);
  const paymentTotal = bnplPaymentTransactions(debtId, untilISO)
    .reduce((sum,tx)=>sum + Number(tx.amount || 0),0);

  // Prefer actual installment schedule total, then recorded statement/starting amounts as fallback.
  return paymentTotal || debtStartingBalance(d) || Number(d?.limit || 0) || Number(d?.statementBalance || 0) || Number(d?.balance || 0);
}
function bnplPaidSoFar(debtId, untilISO="2999-12-31"){
  return bnplPaymentTransactions(debtId, untilISO)
    .filter(tx => tx.status === "cleared")
    .reduce((sum,tx)=>sum + Number(tx.amount || 0),0);
}
function bnplNextPayment(debtId){
  const now = todayISO();
  return bnplPaymentTransactions(debtId, toISO(addMonths(new Date(), 24)))
    .filter(tx => tx.status !== "cleared" && tx.date >= now)
    .sort((a,b)=>a.date.localeCompare(b.date))[0] || null;
}
function bnplProgressText(debtId){
  const payments = bnplPaymentTransactions(debtId, toISO(addMonths(new Date(), 24)));
  if(!payments.length) return "No installments found";
  const paid = payments.filter(tx=>tx.status === "cleared").length;
  return `${paid} of ${payments.length} paid`;
}
function medicalPaymentTransactions(debtId, untilISO="2999-12-31"){
  return visibleTransactionsForDebt(debtId, untilISO)
    .filter(tx => tx.linkedDebtId === debtId && tx.type === "transfer")
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function medicalPaidSoFar(d, untilISO="2999-12-31"){
  const starting = debtStartingBalance(d);
  const current = debtAmountLeftNow(d);
  return starting ? Math.max(0, starting - current) : 0;
}
function medicalNextPayment(d){
  const now = todayISO();
  const nextTx = medicalPaymentTransactions(d.id, toISO(addMonths(new Date(), 24)))
    .filter(tx => tx.status !== "cleared" && tx.date >= now)
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(nextTx) return nextTx;
  if(d?.dueDate && Number(d.minDue || 0)){
    return {date:d.dueDate, amount:debtMonthlyPaymentAmount(d), title:`${d.name || "Medical"} payment`, status:d.paymentStatus || "not-set"};
  }
  return null;
}
function medicalPaymentPlanMetricsHTML(d, currentBal){
  const starting = debtStartingBalance(d);
  const paid = medicalPaidSoFar(d, toISO(addMonths(new Date(), 24)));
  const paidPct = starting ? Math.round((Math.min(starting, paid) / starting) * 100) : 0;
  const next = medicalNextPayment(d);
  return `
    <div class="debt-metrics medical-metrics">
      <div class="card mini"><p class="eyebrow">Current balance</p><div class="value">${money(currentBal)}</div><p class="sub">amount left now</p></div>
      <div class="card mini"><p class="eyebrow">Starting balance</p><div class="value">${money(starting)}</div><p class="sub">original/payment-plan amount</p></div>
      <div class="card mini"><p class="eyebrow">Paid so far</p><div class="value">${money(paid)}</div><p class="sub">${starting ? `${paidPct}% paid` : "tracked from payments"}</p></div>
      <div class="card mini"><p class="eyebrow">Monthly payment</p><div class="value">${debtMonthlyPaymentText(d)}</div><p class="sub">${debtMonthlyPaymentSubText(d)}</p></div>
      ${debtEstimatedPayoffCardHTML(d)}
      <div class="card mini"><p class="eyebrow">Plan type</p><div class="debt-status-pill ${debtPaymentStatusClass(d.paymentStatus)}">${debtPaymentStatusLabel(d.paymentStatus)}</div><p class="sub">Interest-free payment plan</p></div>
    </div>`;
}

function bnplDetailMetricsHTML(d){
  const original = bnplOriginalPurchaseAmount(d.id, toISO(addMonths(new Date(), 24)));
  const paid = bnplPaidSoFar(d.id, toISO(addMonths(new Date(), 24)));
  const remaining = bnplRemainingBalance(d.id, toISO(addMonths(new Date(), 24)));
  const next = bnplNextPayment(d.id);
  const progress = original ? Math.round((paid / original) * 100) : 0;

  return `
    <div class="debt-metrics bnpl-metrics">
      <div class="card mini"><p class="eyebrow">Remaining balance</p><div class="value">${money(remaining)}</div><p class="sub">uncleared installments left</p></div>
      <div class="card mini"><p class="eyebrow">Original purchase</p><div class="value">${money(original)}</div><p class="sub">total installment amount</p></div>
      <div class="card mini"><p class="eyebrow">Paid so far</p><div class="value">${money(paid)}</div><p class="sub">${bnplProgressText(d.id)}${original ? ` • ${progress}%` : ""}</p></div>
      <div class="card mini"><p class="eyebrow">Next due</p><div class="value">${next ? money(next.amount) : "—"}</div><p class="sub">${next ? next.date : "No upcoming payment"}</p></div>
      ${debtEstimatedPayoffCardHTML(d)}
      <div class="card mini"><p class="eyebrow">Installment status</p><div class="debt-status-pill ${debtPaymentStatusClass(debtDisplayPaymentStatus(d))}">${debtPaymentStatusLabel(debtDisplayPaymentStatus(d))}</div><p class="sub">${next ? `Next: ${next.title}` : "All planned payments cleared"}</p></div>
    </div>`;
}
function debtDetailMetricsHTML(d, currentBal, util){
  if(isBNPLDebt(d)) return bnplDetailMetricsHTML(d);
  if(isMedicalDebt(d)) return medicalPaymentPlanMetricsHTML(d, currentBal);
  if(isLoanDebt(d)){
    const starting = debtStartingBalance(d);
    const paidPct = starting ? Math.round((Math.max(0, starting-currentBal)/starting)*100) : 0;
    return `
    <div class="debt-metrics">
      <div class="card mini"><p class="eyebrow">Current balance</p><div class="value">${money(currentBal)}</div><p class="sub">amount left now</p></div>
      <div class="card mini"><p class="eyebrow">Starting balance</p><div class="value">${money(starting)}</div><p class="sub">${starting ? `${paidPct}% paid` : "original balance"}</p></div>
      <div class="card mini"><p class="eyebrow">Monthly payment</p><div class="value">${debtMonthlyPaymentText(d)}</div><p class="sub">${debtMonthlyPaymentSubText(d)}</p></div>
      ${debtEstimatedPayoffCardHTML(d)}
      <div class="card mini"><p class="eyebrow">APR</p><div class="value">${Number(d.apr || 0).toFixed(2)}%</div><p class="sub">${Number(d.apr || 0) ? "interest-bearing loan" : "no interest set"}</p></div>
      <div class="card mini"><p class="eyebrow">Forecast split</p><div class="value">${loanForecastSettings(d) ? "On" : "Off"}</div><p class="sub">${loanForecastSummaryText(d)}</p></div>
      <div class="card mini"><p class="eyebrow">Payment status</p><div class="debt-status-pill ${debtPaymentStatusClass(d.paymentStatus)}">${debtPaymentStatusLabel(d.paymentStatus)}</div><p class="sub">Extra: ${money(Number(d.manualExtra || 0))}</p></div>
    </div>`;
  }

  return `
    <div class="debt-metrics">
      <div class="card mini"><p class="eyebrow">Current balance</p><div class="value">${money(currentBal)}</div></div>
      <div class="card mini"><p class="eyebrow">Statement balance</p><div class="value">${debtStatementBalanceText(d)}</div><p class="sub">${d.statementDate ? `Statement ${d.statementDate}` : "Statement date not set"}</p>${debtAfterPaymentText(d) ? `<p class="sub">${debtAfterPaymentText(d)}${debtUtilAfterPaymentText(d) ? ` • ${debtUtilAfterPaymentText(d)}` : ""}</p>` : ""}</div>
      <div class="card mini"><p class="eyebrow">Credit line</p><div class="value">${d.limit ? money(Number(d.limit)) : "—"}</div><p class="sub">${debtCreditLineSubText(d, currentBal, util)}</p></div>
      <div class="card mini"><p class="eyebrow">Monthly payment</p><div class="value">${debtMonthlyPaymentText(d)}</div><p class="sub">${debtMonthlyPaymentSubText(d)}</p></div>
      ${debtEstimatedPayoffCardHTML(d)}
      <div class="card mini"><p class="eyebrow">Payment status</p><div class="debt-status-pill ${debtPaymentStatusClass(debtDisplayPaymentStatus(d))}">${debtPaymentStatusLabel(debtDisplayPaymentStatus(d))}</div><p class="sub">Automatic from statement + payment schedule</p></div>
    </div>`;
}


function openLoanBalanceAdjustment(debtId){
  const d = debtById(debtId);
  if(!d || !isLoanDebt(d)){ alert("Balance adjustments are for loan accounts."); return; }
  const current = debtAmountLeftNow(d);
  simpleTitle.textContent = "Adjust loan balance";
  simpleFields.innerHTML = `
    <p class="hint">Use this when your lender shows a different balance because of interest, fees, or corrections. This creates a non-cash adjustment so your bank history stays clean.</p>
    <div class="two-col">
      <label>Lender balance now<input id="loanAdjustBalance" type="number" step="0.01" value="${current.toFixed(2)}" required></label>
      <label>Adjustment date<input id="loanAdjustDate" type="date" value="${todayISO()}"></label>
    </div>
    <label>Notes<textarea id="loanAdjustNotes" rows="3" placeholder="Statement balance, interest/fee correction, lender app balance, etc."></textarea></label>
    <p class="hint" id="loanAdjustPreview">Current app balance: ${money(current)}</p>
  `;
  setTimeout(()=>{
    const input = document.getElementById("loanAdjustBalance");
    const preview = document.getElementById("loanAdjustPreview");
    const update = ()=>{
      const target = Number(input?.value || current);
      const diff = target - current;
      if(preview) preview.textContent = `Current app balance: ${money(current)} • adjustment: ${diff >= 0 ? "+" : ""}${money(diff)} • new balance: ${money(target)}`;
    };
    input?.addEventListener("input", update);
    update();
  },0);
  simpleSubmit = ()=>{
    const target = Number(document.getElementById("loanAdjustBalance")?.value || current);
    const diff = Number((target - current).toFixed(2));
    if(Math.abs(diff) < 0.005){ alert("No adjustment needed — the balances already match."); return; }
    data.transactions.push({
      id: uid(),
      title: `Balance adjustment - ${d.name}`,
      amount: Math.abs(diff),
      date: document.getElementById("loanAdjustDate")?.value || todayISO(),
      type: "debt-adjustment",
      status: "cleared",
      accountId: "",
      debtAccountId: "",
      categoryId: "loan-payment",
      transferToAccountId: "",
      linkedDebtId: d.id,
      loanPrincipalAmount: "",
      loanInterestAmount: "",
      loanFeeAmount: "",
      loanBalanceAdjustment: diff,
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat: false,
      notes: document.getElementById("loanAdjustNotes")?.value || `Adjusted to lender balance ${money(target)}.`,
      dateOverrides: {}
    });
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
}
window.openLoanBalanceAdjustment = openLoanBalanceAdjustment;

function renderDebtDetail(){
  const d = debtById(selectedDebtId);
  if(!d){ setView("accounts"); return; }
  const txs = visibleTransactionsForDebt(d.id, toISO(addMonths(new Date(),3))).sort((a,b)=>b.date.localeCompare(a.date));
  const currentBal = debtAmountLeftNow(d);
  const util = debtUtilization(d);

  document.getElementById("debtDetailContent").innerHTML = `
    <div class="detail-head compact-detail-head">
      <div class="compact-account-context">
        <button class="ghost small" onclick="setView('accounts')">← Back</button>
        <div>
          <h3><span class="visual-dot" style="background:${d.color || "#8c6f4d"}"></span>${d.emoji || "💳"} ${d.company} • ${d.name}</h3>
          <p class="hint">${d.type} • ${d.owner} • ${debtFrozenText(d)}${d.apr ? ` • ${d.apr}% APR` : ""}</p>
        </div>
      </div>
      <div class="detail-actions detail-actions-v245">
        <button class="primary" onclick="openTransaction(null,{debtAccountId:'${d.id}', type:'expense'})">+ Card/Klarna spend</button>
        <button class="ghost" onclick="openTransaction(null,{linkedDebtId:'${d.id}', type:'transfer'})">+ Payment</button>
        <details class="detail-more-actions">
          <summary class="ghost">More</summary>
          <div class="detail-more-menu">
            <button class="ghost" onclick="simpleDebt('${d.id}'); this.closest('details').removeAttribute('open')">Edit debt</button>
            <button class="ghost" onclick="quickDebtDue('${d.id}'); this.closest('details').removeAttribute('open')">Update due/min</button>
            ${isLoanDebt(d) ? `<button class="ghost" onclick="openLoanBalanceAdjustment('${d.id}'); this.closest('details').removeAttribute('open')">Adjust balance</button>` : ""}
            ${Number(debtMonthlyPaymentAmount(d) || 0) && d.dueDate ? `<button class="ghost" onclick="createDebtMinPayment('${d.id}'); this.closest('details').removeAttribute('open')">Plan payment</button>` : ""}
          </div>
        </details>
      </div>
    </div>

    <section class="panel">
      ${debtDetailMetricsHTML(d, currentBal, util)}
      ${d.notes ? `<div class="notes debt-notes"><b>Notes:</b> ${d.notes}</div>` : ""}
    </section>

    <section class="panel ledger-panel">
      <div class="panel-head ledger-panel-head">
        <div><h3>Transactions</h3><span class="hint">${filteredLedgerTransactions(txs).length} shown of ${txs.length}</span></div>
        <button type="button" class="ghost small" onclick="toggleLedgerFilters()">${ledgerFiltersOpen ? "Hide filters" : "Filters"}</button>
      </div>
      ${ledgerFiltersOpen ? renderTransactionFilters() : ""}
      ${renderLedger(filteredLedgerTransactions(txs))}
    </section>`;
  attachTransactionContextMenus();
}


function templateKey(title){
  return String(title || "").trim().toLowerCase();
}
function txTypeLabel(type){
  return ({expense:"Expense", income:"Income", paycheck:"Paycheck", transfer:"Transfer / Payment"})[type] || String(type || "Transaction");
}
const DEFAULT_TEMPLATE_FIELDS = {
  title:true,
  categoryId:true,
  notes:true,
  type:false,
  status:false,
  accountId:false,
  debtAccountId:false,
  transferToAccountId:false,
  linkedDebtId:false
};
const AUTO_TEMPLATE_FIELDS = {
  ...DEFAULT_TEMPLATE_FIELDS,
  notes:false
};
const TEMPLATE_FIELD_LABELS = {
  title:"title",
  categoryId:"category",
  notes:"notes",
  type:"type",
  status:"status",
  accountId:"cash account",
  debtAccountId:"card/debt used",
  transferToAccountId:"cash transfer-to",
  linkedDebtId:"payment debt"
};
function normalizeTemplateFields(fields){
  return {...DEFAULT_TEMPLATE_FIELDS, ...(fields || {}), title:true};
}
function boolFromCSV(value, fallback=false){
  if(value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  return ["1","true","yes","y","on","checked"].includes(v);
}
function templateSavedFieldNames(t){
  const fields = normalizeTemplateFields(t?.fields);
  return Object.keys(TEMPLATE_FIELD_LABELS).filter(key=>fields[key]).map(key=>TEMPLATE_FIELD_LABELS[key]);
}
function templateFieldSummary(t){
  const names = templateSavedFieldNames(t).filter(name=>name !== "title");
  return names.length ? `Applies ${names.join(", ")}` : "Applies title only";
}
function templateGeneratedVariantLabel(t){
  const cat = categoryById(t.categoryId || "unassigned");
  const bits = [];
  if(normalizeTemplateFields(t.fields).categoryId) bits.push(`${cat.emoji} ${cat.name}`);
  if(normalizeTemplateFields(t.fields).type && t.type) bits.push(txTypeLabel(t.type));
  if(normalizeTemplateFields(t.fields).accountId && t.accountId) bits.push(accountById(t.accountId)?.name || "cash account");
  if(normalizeTemplateFields(t.fields).debtAccountId && t.debtAccountId) bits.push(debtById(t.debtAccountId)?.name || "card/debt");
  if(normalizeTemplateFields(t.fields).transferToAccountId && t.transferToAccountId) bits.push(`to ${accountById(t.transferToAccountId)?.name || "cash"}`);
  if(normalizeTemplateFields(t.fields).linkedDebtId && t.linkedDebtId) bits.push(`pay ${debtById(t.linkedDebtId)?.name || "debt"}`);
  return bits.join(" • ") || templateFieldSummary(t);
}
function templateVariantLabel(t){
  return String(t?.variantLabel || "").trim() || templateGeneratedVariantLabel(t);
}
function normalizeTransactionTemplate(t, {legacySafe=true}={}){
  const baseFields = legacySafe && !t?.fields
    ? {...DEFAULT_TEMPLATE_FIELDS}
    : normalizeTemplateFields(t?.fields);
  return {
    id: t?.id || uid(),
    title: String(t?.title || "").trim(),
    variantLabel: String(t?.variantLabel || "").trim(),
    type: t?.type || "expense",
    status: t?.status || "planned",
    categoryId: t?.categoryId || "unassigned",
    accountId: t?.accountId || "",
    debtAccountId: t?.debtAccountId || "",
    transferToAccountId: t?.transferToAccountId || "",
    linkedDebtId: t?.linkedDebtId || "",
    notes: t?.notes || "",
    fields: normalizeTemplateFields(baseFields),
    isDefault: !!t?.isDefault,
    archived: !!t?.archived,
    source: t?.source || (t?.autoCreated ? "auto" : "legacy"),
    createdAt: t?.createdAt || ""
  };
}
function templateSignature(t){
  const n = normalizeTransactionTemplate(t, {legacySafe:false});
  const f = normalizeTemplateFields(n.fields);
  return JSON.stringify({
    title: templateKey(n.title),
    categoryId: f.categoryId ? n.categoryId : "",
    notes: f.notes ? n.notes : "",
    type: f.type ? n.type : "",
    status: f.status ? n.status : "",
    accountId: f.accountId ? n.accountId : "",
    debtAccountId: f.debtAccountId ? n.debtAccountId : "",
    transferToAccountId: f.transferToAccountId ? n.transferToAccountId : "",
    linkedDebtId: f.linkedDebtId ? n.linkedDebtId : "",
    fields: f
  });
}
function templateMatchesTransaction(t, tx){
  if(!t || !tx || templateKey(t.title) !== templateKey(tx.title)) return false;
  const f = normalizeTemplateFields(t.fields);
  if(f.categoryId && String(t.categoryId || "") !== String(tx.categoryId || "")) return false;
  if(f.notes && String(t.notes || "").trim() && String(t.notes || "").trim() !== String(tx.notes || "").trim()) return false;
  if(f.type && String(t.type || "") !== String(tx.type || "")) return false;
  if(f.status && String(t.status || "") !== String(tx.status || "")) return false;
  if(f.accountId && String(t.accountId || "") !== String(tx.accountId || "")) return false;
  if(f.debtAccountId && String(t.debtAccountId || "") !== String(tx.debtAccountId || "")) return false;
  if(f.transferToAccountId && String(t.transferToAccountId || "") !== String(tx.transferToAccountId || "")) return false;
  if(f.linkedDebtId && String(t.linkedDebtId || "") !== String(tx.linkedDebtId || "")) return false;
  return true;
}
function templateUsageStats(t){
  const matches = (data.transactions || []).filter(tx=>templateMatchesTransaction(t, tx));
  const dates = matches.map(tx=>String(tx.date || "")).filter(Boolean).sort();
  return {
    count: matches.length,
    lastDate: dates.at(-1) || "",
    planned: matches.filter(tx=>tx.status === "planned").length,
    cleared: matches.filter(tx=>tx.status === "cleared").length
  };
}
function templateLastUsedLabel(date){
  if(!date) return "Never used";
  try{return `Last ${parseDate(date).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}`;}
  catch(err){return `Last ${date}`;}
}
function normalizeTransactionTemplates(){
  data.settings ||= {};
  const seenIds = new Set();
  data.settings.transactionTemplates = (data.settings.transactionTemplates || [])
    .map(t=>normalizeTransactionTemplate(t))
    .filter(t=>{
      if(!t.title) return false;
      if(seenIds.has(t.id)) t.id = uid();
      seenIds.add(t.id);
      return true;
    });
  const families = new Map();
  data.settings.transactionTemplates.forEach(t=>{
    const key = templateKey(t.title);
    if(!families.has(key)) families.set(key, []);
    families.get(key).push(t);
  });
  families.forEach(items=>{
    const active = items.filter(t=>!t.archived);
    if(!active.length) return;
    const defaults = active.filter(t=>t.isDefault);
    if(defaults.length > 1) defaults.slice(1).forEach(t=>t.isDefault=false);
    if(!defaults.length){
      const best = [...active].sort((a,b)=>templateUsageStats(b).count-templateUsageStats(a).count || templateVariantLabel(a).localeCompare(templateVariantLabel(b)))[0];
      if(best) best.isDefault = true;
    }
  });
  data.settings.transactionTemplates.sort((a,b)=>String(a.title || "").localeCompare(String(b.title || "")) || Number(b.isDefault)-Number(a.isDefault) || templateVariantLabel(a).localeCompare(templateVariantLabel(b)));
  return data.settings.transactionTemplates;
}
function transactionTemplateFamilies({includeArchived=true, templates=null}={}){
  const source = (templates || normalizeTransactionTemplates()).filter(t=>includeArchived || !t.archived);
  const map = new Map();
  source.forEach(t=>{
    const key = templateKey(t.title);
    if(!map.has(key)) map.set(key,{key,title:t.title,templates:[]});
    map.get(key).templates.push(t);
  });
  return [...map.values()].sort((a,b)=>a.title.localeCompare(b.title));
}
function cleanTemplateFromTx(tx){
  // Auto-saved shortcuts intentionally remember only title + category. Routing,
  // status, notes, and recurrence stay opt-in so ordinary entries do not create
  // a swarm of almost-identical templates.
  return normalizeTransactionTemplate({
    id: tx.templateId || uid(),
    title: String(tx.title || "").trim(),
    type: tx.type || "expense",
    status: tx.status || "planned",
    categoryId: tx.categoryId || "unassigned",
    accountId: tx.accountId || "",
    debtAccountId: tx.debtAccountId || "",
    transferToAccountId: tx.transferToAccountId || "",
    linkedDebtId: tx.linkedDebtId || "",
    notes: "",
    fields: {...AUTO_TEMPLATE_FIELDS},
    source:"auto",
    createdAt:new Date().toISOString()
  }, {legacySafe:false});
}
function rememberTransactionTemplate(tx){
  if(!tx || !tx.title || !String(tx.title).trim()) return;
  // Recurring schedules belong to Bills. Their generated/edited occurrences
  // should not create another template variant every time they are saved.
  if(isRecurring(tx) || tx.wasRecurringOccurrence || tx.recurringSourceId || tx.recurrenceSourceId) return;
  data.settings ||= {};
  normalizeTransactionTemplates();

  const tpl = cleanTemplateFromTx(tx);
  const sig = templateSignature(tpl);
  const existing = data.settings.transactionTemplates.find(t => templateSignature(t) === sig);
  if(existing){
    if(existing.source === "auto") Object.assign(existing, {...tpl, id:existing.id, isDefault:existing.isDefault, archived:false, createdAt:existing.createdAt || tpl.createdAt});
  } else {
    const familyExists = data.settings.transactionTemplates.some(t=>templateKey(t.title)===templateKey(tpl.title) && !t.archived);
    tpl.isDefault = !familyExists;
    data.settings.transactionTemplates.push(tpl);
  }
  normalizeTransactionTemplates();
}
function templateContextScore(t){
  let score = t.isDefault ? 100 : 0;
  const f = normalizeTemplateFields(t.fields);
  const current = {
    categoryId:document.getElementById("txCategory")?.value || "",
    type:document.getElementById("txType")?.value || "",
    status:document.getElementById("txStatus")?.value || "",
    accountId:document.getElementById("txAccount")?.value || "",
    debtAccountId:document.getElementById("txDebtAccount")?.value || "",
    transferToAccountId:document.getElementById("txTransferTo")?.value || "",
    linkedDebtId:document.getElementById("txDebt")?.value || ""
  };
  if(f.accountId && t.accountId && current.accountId === t.accountId) score += 45;
  if(f.debtAccountId && t.debtAccountId && current.debtAccountId === t.debtAccountId) score += 45;
  if(f.transferToAccountId && t.transferToAccountId && current.transferToAccountId === t.transferToAccountId) score += 35;
  if(f.linkedDebtId && t.linkedDebtId && current.linkedDebtId === t.linkedDebtId) score += 35;
  if(f.type && current.type === t.type) score += 20;
  if(f.categoryId && current.categoryId === t.categoryId) score += 10;
  score += Math.min(20, templateUsageStats(t).count);
  return score;
}
function matchingTransactionTemplates(query){
  const q = templateKey(query);
  if(!q) return [];
  return normalizeTransactionTemplates()
    .filter(t => !t.archived && templateKey(t.title).includes(q))
    .sort((a,b)=>{
      const aKey=templateKey(a.title), bKey=templateKey(b.title);
      const aExact=aKey===q?2:aKey.startsWith(q)?1:0;
      const bExact=bKey===q?2:bKey.startsWith(q)?1:0;
      return bExact-aExact || templateContextScore(b)-templateContextScore(a) || a.title.localeCompare(b.title) || templateVariantLabel(a).localeCompare(templateVariantLabel(b));
    });
}
function matchingTransactionTemplateFamilies(query){
  const q = templateKey(query);
  if(!q) return [];
  const matches = matchingTransactionTemplates(query);
  const families = transactionTemplateFamilies({includeArchived:false,templates:matches});
  families.forEach(family=>family.templates.sort((a,b)=>templateContextScore(b)-templateContextScore(a) || Number(b.isDefault)-Number(a.isDefault) || templateVariantLabel(a).localeCompare(templateVariantLabel(b))));
  return families.sort((a,b)=>{
    const aKey=templateKey(a.title), bKey=templateKey(b.title);
    const aExact=aKey===q?2:aKey.startsWith(q)?1:0;
    const bExact=bKey===q?2:bKey.startsWith(q)?1:0;
    return bExact-aExact || templateContextScore(b.templates[0])-templateContextScore(a.templates[0]) || a.title.localeCompare(b.title);
  }).slice(0,8);
}
function applyTransactionTemplate(templateId){
  const tpl = normalizeTransactionTemplate((data.settings?.transactionTemplates || []).find(t => t.id === templateId));
  if(!tpl || !tpl.title || tpl.archived) return;

  const fields = normalizeTemplateFields(tpl.fields);
  const txTitleEl = document.getElementById("txTitle");
  const txCategoryEl = document.getElementById("txCategory");
  const txNotesEl = document.getElementById("txNotes");

  if(fields.title && txTitleEl) txTitleEl.value = tpl.title || txTitleEl.value;
  if(fields.categoryId && txCategoryEl && tpl.categoryId) txCategoryEl.value = tpl.categoryId;
  if(fields.type && document.getElementById("txType")) txType.value = tpl.type || txType.value;
  if(fields.status && document.getElementById("txStatus")) txStatus.value = tpl.status || txStatus.value;

  updateTransactionFormUI();

  if(fields.accountId && document.getElementById("txAccount")) txAccount.value = tpl.accountId || "";
  if(fields.debtAccountId && document.getElementById("txDebtAccount")) txDebtAccount.value = tpl.debtAccountId || "";
  if(fields.transferToAccountId && document.getElementById("txTransferTo")) txTransferTo.value = tpl.transferToAccountId || "";
  if(fields.linkedDebtId && document.getElementById("txDebt")) txDebt.value = tpl.linkedDebtId || "";
  if(fields.notes && txNotesEl && tpl.notes && !txNotesEl.value) txNotesEl.value = tpl.notes;

  updateTransactionFormUI();
  hideTemplateSuggestions();
}
function renderTemplateSuggestions(){
  try{
    const box = document.getElementById("txTemplateSuggestions");
    const txTitleEl = document.getElementById("txTitle");
    if(!box || !txTitleEl) return;

    const families = matchingTransactionTemplateFamilies(txTitleEl.value);
    if(!families.length){
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = families.map(family=>{
      const best=family.templates[0];
      const others=family.templates.slice(1);
      const bestMeta = family.templates.length > 1
        ? `${templateVariantLabel(best)} • ${templateFieldSummary(best)}`
        : templateFieldSummary(best);
      return `<div class="template-suggestion-family compact">
        <div class="template-suggestion-row compact">
          <button type="button" class="template-suggestion-main" data-template-id="${best.id}">
            <span><b>${escapeAttr(family.title)}</b><small>${escapeAttr(bestMeta)}</small></span>
          </button>
          ${others.length?`<details class="template-suggestion-variants"><summary>${family.templates.length} options</summary><div class="template-suggestion-variant-menu">${family.templates.map(t=>`<button type="button" data-template-id="${t.id}"><b>${escapeAttr(templateVariantLabel(t))}${t.isDefault?' • Default':''}</b><small>${escapeAttr(templateFieldSummary(t))}</small></button>`).join("")}</div></details>`:""}
        </div>
      </div>`;
    }).join("");

    box.querySelectorAll("[data-template-id]").forEach(btn=>{ btn.onclick = () => applyTransactionTemplate(btn.dataset.templateId); });
    box.classList.add("open");
  } catch(err){ console.warn("Template suggestions could not render", err); }
}
function hideTemplateSuggestions(){
  const box = document.getElementById("txTemplateSuggestions");
  if(box) box.classList.remove("open");
}
function deleteTemplateSuggestion(id){
  data.settings ||= {};
  data.settings.transactionTemplates ||= [];
  const before = data.settings.transactionTemplates.length;
  data.settings.transactionTemplates = data.settings.transactionTemplates.filter(t=>t.id !== id);
  if(data.settings.transactionTemplates.length !== before){
    normalizeTransactionTemplates();
    saveData();
    renderTemplateSuggestions();
    renderTransactionTemplates();
  }
}
function templateFamilyUsageStats(family){
  const matching = (data.transactions || []).filter(tx=>templateKey(tx.title)===family.key);
  const dates = matching.map(tx=>String(tx.date||"")).filter(Boolean).sort();
  return {count:matching.length,lastDate:dates.at(-1)||""};
}
function renderTransactionTemplates(){
  const list = document.getElementById("transactionTemplateList");
  if(!list) return;
  const families = transactionTemplateFamilies({includeArchived:true});
  if(!families.length){
    list.innerHTML = `<div class="empty">No templates yet. Saving a normal transaction automatically remembers a simple title + category shortcut.</div>`;
    return;
  }

  const rowMarkup=t=>{const usage=templateUsageStats(t);return `<div class="template-variant-row ${t.archived?'archived':''}">
    <div class="template-variant-main">
      <div class="row-title">${escapeAttr(templateVariantLabel(t))} ${t.isDefault&&!t.archived?'<span class="template-badge default">Default</span>':''}${t.archived?'<span class="template-badge archived">Archived</span>':''}</div>
      <div class="row-sub">${escapeAttr(templateFieldSummary(t))}</div>
      <div class="row-sub">${usage.count} use${usage.count===1?'':'s'} • ${templateLastUsedLabel(usage.lastDate)}</div>
    </div>
    <button class="ghost small" data-template-edit="${t.id}">Edit</button>
    <details class="template-variant-menu">
      <summary aria-label="More template actions">•••</summary>
      <div class="template-variant-menu-popover">
        ${!t.archived&&!t.isDefault?`<button class="ghost small" data-template-default="${t.id}">Make default</button>`:''}
        <button class="ghost small" data-template-archive="${t.id}">${t.archived?'Restore':'Archive'}</button>
        <button class="danger ghost small" data-template-delete="${t.id}">Delete</button>
      </div>
    </details>
  </div>`;};

  list.innerHTML = families.map(family=>{
    const stats=templateFamilyUsageStats(family);
    const active=family.templates.filter(t=>!t.archived);
    const archived=family.templates.filter(t=>t.archived);
    const preferred=active.find(t=>t.isDefault) || [...active].sort((a,b)=>templateUsageStats(b).count-templateUsageStats(a).count)[0];
    const preview=preferred ? `${templateVariantLabel(preferred)} • ${templateGeneratedVariantLabel(preferred)}` : "Archived only";
    return `<details class="template-family">
      <summary class="template-family-summary">
        <span class="template-family-name"><b>${escapeAttr(family.title)}</b><small>${escapeAttr(preview)}</small></span>
        <span class="template-family-meta"><b>${active.length}</b><small>option${active.length===1?'':'s'} • ${stats.count} use${stats.count===1?'':'s'}</small></span>
      </summary>
      <div class="template-family-body">
        <div class="template-family-toolbar"><span class="hint">Choose an option to edit only when this title needs different routing or behavior.</span><button class="ghost small" type="button" data-template-add-variant="${escapeAttr(family.title)}">+ Add option</button></div>
        <div class="template-active-variants">${active.map(rowMarkup).join("") || '<div class="empty">No active options.</div>'}</div>
        ${archived.length?`<details class="template-archived-group"><summary>Archived (${archived.length})</summary><div class="template-archived-list">${archived.map(rowMarkup).join("")}</div></details>`:""}
      </div>
    </details>`;
  }).join("");

  list.querySelectorAll("[data-template-add-variant]").forEach(btn=>btn.onclick=()=>simpleTemplate(null,btn.dataset.templateAddVariant));
  list.querySelectorAll("[data-template-edit]").forEach(btn=>btn.onclick=()=>simpleTemplate(btn.dataset.templateEdit));
  list.querySelectorAll("[data-template-delete]").forEach(btn=>btn.onclick=()=>deleteTemplate(btn.dataset.templateDelete));
  list.querySelectorAll("[data-template-default]").forEach(btn=>btn.onclick=()=>setDefaultTemplate(btn.dataset.templateDefault));
  list.querySelectorAll("[data-template-archive]").forEach(btn=>btn.onclick=()=>toggleTemplateArchived(btn.dataset.templateArchive));
}
function setDefaultTemplate(id){
  normalizeTransactionTemplates();
  const target=data.settings.transactionTemplates.find(t=>t.id===id);
  if(!target) return;
  const key=templateKey(target.title);
  data.settings.transactionTemplates.forEach(t=>{if(templateKey(t.title)===key)t.isDefault=t.id===id;});
  target.archived=false;
  saveData();
}
function toggleTemplateArchived(id){
  normalizeTransactionTemplates();
  const target=data.settings.transactionTemplates.find(t=>t.id===id);
  if(!target) return;
  target.archived=!target.archived;
  if(target.archived) target.isDefault=false;
  normalizeTransactionTemplates();
  saveData();
}
function deleteTemplate(id){
  if(!confirm("Delete this transaction template variant? This does not delete any transactions.")) return;
  data.settings ||= {};
  data.settings.transactionTemplates = (data.settings.transactionTemplates || []).filter(t=>t.id !== id);
  normalizeTransactionTemplates();
  saveData();
}
function templateCheckbox(key, label, checked){
  return `<label class="checkbox template-field-toggle"><input type="checkbox" id="sTplField_${key}" ${checked ? "checked" : ""}> ${label}</label>`;
}
function simpleTemplate(id=null, familyTitle=""){
  data.settings ||= {};
  normalizeTransactionTemplates();
  const tpl = id ? normalizeTransactionTemplate(data.settings.transactionTemplates.find(t=>t.id===id)) : normalizeTransactionTemplate({title:familyTitle,source:"manual",createdAt:new Date().toISOString()}, {legacySafe:false});
  const fields = normalizeTemplateFields(id ? tpl.fields : AUTO_TEMPLATE_FIELDS);
  const ignore = "__ignore__";
  const option = (value,label,selectedValue)=>`<option value="${escapeAttr(value)}" ${String(value)===String(selectedValue)?"selected":""}>${escapeAttr(label)}</option>`;
  const optionalSelect = (selectedValue, options)=>option(ignore,"Don't change",selectedValue)+options;

  simpleTitle.textContent = id ? "Edit template" : (familyTitle ? `Add ${familyTitle} option` : "Add transaction template");
  simpleFields.innerHTML = `
    <div class="template-editor-intro">
      <b>Keep templates simple.</b>
      <span>Title + category are usually enough. Only add routing or status when this option should deliberately change them.</span>
    </div>
    <div class="two-col">
      <label>Transaction title<input id="sTplTitle" value="${escapeAttr(tpl?.title || familyTitle || "")}" placeholder="Gas" required></label>
      <label>Option name, optional<input id="sTplVariantLabel" value="${escapeAttr(tpl?.variantLabel || "")}" placeholder="Joint card, Mak debit…"></label>
    </div>
    <label>Category
      <select id="sTplCategory">
        ${option(ignore,"Don't change category",fields.categoryId ? "" : ignore)}
        ${sortedCategories().map(c=>option(c.id,`${c.emoji} ${c.name}`,fields.categoryId ? (tpl.categoryId || "unassigned") : "")).join("")}
      </select>
    </label>
    <label class="checkbox-row"><input id="sTplDefault" type="checkbox" ${tpl.isDefault?"checked":""}> Use this option by default for this title</label>

    <details class="form-details template-advanced-details">
      <summary><span>Advanced autofill</span><small>Optional</small></summary>
      <div class="details-inner">
        <div class="two-col">
          <label>Type<select id="sTplType">${optionalSelect(fields.type ? tpl.type : ignore,
            option("expense","Expense",fields.type ? tpl.type : ignore)+option("income","Income",fields.type ? tpl.type : ignore)+option("paycheck","Paycheck",fields.type ? tpl.type : ignore)+option("transfer","Transfer / Payment",fields.type ? tpl.type : ignore))}</select></label>
          <label>Status<select id="sTplStatus">${optionalSelect(fields.status ? tpl.status : ignore,
            option("planned","Planned",fields.status ? tpl.status : ignore)+option("cleared","Cleared",fields.status ? tpl.status : ignore))}</select></label>
        </div>
        <label>Cash account<select id="sTplAccount">${optionalSelect(fields.accountId ? tpl.accountId : ignore,
          option("","None",fields.accountId ? tpl.accountId : ignore)+data.accounts.map(a=>option(a.id,a.name,fields.accountId ? tpl.accountId : ignore)).join(""))}</select></label>
        <label>Card/debt used for spending<select id="sTplDebtAccount">${optionalSelect(fields.debtAccountId ? tpl.debtAccountId : ignore,
          option("","None",fields.debtAccountId ? tpl.debtAccountId : ignore)+data.debts.map(d=>option(d.id,`${d.company} • ${d.name}`,fields.debtAccountId ? tpl.debtAccountId : ignore)).join(""))}</select></label>
        <label>Transfer to cash account<select id="sTplTransferTo">${optionalSelect(fields.transferToAccountId ? tpl.transferToAccountId : ignore,
          option("","None",fields.transferToAccountId ? tpl.transferToAccountId : ignore)+data.accounts.map(a=>option(a.id,a.name,fields.transferToAccountId ? tpl.transferToAccountId : ignore)).join(""))}</select></label>
        <label>Payment to debt<select id="sTplLinkedDebt">${optionalSelect(fields.linkedDebtId ? tpl.linkedDebtId : ignore,
          option("","None",fields.linkedDebtId ? tpl.linkedDebtId : ignore)+data.debts.map(d=>option(d.id,`${d.company} • ${d.name}`,fields.linkedDebtId ? tpl.linkedDebtId : ignore)).join(""))}</select></label>
        <label class="checkbox-row"><input id="sTplApplyNotes" type="checkbox" ${fields.notes?"checked":""}> Autofill a saved note</label>
        <label>Saved note<textarea id="sTplNotes" placeholder="Optional">${escapeAttr(tpl?.notes || "")}</textarea></label>
      </div>
    </details>
    <p class="hint">Recurring schedules stay on the Bills page and are never stored in transaction templates.</p>`;

  const categorySelect=document.getElementById("sTplCategory");
  if(categorySelect) categorySelect.value = fields.categoryId ? (tpl.categoryId || "unassigned") : ignore;
  const setOptional=(elId,enabled,value)=>{const el=document.getElementById(elId);if(el)el.value=enabled?String(value??""):ignore;};
  setOptional("sTplType",fields.type,tpl.type||"expense");
  setOptional("sTplStatus",fields.status,tpl.status||"planned");
  setOptional("sTplAccount",fields.accountId,tpl.accountId||"");
  setOptional("sTplDebtAccount",fields.debtAccountId,tpl.debtAccountId||"");
  setOptional("sTplTransferTo",fields.transferToAccountId,tpl.transferToAccountId||"");
  setOptional("sTplLinkedDebt",fields.linkedDebtId,tpl.linkedDebtId||"");

  simpleSubmit = ()=>{
    const titleEl = document.getElementById("sTplTitle");
    if(!titleEl || !titleEl.value.trim()) return false;
    const readChoice=id=>document.getElementById(id)?.value ?? ignore;
    const categoryChoice=readChoice("sTplCategory"), typeChoice=readChoice("sTplType"), statusChoice=readChoice("sTplStatus");
    const accountChoice=readChoice("sTplAccount"), debtAccountChoice=readChoice("sTplDebtAccount"), transferChoice=readChoice("sTplTransferTo"), linkedDebtChoice=readChoice("sTplLinkedDebt");
    const nextFields = normalizeTemplateFields({
      categoryId: categoryChoice !== ignore,
      notes: !!document.getElementById("sTplApplyNotes")?.checked,
      type: typeChoice !== ignore,
      status: statusChoice !== ignore,
      accountId: accountChoice !== ignore,
      debtAccountId: debtAccountChoice !== ignore,
      transferToAccountId: transferChoice !== ignore,
      linkedDebtId: linkedDebtChoice !== ignore
    });
    const payload = normalizeTransactionTemplate({
      id:id || uid(), title:titleEl.value.trim(), variantLabel:document.getElementById("sTplVariantLabel")?.value || "",
      categoryId:categoryChoice!==ignore?categoryChoice:(tpl.categoryId||"unassigned"),
      type:typeChoice!==ignore?typeChoice:(tpl.type||"expense"), status:statusChoice!==ignore?statusChoice:(tpl.status||"planned"),
      accountId:accountChoice!==ignore?accountChoice:(tpl.accountId||""), debtAccountId:debtAccountChoice!==ignore?debtAccountChoice:(tpl.debtAccountId||""),
      transferToAccountId:transferChoice!==ignore?transferChoice:(tpl.transferToAccountId||""), linkedDebtId:linkedDebtChoice!==ignore?linkedDebtChoice:(tpl.linkedDebtId||""),
      notes:document.getElementById("sTplNotes")?.value || tpl.notes || "", fields:nextFields,
      isDefault:!!document.getElementById("sTplDefault")?.checked, archived:false,
      source:id?(tpl.source||"manual"):"manual", createdAt:tpl.createdAt || new Date().toISOString()
    }, {legacySafe:false});
    if(id){
      const existing=data.settings.transactionTemplates.find(t=>t.id===id);
      if(existing) Object.assign(existing,payload,{id});
    } else data.settings.transactionTemplates.push(payload);
    if(payload.isDefault){
      data.settings.transactionTemplates.forEach(t=>{if(t.id!==payload.id&&templateKey(t.title)===templateKey(payload.title))t.isDefault=false;});
    }
    normalizeTransactionTemplates();
  };
  simpleDelete = id ? ()=>deleteTemplate(id) : null;
  deleteSimpleBtn.style.display = id ? "inline-block" : "none";
  simpleModal.showModal();
}
function exactTemplateDuplicateGroups(){
  const groups=new Map();
  normalizeTransactionTemplates().forEach(t=>{
    const sig=templateSignature(t);
    if(!groups.has(sig))groups.set(sig,[]);
    groups.get(sig).push(t);
  });
  return [...groups.values()].filter(items=>items.length>1);
}
function mergeExactTemplateDuplicates(){
  const groups=exactTemplateDuplicateGroups();
  if(!groups.length){alert("No exact duplicate templates were found.");return;}
  groups.forEach(items=>{
    const keep=items.find(t=>t.isDefault&&!t.archived)||items.find(t=>!t.archived)||items[0];
    keep.archived=items.every(t=>t.archived);
    keep.isDefault=items.some(t=>t.isDefault)&&!keep.archived;
    const ids=new Set(items.filter(t=>t.id!==keep.id).map(t=>t.id));
    data.settings.transactionTemplates=data.settings.transactionTemplates.filter(t=>!ids.has(t.id));
  });
  normalizeTransactionTemplates(); saveData(); renderTemplateCleanup();
}
function templateCleanupFamilySection(familyKey){
  return [...document.querySelectorAll("[data-template-cleanup-family]")].find(el=>el.dataset.templateCleanupFamily===familyKey) || null;
}
function selectedTemplateCleanupIds(familyKey){
  const section=templateCleanupFamilySection(familyKey);
  return section ? [...section.querySelectorAll("input[data-template-cleanup-select]:checked")].map(el=>el.value) : [];
}
function mergeSelectedTemplateVariants(familyKey){
  const ids=selectedTemplateCleanupIds(familyKey);
  if(ids.length<2){alert("Select at least two variants to merge.");return;}
  const targetId=templateCleanupFamilySection(familyKey)?.querySelector("[data-template-merge-target]")?.value || ids[0];
  if(!ids.includes(targetId)){alert("Choose one of the selected variants as the version to keep.");return;}
  const target=data.settings.transactionTemplates.find(t=>t.id===targetId);
  if(!target)return;
  if(!confirm(`Merge ${ids.length} variants into “${templateVariantLabel(target)}”? The kept variant's field choices and routing will win.`))return;
  const remove=new Set(ids.filter(id=>id!==targetId));
  data.settings.transactionTemplates=data.settings.transactionTemplates.filter(t=>!remove.has(t.id));
  target.archived=false; target.isDefault=true;
  data.settings.transactionTemplates.forEach(t=>{if(t.id!==target.id&&templateKey(t.title)===familyKey)t.isDefault=false;});
  normalizeTransactionTemplates(); saveData(); renderTemplateCleanup();
}
function archiveSelectedTemplateVariants(familyKey){
  const ids=selectedTemplateCleanupIds(familyKey); if(!ids.length){alert("Select at least one variant.");return;}
  data.settings.transactionTemplates.forEach(t=>{if(ids.includes(t.id)){t.archived=true;t.isDefault=false;}});
  normalizeTransactionTemplates();saveData();renderTemplateCleanup();
}
function deleteSelectedTemplateVariants(familyKey){
  const ids=selectedTemplateCleanupIds(familyKey); if(!ids.length){alert("Select at least one variant.");return;}
  if(!confirm(`Delete ${ids.length} selected template variant${ids.length===1?'':'s'}? Transactions will not be deleted.`))return;
  const remove=new Set(ids); data.settings.transactionTemplates=data.settings.transactionTemplates.filter(t=>!remove.has(t.id));
  normalizeTransactionTemplates();saveData();renderTemplateCleanup();
}
function renderTemplateCleanup(){
  const summary=document.getElementById("templateCleanupSummary");
  const content=document.getElementById("templateCleanupContent");
  if(!summary||!content)return;
  const families=transactionTemplateFamilies({includeArchived:true});
  const templates=normalizeTransactionTemplates();
  const exact=exactTemplateDuplicateGroups();
  const unused=templates.filter(t=>templateUsageStats(t).count===0).length;
  const duplicateCount=exact.reduce((n,g)=>n+g.length-1,0);
  summary.innerHTML=`<span><b>${families.length}</b> families</span><span><b>${templates.filter(t=>!t.archived).length}</b> active options</span><span><b>${duplicateCount}</b> exact duplicates</span><span><b>${unused}</b> unused</span>`;
  content.innerHTML=families.map(family=>`<details class="cleanup-family" data-template-cleanup-family="${escapeAttr(family.key)}">
    <summary class="cleanup-family-summary"><span><b>${escapeAttr(family.title)}</b><small>${family.templates.length} option${family.templates.length===1?'':'s'}</small></span><span>Review</span></summary>
    <div class="cleanup-family-body">
      <p class="hint">Select only the versions you intentionally want to combine, archive, or delete.</p>
      <div class="cleanup-variant-list">${family.templates.map(t=>{const u=templateUsageStats(t);return `<label class="cleanup-variant-row"><input type="checkbox" data-template-cleanup-select value="${t.id}"><span><b>${escapeAttr(templateVariantLabel(t))}</b><small>${escapeAttr(templateFieldSummary(t))} • ${u.count} use${u.count===1?'':'s'}${t.archived?' • Archived':''}${t.isDefault?' • Default':''}</small></span><button type="button" class="ghost small" data-template-cleanup-edit="${t.id}">Edit</button></label>`;}).join("")}</div>
      <div class="cleanup-family-actions">
        <label>Merge into<select data-template-merge-target>${family.templates.map(t=>`<option value="${t.id}">${escapeAttr(templateVariantLabel(t))}</option>`).join("")}</select></label>
        <div class="inline-actions"><button type="button" class="ghost small" data-template-cleanup-action="merge">Merge selected</button><button type="button" class="ghost small" data-template-cleanup-action="archive">Archive selected</button><button type="button" class="danger ghost small" data-template-cleanup-action="delete">Delete selected</button></div>
      </div>
    </div>
  </details>`).join("") || `<div class="empty">No transaction templates yet.</div>`;
  content.querySelectorAll("[data-template-cleanup-edit]").forEach(btn=>btn.onclick=()=>{document.getElementById("templateCleanupModal")?.close();simpleTemplate(btn.dataset.templateCleanupEdit);});
  content.querySelectorAll("[data-template-cleanup-action]").forEach(btn=>btn.onclick=()=>{
    const familyKey=btn.closest("[data-template-cleanup-family]")?.dataset.templateCleanupFamily || "";
    if(btn.dataset.templateCleanupAction==="merge")mergeSelectedTemplateVariants(familyKey);
    if(btn.dataset.templateCleanupAction==="archive")archiveSelectedTemplateVariants(familyKey);
    if(btn.dataset.templateCleanupAction==="delete")deleteSelectedTemplateVariants(familyKey);
  });
}
function openTemplateCleanup(){
  renderTemplateCleanup();
  document.getElementById("templateCleanupModal")?.showModal();
}
window.openTemplateCleanup=openTemplateCleanup;
window.mergeExactTemplateDuplicates=mergeExactTemplateDuplicates;
window.mergeSelectedTemplateVariants=mergeSelectedTemplateVariants;
window.archiveSelectedTemplateVariants=archiveSelectedTemplateVariants;
window.deleteSelectedTemplateVariants=deleteSelectedTemplateVariants;


function renderPaycheckSettings(){
  data.settings ||= {};
  data.settings.paycheckProfiles ||= {};
  const mak = data.settings.paycheckProfiles.Mak || {};
  const ty = data.settings.paycheckProfiles.Ty || {};

  const setVal = (id, val)=>{
    const el = document.getElementById(id);
    if(el) el.value = val ?? "";
  };

  setVal("makHourlyRate", mak.hourlyRate ?? 24);
  setVal("makHoursPerWorkday", mak.hoursPerWorkday ?? 8);
  setVal("makDeductionPercent", mak.deductionPercent ?? 18.51);
  setVal("makFixedDeduction", mak.fixedDeduction ?? 0);

  setVal("tyHourlyRate", ty.hourlyRate ?? 22);
  setVal("tyDefaultHours", ty.defaultHours ?? 38);
  setVal("tyDeductionPercent", ty.deductionPercent ?? 18.51);
  setVal("tyFixedDeduction", ty.fixedDeduction ?? 0);

  const count = document.getElementById("settingsPaycheckCount");
  if(count) count.textContent = "2";
}
function savePaycheckSettingsFromForm(){
  data.settings ||= {};
  data.settings.paycheckProfiles ||= {};
  data.settings.paycheckProfiles.Mak = {
    ...(data.settings.paycheckProfiles.Mak || {}),
    enabled:true,
    mode:"pay-period-weekdays",
    hourlyRate:Number(document.getElementById("makHourlyRate")?.value || 0),
    hoursPerWorkday:Number(document.getElementById("makHoursPerWorkday")?.value || 0),
    deductionPercent:Number(document.getElementById("makDeductionPercent")?.value || 0),
    fixedDeduction:Number(document.getElementById("makFixedDeduction")?.value || 0)
  };
  data.settings.paycheckProfiles.Ty = {
    ...(data.settings.paycheckProfiles.Ty || {}),
    enabled:true,
    mode:"fixed-hours",
    hourlyRate:Number(document.getElementById("tyHourlyRate")?.value || 0),
    defaultHours:Number(document.getElementById("tyDefaultHours")?.value || 0),
    deductionPercent:Number(document.getElementById("tyDeductionPercent")?.value || 0),
    fixedDeduction:Number(document.getElementById("tyFixedDeduction")?.value || 0)
  };
  saveData();
}
function attachPaycheckSettingsListeners(){
  ["makHourlyRate","makHoursPerWorkday","makDeductionPercent","makFixedDeduction","tyHourlyRate","tyDefaultHours","tyDeductionPercent","tyFixedDeduction"].forEach(id=>{
    const el = document.getElementById(id);
    if(el && !el.dataset.listenerAttached){
      el.dataset.listenerAttached = "true";
      el.addEventListener("change", savePaycheckSettingsFromForm);
    }
  });
}


function recentChangeTimeLabel(iso){
  try{
    return new Date(iso).toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
  } catch(err){ return "recently"; }
}
function renderRecentChanges(){
  const list = document.getElementById("recentChangesList");
  if(!list) return;
  const history = loadChangeHistory();
  const undoBtn = document.getElementById("undoLastChangeBtn");
  const clearBtn = document.getElementById("clearChangeHistoryBtn");
  if(undoBtn) undoBtn.disabled = !history.length;
  if(clearBtn) clearBtn.disabled = !history.length;

  if(!history.length){
    list.innerHTML = `<div class="empty">No undoable changes recorded yet. New local edits will appear here. Cloud save/load dates can be newer because undo history stays on this browser only.</div>`;
    return;
  }

  list.innerHTML = history.slice(0,8).map((item, index)=>{
    const canUndo = !!item.before && !item.storageLimited;
    return `
    <details class="template-row change-row" ${index === 0 ? "open" : ""}>
      <summary>
        <span>
          <span class="row-title">${item.label || "Changed Money Nest data"}${item.storageLimited ? " · storage-limited" : ""}</span>
          <span class="row-sub">${recentChangeTimeLabel(item.at)} · local browser history</span>
        </span>
        ${index === 0 && canUndo ? `<button type="button" class="ghost small" onclick="event.preventDefault(); event.stopPropagation(); undoLastChange();">Undo</button>` : ""}
      </summary>
      <div class="change-detail">${changeDetailsHTML(item, index)}</div>
    </details>`;
  }).join("");
}
function undoLastChange(){
  const history = loadChangeHistory();
  const item = history.shift();
  if(!item){ alert("No recent change to undo."); return; }
  if(!item.before || item.storageLimited){ alert("That recent change does not have an undo snapshot saved. Browser storage may have been full."); return; }
  if(!confirm(`Undo: ${item.label || "last change"}?`)) return;
  try{
    suppressChangeHistory = true;
    data = normalizeData(JSON.parse(item.before));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveChangeHistory(history);
    suppressChangeHistory = false;
    renderSelectors();
    render();
    alert("Last change undone.");
  } catch(err){
    suppressChangeHistory = false;
    console.error(err);
    alert("Could not undo that change. Try restoring a JSON backup if needed.");
  }
}
window.undoLastChange = undoLastChange;
function clearChangeHistory(){
  if(!confirm("Clear recent change history? This does not change your Money Nest data.")) return;
  saveChangeHistory([]);
  renderRecentChanges();
}
window.clearChangeHistory = clearChangeHistory;


function renderDropdownDefaultsSettings(){
  const target = document.getElementById("dropdownDefaultsList");
  if(!target) return;
  const d = {...defaultUiPrefs.transactionFilterDefaults, ...transactionFilterDefaults};
  target.innerHTML = `
    <p class="hint">Choose what account/debt transaction dropdowns reset to. Last-used filters still save while you work; use Reset filters in ledgers to return here.</p>
    <div class="settings-default-grid">
      <label>Status
        <select id="defaultTxStatus">
          <option value="all" ${d.status==="all"?"selected":""}>All statuses</option>
          <option value="planned" ${d.status==="planned"?"selected":""}>Planned</option>
          <option value="cleared" ${d.status==="cleared"?"selected":""}>Cleared</option>
        </select>
      </label>
      <label>Category
        <select id="defaultTxCategory">
          <option value="all" ${d.category==="all"?"selected":""}>All categories</option>
          ${data.categories.map(c=>`<option value="${c.id}" ${d.category===c.id?"selected":""}>${c.emoji} ${c.name}</option>`).join("")}
        </select>
      </label>
      <label>Type
        <select id="defaultTxType">
          <option value="all" ${d.type==="all"?"selected":""}>All types</option>
          <option value="expense" ${d.type==="expense"?"selected":""}>Expenses</option>
          <option value="income" ${d.type==="income"?"selected":""}>Income</option>
          <option value="paycheck" ${d.type==="paycheck"?"selected":""}>Paychecks</option>
          <option value="transfer" ${d.type==="transfer"?"selected":""}>Transfers / payments</option>
        </select>
      </label>
      <label>Date range
        <select id="defaultTxDateRange">
          <option value="upcoming-90" ${d.dateRange==="upcoming-90"?"selected":""}>Upcoming 90 days</option>
          <option value="this-month" ${d.dateRange==="this-month"?"selected":""}>This month</option>
          <option value="past-90" ${d.dateRange==="past-90"?"selected":""}>Past 90 days</option>
          <option value="all" ${d.dateRange==="all"?"selected":""}>All dates</option>
        </select>
      </label>
      <label>Sort
        <select id="defaultTxSort">
          <option value="date-asc" ${d.sort==="date-asc"?"selected":""}>Date: soonest first</option>
          <option value="date-desc" ${d.sort==="date-desc"?"selected":""}>Date: newest / farthest first</option>
          <option value="amount-desc" ${d.sort==="amount-desc"?"selected":""}>Amount: high to low</option>
          <option value="amount-asc" ${d.sort==="amount-asc"?"selected":""}>Amount: low to high</option>
          <option value="category" ${d.sort==="category"?"selected":""}>Category A-Z</option>
        </select>
      </label>
    </div>
    <div class="inline-actions">
      <button class="primary small" onclick="saveDropdownDefaultsFromSettings()">Save dropdown defaults</button>
      <button class="ghost small" onclick="resetDropdownDefaults()">Reset defaults</button>
      <button class="ghost small" onclick="resetTransactionFiltersToDefaults()">Apply defaults now</button>
    </div>`;
}
window.saveDropdownDefaultsFromSettings = ()=>{
  transactionFilterDefaults = {
    status:document.getElementById("defaultTxStatus")?.value || "all",
    category:document.getElementById("defaultTxCategory")?.value || "all",
    type:document.getElementById("defaultTxType")?.value || "all",
    dateRange:document.getElementById("defaultTxDateRange")?.value || "upcoming-90",
    sort:document.getElementById("defaultTxSort")?.value || "date-asc"
  };
  saveUiPrefs();
  renderDropdownDefaultsSettings();
};
window.resetDropdownDefaults = ()=>{
  transactionFilterDefaults = {...defaultUiPrefs.transactionFilterDefaults};
  saveUiPrefs();
  renderDropdownDefaultsSettings();
};

function renderSettings(){
  applyMoneyNestPalette();
  renderAppearanceSettings();
  const categoryList = document.getElementById("categoryList");
  if(categoryList){
    categoryList.innerHTML = sortedCategories().map(c=>`
      <div class="category-row">
        <span class="cat-preview" style="background:${hexToSoft(effectiveCategoryColor(c))}"><i class="cat-dot" style="background:${effectiveCategoryColor(c)}"></i>${c.emoji} ${c.name}<small>${c.customColorOverride?"Custom color":paletteRoleLabel(c.paletteRole)}</small></span>
        <button class="ghost small" onclick="simpleCategory('${c.id}')">Edit</button>
      </div>`).join("");
  }

  const catCount = document.getElementById("settingsCategoryCount");
  if(catCount) catCount.textContent = `${data.categories.length}`;

  renderPaycheckSettings();
  attachPaycheckSettingsListeners();

  renderTransactionTemplates();
  renderDropdownDefaultsSettings();
  renderCloudSyncSettings();

  const templateCount = document.getElementById("settingsTemplateCount");
  if(templateCount){
    const families=transactionTemplateFamilies({includeArchived:false});
    const active=(data.settings?.transactionTemplates||[]).filter(t=>!normalizeTransactionTemplate(t).archived).length;
    templateCount.textContent = `${families.length} / ${active}`;
    templateCount.title = "families / active variants";
  }

  renderRecentChanges();
}

function renderSelectors(){
  const accOptions = [`<option value="">None</option>`].concat(data.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`)).join("");
  const catOptions = sortedCategories().map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join("");
  const debtOptions = `<option value="">None</option>` + data.debts.map(d=>`<option value="${d.id}">${d.company} • ${d.name}</option>`).join("");
  document.getElementById("txAccount").innerHTML = accOptions;
  document.getElementById("txCategory").innerHTML = catOptions;
  document.getElementById("txDebt").innerHTML = debtOptions;
  document.getElementById("txDebtAccount").innerHTML = debtOptions;
  document.getElementById("txTransferTo").innerHTML = accOptions;
}


function getRealTx(id){ return data.transactions.find(t => t.id === id); }
function occurrenceForAction(tx, meta={}){
  if(!tx) return null;
  if(isRecurring(tx) && (meta.originalDate || meta.occurrenceDate)){
    return transactionForOccurrenceForm(tx, meta.originalDate || tx.date, meta.occurrenceDate || meta.originalDate || tx.date);
  }
  return tx;
}

window.toggleCleared = (id, meta={})=>{
  const tx = getRealTx(id);
  if(!tx) return;

  const originalDate = meta.originalDate || tx.date;
  const occurrenceDate = meta.occurrenceDate || originalDate;
  const actionTx = occurrenceForAction(tx, {originalDate, occurrenceDate}) || tx;
  const nextStatus = actionTx.status === "cleared" ? "planned" : "cleared";

  // Recurring rows are templates, so toggling cleared/planned should always
  // affect only the clicked occurrence. This keeps weekly paychecks, loan
  // payments, and other repeating items from all changing at once.
  if(isRecurring(tx)){
    const formTx = {
      ...actionTx,
      status: nextStatus,
      date: actionTx.date || occurrenceDate
    };
    if(nextStatus === "cleared" && formTx.pendingReimbursement){
      formTx.pendingReimbursement = false;
      formTx.reimbursementToAccountId = formTx.transferToAccountId || formTx.reimbursementToAccountId || "";
    }
    saveRecurringOccurrenceOverride(tx, formTx, originalDate, occurrenceDate);
  } else {
    tx.status = nextStatus;

    // Pending reimbursements should clear through the normal status toggle.
    // When Mak marks the reimbursement cleared, it becomes a regular cleared transfer
    // and should no longer stay in the pending/expected reimbursement bucket.
    if(nextStatus === "cleared" && tx.pendingReimbursement){
      tx.pendingReimbursement = false;
      tx.reimbursementToAccountId = tx.transferToAccountId || tx.reimbursementToAccountId || "";
    }
  }

  saveData();
};
function statusButton(tx, mode="normal"){
  if(mode === "hidden") return "";
  const id = tx.originalId || tx.id;
  const actionTx = (tx.generated || tx.originalDate) ? tx : (getRealTx(id) || tx);
  const isCleared = actionTx.status === "cleared";
  const originalDate = tx.originalDate || tx.date || "";
  const occurrenceDate = tx.date || originalDate;
  return `<button class="status-toggle ${isCleared ? "cleared" : "planned"}" title="Mark ${isCleared ? "planned" : "cleared"}" onclick="event.stopPropagation(); toggleCleared('${id}',{originalDate:'${originalDate}', occurrenceDate:'${occurrenceDate}'})">${isCleared ? "✓ Cleared" : "○ Planned"}</button>`;
}
window.duplicateTransaction = (id)=>{
  const source = getRealTx(id);
  if(!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = uid();
  copy.title = `${source.title} copy`;
  copy.status = "planned";
  openTransaction(null, copy);
  modalTitle.textContent = "Duplicate transaction";
  deleteTxBtn.style.display = "none";
  duplicateTxBtn.style.display = "none";
};


function askRecurringScope(mode){
  return new Promise(resolve=>{
    const modal = document.getElementById("recurringScopeModal");
    if(!modal){
      const one = confirm(mode === "delete"
        ? "Delete only this occurrence?\n\nOK = this occurrence only\nCancel = this and future occurrences"
        : "Save only this occurrence?\n\nOK = this occurrence only\nCancel = this and future occurrences");
      resolve(one ? "one" : "future");
      return;
    }

    const title = document.getElementById("recurringScopeTitle");
    const hint = document.getElementById("recurringScopeHint");
    const one = document.getElementById("scopeChoiceOne");
    const series = document.getElementById("scopeChoiceSeries");
    const all = document.getElementById("scopeChoiceAll");
    if(all) all.remove();
    const oneTitle = document.getElementById("scopeChoiceOneTitle");
    const oneSub = document.getElementById("scopeChoiceOneSub");
    const seriesTitle = document.getElementById("scopeChoiceSeriesTitle");
    const seriesSub = document.getElementById("scopeChoiceSeriesSub");
    const cancel = document.getElementById("cancelRecurringScope");
    const close = document.getElementById("closeRecurringScope");

    if(mode === "delete"){
      if(title) title.textContent = "Delete recurring transaction";
      if(hint) hint.textContent = "Past/cleared history will be kept. Choose whether to remove just this date or stop the series from here forward.";
      if(oneTitle) oneTitle.textContent = "Delete this occurrence only";
      if(oneSub) oneSub.textContent = "Remove only this one date.";
      if(seriesTitle) seriesTitle.textContent = "Delete this and future occurrences";
      if(seriesSub) seriesSub.textContent = "Keep past/cleared history and stop future repeats from this date forward.";
      if(series) series.classList.add("danger-choice");
    } else {
      if(title) title.textContent = "Save recurring transaction";
      if(hint) hint.textContent = "Past/cleared history will be kept. Choose whether this edit is only for this date or starts from here forward.";
      if(oneTitle) oneTitle.textContent = "This occurrence only";
      if(oneSub) oneSub.textContent = "Create a one-time change for this date.";
      if(seriesTitle) seriesTitle.textContent = "This and future occurrences";
      if(seriesSub) seriesSub.textContent = "Start the edited version from this date forward without changing past history.";
      if(series) series.classList.remove("danger-choice");
    }

    const cleanup = (value)=>{
      one.onclick = null;
      series.onclick = null;
      cancel.onclick = null;
      close.onclick = null;
      modal.oncancel = null;
      modal.close();
      resolve(value);
    };

    one.onclick = ()=>cleanup("one");
    series.onclick = ()=>cleanup("future");
    cancel.onclick = ()=>cleanup("");
    close.onclick = ()=>cleanup("");
    modal.oncancel = (e)=>{ e.preventDefault(); cleanup(""); };
    modal.showModal();
  });
}


function transactionSeriesSignature(tx){
  return [
    String(tx.title || "").trim().toLowerCase(),
    String(tx.accountId || ""),
    String(tx.debtAccountId || ""),
    String(tx.transferToAccountId || ""),
    String(tx.linkedDebtId || ""),
    String(tx.categoryId || ""),
    String(tx.type || ""),
    Number(tx.amount || 0).toFixed(2)
  ].join("|");
}

function recurringScheduleSignature(tx){
  const r = tx?.recurrence || (tx?.repeat ? {type:"monthly", interval:1} : {type:"none", interval:1});
  const type = String(r.type || "none");
  const interval = Math.max(1, Number(r.interval || (type === "biweekly" ? 2 : 1)));
  const weekend = String(r.weekendHandling || "none");
  let anchor = String(tx?.date || "");
  try{
    const start = parseDate(tx?.date || todayISO());
    if(type === "monthly") anchor = `day:${start.getDate()}`;
    else if(type === "last-day-month") anchor = "last-day";
    else if(type === "yearly") anchor = `month-day:${start.getMonth()+1}-${start.getDate()}`;
    else if(type === "weekly" || type === "biweekly") anchor = `weekday:${Number(r.weekday ?? start.getDay())}`;
    else if(type === "nth-weekday") anchor = `nth:${Number(r.ordinal || 1)}:${Number(r.weekday ?? start.getDay())}`;
    else if(type === "every-x-days") anchor = `anchor:${String(tx?.date || "")}`;
  } catch(err){}
  return [type, interval, anchor, weekend].join("|");
}
function recurringSeriesCoreKey(tx){
  return [
    String(tx?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    String(tx?.accountId || ""),
    String(tx?.debtAccountId || ""),
    String(tx?.transferToAccountId || ""),
    String(tx?.linkedDebtId || ""),
    String(tx?.categoryId || ""),
    String(tx?.type || ""),
    recurringScheduleSignature(tx)
  ].join("|");
}
function recurringSeriesExplicitlyLinked(a, b){
  if(!a || !b) return false;
  const aIds = new Set([a.id, a.originalId, a.recurringSourceId, a.recurrenceSourceId].filter(Boolean));
  const bIds = new Set([b.id, b.originalId, b.recurringSourceId, b.recurrenceSourceId].filter(Boolean));
  return [...aIds].some(id=>bIds.has(id));
}
function dayBeforeISO(dateISO){
  try{ return toISO(addDays(parseDate(dateISO), -1)); }
  catch(err){ return ""; }
}
function recurringSeriesLikelySame(previousTx, nextTx){
  if(recurringSeriesExplicitlyLinked(previousTx, nextTx)) return true;
  const sameTitle = String(previousTx?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === String(nextTx?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sameType = String(previousTx?.type || "") === String(nextTx?.type || "");
  const sameSource = String(previousTx?.accountId || "") === String(nextTx?.accountId || "");
  const sameCashDestination = String(previousTx?.transferToAccountId || "") === String(nextTx?.transferToAccountId || "");
  const sameDebtTarget = String(previousTx?.linkedDebtId || "") === String(nextTx?.linkedDebtId || "");
  const sameDebtAccount = String(previousTx?.debtAccountId || "") === String(nextTx?.debtAccountId || "");
  const sameCategory = String(previousTx?.categoryId || "") === String(nextTx?.categoryId || "");
  const sameRoute = sameSource && sameCashDestination && sameDebtTarget && sameDebtAccount;
  const sameSchedule = recurringScheduleSignature(previousTx) === recurringScheduleSignature(nextTx);
  // A shared title/route is not a series identity. Only consider unlinked legacy
  // fragments the same when their recurrence schedules also match.
  return sameSchedule && sameType && ((sameTitle && sameSource) || (sameRoute && (sameTitle || sameCategory)));
}
function recurringSeriesIsSplitPredecessor(previousTx, nextTx){
  if(!previousTx || !nextTx || previousTx.id === nextTx.id) return false;
  if(!isRecurring(previousTx) || !isRecurring(nextTx)) return false;
  if(!recurringSeriesLikelySame(previousTx, nextTx)) return false;
  return !!previousTx.recurrenceUntil && previousTx.recurrenceUntil === dayBeforeISO(nextTx.date);
}
function recurringSeriesLineageIds(baseTx){
  const ids = new Set(baseTx?.id ? [baseTx.id] : []);
  if(!baseTx) return ids;
  const recurringRows = (data.transactions || []).filter(isRecurring);
  let changed = true;
  while(changed){
    changed = false;
    recurringRows.forEach(candidate=>{
      if(ids.has(candidate.id)) return;
      const touches = recurringRows.some(member => ids.has(member.id) && (
        recurringSeriesIsSplitPredecessor(candidate, member) ||
        recurringSeriesIsSplitPredecessor(member, candidate)
      ));
      if(touches){ ids.add(candidate.id); changed = true; }
    });
  }
  return ids;
}
function canonicalRecurringSeries(baseTx){
  if(!baseTx) return null;
  const ids = recurringSeriesLineageIds(baseTx);
  const rows = (data.transactions || []).filter(tx=>ids.has(tx.id) && isRecurring(tx));
  if(!rows.length) return baseTx;
  const today = todayISO();
  return rows.sort((a,b)=>{
    const aActive = !a.recurrenceUntil || a.recurrenceUntil >= today ? 1 : 0;
    const bActive = !b.recurrenceUntil || b.recurrenceUntil >= today ? 1 : 0;
    if(aActive !== bActive) return bActive - aActive;
    return String(b.date || "").localeCompare(String(a.date || ""));
  })[0];
}
function recurringLinkedSourceId(tx){
  return tx?.recurringSourceId || tx?.recurrenceSourceId || tx?.originalId || "";
}
function materializeClearedSeriesHistory(template, targetSeriesId=""){
  if(!template || !isRecurring(template)) return 0;
  const horizon = template.recurrenceUntil && template.recurrenceUntil > todayISO()
    ? template.recurrenceUntil
    : toISO(addMonths(parseDate(todayISO()), 24));
  const occurrences = expandedTransactions(horizon).filter(row=>{
    const generatedFromTemplate = row.id === template.id || row.originalId === template.id;
    return generatedFromTemplate && row.status === "cleared";
  });
  let added = 0;
  occurrences.forEach(row=>{
    const originalDate = row.originalDate || row.date;
    const exists = (data.transactions || []).some(saved =>
      saved.id !== template.id &&
      !isRecurring(saved) &&
      saved.status === "cleared" &&
      (saved.originalDate || saved.date) === originalDate &&
      saved.date === row.date &&
      [targetSeriesId, template.id].includes(recurringLinkedSourceId(saved)) &&
      String(saved.title || "") === String(row.title || "") &&
      Math.abs(Number(saved.amount || 0) - Number(row.amount || 0)) < 0.001
    );
    if(exists) return;
    data.transactions.push({
      ...row,
      id: uid(),
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat:false,
      generated:false,
      originalId:"",
      originalDate,
      overrideFrom: row.overrideFrom || "",
      recurringSourceId: targetSeriesId || "",
      recurrenceSourceId: targetSeriesId || "",
      wasRecurringOccurrence:true,
      dateOverrides:{},
      occurrenceOverrides:{},
      billArchived:false,
      billArchivedAt:"",
      billArchivedPreviousRecurrenceUntil:""
    });
    added++;
  });
  return added;
}
function consolidateRecurringFragments(keeperTx, lineageIds){
  if(!keeperTx) return {removedSeries:0, removedPlanned:0, materialized:0};
  const ids = lineageIds instanceof Set ? lineageIds : recurringSeriesLineageIds(keeperTx);
  let materialized = 0;
  (data.transactions || []).filter(tx=>ids.has(tx.id) && tx.id !== keeperTx.id && isRecurring(tx)).forEach(fragment=>{
    materialized += materializeClearedSeriesHistory(fragment, keeperTx.id);
    keeperTx.linkedTransactionIds = [...new Set([...(keeperTx.linkedTransactionIds || []), ...(fragment.linkedTransactionIds || [])])];
  });
  let removedSeries = 0;
  let removedPlanned = 0;
  data.transactions = (data.transactions || []).filter(row=>{
    if(ids.has(row.id) && row.id !== keeperTx.id && isRecurring(row)){
      removedSeries++;
      return false;
    }
    const sourceId = recurringLinkedSourceId(row);
    if(sourceId && ids.has(sourceId) && sourceId !== keeperTx.id){
      if(row.status === "cleared"){
        row.recurringSourceId = keeperTx.id;
        row.recurrenceSourceId = keeperTx.id;
        row.originalId = "";
        row.wasRecurringOccurrence = true;
        return true;
      }
      removedPlanned++;
      return false;
    }
    return true;
  });
  return {removedSeries, removedPlanned, materialized};
}
function replaceBillSeriesInPlace(baseTx, formTx, editMeta={}){
  if(!baseTx) return;
  const canonical = canonicalRecurringSeries(baseTx) || baseTx;
  const lineageIds = recurringSeriesLineageIds(canonical);
  consolidateRecurringFragments(canonical, lineageIds);
  materializeClearedSeriesHistory(canonical, canonical.id);

  let removedPlanned = 0;
  data.transactions = (data.transactions || []).filter(row=>{
    if(row.id === canonical.id) return true;
    if(recurringLinkedSourceId(row) !== canonical.id) return true;
    if(row.status === "cleared") return true;
    removedPlanned++;
    return false;
  });

  const existingLinked = [...(canonical.linkedTransactionIds || [])];
  const displayedOccurrenceDate = editMeta.occurrenceDate || "";
  const dateWasEdited = !!formTx.date && !!displayedOccurrenceDate && formTx.date !== displayedOccurrenceDate;
  const startDate = dateWasEdited
    ? formTx.date
    : (editMeta.originalDate || formTx.date || displayedOccurrenceDate || canonical.date);
  Object.assign(canonical, {
    ...formTx,
    id: canonical.id,
    date: startDate,
    recurrence: formTx.recurrence || canonical.recurrence || {type:"none", interval:1, weekendHandling:"none"},
    repeat:false,
    recurrenceUntil:"",
    billArchived:false,
    billArchivedAt:"",
    billArchivedPreviousRecurrenceUntil:"",
    dateOverrides:{},
    occurrenceOverrides:{},
    originalId:"",
    originalDate:"",
    recurringSourceId:"",
    recurrenceSourceId:"",
    wasRecurringOccurrence:false,
    linkedTransactionIds:[...new Set([...existingLinked, ...(formTx.linkedTransactionIds || [])])]
  });
  return {removedPlanned};
}
function deleteBillSeriesKeepClearedHistory(baseTx){
  if(!baseTx) return {removedSeries:0, removedPlanned:0, materialized:0};
  const canonical = canonicalRecurringSeries(baseTx) || baseTx;
  const ids = recurringSeriesLineageIds(canonical);
  let materialized = 0;
  (data.transactions || []).filter(tx=>ids.has(tx.id) && isRecurring(tx)).forEach(template=>{
    materialized += materializeClearedSeriesHistory(template, "");
  });
  let removedSeries = 0;
  let removedPlanned = 0;
  data.transactions = (data.transactions || []).filter(row=>{
    if(ids.has(row.id) && isRecurring(row)){
      removedSeries++;
      return false;
    }
    const sourceId = recurringLinkedSourceId(row);
    if(sourceId && ids.has(sourceId)){
      if(row.status === "cleared"){
        row.recurringSourceId = "";
        row.recurrenceSourceId = "";
        row.originalId = "";
        row.wasRecurringOccurrence = true;
        return true;
      }
      removedPlanned++;
      return false;
    }
    return true;
  });
  return {removedSeries, removedPlanned, materialized};
}
function repairSplitRecurringSeriesData(){
  let merged = 0;
  let removedPlanned = 0;
  let materialized = 0;
  let found = true;
  while(found){
    found = false;
    const recurringRows = (data.transactions || []).filter(isRecurring);
    outer:
    for(const previousTx of recurringRows){
      for(const nextTx of recurringRows){
        if(!recurringSeriesIsSplitPredecessor(previousTx, nextTx)) continue;
        const result = consolidateRecurringFragments(nextTx, new Set([previousTx.id, nextTx.id]));
        merged += result.removedSeries;
        removedPlanned += result.removedPlanned;
        materialized += result.materialized;
        found = true;
        break outer;
      }
    }
  }
  return {merged, removedPlanned, materialized};
}
window.repairRecurringSeriesData = ()=>{
  const result = repairSplitRecurringSeriesData();
  if(!result.merged && !result.removedPlanned && !result.materialized){
    alert("No split recurring series were found.");
    return;
  }
  saveData();
  alert(`Recurring series repaired. Combined ${result.merged} old split series, removed ${result.removedPlanned} stale planned rows, and preserved ${result.materialized} cleared history row${result.materialized === 1 ? "" : "s"}.`);
};
function deleteRecurringSeriesAndOrphans(baseTx){
  if(!baseTx) return;
  const canonical = canonicalRecurringSeries(baseTx) || baseTx;
  const lineageIds = recurringSeriesLineageIds(canonical);
  data.transactions = data.transactions.filter(tx=>{
    if(lineageIds.has(tx.id)) return false;
    const sourceId = recurringLinkedSourceId(tx);
    if(sourceId && lineageIds.has(sourceId)) return false;
    return true;
  });
}

function deleteRecurringOccurrence(baseTx, occurrenceOriginalDate, occurrenceDate){
  if(!baseTx) return;
  baseTx.dateOverrides ||= {};
  baseTx.occurrenceOverrides ||= {};

  const targetOriginal = occurrenceOriginalDate || baseTx.date;
  const targetDisplay = occurrenceDate || occurrenceOriginalDate || baseTx.date;

  const markSkipped = (originalISO)=>{
    if(!originalISO) return;
    baseTx.dateOverrides[originalISO] = RECURRENCE_SKIP_DATE;
    baseTx.occurrenceOverrides[originalISO] = {deleted:true};
  };

  // Direct skip for the source date we were given.
  markSkipped(targetOriginal);

  // If the Bills page/calendar passed the displayed/moved date, find the matching
  // recurrence source date and skip that too. This keeps Bills and Calendar in sync.
  try{
    const start = parseDate(baseTx.date);
    const target = targetDisplay;
    const searchStart = addDays(parseDate(target), -7);
    const searchEnd = addDays(parseDate(target), 7);
    let cursor = parseDate(toISO(searchStart));

    while(cursor <= searchEnd){
      if(recurrenceOccursOn(baseTx, cursor, start)){
        const originalISO = toISO(cursor);
        const moved = occurrenceDateFor(baseTx, cursor);
        if(originalISO === target || moved === target){
          markSkipped(originalISO);
        }
      }
      cursor = addDays(cursor, 1);
    }
  } catch(err){
    console.warn("Could not map deleted recurring occurrence", err);
  }
}


function deleteRecurringFuture(baseTx, originalDate){
  if(!baseTx) return;
  const cutoffISO = originalDate || baseTx.date;
  const cutoff = parseDate(cutoffISO);
  const until = addDays(cutoff, -1);

  // Stop the repeating generator before the clicked occurrence, which removes
  // the clicked date and every future generated date while keeping past history.
  baseTx.recurrenceUntil = toISO(until);

  // If this recurring item starts on/after the cutoff and is still planned,
  // remove the template row itself. Otherwise a first future occurrence can stay
  // visible because base occurrences are rendered before recurrence expansion.
  if(baseTx.date >= cutoffISO && baseTx.status !== "cleared"){
    data.transactions = data.transactions.filter(t=>t.id !== baseTx.id);
    return;
  }

  // Clean up any one-off overrides on or after the cutoff so edited/skipped
  // future occurrences do not hang around after choosing delete future.
  if(baseTx.occurrenceOverrides){
    Object.keys(baseTx.occurrenceOverrides).forEach(date=>{
      if(date >= cutoffISO) delete baseTx.occurrenceOverrides[date];
    });
  }
  if(baseTx.dateOverrides){
    Object.keys(baseTx.dateOverrides).forEach(date=>{
      if(date >= cutoffISO) delete baseTx.dateOverrides[date];
    });
  }
}

function deleteTransactionWithScope(id, scope="all", meta={}){
  const tx = data.transactions.find(t=>t.id===id);
  if(!tx) return;

  if(isRecurring(tx) && scope === "one"){
    deleteRecurringOccurrence(tx, meta.originalDate || tx.date, meta.occurrenceDate || meta.originalDate || tx.date);
  } else if(isRecurring(tx) && scope === "future"){
    deleteRecurringFuture(tx, meta.originalDate || tx.date);
  } else if(isRecurring(tx) && scope === "all"){
    deleteRecurringSeriesAndOrphans(tx);
  } else {
    data.transactions = data.transactions.filter(t=>t.id!==id);
  }
}

window.deleteTransactionById = async (id)=>{
  if(!id) return;
  const tx = data.transactions.find(t=>t.id===id);
  if(!tx) return;

  let scope = "all";
  if(isRecurring(tx)){
    scope = await askRecurringScope("delete");
    if(!scope) return;
  } else if(!confirm("Delete this transaction?")){
    return;
  }

  deleteTransactionWithScope(id, scope, {
    originalDate: contextTxMeta.originalDate || tx.date,
    occurrenceDate: contextTxMeta.occurrenceDate || contextTxMeta.originalDate || tx.date
  });
  hideTxContextMenu();
  saveData();
};
let contextTxId = null;
let contextTxMeta = {};
function showTxContextMenu(event, id, meta={}){
  event.preventDefault();
  event.stopPropagation();
  contextTxId = id;
  contextTxMeta = meta || {};
  const menu = document.getElementById("txContextMenu");
  const tx = data.transactions.find(t => t.id === id);
  const toggle = document.getElementById("ctxToggleCleared");
  if(toggle && tx){
    const actionTx = occurrenceForAction(tx, {
      originalDate: meta.originalDate || tx.date,
      occurrenceDate: meta.occurrenceDate || meta.originalDate || tx.date
    }) || tx;
    toggle.textContent = actionTx.status === "cleared" ? "○ Mark planned" : "✓ Mark cleared";
  }
  const useCard = document.getElementById("ctxUseCardInstead");
  if(useCard && tx){
    const canUseCard = tx.type === "expense" && !tx.debtAccountId && !!tx.accountId;
    useCard.style.display = canUseCard ? "block" : "none";
  }
  const createCardPayment = document.getElementById("ctxCreateCardPayment");
  if(createCardPayment && tx){
    const debt = debtById(tx.debtAccountId);
    const canCreatePayment = tx.type === "expense" && !!tx.debtAccountId && isCreditCardDebt(debt);
    createCardPayment.style.display = canCreatePayment ? "block" : "none";
  }
  const markReimbursed = document.getElementById("ctxMarkReimbursed");
  if(markReimbursed) markReimbursed.style.display = "none";
  menu.classList.add("open");

  const menuWidth = 235;
  const menuHeight = 235;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
}
window.showTxActionsFromButton = (button)=>{
  const row = button?.closest?.("[data-tx]");
  if(!row) return;
  const rect = button.getBoundingClientRect();
  showTxContextMenu({
    preventDefault(){},
    stopPropagation(){},
    clientX:Math.min(rect.right, window.innerWidth - 8),
    clientY:Math.min(rect.bottom + 6, window.innerHeight - 8)
  }, row.dataset.tx, {
    originalDate:row.dataset.originalDate || "",
    occurrenceDate:row.dataset.occurrenceDate || ""
  });
};

function hideTxContextMenu(){
  const menu = document.getElementById("txContextMenu");
  if(menu) menu.classList.remove("open");
  contextTxId = null;
  contextTxMeta = {};
}
function attachTransactionContextMenus(){
  document.querySelectorAll("[data-tx]").forEach(el=>{
    el.oncontextmenu = (event)=>showTxContextMenu(event, el.dataset.tx, {
      originalDate: el.dataset.originalDate || "",
      occurrenceDate: el.dataset.occurrenceDate || ""
    });

    // v2-240: touch users can long-press a transaction for the same quick actions
    // as desktop right-click, without permanently consuming chip width with a dots button.
    if(MONEY_NEST_HAS_TOUCH && !el.dataset.longPressReady){
      el.dataset.longPressReady = "1";
      let pressTimer = null;
      let startX = 0;
      let startY = 0;
      const cancelPress = ()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; } };
      el.addEventListener("pointerdown", event=>{
        if(event.pointerType === "mouse") return;
        startX = event.clientX;
        startY = event.clientY;
        cancelPress();
        pressTimer = setTimeout(()=>{
          pressTimer = null;
          if(navigator.vibrate) navigator.vibrate(20);
          el.dataset.suppressNextClick = "1";
          showTxContextMenu({
            preventDefault(){},
            stopPropagation(){},
            clientX:event.clientX,
            clientY:event.clientY
          }, el.dataset.tx, {
            originalDate:el.dataset.originalDate || "",
            occurrenceDate:el.dataset.occurrenceDate || ""
          });
        }, 520);
      }, {passive:true});
      el.addEventListener("pointermove", event=>{
        if(Math.abs(event.clientX-startX)>10 || Math.abs(event.clientY-startY)>10) cancelPress();
      }, {passive:true});
      ["pointerup","pointercancel","pointerleave"].forEach(name=>el.addEventListener(name,cancelPress,{passive:true}));
      el.addEventListener("click", event=>{
        if(el.dataset.suppressNextClick === "1"){
          event.preventDefault();
          event.stopPropagation();
          delete el.dataset.suppressNextClick;
        }
      }, true);
    }
  });
}

function safeAmountExpressionValue(expression){
  const cleaned = String(expression || "")
    .replace(/[,$]/g, "")
    .replace(/[×x]/gi, "*")
    .replace(/[÷]/g, "/")
    .trim();
  if(!cleaned) throw new Error("Enter something to calculate first.");
  if(!/^[0-9+\-*/().\s]+$/.test(cleaned)){
    throw new Error("Use only numbers, +, -, ×, ÷, *, /, and parentheses.");
  }
  const result = Function(`"use strict"; return (${cleaned});`)();
  if(!Number.isFinite(result)) throw new Error("That calculation did not return a usable number.");
  return Math.round(result * 100) / 100;
}
window.toggleAmountCalculator = ()=>{
  const panel = document.getElementById("txAmountCalcPanel");
  if(!panel) return;
  panel.hidden = !panel.hidden;
  if(!panel.hidden) document.getElementById("txAmountCalcExpression")?.focus();
};
window.clearAmountCalculator = ()=>{
  const input = document.getElementById("txAmountCalcExpression");
  if(input) input.value = "";
};
window.calculateTransactionAmount = ()=>{
  try{
    const input = document.getElementById("txAmountCalcExpression");
    const result = safeAmountExpressionValue(input?.value || "");
    txAmount.value = result.toFixed(2);
    updateTransactionFormUI();
  } catch(err){
    alert(`Calculator error: ${err.message || err}`);
  }
};

function updateTransactionDisclosureSummaries(){
  const routingSummary=document.getElementById("txRoutingSummary");
  const routingDetails=document.getElementById("txRoutingDetails");
  const type=document.getElementById("txType")?.value || "expense";
  if(routingDetails) routingDetails.style.display = ["expense","transfer"].includes(type) ? "block" : "none";
  if(routingSummary){
    if(type === "transfer"){
      const target = accountById(document.getElementById("txTransferTo")?.value)?.name || debtById(document.getElementById("txDebt")?.value)?.name || "Choose destination";
      routingSummary.textContent = target;
    } else {
      const card = debtById(document.getElementById("txDebtAccount")?.value);
      routingSummary.textContent = card ? (card.name || card.company || "Card selected") : "Optional card/debt";
    }
  }
  const notesSummary=document.getElementById("txNotesSummary");
  if(notesSummary) notesSummary.textContent = String(document.getElementById("txNotes")?.value || "").trim() ? "Added" : "Optional";
  const linksSummary=document.getElementById("txLinksSummary");
  if(linksSummary) linksSummary.textContent = txLinkDraftIds.length ? `${txLinkDraftIds.length} linked` : "None";
}

function updateTransactionFormUI(){
  const type = txType.value;

  if(type === "paycheck" && (!txCategory.value || txCategory.value === "unassigned")){
    txCategory.value = "income";
  }

  txDebtAccount.closest("label").style.display = type === "expense" ? "grid" : "none";
  txTransferTo.closest("label").style.display = type === "transfer" ? "grid" : "none";
  txDebt.closest("label").style.display = type === "transfer" ? "grid" : "none";

  if(type !== "expense") txDebtAccount.value = "";
  if(type !== "transfer"){
    txTransferTo.value = "";
    txDebt.value = "";
  }

  const routingDetails=document.getElementById("txRoutingDetails");
  if(routingDetails && type === "transfer") routingDetails.open = true;

  const loanDebt = debtById(txDebt.value);
  const showLoanBreakdown = type === "transfer" && !!txDebt.value && isLoanDebt(loanDebt);
  const loanWrap = document.getElementById("txLoanBreakdownWrap");
  if(loanWrap){
    loanWrap.style.display = showLoanBreakdown ? "block" : "none";
    if(showLoanBreakdown && txStatus.value === "cleared") loanWrap.open = true;
  }
  if(!showLoanBreakdown){
    ["txLoanPrincipal","txLoanInterest","txLoanFees"].forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ""; });
  } else {
    const total = Number(txAmount.value || 0);
    const interestEl = document.getElementById("txLoanInterest");
    const feesEl = document.getElementById("txLoanFees");
    const principalInput = document.getElementById("txLoanPrincipal");
    const hasManualBreakdown = principalInput?.value !== "" || interestEl?.value !== "" || feesEl?.value !== "";
    const tempLoanTx = {
      amount: total,
      date: txDate.value || todayISO(),
      type: "transfer",
      status: txStatus.value || "planned",
      linkedDebtId: txDebt.value,
      recurrence: buildRecurrenceFromForm(),
      loanPrincipalAmount: principalInput?.value === "" ? "" : Number(principalInput?.value || 0),
      loanInterestAmount: interestEl?.value === "" ? "" : Number(interestEl?.value || 0),
      loanFeeAmount: feesEl?.value === "" ? "" : Number(feesEl?.value || 0)
    };
    const sameLoanPayments = expandedTransactions(toISO(addMonths(parseDate(txDate.value || todayISO()), 2)))
      .filter(p => p.linkedDebtId === txDebt.value && p.type === "transfer");
    const estimate = loanForecastBreakdownForPayment(loanDebt, tempLoanTx, {estimateFuture:!hasManualBreakdown, allPayments:[...sameLoanPayments, tempLoanTx]});
    const hint = document.getElementById("txLoanBreakdownHint");
    if(hint){
      const sourceText = estimate.estimated ? ` Estimated from ${estimate.source}.` : "";
      const detailText = estimate.estimated
        ? `Auto estimate: principal ${money(estimate.principal)}, interest ${money(estimate.interest)}, fees ${money(estimate.fees)}.`
        : `Manual split: principal ${money(estimate.principal)}, interest ${money(estimate.interest)}, fees ${money(estimate.fees)}.`;
      hint.textContent = `${detailText} This payment will lower the loan balance by ${money(estimate.principal)}.${sourceText}`;
    }
  }

  const autoLabel = document.getElementById("autoPaycheckLabel");
  const hoursWrap = document.getElementById("paycheckHoursWrap");
  const hoursInput = document.getElementById("txPaycheckHoursOverride");
  const autoHint = document.getElementById("autoPaycheckHint");
  const profilePack = paycheckProfileForAccount(txAccount.value);
  const isPaycheckCalc = type === "paycheck" && !!profilePack;

  if(autoLabel) autoLabel.style.display = isPaycheckCalc ? "flex" : "none";
  if(hoursWrap) hoursWrap.style.display = isPaycheckCalc ? "grid" : "none";

  if(autoHint){
    if(isPaycheckCalc){
      const tempTx = {
        type:"paycheck",
        accountId:txAccount.value,
        date:txDate.value || todayISO(),
        paycheckHoursOverride: hoursInput?.value || ""
      };
      const info = paycheckAmountForTransaction(tempTx, txDate.value || todayISO());
      const periodText = info.periodStart && info.periodEnd ? ` • ${info.periodStart} to ${info.periodEnd}` : "";
      autoHint.textContent = `Auto-calc available for ${profilePack.owner}: ${money(info.amount)} net estimate from ${info.hours} hours @ ${money(info.hourlyRate)}/hr, ${info.deductionPercent}% estimated deductions${periodText}.`;
      if(document.getElementById("txAutoPaycheck")?.checked){
        txAmount.value = info.amount;
      }
    } else {
      autoHint.textContent = "";
      if(document.getElementById("txAutoPaycheck")) txAutoPaycheck.checked = false;
      if(hoursWrap) hoursWrap.style.display = "none";
    }
  }
  updateTransactionDisclosureSummaries();
}

["txType","txStatus","txAccount","txDate","txDebtAccount","txTransferTo","txDebt","txAmount","txLoanPrincipal","txLoanInterest","txLoanFees","txPaycheckHoursOverride"].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener("change", ()=>{
    updateTransactionFormUI();
  });
  if(el && ["txPaycheckHoursOverride","txAmount","txLoanPrincipal","txLoanInterest","txLoanFees"].includes(id)) el.addEventListener("input", updateTransactionFormUI);
});
const txTitleTemplateEl = document.getElementById("txTitle");
if(txTitleTemplateEl){
  txTitleTemplateEl.addEventListener("input", renderTemplateSuggestions);
  txTitleTemplateEl.addEventListener("focus", renderTemplateSuggestions);
  txTitleTemplateEl.addEventListener("blur", ()=>setTimeout(hideTemplateSuggestions, 180));
}
document.getElementById("txNotes")?.addEventListener("input", updateTransactionDisclosureSummaries);

if(document.getElementById("txAutoPaycheck")){
  txAutoPaycheck.addEventListener("change", ()=>{
    updateTransactionFormUI();
  });
}

let txEditMeta = { generated:false, originalDate:"", occurrenceDate:"" };
let billSeriesEditId = "";

function transactionPayloadFromForm(id){
  const autoPaycheck = !!document.getElementById("txAutoPaycheck")?.checked;
  const hoursOverride = document.getElementById("txPaycheckHoursOverride")?.value || "";
  const tempTx = {
    id,
    title: txTitle.value,
    amount: Number(txAmount.value || 0),
    date: txDate.value,
    type: txType.value,
    status: txStatus.value,
    accountId: txAccount.value,
    debtAccountId: txDebtAccount.value,
    categoryId: txCategory.value,
    transferToAccountId: txTransferTo.value,
    linkedDebtId: txDebt.value,
    loanPrincipalAmount: document.getElementById("txLoanPrincipal")?.value === "" ? "" : Number(document.getElementById("txLoanPrincipal")?.value || 0),
    loanInterestAmount: document.getElementById("txLoanInterest")?.value === "" ? "" : Number(document.getElementById("txLoanInterest")?.value || 0),
    loanFeeAmount: document.getElementById("txLoanFees")?.value === "" ? "" : Number(document.getElementById("txLoanFees")?.value || 0),
    loanBalanceAdjustment: "",
    autoPaycheck,
    autoMakPaycheck: autoPaycheck && isMakAccountId(txAccount.value),
    paycheckHoursOverride: hoursOverride === "" ? "" : Number(hoursOverride),
    recurrence: buildRecurrenceFromForm(),
    repeat: false,
    notes: txNotes.value,
    dateOverrides: {},
    linkedTransactionIds: [...txLinkDraftIds]
  };

  const calc = autoPaycheck && tempTx.type === "paycheck" ? paycheckAmountForTransaction(tempTx, tempTx.date) : null;

  return {
    ...tempTx,
    amount: calc ? calc.amount : tempTx.amount,
    categoryId: tempTx.categoryId || "income",
    autoPaycheckInfo: calc || undefined
  };
}

function makeOneTimeFromSeriesEdit(baseTx, formTx, occurrenceOriginalDate, occurrenceDate){
  const one = {
    ...formTx,
    id: uid(),
    recurrence: {type:"none", interval:1, weekendHandling:"none"},
    repeat: false,
    generated:false,
    originalId:"",
    originalDate:"",
    overrideFrom:"",
    recurringSourceId: baseTx.id,
    wasRecurringOccurrence:true,
    dateOverrides:{},
    notes: formTx.notes || baseTx.notes || ""
  };

  // Mark the original occurrence as skipped by moving it way outside visible planning.
  deleteRecurringOccurrence(baseTx, occurrenceOriginalDate || baseTx.date, occurrenceDate || occurrenceOriginalDate || baseTx.date);
  return one;
}

function updateSeriesFromDate(baseTx, formTx, occurrenceOriginalDate){
  const cutoffISO = occurrenceOriginalDate || baseTx.date;

  // First/base occurrence: update the recurring transaction directly. This is
  // safe for future-first templates, but the UI no longer offers a "whole past
  // series" option.
  if(!occurrenceOriginalDate || occurrenceOriginalDate === baseTx.date){
    Object.assign(baseTx, {...formTx, id:baseTx.id, dateOverrides: baseTx.dateOverrides || {}, occurrenceOverrides: baseTx.occurrenceOverrides || {}});
    return;
  }

  // Future generated occurrence: end the old series BEFORE this occurrence,
  // then start a new recurring series on the edited date. This makes "this and
  // future occurrences" actually stop all old future generated transactions.
  deleteRecurringFuture(baseTx, cutoffISO);

  data.transactions.push({
    ...formTx,
    id: uid(),
    date: formTx.date || cutoffISO,
    recurrence: formTx.recurrence || baseTx.recurrence || {type:"none", interval:1},
    repeat:false,
    dateOverrides:{},
    occurrenceOverrides:{}
  });
}

const txModal = document.getElementById("transactionModal");
document.getElementById("quickAddBtn").onclick = () => openTransaction();
if(document.getElementById("clearRecentBtn")) clearRecentBtn.onclick = ()=>{
  recentPlaces = [];
  try{ localStorage.removeItem(`${STORAGE_KEY}.recentPlaces`); } catch(err){}
  renderRecentPlaces();
};
document.getElementById("closeModal").onclick = () => { billSeriesEditId = ""; txModal.close(); };
document.getElementById("cancelTxBtn").onclick = () => { billSeriesEditId = ""; txModal.close(); };
document.getElementById("transactionForm").onsubmit = async (e)=>{
  e.preventDefault();
  const id = document.getElementById("txId").value || uid();
  const existing = data.transactions.find(t=>t.id===id);
  const formTx = transactionPayloadFromForm(id);
  if(existing?.pendingReimbursement){
    formTx.pendingReimbursement = formTx.status === "cleared" ? false : existing.pendingReimbursement;
    formTx.reimbursementToAccountId = existing.reimbursementToAccountId || existing.transferToAccountId || "";
  }
  if(existing?.type === "debt-adjustment"){
    formTx.type = "debt-adjustment";
    formTx.linkedDebtId = existing.linkedDebtId || formTx.linkedDebtId;
    formTx.accountId = "";
    formTx.debtAccountId = "";
    formTx.transferToAccountId = "";
    formTx.loanBalanceAdjustment = existing.loanBalanceAdjustment || 0;
  }

  const isRecurringEdit = !!existing && isRecurring(existing);
  const editingBillSeries = !!billSeriesEditId && existing?.id === billSeriesEditId;
  const scope = isRecurringEdit ? (editingBillSeries ? "future" : await askRecurringScope("save")) : "future";
  if(isRecurringEdit && !scope) return;

  if(existing && isRecurringEdit && scope === "one"){
    saveRecurringOccurrenceOverride(existing, formTx, txEditMeta.originalDate || existing.date, txEditMeta.occurrenceDate || existing.date);
  } else if(existing && isRecurringEdit && scope === "future"){
    if(editingBillSeries) replaceBillSeriesInPlace(existing, formTx, txEditMeta);
    else updateSeriesFromDate(existing, formTx, txEditMeta.originalDate || existing.date);
  } else if(existing){
    Object.assign(existing, {...formTx, dateOverrides: existing.dateOverrides || {}});
  } else {
    data.transactions.push(formTx);
  }

  rememberTransactionTemplate(formTx);
  billSeriesEditId = "";
  txModal.close();
  saveData();
  renderTransactionTemplates();
  renderDropdownDefaultsSettings();
};
document.getElementById("deleteTxBtn").onclick = async ()=>{
  const id = txId.value;
  if(!id) return;
  const tx = data.transactions.find(t=>t.id===id);
  if(!tx) return;

  const deletingBillSeries = !!billSeriesEditId && tx.id === billSeriesEditId;
  if(deletingBillSeries){
    if(!confirm(`Delete the entire ${tx.title} recurring series? Cleared history will stay as normal transactions, while the repeating rule and every uncleared occurrence will be removed.`)) return;
    deleteBillSeriesKeepClearedHistory(tx);
  } else {
    let scope = "all";
    if(isRecurring(tx)){
      scope = await askRecurringScope("delete");
      if(!scope) return;
    } else if(!confirm("Delete this transaction?")){
      return;
    }
    deleteTransactionWithScope(id, scope, txEditMeta);
  }

  billSeriesEditId = "";
  txModal.close();
  saveData();
};
document.getElementById("duplicateTxBtn").onclick = ()=>{
  const id = txId.value;
  if(id){ txModal.close(); duplicateTransaction(id); }
};
window.openTransaction = (id=null, defaults={})=>{
  const baseTx = data.transactions.find(t=>t.id===id);
  const occurrenceOriginalDate = defaults.occurrenceOriginalDate || baseTx?.date || defaults.date || todayISO();
  const occurrenceDate = defaults.occurrenceDate || defaults.date || baseTx?.date || todayISO();
  const tx = baseTx && isRecurring(baseTx) ? transactionForOccurrenceForm(baseTx, occurrenceOriginalDate, occurrenceDate) : baseTx;

  txEditMeta = {
    generated: !!defaults.generated,
    originalDate: occurrenceOriginalDate,
    occurrenceDate
  };

  modalTitle.textContent = billSeriesEditId && baseTx?.id === billSeriesEditId ? "Edit bill series" : (tx ? "Edit transaction" : "Add transaction");
  txId.value = tx?.id || "";
  txTitle.value = tx?.title || defaults.title || "";
  txAmount.value = tx?.amount || defaults.amount || "";
  if((tx?.autoPaycheck || tx?.autoMakPaycheck || defaults.autoPaycheck || defaults.autoMakPaycheck) && (tx?.type || defaults.type) === "paycheck"){
    const payDate = occurrenceDate;
    const tempTx = {...(tx || {}), ...(defaults || {}), date:payDate, accountId: tx?.accountId || defaults.accountId || ""};
    const info = paycheckAmountForTransaction(tempTx, payDate);
    if(info) txAmount.value = info.amount;
  }
  txDate.value = tx ? occurrenceDate : (defaults.date || todayISO());
  txType.value = tx?.type || defaults.type || "expense";
  txStatus.value = tx?.status || defaults.status || "planned";
  txAccount.value = tx?.accountId || defaults.accountId || "";
  txDebtAccount.value = tx?.debtAccountId || defaults.debtAccountId || "";
  txCategory.value = tx?.categoryId || defaults.categoryId || data.categories[0]?.id;
  txTransferTo.value = tx?.transferToAccountId || defaults.transferToAccountId || "";
  txDebt.value = tx?.linkedDebtId || defaults.linkedDebtId || "";
  if(document.getElementById("txLoanPrincipal")) txLoanPrincipal.value = tx?.loanPrincipalAmount ?? defaults.loanPrincipalAmount ?? "";
  if(document.getElementById("txLoanInterest")) txLoanInterest.value = tx?.loanInterestAmount ?? defaults.loanInterestAmount ?? "";
  if(document.getElementById("txLoanFees")) txLoanFees.value = tx?.loanFeeAmount ?? defaults.loanFeeAmount ?? "";
  if(document.getElementById("txAutoPaycheck")) txAutoPaycheck.checked = !!(tx?.autoPaycheck || tx?.autoMakPaycheck || defaults.autoPaycheck || defaults.autoMakPaycheck);
  if(document.getElementById("txPaycheckHoursOverride")) txPaycheckHoursOverride.value = tx?.paycheckHoursOverride ?? defaults.paycheckHoursOverride ?? "";
  setRecurrenceForm(tx?.recurrence || (tx?.repeat ? {type:"monthly", interval:1} : defaults.recurrence) || {type:"none", interval:1}, occurrenceDate);
  txNotes.value = tx?.notes || defaults.notes || "";
  txLinkDraftIds = Array.isArray(tx?.linkedTransactionIds) ? [...tx.linkedTransactionIds] : (Array.isArray(defaults.linkedTransactionIds) ? [...defaults.linkedTransactionIds] : []);
  renderTxLinkedList();
  const calcPanel = document.getElementById("txAmountCalcPanel");
  const calcInput = document.getElementById("txAmountCalcExpression");
  if(calcPanel) calcPanel.hidden = true;
  if(calcInput) calcInput.value = "";

  const isRecurringEdit = !!tx && isRecurring(tx);

  deleteTxBtn.style.display = tx ? "inline-block" : "none";
  duplicateTxBtn.style.display = tx ? "inline-block" : "none";
  const directCardPaymentBtn = document.getElementById("createCardPaymentTxBtn");
  if(directCardPaymentBtn){
    const debt = tx ? debtById(tx.debtAccountId) : null;
    const canCreateCardPayment = !!tx && tx.type === "expense" && !!tx.debtAccountId && isCreditCardDebt(debt);
    directCardPaymentBtn.style.display = canCreateCardPayment ? "inline-block" : "none";
    directCardPaymentBtn.onclick = canCreateCardPayment ? ()=>{
      const chargeId = baseTx?.id || tx?.id;
      const meta = {...txEditMeta};
      txModal.close();
      createCardPaymentForCharge(chargeId, meta);
    } : null;
  }
  updateTransactionFormUI();
  const routingDetails=document.getElementById("txRoutingDetails");
  if(routingDetails) routingDetails.open = txType.value === "transfer" || !!txDebtAccount.value || !!txTransferTo.value || !!txDebt.value;
  const repeatDetails=document.getElementById("txRepeatDetails");
  if(repeatDetails) repeatDetails.open = !!tx && isRecurringEdit;
  const linksDetails=document.getElementById("txLinksDetails");
  if(linksDetails) linksDetails.open = !!txLinkDraftIds.length;
  const notesDetails=document.getElementById("txNotesDetails");
  if(notesDetails) notesDetails.open = false;
  const moreActions=document.getElementById("txMoreActions");
  if(moreActions){ moreActions.style.display = tx ? "block" : "none"; moreActions.open = false; }
  updateTransactionDisclosureSummaries();
  txModal.classList.toggle("mobile-quick-add", moneyNestIsPhone() && !tx);
  txModal.classList.toggle("mobile-transaction-edit", moneyNestIsPhone() && !!tx);
  txModal.showModal();
  if(moneyNestIsPhone() && !tx){
    setTimeout(()=>{
      const first = txTitle.value ? txAmount : txTitle;
      try{ first?.focus({preventScroll:true}); }catch(err){ first?.focus(); }
    },50);
  }
};

const simpleModal = document.getElementById("simpleModal");
let simpleSubmit = null, simpleDelete = null;
closeSimple.onclick = ()=>simpleModal.close();
cancelSimple.onclick = ()=>simpleModal.close();
simpleForm.onsubmit = e => {
  e.preventDefault();
  if(simpleSubmit && simpleSubmit() === false) return;
  simpleModal.close();
  saveData();
  renderSelectors();
  render();
};
deleteSimpleBtn.onclick = () => {
  if(simpleDelete) simpleDelete();
  normalizeCategories();
  simpleModal.close();
  saveData();
  renderSelectors();
  render();
};

addAccountBtn.onclick = () => simpleAccount();
window.simpleAccount = (id=null)=>{
  const acc = id ? accountById(id) : null;
  simpleTitle.textContent = acc ? "Edit account" : "Add account";
  simpleFields.innerHTML = `
    <div class="two-col">
      <label>Name<input id="sName" value="${acc?.name || ""}" required></label>
      <label>Emoji<input id="sEmoji" value="${acc?.emoji || "💵"}"></label>
    </div>
    <div class="two-col">
      <label>Color<input id="sColor" type="color" value="${acc?.color || "#8c6f4d"}"></label>
      <label>Owner<select id="sOwner"><option>Mak</option><option>Ty</option><option>Joint</option></select></label>
    </div>
    <label>Starting balance<input id="sBalance" type="number" step="0.01" value="${acc?.startingBalance ?? 0}"></label>

    <details class="form-details" ${acc && isSavingsAccount(acc) ? "open" : ""}>
      <summary>Savings goal, optional</summary>
      <div class="details-inner">
        <div class="two-col">
          <label>Goal name<input id="sGoalName" value="${acc?.goalName || ""}" placeholder="Emergency fund, moving, etc."></label>
          <label>Goal amount<input id="sGoalAmount" type="number" step="0.01" value="${acc?.goalAmount ?? 0}"></label>
        </div>
        <p class="hint">Savings uses this to show “Left to Goal” on the Accounts page.</p>
      </div>
    </details>

    <label class="checkbox"><input id="sPaycheck" type="checkbox" ${acc?.paycheckAccount ? "checked" : ""}> Use next paycheck safe-to-spend logic</label>`;
  setTimeout(()=>{ if(acc) sOwner.value=acc.owner; },0);
  simpleSubmit = ()=>{
    const payload = {
      name:sName.value,
      emoji:sEmoji.value || "💵",
      color:sColor.value || "#8c6f4d",
      type:"cash",
      owner:sOwner.value,
      startingBalance:Number(sBalance.value || 0),
      goalName:document.getElementById("sGoalName")?.value || "",
      goalAmount:Number(document.getElementById("sGoalAmount")?.value || 0),
      paycheckAccount:sPaycheck.checked
    };

    if(acc){
      Object.assign(acc, payload);
    } else {
      data.accounts.push({id:uid(), order:data.accounts.length, ...payload});
    }
  };
  simpleDelete = acc ? ()=>{ if(confirm("Delete this account?")) data.accounts = data.accounts.filter(a=>a.id!==acc.id); } : null;
  deleteSimpleBtn.style.display = acc ? "inline-block" : "none";
  simpleModal.showModal();
};


addBudgetBtn.onclick = () => simpleBudget();
addBillBtn.onclick = () => openTransaction(null, { recurrence:{type:"monthly", interval:1} });
window.simpleBudget = (id=null, preset={})=>{
  const b = id ? data.budgets.find(x=>x.id===id) : null;
  const allAccountIds = orderedAccounts().map(a=>a.id);
  let initialIds = b ? budgetScopeAccountIds(b) : (preset.accountId && preset.accountId !== "all" ? [preset.accountId] : allAccountIds);
  if(b?.accountScope === "all" || (!b && preset.accountId === "all")) initialIds = allAccountIds;
  simpleTitle.textContent = b ? "Edit budget" : "Add budget";
  simpleFields.innerHTML = `
    <div class="form-grid two">
      <label>Budget/group name <input id="sBudgetName" value="${escapeAttr(b?.name || "")}" placeholder="Optional — e.g. Necessary bills"></label>
      <label>Budget emoji <input id="sBudgetEmoji" value="${escapeAttr(b?.emoji || "")}" maxlength="12" placeholder="Optional — e.g. 🏠"></label>
    </div>
    <div class="budget-account-picker">
      <span class="field-label">Include accounts</span>
      ${orderedAccounts().map(a=>`<label class="budget-account-check"><input type="checkbox" name="sBudgetAccountIds" value="${a.id}"> <span>${a.emoji || "💵"} ${a.name}</span></label>`).join("")}
      <p class="hint">Select one, several, or every account. Spending from unchecked accounts will be excluded.</p>
    </div>
    <div class="budget-account-picker">
      <span class="field-label">Include categories</span>
      ${sortedCategories().filter(c=>!isBudgetExcludedCategory(c.id)).map(c=>`<label class="budget-account-check"><input type="checkbox" name="sBudgetCategoryIds" value="${c.id}"> <span>${c.emoji} ${c.name}</span></label>`).join("")}
      <p class="hint">Select one category or combine several categories under one monthly budget.</p>
    </div>
    <label>Monthly amount<input id="sAmount" type="number" step="0.01" value="${b?.amount ?? ""}" required></label>`;
  setTimeout(()=>{
    document.querySelectorAll('input[name="sBudgetAccountIds"]').forEach(input=>{ input.checked = initialIds.includes(input.value); });
    const initialCategoryIds = b ? budgetCategoryIds(b) : (preset.categoryId ? [preset.categoryId] : []);
    document.querySelectorAll('input[name="sBudgetCategoryIds"]').forEach(input=>{ input.checked = initialCategoryIds.includes(input.value); });
  },0);
  simpleSubmit = ()=>{
    let accountIds = [...document.querySelectorAll('input[name="sBudgetAccountIds"]:checked')].map(input=>input.value);
    if(!accountIds.length){
      alert("Choose at least one account for this budget.");
      return false;
    }
    const scope = accountIds.length === allAccountIds.length ? "all" : (accountIds.length === 1 ? "single" : "selected");
    const accountId = scope === "all" ? "" : accountIds[0];
    const categoryIds = [...document.querySelectorAll('input[name="sBudgetCategoryIds"]:checked')].map(input=>input.value).filter(id=>!isBudgetExcludedCategory(id));
    if(!categoryIds.length){
      alert("Choose at least one category for this budget.");
      return false;
    }
    const target = b || {id:uid()};
    target.name = document.getElementById("sBudgetName")?.value.trim() || "";
    target.emoji = document.getElementById("sBudgetEmoji")?.value.trim() || "";
    target.accountScope = scope;
    target.accountId = accountId;
    target.accountIds = scope === "all" ? [] : accountIds;
    target.categoryIds = categoryIds;
    target.categoryId = categoryIds[0]; // legacy fallback for older app versions
    target.amount = Number(sAmount.value);
    target.period = target.period || "monthly";
    target.notes = target.notes || "";
    if(!b) data.budgets.push(target);
  };
  simpleDelete = b ? ()=>{ if(confirm("Delete this budget?")) data.budgets = data.budgets.filter(x=>x.id!==b.id); } : null;
  deleteSimpleBtn.style.display = b ? "inline-block" : "none";
  simpleModal.showModal();
};
window.addBudgetFromReview = (categoryId)=>{
  if(isBudgetExcludedCategory(categoryId)) return;
  if(!categoryId || categoryId === "other"){
    chooseOtherBudgetCategory();
    return;
  }
  simpleBudget(null, {categoryId, accountId:budgetReviewAccountIds.length===1 ? budgetReviewAccountIds[0] : "all"});
};
window.chooseOtherBudgetCategory = ()=>{
  const stats = budgetReviewStats();
  const otherItems = budgetReviewPieData(stats).grouped;
  if(!otherItems.length){
    alert("No smaller categories to review right now.");
    return;
  }
  const list = otherItems.map((item, i)=>`${i+1}. ${item.cat.emoji} ${item.cat.name} — ${money(item.amount)}`).join("\n");
  const answer = prompt(`Which smaller category do you want to review?\n${list}\n\nType a number:`);
  const index = Number(answer) - 1;
  if(Number.isFinite(index) && otherItems[index]){
    openCategoryBudgetDetail(otherItems[index].categoryId);
  }
};

addDebtBtn.onclick = () => simpleDebt();
addDebtBtn.onclick = () => simpleDebt();



function cardPayableDebts(){
  return orderedDebts().filter(d => !isMedicalDebt(d) && !isLoanDebt(d));
}
function isCreditCardDebt(d){
  return d?.type === "Credit Card" || debtTypeLabel(d?.type) === "Credit Card";
}
function transactionOccurrenceSnapshot(id, meta={}){
  const tx = data.transactions.find(t=>t.id===id);
  if(!tx) return null;
  const occurrenceDate = meta.occurrenceDate || tx.date || todayISO();
  return {
    ...tx,
    date: occurrenceDate,
    originalDate: meta.originalDate || tx.date || occurrenceDate,
    generated: !!meta.originalDate && meta.originalDate !== tx.date
  };
}
function useCardInstead(id, meta={}){
  const baseTx = data.transactions.find(t=>t.id===id);
  const tx = transactionOccurrenceSnapshot(id, meta);
  if(!baseTx || !tx){ alert("Could not find that transaction."); return; }
  if(tx.type !== "expense" || tx.debtAccountId || !tx.accountId){
    alert("Use card instead is for cash-account expenses that you want to route through a credit/rewards card.");
    return;
  }
  const cards = cardPayableDebts();
  if(!cards.length){ alert("Add a credit card or BNPL debt account first."); return; }

  simpleTitle.textContent = "Use card instead";
  const defaultCard = cards.find(d => /one\s*pay|onepay/i.test(`${d.company || ""} ${d.name || ""}`)) || cards[0];
  const defaultPaymentDate = tx.date;
  simpleFields.innerHTML = `
    <p class="hint">This keeps the cash plan/category, adds the card charge on the purchase date, and schedules the card payment separately.</p>
    <div class="two-col">
      <label>Card used
        <select id="cardInsteadDebt">${cards.map(d=>`<option value="${d.id}" ${d.id===defaultCard.id ? "selected" : ""}>${d.emoji || "💳"} ${d.company} • ${d.name}</option>`).join("")}</select>
      </label>
      <label>Cash account paying it
        <select id="cardInsteadCash">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===tx.accountId ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
      </label>
    </div>
    <div class="two-col">
      <label>Purchase/card charge date<input id="cardInsteadPurchaseDate" type="date" value="${tx.date}"></label>
      <label>Payment date from cash<input id="cardInsteadPaymentDate" type="date" value="${defaultPaymentDate}"></label>
    </div>
    <div class="two-col">
      <label>Card charge status
        <select id="cardInsteadChargeStatus"><option value="planned">Planned</option><option value="cleared">Cleared</option></select>
      </label>
      <label>Cash payment status
        <select id="cardInsteadPaymentStatus"><option value="planned">Planned</option><option value="cleared">Cleared</option></select>
      </label>
    </div>
    <label class="checkbox"><input id="cardInsteadKeepTitle" type="checkbox" checked> Use the same title/category/amount for the card charge and cash payment</label>
    <p class="hint"><b>${tx.title || "Expense"}</b> • ${money(Number(tx.amount || 0))} • ${categoryById(tx.categoryId)?.emoji || ""} ${categoryById(tx.categoryId)?.name || "Uncategorized"}</p>
  `;
  setTimeout(()=>{
    const status = tx.status || "planned";
    const chargeStatus = document.getElementById("cardInsteadChargeStatus");
    const paymentStatus = document.getElementById("cardInsteadPaymentStatus");
    if(chargeStatus) chargeStatus.value = status;
    if(paymentStatus) paymentStatus.value = status;
  },0);

  simpleSubmit = ()=>{
    const cardId = document.getElementById("cardInsteadDebt")?.value || defaultCard.id;
    const cashId = document.getElementById("cardInsteadCash")?.value || tx.accountId;
    const purchaseDate = document.getElementById("cardInsteadPurchaseDate")?.value || tx.date;
    const paymentDate = document.getElementById("cardInsteadPaymentDate")?.value || tx.date;
    const chargeStatus = document.getElementById("cardInsteadChargeStatus")?.value || tx.status || "planned";
    const paymentStatus = document.getElementById("cardInsteadPaymentStatus")?.value || tx.status || "planned";
    const card = debtById(cardId);
    const amount = Number(tx.amount || 0);
    const noteSuffix = `Routed through ${card?.name || "card"} from planned cash expense ${tx.id || id}.`;

    const cardSpend = {
      id: uid(),
      title: tx.title || "Card purchase",
      amount,
      date: purchaseDate,
      type: "expense",
      status: chargeStatus,
      accountId: "",
      debtAccountId: cardId,
      categoryId: tx.categoryId,
      transferToAccountId: "",
      linkedDebtId: "",
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat: false,
      notes: [tx.notes, noteSuffix].filter(Boolean).join("\n"),
      dateOverrides: {}
    };

    const paymentTx = {
      id: uid(),
      title: tx.title || `Payment to ${card?.name || "card"}`,
      amount,
      date: paymentDate,
      type: "transfer",
      status: paymentStatus,
      accountId: cashId,
      debtAccountId: "",
      categoryId: tx.categoryId,
      transferToAccountId: "",
      linkedDebtId: cardId,
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat: false,
      notes: [tx.notes, `Card payment for ${card?.name || "card"}; category kept as ${categoryById(tx.categoryId)?.name || "original category"} for cash planning.`].filter(Boolean).join("\n"),
      dateOverrides: {}
    };

    if(isRecurring(baseTx)){
      deleteRecurringOccurrence(baseTx, meta.originalDate || tx.originalDate || baseTx.date, meta.occurrenceDate || tx.date);
      data.transactions.push(cardSpend, paymentTx);
    } else {
      Object.assign(baseTx, paymentTx, {id: baseTx.id});
      data.transactions.push(cardSpend);
    }
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
}
window.useCardInstead = useCardInstead;


function createCardPaymentForCharge(id, meta={}){
  const baseTx = data.transactions.find(t=>t.id===id);
  const tx = transactionOccurrenceSnapshot(id, meta);
  if(!baseTx || !tx){ alert("Could not find that transaction."); return; }
  const debt = debtById(tx.debtAccountId);
  if(tx.type !== "expense" || !tx.debtAccountId || !isCreditCardDebt(debt)){
    alert("Create card payment is for existing credit-card purchases.");
    return;
  }
  const cashAccounts = data.accounts.filter(a=>!isSavingsAccount(a));
  if(!cashAccounts.length){ alert("Add a cash/checking account first."); return; }

  const joint = cashAccounts.find(a=>/joint/i.test(`${a.owner || ""} ${a.name || ""}`)) || null;
  const ownerMatch = cashAccounts.find(a=>a.owner && debt?.owner && a.owner === debt.owner) || null;
  const defaultPaying = /one\s*pay|onepay/i.test(`${debt?.company || ""} ${debt?.name || ""}`) && joint ? joint : (ownerMatch || cashAccounts[0]);
  const reimbDefaults = defaultReimbursementAccounts(defaultPaying?.id || "");
  const amount = Number(tx.amount || 0);
  const category = categoryById(tx.categoryId);
  // Creating a card payment is usually a planning action; do not auto-clear it just because the card charge is cleared.
  const defaultPaymentStatus = "planned";

  simpleTitle.textContent = "Create card payment";
  simpleFields.innerHTML = `
    <p class="hint">Use this when the credit-card charge already exists. It creates the cash-account payment that pays this card charge down, without re-entering the purchase.</p>
    <p class="hint"><b>${tx.title || "Card purchase"}</b> • ${money(amount)} • ${category?.emoji || ""} ${category?.name || "Uncategorized"} • ${debt?.emoji || "💳"} ${debt?.name || "Credit card"}</p>
    <div class="two-col">
      <label>Account paying the card
        <select id="cardPayAccount">${cashAccounts.map(a=>`<option value="${a.id}" ${a.id===defaultPaying?.id ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
      </label>
      <label>Payment date<input id="cardPayDate" type="date" value="${todayISO()}"></label>
    </div>
    <div class="two-col">
      <label>Payment amount<input id="cardPayAmount" type="number" step="0.01" value="${amount.toFixed(2)}" required></label>
      <label>Payment status
        <select id="cardPayStatus"><option value="planned">Planned</option><option value="cleared">Cleared</option></select>
      </label>
    </div>
    <label>Payment title<input id="cardPayTitle" value="${(tx.title || `Payment to ${debt?.name || "card"}`).replace(/"/g,'&quot;')}"></label>
    <label class="checkbox"><input id="cardPayCreateIou" type="checkbox"> Also create planned reimbursement / IOU to pay this cash account back later</label>
    <div id="cardPayIouFields" class="nested-card" style="display:none; margin-top:10px;">
      <div class="two-col">
        <label>From / paying later
          <select id="cardPayIouFrom">${cashAccounts.map(a=>`<option value="${a.id}" ${a.id===reimbDefaults.from ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
        </label>
        <label>To / account being paid back
          <select id="cardPayIouTo">${cashAccounts.map(a=>`<option value="${a.id}" ${a.id===defaultPaying?.id ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
        </label>
      </div>
      <div class="two-col">
        <label>Repayment date<input id="cardPayIouDate" type="date" value="${nextPaycheckDate(reimbDefaults.from || cashAccounts[0]?.id || "")}"></label>
        <label>IOU title<input id="cardPayIouTitle" value="Pay back ${defaultPaying?.name || "cash account"}"></label>
      </div>
      <p class="hint">This creates a normal planned transfer between cash accounts, labeled as an IOU so it is easier to track.</p>
    </div>
  `;
  setTimeout(()=>{
    const statusEl = document.getElementById("cardPayStatus");
    if(statusEl) statusEl.value = defaultPaymentStatus;
    const checkbox = document.getElementById("cardPayCreateIou");
    const fields = document.getElementById("cardPayIouFields");
    const payAccount = document.getElementById("cardPayAccount");
    const iouTo = document.getElementById("cardPayIouTo");
    const iouTitle = document.getElementById("cardPayIouTitle");
    const syncIouTo = ()=>{
      if(iouTo && payAccount) iouTo.value = payAccount.value;
      const acct = accountById(payAccount?.value || "");
      if(iouTitle) iouTitle.value = `Pay back ${acct?.name || "cash account"}`;
    };
    if(checkbox && fields){
      checkbox.onchange = ()=>{ fields.style.display = checkbox.checked ? "block" : "none"; if(checkbox.checked) syncIouTo(); };
    }
    if(payAccount) payAccount.onchange = syncIouTo;
  },0);

  simpleSubmit = ()=>{
    const payAccountId = document.getElementById("cardPayAccount")?.value || defaultPaying?.id || "";
    const payAmount = Number(document.getElementById("cardPayAmount")?.value || amount);
    const payDate = document.getElementById("cardPayDate")?.value || todayISO();
    const payStatus = document.getElementById("cardPayStatus")?.value || "planned";
    const payTitle = document.getElementById("cardPayTitle")?.value || tx.title || `Payment to ${debt?.name || "card"}`;
    if(!payAccountId){ alert("Choose the cash account paying the card."); return; }
    if(!payAmount){ alert("Enter a payment amount."); return; }

    const wantsIou = !!document.getElementById("cardPayCreateIou")?.checked;
    const iouFrom = document.getElementById("cardPayIouFrom")?.value || "";
    const iouTo = document.getElementById("cardPayIouTo")?.value || payAccountId;
    if(wantsIou && (!iouFrom || !iouTo || iouFrom === iouTo)){ alert("Choose two different IOU accounts."); return; }

    data.transactions.push({
      id: uid(),
      title: payTitle,
      amount: payAmount,
      date: payDate,
      type: "transfer",
      status: payStatus,
      accountId: payAccountId,
      debtAccountId: "",
      categoryId: tx.categoryId,
      transferToAccountId: "",
      linkedDebtId: debt.id,
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat: false,
      notes: [
        `Card payment created from ${tx.title || "card purchase"} on ${tx.date}.`,
        `Pays ${debt?.name || "credit card"}; category kept as ${category?.name || "original category"} for cash planning.`
      ].join("\n"),
      dateOverrides: {}
    });

    if(wantsIou){
      const from = iouFrom;
      const to = iouTo;
      data.transactions.push({
        id: uid(),
        title: document.getElementById("cardPayIouTitle")?.value || `Pay back ${accountById(to)?.name || "cash account"}`,
        amount: payAmount,
        date: document.getElementById("cardPayIouDate")?.value || nextPaycheckDate(from),
        type: "transfer",
        status: "planned",
        accountId: from,
        debtAccountId: "",
        categoryId: tx.categoryId,
        transferToAccountId: to,
        linkedDebtId: "",
        pendingReimbursement: true,
        reimbursementToAccountId: to,
        recurrence: {type:"none", interval:1, weekendHandling:"none"},
        repeat: false,
        notes: `Planned IOU / reimbursement for ${tx.title || "card purchase"} paid from ${accountById(to)?.name || "cash account"}.`,
        dateOverrides: {}
      });
    }
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
}
window.createCardPaymentForCharge = createCardPaymentForCharge;

function defaultReimbursementAccounts(selectedId){
  const selected = accountById(selectedId);
  const joint = data.accounts.find(a=>/joint/i.test(`${a.owner || ""} ${a.name || ""}`) && !isSavingsAccount(a)) || data.accounts.find(a=>a.owner === "Joint" && !isSavingsAccount(a));
  const personal = data.accounts.find(a=>a.owner === "Mak" && !isSavingsAccount(a)) || data.accounts.find(a=>a.owner !== "Joint" && !isSavingsAccount(a)) || data.accounts[0];
  if(selected?.owner === "Joint" || /joint/i.test(selected?.name || "")){
    return {from: personal?.id || selectedId || "", to: selectedId || joint?.id || ""};
  }
  return {from: selectedId || personal?.id || "", to: joint?.id || data.accounts.find(a=>a.id !== selectedId)?.id || ""};
}
function openPendingReimbursement(selectedAccountId=""){
  if(data.accounts.length < 2){ alert("Add at least two cash accounts first."); return; }
  const defaults = defaultReimbursementAccounts(selectedAccountId);
  simpleTitle.textContent = "Plan reimbursement / IOU";
  simpleFields.innerHTML = `
    <p class="hint">Use this when one cash account fronts money and another account will pay it back later. This creates a normal planned transfer that counts in projected balances and Safe to Spend.</p>
    <div class="two-col">
      <label>From / paying later
        <select id="reimbFrom">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===defaults.from ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
      </label>
      <label>To / account being paid back
        <select id="reimbTo">${data.accounts.map(a=>`<option value="${a.id}" ${a.id===defaults.to ? "selected" : ""}>${a.emoji || "💵"} ${a.name}</option>`).join("")}</select>
      </label>
    </div>
    <div class="two-col">
      <label>Estimated / actual amount<input id="reimbAmount" type="number" step="0.01" placeholder="0.00" required></label>
      <label>Repayment date<input id="reimbDate" type="date" value="${todayISO()}"></label>
    </div>
    <div class="two-col">
      <label>Category<select id="reimbCategory">${sortedCategories().map(c=>`<option value="${c.id}" ${c.id==="gas" ? "selected" : ""}>${c.emoji} ${c.name}</option>`).join("")}</select></label>
      <label>Title<input id="reimbTitle" value="Pay back Joint" required></label>
    </div>
    <label>Notes<textarea id="reimbNotes" rows="3" placeholder="Gas reimbursement, OnePay payoff, etc."></textarea></label>
    <p class="hint">Tip: use an estimate while planning. Edit the amount once you know the exact total, then mark it cleared when you actually transfer the money.</p>
  `;
  simpleSubmit = ()=>{
    const from = document.getElementById("reimbFrom")?.value || defaults.from;
    const to = document.getElementById("reimbTo")?.value || defaults.to;
    const amount = Number(document.getElementById("reimbAmount")?.value || 0);
    if(!from || !to || from === to){ alert("Choose two different accounts."); return; }
    if(!amount){ alert("Enter an amount."); return; }
    data.transactions.push({
      id: uid(),
      title: document.getElementById("reimbTitle")?.value || "Planned reimbursement",
      amount,
      date: document.getElementById("reimbDate")?.value || todayISO(),
      type: "transfer",
      status: "planned",
      accountId: from,
      debtAccountId: "",
      categoryId: document.getElementById("reimbCategory")?.value || "unassigned",
      transferToAccountId: to,
      linkedDebtId: "",
      pendingReimbursement: true,
      reimbursementToAccountId: to,
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      repeat: false,
      notes: document.getElementById("reimbNotes")?.value || "Planned IOU / reimbursement. Counts like a normal planned transfer.",
      dateOverrides: {}
    });
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
}
window.openPendingReimbursement = openPendingReimbursement;
function markPendingReimbursementCleared(id){
  const tx = data.transactions.find(t=>t.id === id);
  if(!tx){ alert("Could not find that transaction."); return; }
  if(!tx.pendingReimbursement || tx.type !== "transfer" || !tx.transferToAccountId){
    alert("That transaction is not a pending reimbursement.");
    return;
  }
  tx.status = "cleared";
  tx.pendingReimbursement = false;
  tx.reimbursementToAccountId = tx.transferToAccountId || tx.reimbursementToAccountId || "";
  saveData();
  render();
}
window.markPendingReimbursementCleared = markPendingReimbursementCleared;

window.createDebtMinPayment = (id)=>{
  const d = debtById(id);
  if(!d || !Number(debtMonthlyPaymentAmount(d) || 0)){
    alert("Monthly payment is not set for this debt.");
    return;
  }

  const suggestedAccount = data.accounts.find(a => a.owner === d.owner && !isSavingsAccount(a)) || data.accounts.find(a => !isSavingsAccount(a)) || data.accounts[0];
  const defaultAmount = debtMonthlyPaymentAmount(d);

  simpleTitle.textContent = "Plan debt payment";
  simpleFields.innerHTML = `
    <p class="hint">${d.emoji || "💳"} ${d.name}</p>
    <label>Pull from account
      <select id="sSourceAccount">
        ${data.accounts.filter(a=>!isSavingsAccount(a)).map(a=>`<option value="${a.id}">${a.emoji || "💵"} ${a.name}</option>`).join("")}
      </select>
    </label>
    <div class="two-col">
      <label>Payment date<input id="sPaymentDate" type="date" value="${d.dueDate || todayISO()}"></label>
      <label>Amount<input id="sPaymentAmount" type="number" step="0.01" value="${defaultAmount}"></label>
    </div>
    <label>Status
      <select id="sPaymentTxStatus">
        <option value="planned">Planned</option>
        <option value="cleared">Cleared</option>
      </select>
    </label>
    <p class="hint">This creates a transfer out of the selected checking account and links it to the debt, so both the account and debt balances update.</p>
  `;

  setTimeout(()=>{ if(suggestedAccount) sSourceAccount.value = suggestedAccount.id; },0);

  simpleSubmit = ()=>{
    data.transactions.push({
      id: uid(),
      title: `${d.name} payment`,
      amount: Number(sPaymentAmount.value || 0),
      date: sPaymentDate.value || d.dueDate || todayISO(),
      type: "transfer",
      status: sPaymentTxStatus.value || "planned",
      accountId: sSourceAccount.value || "",
      categoryId: debtPaymentCategoryId(d),
      linkedDebtId: d.id,
      recurrence: {type:"none", interval:1, weekendHandling:"none"},
      notes: "Created from debt monthly payment"
    });
    d.paymentStatus = sPaymentTxStatus.value === "cleared" ? "paid" : "scheduled";
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
};



window.addBNPLPurchase = ()=>{
  const accounts = data.accounts.filter(a=>!isSavingsAccount(a));
  const defaultAccount = accounts.find(a=>a.owner==="Mak") || accounts[0];

  simpleTitle.textContent = "Add BNPL purchase";
  simpleFields.innerHTML = `
    <p class="hint">Create a new BNPL debt account and planned payment transactions in one step.</p>

    <div class="two-col">
      <label>Provider / company
        <input id="bnplCompany" value="Klarna" placeholder="Klarna, Affirm, Afterpay">
      </label>
      <label>Merchant / purchase name
        <input id="bnplMerchant" placeholder="Amazon, Ulta, Ring..." required>
      </label>
    </div>

    <div class="two-col">
      <label>Owner
        <select id="bnplOwner">
          <option>Mak</option>
          <option>Ty</option>
          <option>Joint</option>
        </select>
      </label>
      <label>Pull payments from
        <select id="bnplSourceAccount">
          ${accounts.map(a=>`<option value="${a.id}">${a.emoji || "💵"} ${a.name}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="two-col">
      <label>Total purchase amount
        <input id="bnplTotal" type="number" step="0.01" value="0.00">
      </label>
      <label>Number of payments
        <input id="bnplCount" type="number" min="1" step="1" value="4">
      </label>
    </div>

    <div class="two-col">
      <label>First due date
        <input id="bnplFirstDate" type="date" value="${todayISO()}">
      </label>
      <label>Payment schedule
        <select id="bnplScheduleMode">
          <option value="days">Every N days</option>
          <option value="monthly-same-day">Monthly on same date</option>
        </select>
      </label>
    </div>

    <label id="bnplFrequencyWrap"><span id="bnplFrequencyLabel">Every how many days?</span>
      <input id="bnplFrequency" type="number" min="1" step="1" value="14">
    </label>

    <label class="checkbox"><input id="bnplCreatePayments" type="checkbox" checked> Add each payment as a planned transaction</label>

    <div class="bnpl-preview-head">
      <strong>Payment schedule</strong>
      <button type="button" class="ghost tiny" id="bnplRefreshSchedule">Refresh split</button>
    </div>
    <div id="bnplPayments"></div>

    <p class="hint">Tip: use Refresh split after changing total, payment count, first date, or frequency. You can still edit individual dates/amounts before saving.</p>
  `;

  setTimeout(()=>{
    if(defaultAccount) bnplSourceAccount.value = defaultAccount.id;

    const updateScheduleUI = ()=>{
      const monthly = bnplScheduleMode.value === "monthly-same-day";
      if(bnplFrequencyLabel) bnplFrequencyLabel.textContent = monthly ? "Every how many months?" : "Every how many days?";
      if(monthly && Number(bnplFrequency.value || 0) > 12) bnplFrequency.value = 1;
      if(monthly && !bnplFrequency.value) bnplFrequency.value = 1;
      if(!monthly && !bnplFrequency.value) bnplFrequency.value = 14;
    };
    const refresh = ()=>{
      updateScheduleUI();
      const total = Number(bnplTotal.value || 0);
      const count = Math.max(1, Number(bnplCount.value || 1));
      const first = bnplFirstDate.value || todayISO();
      const mode = bnplScheduleMode.value || "days";
      const fallbackFreq = mode === "monthly-same-day" ? 1 : 14;
      const freq = Math.max(1, Number(bnplFrequency.value || fallbackFreq));
      bnplPayments.innerHTML = bnplPaymentRowsHTML(total, count, first, freq, mode);
    };

    bnplRefreshSchedule.onclick = refresh;
    [bnplTotal, bnplCount, bnplFirstDate, bnplFrequency, bnplScheduleMode].forEach(el=>el.addEventListener("change", refresh));
    bnplScheduleMode.addEventListener("change", ()=>{
      if(bnplScheduleMode.value === "monthly-same-day") bnplFrequency.value = 1;
      refresh();
    });
    refresh();
  },0);

  simpleSubmit = ()=>{
    const company = bnplCompany.value || "Klarna";
    const merchant = bnplMerchant.value || company;
    const owner = bnplOwner.value || "Mak";
    const sourceAccountId = bnplSourceAccount.value || "";
    const total = Number(bnplTotal.value || 0);
    const paymentDates = Array.from(document.querySelectorAll(".bnpl-date")).map(x=>x.value || todayISO());
    const paymentAmounts = Array.from(document.querySelectorAll(".bnpl-amount")).map(x=>Number(x.value || 0));
    const firstDue = paymentDates[0] || "";
    const minDue = paymentAmounts[0] || 0;
    const scheduleMode = document.getElementById("bnplScheduleMode")?.value || "days";
    const scheduleFreq = Math.max(1, Number(document.getElementById("bnplFrequency")?.value || (scheduleMode === "monthly-same-day" ? 1 : 14)));
    const scheduleText = scheduleMode === "monthly-same-day"
      ? `monthly every ${scheduleFreq} month${scheduleFreq === 1 ? "" : "s"} on day ${parseDate(firstDue || todayISO()).getDate()}`
      : `every ${scheduleFreq} day${scheduleFreq === 1 ? "" : "s"}`;

    const debtId = uid();
    const debtName = `${merchant} ${company}`;

    data.debts.push({
      id: debtId,
      order: data.debts.length,
      type: "Buy Now, Pay Later",
      company,
      name: debtName,
      emoji: "💗",
      color: "#f3a6c8",
      owner,
      startingBalance: total,
      balance: total,
      limit: null,
      apr: 0,
      statementDate: "",
      dueDate: firstDue,
      statementBalance: total,
      minDue,
      manualExtra: 0,
      paymentStatus: bnplCreatePayments.checked ? "scheduled" : "not-set",
      frozenLocked: false,
      notes: `BNPL purchase: ${merchant} • Schedule: ${scheduleText}`
    });

    if(bnplCreatePayments.checked){
      paymentDates.forEach((date, i)=>{
        const amount = Number(paymentAmounts[i] || 0);
        if(!amount) return;
        data.transactions.push({
          id: uid(),
          title: `${merchant} (${i+1}/${paymentDates.length})`,
          amount,
          date,
          type: "transfer",
          status: "planned",
          accountId: sourceAccountId,
          categoryId: "klarna",
          linkedDebtId: debtId,
          recurrence: {type:"none", interval:1, weekendHandling:"none"},
          notes: `BNPL payment ${i+1} of ${paymentDates.length} for ${debtName} • Original due date ${date}`
        });
      });
    }
  };

  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
};


window.quickDebtDue = (id)=>{
  const d = debtById(id);
  if(!d) return;
  const isBnpl = isBNPLDebt(d);
  const isMedical = isMedicalDebt(d);
  const isCreditCard = d.type === "Credit Card";
  const dueLabel = isBnpl || isMedical ? "Next payment due" : "Due date";
  const amountLabel = isBnpl ? "Next payment amount" : (isMedical ? "Monthly payment" : "Minimum due");
  simpleTitle.textContent = isBnpl || isMedical ? "Update payment plan" : "Update due date / minimum";
  simpleFields.innerHTML = `
    <p class="hint">${d.emoji || "💳"} ${d.name}</p>
    <div class="two-col">
      ${isBnpl ? `<p class="hint">BNPL due dates are set by the linked installment transactions. Edit/move those transactions directly; their notes preserve the original due date.</p>` : `<label>${dueLabel}<input id="sDueDate" type="date" value="${d.dueDate || ""}"></label>`}
      <label>${amountLabel}<input id="sMinDue" type="number" step="0.01" value="${d.minDue ?? 0}"></label>
    </div>
    ${isBnpl ? "" : `
    <div class="two-col">
      <label>Manual extra payment<input id="sManualExtra" type="number" step="0.01" value="${d.manualExtra ?? 0}"></label>
      <label>Monthly payment total<input id="sTotalMonthlyPayment" type="number" step="0.01" value="${debtMonthlyPaymentAmount(d) || 0}"></label>
    </div>`}
    ${isBnpl ? "" : `
    <div class="two-col">
      <label>Statement date<input id="sStatementDate" type="date" value="${d.statementDate || ""}"></label>
      <label>Statement balance<input id="sStatementBalance" type="number" step="0.01" value="${d.statementBalance ?? d.balance ?? 0}"></label>
    </div>
    <label class="checkbox"><input id="sResetTrackingToStatement" type="checkbox"> Reset tracking baseline to this statement balance/date</label>
    <p class="hint">Use this when you want Current Balance to start from the statement balance, then only count cleared debt activity after the statement date.</p>`}
    ${isCreditCard ? `<div class="subpanel"><p class="eyebrow">Automatic payment status</p><div class="debt-status-pill ${debtPaymentStatusClass(debtDisplayPaymentStatus(d))}">${debtPaymentStatusLabel(debtDisplayPaymentStatus(d))}</div><p class="hint">Money Nest derives this from the statement/minimum due plus linked planned or recurring card payments. Save changes to refresh it.</p></div>` : `<label>${isBnpl ? "Installment status" : "Payment status"}
      <select id="sPaymentStatus">
        <option value="not-set">Not set</option>
        <option value="planned">Planned</option>
        <option value="unpaid">Unpaid</option>
        <option value="scheduled">Scheduled</option>
        <option value="autopay">Autopay</option>
        <option value="paid">Paid</option>
        <option value="skip">Skip/Ignore</option>
      </select>
    </label>`}`;
  setTimeout(()=>{
    if(document.getElementById("sPaymentStatus")) sPaymentStatus.value = isBnpl ? debtDisplayPaymentStatus(d) : (d.paymentStatus || "not-set");
    let totalMonthlyTouched = false;
    const minInput = document.getElementById("sMinDue");
    const extraInput = document.getElementById("sManualExtra");
    const totalInput = document.getElementById("sTotalMonthlyPayment");
    totalInput?.addEventListener("input", ()=>{ totalMonthlyTouched = true; });
    const syncTotalMonthly = ()=>{
      if(totalMonthlyTouched || !totalInput) return;
      totalInput.value = (Number(minInput?.value || 0) + Number(extraInput?.value || 0)).toFixed(2);
    };
    minInput?.addEventListener("input", syncTotalMonthly);
    extraInput?.addEventListener("input", syncTotalMonthly);
  },0);
  simpleSubmit = ()=>{
    if(document.getElementById("sDueDate")) d.dueDate=sDueDate.value;
    d.minDue=Number(sMinDue.value || 0);
    if(!isBnpl){
      d.manualExtra = Number(document.getElementById("sManualExtra")?.value || 0);
      d.totalMonthlyPayment = Number(document.getElementById("sTotalMonthlyPayment")?.value || 0) || (Number(d.minDue || 0) + Number(d.manualExtra || 0));
    }
    if(!isBnpl){
      d.statementDate=sStatementDate.value;
      d.statementBalance=Number(sStatementBalance.value || 0);
      if(document.getElementById("sResetTrackingToStatement")?.checked){
        d.trackingStartDate = sStatementDate.value || todayISO();
        if(!isMedical && !isLoanDebt(d)){
          d.startingBalance = Number(sStatementBalance.value || 0);
          d.balance = d.startingBalance; // legacy/export compatibility only; live Current Balance is calculated.
        }
      }
    }
    if(document.getElementById("sPaymentStatus")) d.paymentStatus=sPaymentStatus.value;
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
};


window.simpleDebt = (id=null)=>{
  const d = id ? debtById(id) : null;
  simpleTitle.textContent = d ? "Edit debt" : "Add debt";
  simpleFields.innerHTML = `
    <div class="two-col">
      <label>Type<select id="sType"><option>Credit Card</option><option>Loan</option><option>Medical</option><option>Buy Now, Pay Later</option></select></label>
      <label>Owner<select id="sOwner"><option>Mak</option><option>Ty</option><option>Joint</option></select></label>
    </div>
    <div class="two-col">
      <label>Company<input id="sCompany" value="${d?.company || ""}" required></label>
      <label>Name<input id="sName" value="${d?.name || ""}" required></label>
    </div>
    <div class="two-col">
      <label>Emoji<input id="sEmoji" value="${d?.emoji || "💳"}"></label>
      <label>Color<input id="sColor" type="color" value="${d?.color || "#8c6f4d"}"></label>
    </div>

    <div class="two-col">
      <label id="sStartingBalanceLabel">Starting balance<input id="sStartingBalance" type="number" step="0.01" value="${d?.startingBalance ?? d?.statementBalance ?? d?.balance ?? ""}"></label>
      <label id="sBalanceLabel">Remaining balance<input id="sBalance" type="number" step="0.01" value="${d?.balance ?? ""}"></label>
    </div>
    <div class="two-col">
      <label id="sTrackingStartDateLabel">Count cleared transactions after<input id="sTrackingStartDate" type="date" value="${d?.trackingStartDate || ""}"></label>
      <label id="sLimitLabel">Credit line / limit<input id="sLimit" type="number" step="0.01" value="${d?.limit ?? ""}"></label>
    </div>

    <div class="two-col">
      <label id="sStatementDateLabel">Statement date<input id="sStatementDate" type="date" value="${d?.statementDate || ""}"></label>
      <label id="sDueDateLabel">Due date<input id="sDueDate" type="date" value="${d?.dueDate || ""}"></label>
    </div>

    <div class="two-col">
      <label id="sStatementBalanceLabel">Statement balance<input id="sStatementBalance" type="number" step="0.01" value="${d?.statementBalance ?? d?.balance ?? 0}"></label>
      <label id="sMinDueLabel">Minimum due<input id="sMinDue" type="number" step="0.01" value="${d?.minDue ?? 0}"></label>
    </div>

    <div class="two-col" id="sDebtExtraRow">
      <label id="sManualExtraLabel">Manual extra payment<input id="sManualExtra" type="number" step="0.01" value="${d?.manualExtra ?? 0}"></label>
      <label id="sAprLabel">APR<input id="sApr" type="number" step="0.01" value="${d?.apr ?? 0}"></label>
    </div>

    <label id="sTotalMonthlyPaymentLabel">Monthly payment total
      <input id="sTotalMonthlyPayment" type="number" step="0.01" value="${d ? debtMonthlyPaymentAmount(d) : 0}">
    </label>

    <label id="sPaymentStatusLabel">Payment status
      <select id="sPaymentStatus">
        <option value="not-set">Not set</option>
        <option value="planned">Planned</option>
        <option value="unpaid">Unpaid</option>
        <option value="scheduled">Scheduled</option>
        <option value="autopay">Autopay</option>
        <option value="paid">Paid</option>
        <option value="skip">Skip/Ignore</option>
      </select>
    </label>
    <div class="subpanel" id="sAutoPaymentStatusBlock" style="display:none"></div>
    <label class="checkbox" id="sFrozenLockedLabel"><input id="sFrozenLocked" type="checkbox" ${d?.frozenLocked ? "checked" : ""}> Frozen / locked</label>

    <div class="subpanel" id="sLoanForecastBlock">
      <h4>Loan payoff forecast</h4>
      <label>Future payment split
        <select id="sLoanForecastBreakdownMode">
          <option value="auto">Auto from cleared payment breakdowns</option>
          <option value="manual">Manual percentages</option>
          <option value="off">Off / full payment lowers balance</option>
        </select>
      </label>
      <label>Fee timing
        <select id="sLoanFeeTiming">
          <option value="auto">Auto</option>
          <option value="every-payment">Every payment</option>
          <option value="first-payment-month">First payment each month</option>
          <option value="monthly-only">Monthly payments only</option>
          <option value="none">No fees in forecast</option>
        </select>
      </label>
      <div class="three-col">
        <label>Principal %<input id="sLoanEstPrincipalPct" type="number" step="0.01" value="${d?.loanEstPrincipalPct ?? ""}" placeholder="auto"></label>
        <label>Interest %<input id="sLoanEstInterestPct" type="number" step="0.01" value="${d?.loanEstInterestPct ?? ""}" placeholder="auto"></label>
        <label>Fee %<input id="sLoanEstFeePct" type="number" step="0.01" value="${d?.loanEstFeePct ?? ""}" placeholder="auto"></label>
      </div>
      <p class="hint" id="sLoanForecastHint">Actual payment breakdowns still override estimates. Future recurring payments use this split for payoff dates.</p>
      <p class="hint" id="sLoanForecastHistoryHint">${d && isLoanDebt(d) ? loanForecastHistoryCountText(d) : ""}</p>
    </div>

    <p class="hint" id="sBnplHint"></p>
    <label>Notes<textarea id="sNotes" placeholder="Optional">${d?.notes || ""}</textarea></label>`;

  const updateDebtFormLabels = ()=>{
    const type = document.getElementById("sType")?.value || "";
    const isBnpl = type === "Buy Now, Pay Later" || type === "Klarna";
    const isMedical = type === "Medical";
    const isLoan = type === "Loan";
    const isCreditCard = type === "Credit Card";

    const startingBalanceLabel = document.getElementById("sStartingBalanceLabel");
    const balanceLabel = document.getElementById("sBalanceLabel");
    const trackingStartDateLabel = document.getElementById("sTrackingStartDateLabel");
    const limitLabel = document.getElementById("sLimitLabel");
    const statementDateLabel = document.getElementById("sStatementDateLabel");
    const dueDateLabel = document.getElementById("sDueDateLabel");
    const statementBalanceLabel = document.getElementById("sStatementBalanceLabel");
    const minDueLabel = document.getElementById("sMinDueLabel");
    const extraRow = document.getElementById("sDebtExtraRow");
    const manualExtraLabel = document.getElementById("sManualExtraLabel");
    const aprLabel = document.getElementById("sAprLabel");
    const totalMonthlyLabel = document.getElementById("sTotalMonthlyPaymentLabel");
    const paymentStatusLabel = document.getElementById("sPaymentStatusLabel");
    const autoPaymentStatusBlock = document.getElementById("sAutoPaymentStatusBlock");
    const frozenLabel = document.getElementById("sFrozenLockedLabel");
    const loanForecastBlock = document.getElementById("sLoanForecastBlock");
    const loanForecastHint = document.getElementById("sLoanForecastHint");
    const hint = document.getElementById("sBnplHint");

    if(isBnpl){
      if(startingBalanceLabel) startingBalanceLabel.childNodes[0].textContent = "Original purchase / total";
      if(balanceLabel){ balanceLabel.style.display = ""; balanceLabel.childNodes[0].textContent = "Remaining balance"; }
      if(trackingStartDateLabel) trackingStartDateLabel.style.display = "none";
      if(limitLabel) limitLabel.style.display = "none";
      if(dueDateLabel) dueDateLabel.style.display = "none";
      if(minDueLabel) minDueLabel.childNodes[0].textContent = "Next payment amount";
      if(statementBalanceLabel) statementBalanceLabel.style.display = "none";
      if(statementDateLabel) statementDateLabel.style.display = "none";
      if(extraRow) extraRow.style.display = "none";
      if(totalMonthlyLabel) totalMonthlyLabel.style.display = "none";
      if(paymentStatusLabel){ paymentStatusLabel.style.display = ""; paymentStatusLabel.childNodes[0].textContent = "Installment status"; }
      if(autoPaymentStatusBlock) autoPaymentStatusBlock.style.display = "none";
      if(frozenLabel) frozenLabel.style.display = "none";
      if(loanForecastBlock) loanForecastBlock.style.display = "none";
      if(hint) hint.textContent = "BNPL balances are calculated from linked installment payments. These fields are fallback/reference values.";
    } else if(isMedical){
      if(startingBalanceLabel) startingBalanceLabel.childNodes[0].textContent = "Starting balance";
      if(balanceLabel) balanceLabel.style.display = "none";
      if(trackingStartDateLabel) trackingStartDateLabel.style.display = "none";
      if(limitLabel) limitLabel.style.display = "none";
      if(dueDateLabel){ dueDateLabel.style.display = ""; dueDateLabel.childNodes[0].textContent = "Next payment due"; }
      if(minDueLabel) minDueLabel.childNodes[0].textContent = "Monthly payment";
      if(statementDateLabel){ statementDateLabel.style.display = ""; statementDateLabel.childNodes[0].textContent = "Statement / current date"; }
      if(statementBalanceLabel){ statementBalanceLabel.style.display = ""; statementBalanceLabel.childNodes[0].textContent = "Statement / current balance"; }
      if(extraRow) extraRow.style.display = "";
      if(manualExtraLabel) manualExtraLabel.style.display = "";
      if(aprLabel) aprLabel.style.display = "none";
      if(totalMonthlyLabel) totalMonthlyLabel.style.display = "";
      if(paymentStatusLabel){ paymentStatusLabel.style.display = ""; paymentStatusLabel.childNodes[0].textContent = "Payment status"; }
      if(autoPaymentStatusBlock) autoPaymentStatusBlock.style.display = "none";
      if(frozenLabel) frozenLabel.style.display = "none";
      if(loanForecastBlock) loanForecastBlock.style.display = "none";
      if(hint) hint.textContent = "Medical Current Balance uses Statement/Current Balance + Date as the live provider baseline when provided, then counts cleared payments after that date.";
    } else {
      if(startingBalanceLabel) startingBalanceLabel.childNodes[0].textContent = "Starting balance";
      if(balanceLabel) balanceLabel.style.display = "none";
      if(trackingStartDateLabel) trackingStartDateLabel.style.display = "";
      if(limitLabel){ limitLabel.style.display = isLoan ? "none" : ""; limitLabel.childNodes[0].textContent = "Credit line / limit"; }
      if(dueDateLabel){ dueDateLabel.style.display = ""; dueDateLabel.childNodes[0].textContent = "Due date"; }
      if(minDueLabel) minDueLabel.childNodes[0].textContent = "Minimum due";
      if(statementBalanceLabel) statementBalanceLabel.style.display = "";
      if(statementDateLabel) statementDateLabel.style.display = "";
      if(extraRow) extraRow.style.display = "";
      if(manualExtraLabel) manualExtraLabel.style.display = "";
      if(aprLabel) aprLabel.style.display = "";
      if(totalMonthlyLabel) totalMonthlyLabel.style.display = "";
      if(paymentStatusLabel){ paymentStatusLabel.style.display = isCreditCard ? "none" : ""; paymentStatusLabel.childNodes[0].textContent = "Payment status"; }
      if(autoPaymentStatusBlock){
        autoPaymentStatusBlock.style.display = isCreditCard ? "" : "none";
        if(isCreditCard){
          const autoStatus = d && d.type === "Credit Card" ? debtDisplayPaymentStatus(d) : "unpaid";
          autoPaymentStatusBlock.innerHTML = `<p class="eyebrow">Automatic payment status</p><div class="debt-status-pill ${debtPaymentStatusClass(autoStatus)}">${d ? debtPaymentStatusLabel(autoStatus) : "Automatic after save"}</div><p class="hint">Credit cards use linked payment data automatically: recurring series = Autopay, one planned payment = Scheduled, a cleared payment or $0 statement/$0 due = Paid, otherwise Unpaid.</p>`;
        }
      }
      if(frozenLabel) frozenLabel.style.display = "";
      if(loanForecastBlock) loanForecastBlock.style.display = isLoan ? "" : "none";
      if(loanForecastHint && isLoan){
        const tempDebt = d || {};
        loanForecastHint.textContent = loanForecastSummaryText({
          ...tempDebt,
          id: tempDebt.id || "",
          type:"Loan",
          loanForecastBreakdownMode:document.getElementById("sLoanForecastBreakdownMode")?.value || tempDebt.loanForecastBreakdownMode || "auto",
          loanFeeTiming:document.getElementById("sLoanFeeTiming")?.value || tempDebt.loanFeeTiming || "auto",
          loanEstPrincipalPct:document.getElementById("sLoanEstPrincipalPct")?.value ?? tempDebt.loanEstPrincipalPct ?? "",
          loanEstInterestPct:document.getElementById("sLoanEstInterestPct")?.value ?? tempDebt.loanEstInterestPct ?? "",
          loanEstFeePct:document.getElementById("sLoanEstFeePct")?.value ?? tempDebt.loanEstFeePct ?? "",
          loanForecastHistory:tempDebt.loanForecastHistory || []
        });
      }
      if(hint) hint.textContent = isLoan ? "Loan Current Balance uses Statement Balance/Date as the live lender baseline when provided, then counts cleared loan activity after that date. Planned/recurring payments can estimate principal/interest/fees from recent breakdowns." : "Current Balance is calculated from Starting Balance plus cleared card/debt transactions and payments. Planned future payments only affect forecasts.";
    }
  };

  setTimeout(()=>{
    if(d){
      sType.value = d.type === "Klarna" ? "Buy Now, Pay Later" : d.type;
      sOwner.value = d.owner;
      sPaymentStatus.value = isBNPLDebt(d) ? debtDisplayPaymentStatus(d) : (d.paymentStatus || "not-set");
      const forecastModeEl = document.getElementById("sLoanForecastBreakdownMode");
      const feeTimingEl = document.getElementById("sLoanFeeTiming");
      if(forecastModeEl) forecastModeEl.value = d.loanForecastBreakdownMode || "auto";
      if(feeTimingEl) feeTimingEl.value = d.loanFeeTiming || "auto";
    }
    updateDebtFormLabels();
    sType.addEventListener("change", updateDebtFormLabels);
    ["sLoanForecastBreakdownMode","sLoanFeeTiming","sLoanEstPrincipalPct","sLoanEstInterestPct","sLoanEstFeePct"].forEach(id=>{
      document.getElementById(id)?.addEventListener("input", updateDebtFormLabels);
      document.getElementById(id)?.addEventListener("change", updateDebtFormLabels);
    });

    let totalMonthlyTouched = false;
    const minInput = document.getElementById("sMinDue");
    const extraInput = document.getElementById("sManualExtra");
    const totalInput = document.getElementById("sTotalMonthlyPayment");
    totalInput?.addEventListener("input", ()=>{ totalMonthlyTouched = true; });
    const syncTotalMonthly = ()=>{
      if(totalMonthlyTouched || !totalInput) return;
      totalInput.value = (Number(minInput?.value || 0) + Number(extraInput?.value || 0)).toFixed(2);
    };
    minInput?.addEventListener("input", syncTotalMonthly);
    extraInput?.addEventListener("input", syncTotalMonthly);
  },0);

  simpleSubmit = ()=>{
    const isBnpl = sType.value === "Buy Now, Pay Later" || sType.value === "Klarna";
    const isMedical = sType.value === "Medical";
    const isLoan = sType.value === "Loan";
    const payload = {
      type:sType.value === "Klarna" ? "Buy Now, Pay Later" : sType.value,
      company:sCompany.value,
      name:sName.value,
      owner:sOwner.value,
      emoji:sEmoji.value || "💳",
      color:sColor.value || "#8c6f4d",
      startingBalance:Number(document.getElementById("sStartingBalance")?.value || document.getElementById("sBalance")?.value || 0),
      // Preserve legacy balance/currentBalance export field. Non-BNPL debts calculate live Current Balance from the selected baseline + cleared transactions.
      balance:isBnpl ? Number(document.getElementById("sBalance")?.value || 0) : (isMedical ? Number(sStatementBalance?.value || document.getElementById("sStartingBalance")?.value || 0) : Number(document.getElementById("sStartingBalance")?.value || 0)),
      trackingStartDate:(isBnpl || isMedical) ? "" : (document.getElementById("sTrackingStartDate")?.value || ""),
      limit:(isBnpl || isMedical || isLoan) ? null : (sLimit.value === "" ? null : Number(sLimit.value)),
      statementDate:isBnpl ? "" : sStatementDate.value,
      dueDate:sDueDate.value,
      statementBalance:isBnpl ? Number(document.getElementById("sStartingBalance")?.value || document.getElementById("sBalance")?.value || 0) : Number(sStatementBalance.value || 0),
      minDue:Number(sMinDue.value || 0),
      manualExtra:isBnpl ? 0 : Number(sManualExtra.value || 0),
      totalMonthlyPayment:isBnpl ? Number(sMinDue.value || 0) : (Number(document.getElementById("sTotalMonthlyPayment")?.value || 0) || (Number(sMinDue.value || 0) + Number(sManualExtra.value || 0))),
      apr:(isBnpl || isMedical) ? 0 : Number(sApr.value || 0),
      paymentStatus:(sType.value === "Credit Card" ? (d?.paymentStatus || "not-set") : sPaymentStatus.value),
      loanForecastBreakdownMode:isLoan ? (document.getElementById("sLoanForecastBreakdownMode")?.value || "auto") : "auto",
      loanFeeTiming:isLoan ? (document.getElementById("sLoanFeeTiming")?.value || "auto") : "auto",
      loanEstPrincipalPct:isLoan ? (document.getElementById("sLoanEstPrincipalPct")?.value || "") : "",
      loanEstInterestPct:isLoan ? (document.getElementById("sLoanEstInterestPct")?.value || "") : "",
      loanEstFeePct:isLoan ? (document.getElementById("sLoanEstFeePct")?.value || "") : "",
      loanForecastHistory:isLoan ? normalizeLoanForecastHistory(d?.loanForecastHistory || defaultLoanForecastHistoryForDebt({owner:sOwner.value, company:sCompany.value, name:sName.value, type:"Loan"})) : [],
      frozenLocked:(isBnpl || isMedical) ? false : sFrozenLocked.checked,
      notes:sNotes.value || ""
    };
    if(d){
      Object.assign(d, payload);
    } else {
      data.debts.push({id:uid(), order:data.debts.length, ...payload});
    }
  };
  simpleDelete = d ? ()=>{ if(confirm("Delete this debt?")) data.debts = data.debts.filter(x=>x.id!==d.id); } : null;
  deleteSimpleBtn.style.display = d ? "inline-block" : "none";
  simpleModal.showModal();
};

if(document.getElementById("addCategoryBtn")) addCategoryBtn.onclick = () => simpleCategory();
const bulkEditCategoriesBtnEl = document.getElementById("bulkEditCategoriesBtn");
const categoryCleanupBtnEl = document.getElementById("categoryCleanupBtn");
const addTemplateBtnEl = document.getElementById("addTemplateBtn");
const templateCleanupBtnEl = document.getElementById("templateCleanupBtn");
if(addTemplateBtnEl) addTemplateBtnEl.onclick = () => simpleTemplate();
if(templateCleanupBtnEl) templateCleanupBtnEl.onclick = openTemplateCleanup;
if(categoryCleanupBtnEl) categoryCleanupBtnEl.onclick = openCategoryCleanup;
const undoLastChangeBtnEl = document.getElementById("undoLastChangeBtn");
if(undoLastChangeBtnEl) undoLastChangeBtnEl.onclick = undoLastChange;
const clearChangeHistoryBtnEl = document.getElementById("clearChangeHistoryBtn");
if(clearChangeHistoryBtnEl) clearChangeHistoryBtnEl.onclick = clearChangeHistory;
window.bulkEditCategoryColors = ()=>{
  const cats = sortedCategories();
  simpleTitle.textContent = "Bulk edit category colors";
  simpleFields.innerHTML = `
    <p class="hint">Select categories, then apply one palette role or one custom color to all of them. Names, emojis, and transaction assignments will not change.</p>
    <div class="inline-actions bulk-category-actions">
      <button type="button" class="ghost small" id="bulkCategorySelectAll">Select all</button>
      <button type="button" class="ghost small" id="bulkCategorySelectNone">Clear selection</button>
      <span class="summary-pill" id="bulkCategorySelectedCount">0 selected</span>
    </div>
    <div class="bulk-category-list">
      ${cats.map(c=>`<label class="bulk-category-option"><input type="checkbox" data-bulk-category-id="${escapeAttr(c.id)}"><span class="cat-dot" style="background:${effectiveCategoryColor(c)}"></span><span>${c.emoji||""} ${c.name}</span><small>${c.customColorOverride?"Custom color":paletteRoleLabel(c.paletteRole)}</small></label>`).join("")}
    </div>
    <label>Apply
      <select id="bulkCategoryColorAction">
        <option value="role">Palette role</option>
        <option value="custom">Custom color override</option>
        <option value="clear">Remove custom overrides</option>
      </select>
    </label>
    <label id="bulkCategoryRoleWrap">Palette role
      <select id="bulkCategoryPaletteRole">${CATEGORY_PALETTE_ROLES.map(r=>`<option value="${r}">${paletteRoleLabel(r)}</option>`).join("")}</select>
    </label>
    <label id="bulkCategoryColorWrap" style="display:none">Custom color
      <input id="bulkCategoryCustomColor" type="color" value="#d56b9a">
    </label>`;

  const checks = [...simpleFields.querySelectorAll("[data-bulk-category-id]")];
  const countEl = document.getElementById("bulkCategorySelectedCount");
  const updateCount = ()=>{ if(countEl) countEl.textContent = `${checks.filter(x=>x.checked).length} selected`; };
  checks.forEach(x=>x.addEventListener("change", updateCount));
  document.getElementById("bulkCategorySelectAll")?.addEventListener("click",()=>{checks.forEach(x=>x.checked=true);updateCount();});
  document.getElementById("bulkCategorySelectNone")?.addEventListener("click",()=>{checks.forEach(x=>x.checked=false);updateCount();});
  document.getElementById("bulkCategoryColorAction")?.addEventListener("change",e=>{
    const action=e.target.value;
    const roleWrap=document.getElementById("bulkCategoryRoleWrap");
    const colorWrap=document.getElementById("bulkCategoryColorWrap");
    if(roleWrap) roleWrap.style.display=action==="role"?"":"none";
    if(colorWrap) colorWrap.style.display=action==="custom"?"":"none";
  });

  simpleSubmit = ()=>{
    const ids = checks.filter(x=>x.checked).map(x=>x.dataset.bulkCategoryId);
    if(!ids.length){ alert("Select at least one category."); return false; }
    const action = document.getElementById("bulkCategoryColorAction")?.value || "role";
    const role = document.getElementById("bulkCategoryPaletteRole")?.value || "medium1";
    const customColor = document.getElementById("bulkCategoryCustomColor")?.value || "#d56b9a";
    data.categories.filter(c=>ids.includes(c.id)).forEach(c=>{
      c.legacyColor ||= c.color || effectiveCategoryColor(c);
      if(action === "role"){
        c.paletteRole = role;
        c.customColorOverride = false;
        c.customColor = "";
      } else if(action === "custom"){
        c.customColorOverride = true;
        c.customColor = customColor;
      } else {
        c.customColorOverride = false;
        c.customColor = "";
      }
      c.color = effectiveCategoryColor(c);
    });
    normalizeCategories();
  };
  simpleDelete = null;
  deleteSimpleBtn.style.display = "none";
  simpleModal.showModal();
};
if(bulkEditCategoriesBtnEl) bulkEditCategoriesBtnEl.onclick = window.bulkEditCategoryColors;

window.simpleCategory = (id=null)=>{
  const c = id ? categoryById(id) : null;
  simpleTitle.textContent = id ? "Edit category" : "Add category";
  simpleFields.innerHTML = `
    <label>Name<input id="sName" value="${id ? c.name : ""}" required></label>
    <label>Emoji<input id="sEmoji" value="${id ? c.emoji : ""}" placeholder="🍔"></label>
    <label>Palette role<select id="sPaletteRole">${CATEGORY_PALETTE_ROLES.map(r=>`<option value="${r}" ${(id?c.paletteRole:defaultCategoryPaletteRole({id:slug(c?.name||"")}))===r?"selected":""}>${paletteRoleLabel(r)}</option>`).join("")}</select></label>
    <label class="checkbox-row"><input id="sCustomColorOverride" type="checkbox" ${id&&c.customColorOverride?"checked":""}> Keep a custom color instead of following the palette</label>
    <label>Custom color<input id="sColor" type="color" value="${id ? (c.customColor||c.color) : "#8c6f4d"}"></label>`;
  simpleSubmit = ()=>{
    const nameEl = document.getElementById("sName");
    const emojiEl = document.getElementById("sEmoji");
    const colorEl = document.getElementById("sColor");
    const roleEl = document.getElementById("sPaletteRole");
    const overrideEl = document.getElementById("sCustomColorOverride");
    const nextName = (nameEl?.value || "").trim();
    const nextEmoji = emojiEl?.value || "";
    const nextColor = colorEl?.value || "#8c6f4d";
    const nextRole = roleEl?.value || "medium1";
    const nextOverride = !!overrideEl?.checked;

    if(!nextName) return;

    if(id){
      const target = data.categories.find(x=>x.id===id) || c;
      target.name = nextName;
      target.emoji = nextEmoji;
      target.paletteRole = nextRole;
      target.customColorOverride = nextOverride;
      target.customColor = nextOverride ? nextColor : "";
      target.legacyColor ||= target.color || nextColor;
      target.color = effectiveCategoryColor(target);
    } else {
      const nextId = slug(nextName);
      const existing = data.categories.find(x=>x.id===nextId);
      if(existing){
        existing.name = nextName;
        existing.emoji = nextEmoji;
        existing.paletteRole = nextRole;
        existing.customColorOverride = nextOverride;
        existing.customColor = nextOverride ? nextColor : "";
        existing.legacyColor ||= existing.color || nextColor;
        existing.color = effectiveCategoryColor(existing);
      } else {
        const created={id:nextId,name:nextName,emoji:nextEmoji,color:nextColor,legacyColor:nextColor,paletteRole:nextRole,customColorOverride:nextOverride,customColor:nextOverride?nextColor:""};
        created.color=effectiveCategoryColor(created); data.categories.push(created);
      }
    }

    normalizeCategories();
  };
  simpleDelete = id ? ()=>{
    if(confirm("Delete this category? Existing transactions will become unassigned.")){
      data.transactions.forEach(tx=>{ if(tx.categoryId === id) tx.categoryId = "unassigned"; });
      (data.settings?.transactionTemplates || []).forEach(t=>{ if(t.categoryId === id) t.categoryId = "unassigned"; });
      data.categories = data.categories.filter(x=>x.id!==id);
    }
  } : null;
  deleteSimpleBtn.style.display = id ? "inline-block" : "none";
  simpleModal.showModal();
};


const CORE_CATEGORY_IDS = new Set(["income","paycheck","transfer","unassigned","banking","credit-card-payment","loan-payment","klarna","savings","medical"]);
function categoryUsageStats(category){
  const id=category.id;
  const txs=(data.transactions||[]).filter(tx=>tx.categoryId===id);
  const templates=(data.settings?.transactionTemplates||[]).filter(t=>t.categoryId===id);
  const budgets=(data.budgets||[]).filter(b=>{
    const ids=Array.isArray(b.categoryIds)&&b.categoryIds.length?b.categoryIds:[b.categoryId].filter(Boolean);
    return ids.includes(id);
  });
  const recurring=txs.filter(tx=>isRecurring(tx)).length;
  const dates=txs.map(tx=>String(tx.date||"")).filter(Boolean).sort();
  const lastDate=dates.at(-1)||"";
  const configured=templates.length+budgets.length+recurring;
  let status="Keep";
  let reason="Used regularly";
  if(CORE_CATEGORY_IDS.has(id)){status="Core";reason="Reserved for Money Nest calculations or routing";}
  else if(!txs.length&&!configured){status="Unused";reason="No transactions, templates, budgets, or recurring rules";}
  else if(configured){status="Configured";reason=[budgets.length?`${budgets.length} budget${budgets.length===1?'':'s'}`:'',templates.length?`${templates.length} template${templates.length===1?'':'s'}`:'',recurring?`${recurring} recurring rule${recurring===1?'':'s'}`:''].filter(Boolean).join(" • ");}
  else if(txs.length<=2){status="Review";reason=`Only ${txs.length} saved transaction${txs.length===1?'':'s'}`;}
  else if(lastDate){
    try{if(daysBetween(parseDate(lastDate),new Date())>365){status="Historical";reason="No use in the last year";}}catch(err){}
  }
  return {txCount:txs.length,cleared:txs.filter(t=>t.status==='cleared').length,planned:txs.filter(t=>t.status==='planned').length,templates:templates.length,budgets:budgets.length,recurring,lastDate,configured,status,reason};
}
function categoryCleanupRows(filter="all"){
  return sortedCategories().map(c=>({category:c,stats:categoryUsageStats(c)})).filter(item=>{
    if(filter==="unused")return item.stats.status==="Unused";
    if(filter==="review")return ["Review","Historical"].includes(item.stats.status);
    if(filter==="configured")return item.stats.status==="Configured";
    return true;
  }).sort((a,b)=>{
    const priority={Unused:0,Review:1,Historical:2,Configured:3,Keep:4,Core:5};
    return (priority[a.stats.status]??9)-(priority[b.stats.status]??9)||a.category.name.localeCompare(b.category.name);
  });
}
function mergeCategoryInto(sourceId,targetId){
  if(!sourceId||!targetId||sourceId===targetId)return;
  if(CORE_CATEGORY_IDS.has(sourceId)){alert("This is a core Money Nest category and cannot be merged away. You can still edit its name, emoji, or color.");return;}
  const source=categoryById(sourceId),target=categoryById(targetId);
  if(!source||!target)return;
  const s=categoryUsageStats(source);
  if(!confirm(`Merge “${source.name}” into “${target.name}”? This will update ${s.txCount} transactions, ${s.templates} templates, and ${s.budgets} budgets, then remove the old category.`))return;
  (data.transactions||[]).forEach(tx=>{if(tx.categoryId===sourceId)tx.categoryId=targetId;});
  (data.settings?.transactionTemplates||[]).forEach(t=>{if(t.categoryId===sourceId)t.categoryId=targetId;});
  (data.budgets||[]).forEach(b=>{
    let ids=Array.isArray(b.categoryIds)&&b.categoryIds.length?[...b.categoryIds]:[b.categoryId].filter(Boolean);
    ids=[...new Set(ids.map(id=>id===sourceId?targetId:id))];
    b.categoryIds=ids;b.categoryId=ids[0]||targetId;
  });
  data.categories=data.categories.filter(c=>c.id!==sourceId);
  if(Array.isArray(calendarHighlightCategories))calendarHighlightCategories=calendarHighlightCategories.map(id=>id===sourceId?targetId:id);
  normalizeCategories();normalizeTransactionTemplates();saveData();renderCategoryCleanup();
}
function deleteUnusedCategory(id){
  const c=categoryById(id);if(!c)return;
  const s=categoryUsageStats(c);
  if(s.txCount||s.configured){alert("This category still has references. Merge it into another category instead of deleting it.");return;}
  if(CORE_CATEGORY_IDS.has(id)){alert("This is a core Money Nest category and cannot be deleted.");return;}
  if(!confirm(`Delete unused category “${c.name}”?`))return;
  data.categories=data.categories.filter(x=>x.id!==id);normalizeCategories();saveData();renderCategoryCleanup();
}
function renderCategoryCleanup(){
  const summary=document.getElementById("categoryCleanupSummary"),content=document.getElementById("categoryCleanupContent");
  if(!summary||!content)return;
  const all=sortedCategories().map(c=>({category:c,stats:categoryUsageStats(c)}));
  const filter=document.getElementById("categoryCleanupFilter")?.value||"all";
  const rows=categoryCleanupRows(filter);
  summary.innerHTML=`<article><b>${all.length}</b><span>categories</span></article><article><b>${all.filter(x=>x.stats.status==='Unused').length}</b><span>unused</span></article><article><b>${all.filter(x=>['Review','Historical'].includes(x.stats.status)).length}</b><span>worth reviewing</span></article><article><b>${all.reduce((n,x)=>n+x.stats.txCount,0)}</b><span>categorized records</span></article>`;
  content.innerHTML=rows.map(({category:c,stats:s})=>`<article class="category-cleanup-row">
    <div class="category-cleanup-name"><span class="cat-dot" style="background:${effectiveCategoryColor(c)}"></span><div><b>${c.emoji||''} ${escapeAttr(c.name)}</b><small>${escapeAttr(s.status)} — ${escapeAttr(s.reason)}</small></div></div>
    <div class="category-cleanup-stats"><span><b>${s.txCount}</b> transactions</span><span>${s.cleared} cleared • ${s.planned} planned</span><span>${s.lastDate?templateLastUsedLabel(s.lastDate):'Never used'}</span></div>
    <div class="category-cleanup-links"><span>${s.budgets} budgets</span><span>${s.templates} templates</span><span>${s.recurring} recurring</span></div>
    <div class="category-cleanup-actions" data-category-cleanup-id="${c.id}"><button type="button" class="ghost small" data-category-cleanup-edit>Edit</button>${CORE_CATEGORY_IDS.has(c.id)?`<span class="template-badge default">Protected core category</span>`:`<label>Merge into<select data-category-merge-target><option value="">Choose…</option>${sortedCategories().filter(x=>x.id!==c.id).map(x=>`<option value="${x.id}">${x.emoji||''} ${escapeAttr(x.name)}</option>`).join('')}</select></label><button type="button" class="ghost small" data-category-cleanup-merge>Merge</button>${s.status==='Unused'?`<button type="button" class="danger ghost small" data-category-cleanup-delete>Delete unused</button>`:''}`}</div>
  </article>`).join('')||`<div class="empty">No categories match this filter.</div>`;
  content.querySelectorAll("[data-category-cleanup-edit]").forEach(btn=>btn.onclick=()=>{
    const id=btn.closest("[data-category-cleanup-id]")?.dataset.categoryCleanupId || "";
    document.getElementById("categoryCleanupModal")?.close();
    simpleCategory(id);
  });
  content.querySelectorAll("[data-category-cleanup-merge]").forEach(btn=>btn.onclick=()=>{
    const wrap=btn.closest("[data-category-cleanup-id]");
    mergeCategoryInto(wrap?.dataset.categoryCleanupId || "",wrap?.querySelector("[data-category-merge-target]")?.value || "");
  });
  content.querySelectorAll("[data-category-cleanup-delete]").forEach(btn=>btn.onclick=()=>{
    deleteUnusedCategory(btn.closest("[data-category-cleanup-id]")?.dataset.categoryCleanupId || "");
  });
}
function openCategoryCleanup(){renderCategoryCleanup();document.getElementById("categoryCleanupModal")?.showModal();}
window.openCategoryCleanup=openCategoryCleanup;
window.renderCategoryCleanup=renderCategoryCleanup;
window.mergeCategoryInto=mergeCategoryInto;
window.deleteUnusedCategory=deleteUnusedCategory;




function recurrenceOccursOn(tx, cursor, start){
  const r = tx.recurrence || (tx.repeat ? { type:"monthly", interval:1 } : { type:"none", interval:1 });
  if(!r || r.type === "none") return sameDay(cursor, start);

  if(cursor < start) return false;

  if(r.type === "weekly"){
    const interval = Number(r.interval || 1);
    return cursor.getDay() === Number(r.weekday ?? start.getDay()) && daysBetween(start, cursor) % (interval * 7) === 0;
  }

  if(r.type === "biweekly"){
    return cursor.getDay() === start.getDay() && daysBetween(start, cursor) % 14 === 0;
  }

  if(r.type === "monthly"){
    const interval = Number(r.interval || 1);
    return cursor.getDate() === monthlyTargetDay(start, cursor) && monthDiff(start, cursor) % interval === 0;
  }

  if(r.type === "last-day-month"){
    const interval = Number(r.interval || 1);
    return cursor.getDate() === endOfMonth(cursor).getDate() && monthDiff(start, cursor) % interval === 0;
  }

  if(r.type === "yearly"){
    const interval = Number(r.interval || 1);
    return cursor.getMonth() === start.getMonth() && cursor.getDate() === start.getDate() && ((cursor.getFullYear() - start.getFullYear()) % interval === 0);
  }

  if(r.type === "every-x-days"){
    const interval = Number(r.interval || 1);
    return daysBetween(start, cursor) % interval === 0;
  }

  if(r.type === "nth-weekday"){
    const interval = Number(r.interval || 1);
    const nth = nthWeekdayOfMonth(cursor.getFullYear(), cursor.getMonth(), r.weekday ?? start.getDay(), r.ordinal || 1);
    return !!(nth && sameDay(cursor, nth) && monthDiff(start, cursor) % interval === 0);
  }

  return false;
}


function billLooseTitle(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function billLooseTitleMatch(a, b){
  const aa = billLooseTitle(a);
  const bb = billLooseTitle(b);
  if(!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}
function billRouteMatches(template, other){
  if(!template || !other) return false;
  const sameType = String(template.type || "") === String(other.type || "");
  if(!sameType) return false;

  const sameSource = String(template.accountId || "") === String(other.accountId || "");
  const sameCashDestination = String(template.transferToAccountId || "") === String(other.transferToAccountId || "");
  const sameDebtTarget = String(template.linkedDebtId || "") === String(other.linkedDebtId || "");
  const sameDebtAccount = String(template.debtAccountId || "") === String(other.debtAccountId || "");
  const sameCategory = String(template.categoryId || "") === String(other.categoryId || "");
  const amountClose = Math.abs(Number(template.amount || 0) - Number(other.amount || 0)) < 0.01;
  const titleMatch = billLooseTitleMatch(template.title, other.title) || billLooseTitleMatch(template.notes, other.notes);

  const exactRoute = sameSource && sameCashDestination && sameDebtTarget && sameDebtAccount;
  const linkedDebtStrong = !!template.linkedDebtId && sameDebtTarget;
  const cashTransferStrong = !!template.transferToAccountId && sameSource && sameCashDestination;
  const debtAccountStrong = !!template.debtAccountId && sameSource && sameDebtAccount;

  // Prefer stable routing/category/amount matches, but allow a looser match for
  // moved/early card, loan, and BNPL payments whose title changed slightly.
  if(exactRoute && (amountClose || sameCategory || titleMatch)) return true;
  if((linkedDebtStrong || cashTransferStrong || debtAccountStrong) && (amountClose || sameCategory || titleMatch)) return true;
  return false;
}
function findLooseBillPaymentMatch(template, originalISO, occurrenceISO, excludedIds=new Set()){
  try{
    const anchor = parseDate(originalISO || occurrenceISO || template.date || todayISO());
    const start = toISO(addDays(anchor, -21));
    const end = toISO(addDays(anchor, 45));
    const templateLineage = recurringSeriesLineageIds(template);
    const candidates = data.transactions
      .filter(other => other && other.id !== template.id && other.originalId !== template.id)
      .filter(other => !excludedIds.has(other.id))
      .filter(other => !isRecurring(other))
      .filter(other => {
        const sourceId = recurringLinkedSourceId(other);
        return !sourceId || templateLineage.has(sourceId);
      })
      .filter(other => other.date >= start && other.date <= end)
      .filter(other => billRouteMatches(template, other));

    if(!candidates.length) return null;
    candidates.sort((a,b)=>{
      const aCleared = a.status === "cleared" ? 0 : 1;
      const bCleared = b.status === "cleared" ? 0 : 1;
      if(aCleared !== bCleared) return aCleared - bCleared;
      const aDist = Math.abs(daysBetween(anchor, parseDate(a.date)));
      const bDist = Math.abs(daysBetween(anchor, parseDate(b.date)));
      if(aDist !== bDist) return aDist - bDist;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
    return candidates[0] || null;
  } catch(err){
    console.warn("Could not match loose bill payment for", template?.title, err);
    return null;
  }
}
function billOccurrenceInfo(tx){
  try{
    const todayISOValue = todayISO();
    const today = parseDate(todayISOValue);
    const start = parseDate(tx.date);
    const horizon = parseDate(toISO(addMonths(new Date(), 24)));
    const lookbackISO = toISO(addDays(today, -75));

    let cursor = parseDate(toISO(start));
    let firstFuture = null;
    let firstPastDue = null;
    let latestHandled = null;
    const usedLooseMatchIds = new Set();

    while(cursor <= horizon){
      if(recurrenceOccursOn(tx, cursor, start)){
        const originalISO = toISO(cursor);
        if(tx.recurrenceUntil && originalISO > tx.recurrenceUntil){
          cursor = addDays(cursor, 1);
          continue;
        }

        const moved = occurrenceDateFor(tx, cursor);
        if(moved === RECURRENCE_SKIP_DATE || isSkippedOccurrenceDate(tx.dateOverrides?.[originalISO])){
          cursor = addDays(cursor, 1);
          continue;
        }

        const occurrence = applyOccurrenceOverride({
          ...tx,
          id: originalISO === tx.date ? tx.id : `${tx.id}-${originalISO}`,
          originalId: tx.id,
          status: originalISO === tx.date ? tx.status : "planned",
          generated: originalISO !== tx.date
        }, originalISO, moved);

        if(occurrence){
          const looseMatch = occurrence.status === "cleared"
            ? null
            : findLooseBillPaymentMatch(tx, originalISO, occurrence.date, usedLooseMatchIds);
          if(looseMatch?.id) usedLooseMatchIds.add(looseMatch.id);
          const matchedDate = looseMatch?.date || "";
          const displayDate = matchedDate || occurrence.date;
          const cleared = occurrence.status === "cleared" || looseMatch?.status === "cleared";
          // A saved planned occurrence is still the next upcoming bill. Only a
          // cleared match should mark the recurring date as handled and advance
          // the header/card to the following occurrence.
          const handled = cleared;
          const info = {
            date: displayDate,
            originalDate: originalISO,
            status: cleared ? "cleared" : "planned",
            matched: looseMatch || null,
            handled
          };

          if(displayDate >= todayISOValue){
            if(handled){
              latestHandled = {...info, status: cleared ? "cleared" : "planned"};
            } else {
              firstFuture = info;
              break;
            }
          } else if(handled){
            latestHandled = {...info, status: cleared ? "cleared" : "planned"};
          } else if(displayDate >= lookbackISO && !firstPastDue){
            firstPastDue = {...info, status:"due"};
          }
        }
      }
      cursor = addDays(cursor, 1);
    }

    // If something old is truly unresolved, keep surfacing it; otherwise show the
    // next scheduled occurrence. This avoids stale June cards when a payment was
    // dragged, moved, or handled by a matching one-off payment.
    if(firstPastDue) return firstPastDue;
    if(firstFuture) return firstFuture;
    if(latestHandled) return latestHandled;

    const latest = latestBillOccurrenceDate(tx) || tx?.date || todayISOValue;
    if(tx.recurrenceUntil && tx.recurrenceUntil < todayISOValue){
      return {date: latest, originalDate: tx.recurrenceUntil || latest, status:"ended", handled:true};
    }
    return {date: latest, originalDate: latest, status: tx.status === "cleared" ? "cleared" : "due", handled: tx.status === "cleared"};
  } catch(err){
    console.warn("Could not calculate bill occurrence info for", tx?.title, err);
    return {date: tx?.date || todayISO(), originalDate: tx?.date || todayISO(), status: tx?.status === "cleared" ? "cleared" : "due", handled: tx?.status === "cleared"};
  }
}
function billFutureOccurrenceDate(tx){
  const info = billOccurrenceInfo(tx);
  return info.date >= todayISO() ? info.date : "";
}
function latestBillOccurrenceDate(tx){
  try{
    const todayISOValue = todayISO();
    const today = parseDate(todayISOValue);
    const start = parseDate(tx.date);
    let cursor = parseDate(toISO(start));
    let latest = "";

    while(cursor <= today){
      if(recurrenceOccursOn(tx, cursor, start)){
        const originalISO = toISO(cursor);
        if(!tx.recurrenceUntil || originalISO <= tx.recurrenceUntil){
          const moved = occurrenceDateFor(tx, cursor);
          if(moved !== RECURRENCE_SKIP_DATE && !isSkippedOccurrenceDate(tx.dateOverrides?.[originalISO]) && moved <= todayISOValue){
            latest = moved;
          }
        }
      }
      cursor = addDays(cursor, 1);
    }

    return latest;
  } catch(err){
    console.warn("Could not calculate latest bill occurrence for", tx?.title, err);
    return tx?.date || "";
  }
}

function billOccurrenceDisplayDate(tx){
  return billOccurrenceInfo(tx).date || tx?.date || todayISO();
}

function billOccurrenceStatus(tx){
  return tx.billInfo?.status || billOccurrenceInfo(tx).status || "planned";
}
function billStatusBadge(tx){
  const status = billOccurrenceStatus(tx);
  const label = status === "cleared" ? "✓ Cleared" : status === "due" ? "⚠ Due" : status === "ended" ? "✓ Ended" : "○ Planned";
  const cssStatus = status === "ended" ? "cleared ended" : status;
  const title = status === "due" ? "Due or overdue and not matched to a moved/early payment" : status === "ended" ? "Recurring series ended" : "Next occurrence status";
  return `<span class="status-toggle ${cssStatus} bill-status-badge" title="${title}">${label}</span>`;
}

function nextOccurrenceDate(tx){
  try{
    const today = parseDate(todayISO());
    const start = parseDate(tx.date);
    const horizon = parseDate(toISO(addMonths(new Date(), 24)));

    let cursor = new Date(Math.max(start.getTime(), addDays(today, -7).getTime()));
    cursor = parseDate(toISO(cursor));

    while(cursor <= horizon){
      if(recurrenceOccursOn(tx, cursor, start)){
        const originalISO = toISO(cursor);
        const moved = occurrenceDateFor(tx, cursor);
        if(moved === "9999-12-31" || tx.dateOverrides?.[originalISO] === "9999-12-31"){
          cursor = addDays(cursor, 1);
          continue;
        }
        if(moved >= todayISO()) return moved;
      }
      cursor = addDays(cursor, 1);
    }

    return tx.date || todayISO();
  } catch(err){
    console.warn("Could not calculate next occurrence for", tx?.title, err);
    return tx?.date || todayISO();
  }
}

function billAccountLabel(tx){
  if(tx.accountId) return accountById(tx.accountId)?.name || "Unknown account";
  if(tx.debtAccountId) return debtById(tx.debtAccountId)?.name || "Unknown debt";
  return "No account";
}


function normalizeBillCategoriesFilter(){
  if(!Array.isArray(billFilters.categories)){
    billFilters.categories = billFilters.category ? [billFilters.category] : ["all"];
  }
  if(!billFilters.categories.length || billFilters.categories.includes("all")){
    billFilters.categories = ["all"];
  }
}
function billCategoryFilterIsAll(){
  normalizeBillCategoriesFilter();
  return billFilters.categories.includes("all");
}
function billCategoryFilterLabel(){
  normalizeBillCategoriesFilter();
  if(billCategoryFilterIsAll()) return "All categories";
  if(billFilters.categories.length === 1) return categoryById(billFilters.categories[0]).name;
  return `${billFilters.categories.length} categories`;
}

function billMatchesFilters(tx){
  const account = accountById(tx.accountId);
  const owner = account?.owner;
  const accountMatch =
    billFilters.account === "all" ||
    tx.accountId === billFilters.account ||
    tx.debtAccountId === billFilters.account ||
    tx.linkedDebtId === billFilters.account ||
    owner === billFilters.account;

  normalizeBillCategoriesFilter();
  const categoryMatch = billCategoryFilterIsAll() || billFilters.categories.includes(tx.categoryId);
  const typeMatch = billFilters.type === "all" || tx.type === billFilters.type;
  const recurrenceType = tx.recurrence?.type || (tx.repeat ? "monthly" : "none");
  const recurrenceMatch = billFilters.recurrence === "all" || recurrenceType === billFilters.recurrence;

  return accountMatch && categoryMatch && typeMatch && recurrenceMatch;
}

function renderBillFilters(){
  const accountSelect = document.getElementById("billAccountFilter");
  const categorySelect = document.getElementById("billCategoryFilter");
  const typeSelect = document.getElementById("billTypeFilter");
  const recurrenceSelect = document.getElementById("billRecurrenceFilter");
  const sortSelect = document.getElementById("billSort");

  const accountOptions = [
    `<option value="all">All accounts/owners</option>`,
    `<option value="Mak">Mak only</option>`,
    `<option value="Ty">Ty only</option>`,
    `<option value="Joint">Joint only</option>`,
    ...data.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`),
    ...data.debts.map(d=>`<option value="${d.id}">${d.company || "Debt"} • ${d.name}</option>`)
  ].join("");

  if(accountSelect){
    accountSelect.innerHTML = accountOptions;
    accountSelect.value = billFilters.account || "all";
  }

  const categoryBtn = document.getElementById("billCategoryDropdownBtn");
  const categoryMenu = document.getElementById("billCategoryDropdownMenu");
  if(categoryBtn && categoryMenu){
    normalizeBillCategoriesFilter();
    const validIds = data.categories.map(c=>c.id);
    const normalizedBillCategories = billFilters.categories.filter(id => id === "all" || validIds.includes(id));
    if(normalizedBillCategories.join("|") !== billFilters.categories.join("|")){
      billFilters.categories = normalizedBillCategories.length ? normalizedBillCategories : ["all"];
      saveUiPrefs();
    }
    if(!billFilters.categories.length) billFilters.categories = ["all"];

    categoryBtn.textContent = billCategoryFilterLabel();
    categoryBtn.title = billCategoryFilterLabel();

    const rows = [
      `<label class="check-row"><input type="checkbox" value="all" ${billCategoryFilterIsAll() ? "checked" : ""}> <span>All categories</span></label>`,
      ...data.categories.map(c=>`<label class="check-row"><input type="checkbox" value="${c.id}" ${billFilters.categories.includes(c.id) ? "checked" : ""}> <span>${c.emoji} ${c.name}</span></label>`)
    ];
    categoryMenu.innerHTML = rows.join("");

    categoryMenu.querySelectorAll("input[type='checkbox']").forEach(input=>{
      input.onchange = ()=>{
        let selected = [...categoryMenu.querySelectorAll("input[type='checkbox']:checked")].map(i=>i.value);

        if(input.value === "all" && input.checked){
          selected = ["all"];
        } else {
          selected = selected.filter(v=>v !== "all");
        }

        billFilters.categories = selected.length ? selected : ["all"];
        billFilters.category = billFilters.categories[0] || "all";
        saveUiPrefs();
        renderBills();
      };
    });
  }

  if(typeSelect) typeSelect.value = billFilters.type || "all";
  if(recurrenceSelect) recurrenceSelect.value = billFilters.recurrence || "all";
  if(sortSelect) sortSelect.value = billFilters.sort || "date";
}

function dedupeRecurringBillRows(rows){
  const grouped = new Map();
  rows.forEach(tx => {
    // A recurring template's ID is its identity. Titles, routes, amounts, and
    // schedules are display/content fields and may intentionally match another
    // independent series. Only collapse rows that resolve to the same explicit
    // canonical lineage; never hide a separate template because its name matches.
    // Keep the rendered row rather than replacing it with the raw canonical
    // transaction so derived display fields such as nextDate/billInfo survive.
    const canonical = canonicalRecurringSeries(tx) || tx;
    const key = String(canonical.id || tx.id || "");
    if(!grouped.has(key)) grouped.set(key, tx);
  });
  return [...grouped.values()];
}


function archiveRecurringBill(txId){
  const tx = data.transactions.find(t=>t.id === txId);
  if(!tx || !isRecurring(tx)) return false;
  if(!confirm(`Archive ${tx.title}? Future and non-cleared occurrences will be removed, while cleared history and the recurring rule stay available.`)) return false;

  const today = todayISO();
  tx.billArchived = true;
  tx.billArchivedAt = today;
  tx.billArchivedPreviousRecurrenceUntil = tx.recurrenceUntil || "";
  tx.recurrenceUntil = toISO(addDays(parseDate(today), -1));

  // Remove saved one-off/replacement rows tied to this series when they are
  // future or not cleared. Cleared history remains untouched.
  data.transactions = data.transactions.filter(row=>{
    if(row.id === tx.id) return true;
    const sourceId = row.recurringSourceId || row.originalId || row.recurrenceSourceId || "";
    if(sourceId !== tx.id) return true;
    return row.status === "cleared" && String(row.date || "") < today;
  });

  // Remove non-cleared and future occurrence overrides. Restoring the rule will
  // regenerate its schedule from the recurring template.
  if(tx.occurrenceOverrides && typeof tx.occurrenceOverrides === "object"){
    Object.keys(tx.occurrenceOverrides).forEach(originalDate=>{
      const override = tx.occurrenceOverrides[originalDate] || {};
      const effectiveDate = override.date || originalDate;
      if(override.status !== "cleared" || effectiveDate >= today) delete tx.occurrenceOverrides[originalDate];
    });
  }
  if(tx.dateOverrides && typeof tx.dateOverrides === "object"){
    Object.keys(tx.dateOverrides).forEach(originalDate=>{
      const movedDate = tx.dateOverrides[originalDate];
      if(originalDate >= today || (movedDate && movedDate !== RECURRENCE_SKIP_DATE && movedDate >= today)) delete tx.dateOverrides[originalDate];
    });
  }

  saveData();
  renderBills();
  return true;
}

function restoreArchivedBill(txId){
  const tx = data.transactions.find(t=>t.id === txId);
  if(!tx || !isRecurring(tx)) return false;
  const label = tx.billArchived ? "Restore" : "Reactivate";
  if(!confirm(`${label} ${tx.title} as an active recurring bill?`)) return false;

  if(tx.billArchived){
    tx.recurrenceUntil = tx.billArchivedPreviousRecurrenceUntil || "";
  } else {
    tx.recurrenceUntil = "";
  }
  tx.billArchived = false;
  tx.billArchivedAt = "";
  tx.billArchivedPreviousRecurrenceUntil = "";
  saveData();
  renderBills();
  return true;
}


function billLinkedTransactions(baseTx, expandedRows=null){
  if(!baseTx) return [];
  const canonical = canonicalRecurringSeries(baseTx) || baseTx;
  const lineageIds = recurringSeriesLineageIds(canonical);
  const today = todayISO();
  const horizon = canonical.recurrenceUntil && canonical.recurrenceUntil > today
    ? canonical.recurrenceUntil
    : toISO(addMonths(parseDate(today), 12));
  const sourceRows = Array.isArray(expandedRows) ? expandedRows : expandedTransactions(horizon);
  const linked = sourceRows.filter(tx => {
    const sourceId = tx.originalId || tx.recurringSourceId || tx.recurrenceSourceId || tx.id;
    return lineageIds.has(sourceId) || lineageIds.has(tx.id);
  });
  const extraSaved = data.transactions.filter(tx =>
    !lineageIds.has(tx.id) && lineageIds.has(recurringLinkedSourceId(tx))
  );
  const byKey = new Map();
  [...linked, ...extraSaved].forEach(tx => {
    const key = [tx.originalId || tx.recurringSourceId || tx.id, tx.originalDate || tx.date, tx.date, tx.title, Number(tx.amount || 0).toFixed(2), tx.status].join("|");
    if(!byKey.has(key)) byKey.set(key, tx);
  });
  return [...byKey.values()].sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")));
}

function billDisplayedNextDate(baseTx, fallbackDate="", expandedRows=null){
  if(!baseTx) return fallbackDate || "";
  const today = todayISO();
  const nextLinked = billLinkedTransactions(baseTx, expandedRows).find(row =>
    row.status !== "cleared" && String(row.date || "") >= today
  );
  return nextLinked?.date || fallbackDate || billOccurrenceInfo(baseTx).date || baseTx.date || "";
}

// Resolve the occurrence that the bill-series editor should start from. Series
// edits apply to the earliest uncleared occurrence and everything after it;
// cleared history remains materialized and unchanged.
function billSeriesEditOccurrence(baseTx){
  const canonical = canonicalRecurringSeries(baseTx) || baseTx;
  if(!canonical) return {generated:true, occurrenceOriginalDate:"", occurrenceDate:""};
  const nextUncleared = billLinkedTransactions(canonical).find(row =>
    row.status !== "cleared" && !!String(row.date || "")
  );
  if(nextUncleared){
    const sourceId = recurringLinkedSourceId(nextUncleared);
    return {
      generated: !!nextUncleared.generated || !!nextUncleared.originalId || sourceId === canonical.id || nextUncleared.id !== canonical.id,
      occurrenceOriginalDate: nextUncleared.originalDate || nextUncleared.overrideFrom || nextUncleared.date,
      occurrenceDate: nextUncleared.date
    };
  }
  const info = billOccurrenceInfo(canonical);
  return {
    generated:true,
    occurrenceOriginalDate: info.originalDate || canonical.date,
    occurrenceDate: info.date || canonical.date
  };
}

function billTransactionRowHTML(tx){
  const account = accountById(tx.accountId);
  const cat = categoryById(tx.categoryId);
  const editId = tx.originalId || tx.recurringSourceId || tx.id;
  const originalDate = tx.originalDate || tx.date;
  const generated = !!tx.generated || editId !== tx.id;
  const sign = (tx.type === "income" || tx.type === "paycheck") ? "+" : "-";
  return `<button type="button" class="bill-detail-row" onclick="document.getElementById('billDetailModal').close();openTransaction('${editId}',{generated:${generated},occurrenceOriginalDate:'${originalDate}',occurrenceDate:'${tx.date}'})">
    <span class="bill-detail-row-main"><b>${escapeAttr(tx.title || "Untitled")}</b><small>${tx.date} • ${account?.name || billAccountLabel(tx) || "Unknown account"} • ${cat?.emoji || ""} ${cat?.name || "Unassigned"}</small></span>
    <span class="bill-detail-row-side"><strong>${sign}${money(tx.amount)}</strong><small class="status-pill ${tx.status === "cleared" ? "cleared" : "planned"}">${tx.status === "cleared" ? "✓ Cleared" : "○ Planned"}</small></span>
  </button>`;
}

function openBillSeriesEditor(txId){
  const selected = data.transactions.find(t=>t.id === txId);
  const tx = canonicalRecurringSeries(selected) || selected;
  if(!tx || !isRecurring(tx)) return;
  const editOccurrence = billSeriesEditOccurrence(tx);
  billSeriesEditId = tx.id;
  document.getElementById("billDetailModal")?.close();
  openTransaction(tx.id, editOccurrence);
}

function openBillDetails(txId){
  const selected = data.transactions.find(t=>t.id === txId);
  const tx = canonicalRecurringSeries(selected) || selected;
  if(!tx) return;
  const modal = document.getElementById("billDetailModal");
  const title = document.getElementById("billDetailTitle");
  const sub = document.getElementById("billDetailSub");
  const summary = document.getElementById("billDetailSummary");
  const list = document.getElementById("billDetailTransactions");
  const editBtn = document.getElementById("editBillSeriesBtn");
  const manageBtn = document.getElementById("billArchiveSeriesBtn");
  const deleteBtn = document.getElementById("deleteBillSeriesBtn");
  const rows = billLinkedTransactions(tx);
  const cleared = rows.filter(row=>row.status === "cleared");
  const planned = rows.filter(row=>row.status !== "cleared");
  const info = billOccurrenceInfo(tx);
  const nextLinked = planned.find(row=>String(row.date || "") >= todayISO()) || null;
  const displayedNextDate = nextLinked?.date || info.date;
  title.textContent = `${categoryById(tx.categoryId).emoji} ${tx.title}`;
  sub.textContent = `${recurrenceDescription(tx)} • ${tx.billArchived ? "Archived" : (info.status === "ended" ? "Ended" : `Next ${displayedNextDate}`)}`;
  summary.innerHTML = `<div class="bill-detail-stat"><span>Cleared history</span><strong>${cleared.length}</strong></div><div class="bill-detail-stat"><span>Upcoming / planned</span><strong>${planned.length}</strong></div><div class="bill-detail-stat"><span>Typical amount</span><strong>${money(tx.amount)}</strong></div>`;
  list.innerHTML = rows.length
    ? `<div class="bill-detail-list-head"><h4>Transactions associated with this bill</h4><span>${rows.length} shown</span></div><div class="bill-detail-list">${rows.map(billTransactionRowHTML).join("")}</div><p class="hint bill-detail-horizon">Includes saved history and generated occurrences through the next 12 months.</p>`
    : `<div class="empty">No linked transactions were found for this bill.</div>`;
  editBtn.textContent = tx.billArchived ? "Restore before editing" : "Edit series";
  editBtn.disabled = !!tx.billArchived;
  editBtn.onclick = ()=>openBillSeriesEditor(tx.id);
  if(manageBtn){
    const inactive = tx.billArchived || info.status === "ended";
    manageBtn.textContent = tx.billArchived ? "Restore series" : (info.status === "ended" ? "Reactivate series" : "Archive series");
    manageBtn.onclick = ()=>{
      const changed = inactive ? restoreArchivedBill(tx.id) : archiveRecurringBill(tx.id);
      if(changed) modal.close();
    };
  }
  if(deleteBtn){
    deleteBtn.onclick = ()=>{
      if(!confirm(`Delete the entire ${tx.title} recurring series? Cleared history will stay as normal transactions, while the repeating rule and every uncleared occurrence will be removed.`)) return;
      deleteBillSeriesKeepClearedHistory(tx);
      modal.close();
      saveData();
    };
  }
  modal.showModal();
}
window.openBillDetails = openBillDetails;
window.openBillSeriesEditor = openBillSeriesEditor;

function billCardHTML(tx, archivedSection=false){
  const cat = categoryById(tx.categoryId);
  const account = billAccountLabel(tx);
  const route = tx.type === "transfer" ? transactionTransferLabel(tx) : `${account}${tx.linkedDebtId ? ` → ${debtById(tx.linkedDebtId)?.name || "debt"}` : ""}`;
  const displayDate = tx.nextDate || tx.billInfo?.date || billOccurrenceInfo(tx).date || tx.date || "—";
  const dateLabel = archivedSection
    ? (tx.billArchivedAt ? `Archived ${tx.billArchivedAt}` : `Ended ${displayDate}`)
    : `Next ${displayDate}`;
  return `<div class="bill-card ${archivedSection ? "bill-card-archived" : ""}" style="--bill-category:${escapeAttr(cat.color)}" data-tx="${tx.id}" data-original-date="${tx.billInfo?.originalDate || displayDate}" data-occurrence-date="${displayDate}" onclick="openBillDetails('${tx.id}')">
    <div class="bill-card-main">
      <div class="row-title">${cat.emoji} ${tx.title}</div>
      <div class="row-sub">${route} • ${cat.name}</div>
    </div>
    <div class="bill-card-schedule">
      <b>${dateLabel}</b>
      <span>${recurrenceDescription(tx)}</span>
    </div>
    <div class="bill-card-status">${billStatusBadge(tx)}</div>
    <div class="amount bill-amount ${(tx.type==='income'||tx.type==='paycheck')?'good':'bad'}">${(tx.type==='income'||tx.type==='paycheck')?'+':'-'}${money(tx.amount)}</div>
    <span class="bill-row-chevron" aria-hidden="true">›</span>
  </div>`;
}

function renderBills(){
  const list = document.getElementById("billsList");
  try{
    renderBillFilters();

    const sharedExpandedBillRows = expandedTransactions(toISO(addMonths(parseDate(todayISO()), 12)));
    let recurring = data.transactions
      .filter(tx => {
        try{ return isRecurring(tx); } catch(err){ return false; }
      })
      .filter(tx => !(data.transactions || []).some(nextTx => recurringSeriesIsSplitPredecessor(tx, nextTx)))
      .filter(tx => {
        try{ return billMatchesFilters(tx); } catch(err){ return false; }
      })
      .map(tx => {
        const info = billOccurrenceInfo(tx);
        const nextDate = (!tx.billArchived && info.status !== "ended")
          ? billDisplayedNextDate(tx, info.date, sharedExpandedBillRows)
          : info.date;
        return {...tx, nextDate, billInfo:{...info, date:nextDate}};
      })
      .filter(tx => tx.nextDate);

    recurring = dedupeRecurringBillRows(recurring);

    const sortBills = rows => rows.sort((a,b)=>{
      if((billFilters.sort || "date") === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0);
      if((billFilters.sort || "date") === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0);
      if((billFilters.sort || "date") === "category") return categoryById(a.categoryId).name.localeCompare(categoryById(b.categoryId).name);
      if((billFilters.sort || "date") === "account") return billAccountLabel(a).localeCompare(billAccountLabel(b));
      return String(a.nextDate || "").localeCompare(String(b.nextDate || ""));
    });

    const archived = sortBills(recurring.filter(tx => tx.billArchived || billOccurrenceStatus(tx) === "ended"));
    const active = sortBills(recurring.filter(tx => !tx.billArchived && billOccurrenceStatus(tx) !== "ended"));

    if(!list) return;
    if(!active.length && !archived.length){
      list.innerHTML = `<div class="empty">No recurring transactions match those filters.</div>`;
      return;
    }

    const activeHTML = active.length
      ? `<div class="bill-list-summary"><span><b>${active.length}</b> active recurring item${active.length===1?"":"s"}</span><small>Tap a row for history and series actions.</small></div><div class="bill-active-list">${active.map(tx=>billCardHTML(tx,false)).join("")}</div>`
      : `<div class="empty compact">No active recurring bills match these filters.</div>`;
    const archivedHTML = archived.length
      ? `<details class="archived-bills-section"><summary><span>Ended / Archived bills</span><span class="pill">${archived.length}</span></summary><div class="archived-bills-list">${archived.map(tx=>billCardHTML(tx,true)).join("")}</div></details>`
      : "";

    list.innerHTML = activeHTML + archivedHTML;
    attachTransactionContextMenus();
  } catch(err){
    console.error("Bills page crashed while rendering:", err);
    if(list) list.innerHTML = `<div class="empty"><b>Bills could not load.</b><br>${err.message || err}</div>`;
  }
}

function buildRecurrenceFromForm(){
  const type = txRepeatRule.value;
  if(type === "none") return { type:"none", interval:1, weekendHandling: txWeekendHandling?.value || "none" };
  const interval = Math.max(1, Number(txRepeatInterval.value || 1));
  const base = { type, interval, weekendHandling: txWeekendHandling?.value || "none" };
  if(type === "weekly") base.weekday = Number(txRepeatWeekday.value);
  if(type === "nth-weekday"){
    base.weekday = Number(txRepeatWeekday.value);
    base.ordinal = Number(txRepeatOrdinal.value);
  }
  return base;
}

function setRecurrenceForm(recurrence, dateISO){
  const r = recurrence || { type:"none", interval:1 };
  txRepeatRule.value = r.type || "none";
  if(document.getElementById("txWeekendHandling")) txWeekendHandling.value = r.weekendHandling || "none";
  txRepeatInterval.value = r.interval || (r.type === "biweekly" ? 2 : 1);
  const dateWeekday = parseDate(dateISO).getDay();
  txRepeatWeekday.value = String(r.weekday ?? dateWeekday);
  txRepeatOrdinal.value = String(r.ordinal ?? 1);
  updateRecurrenceUI();
}

function updateRecurrenceUI(){
  const type = txRepeatRule.value;
  if(document.getElementById("txWeekendHandling")) txWeekendHandling.closest("label").style.display = type === "none" ? "none" : "grid";
  recurrenceDetails.classList.toggle("active", type !== "none" && type !== "biweekly" && type !== "monthly" && type !== "last-day-month" && type !== "yearly");

  if(type === "weekly"){
    repeatIntervalUnitLabel.style.display = "grid";
    txRepeatInterval.closest("label").style.display = "grid";
    txRepeatWeekday.closest("label").style.display = "grid";
    txRepeatOrdinal.closest("label").style.display = "none";
    txRepeatIntervalUnit.value = "week(s)";
  } else if(type === "every-x-days"){
    repeatIntervalUnitLabel.style.display = "grid";
    txRepeatInterval.closest("label").style.display = "grid";
    txRepeatWeekday.closest("label").style.display = "none";
    txRepeatOrdinal.closest("label").style.display = "none";
    txRepeatIntervalUnit.value = "day(s)";
  } else if(type === "nth-weekday"){
    repeatIntervalUnitLabel.style.display = "grid";
    txRepeatInterval.closest("label").style.display = "grid";
    txRepeatWeekday.closest("label").style.display = "grid";
    txRepeatOrdinal.closest("label").style.display = "grid";
    txRepeatIntervalUnit.value = "month(s)";
  }
  const repeatSummary=document.getElementById("txRepeatSummary");
  if(repeatSummary){
    const labels={none:"Does not repeat",weekly:"Weekly",biweekly:"Every 2 weeks",monthly:"Monthly","last-day-month":"Last day monthly",yearly:"Yearly","every-x-days":`Every ${Math.max(1,Number(txRepeatInterval.value||1))} days`,"nth-weekday":"Monthly pattern"};
    repeatSummary.textContent=labels[type] || "Custom repeat";
  }

}


window.openTransferFromAccount = (fromAccountId)=>{
  openTransaction(null, {
    accountId: fromAccountId,
    type: "transfer",
    categoryId: "banking"
  });
};

function openDayModal(dayISO){
  selectedDayISO = dayISO;
  const modal = document.getElementById("dayModal");
  const dayTitle = document.getElementById("dayModalTitle");
  const daySub = document.getElementById("dayModalSub");
  const list = document.getElementById("dayModalTransactions");

  const checkingAccountIds = data.accounts
    .filter(a => a.name.toLowerCase().includes("checking") && !a.name.toLowerCase().includes("savings"))
    .map(a => a.id);

  const rawDayTx = expandedTransactions(dayISO).filter(tx => {
    const accountMatches = calendarFilter === "all"
      ? (checkingAccountIds.includes(tx.accountId) || checkingAccountIds.includes(tx.transferToAccountId))
      : (tx.accountId === calendarFilter || tx.transferToAccountId === calendarFilter);
    return tx.date === dayISO && accountMatches;
  });
  const dayTx = calendarDisplayEntries(rawDayTx);

  const viewName = calendarFilter === "all" ? "All checking accounts" : accountById(calendarFilter)?.name || "Selected account";
  dayTitle.textContent = new Date(dayISO + "T12:00:00").toLocaleDateString(undefined, {weekday:"long", month:"long", day:"numeric", year:"numeric"});
  daySub.textContent = `${viewName} • ${dayTx.length} transaction${dayTx.length === 1 ? "" : "s"}`;

  list.innerHTML = dayTx.length ? dayTx.map(tx => {
    const cat = categoryById(tx.categoryId);
    const acctText = tx.calendarAccountId ? accountById(tx.calendarAccountId)?.name || transactionAccountText(tx) : transactionAccountText(tx);
    const isPositive = calendarEntryIsPositive(tx);
    return `<div class="day-modal-row" data-tx="${tx.originalId || tx.id}" data-generated="${!!tx.generated}" data-original-date="${tx.originalDate || tx.date}" data-occurrence-date="${tx.date}" onclick="closeDayModalNow(); openTransaction('${tx.originalId || tx.id}',{generated:${!!tx.generated}, occurrenceOriginalDate:'${tx.originalDate || tx.date}', occurrenceDate:'${tx.date}'});">
      <div class="day-modal-main">
        <div class="row-title">${cat.emoji} ${calendarEntryLabel(tx)}</div>
        <div class="row-sub">${acctText} • ${cat.name} • ${tx.status}</div>
      </div>
      <div class="amount ${isPositive?'good':'bad'}">${isPositive?'+':'-'}${money(tx.amount)}</div>
    </div>`;
  }).join("") : `<div class="empty">No transactions for this day in this calendar view.</div>`;

  modal.showModal();
  attachTransactionContextMenus();
}

window.closeDayModalNow = function(){
  var modal = document.getElementById("dayModal");
  if(modal) modal.close();
};


setupContextMenuEvents();
document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{ if(btn.dataset.view) setView(btn.dataset.view); }));
const mobileMoreNavBtn=document.getElementById("mobileMoreNavBtn");
if(mobileMoreNavBtn) mobileMoreNavBtn.addEventListener("click",openMobileMore);
const closeMobileMoreBtn=document.getElementById("closeMobileMoreBtn");
if(closeMobileMoreBtn) closeMobileMoreBtn.addEventListener("click",closeMobileMore);
prevMonth.onclick = ()=>{ calendarDate = addMonths(calendarDate,-1); renderCalendar(); };
nextMonth.onclick = ()=>{ calendarDate = addMonths(calendarDate,1); renderCalendar(); };
function scrollCalendarToToday(){
  const todayEl = document.querySelector(`#calendarGrid .day[data-day="${todayISO()}"]`);
  if(todayEl) todayEl.scrollIntoView({behavior:"smooth", block:"center"});
}
function scrollCalendarToTodaySoon(){
  setTimeout(scrollCalendarToToday, 60);
  setTimeout(scrollCalendarToToday, 180);
}
todayBtn.onclick = ()=>{ calendarDate = new Date(); renderCalendar(); scrollCalendarToTodaySoon(); };
if(document.getElementById("calendarAccountFilter")) calendarAccountFilter.onchange = e=>{ calendarFilter = e.target.value; saveUiPrefs(); renderCalendar(); };
const calendarCategoryHighlightBtnEl = document.getElementById("calendarCategoryHighlightBtn");
if(calendarCategoryHighlightBtnEl) calendarCategoryHighlightBtnEl.onclick = (e)=>{
  e.stopPropagation();
  document.getElementById("calendarCategoryHighlightDropdown")?.classList.toggle("open");
};
document.addEventListener("click", (e)=>{
  const dropdown = document.getElementById("calendarCategoryHighlightDropdown");
  if(dropdown && !dropdown.contains(e.target)) dropdown.classList.remove("open");
});
if(document.getElementById("calendarCategoryHighlight")) calendarCategoryHighlight.onchange = e=>{
  const selected = [...e.target.selectedOptions].map(o=>o.value);
  calendarHighlightCategories = selected.includes("all") || !selected.length ? ["all"] : selected.filter(v=>v !== "all");
  saveUiPrefs();
  renderCalendar();
};
txRepeatRule.onchange = updateRecurrenceUI;
txType.onchange = updateTransactionFormUI;
if(document.getElementById("billAccountFilter")) if(document.getElementById("billAccountFilter")) billAccountFilter.onchange = e=>{ billFilters.account = e.target.value; saveUiPrefs(); renderBills(); };
const billCategoryDropdownBtnEl = document.getElementById("billCategoryDropdownBtn");
if(billCategoryDropdownBtnEl) billCategoryDropdownBtnEl.onclick = (e)=>{
  e.stopPropagation();
  document.getElementById("billCategoryDropdown")?.classList.toggle("open");
};
document.addEventListener("click", (e)=>{
  const dropdown = document.getElementById("billCategoryDropdown");
  if(dropdown && !dropdown.contains(e.target)) dropdown.classList.remove("open");
});
if(document.getElementById("billTypeFilter")) if(document.getElementById("billTypeFilter")) billTypeFilter.onchange = e=>{ billFilters.type = e.target.value; saveUiPrefs(); renderBills(); };
if(document.getElementById("billRecurrenceFilter")) if(document.getElementById("billRecurrenceFilter")) billRecurrenceFilter.onchange = e=>{ billFilters.recurrence = e.target.value; saveUiPrefs(); renderBills(); };
if(document.getElementById("billSort")) if(document.getElementById("billSort")) billSort.onchange = e=>{ billFilters.sort = e.target.value; saveUiPrefs(); renderBills(); };

addDayTransactionBtn.onclick = ()=>{
  const defaults = { date: selectedDayISO };
  if(calendarFilter !== "all") defaults.accountId = calendarFilter;
  document.getElementById('dayModal').close();
  openTransaction(null, defaults);
};

if(document.getElementById("settingsSampleResetBtn")) settingsSampleResetBtn.onclick = ()=>{ if(confirm("Reset to sample data? This replaces your current local Money Nest data.")){ localStorage.removeItem("moneyNest.v1"); localStorage.removeItem("moneyNest.v2"); localStorage.removeItem("moneyNest.v2.7.imported"); localStorage.removeItem("moneyNest.v2.10.fixed"); localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData)); localStorage.removeItem(UI_PREFS_KEY); data = loadData(); setView("dashboard"); } };

document.getElementById("closeDayModal").onclick = function(){ document.getElementById("dayModal").close(); };
document.getElementById("cancelDayModal").onclick = function(){ document.getElementById("dayModal").close(); };
document.getElementById("dayModal").addEventListener("click", (e)=>{
  if(e.target.id === "dayModal") document.getElementById("dayModal").close();
});
document.getElementById("addDayTransactionBtn").onclick = ()=>{
  const defaults = { date: selectedDayISO };
  if(calendarFilter !== "all") defaults.accountId = calendarFilter;
  document.getElementById('dayModal').close();
  openTransaction(null, defaults);
};


function csvEscape(value){
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replaceAll('"','""')}"`;
}
function makeCSV(rows, headers){
  return headers.join(",") + "\n" + rows.map(row => headers.map(h=>csvEscape(row[h])).join(",")).join("\n");
}
function parseCSV(text){
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for(let i=0; i<text.length; i++){
    const char = text[i];
    const next = text[i+1];

    if(quoted){
      if(char === '"' && next === '"'){
        value += '"';
        i++;
      } else if(char === '"'){
        quoted = false;
      } else {
        value += char;
      }
    } else {
      if(char === '"'){
        quoted = true;
      } else if(char === ","){
        row.push(value);
        value = "";
      } else if(char === "\n"){
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if(char !== "\r"){
        value += char;
      }
    }
  }
  row.push(value);
  rows.push(row);

  const headers = rows.shift().map(h=>h.trim());
  return rows
    .filter(r => r.some(cell => String(cell).trim() !== ""))
    .map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ""])));
}
function downloadText(filename, text, type="text/plain"){
  const blob = new Blob([text], {type});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportReportEscape(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch] || ch));
}
function exportReportMoney(value){ return exportReportEscape(money(Number(value || 0))); }
function exportReportDate(value){ return value ? exportReportEscape(value) : "—"; }
function exportReportRow(cells){
  return `<tr>${cells.map(cell=>`<td>${cell}</td>`).join("")}</tr>`;
}
function exportReportTable(headers, rows, emptyText="No items."){
  if(!rows.length) return `<p class="empty">${exportReportEscape(emptyText)}</p>`;
  return `<table><thead><tr>${headers.map(h=>`<th>${exportReportEscape(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}
function transactionReportAmount(tx, perspective="cash"){
  const amount = Number(tx.amount || 0);
  if(perspective === "debt"){
    if(tx.linkedDebtId && tx.type === "transfer") return money(amount);
    if(tx.debtAccountId && tx.type === "expense") return "-" + money(amount);
  }
  if(tx.type === "income" || tx.type === "paycheck") return "+" + money(amount);
  return "-" + money(amount);
}
function transactionReportAccount(tx){
  const from = tx.accountId ? accountById(tx.accountId)?.name : tx.debtAccountId ? debtById(tx.debtAccountId)?.name : "No account";
  const to = tx.transferToAccountId ? accountById(tx.transferToAccountId)?.name : tx.linkedDebtId ? debtById(tx.linkedDebtId)?.name : "";
  return to ? `${from || "Account"} → ${to}` : (from || "No account");
}
function financialPictureData(options={}){
  const horizonDays = Number(options.horizonDays || 90);
  const dueDays = Number(options.dueDays || Math.min(Math.max(horizonDays, 45), 365));
  const statementDays = Number(options.statementDays || Math.min(Math.max(horizonDays, 14), 365));
  const rowLimit = Number(options.rowLimit || (horizonDays > 120 ? 1200 : 300));
  const today = todayISO();
  const next30 = toISO(addDays(parseDate(today), 30));
  const horizonDate = toISO(addDays(parseDate(today), horizonDays));
  const cashAccounts = [...(data.accounts || [])].sort((a,b)=>String(a.owner || "").localeCompare(String(b.owner || "")) || String(a.name || "").localeCompare(String(b.name || "")));
  const debts = orderedDebts(data.debts || []);
  const recurringBills = (data.transactions || [])
    .filter(tx => isRecurring(tx))
    .map(tx => {
        const info = billOccurrenceInfo(tx);
        return {...tx, nextDate: info.date, billInfo: info};
      })
    .filter(tx => tx.nextDate)
    .sort((a,b)=>String(a.nextDate || "").localeCompare(String(b.nextDate || "")) || String(a.title || "").localeCompare(String(b.title || "")));
  const upcomingTransactions = expandedTransactions(horizonDate)
    .filter(tx => tx.date >= today && tx.date <= horizonDate)
    .filter(tx => tx.status !== "cleared")
    .sort((a,b)=>String(a.date || "").localeCompare(String(b.date || "")) || String(a.title || "").localeCompare(String(b.title || "")));
  const plannedByCategory = upcomingTransactions.reduce((map, tx)=>{
    const key = tx.categoryId || "unassigned";
    if(!map[key]) map[key] = {category: categoryById(key), inflow:0, outflow:0, count:0};
    const amount = Number(tx.amount || 0);
    if(tx.type === "income" || tx.type === "paycheck") map[key].inflow += amount;
    else map[key].outflow += amount;
    map[key].count += 1;
    return map;
  }, {});
  const debtDue = debtPaymentsDueSoon(dueDays);
  const statements = creditCardStatementsToCheck(statementDays);
  return {today, next30, horizonDate, horizonDays, dueDays, statementDays, rowLimit, cashAccounts, debts, recurringBills, upcomingTransactions, plannedByCategory:Object.values(plannedByCategory), debtDue, statements};
}
function buildFinancialPictureHTML(options={}){
  const pic = financialPictureData(options);
  const currentCashTotal = pic.cashAccounts.reduce((sum,a)=>sum + accountBalance(a.id, false, pic.today), 0);
  const projectedCashTotal = pic.cashAccounts.reduce((sum,a)=>sum + accountBalance(a.id, true, pic.next30), 0);
  const projectedHorizonCashTotal = pic.cashAccounts.reduce((sum,a)=>sum + accountBalance(a.id, true, pic.horizonDate), 0);
  const debtTotal = pic.debts.reduce((sum,d)=>sum + debtAmountLeftNow(d), 0);
  const safeSpendTotal = pic.cashAccounts.reduce((sum,a)=>{
    const safe = safeToSpend(a);
    return sum + (safe.amount === null ? 0 : Number(safe.amount || 0));
  }, 0);

  const accountRows = pic.cashAccounts.map(a=>{
    const safe = safeToSpend(a);
    return exportReportRow([
      exportReportEscape(`${a.emoji || ""} ${a.name || "Account"}`),
      exportReportEscape(a.owner || "—"),
      exportReportMoney(accountBalance(a.id, false, pic.today)),
      exportReportMoney(accountBalance(a.id, true, pic.next30)),
      safe.amount === null ? exportReportEscape(safe.label) : `${exportReportMoney(safe.amount)}<br><span>${exportReportEscape(safe.label)}</span>`,
      exportReportEscape(a.notes || "")
    ]);
  });

  const debtRows = pic.debts.map(d=>{
    const payoff = debtEstimatedPayoff(d);
    return exportReportRow([
      exportReportEscape(`${d.emoji || ""} ${d.name || "Debt"}`),
      exportReportEscape(d.type || "—"),
      exportReportEscape(d.owner || "—"),
      exportReportMoney(debtAmountLeftNow(d)),
      exportReportEscape(debtMonthlyPaymentText(d)),
      exportReportDate(nextDebtDueDate(d)),
      exportReportEscape(debtPaymentStatusLabel(debtDisplayPaymentStatus(d))),
      `${exportReportEscape(payoff.value)}<br><span>${exportReportEscape(payoff.sub || "")}</span>`
    ]);
  });

  const billRows = pic.recurringBills.map(tx=>exportReportRow([
    exportReportDate(tx.nextDate),
    exportReportEscape(tx.title || "Untitled"),
    exportReportEscape(transactionReportAccount(tx)),
    exportReportEscape(categoryById(tx.categoryId).name),
    exportReportEscape(tx.type || "—"),
    exportReportEscape(recurrenceDescription(tx)),
    exportReportEscape(billOccurrenceStatus(tx)),
    exportReportEscape(transactionReportAmount(tx))
  ]));

  const upcomingRows = pic.upcomingTransactions.slice(0,pic.rowLimit).map(tx=>exportReportRow([
    exportReportDate(tx.date),
    exportReportEscape(tx.title || "Untitled"),
    exportReportEscape(transactionReportAccount(tx)),
    exportReportEscape(categoryById(tx.categoryId).name),
    exportReportEscape(tx.type || "—"),
    exportReportEscape(tx.status || "planned"),
    exportReportEscape(transactionReportAmount(tx)),
    exportReportEscape(tx.notes || "")
  ]));

  const categoryRows = pic.plannedByCategory
    .sort((a,b)=>Number(b.outflow || 0) - Number(a.outflow || 0))
    .map(item=>exportReportRow([
      exportReportEscape(`${item.category.emoji || ""} ${item.category.name || "Unassigned"}`),
      exportReportMoney(item.outflow),
      exportReportMoney(item.inflow),
      exportReportEscape(item.count)
    ]));

  const dueRows = pic.debtDue.map(d=>exportReportRow([
    exportReportDate(d.nextDue),
    exportReportEscape(`${d.emoji || ""} ${d.name || "Debt"}`),
    exportReportEscape(d.type || "—"),
    exportReportEscape(debtMinimumDueText(d)),
    exportReportEscape(debtPaymentStatusLabel(debtDisplayPaymentStatus(d))),
    hasPlannedDebtPayment(d, d.nextDue) ? "Yes" : "No"
  ]));

  const statementRows = pic.statements.map(d=>exportReportRow([
    exportReportDate(d.nextStatementDate),
    exportReportEscape(`${d.emoji || ""} ${d.name || "Card"}`),
    exportReportDate(d.statementDate),
    exportReportMoney(d.statementBalance || 0),
    exportReportMoney(debtAmountLeftNow(d))
  ]));

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Money Nest Financial Picture ${pic.today}</title>
<style>
  :root{--ink:#1f2428;--muted:#6f6256;--line:#decab4;--soft:#fff8ef;--card:#fffdf9;--accent:#9b7650;}
  body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f4eadc;color:var(--ink);line-height:1.35;}
  .wrap{max-width:1180px;margin:0 auto;padding:28px;}
  h1{font-size:34px;margin:0 0 4px;} h2{font-size:22px;margin:28px 0 10px;} p{margin:0 0 12px;color:var(--muted);} 
  .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0 26px;}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 8px 24px rgba(58,43,25,.05);} .stat .label{font-size:12px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;color:var(--muted);} .stat .value{font-size:24px;font-weight:900;margin-top:8px;}
  section{background:rgba(255,253,249,.72);border:1px solid var(--line);border-radius:22px;padding:18px;margin:16px 0;overflow:auto;}
  table{border-collapse:collapse;width:100%;font-size:13px;background:var(--card);border-radius:14px;overflow:hidden;} th,td{border-bottom:1px solid #ead9c8;padding:10px;text-align:left;vertical-align:top;} th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#fbf1e5;} td span{color:var(--muted);font-size:12px;} tr:last-child td{border-bottom:0;} .empty{padding:10px 0;color:var(--muted);} .note{font-size:12px;color:var(--muted);margin-top:10px;}
</style></head>
<body><div class="wrap">
  <h1>Money Nest Financial Picture</h1>
  <p>Generated ${exportReportEscape(new Date().toLocaleString())}. This is a readable snapshot/export, not a restore backup.</p>
  <div class="summary">
    <div class="stat"><div class="label">Cash today</div><div class="value">${exportReportMoney(currentCashTotal)}</div></div>
    <div class="stat"><div class="label">Cash projected 30 days</div><div class="value">${exportReportMoney(projectedCashTotal)}</div></div>
    <div class="stat"><div class="label">Cash projected ${pic.horizonDays} days</div><div class="value">${exportReportMoney(projectedHorizonCashTotal)}</div></div>
    <div class="stat"><div class="label">Total debt</div><div class="value">${exportReportMoney(debtTotal)}</div></div>
    <div class="stat"><div class="label">Safe to spend total</div><div class="value">${exportReportMoney(safeSpendTotal)}</div></div>
  </div>
  <section><h2>Accounts</h2>${exportReportTable(["Account","Owner","Cleared balance","Projected 30 days","Safe to spend","Notes"], accountRows)}</section>
  <section><h2>Debts</h2>${exportReportTable(["Debt","Type","Owner","Current balance","Monthly/payment","Next due","Status","Estimated payoff"], debtRows)}</section>
  <section><h2>Debt payments due soon</h2><p>Next ${pic.dueDays} days.</p>${exportReportTable(["Due","Debt","Type","Amount","Status","Payment planned"], dueRows)}</section>
  <section><h2>Credit card statements to check</h2><p>Past due or expected in the next ${pic.statementDays} days.</p>${exportReportTable(["Expected","Card","Previous statement","Statement balance","Current balance"], statementRows, "No credit card statements need checking soon.")}</section>
  <section><h2>Recurring bills and planned recurring transactions</h2>${exportReportTable(["Next date","Title","Account / route","Category","Type","Repeats","Status","Amount"], billRows)}</section>
  <section><h2>Upcoming planned transactions</h2><p>Next ${pic.horizonDays} days. Limited to first ${pic.rowLimit} rows to keep the report readable.</p>${exportReportTable(["Date","Title","Account / route","Category","Type","Status","Amount","Notes"], upcomingRows)}</section>
  <section><h2>Upcoming planned cashflow by category</h2><p>Next ${pic.horizonDays} days, based on planned/un-cleared transactions.</p>${exportReportTable(["Category","Planned outflow","Planned inflow","Count"], categoryRows)}</section>
  <p class="note">Privacy note: this report is human-readable and may contain sensitive financial details. Keep it wherever you would keep a detailed budget spreadsheet.</p>
</div></body></html>`;
}
function exportFinancialPicture(){
  const html = buildFinancialPictureHTML({horizonDays:90, dueDays:45, statementDays:14, rowLimit:300});
  downloadText(`money-nest-financial-picture-${todayISO()}.html`, html, "text/html");
  alert("Exported a readable financial picture report. Keep it private like a detailed budget spreadsheet.");
}
function exportExtendedFinancialPicture(){
  const html = buildFinancialPictureHTML({horizonDays:365, dueDays:365, statementDays:365, rowLimit:1200});
  downloadText(`money-nest-financial-picture-12-months-${todayISO()}.html`, html, "text/html");
  alert("Exported a readable 12-month financial picture report. Keep it private like a detailed budget spreadsheet.");
}
function exportEditableCSVs(){
  const dateStamp = todayISO();

  const categoryHeaders = ["id","name","emoji","color","paletteRole","customColorOverride","customColor","legacyColor"];
  const categoryRows = data.categories.map(c=>({id:c.id,name:c.name,emoji:c.emoji||"",color:effectiveCategoryColor(c),paletteRole:c.paletteRole||"",customColorOverride:!!c.customColorOverride,customColor:c.customColor||"",legacyColor:c.legacyColor||c.color||""}));

  const accountHeaders = ["id","order","name","emoji","color","owner","startingBalance","goalName","goalAmount","paycheckAccount"];
  const accountRows = orderedAccounts().map(a=>({
    id:a.id, order:a.order ?? "", name:a.name, emoji:a.emoji || "", color:a.color || "", owner:a.owner,
    startingBalance:a.startingBalance ?? 0, goalName:a.goalName || "", goalAmount:a.goalAmount ?? 0, paycheckAccount:!!a.paycheckAccount
  }));

  const debtHeaders = ["id","order","type","company","name","emoji","color","owner","startingBalance","balance","trackingStartDate","limit","apr","statementDate","dueDate","statementBalance","minDue","manualExtra","totalMonthlyPayment","loanForecastBreakdownMode","loanFeeTiming","loanEstPrincipalPct","loanEstInterestPct","loanEstFeePct","loanForecastHistoryJSON","monthsToPayoffStarting","monthsToPayoffCurrent","payoffDate","paymentStatus","frozenLocked","notes"];
  const debtRows = orderedDebts().map(d=>({
    id:d.id, order:d.order ?? "", type:d.type, company:d.company, name:d.name, emoji:d.emoji || "", color:d.color || "", owner:d.owner,
    startingBalance:d.startingBalance ?? "", balance:d.balance ?? 0, trackingStartDate:d.trackingStartDate || "", limit:d.limit ?? "", apr:d.apr ?? 0,
    statementDate:d.statementDate || "", dueDate:d.dueDate || "", statementBalance:d.statementBalance ?? "",
    minDue:d.minDue ?? "", manualExtra:d.manualExtra ?? "", totalMonthlyPayment:d.totalMonthlyPayment ?? "",
    loanForecastBreakdownMode:d.loanForecastBreakdownMode || "auto", loanFeeTiming:d.loanFeeTiming || "auto",
    loanEstPrincipalPct:d.loanEstPrincipalPct ?? "", loanEstInterestPct:d.loanEstInterestPct ?? "", loanEstFeePct:d.loanEstFeePct ?? "",
    loanForecastHistoryJSON: JSON.stringify(normalizeLoanForecastHistory(d.loanForecastHistory || [])),
    monthsToPayoffStarting:d.monthsToPayoffStarting ?? "", monthsToPayoffCurrent:d.monthsToPayoffCurrent ?? "",
    payoffDate:d.payoffDate || "", paymentStatus:d.paymentStatus || "not-set",
    frozenLocked:!!d.frozenLocked, notes:d.notes || ""
  }));

  const budgetHeaders = ["id","name","emoji","accountScope","accountId","accountIdsJSON","categoryId","categoryIdsJSON","amount","period","notes"];
  const budgetRows = (data.budgets || []).map(b=>({
    id:b.id, name:b.name || "", emoji:b.emoji || "", accountScope:b.accountScope || (b.accountId ? "single" : "all"), accountId:b.accountId || "",
    accountIdsJSON:JSON.stringify(budgetScopeAccountIds(b)), categoryId:budgetCategoryIds(b)[0] || b.categoryId || "", categoryIdsJSON:JSON.stringify(budgetCategoryIds(b)), amount:b.amount ?? "",
    period:b.period || "monthly", notes:b.notes || ""
  }));

  const txHeaders = [
    "id","date","title","amount","type","status","accountId","debtAccountId","categoryId","transferToAccountId","linkedDebtId",
    "pendingReimbursement","reimbursementToAccountId",
    "loanPrincipalAmount","loanInterestAmount","loanFeeAmount","loanBalanceAdjustment",
    "autoPaycheck","autoMakPaycheck","paycheckHoursOverride","autoPaycheckInfoJSON",
    "repeatType","repeatInterval","repeatWeekday","repeatOrdinal","weekendHandling","recurrenceUntil","billArchived","billArchivedAt","billArchivedPreviousRecurrenceUntil","recurringSourceId","recurrenceSourceId","originalDate","wasRecurringOccurrence","dateOverridesJSON","occurrenceOverridesJSON","linkedTransactionIdsJSON","notes"
  ];
  const txRows = data.transactions.map(tx=>({
    id:tx.id, date:tx.date, title:tx.title, amount:tx.amount, type:tx.type, status:tx.status,
    accountId:tx.accountId || "", debtAccountId:tx.debtAccountId || "", categoryId:tx.categoryId || "",
    transferToAccountId:tx.transferToAccountId || "", linkedDebtId:tx.linkedDebtId || "",
    pendingReimbursement:!!tx.pendingReimbursement, reimbursementToAccountId:tx.reimbursementToAccountId || "",
    loanPrincipalAmount:tx.loanPrincipalAmount ?? "", loanInterestAmount:tx.loanInterestAmount ?? "", loanFeeAmount:tx.loanFeeAmount ?? "", loanBalanceAdjustment:tx.loanBalanceAdjustment ?? "",
    autoPaycheck:!!tx.autoPaycheck, autoMakPaycheck:!!tx.autoMakPaycheck, paycheckHoursOverride:tx.paycheckHoursOverride ?? "", autoPaycheckInfoJSON: JSON.stringify(tx.autoPaycheckInfo || {}),
    repeatType:tx.recurrence?.type || "none", repeatInterval:tx.recurrence?.interval || 1,
    repeatWeekday:tx.recurrence?.weekday ?? "", repeatOrdinal:tx.recurrence?.ordinal ?? "",
    weekendHandling:tx.recurrence?.weekendHandling || "none",
    recurrenceUntil: tx.recurrenceUntil || "",
    billArchived: !!tx.billArchived,
    billArchivedAt: tx.billArchivedAt || "",
    billArchivedPreviousRecurrenceUntil: tx.billArchivedPreviousRecurrenceUntil || "",
    recurringSourceId: tx.recurringSourceId || "",
    recurrenceSourceId: tx.recurrenceSourceId || "",
    originalDate: tx.originalDate || "",
    wasRecurringOccurrence: !!tx.wasRecurringOccurrence,
    dateOverridesJSON: JSON.stringify(tx.dateOverrides || {}),
    occurrenceOverridesJSON: JSON.stringify(tx.occurrenceOverrides || {}),
    linkedTransactionIdsJSON: JSON.stringify(tx.linkedTransactionIds || []),
    notes:tx.notes || ""
  }));

  const templateHeaders = [
    "id","title","variantLabel","isDefault","archived","source","createdAt","type","status","categoryId","accountId","debtAccountId","transferToAccountId","linkedDebtId","notes",
    "saveTitle","saveCategory","saveNotes","saveType","saveStatus","saveAccount","saveDebtSpendingAccount","saveTransferToAccount","savePaymentDebt"
  ];
  const templateRows = (data.settings?.transactionTemplates || []).map(raw=>{
    const t = normalizeTransactionTemplate(raw);
    const f = normalizeTemplateFields(t.fields);
    return {
      id:t.id, title:t.title || "", variantLabel:t.variantLabel || "", isDefault:!!t.isDefault, archived:!!t.archived, source:t.source || "legacy", createdAt:t.createdAt || "", type:t.type || "expense", status:t.status || "planned", categoryId:t.categoryId || "unassigned",
      accountId:t.accountId || "", debtAccountId:t.debtAccountId || "",
      transferToAccountId:t.transferToAccountId || "", linkedDebtId:t.linkedDebtId || "",
      notes:t.notes || "",
      saveTitle:!!f.title, saveCategory:!!f.categoryId, saveNotes:!!f.notes, saveType:!!f.type, saveStatus:!!f.status,
      saveAccount:!!f.accountId, saveDebtSpendingAccount:!!f.debtAccountId, saveTransferToAccount:!!f.transferToAccountId, savePaymentDebt:!!f.linkedDebtId
    };
  });

  downloadText(`money-nest-categories-${dateStamp}.csv`, makeCSV(categoryRows, categoryHeaders), "text/csv");
  downloadText(`money-nest-accounts-${dateStamp}.csv`, makeCSV(accountRows, accountHeaders), "text/csv");
  downloadText(`money-nest-debts-${dateStamp}.csv`, makeCSV(debtRows, debtHeaders), "text/csv");
  downloadText(`money-nest-budgets-${dateStamp}.csv`, makeCSV(budgetRows, budgetHeaders), "text/csv");
  downloadText(`money-nest-transactions-${dateStamp}.csv`, makeCSV(txRows, txHeaders), "text/csv");
  downloadText(`money-nest-transaction-templates-${dateStamp}.csv`, makeCSV(templateRows, templateHeaders), "text/csv");
  alert("Exported editable CSVs. JSON is still best for full restore; CSVs are best for batch editing.");
}

function importEditedCSV(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    const rows = parseCSV(reader.result);
    if(!rows.length){ alert("No rows found in CSV."); return; }

    const headers = Object.keys(rows[0]);
    if(headers.includes("name") && headers.includes("emoji") && headers.includes("color") && !headers.includes("owner") && !headers.includes("company")){
      rows.forEach(row=>{
        let c = data.categories.find(x=>x.id === row.id);
        if(!c){
          c = {id:row.id||slug(row.name),name:row.name||"New Category",emoji:row.emoji||"",color:row.color||"#8c6f4d",legacyColor:row.legacyColor||row.color||"#8c6f4d",paletteRole:row.paletteRole||defaultCategoryPaletteRole({id:row.id||slug(row.name)}),customColorOverride:String(row.customColorOverride).toLowerCase()==="true",customColor:row.customColor||""};
          data.categories.push(c);
        } else {
          c.name = row.name || c.name;
          c.emoji = row.emoji || c.emoji;
          c.legacyColor = row.legacyColor || c.legacyColor || row.color || c.color;
          c.paletteRole = row.paletteRole || c.paletteRole || defaultCategoryPaletteRole(c);
          c.customColorOverride = row.customColorOverride === undefined ? !!c.customColorOverride : String(row.customColorOverride).toLowerCase()==="true";
          c.customColor = row.customColor === undefined ? (c.customColor||"") : (row.customColor||"");
          c.color = c.customColorOverride ? (c.customColor||row.color||c.color) : effectiveCategoryColor(c);
        }
      });
      saveData();
      alert("Categories CSV imported.");
      return;
    }

    if(headers.includes("accountId") && headers.includes("categoryId") && headers.includes("period") && !headers.includes("title")){
      data.budgets = rows.map(row=>{
        let accountIds = [];
        try{ accountIds = JSON.parse(row.accountIdsJSON || "[]"); }catch(e){ accountIds = String(row.accountIds || "").split(/[|;]/).map(v=>v.trim()).filter(Boolean); }
        const accountId = row.accountId || accountIds[0] || "";
        let accountScope = ["single","all","selected"].includes(row.accountScope) ? row.accountScope : (accountId ? "single" : "all");
        if(accountScope === "single") accountIds = accountId ? [accountId] : [];
        if(accountScope === "all") accountIds = [];
        if(accountScope === "selected" && !accountIds.length && accountId) accountIds = [accountId];
        let categoryIds = [];
        try{ categoryIds = JSON.parse(row.categoryIdsJSON || "[]"); }catch(e){ categoryIds = String(row.categoryIds || "").split(/[|;]/).map(v=>v.trim()).filter(Boolean); }
        if(!categoryIds.length && row.categoryId) categoryIds = [row.categoryId];
        categoryIds = [...new Set(categoryIds.filter(id=>id && !isBudgetExcludedCategory(id)))];
        return {
          id: row.id || uid(), name: row.name || "", emoji: row.emoji || "", accountScope, accountId: accountScope === "all" ? "" : (accountId || accountIds[0] || ""), accountIds,
          categoryId: categoryIds[0] || row.categoryId || "", categoryIds, amount: Number(row.amount || 0), period: row.period || "monthly", notes: row.notes || ""
        };
      });
      saveData();
      alert("Budgets CSV imported.");
      return;
    }

    if(headers.includes("company") && headers.includes("dueDate") && headers.includes("minDue")){
      rows.forEach(row=>{
        const d = data.debts.find(x=>x.id === row.id);
        if(!d) return;
        d.order = row.order === "" ? d.order : Number(row.order);
        d.type = row.type === "Klarna" ? "Buy Now, Pay Later" : (row.type || d.type);
        if(isMedicalDebtLike(d)) d.type = "Medical";
        d.company = row.company || d.company;
        d.name = row.name || d.name;
        d.emoji = row.emoji || d.emoji;
        d.color = row.color || d.color;
        d.owner = row.owner || d.owner;
        d.startingBalance = row.startingBalance === undefined || row.startingBalance === "" ? d.startingBalance : Number(row.startingBalance);
        d.balance = row.balance === "" ? d.balance : Number(row.balance);
        d.trackingStartDate = row.trackingStartDate === undefined ? (d.trackingStartDate || "") : (row.trackingStartDate || "");
        d.limit = row.limit === "" ? null : Number(row.limit);
        d.apr = row.apr === "" ? 0 : Number(row.apr);
        d.statementDate = row.statementDate || "";
        d.dueDate = row.dueDate || "";
        d.statementBalance = row.statementBalance === "" ? 0 : Number(row.statementBalance);
        d.minDue = row.minDue === "" ? 0 : Number(row.minDue);
        d.manualExtra = row.manualExtra === "" ? 0 : Number(row.manualExtra);
        d.totalMonthlyPayment = row.totalMonthlyPayment === undefined || row.totalMonthlyPayment === "" ? d.totalMonthlyPayment : Number(row.totalMonthlyPayment);
        d.loanForecastBreakdownMode = row.loanForecastBreakdownMode === undefined || row.loanForecastBreakdownMode === "" ? (d.loanForecastBreakdownMode || "auto") : row.loanForecastBreakdownMode;
        d.loanFeeTiming = row.loanFeeTiming === undefined || row.loanFeeTiming === "" ? (d.loanFeeTiming || "auto") : row.loanFeeTiming;
        d.loanEstPrincipalPct = row.loanEstPrincipalPct === undefined ? (d.loanEstPrincipalPct ?? "") : row.loanEstPrincipalPct;
        d.loanEstInterestPct = row.loanEstInterestPct === undefined ? (d.loanEstInterestPct ?? "") : row.loanEstInterestPct;
        d.loanEstFeePct = row.loanEstFeePct === undefined ? (d.loanEstFeePct ?? "") : row.loanEstFeePct;
        if(row.loanForecastHistoryJSON !== undefined){
          try{ d.loanForecastHistory = normalizeLoanForecastHistory(JSON.parse(row.loanForecastHistoryJSON || "[]")); }
          catch(err){ d.loanForecastHistory = normalizeLoanForecastHistory(d.loanForecastHistory || []); }
        }
        d.monthsToPayoffStarting = row.monthsToPayoffStarting === undefined || row.monthsToPayoffStarting === "" ? d.monthsToPayoffStarting : Number(row.monthsToPayoffStarting);
        d.monthsToPayoffCurrent = row.monthsToPayoffCurrent === undefined || row.monthsToPayoffCurrent === "" ? d.monthsToPayoffCurrent : Number(row.monthsToPayoffCurrent);
        d.payoffDate = row.payoffDate === undefined ? (d.payoffDate || "") : (row.payoffDate || "");
        d.paymentStatus = row.paymentStatus || "not-set";
        d.frozenLocked = String(row.frozenLocked).toLowerCase() === "true";
        d.notes = row.notes || "";
      });
      saveData();
      alert("Debt CSV imported.");
      return;
    }

    if(headers.includes("startingBalance") && headers.includes("paycheckAccount")){
      rows.forEach(row=>{
        const a = data.accounts.find(x=>x.id === row.id);
        if(!a) return;
        a.order = row.order === "" ? a.order : Number(row.order);
        a.name = row.name || a.name;
        a.emoji = row.emoji || a.emoji;
        a.color = row.color || a.color;
        a.owner = row.owner || a.owner;
        a.startingBalance = row.startingBalance === "" ? a.startingBalance : Number(row.startingBalance);
        a.goalName = row.goalName || "";
        a.goalAmount = row.goalAmount === "" ? 0 : Number(row.goalAmount || 0);
        a.paycheckAccount = String(row.paycheckAccount).toLowerCase() === "true";
      });
      saveData();
      alert("Accounts CSV imported.");
      return;
    }

    if(headers.includes("title") && headers.includes("categoryId") && headers.includes("type") && !headers.includes("amount") && !headers.includes("date")){
      data.settings ||= {};
      data.settings.transactionTemplates ||= [];
      rows.forEach(row=>{
        const id = row.id || uid();
        const hasNewFieldColumns = headers.some(h=>h.startsWith("save"));
        const fields = hasNewFieldColumns ? normalizeTemplateFields({
          title: boolFromCSV(row.saveTitle, true),
          categoryId: boolFromCSV(row.saveCategory, true),
          notes: boolFromCSV(row.saveNotes, true),
          type: boolFromCSV(row.saveType, false),
          status: boolFromCSV(row.saveStatus, false),
          accountId: boolFromCSV(row.saveAccount, false),
          debtAccountId: boolFromCSV(row.saveDebtSpendingAccount, false),
          transferToAccountId: boolFromCSV(row.saveTransferToAccount, false),
          linkedDebtId: boolFromCSV(row.savePaymentDebt, false)
        }) : {...DEFAULT_TEMPLATE_FIELDS};
        const payload = normalizeTransactionTemplate({
          id,
          title: row.title || "",
          variantLabel: row.variantLabel || "",
          isDefault: boolFromCSV(row.isDefault, false),
          archived: boolFromCSV(row.archived, false),
          source: row.source || "csv",
          createdAt: row.createdAt || "",
          type: row.type || "expense",
          status: row.status || "planned",
          categoryId: row.categoryId || "unassigned",
          accountId: row.accountId || "",
          debtAccountId: row.debtAccountId || "",
          transferToAccountId: row.transferToAccountId || "",
          linkedDebtId: row.linkedDebtId || "",
          notes: row.notes || "",
          fields
        }, {legacySafe:false});
        if(!payload.title) return;
        const existing = data.settings.transactionTemplates.find(t => t.id === id);
        if(existing) Object.assign(existing, {...payload, id: existing.id});
        else data.settings.transactionTemplates.push(payload);
      });
      normalizeTransactionTemplates();
      saveData();
      alert("Transaction templates CSV imported.");
      return;
    }

    if(headers.includes("title") && headers.includes("amount") && headers.includes("date")){
      rows.forEach(row=>{
        const tx = data.transactions.find(x=>x.id === row.id);
        if(!tx) return;
        tx.date = row.date || tx.date;
        tx.title = row.title || tx.title;
        tx.amount = row.amount === "" ? tx.amount : Number(row.amount);
        tx.type = row.type || tx.type;
        tx.status = row.status || tx.status;
        tx.accountId = row.accountId || "";
        tx.debtAccountId = row.debtAccountId || "";
        tx.categoryId = row.categoryId || tx.categoryId;
        tx.transferToAccountId = row.transferToAccountId || "";
        tx.linkedDebtId = row.linkedDebtId || "";
        tx.pendingReimbursement = row.pendingReimbursement === undefined ? !!tx.pendingReimbursement : String(row.pendingReimbursement).toLowerCase() === "true";
        tx.reimbursementToAccountId = row.reimbursementToAccountId === undefined ? (tx.reimbursementToAccountId || "") : (row.reimbursementToAccountId || "");
        tx.loanPrincipalAmount = row.loanPrincipalAmount === undefined || row.loanPrincipalAmount === "" ? (tx.loanPrincipalAmount ?? "") : Number(row.loanPrincipalAmount);
        tx.loanInterestAmount = row.loanInterestAmount === undefined || row.loanInterestAmount === "" ? (tx.loanInterestAmount ?? "") : Number(row.loanInterestAmount);
        tx.loanFeeAmount = row.loanFeeAmount === undefined || row.loanFeeAmount === "" ? (tx.loanFeeAmount ?? "") : Number(row.loanFeeAmount);
        tx.loanBalanceAdjustment = row.loanBalanceAdjustment === undefined || row.loanBalanceAdjustment === "" ? (tx.loanBalanceAdjustment ?? "") : Number(row.loanBalanceAdjustment);
        tx.autoPaycheck = row.autoPaycheck === undefined ? !!tx.autoPaycheck : String(row.autoPaycheck).toLowerCase() === "true";
        tx.autoMakPaycheck = row.autoMakPaycheck === undefined ? !!tx.autoMakPaycheck : String(row.autoMakPaycheck).toLowerCase() === "true";
        tx.paycheckHoursOverride = row.paycheckHoursOverride === undefined || row.paycheckHoursOverride === "" ? "" : Number(row.paycheckHoursOverride);
        if(row.autoPaycheckInfoJSON){
          try{ tx.autoPaycheckInfo = JSON.parse(row.autoPaycheckInfoJSON); } catch(err){ console.warn("Bad autoPaycheckInfoJSON", err); }
        }
        tx.recurrence = {
          ...(tx.recurrence || {}),
          type: row.repeatType || tx.recurrence?.type || "none",
          interval: row.repeatInterval === "" ? (tx.recurrence?.interval || 1) : Number(row.repeatInterval),
          weekday: row.repeatWeekday === "" ? tx.recurrence?.weekday : Number(row.repeatWeekday),
          ordinal: row.repeatOrdinal === "" ? tx.recurrence?.ordinal : Number(row.repeatOrdinal),
          weekendHandling: row.weekendHandling || tx.recurrence?.weekendHandling || "none"
        };
        tx.recurrenceUntil = row.recurrenceUntil === undefined ? (tx.recurrenceUntil || "") : (row.recurrenceUntil || "");
        tx.billArchived = row.billArchived === undefined ? !!tx.billArchived : String(row.billArchived).toLowerCase() === "true";
        tx.billArchivedAt = row.billArchivedAt === undefined ? (tx.billArchivedAt || "") : (row.billArchivedAt || "");
        tx.billArchivedPreviousRecurrenceUntil = row.billArchivedPreviousRecurrenceUntil === undefined ? (tx.billArchivedPreviousRecurrenceUntil || "") : (row.billArchivedPreviousRecurrenceUntil || "");
        tx.recurringSourceId = row.recurringSourceId === undefined ? (tx.recurringSourceId || "") : (row.recurringSourceId || "");
        tx.recurrenceSourceId = row.recurrenceSourceId === undefined ? (tx.recurrenceSourceId || "") : (row.recurrenceSourceId || "");
        tx.originalDate = row.originalDate === undefined ? (tx.originalDate || "") : (row.originalDate || "");
        tx.wasRecurringOccurrence = row.wasRecurringOccurrence === undefined ? !!tx.wasRecurringOccurrence : String(row.wasRecurringOccurrence).toLowerCase() === "true";
        if(row.dateOverridesJSON){
          try{ tx.dateOverrides = JSON.parse(row.dateOverridesJSON); } catch(err){ console.warn("Bad dateOverridesJSON", err); }
        }
        if(row.occurrenceOverridesJSON){
          try{ tx.occurrenceOverrides = JSON.parse(row.occurrenceOverridesJSON); } catch(err){ console.warn("Bad occurrenceOverridesJSON", err); }
        }
        if(row.linkedTransactionIdsJSON){
          try{ tx.linkedTransactionIds = JSON.parse(row.linkedTransactionIdsJSON); } catch(err){ console.warn("Bad linkedTransactionIdsJSON", err); }
        }
        tx.notes = row.notes || "";
      });
      saveData();
      alert("Transactions CSV imported.");
      return;
    }

    alert("I couldn't tell whether this is an Accounts, Debts, or Transactions CSV.");
  };
  reader.readAsText(file);
}



function clearEverything(){
  const step1 = confirm("This will delete ALL Money Nest data in this browser. Export a JSON backup first. Continue?");
  if(!step1) return;
  const step2 = confirm("Seriously: accounts, debts, transactions, budgets, categories, everything. Continue?");
  if(!step2) return;
  const typed = prompt('Type DELETE MONEY NEST to clear everything.');
  if(typed !== "DELETE MONEY NEST"){
    alert("Clear cancelled.");
    return;
  }

  data = normalizeData({
    settings:{buffer:50},
    categories:[
    {id:"income", name:"Income", emoji:"💰", color:"#31d136"},
    {id:"paycheck", name:"Paycheck", emoji:"💵", color:"#19b51f"},
    {id:"transfer", name:"Transfer", emoji:"↔️", color:"#b28d4a"},
    {id:"unassigned", name:"Unassigned", emoji:"▫️", color:"#111111"},
    {id:"banking", name:"Banking", emoji:"🏦", color:"#9b9b9b"},
    {id:"car", name:"Car", emoji:"🚗", color:"#5469b8"},
    {id:"credit-card-payment", name:"Credit Card Payment", emoji:"💳", color:"#ff1717"},
    {id:"entertainment", name:"Entertainment", emoji:"🎬", color:"#f0bc12"},
    {id:"food", name:"Food", emoji:"🍔", color:"#fff86a"},
    {id:"gas", name:"Gas", emoji:"⛽", color:"#6f99e8"},
    {id:"gifts", name:"Gifts", emoji:"🎁", color:"#b59b3b"},
    {id:"groceries", name:"Groceries", emoji:"🛒", color:"#e4f227"},
    {id:"household", name:"Household", emoji:"🏠", color:"#efe6a8"},
    {id:"insurance", name:"Insurance", emoji:"🛡️", color:"#12a9e6"},
    {id:"klarna", name:"Klarna", emoji:"💗", color:"#f6a7b8"},
    {id:"loan-payment", name:"Loan Payment", emoji:"📄", color:"#ee6d6d"},
    {id:"mak-spending", name:"Mak Spending", emoji:"🛍️", color:"#ffa94d"},
    {id:"medical", name:"Medical", emoji:"🩺", color:"#8936ff"},
    {id:"new-house", name:"New House", emoji:"🏡", color:"#ec14d4"},
    {id:"phone", name:"Phone", emoji:"📱", color:"#1246ff"},
    {id:"rent", name:"Rent", emoji:"🏘️", color:"#2d21ef"},
    {id:"savings", name:"Savings", emoji:"🌱", color:"#218f50"},
    {id:"shopping", name:"Shopping", emoji:"🛒", color:"#ffd1a1"},
    {id:"subscription", name:"Subscription", emoji:"🔁", color:"#f2de83"},
    {id:"ty-spending", name:"Ty Spending", emoji:"🧢", color:"#c59427"},
    {id:"utilities", name:"Utilities", emoji:"💡", color:"#4f77c8"}
  ],
    accounts:[],
    debts:[],
    budgets:[],
    transactions:[]
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  localStorage.removeItem(UI_PREFS_KEY);
  setView("dashboard");
  alert("Money Nest has been cleared.");
}

if(document.getElementById("backupBtn")) backupBtn.onclick = ()=>{ const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "money-nest-backup.json"; a.click(); saveLocalMeta({lastJsonBackup:new Date().toISOString()}); renderBackupHealthIndicator(); };
if(document.getElementById("financialPictureBtn")) financialPictureBtn.onclick = exportFinancialPicture;
if(document.getElementById("extendedFinancialPictureBtn")) extendedFinancialPictureBtn.onclick = exportExtendedFinancialPicture;
if(document.getElementById("csvExportBtn")) csvExportBtn.onclick = exportEditableCSVs;
if(document.getElementById("settingsClearAllBtn")) settingsClearAllBtn.onclick = clearEverything;
if(document.getElementById("csvImportInput")) csvImportInput.onchange = (e)=>{ const file = e.target.files[0]; if(!file) return; importEditedCSV(file); e.target.value = ""; };

function backupImportCandidate(parsed){
  if(parsed && typeof parsed === "object"){
    if(parsed.moneyNest && typeof parsed.moneyNest === "object") return parsed.moneyNest;
    if(parsed.data && typeof parsed.data === "object") return parsed.data;
    if(parsed.backup && typeof parsed.backup === "object") return parsed.backup;
  }
  return parsed;
}
function validateBackupShape(candidate){
  if(!candidate || typeof candidate !== "object" || Array.isArray(candidate)){
    throw new Error("This file is not a Money Nest JSON backup.");
  }
  const hasMoneyNestData = ["accounts","transactions","debts","categories","settings","budgets"].some(key => Object.prototype.hasOwnProperty.call(candidate, key));
  if(!hasMoneyNestData){
    throw new Error("This JSON does not look like a Money Nest backup. Make sure you chose the JSON backup, not the financial-picture HTML report or a CSV file.");
  }
}
function saveImportedBackupData(normalized){
  const raw = JSON.stringify(normalized);
  try{
    localStorage.setItem(STORAGE_KEY, raw);
  } catch(err){
    // Importing a full backup should not also store a giant before/after undo snapshot.
    // If browser storage is tight, clear local undo history and try once more.
    try{ localStorage.removeItem(CHANGE_HISTORY_KEY); } catch(innerErr){}
    localStorage.setItem(STORAGE_KEY, raw);
  }
}
function importBackupJSON(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      const candidate = backupImportCandidate(parsed);
      validateBackupShape(candidate);
      const normalized = normalizeData(candidate);
      suppressChangeHistory = true;
      data = normalized;
      repairSplitRecurringSeriesData();
      saveImportedBackupData(data);
      touchLocalMoneyNestData();
      suppressChangeHistory = false;
      try{ currentView = "dashboard"; setView("dashboard"); }
      catch(renderErr){ console.warn("Backup imported, but dashboard render needed fallback", renderErr); render(); }
      alert("Backup imported.");
    } catch(err){
      suppressChangeHistory = false;
      console.error("Backup import failed", err);
      alert(`Backup import failed: ${err.message || err}`);
    }
  };
  reader.onerror = ()=> alert("Backup import failed: Money Nest could not read that file.");
  reader.readAsText(file);
}
if(document.getElementById("importInput")) importInput.onchange = (e)=>{ const file = e.target.files[0]; if(!file) return; importBackupJSON(file); e.target.value = ""; };


function bootMoneyNest(){
  try{
    setView(currentView || "dashboard");
  } catch(err){
    console.error("Startup render failed", err);
    try{
      currentView = "dashboard";
      document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id === "dashboard"));
      document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.view === "dashboard"));
      const title = document.getElementById("viewTitle");
      if(title) title.textContent = "Dashboard";
      renderDashboard();
    } catch(innerErr){
      console.error("Fallback dashboard render failed", innerErr);
    }
  }
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", bootMoneyNest);
} else {
  bootMoneyNest();
}


// v2-211: combinable Budget Review quick filters replace separate account/recurring controls.
// v2-205: search modal polish, selected budget presets, and recurring bill deduping.
function openGlobalSearch(){ const m=document.getElementById('globalSearchModal'); if(!m)return; if(!m.open)m.showModal(); const i=document.getElementById('globalSearchInput'); i.value=''; renderGlobalSearch(''); setTimeout(()=>i.focus(),30); }
window.openGlobalSearch=openGlobalSearch;
function renderGlobalSearch(query=''){
 const el=document.getElementById('globalSearchResults'); if(!el)return; const q=String(query).trim().toLowerCase();
 if(!q){el.innerHTML='<div class="empty-state">Start typing to search all saved transactions.</div>';return;}
 const rows=expandedTransactions(toISO(addMonths(new Date(),24))).filter(tx=>{const a=accountById(tx.accountId),c=categoryById(tx.categoryId);return [tx.title,tx.notes,tx.date,tx.amount,a?.name,c?.name,tx.status,tx.type].some(v=>String(v??'').toLowerCase().includes(q));}).slice(0,80);
 el.innerHTML=rows.length?rows.map(tx=>{const a=accountById(tx.accountId),c=categoryById(tx.categoryId);return `<button class="global-search-row" onclick="document.getElementById('globalSearchModal').close();openTransaction('${tx.originalId||tx.id}',{generated:${!!tx.generated},occurrenceOriginalDate:'${tx.originalDate||tx.date}',occurrenceDate:'${tx.date}'})"><span><b>${escapeAttr(tx.title||'Untitled')}</b><small>${tx.date} • ${a?.name||'Unknown account'} • ${c?.name||'Unassigned'} • ${tx.status}</small></span><strong>${money(tx.amount)}</strong></button>`}).join(''):'<div class="empty-state">No matches.</div>';
}
window.renderGlobalSearch=renderGlobalSearch;
function healthScan(){
 const issues=[]; const txIds=new Set();
 data.transactions.forEach(tx=>{if(txIds.has(tx.id))issues.push({kind:'duplicate',label:`Duplicate transaction ID: ${tx.title||tx.id}`});txIds.add(tx.id);if(tx.accountId&&!accountById(tx.accountId)&&!debtById(tx.accountId))issues.push({kind:'account',label:`${tx.title||'Transaction'} references a missing account`});if(tx.categoryId&&!categoryById(tx.categoryId))issues.push({kind:'category',label:`${tx.title||'Transaction'} references a missing category`});});
 const recurring=data.transactions.filter(isRecurring); const likely=[];
 data.transactions.filter(t=>!isRecurring(t)&&!t.recurringSourceId&&!t.originalId&&!t.wasRecurringOccurrence&&t.status==='cleared').forEach(tx=>{const match=recurring.find(r=>String(r.title||'').trim().toLowerCase()===String(tx.title||'').trim().toLowerCase()&&r.categoryId===tx.categoryId&&r.accountId===tx.accountId&&Math.abs(Number(r.amount||0)-Number(tx.amount||0))<0.01);if(match)likely.push({tx,match});});
 const stale=recurring.filter(r=>{const latest=expandedTransactions(todayISO()).filter(t=>(t.originalId||t.id)===r.id&&t.date<=todayISO()).sort((a,b)=>b.date.localeCompare(a.date))[0];return latest&&((parseDate(todayISO())-parseDate(latest.date))/86400000)>120;});
 return {issues,likely,stale,duplicates:findLikelyDuplicateTransactions()};
}
function findLikelyDuplicateTransactions(){const map=new Map(),out=[];data.transactions.filter(t=>!isRecurring(t)).forEach(t=>{const key=[t.date,String(t.title||'').trim().toLowerCase(),Number(t.amount||0).toFixed(2),t.accountId].join('|');if(map.has(key))out.push([map.get(key),t]);else map.set(key,t)});return out;}
function linkLikelyRecurring(txId,sourceId){const tx=data.transactions.find(t=>t.id===txId),src=data.transactions.find(t=>t.id===sourceId);if(!tx||!src)return;tx.recurringSourceId=src.id;tx.originalId=src.id;tx.wasRecurringOccurrence=true;tx.originalDate=tx.originalDate||tx.date;saveData();alert('Linked to the recurring bill.');}
window.linkLikelyRecurring=linkLikelyRecurring;
function renderMoneyNestHealthCenter(){
  const el=document.getElementById('moneyNestHealthCenter'); if(!el)return;
  const s=healthScan(); const total=s.issues.length+s.likely.length+s.stale.length+s.duplicates.length;
  const badge=document.getElementById('healthIssueCount'); if(badge)badge.textContent=total?`${total} found`:'healthy';
  let out=`<div class="health-summary-grid"><article><b>${s.issues.length}</b><span>Broken references</span></article><article><b>${s.likely.length}</b><span>Possible unlinked bills</span></article><article><b>${s.duplicates.length}</b><span>Possible duplicates</span></article><article><b>${s.stale.length}</b><span>Stale recurring rules</span></article></div>`;
  if(s.likely.length) out += `<h4>Smart recurring matches</h4>` + s.likely.slice(0,12).map(x=>`<div class="health-row"><span><b>${escapeAttr(x.tx.title)}</b><small>${x.tx.date} looks like ${escapeAttr(x.match.title)}</small></span><button class="ghost small" onclick="linkLikelyRecurring('${x.tx.id}','${x.match.id}')">Link</button></div>`).join('');
  if(s.issues.length) out += `<h4>Data health</h4>` + s.issues.slice(0,12).map(x=>`<div class="health-row"><span>${escapeAttr(x.label)}</span></div>`).join('');
  if(s.duplicates.length) out += `<h4>Possible duplicates</h4>` + s.duplicates.slice(0,10).map(([a,b])=>`<div class="health-row"><span><b>${escapeAttr(a.title)}</b><small>${a.date} • ${money(a.amount)} • review before deleting</small></span></div>`).join('');
  if(s.stale.length) out += `<h4>Recurring rules to review</h4>` + s.stale.slice(0,10).map(x=>`<div class="health-row"><span><b>${escapeAttr(x.title)}</b><small>No matched activity in roughly 120 days</small></span><button class="ghost small" onclick="openTransaction('${x.id}')">Review</button></div>`).join('');
  if(!total) out += '<div class="empty-state">No obvious data-health problems found.</div>';
  el.innerHTML=out;
}
const _renderSettings204=renderSettings; renderSettings=function(){_renderSettings204();renderMoneyNestHealthCenter();};

// v2-206: actionable, dismissible duplicate cleanup findings.
const HEALTH_DISMISSALS_KEY = 'moneyNestHealthDismissalsV1';
function getHealthDismissals(){
  try{ return new Set(JSON.parse(localStorage.getItem(HEALTH_DISMISSALS_KEY) || '[]')); }
  catch(err){ return new Set(); }
}
function saveHealthDismissals(set){
  try{ localStorage.setItem(HEALTH_DISMISSALS_KEY, JSON.stringify([...set])); }catch(err){}
}
function duplicatePairKey(a,b){
  return [String(a?.id||''),String(b?.id||'')].sort().join('::');
}
function dismissHealthFinding(key){
  const set=getHealthDismissals(); set.add(String(key)); saveHealthDismissals(set); renderMoneyNestHealthCenter();
}
window.dismissHealthFinding=dismissHealthFinding;
function clearHealthDismissals(){
  try{ localStorage.removeItem(HEALTH_DISMISSALS_KEY); }catch(err){}
  renderMoneyNestHealthCenter();
}
window.clearHealthDismissals=clearHealthDismissals;

findLikelyDuplicateTransactions=function(){
  const groups=new Map(), out=[], dismissed=getHealthDismissals();
  data.transactions.filter(t=>t && !isRecurring(t) && !t.deleted).forEach(t=>{
    const key=[
      t.date,
      String(t.title||'').trim().toLowerCase(),
      Number(t.amount||0).toFixed(2),
      t.accountId||'',
      t.categoryId||'',
      t.type||'',
      t.status||'',
      t.transferToAccountId||t.transferTo||'',
      t.debtId||t.debtAccountId||''
    ].join('|');
    const arr=groups.get(key)||[]; arr.push(t); groups.set(key,arr);
  });
  groups.forEach(arr=>{
    if(arr.length<2)return;
    for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){
      const a=arr[i], b=arr[j];
      if(!a.id || !b.id || a.id===b.id) continue;
      const pairKey=duplicatePairKey(a,b);
      if(!dismissed.has(pairKey)) out.push([a,b,pairKey]);
    }
  });
  return out;
};

renderMoneyNestHealthCenter=function(){
  const el=document.getElementById('moneyNestHealthCenter'); if(!el)return;
  const s=healthScan(); const total=s.issues.length+s.likely.length+s.stale.length+s.duplicates.length;
  const badge=document.getElementById('healthIssueCount'); if(badge)badge.textContent=total?`${total} found`:'healthy';
  let out=`<div class="health-summary-grid"><article><b>${s.issues.length}</b><span>Broken references</span></article><article><b>${s.likely.length}</b><span>Possible unlinked bills</span></article><article><b>${s.duplicates.length}</b><span>Possible duplicates</span></article><article><b>${s.stale.length}</b><span>Stale recurring rules</span></article></div>`;
  if(s.likely.length) out += `<h4>Smart recurring matches</h4>` + s.likely.slice(0,12).map(x=>`<div class="health-row"><span><b>${escapeAttr(x.tx.title)}</b><small>${x.tx.date} looks like ${escapeAttr(x.match.title)}</small></span><button class="ghost small" onclick="linkLikelyRecurring('${x.tx.id}','${x.match.id}')">Link</button></div>`).join('');
  if(s.issues.length) out += `<h4>Data health</h4>` + s.issues.slice(0,12).map(x=>`<div class="health-row"><span>${escapeAttr(x.label)}</span></div>`).join('');
  if(s.duplicates.length){
    out += `<div class="health-section-heading"><h4>Possible duplicates</h4><button class="ghost small" onclick="clearHealthDismissals()">Restore dismissed</button></div>`;
    out += s.duplicates.slice(0,10).map(([a,b,key])=>{
      const accountA=accountById(a.accountId)?.name||'Unknown account';
      const accountB=accountById(b.accountId)?.name||'Unknown account';
      return `<div class="health-row health-duplicate-row"><span><b>${escapeAttr(a.title||'Untitled')}</b><small>Two saved records match: ${a.date} • ${money(a.amount)}</small><small>1. ${escapeAttr(accountA)} • ${escapeAttr(a.categoryId?categoryById(a.categoryId)?.name||'Unassigned':'Unassigned')}</small><small>2. ${escapeAttr(accountB)} • ${escapeAttr(b.categoryId?categoryById(b.categoryId)?.name||'Unassigned':'Unassigned')}</small></span><div class="health-actions"><button class="ghost small" onclick="openTransaction('${a.id}')">Review 1</button><button class="ghost small" onclick="openTransaction('${b.id}')">Review 2</button><button class="ghost small" onclick="dismissHealthFinding('${key}')">Dismiss</button></div></div>`;
    }).join('');
  }
  if(s.stale.length) out += `<h4>Recurring rules to review</h4>` + s.stale.slice(0,10).map(x=>`<div class="health-row"><span><b>${escapeAttr(x.title)}</b><small>No matched activity in roughly 120 days</small></span><button class="ghost small" onclick="openTransaction('${x.id}')">Review</button></div>`).join('');
  if(!total) out += '<div class="empty-state">No obvious data-health problems found.</div>';
  el.innerHTML=out;
};

// v2-207: archived bills section with archive/restore workflow.
// v2-208: reserve a dedicated Bills amount column so archive controls cannot squeeze totals.


// v2-213: Simplified Budget Review with a compact summary strip and collapsed secondary insights; Smart Cleanup now starts collapsed.
// v2-212: Combined Cash Accounts and Debts into one Accounts page while preserving all existing data models and detail views.


// v2-214: transaction linking, Needs Review inbox, calendar density, and backup health.
let txLinkDraftIds = [];
function txByAnyId(id){ return (data.transactions || []).find(t=>String(t.id)===String(id)); }
function transactionLinkLabel(tx){
  const acct = accountById(tx.accountId)?.name || debtById(tx.debtAccountId || tx.linkedDebtId)?.name || "Unknown account";
  const cat = categoryById(tx.categoryId)?.name || "Unassigned";
  return `${tx.date || "No date"} • ${acct} • ${cat} • ${money(tx.amount || 0)}`;
}
function renderTxLinkedList(){
  const el=document.getElementById('txLinkedList'); if(!el)return;
  const rows=txLinkDraftIds.map(txByAnyId).filter(Boolean);
  el.innerHTML=rows.length ? rows.map(tx=>`<div class="linked-tx-row"><span><b>${escapeAttr(tx.title||'Untitled')}</b><small>${escapeAttr(transactionLinkLabel(tx))}</small></span><button type="button" class="ghost small" onclick="removeDraftTransactionLink('${tx.id}')">Remove</button></div>`).join('') : '<div class="empty">No linked transactions yet.</div>';
  const summary=document.getElementById('txLinksSummary'); if(summary) summary.textContent=rows.length?`${rows.length} linked`:'None';
}
window.removeDraftTransactionLink=id=>{txLinkDraftIds=txLinkDraftIds.filter(x=>x!==id);renderTxLinkedList();};
function candidateTransactionText(tx){ return [tx.title,tx.date,tx.amount,accountById(tx.accountId)?.name,categoryById(tx.categoryId)?.name,debtById(tx.debtAccountId||tx.linkedDebtId)?.name].filter(Boolean).join(' ').toLowerCase(); }
function renderTxLinkCandidates(){
  const el=document.getElementById('txLinkCandidates'); if(!el)return;
  const q=(document.getElementById('txLinkSearch')?.value||'').trim().toLowerCase();
  const currentId=document.getElementById('txId')?.value||'';
  const rows=(data.transactions||[]).filter(tx=>tx.id!==currentId && !isRecurring(tx) && (!q || candidateTransactionText(tx).includes(q))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,100);
  el.innerHTML=rows.length?rows.map(tx=>`<label class="link-candidate"><input type="checkbox" value="${tx.id}" ${txLinkDraftIds.includes(tx.id)?'checked':''}><span><b>${escapeAttr(tx.title||'Untitled')}</b><small>${escapeAttr(transactionLinkLabel(tx))}</small></span><b>${money(tx.amount||0)}</b></label>`).join(''):'<div class="empty">No matching saved transactions.</div>';
}
function openTxLinkManager(){ const d=document.getElementById('txLinkModal'); if(!d)return; document.getElementById('txLinkSearch').value=''; renderTxLinkCandidates(); d.showModal(); }
function closeTxLinkManager(){document.getElementById('txLinkModal')?.close();}
document.getElementById('manageTxLinksBtn')?.addEventListener('click',openTxLinkManager);
document.getElementById('closeTxLinkModal')?.addEventListener('click',closeTxLinkManager);
document.getElementById('cancelTxLinks')?.addEventListener('click',closeTxLinkManager);
document.getElementById('txLinkSearch')?.addEventListener('input',renderTxLinkCandidates);
document.getElementById('saveTxLinks')?.addEventListener('click',()=>{
  txLinkDraftIds=[...document.querySelectorAll('#txLinkCandidates input:checked')].map(x=>x.value);
  renderTxLinkedList(); closeTxLinkManager();
});
function reconcileTransactionLinks(){
  const valid=new Set((data.transactions||[]).map(t=>String(t.id)));
  (data.transactions||[]).forEach(tx=>{tx.linkedTransactionIds=[...new Set((tx.linkedTransactionIds||[]).filter(id=>valid.has(String(id))&&String(id)!==String(tx.id)).map(String))];});
  (data.transactions||[]).forEach(tx=>tx.linkedTransactionIds.forEach(id=>{const other=txByAnyId(id);if(other&&!other.linkedTransactionIds.includes(tx.id))other.linkedTransactionIds.push(tx.id);}));
}
const _saveData214=saveData; saveData=function(){reconcileTransactionLinks();_saveData214();};

const REVIEW_DISMISSALS_KEY=`${STORAGE_KEY}.reviewDismissals`;
function getReviewDismissals(){try{return new Set(JSON.parse(localStorage.getItem(REVIEW_DISMISSALS_KEY)||'[]'));}catch(e){return new Set();}}
function reviewKey(kind,id){return `${kind}:${id}`;}
window.dismissReviewItem=(key)=>{const s=getReviewDismissals();s.add(key);localStorage.setItem(REVIEW_DISMISSALS_KEY,JSON.stringify([...s]));renderNeedsReview();};
window.restoreReviewDismissals=()=>{localStorage.removeItem(REVIEW_DISMISSALS_KEY);renderNeedsReview();};
function collectNeedsReview(){
  const dismissed=getReviewDismissals(), out=[];
  const today=todayISO();
  (data.transactions||[]).forEach(tx=>{
    const id=tx.id||uid();
    if(!isRecurring(tx) && pastPlannedNeedsAttention(tx,7)) out.push({kind:'past',id,key:reviewKey('past',id),title:`Past planned: ${tx.title||'Untitled'}`,sub:`${tx.date} • ${money(tx.amount||0)} • ${transactionAccountText(tx)}`,action:`openTransaction('${id}')`});
    if(tx.accountId && !accountById(tx.accountId)) out.push({kind:'account',id,key:reviewKey('account',id),title:`Unknown account: ${tx.title||'Untitled'}`,sub:`${tx.date||''} • ${money(tx.amount||0)}`,action:`openTransaction('${id}')`});
    if(tx.categoryId && !(data.categories||[]).some(c=>c.id===tx.categoryId)) out.push({kind:'category',id,key:reviewKey('category',id),title:`Unknown category: ${tx.title||'Untitled'}`,sub:`${tx.date||''} • ${money(tx.amount||0)}`,action:`openTransaction('${id}')`});
  });
  clearedLoanPaymentsMissingBreakdown().forEach(tx=>{
    const debt=debtById(tx.linkedDebtId);
    const baseId=tx.originalId || tx.id;
    const occurrenceKey=tx.originalDate || tx.date || "";
    const missing=loanPaymentMissingBreakdownFields(tx);
    out.push({
      kind:'loanBreakdown',
      id:`${baseId}-${occurrenceKey}`,
      key:reviewKey('loanBreakdown',`${baseId}-${occurrenceKey}`),
      title:`Loan breakdown missing: ${tx.title || debt?.name || 'Loan payment'}`,
      sub:`${tx.date || ''} • ${debt?.name || 'Loan'} • ${money(tx.amount || 0)} • missing ${missing.join(', ')}`,
      action:loanPaymentReviewAction(tx)
    });
  });
  const h=healthScan();
  h.likely.forEach(x=>out.push({kind:'bill',id:x.tx.id,key:reviewKey('bill',x.tx.id),title:`Possible unlinked bill: ${x.tx.title}`,sub:`${x.tx.date} looks like ${x.match.title}`,action:`openTransaction('${x.tx.id}')`,secondary:`linkLikelyRecurring('${x.tx.id}','${x.match.id}')`,secondaryLabel:'Link bill'}));
  h.duplicates.forEach(([a,b])=>out.push({kind:'duplicate',id:`${a.id}-${b.id}`,key:reviewKey('duplicate',duplicatePairKey(a,b)),title:`Possible duplicate: ${a.title}`,sub:`${a.date} • ${money(a.amount)} • two matching saved records`,action:`openTransaction('${a.id}')`,secondary:`openTransaction('${b.id}')`,secondaryLabel:'Review second'}));
  h.stale.forEach(x=>out.push({kind:'stale',id:x.id,key:reviewKey('stale',x.id),title:`Recurring rule may be stale: ${x.title}`,sub:'No matched activity in roughly 120 days',action:`openTransaction('${x.id}')`}));
  return out.filter(x=>!dismissed.has(x.key));
}
window.renderNeedsReview=function(){
  const list=document.getElementById('needsReviewList'),summary=document.getElementById('needsReviewSummary');
  const items=collectNeedsReview(); const groups={past:0,account:0,category:0,bill:0,duplicate:0,stale:0,loanBreakdown:0};items.forEach(x=>groups[x.kind]=(groups[x.kind]||0)+1);
  const badge=document.getElementById('reviewNavBadge');if(badge){badge.textContent=items.length;badge.hidden=!items.length;}
  const dashboardCount=document.getElementById('dashboardReviewCount');if(dashboardCount)dashboardCount.textContent=items.length?`${items.length} found`:'clear';
  if(summary)summary.innerHTML=`<article><b>${items.length}</b><span>Total findings</span></article><article><b>${groups.past||0}</b><span>Past planned</span></article><article><b>${groups.loanBreakdown||0}</b><span>Loan breakdowns</span></article><article><b>${(groups.account||0)+(groups.category||0)}</b><span>Broken references</span></article><article><b>${(groups.bill||0)+(groups.duplicate||0)+(groups.stale||0)}</b><span>Cleanup suggestions</span></article>`;
  if(list)list.innerHTML=items.length?items.map(x=>`<div class="review-item"><span><b>${escapeAttr(x.title)}</b><small>${escapeAttr(x.sub)}</small></span><div class="review-actions"><button class="ghost small" onclick="${x.action}">Review</button>${x.secondary?`<button class="ghost small" onclick="${x.secondary}">${x.secondaryLabel}</button>`:''}<button class="ghost small" onclick="dismissReviewItem('${escapeAttr(x.key)}')">Dismiss</button></div></div>`).join(''):`<div class="empty-state">Nothing needs review right now. 🎉 <button class="ghost small" onclick="restoreReviewDismissals()">Restore dismissed</button></div>`;
};
const _render214=render; render=function(){_render214();renderNeedsReview();};

function applyCalendarDensity(){
  const grid=document.getElementById('calendarGrid');if(!grid)return;
  grid.classList.remove('density-compact','density-comfortable','density-detailed');grid.classList.add(`density-${calendarDensity}`);
  const sel=document.getElementById('calendarDensity');if(sel)sel.value=calendarDensity;
}
const _renderCalendar214=renderCalendar;renderCalendar=function(){_renderCalendar214();applyCalendarDensity();};


function backupHealthData(){
  const meta=loadLocalMeta(), cloud=loadCloudConfig();
  const local=meta.lastLocalChange||'', json=meta.lastJsonBackup||'', cloudSave=cloud.lastCloudSave||'';
  const newestBackup=newestISO(json,cloudSave); const changedSince=!newestBackup||isoIsAfter(local,newestBackup);
  return {local,json,cloudSave,changedSince};
}
window.renderBackupHealthIndicator=function(){
  const el=document.getElementById('backupHealthIndicator');if(!el)return;
  const b=backupHealthData();
  el.innerHTML=`<article><b class="${b.changedSince?'backup-warn':'backup-good'}">${b.changedSince?'Backup recommended':'Backed up'}</b><span>${b.changedSince?'Local data changed after the newest saved copy.':'Newest backup is at least as recent as local edits.'}</span></article><article><b>${fmtCloudTime(b.json)}</b><span>Last JSON backup</span></article><article><b>${fmtCloudTime(b.cloudSave)}</b><span>Last cloud save</span></article>`;
};
const _renderSettings214=renderSettings;renderSettings=function(){_renderSettings214();renderBackupHealthIndicator();};

// Ensure old backups get normalized and links become reciprocal without changing totals.
reconcileTransactionLinks();
renderNeedsReview();

// v2-215: Calendar density now changes visible transaction count and sizing; Needs Review and Smart Cleanup are unified on Dashboard.

// v2-216: palette rendering hook.
const _render216=render; render=function(){applyMoneyNestPalette();_render216();};
applyMoneyNestPalette();

// v2-220: Calendar density control removed; calendar uses the original comfortable layout.
// v2-222: Search moved to the sidebar card; Original migrated into editable Custom and removed as a separate choice.


// v2-223 recurring management shortcut.
window.setBillFilterPreset=function(mode){
  if(mode==='active'){ billFilters.account='all'; billFilters.type='all'; billFilters.recurrence='all'; billFilters.categories=[]; saveUiPrefs(); renderBills(); }
};


function renderVersionSaveIndicator(){
  const el=document.getElementById('appVersionSaveIndicator'); if(!el)return;
  const meta=loadLocalMeta(); const warning=meta.olderSchemaWarning;
  el.innerHTML=`<article><b>Money Nest v${APP_VERSION}</b><span>Data schema ${CURRENT_SCHEMA_VERSION}</span></article><article><b>${fmtCloudTime(meta.lastLocalChange)}</b><span>Last local data save</span></article>${warning?`<article class="schema-warning"><b>Older data upgraded</b><span>Schema ${warning.from} → ${warning.to}. Keep a fresh JSON backup.</span></article>`:''}`;
}
function organizeSettingsIntoFourSections(){
  const stack=document.querySelector('#settings .settings-stack'); if(!stack || stack.dataset.grouped223==='1')return;
  stack.dataset.grouped223='1';
  const overview=stack.querySelector('.settings-overview');
  const cards=[...stack.children].filter(el=>el!==overview && el.matches('details.panel'));
  const defs=[
    ['data','📦','Data & Backup','Cloud sync, backups, reports, and undo history'],
    ['appearance','🎨','Appearance','Palettes, categories, colors, and labels'],
    ['automation','⚙️','Automation','Templates, paychecks, and repeating workflows'],
    ['preferences','🎛️','App Preferences','Defaults, reference notes, and behavior']
  ];
  const groups={};
  defs.forEach(([id,emoji,title,sub])=>{const d=document.createElement('details');d.className='panel settings-collapsible settings-master-group';d.innerHTML=`<summary><span class="settings-summary-main"><span class="settings-emoji">${emoji}</span><span><b>${title}</b><small>${sub}</small></span></span><span class="summary-pill">open</span></summary><div class="settings-collapse-body settings-master-body" data-settings-master="${id}"></div>`;stack.appendChild(d);groups[id]=d.querySelector('.settings-master-body');});
  cards.forEach(card=>{
    const t=(card.querySelector('summary b')?.textContent||'').toLowerCase();
    let g='preferences';
    if(/appearance|categor/.test(t))g='appearance';
    else if(/cloud|backup|recent changes/.test(t))g='data';
    else if(/template|paycheck/.test(t))g='automation';
    groups[g].appendChild(card);
  });
  [...stack.children].filter(el=>el.classList?.contains('settings-group-label')).forEach(el=>el.remove());
}
const _renderSettings223=renderSettings; renderSettings=function(){_renderSettings223();renderVersionSaveIndicator();organizeSettingsIntoFourSections();};


// v2-223 unified transaction detail: every existing transaction opens one review screen first.
const openTransactionEditor = window.openTransaction;
let transactionDetailContext=null;
function transactionDetailResolved(id,defaults={}){
  const base=data.transactions.find(t=>String(t.id)===String(id)); if(!base)return null;
  const originalDate=defaults.occurrenceOriginalDate||defaults.originalDate||base.date;
  const date=defaults.occurrenceDate||defaults.date||base.date;
  const tx=isRecurring(base)?transactionForOccurrenceForm(base,originalDate,date):base;
  return {base,tx,defaults:{...defaults,occurrenceOriginalDate:originalDate,occurrenceDate:date}};
}
function openTransactionDetail(id,defaults={}){
  const ctx=transactionDetailResolved(id,defaults); if(!ctx)return openTransactionEditor(id,defaults);
  transactionDetailContext=ctx;
  const {base,tx}=ctx, account=accountById(tx.accountId), category=categoryById(tx.categoryId), debt=debtById(tx.debtAccountId||tx.linkedDebtId);
  const linked=(base.linkedTransactionIds||[]).map(x=>data.transactions.find(t=>String(t.id)===String(x))).filter(Boolean);
  document.getElementById('transactionDetailTitle').textContent=tx.title||'Untitled transaction';
  document.getElementById('transactionDetailSub').textContent=`${tx.date||''} • ${tx.status==='cleared'?'Cleared':'Planned'}`;
  document.getElementById('transactionDetailBody').innerHTML=`<div class="transaction-detail-summary"><article><span>Amount</span><b>${money(tx.amount||0)}</b></article><article><span>Account</span><b>${account?.emoji||'💵'} ${escapeAttr(account?.name||'Unknown account')}</b></article><article><span>Category</span><b>${category?.emoji||''} ${escapeAttr(category?.name||'Unassigned')}</b></article><article><span>Type</span><b>${escapeAttr(tx.type||'expense')}</b></article></div>${debt?`<div class="transaction-detail-section"><b>Related account/debt</b><p>${escapeAttr(debt.name||debt.company||'Debt')}</p></div>`:''}${isRecurring(base)?`<div class="transaction-detail-section"><b>Recurring source</b><p>${escapeAttr(recurrenceDescription(base))}</p></div>`:''}${tx.notes?`<div class="transaction-detail-section"><b>Notes</b><p>${escapeAttr(tx.notes)}</p></div>`:''}<div class="transaction-detail-section"><b>Linked transactions</b>${linked.length?linked.map(l=>`<button type="button" class="linked-detail-row" onclick="openTransactionDetail('${l.id}')"><span>${escapeAttr(l.title||'Untitled')}<small>${l.date} • ${transactionAccountText(l)}</small></span><strong>${money(l.amount||0)}</strong></button>`).join(''):'<p class="hint">No linked transactions.</p>'}</div>`;
  document.getElementById('transactionDetailEditBtn').onclick=()=>{document.getElementById('transactionDetailModal').close();openTransactionEditor(base.id,ctx.defaults);};
  document.getElementById('transactionDetailDuplicateBtn').onclick=()=>{document.getElementById('transactionDetailModal').close();duplicateTransaction(base.id);};
  document.getElementById('transactionDetailModal').showModal();
}
window.openTransactionDetail=openTransactionDetail;
// v2-228: restore direct editing when an existing transaction is selected.
window.openTransaction=(id=null,defaults={})=>openTransactionEditor(id,defaults);
// Bill series editing is an explicit edit action, so bypass the review screen.
const _openBillSeriesEditor223=openBillSeriesEditor; openBillSeriesEditor=function(txId){
  const selected=data.transactions.find(t=>t.id===txId); const tx=canonicalRecurringSeries(selected)||selected; if(!tx||!isRecurring(tx))return;
  const editOccurrence=billSeriesEditOccurrence(tx); billSeriesEditId=tx.id; document.getElementById('billDetailModal')?.close();
  openTransactionEditor(tx.id,editOccurrence);
};


function showOlderSchemaWarning(){
  const w=loadLocalMeta().olderSchemaWarning; if(!w || sessionStorage.getItem('moneyNest.schemaWarned'))return;
  sessionStorage.setItem('moneyNest.schemaWarned','1');
  const bar=document.createElement('div');bar.className='schema-upgrade-banner';bar.innerHTML=`<span><b>Money Nest upgraded older saved data.</b> Schema ${w.from} → ${w.to}. Make a fresh JSON backup when convenient.</span><button type="button" class="icon-btn">×</button>`;bar.querySelector('button').onclick=()=>bar.remove();document.body.prepend(bar);
}
setTimeout(showOlderSchemaWarning,0);

// v2-229: Data & Backup is the first grouped Settings card below the Settings Map.

// v2-230: Bill-series transaction details sort chronologically with the soonest date first.
const RECURRING_REPAIR_231_KEY = `${STORAGE_KEY}.recurringRepair231`;
(function autoRepairKnownSplitRecurringSeries(){
  try{
    if(localStorage.getItem(RECURRING_REPAIR_231_KEY)) return;
    const result = repairSplitRecurringSeriesData();
    localStorage.setItem(RECURRING_REPAIR_231_KEY, JSON.stringify({...result, at:new Date().toISOString()}));
    if(result.merged || result.removedPlanned || result.materialized){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      saveLocalMeta({lastRecurringSeriesRepair:new Date().toISOString(), recurringSeriesRepairResult:result});
    }
  } catch(err){
    console.warn("Could not auto-repair older split recurring series", err);
  }
})();

// v2-231: Bill series edits now replace the active rule in place, preserve cleared history, repair old split fragments, and prevent loose payment matches from skipping multiple occurrences.

// v2-232: Planned loose matches remain the current upcoming bill; only cleared matches advance the displayed Next date.

// v2-233: Bills page cards use the earliest actual linked planned occurrence for their Next date, matching bill details.

// v2-234: Budgets support an optional custom emoji, preserved in JSON and budget CSV import/export.
// v2-235: Monthly Budget Targets and Budget Performance are sorted alphabetically by displayed budget title.
// v2-237: Recurring series identity now includes its schedule, so same-title bills on different dates/rules remain separate and safe to edit/delete.
// v2-236: Bill series editing starts from the earliest uncleared linked occurrence, preserving cleared history and updating that occurrence forward.

// v2-242: loan forecasts learn from completed cleared recurring occurrences; incomplete cleared loan breakdowns are flagged on Dashboard.

// v2-243: Dashboard hierarchy is calmer and more compact; Action Center groups are collapsible and shared surfaces use lighter visual weight.

// v2-244: Action Center groups default closed; Bills and Budgets use flatter, more compact presentation without changing finance logic.
// v2-246: Bills deduplication preserves derived next-date display fields; bill rows also fall back safely instead of ever rendering "Next undefined".
// v2-245: Accounts use calmer scan-first rows, arrangement controls are opt-in, debt utilities are tucked away, and touch/detail action layouts are less cluttered.

// v2-247: iPhone task-first mode adds a streamlined Home, Future cashflow view, four-item mobile nav, More sheet, and quicker transaction-entry presentation without changing saved financial data.

// v2-248: Calendar drag/drop now moves cleared recurring occurrences by keeping their occurrence-override date in sync with the recurrence date override.

// v2-249: Dashboard past-planned alerts now wait more than 7 days; credit-card payment statuses are derived automatically from statement/minimum due plus linked planned, cleared, or active recurring payments.
