const STORAGE_KEY = "moneyNest.v2.113";
const UI_PREFS_KEY = `${STORAGE_KEY}.uiPrefs`;

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
    <p class="hint"><b>Safety:</b> Manual only is safest while testing. Auto-save can be paused anytime by setting Cloud sync mode to Off / paused. Keep JSON backups as your emergency save file.</p>
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
function cloudPayload(){
  // Keep undo history local only. The cloud row is the app data itself.
  return JSON.parse(JSON.stringify(data));
}
async function saveDataToCloud({silent=false}={}){
  const config = loadCloudConfig();
  if(config.mode === "off") throw new Error("Cloud sync is paused/off.");
  const user = await requireCloudUser();
  const client = getCloudClient();
  cloudSavingNow = true;
  const now = new Date().toISOString();
  const {error} = await client.from("money_nest_data").upsert({user_id:user.id, data:cloudPayload(), updated_at:now}, {onConflict:"user_id"});
  cloudSavingNow = false;
  if(error) throw error;
  saveCloudConfig({lastCloudSave: now});
  if(!silent){ await renderCloudSyncSettings(); alert("Saved Money Nest data to Supabase."); }
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
    const {data: row, error} = await client.from("money_nest_data").select("data, updated_at").eq("user_id", user.id).maybeSingle();
    if(error) throw error;
    if(!row?.data) throw new Error("No cloud backup found yet. Use Save to cloud first.");
    const ok = confirm(`Load cloud data from ${fmtCloudTime(row.updated_at)}? This will replace the data currently in this browser. Export a JSON backup first if you are unsure.`);
    if(!ok) return;
    suppressChangeHistory = true;
    data = normalizeData(row.data);
    saveImportedBackupData(data);
    suppressChangeHistory = false;
    saveCloudConfig({lastCloudLoad: new Date().toISOString()});
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
  const ids = ['accountDetail', 'accountDetailContent', 'accountList', 'accounts', 'addAccountBtn', 'addBillBtn', 'addBudgetBtn', 'addCategoryBtn', 'addDayTransactionBtn', 'addDebtBtn', 'autoPaycheckHint', 'autoPaycheckLabel', 'backupBtn', 'financialPictureBtn', 'extendedFinancialPictureBtn', 'billAccountFilter', 'billCategoryFilter', 'billRecurrenceFilter', 'billSort', 'billTypeFilter', 'bills', 'billsList', 'budgetList', 'budgets', 'calendar', 'calendarAccountFilter', 'calendarCategoryHighlight', 'calendarCategoryHighlightDropdown', 'calendarCategoryHighlightBtn', 'calendarCategoryHighlightMenu', 'calendarGrid', 'cancelDayModal', 'cancelSimple', 'cancelTxBtn', 'categoryList', 'clearRecentBtn', 'closeDayModal', 'closeModal', 'closeSimple', 'csvExportBtn', 'csvImportInput', 'ctxDelete', 'ctxDuplicate', 'ctxEdit', 'ctxCreateCardPayment', 'ctxMarkReimbursed', 'ctxToggleCleared', 'ctxUseCardInstead', 'dashboard', 'dayModal', 'dayModalSub', 'dayModalTitle', 'dayModalTransactions', 'debtDetail', 'debtDetailContent', 'debtGroups', 'debtSnapshot', 'debts', 'deleteSimpleBtn', 'deleteTxBtn', 'duplicateTxBtn', 'importInput', 'modalTitle', 'monthLabel', 'nextMonth', 'prevMonth', 'quickAddBtn', 'recentPlacesList', 'recentChangesList', 'undoLastChangeBtn', 'clearChangeHistoryBtn', 'recurrenceDetails', 'repeatIntervalUnitLabel', 'safeSpendList', 'saveTxBtn', 'settings', 'settingsClearAllBtn', 'settingsSampleResetBtn', 'simpleFields', 'simpleForm', 'simpleModal', 'simpleTitle', 'summaryCards', 'todayBtn', 'transactionForm', 'transactionModal', 'txAccount', 'txAmount', 'txAutoPaycheck', 'txCategory', 'txContextMenu', 'txDate', 'txDebt', 'txDebtAccount', 'txLoanBreakdownWrap', 'txLoanPrincipal', 'txLoanInterest', 'txLoanFees', 'txLoanBreakdownHint', 'txDeleteAll', 'txDeleteOne', 'txDeleteScopeWrap', 'txId', 'txNotes', 'txRepeatInterval', 'txRepeatIntervalUnit', 'txRepeatOrdinal', 'txRepeatRule', 'txRepeatWeekday', 'txSaveScopeHint', 'txSaveScopeWrap', 'txScopeFuture', 'txScopeOne', 'txStatus', 'txTitle', 'txTransferTo', 'txType', 'txWeekendHandling', 'upcomingList', 'viewTitle', 'settingsPaycheckCount', 'paycheckProfileList', 'makHourlyRate', 'makHoursPerWorkday', 'makDeductionPercent', 'makFixedDeduction', 'tyHourlyRate', 'tyDefaultHours', 'tyDeductionPercent', 'tyFixedDeduction', 'paycheckHoursWrap', 'txPaycheckHoursOverride', 'billCategoryDropdown', 'billCategoryDropdownBtn', 'billCategoryDropdownMenu'];
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

let data = loadData();
const CHANGE_HISTORY_KEY = `${STORAGE_KEY}.changeHistory`;
let suppressChangeHistory = false;
let currentView = "dashboard";
let selectedAccountId = null;
let selectedDebtId = null;
let accountDetailSortInitialized = false;

const defaultUiPrefs = {
  calendarFilter: "all",
  calendarHighlightCategories: ["all"],
  billFilters: { account:"all", categories:["all"], type:"all", recurrence:"all", sort:"date" },
  transactionFilters: { status:"all", category:"all", type:"all", sort:"date-asc", dateRange:"upcoming-90", search:"" },
  transactionFilterDefaults: { status:"all", category:"all", type:"all", sort:"date-asc", dateRange:"upcoming-90" },
  accountDetailMode: "bank",
  accountForecastRange: "today-forward"
};
const allowedAccountForecastRanges = new Set(["today-forward", "this-month", "next-paycheck", "next-30", "next-60", "next-90"]);
function cleanAccountForecastRange(range){
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
      accountForecastRange
    }));
  } catch(err){
    console.warn("Could not save Money Nest UI preferences", err);
  }
}
const uiPrefs = loadUiPrefs();
let accountDetailMode = uiPrefs.accountDetailMode || "bank";
let accountForecastRange = cleanAccountForecastRange(uiPrefs.accountForecastRange || "today-forward");
let accountBackTarget = "accounts";
let selectedDayISO = null;
let calendarDate = new Date("2026-06-01T12:00:00");
let calendarFilter = uiPrefs.calendarFilter || "all";
let calendarHighlightCategories = Array.isArray(uiPrefs.calendarHighlightCategories) ? uiPrefs.calendarHighlightCategories : ["all"];
let recentPlaces = [];
let suppressRecentTracking = false;
loadRecentPlaces();
let billFilters = {...defaultUiPrefs.billFilters, ...(uiPrefs.billFilters || {})};
if(!Array.isArray(billFilters.categories)) billFilters.categories = [billFilters.category || "all"];
let transactionFilterDefaults = {...defaultUiPrefs.transactionFilterDefaults, ...(uiPrefs.transactionFilterDefaults || {})};
let transactionFilters = {...defaultUiPrefs.transactionFilters, ...(uiPrefs.transactionFilters || {})};


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
  const d = raw || JSON.parse(JSON.stringify(sampleData));
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
    occurrenceOverrides: tx.occurrenceOverrides || {}
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
  try{ localStorage.setItem(CHANGE_HISTORY_KEY, JSON.stringify((history || []).slice(0,10))); }
  catch(err){ console.warn("Could not save change history", err); }
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
function changeDetailsHTML(item, historyIndex=0){
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
  let before, after;
  try{
    before = JSON.parse(item.before || "{}");
    after = JSON.parse(item.after || "{}");
  } catch(err){
    alert("Could not read that change snapshot.");
    return;
  }
  const beforeTx = (before.transactions || []).find(t=>t.id === txId);
  const afterTx = (after.transactions || []).find(t=>t.id === txId);
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
  history.unshift({
    id: uid(),
    at: new Date().toISOString(),
    label: summarizeDataChange(beforeRaw, afterRaw),
    before: beforeRaw,
    after: afterRaw
  });
  saveChangeHistory(history);
}
function saveData(){
  const beforeRaw = localStorage.getItem(STORAGE_KEY);
  const afterRaw = JSON.stringify(data);
  recordChangeSnapshot(beforeRaw, afterRaw);
  localStorage.setItem(STORAGE_KEY, afterRaw);
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
function occurrenceDateFor(tx, dateObj){
  const originalISO = toISO(dateObj);
  if(tx.dateOverrides && tx.dateOverrides[originalISO]) return tx.dateOverrides[originalISO];
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
    if(baseOccurrence) out.push(baseOccurrence);

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
        if(generatedOccurrence) out.push(generatedOccurrence);
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

  // Transfers between cash accounts:
  // from accountId = money leaves; transferToAccountId = money arrives.
  // Pending reimbursements are intentionally conservative: the payer account plans
  // for money leaving, but the receiving account does NOT count it as available
  // until the reimbursement is actually cleared.
  if(tx.type === "transfer" && tx.transferToAccountId === accountId){
    if(isPendingReimbursementTx(tx)) return 0;
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
  const txSamples = data.transactions
    .filter(tx => tx.linkedDebtId === d.id && tx.type === "transfer" && tx.status === "cleared" && Number(tx.amount || 0) > 0 && loanPaymentHasManualBreakdown(tx))
    .filter(tx => debtTransactionCountsForBalance(d, tx))
    .map(tx => {
      const amount = Number(tx.amount || 0);
      const principal = loanPrincipalReductionForPayment(tx);
      const interest = Number(tx.loanInterestAmount || 0);
      const fees = Number(tx.loanFeeAmount || 0);
      return {tx, date:tx.date || "", amount, principal, interest, fees, balanceBefore:"", source:"transaction"};
    });

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
  });

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
    return { amount: Math.max(0, min), label:`lowest day: ${minDate} (${money(min)})` };
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
      return { amount: Math.max(0, bal), label:`before next paycheck: ${next}` };
    }

    while(cursor <= end){
      const iso = toISO(cursor);
      const bal = accountBalance(account.id, true, iso);
      if(bal < min){ min = bal; minDate = iso; }
      cursor.setDate(cursor.getDate()+1);
    }
    return { amount: Math.max(0, min), label:`lowest before paycheck: ${minDate} (${money(min)})` };
  }

  const projected = accountBalance(account.id, true, toISO(addMonths(new Date(),1)));
  return { amount: Math.max(0, projected), label:"next 30 days" };
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
    currentView = view;
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id===view));
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.view===view));
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
  if(currentView==="calendar") renderCalendar();
  if(currentView==="accounts") renderAccounts();
  if(currentView==="accountDetail") renderAccountDetail();
  if(currentView==="budgets") renderBudgets();
  if(currentView==="bills") renderBills();
  if(currentView==="debts") renderDebts();
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
function hasPlannedDebtPayment(d, dueISO){
  if(!dueISO) return false;
  const windowStart = toISO(addDays(parseDate(dueISO), -10));
  const windowEnd = dueISO;
  return expandedTransactions(windowEnd).some(tx =>
    tx.linkedDebtId === d.id &&
    tx.date >= windowStart &&
    tx.date <= windowEnd &&
    tx.type === "transfer"
  );
}
function debtPaymentsDueSoon(days=30){
  const start = todayISO();
  const end = toISO(addDays(parseDate(start), days));
  return data.debts
    .map(d => ({...d, nextDue: nextDebtDueDate(d, start)}))
    .filter(d => d.nextDue && d.nextDue >= start && d.nextDue <= end)
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
    .filter(tx => tx.status === "planned" && tx.date < today)
    .slice(0,5)
    .forEach(tx=>{
      items.push({level:"warn", title:`Past planned: ${tx.title}`, sub:`${tx.date} • ${money(tx.amount)}`, action:`openTransaction('${tx.originalId || tx.id}')`});
    });

  data.debts.forEach(d=>{
    if((d.type === "Credit Card" || d.type === "Klarna") && !d.dueDate){
      items.push({level:"warn", title:`${d.name} missing due date`, sub:"Add a due date for reminders", action:`openDebtDetail('${d.id}')`});
    }
    if((d.type === "Credit Card" || d.type === "Klarna") && !Number(d.minDue || 0)){
      items.push({level:"warn", title:`${d.name} missing minimum due`, sub:"Add min due for payment planning", action:`openDebtDetail('${d.id}')`});
    }
    const due = nextDebtDueDate(d);
    if(due && due <= toISO(addDays(parseDate(today), 7)) && !hasPlannedDebtPayment(d, due) && !["paid","autopay","scheduled","skip"].includes(d.paymentStatus)){
      items.push({level:"bad", title:`${d.name} due soon`, sub:`Due ${due} • no planned payment found`, action:`openDebtDetail('${d.id}')`});
    }
  });

  return items.slice(0,8);
}

