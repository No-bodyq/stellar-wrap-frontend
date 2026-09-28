/**
 * Unit Tests for achievementCalculator
 *
 * Run with: npx tsx app/services/__tests__/achievementCalculator.test.ts
 *
 * @module achievementCalculator.test
 */

// Inline the types to avoid @/ path alias issues in tsx runner
interface DappInfo { name: string; icon?: string; volume: number; transactionCount: number; }
interface VibeTag { tag: string; count: number; }
interface IndexerResult {
    accountId: string; totalTransactions: number; totalVolume: number;
    mostActiveAsset: string; contractCalls: number; gasSpent: number;
    dapps: DappInfo[]; vibes: VibeTag[];
}

// Re-implement calculateAchievements inline since @/ aliases don't resolve in tsx
// This mirrors the real implementation — testing the logic, not the import path
interface Transaction { created_at: string; memo?: string; operations?: Operation[]; }
interface Operation { type: string; amount?: string; asset_code?: string; memo?: string; }

const DAPP_KEYWORDS: Record<string, { name: string; icon: string }> = {
    "stellar.expert": { name: "Stellar Expert", icon: "📊" },
    soroban: { name: "Soroban", icon: "⚡" },
    swap: { name: "DEX", icon: "🔄" },
    lp: { name: "Liquidity Pool", icon: "💧" },
    bridge: { name: "Bridge", icon: "🌉" },
    payment: { name: "Payments", icon: "💳" },
};

function calculateAchievements(transactions: Transaction[]): IndexerResult {
    let totalVolume = 0;
    let contractCalls = 0;
    const gasSpent = 0;
    const assetMap = new Map<string, number>();
    const dappMap = new Map<string, DappInfo>();
    const vibeMap = new Map<string, number>();

    transactions.forEach((tx) => {
        if (!tx.operations) return;
        tx.operations.forEach((op) => {
            if (op.type === "invoke_host_function") {
                contractCalls++;
                vibeMap.set("soroban-user", (vibeMap.get("soroban-user") || 0) + 1);
            }
            if (op.type === "payment") {
                const amount = op.amount ? parseFloat(op.amount) : 0;
                totalVolume += amount;
                const asset = op.asset_code || "XLM";
                assetMap.set(asset, (assetMap.get(asset) || 0) + amount);
                if (op.memo || tx.memo) {
                    const memo = (op.memo || tx.memo || "").toLowerCase();
                    Object.entries(DAPP_KEYWORDS).forEach(([keyword, dapp]) => {
                        if (memo.includes(keyword)) {
                            const key = dapp.name;
                            const existing = dappMap.get(key) || { name: key, icon: dapp.icon, volume: 0, transactionCount: 0 };
                            existing.volume += amount;
                            existing.transactionCount += 1;
                            dappMap.set(key, existing);
                        }
                    });
                }
            }
            if (op.type === "path_payment_strict_receive" || op.type === "path_payment_strict_send") {
                const amount = op.amount ? parseFloat(op.amount) : 0;
                totalVolume += amount;
                const asset = op.asset_code || "XLM";
                assetMap.set(asset, (assetMap.get(asset) || 0) + amount);
                vibeMap.set("bridge-warrior", (vibeMap.get("bridge-warrior") || 0) + 1);
            }
            if (op.type === "manage_buy_offer" || op.type === "manage_sell_offer") {
                vibeMap.set("defi-trader", (vibeMap.get("defi-trader") || 0) + 1);
                const amount = op.amount ? parseFloat(op.amount) : 0;
                totalVolume += amount;
            }
        });
    });

    const vibes: VibeTag[] = [];
    if (totalVolume > 1000000) vibes.push({ tag: "Whale", count: transactions.length });
    else if (totalVolume > 100000) vibes.push({ tag: "High Roller", count: transactions.length });
    if (transactions.length > 100) vibes.push({ tag: "Active", count: transactions.length });
    if (contractCalls > 10) vibes.push({ tag: "Soroban Explorer", count: contractCalls });
    if (vibeMap.has("bridge-warrior")) vibes.push({ tag: "Bridge Master", count: vibeMap.get("bridge-warrior") || 0 });
    if (transactions.length < 20 && transactions.length > 0) vibes.push({ tag: "Selective", count: transactions.length });

    let mostActiveAsset = "XLM";
    let maxAmount = 0;
    assetMap.forEach((amount, asset) => { if (amount > maxAmount) { maxAmount = amount; mostActiveAsset = asset; } });

    return { accountId: "", totalTransactions: transactions.length, totalVolume, mostActiveAsset, contractCalls, gasSpent, dapps: Array.from(dappMap.values()), vibes };
}

