const { useState, useEffect, useRef, useMemo, useCallback } = React;
const Recharts = window.Recharts || window.recharts;
const ChartFallback = ({ children, style }) => React.createElement("div", { style: style || {} }, children || null);
const ChartNull = () => null;
const {
  PieChart = ChartFallback,
  Pie = ChartFallback,
  Cell = ChartNull,
  BarChart = ChartFallback,
  Bar = ChartNull,
  XAxis = ChartNull,
  YAxis = ChartNull,
  Tooltip = ChartNull,
  ResponsiveContainer = ChartFallback,
  LineChart = ChartFallback,
  Line = ChartNull,
  CartesianGrid = ChartNull,
  Legend = ChartNull,
  AreaChart = ChartFallback,
  Area = ChartNull
} = Recharts || {};

// ─── Utility helpers ───
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];
const nowTime = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
const toTimestamp = (dateStr, timeStr) => {
  try {
    if (!dateStr) return Date.now();
    const time = timeStr || "00:00";
    const dt = new Date(`${dateStr}T${time}:00`);
    if (isNaN(dt.getTime())) return Date.now();
    return dt.getTime();
  } catch (_e) {
    return Date.now();
  }
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyFormat = (currency = "RWF") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
    });
  } catch (_e) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  }
};
const fmtCur = (n, currency) => {
  try {
    const c = (currency ?? (typeof window !== "undefined" && window.__zt_currency) ?? "RWF");
    const rate = (typeof window !== "undefined" && typeof window.__zt_fxRate === "number") ? window.__zt_fxRate : 1;
    const nf = moneyFormat(c);
    return nf.format(Number(n || 0) * rate);
  } catch (_e) {
    return String(n ?? 0);
  }
};
// Convert a display-currency amount back into base currency.
// Base currency is the internal storage/calc currency for products/transactions.
const toBaseMoney = (amount) => {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 0;
  try {
    const rate = (typeof window !== "undefined" && typeof window.__zt_fxRate === "number") ? window.__zt_fxRate : 1;
    const r = Number(rate || 1);
    if (!Number.isFinite(r) || r <= 0) return n;
    return n / r;
  } catch (_e) {
    return n;
  }
};
const API_BASE = (() => {
  try {
    return (typeof window !== "undefined" && window.__zt_api_base) ? String(window.__zt_api_base) : "http://localhost:5051";
  } catch (_e) {
    return "http://localhost:5051";
  }
})();

