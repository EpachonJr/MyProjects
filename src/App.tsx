import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  PieChart,
  Target,
  Briefcase,
  Landmark,
  Globe,
  Coins,
  Rocket,
  History,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  Radio,
  Sparkles,
  Activity,
} from 'lucide-react';
import {
  INITIAL_HOLDINGS,
  INITIAL_ALLOCATION_GOALS,
  INITIAL_MONTHLY_PERFORMANCE,
  INITIAL_FIXED_INCOME_PRODUCTS,
  INITIAL_TRANSACTIONS,
  INITIAL_RECENT_DIVIDENDS,
  INITIAL_FOREX_PURCHASES,
  INITIAL_LIFE_GOALS,
  INITIAL_CASHFLOW_PROFILE,
  INITIAL_MARKET_INDICATORS,
  CURRENT_PTAX,
} from './data/seedData';
import {
  AllocationGoal,
  DividendRecord,
  FixedIncomeProductSummary,
  ForexPurchase,
  Holding,
  LifeGoalRow,
  MarketIndicator,
  MonthlyPerformanceRow,
  TransactionRecord,
} from './types/portfolio';
import {
  CurrencyMode,
  computePortfolioSummary,
  formatCurrency,
  formatPct,
} from './utils/calculations';
import { RentabilityTab } from './components/RentabilityTab';
import { DayPerformanceTab } from './components/DayPerformanceTab';
import { PatrimonyTab } from './components/PatrimonyTab';
import { AllocationTab } from './components/AllocationTab';
import { HoldingsTab } from './components/HoldingsTab';
import { FixedIncomeForexTab, FixedIncomeLiveMeta } from './components/FixedIncomeForexTab';
import { ForexTab, ForexSummaryItem } from './components/ForexTab';
import { DividendsTab } from './components/DividendsTab';
import { GoalsAndTransactionsTab } from './components/GoalsAndTransactionsTab';
import { TransactionsTab } from './components/TransactionsTab';
import { CuriositiesTab } from './components/CuriositiesTab';

type TabId =
  | 'RENTABILIDADE'
  | 'PERFORMANCE_DO_DIA'
  | 'PATRIMONIO'
  | 'ALOCACAO'
  | 'ATIVOS'
  | 'RENDA_FIXA'
  | 'CAMBIO'
  | 'PROVENTOS'
  | 'METAS'
  | 'TRANSACOES'
  | 'CURIOSIDADES';

function checkIsWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

const MANUAL_CASH_DEFS: Record<
  string,
  { id: string; ticker: string; name: string; broker: string; sector: string }
> = {
  nubank: {
    id: 'fi-nubank-cc',
    ticker: 'NUBANK-CC',
    name: 'NuBank (Conta)',
    broker: 'NUBANK',
    sector: 'Caixa / Conta Corrente',
  },
  'itaú': {
    id: 'fi-itau-cc',
    ticker: 'ITAU-CC',
    name: 'Itaú (Conta)',
    broker: 'ITAÚ',
    sector: 'Caixa / Conta Corrente',
  },
  itau: {
    id: 'fi-itau-cc',
    ticker: 'ITAU-CC',
    name: 'Itaú (Conta)',
    broker: 'ITAÚ',
    sector: 'Caixa / Conta Corrente',
  },
  wise: {
    id: 'fi-wise-cash',
    ticker: 'WISE-BRL',
    name: 'Wise',
    broker: 'WISE',
    sector: 'Caixa Internacional',
  },
  'leftovers avenue': {
    id: 'fi-leftovers-avenue',
    ticker: 'AVENUE-CASH',
    name: 'Leftovers Avenue',
    broker: 'AVENUE',
    sector: 'Caixa Corretora US',
  },
  'letfovers xp': {
    id: 'fi-leftovers-xp',
    ticker: 'XP-CASH',
    name: 'Leftovers XP',
    broker: 'XP',
    sector: 'Caixa Corretora BR',
  },
  'leftovers xp': {
    id: 'fi-leftovers-xp',
    ticker: 'XP-CASH',
    name: 'Leftovers XP',
    broker: 'XP',
    sector: 'Caixa Corretora BR',
  },
  'leftovers clear': {
    id: 'fi-leftovers-clear',
    ticker: 'CLEAR-CASH',
    name: 'Leftovers Clear',
    broker: 'CLEAR',
    sector: 'Caixa Corretora BR',
  },
  'leftovers binance': {
    id: 'fi-leftovers-binance',
    ticker: 'BINANCE-CASH',
    name: 'Leftovers Binance',
    broker: 'BINANCE',
    sector: 'Caixa Corretora Cripto',
  },
};

function deduplicateFixedIncomeProducts(
  products: FixedIncomeProductSummary[]
): FixedIncomeProductSummary[] {
  const byHoldingId = new Map<string, FixedIncomeProductSummary>();
  for (const p of products) {
    const key = p.holdingId || p.id;
    const existing = byHoldingId.get(key);
    if (!existing) {
      byHoldingId.set(key, p);
    } else if (p.id.startsWith('fip-') && !existing.id.startsWith('fip-')) {
      byHoldingId.set(key, p);
    }
  }
  return Array.from(byHoldingId.values());
}

