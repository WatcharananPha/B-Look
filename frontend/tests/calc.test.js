/**
 * Frontend Calculation Tests — Standalone Node.js script
 *
 * Mirrors the exact calculation logic from frontend/src/App.jsx.
 * No test framework required — run with: node frontend/tests/calc.test.js
 *
 * Tests cover:
 *   1. _calculateShippingCost()      — all tiers, boundaries, gap range, >100
 *   2. VAT calculation               — excluded, included, zero-rate
 *   3. Settings VAT display conversion (×100 / ÷100 round-trip)
 *   4. Sizing surcharge              — shirt vs non-shirt
 *   5. productSubtotal / totalBeforeCalc
 *   6. Deposit calculations          — ceil(grandTotal/2), deposit2, balance
 */

"use strict";

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function pass(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, msg) { console.error(`  ✗ ${label}${msg ? " — " + msg : ""}`); failed++; }

function assertEqual(actual, expected, label, tolerance = 1e-6) {
  const ok = (actual === expected) ||
    (typeof actual === "number" && typeof expected === "number" &&
     Math.abs(actual - expected) <= tolerance);
  ok ? pass(label) : fail(label, `actual=${actual}, expected=${expected}`);
}

function assertStrictEqual(actual, expected, label) {
  actual === expected ? pass(label) : fail(label, `actual=${actual}, expected=${expected}`);
}

function section(title) { console.log(`\n[${title}]`); }

// ── Functions extracted from App.jsx (must stay in sync) ─────────────────────

const DEFAULT_SHIPPING_COST_TABLE = [
  { minQty: 10, maxQty: 15, cost: 60  },
  { minQty: 16, maxQty: 20, cost: 80  },
  { minQty: 21, maxQty: 30, cost: 100 },
  { minQty: 31, maxQty: 40, cost: 120 },
  { minQty: 41, maxQty: 50, cost: 180 },
  { minQty: 51, maxQty: 70, cost: 200 },
  { minQty: 80, maxQty: 100, cost: 230 },
];

/**
 * _calculateShippingCost — mirrors App.jsx lines ~146-168
 * @param {number} qty
 * @param {Array}  table       - shipping cost table (default = DEFAULT_SHIPPING_COST_TABLE)
 * @param {number} extraPerUnit - cost per unit above 100 (default localStorage value = 50)
 */
function _calculateShippingCost(qty, table = DEFAULT_SHIPPING_COST_TABLE, extraPerUnit = 50) {
  if (qty < 10) return 0;
  const tier = table.find(t => qty >= t.minQty && qty <= t.maxQty);
  if (tier) return tier.cost;
  if (qty >= 71 && qty <= 79) return 200;  // hardcoded gap (71-79 not in table)
  if (qty > 100) {
    const baseCost = 230;
    const extraQty = qty - 100;
    return baseCost + (extraQty * extraPerUnit);
  }
  return 0;
}

/**
 * VAT calculation — mirrors App.jsx lines ~2738-2747
 */
function calculateVAT(totalBeforeCalc, vatRate, isVatIncluded) {
  let vatAmount = 0, grandTotal = 0;
  if (isVatIncluded) {
    vatAmount = totalBeforeCalc * (vatRate / (1 + vatRate));
    grandTotal = totalBeforeCalc;
  } else {
    vatAmount = totalBeforeCalc * vatRate;
    grandTotal = totalBeforeCalc + vatAmount;
  }
  return { vatAmount, grandTotal };
}

/**
 * Totals — mirrors App.jsx lines ~2732-2736
 */
function calculateTotals(totalQty, basePrice, sizingSurcharge, addOnOptionsTotal, manualAddOnCost, shippingCost, discount) {
  const productSubtotal = Number(totalQty) * Number(basePrice || 0);
  const totalBeforeCalc = Number(productSubtotal || 0)
    + Number(sizingSurcharge || 0)
    + Number(addOnOptionsTotal || 0)
    + Number(manualAddOnCost || 0)
    + Number(shippingCost || 0)
    - Number(discount || 0);
  return { productSubtotal, totalBeforeCalc };
}

/**
 * Deposits — mirrors App.jsx lines ~2750-2753
 */