async function apiJson(path, { method = "GET", body, token } = {}) {
  const url = String(path || "").startsWith("http") ? String(path) : `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_e) { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error ? String(data.error) : (data?.message ? String(data.message) : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
// Ensure default currency is RWF even before React runs.
if (typeof window !== "undefined") {
  window.__zt_currency = "RWF";
  if (typeof window.__zt_fxRate !== "number") window.__zt_fxRate = 1;
}
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const parseDate = (d) => new Date(d + "T00:00:00");
const isToday = (d) => d === today();
const isThisWeek = (d) => daysBetween(d, today()) <= 7 && daysBetween(d, today()) >= 0;
const isThisMonth = (d) => { const t = new Date(); const dd = parseDate(d); return dd.getMonth() === t.getMonth() && dd.getFullYear() === t.getFullYear(); };
const isThisYear = (d) => parseDate(d).getFullYear() === new Date().getFullYear();

const UNIT_DEFS = {
  kg: { type: "mass", factor: 1000 },
  hg: { type: "mass", factor: 100 },
  dag: { type: "mass", factor: 10 },
  g: { type: "mass", factor: 1 },
  dg: { type: "mass", factor: 0.1 },
  cg: { type: "mass", factor: 0.01 },
  mg: { type: "mass", factor: 0.001 },
  l: { type: "volume", factor: 1000 },
  dl: { type: "volume", factor: 100 },
  cl: { type: "volume", factor: 10 },
  ml: { type: "volume", factor: 1 },
  piece: { type: "count", factor: 1 },
  dozen: { type: "count", factor: 12 },
  bag: { type: "count", factor: 1 },
  box: { type: "count", factor: 1 },
  bottle: { type: "count", factor: 1 },
  packet: { type: "count", factor: 1 },
};
const UNITS = Object.keys(UNIT_DEFS);
const UNIT_FULL_NAMES = {
  kg: "kilogram",
  hg: "hectogram",
  dag: "decagram",
  g: "gram",
  dg: "decigram",
  cg: "centigram",
  mg: "milligram",
  l: "liter",
  dl: "deciliter",
  cl: "centiliter",
  ml: "milliliter",
  piece: "piece",
  dozen: "dozen",
  bag: "bag",
  box: "box",
  bottle: "bottle",
  packet: "packet",
};
const UNIT_ALIASES = {
  // Mass full forms
  kilogram: "kg", kilograms: "kg",
  hectogram: "hg", hectograms: "hg",
  decagram: "dag", decagrams: "dag",
  gram: "g", grams: "g",
  decigram: "dg", decigrams: "dg",
  centigram: "cg", centigrams: "cg",
  milligram: "mg", milligrams: "mg",

  // Volume full forms
  liter: "l", liters: "l", litre: "l", litres: "l",
  deciliter: "dl", deciliters: "dl",
  centiliter: "cl", centiliters: "cl",
  milliliter: "ml", milliliters: "ml",

  // Count forms
  piece: "piece", pieces: "piece", pcs: "piece",
  dozen: "dozen", dozens: "dozen",
  bag: "bag", bags: "bag",
  box: "box", boxes: "box",
  bottle: "bottle", bottles: "bottle",
  packet: "packet", packets: "packet",

  // Keep existing aliases
  liters: "l",
};
const normalizeUnit = (u = "") => {
  const unit = String(u).trim().toLowerCase().replace(/[^a-z]/g, "");
  return UNIT_ALIASES[unit] || unit;
};
const unitFull = (u) => UNIT_FULL_NAMES[normalizeUnit(u)] || normalizeUnit(u);
const LANGS = {
  en: "English",
  sw: "Kiswahili",
  rw: "Kinyarwanda",
  fr: "Français",
  zh: "中文",
};
const LOCALE_BY_LANG = { en: "en", sw: "sw", rw: "rw", fr: "fr", zh: "zh-CN" };
const localeForLang = (lang) => LOCALE_BY_LANG[lang] || "en";
const I18N = {
  en: {
    "common.language": "Language",
    "common.logout": "Log Out",
    "common.save": "Save",
    "common.saving": "Saving...",
    "common.saved": "Saved",
    "common.saveFailed": "Save failed",
    "common.saveTitle": "Save data to this device",
    "common.loading": "Loading...",
    "common.noDataDash.title": "Welcome to ZuriTrack!",
    "common.noDataDash.body1": "Your inventory is empty. Head to",
    "common.noDataDash.body2": "in the sidebar to add your first products.",
    "common.noDataDash.body3": "Products are created automatically — just type a name, enter quantity and cost, and you're done.",
    "common.orders": "orders",
    "common.entries": "entries",
    "common.unitsTotal": "units total",
    "common.margin": "margin",
    "common.totalInStock": "Total in stock",
    "common.noStockYet": "No stock yet. Add products to populate this chart.",
    "common.totalValue": "Total Value",
    "nav.dashboard": "Dashboard",
    "nav.uptime": "Uptime",
    "nav.stockIn": "Add Stock",
    "nav.stockOut": "Sell Product",
    "nav.inventory": "Inventory",
    "nav.reports": "Reports",
    "period.today": "Today",
    "period.weekly": "Weekly",
    "period.monthly": "Monthly",
    "period.yearly": "Yearly",
    "dashboard.salesPurchases": "Sales & Purchases",
    "dashboard.stockDistribution": "Stock Distribution",
    "dashboard.totalSales": "Total Sales",
    "dashboard.totalPurchases": "Total Purchases",
    "dashboard.netProfit": "Net Profit",
    "dashboard.itemsSold": "Items Sold",
    "dashboard.topSellingProducts": "Top Selling Products",
    "dashboard.lowStockAlerts": "Low Stock Alerts",
    "dashboard.recentTransactions": "Recent Transactions",
    "common.searchProducts": "Search products...",
    "common.sort.name": "Sort by Name",
    "common.sort.stock": "Sort by Stock",
    "common.sort.value": "Sort by Value",
    "reports.filters.from": "From",
    "reports.filters.to": "To",
    "reports.filters.product": "Product",
    "reports.filters.type": "Type",
    "reports.filters.allProducts": "All products",
    "reports.type.all": "All",
    "reports.type.in": "Stock In",
    "reports.type.out": "Sales",
    "reports.summary.itemsIn": "Items In",
    "reports.summary.itemsOut": "Items Out",
    "reports.summary.totalCost": "Total Cost",
    "reports.summary.revenue": "Revenue",
    "reports.summary.profit": "Profit",
    "reports.transactions": "Transactions",
    "reports.table.product": "Product",
    "reports.table.type": "Type",
    "reports.table.qty": "Qty",
    "reports.table.costUnit": "Cost/unit",
    "reports.table.saleUnit": "Sale/unit",
    "reports.table.total": "Total",
    "reports.table.profit": "Profit",
    "reports.table.date": "Date",
    "reports.table.time": "Time",
    "reports.badge.in": "IN",
    "reports.badge.sale": "SALE",
    "reports.importError": "Could not import file. Use a valid JSON backup.",
    "reports.invalidBackupFile": "Invalid backup file",
    "reports.importedData": "Imported {products} products and {transactions} transactions",
    "common.exportCSV": "Export CSV",
    "common.exportBackup": "Export Full Backup",
    "common.importBackup": "Import Backup",
    "common.undoDelete": "Undo Delete",
    "common.remove": "Remove",
    "stockIn.singleItem": "Single Item",
    "stockIn.multiItem": "Multi Item",
    "stockIn.productName": "Product Name",
    "stockIn.startTypingProduct": "Start typing product name...",
    "stockIn.quantity": "Quantity",
    "stockIn.unit": "Unit",
    "stockIn.enterMultiple": "Enter multiple items (e.g.,",
    "stockIn.multiPlaceholder": "Potato 10kg RWF 300, Maize 30kg RWF 300",
    "stockIn.defaultCost": "Default Cost (RWF/unit) (optional)",
    "stockIn.defaultSale": "Default Sale (RWF/unit) (optional)",
    "stockIn.preview": "Preview",
    "stockIn.addAllItems": "Add All Items",
    "stockIn.quickTemplates": "Quick Templates",
    "stockIn.timestampAuto": "Date and time are added automatically",
    "stockIn.addStock": "Add Stock",
    "stockIn.parseError": "Could not parse input. Use format: Potato 10kg RWF 300, Maize 30kg RWF 300",
    "stockIn.addedItems": "Added {count} items to stock",
    "stockIn.costFromPriceTag": "Cost from price tag",
    "stockIn.enterDate": "Date",
    "stockIn.enterTime": "Time",
    "stockIn.costPrompt": "How do you want to enter cost?",
    "stockIn.costMode.total": "I paid total amount",
    "stockIn.costMode.perUnit": "I know price per {unit}",
    "stockIn.totalPaid": "Total Amount Paid (RWF)",
    "stockIn.totalPaidPlaceholder": "e.g. 1200 for the whole batch",
    "stockIn.pricePerUnit": "Price per {unit} (RWF)",
    "stockIn.pricePerUnitPlaceholder": "e.g. 1.50 per {unit}",
    "stockIn.salePriceOptional": "Sale price per {unit} (RWF/unit) (optional)",
    "stockIn.salePriceOptionalPlaceholder": "e.g. 2.99 per {unit} (optional)",
    "stockIn.autoBreakdown": "Auto-Calculated Breakdown",
    "stockIn.costPer": "Cost per {unit}",
    "stockIn.totalCost": "Total Cost",
    "stockOut.startTyping": "Start typing to find product...",
    "stockOut.inStock": "In Stock",
    "stockOut.costPrice": "Cost Price",
    "stockOut.lastSalePrice": "Last Sale Price",
    "stockOut.howEnterSalePrice": "How do you want to enter the sale price?",
    "stockOut.pricePer": "Price per {unit}",
    "stockOut.totalReceived": "Total received",
    "stockOut.salePricePer": "Sale price per {unit} (RWF)",
    "stockOut.totalAmountReceived": "Total amount received (RWF)",
    "stockOut.completeSale": "Complete Sale",
    "stockOut.quickSell": "Quick Sell — Frequent Products",
    "stockOut.noProducts": "No products to sell",
    "stockOut.addStockFirst": "Add products through {addStock} first, then come back here to sell.",
    "common.inventoryManager": "Inventory Manager",
    "common.myShop": "My Shop",
    "common.admin": "admin",
    "stockIn.error.nameQty": "Please enter product name and quantity",
    "stockIn.error.validCost": "Please enter a valid cost",
    "stockIn.error.unitNotCompatible": "Unit \"{unit}\" is not compatible with \"{productUnit}\"",
    "stockIn.success.added": "Added {qty} {unit} of {name} ({stockQty} {productUnit} in stock)",
    "stockOut.error.selectProduct": "Please select a product",
    "stockOut.error.enterQuantity": "Please enter quantity",
    "stockOut.error.validSalePrice": "Please enter a valid sale price",
    "stockOut.error.unitNotCompatible": "Selected unit is not compatible with product unit",
    "stockOut.error.notEnoughStock": "Not enough stock!",
    "stockOut.success.sold": "Sold {qty} {unit} of {name}. Remaining: {remaining} {productUnit}",
    "inventory.error.invalidCostPrice": "Invalid cost price",
    "inventory.error.invalidSalePrice": "Invalid sale price",
    "inventory.success.updatedPrices": "Updated prices for {name}: Cost {cost}/{unit}, Sale {sale}/{unit}",
    "common.productRemovedUndo": "\"{name}\" removed. You can undo.",
    "common.productRestored": "Restored \"{name}\"",
    "common.level.low": "Low",
    "common.level.medium": "Medium",
    "common.level.good": "Good",
    "inventory.price": "Price",
    "inventory.base": "base",
    "dashboard.allWellStocked": "All products are well-stocked!",
    "unit.piece": "piece",
    "unit.kg": "kg",
    "unit.g": "g",
    "unit.l": "l",
    "unit.ml": "ml",
    "unit.mg": "mg",
    "unit.ton": "ton",
    "unit.dozen": "dozen",
    "unitFull.kg": "kilogram",
    "unitFull.g": "gram",
    "unitFull.mg": "milligram",
    "unitFull.l": "liter",
    "unitFull.ml": "milliliter",
    "unitFull.piece": "piece",
    "unitFull.dozen": "dozen",
    "unitFull.ton": "ton",
  },
  sw: {
    "common.language": "Lugha",
    "common.logout": "Toka",
    "common.save": "Hifadhi",
    "common.saving": "Inahifadhi...",
    "common.saved": "Imehifadhiwa",
    "common.saveFailed": "Imeshindikana kuhifadhi",
    "common.saveTitle": "Hifadhi data kwenye kifaa hiki",
    "common.loading": "Inapakia...",
    "common.noDataDash.title": "Karibu ZuriTrack!",
    "common.noDataDash.body1": "Huna bidhaa kwenye orodha. Nenda",
    "common.noDataDash.body2": "kwenye upande wa kushoto kuongeza bidhaa zako za kwanza.",
    "common.noDataDash.body3": "Bidhaa huundwa kiotomatiki — andika jina, weka kiasi na gharama, na umemaliza.",
    "common.orders": "oda",
    "common.entries": "maingizo",
    "common.unitsTotal": "jumla ya vipimo",
    "common.margin": "faida",
    "common.totalInStock": "Jumla kwenye stock",
    "common.noStockYet": "Hakuna stock bado. Ongeza bidhaa ili chati ijazwe.",
    "common.totalValue": "Thamani Jumla",
    "nav.dashboard": "Dashibodi",
    "nav.stockIn": "Ongeza Hisa",
    "nav.stockOut": "Uza Bidhaa",
    "nav.inventory": "Hesabu",
    "nav.reports": "Ripoti",
    "period.today": "Leo",
    "period.weekly": "Kila wiki",
    "period.monthly": "Kila mwezi",
    "period.yearly": "Kila mwaka",
    "dashboard.salesPurchases": "Mauzo na Manunuzi",
    "dashboard.stockDistribution": "Gawanyo la Hisa",
    "dashboard.totalSales": "Jumla ya Mauzo",
    "dashboard.totalPurchases": "Jumla ya Manunuzi",
    "dashboard.netProfit": "Faida Halisi",
    "dashboard.itemsSold": "Bidhaa Zilizouzwa",
    "dashboard.topSellingProducts": "Bidhaa Zinazouzwa Zaidi",
    "dashboard.lowStockAlerts": "Tahadhari za Hisa Ndogo",
    "dashboard.recentTransactions": "Miamala ya Hivi Karibuni",
    "common.searchProducts": "Tafuta bidhaa...",
    "common.sort.name": "Panga kwa Jina",
    "common.sort.stock": "Panga kwa Hisa",
    "common.sort.value": "Panga kwa Thamani",
    "reports.filters.from": "Kuanzia",
    "reports.filters.to": "Hadi",
    "reports.filters.product": "Bidhaa",
    "reports.filters.type": "Aina",
    "reports.filters.allProducts": "Bidhaa zote",
    "reports.type.all": "Zote",
    "reports.type.in": "Stock In",
    "reports.type.out": "Mauzo",
    "reports.summary.itemsIn": "Vilivyoingizwa",
    "reports.summary.itemsOut": "Vilivyotoka",
    "reports.summary.totalCost": "Gharama Jumla",
    "reports.summary.revenue": "Mapato",
    "reports.summary.profit": "Faida",
    "reports.transactions": "Miamala",
    "reports.table.product": "Bidhaa",
    "reports.table.type": "Aina",
    "reports.table.qty": "Kiasi",
    "reports.table.costUnit": "Gharama/kipimo",
    "reports.table.saleUnit": "Bei/kipimo",
    "reports.table.total": "Jumla",
    "reports.table.profit": "Faida",
    "reports.table.date": "Tarehe",
    "reports.table.time": "Muda",
    "reports.badge.in": "INGIZA",
    "reports.badge.sale": "MAUZO",
    "reports.importError": "Imeshindikana kuingiza faili. Tumia nakala ya JSON sahihi.",
    "reports.invalidBackupFile": "Faili ya nakala si sahihi",
    "reports.importedData": "Imeingiza bidhaa {products} na miamala {transactions}",
    "common.exportCSV": "Hamisha CSV",
    "common.exportBackup": "Hamisha Nakala Kamili",
    "common.importBackup": "Ingiza Nakala",
    "common.undoDelete": "Tendua Kufuta",
    "common.remove": "Ondoa",
    "stockIn.singleItem": "Kitu kimoja",
    "stockIn.multiItem": "Bidhaa nyingi",
    "stockIn.productName": "Jina la Bidhaa",
    "stockIn.startTypingProduct": "Anza kuandika jina la bidhaa...",
    "stockIn.quantity": "Kiasi",
    "stockIn.unit": "Kitengo",
    "stockIn.enterMultiple": "Ingiza bidhaa nyingi (mfano,",
    "stockIn.multiPlaceholder": "Viazi 10kg RWF 300, Mahindi 30kg RWF 300",
    "stockIn.defaultCost": "Gharama chaguomsingi (RWF/kitengo) (hiari)",
    "stockIn.defaultSale": "Bei ya kuuza chaguomsingi (RWF/kitengo) (hiari)",
    "stockIn.preview": "Hakikisho",
    "stockIn.addAllItems": "Ongeza Bidhaa Zote",
    "stockIn.quickTemplates": "Mifano ya Haraka",
    "stockIn.timestampAuto": "Tarehe na muda vinaongezwa moja kwa moja",
    "stockIn.addStock": "Ongeza Hisa",
    "stockIn.parseError": "Imeshindikana kusoma maandishi. Tumia muundo: Viazi 10kg RWF 300, Mahindi 30kg RWF 300",
    "stockIn.addedItems": "Bidhaa {count} zimeongezwa kwenye hisa",
    "stockIn.costFromPriceTag": "Gharama kutoka bei iliyoandikwa",
    "stockIn.enterDate": "Tarehe",
    "stockIn.enterTime": "Muda",
    "stockIn.costPrompt": "Unataka kuingiza gharama vipi?",
    "stockIn.costMode.total": "Nimelipa jumla ya kiasi",
    "stockIn.costMode.perUnit": "Najua bei kwa {unit}",
    "stockIn.totalPaid": "Jumla Iliyolipwa (RWF)",
    "stockIn.totalPaidPlaceholder": "mf. 1200 kwa mzigo wote",
    "stockIn.pricePerUnit": "Bei kwa {unit} (RWF)",
    "stockIn.pricePerUnitPlaceholder": "mf. 1.50 kwa {unit}",
    "stockIn.salePriceOptional": "Bei ya kuuza kwa {unit} (RWF/kitengo) (hiari)",
    "stockIn.salePriceOptionalPlaceholder": "mf. 2.99 kwa {unit} (hiari)",
    "stockIn.autoBreakdown": "Muhtasari wa Hesabu Kiotomatiki",
    "stockIn.costPer": "Gharama kwa {unit}",
    "stockIn.totalCost": "Gharama Jumla",
    "stockOut.startTyping": "Anza kuandika kutafuta bidhaa...",
    "stockOut.inStock": "Hisa Iliyopo",
    "stockOut.costPrice": "Bei ya Gharama",
    "stockOut.lastSalePrice": "Bei ya Mwisho ya Uuzaji",
    "stockOut.howEnterSalePrice": "Unataka kuingiza bei ya uuzaji vipi?",
    "stockOut.pricePer": "Bei kwa {unit}",
    "stockOut.totalReceived": "Jumla iliyopokelewa",
    "stockOut.salePricePer": "Bei ya kuuza kwa {unit} (RWF)",
    "stockOut.totalAmountReceived": "Jumla ya fedha iliyopokelewa (RWF)",
    "stockOut.completeSale": "Kamilisha Uuzaji",
    "stockOut.quickSell": "Uuzaji wa Haraka — Bidhaa za Mara kwa Mara",
    "stockOut.noProducts": "Hakuna bidhaa ya kuuza",
    "stockOut.addStockFirst": "Ongeza bidhaa kupitia {addStock} kwanza, kisha urudi hapa kuuza.",
    "common.inventoryManager": "Msimamizi wa Hisa",
    "common.myShop": "Duka Langu",
    "common.admin": "msimamizi",
    "stockIn.error.nameQty": "Tafadhali weka jina la bidhaa na kiasi",
    "stockIn.error.validCost": "Tafadhali weka gharama halali",
    "stockIn.error.unitNotCompatible": "Kipimo \"{unit}\" hakiendani na \"{productUnit}\"",
    "stockIn.success.added": "Imeongezwa {qty} {unit} ya {name} ({stockQty} {productUnit} kwenye hisa)",
    "stockOut.error.selectProduct": "Tafadhali chagua bidhaa",
    "stockOut.error.enterQuantity": "Tafadhali weka kiasi",
    "stockOut.error.validSalePrice": "Tafadhali weka bei halali ya kuuza",
    "stockOut.error.unitNotCompatible": "Kipimo ulichochagua hakiendani na kipimo cha bidhaa",
    "stockOut.error.notEnoughStock": "Hisa haitoshi!",
    "stockOut.success.sold": "Umeuza {qty} {unit} ya {name}. Iliyobaki: {remaining} {productUnit}",
    "inventory.error.invalidCostPrice": "Bei ya gharama si sahihi",
    "inventory.error.invalidSalePrice": "Bei ya kuuza si sahihi",
    "inventory.success.updatedPrices": "Bei zimesasishwa kwa {name}: Gharama {cost}/{unit}, Uuzaji {sale}/{unit}",
    "common.productRemovedUndo": "\"{name}\" imeondolewa. Unaweza kutengua.",
    "common.productRestored": "Imerejeshwa \"{name}\"",
    "common.level.low": "Hisa Ndogo",
    "common.level.medium": "Wastani",
    "common.level.good": "Nzuri",
    "inventory.price": "Bei",
    "inventory.base": "msingi",
    "dashboard.allWellStocked": "Bidhaa zote zina hisa ya kutosha!",
    "unit.piece": "kipande",
    "unit.kg": "kg",
    "unit.g": "g",
    "unit.l": "lita",
    "unit.ml": "ml",
    "unit.mg": "mg",
    "unit.ton": "tani",
    "unit.dozen": "dazeni",
    "unitFull.kg": "kilogramu",
    "unitFull.g": "gramu",
    "unitFull.mg": "miligramu",
    "unitFull.l": "lita",
    "unitFull.ml": "mililita",
    "unitFull.piece": "kipande",
    "unitFull.dozen": "dazeni",
    "unitFull.ton": "tani",
  },
  rw: {
    "common.language": "Ururimi",
    "common.logout": "Sohoka",
    "common.save": "Bika",
    "common.saving": "Birabika...",
    "common.saved": "Byabitswe",
    "common.saveFailed": "Kubika byanze",
    "common.saveTitle": "Bika amakuru kuri iki gikoresho",
    "common.loading": "Birimo gutangizwa...",
    "common.noDataDash.title": "Murakaza neza kuri ZuriTrack!",
    "common.noDataDash.body1": "Ububiko bwawe burimo ubusa. Jya kuri",
    "common.noDataDash.body2": "ku ruhande wongere ibicuruzwa bya mbere.",
    "common.noDataDash.body3": "Ibicuruzwa bihanwa bihita — andika izina, andika ingano n'igiciro, urarangiza.",
    "common.orders": "amategeko",
    "common.entries": "inyandiko",
    "common.unitsTotal": "ingano zose",
    "common.margin": "inyungu",
    "common.totalInStock": "Igiteranyo mu bubiko",
    "common.noStockYet": "Nta bubiko buriho. Ongeramo ibicuruzwa kugira ngo igishushanyo kigaragare.",
    "common.totalValue": "Agaciro kose",
    "nav.dashboard": "Ikibaho",
    "nav.stockIn": "Ongeramo Stock",
    "nav.stockOut": "Kugurisha",
    "nav.inventory": "Ububiko",
    "nav.reports": "Raporo",
    "period.today": "Uyu munsi",
    "period.weekly": "Icyumweru",
    "period.monthly": "Ukwezi",
    "period.yearly": "Umwaka",
    "dashboard.salesPurchases": "Kugurisha no Kugura",
    "dashboard.stockDistribution": "Ibwiciro by'Ububiko",
    "dashboard.totalSales": "Igurishwa Ryose",
    "dashboard.totalPurchases": "Ibitugu byose (Kugura)",
    "dashboard.netProfit": "Aho inyungu ihagaze",
    "dashboard.itemsSold": "Ibicuruzwa byagurishijwe",
    "dashboard.topSellingProducts": "Ibicuruzwa Byagurishijwe Cyane",
    "dashboard.lowStockAlerts": "Iburira ry'Ububiko Buke",
    "dashboard.recentTransactions": "Ibyakozwe Vuba",
    "common.searchProducts": "Shakisha ibicuruzwa...",
    "common.sort.name": "Rondora ku izina",
    "common.sort.stock": "Rondora ku stock",
    "common.sort.value": "Rondora ku gaciro",
    "reports.filters.from": "Bivuye",
    "reports.filters.to": "Kugeza",
    "reports.filters.product": "Ibicuruzwa",
    "reports.filters.type": "Ubwoko",
    "reports.filters.allProducts": "Ibicuruzwa byose",
    "reports.type.all": "Byose",
    "reports.type.in": "Byinjijwe",
    "reports.type.out": "Byagurishijwe",
    "reports.summary.itemsIn": "Ibyinjijwe",
    "reports.summary.itemsOut": "Ibyasohotse",
    "reports.summary.totalCost": "Ikiguzi cyose",
    "reports.summary.revenue": "Amafaranga yinjiye",
    "reports.summary.profit": "Inyungu",
    "reports.transactions": "Ibyakozwe",
    "reports.table.product": "Igicuruzwa",
    "reports.table.type": "Ubwoko",
    "reports.table.qty": "Ingano",
    "reports.table.costUnit": "Ikiguzi/igipimo",
    "reports.table.saleUnit": "Igurishwa/igipimo",
    "reports.table.total": "Igiteranyo",
    "reports.table.profit": "Inyungu",
    "reports.table.date": "Itariki",
    "reports.table.time": "Igihe",
    "reports.badge.in": "IN",
    "reports.badge.sale": "SALE",
    "reports.importError": "Ntibishoboye kwinjiza dosiye. Koresha backup ya JSON yemewe.",
    "reports.invalidBackupFile": "Backup file siyo",
    "reports.importedData": "Yinjijwe ibicuruzwa {products} n'ibyakozwe {transactions}",
    "common.exportCSV": "Ohereza CSV",
    "common.exportBackup": "Ohereza Backup Nto",
    "common.importBackup": "Shyiramo Backup",
    "common.undoDelete": "Tweza Gusiba",
    "common.remove": "Siba",
    "stockIn.singleItem": "Ikintu kimwe",
    "stockIn.multiItem": "Ibintu byinshi",
    "stockIn.productName": "Izina ry'Igicuruzwa",
    "stockIn.startTypingProduct": "Tangira wandike izina ry'igicuruzwa...",
    "stockIn.quantity": "Ingano",
    "stockIn.unit": "Igipimo",
    "stockIn.enterMultiple": "Andika ibicuruzwa byinshi (urugero,",
    "stockIn.multiPlaceholder": "Ibirayi 10kg RWF 300, Ibigori 30kg RWF 300",
    "stockIn.defaultCost": "Igiciro fatizo (RWF/igipimo) (si ngombwa)",
    "stockIn.defaultSale": "Igiciro cyo kugurisha fatizo (RWF/igipimo) (si ngombwa)",
    "stockIn.preview": "Ibanze kureba",
    "stockIn.addAllItems": "Ongeramo Ibintu Byose",
    "stockIn.quickTemplates": "Ingero Zihuse",
    "stockIn.timestampAuto": "Itariki n'igihe byongerwaho ako kanya",
    "stockIn.addStock": "Ongeramo Stock",
    "stockIn.parseError": "Ntibyasomye neza inyandiko. Koresha: Ibirayi 10kg RWF 300, Ibigori 30kg RWF 300",
    "stockIn.addedItems": "Ibintu {count} byongewe muri stock",
    "stockIn.costFromPriceTag": "Ikiguzi gikuwe ku giciro",
    "stockIn.enterDate": "Itariki",
    "stockIn.enterTime": "Igihe",
    "stockIn.costPrompt": "Ushaka kwinjiza ikiguzi ute?",
    "stockIn.costMode.total": "Nishyuye amafaranga yose",
    "stockIn.costMode.perUnit": "Nzi igiciro kuri {unit}",
    "stockIn.totalPaid": "Amafaranga Yose Yishyuwe (RWF)",
    "stockIn.totalPaidPlaceholder": "urug. 1200 ku bipimo byose",
    "stockIn.pricePerUnit": "Igiciro kuri {unit} (RWF)",
    "stockIn.pricePerUnitPlaceholder": "urug. 1.50 kuri {unit}",
    "stockIn.salePriceOptional": "Igiciro cyo kugurisha kuri {unit} (RWF/igipimo) (si ngombwa)",
    "stockIn.salePriceOptionalPlaceholder": "urug. 2.99 kuri {unit} (si ngombwa)",
    "stockIn.autoBreakdown": "Ibisobanuro by'ibaruramari (byikora)",
    "stockIn.costPer": "Ikiguzi kuri {unit}",
    "stockIn.totalCost": "Ikiguzi cyose",
    "stockOut.startTyping": "Tangira wandike ushaka igicuruzwa...",
    "stockOut.inStock": "Muri Stock",
    "stockOut.costPrice": "Igiciro cy'ikiguzi",
    "stockOut.lastSalePrice": "Igiciro cya nyuma cyagurishijweho",
    "stockOut.howEnterSalePrice": "Ushaka kwinjiza igiciro cyo kugurisha ute?",
    "stockOut.pricePer": "Igiciro kuri {unit}",
    "stockOut.totalReceived": "Amafaranga yose yakiriwe",
    "stockOut.salePricePer": "Igiciro cyo kugurisha kuri {unit} (RWF)",
    "stockOut.totalAmountReceived": "Amafaranga yose yakiriwe (RWF)",
    "stockOut.completeSale": "Rangiza Igurisha",
    "stockOut.quickSell": "Igurisha Ryihuse — Ibicuruzwa Bikunze",
    "stockOut.noProducts": "Nta bicuruzwa byo kugurisha",
    "stockOut.addStockFirst": "Banza wongere ibicuruzwa ukoresheje {addStock}, hanyuma ugaruke hano kugurisha.",
    "common.inventoryManager": "Umuyobozi w'Ububiko",
    "common.myShop": "Iduka Ryanjye",
    "common.admin": "admin",
    "stockIn.error.nameQty": "Andika izina ry'igicuruzwa n'ingano",
    "stockIn.error.validCost": "Andika ikiguzi gifite agaciro",
    "stockIn.error.unitNotCompatible": "Igipimo \"{unit}\" ntigihuye na \"{productUnit}\"",
    "stockIn.success.added": "Hongewe {qty} {unit} bya {name} ({stockQty} {productUnit} biri muri stock)",
    "stockOut.error.selectProduct": "Hitamo igicuruzwa",
    "stockOut.error.enterQuantity": "Andika ingano",
    "stockOut.error.validSalePrice": "Andika igiciro cyo kugurisha gifite agaciro",
    "stockOut.error.unitNotCompatible": "Igipimo wahisemo ntigihuye n'igipimo cy'igicuruzwa",
    "stockOut.error.notEnoughStock": "Stock ntihagije!",
    "stockOut.success.sold": "Wagurishije {qty} {unit} bya {name}. Hasigaye: {remaining} {productUnit}",
    "inventory.error.invalidCostPrice": "Igiciro cy'ikiguzi si cyo",
    "inventory.error.invalidSalePrice": "Igiciro cyo kugurisha si cyo",
    "inventory.success.updatedPrices": "Ibiciro byavuguruwe kuri {name}: Ikiguzi {cost}/{unit}, Igurisha {sale}/{unit}",
    "common.productRemovedUndo": "\"{name}\" cyasibwe. Ushobora gusubiza inyuma.",
    "common.productRestored": "\"{name}\" cyagaruwe",
    "common.level.low": "Nto",
    "common.level.medium": "Hagati",
    "common.level.good": "Ni byiza",
    "inventory.price": "Igiciro",
    "inventory.base": "shingiro",
    "dashboard.allWellStocked": "Ibicuruzwa byose bifite stock ihagije!",
    "unit.piece": "agace",
    "unit.kg": "kg",
    "unit.g": "g",
    "unit.l": "l",
    "unit.ml": "ml",
    "unit.mg": "mg",
    "unit.ton": "toni",
    "unit.dozen": "duzine",
    "unitFull.kg": "kilogarama",
    "unitFull.g": "garama",
    "unitFull.mg": "miligarama",
    "unitFull.l": "litiro",
    "unitFull.ml": "mililitiro",
    "unitFull.piece": "agace",
    "unitFull.dozen": "duzine",
    "unitFull.ton": "toni",
  },
  fr: {
    "common.language": "Langue",
    "common.logout": "Déconnexion",
    "common.save": "Enregistrer",
    "common.saving": "Enregistrement...",
    "common.saved": "Enregistré",
    "common.saveFailed": "Échec de l’enregistrement",
    "common.saveTitle": "Enregistrer les données sur cet appareil",
    "common.loading": "Chargement...",
    "common.noDataDash.title": "Bienvenue sur ZuriTrack !",
    "common.noDataDash.body1": "Votre inventaire est vide. Allez dans",
    "common.noDataDash.body2": "dans la barre latérale pour ajouter vos premiers produits.",
    "common.noDataDash.body3": "Les produits sont créés automatiquement — saisissez un nom, une quantité et un coût, et c’est fait.",
    "common.orders": "commandes",
    "common.entries": "entrées",
    "common.unitsTotal": "unités au total",
    "common.margin": "marge",
    "common.totalInStock": "Total en stock",
    "common.noStockYet": "Aucun stock pour l’instant. Ajoutez des produits pour remplir ce graphique.",
    "common.totalValue": "Valeur totale",
    "nav.dashboard": "Tableau de bord",
    "nav.stockIn": "Ajouter du stock",
    "nav.stockOut": "Vendre le produit",
    "nav.inventory": "Inventaire",
    "nav.reports": "Rapports",
    "period.today": "Aujourd'hui",
    "period.weekly": "Hebdomadaire",
    "period.monthly": "Mensuel",
    "period.yearly": "Annuel",
    "dashboard.salesPurchases": "Ventes et Achats",
    "dashboard.stockDistribution": "Répartition du stock",
    "dashboard.totalSales": "Ventes totales",
    "dashboard.totalPurchases": "Achats totaux",
    "dashboard.netProfit": "Bénéfice net",
    "dashboard.itemsSold": "Articles vendus",
    "dashboard.topSellingProducts": "Produits les plus vendus",
    "dashboard.lowStockAlerts": "Alerte stock faible",
    "dashboard.recentTransactions": "Transactions récentes",
    "common.searchProducts": "Rechercher des produits...",
    "common.sort.name": "Trier par nom",
    "common.sort.stock": "Trier par stock",
    "common.sort.value": "Trier par valeur",
    "reports.filters.from": "De",
    "reports.filters.to": "À",
    "reports.filters.product": "Produit",
    "reports.filters.type": "Type",
    "reports.filters.allProducts": "Tous les produits",
    "reports.type.all": "Tous",
    "reports.type.in": "Entrées stock",
    "reports.type.out": "Ventes",
    "reports.summary.itemsIn": "Articles entrants",
    "reports.summary.itemsOut": "Articles sortants",
    "reports.summary.totalCost": "Coût total",
    "reports.summary.revenue": "Revenu",
    "reports.summary.profit": "Bénéfice",
    "reports.transactions": "Transactions",
    "reports.table.product": "Produit",
    "reports.table.type": "Type",
    "reports.table.qty": "Qté",
    "reports.table.costUnit": "Coût/unité",
    "reports.table.saleUnit": "Vente/unité",
    "reports.table.total": "Total",
    "reports.table.profit": "Bénéfice",
    "reports.table.date": "Date",
    "reports.table.time": "Heure",
    "reports.badge.in": "ENTRÉE",
    "reports.badge.sale": "VENTE",
    "reports.importError": "Impossible d’importer le fichier. Utilisez une sauvegarde JSON valide.",
    "reports.invalidBackupFile": "Fichier de sauvegarde invalide",
    "reports.importedData": "{products} produits et {transactions} transactions importés",
    "common.exportCSV": "Exporter CSV",
    "common.exportBackup": "Exporter une sauvegarde complète",
    "common.importBackup": "Importer une sauvegarde",
    "common.undoDelete": "Annuler la suppression",
    "common.remove": "Supprimer",
    "stockIn.singleItem": "Article unique",
    "stockIn.multiItem": "Articles multiples",
    "stockIn.productName": "Nom du produit",
    "stockIn.startTypingProduct": "Commencez à saisir le nom du produit...",
    "stockIn.quantity": "Quantité",
    "stockIn.unit": "Unité",
    "stockIn.enterMultiple": "Entrez plusieurs articles (ex.,",
    "stockIn.multiPlaceholder": "Pomme de terre 10kg RWF 300, Maïs 30kg RWF 300",
    "stockIn.defaultCost": "Coût par défaut (RWF/unité) (optionnel)",
    "stockIn.defaultSale": "Vente par défaut (RWF/unité) (optionnel)",
    "stockIn.preview": "Aperçu",
    "stockIn.addAllItems": "Ajouter tous les articles",
    "stockIn.quickTemplates": "Modèles rapides",
    "stockIn.timestampAuto": "La date et l'heure sont ajoutées automatiquement",
    "stockIn.addStock": "Ajouter du stock",
    "stockIn.parseError": "Impossible d'analyser la saisie. Utilisez : Pomme de terre 10kg RWF 300, Maïs 30kg RWF 300",
    "stockIn.addedItems": "{count} articles ajoutés au stock",
    "stockIn.costFromPriceTag": "Coût depuis le prix saisi",
    "stockIn.enterDate": "Date",
    "stockIn.enterTime": "Heure",
    "stockIn.costPrompt": "Comment voulez-vous saisir le coût ?",
    "stockIn.costMode.total": "J’ai payé le montant total",
    "stockIn.costMode.perUnit": "Je connais le prix par {unit}",
    "stockIn.totalPaid": "Montant total payé (RWF)",
    "stockIn.totalPaidPlaceholder": "ex. 1200 pour tout le lot",
    "stockIn.pricePerUnit": "Prix par {unit} (RWF)",
    "stockIn.pricePerUnitPlaceholder": "ex. 1,50 par {unit}",
    "stockIn.salePriceOptional": "Prix de vente par {unit} (RWF/unité) (optionnel)",
    "stockIn.salePriceOptionalPlaceholder": "ex. 2,99 par {unit} (optionnel)",
    "stockIn.autoBreakdown": "Répartition calculée automatiquement",
    "stockIn.costPer": "Coût par {unit}",
    "stockIn.totalCost": "Coût total",
    "stockOut.startTyping": "Commencez à saisir pour trouver un produit...",
    "stockOut.inStock": "En stock",
    "stockOut.costPrice": "Prix de revient",
    "stockOut.lastSalePrice": "Dernier prix de vente",
    "stockOut.howEnterSalePrice": "Comment voulez-vous saisir le prix de vente ?",
    "stockOut.pricePer": "Prix par {unit}",
    "stockOut.totalReceived": "Total reçu",
    "stockOut.salePricePer": "Prix de vente par {unit} (RWF)",
    "stockOut.totalAmountReceived": "Montant total reçu (RWF)",
    "stockOut.completeSale": "Finaliser la vente",
    "stockOut.quickSell": "Vente rapide — Produits fréquents",
    "stockOut.noProducts": "Aucun produit à vendre",
    "stockOut.addStockFirst": "Ajoutez d'abord des produits via {addStock}, puis revenez ici pour vendre.",
    "common.inventoryManager": "Gestionnaire d'inventaire",
    "common.myShop": "Ma boutique",
    "common.admin": "admin",
    "stockIn.error.nameQty": "Veuillez saisir le nom du produit et la quantité",
    "stockIn.error.validCost": "Veuillez saisir un coût valide",
    "stockIn.error.unitNotCompatible": "L'unité \"{unit}\" n'est pas compatible avec \"{productUnit}\"",
    "stockIn.success.added": "{qty} {unit} de {name} ajouté(s) ({stockQty} {productUnit} en stock)",
    "stockOut.error.selectProduct": "Veuillez sélectionner un produit",
    "stockOut.error.enterQuantity": "Veuillez saisir une quantité",
    "stockOut.error.validSalePrice": "Veuillez saisir un prix de vente valide",
    "stockOut.error.unitNotCompatible": "L'unité sélectionnée n'est pas compatible avec l'unité du produit",
    "stockOut.error.notEnoughStock": "Stock insuffisant !",
    "stockOut.success.sold": "{qty} {unit} de {name} vendu(s). Reste : {remaining} {productUnit}",
    "inventory.error.invalidCostPrice": "Prix de revient invalide",
    "inventory.error.invalidSalePrice": "Prix de vente invalide",
    "inventory.success.updatedPrices": "Prix mis à jour pour {name} : Coût {cost}/{unit}, Vente {sale}/{unit}",
    "common.productRemovedUndo": "\"{name}\" supprimé. Vous pouvez annuler.",
    "common.productRestored": "\"{name}\" restauré",
    "common.level.low": "Faible",
    "common.level.medium": "Moyen",
    "common.level.good": "Bon",
    "inventory.price": "Prix",
    "inventory.base": "base",
    "dashboard.allWellStocked": "Tous les produits sont bien approvisionnés !",
    "unit.piece": "pièce",
    "unit.kg": "kg",
    "unit.g": "g",
    "unit.l": "l",
    "unit.ml": "ml",
    "unit.mg": "mg",
    "unit.ton": "tonne",
    "unit.dozen": "douzaine",
    "unitFull.kg": "kilogramme",
    "unitFull.g": "gramme",
    "unitFull.mg": "milligramme",
    "unitFull.l": "litre",
    "unitFull.ml": "millilitre",
    "unitFull.piece": "pièce",
    "unitFull.dozen": "douzaine",
    "unitFull.ton": "tonne",
  },
  zh: {
    "common.language": "语言",
    "common.logout": "退出登录",
    "common.save": "保存",
    "common.saving": "正在保存…",
    "common.saved": "已保存",
    "common.saveFailed": "保存失败",
    "common.saveTitle": "将数据保存到本设备",
    "common.loading": "加载中…",
    "common.noDataDash.title": "欢迎使用 ZuriTrack！",
    "common.noDataDash.body1": "你的库存为空。请在侧边栏进入",
    "common.noDataDash.body2": "以添加你的第一批产品。",
    "common.noDataDash.body3": "产品会自动创建——输入名称、数量和成本即可完成。",
    "common.orders": "订单",
    "common.entries": "条目",
    "common.unitsTotal": "单位合计",
    "common.margin": "利润率",
    "common.totalInStock": "库存总计",
    "common.noStockYet": "暂无库存。请添加产品以填充该图表。",
    "common.totalValue": "总价值",
    "nav.dashboard": "仪表盘",
    "nav.stockIn": "添加库存",
    "nav.stockOut": "销售商品",
    "nav.inventory": "库存",
    "nav.reports": "报表",
    "period.today": "今天",
    "period.weekly": "每周",
    "period.monthly": "每月",
    "period.yearly": "每年",
    "dashboard.salesPurchases": "销售与采购",
    "dashboard.stockDistribution": "库存分布",
    "dashboard.totalSales": "销售总额",
    "dashboard.totalPurchases": "采购总额",
    "dashboard.netProfit": "净利润",
    "dashboard.itemsSold": "已售商品",
    "dashboard.topSellingProducts": "热门畅销品",
    "dashboard.lowStockAlerts": "低库存提醒",
    "dashboard.recentTransactions": "最近交易",
    "common.searchProducts": "搜索产品...",
    "common.sort.name": "按名称排序",
    "common.sort.stock": "按库存排序",
    "common.sort.value": "按价值排序",
    "reports.filters.from": "从",
    "reports.filters.to": "到",
    "reports.filters.product": "产品",
    "reports.filters.type": "类型",
    "reports.filters.allProducts": "全部产品",
    "reports.type.all": "全部",
    "reports.type.in": "入库",
    "reports.type.out": "销售",
    "reports.summary.itemsIn": "入库数量",
    "reports.summary.itemsOut": "出库数量",
    "reports.summary.totalCost": "总成本",
    "reports.summary.revenue": "收入",
    "reports.summary.profit": "利润",
    "reports.transactions": "交易",
    "reports.table.product": "产品",
    "reports.table.type": "类型",
    "reports.table.qty": "数量",
    "reports.table.costUnit": "成本/单位",
    "reports.table.saleUnit": "售价/单位",
    "reports.table.total": "合计",
    "reports.table.profit": "利润",
    "reports.table.date": "日期",
    "reports.table.time": "时间",
    "reports.badge.in": "入库",
    "reports.badge.sale": "销售",
    "reports.importError": "无法导入文件。请使用有效的 JSON 备份。",
    "reports.invalidBackupFile": "备份文件无效",
    "reports.importedData": "已导入 {products} 个产品和 {transactions} 条交易",
    "common.exportCSV": "导出 CSV",
    "common.exportBackup": "导出完整备份",
    "common.importBackup": "导入备份",
    "common.undoDelete": "撤销删除",
    "common.remove": "删除",
    "stockIn.singleItem": "单个商品",
    "stockIn.multiItem": "多个商品",
    "stockIn.productName": "商品名称",
    "stockIn.startTypingProduct": "开始输入商品名称...",
    "stockIn.quantity": "数量",
    "stockIn.unit": "单位",
    "stockIn.enterMultiple": "输入多个商品（例如，",
    "stockIn.multiPlaceholder": "土豆 10kg RWF 300, 玉米 30kg RWF 300",
    "stockIn.defaultCost": "默认成本（RWF/单位）（可选）",
    "stockIn.defaultSale": "默认售价（RWF/单位）（可选）",
    "stockIn.preview": "预览",
    "stockIn.addAllItems": "添加全部商品",
    "stockIn.quickTemplates": "快捷模板",
    "stockIn.timestampAuto": "日期和时间会自动添加",
    "stockIn.addStock": "添加库存",
    "stockIn.parseError": "无法解析输入。请使用格式：土豆 10kg RWF 300, 玉米 30kg RWF 300",
    "stockIn.addedItems": "已添加 {count} 个商品到库存",
    "stockIn.costFromPriceTag": "按输入价格计算成本",
    "stockIn.enterDate": "日期",
    "stockIn.enterTime": "时间",
    "stockIn.costPrompt": "你希望如何输入成本？",
    "stockIn.costMode.total": "我输入总金额",
    "stockIn.costMode.perUnit": "我知道每{unit}价格",
    "stockIn.totalPaid": "总支付金额 (RWF)",
    "stockIn.totalPaidPlaceholder": "例如：整批 1200",
    "stockIn.pricePerUnit": "每{unit}价格 (RWF)",
    "stockIn.pricePerUnitPlaceholder": "例如：每{unit} 1.50",
    "stockIn.salePriceOptional": "每{unit}售价 (RWF/单位)（可选）",
    "stockIn.salePriceOptionalPlaceholder": "例如：每{unit} 2.99（可选）",
    "stockIn.autoBreakdown": "自动计算明细",
    "stockIn.costPer": "每{unit}成本",
    "stockIn.totalCost": "总成本",
    "stockOut.startTyping": "开始输入以查找商品...",
    "stockOut.inStock": "库存",
    "stockOut.costPrice": "成本价",
    "stockOut.lastSalePrice": "最近售价",
    "stockOut.howEnterSalePrice": "你希望如何输入售价？",
    "stockOut.pricePer": "每{unit}价格",
    "stockOut.totalReceived": "总收款",
    "stockOut.salePricePer": "每{unit}售价 (RWF)",
    "stockOut.totalAmountReceived": "总收款金额 (RWF)",
    "stockOut.completeSale": "完成销售",
    "stockOut.quickSell": "快速销售 — 常用商品",
    "stockOut.noProducts": "没有可销售商品",
    "stockOut.addStockFirst": "请先通过 {addStock} 添加商品，然后再回来销售。",
    "common.inventoryManager": "库存管理",
    "common.myShop": "我的店铺",
    "common.admin": "管理员",
    "stockIn.error.nameQty": "请输入商品名称和数量",
    "stockIn.error.validCost": "请输入有效成本",
    "stockIn.error.unitNotCompatible": "单位“{unit}”与“{productUnit}”不兼容",
    "stockIn.success.added": "已添加 {qty} {unit} 的 {name}（库存 {stockQty} {productUnit}）",
    "stockOut.error.selectProduct": "请选择商品",
    "stockOut.error.enterQuantity": "请输入数量",
    "stockOut.error.validSalePrice": "请输入有效售价",
    "stockOut.error.unitNotCompatible": "所选单位与商品单位不兼容",
    "stockOut.error.notEnoughStock": "库存不足！",
    "stockOut.success.sold": "已售出 {qty} {unit} 的 {name}。剩余：{remaining} {productUnit}",
    "inventory.error.invalidCostPrice": "成本价无效",
    "inventory.error.invalidSalePrice": "销售价无效",
    "inventory.success.updatedPrices": "已更新 {name} 的价格：成本 {cost}/{unit}，售价 {sale}/{unit}",
    "common.productRemovedUndo": "已删除“{name}”，可撤销。",
    "common.productRestored": "已恢复“{name}”",
    "common.level.low": "低",
    "common.level.medium": "中",
    "common.level.good": "良好",
    "inventory.price": "价格",
    "inventory.base": "基础",
    "dashboard.allWellStocked": "所有产品库存充足！",
    "unit.piece": "件",
    "unit.kg": "千克",
    "unit.g": "克",
    "unit.l": "升",
    "unit.ml": "毫升",
    "unit.mg": "毫克",
    "unit.ton": "吨",
    "unit.dozen": "打",
    "unitFull.kg": "千克",
    "unitFull.g": "克",
    "unitFull.mg": "毫克",
    "unitFull.l": "升",
    "unitFull.ml": "毫升",
    "unitFull.piece": "件",
    "unitFull.dozen": "打",
    "unitFull.ton": "吨",
  },
};
const tLang = (lang, key) => I18N[lang]?.[key] ?? I18N.en?.[key] ?? key;
const tFmtLang = (lang, key, vars = {}) => {
  let str = tLang(lang, key);
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replaceAll(`{${k}}`, String(v));
  });
  return str;
};
const unitLabelLang = (lang, unit) => tLang(lang, `unit.${normalizeUnit(unit)}`);
const unitFullLang = (lang, unit) => tLang(lang, `unitFull.${normalizeUnit(unit)}`) || unitFull(unit);
const unitType = (u) => UNIT_DEFS[normalizeUnit(u)]?.type || "count";
const isConvertible = (from, to) => unitType(from) === unitType(to);
const UnitIcon = ({ unit, size = 14, style }) => {
  const u = normalizeUnit(unit);
  const t = unitType(u);
  // Icons8 "Fluency Systems Filled" set (filled, modern). Using PNG CDN for simplicity.
  const ICON8 = {
    mass: "https://img.icons8.com/fluency-systems-filled/48/weight.png",
    volume: "https://img.icons8.com/fluency-systems-filled/48/water.png",
    bottle: "https://img.icons8.com/fluency-systems-filled/48/wine-bottle.png",
    box: "https://img.icons8.com/fluency-systems-filled/48/box.png",
    bag: "https://img.icons8.com/fluency-systems-filled/48/shopping-bag.png",
    packet: "https://img.icons8.com/fluency-systems-filled/48/package.png",
    dozen: "https://img.icons8.com/fluency-systems-filled/48/stack.png",
    piece: "https://img.icons8.com/fluency-systems-filled/48/filled-circle.png",
    tag: "https://img.icons8.com/fluency-systems-filled/48/price-tag.png",
  };
  const src =
    (u === "bottle" ? ICON8.bottle
      : u === "box" ? ICON8.box
        : u === "bag" ? ICON8.bag
          : u === "packet" ? ICON8.packet
            : u === "dozen" ? ICON8.dozen
              : u === "piece" ? ICON8.piece
                : t === "mass" ? ICON8.mass
                  : t === "volume" ? ICON8.volume
                    : ICON8.tag);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="unit-ic"
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ display: "block", width: size, height: size, objectFit: "contain", filter: "var(--unit-icon-filter)", ...style }}
      onError={(e) => { try { e.currentTarget.style.display = "none"; } catch (_e) {} }}
    />
  );
};
const convertQty = (qty, from, to) => {
  const f = UNIT_DEFS[normalizeUnit(from)];
  const t = UNIT_DEFS[normalizeUnit(to)];
  if (!f || !t || f.type !== t.type) return null;
  return Number(qty || 0) * (f.factor / t.factor);
};
const convertPricePerUnit = (price, from, to) => {
  const f = UNIT_DEFS[normalizeUnit(from)];
  const t = UNIT_DEFS[normalizeUnit(to)];
  if (!f || !t || f.type !== t.type) return null;
  return Number(price || 0) * (t.factor / f.factor);
};
const unitsFor = (u) => {
  const type = unitType(u);
  return UNITS.filter(x => UNIT_DEFS[x].type === type);
};
const STOCK_COLORS = { high: "#22c55e", medium: "#f59e0b", low: "#ef4444" };
const LOGO_SRC = "./assets/llogo.png";
const POWERED_BY_LOGO_SRC = "./assets/pixel-spring.png";

const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
};

const normalize = (s) => s.toLowerCase().trim().replace(/s$/, "").replace(/ies$/, "y");

const fuzzyMatch = (input, products) => {
  if (!input) return [];
  const norm = normalize(input);
  return products
    .map(p => {
      const pn = normalize(p.name);
      const startsWith = pn.startsWith(norm);
      const includes = pn.includes(norm);
      const dist = levenshtein(norm, pn.slice(0, norm.length));
      let score = dist;
      if (startsWith) score -= 100;
      if (includes) score -= 50;
      score -= (p.frequency || 0) * 2;
      return { ...p, score };
    })
    .filter(p => p.score < 5)
    .sort((a, b) => a.score - b.score);
};

const parseMultiInput = (text) => {
  const items = text.split(",").map(s => s.trim()).filter(Boolean);
  return items.map(item => {
    // Supported:
    // "potato 10kg RWF 300", "maize 30 kg RWF 300", "beans 5l", "rice 20"
    const match = item.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?(?:\s*\$\s*(\d+(?:\.\d+)?))?$/i);
    if (match) {
      const parsedPrice = match[4] ? parseFloat(match[4]) : null;
      return {
        name: match[1].trim(),
        qty: parseFloat(match[2]),
        unit: normalizeUnit(match[3] || "piece"),
        totalPaid: Number.isFinite(parsedPrice) ? parsedPrice : null,
      };
    }
    return null;
  }).filter(Boolean);
};

// ─── SEED DATA (empty — user adds their own) ───
const SEED_PRODUCTS = [];
const genTransactions = () => [];

// ─── ICONS (inline SVG) ───
const Icons = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  stockIn: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>,
  stockOut: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  inventory: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  trend: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  save: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  chevron: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 010 20"/><path d="M12 2a15 15 0 000 20"/></svg>,
  undo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  uptime: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/><path d="M12 3V1"/></svg>,
};

// ─── Auto-suggest Input Component ───
function AutoInput({ value, onChange, products, placeholder, onSelect, style, t }) {
  const tt = t || ((k) => k);
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const [showSug, setShowSug] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (value.length > 0) {
      const matches = fuzzyMatch(value, products).slice(0, 6);
      setSuggestions(matches);
      setSelIdx(0);
      setShowSug(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }, [value, products]);

  const handleKey = (e) => {
    if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      const s = suggestions[selIdx];
      onChange(s.name);
      onSelect?.(s);
      setShowSug(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestions.length > 0 && showSug) {
      e.preventDefault();
      const s = suggestions[selIdx];
      onChange(s.name);
      onSelect?.(s);
      setShowSug(false);
    }
  };

  const ghost = suggestions.length > 0 && value.length > 0 ? suggestions[selIdx]?.name : "";
  const ghostVisible = ghost && normalize(ghost).startsWith(normalize(value));

  return (
    <div style={{ position: "relative", ...style }}>
      {ghostVisible && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", padding: "0 16px",
          color: "var(--text-ghost)", fontSize: 15, pointerEvents: "none", fontFamily: "inherit"
        }}>
          <span style={{ visibility: "hidden" }}>{value}</span>
          <span>{ghost.slice(value.length)}</span>
          <span style={{ marginLeft: 12, fontSize: 11, opacity: 0.4, background: "var(--bg-tag)", padding: "2px 6px", borderRadius: 4 }}>Tab</span>
        </div>
      )}
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => value.length > 0 && suggestions.length > 0 && setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 200)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)",
          fontSize: 15, fontFamily: "inherit", background: "transparent", color: "var(--text)",
          outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
        }}
        onFocusCapture={e => e.target.style.borderColor = "var(--primary)"}
        onBlurCapture={e => e.target.style.borderColor = "var(--border)"}
      />
      {showSug && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "var(--popover-bg)", borderRadius: 12, marginTop: 6,
          boxShadow: "0 18px 50px rgba(0,0,0,0.22)", border: "1px solid var(--border)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          overflow: "hidden", maxHeight: 240, overflowY: "auto",
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              onMouseDown={() => { onChange(s.name); onSelect?.(s); setShowSug(false); }}
              style={{
                padding: "10px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: i === selIdx ? "var(--bg-hover)" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid var(--border-light)" : "none",
              }}
            >
              <span style={{ fontWeight: 500, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", opacity: 0.85 }}><UnitIcon unit={s.unit} size={16} /></span>
                <span>{s.name}</span>
              </span>
              <span style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>{s.stock} {s.unit}</span>
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: s.stock < 25 ? "var(--low-bg)" : s.stock < 75 ? "var(--med-bg)" : "var(--good-bg)",
                  color: s.stock < 25 ? "var(--low-fg)" : s.stock < 75 ? "var(--med-fg)" : "var(--good-fg)",
                }}>{s.stock < 25 ? tt("common.level.low") : s.stock < 75 ? tt("common.level.medium") : tt("common.level.good")}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toast ───
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000,
      padding: "14px 24px", borderRadius: 14,
      background: type === "success" ? "var(--toast-success)" : type === "error" ? "var(--toast-error)" : "var(--toast-info)",
      color: "#fff", fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
      animation: "slideUp 0.3s ease", display: "flex", alignItems: "center", gap: 10,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {type === "success" && Icons.check}
      {message}
    </div>
  );
}

// ─── Simple hash for passwords ───
// ─── Auth Page ───
function AuthPage({ onLogin }) {
  const [step, setStep] = useState("auth"); // "auth" | "reset"
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [shopName, setShopName] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetConfirmPass, setResetConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const emailRef = useRef(null);

  const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
  const [resetCode, setResetCode] = useState("");

  const sendRecoveryCode = async () => {
    setError("");
    const e = normalizeEmail(email);
    if (!e) return setError("Please enter your email"), void 0;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setError("Please enter a valid email"), void 0;
    setLoading(true);
    try {
      await apiJson("/auth/password/forgot", { method: "POST", body: { email: e } });
      setStep("reset");
      setResetCode("");
    } catch (_e) {
      setError("Could not send recovery code. Please try again.");
    }
    setLoading(false);
  };

  const applyPasswordReset = async () => {
    setError("");
    const e = normalizeEmail(email);
    if (!e) return setError("Please enter your email"), void 0;
    if (!resetCode.trim()) return setError("Enter the 6-digit code."), void 0;
    if (resetNewPass.length < 6) return setError("New password must be at least 6 characters."), void 0;
    if (resetNewPass !== resetConfirmPass) return setError("Passwords do not match."), void 0;
    setLoading(true);
    try {
      const out = await apiJson("/auth/password/reset", {
        method: "POST",
        body: { email: e, code: resetCode.trim(), newPassword: resetNewPass }
      });
      onLogin(out); // { token, user }
    } catch (_e) {
      setError("Could not reset password. Please try again.");
    }
    setLoading(false);
  };

  const validate = () => {
    setError("");
    if (!email.trim()) return setError("Please enter your email"), false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Please enter a valid email"), false;
    if (password.length < 6) return setError("Password must be at least 6 characters"), false;
    if (mode === "signup") {
      if (!shopName.trim()) return setError("Please enter your shop name"), false;
      if (password !== confirmPass) return setError("Passwords do not match"), false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError("");
    const e = normalizeEmail(email);

    try {
      if (mode === "signup") {
        const out = await apiJson("/auth/signup", {
          method: "POST",
          body: { email: e, password, shopName: shopName.trim() }
        });
        onLogin(out);
      } else {
        const out = await apiJson("/auth/login", {
          method: "POST",
          body: { email: e, password }
        });
        onLogin(out);
      }
    } catch (err) {
      const msg = String(err?.message || "Something went wrong. Please try again.");
      if (msg === "email_exists") setError("An account with this email already exists. Please log in.");
      else if (msg === "invalid_credentials") setError("Incorrect password. Please try again.");
      else if (msg === "not_found") setError("No account found with this email. Please sign up first.");
      else if (msg === "shop_name_required") setError("Please enter your shop name");
      else if (msg === "password_too_short") setError("Password must be at least 6 characters");
      else setError(msg);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };

  const inputStyle = {
    width: "100%", padding: "14px 18px", borderRadius: 14, border: "2px solid #e2e8f0",
    fontSize: 15, outline: "none", background: "#f8fafc", color: "#1e293b",
    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)",
      fontFamily: "'DM Sans', sans-serif", padding: 20,
    }}>
      {/* Background decorations */}
      <div style={{ position: "fixed", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: "rgba(129,140,248,0.15)", filter: "blur(60px)" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(167,139,250,0.12)", filter: "blur(50px)" }} />

      <div style={{
        width: "100%", maxWidth: 460, animation: "fadeIn 0.5s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
                background: "linear-gradient(135deg, #818cf8, #6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
              }}>
                <img src={LOGO_SRC} alt="ZuriTrack" style={{ width: 42, height: 42, objectFit: "contain" }} />
              </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: -0.5, margin: 0 }}>ZuriTrack</h1>
          <p style={{ fontSize: 14, color: "#a5b4fc", marginTop: 6 }}>Inventory & Sales Manager</p>
        </div>

        {/* Auth Card */}
        <div style={{
          background: "#fff", borderRadius: 24, padding: "36px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}>
          {/* Simple auth form */}
          {step === "auth" && (
            <>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Email Address</label>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                />
              </div>

              {mode === "signup" && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Shop Name</label>
                  <input
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Mama's General Store"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              )}

              <div style={{ marginBottom: mode === "signup" ? 18 : 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                    style={{ ...inputStyle, paddingRight: 48 }}
                    onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                  />
                  <button onClick={() => setShowPass(!showPass)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4,
                  }}>
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <div style={{ marginTop: 10, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => { setStep("reset"); setError(""); }}
                    style={{ border: "none", background: "transparent", color: "#6366f1", fontWeight: 900, cursor: "pointer", fontSize: 13 }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}

          {/* Password recovery */}
          {step === "reset" && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Recover password</div>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); }}
                  style={{ border: "none", background: "transparent", color: "#6366f1", fontWeight: 900, cursor: "pointer", fontSize: 13 }}
                >
                  Back
                </button>
              </div>

              <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={sendRecoveryCode}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: "none",
                    background: loading ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Send code
                </button>
              </div>

              <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>Enter code + new password</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  <input
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                    style={inputStyle}
                  />
                  <input
                    type={showPass ? "text" : "password"}
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    placeholder="New password"
                    style={inputStyle}
                  />
                  <input
                    type={showPass ? "text" : "password"}
                    value={resetConfirmPass}
                    onChange={(e) => setResetConfirmPass(e.target.value)}
                    placeholder="Confirm new password"
                    style={inputStyle}
                  />
                </div>
                <button
                  type="button"
                  onClick={applyPasswordReset}
                  disabled={loading}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 900,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Reset password
                </button>
                <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                  We will send a 6-digit code to your email (valid for 10 minutes).
                </div>
              </div>
            </div>
          )}

          {/* Mode Toggle */}
          <div style={{
            display: "flex", background: "#f1f5f9", borderRadius: 14, padding: 4, marginBottom: 28,
          }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "11px 0", border: "none", borderRadius: 11, cursor: "pointer",
                  fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#1e293b" : "#94a3b8",
                  boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.2s",
                }}>{m === "login" ? "Log In" : "Create Account"}</button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 12, background: "var(--red-bg)", border: "1px solid var(--border)",
              color: "var(--red)", fontSize: 13, fontWeight: 500, marginBottom: 20,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          {/* Shop Name (signup only) */}
          {/* handled in simple auth form */}

          {/* Profile image + role are set after login (in-app) */}

          {/* Email is captured in the email-first step */}

          {/* Password */}
          {/* handled in simple auth form */}

          {/* Confirm Password (signup only) */}
          {step === "auth" && mode === "signup" && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, display: "block" }}>Confirm Password</label>
              <input
                type={showPass ? "text" : "password"} value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Re-enter your password"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          )}

          {/* Password strength indicator (signup) */}
          {step === "auth" && mode === "signup" && password.length > 0 && (
            <div style={{ marginBottom: 20, marginTop: 10 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {[1, 2, 3, 4].map(level => (
                  <div key={level} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: password.length >= level * 3
                      ? password.length >= 12 ? "#22c55e" : password.length >= 8 ? "#f59e0b" : "#ef4444"
                      : "#e2e8f0",
                    transition: "background 0.3s",
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: password.length >= 12 ? "#22c55e" : password.length >= 8 ? "#f59e0b" : "#ef4444", fontWeight: 500 }}>
                {password.length >= 12 ? "Strong password" : password.length >= 8 ? "Good password" : password.length >= 6 ? "Fair password" : "Too short"}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: step === "auth" ? "block" : "none",
              width: "100%", padding: "15px 0", border: "none", borderRadius: 14, cursor: loading ? "wait" : "pointer",
              fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: loading ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff", marginTop: 16,
              boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
              transition: "all 0.2s", transform: loading ? "none" : undefined,
            }}
            onMouseEnter={e => { if (!loading) e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.target.style.transform = "none"; }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeLinecap="round"/></svg>
                {mode === "login" ? "Logging in..." : "Creating account..."}
              </span>
            ) : (
              mode === "login" ? "Log In" : "Create Account"
            )}
          </button>

          {/* Footer hint */}
          <p style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", marginTop: 20, marginBottom: 0 }}>
            {mode === "login" ? (
              <>Don't have an account? <span onClick={() => { setMode("signup"); setError(""); }} style={{ color: "#6366f1", fontWeight: 600, cursor: "pointer" }}>Sign up</span></>
            ) : (
              <>Already have an account? <span onClick={() => { setMode("login"); setError(""); }} style={{ color: "#6366f1", fontWeight: 600, cursor: "pointer" }}>Log in</span></>
            )}
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(165,180,252,0.6)", marginTop: 24 }}>
          Powered by a secure login API.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Root App with Auth Gate ───
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check for saved session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await window.storage.get("current_session");
        if (session) {
          const parsed = JSON.parse(session.value);
          if (parsed && parsed.token && parsed.user) {
            setToken(parsed.token);
            setUser(parsed.user);
            try {
              const me = await apiJson("/me", { token: parsed.token });
              if (me?.user) {
                setUser(me.user);
                await window.storage.set("current_session", JSON.stringify({ token: parsed.token, user: me.user }));
              }
            } catch (_e) {
              // invalid token; clear session
              await window.storage.delete("current_session");
              setUser(null);
              setToken("");
            }
          } else {
            // legacy session format
            setUser(parsed);
          }
        }
      } catch (e) { /* no session */ }
      setCheckingAuth(false);
    })();
  }, []);

  const handleLogin = async (payload) => {
    const nextToken = payload?.token || "";
    const nextUser = payload?.user || null;
    if (!nextToken || !nextUser) return;
    setToken(nextToken);
    setUser({
      ...nextUser,
      role: nextUser?.role || "stock_manager",
      avatarDataUrl: nextUser?.avatarDataUrl || "",
    });
    try {
      await window.storage.set("current_session", JSON.stringify({
        token: nextToken,
        user: {
          ...nextUser,
          role: nextUser?.role || "stock_manager",
          avatarDataUrl: nextUser?.avatarDataUrl || "",
        }
      }));
    } catch (e) { /* storage might fail */ }
  };

  const handleUpdateUser = async (patch) => {
    try {
      if (!token) return;
      const out = await apiJson("/me", { method: "PATCH", token, body: patch || {} });
      if (out?.user) {
        setUser(out.user);
        window.storage.set("current_session", JSON.stringify({ token, user: out.user })).catch(() => {});
      }
    } catch (_e) {
      // ignore
    }
  };

  const handleLogout = async () => {
    setUser(null);
    setToken("");
    try {
      await window.storage.delete("current_session");
    } catch (e) { /* ok */ }
  };

  if (checkingAuth) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1e1b4b, #312e81)", fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "#a5b4fc", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img src={LOGO_SRC} alt="ZuriTrack" style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 10 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 0.5, marginBottom: 6 }}>ZuriTrack</div>
          <div style={{ fontSize: 15 }}>{tLang("en", "common.loading")}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <MainApp user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
}

// ─── Main App ───
function MainApp({ user, onLogout, onUpdateUser }) {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [transactions, setTransactions] = useState(() => genTransactions());
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [period, setPeriod] = useState("today");
  const [lang, setLang] = useState("en");
  const [currency, setCurrency] = useState("RWF");
  const [theme, setTheme] = useState("light"); // "light" | "dark" | "system"
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [uptimePoints, setUptimePoints] = useState([]); // [{ t: ms, v: sec }]
  const [uptimeLogs, setUptimeLogs] = useState([]); // [{ t: ms, msg }]
  const [lastDeleted, setLastDeleted] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "failed"
  const [hydrated, setHydrated] = useState(false);

  const dataKey = `zuriTrack:data:${user?.email || "anonymous"}`;
  const langKey = `zuriTrack:lang:${user?.email || "anonymous"}`;
  const currencyKey = `zuriTrack:currency:${user?.email || "anonymous"}`;
  const themeKey = `zuriTrack:theme:${user?.email || "anonymous"}`;
  const tr = (key) => tLang(lang, key);
  const trf = (key, vars) => tFmtLang(lang, key, vars);
  const isPhone = () => {
    try {
      return window.matchMedia ? window.matchMedia("(max-width: 720px)").matches : (window.innerWidth <= 720);
    } catch (_e) {
      return false;
    }
  };

  const currencyWrapRef = useRef(null);
  const langWrapRef = useRef(null);
  const profileImgInputRef = useRef(null);
  const pickProfileImage = () => profileImgInputRef.current?.click?.();
  const onProfileImageFile = (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) { showToast("Please choose an image file.", "error"); return; }
    const r = new FileReader();
    r.onload = () => onUpdateUser?.({ avatarDataUrl: String(r.result || "") });
    r.onerror = () => showToast("Could not read that image. Try another one.", "error");
    r.readAsDataURL(file);
  };
  const CURRENCIES = [
    ["RWF", "Rwandan Franc"],
    ["USD", "US Dollar"],
    ["KES", "Kenyan Shilling"],
    ["TZS", "Tanzanian Shilling"],
    ["UGX", "Ugandan Shilling"],
    ["NGN", "Nigerian Naira"],
    ["GHS", "Ghanaian Cedi"],
    ["ZAR", "South African Rand"],
    ["XOF", "West African CFA"],
    ["XAF", "Central African CFA"],
    ["ETB", "Ethiopian Birr"],
    ["EGP", "Egyptian Pound"],
    ["MAD", "Moroccan Dirham"],
  ];
  const currencyLabel = (code) => (CURRENCIES.find(([c]) => c === code)?.[1] || code);

  useEffect(() => {
    const onDocDown = (e) => {
      if (currencyWrapRef.current && !currencyWrapRef.current.contains(e.target)) setCurrencyOpen(false);
      if (langWrapRef.current && !langWrapRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, []);

  const LANG_OPTIONS = Object.entries(LANGS); // [code, label]

  useEffect(() => {
    // Mobile-first: start with drawer closed on small screens,
    // and auto-close it when resizing down.
    const mq = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
    const apply = () => {
      const isSmall = mq ? mq.matches : (window.innerWidth <= 720);
      if (isSmall) setSidebarOpen(false);
    };
    apply();
    if (!mq) return;
    const handler = () => apply();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  // Uptime tracking for the current session
  useEffect(() => {
    const startedAt = Date.now();
    setUptimeLogs([{ t: startedAt, msg: "Session started" }]);
    setUptimePoints([{ t: startedAt, v: 0 }]);

    const tick = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      setUptimeSec(sec);
    }, 1000);

    const sample = window.setInterval(() => {
      const now = Date.now();
      const sec = Math.floor((now - startedAt) / 1000);
      setUptimePoints((prev) => {
        const next = [...prev, { t: now, v: sec }];
        return next.length > 720 ? next.slice(next.length - 720) : next;
      });
    }, 10_000);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(sample);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get(langKey);
        const savedLang = saved?.value;
        if (savedLang && LANGS[savedLang]) setLang(savedLang);
      } catch (_e) {
        // ignore
      }
    })();
  }, [langKey]);

  useEffect(() => {
    // Persist language choice for this device/user
    window.storage.set(langKey, lang).catch(() => {});
  }, [langKey, lang]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get(themeKey);
        const v = saved?.value;
        if (v === "light" || v === "dark" || v === "system") setTheme(v);
      } catch (_e) {}
    })();
  }, [themeKey]);

  useEffect(() => {
    window.storage.set(themeKey, theme).catch(() => {});
  }, [themeKey, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    const apply = () => {
      const isSystemDark = mq ? mq.matches : false;
      const resolved = theme === "system" ? (isSystemDark ? "dark" : "light") : theme;
      root.setAttribute("data-theme", resolved);
    };

    apply();

    if (!mq) return;
    const handler = () => apply();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get(currencyKey);
        const savedCurrency = saved?.value;
        if (savedCurrency) setCurrency(savedCurrency);
      } catch (_e) {}
    })();
  }, [currencyKey]);

  useEffect(() => {
    // Keep global formatter currency in sync with selection
    window.__zt_currency = currency || "RWF";
    if (typeof window.__zt_fxRate !== "number") window.__zt_fxRate = 1;
  }, [currency]);

  useEffect(() => {
    window.storage.set(currencyKey, currency).catch(() => {});
  }, [currencyKey, currency]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get(dataKey);
        if (saved?.value) {
          const parsed = JSON.parse(saved.value);
          if (Array.isArray(parsed.products) && Array.isArray(parsed.transactions)) {
            setProducts(parsed.products.map(p => ({ ...p, unit: normalizeUnit(p.unit || "piece") })));
            setTransactions(parsed.transactions.map(t => ({ ...t, unit: normalizeUnit(t.unit || "piece") })));
          }
        }
      } catch (_e) {
        // No saved data yet (or storage unavailable)
      } finally {
        setHydrated(true);
      }
    })();
  }, [dataKey]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(async () => {
      try {
        await window.storage.set(dataKey, JSON.stringify({ products, transactions }));
        setSaveStatus("saved");
      } catch (_e) {
        setSaveStatus("failed");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [products, transactions, hydrated, dataKey]);

  const saveNow = async () => {
    setSaveStatus("saving");
    try {
      await window.storage.set(dataKey, JSON.stringify({ products, transactions }));
      setSaveStatus("saved");
    } catch (_e) {
      setSaveStatus("failed");
    }
  };

  const showToast = (message, type = "success") => setToast({ message, type, key: Date.now() });

  const addTransaction = (txn) => {
    setTransactions(prev => [txn, ...prev]);
    setProducts(prev => prev.map(p => {
      if (p.id === txn.productId) {
        const qtyInProductUnit = txn.unit === p.unit ? txn.quantity : (convertQty(txn.quantity, txn.unit, p.unit) ?? txn.quantity);
        const updated = {
          ...p,
          stock: txn.type === "in" ? p.stock + qtyInProductUnit : p.stock - qtyInProductUnit,
          frequency: (p.frequency || 0) + 1,
        };
        // Auto-save cost price when adding stock, sale price when selling
        if (txn.type === "in" && txn.costPrice > 0) {
          updated.costPrice = txn.unit === p.unit ? txn.costPrice : (convertPricePerUnit(txn.costPrice, txn.unit, p.unit) ?? txn.costPrice);
        }
        if (txn.type === "out" && txn.salePrice > 0) {
          updated.salePrice = txn.unit === p.unit ? txn.salePrice : (convertPricePerUnit(txn.salePrice, txn.unit, p.unit) ?? txn.salePrice);
        }
        return updated;
      }
      return p;
    }));
  };

  const findOrCreateProduct = (name, unit, costPrice, salePrice) => {
    const existing = products.find(p => normalize(p.name) === normalize(name));
    if (existing) return existing;
    const baseUnit = normalizeUnit(unit || "piece");
    const newP = { id: uid(), name, unit: baseUnit, costPrice: costPrice || 0, salePrice: salePrice || 0, frequency: 0, stock: 0 };
    setProducts(prev => [...prev, newP]);
    return newP;
  };

  const updateProductPrice = (productId, newCostPrice, newSalePrice) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          costPrice: newCostPrice !== null && newCostPrice !== undefined ? newCostPrice : p.costPrice,
          salePrice: newSalePrice !== null && newSalePrice !== undefined ? newSalePrice : p.salePrice,
        };
      }
      return p;
    }));
  };

  const removeProduct = (productId) => {
    const product = products.find(p => p.id === productId);
    const deletedTxns = transactions.filter(t => t.productId === productId);
    setLastDeleted(product ? { product, transactions: deletedTxns } : null);
    setProducts(prev => prev.filter(p => p.id !== productId));
    setTransactions(prev => prev.filter(t => t.productId !== productId));
    if (product) showToast(trf("common.productRemovedUndo", { name: product.name }));
  };

  const undoRemoveProduct = () => {
    if (!lastDeleted?.product) return;
    setProducts(prev => [...prev, lastDeleted.product]);
    setTransactions(prev => [...lastDeleted.transactions, ...prev]);
    showToast(trf("common.productRestored", { name: lastDeleted.product.name }));
    setLastDeleted(null);
  };

  const importAppData = (payload) => {
    if (!payload || !Array.isArray(payload.products) || !Array.isArray(payload.transactions)) {
      showToast(tr("reports.invalidBackupFile"), "error");
      return;
    }
    setProducts(payload.products.map(p => ({ ...p, unit: normalizeUnit(p.unit || "piece") })));
    setTransactions(payload.transactions.map(t => ({ ...t, unit: normalizeUnit(t.unit || "piece") })));
    showToast(trf("reports.importedData", { products: payload.products.length, transactions: payload.transactions.length }));
  };

  const exportAppData = () => ({
    app: "ZuriTrack",
    exportedAt: new Date().toISOString(),
    user: { email: user?.email || "", shopName: user?.shopName || "" },
    products,
    transactions,
  });

  const stats = useMemo(() => {
    const filterByPeriod = (d) => {
      if (period === "today") return isToday(d);
      if (period === "weekly") return isThisWeek(d);
      if (period === "monthly") return isThisMonth(d);
      return isThisYear(d);
    };
    const filtered = transactions.filter(t => filterByPeriod(t.date));
    const sales = filtered.filter(t => t.type === "out");
    const purchases = filtered.filter(t => t.type === "in");
    const totalSales = sales.reduce((s, t) => s + t.salePrice * t.quantity, 0);
    const totalPurchases = purchases.reduce((s, t) => s + t.costPrice * t.quantity, 0);
    const totalProfit = sales.reduce((s, t) => s + t.profit, 0);
    const totalItems = sales.reduce((s, t) => s + t.quantity, 0);
    return { totalSales, totalPurchases, totalProfit, totalItems, salesCount: sales.length, purchaseCount: purchases.length };
  }, [transactions, period]);

  const lowStockProducts = products.filter(p => p.stock < 30).sort((a, b) => a.stock - b.stock);
  const topProducts = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "out").forEach(t => {
      map[t.productName] = (map[t.productName] || 0) + t.quantity;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));
  }, [transactions]);

  const chartData = useMemo(() => {
    const map = {};
    const orderedKeys = [];

    const addBucket = (key, label) => {
      if (!map[key]) map[key] = { date: label, sales: 0, purchases: 0, profit: 0 };
      return map[key];
    };

    const addTxToBucket = (bucketKey, t) => {
      const b = map[bucketKey];
      if (!b) return;
      if (t.type === "out") {
        b.sales += t.salePrice * t.quantity;
        b.profit += t.profit;
      } else {
        b.purchases += t.costPrice * t.quantity;
      }
    };

    if (period === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const buckets = 12; // every 2 hours
      const stepMs = (24 / buckets) * 60 * 60 * 1000;
      for (let i = 0; i < buckets; i++) {
        const bucketStart = new Date(start.getTime() + i * stepMs);
        const key = String(i);
        const label = bucketStart.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
        addBucket(key, label);
        orderedKeys.push(key);
      }
      transactions.forEach(t => {
        const ts = t.timestamp || parseDate(t.date).getTime();
        const dt = new Date(ts);
        if (dt < start || dt >= new Date(start.getTime() + 24 * 60 * 60 * 1000)) return;
        const idx = Math.floor((dt.getTime() - start.getTime()) / stepMs);
        if (idx >= 0 && idx < buckets) addTxToBucket(String(idx), t);
      });
    } else if (period === "weekly") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en", { weekday: "short" });
        addBucket(ds, label);
        orderedKeys.push(ds);
      }
      transactions.forEach(t => addTxToBucket(t.date, t));
    } else if (period === "monthly") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
        addBucket(ds, label);
        orderedKeys.push(ds);
      }
      transactions.forEach(t => addTxToBucket(t.date, t));
    } else {
      // yearly: current year months
      const year = new Date().getFullYear();
      for (let m = 0; m < 12; m++) {
        const d = new Date(year, m, 1);
        const key = `${year}-${m + 1}`;
        const label = d.toLocaleDateString("en", { month: "short" });
        addBucket(key, label);
        orderedKeys.push(key);
      }
      transactions.forEach(t => {
        const ts = t.timestamp || parseDate(t.date).getTime();
        const d = new Date(ts);
        if (d.getFullYear() !== year) return;
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        addTxToBucket(key, t);
      });
    }

    return orderedKeys.map(k => map[k]);
  }, [transactions, period]);

  const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Mono:wght@400;700&display=swap');
    :root {
      --primary: #6366f1;
      --primary-light: #818cf8;
      --primary-dark: #4f46e5;
      --primary-bg: #eef2ff;
      --bg: #f8f9fc;
      --bg-card: #ffffff;
      --bg-sidebar: #1e1b4b;
      --bg-hover: #f1f5f9;
      --bg-tag: #e2e8f0;
      --text: #000000;
      --text-dim: #000000;
      --text-ghost: #000000;
      --text-sidebar: #c7d2fe;
      --text-sidebar-active: #ffffff;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --green: #059669;
      --green-bg: #ecfdf5;
      --red: #dc2626;
      --red-bg: #fef2f2;
      --orange: #d97706;
      --orange-bg: #fffbeb;
      --blue: #2563eb;
      --blue-bg: #eff6ff;
      --low-bg: #fef2f2;
      --low-fg: #dc2626;
      --med-bg: #fffbeb;
      --med-fg: #d97706;
      --good-bg: #ecfdf5;
      --good-fg: #059669;

      /* Responsive layout vars */
      --sidebar-w: 260px;
      --header-pad-x: 32px;
      --header-pad-y: 16px;
      --content-pad-x: 32px;
      --content-pad-y: 24px;

      /* Chart + toast theme vars */
      --chart-grid: rgba(148, 163, 184, 0.28);
      --chart-axis: rgba(148, 163, 184, 0.38);
      --chart-text: #94a3b8;
      --chart-donut-hole: #ffffff;
      --toast-success: #059669;
      --toast-error: #dc2626;
      --toast-info: #2563eb;
      --popover-bg: rgba(255, 255, 255, 0.96);
      --unit-icon-filter: grayscale(1) saturate(0) brightness(0);
      --header-glass: linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.46));
    }

    /* Dark theme overrides */
    [data-theme="dark"] {
      --primary-bg: rgba(99, 102, 241, 0.14);
      --bg: #0b1020;
      --bg-card: rgba(255, 255, 255, 0.06);
      --bg-sidebar: rgba(7, 11, 22, 0.78);
      --bg-hover: rgba(255, 255, 255, 0.08);
      --bg-tag: rgba(255, 255, 255, 0.10);
      --text: rgba(255, 255, 255, 0.96);
      --text-dim: rgba(255, 255, 255, 0.72);
      --text-ghost: rgba(255, 255, 255, 0.55);
      --text-sidebar: rgba(255, 255, 255, 0.78);
      --text-sidebar-active: rgba(255, 255, 255, 0.98);
      --border: rgba(255, 255, 255, 0.12);
      --border-light: rgba(255, 255, 255, 0.08);
      --green-bg: rgba(34, 197, 94, 0.14);
      --red-bg: rgba(239, 68, 68, 0.14);
      --orange-bg: rgba(245, 158, 11, 0.14);
      --blue-bg: rgba(59, 130, 246, 0.14);
      --low-bg: rgba(239, 68, 68, 0.14);
      --low-fg: rgba(248, 113, 113, 0.95);
      --med-bg: rgba(245, 158, 11, 0.14);
      --med-fg: rgba(251, 191, 36, 0.95);
      --good-bg: rgba(34, 197, 94, 0.14);
      --good-fg: rgba(74, 222, 128, 0.95);
      --chart-grid: rgba(255, 255, 255, 0.06);
      --chart-axis: rgba(255, 255, 255, 0.08);
      --chart-text: rgba(255, 255, 255, 0.55);
      --chart-donut-hole: rgba(255, 255, 255, 0.08);
      --popover-bg: rgba(10, 14, 28, 0.72);
      --unit-icon-filter: grayscale(1) saturate(0) brightness(0) invert(1);
      --header-glass: linear-gradient(180deg, rgba(7, 11, 22, 0.62), rgba(7, 11, 22, 0.44));
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }
    .unit-ic { filter: var(--unit-icon-filter); }
    input, select, button, textarea { font-family: 'DM Sans', sans-serif; }
    input, select, textarea, option {
      color: var(--text) !important;
      -webkit-text-fill-color: var(--text);
    }
    /* Placeholders: visibly lighter than typed text */
    input::placeholder,
    textarea::placeholder,
    input::-webkit-input-placeholder,
    textarea::-webkit-input-placeholder {
      color: rgba(0, 0, 0, 0.40) !important;
      -webkit-text-fill-color: rgba(0, 0, 0, 0.40) !important;
      opacity: 1 !important;
      font-weight: 500;
    }
    [data-theme="dark"] input::placeholder,
    [data-theme="dark"] textarea::placeholder,
    [data-theme="dark"] input::-webkit-input-placeholder,
    [data-theme="dark"] textarea::-webkit-input-placeholder {
      color: rgba(255, 255, 255, 0.40) !important;
      -webkit-text-fill-color: rgba(255, 255, 255, 0.40) !important;
    }
    select { background: var(--bg-card); color: var(--text) !important; -webkit-text-fill-color: var(--text); }
    option { background: var(--bg-card); color: var(--text) !important; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes chartRise {
      from { opacity: 0; transform: translateY(14px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes chartDraw {
      from { stroke-dashoffset: 100; opacity: 0.35; }
      to { stroke-dashoffset: 0; opacity: 1; }
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .stat-card { transition: transform 0.2s, box-shadow 0.2s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
    .nav-item { transition: all 0.2s; cursor: pointer; border-radius: 12px; }
    .nav-item:hover { background: rgba(255,255,255,0.08); }
    .btn { cursor: pointer; border: none; font-weight: 600; border-radius: 12px; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-outline { background: transparent; border: 2px solid var(--border); color: var(--text); }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

    /* Glass panels */
    .glass-panel {
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 18px 50px rgba(0,0,0,0.10);
    }
    [data-theme="dark"] .glass-panel {
      box-shadow: 0 24px 70px rgba(0,0,0,0.35);
    }
    .glass-panel::before {
      content: "";
      position: absolute;
      inset: -2px;
      background:
        radial-gradient(600px 220px at 20% 0%, rgba(99,102,241,0.12), transparent 62%),
        radial-gradient(560px 220px at 85% 10%, rgba(34,197,94,0.10), transparent 62%),
        linear-gradient(120deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
      opacity: 0.65;
      pointer-events: none;
    }
    [data-theme="dark"] .glass-panel::before {
      background:
        radial-gradient(600px 220px at 20% 0%, rgba(99,102,241,0.16), transparent 62%),
        radial-gradient(560px 220px at 85% 10%, rgba(34,197,94,0.12), transparent 62%),
        linear-gradient(120deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
      opacity: 0.8;
    }
    .glass-panel::after {
      content: none;
    }
    .glass-panel > * { position: relative; z-index: 1; }

    /* Forms (Stock In / Stock Out) */
    .page-centered {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
    }
    .card-pad {
      padding: clamp(16px, 3.6vw, 32px);
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .grid-qty {
      display: grid;
      grid-template-columns: 1fr 180px;
      gap: 12px;
    }
    @media (max-width: 720px) {
      .grid-2 { grid-template-columns: 1fr; }
      .grid-qty { grid-template-columns: 1fr; }
    }

    /* App-wide responsiveness */
    .app-header { padding: var(--header-pad-y) var(--header-pad-x) !important; }
    .app-content { padding: var(--content-pad-y) var(--content-pad-x) !important; }
    .sidebar { width: var(--sidebar-w); }
    .sidebar { backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); }
    /* Stronger nav glass blur everywhere inside the sidebar */
    .sidebar .nav-select,
    .sidebar .glass-dd-btn,
    .sidebar .glass-dd-list {
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
    }
    .nav-section { padding: 10px 12px; margin-top: 6px; }
    .nav-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      margin: 10px 8px 6px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      line-height: 1;
    }
    .nav-label svg {
      width: 14px;
      height: 14px;
      display: block;
      transform: translateY(-0.5px);
    }
    .nav-select {
      width: 100%;
      padding: 11px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.26);
      background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.10));
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
      appearance: none;
    }
    .nav-select:hover {
      background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.12));
      border-color: rgba(255,255,255,0.38);
      transform: translateY(-0.5px);
    }
    .nav-select:active { transform: translateY(0px); }
    .nav-select:focus {
      border-color: rgba(165, 180, 252, 0.95);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.28), 0 14px 34px rgba(0, 0, 0, 0.22);
    }
    .nav-select option {
      background: #0b1020;
      color: #ffffff;
    }

    /* Custom glass dropdown (consistent across browsers) */
    .glass-dd { position: relative; width: 100%; }
    .glass-dd-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.26);
      background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.10));
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      outline: none;
      transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
    }
    .glass-dd-btn:hover {
      background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.12));
      border-color: rgba(255,255,255,0.38);
      transform: translateY(-0.5px);
    }
    .glass-dd-btn:active { transform: translateY(0px); }
    .glass-dd-btn:focus {
      border-color: rgba(165, 180, 252, 0.95);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.28), 0 14px 34px rgba(0, 0, 0, 0.22);
    }
    .glass-dd-value { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .glass-dd-sub { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.72); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .glass-dd-list {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 8px);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(10, 14, 28, 0.72);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.42);
      overflow: hidden;
      z-index: 2000;
    }
    .glass-dd-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      color: rgba(255,255,255,0.94);
      font-size: 13px;
      font-weight: 800;
      border: none;
      background: transparent;
      text-align: left;
      transition: background 120ms ease;
    }
    .glass-dd-item:hover { background: rgba(255,255,255,0.10); }
    .glass-dd-item small { color: rgba(255,255,255,0.72); font-weight: 800; font-size: 11px; }
    .glass-dd-item.is-active { background: rgba(99, 102, 241, 0.22); }

    /* Header language dropdown: same glass look */
    .header-dd { width: 180px; }
    .header-dd .glass-dd-btn {
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.45));
      color: var(--text);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    [data-theme="dark"] .header-dd .glass-dd-btn {
      background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
      color: rgba(255,255,255,0.92);
      border-color: rgba(255,255,255,0.14);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
    }

    /* Inventory unit dropdown: compact, matches app theme */
    .inv-dd { width: auto; min-width: 120px; }
    .inv-dd .glass-dd-btn {
      padding: 6px 10px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 800;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.46));
      color: var(--text);
      box-shadow: 0 12px 26px rgba(2, 6, 23, 0.10);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    [data-theme="dark"] .inv-dd .glass-dd-btn {
      background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
      color: rgba(255,255,255,0.92);
      border-color: rgba(255,255,255,0.14);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
    }
    .inv-dd .glass-dd-sub { color: rgba(15,23,42,0.60); font-weight: 800; }
    [data-theme="dark"] .inv-dd .glass-dd-sub { color: rgba(255,255,255,0.62); }
    .inv-dd .glass-dd-list {
      top: calc(100% + 8px);
      min-width: 180px;
      right: auto;
      left: 0;
      background: rgba(255,255,255,0.86);
      border: 1px solid rgba(148,163,184,0.35);
      box-shadow: 0 22px 60px rgba(2, 6, 23, 0.18);
    }
    [data-theme="dark"] .inv-dd .glass-dd-list {
      background: rgba(10, 14, 28, 0.78);
      border-color: rgba(255,255,255,0.14);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.42);
    }
    .inv-dd .glass-dd-item { color: rgba(15,23,42,0.92); }
    [data-theme="dark"] .inv-dd .glass-dd-item { color: rgba(255,255,255,0.94); }
    .inv-dd .glass-dd-item:hover { background: rgba(99,102,241,0.10); }
    [data-theme="dark"] .inv-dd .glass-dd-item:hover { background: rgba(255,255,255,0.10); }

    @media (max-width: 1024px) {
      :root {
        --header-pad-x: 20px;
        --content-pad-x: 20px;
      }
      .dash-charts { grid-template-columns: 1fr !important; }
      .dash-bottom { grid-template-columns: 1fr !important; }
    }

    @media (max-width: 720px) {
      :root {
        --header-pad-x: 14px;
        --header-pad-y: 12px;
        --content-pad-x: 14px;
        --content-pad-y: 16px;
      }
      .app-header { flex-wrap: wrap; }
      .hide-sm { display: none !important; }
      .page-centered { max-width: 100%; }
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .app-content { max-width: 100vw; overflow-x: hidden; }
      img, svg, canvas { max-width: 100%; height: auto; }
      table { width: 100%; }
      /* Any wide content becomes scrollable instead of overflowing */
      .app-content > div { max-width: 100%; }
      .app-content * { min-width: 0; }
    .recent-card { padding: 16px !important; }
    .recent-table th { padding: 8px 10px !important; font-size: 11px !important; }
    .recent-table td { padding: 10px 10px !important; font-size: 13px !important; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      line-height: 1;
    }
    .mono { font-family: 'Space Mono', monospace; }

      /* Mobile drawer sidebar */
      .sidebar {
        position: fixed !important;
        top: 0;
        bottom: 0;
        left: 0;
        width: min(var(--sidebar-w), 86vw) !important;
        transform: translateX(-102%);
        transition: transform 180ms ease, box-shadow 180ms ease;
        box-shadow: none;
        z-index: 120;
      }
      .sidebar.is-open {
        transform: translateX(0);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }
      .sidebar.is-open .nav-item {
        animation: navIn 160ms ease both;
      }
      .sidebar.is-open .nav-item:nth-child(1) { animation-delay: 10ms; }
      .sidebar.is-open .nav-item:nth-child(2) { animation-delay: 25ms; }
      .sidebar.is-open .nav-item:nth-child(3) { animation-delay: 40ms; }
      .sidebar.is-open .nav-item:nth-child(4) { animation-delay: 55ms; }
      .sidebar.is-open .nav-item:nth-child(5) { animation-delay: 70ms; }
      @keyframes navIn {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.5);
        z-index: 110;
      }
      .main {
        margin-left: 0 !important;
      }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}
        {/* Sidebar */}
        <aside
          className={`sidebar ${sidebarOpen ? "is-open" : ""}`}
          style={{
            width: sidebarOpen ? "var(--sidebar-w)" : 0,
            overflow: "hidden",
            transition: "width 0.3s",
            background: "var(--bg-sidebar)",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 120,
          }}
        >
          <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img src={LOGO_SRC} alt="ZuriTrack" style={{ width: 24, height: 24, objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: -0.5 }}>ZuriTrack</div>
                <div style={{ color: "var(--text-sidebar)", fontSize: 11 }}>{tr("common.inventoryManager")}</div>
              </div>
            </div>
          </div>
          <nav style={{ padding: "16px 12px", flex: 1 }}>
            {[
              { id: "dashboard", icon: Icons.dashboard, labelKey: "nav.dashboard" },
              { id: "stockIn", icon: Icons.stockIn, labelKey: "nav.stockIn" },
              { id: "stockOut", icon: Icons.stockOut, labelKey: "nav.stockOut" },
              { id: "inventory", icon: Icons.inventory, labelKey: "nav.inventory" },
              { id: "reports", icon: Icons.reports, labelKey: "nav.reports" },
              { id: "uptime", icon: Icons.uptime, labelKey: "nav.uptime" },
            ].map(item => (
              <div
                key={item.id}
                className="nav-item"
                onClick={() => { setPage(item.id); if (isPhone()) setSidebarOpen(false); }}
                style={{
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 4, color: page === item.id ? "var(--text-sidebar-active)" : "var(--text-sidebar)",
                  background: page === item.id ? "rgba(255,255,255,0.12)" : "transparent",
                  fontWeight: page === item.id ? 600 : 400, fontSize: 14,
                }}
              >
                {item.icon}
                {tr(item.labelKey)}
                {item.id === "inventory" && lowStockProducts.length > 0 && (
                  <span style={{
                    marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 11,
                    padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                  }}>{lowStockProducts.length}</span>
                )}
              </div>
            ))}

            {/* Currency (under Reports) */}
            <div className="nav-section">
              <div className="nav-label">
                <span style={{ display: "inline-flex", opacity: 0.95 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 7h18v10H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M6 10h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M6 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M16 10h2M16 14h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                Currency
              </div>
              <div className="glass-dd" ref={currencyWrapRef}>
                <button
                  type="button"
                  className="glass-dd-btn"
                  onClick={() => setCurrencyOpen(v => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={currencyOpen ? "true" : "false"}
                >
                  <span className="glass-dd-value">
                    <span>{currency}</span>
                    <span className="glass-dd-sub">{currencyLabel(currency)}</span>
                  </span>
                  <span aria-hidden="true" style={{ opacity: 0.9, display: "inline-flex" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>

                {currencyOpen && (
                  <div className="glass-dd-list" role="listbox" aria-label="Currency options">
                    {CURRENCIES.map(([code, label]) => (
                      <button
                        type="button"
                        key={code}
                        className={`glass-dd-item ${currency === code ? "is-active" : ""}`}
                        onClick={() => { setCurrency(code); setCurrencyOpen(false); }}
                      >
                        <span>{label}</span>
                        <small>{code}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Theme */}
            <div className="nav-section">
              <div className="nav-label">Theme</div>
              <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: 4 }}>
                {[
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["system", "System"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="btn"
                    onClick={() => setTheme(id)}
                    style={{
                      flex: 1,
                      padding: "9px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 12,
                      background: theme === id ? "rgba(255,255,255,0.16)" : "transparent",
                      border: theme === id ? "1px solid rgba(255,255,255,0.22)" : "1px solid transparent",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </nav>
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <button
                type="button"
                onClick={pickProfileImage}
                title="Change profile image"
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #c084fc, #818cf8)",
                  display: "grid", placeItems: "center",
                  border: "1px solid rgba(255,255,255,0.18)",
                  overflow: "hidden",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {user?.avatarDataUrl ? (
                  <img src={user.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {(user?.shopName || user?.email || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              <input
                ref={profileImgInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => onProfileImageFile(e.target.files?.[0])}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.shopName || tr("common.myShop")}
                </div>
                <div style={{ color: "var(--text-sidebar)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email || tr("common.admin")} • {(user?.role === "admin") ? "Admin" : "Stock Manager"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => onUpdateUser?.({ role: "stock_manager" })}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: user?.role !== "admin" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Stock Manager
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onUpdateUser?.({ role: "admin" })}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: user?.role === "admin" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Admin
              </button>
            </div>
            <button onClick={onLogout} className="nav-item" style={{
              width: "100%", padding: "9px 14px", display: "flex", alignItems: "center", gap: 8,
              background: "rgba(239,68,68,0.1)", border: "none", color: "#fca5a5",
              fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              {tr("common.logout")}
            </button>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 10, color: "var(--text-sidebar)" }}>
              <span>Powered by</span>
              <img src={POWERED_BY_LOGO_SRC} alt="PixelSpring" style={{ width: 14, height: 14, objectFit: "contain" }} />
              <span style={{ color: "#fff", fontWeight: 700 }}>PixelSpring</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main" style={{ flex: 1, marginLeft: sidebarOpen ? "var(--sidebar-w)" : 0, transition: "margin-left 0.3s" }}>
          {/* Header */}
          <header style={{
            padding: "16px 32px",
            background: "var(--header-glass, linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.46)))",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50,
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)",
          }} className="app-header">
            <button className="btn" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ padding: 8, background: "transparent", color: "var(--text)" }}>
              {Icons.menu}
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
              {page === "dashboard"
                ? tr("nav.dashboard")
                : page === "uptime"
                  ? tr("nav.uptime")
                : page === "stockIn"
                ? tr("nav.stockIn")
                : page === "stockOut"
                  ? tr("nav.stockOut")
                  : page === "inventory"
                    ? tr("nav.inventory")
                    : tr("nav.reports")}
            </h1>
            <div style={{ flex: 1 }} />
            <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)" }}>
              {new Date().toLocaleDateString(localeForLang(lang), { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }} title={tr("common.language")}>
              <span style={{ color: "var(--text-dim)", display: "inline-flex", alignItems: "center" }}>{Icons.globe}</span>
              <div className="glass-dd header-dd" ref={langWrapRef}>
                <button
                  type="button"
                  className="glass-dd-btn"
                  onClick={() => setLangOpen(v => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={langOpen ? "true" : "false"}
                  style={{ padding: "9px 12px", borderRadius: 12, fontSize: 12 }}
                >
                  <span className="glass-dd-value">
                    <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 800 }}>{lang.toUpperCase()}</span>
                    <span className="glass-dd-sub" style={{ color: "inherit", opacity: 0.75 }}>{LANGS[lang]}</span>
                  </span>
                  <span aria-hidden="true" style={{ opacity: 0.8, display: "inline-flex" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>

                {langOpen && (
                  <div className="glass-dd-list" role="listbox" aria-label="Language options" style={{ top: "calc(100% + 10px)" }}>
                    {LANG_OPTIONS.map(([code, label]) => (
                      <button
                        type="button"
                        key={code}
                        className={`glass-dd-item ${lang === code ? "is-active" : ""}`}
                        onClick={() => { setLang(code); setLangOpen(false); }}
                      >
                        <span>{label}</span>
                        <small>{code.toUpperCase()}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={saveNow}
              disabled={saveStatus === "saving"}
              className="btn"
              style={{
                padding: "9px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: saveStatus === "saving" ? "wait" : "pointer",
                fontSize: 12,
                fontWeight: 700,
                opacity: saveStatus === "saving" ? 0.7 : 1,
              }}
              title={tr("common.saveTitle")}
            >
              {Icons.save} {saveStatus === "saving" ? tr("common.saving") : tr("common.save")}
            </button>
            <div style={{ position: "relative" }}>
              <div style={{ cursor: "pointer", color: "var(--text-dim)" }}>{Icons.bell}</div>
              {lowStockProducts.length > 0 && <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />}
            </div>
          </header>

          <div style={{ padding: "24px 32px", animation: "fadeIn 0.3s ease" }} className="app-content">
            {page === "dashboard" && <DashboardPage stats={stats} period={period} setPeriod={setPeriod} chartData={chartData} topProducts={topProducts} lowStockProducts={lowStockProducts} products={products} transactions={transactions} COLORS={COLORS} t={tr} currency={currency} />}
            {page === "uptime" && <UptimePage uptimeSec={uptimeSec} points={uptimePoints} logs={uptimeLogs} />}
            {page === "stockIn" && <StockInPage products={products} addTransaction={addTransaction} findOrCreateProduct={findOrCreateProduct} updateProductPrice={updateProductPrice} showToast={showToast} t={tr} tf={trf} lang={lang} currency={currency} />}
            {page === "stockOut" && <StockOutPage products={products} addTransaction={addTransaction} updateProductPrice={updateProductPrice} showToast={showToast} t={tr} tf={trf} lang={lang} currency={currency} />}
            {page === "inventory" && <InventoryPage products={products} updateProductPrice={updateProductPrice} removeProduct={removeProduct} undoRemoveProduct={undoRemoveProduct} hasUndo={!!lastDeleted} showToast={showToast} t={tr} />}
            {page === "reports" && <ReportsPage transactions={transactions} products={products} onImportData={importAppData} onExportData={exportAppData} showToast={showToast} t={tr} lang={lang} />}
          </div>
        </main>

        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </>
  );
}

// ─── DASHBOARD ───
function DashboardPage({ stats, period, setPeriod, chartData, topProducts, lowStockProducts, products, transactions, COLORS, t, currency }) {
  const periodButtons = ["today", "weekly", "monthly", "yearly"];
  const recentTxns = transactions.slice(0, 8);
  const tt = t || ((k) => k);
  const unitByName = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => { if (p && p.name) m[p.name] = p.unit; });
    return m;
  }, [products]);
  const [showCharts, setShowCharts] = useState(true);
  const [isSmall, setIsSmall] = useState(false);
  const stockDistribution = products
    .filter(p => p.stock > 0)
    .slice(0, 8)
    .map((p, i) => ({ name: p.name, value: p.stock, color: COLORS[i % COLORS.length] }));
  const totalStock = stockDistribution.reduce((sum, p) => sum + p.value, 0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShowCharts(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
    const apply = () => setIsSmall(mq ? mq.matches : (window.innerWidth <= 720));
    apply();
    if (!mq) return;
    const handler = () => apply();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  return (
    <div>
      {/* Welcome banner when empty */}
      {products.length === 0 && transactions.length === 0 && (
        <div style={{
          background: "linear-gradient(135deg, #eef2ff, #e0e7ff)", borderRadius: 20, padding: "36px 32px",
          marginBottom: 28, border: "1px solid #c7d2fe",
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1e1b4b", marginBottom: 8 }}>
            {tt("common.noDataDash.title")} 🎉
          </div>
          <div style={{ fontSize: 15, color: "#4338ca", lineHeight: 1.6, maxWidth: 560 }}>
            {tt("common.noDataDash.body1")} <strong>{tt("nav.stockIn")}</strong> {tt("common.noDataDash.body2")}
            {" "}
            {tt("common.noDataDash.body3")}
          </div>
        </div>
      )}

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {periodButtons.map(p => (
          <button key={p} className="btn" onClick={() => setPeriod(p)} style={{
            padding: "8px 20px", fontSize: 13, textTransform: "capitalize",
            background: period === p ? "var(--primary)" : "var(--bg-card)",
            color: period === p ? "#fff" : "var(--text-dim)", border: period === p ? "none" : "1px solid var(--border)",
          }}>{tt(`period.${p}`)}</button>
        ))}
      </div>

      {isSmall && (
        <>
          {/* Charts Row (phone first) */}
          <div className="dash-charts" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 28 }}>
            <div className="glass-panel" style={{ padding: 24, overflow: "visible", animation: showCharts ? "chartRise 0.9s ease-out" : "none" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{tt("dashboard.salesPurchases")}</div>
              <SimpleTwoLineChart data={chartData} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="glass-panel" style={{ padding: 24, flex: 1, animation: showCharts ? "chartRise 0.9s ease-out" : "none" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{tt("dashboard.stockDistribution")}</div>
                <SimpleDonutChart data={stockDistribution} />
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: -4, marginBottom: 8 }}>
                  {tt("common.totalInStock")}: <strong style={{ color: "var(--text)" }}>{fmt(totalStock)}</strong>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {stockDistribution.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{tt("common.noStockYet")}</span>
                  ) : stockDistribution.map((s, i) => (
                    <span key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                      {s.name} ({fmt(s.value)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
            {[
              { label: tt("dashboard.totalSales"), value: fmtCur(stats.totalSales, currency), icon: Icons.trend, color: "#6366f1", bg: "var(--primary-bg)", sub: `${stats.salesCount} ${tt("common.orders")}` },
              { label: tt("dashboard.totalPurchases"), value: fmtCur(stats.totalPurchases, currency), icon: Icons.stockIn, color: "#059669", bg: "var(--green-bg)", sub: `${stats.purchaseCount} ${tt("common.entries")}` },
              { label: tt("dashboard.netProfit"), value: fmtCur(stats.totalProfit, currency), icon: Icons.trend, color: stats.totalProfit >= 0 ? "#059669" : "#dc2626", bg: stats.totalProfit >= 0 ? "var(--green-bg)" : "var(--red-bg)", sub: `${((stats.totalProfit / (stats.totalSales || 1)) * 100).toFixed(1)}% ${tt("common.margin")}` },
              { label: tt("dashboard.itemsSold"), value: fmt(stats.totalItems), icon: Icons.inventory, color: "#d97706", bg: "var(--orange-bg)", sub: tt("common.unitsTotal") },
            ].map((card, i) => (
              <div key={i} className="stat-card" style={{
                background: "var(--bg-card)", borderRadius: 16, padding: "22px 24px",
                border: "1px solid var(--border)", position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 16, right: 16, width: 42, height: 42, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8, fontWeight: 500 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: card.color, fontFamily: "'Space Mono', monospace" }}>{card.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isSmall && (
        <>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
            {[
              { label: tt("dashboard.totalSales"), value: fmtCur(stats.totalSales, currency), icon: Icons.trend, color: "#6366f1", bg: "var(--primary-bg)", sub: `${stats.salesCount} ${tt("common.orders")}` },
              { label: tt("dashboard.totalPurchases"), value: fmtCur(stats.totalPurchases, currency), icon: Icons.stockIn, color: "#059669", bg: "var(--green-bg)", sub: `${stats.purchaseCount} ${tt("common.entries")}` },
              { label: tt("dashboard.netProfit"), value: fmtCur(stats.totalProfit, currency), icon: Icons.trend, color: stats.totalProfit >= 0 ? "#059669" : "#dc2626", bg: stats.totalProfit >= 0 ? "var(--green-bg)" : "var(--red-bg)", sub: `${((stats.totalProfit / (stats.totalSales || 1)) * 100).toFixed(1)}% ${tt("common.margin")}` },
              { label: tt("dashboard.itemsSold"), value: fmt(stats.totalItems), icon: Icons.inventory, color: "#d97706", bg: "var(--orange-bg)", sub: tt("common.unitsTotal") },
            ].map((card, i) => (
              <div key={i} className="stat-card" style={{
                background: "var(--bg-card)", borderRadius: 16, padding: "22px 24px",
                border: "1px solid var(--border)", position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 16, right: 16, width: 42, height: 42, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                  {card.icon}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8, fontWeight: 500 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: card.color, fontFamily: "'Space Mono', monospace" }}>{card.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="dash-charts" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 28 }}>
            <div className="glass-panel" style={{ padding: 24, overflow: "visible", animation: showCharts ? "chartRise 0.9s ease-out" : "none" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{tt("dashboard.salesPurchases")}</div>
              <SimpleTwoLineChart data={chartData} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="glass-panel" style={{ padding: 24, flex: 1, animation: showCharts ? "chartRise 0.9s ease-out" : "none" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{tt("dashboard.stockDistribution")}</div>
                <SimpleDonutChart data={stockDistribution} />
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: -4, marginBottom: 8 }}>
                  {tt("common.totalInStock")}: <strong style={{ color: "var(--text)" }}>{fmt(totalStock)}</strong>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {stockDistribution.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{tt("common.noStockYet")}</span>
                  ) : stockDistribution.map((s, i) => (
                    <span key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                      {s.name} ({fmt(s.value)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Row */}
      <div className="dash-bottom" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Top Selling */}
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{tt("dashboard.topSellingProducts")}</div>
          {topProducts.map((p, i) => {
            const maxQ = topProducts[0]?.qty || 1;
            return (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, background: i < 3 ? COLORS[i] : "var(--bg)", color: i < 3 ? "#fff" : "var(--text-dim)",
                }}>{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={unitByName[p.name] || "piece"} size={16} /></span>
                    <span>{p.name}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg)", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: COLORS[i % COLORS.length], width: `${(p.qty / maxQ) * 100}%`, transition: "width 0.8s ease" }} />
                  </div>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace" }}>{p.qty}</span>
              </div>
            );
          })}
        </div>

        {/* Low Stock Alerts */}
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              <span style={{ color: "#ef4444" }}>{Icons.alert}</span> {tt("dashboard.lowStockAlerts")}
            </div>
          {lowStockProducts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-dim)" }}>{tt("dashboard.allWellStocked")}</div>
          ) : lowStockProducts.slice(0, 6).map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "10px 14px",
              borderRadius: 10, background: p.stock < 15 ? "var(--low-bg)" : "var(--med-bg)",
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: p.stock < 15 ? "var(--low-fg)" : "var(--med-fg)",
                animation: p.stock < 10 ? "pulse 2s infinite" : "none",
              }} />
              <span style={{ flex: 1, fontWeight: 500, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={p.unit} size={16} /></span>
                <span>{p.name}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: p.stock < 15 ? "var(--low-fg)" : "var(--med-fg)", fontFamily: "'Space Mono', monospace" }}>
                {p.stock} {p.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="recent-card" style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginTop: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{tt("dashboard.recentTransactions")}</div>
        {recentTxns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-dim)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14 }}>No transactions yet. Add stock or sell products to see them here.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="recent-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Product", "Type", "Qty", "Price/unit", "Total", "Profit", "Date"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentTxns.map(t => {
                const perUnit = t.type === "in" ? t.costPrice : t.salePrice;
                const total = perUnit * t.quantity;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "12px", fontSize: 14, fontWeight: 500 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={t.unit} size={16} /></span>
                        <span>{t.productName}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        className="chip"
                        style={{
                          background: t.type === "in" ? "var(--green-bg)" : "var(--blue-bg)",
                          color: t.type === "in" ? "var(--green)" : "var(--blue)",
                        }}
                      >
                        {t.type === "in" ? Icons.stockIn : Icons.stockOut}
                        {t.type === "in" ? "Stock In" : "Sale"}
                      </span>
                    </td>
                    <td className="mono" style={{ padding: "12px", fontSize: 14, fontFamily: "'Space Mono', monospace" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", opacity: 0.85 }}><UnitIcon unit={t.unit} size={14} /></span>
                        <span>{t.quantity} {t.unit}</span>
                      </span>
                    </td>
                    <td className="mono" style={{ padding: "12px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                      {fmtCur(perUnit)}<span style={{ fontSize: 11, color: "var(--text-dim)" }}>/{t.unit}</span>
                    </td>
                    <td className="mono" style={{ padding: "12px", fontSize: 14, fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>
                      {fmtCur(total)}
                    </td>
                    <td className="mono" style={{ padding: "12px", fontSize: 14, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: t.profit > 0 ? "var(--green)" : "var(--text-dim)" }}>
                      {t.type === "out" ? fmtCur(t.profit) : "—"}
                    </td>
                    <td style={{ padding: "12px", fontSize: 13, color: "var(--text-dim)" }}>{t.date}</td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UptimePage({ uptimeSec, points, logs }) {
  const fmtDur = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const data = (points || []).slice(-120); // last ~20min at 10s sampling
  // Show fewer bars for a cleaner modern look
  const BAR_COUNT = 36;
  const stride = Math.max(1, Math.floor(data.length / BAR_COUNT));
  const bars = data.filter((_, i) => i % stride === 0).slice(-BAR_COUNT);
  const maxV = Math.max(1, ...bars.map(d => Number(d.v || 0)));
  const width = 900;
  const height = 240;
  const pad = { top: 18, right: 16, bottom: 28, left: 52 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: "var(--primary-bg)", display: "grid", placeItems: "center", color: "var(--primary)" }}>
          {Icons.uptime}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>System Uptime</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Tracks how long this session has been running.</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-card)", fontFamily: "'Space Mono', monospace", fontWeight: 800, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
          {fmtDur(uptimeSec)}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "var(--text)" }}>Uptime (bar graph)</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Last ~20 minutes • sampled</div>
        </div>
        <div style={{ width: "100%", aspectRatio: `${width} / ${height}`, minHeight: 220 }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
            <defs>
              <linearGradient id="upBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.40" />
              </linearGradient>
              <linearGradient id="upGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="g" />
                <feMerge>
                  <feMergeNode in="g" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* grid */}
            {[...Array(5)].map((_, i) => {
              const y = pad.top + (i / 4) * chartH;
              return <line key={i} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />;
            })}
            <line x1={pad.left} y1={pad.top + chartH} x2={width - pad.right} y2={pad.top + chartH} stroke="var(--chart-axis)" />
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke="var(--chart-axis)" />

            {/* y labels */}
            {[...Array(5)].map((_, i) => {
              const v = Math.round(maxV - (i / 4) * maxV);
              const y = pad.top + (i / 4) * chartH;
              return (
                <text key={i} x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--chart-text)">
                  {fmtDur(v)}
                </text>
              );
            })}

            {/* bars */}
            {(() => {
              const n = Math.max(1, bars.length);
              const gap = 6;
              const barW = Math.max(6, Math.min(18, (chartW - gap * (n - 1)) / n));
              const usedW = barW * n + gap * (n - 1);
              const x0 = pad.left + Math.max(0, (chartW - usedW) / 2);
              const baseY = pad.top + chartH;
              return bars.map((d, i) => {
                const v = Math.max(0, Number(d.v || 0));
                const h = (v / maxV) * chartH;
                const x = x0 + i * (barW + gap);
                const y = baseY - h;
                return (
                  <g key={d.t || i}>
                    <rect x={x} y={y} width={barW} height={h} rx="10" fill="url(#upBar)" filter="url(#barGlow)" opacity="0.9" />
                    <rect x={x} y={y} width={barW} height={Math.min(h, 26)} rx="10" fill="url(#upGlow)" opacity="0.9" />
                  </g>
                );
              });
            })()}

            {/* x labels (sparse) */}
            {bars.filter((_, i) => i === 0 || i === Math.floor(bars.length / 2) || i === bars.length - 1).map((d, idx) => {
              const n = Math.max(1, bars.length);
              const gap = 6;
              const barW = Math.max(6, Math.min(18, (chartW - gap * (n - 1)) / n));
              const usedW = barW * n + gap * (n - 1);
              const x0 = pad.left + Math.max(0, (chartW - usedW) / 2);
              const i = idx === 0 ? 0 : (idx === 1 ? Math.floor(bars.length / 2) : bars.length - 1);
              const x = x0 + i * (barW + gap) + barW / 2;
              const label = new Date(d.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <text key={d.t || idx} x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="var(--chart-text)">
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 18, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Logs</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Recent system events (this session)</div>
        </div>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Time</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>Event</th>
              </tr>
            </thead>
            <tbody>
              {(logs || []).slice().reverse().slice(0, 30).map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-dim)", fontFamily: "'Space Mono', monospace" }}>
                    {new Date(l.t).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{l.msg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SimpleTwoLineChart({ data }) {
  // Keep a single source of truth for line colors so the fade fill always matches.
  // (SVG gradient stops don't reliably resolve CSS variables across browsers.)
  const SALES_COLOR = "#6366f1";
  const PURCH_COLOR = "#22c55e";
  const width = 800;
  const height = 280;
  // Slightly larger padding so thick strokes/glow stay inside the frame.
  const pad = { top: 22, right: 22, bottom: 30, left: 60 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxY = Math.max(1, ...data.map(d => Math.max(0, Number(d.sales || 0), Number(d.purchases || 0))));
  const labelEvery = data.length <= 8 ? 1 : data.length <= 12 ? 2 : 3;
  const ticks = 4;

  const pointsFor = (key) => data.map((d, i) => {
    const x = pad.left + (i / Math.max(1, data.length - 1)) * chartW;
    const v = Math.max(0, Number(d[key] || 0));
    const yy = pad.top + (1 - v / maxY) * chartH;
    const y = Math.max(pad.top, Math.min(pad.top + chartH, yy));
    return [x, y];
  });

  const salesPts = pointsFor("sales");
  const purchPts = pointsFor("purchases");
  const mkSmoothPath = (pts, tension = 0.18) => {
    if (!pts || pts.length === 0) return "";
    if (pts.length === 1) return `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    const t = Math.max(0, Math.min(0.5, tension));
    const yMin = pad.top;
    const yMax = pad.top + chartH;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const c = (p0, p1, p2, p3) => {
      const x1 = p1[0] + (p2[0] - p0[0]) * t;
      const y1 = clamp(p1[1] + (p2[1] - p0[1]) * t, yMin, yMax);
      const x2 = p2[0] - (p3[0] - p1[0]) * t;
      const y2 = clamp(p2[1] - (p3[1] - p1[1]) * t, yMin, yMax);
      return [x1, y1, x2, y2];
    };
    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const [x1, y1, x2, y2] = c(p0, p1, p2, p3);
      d += ` C${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d;
  };
  const salesPath = mkSmoothPath(salesPts, 0.18);
  const purchPath = mkSmoothPath(purchPts, 0.18);
  const baseY = pad.top + chartH;
  const mkAreaPath = (linePath, pts) => {
    if (!linePath || !pts || pts.length < 2) return "";
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${linePath} L${last[0].toFixed(2)},${baseY.toFixed(2)} L${first[0].toFixed(2)},${baseY.toFixed(2)} Z`;
  };
  const salesArea = mkAreaPath(salesPath, salesPts);
  const purchArea = mkAreaPath(purchPath, purchPts);

  return (
    <div style={{ width: "100%", padding: 6 }}>
      <div style={{ width: "100%", overflow: "hidden", aspectRatio: `${width} / ${height}`, minHeight: 220 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "hidden", display: "block" }}
        >
          <defs>
          <linearGradient id="salesGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SALES_COLOR} stopOpacity="0.14" />
            <stop offset="100%" stopColor={SALES_COLOR} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="purchGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PURCH_COLOR} stopOpacity="0.12" />
            <stop offset="100%" stopColor={PURCH_COLOR} stopOpacity="0" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.8 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          </defs>

          {/* Soft gradient fills under lines */}
          {salesArea && <path d={salesArea} fill="url(#salesGlow)" stroke="none" />}
          {purchArea && <path d={purchArea} fill="url(#purchGlow)" stroke="none" />}

          {[...Array(ticks + 1)].map((_, i) => {
            const y = pad.top + (i / ticks) * chartH;
            return <line key={i} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />;
          })}

          <line x1={pad.left} y1={pad.top + chartH} x2={width - pad.right} y2={pad.top + chartH} stroke="var(--chart-axis)" />
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke="var(--chart-axis)" />

          {[...Array(ticks + 1)].map((_, i) => {
            const val = Math.max(0, Math.round(maxY - (i / ticks) * maxY));
            const y = pad.top + (i / ticks) * chartH;
            return (
              <text key={i} x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--chart-text)">
                {fmt(val)}
              </text>
            );
          })}

          {data.filter((_, i) => i % labelEvery === 0).map((d, idx) => {
            const i = idx * labelEvery;
            const x = pad.left + (i / Math.max(1, data.length - 1)) * chartW;
            return (
              <text key={d.date + i} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--chart-text)">
                {d.date}
              </text>
            );
          })}

          <path d={salesPath} fill="none" stroke={SALES_COLOR} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.16" filter="url(#softGlow)" />
          <path
            d={salesPath}
            fill="none"
            stroke={SALES_COLOR}
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset="100"
            style={{ animation: "chartDraw 2.6s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
          />
          <path d={purchPath} fill="none" stroke={PURCH_COLOR} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.14" filter="url(#softGlow)" />
          <path
            d={purchPath}
            fill="none"
            stroke={PURCH_COLOR}
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset="100"
            style={{ animation: "chartDraw 2.6s cubic-bezier(0.22, 1, 0.36, 1) 0.16s forwards" }}
          />
        </svg>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, fontSize: 12, color: "var(--text-dim)", flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 999,
          border: "1px solid rgba(99,102,241,0.28)",
          background: "rgba(99,102,241,0.10)",
          color: "var(--text)",
          fontWeight: 800,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", display: "inline-block", boxShadow: "0 0 0 4px rgba(99,102,241,0.12)" }} />
          Sales
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: 999,
          border: "1px solid rgba(34,197,94,0.28)",
          background: "rgba(34,197,94,0.10)",
          color: "var(--text)",
          fontWeight: 800,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 0 4px rgba(34,197,94,0.12)" }} />
          Purchases
        </span>
        <span className="hide-sm" style={{ marginLeft: 6, fontSize: 11, color: "var(--text-dim)", opacity: 0.85 }}>
          Blue line = <strong>Sales</strong>, Green line = <strong>Purchases</strong>
        </span>
      </div>
    </div>
  );
}

function SimpleScatterCorrelation({ data, xKey, yKey, xLabel, yLabel, dotColor = "rgba(99,102,241,0.9)" }) {
  const width = 360;
  const height = 200;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const pts = (Array.isArray(data) ? data : [])
    .map((d) => [Number(d?.[xKey] ?? 0), Number(d?.[yKey] ?? 0)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  const safeRange = (a, b) => (b - a === 0 ? 1 : (b - a));
  const xRange = safeRange(minX, maxX);
  const yRange = safeRange(minY, maxY);

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const mapX = (x) => pad.left + ((x - minX) / xRange) * plotW;
  const mapY = (y) => pad.top + (1 - (y - minY) / yRange) * plotH;

  const pearsonR = (() => {
    if (pts.length < 2) return 0;
    const n = pts.length;
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / n;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx;
      const b = ys[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    const den = Math.sqrt(dx * dy);
    return den === 0 ? 0 : (num / den);
  })();

  return (
    <div style={{ width: "100%", height: 200 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        <line x1={pad.left} y1={pad.top + plotH} x2={width - pad.right} y2={pad.top + plotH} stroke="var(--chart-axis)" />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="var(--chart-axis)" />
        {[0.25, 0.5, 0.75].map((t, i) => (
          <line key={i} x1={pad.left} y1={pad.top + t * plotH} x2={width - pad.right} y2={pad.top + t * plotH} stroke="var(--chart-grid)" />
        ))}
        {pts.slice(0, 220).map(([x, y], i) => (
          <circle key={i} cx={mapX(x)} cy={mapY(y)} r="3.2" fill={dotColor} opacity="0.85" />
        ))}
        <text x={width - pad.right} y={pad.top + 10} textAnchor="end" fontSize="11" fill="var(--chart-text)">
          r={pearsonR.toFixed(2)}
        </text>
        <text x={width / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--chart-text)">{xLabel}</text>
        <text x={12} y={height / 2} textAnchor="middle" fontSize="10" fill="var(--chart-text)" transform={`rotate(-90 12 ${height / 2})`}>{yLabel}</text>
      </svg>
    </div>
  );
}

function SimpleDonutChart({ data }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const stroke = 22;
  const total = Math.max(1, data.reduce((s, d) => s + Number(d.value || 0), 0));
  let acc = 0;

  return (
    <div style={{ width: "100%", height: 160, display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const frac = Number(d.value || 0) / total;
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += Number(d.value || 0);
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + r * Math.cos(start);
          const y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end);
          const y2 = cy + r * Math.sin(end);
          const large = frac > 0.5 ? 1 : 0;
          const dPath = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
          return (
            <path
              key={d.name + i}
              d={dPath}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
              style={{ animation: `chartDraw 3s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.14}s forwards` }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - stroke / 2} fill="var(--chart-donut-hole)" />
      </svg>
    </div>
  );
}

// ─── STOCK IN ───
function StockInPage({ products, addTransaction, findOrCreateProduct, showToast, updateProductPrice, t, tf, lang, currency }) {
  const tt = t || ((k) => k);
  const ttf = tf || ((k, vars = {}) => {
    let str = tt(k);
    Object.entries(vars).forEach(([kk, vv]) => { str = str.replaceAll(`{${kk}}`, String(vv)); });
    return str;
  });
  const [name, setName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(nowTime());
  const [multiInput, setMultiInput] = useState("");
  const [mode, setMode] = useState("single");
  // Cost calculation mode: "total" = enter total paid, "perUnit" = enter price per unit
  const [costMode, setCostMode] = useState("total");
  const [totalPaid, setTotalPaid] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [salePricePerUnitInput, setSalePricePerUnitInput] = useState("");

  // Multi-item defaults (optional): applied to each parsed item
  const [multiCostPerUnitInput, setMultiCostPerUnitInput] = useState("");
  const [multiSalePerUnitInput, setMultiSalePerUnitInput] = useState("");

  const calcCostPerUnit = costMode === "total"
    ? (totalPaid && qty ? parseFloat(totalPaid) / parseFloat(qty) : 0)
    : (pricePerUnit ? parseFloat(pricePerUnit) : 0);

  const calcTotalCost = costMode === "total"
    ? (totalPaid ? parseFloat(totalPaid) : 0)
    : (pricePerUnit && qty ? parseFloat(pricePerUnit) * parseFloat(qty) : 0);

  // Values are typed in current display currency. Convert to base before formatting,
  // because fmtCur() expects base values and applies currency formatting.
  const calcCostPerUnitBase = toBaseMoney(calcCostPerUnit);
  const calcTotalCostBase = toBaseMoney(calcTotalCost);

  const handleSelect = (p) => {
    setSelectedProduct(p);
    setUnit(p.unit);
    if (p.costPrice > 0) {
      setCostMode("perUnit");
      setPricePerUnit(p.costPrice.toString());
      setTotalPaid("");
    }
  };

  const handleAdd = () => {
    if (!name || !qty) { showToast(tt("stockIn.error.nameQty"), "error"); return; }
    if (calcCostPerUnit <= 0) { showToast(tt("stockIn.error.validCost"), "error"); return; }
    const normalizedUnit = normalizeUnit(unit);
    const cpp = calcCostPerUnit;
    const saleVal = parseFloat(salePricePerUnitInput);
    const salePerInputUnit = Number.isFinite(saleVal) && saleVal > 0 ? saleVal : 0;

    const product = selectedProduct || findOrCreateProduct(name, normalizedUnit, cpp, salePerInputUnit);
    if (selectedProduct && !isConvertible(normalizedUnit, selectedProduct.unit)) {
      showToast(ttf("stockIn.error.unitNotCompatible", { unit: normalizedUnit, productUnit: selectedProduct.unit }), "error");
      return;
    }
    // Also update product's stored cost per unit
    const costPerProductUnit = normalizedUnit === product.unit ? cpp : (convertPricePerUnit(cpp, normalizedUnit, product.unit) ?? cpp);
    const salePerProductUnit = salePerInputUnit === 0
      ? null
      : (normalizedUnit === product.unit ? salePerInputUnit : (convertPricePerUnit(salePerInputUnit, normalizedUnit, product.unit) ?? salePerInputUnit));
    if (updateProductPrice) updateProductPrice(product.id, costPerProductUnit, salePerProductUnit);
    const txn = {
      id: uid(), productId: product.id, productName: name, type: "in",
      quantity: parseFloat(qty), unit: normalizedUnit, costPrice: cpp,
      salePrice: 0, profit: 0, date, timestamp: toTimestamp(date, time),
    };
    addTransaction(txn);
    const qtyBase = convertQty(parseFloat(qty), normalizedUnit, product.unit) ?? parseFloat(qty);
    showToast(ttf("stockIn.success.added", {
      qty: fmt(parseFloat(qty)),
      unit: normalizedUnit,
      name,
      stockQty: fmt(qtyBase),
      productUnit: product.unit,
    }));
    setName(""); setQty(""); setTotalPaid(""); setPricePerUnit("");
    setSalePricePerUnitInput(""); setSelectedProduct(null);
  };

  const handleMultiAdd = () => {
    const items = parseMultiInput(multiInput);
    if (items.length === 0) { showToast(tt("stockIn.parseError"), "error"); return; }
    const hasCostDefault = multiCostPerUnitInput.trim() !== "";
    const hasSaleDefault = multiSalePerUnitInput.trim() !== "";
    const defaultCost = parseFloat(multiCostPerUnitInput);
    const defaultSale = parseFloat(multiSalePerUnitInput);
    const costPerUnit = hasCostDefault && Number.isFinite(defaultCost) ? defaultCost : 0;
    const salePerUnit = hasSaleDefault && Number.isFinite(defaultSale) ? defaultSale : 0;

    items.forEach(item => {
      const parsedCostPerUnit = item.totalPaid && item.qty > 0 ? (item.totalPaid / item.qty) : null;
      const effectiveCostPerUnit = parsedCostPerUnit ?? (hasCostDefault ? costPerUnit : 0);
      const product = findOrCreateProduct(item.name, item.unit, effectiveCostPerUnit, hasSaleDefault ? salePerUnit : 0);
      if (updateProductPrice && product) {
        if (effectiveCostPerUnit > 0) {
          const costInProductUnit = item.unit === product.unit ? effectiveCostPerUnit : (convertPricePerUnit(effectiveCostPerUnit, item.unit, product.unit) ?? effectiveCostPerUnit);
          updateProductPrice(product.id, costInProductUnit, undefined);
        }
        if (hasSaleDefault) {
          const saleInProductUnit = item.unit === product.unit ? salePerUnit : (convertPricePerUnit(salePerUnit, item.unit, product.unit) ?? salePerUnit);
          updateProductPrice(product.id, undefined, saleInProductUnit);
        }
      }
      addTransaction({
        id: uid(), productId: product.id, productName: item.name, type: "in",
        quantity: item.qty, unit: item.unit,
        costPrice: effectiveCostPerUnit,
        salePrice: 0, profit: 0,
        date: today(), timestamp: Date.now(),
      });
    });
    showToast(ttf("stockIn.addedItems", { count: items.length }));
    setMultiInput("");
  };

  const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, display: "block" };

  return (
    <div className="page-centered">
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <button className="btn" onClick={() => setMode("single")} style={{
          padding: "10px 24px", fontSize: 14,
          background: mode === "single" ? "var(--primary)" : "var(--bg-card)",
          color: mode === "single" ? "#fff" : "var(--text)", border: mode !== "single" ? "1px solid var(--border)" : "none",
        }}>{tt("stockIn.singleItem")}</button>
        <button className="btn" onClick={() => setMode("multi")} style={{
          padding: "10px 24px", fontSize: 14,
          background: mode === "multi" ? "var(--primary)" : "var(--bg-card)",
          color: mode === "multi" ? "#fff" : "var(--text)", border: mode !== "multi" ? "1px solid var(--border)" : "none",
        }}>{tt("stockIn.multiItem")}</button>
      </div>

      <div className="card-pad" style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)" }}>
        {mode === "single" ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{tt("stockIn.productName")}</label>
              <AutoInput value={name} onChange={setName} products={products} placeholder={tt("stockIn.startTypingProduct")} onSelect={handleSelect} t={tt} />
            </div>

            <div className="grid-2" style={{ marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>{tt("stockIn.quantity")}</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{tt("stockIn.unit")}</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {UNITS.map(u => <option key={u} value={u}>{unitLabelLang(lang, u)} ({unitFull(u)})</option>)}
                </select>
              </div>
            </div>

            {/* Cost Mode Toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>How do you want to enter cost?</label>
              <div style={{ display: "flex", gap: 6, background: "var(--bg)", borderRadius: 12, padding: 4, width: "fit-content" }}>
                <button className="btn" onClick={() => { setCostMode("total"); setPricePerUnit(""); }} style={{
                  padding: "8px 18px", fontSize: 13, borderRadius: 10,
                  background: costMode === "total" ? "var(--primary)" : "transparent",
                  color: costMode === "total" ? "#fff" : "var(--text-dim)",
                }}>I paid total amount</button>
                <button className="btn" onClick={() => { setCostMode("perUnit"); setTotalPaid(""); }} style={{
                  padding: "8px 18px", fontSize: 13, borderRadius: 10,
                  background: costMode === "perUnit" ? "var(--primary)" : "transparent",
                  color: costMode === "perUnit" ? "#fff" : "var(--text-dim)",
                }}>I know price per {unit}</button>
              </div>
            </div>

            {costMode === "total" ? (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Total Amount Paid ({currency || "RWF"})</label>
                <input type="number" step="0.01" value={totalPaid} onChange={e => setTotalPaid(e.target.value)}
                  placeholder="e.g. 1200 for the whole batch" style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Price per {unit} ({currency || "RWF"})</label>
                <input type="number" step="0.01" value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)}
                  placeholder={`e.g. 1.50 per ${unit}`} style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Sale price per {unit} ({currency || "RWF"}/{unit}) (optional)</label>
              <input type="number" step="0.01" value={salePricePerUnitInput} onChange={e => setSalePricePerUnitInput(e.target.value)}
                placeholder={`e.g. 2.99 ${currency || "RWF"} per ${unit} (optional)`} style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
            </div>

            {/* ─── LIVE COST BREAKDOWN ─── */}
            {qty && (calcCostPerUnit > 0 || calcTotalCost > 0) && (
              <div style={{
                padding: "20px 24px", borderRadius: 16, marginBottom: 24,
                background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(59,130,246,0.10))",
                border: "1px solid rgba(99,102,241,0.28)",
                boxShadow: "0 12px 28px rgba(2,6,23,0.12)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>
                  Auto-Calculated Breakdown
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500 }}>Quantity</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--text)" }}>
                      {qty} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-dim)" }}>{unit}</span>
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid rgba(148,163,184,0.35)", paddingLeft: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500 }}>Cost per {unit}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--primary)" }}>
                      {fmtCur(calcCostPerUnitBase)}
                    </div>
                  </div>
                  <div style={{ borderLeft: "1px solid rgba(148,163,184,0.35)", paddingLeft: 16 }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500 }}>Total Cost</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--green)" }}>
                      {fmtCur(calcTotalCostBase)}
                    </div>
                  </div>
                </div>
                {costMode === "total" && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {fmtCur(toBaseMoney(parseFloat(totalPaid || 0)))} ÷ {qty} {unit} = <strong style={{ color: "var(--primary)" }}>{fmtCur(calcCostPerUnitBase)}</strong> per {unit}
                  </div>
                )}
                {costMode === "perUnit" && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {fmtCur(toBaseMoney(parseFloat(pricePerUnit || 0)))} × {qty} {unit} = <strong style={{ color: "#059669" }}>{fmtCur(calcTotalCostBase)}</strong> total
                  </div>
                )}
              </div>
            )}

            <div className="grid-2" style={{ gap: 14, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>{tt("stockIn.enterDate")}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" }} />
              </div>
              <div>
                <label style={labelStyle}>{tt("stockIn.enterTime")}</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" }} />
              </div>
            </div>
            {selectedProduct && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--primary-bg)", marginBottom: 20, fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{selectedProduct.name}</span>
                <span>Stock: <strong style={{ fontFamily: "'Space Mono', monospace" }}>{selectedProduct.stock} {selectedProduct.unit}</strong></span>
                <span>Current cost: <strong style={{ fontFamily: "'Space Mono', monospace", color: "var(--primary)" }}>{fmtCur(selectedProduct.costPrice)}/{selectedProduct.unit}</strong></span>
                {selectedProduct.salePrice > 0 && <span>Sale price: <strong style={{ fontFamily: "'Space Mono', monospace", color: "var(--green)" }}>{fmtCur(selectedProduct.salePrice)}/{selectedProduct.unit}</strong></span>}
              </div>
            )}
            <button className="btn btn-primary" onClick={handleAdd}
              style={{ padding: "14px 40px", fontSize: 16, display: "flex", alignItems: "center", gap: 10 }}>
              {Icons.plus} {tt("stockIn.addStock")}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, display: "block" }}>
                {tt("stockIn.enterMultiple")} <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--primary)" }}>{`Potato 10kg ${currency || "RWF"} 300, Maize 30kg ${currency || "RWF"} 300`}</span>)
              </label>
              <textarea
                value={multiInput} onChange={e => setMultiInput(e.target.value)}
                placeholder={tt("stockIn.multiPlaceholder")}
                rows={4}
                style={{
                  width: "100%", padding: "16px", borderRadius: 12, border: "2px solid var(--border)",
                  fontSize: 15, outline: "none", background: "var(--bg)", resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div className="grid-2" style={{ gap: 14, marginBottom: 18 }}>
              <div>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
                  {Icons.stockIn} {tt("stockIn.defaultCost")}
                </label>
                <input type="number" step="0.01" value={multiCostPerUnitInput} onChange={e => setMultiCostPerUnitInput(e.target.value)}
                  placeholder="e.g. 1.50 per kg" style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
                  {Icons.stockOut} {tt("stockIn.defaultSale")}
                </label>
                <input type="number" step="0.01" value={multiSalePerUnitInput} onChange={e => setMultiSalePerUnitInput(e.target.value)}
                  placeholder="e.g. 2.99 per kg" style={inputStyle} />
              </div>
            </div>
            {multiInput && parseMultiInput(multiInput).length > 0 && (
              <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "var(--primary-bg)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>{tt("stockIn.preview")}</div>
                {parseMultiInput(multiInput).map((item, i) => (
                  <div key={i} style={{ fontSize: 14, marginBottom: 4 }}>
                    {Icons.check} <strong>{item.name}</strong> — {item.qty} {unitLabelLang(lang, item.unit)}{item.totalPaid ? ` • ${currency || "RWF"} ${fmt(item.totalPaid)} ${tt("stockIn.costFromPriceTag")}` : ""}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={handleMultiAdd}
              style={{ padding: "14px 40px", fontSize: 16, display: "flex", alignItems: "center", gap: 10 }}>
              {Icons.plus} {tt("stockIn.addAllItems")}
            </button>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)" }}>
              {tt("stockIn.timestampAuto")}
            </div>
          </>
        )}
      </div>

      {/* Quick Templates */}
      <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginTop: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{tt("stockIn.quickTemplates")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Rice 100kg", "Sugar 50kg", "Oil 20liters", "Flour 50kg", "Beans 30kg", "Milk 20liters"].map(t => (
            <button key={t} className="btn btn-outline" onClick={() => { setMode("multi"); setMultiInput(t); }}
              style={{ padding: "8px 16px", fontSize: 13 }}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── STOCK OUT / SELL ───
function StockOutPage({ products, addTransaction, showToast, updateProductPrice, t, tf, lang, currency }) {
  const tt = t || ((k) => k);
  const ttf = tf || ((k, vars = {}) => {
    let str = tt(k);
    Object.entries(vars).forEach(([kk, vv]) => { str = str.replaceAll(`{${kk}}`, String(vv)); });
    return str;
  });
  const [name, setName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(nowTime());
  // Sale price mode: "perUnit" = price per kg/liter/piece, "total" = total received
  const [saleMode, setSaleMode] = useState("perUnit");
  const [salePricePerUnit, setSalePricePerUnit] = useState("");
  const [totalReceived, setTotalReceived] = useState("");
  const [sellUnit, setSellUnit] = useState("piece");
  const prevSellUnitRef = useRef("piece");

  const unitLabel = selectedProduct ? unitLabelLang(lang, sellUnit) : tt("stockIn.unit").toLowerCase();

  const handleSelect = (p) => {
    setSelectedProduct(p);
    setSellUnit(p.unit);
    if (p.salePrice > 0) {
      setSaleMode("perUnit");
      setSalePricePerUnit((convertPricePerUnit(p.salePrice, p.unit, p.unit) ?? p.salePrice).toString());
      setTotalReceived("");
    }
  };

  const qtyNum = parseFloat(qty) || 0;
  const qtyInProductUnit = selectedProduct ? (convertQty(qtyNum, sellUnit, selectedProduct.unit) ?? 0) : 0;
  const costPerUnit = selectedProduct ? (convertPricePerUnit(selectedProduct.costPrice || 0, selectedProduct.unit, sellUnit) ?? 0) : 0;

  useEffect(() => {
    const prevUnit = prevSellUnitRef.current;
    if (selectedProduct && saleMode === "perUnit" && salePricePerUnit && prevUnit !== sellUnit) {
      const converted = convertPricePerUnit(parseFloat(salePricePerUnit) || 0, prevUnit, sellUnit);
      if (converted !== null) {
        const neat = Number.isFinite(converted) ? String(Number(converted.toFixed(6))) : salePricePerUnit;
        setSalePricePerUnit(neat);
      }
    }
    prevSellUnitRef.current = sellUnit;
  }, [sellUnit, selectedProduct, saleMode, salePricePerUnit]);

  // Calculate sale price per unit based on mode
  const calcSalePricePerUnit = saleMode === "perUnit"
    ? (parseFloat(salePricePerUnit) || 0)
    : (totalReceived && qtyNum > 0 ? parseFloat(totalReceived) / qtyNum : 0);

  const calcTotalSale = saleMode === "perUnit"
    ? ((parseFloat(salePricePerUnit) || 0) * qtyNum)
    : (parseFloat(totalReceived) || 0);

  const totalCostAmount = costPerUnit * qtyNum;
  // Values typed here are in the selected display currency. Convert to base before formatting/calculations,
  // because product prices and analytics are stored in base.
  const salePerUnitBase = toBaseMoney(calcSalePricePerUnit);
  const totalSaleBase = saleMode === "total"
    ? toBaseMoney(parseFloat(totalReceived) || 0)
    : (salePerUnitBase * qtyNum);
  const profitBase = totalSaleBase - totalCostAmount;
  const marginPct = totalSaleBase > 0 ? (profitBase / totalSaleBase) * 100 : 0;

  const handleSell = () => {
    if (!selectedProduct) { showToast(tt("stockOut.error.selectProduct"), "error"); return; }
    if (!qty || qtyNum <= 0) { showToast(tt("stockOut.error.enterQuantity"), "error"); return; }
    if (calcSalePricePerUnit <= 0) { showToast(tt("stockOut.error.validSalePrice"), "error"); return; }
    if (!isConvertible(sellUnit, selectedProduct.unit)) { showToast(tt("stockOut.error.unitNotCompatible"), "error"); return; }
    if (qtyInProductUnit > selectedProduct.stock) { showToast(tt("stockOut.error.notEnoughStock"), "error"); return; }
    const sppu = calcSalePricePerUnit;
    // Save the sale price per unit to the product for next time
    const salePriceInProductUnitDisplay = convertPricePerUnit(sppu, sellUnit, selectedProduct.unit) ?? sppu;
    const salePriceInProductUnitBase = toBaseMoney(salePriceInProductUnitDisplay);
    if (updateProductPrice) updateProductPrice(selectedProduct.id, null, salePriceInProductUnitBase);
    const txn = {
      id: uid(), productId: selectedProduct.id, productName: selectedProduct.name, type: "out",
      quantity: qtyNum, unit: sellUnit,
      costPrice: costPerUnit, salePrice: toBaseMoney(sppu),
      profit: profitBase,
      date, timestamp: toTimestamp(date, time),
    };
    addTransaction(txn);
    const remaining = selectedProduct.stock - qtyInProductUnit;
    showToast(ttf("stockOut.success.sold", {
      qty,
      unit: sellUnit,
      name: selectedProduct.name,
      remaining: fmt(remaining),
      productUnit: selectedProduct.unit,
    }));
    setName(""); setQty(""); setSalePricePerUnit(""); setTotalReceived(""); setSelectedProduct(null);
  };

  const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, display: "block" };

  return (
    <div className="page-centered">
      <div className="card-pad" style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)" }}>
        {/* Product Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>{tt("stockIn.productName")}</label>
          <AutoInput value={name} onChange={setName} products={products} placeholder={tt("stockOut.startTyping")} onSelect={handleSelect} t={tt} />
        </div>

        {/* Product info banner */}
        {selectedProduct && (
          <div style={{
            padding: "16px 20px", borderRadius: 14, background: "var(--primary-bg)", marginBottom: 20,
            border: "1px solid #c7d2fe", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{tt("stockOut.inStock")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: selectedProduct.stock < 20 ? "#dc2626" : "var(--text)" }}>
                {selectedProduct.stock} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-dim)" }}>{selectedProduct.unit}</span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "#c7d2fe" }} />
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{tt("stockOut.costPrice")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--primary)" }}>
                {fmtCur(costPerUnit)} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-dim)" }}>/{selectedProduct.unit}</span>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "#c7d2fe" }} />
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{tt("stockOut.lastSalePrice")}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--green)" }}>
                {selectedProduct.salePrice > 0 ? fmtCur(selectedProduct.salePrice) : "—"} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-dim)" }}>/{selectedProduct.unit}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>{tt("stockIn.quantity")} ({unitLabel})</label>
          <div className="grid-qty">
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0"
              style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
            <select value={sellUnit} onChange={e => setSellUnit(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} disabled={!selectedProduct}>
              {(selectedProduct ? unitsFor(selectedProduct.unit) : UNITS).map(u => <option key={u} value={u}>{unitLabelLang(lang, u)} ({unitFull(u)})</option>)}
            </select>
          </div>
          {selectedProduct && sellUnit !== selectedProduct.unit && qtyNum > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
              {fmt(qtyNum)} {sellUnit} = <strong style={{ color: "var(--primary)" }}>{fmt(qtyInProductUnit)} {selectedProduct.unit}</strong>
            </div>
          )}
        </div>

        {/* Sale Price Mode Toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginBottom: 10 }}>{tt("stockOut.howEnterSalePrice")}</label>
          <div style={{ display: "flex", gap: 6, background: "var(--bg)", borderRadius: 12, padding: 4, width: "fit-content" }}>
            <button className="btn" onClick={() => { setSaleMode("perUnit"); setTotalReceived(""); }} style={{
              padding: "8px 18px", fontSize: 13, borderRadius: 10,
              background: saleMode === "perUnit" ? "var(--primary)" : "transparent",
              color: saleMode === "perUnit" ? "#fff" : "var(--text-dim)",
            }}>{ttf("stockOut.pricePer", { unit: unitLabel })}</button>
            <button className="btn" onClick={() => { setSaleMode("total"); setSalePricePerUnit(""); }} style={{
              padding: "8px 18px", fontSize: 13, borderRadius: 10,
              background: saleMode === "total" ? "var(--primary)" : "transparent",
              color: saleMode === "total" ? "#fff" : "var(--text-dim)",
            }}>{tt("stockOut.totalReceived")}</button>
          </div>
        </div>

        {/* Sale Price Input */}
        {saleMode === "perUnit" ? (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Sale price per {unitLabel} ({currency || "RWF"})</label>
            <input type="number" step="0.01" value={salePricePerUnit} onChange={e => setSalePricePerUnit(e.target.value)}
              placeholder={`e.g. ${(selectedProduct ? (selectedProduct.salePrice || selectedProduct.costPrice * 1.3) : 0).toFixed(2)} ${currency || "RWF"} per ${unitLabel}`}
              style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Total amount received ({currency || "RWF"})</label>
            <input type="number" step="0.01" value={totalReceived} onChange={e => setTotalReceived(e.target.value)}
              placeholder={`e.g. 5000 ${currency || "RWF"} total for the batch`}
              style={{ ...inputStyle, fontSize: 18, fontWeight: 600, fontFamily: "'Space Mono', monospace" }} />
          </div>
        )}

        {/* ─── LIVE CALCULATION BREAKDOWN ─── */}
        {selectedProduct && qtyNum > 0 && calcSalePricePerUnit > 0 && (
          <div style={{
            borderRadius: 16, marginBottom: 24, overflow: "hidden",
            border: `1px solid ${profitBase >= 0 ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
            boxShadow: "0 14px 34px rgba(2,6,23,0.14)",
          }}>
            {/* Calculation formula bar */}
            <div style={{
              padding: "12px 20px", fontSize: 13, fontFamily: "'Space Mono', monospace",
              background: profitBase >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.10)",
              color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
            }}>
              {saleMode === "total" && (
                <span style={{ marginRight: 8, fontSize: 12, color: "var(--primary)" }}>
                  {fmtCur(toBaseMoney(parseFloat(totalReceived || 0)))} ÷ {qty} {unitLabel} = {fmtCur(salePerUnitBase)}/{unitLabel}
                  <span style={{ margin: "0 8px", color: "var(--text-dim)" }}>→</span>
                </span>
              )}
              <span>({fmtCur(salePerUnitBase)} − {fmtCur(costPerUnit)})</span>
              <span>×</span>
              <span>{qty} {unitLabel}</span>
              <span>=</span>
              <strong style={{ color: profitBase >= 0 ? "var(--green)" : "var(--red)" }}>{fmtCur(profitBase)}</strong>
            </div>

            {/* Results grid */}
            <div style={{
              padding: "20px 24px",
              background: profitBase >= 0
                ? "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))"
                : "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(244,63,94,0.08))",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Sale</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--blue)" }}>
                  {fmtCur(totalSaleBase)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{fmtCur(salePerUnitBase)} × {qty}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Cost</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--orange)" }}>
                  {fmtCur(totalCostAmount)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{fmtCur(costPerUnit)} × {qty}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Profit</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: profitBase >= 0 ? "var(--green)" : "var(--red)" }}>
                  {fmtCur(profitBase)}
                </div>
                <div style={{ fontSize: 11, color: profitBase >= 0 ? "var(--green)" : "var(--red)", marginTop: 2, fontWeight: 600 }}>
                  {marginPct.toFixed(1)}% margin
                </div>
              </div>
            </div>

            {/* Sale price per unit info when using total mode */}
            {saleMode === "total" && (
              <div style={{ padding: "10px 20px", background: profitBase >= 0 ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.08)", fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                Sale price per {unitLabel}: <strong style={{ color: "var(--primary)", fontFamily: "'Space Mono', monospace" }}>{fmtCur(salePerUnitBase)}</strong>
                {" "}(from {fmtCur(toBaseMoney(parseFloat(totalReceived || 0)))} ÷ {qty} {unitLabel})
              </div>
            )}
            {saleMode === "perUnit" && (
              <div style={{ padding: "10px 20px", background: profitBase >= 0 ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.08)", fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                {fmtCur(salePerUnitBase)} × {qty} {unitLabel} = <strong style={{ color: "var(--blue)", fontFamily: "'Space Mono', monospace" }}>{fmtCur(totalSaleBase)}</strong> total received
              </div>
            )}

            {/* Warning if selling below cost */}
            {profitBase < 0 && (
              <div style={{ padding: "10px 20px", background: "var(--red-bg)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--red)", fontWeight: 600 }}>
                {Icons.alert} Selling below cost — you are losing {fmtCur(Math.abs(profitBase))} on this sale
              </div>
            )}
            {/* Warning if not enough stock */}
            {qtyInProductUnit > selectedProduct.stock && (
              <div style={{ padding: "10px 20px", background: "var(--orange-bg)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--orange)", fontWeight: 600 }}>
                {Icons.alert} Only {selectedProduct.stock} {selectedProduct.unit} in stock — not enough
              </div>
            )}
          </div>
        )}

        {/* Date & Time */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>{tt("stockIn.enterDate")}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" }} />
          </div>
          <div>
            <label style={labelStyle}>{tt("stockIn.enterTime")}</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ padding: "12px 16px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 15, outline: "none", background: "var(--bg)" }} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSell}
          style={{ padding: "14px 40px", fontSize: 16, display: "flex", alignItems: "center", gap: 10, opacity: (qtyInProductUnit > (selectedProduct?.stock || 0)) ? 0.5 : 1 }}>
          {Icons.stockOut} {tt("stockOut.completeSale")}
        </button>
      </div>

      {/* Quick Sell */}
      {products.length > 0 && (
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{tt("stockOut.quickSell")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...products].sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 8).map(p => (
              <button key={p.id} className="btn btn-outline" onClick={() => { setName(p.name); handleSelect(p); }}
                style={{ padding: "8px 16px", fontSize: 13 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", opacity: 0.85 }}><UnitIcon unit={p.unit} size={16} /></span>
                  <span>{p.name}</span>
                </span>{" "}
                <span style={{ opacity: 0.55, marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>{p.stock}{p.unit}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {products.length === 0 && (
        <div style={{
          textAlign: "center", padding: "48px 20px", marginTop: 20,
          background: "var(--bg-card)", borderRadius: 16, border: "2px dashed var(--border)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{tt("stockOut.noProducts")}</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {ttf("stockOut.addStockFirst", { addStock: tt("stockIn.addStock") }).split(tt("stockIn.addStock"))[0]}
            <strong>{tt("stockIn.addStock")}</strong>
            {ttf("stockOut.addStockFirst", { addStock: tt("stockIn.addStock") }).split(tt("stockIn.addStock")).slice(1).join(tt("stockIn.addStock"))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── INVENTORY ───
function InventoryPage({ products, updateProductPrice, removeProduct, undoRemoveProduct, hasUndo, showToast, t }) {
  const tt = t || ((k) => k);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [editingId, setEditingId] = useState(null);
  const [editCost, setEditCost] = useState("");
  const [editSale, setEditSale] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [displayUnits, setDisplayUnits] = useState({});
  const [unitOpenId, setUnitOpenId] = useState(null);

  useEffect(() => {
    const onDocDown = (e) => {
      try {
        if (!e?.target?.closest?.(".inv-dd")) setUnitOpenId(null);
      } catch (_e) {}
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, []);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditCost(p.costPrice.toString());
    setEditSale(p.salePrice.toString());
  };

  const saveEdit = (p) => {
    const newCost = parseFloat(editCost);
    const newSale = parseFloat(editSale);
    if (isNaN(newCost) || newCost < 0) { showToast(tt("inventory.error.invalidCostPrice"), "error"); return; }
    if (isNaN(newSale) || newSale < 0) { showToast(tt("inventory.error.invalidSalePrice"), "error"); return; }
    updateProductPrice(p.id, toBaseMoney(newCost), toBaseMoney(newSale));
    setEditingId(null);
    showToast(tt("inventory.success.updatedPrices")
      .replace("{name}", p.name)
      .replace("{cost}", fmtCur(toBaseMoney(newCost)))
      .replace("{sale}", fmtCur(toBaseMoney(newSale)))
      .replaceAll("{unit}", p.unit));
  };

  const cancelEdit = () => { setEditingId(null); };

  const filtered = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "stock") return a.stock - b.stock;
      if (sort === "value") return (b.stock * b.costPrice) - (a.stock * a.costPrice);
      return 0;
    });

  const totalValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);

  const inlineInput = { padding: "6px 10px", borderRadius: 8, border: "2px solid var(--primary)", fontSize: 14, outline: "none", width: 80, fontFamily: "'Space Mono', monospace", fontWeight: 600, background: "#fff", textAlign: "center" };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>{Icons.search}</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tt("common.searchProducts")}
            style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 14, outline: "none", background: "var(--bg-card)" }} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ padding: "12px 20px", borderRadius: 12, border: "2px solid var(--border)", fontSize: 14, outline: "none", background: "var(--bg-card)", cursor: "pointer" }}>
          <option value="name">{tt("common.sort.name")}</option>
          <option value="stock">{tt("common.sort.stock")}</option>
          <option value="value">{tt("common.sort.value")}</option>
        </select>
        <div style={{ padding: "10px 20px", borderRadius: 12, background: "var(--primary-bg)", fontSize: 14, fontWeight: 600, color: "var(--primary)" }}>
          {tt("common.totalValue")}: {fmtCur(totalValue)}
        </div>
        {hasUndo && (
          <button onClick={undoRemoveProduct} className="btn btn-outline" style={{ padding: "10px 16px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            {Icons.undo} {tt("common.undoDelete")}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map(p => {
          const viewUnit = displayUnits[p.id] || p.unit;
          const viewStock = convertQty(p.stock, p.unit, viewUnit) ?? p.stock;
          const viewCost = convertPricePerUnit(p.costPrice || 0, p.unit, viewUnit) ?? p.costPrice;
          const viewSale = convertPricePerUnit(p.salePrice || 0, p.unit, viewUnit) ?? p.salePrice;
          const level = p.stock < 15 ? "low" : p.stock < 50 ? "medium" : "high";
          const pct = Math.min((p.stock / 200) * 100, 100);
          const isEditing = editingId === p.id;
          const margin = p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice * 100) : 0;
          return (
            <div key={p.id} className="stat-card" style={{
              background: "var(--bg-card)", borderRadius: 16, padding: 20,
              border: `2px solid ${isEditing ? "var(--primary)" : level === "low" ? "#fecaca" : level === "medium" ? "#fde68a" : "var(--border)"}`,
              transition: "border-color 0.2s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={p.unit} size={18} /></span>
                    <span>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-flex", opacity: 0.7 }}><UnitIcon unit={p.unit} size={14} /></span>
                      <span>{tt("inventory.base")} {p.unit}</span>
                    </span>
                    <div className="glass-dd inv-dd">
                      <button
                        type="button"
                        className="glass-dd-btn"
                        onClick={() => setUnitOpenId((v) => (v === p.id ? null : p.id))}
                        aria-haspopup="listbox"
                        aria-expanded={unitOpenId === p.id ? "true" : "false"}
                      >
                        <span className="glass-dd-value">
                          <span>{viewUnit}</span>
                          <span className="glass-dd-sub">{unitFull(viewUnit)}</span>
                        </span>
                        <span aria-hidden="true" style={{ opacity: 0.9, display: "inline-flex" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </button>
                      {unitOpenId === p.id && (
                        <div className="glass-dd-list" role="listbox" aria-label="Unit options">
                          {unitsFor(p.unit).map((u) => (
                            <button
                              type="button"
                              key={u}
                              className={`glass-dd-item ${viewUnit === u ? "is-active" : ""}`}
                              onClick={() => { setDisplayUnits(prev => ({ ...prev, [p.id]: u })); setUnitOpenId(null); }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={u} size={16} /></span>
                                <span>{unitLabelLang("en", u) || u}</span>
                              </span>
                              <small>{u} • {unitFull(u)}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 170 }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: level === "low" ? "#fef2f2" : level === "medium" ? "#fffbeb" : "#ecfdf5",
                    color: STOCK_COLORS[level],
                  }}>{level === "low" ? tt("common.level.low") : level === "medium" ? tt("common.level.medium") : tt("common.level.good")}</span>
                  {!isEditing && (
                    <>
                      <button onClick={() => startEdit(p)} className="btn" style={{
                        padding: "4px 8px", background: "var(--bg)", color: "var(--text-dim)", borderRadius: 8,
                        display: "flex", alignItems: "center", gap: 4, fontSize: 11, flex: "0 0 auto", whiteSpace: "nowrap",
                      }}>{Icons.edit} {tt("inventory.price")}</button>
                      <button onClick={() => setConfirmDeleteId(p.id)} className="btn" style={{
                        padding: "4px 8px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8,
                        display: "flex", alignItems: "center", gap: 4, fontSize: 11, flex: "0 0 auto",
                      }}>{Icons.trash}</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: STOCK_COLORS[level], marginBottom: 12 }}>
                {fmt(viewStock)} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-dim)" }}>{viewUnit}</span>
              </div>

              <div style={{ height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", borderRadius: 4, background: STOCK_COLORS[level], width: `${pct}%`, transition: "width 0.6s ease" }} />
              </div>

              {isEditing ? (
                <div style={{ background: "var(--primary-bg)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Cost per {p.unit}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700 }}>{window.__zt_currency || "RWF"}</span>
                        <input type="number" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)}
                          style={inlineInput} autoFocus
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(p); if (e.key === "Escape") cancelEdit(); }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Sale per {p.unit}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 700 }}>{window.__zt_currency || "RWF"}</span>
                        <input type="number" step="0.01" value={editSale} onChange={e => setEditSale(e.target.value)}
                          style={inlineInput}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(p); if (e.key === "Escape") cancelEdit(); }} />
                      </div>
                    </div>
                  </div>
                  {editCost && editSale && parseFloat(editSale) > 0 && (
                    <div style={{ fontSize: 12, color: parseFloat(editSale) > parseFloat(editCost) ? "var(--green)" : "#dc2626", fontWeight: 600, marginBottom: 10 }}>
                      Margin: {fmtCur(parseFloat(editSale) - parseFloat(editCost))}/{p.unit} ({((parseFloat(editSale) - parseFloat(editCost)) / parseFloat(editSale) * 100).toFixed(1)}%)
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(p)} className="btn btn-primary" style={{ padding: "6px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      {Icons.check} Save
                    </button>
                    <button onClick={cancelEdit} className="btn btn-outline" style={{ padding: "6px 16px", fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-dim)", marginBottom: 2, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Cost</div>
                    <div style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "var(--text)" }}>{fmtCur(viewCost)}</div>
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-dim)", marginBottom: 2, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Sale</div>
                    <div style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: p.salePrice > 0 ? "var(--green)" : "var(--text-dim)" }}>{p.salePrice > 0 ? fmtCur(viewSale) : "—"}</div>
                  </div>
                  <div style={{ background: margin > 0 ? "var(--green-bg)" : "var(--bg)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-dim)", marginBottom: 2, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Margin</div>
                    <div style={{ fontWeight: 700, fontFamily: "'Space Mono', monospace", color: margin > 0 ? "var(--green)" : "var(--text-dim)" }}>{margin > 0 ? `${margin.toFixed(0)}%` : "—"}</div>
                  </div>
                </div>
              )}

              {/* Delete confirmation overlay */}
              {confirmDeleteId === p.id && (
                <div style={{
                  marginTop: 14, padding: "16px", borderRadius: 12,
                  background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
                  border: "2px solid #fecaca",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>
                    Remove "{p.name}"?
                  </div>
                  <div style={{ fontSize: 12, color: "#991b1b", marginBottom: 12 }}>
                    This will permanently delete this product and all its transaction history.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { removeProduct(p.id); setConfirmDeleteId(null); }}
                      className="btn" style={{
                        padding: "8px 18px", fontSize: 12, fontWeight: 700,
                        background: "#dc2626", color: "#fff", borderRadius: 10,
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                      {Icons.trash} Yes, Remove
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="btn btn-outline" style={{ padding: "8px 18px", fontSize: 12, borderRadius: 10 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "var(--bg-card)", borderRadius: 20, border: "2px dashed var(--border)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>No products yet</div>
          <div style={{ fontSize: 14, color: "var(--text-dim)", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
            Go to <strong>Add Stock</strong> to add your first product. Products are created automatically when you add stock for the first time.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ───
function ReportsPage({ transactions, products, onImportData, onExportData, showToast, t, lang }) {
  const tt = t || ((k) => k);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(today());
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filtered = transactions.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false;
    if (filterProduct && !t.productName.toLowerCase().includes(filterProduct.toLowerCase())) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    return true;
  });

  const summary = {
    totalIn: filtered.filter(t => t.type === "in").reduce((s, t) => s + t.quantity, 0),
    totalOut: filtered.filter(t => t.type === "out").reduce((s, t) => s + t.quantity, 0),
    totalCost: filtered.filter(t => t.type === "in").reduce((s, t) => s + t.costPrice * t.quantity, 0),
    totalRevenue: filtered.filter(t => t.type === "out").reduce((s, t) => s + t.salePrice * t.quantity, 0),
    totalProfit: filtered.filter(t => t.type === "out").reduce((s, t) => s + t.profit, 0),
  };

  const fmtTime = (ts) => {
    try {
      if (!ts) return "—";
      const d = new Date(ts);
      return d.toLocaleTimeString(localeForLang(lang), { hour: "2-digit", minute: "2-digit" });
    } catch (_e) {
      return "—";
    }
  };

  const exportCSV = () => {
    const headers = "Product,Type,Quantity,Unit,Cost Price,Sale Price,Profit,Date,Time\n";
    const rows = filtered.map(t => `${t.productName},${t.type},${t.quantity},${t.unit},${t.costPrice},${t.salePrice},${t.profit},${t.date},${fmtTime(t.timestamp)}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportBackupJSON = () => {
    const payload = onExportData ? onExportData() : { products, transactions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zuritrack_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackupJSON = async (file) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      onImportData?.(data);
    } catch (_e) {
      showToast?.(tt("reports.importError"), "error");
    }
  };

  return (
    <div>
      {/* Filters */}
      <div style={{
        background: "var(--bg-card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", marginBottom: 24,
        display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end",
      }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, display: "block" }}>{tt("reports.filters.from")}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, display: "block" }}>{tt("reports.filters.to")}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg)" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, display: "block" }}>{tt("reports.filters.product")}</label>
          <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)} placeholder={tt("reports.filters.allProducts")}
            style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg)", width: 160 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6, display: "block" }}>{tt("reports.filters.type")}</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "2px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg)", cursor: "pointer" }}>
            <option value="all">{tt("reports.type.all")}</option>
            <option value="in">{tt("reports.type.in")}</option>
            <option value="out">{tt("reports.type.out")}</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={exportCSV} style={{ padding: "10px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          {Icons.download} {tt("common.exportCSV")}
        </button>
        <button className="btn btn-outline" onClick={exportBackupJSON} style={{ padding: "10px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          {Icons.download} {tt("common.exportBackup")}
        </button>
        <label className="btn btn-outline" style={{ padding: "10px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          {tt("common.importBackup")}
          <input type="file" accept="application/json" style={{ display: "none" }} onChange={e => importBackupJSON(e.target.files?.[0])} />
        </label>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: tt("reports.summary.itemsIn"), value: fmt(summary.totalIn), color: "var(--green)", bg: "var(--green-bg)" },
          { label: tt("reports.summary.itemsOut"), value: fmt(summary.totalOut), color: "var(--blue)", bg: "var(--blue-bg)" },
          { label: tt("reports.summary.totalCost"), value: fmtCur(summary.totalCost), color: "var(--orange)", bg: "var(--orange-bg)" },
          { label: tt("reports.summary.revenue"), value: fmtCur(summary.totalRevenue), color: "var(--primary)", bg: "var(--primary-bg)" },
          { label: tt("reports.summary.profit"), value: fmtCur(summary.totalProfit), color: "var(--green)", bg: "var(--green-bg)" },
        ].map((c, i) => (
          <div key={i} style={{ background: "var(--bg-card)", borderRadius: 14, padding: "16px 20px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontFamily: "'Space Mono', monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{filtered.length} {tt("reports.transactions")}</span>
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)", position: "sticky", top: 0 }}>
                {[
                  tt("reports.table.product"),
                  tt("reports.table.type"),
                  tt("reports.table.qty"),
                  tt("reports.table.costUnit"),
                  tt("reports.table.saleUnit"),
                  tt("reports.table.total"),
                  tt("reports.table.profit"),
                  tt("reports.table.date"),
                ].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>{tt("reports.table.time")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(t => {
                const perUnit = t.type === "in" ? t.costPrice : t.salePrice;
                const total = perUnit * t.quantity;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ display: "inline-flex", opacity: 0.9 }}><UnitIcon unit={t.unit} size={15} /></span>
                        <span>{t.productName}</span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: t.type === "in" ? "var(--green-bg)" : "var(--blue-bg)",
                        color: t.type === "in" ? "var(--green)" : "var(--blue)",
                      }}>{t.type === "in" ? tt("reports.badge.in") : tt("reports.badge.sale")}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                      {t.quantity} <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.unit}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                      {fmtCur(t.costPrice)}<span style={{ fontSize: 10, color: "var(--text-dim)" }}>/{t.unit}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>
                      {t.type === "out" ? <>{fmtCur(t.salePrice)}<span style={{ fontSize: 10, color: "var(--text-dim)" }}>/{t.unit}</span></> : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>
                      {fmtCur(total)}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: t.profit > 0 ? "var(--green)" : "var(--text-dim)" }}>
                      {t.type === "out" ? fmtCur(t.profit) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{t.date}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>{fmtTime(t.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Mount after all declarations so any values are initialized.
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