function deduplicateHoldings(holdings: Holding[]): Holding[] {
  const seenIds = new Set<string>();
  const seenTickers = new Set<string>();
  const result: Holding[] = [];
  for (const h of holdings) {
    if (seenIds.has(h.id) || seenTickers.has(h.ticker)) continue;
    seenIds.add(h.id);
    seenTickers.add(h.ticker);
    result.push(h);
  }
  return result;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('RENTABILIDADE');
  const [currency, setCurrency] = useState<CurrencyMode>('BRL');
  const [ptax, setPtax] = useState<number>(CURRENT_PTAX);
  const [includeFgts, setIncludeFgts] = useState<boolean>(true);
  const [hideValues, setHideValues] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SAVED'>('IDLE');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isWeekend, setIsWeekend] = useState<boolean>(checkIsWeekend);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [fixedIncomeLiveMeta, setFixedIncomeLiveMeta] = useState<FixedIncomeLiveMeta | null>(null);
  const [googleSheetsMeta, setGoogleSheetsMeta] = useState<{
    syncedAt: string;
    sheetUrl: string;
    transactionsCount: number;
    dividendsCount: number;
    totalHistoricalDividendsBrl: number;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('patrimony_gs_meta_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [patrimonySheetMeta, setPatrimonySheetMeta] = useState<{
    syncedAt: string;
    sheetUrl: string;
    fixedIncomeCount: number;
    forexPurchasesCount: number;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('patrimony_pat_meta_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Portfolio State
  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_HOLDINGS);
  const [allocationGoals, setAllocationGoals] = useState<AllocationGoal[]>(INITIAL_ALLOCATION_GOALS);
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformanceRow[]>(INITIAL_MONTHLY_PERFORMANCE);
  const [fixedIncomeProducts, setFixedIncomeProducts] = useState<FixedIncomeProductSummary[]>(INITIAL_FIXED_INCOME_PRODUCTS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [recentDividends, setRecentDividends] = useState<DividendRecord[]>(INITIAL_RECENT_DIVIDENDS);
  const [forexPurchases, setForexPurchases] = useState<ForexPurchase[]>(INITIAL_FOREX_PURCHASES);
  const [forexSummaries, setForexSummaries] = useState<ForexSummaryItem[] | undefined>(undefined);
  const [lifeGoals, setLifeGoals] = useState<LifeGoalRow[]>(INITIAL_LIFE_GOALS);
  const [cashflowProfile, setCashflowProfile] = useState(INITIAL_CASHFLOW_PROFILE);
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>(INITIAL_MARKET_INDICATORS);

  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const fixedIncomeRef = useRef(fixedIncomeProducts);
  fixedIncomeRef.current = fixedIncomeProducts;

  // Keep a stable snapshot ref of all state slices so callbacks never re-trigger effects in a loop
  const stateSnapshotRef = useRef({
    holdings,
    allocationGoals,
    monthlyPerformance,
    fixedIncomeProducts,
    transactions,
    recentDividends,
    forexPurchases,
    forexSummaries,
    lifeGoals,
    cashflowProfile,
    ptax,
  });
  stateSnapshotRef.current = {
    holdings,
    allocationGoals,
    monthlyPerformance,
    fixedIncomeProducts,
    transactions,
    recentDividends,
    forexPurchases,
    forexSummaries,
    lifeGoals,
    cashflowProfile,
    ptax,
  };

  // Persist changes to SQLite backend + localStorage (stable reference: [] deps)
  const persistState = useCallback(
    async (nextState: {
      holdings?: Holding[];
      allocationGoals?: AllocationGoal[];
      fixedIncomeProducts?: FixedIncomeProductSummary[];
      transactions?: TransactionRecord[];
      recentDividends?: DividendRecord[];
      forexPurchases?: ForexPurchase[];
      forexSummaries?: ForexSummaryItem[];
      lifeGoals?: LifeGoalRow[];
      cashflowProfile?: typeof INITIAL_CASHFLOW_PROFILE;
      ptax?: number;
    }) => {
      const snap = stateSnapshotRef.current;
      const payload = {
        holdings: nextState.holdings ?? holdingsRef.current,
        allocationGoals: nextState.allocationGoals ?? snap.allocationGoals,
        monthlyPerformance: snap.monthlyPerformance,
        fixedIncomeProducts: nextState.fixedIncomeProducts ?? fixedIncomeRef.current,
        transactions: nextState.transactions ?? snap.transactions,
        recentDividends: nextState.recentDividends ?? snap.recentDividends,
        forexPurchases: nextState.forexPurchases ?? snap.forexPurchases,
        forexSummaries: nextState.forexSummaries ?? snap.forexSummaries,
        lifeGoals: nextState.lifeGoals ?? snap.lifeGoals,
        cashflowProfile: nextState.cashflowProfile ?? snap.cashflowProfile,
        ptax: nextState.ptax ?? snap.ptax,
      };
      localStorage.removeItem('patrimony_dashboard_state_v3');
      localStorage.setItem('patrimony_dashboard_state_v4', JSON.stringify(payload));
      try {
        await fetch('/api/portfolio', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}
    },
    []
  );

  // Live Market Sync (1m weekdays / 10m weekends for market prices; ONCE PER DAY for Google Sheets)
  const handleRefreshLiveQuotes = useCallback(async (forceSheetSync = false) => {
    setSyncStatus('SYNCING');
    setIsWeekend(checkIsWeekend());
    try {
      const currentHoldings = deduplicateHoldings(holdingsRef.current);
      const currentFiProducts = deduplicateFixedIncomeProducts(fixedIncomeRef.current);
      const tradableTickers = currentHoldings
        .filter((h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS')
        .map((h) => ({
          ticker: h.ticker,
          assetClass: h.assetClass,
          broker: h.broker,
        }));

      // Always query Google Sheets cache so the dashboard never diverges from the spreadsheet
      const shouldSyncSheetsToday = true;

      const res = await fetch('/api/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: tradableTickers,
          includeGoogleSheets: shouldSyncSheetsToday,
          forceGoogleSheets: Boolean(forceSheetSync),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const liveUsd = data.liveUsdBrl || CURRENT_PTAX;
        const mQuotes = data.marketQuotes || {};
        const hQuotes = data.holdingQuotes || {};
        const fiLive = data.fixedIncomeLive || null;
        const gsLive = data.googleSheetsLive || null;
        const patLive = data.patrimonySheetLive || null;

        if (gsLive || patLive) {
          localStorage.setItem('patrimony_sheets_last_sync_ms', String(Date.now()));
        }

        setPtax(liveUsd);
        if (fiLive) {
          setFixedIncomeLiveMeta(fiLive);
        }

        // Update market indicators strip
        setMarketIndicators((prev) =>
          prev.map((ind) => {
            const q = mQuotes[ind.ticker];
            if (q && typeof q.price === 'number') {
              return {
                ...ind,
                value: Number(q.price.toFixed(ind.currency === 'PTS' ? 0 : 2)),
                dayChangePct: q.changePct ?? ind.dayChangePct,
              };
            }
            if (ind.ticker === 'BTCBRL' && mQuotes.BTCUSD?.price) {
              return {
                ...ind,
                value: Math.round(mQuotes.BTCUSD.price * liveUsd),
                dayChangePct: mQuotes.BTCUSD.changePct ?? ind.dayChangePct,
              };
            }
            return ind;
          })
        );

        // 0.5 Merge Fixed Income products from Patrimony Analysis 2.0 (Fixed Income tab, once per day)
        let mergedFiProducts = currentFiProducts;
        if (patLive && Array.isArray(patLive.fixedIncomeSheetProducts) && patLive.fixedIncomeSheetProducts.length > 0) {
          const nextPatMeta = {
            syncedAt: patLive.syncedAt,
            sheetUrl: patLive.sheetUrl,
            fixedIncomeCount: patLive.fixedIncomeSheetProducts.length,
            forexPurchasesCount: patLive.forexPurchases?.length || 0,
          };
          setPatrimonySheetMeta(nextPatMeta);
          localStorage.setItem('patrimony_pat_meta_v1', JSON.stringify(nextPatMeta));

          const sheetFiMap = new Map<string, any>();
          for (const sp of patLive.fixedIncomeSheetProducts) {
            if (sp.id) sheetFiMap.set(sp.id, sp);
            if (sp.holdingId) sheetFiMap.set(sp.holdingId, sp);
          }

          const existingIds = new Set<string>();
          mergedFiProducts = mergedFiProducts.map((prod) => {
            existingIds.add(prod.id);
            existingIds.add(prod.holdingId);
            const sp = sheetFiMap.get(prod.id) || sheetFiMap.get(prod.holdingId);
            if (!sp) return prod;

            // Sync monthlyHistory from Fixed Income tab
            const nextMonthlyHistory =
              Array.isArray(sp.monthlyHistory) && sp.monthlyHistory.length > 0
                ? sp.monthlyHistory
                : prod.monthlyHistory;

            // Detect if the user recorded a new Aporte or Resgate in the Fixed Income sheet
            const deltaInvested = Number((sp.totalInvestedBrl - prod.totalInvestedBrl).toFixed(2));
            if (Math.abs(deltaInvested) > 0.05) {
              const newMarket = Number(
                Math.max(sp.marketValueBrl, prod.marketValueBrl + deltaInvested).toFixed(2)
              );
              const newProfit = Number((newMarket - sp.totalInvestedBrl).toFixed(2));
              const newRentPct =
                sp.totalInvestedBrl > 0
                  ? Number(((newProfit / sp.totalInvestedBrl) * 100).toFixed(2))
                  : 0;
              return {
                ...prod,
                initialDepositBrl: sp.initialDepositBrl || prod.initialDepositBrl,
                totalInvestedBrl: sp.totalInvestedBrl,
                marketValueBrl: newMarket,
                absoluteProfitBrl: newProfit,
                rentabilityPct: newRentPct,
                netValueBrl: Number((newMarket - (prod.taxesAndFeesBrl || 0)).toFixed(2)),
                monthlyHistory: nextMonthlyHistory,
              };
            }

            return {
              ...prod,
              monthlyHistory: nextMonthlyHistory,
            };
          });

          // Also append any brand-new or withdrawn Fixed Income products from Patrimony Analysis 2.0
          for (const sp of patLive.fixedIncomeSheetProducts) {
            if (!existingIds.has(sp.id) && !existingIds.has(sp.holdingId)) {
              existingIds.add(sp.id);
              existingIds.add(sp.holdingId);
              const isWithdrawn = sp.status === 'WITHDRAWN';
              mergedFiProducts.push({
                id: sp.id,
                holdingId: sp.holdingId,
                name: sp.rawTitle,
                issuer: sp.rawTitle.includes('NUBANK')
                  ? 'Nubank'
                  : sp.rawTitle.includes('ORIGINAL')
                    ? 'Banco Original'
                    : sp.rawTitle.includes('TESOURO')
                      ? 'Tesouro Nacional'
                      : sp.rawTitle.includes('PICPAY')
                        ? 'PicPay'
                        : sp.rawTitle.includes('Alaska')
                          ? 'Alaska Asset'
                          : 'Planilha Patrimony 2.0',
                indexer: sp.rawTitle.includes('200%')
                  ? '200% do CDI'
                  : sp.rawTitle.includes('107%')
                    ? '107% do CDI'
                    : sp.rawTitle.includes('95,5%')
                      ? '95,5% do CDI'
                      : sp.rawTitle.includes('11,71%')
                        ? 'Pré-fixado (11,71%)'
                        : sp.rawTitle.includes('Alaska')
                          ? 'Fundo Multimercado'
                          : 'CDI / Pré / IPCA',
                startDate: '2021-01-01',
                expirationDate: isWithdrawn ? (sp.withdrawnMonth || 'Resgatado') : 'A definir',
                initialDepositBrl: sp.initialDepositBrl,
                totalInvestedBrl: sp.totalInvestedBrl,
                marketValueBrl: isWithdrawn ? 0 : sp.marketValueBrl,
                netValueBrl: isWithdrawn ? 0 : sp.marketValueBrl,
                taxesAndFeesBrl: 0,
                absoluteProfitBrl: sp.absoluteProfitBrl,
                rentabilityPct: sp.rentabilityPct,
                status: isWithdrawn ? 'WITHDRAWN' : 'ACTIVE',
                withdrawnMonth: sp.withdrawnMonth,
                automationType: 'BCB_CDI',
                automationIdentifier: isWithdrawn ? 'Resgatado' : '100% CDI',
                riskLevel: 'Very low',
                cdiPct: 100,
                lastQuotaDate: '2026-09-26',
                monthlyHistory: sp.monthlyHistory || [],
              });
            }
          }
        }
        mergedFiProducts = deduplicateFixedIncomeProducts(mergedFiProducts);

        // 1. Update Fixed Income products if newer business days/quotas/PUs exist
        const dailyCdiRatePct = fiLive?.bcbCdi?.latestDailyRatePct || 0.050788;
        const cdiEntries: Array<{ dateIso: string; ratePct: number }> =
          fiLive?.bcbCdi?.dailyEntries || [];

        const updatedFiProducts = mergedFiProducts.map((prod) => {
          if (prod.status === 'WITHDRAWN') return prod;
          // A) BCB_CDI products (NuBank Invest, Caixinha UV & Banco Original LCA)
          if (prod.automationType === 'BCB_CDI') {
            const lastSync = prod.lastQuotaDate || '2026-09-26';
            const newDays = cdiEntries.filter((d) => d.dateIso > lastSync);
            if (newDays.length === 0) return prod;

            const cdiMult = (prod.cdiPct || 100) / 100;
            let compoundFactor = 1;
            for (const d of newDays) {
              compoundFactor *= 1 + (d.ratePct / 100) * cdiMult;
            }
            const newGross = Number((prod.marketValueBrl * compoundFactor).toFixed(2));
            const newProfit = Number((newGross - prod.totalInvestedBrl).toFixed(2));
            const newRentPct =
              prod.totalInvestedBrl > 0
                ? Number(((newProfit / prod.totalInvestedBrl) * 100).toFixed(2))
                : 0;

            const updatedSubTranches = prod.subTranches?.map((tr) => {
              const trGross = Number((tr.grossValueBrl * compoundFactor).toFixed(2));
              const trGain = Math.max(0, trGross - tr.appliedBrl);
              const trTax =
                tr.irAliquotPct > 0 ? Number((trGain * (tr.irAliquotPct / 100)).toFixed(2)) : 0;
              return {
                ...tr,
                grossValueBrl: trGross,
                taxBrl: trTax,
                netValueBrl: Number((trGross - trTax).toFixed(2)),
              };
            });

            const totalTaxes = updatedSubTranches
              ? Number(updatedSubTranches.reduce((a, b) => a + b.taxBrl, 0).toFixed(2))
              : prod.taxesAndFeesBrl || 0;

            return {
              ...prod,
              marketValueBrl: newGross,
              absoluteProfitBrl: newProfit,
              rentabilityPct: newRentPct,
              taxesAndFeesBrl: totalTaxes,
              netValueBrl: Number((newGross - totalTaxes).toFixed(2)),
              subTranches: updatedSubTranches,
              lastQuotaDate: newDays[newDays.length - 1].dateIso,
            };
          }

          // B) CVM_QUOTA products (Nu Reserva Imediata 42.699.466/0001-77)
          if (prod.automationType === 'CVM_QUOTA' && prod.cvmCnpj && prod.fundQuotas) {
            const cvmEntry = fiLive?.cvmQuotas?.[prod.cvmCnpj];
            if (!cvmEntry || !cvmEntry.quotaValue) return prod;
            const lastSync = prod.lastQuotaDate || '2026-09-24';
            if (cvmEntry.dateIso <= lastSync) return prod;

            const newGross = Number((prod.fundQuotas * cvmEntry.quotaValue).toFixed(2));
            const newProfit = Number((newGross - prod.totalInvestedBrl).toFixed(2));
            const newTaxes = Number(Math.max(0, newProfit * 0.15).toFixed(2));
            return {
              ...prod,
              lastQuotaValue: cvmEntry.quotaValue,
              lastQuotaDate: cvmEntry.dateIso,
              marketValueBrl: newGross,
              absoluteProfitBrl: newProfit,
              rentabilityPct:
                prod.totalInvestedBrl > 0
                  ? Number(((newProfit / prod.totalInvestedBrl) * 100).toFixed(2))
                  : 0,
              taxesAndFeesBrl: newTaxes,
              netValueBrl: Number((newGross - newTaxes).toFixed(2)),
            };
          }

          // C) TESOURO_DIRETO products (Mark-to-market PU × Quantity)
          if (
            prod.automationType === 'TESOURO_DIRETO' &&
            prod.tesouroBondType &&
            prod.tesouroMaturity &&
            prod.tesouroTitlesQty
          ) {
            const bondKey = `${prod.tesouroBondType}|${prod.tesouroMaturity}`;
            const bondEntry = fiLive?.tesouroPu?.[bondKey];
            if (!bondEntry || !bondEntry.puVenda) return prod;
            const lastSync = prod.lastTesouroDate || '2026-09-26';
            if (bondEntry.dateIso <= lastSync) return prod;

            const newGross = Number((prod.tesouroTitlesQty * bondEntry.puVenda).toFixed(2));
            const newProfit = Number((newGross - prod.totalInvestedBrl).toFixed(2));
            const taxRatio =
              prod.marketValueBrl > 0 ? (prod.taxesAndFeesBrl || 0) / prod.marketValueBrl : 0.02;
            const newTaxes = Number((newGross * taxRatio).toFixed(2));

            return {
              ...prod,
              lastTesouroPu: bondEntry.puVenda,
              lastTesouroDate: bondEntry.dateIso,
              marketValueBrl: newGross,
              absoluteProfitBrl: newProfit,
              rentabilityPct:
                prod.totalInvestedBrl > 0
                  ? Number(((newProfit / prod.totalInvestedBrl) * 100).toFixed(2))
                  : 0,
              taxesAndFeesBrl: newTaxes,
              netValueBrl: Number((newGross - newTaxes).toFixed(2)),
            };
          }

          return prod;
        });

        fixedIncomeRef.current = updatedFiProducts;
        setFixedIncomeProducts(updatedFiProducts);

        // Map holdingId -> updated FixedIncomeProductSummary for fast lookup
        const fiByHoldingId = new Map<string, FixedIncomeProductSummary>();
        for (const p of updatedFiProducts) {
          fiByHoldingId.set(p.holdingId, p);
        }

        // 1.5 Update ONLY Fixed Income, Manual Leftovers, and Currency Exchange from Patrimony Analysis 2.0 (when synced once per day)
        // Variable-income holdings and FGTS remain untouched by spreadsheet sync.
        let baseHoldings = currentHoldings;
        if (patLive) {
          const existingById = new Map<string, Holding>();
          for (const h of currentHoldings) {
            existingById.set(h.id, h);
          }

          // Keep all non-FIXED_INCOME and non-FX-currency holdings, updated with live quantities/values from Stocks tab
          const sheetStocksMap = new Map<string, any>();
          if (patLive && Array.isArray(patLive.stocksSheetHoldings)) {
            for (const sh of patLive.stocksSheetHoldings) {
              if (sh.ticker) sheetStocksMap.set(sh.ticker.toUpperCase(), sh);
            }
          }

          const preservedHoldings = currentHoldings
            .filter(
              (h) =>
                h.assetClass !== 'FIXED_INCOME' &&
                !(h.assetClass === 'PROTECTION' && ['USD', 'GBP', 'EUR', 'CHF'].includes(h.ticker))
            )
            .map((h) => {
              if (h.assetClass === 'FGTS') {
                const fgtsVal =
                  typeof patLive.fgtsBrl === 'number' && patLive.fgtsBrl > 0
                    ? patLive.fgtsBrl
                    : h.marketValueBrl;
                return {
                  ...h,
                  investedBrl: fgtsVal,
                  avgPriceBrl: fgtsVal,
                  currentPriceBrl: fgtsVal,
                  marketValueBrl: fgtsVal,
                };
              }

              const sh = sheetStocksMap.get(h.ticker.toUpperCase());
              if (!sh) return h;
              if (typeof sh.quantity !== 'number' || sh.quantity <= 0 || sh.marketValueBrl <= 0 || sh.marketValueBrl > 10_000_000) return h;

              return {
                ...h,
                quantity: sh.quantity,
                avgPriceBrl: sh.avgPriceBrl,
                currentPriceBrl: sh.currentPriceBrl,
                investedBrl: sh.investedBrl,
                marketValueBrl: sh.marketValueBrl,
                openProfitBrl: sh.openProfitBrl,
                openProfitPct: sh.openProfitPct,
                dividendsBrl: sh.dividendsBrl || h.dividendsBrl,
                totalProfitBrl:
                  sh.totalProfitBrl ||
                  Number((sh.openProfitBrl + (sh.dividendsBrl || h.dividendsBrl || 0)).toFixed(2)),
              };
            });

          // A) Automated Fixed Income holdings (Active custody only; withdrawn products are kept in fixedIncomeProducts)
          const fiHoldings: Holding[] = updatedFiProducts
            .filter((fp) => fp.status !== 'WITHDRAWN' && fp.marketValueBrl > 0)
            .map((fp) => {
              const existingFi = existingById.get(fp.holdingId);
              if (existingFi) return existingFi;
            return {
              id: fp.holdingId,
              ticker: fp.name.slice(0, 14).toUpperCase(),
              name: fp.name,
              assetClass: 'FIXED_INCOME',
              macroGroup: 'Cash on Hand',
              broker: fp.issuer.toUpperCase(),
              quantity: 1,
              avgPriceBrl: fp.totalInvestedBrl,
              currentPriceBrl: fp.marketValueBrl,
              investedBrl: fp.totalInvestedBrl,
              marketValueBrl: fp.marketValueBrl,
              netValueBrl: fp.netValueBrl ?? fp.marketValueBrl,
              taxesAndFeesBrl: fp.taxesAndFeesBrl ?? 0,
              dailyChangeBrl: 0,
              dailyChangePct: 0,
              openProfitBrl: fp.absoluteProfitBrl,
              openProfitPct: fp.rentabilityPct,
              tradesProfitBrl: 0,
              dividendsBrl: 0,
              totalProfitBrl: fp.absoluteProfitBrl,
              tirMonthlyPct: 0.9,
              tirAnnualPct: 11.4,
              sector: `Renda Fixa (${fp.indexer})`,
              riskLevel: 'Very low',
              automationSource: 'BCB_CDI',
              info: `${fp.name} sincronizado via Patrimony Analysis 2.0.`,
            };
          });

          // B) Manual Cash on Hand & Leftovers from Patrimony Analysis 2.0
          let manualCashHoldings: Holding[] = currentHoldings.filter(
            (h) => h.assetClass === 'FIXED_INCOME' && h.isManual
          );
          if (Array.isArray(patLive.manualCashItems) && patLive.manualCashItems.length > 0) {
            manualCashHoldings = patLive.manualCashItems
              .filter((item: any) => item.valueBrl > 0)
              .map((item: any) => {
                const key = String(item.name || '').trim().toLowerCase();
                const def = MANUAL_CASH_DEFS[key] || {
                  id: `fi-manual-${key.replace(/[^a-z0-9]+/g, '-')}`,
                  ticker: String(item.name || 'CASH').toUpperCase(),
                  name: item.name,
                  broker: 'MANUAL',
                  sector: 'Caixa / Manual',
                };
                const existing = existingById.get(def.id);
                return {
                  id: def.id,
                  ticker: def.ticker,
                  name: def.name,
                  assetClass: 'FIXED_INCOME',
                  macroGroup: 'Cash on Hand',
                  broker: def.broker,
                  quantity: 1,
                  avgPriceBrl: item.valueBrl,
                  currentPriceBrl: item.valueBrl,
                  investedBrl: item.valueBrl,
                  marketValueBrl: item.valueBrl,
                  dailyChangeBrl: 0,
                  dailyChangePct: 0,
                  openProfitBrl: 0,
                  openProfitPct: 0,
                  tradesProfitBrl: 0,
                  dividendsBrl: 0,
                  totalProfitBrl: 0,
                  tirMonthlyPct: existing?.tirMonthlyPct ?? 0,
                  tirAnnualPct: existing?.tirAnnualPct ?? 0,
                  sector: def.sector,
                  riskLevel: item.riskLevel || 'Very low',
                  isManual: true,
                  info: existing?.info || `Saldo manual (${item.name}) sincronizado com Patrimony Analysis 2.0.`,
                };
              });
          }

          // C) Foreign Currency Protection Holdings (USD, GBP, EUR, CHF) from Patrimony Analysis 2.0 Currency tab
          let fxProtectionHoldings: Holding[] = currentHoldings.filter(
            (h) => h.assetClass === 'PROTECTION' && ['USD', 'GBP', 'EUR', 'CHF'].includes(h.ticker)
          );
          if (Array.isArray(patLive.forexSummaries) && patLive.forexSummaries.length > 0) {
            const fxByCode = new Map<string, any>(
              patLive.forexSummaries.map((s: any) => [s.code, s])
            );
            fxProtectionHoldings = fxProtectionHoldings.map((h) => {
              const fx = fxByCode.get(h.ticker);
              if (!fx) return h;
              const currentRate =
                h.ticker === 'USD'
                  ? liveUsd
                  : h.ticker === 'GBP'
                    ? mQuotes.GBPBRL?.price || fx.currentEx
                    : h.ticker === 'EUR'
                      ? mQuotes.EURBRL?.price || fx.currentEx
                      : mQuotes.CHFBRL?.price || fx.currentEx;
              const protBrl = fx.patrimonyProtectionBrl || fx.valueBrl;
              const profitBrl = fx.profitBrl;
              const investedBrl = Number(Math.max(0, protBrl - profitBrl).toFixed(2));
              const qty = currentRate > 0 ? Number((protBrl / currentRate).toFixed(2)) : h.quantity;
              return {
                ...h,
                quantity: qty,
                avgPriceBrl: fx.avgPaidEx,
                currentPriceBrl: Number(currentRate.toFixed(2)),
                investedBrl,
                marketValueBrl: Number(protBrl.toFixed(2)),
                openProfitBrl: profitBrl,
                openProfitPct: fx.profitPct,
                totalProfitBrl: profitBrl,
                info: `Reserva cambial (${fx.cashOnHand}). Câmbio médio pago: R$ ${fx.avgPaidEx.toFixed(2)} | Cotação atual: R$ ${currentRate.toFixed(2)}.`,
              };
            });
          }

          baseHoldings = deduplicateHoldings([
            ...preservedHoldings,
            ...fxProtectionHoldings,
            ...fiHoldings,
            ...manualCashHoldings,
          ]);
        }

        // 2. Update all holdings with live market prices & daily variations
        const updatedHoldings = deduplicateHoldings(
          baseHoldings.map((h) => {
            if (h.assetClass === 'FGTS') return h;

            // Sync FIXED_INCOME holdings with their automated FixedIncomeProductSummary
            if (h.assetClass === 'FIXED_INCOME') {
              const matchedProd = fiByHoldingId.get(h.id);
              if (!matchedProd) return h;
              const cdiFactor =
                matchedProd.automationType === 'BCB_CDI'
                  ? ((matchedProd.cdiPct || 100) / 100) * dailyCdiRatePct
                  : dailyCdiRatePct;
              const estDailyBrl = Number(
                ((matchedProd.marketValueBrl * cdiFactor) / 100).toFixed(2)
              );
              return {
                ...h,
                investedBrl: matchedProd.totalInvestedBrl,
                avgPriceBrl: matchedProd.totalInvestedBrl,
                currentPriceBrl: matchedProd.marketValueBrl,
                marketValueBrl: matchedProd.marketValueBrl,
                netValueBrl: matchedProd.netValueBrl ?? matchedProd.marketValueBrl,
                taxesAndFeesBrl: matchedProd.taxesAndFeesBrl ?? h.taxesAndFeesBrl,
                dailyChangePct: Number(cdiFactor.toFixed(3)),
                dailyChangeBrl: estDailyBrl,
                openProfitBrl: matchedProd.absoluteProfitBrl,
                openProfitPct: matchedProd.rentabilityPct,
                totalProfitBrl: matchedProd.absoluteProfitBrl,
              };
            }

            const q = hQuotes[h.ticker];
            if (!q || typeof q.priceBrl !== 'number' || q.priceBrl <= 0) return h;

            // Preserve the base valuation from the spreadsheet (1:1 exact parity)!
            // Quotes from Yahoo Finance only provide the intraday change % and daily change R$.
            const dailyChangePct = q.changePct ?? h.dailyChangePct;
            const dailyChangeBrl = Number(((h.marketValueBrl * dailyChangePct) / 100).toFixed(2));

            return {
              ...h,
              dailyChangePct,
              dailyChangeBrl: q.changePct !== undefined ? dailyChangeBrl : h.dailyChangeBrl,
            };
          })
        );

        // 3. Sync ONLY op.normal (transactions) and proventos (recentDividends) from the Investments Sheet (once per day)
        const snap = stateSnapshotRef.current;
        let nextTransactions = snap.transactions;
        let nextDividends = snap.recentDividends;

        if (gsLive) {
          const nextGsMeta = {
            syncedAt: gsLive.syncedAt,
            sheetUrl: gsLive.sheetUrl,
            transactionsCount: gsLive.transactionsCount,
            dividendsCount: gsLive.dividendsCount,
            totalHistoricalDividendsBrl: gsLive.totalHistoricalDividendsBrl,
          };
          setGoogleSheetsMeta(nextGsMeta);
          localStorage.setItem('patrimony_gs_meta_v1', JSON.stringify(nextGsMeta));

          if (Array.isArray(gsLive.transactions) && gsLive.transactions.length > 0) {
            nextTransactions = gsLive.transactions;
            setTransactions(gsLive.transactions);
          }
          if (Array.isArray(gsLive.recentDividends) && gsLive.recentDividends.length > 0) {
            nextDividends = gsLive.recentDividends;
            setRecentDividends(gsLive.recentDividends);
          }
        }

        // 4. Sync Currency Exchange purchases & summaries from Patrimony Analysis 2.0 (once per day)
        let nextForexPurchases = snap.forexPurchases;
        let nextForexSummaries = snap.forexSummaries;
        if (patLive?.forexPurchases && patLive.forexPurchases.length > 0) {
          nextForexPurchases = patLive.forexPurchases;
          setForexPurchases(patLive.forexPurchases);
        }
        if (patLive?.forexSummaries && patLive.forexSummaries.length > 0) {
          nextForexSummaries = patLive.forexSummaries;
          setForexSummaries(patLive.forexSummaries);
        }

        holdingsRef.current = updatedHoldings;
        setHoldings(updatedHoldings);
        setLastLiveUpdate(new Date().toLocaleTimeString('pt-BR'));
        persistState({
          holdings: updatedHoldings,
          fixedIncomeProducts: updatedFiProducts,
          transactions: nextTransactions,
          recentDividends: nextDividends,
          forexPurchases: nextForexPurchases,
          forexSummaries: nextForexSummaries,
          ptax: liveUsd,
        });
      }
    } catch {
      // Offline fallback
    } finally {
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    }
  }, [persistState]);

  // Load state from SQLite API strictly ONCE on startup, then trigger initial live market sync
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function loadInitial() {
      try {
        const res = await fetch('/api/portfolio');
        if (res.ok) {
          const data = await res.json();
          if (data.initialized && data.state) {
            const s = data.state;
            if (s.holdings) {
              const cleanH = deduplicateHoldings(s.holdings);
              const voo = cleanH.find((h) => h.ticker === 'VOO');
              if (voo && voo.quantity > 0 && voo.quantity <= 100) {
                holdingsRef.current = cleanH;
                setHoldings(cleanH);
              }
            }
            if (s.allocationGoals) setAllocationGoals(s.allocationGoals);
            if (s.monthlyPerformance) setMonthlyPerformance(s.monthlyPerformance);
            if (s.fixedIncomeProducts) {
              const cleanFi = deduplicateFixedIncomeProducts(s.fixedIncomeProducts);
              fixedIncomeRef.current = cleanFi;
              setFixedIncomeProducts(cleanFi);
            }
            if (s.transactions) setTransactions(s.transactions);
            if (s.recentDividends) setRecentDividends(s.recentDividends);
            if (s.forexPurchases) setForexPurchases(s.forexPurchases);
            if (s.forexSummaries) setForexSummaries(s.forexSummaries);
            if (s.lifeGoals) setLifeGoals(s.lifeGoals);
            if (s.cashflowProfile) setCashflowProfile(s.cashflowProfile);
            if (s.ptax) setPtax(s.ptax);
          }
        }
      } catch {}
      // Fetch live market quotes once on startup (sheets only if >24h since last sync)
      setTimeout(() => {
        handleRefreshLiveQuotes(false);
      }, 600);
    }
    loadInitial();
  }, [handleRefreshLiveQuotes]);

  // Smart Auto-Refresh: 1 minute (60,000 ms) on weekdays (Mon-Fri), 10 minutes (600,000 ms) on weekends (Sat-Sun)
  useEffect(() => {
    if (!autoRefresh) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const weekend = checkIsWeekend();
      setIsWeekend(weekend);
      const intervalMs = weekend ? 600_000 : 60_000;
      timeoutId = setTimeout(() => {
        handleRefreshLiveQuotes(false);
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [autoRefresh, handleRefreshLiveQuotes]);

  // Export portfolio JSON backup
  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      holdings,
      allocationGoals,
      monthlyPerformance,
      fixedIncomeProducts,
      transactions,
      recentDividends,
      forexPurchases,
      forexSummaries,
      lifeGoals,
      cashflowProfile,
      ptax,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patrimony-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import portfolio JSON backup
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result));
        if (parsed.holdings) {
          setHoldings(parsed.holdings);
          if (parsed.allocationGoals) setAllocationGoals(parsed.allocationGoals);
          if (parsed.fixedIncomeProducts) setFixedIncomeProducts(parsed.fixedIncomeProducts);
          if (parsed.transactions) setTransactions(parsed.transactions);
          if (parsed.recentDividends) setRecentDividends(parsed.recentDividends);
          if (parsed.forexPurchases) setForexPurchases(parsed.forexPurchases);
          if (parsed.forexSummaries) setForexSummaries(parsed.forexSummaries);
          if (parsed.lifeGoals) setLifeGoals(parsed.lifeGoals);
          if (parsed.cashflowProfile) setCashflowProfile(parsed.cashflowProfile);
          persistState(parsed);
        }
      } catch {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  // Avenue leftovers are always included
  const summary = computePortfolioSummary(holdings, includeFgts);
  const variableHoldings = holdings.filter(
    (h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS' && !h.isManual
  );
  const variableMarketBrl = variableHoldings.reduce((a, b) => a + b.marketValueBrl, 0);
  const variableInvestedBrl = variableHoldings.reduce((a, b) => a + b.investedBrl, 0);
  const variableOpenProfitBrl = variableHoldings.reduce((a, b) => a + b.openProfitBrl, 0);
  const variableTotalProfitBrl = variableHoldings.reduce((a, b) => a + b.totalProfitBrl, 0);
  const variableOpenProfitPct =
    variableInvestedBrl > 0 ? (variableOpenProfitBrl / variableInvestedBrl) * 100 : 0;
  const totalDailyChangeBrl = holdings.reduce((a, b) => a + b.dailyChangeBrl, 0);
  const totalDailyChangePct =
    variableMarketBrl > 0 ? (totalDailyChangeBrl / variableMarketBrl) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#111317] text-slate-100 flex flex-col">
      {/* Top Header Bar (scrolls naturally on mobile so it doesn't freeze half the screen; padded for iPhone status bar) */}
      <header className="bg-[#161920] border-b border-[#2b303b]/60 ios-header-safe">
        <div className="max-w-[1440px] mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
          {/* Brand + Privacy Eye + Live Status */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center shadow-md shrink-0">
              <LineChart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Patrimony Dashboard
              </h1>
              <button
                onClick={() => setHideValues((v) => !v)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {lastLiveUpdate && (
                <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Ao Vivo ({lastLiveUpdate})
                </span>
              )}
            </div>
          </div>

          {/* Right Global Controls: Currency Switcher, PTAX, Auto-Refresh, FGTS Toggle, Backup */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Global Currency Toggle */}
            <div className="flex items-center bg-[#111317] p-0.5 sm:p-1 rounded-lg border border-[#2b303b]">
              <button
                onClick={() => setCurrency('BRL')}
                className={`px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  currency === 'BRL'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇧🇷 R$
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-bold transition-all ${
                  currency === 'USD'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇺🇸 US$
              </button>
            </div>

            {/* Live PTAX Box */}
            <div className="flex items-center gap-1 bg-[#111317] border border-[#2b303b] rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs">
              <span className="text-slate-400">US$/R$:</span>
              <input
                type="number"
                step="0.01"
                value={ptax}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 5.18;
                  setPtax(val);
                  persistState({ ptax: val });
                }}
                className="w-14 sm:w-16 bg-transparent font-mono font-bold text-amber-400 focus:outline-none"
              />
            </div>

            {/* Smart Auto-Refresh Toggle (1m on weekdays, 10m on weekends) */}
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all ${
                autoRefresh
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#111317] border-[#2b303b] text-slate-400'
              }`}
              title="Atualiza automaticamente a cada 1 minuto em dias úteis (Seg-Sex) e a cada 10 minutos aos finais de semana (Sáb-Dom)"
            >
              <Radio className="w-3.5 h-3.5" />
              {isWeekend ? 'Auto (10m)' : 'Auto (1m)'}
            </button>

            {/* Manual Live Sync Button */}
            <button
              onClick={() => handleRefreshLiveQuotes(true)}
              disabled={syncStatus === 'SYNCING'}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-[#1b1e24] hover:bg-[#23272f] border border-[#2b303b] text-[11px] sm:text-xs font-medium text-slate-200 transition-all"
              title="Sincronizar Planilha Google Sheets, Ações, FIIs, ETFs, Cripto, Dólar e Renda Fixa (BCB/CVM/Tesouro) agora"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  syncStatus === 'SYNCING' ? 'animate-spin' : ''
                }`}
              />
              {syncStatus === 'SYNCING' ? 'Sincronizando...' : 'Sincronizar'}
            </button>

            {/* FGTS Toggle */}
            <button
              onClick={() => setIncludeFgts((v) => !v)}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all ${
                includeFgts
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                  : 'bg-[#111317] border-[#2b303b] text-slate-400 hover:text-white'
              }`}
            >
              {includeFgts ? '✓ FGTS' : 'Sem FGTS'}
            </button>

            {/* Export / Import */}
            <button
              onClick={handleExportJson}
              className="p-1.5 rounded-lg bg-[#1b1e24] hover:bg-[#23272f] border border-[#2b303b] text-slate-300 hover:text-white"
              title="Exportar Backup JSON"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <label
              className="p-1.5 rounded-lg bg-[#1b1e24] hover:bg-[#23272f] border border-[#2b303b] text-slate-300 hover:text-white cursor-pointer"
              title="Importar Backup JSON"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      {/* Slim Navigation Tabs Bar (sticky only on desktop so mobile scrolling uses 100% of screen) */}
      <nav className="md:sticky md:top-0 z-30 bg-[#161920]/95 backdrop-blur border-b border-[#2b303b]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'RENTABILIDADE', label: 'Rentabilidade', icon: LineChart },
            { id: 'PERFORMANCE_DO_DIA', label: 'Performance do Dia', icon: Activity },
            { id: 'PATRIMONIO', label: 'Distribuição do Patrimônio', icon: PieChart },
            { id: 'ALOCACAO', label: 'Alocação', icon: Target },
            { id: 'ATIVOS', label: 'Carteira & Custódia', icon: Briefcase },
            { id: 'RENDA_FIXA', label: 'Renda Fixa', icon: Landmark },
            { id: 'CAMBIO', label: 'Câmbio', icon: Globe },
            { id: 'PROVENTOS', label: 'Proventos', icon: Coins },
            { id: 'METAS', label: 'Metas', icon: Rocket },
            { id: 'TRANSACOES', label: 'Transações', icon: History },
            { id: 'CURIOSIDADES', label: 'Curiosidades', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-amber-500 text-amber-400 bg-[#1b1e24]/70'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#1b1e24]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Top Executive KPI Banner */}
      <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-3 sm:p-4 shadow overflow-hidden min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 flex items-center justify-between gap-1">
              <span className="truncate">Patrimônio {includeFgts ? '(c/ FGTS)' : '(s/ FGTS)'}</span>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 whitespace-nowrap shrink-0">
                Meta 1M: {((summary.withFgtsTotalBrl / 1_000_000) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[15px] sm:text-xl lg:text-2xl font-extrabold font-mono text-white mt-1 tracking-tight truncate">
              {formatCurrency(summary.totalMarketBrl, currency, ptax, hideValues)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-1 truncate">
              {currency === 'BRL'
                ? `US$: ${formatCurrency(summary.totalMarketBrl, 'USD', ptax, hideValues)}`
                : `R$: ${formatCurrency(summary.totalMarketBrl, 'BRL', ptax, hideValues)}`}
            </div>
          </div>

          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-3 sm:p-4 shadow overflow-hidden min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
              Custódia Renda Variável
            </div>
            <div className="text-[15px] sm:text-xl lg:text-2xl font-extrabold font-mono text-amber-400 mt-1 tracking-tight truncate">
              {formatCurrency(variableMarketBrl, currency, ptax, hideValues)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-1 truncate">
              Investido: {formatCurrency(variableInvestedBrl, currency, ptax, hideValues)}
            </div>
          </div>

          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-3 sm:p-4 shadow overflow-hidden min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
              Renda Fixa & Caixa ({formatPct(summary.byMacroGroup['Cash on Hand']?.sharePct ?? 50.4, 1)})
            </div>
            <div className="text-[15px] sm:text-xl lg:text-2xl font-extrabold font-mono text-blue-400 mt-1 tracking-tight truncate">
              {formatCurrency(summary.byMacroGroup['Cash on Hand']?.marketBrl ?? 423648.14, currency, ptax, hideValues)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-emerald-400 mt-1 truncate">
              Lucro RF: +{formatCurrency(fixedIncomeProducts.reduce((a, b) => a + b.absoluteProfitBrl, 0), currency, ptax, hideValues)}
            </div>
          </div>

          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-3 sm:p-4 shadow overflow-hidden min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
              Lucro Total Renda Variável
            </div>
            <div className="text-[15px] sm:text-xl lg:text-2xl font-extrabold font-mono text-emerald-400 mt-1 tracking-tight truncate">
              {variableTotalProfitBrl >= 0 ? '+' : ''}
              {formatCurrency(variableTotalProfitBrl, currency, ptax, hideValues)}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 mt-1 truncate">
              Aberto: {variableOpenProfitBrl >= 0 ? '+' : ''}
              {formatCurrency(variableOpenProfitBrl, currency, ptax, hideValues)} ({formatPct(variableOpenProfitPct, 1, true)})
            </div>
          </div>

          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-3 sm:p-4 shadow col-span-2 md:col-span-1 overflow-hidden min-w-0">
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
              Variação do Dia (Ao Vivo)
            </div>
            <div
              className={`text-base sm:text-xl lg:text-2xl font-extrabold font-mono mt-1 tracking-tight truncate ${
                totalDailyChangeBrl >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {totalDailyChangeBrl >= 0 ? '+' : ''}
              {formatCurrency(totalDailyChangeBrl, currency, ptax, hideValues)}{' '}
              <span className="text-xs">({formatPct(totalDailyChangePct, 2, true)})</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-amber-400 mt-1 truncate">
              Proventos: {formatCurrency(googleSheetsMeta?.totalHistoricalDividendsBrl ?? 40486.14, currency, ptax, hideValues)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {activeTab === 'RENTABILIDADE' && (
          <RentabilityTab
            monthlyPerformance={monthlyPerformance}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
        )}

        {activeTab === 'PERFORMANCE_DO_DIA' && (
          <DayPerformanceTab
            holdings={holdings}
            ptax={ptax}
            currency={currency}
            hideValues={hideValues}
            onRefreshQuotes={async () => {
              await handleRefreshLiveQuotes(false);
            }}
            isSyncing={syncStatus === 'SYNCING'}
            lastUpdated={lastLiveUpdate}
          />
        )}

        {activeTab === 'PATRIMONIO' && (
          <PatrimonyTab
            holdings={holdings}
            allocationGoals={allocationGoals}
            marketIndicators={marketIndicators}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
            includeFgts={includeFgts}
          />
        )}

        {activeTab === 'ALOCACAO' && (
          <AllocationTab
            holdings={holdings}
            allocationGoals={allocationGoals}
            onUpdateGoals={(nextGoals) => {
              setAllocationGoals(nextGoals);
              persistState({ allocationGoals: nextGoals });
            }}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
            includeFgts={includeFgts}
          />
        )}

        {activeTab === 'ATIVOS' && (
          <HoldingsTab
            holdings={holdings}
            onUpdateHolding={(updated) => {
              const next = holdings.map((h) => (h.id === updated.id ? updated : h));
              setHoldings(next);
              persistState({ holdings: next });
            }}
            onAddHolding={(newH) => {
              const next = [...holdings, newH];
              setHoldings(next);
              persistState({ holdings: next });
            }}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}

        {activeTab === 'RENDA_FIXA' && (
          <FixedIncomeForexTab
            products={fixedIncomeProducts}
            onUpdateProducts={(nextProds) => {
              setFixedIncomeProducts(nextProds);
              const prodMap = new Map(nextProds.map((p) => [p.holdingId, p]));
              const nextHoldings = holdings.map((h) => {
                if (h.assetClass !== 'FIXED_INCOME') return h;
                const matched = prodMap.get(h.id);
                if (!matched) return h;
                return {
                  ...h,
                  investedBrl: matched.totalInvestedBrl,
                  avgPriceBrl: matched.totalInvestedBrl,
                  currentPriceBrl: matched.marketValueBrl,
                  marketValueBrl: matched.marketValueBrl,
                  openProfitBrl: matched.absoluteProfitBrl,
                  openProfitPct: matched.rentabilityPct,
                  totalProfitBrl: matched.absoluteProfitBrl,
                };
              });
              setHoldings(nextHoldings);
              persistState({ fixedIncomeProducts: nextProds, holdings: nextHoldings });
            }}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
            liveMeta={fixedIncomeLiveMeta}
          />
        )}

        {activeTab === 'CAMBIO' && (
          <ForexTab
            forexPurchases={forexPurchases}
            forexSummaries={forexSummaries}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}

        {activeTab === 'PROVENTOS' && (
          <DividendsTab
            holdings={holdings}
            transactions={transactions}
            recentDividends={recentDividends}
            onAddDividend={(div) => {
              const nextDivs = [div, ...recentDividends];
              const nextHoldings = holdings.map((h) =>
                h.ticker === div.ticker
                  ? {
                      ...h,
                      dividendsBrl: Number((h.dividendsBrl + div.netValueBrl).toFixed(2)),
                      totalProfitBrl: Number((h.totalProfitBrl + div.netValueBrl).toFixed(2)),
                    }
                  : h
              );
              setRecentDividends(nextDivs);
              setHoldings(nextHoldings);
              persistState({ recentDividends: nextDivs, holdings: nextHoldings });
            }}
            onAddDividendsBatch={(divs) => {
              const nextDivs = [...divs, ...recentDividends];
              const deltaByTicker = new Map<string, number>();
              for (const d of divs) {
                deltaByTicker.set(d.ticker, (deltaByTicker.get(d.ticker) || 0) + d.netValueBrl);
              }
              const nextHoldings = holdings.map((h) => {
                const addBrl = deltaByTicker.get(h.ticker);
                if (!addBrl) return h;
                return {
                  ...h,
                  dividendsBrl: Number((h.dividendsBrl + addBrl).toFixed(2)),
                  totalProfitBrl: Number((h.totalProfitBrl + addBrl).toFixed(2)),
                };
              });
              setRecentDividends(nextDivs);
              setHoldings(nextHoldings);
              persistState({ recentDividends: nextDivs, holdings: nextHoldings });
            }}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}

        {activeTab === 'METAS' && (
          <GoalsAndTransactionsTab
            lifeGoals={lifeGoals}
            cashflowProfile={cashflowProfile}
            onUpdateCashflow={(nextProfile) => {
              setCashflowProfile(nextProfile);
              persistState({ cashflowProfile: nextProfile });
            }}
            recentDividends={recentDividends}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}

        {activeTab === 'TRANSACOES' && (
          <TransactionsTab
            transactions={transactions}
            holdings={holdings}
            onAddTransaction={(newTx) => {
              const nextTx = [...transactions, newTx];
              setTransactions(nextTx);
              persistState({ transactions: nextTx });
            }}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}

        {activeTab === 'CURIOSIDADES' && (
          <CuriositiesTab
            holdings={holdings}
            fixedIncomeProducts={fixedIncomeProducts}
            transactions={transactions}
            recentDividends={recentDividends}
            forexPurchases={forexPurchases}
            monthlyPerformance={monthlyPerformance}
            currency={currency}
            ptax={ptax}
            hideValues={hideValues}
          />
        )}
      </main>

      {/* Footer with Google Sheets links & Data Sources */}
      <footer className="border-t border-[#2b303b]/70 bg-[#161920]/80 mt-8 ios-bottom-safe">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-[11px] text-slate-400">
            Controle Pessoal • Planilhas Google Sheets sincronizadas 1x/dia + Cotações Yahoo Finance, BCB CDI, CVM e Tesouro Direto
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {googleSheetsMeta && (
              <a
                href={googleSheetsMeta.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full transition-colors"
                title={`Planilha de Investimentos (1x/dia): op.normal (${googleSheetsMeta.transactionsCount} operações) e proventos (${googleSheetsMeta.dividendsCount} registros)`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Planilha RV ({googleSheetsMeta.transactionsCount} ops • {googleSheetsMeta.dividendsCount} prov • 1x/dia)
              </a>
            )}
            {patrimonySheetMeta && (
              <a
                href={patrimonySheetMeta.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-blue-300 font-semibold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-full transition-colors"
                title={`Patrimony Analysis 2.0 (1x/dia): ${patrimonySheetMeta.fixedIncomeCount} títulos de Renda Fixa, ${patrimonySheetMeta.forexPurchasesCount} remessas de Câmbio e Leftovers Manuais`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Patrimony 2.0 ({patrimonySheetMeta.fixedIncomeCount} RF • {patrimonySheetMeta.forexPurchasesCount} Câmbio • 1x/dia)
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
