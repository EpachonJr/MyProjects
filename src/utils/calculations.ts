import {
  AssetClass,
  DividendRecord,
  Holding,
  MonthlyPerformanceRow,
} from '../types/portfolio';
import {
  INITIAL_DIVIDEND_MONTHLY_SERIES,
  INITIAL_RECENT_DIVIDENDS,
} from '../data/seedHistory';

export type CurrencyMode = 'BRL' | 'USD';

export type BenchmarkKey = 'CDI' | 'IPCA' | 'IBOV' | 'SP500' | 'NASDAQ' | 'DOWJONES' | 'IFIX';

export type YoYCategoryKey =
  | 'CARTEIRA'
  | 'ACOES'
  | 'ETF'
  | 'TESOURO'
  | 'STOCKS'
  | 'FIIS'
  | 'RENDA_FIXA'
  | 'CRIPTO'
  | 'CDI'
  | 'IPCA'
  | 'IBOV'
  | 'SP500'
  | 'NASDAQ'
  | 'DOWJONES'
  | 'IFIX';

export function formatCurrency(
  valueBrl: number,
  currency: CurrencyMode = 'BRL',
  ptax: number = 5.1842,
  hideValues: boolean = false,
  compact: boolean = false
): string {
  if (hideValues) return currency === 'BRL' ? 'R$ ••••••' : '$ ••••••';
  const val = currency === 'BRL' ? valueBrl : valueBrl / ptax;
  const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
  const currCode = currency === 'BRL' ? 'BRL' : 'USD';

  if (compact && Math.abs(val) >= 1_000_000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currCode,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(val);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatPct(val: number | null | undefined, digits: number = 2, showPlus: boolean = false): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-%';
  const prefix = showPlus && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(digits).replace('.', ',')}%`;
}

export interface RentabilityFilterConfig {
  preset: 'STATUS_INVEST_EQUITIES' | 'ALL_WITH_FIXED_INCOME' | 'ONLY_STOCKS' | 'ONLY_FIXED_INCOME' | 'ONLY_FIIS' | 'CUSTOM';
  selectedClasses: AssetClass[];
  currency: CurrencyMode;
  deflateIpca: boolean; // Real return above inflation
  startMonth: string; // YYYY-MM
  endMonth: string;   // YYYY-MM
}

export interface ComputedTimeSeriesPoint {
  month: string;
  label: string;
  portfolioMonthlyPct: number;
  portfolioAccumulatedPct: number;
  cdiAccumulatedPct: number;
  ipcaAccumulatedPct: number;
  ibovAccumulatedPct: number;
  sp500AccumulatedPct: number;
  nasdaqAccumulatedPct: number;
  dowJonesAccumulatedPct: number;
  ifixAccumulatedPct: number;
  usdAccumulatedPct: number;
  ptax: number;
}

export interface YoYCategoryYearData {
  months: (number | null)[]; // index 0..11 (Jan..Dec)
  yearReturnPct: number | null;
  accumulatedPct: number | null;
}

export interface YearOverYearRow {
  year: number;
  months: (number | null)[]; // index 0..11 (Jan..Dec)
  benchMonths: (number | null)[];
  yearReturnPct: number;
  benchYearReturnPct: number;
  accumulatedPct: number;
  categories: Record<YoYCategoryKey, YoYCategoryYearData>;
}

/**
 * Adjusts a nominal BRL monthly return for USD currency mode and/or IPCA deflation.
 */
function applyCurrencyAndDeflation(
  nominalBrlPct: number,
  row: MonthlyPerformanceRow,
  config: RentabilityFilterConfig,
  isAlreadyUsdWhenUsdMode: boolean = false
): number {
  let adjustedPct = nominalBrlPct;

  if (config.currency === 'USD' && !isAlreadyUsdWhenUsdMode) {
    const brlFactor = 1 + adjustedPct / 100;
    const fxFactor = 1 + row.usdBrlPct / 100;
    adjustedPct = ((brlFactor / fxFactor) - 1) * 100;
  }

  if (config.deflateIpca) {
    const factor = 1 + adjustedPct / 100;
    const ipcaFactor = 1 + row.ipcaPct / 100;
    adjustedPct = ((factor / ipcaFactor) - 1) * 100;
  }

  return Number(adjustedPct.toFixed(2));
}

/**
 * Computes the monthly return for a given MonthlyPerformanceRow based on the user's selected asset classes
 * and currency mode (BRL vs USD) or real return (deflated by IPCA).
 */
export function computeBlendedMonthlyReturn(
  row: MonthlyPerformanceRow,
  config: RentabilityFilterConfig
): number {
  let nominalBrlPct = 0;

  const classes = new Set(config.selectedClasses);
  const isExactStatusInvest =
    config.preset === 'STATUS_INVEST_EQUITIES' ||
    (!classes.has('FIXED_INCOME') &&
      classes.has('STOCKS_BR') &&
      classes.has('STOCKS_US') &&
      classes.has('ETFS_US') &&
      classes.has('FIIS') &&
      classes.size >= 4);

  if (isExactStatusInvest && !classes.has('FIXED_INCOME')) {
    nominalBrlPct = row.equitiesStatusInvestPct;
  } else if (classes.size === 1 && classes.has('FIXED_INCOME')) {
    nominalBrlPct = row.fixedIncomePct;
  } else if (classes.size === 1 && classes.has('FIIS')) {
    nominalBrlPct = row.fiisPct;
  } else if (classes.size === 1 && classes.has('STOCKS_BR')) {
    nominalBrlPct = row.stocksBrPct;
  } else if (classes.size === 1 && classes.has('STOCKS_US')) {
    nominalBrlPct = row.stocksUsPct;
  } else if (classes.size === 1 && classes.has('ETFS_US')) {
    nominalBrlPct = row.etfsUsPct;
  } else if (classes.size === 1 && classes.has('CRYPTO')) {
    nominalBrlPct = row.cryptoPct;
  } else if (classes.size === 1 && classes.has('PROTECTION')) {
    nominalBrlPct = row.protectionPct;
  } else {
    const hasAllVariable =
      classes.has('STOCKS_BR') &&
      classes.has('STOCKS_US') &&
      classes.has('ETFS_US') &&
      classes.has('FIIS');

    if (hasAllVariable && classes.has('FIXED_INCOME')) {
      const fiWeight = row.weights.FIXED_INCOME;
      const eqWeight = 1 - fiWeight;
      nominalBrlPct = fiWeight * row.fixedIncomePct + eqWeight * row.equitiesStatusInvestPct;
    } else {
      let totalWeight = 0;
      let weightedSum = 0;

      const classMap: Array<[AssetClass, number, number]> = [
        ['FIXED_INCOME', row.weights.FIXED_INCOME, row.fixedIncomePct],
        ['STOCKS_BR', row.weights.STOCKS_BR, row.stocksBrPct],
        ['STOCKS_US', row.weights.STOCKS_US, row.stocksUsPct],
        ['ETFS_US', row.weights.ETFS_US, row.etfsUsPct],
        ['FIIS', row.weights.FIIS, row.fiisPct],
        ['CRYPTO', row.weights.CRYPTO, row.cryptoPct],
        ['PROTECTION', row.weights.PROTECTION, row.protectionPct],
      ];

      for (const [cls, w, r] of classMap) {
        if (classes.has(cls)) {
          totalWeight += w;
          weightedSum += w * r;
        }
      }

      nominalBrlPct = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
  }

  return applyCurrencyAndDeflation(nominalBrlPct, row, config, false);
}

const ALL_YOY_CATEGORIES: YoYCategoryKey[] = [
  'CARTEIRA',
  'ACOES',
  'ETF',
  'TESOURO',
  'STOCKS',
  'FIIS',
  'RENDA_FIXA',
  'CRIPTO',
  'CDI',
  'IPCA',
  'IBOV',
  'SP500',
  'NASDAQ',
  'DOWJONES',
  'IFIX',
];

export function buildRentabilityAnalytics(
  rows: MonthlyPerformanceRow[],
  config: RentabilityFilterConfig,
  comparisonBenchmark: BenchmarkKey = 'CDI'
) {
  const filtered = rows.filter(
    (r) => r.month >= config.startMonth && r.month <= config.endMonth
  );

  let portFactor = 1;
  let cdiFactor = 1;
  let ipcaFactor = 1;
  let ibovFactor = 1;
  let sp500Factor = 1;
  let nasdaqFactor = 1;
  let dowJonesFactor = 1;
  let ifixFactor = 1;
  let usdFactor = 1;

  // Running cumulative factors for each YoY category
  const catFactors: Record<YoYCategoryKey, number> = {
    CARTEIRA: 1,
    ACOES: 1,
    ETF: 1,
    TESOURO: 1,
    STOCKS: 1,
    FIIS: 1,
    RENDA_FIXA: 1,
    CRIPTO: 1,
    CDI: 1,
    IPCA: 1,
    IBOV: 1,
    SP500: 1,
    NASDAQ: 1,
    DOWJONES: 1,
    IFIX: 1,
  };
  const catHasStarted: Record<YoYCategoryKey, boolean> = {
    CARTEIRA: false,
    ACOES: false,
    ETF: false,
    TESOURO: false,
    STOCKS: false,
    FIIS: false,
    RENDA_FIXA: false,
    CRIPTO: false,
    CDI: false,
    IPCA: false,
    IBOV: false,
    SP500: false,
    NASDAQ: false,
    DOWJONES: false,
    IFIX: false,
  };

  // Baseline point at 0% before first month
  const timeSeries: ComputedTimeSeriesPoint[] = [];
  if (filtered.length > 0) {
    timeSeries.push({
      month: 'Início',
      label: '22/11/19',
      portfolioMonthlyPct: 0,
      portfolioAccumulatedPct: 0,
      cdiAccumulatedPct: 0,
      ipcaAccumulatedPct: 0,
      ibovAccumulatedPct: 0,
      sp500AccumulatedPct: 0,
      nasdaqAccumulatedPct: 0,
      dowJonesAccumulatedPct: 0,
      ifixAccumulatedPct: 0,
      usdAccumulatedPct: 0,
      ptax: filtered[0].ptax,
    });
  }

  let bestMonth = { month: '-', pct: -Infinity };
  let worstMonth = { month: '-', pct: Infinity };
  let positiveMonths = 0;
  let negativeMonths = 0;

  const monthlyComputed: Array<{
    row: MonthlyPerformanceRow;
    portPct: number;
    benchPct: number;
    accumulatedPct: number;
    catMonthly: Record<YoYCategoryKey, number | null>;
    catAccumulated: Record<YoYCategoryKey, number | null>;
  }> = [];

  for (const row of filtered) {
    const portPct = computeBlendedMonthlyReturn(row, config);

    // Benchmarks in selected currency
    const fxFactor = config.currency === 'USD' ? 1 + row.usdBrlPct / 100 : 1;
    const toCurr = (pctBrl: number) =>
      config.currency === 'USD'
        ? (((1 + pctBrl / 100) / fxFactor) - 1) * 100
        : pctBrl;

    const cdiM = toCurr(row.cdiPct);
    const ipcaM = toCurr(row.ipcaPct);
    const ibovM = toCurr(row.ibovPct);
    const sp500M = config.currency === 'USD' ? row.sp500UsdPct : row.sp500BrlPct;
    const nasdaqM =
      config.currency === 'USD'
        ? (row.nasdaqUsdPct ?? row.sp500UsdPct)
        : (row.nasdaqBrlPct ?? row.sp500BrlPct);
    const dowJonesM =
      config.currency === 'USD'
        ? (row.dowJonesUsdPct ?? row.sp500UsdPct)
        : (row.dowJonesBrlPct ?? row.sp500BrlPct);
    const ifixM = toCurr(row.ifixPct);
    const usdM = row.usdBrlPct;

    portFactor *= 1 + portPct / 100;
    cdiFactor *= 1 + cdiM / 100;
    ipcaFactor *= 1 + ipcaM / 100;
    ibovFactor *= 1 + ibovM / 100;
    sp500Factor *= 1 + sp500M / 100;
    nasdaqFactor *= 1 + nasdaqM / 100;
    dowJonesFactor *= 1 + dowJonesM / 100;
    ifixFactor *= 1 + ifixM / 100;
    usdFactor *= 1 + usdM / 100;

    const portAcc = Number(((portFactor - 1) * 100).toFixed(2));

    if (portPct >= 0) positiveMonths++;
    else negativeMonths++;

    if (portPct > bestMonth.pct) bestMonth = { month: row.month, pct: portPct };
    if (portPct < worstMonth.pct) worstMonth = { month: row.month, pct: portPct };

    const [y, m] = row.month.split('-');
    const label = `${m}/${y.slice(2)}`;

    timeSeries.push({
      month: row.month,
      label,
      portfolioMonthlyPct: portPct,
      portfolioAccumulatedPct: portAcc,
      cdiAccumulatedPct: Number(((cdiFactor - 1) * 100).toFixed(2)),
      ipcaAccumulatedPct: Number(((ipcaFactor - 1) * 100).toFixed(2)),
      ibovAccumulatedPct: Number(((ibovFactor - 1) * 100).toFixed(2)),
      sp500AccumulatedPct: Number(((sp500Factor - 1) * 100).toFixed(2)),
      nasdaqAccumulatedPct: Number(((nasdaqFactor - 1) * 100).toFixed(2)),
      dowJonesAccumulatedPct: Number(((dowJonesFactor - 1) * 100).toFixed(2)),
      ifixAccumulatedPct: Number(((ifixFactor - 1) * 100).toFixed(2)),
      usdAccumulatedPct: Number(((usdFactor - 1) * 100).toFixed(2)),
      ptax: row.ptax,
    });

    const benchPct =
      comparisonBenchmark === 'CDI'
        ? cdiM
        : comparisonBenchmark === 'IPCA'
          ? ipcaM
          : comparisonBenchmark === 'IBOV'
            ? ibovM
            : comparisonBenchmark === 'SP500'
              ? sp500M
              : comparisonBenchmark === 'NASDAQ'
                ? nasdaqM
                : comparisonBenchmark === 'DOWJONES'
                  ? dowJonesM
                  : ifixM;

    // Compute per-category monthly return (respecting inception dates for ETF, Tesouro, Stocks, Cripto)
    const etfActive = row.month >= '2023-05';
    const tesouroActive = row.month >= '2023-09';
    const stocksActive = row.month >= '2020-02';
    const criptoActive = row.month >= '2021-01';

    const rawCatValues: Record<YoYCategoryKey, number | null> = {
      CARTEIRA: portPct,
      ACOES: applyCurrencyAndDeflation(row.stocksBrPct, row, config, false),
      ETF: etfActive ? applyCurrencyAndDeflation(row.etfsUsPct, row, config, false) : null,
      TESOURO: tesouroActive
        ? applyCurrencyAndDeflation(row.tesouroPct ?? row.fixedIncomePct, row, config, false)
        : null,
      STOCKS: stocksActive ? applyCurrencyAndDeflation(row.stocksUsPct, row, config, false) : null,
      FIIS: applyCurrencyAndDeflation(row.fiisPct, row, config, false),
      RENDA_FIXA: applyCurrencyAndDeflation(row.fixedIncomePct, row, config, false),
      CRIPTO: criptoActive ? applyCurrencyAndDeflation(row.cryptoPct, row, config, false) : null,
      CDI: Number(cdiM.toFixed(2)),
      IPCA: Number(ipcaM.toFixed(2)),
      IBOV: Number(ibovM.toFixed(2)),
      SP500: Number(sp500M.toFixed(2)),
      NASDAQ: Number(nasdaqM.toFixed(2)),
      DOWJONES: Number(dowJonesM.toFixed(2)),
      IFIX: Number(ifixM.toFixed(2)),
    };

    const catMonthly = {} as Record<YoYCategoryKey, number | null>;
    const catAccumulated = {} as Record<YoYCategoryKey, number | null>;

    for (const key of ALL_YOY_CATEGORIES) {
      const val = rawCatValues[key];
      catMonthly[key] = val;
      if (val !== null) {
        catHasStarted[key] = true;
        catFactors[key] *= 1 + val / 100;
        catAccumulated[key] = Number(((catFactors[key] - 1) * 100).toFixed(2));
      } else {
        catAccumulated[key] = catHasStarted[key]
          ? Number(((catFactors[key] - 1) * 100).toFixed(2))
          : null;
      }
    }

    monthlyComputed.push({
      row,
      portPct,
      benchPct: Number(benchPct.toFixed(2)),
      accumulatedPct: portAcc,
      catMonthly,
      catAccumulated,
    });
  }

  // Compute trailing 6m, 12m, 24m growth
  const calcTrailing = (n: number) => {
    const slice = monthlyComputed.slice(-n);
    if (slice.length === 0) return 0;
    const f = slice.reduce((acc, item) => acc * (1 + item.portPct / 100), 1);
    return Number(((f - 1) * 100).toFixed(2));
  };

  const growth6m = calcTrailing(6);
  const growth12m = calcTrailing(12);
  const growth24m = calcTrailing(24);

  // Build Year-over-Year table (descending years like Status Invest)
  const yearsMap = new Map<number, YearOverYearRow>();
  for (const item of monthlyComputed) {
    const y = item.row.year;
    if (!yearsMap.has(y)) {
      const emptyCategories = {} as Record<YoYCategoryKey, YoYCategoryYearData>;
      for (const key of ALL_YOY_CATEGORIES) {
        emptyCategories[key] = {
          months: Array(12).fill(null),
          yearReturnPct: null,
          accumulatedPct: null,
        };
      }
      yearsMap.set(y, {
        year: y,
        months: Array(12).fill(null),
        benchMonths: Array(12).fill(null),
        yearReturnPct: 0,
        benchYearReturnPct: 0,
        accumulatedPct: 0,
        categories: emptyCategories,
      });
    }
    const yRow = yearsMap.get(y)!;
    const mIdx = item.row.monthIndex - 1;
    yRow.months[mIdx] = item.portPct;
    yRow.benchMonths[mIdx] = item.benchPct;
    yRow.accumulatedPct = item.accumulatedPct;

    for (const key of ALL_YOY_CATEGORIES) {
      yRow.categories[key].months[mIdx] = item.catMonthly[key];
      if (item.catAccumulated[key] !== null) {
        yRow.categories[key].accumulatedPct = item.catAccumulated[key];
      }
    }
  }

  for (const yRow of yearsMap.values()) {
    let yf = 1;
    let bf = 1;
    for (let i = 0; i < 12; i++) {
      if (yRow.months[i] !== null) yf *= 1 + (yRow.months[i] as number) / 100;
      if (yRow.benchMonths[i] !== null) bf *= 1 + (yRow.benchMonths[i] as number) / 100;
    }
    yRow.yearReturnPct = Number(((yf - 1) * 100).toFixed(2));
    yRow.benchYearReturnPct = Number(((bf - 1) * 100).toFixed(2));

    for (const key of ALL_YOY_CATEGORIES) {
      const catData = yRow.categories[key];
      let cf = 1;
      let hasAnyMonth = false;
      for (let i = 0; i < 12; i++) {
        if (catData.months[i] !== null) {
          hasAnyMonth = true;
          cf *= 1 + (catData.months[i] as number) / 100;
        }
      }
      catData.yearReturnPct = hasAnyMonth ? Number(((cf - 1) * 100).toFixed(2)) : null;
    }
  }

  const yoyTable = Array.from(yearsMap.values()).sort((a, b) => b.year - a.year);
  const currentAccumulatedPct = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].portfolioAccumulatedPct : 0;

  return {
    timeSeries,
    yoyTable,
    currentAccumulatedPct,
    periodAccumulatedPct: currentAccumulatedPct,
    growth6m,
    growth12m,
    growth24m,
    bestMonth,
    worstMonth,
    positiveMonths,
    negativeMonths,
    benchmarksFinal: {
      CDI: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].cdiAccumulatedPct : 0,
      IPCA: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ipcaAccumulatedPct : 0,
      IBOV: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ibovAccumulatedPct : 0,
      SP500: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].sp500AccumulatedPct : 0,
      NASDAQ: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].nasdaqAccumulatedPct : 0,
      DOWJONES: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].dowJonesAccumulatedPct : 0,
      IFIX: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].ifixAccumulatedPct : 0,
      USD: timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].usdAccumulatedPct : 0,
    },
  };
}

/**
 * Computes portfolio summary. Avenue leftovers ('fi-leftovers-avenue') are always included.
 */
export function computePortfolioSummary(
  holdings: Holding[],
  includeFgts: boolean
) {
  const activeHoldings = holdings.filter((h) => {
    if (!includeFgts && h.assetClass === 'FGTS') return false;
    return true;
  });

  const totalMarketBrl = activeHoldings.reduce((acc, h) => acc + h.marketValueBrl, 0);
  const totalInvestedBrl = activeHoldings.reduce((acc, h) => acc + h.investedBrl, 0);
  const totalDailyChangeBrl = activeHoldings.reduce((acc, h) => acc + h.dailyChangeBrl, 0);
  const totalDividendsBrl = activeHoldings.reduce((acc, h) => acc + h.dividendsBrl, 0);
  const totalOpenProfitBrl = activeHoldings.reduce((acc, h) => acc + h.openProfitBrl, 0);

  // Macro Group totals (excluding FGTS for allocation percentages)
  const nonFgts = holdings.filter((h) => h.assetClass !== 'FGTS');
  const nonFgtsTotalBrl = nonFgts.reduce((acc, h) => acc + h.marketValueBrl, 0);

  const byMacroGroup: Record<string, { marketBrl: number; investedBrl: number; profitBrl: number; dividendsBrl: number; sharePct: number }> = {};
  for (const h of nonFgts) {
    if (!byMacroGroup[h.macroGroup]) {
      byMacroGroup[h.macroGroup] = { marketBrl: 0, investedBrl: 0, profitBrl: 0, dividendsBrl: 0, sharePct: 0 };
    }
    byMacroGroup[h.macroGroup].marketBrl += h.marketValueBrl;
    byMacroGroup[h.macroGroup].investedBrl += h.investedBrl;
    byMacroGroup[h.macroGroup].profitBrl += h.openProfitBrl;
    byMacroGroup[h.macroGroup].dividendsBrl += h.dividendsBrl;
  }
  for (const key of Object.keys(byMacroGroup)) {
    byMacroGroup[key].sharePct = nonFgtsTotalBrl > 0 ? (byMacroGroup[key].marketBrl / nonFgtsTotalBrl) * 100 : 0;
  }

  // Risk analysis breakdown (including FGTS as Very low)
  const riskTotalBrl = holdings.reduce((acc, h) => acc + h.marketValueBrl, 0);
  const byRisk: Record<string, { marketBrl: number; sharePct: number }> = {
    'Very low': { marketBrl: 0, sharePct: 0 },
    'Low': { marketBrl: 0, sharePct: 0 },
    'Medium': { marketBrl: 0, sharePct: 0 },
    'High': { marketBrl: 0, sharePct: 0 },
  };
  for (const h of holdings) {
    byRisk[h.riskLevel].marketBrl += h.marketValueBrl;
  }
  for (const rKey of Object.keys(byRisk)) {
    byRisk[rKey].sharePct = riskTotalBrl > 0 ? (byRisk[rKey].marketBrl / riskTotalBrl) * 100 : 0;
  }

  return {
    totalMarketBrl,
    totalInvestedBrl,
    nonFgtsTotalBrl,
    withFgtsTotalBrl: riskTotalBrl,
    totalDailyChangeBrl,
    totalDividendsBrl,
    totalOpenProfitBrl,
    byMacroGroup,
    byRisk,
  };
}

/**
 * Automatically calculates the average monthly dividends over the latest 3 months
 * from INITIAL_DIVIDEND_MONTHLY_SERIES combined with any newly added user dividend events.
 */
export function computeLatest3mAvgDividendsBrl(recentDividends: DividendRecord[] = []): {
  avg3mBrl: number;
  latest3Months: Array<{ month: string; totalBrl: number }>;
} {
  const seedIds = new Set(INITIAL_RECENT_DIVIDENDS.map((d) => d.id));
  const monthMap = new Map<string, number>();

  for (const item of INITIAL_DIVIDEND_MONTHLY_SERIES) {
    monthMap.set(item.month, item.totalBrl);
  }

  // Include any user-added dividend events not already in the initial seed
  for (const div of recentDividends) {
    if (!seedIds.has(div.id) && div.date && div.date.length >= 7) {
      const m = div.date.slice(0, 7);
      monthMap.set(m, Number(((monthMap.get(m) ?? 0) + div.netValueBrl).toFixed(2)));
    }
  }

  const sortedMonths = Array.from(monthMap.entries())
    .map(([month, totalBrl]) => ({ month, totalBrl }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const latest3Months = sortedMonths.slice(-3);
  if (latest3Months.length === 0) {
    return { avg3mBrl: 0, latest3Months: [] };
  }

  const sum = latest3Months.reduce((acc, item) => acc + item.totalBrl, 0);
  const avg3mBrl = Number((sum / latest3Months.length).toFixed(2));

  return {
    avg3mBrl,
    latest3Months,
  };
}