function calculateDeposit1(grandTotal) {
  return Math.ceil(grandTotal / 2);
}
function calculateDeposit2(grandTotal, deposit1, designFee = 0, advanceHold = 0) {
  return grandTotal - deposit1 - designFee - advanceHold;
}
function calculateBalance(grandTotal, deposit1, deposit2) {
  return grandTotal - deposit1 - deposit2;
}

/**
 * Sizing surcharge — mirrors App.jsx line ~2732
 */
function calculateSizingSurcharge(productType, oversizeSurchargeQty) {
  return productType === "shirt" ? oversizeSurchargeQty * 100 : 0;
}


// ══════════════════════════════════════════════════════════════════════════════
// 1. _calculateShippingCost()
// ══════════════════════════════════════════════════════════════════════════════

section("1. _calculateShippingCost — below minimum");
assertEqual(_calculateShippingCost(0),  0, "qty=0  → 0");
assertEqual(_calculateShippingCost(1),  0, "qty=1  → 0");
assertEqual(_calculateShippingCost(5),  0, "qty=5  → 0");
assertEqual(_calculateShippingCost(9),  0, "qty=9  → 0");

section("1. _calculateShippingCost — tier 10-15 (60 ฿)");
assertEqual(_calculateShippingCost(10), 60, "qty=10 → 60");
assertEqual(_calculateShippingCost(12), 60, "qty=12 → 60");
assertEqual(_calculateShippingCost(15), 60, "qty=15 → 60");

section("1. _calculateShippingCost — tier 16-20 (80 ฿)");
assertEqual(_calculateShippingCost(16), 80, "qty=16 → 80");
assertEqual(_calculateShippingCost(18), 80, "qty=18 → 80");
assertEqual(_calculateShippingCost(20), 80, "qty=20 → 80");

section("1. _calculateShippingCost — tier 21-30 (100 ฿)");
assertEqual(_calculateShippingCost(21), 100, "qty=21 → 100");
assertEqual(_calculateShippingCost(25), 100, "qty=25 → 100");
assertEqual(_calculateShippingCost(30), 100, "qty=30 → 100");

section("1. _calculateShippingCost — tier 31-40 (120 ฿)");
assertEqual(_calculateShippingCost(31), 120, "qty=31 → 120");
assertEqual(_calculateShippingCost(35), 120, "qty=35 → 120");
assertEqual(_calculateShippingCost(40), 120, "qty=40 → 120");

section("1. _calculateShippingCost — tier 41-50 (180 ฿)");
assertEqual(_calculateShippingCost(41), 180, "qty=41 → 180");
assertEqual(_calculateShippingCost(45), 180, "qty=45 → 180");
assertEqual(_calculateShippingCost(50), 180, "qty=50 → 180");

section("1. _calculateShippingCost — tier 51-70 (200 ฿)");
assertEqual(_calculateShippingCost(51), 200, "qty=51 → 200");
assertEqual(_calculateShippingCost(60), 200, "qty=60 → 200");
assertEqual(_calculateShippingCost(70), 200, "qty=70 → 200");

section("1. _calculateShippingCost — gap range 71-79 (hardcoded 200 ฿)");
assertEqual(_calculateShippingCost(71), 200, "qty=71 → 200 (gap, not in table)");
assertEqual(_calculateShippingCost(75), 200, "qty=75 → 200 (gap)");
assertEqual(_calculateShippingCost(79), 200, "qty=79 → 200 (gap)");

section("1. _calculateShippingCost — tier 80-100 (230 ฿)");
assertEqual(_calculateShippingCost(80),  230, "qty=80  → 230");
assertEqual(_calculateShippingCost(90),  230, "qty=90  → 230");
assertEqual(_calculateShippingCost(100), 230, "qty=100 → 230");

section("1. _calculateShippingCost — over 100 (230 + (qty-100)×50)");
assertEqual(_calculateShippingCost(101), 280,  "qty=101 → 230+(1×50)=280");
assertEqual(_calculateShippingCost(102), 330,  "qty=102 → 230+(2×50)=330");
assertEqual(_calculateShippingCost(110), 730,  "qty=110 → 230+(10×50)=730");
assertEqual(_calculateShippingCost(120), 1230, "qty=120 → 230+(20×50)=1230");