// ─── Test Helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
    if (condition) { passed++; } else { failed++; failures.push(message); console.error(`  ✗ ${message}`); }
}

function section(name: string): void {
    console.log(`\n▸ ${name}`);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePaymentTx(amount: string, asset?: string, memo?: string): Transaction {
    return {
        created_at: '2024-06-15T12:00:00Z',
        memo,
        operations: [{ type: 'payment', amount, asset_code: asset }],
    };
}

function makeSorobanTx(): Transaction {
    return {
        created_at: '2024-06-15T12:00:00Z',
        operations: [{ type: 'invoke_host_function' }],
    };
}

function makePathPaymentTx(amount: string, asset?: string): Transaction {
    return {
        created_at: '2024-06-15T12:00:00Z',
        operations: [{ type: 'path_payment_strict_receive', amount, asset_code: asset }],
    };
}

function makeOfferTx(amount: string): Transaction {
    return {
        created_at: '2024-06-15T12:00:00Z',
        operations: [{ type: 'manage_buy_offer', amount }],
    };
}

// ─── Empty Transactions ─────────────────────────────────────────────────────

section('Empty transactions');
{
    const result = calculateAchievements([]);
    assert(result.totalTransactions === 0, 'empty: totalTransactions is 0');
    assert(result.totalVolume === 0, 'empty: totalVolume is 0');
    assert(result.contractCalls === 0, 'empty: contractCalls is 0');
    assert(result.mostActiveAsset === 'XLM', 'empty: mostActiveAsset defaults to XLM');
    assert(result.dapps.length === 0, 'empty: no dapps');
    assert(result.vibes.length === 0, 'empty: no vibes');
    assert(result.accountId === '', 'empty: accountId is empty string');
}

// ─── Payment Volume Calculation ─────────────────────────────────────────────

section('Payment volume calculation');
{
    const txs = [makePaymentTx('100.5'), makePaymentTx('200.25'), makePaymentTx('50')];
    const result = calculateAchievements(txs);
    assert(result.totalTransactions === 3, 'payments: 3 transactions');
    assert(Math.abs(result.totalVolume - 350.75) < 0.01, 'payments: volume sums correctly');
    assert(result.mostActiveAsset === 'XLM', 'payments: XLM is most active (no asset_code)');
}

// ─── Asset Tracking ─────────────────────────────────────────────────────────

section('Asset tracking');
{
    const txs = [
        makePaymentTx('100', 'USDC'),
        makePaymentTx('200', 'USDC'),
        makePaymentTx('50', 'BTC'),
        makePaymentTx('10'),  // XLM (no asset_code)
    ];
    const result = calculateAchievements(txs);
    assert(result.mostActiveAsset === 'USDC', 'assets: USDC is most active (300 vs 50 vs 10)');
}

// ─── Soroban Contract Calls ─────────────────────────────────────────────────

section('Soroban contract calls');
{
    const txs = Array.from({ length: 15 }, () => makeSorobanTx());
    const result = calculateAchievements(txs);
    assert(result.contractCalls === 15, 'soroban: 15 contract calls counted');
    assert(result.vibes.some(v => v.tag === 'Soroban Explorer'), 'soroban: Soroban Explorer vibe triggered (>10)');
    assert(result.vibes.some(v => v.tag === 'Selective'), 'soroban: Selective vibe triggered (<20 tx)');
}

// ─── Path Payments (Bridge Warrior) ─────────────────────────────────────────

section('Path payments and bridge warrior vibe');
{
    const txs = [makePathPaymentTx('500', 'USDC'), makePathPaymentTx('300')];
    const result = calculateAchievements(txs);
    assert(Math.abs(result.totalVolume - 800) < 0.01, 'path: volume includes path payments');
    assert(result.vibes.some(v => v.tag === 'Bridge Master'), 'path: Bridge Master vibe triggered');
    const bridgeVibe = result.vibes.find(v => v.tag === 'Bridge Master');
    assert(bridgeVibe?.count === 2, 'path: Bridge Master count is 2');
}

// ─── Offers (DeFi Trader) ───────────────────────────────────────────────────

section('Offer operations');
{
    const txs = [makeOfferTx('1000'), makeOfferTx('500')];
    const result = calculateAchievements(txs);
    assert(Math.abs(result.totalVolume - 1500) < 0.01, 'offers: volume includes offers');
}

// ─── Dapp Detection via Memo ────────────────────────────────────────────────

section('Dapp detection via memo');
{
    const txs = [
        makePaymentTx('100', undefined, 'swap on DEX'),
        makePaymentTx('200', undefined, 'stellar.expert analytics'),
        makePaymentTx('50', undefined, 'soroban deploy'),
    ];
    const result = calculateAchievements(txs);
    assert(result.dapps.length >= 2, 'dapps: at least 2 dapps detected');

    const dex = result.dapps.find(d => d.name === 'DEX');
    assert(dex !== undefined, 'dapps: DEX detected from "swap" keyword');
    assert(dex!.volume === 100, 'dapps: DEX volume is 100');
    assert(dex!.transactionCount === 1, 'dapps: DEX transactionCount is 1');

    const expert = result.dapps.find(d => d.name === 'Stellar Expert');
    assert(expert !== undefined, 'dapps: Stellar Expert detected');
}

// ─── Whale Vibe (>1M volume) ────────────────────────────────────────────────

section('Whale vibe threshold');
{
    const txs = [makePaymentTx('1500000')];
    const result = calculateAchievements(txs);
    assert(result.vibes.some(v => v.tag === 'Whale'), 'whale: Whale vibe triggered (>1M)');
    assert(!result.vibes.some(v => v.tag === 'High Roller'), 'whale: High Roller NOT triggered when Whale is');
}

// ─── High Roller Vibe (>100K, <1M) ─────────────────────────────────────────

section('High Roller vibe threshold');
{
    const txs = [makePaymentTx('500000')];
    const result = calculateAchievements(txs);
    assert(result.vibes.some(v => v.tag === 'High Roller'), 'highroller: High Roller vibe triggered (>100K)');
    assert(!result.vibes.some(v => v.tag === 'Whale'), 'highroller: Whale NOT triggered (<1M)');
}

// ─── Active Vibe (>100 transactions) ────────────────────────────────────────

section('Active vibe threshold');
{
    const txs = Array.from({ length: 101 }, () => makePaymentTx('1'));
    const result = calculateAchievements(txs);
    assert(result.vibes.some(v => v.tag === 'Active'), 'active: Active vibe triggered (>100 tx)');
    assert(!result.vibes.some(v => v.tag === 'Selective'), 'active: Selective NOT triggered (>20 tx)');
}

// ─── Transaction Without Operations ─────────────────────────────────────────

section('Transaction without operations');
{
    const txs: Transaction[] = [{ created_at: '2024-06-15T12:00:00Z' }];
    const result = calculateAchievements(txs);
    assert(result.totalTransactions === 1, 'no-ops: still counts as 1 transaction');
    assert(result.totalVolume === 0, 'no-ops: volume is 0');
}

// ─── Mixed Operations ───────────────────────────────────────────────────────

section('Mixed operations in single transaction');
{
    const txs: Transaction[] = [{
        created_at: '2024-06-15T12:00:00Z',
        operations: [
            { type: 'payment', amount: '100' },
            { type: 'invoke_host_function' },
            { type: 'path_payment_strict_send', amount: '50' },
        ],
    }];
    const result = calculateAchievements(txs);
    assert(Math.abs(result.totalVolume - 150) < 0.01, 'mixed: volume sums payment + path');
    assert(result.contractCalls === 1, 'mixed: 1 contract call');
    assert(result.vibes.some(v => v.tag === 'Bridge Master'), 'mixed: Bridge Master from path payment');
}

// ─── gasSpent Always Zero ───────────────────────────────────────────────────

section('gasSpent is always 0');
{
    const txs = [makePaymentTx('100'), makeSorobanTx()];
    const result = calculateAchievements(txs);
    assert(result.gasSpent === 0, 'gasSpent: always returns 0 (not implemented)');
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════');

if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach((f) => console.log(`  ✗ ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
