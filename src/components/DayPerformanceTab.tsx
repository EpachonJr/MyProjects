import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUpDown,
  Filter,
  DollarSign,
  Activity,
  Zap,
} from 'lucide-react';
import { AssetClass, Holding } from '../types/portfolio';
import { CurrencyMode, formatCurrency, formatPct } from '../utils/calculations';

interface DayPerformanceTabProps {
  holdings: Holding[];
  ptax: number;
  currency: CurrencyMode;
  hideValues: boolean;
  onRefreshQuotes: () => Promise<void>;
  isSyncing: boolean;
  lastUpdated: string | null;
}

type SubView = 'PORTFOLIOS' | 'HOLDINGS';

interface PortfolioGroupDef {
  id: string;
  name: string;
  subTitle?: string;
  filterFn: (h: Holding) => boolean;
}

const PORTFOLIO_GROUPS: PortfolioGroupDef[] = [
  {
    id: 'etfs_usa',
    name: 'ETFs (USA)',
    subTitle: 'ETFs Internacionais & S&P 500',
    filterFn: (h) => h.assetClass === 'ETFS_US',
  },
  {
    id: 'real_estate_bra',
    name: 'Real State (BRA)',
    subTitle: 'Fundos Imobiliários (FIIs)',
    filterFn: (h) => h.assetClass === 'FIIS',
  },
  {
    id: 'crypto',
    name: 'Crypto',
    subTitle: 'Criptomoedas',
    filterFn: (h) => h.assetClass === 'CRYPTO',
  },
  {
    id: 'protection',
    name: 'Protection',
    subTitle: 'Ouro (IAU)',
    filterFn: (h) => h.assetClass === 'PROTECTION' && h.ticker === 'IAU',
  },
  {
    id: 'stocks_bra',
    name: 'Stocks (BRA)',
    subTitle: 'Ações Brasil (B3)',
    filterFn: (h) => h.assetClass === 'STOCKS_BR',
  },
  {
    id: 'stocks_usa',
    name: 'Stocks (USA)',
    subTitle: 'Ações Americanas (NYSE & NASDAQ)',
    filterFn: (h) => h.assetClass === 'STOCKS_US',
  },
];

function getMarketStatus(): { b3Open: boolean; usOpen: boolean } {
  const now = new Date();
  const day = now.getDay();
  // Weekend
  if (day === 0 || day === 6) {
    return { b3Open: false, usOpen: false };
  }
  // Convert to Brasília time minutes
  // B3: 10:00 to 17:00 BRT
  const brtHours = (now.getUTCHours() - 3 + 24) % 24;
  const brtMinutes = brtHours * 60 + now.getUTCMinutes();

  const b3Open = brtMinutes >= 10 * 60 && brtMinutes <= 17 * 60;
  // US markets: 10:30 to 17:00 BRT
  const usOpen = brtMinutes >= 10 * 60 + 30 && brtMinutes <= 17 * 60;

  return { b3Open, usOpen };
}

export type HoldingsSortColumn =
  | 'ticker'
  | 'class'
  | 'quantity'
  | 'currentPrice'
  | 'dailyPct'
  | 'dailyBrl'
  | 'marketValue'
  | 'invested'
  | 'totalReturnPct'
  | 'openProfitBrl'
  | 'openProfitPct';

export type PortfoliosSortColumn =
  | 'name'
  | 'symbolsCount'
  | 'costBasis'
  | 'marketValue'
  | 'dayChangeBrl'
  | 'dayChangePct'
  | 'totalReturnPct'
  | 'unrealizedGainBrl'
  | 'realizedGainBrl';

export function getHoldingTotalReturnPct(h: Holding): number {
  if (h.investedBrl > 0 && typeof h.totalProfitBrl === 'number') {
    return (h.totalProfitBrl / h.investedBrl) * 100;
  }
  if (typeof h.openProfitPct === 'number' && !isNaN(h.openProfitPct) && h.openProfitPct !== 0) {
    return h.openProfitPct;
  }
  if (h.investedBrl > 0) {
    return (h.openProfitBrl / h.investedBrl) * 100;
  }
  return 0;
}