section("1. _calculateShippingCost — configurable extraPerUnit");
assertEqual(_calculateShippingCost(110, DEFAULT_SHIPPING_COST_TABLE, 30), 530,
  "qty=110, extra=30 → 230+(10×30)=530");
assertEqual(_calculateShippingCost(110, DEFAULT_SHIPPING_COST_TABLE, 0), 230,
  "qty=110, extra=0 → 230 (flat after 100)");

section("1. _calculateShippingCost — boundary transitions (n-1 vs n)");
const boundaryPairs = [
  [9, 0], [10, 60],
  [15, 60], [16, 80],
  [20, 80], [21, 100],
  [30, 100], [31, 120],
  [40, 120], [41, 180],
  [50, 180], [51, 200],
  [70, 200], [71, 200],  // still 200 because of hardcoded gap
  [79, 200], [80, 230],
  [100, 230], [101, 280],
];
boundaryPairs.forEach(([qty, expected]) => {
  assertEqual(_calculateShippingCost(qty), expected, `boundary qty=${qty} → ${expected}`);
});


// ══════════════════════════════════════════════════════════════════════════════
// 2. VAT Calculation  (config.vat_rate stored as 0.07 in backend)
// ══════════════════════════════════════════════════════════════════════════════

section("2. VAT — excluded (adds on top)");
{
  const { vatAmount, grandTotal } = calculateVAT(1000, 0.07, false);
  assertEqual(vatAmount,   70,   "1000 excl 7%: vatAmount=70");
  assertEqual(grandTotal, 1070,  "1000 excl 7%: grandTotal=1070");
}
{
  const { vatAmount, grandTotal } = calculateVAT(5000, 0.07, false);
  assertEqual(vatAmount,   350,  "5000 excl 7%: vatAmount=350");
  assertEqual(grandTotal, 5350,  "5000 excl 7%: grandTotal=5350");
}

section("2. VAT — included (extract from price)");
{
  // totalBefore=1070 → vat=1070×(0.07/1.07)=70, grand=1070
  const { vatAmount, grandTotal } = calculateVAT(1070, 0.07, true);
  assertEqual(vatAmount,  1070 * (0.07 / 1.07), "1070 incl 7%: vatAmount≈70");
  assertEqual(grandTotal, 1070,                 "1070 incl 7%: grandTotal=1070");
}
{
  // symmetry: excl result (1070) fed back as incl should recover same vat
  const { vatAmount: va1 } = calculateVAT(1000, 0.07, false);   // 70
  const { vatAmount: va2 } = calculateVAT(1070, 0.07, true);    // ≈70
  assertEqual(va1, va2, "excluded and included give same vatAmount for same base amount", 0.01);
}

section("2. VAT — zero rate");
{
  const { vatAmount, grandTotal } = calculateVAT(1000, 0, false);
  assertEqual(vatAmount,   0, "zero rate excl: vatAmount=0");
  assertEqual(grandTotal, 1000, "zero rate excl: grandTotal=1000");
}
{
  const { vatAmount, grandTotal } = calculateVAT(1000, 0, true);
  assertEqual(vatAmount,   0, "zero rate incl: vatAmount=0");
  assertEqual(grandTotal, 1000, "zero rate incl: grandTotal=1000");
}

section("2. VAT — Settings page display conversion (×100 / ÷100)");
{
  // Backend stores 0.07 → displayed in SettingsPage as 7
  const stored  = 0.07;
  const display = stored * 100;
  const saved   = display / 100;
  assertEqual(display, 7,    "stored 0.07 → display 7");
  assertEqual(saved, 0.07,   "display 7 → save 0.07");
}
{
  // Edge: 0% VAT round-trip
  const stored  = 0.0;
  const display = stored * 100;
  const saved   = display / 100;
  assertEqual(display, 0, "stored 0.0 → display 0");
  assertEqual(saved, 0.0, "display 0 → save 0.0");
}
{
  // Edge: 10% VAT round-trip
  const stored  = 0.10;
  const display = stored * 100;
  const saved   = display / 100;
  assertEqual(display, 10, "stored 0.10 → display 10");
  assertEqual(saved, 0.10, "display 10 → save 0.10");
}


