export type AssetClass =
  | 'FIXED_INCOME'
  | 'STOCKS_BR'
  | 'STOCKS_US'
  | 'ETFS_US'
  | 'FIIS'
  | 'CRYPTO'
  | 'PROTECTION'
  | 'FGTS';

export type RiskLevel = 'Very low' | 'Low' | 'Medium' | 'High';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  macroGroup: 'Cash on Hand' | 'Stocks (US)' | 'ETFs (US)' | 'Stocks (BRA)' | 'FIIs' | 'Cryptocurrency' | 'Protection' | 'FGTS';
  broker: string;
  quantity: number;
  avgPriceBrl: number;
  avgPriceAdjustedBrl?: number;
  currentPriceBrl: number;
  investedBrl: number;
  marketValueBrl: number;
  netValueBrl?: number;
  taxesAndFeesBrl?: number;
  dailyChangeBrl: number;
  dailyChangePct: number;
  openProfitBrl: number;
  openProfitPct: number;
  tradesProfitBrl: number;
  dividendsBrl: number;
  totalProfitBrl: number;
  tirMonthlyPct: number;
  tirAnnualPct: number;
  sector: string;
  subType?: string;
  riskLevel: RiskLevel;
  targetWeightInClassPct?: number;
  isManual?: boolean;
  automationSource?: 'BCB_CDI' | 'CVM_QUOTA' | 'TESOURO_DIRETO_PU' | 'YAHOO_FINANCE' | 'MANUAL';
  info: string;
}

export interface AllocationGoal {
  macroGroup: 'Cash on Hand' | 'Stocks (US)' | 'ETFs (US)' | 'Stocks (BRA)' | 'FIIs' | 'Cryptocurrency' | 'Protection';
  targetPct: number;
  currentBrl: number;
  currentPct: number;
  targetBrl: number;
  missingBrl: number;
}

export interface MonthlyPerformanceRow {
  month: string; // YYYY-MM
  year: number;
  monthIndex: number; // 1..12
  ptax: number;
  equitiesStatusInvestPct: number;
  fixedIncomePct: number;
  tesouroPct: number;
  stocksBrPct: number;
  stocksUsPct: number;
  etfsUsPct: number;
  fiisPct: number;
  cryptoPct: number;
  protectionPct: number;
  weights: {
    FIXED_INCOME: number;
    STOCKS_BR: number;
    STOCKS_US: number;
    ETFS_US: number;
    FIIS: number;
    CRYPTO: number;
    PROTECTION: number;
  };
  cdiPct: number;
  ipcaPct: number;
  ibovPct: number;
  sp500UsdPct: number;
  sp500BrlPct: number;
  nasdaqUsdPct: number;
  nasdaqBrlPct: number;
  dowJonesUsdPct: number;
  dowJonesBrlPct: number;
  ifixPct: number;
  usdBrlPct: number;
}

export interface FixedIncomeSubTranche {
  id: string;
  label: string;
  depositDate: string;
  appliedBrl: number;
  grossValueBrl: number;
  netValueBrl: number;
  taxBrl: number;
  irAliquotPct: number;
  cdiMultiplierPct: number;
  maturityDate?: string;
  notes?: string;
}

export interface FixedIncomeProductSummary {
  id: string;
  holdingId: string;
  name: string;
  issuer: string;
  indexer: string;
  automationType: 'BCB_CDI' | 'CVM_QUOTA' | 'TESOURO_DIRETO';
  automationIdentifier: string; // e.g. '100% CDI', '42.699.466/0001-77', 'Tesouro IPCA+ 15/05/2029'
  cdiPct?: number;
  cvmCnpj?: string;
  fundQuotas?: number;
  lastQuotaValue?: number;
  lastQuotaDate?: string;
  tesouroBondType?: string;
  tesouroMaturity?: string;
  tesouroTitlesQty?: number;
  lastTesouroPu?: number;
  lastTesouroDate?: string;
  initialDepositBrl: number;
  totalInvestedBrl: number;
  marketValueBrl: number; // Gross Value (Valor Bruto)
  taxesAndFeesBrl: number; // Impostos (IR) + Taxa B3
  netValueBrl: number;     // Net Value (Valor Líquido)
  absoluteProfitBrl: number;
  rentabilityPct: number;
  startDate: string;
  expirationDate?: string;
  taxAliquotPct?: number;
  grossUpCdiPct?: number;
  riskLevel: RiskLevel;
  subTranches?: FixedIncomeSubTranche[];
  rulesNotes?: string;
  status?: 'ACTIVE' | 'WITHDRAWN';
  withdrawnMonth?: string;
  monthlyHistory: {
    month: string; // YYYY-MM
    depositWithdrawalBrl: number;
    marketValueBrl: number;
    monthlyReturnPct: number;
    accumulatedReturnPct: number;
  }[];
}

export interface TransactionRecord {
  id: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  event: 'C' | 'V' | 'SUB' | 'BN' | 'S/I' | 'AT' | 'SALDO';
  quantity: number;
  price: number;
  fees: number;
  broker: string;
  currency: 'BRL' | 'USD';
  assetClass: string;
  volumeBrl: number;
  profitBrl: number;
  profitPct: number;
  cashFlowBrl: number;
  ptax: number;
  notes?: string;
}

export interface DividendRecord {
  id: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  type: 'DIVIDENDO' | 'JSCP';
  netValueBrl: number;
  grossValueBrl: number;
  irrfBrl: number;
  broker: string;
  assetClass: 'FII' | 'AÇÃO' | 'STOCK' | 'ETF_US';
}

export interface ForexPurchase {
  id: string;
  currency: 'USD' | 'GBP' | 'EUR' | 'CHF';
  date: string;
  amountForeign: number;
  exchangeRate: number;
  taxBrl: number;
  note?: string;
}

export interface LifeGoalRow {
  age: number;
  year: number;
  goalBrl: number;
  patrimonyBrl: number | null;
  statusPct: number;
  yoyVarPct: number | null;
}

export interface MarketIndicator {
  ticker: string;
  name: string;
  category: 'Index' | 'Currency' | 'Crypto' | 'Commodity';
  value: number;
  currency: 'PTS' | 'BRL' | 'USD';
  dayChangePct: number;
  ytdChangePct: number;
}