export function getHoldingOpenReturnPct(h: Holding): number {
  if (typeof h.openProfitPct === 'number' && !isNaN(h.openProfitPct)) {
    return h.openProfitPct;
  }
  if (h.investedBrl > 0) {
    return (h.openProfitBrl / h.investedBrl) * 100;
  }
  return 0;
}

export const DayPerformanceTab: React.FC<DayPerformanceTabProps> = ({
  holdings,
  ptax,
  currency,
  hideValues,
  onRefreshQuotes,
  isSyncing,
  lastUpdated,
}) => {
  const [subView, setSubView] = useState<SubView>('PORTFOLIOS');
  const [expandedPortfolio, setExpandedPortfolio] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'ALL' | AssetClass>('ALL');
  const [sortBy, setSortBy] = useState<HoldingsSortColumn>('dailyPct');
  const [sortDesc, setSortDesc] = useState(true);
  const [portSortBy, setPortSortBy] = useState<PortfoliosSortColumn>('marketValue');
  const [portSortDesc, setPortSortDesc] = useState(true);

  const { b3Open, usOpen } = useMemo(() => getMarketStatus(), []);

  // Filter only tradeable assets for daily monitoring (ex-FGTS and ex-cash)
  const tradeableHoldings = useMemo(
    () =>
      holdings.filter(
        (h) =>
          ['STOCKS_BR', 'STOCKS_US', 'ETFS_US', 'FIIS', 'CRYPTO', 'PROTECTION'].includes(h.assetClass) &&
          !h.isManual &&
          h.ticker !== 'FGTS' &&
          !['USD', 'EUR', 'GBP', 'CHF'].includes(h.ticker)
      ),
    [holdings]
  );

  // Overall Day KPI Metrics
  const metrics = useMemo(() => {
    let totalDayChangeBrl = 0;
    let totalMarketValueBrl = 0;
    let totalCostBasisBrl = 0;
    let totalUnrealizedGainBrl = 0;
    let totalRealizedGainBrl = 0;

    let topGainer: Holding | null = null;
    let topLoser: Holding | null = null;

    for (const h of tradeableHoldings) {
      totalDayChangeBrl += h.dailyChangeBrl || 0;
      totalMarketValueBrl += h.marketValueBrl || 0;
      totalCostBasisBrl += h.investedBrl || 0;
      totalUnrealizedGainBrl += h.openProfitBrl || 0;
      totalRealizedGainBrl += h.tradesProfitBrl || 0;

      const changePct = h.dailyChangePct ?? 0;
      if (!topGainer || changePct > (topGainer.dailyChangePct ?? -999)) {
        topGainer = h;
      }
      if (!topLoser || changePct < (topLoser.dailyChangePct ?? 999)) {
        topLoser = h;
      }
    }

    const prevDayMarketValue = totalMarketValueBrl - totalDayChangeBrl;
    const totalDayChangePct =
      prevDayMarketValue > 0 ? (totalDayChangeBrl / prevDayMarketValue) * 100 : 0;
    const totalUnrealizedPct =
      totalCostBasisBrl > 0 ? (totalUnrealizedGainBrl / totalCostBasisBrl) * 100 : 0;

    return {
      totalDayChangeBrl,
      totalDayChangePct,
      totalMarketValueBrl,
      totalCostBasisBrl,
      totalUnrealizedGainBrl,
      totalUnrealizedPct,
      totalRealizedGainBrl,
      topGainer,
      topLoser,
    };
  }, [tradeableHoldings]);

  // Portfolios Groups computation (exactly matching the Yahoo Finance layout)
  const portfolioSummaries = useMemo(() => {
    const list = PORTFOLIO_GROUPS.map((group) => {
      const items = tradeableHoldings.filter(group.filterFn);
      const symbolsCount = items.length;

      let costBasis = 0;
      let marketValue = 0;
      let dayChangeBrl = 0;
      let unrealizedGainBrl = 0;
      let realizedGainBrl = 0;

      for (const item of items) {
        costBasis += item.investedBrl || 0;
        marketValue += item.marketValueBrl || 0;
        dayChangeBrl += item.dailyChangeBrl || 0;
        unrealizedGainBrl += item.openProfitBrl || 0;
        realizedGainBrl += item.tradesProfitBrl || 0;
      }

      const prevMarket = marketValue - dayChangeBrl;
      const dayChangePct = prevMarket > 0 ? (dayChangeBrl / prevMarket) * 100 : 0;
      const unrealizedPct = costBasis > 0 ? (unrealizedGainBrl / costBasis) * 100 : 0;
      const realizedPct = costBasis > 0 ? (realizedGainBrl / costBasis) * 100 : 0;
      const totalReturnPct =
        costBasis > 0 ? ((unrealizedGainBrl + realizedGainBrl) / costBasis) * 100 : unrealizedPct;

      return {
        ...group,
        items,
        symbolsCount,
        costBasis,
        marketValue,
        dayChangeBrl,
        dayChangePct,
        unrealizedGainBrl,
        unrealizedPct,
        realizedGainBrl,
        realizedPct,
        totalReturnPct,
      };
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (portSortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'symbolsCount':
          cmp = a.symbolsCount - b.symbolsCount;
          break;
        case 'costBasis':
          cmp = a.costBasis - b.costBasis;
          break;
        case 'marketValue':
          cmp = a.marketValue - b.marketValue;
          break;
        case 'dayChangeBrl':
          cmp = a.dayChangeBrl - b.dayChangeBrl;
          break;
        case 'dayChangePct':
          cmp = a.dayChangePct - b.dayChangePct;
          break;
        case 'totalReturnPct':
          cmp = a.totalReturnPct - b.totalReturnPct;
          break;
        case 'unrealizedGainBrl':
          cmp = a.unrealizedGainBrl - b.unrealizedGainBrl;
          break;
        case 'realizedGainBrl':
          cmp = a.realizedGainBrl - b.realizedGainBrl;
          break;
      }
      return portSortDesc ? -cmp : cmp;
    });
  }, [tradeableHoldings, portSortBy, portSortDesc]);

  const togglePortSort = (col: PortfoliosSortColumn) => {
    if (portSortBy === col) {
      setPortSortDesc(!portSortDesc);
    } else {
      setPortSortBy(col);
      setPortSortDesc(col !== 'name');
    }
  };

  // Filtered and Sorted Individual Holdings for "My Holdings" tab
  const filteredHoldings = useMemo(() => {
    let result = tradeableHoldings;

    if (classFilter !== 'ALL') {
      result = result.filter((h) => h.assetClass === classFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'ticker':
          cmp = a.ticker.localeCompare(b.ticker);
          break;
        case 'class':
          cmp = (a.macroGroup || a.assetClass).localeCompare(b.macroGroup || b.assetClass);
          break;
        case 'quantity':
          cmp = (a.quantity ?? 0) - (b.quantity ?? 0);
          break;
        case 'currentPrice':
          cmp = (a.currentPriceBrl ?? 0) - (b.currentPriceBrl ?? 0);
          break;
        case 'dailyPct':
          cmp = (a.dailyChangePct ?? 0) - (b.dailyChangePct ?? 0);
          break;
        case 'dailyBrl':
          cmp = (a.dailyChangeBrl ?? 0) - (b.dailyChangeBrl ?? 0);
          break;
        case 'marketValue':
          cmp = a.marketValueBrl - b.marketValueBrl;
          break;
        case 'invested':
          cmp = a.investedBrl - b.investedBrl;
          break;
        case 'totalReturnPct':
          cmp = getHoldingTotalReturnPct(a) - getHoldingTotalReturnPct(b);
          break;
        case 'openProfitPct':
          cmp = getHoldingOpenReturnPct(a) - getHoldingOpenReturnPct(b);
          break;
        case 'openProfitBrl':
        default:
          cmp = (a.openProfitBrl ?? 0) - (b.openProfitBrl ?? 0);
          break;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [tradeableHoldings, classFilter, searchQuery, sortBy, sortDesc]);

  const toggleSort = (col: HoldingsSortColumn) => {
    if (sortBy === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(col);
      // Alphabetical columns default to ascending (A-Z), financial metrics default to descending (highest first)
      setSortDesc(col !== 'ticker' && col !== 'class');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Bar: Sub-tabs (My Portfolios / My Holdings) + Live Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161920] p-2 sm:p-2.5 rounded-2xl border border-[#2b303b]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSubView('PORTFOLIOS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              subView === 'PORTFOLIOS'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            My Portfolios
          </button>
          <button
            onClick={() => setSubView('HOLDINGS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              subView === 'HOLDINGS'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            My Holdings
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {tradeableHoldings.length}
            </span>
          </button>
        </div>

        {/* Market Status Badges + Instant Quote Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Market status indicators */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium bg-[#111317] px-3 py-1.5 rounded-xl border border-[#2b303b]">
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  b3Open ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="text-slate-400">B3:</span>
              <span className={b3Open ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {b3Open ? 'Aberta' : 'Fechada'}
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  usOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="text-slate-400">NYSE:</span>
              <span className={usOpen ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {usOpen ? 'Aberta' : 'Fechada'}
              </span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Cripto:</span>
              <span className="text-emerald-400 font-bold">24/7</span>
            </span>
          </div>

          <button
            onClick={onRefreshQuotes}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50"
            title="Atualizar cotações do dia em tempo real via Yahoo Finance & BCB"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Atualizando...' : 'Atualizar Cotações'}
          </button>
        </div>
      </div>

      {/* KPI Cards Strip: Total Day Change, Top Gainer, Top Loser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Day Change */}
        <div className="bg-[#161920] p-4 rounded-2xl border border-[#2b303b] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Variação do Dia
            </span>
            <div
              className={`p-1.5 rounded-lg ${
                metrics.totalDayChangeBrl >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {metrics.totalDayChangeBrl >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-xl sm:text-2xl font-extrabold ${
                metrics.totalDayChangeBrl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.totalDayChangeBrl >= 0 ? '+' : ''}
              {formatCurrency(metrics.totalDayChangeBrl, currency, ptax, hideValues)}
            </div>
            <div
              className={`text-xs font-bold mt-0.5 ${
                metrics.totalDayChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {metrics.totalDayChangePct >= 0 ? '+' : ''}
              {metrics.totalDayChangePct.toFixed(2)}% hoje
            </div>
          </div>
        </div>

        {/* Top Gainer */}
        <div className="bg-[#161920] p-4 rounded-2xl border border-[#2b303b]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Maior Alta do Dia
            </span>
            <span className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">
              🚀 Top Alta
            </span>
          </div>
          <div className="mt-2">
            {metrics.topGainer ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-white">{metrics.topGainer.ticker}</span>
                  <span className="text-xs font-bold text-emerald-400">
                    +{metrics.topGainer.dailyChangePct?.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {metrics.topGainer.name} • +
                  {formatCurrency(
                    metrics.topGainer.dailyChangeBrl || 0,
                    currency,
                    ptax,
                    hideValues
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-500">Sem dados</span>
            )}
          </div>
        </div>

        {/* Top Loser */}
        <div className="bg-[#161920] p-4 rounded-2xl border border-[#2b303b]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Maior Baixa do Dia
            </span>
            <span className="p-1 rounded-md bg-rose-500/15 text-rose-400 text-[11px] font-bold">
              🔻 Top Baixa
            </span>
          </div>
          <div className="mt-2">
            {metrics.topLoser ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-white">{metrics.topLoser.ticker}</span>
                  <span className="text-xs font-bold text-rose-400">
                    {metrics.topLoser.dailyChangePct?.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {metrics.topLoser.name} •{' '}
                  {formatCurrency(
                    metrics.topLoser.dailyChangeBrl || 0,
                    currency,
                    ptax,
                    hideValues
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-500">Sem dados</span>
            )}
          </div>
        </div>

        {/* Monitored Total Market Value */}
        <div className="bg-[#161920] p-4 rounded-2xl border border-[#2b303b]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Valor sob Monitoramento
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-white">
              {formatCurrency(metrics.totalMarketValueBrl, currency, ptax, hideValues)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {tradeableHoldings.length} ativos acompanhados
            </div>
          </div>
        </div>
      </div>

      {/* VIEW 1: MY PORTFOLIOS (Exact reproduction of Yahoo Finance layout) */}
      {subView === 'PORTFOLIOS' && (
        <div className="bg-[#161920] rounded-2xl border border-[#2b303b] overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-[#2b303b] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Performance por Portfólio / Classe
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Visão consolidada por grupo com variação do dia, lucro não realizado e lucro realizado.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium bg-[#111317] px-3 py-1 rounded-lg border border-[#2b303b]">
              Clique em qualquer linha para ver os ativos individuais
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#12141a] text-slate-400 border-b border-[#2b303b]">
                  <th
                    onClick={() => togglePortSort('name')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      portSortBy === 'name' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      Portfolio Name
                      {portSortBy === 'name' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('symbolsCount')}
                    className={`py-3.5 px-3 font-bold uppercase tracking-wider text-center cursor-pointer transition-colors ${
                      portSortBy === 'symbolsCount' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      Symbols
                      {portSortBy === 'symbolsCount' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('costBasis')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'costBasis' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <div>
                        Cost Basis <span className="text-[10px] font-normal text-slate-500 italic block">Includes cash</span>
                      </div>
                      {portSortBy === 'costBasis' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('marketValue')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'marketValue' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <div>
                        Market Value <span className="text-[10px] font-normal text-slate-500 italic block">Includes cash</span>
                      </div>
                      {portSortBy === 'marketValue' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('dayChangeBrl')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'dayChangeBrl' || portSortBy === 'dayChangePct' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Day Change
                      {portSortBy === 'dayChangeBrl' || portSortBy === 'dayChangePct' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('totalReturnPct')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'totalReturnPct' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-amber-300">Rentab. Total (%)</span>
                      {portSortBy === 'totalReturnPct' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-amber-400/70" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('unrealizedGainBrl')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'unrealizedGainBrl' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Unrealized Gain/Loss
                      {portSortBy === 'unrealizedGainBrl' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => togglePortSort('realizedGainBrl')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      portSortBy === 'realizedGainBrl' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Realized Gain/Loss
                      {portSortBy === 'realizedGainBrl' ? (
                        portSortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232732]">
                {portfolioSummaries.map((p) => {
                  const isExpanded = expandedPortfolio === p.id;
                  const dayPositive = p.dayChangeBrl >= 0;
                  const unrlPositive = p.unrealizedGainBrl >= 0;
                  const rlPositive = p.realizedGainBrl >= 0;
                  const totRetPositive = p.totalReturnPct >= 0;

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={() => setExpandedPortfolio(isExpanded ? null : p.id)}
                        className={`hover:bg-[#1b1e26] cursor-pointer transition-colors ${
                          isExpanded ? 'bg-[#1b1e26]/70' : ''
                        }`}
                      >
                        {/* Portfolio Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-600 hover:text-white transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-amber-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-[#212530] border border-[#2b303b] flex items-center justify-center text-slate-300">
                              <Briefcase className="w-4 h-4 text-amber-400" />
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-white">{p.name}</div>
                              {p.subTitle && (
                                <div className="text-[11px] text-slate-400">{p.subTitle}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Symbols Count */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-300">
                          {p.symbolsCount}
                        </td>

                        {/* Cost Basis */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-300">
                          {formatCurrency(p.costBasis, currency, ptax, hideValues)}
                        </td>

                        {/* Market Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white text-[13px]">
                          {formatCurrency(p.marketValue, currency, ptax, hideValues)}
                        </td>

                        {/* Day Change (R$ and %) */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className={`font-mono font-extrabold text-[13px] ${
                              dayPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {dayPositive ? '+' : ''}
                            {formatCurrency(p.dayChangeBrl, currency, ptax, hideValues)}
                          </div>
                          <div
                            className={`text-[11px] font-bold ${
                              dayPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {dayPositive ? '+' : ''}
                            {p.dayChangePct.toFixed(2)}%
                          </div>
                        </td>

                        {/* Rentabilidade Total (%) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end">
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-black shadow-sm ${
                                totRetPositive
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {totRetPositive ? '+' : ''}
                              {p.totalReturnPct.toFixed(2)}%
                            </span>
                          </div>
                        </td>

                        {/* Unrealized Gain/Loss */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className={`font-mono font-extrabold ${
                              unrlPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {unrlPositive ? '+' : ''}
                            {formatCurrency(p.unrealizedGainBrl, currency, ptax, hideValues)}
                          </div>
                          <div
                            className={`text-[11px] font-bold ${
                              unrlPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {unrlPositive ? '+' : ''}
                            {p.unrealizedPct.toFixed(2)}%
                          </div>
                        </td>

                        {/* Realized Gain/Loss */}
                        <td className="py-3.5 px-4 text-right">
                          {p.realizedGainBrl !== 0 ? (
                            <>
                              <div
                                className={`font-mono font-extrabold ${
                                  rlPositive ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {rlPositive ? '+' : ''}
                                {formatCurrency(p.realizedGainBrl, currency, ptax, hideValues)}
                              </div>
                              <div
                                className={`text-[11px] font-bold ${
                                  rlPositive ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {rlPositive ? '+' : ''}
                                {p.realizedPct.toFixed(2)}%
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-600 font-mono font-bold">--</span>
                          )}
                        </td>

                        {/* Action Dots */}
                        <td className="py-3.5 px-3 text-center text-slate-500">
                          <span className="text-lg leading-none font-bold">•••</span>
                        </td>
                      </tr>

                      {/* Accordion / Expanded Assets of this Portfolio */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0 bg-[#12141a]">
                            <div className="p-4 border-y border-[#2b303b]/60">
                              <div className="flex items-center justify-between mb-2.5 px-2">
                                <span className="text-xs font-bold text-slate-300">
                                  Ativos em {p.name} ({p.items.length})
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Variação acumulada do grupo: {p.dayChangePct >= 0 ? '+' : ''}
                                  {p.dayChangePct.toFixed(2)}%
                                </span>
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-[#2b303b]">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                  <thead className="bg-[#191c24] text-slate-400 border-b border-[#2b303b]">
                                    <tr>
                                      <th className="py-2.5 px-3 font-bold uppercase">Símbolo</th>
                                      <th className="py-2.5 px-3 font-bold uppercase">Nome</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Qtd</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Preço</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Variação Dia (R$)</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Variação Dia (%)</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Valor Mercado</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right text-amber-300">Rentab. Total (%)</th>
                                      <th className="py-2.5 px-3 font-bold uppercase text-right">Lucro Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#232732] bg-[#14161d]">
                                    {p.items.map((it) => {
                                      const itDayPos = (it.dailyChangeBrl ?? 0) >= 0;
                                      const itProfPos = (it.openProfitBrl ?? 0) >= 0;
                                      const itTotRetPct = getHoldingTotalReturnPct(it);
                                      const itTotRetPos = itTotRetPct >= 0;
                                      return (
                                        <tr key={it.id} className="hover:bg-[#1c202a]">
                                          <td className="py-2.5 px-3 font-extrabold text-amber-400">
                                            {it.ticker}
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-300 max-w-[180px] truncate">
                                            {it.name}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                            {it.quantity}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                            {formatCurrency(it.currentPriceBrl, currency, ptax, hideValues)}
                                          </td>
                                          <td
                                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                                              itDayPos ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                          >
                                            {itDayPos ? '+' : ''}
                                            {formatCurrency(it.dailyChangeBrl ?? 0, currency, ptax, hideValues)}
                                          </td>
                                          <td
                                            className={`py-2.5 px-3 text-right font-bold ${
                                              itDayPos ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                          >
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                                itDayPos
                                                  ? 'bg-emerald-500/10 text-emerald-400'
                                                  : 'bg-rose-500/10 text-rose-400'
                                              }`}
                                            >
                                              {itDayPos ? '+' : ''}
                                              {(it.dailyChangePct ?? 0).toFixed(2)}%
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                            {formatCurrency(it.marketValueBrl, currency, ptax, hideValues)}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-bold">
                                            <span
                                              className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black ${
                                                itTotRetPos
                                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                              }`}
                                            >
                                              {itTotRetPos ? '+' : ''}
                                              {itTotRetPct.toFixed(2)}%
                                            </span>
                                          </td>
                                          <td
                                            className={`py-2.5 px-3 text-right font-mono font-bold ${
                                              itProfPos ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                          >
                                            {itProfPos ? '+' : ''}
                                            {formatCurrency(it.openProfitBrl, currency, ptax, hideValues)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: MY HOLDINGS (Individual Stocks, FIIs, ETFs & Crypto with live performance) */}
      {subView === 'HOLDINGS' && (
        <div className="bg-[#161920] rounded-2xl border border-[#2b303b] overflow-hidden shadow-xl space-y-4 p-4 sm:p-5">
          {/* Top Control Bar: Filter Chips + Search Input */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Todos', count: tradeableHoldings.length },
                {
                  id: 'STOCKS_BR',
                  label: 'Ações BR',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'STOCKS_BR').length,
                },
                {
                  id: 'STOCKS_US',
                  label: 'Ações US',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'STOCKS_US').length,
                },
                {
                  id: 'ETFS_US',
                  label: 'ETFs US',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'ETFS_US').length,
                },
                {
                  id: 'FIIS',
                  label: 'FIIs',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'FIIS').length,
                },
                {
                  id: 'CRYPTO',
                  label: 'Cripto',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'CRYPTO').length,
                },
                {
                  id: 'PROTECTION',
                  label: 'Proteção',
                  count: tradeableHoldings.filter((h) => h.assetClass === 'PROTECTION').length,
                },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setClassFilter(chip.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    classFilter === chip.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-[#111317] text-slate-400 hover:text-white border border-[#2b303b]'
                  }`}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar ativo ou ticker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111317] border border-[#2b303b] text-slate-200 placeholder-slate-500 text-xs rounded-xl pl-9 pr-3 py-1.5 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Quick-Sort Presets Strip */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#232732]/60">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              Ordenar por:
            </span>
            {[
              {
                id: 'totRet-desc',
                label: '🔥 Maior Rentabilidade Total',
                col: 'totalReturnPct' as HoldingsSortColumn,
                desc: true,
              },
              {
                id: 'totRet-asc',
                label: '🔻 Menor Rentabilidade Total',
                col: 'totalReturnPct' as HoldingsSortColumn,
                desc: false,
              },
              {
                id: 'day-desc',
                label: '🚀 Maior Alta do Dia',
                col: 'dailyPct' as HoldingsSortColumn,
                desc: true,
              },
              {
                id: 'day-asc',
                label: '📉 Maior Baixa do Dia',
                col: 'dailyPct' as HoldingsSortColumn,
                desc: false,
              },
              {
                id: 'mkt-desc',
                label: '💰 Maior Valor de Mercado',
                col: 'marketValue' as HoldingsSortColumn,
                desc: true,
              },
              {
                id: 'prof-desc',
                label: '💵 Maior Lucro R$',
                col: 'openProfitBrl' as HoldingsSortColumn,
                desc: true,
              },
            ].map((pill) => {
              const isPillActive = sortBy === pill.col && sortDesc === pill.desc;
              return (
                <button
                  key={pill.id}
                  onClick={() => {
                    setSortBy(pill.col);
                    setSortDesc(pill.desc);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isPillActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-[#111317] text-slate-400 hover:text-white hover:bg-slate-800/60 border border-[#2b303b]'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Holdings Table with All Columns Sortable */}
          <div className="overflow-x-auto rounded-xl border border-[#2b303b]">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#12141a] text-slate-400 border-b border-[#2b303b]">
                  {/* Símbolo & Ativo */}
                  <th
                    onClick={() => toggleSort('ticker')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      sortBy === 'ticker' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Símbolo"
                  >
                    <div className="flex items-center gap-1.5">
                      Símbolo & Ativo
                      {sortBy === 'ticker' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Classe */}
                  <th
                    onClick={() => toggleSort('class')}
                    className={`py-3.5 px-3 font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      sortBy === 'class' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Classe de Ativo"
                  >
                    <div className="flex items-center gap-1.5">
                      Classe
                      {sortBy === 'class' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Qtd */}
                  <th
                    onClick={() => toggleSort('quantity')}
                    className={`py-3.5 px-3 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'quantity' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Quantidade de Cotas"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Qtd
                      {sortBy === 'quantity' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Preço Atual */}
                  <th
                    onClick={() => toggleSort('currentPrice')}
                    className={`py-3.5 px-3 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'currentPrice' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Preço Unitário"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Preço Atual
                      {sortBy === 'currentPrice' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Variação do Dia */}
                  <th
                    onClick={() => toggleSort('dailyPct')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'dailyPct' || sortBy === 'dailyBrl' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Variação do Dia"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Variação do Dia
                      {sortBy === 'dailyPct' || sortBy === 'dailyBrl' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Valor de Mercado */}
                  <th
                    onClick={() => toggleSort('marketValue')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'marketValue' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Valor de Mercado Total"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Valor de Mercado
                      {sortBy === 'marketValue' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Custo Total */}
                  <th
                    onClick={() => toggleSort('invested')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'invested' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Custo Total Investido"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Custo Total
                      {sortBy === 'invested' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>

                  {/* Rentabilidade Total (%) - REQUESTED COLUMN */}
                  <th
                    onClick={() => toggleSort('totalReturnPct')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'totalReturnPct' || sortBy === 'openProfitPct'
                        ? 'text-amber-400 bg-[#161a22]'
                        : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Rentabilidade Percentual Total do Ativo (Maior retorno para Menor)"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-amber-300">Rentabilidade Total (%)</span>
                      {sortBy === 'totalReturnPct' || sortBy === 'openProfitPct' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-amber-400/70" />
                      )}
                    </div>
                  </th>

                  {/* Lucro Total R$ */}
                  <th
                    onClick={() => toggleSort('openProfitBrl')}
                    className={`py-3.5 px-4 font-bold uppercase tracking-wider text-right cursor-pointer transition-colors ${
                      sortBy === 'openProfitBrl' ? 'text-amber-400 bg-[#161a22]' : 'hover:text-white'
                    }`}
                    title="Clique para ordenar por Lucro Total em R$"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Lucro Total (R$)
                      {sortBy === 'openProfitBrl' ? (
                        sortDesc ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232732] bg-[#161920]">
                {filteredHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Nenhum ativo encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredHoldings.map((h) => {
                    const dayPositive = (h.dailyChangeBrl ?? 0) >= 0;
                    const totProfitVal = h.totalProfitBrl ?? h.openProfitBrl ?? 0;
                    const totProfitPositive = totProfitVal >= 0;
                    const totalReturnPct = getHoldingTotalReturnPct(h);
                    const totalReturnPositive = totalReturnPct >= 0;
                    const openReturnPct = getHoldingOpenReturnPct(h);

                    return (
                      <tr key={h.id} className="hover:bg-[#1b1e26] transition-colors">
                        {/* Ticker & Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#212530] border border-[#2b303b] flex items-center justify-center font-extrabold text-xs text-amber-400">
                              {h.ticker.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm">{h.ticker}</div>
                              <div className="text-[11px] text-slate-400 max-w-[200px] truncate">
                                {h.name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#111317] border border-[#2b303b] text-slate-300">
                            {h.macroGroup || h.assetClass}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-300">
                          {h.quantity}
                        </td>

                        {/* Current Price */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-200">
                          {formatCurrency(h.currentPriceBrl, currency, ptax, hideValues)}
                        </td>

                        {/* Day Change (R$ and %) */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className={`font-mono font-extrabold text-sm ${
                              dayPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {dayPositive ? '+' : ''}
                            {formatCurrency(h.dailyChangeBrl ?? 0, currency, ptax, hideValues)}
                          </div>
                          <div className="mt-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                dayPositive
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {dayPositive ? '+' : ''}
                              {(h.dailyChangePct ?? 0).toFixed(2)}%
                            </span>
                          </div>
                        </td>

                        {/* Market Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-white text-[13px]">
                          {formatCurrency(h.marketValueBrl, currency, ptax, hideValues)}
                        </td>

                        {/* Cost Basis */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                          {formatCurrency(h.investedBrl, currency, ptax, hideValues)}
                        </td>

                        {/* Rentabilidade Total (%) - REQUESTED COLUMN */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black shadow-sm ${
                                totalReturnPositive
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {totalReturnPositive ? '+' : ''}
                              {totalReturnPct.toFixed(2)}%
                            </span>
                          </div>
                          {h.dividendsBrl && h.dividendsBrl > 0 ? (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              sem prov.: {openReturnPct >= 0 ? '+' : ''}{openReturnPct.toFixed(1)}%
                            </div>
                          ) : null}
                        </td>

                        {/* Lucro Total R$ */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div
                            className={`font-extrabold text-sm ${
                              totProfitPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {totProfitPositive ? '+' : ''}
                            {formatCurrency(totProfitVal, currency, ptax, hideValues)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {h.dividendsBrl && h.dividendsBrl > 0
                              ? `Prov.: +${formatCurrency(h.dividendsBrl, currency, ptax, hideValues)}`
                              : 'Ganho de capital'}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