function renderDashboard(){
  try{
    const attention = dashboardNeedsAttention();
    const dueSoon = debtPaymentsDueSoon(30);
    const dueSoonRows = dueSoon.slice(0, 6);
    const dueSoonExtra = Math.max(0, dueSoon.length - dueSoonRows.length);
    const statementsToCheck = creditCardStatementsToCheck(7);

    document.getElementById("summaryCards").innerHTML = `
      <article class="card attention-card">
        <p class="eyebrow">Needs attention</p>
        <div class="value">${attention.length}</div>
        <p class="sub">${attention.length ? "item(s) to review" : "nothing urgent 🎉"}</p>
      </article>
      <article class="card attention-card">
        <p class="eyebrow">Debt payments due soon</p>
        <div class="value">${dueSoon.length}</div>
        <p class="sub">next 30 days, estimated monthly</p>
      </article>
      <article class="card attention-card">
        <p class="eyebrow">Overdraw risk</p>
        <div class="value">${data.accounts.filter(a=>!isSavingsAccount(a) && safeToSpend(a).amount <= 0).length}</div>
        <p class="sub">accounts at $0 or less safe</p>
      </article>
      <article class="card attention-card">
        <p class="eyebrow">Statements to check</p>
        <div class="value">${statementsToCheck.length}</div>
        <p class="sub">past due + next 7 days</p>
      </article>`;

    document.getElementById("safeSpendList").innerHTML = orderedAccounts().filter(a=>!isSavingsAccount(a)).map(a=>{
      const safe = safeToSpend(a);
      const metric = billsMetricForAccount(a);
      return `<div class="row clickable" onclick="openAccountDetail('${a.id}', 'dashboard')">
        <div>
          <div class="row-title">${a.emoji || "💵"} ${a.name}</div>
          <div class="row-sub">${safe.label} • ${metric.sub}</div>
        </div>
        <div class="amount ${safe.amount>75?'good':safe.amount>0?'warn':'bad'}">${money(safe.amount)}</div>
      </div>`;
    }).join("");

    const upcoming = expandedTransactions(toISO(addMonths(new Date(), 1)))
      .filter(tx => tx.date >= todayISO() && tx.date <= toISO(new Date(Date.now()+14*864e5)))
      .slice(0,10);

    document.getElementById("upcomingList").innerHTML = upcoming.length ? upcoming.map(tx=>{
      const cat = categoryById(tx.categoryId);
      const acctText = transactionAccountText(tx);
      const isPositive = tx.type === "income" || tx.type === "paycheck";
      return `<div class="upcoming-row" data-tx="${tx.originalId || tx.id}" data-generated="${!!tx.generated}" data-original-date="${tx.originalDate || tx.date}" data-occurrence-date="${tx.date}" onclick="openTransaction('${tx.originalId || tx.id}',{generated:${!!tx.generated}, occurrenceOriginalDate:'${tx.originalDate || tx.date}', occurrenceDate:'${tx.date}'})">
        <div class="upcoming-main">
          <div class="row-title">${cat.emoji} ${tx.title}</div>
          <div class="row-sub">${displayDateWithOverride(tx)} • ${cat.name} • ${acctText}</div>
        </div>
        <div class="amount ${isPositive?'good':'bad'}">${isPositive?'+':'-'}${money(tx.amount)}</div>
      </div>`;
    }).join("") : `<div class="empty">No upcoming transactions in the next 14 days.</div>`;

    document.getElementById("debtSnapshot").innerHTML = `
      <div class="action-center-v2">
        <section class="action-section-v2">
          <div class="action-section-title">
            <h4>Needs attention</h4>
            <span>${attention.length} item(s)</span>
          </div>
          <div class="action-list-v2">
            ${attention.length ? attention.map(item=>`<div class="action-row-v2 clickable ${item.level}" onclick="${item.action}">
              <div class="action-left">
                <span class="action-symbol">${item.level==="bad" ? "🚨" : "⚠️"}</span>
                <div>
                  <div class="row-title">${item.title}</div>
                  <div class="row-sub">${item.sub}</div>
                </div>
              </div>
            </div>`).join("") : `<div class="empty">Nothing needs attention right now.</div>`}
          </div>
        </section>

        <section class="action-section-v2">
          <div class="action-section-title">
            <h4>Debt payments due soon</h4>
            <span>next 30 days${dueSoonExtra ? ` • showing first ${dueSoonRows.length}` : ""}</span>
          </div>
          <div class="action-list-v2">
            ${dueSoonRows.length ? dueSoonRows.map(d=>{
              const planned = hasPlannedDebtPayment(d, d.nextDue);
              const good = planned || ["paid","autopay","scheduled"].includes(d.paymentStatus);
              return `<div class="action-row-v2 debt-due clickable" onclick="openDebtDetail('${d.id}')">
                <div class="action-left">
                  <span class="action-symbol">${d.emoji || "💳"}</span>
                  <div>
                    <div class="row-title">${d.name}</div>
                    <div class="row-sub">Due ${d.nextDue} • Min ${debtMinDueText(d)}</div>
                    <div class="row-sub">${debtPaymentStatusLabel(d.paymentStatus)}${planned ? " • payment planned" : ""}</div>
                  </div>
                </div>
                <div class="debt-status-pill ${good ? "good" : "warn"}">${planned ? "Planned" : debtPaymentStatusLabel(d.paymentStatus)}</div>
              </div>`;
            }).join("") : `<div class="empty">No debt due dates in the next 30 days.</div>`}
            ${dueSoonExtra ? `<div class="action-row-v2 clickable" onclick="setView('debts')"><div class="action-left"><span class="action-symbol">➕</span><div><div class="row-title">${dueSoonExtra} more due soon</div><div class="row-sub">Open Debts to review the rest.</div></div></div></div>` : ""}
          </div>
        </section>

        <section class="action-section-v2">
          <div class="action-section-title">
            <h4>Credit card statements</h4>
            <span>past due + next 7 days</span>
          </div>
          <div class="action-list-v2">
            ${statementsToCheck.length ? statementsToCheck.map(d=>{
              const upcoming = d.nextStatementDate > todayISO();
              return `<div class="action-row-v2 clickable" onclick="openDebtDetail('${d.id}')">
              <div class="action-left">
                <span class="action-symbol">${d.emoji || "💳"}</span>
                <div>
                  <div class="row-title">${d.name}</div>
                  <div class="row-sub">${d.nextStatementDate < todayISO() ? "Past due / check" : "Expected around"} ${d.nextStatementDate}</div>
                  <div class="row-sub">Previous statement ${d.statementDate}${d.statementBalance ? ` • ${money(d.statementBalance)}` : ""}</div>
                </div>
              </div>
              <div class="debt-status-pill ${upcoming ? "warn" : "bad"}">${upcoming ? "Upcoming" : "Check statement"}</div>
            </div>`;
            }).join("") : `<div class="empty">No credit card statements past due or expected in the next 7 days.</div>`}
          </div>
        </section>
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
      <span class="tx-name">${highlighted ? cat.emoji : "◦"} ${calendarEntryLabel(tx)}</span>
      <span class="tx-chip-amount">${isPositive?'+':'-'}${money(tx.amount)}</span>
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
    const visibleTx = day.dayTx.slice(0,3);
    const hiddenCount = Math.max(0, day.dayTx.length - visibleTx.length);
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

function renderAccounts(){
  document.getElementById("accountList").innerHTML = orderedAccounts().map(a=>`
    <div class="account-card tinted-card" draggable="true" data-id="${a.id}" style="--card-color:${a.color || "#8c6f4d"}; background:${hexToSoft(a.color || "#8c6f4d")}" onclick="openAccountDetail('${a.id}', 'accounts')">
      <div><div class="row-title">${a.emoji || "💵"} ${a.name}</div><div class="row-sub">${a.owner} • ${a.paycheckAccount ? "personal/paycheck" : "shared/other"}</div></div>
      <div><div class="label">Actual</div><div class="amount">${money(accountBalance(a.id,false,todayISO()))}</div></div>
      <div><div class="label">${billsMetricForAccount(a).label}</div><div class="amount ${isSavingsAccount(a) ? "good" : "bad"}">${money(billsMetricForAccount(a).amount)}</div><div class="row-sub">${billsMetricForAccount(a).sub}</div></div>
      ${isSavingsAccount(a)
        ? `<div>
            <div class="label">${savingsGoalAmount(a) ? "Left to Goal" : "Goal"}</div>
            <div class="amount">${savingsGoalAmount(a) ? money(savingsGoalRemaining(a)) : "Not set"}</div>
            <div class="row-sub">${savingsGoalAmount(a) ? `${savingsGoalProgress(a)}% of ${money(savingsGoalAmount(a))}${a.goalName ? ` • ${a.goalName}` : ""}` : "set a savings goal"}</div>
          </div>`
        : `<div><div class="label">Safe</div><div class="amount good">${money(safeToSpend(a).amount)}</div></div>`}
      <div class="inline-actions account-reorder-actions">
        <button class="ghost tiny" onclick="event.stopPropagation(); moveAccount('${a.id}', -1)">↑</button>
        <button class="ghost tiny" onclick="event.stopPropagation(); moveAccount('${a.id}', 1)">↓</button>
        <button class="ghost small" onclick="event.stopPropagation(); simpleAccount('${a.id}')">Edit</button>
      </div>
    </div>`).join("");
  setupReorder(".account-card[data-id]", "account");
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

  return {start: today, end: toISO(addDays(now, 90)), label:"next 90 days"};
}

function forecastWindowTransactions(accountId, untilISO){
  return visibleTransactionsForAccount(accountId, untilISO);
}

function renderForecastRangeControl(accountId){
  accountForecastRange = cleanAccountForecastRange(accountForecastRange);
  const acc = accountById(accountId);
  return `<label class="forecast-range-label">Forecast range
    <select onchange="accountForecastRange=this.value; saveUiPrefs(); renderAccountDetail()">
      <option value="today-forward" ${accountForecastRange==="today-forward"?"selected":""}>Today forward</option>
      <option value="this-month" ${accountForecastRange==="this-month"?"selected":""}>This month</option>
      ${acc?.paycheckAccount ? `<option value="next-paycheck" ${accountForecastRange==="next-paycheck"?"selected":""}>Through next paycheck</option>` : ""}
      <option value="next-30" ${accountForecastRange==="next-30"?"selected":""}>Next 30 days</option>
      <option value="next-60" ${accountForecastRange==="next-60"?"selected":""}>Next 60 days</option>
      <option value="next-90" ${accountForecastRange==="next-90"?"selected":""}>Next 90 days</option>
    </select>
  </label>`;
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

  return `<div class="account-balance-strip">
    <div class="mini-balance-card">
      <div class="label">Cleared balance</div>
      <div class="amount">${money(cleared)}</div>
      <div class="row-sub">bank balance / cleared only</div>
    </div>
    <div class="mini-balance-card">
      <div class="label">Projected 30 days</div>
      <div class="amount">${money(projected30)}</div>
      <div class="row-sub">after planned + cleared</div>
    </div>
    <div class="mini-balance-card">
      <div class="label">Projected 90 days</div>
      <div class="amount">${money(projected90)}</div>
      <div class="row-sub">longer forecast</div>
    </div>
    ${expectedIn90 ? `<div class="mini-balance-card">
      <div class="label">Expected reimbursements</div>
      <div class="amount good">${money(expectedIn90)}</div>
      <div class="row-sub">pending / not available yet</div>
    </div>` : ""}
  </div>`;
}

function renderAccountDetail(){
  const a = accountById(selectedAccountId);
  if(!a){ setView("accounts"); return; }

  let txs = [];
  let rangeInfo = {start:"1900-01-01", end:todayISO(), label:""};
  let balances = {};

  if(accountDetailMode === "bank"){
    transactionFilters.status = "cleared";
    transactionFilters.sort = "date-desc";
    if(transactionFilters.dateRange === "upcoming-90") transactionFilters.dateRange = "all";
    saveUiPrefs();
    txs = visibleTransactionsForAccount(a.id, todayISO())
      .filter(tx => tx.status === "cleared" && tx.date <= todayISO());
    balances = accountBankBalanceMap(a.id, todayISO());
  } else {
    if(transactionFilters.status === "cleared") transactionFilters.status = "all";
    transactionFilters.sort = "date-asc";
    accountForecastRange = cleanAccountForecastRange(accountForecastRange);
    saveUiPrefs();
    rangeInfo = forecastRangeDates(accountForecastRange);
    txs = forecastWindowTransactions(a.id, rangeInfo.end)
      .filter(tx => tx.date >= rangeInfo.start && tx.date <= rangeInfo.end);
    balances = accountRunningBalanceMap(a.id, rangeInfo.end, rangeInfo.start);
  }

  const filtered = filteredLedgerTransactions(txs);

  document.getElementById("accountDetailContent").innerHTML = `
    <div class="detail-head">
      <div>
        <button class="ghost small" onclick="setView(accountBackTarget)">← Back</button>
        <h3 style="margin-top:12px"><span class="visual-dot" style="background:${a.color || "#8c6f4d"}"></span>${a.emoji || "💵"} ${a.name}</h3>
        <p class="hint">${a.owner}${isSavingsAccount(a) ? ` • Savings / not for spending${savingsGoalAmount(a) ? ` • Goal ${money(savingsGoalAmount(a))} • Left ${money(savingsGoalRemaining(a))}` : ""}` : ` • ${billsMetricForAccount(a).label}: ${money(billsMetricForAccount(a).amount)} (${billsMetricForAccount(a).sub}) • Safe ${money(safeToSpend(a).amount)}`}</p>
      </div>
      <div class="detail-actions">
        <button class="primary" onclick="openTransaction(null,{accountId:'${a.id}'})">+ Transaction</button>
        <button class="ghost" onclick="openTransferFromAccount('${a.id}')">↔ Transfer</button>
        <button class="ghost" onclick="openPendingReimbursement('${a.id}')">IOU / reimbursement</button>
        <button class="ghost" onclick="simpleAccount('${a.id}')">Edit account</button>
      </div>
    </div>

    ${renderAccountBalanceCards(a.id)}

    <div class="account-mode-tabs">
      <button class="${accountDetailMode==="bank" ? "active" : ""}" onclick="accountDetailMode='bank'; saveUiPrefs(); renderAccountDetail()">Bank View</button>
      <button class="${accountDetailMode==="forecast" ? "active" : ""}" onclick="accountDetailMode='forecast'; saveUiPrefs(); renderAccountDetail()">Forecast View</button>
      ${accountDetailMode==="forecast" ? renderForecastRangeControl(a.id) : ""}
    </div>

    <section class="panel">
      <div class="panel-head">
        <h3>${accountDetailMode==="bank" ? "Bank / cleared transactions" : "Forecast / planned transactions"}</h3>
        <span class="hint">${filtered.length} shown of ${txs.length} • ${accountDetailMode==="bank" ? "newest first, cleared only" : `${rangeInfo.label}, projected balance`}</span>
      </div>
      ${renderTransactionFilters({hideSort:true, accountMode:accountDetailMode})}
      ${renderLedger(filtered, {accountId:a.id, runningBalances:balances, mode:accountDetailMode})}
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
    const accountScoped = currentView === "accountDetail";
    if(accountScoped){
      dateMatch = true;
    } else if(transactionFilters.dateRange === "upcoming-90"){
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

function renderTransactionFilters(options={}){
  const hideSort = !!options.hideSort;
  const accountMode = options.accountMode || "";
  return `<div class="transaction-filters">
    <label>Search
      <input value="${transactionFilters.search || ""}" placeholder="Search transactions" oninput="setTransactionFilter('search', this.value)">
    </label>    ${accountMode === "bank" ? "" : `<label>Status
      <select onchange="setTransactionFilter('status', this.value)">
        <option value="all" ${transactionFilters.status==="all"?"selected":""}>All statuses</option>
        <option value="planned" ${transactionFilters.status==="planned"?"selected":""}>Planned</option>
        <option value="cleared" ${transactionFilters.status==="cleared"?"selected":""}>Cleared</option>
      </select>
    </label>`}
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
        context = `Expected reimbursement from ${accountById(tx.accountId)?.name || "account"} (pending / not counted yet)`;
      } else if(showBalance && isPendingReimbursementTx(tx) && tx.accountId === options.accountId){
        context = `Pending reimbursement to ${accountById(tx.transferToAccountId)?.name || "account"}`;
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

function renderBudgets(){
  const now = new Date(), start = toISO(startOfMonth(now)), end = toISO(endOfMonth(now));
  document.getElementById("budgetList").innerHTML = data.budgets.map(b=>{
    const spent = expandedTransactions(end).filter(tx => tx.date >= start && tx.date <= end && tx.accountId === b.accountId && tx.categoryId === b.categoryId && tx.type !== "income" && tx.status === "cleared").reduce((s,tx)=>s+tx.amount,0);
    const pct = Math.min(100, b.amount ? (spent/b.amount)*100 : 0);
    const acc = accountById(b.accountId), cat = categoryById(b.categoryId);
    return `<div class="row">
      <div style="flex:1"><div class="row-title">${acc?.name || "Unknown"} • <span class="cat-preview" style="background:${hexToSoft(cat.color)}">${cat.emoji} ${cat.name}</span></div>
      <div class="row-sub">${money(spent)} spent of ${money(b.amount)}</div><div class="progress"><span style="width:${pct}%"></span></div></div>
      <div class="amount">${money(Math.max(0,b.amount-spent))} left</div>
      <button class="ghost small" onclick="simpleBudget('${b.id}')">Edit</button>
    </div>`;
  }).join("");
}


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
function bnplPaymentRowsHTML(total, count, firstDate, frequencyDays){
  const amounts = splitAmount(total, count);
  const first = parseDate(firstDate || todayISO());
  return amounts.map((amt, i)=>{
    const due = toISO(addDays(first, i * Number(frequencyDays || 14)));
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
  document.getElementById("debtGroups").innerHTML = creditCardUtilizationSummariesHTML() + `<div class="panel-actions debt-label-actions"><button class="primary small" onclick="addBNPLPurchase()">+ BNPL purchase</button><button class="ghost small" onclick="editDebtTypes()">Edit debt category labels</button></div>` + Object.entries(groupedType).map(([type,debts])=>{
    const typeTotal = debts.reduce((s,d)=>s+debtAmountLeftNow(d),0);
    const byCompany = groupBy(orderedDebts(debts), "company");
    return `<details class="debt-type-section" ${isDebtExpanded("openDebtTypes", type) ? "open" : ""} ontoggle="rememberExpanded('openDebtTypes','${type}',this.open)">
      <summary class="debt-type-summary">
        <span>${debtTypeLabel(type)}</span>
        <span class="debt-type-summary-actions">
          <button class="ghost tiny" onclick="event.preventDefault(); event.stopPropagation(); expandDebtTypeAccounts('${type}')">Expand accounts</button>
          <button class="ghost tiny" onclick="event.preventDefault(); event.stopPropagation(); collapseDebtTypeAccounts('${type}')">Collapse accounts</button>
          <span>${money(typeTotal)} • ${debts.length} account${debts.length === 1 ? "" : "s"} ▾</span>
        </span>
      </summary>
      <div class="debt-type-body">
        ${Object.entries(byCompany).map(([company,cards])=>`
          <div class="debt-company ${isDebtExpanded("openDebtCompanies", debtCompanyKey(type, company)) ? "open" : ""}" onclick="this.classList.toggle('open'); rememberExpanded('openDebtCompanies', debtCompanyKey('${type}', '${company.replaceAll("'", "\'")}'), this.classList.contains('open'))">
            <strong>${company}</strong>
            <span>${money(cards.reduce((s,d)=>s+debtAmountLeftNow(d),0))} ▾</span>
          </div>
          <div class="debt-cards ${isDebtExpanded("openDebtCompanies", debtCompanyKey(type, company)) ? "open" : ""}">
            ${orderedDebts(cards).map(d=>{
              const util = debtUtilization(d);
              const bal = debtAmountLeftNow(d);
              const displayStatus = debtDisplayPaymentStatus(d);
              const statusClass = debtPaymentStatusClass(displayStatus);
              return `<div class="debt-account-card tinted-card clickable ${d.frozenLocked ? "debt-frozen" : ""}" draggable="true" data-id="${d.id}" style="--card-color:${d.color || "#8c6f4d"}; background:${hexToSoft(d.color || "#8c6f4d")}" onclick="openDebtDetail('${d.id}')">
                <div>
                  <div class="row-title">${d.frozenLocked ? "🔒 " : ""}${d.emoji || "💳"} ${d.name}</div>
                  <div class="row-sub">${d.owner} • ${debtFrozenText(d)}${d.apr ? ` • ${d.apr}% APR` : ""}</div>
                </div>
                <div>
                  <div class="label">Current</div>
                  <div class="amount bad">${money(bal)}</div>
                  <div class="row-sub">${debtStatementLine(d)}</div>
                  ${debtNextStatementText(d) ? `<div class="row-sub">${debtNextStatementText(d)}</div>` : (debtAfterPaymentText(d) ? `<div class="row-sub">${debtAfterPaymentText(d)}</div>` : "")}
                </div>
                <div>
                  <div class="label">Credit line</div>
                  <div class="row-sub">${debtCreditLineText(d)}</div>
                  ${d.limit && !isBNPLDebt(d) && !isMedicalDebt(d) && !isLoanDebt(d) ? `<div class="row-sub">${debtCreditLineSubText(d, bal, util)}</div>` : (util !== null ? `<div class="row-sub">${util}% used</div>` : "")}
                </div>
                <div>
                  <div class="label">Due / Payment</div>
                  <div class="row-sub">${debtDueText(d)}</div>
                  <div class="row-sub">${debtMonthlyPaymentText(d)}</div>
                </div>
                <div>
                  <div class="label">Status</div>
                  <div class="debt-status-pill ${statusClass}">${debtPaymentStatusLabel(displayStatus)}</div>
                  <button class="ghost tiny" onclick="event.stopPropagation(); quickDebtDue('${d.id}')">Update</button>
                </div>
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
      <div class="card mini"><p class="eyebrow">Payment status</p><div class="debt-status-pill ${debtPaymentStatusClass(d.paymentStatus)}">${debtPaymentStatusLabel(d.paymentStatus)}</div><p class="sub">Extra: ${money(Number(d.manualExtra || 0))}</p></div>
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
  if(!d){ setView("debts"); return; }
  const txs = visibleTransactionsForDebt(d.id, toISO(addMonths(new Date(),3))).sort((a,b)=>b.date.localeCompare(a.date));
  const currentBal = debtAmountLeftNow(d);
  const util = debtUtilization(d);

  document.getElementById("debtDetailContent").innerHTML = `
    <div class="detail-head">
      <div>
        <button class="ghost small" onclick="setView('debts')">← Back to debts</button>
        <h3 style="margin-top:12px"><span class="visual-dot" style="background:${d.color || "#8c6f4d"}"></span>${d.emoji || "💳"} ${d.company} • ${d.name}</h3>
        <p class="hint">${d.type} • ${d.owner} • ${debtFrozenText(d)}${d.apr ? ` • ${d.apr}% APR` : ""}</p>
      </div>
      <div class="detail-actions">
        <button class="primary" onclick="openTransaction(null,{debtAccountId:'${d.id}', type:'expense'})">+ Card/Klarna spend</button>
        <button class="ghost" onclick="openTransaction(null,{linkedDebtId:'${d.id}', type:'transfer'})">+ Payment</button>
        <button class="ghost" onclick="simpleDebt('${d.id}')">Edit debt</button>
        <button class="ghost" onclick="quickDebtDue('${d.id}')">Update due/min</button>
        ${isLoanDebt(d) ? `<button class="ghost" onclick="openLoanBalanceAdjustment('${d.id}')">Adjust balance</button>` : ""}
        ${Number(debtMonthlyPaymentAmount(d) || 0) && d.dueDate ? `<button class="ghost" onclick="createDebtMinPayment('${d.id}')">Plan payment</button>` : ""}
      </div>
    </div>

    <section class="panel">
      ${debtDetailMetricsHTML(d, currentBal, util)}
      ${d.notes ? `<div class="notes debt-notes"><b>Notes:</b> ${d.notes}</div>` : ""}
    </section>

    <section class="panel">
      <div class="panel-head"><h3>Transactions</h3><span class="hint">${filteredLedgerTransactions(txs).length} shown of ${txs.length}</span></div>
      ${renderTransactionFilters()}
      ${renderLedger(filteredLedgerTransactions(txs))}
    </section>`;
  attachTransactionContextMenus();
}


function templateKey(title){
  return String(title || "").trim().toLowerCase();
}
function cleanTemplateFromTx(tx){
  // Transaction title autofill should only remember merchant/basic description fields.
  // Do not save type/status or account/debt/transfer routing. A title like “Les Schwab”
  // might be a card charge, a cash expense, or a payment depending on where Mak starts.
  return {
    id: tx.templateId || uid(),
    title: String(tx.title || "").trim(),
    categoryId: tx.categoryId || "unassigned",
    notes: tx.notes || ""
  };
}
function rememberTransactionTemplate(tx){
  if(!tx || !tx.title || !String(tx.title).trim()) return;
  data.settings ||= {};
  data.settings.transactionTemplates ||= [];

  const tpl = cleanTemplateFromTx(tx);
  const key = templateKey(tpl.title);
  if(!key) return;

  const existing = data.settings.transactionTemplates.find(t => templateKey(t.title) === key);
  if(existing){
    Object.assign(existing, {...tpl, id: existing.id});
  } else {
    data.settings.transactionTemplates.push(tpl);
  }

  data.settings.transactionTemplates.sort((a,b)=>String(a.title || "").localeCompare(String(b.title || "")));
}
function matchingTransactionTemplates(query){
  const q = templateKey(query);
  if(!q) return [];
  return (data.settings?.transactionTemplates || [])
    .filter(t => templateKey(t.title).includes(q))
    .slice(0,8);
}
function applyTransactionTemplate(templateId){
  const tpl = (data.settings?.transactionTemplates || []).find(t => t.id === templateId);
  if(!tpl) return;

  const txTitleEl = document.getElementById("txTitle");
  const txCategoryEl = document.getElementById("txCategory");
  const txNotesEl = document.getElementById("txNotes");

  if(txTitleEl) txTitleEl.value = tpl.title || txTitleEl.value;
  if(txCategoryEl && tpl.categoryId) txCategoryEl.value = tpl.categoryId;
  // Intentionally do not autofill type/status/account/card/debt/transfer routing.
  // Templates only suggest the title/category/notes so routing stays intentional.
  if(txNotesEl && tpl.notes && !txNotesEl.value) txNotesEl.value = tpl.notes;

  updateTransactionFormUI();
  hideTemplateSuggestions();
}
function renderTemplateSuggestions(){
  try{
    const box = document.getElementById("txTemplateSuggestions");
    const txTitleEl = document.getElementById("txTitle");
    if(!box || !txTitleEl) return;

    const matches = matchingTransactionTemplates(txTitleEl.value);
    if(!matches.length){
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = matches.map(t=>{
      const cat = categoryById(t.categoryId || "unassigned");
      return `<div class="template-suggestion-row">
        <button type="button" class="template-suggestion-main" data-template-id="${t.id}">
          <span><b>${t.title}</b><small>${cat.emoji} ${cat.name}</small></span>
        </button>
        <button type="button" class="template-suggestion-delete" data-template-delete-inline="${t.id}" title="Delete this saved suggestion" aria-label="Delete saved suggestion ${String(t.title || '').replace(/"/g, '&quot;')}">×</button>
      </div>`;
    }).join("");

    box.querySelectorAll("[data-template-id]").forEach(btn=>{
      btn.onclick = () => applyTransactionTemplate(btn.dataset.templateId);
    });
    box.querySelectorAll("[data-template-delete-inline]").forEach(btn=>{
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        deleteTemplateSuggestion(btn.dataset.templateDeleteInline);
      };
    });

    box.classList.add("open");
  } catch(err){
    console.warn("Template suggestions could not render", err);
  }
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
    saveData();
    renderTemplateSuggestions();
    renderTransactionTemplates();
  }
}
function renderTransactionTemplates(){
  const list = document.getElementById("transactionTemplateList");
  if(!list) return;
  data.settings ||= {};
  data.settings.transactionTemplates ||= [];

  const templates = data.settings.transactionTemplates;
  if(!templates.length){
    list.innerHTML = `<div class="empty">No templates yet. Saving a transaction will remember its title/type/category automatically.</div>`;
    return;
  }

  list.innerHTML = templates.map(t=>{
    const cat = categoryById(t.categoryId || "unassigned");
    return `<div class="template-row">
      <div>
        <div class="row-title">${t.title}</div>
        <div class="row-sub">${cat.emoji} ${cat.name}</div>
      </div>
      <div class="template-actions">
        <button class="ghost small" data-template-edit="${t.id}">Edit</button>
        <button class="danger ghost small" data-template-delete="${t.id}">Delete</button>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll("[data-template-edit]").forEach(btn=>{
    btn.onclick = () => simpleTemplate(btn.dataset.templateEdit);
  });
  list.querySelectorAll("[data-template-delete]").forEach(btn=>{
    btn.onclick = () => deleteTemplate(btn.dataset.templateDelete);
  });
}
function deleteTemplate(id){
  if(!confirm("Delete this transaction template?")) return;
  data.settings ||= {};
  data.settings.transactionTemplates = (data.settings.transactionTemplates || []).filter(t=>t.id !== id);
  saveData();
}
function simpleTemplate(id=null){
  data.settings ||= {};
  data.settings.transactionTemplates ||= [];
  const tpl = id ? data.settings.transactionTemplates.find(t=>t.id===id) : null;

  simpleTitle.textContent = tpl ? "Edit transaction template" : "Add transaction template";
  simpleFields.innerHTML = `
    <label>Title<input id="sTplTitle" value="${tpl?.title || ""}" placeholder="McDonalds" required></label>
    <label>Category<select id="sTplCategory">${sortedCategories().map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join("")}</select></label>
    <label>Notes<textarea id="sTplNotes">${tpl?.notes || ""}</textarea></label>
    <p class="hint">Templates do not save transaction type/status or account routing, so they will not accidentally move a transaction to the wrong account.</p>
  `;

  const catEl = document.getElementById("sTplCategory");

  if(tpl){
    if(catEl) catEl.value = tpl.categoryId || "unassigned";
  }

  simpleSubmit = ()=>{
    const titleEl = document.getElementById("sTplTitle");
    if(!titleEl || !titleEl.value.trim()) return;
    const payload = {
      id: tpl?.id || uid(),
      title: titleEl.value.trim(),
      categoryId: document.getElementById("sTplCategory")?.value || "unassigned",
      notes: document.getElementById("sTplNotes")?.value || ""
    };

    const existing = data.settings.transactionTemplates.find(t => templateKey(t.title) === templateKey(payload.title));
    if(tpl) Object.assign(tpl, payload);
    else if(existing) Object.assign(existing, {...payload, id:existing.id});
    else data.settings.transactionTemplates.push(payload);

    data.settings.transactionTemplates.sort((a,b)=>String(a.title || "").localeCompare(String(b.title || "")));
  };
  simpleDelete = tpl ? ()=>deleteTemplate(tpl.id) : null;
  deleteSimpleBtn.style.display = tpl ? "inline-block" : "none";
  simpleModal.showModal();
}


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
    list.innerHTML = `<div class="empty">No undoable changes recorded yet. New saves will appear here.</div>`;
    return;
  }

  list.innerHTML = history.slice(0,8).map((item, index)=>`
    <details class="template-row change-row" ${index === 0 ? "open" : ""}>
      <summary>
        <span>
          <span class="row-title">${item.label || "Changed Money Nest data"}</span>
          <span class="row-sub">${recentChangeTimeLabel(item.at)}</span>
        </span>
        ${index === 0 ? `<button type="button" class="ghost small" onclick="event.preventDefault(); event.stopPropagation(); undoLastChange();">Undo</button>` : ""}
      </summary>
      <div class="change-detail">${changeDetailsHTML(item, index)}</div>
    </details>`).join("");
}
function undoLastChange(){
  const history = loadChangeHistory();
  const item = history.shift();
  if(!item){ alert("No recent change to undo."); return; }
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
  const categoryList = document.getElementById("categoryList");
  if(categoryList){
    categoryList.innerHTML = sortedCategories().map(c=>`
      <div class="category-row">
        <span class="cat-preview" style="background:${hexToSoft(c.color)}">${c.emoji} ${c.name}</span>
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
  if(templateCount) templateCount.textContent = `${data.settings?.transactionTemplates?.length || 0}`;

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
        ? "Delete only this occurrence?\n\nOK = this occurrence only\nCancel = whole recurring series"
        : "Save only this occurrence?\n\nOK = this occurrence only\nCancel = this and future occurrences");
      resolve(one ? "one" : "future");
      return;
    }

    const title = document.getElementById("recurringScopeTitle");
    const hint = document.getElementById("recurringScopeHint");
    const one = document.getElementById("scopeChoiceOne");
    const series = document.getElementById("scopeChoiceSeries");
    let all = document.getElementById("scopeChoiceAll");
    if(!all && series?.parentElement){
      all = document.createElement("button");
      all.type = "button";
      all.className = "scope-choice danger-choice";
      all.id = "scopeChoiceAll";
      all.innerHTML = `<b>Delete the whole recurring series</b><span>Remove this repeating bill completely.</span>`;
      series.parentElement.appendChild(all);
    }
    const oneTitle = document.getElementById("scopeChoiceOneTitle");
    const oneSub = document.getElementById("scopeChoiceOneSub");
    const seriesTitle = document.getElementById("scopeChoiceSeriesTitle");
    const seriesSub = document.getElementById("scopeChoiceSeriesSub");
    const cancel = document.getElementById("cancelRecurringScope");
    const close = document.getElementById("closeRecurringScope");

    if(mode === "delete"){
      if(title) title.textContent = "Delete recurring transaction";
      if(hint) hint.textContent = "Choose how much of this repeating transaction to delete.";
      if(oneTitle) oneTitle.textContent = "Delete this occurrence only";
      if(oneSub) oneSub.textContent = "Remove only this one date.";
      if(seriesTitle) seriesTitle.textContent = "Delete this and future occurrences";
      if(seriesSub) seriesSub.textContent = "Keep past occurrences, stop this repeating transaction from this date forward.";
      if(series) series.classList.add("danger-choice");
      if(all) all.style.display = "block";
    } else {
      if(title) title.textContent = "Save recurring transaction";
      if(hint) hint.textContent = "Do you want this edit to affect only this date or the repeating transaction?";
      if(oneTitle) oneTitle.textContent = "This occurrence only";
      if(oneSub) oneSub.textContent = "Create a one-time change for this date.";
      if(seriesTitle) seriesTitle.textContent = "This and future occurrences / recurring series";
      if(seriesSub) seriesSub.textContent = "Update the repeating transaction from here forward.";
      if(series) series.classList.remove("danger-choice");
      if(all) all.style.display = "none";
    }

    const cleanup = (value)=>{
      one.onclick = null;
      series.onclick = null;
      if(all) all.onclick = null;
      cancel.onclick = null;
      close.onclick = null;
      modal.oncancel = null;
      modal.close();
      resolve(value);
    };

    one.onclick = ()=>cleanup("one");
    series.onclick = ()=>cleanup(mode === "delete" ? "future" : "future");
    if(all) all.onclick = ()=>cleanup("all");
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
function deleteRecurringSeriesAndOrphans(baseTx){
  if(!baseTx) return;
  const sig = transactionSeriesSignature(baseTx);
  const baseId = baseTx.originalId || baseTx.id;

  data.transactions = data.transactions.filter(tx=>{
    if(tx.id === baseId || tx.originalId === baseId) return false;

    // Remove orphaned related entries only when they look like the same bill/series.
    if(transactionSeriesSignature(tx) === sig){
      const sameRepeat = isRecurring(tx) || tx.generated || /monthly|weekly|every|day|repeats/i.test(tx.notes || "");
      if(sameRepeat) return false;
    }

    return true;
  });
}

function deleteRecurringOccurrence(baseTx, occurrenceOriginalDate, occurrenceDate){
  if(!baseTx) return;
  baseTx.dateOverrides ||= {};

  const skipValue = "9999-12-31";
  const targetOriginal = occurrenceOriginalDate || baseTx.date;
  const targetDisplay = occurrenceDate || occurrenceOriginalDate || baseTx.date;

  // Direct skip for the date we were given.
  if(targetOriginal){
    baseTx.dateOverrides[targetOriginal] = skipValue;
    if(baseTx.occurrenceOverrides) delete baseTx.occurrenceOverrides[targetOriginal];
  }

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
          baseTx.dateOverrides[originalISO] = skipValue;
          baseTx.dateOverrides[target] = skipValue;
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
  const cutoff = parseDate(originalDate || baseTx.date);
  const until = addDays(cutoff, -1);
  baseTx.recurrenceUntil = toISO(until);
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
  });
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

  const loanDebt = debtById(txDebt.value);
  const showLoanBreakdown = type === "transfer" && !!txDebt.value && isLoanDebt(loanDebt);
  const loanWrap = document.getElementById("txLoanBreakdownWrap");
  if(loanWrap) loanWrap.style.display = showLoanBreakdown ? "block" : "none";
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
}

["txType","txAccount","txDate","txDebt","txAmount","txLoanPrincipal","txLoanInterest","txLoanFees","txPaycheckHoursOverride"].forEach(id=>{
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

if(document.getElementById("txAutoPaycheck")){
  txAutoPaycheck.addEventListener("change", ()=>{
    updateTransactionFormUI();
  });
}

let txEditMeta = { generated:false, originalDate:"", occurrenceDate:"" };

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
    dateOverrides: {}
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
    dateOverrides:{},
    notes: formTx.notes || baseTx.notes || ""
  };

  // Mark the original occurrence as skipped by moving it way outside visible planning.
  deleteRecurringOccurrence(baseTx, occurrenceOriginalDate || baseTx.date, occurrenceDate || occurrenceOriginalDate || baseTx.date);
  return one;
}

function updateSeriesFromDate(baseTx, formTx, occurrenceOriginalDate){
  // First/base occurrence: update the recurring transaction directly.
  if(!occurrenceOriginalDate || occurrenceOriginalDate === baseTx.date){
    Object.assign(baseTx, {...formTx, id:baseTx.id, dateOverrides: baseTx.dateOverrides || {}, occurrenceOverrides: baseTx.occurrenceOverrides || {}});
    return;
  }

  // Future generated occurrence: end old series at this occurrence by skipping that occurrence forward,
  // then create a new recurring series beginning on the edited date.
  deleteRecurringOccurrence(baseTx, occurrenceOriginalDate || baseTx.date, occurrenceOriginalDate || baseTx.date);

  data.transactions.push({
    ...formTx,
    id: uid(),
    recurrence: formTx.recurrence || baseTx.recurrence || {type:"none", interval:1},
    repeat:false,
    dateOverrides:{}
  });
}

const txModal = document.getElementById("transactionModal");
document.getElementById("quickAddBtn").onclick = () => openTransaction();
if(document.getElementById("clearRecentBtn")) clearRecentBtn.onclick = ()=>{
  recentPlaces = [];
  try{ localStorage.removeItem(`${STORAGE_KEY}.recentPlaces`); } catch(err){}
  renderRecentPlaces();
};
document.getElementById("closeModal").onclick = () => txModal.close();
document.getElementById("cancelTxBtn").onclick = () => txModal.close();
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
  const scope = isRecurringEdit ? await askRecurringScope("save") : "future";
  if(isRecurringEdit && !scope) return;

  if(existing && isRecurringEdit && scope === "one"){
    saveRecurringOccurrenceOverride(existing, formTx, txEditMeta.originalDate || existing.date, txEditMeta.occurrenceDate || existing.date);
  } else if(existing && isRecurringEdit && scope === "future"){
    updateSeriesFromDate(existing, formTx, txEditMeta.originalDate || existing.date);
  } else if(existing){
    Object.assign(existing, {...formTx, dateOverrides: existing.dateOverrides || {}});
  } else {
    data.transactions.push(formTx);
  }

  rememberTransactionTemplate(formTx);
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

  let scope = "all";
  if(isRecurring(tx)){
    scope = await askRecurringScope("delete");
    if(!scope) return;
  } else if(!confirm("Delete this transaction?")){
    return;
  }

  deleteTransactionWithScope(id, scope, txEditMeta);
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

  modalTitle.textContent = tx ? "Edit transaction" : "Add transaction";
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

  const isRecurringEdit = !!tx && isRecurring(tx);

  deleteTxBtn.style.display = tx ? "inline-block" : "none";
  duplicateTxBtn.style.display = tx ? "inline-block" : "none";
  updateTransactionFormUI();
  txModal.showModal();
};

const simpleModal = document.getElementById("simpleModal");
let simpleSubmit = null, simpleDelete = null;
closeSimple.onclick = ()=>simpleModal.close();
cancelSimple.onclick = ()=>simpleModal.close();
simpleForm.onsubmit = e => {
  e.preventDefault();
  if(simpleSubmit) simpleSubmit();
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
window.simpleBudget = (id=null)=>{
  const b = id ? data.budgets.find(x=>x.id===id) : null;
  simpleTitle.textContent = b ? "Edit budget" : "Add budget";
  simpleFields.innerHTML = `
    <label>Account<select id="sAccount">${data.accounts.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}</select></label>
    <label>Category<select id="sCat">${sortedCategories().map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join("")}</select></label>
    <label>Monthly amount<input id="sAmount" type="number" step="0.01" value="${b?.amount ?? ""}" required></label>`;
  setTimeout(()=>{ if(b){ sAccount.value=b.accountId; sCat.value=b.categoryId; } },0);
  simpleSubmit = ()=>{ if(b){ b.accountId=sAccount.value; b.categoryId=sCat.value; b.amount=Number(sAmount.value); } else data.budgets.push({id:uid(), accountId:sAccount.value, categoryId:sCat.value, amount:Number(sAmount.value)}); };
  simpleDelete = b ? ()=>{ if(confirm("Delete this budget?")) data.budgets = data.budgets.filter(x=>x.id!==b.id); } : null;
  deleteSimpleBtn.style.display = b ? "inline-block" : "none";
  simpleModal.showModal();
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
    <label class="checkbox"><input id="cardPayCreateIou" type="checkbox"> Also create pending reimbursement / IOU to pay this cash account back later</label>
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
      <p class="hint">Pending reimbursements reduce the paying-later account forecast, but do not make the receiving account look like it already has the money.</p>
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
        notes: `Pending reimbursement for ${tx.title || "card purchase"} paid from ${accountById(to)?.name || "cash account"}.`,
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
  simpleTitle.textContent = "Plan pending reimbursement / IOU";
  simpleFields.innerHTML = `
    <p class="hint">Use this when one cash account fronts money and another account will pay it back later. The paying account plans for money leaving, but the receiving account only shows it as expected — not available — until cleared.</p>
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
      title: document.getElementById("reimbTitle")?.value || "Pending reimbursement",
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
      notes: document.getElementById("reimbNotes")?.value || "Pending reimbursement: does not increase the receiving account until cleared.",
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
      <label>Every how many days?
        <input id="bnplFrequency" type="number" min="1" step="1" value="14">
      </label>
    </div>

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

    const refresh = ()=>{
      const total = Number(bnplTotal.value || 0);
      const count = Math.max(1, Number(bnplCount.value || 1));
      const first = bnplFirstDate.value || todayISO();
      const freq = Math.max(1, Number(bnplFrequency.value || 14));
      bnplPayments.innerHTML = bnplPaymentRowsHTML(total, count, first, freq);
    };

    bnplRefreshSchedule.onclick = refresh;
    [bnplTotal, bnplCount, bnplFirstDate, bnplFrequency].forEach(el=>el.addEventListener("change", refresh));
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
      notes: `BNPL purchase: ${merchant}`
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
    <label>${isBnpl ? "Installment status" : "Payment status"}
      <select id="sPaymentStatus">
        <option value="not-set">Not set</option>
        <option value="planned">Planned</option>
        <option value="unpaid">Unpaid</option>
        <option value="scheduled">Scheduled</option>
        <option value="autopay">Autopay</option>
        <option value="paid">Paid</option>
        <option value="skip">Skip/Ignore</option>
      </select>
    </label>`;
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
      if(paymentStatusLabel){ paymentStatusLabel.style.display = ""; paymentStatusLabel.childNodes[0].textContent = "Payment status"; }
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
      paymentStatus:sPaymentStatus.value,
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
const addTemplateBtnEl = document.getElementById("addTemplateBtn");
if(addTemplateBtnEl) addTemplateBtnEl.onclick = () => simpleTemplate();
const undoLastChangeBtnEl = document.getElementById("undoLastChangeBtn");
if(undoLastChangeBtnEl) undoLastChangeBtnEl.onclick = undoLastChange;
const clearChangeHistoryBtnEl = document.getElementById("clearChangeHistoryBtn");
if(clearChangeHistoryBtnEl) clearChangeHistoryBtnEl.onclick = clearChangeHistory;
window.simpleCategory = (id=null)=>{
  const c = id ? categoryById(id) : null;
  simpleTitle.textContent = id ? "Edit category" : "Add category";
  simpleFields.innerHTML = `
    <label>Name<input id="sName" value="${id ? c.name : ""}" required></label>
    <label>Emoji<input id="sEmoji" value="${id ? c.emoji : ""}" placeholder="🍔"></label>
    <label>Color<input id="sColor" type="color" value="${id ? c.color : "#8c6f4d"}"></label>`;
  simpleSubmit = ()=>{
    const nameEl = document.getElementById("sName");
    const emojiEl = document.getElementById("sEmoji");
    const colorEl = document.getElementById("sColor");
    const nextName = (nameEl?.value || "").trim();
    const nextEmoji = emojiEl?.value || "";
    const nextColor = colorEl?.value || "#8c6f4d";

    if(!nextName) return;

    if(id){
      const target = data.categories.find(x=>x.id===id) || c;
      target.name = nextName;
      target.emoji = nextEmoji;
      target.color = nextColor;
    } else {
      const nextId = slug(nextName);
      const existing = data.categories.find(x=>x.id===nextId);
      if(existing){
        existing.name = nextName;
        existing.emoji = nextEmoji;
        existing.color = nextColor;
      } else {
        data.categories.push({id:nextId, name:nextName, emoji:nextEmoji, color:nextColor});
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


function billOccurrenceDisplayDate(tx){
  // Bills should show the next actionable occurrence:
  // - unpaid recent past/today = Due
  // - cleared recurring item = jump to the first future occurrence after today
  try{
    const todayISOValue = todayISO();
    const today = parseDate(todayISOValue);
    const start = parseDate(tx.date);
    const horizon = parseDate(toISO(addMonths(new Date(), 24)));

    let cursor = new Date(Math.max(start.getTime(), addDays(today, -60).getTime()));
    cursor = parseDate(toISO(cursor));

    let lastPastOrToday = "";
    let firstFuture = "";

    while(cursor <= horizon){
      if(recurrenceOccursOn(tx, cursor, start)){
        const originalISO = toISO(cursor);

        if(tx.recurrenceUntil && originalISO > tx.recurrenceUntil){
          cursor = addDays(cursor, 1);
          continue;
        }

        const moved = occurrenceDateFor(tx, cursor);

        // Skip occurrences that were explicitly removed. Check both the source
        // recurrence date and the moved/display date.
        if(moved === "9999-12-31" || tx.dateOverrides?.[originalISO] === "9999-12-31"){
          cursor = addDays(cursor, 1);
          continue;
        }

        if(moved <= todayISOValue){
          lastPastOrToday = moved;
        } else {
          firstFuture = moved;
          break;
        }
      }
      cursor = addDays(cursor, 1);
    }

    if(tx.status === "cleared"){
      // Once the current/base occurrence is paid, Bills should move forward.
      return firstFuture || lastPastOrToday || "";
    }

    return lastPastOrToday || firstFuture || "";
  } catch(err){
    console.warn("Could not calculate bill occurrence for", tx?.title, err);
    return tx?.date || todayISO();
  }
}

function billOccurrenceStatus(tx){
  const date = tx.nextDate || billOccurrenceDisplayDate(tx);
  const today = todayISO();

  if(tx.status === "cleared"){
    // If a future date was found, the bill is planned again.
    // If no future occurrence was found and it falls back to today/past, keep it Cleared.
    return date > today ? "planned" : "cleared";
  }

  if(date <= today) return "due";
  return "planned";
}
function billStatusBadge(tx){
  const status = billOccurrenceStatus(tx);
  const label = status === "cleared" ? "✓ Cleared" : status === "due" ? "⚠ Due" : "○ Planned";
  return `<span class="status-toggle ${status} bill-status-badge" title="${status === "due" ? "Due or overdue and not cleared" : "Next occurrence status"}">${label}</span>`;
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

function renderBills(){
  const list = document.getElementById("billsList");
  try{
    renderBillFilters();

    let recurring = data.transactions
      .filter(tx => {
        try{ return isRecurring(tx); } catch(err){ return false; }
      })
      .filter(tx => {
        try{ return billMatchesFilters(tx); } catch(err){ return false; }
      })
      .map(tx => ({...tx, nextDate: billOccurrenceDisplayDate(tx)}))
      .filter(tx => tx.nextDate);

    recurring.sort((a,b)=>{
      if((billFilters.sort || "date") === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0);
      if((billFilters.sort || "date") === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0);
      if((billFilters.sort || "date") === "category") return categoryById(a.categoryId).name.localeCompare(categoryById(b.categoryId).name);
      if((billFilters.sort || "date") === "account") return billAccountLabel(a).localeCompare(billAccountLabel(b));
      return String(a.nextDate || "").localeCompare(String(b.nextDate || ""));
    });

    if(!list) return;
    if(!recurring.length){
      list.innerHTML = `<div class="empty">No recurring transactions match those filters.</div>`;
      return;
    }

    list.innerHTML = recurring.map(tx => {
      const cat = categoryById(tx.categoryId);
      const account = billAccountLabel(tx);
      const route = tx.type === "transfer" ? transactionTransferLabel(tx) : `${account}${tx.linkedDebtId ? ` → ${debtById(tx.linkedDebtId)?.name || "debt"}` : ""}`;
      return `<div class="bill-card" data-tx="${tx.id}" data-original-date="${tx.nextDate}" data-occurrence-date="${tx.nextDate}" onclick="openTransaction('${tx.id}',{generated:true, occurrenceOriginalDate:'${tx.nextDate}', occurrenceDate:'${tx.nextDate}'})">
        <div>
          <div class="row-title">${cat.emoji} ${tx.title}</div>
          <div class="row-sub">${route}</div>
        </div>
        <div><span class="cat-preview" style="background:${hexToSoft(cat.color)}">${cat.emoji} ${cat.name}</span></div>
        <div class="bill-repeat">
          <div class="label">Repeats</div>
          <div class="row-sub">${recurrenceDescription(tx)}</div>
          <div class="row-sub">Next: ${tx.nextDate}</div>
        </div>
        <div class="tx-chip-actions">${billStatusBadge(tx)}<div class="amount bill-amount ${(tx.type==='income'||tx.type==='paycheck')?'good':'bad'}">${(tx.type==='income'||tx.type==='paycheck')?'+':'-'}${money(tx.amount)}</div></div>
      </div>`;
    }).join("");
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
document.querySelectorAll(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
prevMonth.onclick = ()=>{ calendarDate = addMonths(calendarDate,-1); renderCalendar(); };
nextMonth.onclick = ()=>{ calendarDate = addMonths(calendarDate,1); renderCalendar(); };
todayBtn.onclick = ()=>{ calendarDate = new Date(); renderCalendar(); };
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
    .map(tx => ({...tx, nextDate: billOccurrenceDisplayDate(tx)}))
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

  const categoryHeaders = ["id","name","emoji","color"];
  const categoryRows = data.categories.map(c=>({id:c.id, name:c.name, emoji:c.emoji || "", color:c.color || ""}));

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

  const budgetHeaders = ["id","accountId","categoryId","amount","period","notes"];
  const budgetRows = (data.budgets || []).map(b=>({
    id:b.id, accountId:b.accountId || "", categoryId:b.categoryId || "", amount:b.amount ?? "",
    period:b.period || "monthly", notes:b.notes || ""
  }));

  const txHeaders = [
    "id","date","title","amount","type","status","accountId","debtAccountId","categoryId","transferToAccountId","linkedDebtId",
    "pendingReimbursement","reimbursementToAccountId",
    "loanPrincipalAmount","loanInterestAmount","loanFeeAmount","loanBalanceAdjustment",
    "autoPaycheck","autoMakPaycheck","paycheckHoursOverride","autoPaycheckInfoJSON",
    "repeatType","repeatInterval","repeatWeekday","repeatOrdinal","weekendHandling","recurrenceUntil","dateOverridesJSON","occurrenceOverridesJSON","notes"
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
    dateOverridesJSON: JSON.stringify(tx.dateOverrides || {}),
    occurrenceOverridesJSON: JSON.stringify(tx.occurrenceOverrides || {}),
    notes:tx.notes || ""
  }));

  const templateHeaders = ["id","title","type","categoryId","accountId","debtAccountId","transferToAccountId","linkedDebtId","notes"];
  const templateRows = (data.settings?.transactionTemplates || []).map(t=>({
    id:t.id, title:t.title || "", type:t.type || "expense", categoryId:t.categoryId || "unassigned",
    accountId:t.accountId || "", debtAccountId:t.debtAccountId || "",
    transferToAccountId:t.transferToAccountId || "", linkedDebtId:t.linkedDebtId || "",
    notes:t.notes || ""
  }));

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
          c = {id: row.id || slug(row.name), name: row.name || "New Category", emoji: row.emoji || "", color: row.color || "#8c6f4d"};
          data.categories.push(c);
        } else {
          c.name = row.name || c.name;
          c.emoji = row.emoji || c.emoji;
          c.color = row.color || c.color;
        }
      });
      saveData();
      alert("Categories CSV imported.");
      return;
    }

    if(headers.includes("accountId") && headers.includes("categoryId") && headers.includes("period") && !headers.includes("title")){
      data.budgets = rows.map(row=>({
        id: row.id || uid(),
        accountId: row.accountId || "",
        categoryId: row.categoryId || "",
        amount: Number(row.amount || 0),
        period: row.period || "monthly",
        notes: row.notes || ""
      }));
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
        const payload = {
          id,
          title: row.title || "",
          type: row.type || "expense",
          categoryId: row.categoryId || "unassigned",
          accountId: row.accountId || "",
          debtAccountId: row.debtAccountId || "",
          transferToAccountId: row.transferToAccountId || "",
          linkedDebtId: row.linkedDebtId || "",
          notes: row.notes || ""
        };
        if(!payload.title) return;
        const existing = data.settings.transactionTemplates.find(t => t.id === id || templateKey(t.title) === templateKey(payload.title));
        if(existing) Object.assign(existing, {...payload, id: existing.id});
        else data.settings.transactionTemplates.push(payload);
      });
      data.settings.transactionTemplates.sort((a,b)=>String(a.title || "").localeCompare(String(b.title || "")));
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
        if(row.dateOverridesJSON){
          try{ tx.dateOverrides = JSON.parse(row.dateOverridesJSON); } catch(err){ console.warn("Bad dateOverridesJSON", err); }
        }
        if(row.occurrenceOverridesJSON){
          try{ tx.occurrenceOverrides = JSON.parse(row.occurrenceOverridesJSON); } catch(err){ console.warn("Bad occurrenceOverridesJSON", err); }
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

if(document.getElementById("backupBtn")) backupBtn.onclick = ()=>{ const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "money-nest-backup.json"; a.click(); };
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
      saveImportedBackupData(data);
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