// ══════════════════════════════════════════════════════════════════════════════
// 3. Sizing Surcharge  (shirt only, 100 ฿ per oversized piece)
// ══════════════════════════════════════════════════════════════════════════════

section("3. Sizing surcharge");
assertEqual(calculateSizingSurcharge("shirt", 0), 0,   "shirt 0 oversize → 0");
assertEqual(calculateSizingSurcharge("shirt", 1), 100, "shirt 1 oversize → 100");
assertEqual(calculateSizingSurcharge("shirt", 3), 300, "shirt 3 oversize → 300");
assertEqual(calculateSizingSurcharge("shirt", 10), 1000, "shirt 10 oversize → 1000");
assertEqual(calculateSizingSurcharge("polo",  5), 0,   "non-shirt → 0 surcharge");
assertEqual(calculateSizingSurcharge("",      5), 0,   "empty type → 0 surcharge");


// ══════════════════════════════════════════════════════════════════════════════
// 4. productSubtotal and totalBeforeCalc
// ══════════════════════════════════════════════════════════════════════════════

section("4. productSubtotal and totalBeforeCalc");
{
  const { productSubtotal, totalBeforeCalc } = calculateTotals(20, 240, 0, 0, 0, 80, 0);
  assertEqual(productSubtotal,  4800, "20×240=4800");
  assertEqual(totalBeforeCalc, 4880, "4800+0+0+0+80-0=4880");
}
{
  // With addons, manual cost, sizing surcharge
  const { productSubtotal, totalBeforeCalc } = calculateTotals(20, 240, 200, 800, 0, 80, 0);
  assertEqual(productSubtotal,  4800, "20×240=4800");
  assertEqual(totalBeforeCalc, 5880, "4800+200+800+0+80-0=5880");
}
{
  // With discount
  const { totalBeforeCalc } = calculateTotals(10, 240, 0, 0, 0, 60, 300);
  assertEqual(totalBeforeCalc, 2160, "10×240+60-300=2160");
}
{
  // Zero quantities
  const { productSubtotal, totalBeforeCalc } = calculateTotals(0, 240, 0, 0, 0, 0, 0);
  assertEqual(productSubtotal,  0, "0 qty → productSubtotal=0");
  assertEqual(totalBeforeCalc, 0, "0 qty → totalBeforeCalc=0");
}
{
  // Zero base price (not yet set)
  const { productSubtotal } = calculateTotals(20, 0, 0, 0, 0, 0, 0);
  assertEqual(productSubtotal, 0, "basePrice=0 → productSubtotal=0");
}
{
  // manualAddOnCost (additional note cost)
  const { totalBeforeCalc } = calculateTotals(10, 240, 0, 0, 500, 60, 0);
  assertEqual(totalBeforeCalc, 2960, "10×240+500+60=2960");
}


// ══════════════════════════════════════════════════════════════════════════════
// 5. Full order calculation (pricing → VAT → grand total)
// ══════════════════════════════════════════════════════════════════════════════

section("5. Full order: qty=20 คอกลม, no addons, VAT excl 7%");
{
  // Backend would return: unit=240, shipping=80
  const basePrice   = 240;
  const qty         = 20;
  const shipping    = _calculateShippingCost(qty);         // 80
  const { productSubtotal, totalBeforeCalc } = calculateTotals(qty, basePrice, 0, 0, 0, shipping, 0);
  const { vatAmount, grandTotal } = calculateVAT(totalBeforeCalc, 0.07, false);

  assertEqual(shipping,       80,   "shipping for qty=20 → 80");
  assertEqual(productSubtotal, 4800, "20×240=4800");
  assertEqual(totalBeforeCalc, 4880, "4800+80=4880");
  assertEqual(vatAmount,  4880 * 0.07,  "vatAmount=4880×0.07=341.6");
  assertEqual(grandTotal, 4880 * 1.07,  "grandTotal=4880×1.07=5221.6");
}

section("5. Full order: qty=50 คอปก, longSleeve addon, VAT incl 7%");
{
  // unit=260 (collarOthers 31-50), addon=40/unit, shipping=180
  const unit     = 260;
  const addon    = 40;
  const qty      = 50;
  const shipping = _calculateShippingCost(qty);  // 180
  const addonTotal = addon * qty;
  const { productSubtotal, totalBeforeCalc } = calculateTotals(qty, unit, 0, addonTotal, 0, shipping, 0);
  const { vatAmount, grandTotal } = calculateVAT(totalBeforeCalc, 0.07, true);

  assertEqual(shipping,        180,   "shipping for qty=50 → 180");
  assertEqual(productSubtotal, 13000, "50×260=13000");
  assertEqual(totalBeforeCalc, 15180, "13000+2000+180=15180");
  assertEqual(grandTotal,      15180, "VAT included → grandTotal=totalBefore");
  assertEqual(vatAmount, 15180 * (0.07 / 1.07), "VAT extracted from totalBefore");
}


// ══════════════════════════════════════════════════════════════════════════════
// 6. Deposit and Balance calculations
// ══════════════════════════════════════════════════════════════════════════════

section("6. Deposit calculations — deposit1 = ceil(grandTotal/2)");
{
  const d1 = calculateDeposit1(2000);
  assertEqual(d1, 1000, "even 2000: deposit1=1000");
  const d2 = calculateDeposit2(2000, d1, 0, 0);
  assertEqual(d2, 1000, "even 2000: deposit2=1000");
}
{
  // Odd grandTotal → deposit1 rounds up, deposit2 rounds down
  const d1 = calculateDeposit1(1001);
  assertEqual(d1, 501, "odd 1001: deposit1=ceil(1001/2)=501");
  const d2 = calculateDeposit2(1001, d1, 0, 0);
  assertEqual(d2, 500, "odd 1001: deposit2=1001-501=500");
}
{
  // Deposit1 + Deposit2 = grandTotal (no fees)
  const grand = 3750;
  const d1 = calculateDeposit1(grand);
  const d2 = calculateDeposit2(grand, d1, 0, 0);
  assertEqual(d1 + d2, grand, "d1+d2=grandTotal when no fees");
}

section("6. Deposit2 with designFee and advanceHold");
{
  // grandTotal=2000, deposit1=1000, designFee=200, advanceHold=100
  // deposit2 = 2000-1000-200-100 = 700
  const d1 = calculateDeposit1(2000);
  const d2 = calculateDeposit2(2000, d1, 200, 100);
  assertEqual(d2, 700, "deposit2=2000-1000-200-100=700");
}
{
  // When advanceHold covers the remaining balance, deposit2 can be 0 or negative
  const d1 = calculateDeposit1(2000);
  const d2 = calculateDeposit2(2000, d1, 0, 1000);  // 2000-1000-0-1000=0
  assertEqual(d2, 0, "deposit2=0 when advanceHold covers remainder");
}

section("6. Balance (remaining after payments)");
{
  const balance = calculateBalance(2000, 1000, 700);
  assertEqual(balance, 300, "2000-1000-700=300");
}
{
  const balance = calculateBalance(2000, 1000, 1000);
  assertEqual(balance, 0, "fully paid: balance=0");
}
{
  // Overpayment → negative balance
  const balance = calculateBalance(2000, 1200, 900);
  assertEqual(balance, -100, "overpayment: balance=-100");
}

section("6. Deposit/balance full scenario");
{
  // grandTotal=5221.6 (from section 5 example)
  const grand = 5221.6;
  const d1    = calculateDeposit1(grand);       // ceil(5221.6/2)=2611
  const d2    = calculateDeposit2(grand, d1, 0, 0);  // 5221.6-2611=2610.6
  assertEqual(d1, Math.ceil(grand / 2), "deposit1=ceil(grand/2)");
  assertEqual(d1 + d2, grand, "d1+d2 = grandTotal", 0.01);
  const bal = calculateBalance(grand, d1, d2);
  assertEqual(bal, 0, "balance=0 after both deposits", 0.01);
}


// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"─".repeat(55)}`);
console.log(`  Result: ${passed} passed, ${failed} failed`);
console.log(`${"─".repeat(55)}\n`);

if (failed > 0) process.exit(1);
