import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Trophy,
  Skull,
  Flame,
  Coins,
  Calendar,
  TrendingUp,
  TrendingDown,
  Award,
  Zap,
  Compass,
  History,
} from 'lucide-react';
import {
  DividendRecord,
  FixedIncomeProductSummary,
  ForexPurchase,
  Holding,
  MonthlyPerformanceRow,
  TransactionRecord,
} from '../types/portfolio';
import {
  CurrencyMode,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

interface CuriositiesTabProps {
  holdings: Holding[];
  fixedIncomeProducts: FixedIncomeProductSummary[];
  transactions: TransactionRecord[];
  recentDividends: DividendRecord[];
  forexPurchases: ForexPurchase[];
  monthlyPerformance: MonthlyPerformanceRow[];
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

type CategoryFilter = 'ALL' | 'WINS' | 'LOSSES' | 'WEIRD' | 'DIVIDENDS_TIMELINE';

export const CuriositiesTab: React.FC<CuriositiesTabProps> = ({
  holdings,
  fixedIncomeProducts,
  transactions,
  recentDividends,
  forexPurchases,
  monthlyPerformance,
  currency,
  ptax,
  hideValues,
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('ALL');

  // 1. Compute Dynamic Records from Live Holdings & Fixed Income
  const stats = useMemo(() => {
    const varHoldings = holdings.filter(
      (h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS' && !h.isManual
    );

    // Biggest Open Profit in R$ (Variable Income)
    const topOpenBrl = [...varHoldings].sort((a, b) => b.openProfitBrl - a.openProfitBrl);
    // Biggest Total Profit in R$ (Open + Realized Trades + Dividends)
    const topTotalBrl = [...varHoldings].sort((a, b) => b.totalProfitBrl - a.totalProfitBrl);
    // Biggest Open Profit in % (Variable Income)
    const topOpenPct = [...varHoldings].sort((a, b) => b.openProfitPct - a.openProfitPct);

    // Biggest Open Loss in R$
    const worstOpenBrl = [...varHoldings].sort((a, b) => a.openProfitBrl - b.openProfitBrl);
    // Biggest Open Loss in %
    const worstOpenPct = [...varHoldings].sort((a, b) => a.openProfitPct - b.openProfitPct);

    // Fixed Income Champion
    const topFiBrl = [...fixedIncomeProducts].sort(
      (a, b) => b.absoluteProfitBrl - a.absoluteProfitBrl
    )[0];
    const topFiPct = [...fixedIncomeProducts].sort(
      (a, b) => b.rentabilityPct - a.rentabilityPct
    )[0];

    // Realized Sells from Transactions (op.normal)
    const sellTxs = transactions.filter(
      (t) =>
        (t.event === 'V' || t.event.toUpperCase().startsWith('VENDA')) &&
        typeof t.profitBrl === 'number' &&
        t.profitBrl !== 0
    );
    const topRealizedSellsBrl = [...sellTxs].sort((a, b) => b.profitBrl - a.profitBrl);
    const topRealizedSellsPct = [...sellTxs].sort((a, b) => b.profitPct - a.profitPct);
    const worstRealizedSellsBrl = [...sellTxs].sort((a, b) => a.profitBrl - b.profitBrl);
    const worstRealizedSellsPct = [...sellTxs].sort((a, b) => a.profitPct - b.profitPct);

    // Aggregate realized profit by ticker across all sell transactions
    const realizedByTickerMap = new Map<
      string,
      { ticker: string; totalRealizedBrl: number; count: number; worstPct: number; bestPct: number }
    >();
    for (const s of sellTxs) {
      const cur = realizedByTickerMap.get(s.ticker) || {
        ticker: s.ticker,
        totalRealizedBrl: 0,
        count: 0,
        worstPct: 0,
        bestPct: 0,
      };
      cur.totalRealizedBrl += s.profitBrl;
      cur.count += 1;
      if (s.profitPct < cur.worstPct) cur.worstPct = s.profitPct;
      if (s.profitPct > cur.bestPct) cur.bestPct = s.profitPct;
      realizedByTickerMap.set(s.ticker, cur);
    }
    const realizedByTicker = Array.from(realizedByTickerMap.values());
    const topRealizedTickerBrl = [...realizedByTicker].sort(
      (a, b) => b.totalRealizedBrl - a.totalRealizedBrl
    );
    const worstRealizedTickerBrl = [...realizedByTicker].sort(
      (a, b) => a.totalRealizedBrl - b.totalRealizedBrl
    );

    // Dividends Extremes
    const validDivs = recentDividends.filter((d) => d.netValueBrl > 0);
    const biggestSingleDiv = [...validDivs].sort((a, b) => b.netValueBrl - a.netValueBrl)[0];
    const smallestSingleDiv = [...validDivs].sort((a, b) => a.netValueBrl - b.netValueBrl)[0];
    const topDivHoldings = [...varHoldings].sort((a, b) => b.dividendsBrl - a.dividendsBrl);

    // Monthly Performance Extremes
    const bestMonthEquities = [...monthlyPerformance].sort(
      (a, b) => b.equitiesStatusInvestPct - a.equitiesStatusInvestPct
    )[0];
    const worstMonthEquities = [...monthlyPerformance].sort(
      (a, b) => a.equitiesStatusInvestPct - b.equitiesStatusInvestPct
    )[0];

    // Unique tickers ever traded
    const uniqueTickersEver = new Set(transactions.map((t) => t.ticker));
    for (const h of varHoldings) uniqueTickersEver.add(h.ticker);

    return {
      topOpenBrl,
      topTotalBrl,
      topOpenPct,
      worstOpenBrl,
      worstOpenPct,
      topFiBrl,
      topFiPct,
      topRealizedSellsBrl,
      topRealizedSellsPct,
      worstRealizedSellsBrl,
      worstRealizedSellsPct,
      topRealizedTickerBrl,
      worstRealizedTickerBrl,
      biggestSingleDiv,
      smallestSingleDiv,
      topDivHoldings,
      bestMonthEquities,
      worstMonthEquities,
      uniqueTickersCount: uniqueTickersEver.size,
    };
  }, [holdings, fixedIncomeProducts, transactions, recentDividends, monthlyPerformance]);

  const bestTotalWinner = stats.topTotalBrl[0];
  const bestOpenWinnerBrl = stats.topOpenBrl[0];
  const bestOpenWinnerPct = stats.topOpenPct[0];
  const worstOpenLoserBrl = stats.worstOpenBrl[0];
  const worstOpenLoserPct = stats.worstOpenPct[0];

  return (
    <div className="space-y-6">
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-r from-[#1b1e24] via-[#20242d] to-[#1b1e24] border border-amber-500/30 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Raio-X Histórico (Nov/2019 — Presente)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {stats.uniqueTickersCount} ativos já negociados • {transactions.length} operações •{' '}
                {recentDividends.length} proventos • {forexPurchases.length} câmbios
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-2 flex items-center gap-2">
              Curiosidades, Recordes & Bastidores da Sua Carteira
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Uma viagem pelos números reais das suas duas planilhas desde 2019: seus maiores acertos em volume (R$) e em percentual (%), as maiores &ldquo;cicatrizes de guerra&rdquo;, os investimentos mais aleatórios que você já fez e os micro-dividendos de 2 centavos.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#121418] p-1.5 rounded-xl border border-[#2b303b]">
            {[
              { id: 'ALL', label: 'Tudo' },
              { id: 'WINS', label: '🏆 Maiores Lucros' },
              { id: 'LOSSES', label: '🩹 Maiores Prejuízos' },
              { id: 'WEIRD', label: '🤪 Mais Inusitados' },
              { id: 'DIVIDENDS_TIMELINE', label: '🪙 Dividendos & Marcos' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as CategoryFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === item.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Headline Trophy / Record Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Card 1: Biggest Profit in Money Volume */}
          <div className="bg-[#121418] border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Maior Lucro em R$ (RV)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                Aberto + Vendas
              </span>
            </div>
            <div className="text-lg font-extrabold text-white mt-2">
              {bestTotalWinner?.ticker || 'ASX'} •{' '}
              <span className="text-emerald-400 font-mono">
                +{formatCurrency(bestTotalWinner?.totalProfitBrl || 16578.84, currency, ptax, hideValues)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Semicondutores em Taiwan: você já embolsou{' '}
              <strong className="text-slate-200">
                +{formatCurrency(bestTotalWinner?.tradesProfitBrl || 9200.23, currency, ptax, hideValues)}
              </strong>{' '}
              em vendas parciais e ainda tem{' '}
              <strong className="text-emerald-400">
                +{formatCurrency(bestTotalWinner?.openProfitBrl || 7211.76, currency, ptax, hideValues)}
              </strong>{' '}
              em aberto! (Na Renda Fixa, o campeão absoluto é o{' '}
              <strong className="text-white">NuBank Invest</strong> com{' '}
              <strong className="text-emerald-400">
                +{formatCurrency(stats.topFiBrl?.absoluteProfitBrl || 66431.23, currency, ptax, hideValues)}
              </strong>
              ).
            </p>
          </div>

          {/* Card 2: Biggest Profit in Relative % */}
          <div className="bg-[#121418] border border-emerald-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Maior Lucro em %
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                5x o Capital
              </span>
            </div>
            <div className="text-lg font-extrabold text-white mt-2">
              {bestOpenWinnerPct?.ticker || 'NRG'} •{' '}
              <span className="text-emerald-400 font-mono">
                {formatPct(bestOpenWinnerPct?.openProfitPct || 408.9, 1, true)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Comprada a partir de ago/2020 na faixa de US$ 33, a{' '}
              <strong className="text-slate-200">NRG Energy</strong> também detém o recorde de{' '}
              <strong className="text-emerald-400">maior trade individual realizado em % (+392,25%)</strong>{' '}
              quando você vendeu 4 ações a US$ 157,16 em 27/05/2025!
            </p>
          </div>

          {/* Card 3: Biggest Loss in Money Volume */}
          <div className="bg-[#121418] border border-red-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Maior Prejuízo em R$
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300">
                Em Aberto vs Realizado
              </span>
            </div>
            <div className="text-lg font-extrabold text-white mt-2">
              {worstOpenLoserBrl?.ticker || 'MLAS3'} •{' '}
              <span className="text-red-400 font-mono">
                {formatCurrency(worstOpenLoserBrl?.openProfitBrl || -7043.29, currency, ptax, hideValues)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Em aberto, a <strong className="text-slate-200">Multilaser (MLAS3)</strong> lidera com{' '}
              <strong className="text-red-400">
                {formatCurrency(worstOpenLoserBrl?.openProfitBrl || -7043.29, currency, ptax, hideValues)}
              </strong>{' '}
              (seguida da <strong className="text-slate-200">Celanese CE</strong> com{' '}
              {formatCurrency(-4477.02, currency, ptax, hideValues)}). Já entre vendas realizadas, o maior corte foi{' '}
              <strong className="text-red-400">
                CSAN3 ({formatCurrency(-4190.7, currency, ptax, hideValues)})
              </strong>{' '}
              em 06/01/2026.
            </p>
          </div>

          {/* Card 4: Biggest Loss in Relative % */}
          <div className="bg-[#121418] border border-red-500/30 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                <Skull className="w-3.5 h-3.5" /> Maior Tombo em %
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300">
                Quase Pó
              </span>
            </div>
            <div className="text-lg font-extrabold text-white mt-2">
              OIBR3 (-95,2%) / {worstOpenLoserPct?.ticker || 'DOTUSD'} (
              {formatPct(worstOpenLoserPct?.openProfitPct || -88.5, 1)})
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nas vendas encerradas, <strong className="text-slate-200">OIBR3</strong> derreteu{' '}
              <strong className="text-red-400">-95,19%</strong> (R$ 262 viraram R$ 12,60 após grupamento 10:1). Na carteira atual,{' '}
              <strong className="text-slate-200">Polkadot (DOTUSD)</strong> cai{' '}
              <strong className="text-red-400">
                {formatPct(worstOpenLoserPct?.openProfitPct || -88.5, 1)}
              </strong>{' '}
              (R$ 215,91 viraram R$ 25).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: HALL DA FAMA (MAIORES LUCROS EM R$ E EM %) */}
      {(filter === 'ALL' || filter === 'WINS') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Wins in Money Volume (R$) */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  Top 6 Maiores Lucros em Volume (R$)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Os ativos que mais colocaram dinheiro real no seu patrimônio (Aberto + Vendas + Proventos).
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Volume Financeiro
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {/* #1 Absolute Champion: NuBank Invest */}
              <div className="bg-[#121418] border border-emerald-500/30 rounded-lg p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950">
                      #1 GERAL (RF)
                    </span>
                    <span className="font-bold text-white text-sm">
                      NuBank Invest (Saldo Separado + RDB 100% CDI)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Investido: {formatCurrency(stats.topFiBrl?.totalInvestedBrl || 213502.74, currency, ptax, hideValues)} • Patrimônio atual:{' '}
                    {formatCurrency(stats.topFiBrl?.marketValueBrl || 279933.97, currency, ptax, hideValues)}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-extrabold text-emerald-400">
                    +{formatCurrency(stats.topFiBrl?.absoluteProfitBrl || 66431.23, currency, ptax, hideValues)}
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    +{formatPct(stats.topFiBrl?.rentabilityPct || 31.11, 2)}
                  </div>
                </div>
              </div>

              {stats.topTotalBrl.slice(0, 5).map((h, idx) => (
                <div
                  key={h.id}
                  className="bg-[#121418] border border-[#2b303b] rounded-lg p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 font-mono">
                        #{idx + 1} RV
                      </span>
                      <span className="font-bold text-white text-sm">
                        {h.ticker} — {h.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {h.macroGroup}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Aberto: +{formatCurrency(h.openProfitBrl, currency, ptax, hideValues)} | Vendas:{' '}
                      +{formatCurrency(h.tradesProfitBrl, currency, ptax, hideValues)} | Div: +
                      {formatCurrency(h.dividendsBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-extrabold text-emerald-400">
                      +{formatCurrency(h.totalProfitBrl, currency, ptax, hideValues)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Aberto: {formatPct(h.openProfitPct, 1, true)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Wins in Relative Percentage (%) */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Top 6 Maiores Multiplicações Relativas (%)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Os &ldquo;Multi-Baggers&rdquo; da sua carteira que multiplicaram de 2x a 5x o capital investido.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Rentabilidade %
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {stats.topOpenPct.slice(0, 6).map((h, idx) => (
                <div
                  key={h.id}
                  className="bg-[#121418] border border-[#2b303b] rounded-lg p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                        #{idx + 1} ({((h.openProfitPct + 100) / 100).toFixed(2)}x)
                      </span>
                      <span className="font-bold text-white text-sm">
                        {h.ticker} — {h.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      PM: {formatCurrency(h.avgPriceBrl, currency, ptax, hideValues)} → Atual:{' '}
                      {formatCurrency(h.currentPriceBrl, currency, ptax, hideValues)} • Investido:{' '}
                      {formatCurrency(h.investedBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-extrabold text-emerald-400">
                      {formatPct(h.openProfitPct, 1, true)}
                    </div>
                    <div className="text-[11px] text-emerald-300">
                      +{formatCurrency(h.openProfitBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CICATRIZES DE GUERRA (MAIORES PREJUÍZOS EM R$ E EM %) */}
      {(filter === 'ALL' || filter === 'LOSSES') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Biggest Losses in Money Volume (R$) */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Maiores Prejuízos em Volume Financeiro (R$)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Onde o bolso mais doeu em Reais — somando posições abertas e vendas já encerradas.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                Em R$
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {stats.worstOpenBrl.slice(0, 3).map((h, idx) => (
                <div
                  key={h.id}
                  className="bg-[#121418] border border-red-500/20 rounded-lg p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 font-mono">
                        ABERTO #{idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {h.ticker} — {h.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Investido: {formatCurrency(h.investedBrl, currency, ptax, hideValues)} → Valor Atual:{' '}
                      {formatCurrency(h.marketValueBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-extrabold text-red-400">
                      {formatCurrency(h.openProfitBrl, currency, ptax, hideValues)}
                    </div>
                    <div className="text-[11px] text-red-300">
                      {formatPct(h.openProfitPct, 1)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Top 3 Realized Losses in R$ from op.normal */}
              {[
                {
                  ticker: 'CSAN3',
                  name: 'Cosan S.A. (Encerrada em 06/01/2026)',
                  lossBrl: -4190.7,
                  lossPct: -61.31,
                  detail: '8 compras entre 2021 e 2025 (PM R$ 13,67) → Venda total de 500 ações a R$ 5,29',
                },
                {
                  ticker: 'LVTC3',
                  name: 'WDC Networks / Livetech (Encerrada em 02/01/2025)',
                  lossBrl: -2383.0,
                  lossPct: -63.03,
                  detail: '6 compras entre jul/2021 (R$ 24,71) e jan/2024 → Venda total de 600 ações a R$ 2,33',
                },
                {
                  ticker: 'RAPT4',
                  name: 'Randoncorp (Encerrada em 06/01/2026)',
                  lossBrl: -2225.62,
                  lossPct: -45.69,
                  detail: '6 compras entre 2021 e 2025 → Venda total de 450 ações a R$ 5,86',
                },
              ].map((item, idx) => (
                <div
                  key={item.ticker}
                  className="bg-[#121418] border border-[#2b303b] rounded-lg p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                        REALIZADO #{idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {item.ticker} — {item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{item.detail}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-extrabold text-red-400">
                      {formatCurrency(item.lossBrl, currency, ptax, hideValues)}
                    </div>
                    <div className="text-[11px] text-red-300">{formatPct(item.lossPct, 1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Biggest Losses in Relative % */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Skull className="w-4 h-4 text-red-400" />
                  Maiores Quedas Relativas em Percentual (%)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Os ativos que sofreram as desvalorizações mais severas desde a compra.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                Queda %
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {[
                {
                  badge: 'REALIZADO #1',
                  ticker: 'OIBR3 — Oi S.A. (Recuperação Judicial)',
                  pct: -95.19,
                  lossBrl: -249.4,
                  story:
                    'Comprou 200 ações a R$ 1,31 em 20/07/2020 (R$ 262). Sofreu grupamento 10:1 em jan/2023 (virando 20 ações) e foi vendida a R$ 0,63 em 08/01/2024 por R$ 12,60!',
                },
                {
                  badge: 'EM ABERTO #1',
                  ticker: 'DOTUSD — Polkadot (Cripto)',
                  pct: -88.5,
                  lossBrl: -191.15,
                  story:
                    'Comprada no ciclo de alta em fev/2022 com preço médio de R$ 56,54. Hoje vale cerca de R$ 6,48 por token (R$ 215,91 viraram R$ 25,00).',
                },
                {
                  badge: 'EM ABERTO #2',
                  ticker: 'MLAS3 — Multilaser Industrial (ex-Mobly/Watts)',
                  pct: -75.4,
                  lossBrl: -7043.29,
                  story:
                    'Comprada a partir de jul/2021 com PM de R$ 7,74 (1.207 ações). A queda para a casa de R$ 1,91 gerou a maior perda aberta da carteira.',
                },
                {
                  badge: 'REALIZADO #2',
                  ticker: 'MJ — Amplify Alternative Harvest ETF (Cannabis US)',
                  pct: -73.38,
                  lossBrl: -1244.99,
                  story:
                    '5 compras entre 2021 e 2023 tentando fazer preço médio (de US$ 25,50 até US$ 2,96), grupamento reverso 12:1 em fev/2025 e venda total em 13/05/2025.',
                },
                {
                  badge: 'EM ABERTO #3',
                  ticker: 'ADAUSD — Cardano (Cripto)',
                  pct: -64.9,
                  lossBrl: -368.55,
                  story:
                    '148,66 ADAs compradas a um preço médio de R$ 3,82 (R$ 568,01 investidos vs R$ 199,00 atuais).',
                },
                {
                  badge: 'REALIZADO #3',
                  ticker: 'QUAL3 — Qualicorp (Saúde BR)',
                  pct: -64.85,
                  lossBrl: -530.44,
                  story:
                    'Comprada em out/2020 a R$ 31,52 e jul/2021 a R$ 26,14 → Vendida integralmente em 28/07/2022 a R$ 10,27.',
                },
              ].map((item) => (
                <div
                  key={item.ticker}
                  className="bg-[#121418] border border-[#2b303b] rounded-lg p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-300 font-mono">
                        {item.badge}
                      </span>
                      <span className="font-bold text-white text-sm">{item.ticker}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{item.story}</div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <div className="text-sm font-extrabold text-red-400">
                      {formatPct(item.pct, 2)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatCurrency(item.lossBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: INVESTIMENTOS MAIS INUSITADOS & HISTÓRIAS REAIS DA PLANILHA */}
      {(filter === 'ALL' || filter === 'WEIRD') && (
        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                Os 8 Episódios Mais Inusitados, Curiosos e Engraçados da Sua Planilha
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fatos reais garimpados linha por linha das abas <code className="text-amber-300">op.normal</code>,{' '}
                <code className="text-amber-300">Fixed Income</code> e <code className="text-amber-300">Currency</code>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            {/* Story 1: GameStop (GME) */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🚀🎮</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    +28,48% em 48h
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  O Trade de 0,0682 Ação na GameStop (GME)
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Em <strong className="text-slate-200">27/01/2021</strong>, no exato auge mundial do short squeeze do Reddit (<em>WallStreetBets</em>), você comprou{' '}
                  <strong className="text-amber-300">0,0682 fração de ação da GME</strong> na Avenue e vendeu{' '}
                  <strong className="text-slate-200">2 dias depois (29/01/2021)</strong>. Saiu ileso da bolha com{' '}
                  <strong className="text-emerald-400">+R$ 27,68 de lucro</strong>!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                Linha 176-177 • op.normal (Avenue)
              </div>
            </div>

            {/* Story 2: Whirlpool Same-Day Swap */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🧺⚡</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300">
                    Day-Trade de -R$ 2,25
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  O &ldquo;Arrependimento Instantâneo&rdquo; na Whirlpool (WHRL3 → WHRL4)
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Em <strong className="text-slate-200">24/07/2020</strong>, você comprou 45 ações ordinárias da dona da Brastemp (<strong className="text-amber-300">WHRL3</strong> a R$ 7,43) e{' '}
                  <strong className="text-slate-200">vendeu no mesmíssimo dia</strong> a R$ 7,38 (realizando um prejuízo épico de{' '}
                  <strong className="text-red-400">-R$ 2,25</strong>) só para trocar por 40 ações preferenciais (<strong className="text-emerald-300">WHRL4</strong>) no mesmo pregão!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                24/07/2020 • Único Day-Trade da planilha
              </div>
            </div>

            {/* Story 3: Uranium, Cannabis & Cheesecake */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">☢️🌿🍰</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                    Portfólio Exótico
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  Urânio Nuclear, Cannabis e Cheesecake Factory
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Sua carteira nos EUA já combinou <strong className="text-emerald-400">Urânio Nuclear (URNM, +120,9%)</strong>, um{' '}
                  <strong className="text-red-400">ETF de Cannabis (MJ, -73,4%)</strong>, restaurantes do{' '}
                  <strong className="text-amber-300">The Cheesecake Factory (CAKE, +R$ 132,45)</strong> e a criadora de Call of Duty (<strong className="text-emerald-300">ATVI, +R$ 271,96</strong>). O Urânio pagou a conta da Cannabis com sobra!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                URNM (+R$ 6.697) vs MJ (-R$ 1.245)
              </div>
            </div>

            {/* Story 4: Mexican Pesos to USD */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🇲🇽🌮💵</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                    US$ 103,04
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  Os Pesos Mexicanos que Viraram Dólar
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  No seu histórico de Câmbio (<strong className="text-slate-200">09/05/2026</strong>), existe uma compra de{' '}
                  <strong className="text-amber-300">US$ 103,04</strong> a R$ 4,9495 com R$ 23,90 de taxas e uma nota muito específica:{' '}
                  <em className="text-emerald-300">&ldquo;Transferred Mexican Pesos to USD&rdquo;</em>, logo ao lado de outra transferência batizada de{' '}
                  <em className="text-emerald-300">&ldquo;Carioca transfer&rdquo;</em> (US$ 50,00)!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                Aba Currency • Patrimony Analysis 2.0
              </div>
            </div>

            {/* Story 5: Alaska Black inside Fixed Income */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🐻🕵️‍♂️</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300">
                    -7,43% (-R$ 74,26)
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  O &ldquo;Infiltrado&rdquo; na Planilha de Renda Fixa (Alaska Black)
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Escondido na última coluna (<code className="text-amber-300">Col 63</code>) da sua aba de{' '}
                  <strong className="text-slate-200">Renda Fixa</strong> está o famoso fundo de ações{' '}
                  <strong className="text-amber-300">Alaska Black Institucional</strong>! Você colocou R$ 1.000,00 em nov/2019 e resgatou R$ 925,74 em jul/2020 — o único item da planilha de Renda Fixa que terminou no negativo!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                Col 63 • Aba Fixed Income + op.normal
              </div>
            </div>

            {/* Story 6: The Great B3 Purge of Jan 6, 2026 */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🧹🇧🇷</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300">
                    06/01/2026
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  &ldquo;O Grande Expurgo da B3&rdquo; (5 Ações Zeradas num Único Dia)
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Em <strong className="text-slate-200">06/01/2026</strong>, você acordou decidido a fazer faxina na carteira brasileira: vendeu de uma só vez{' '}
                  <strong className="text-red-300">CSAN3, RAPT4, BRAV3, GMAT3 e AGRO3</strong> (7 ordens de venda no mesmo dia), realizando{' '}
                  <strong className="text-red-400">-R$ 9.613,03</strong> de prejuízo contábil para focar nos EUA e em Renda Fixa!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                Linhas 574-580 • op.normal (XP)
              </div>
            </div>

            {/* Story 7: XP Inc Stock vs XP Broker */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🏦🔄</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                    8 Compras (2020–2024)
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  Cliente Fiel, Acionista Nem Tanto (XP Inc. na Nasdaq)
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Embora a <strong className="text-slate-200">XP</strong> seja sua principal corretora no Brasil, a ação da{' '}
                  <strong className="text-amber-300">XP Inc. (NASDAQ: XP)</strong> deu trabalho: você fez 8 compras entre set/2020 e jul/2024 e vendeu todas as 40 ações em{' '}
                  <strong className="text-slate-200">20/01/2026</strong> a US$ 17,71 (<strong className="text-red-400">-R$ 573,27</strong>), transferindo os US$ 708,46 direto para o caixa dolarizado!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                20/01/2026 • op.normal + Currency
              </div>
            </div>

            {/* Story 8: 200% CDI Promo & PicPay */}
            <div className="bg-[#121418] border border-[#2b303b] hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-lg">🎯💳</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    Caçador de CDI
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">
                  O Lendário CDB 200% do CDI & A Era do PicPay
                </h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Você já passou por <strong className="text-slate-200">14 produtos diferentes de Renda Fixa</strong> desde 2021, incluindo o clássico{' '}
                  <strong className="text-emerald-300">PicPay (+25,75% / +R$ 701,48)</strong>, o{' '}
                  <strong className="text-amber-300">CDB Promo 200% do CDI do Nubank (+R$ 517,56 em poucos meses)</strong> e o{' '}
                  <strong className="text-emerald-400">Tesouro Selic 2027 (+85,10% acumulados desde ago/2021)</strong>!
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-[#2b303b]/60 text-[10px] font-mono text-slate-500">
                14 Colunas Históricas • Aba Fixed Income
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: DIVIDENDOS CURIOSOS & LINHA DO TEMPO (2019–2026) */}
      {(filter === 'ALL' || filter === 'DIVIDENDS_TIMELINE') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dividend Curiosities */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  Curiosidades dos Seus {recentDividends.length} Proventos Recebidos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dos famosos &ldquo;2 centavos&rdquo; da Petrobras até os maiores cheques mensais isentos de IR.
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="bg-[#121418] border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    🪙 O Menor Provento da História (&ldquo;Dois Centavos!&rdquo;)
                  </span>
                  <span className="font-mono text-sm font-extrabold text-amber-400">R$ 0,02</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Em <strong className="text-slate-200">15/12/2020</strong>, a <strong className="text-white">PETR4</strong> depositou na sua conta da XP exatamente{' '}
                  <strong className="text-amber-300">R$ 0,02 líquidos</strong>. Cinco anos depois, em{' '}
                  <strong className="text-slate-200">30/09/2025</strong>, o ETF americano de cibersegurança{' '}
                  <strong className="text-white">CIBR</strong> empatou o recorde depositando outros <strong className="text-amber-300">R$ 0,02</strong>!
                </p>
              </div>

              <div className="bg-[#121418] border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    💰 O Maior Pagamento Único de Dividendo
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-400">
                    {formatCurrency(stats.biggestSingleDiv?.netValueBrl || 430.32, currency, ptax, hideValues)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pago por <strong className="text-white">{stats.biggestSingleDiv?.ticker || 'LOGG3'}</strong> em{' '}
                  <strong className="text-slate-200">{stats.biggestSingleDiv?.date || '2025-12-29'}</strong> (21.516x maior que o dividendo de 2 centavos da PETR4!), seguido de perto por{' '}
                  <strong className="text-white">ITSA4 ({formatCurrency(404.74, currency, ptax, hideValues)})</strong> em 19/12/2025.
                </p>
              </div>

              <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-4">
                <div className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  Top 5 Maiores Geradores de Renda Passiva Acumulada
                </div>
                <div className="space-y-2">
                  {stats.topDivHoldings.slice(0, 5).map((h, i) => (
                    <div key={h.id} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300">
                        {i + 1}. <strong className="text-white">{h.ticker}</strong> ({h.macroGroup})
                      </span>
                      <span className="text-emerald-400 font-bold">
                        +{formatCurrency(h.dividendsBrl, currency, ptax, hideValues)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Historical Milestones & Stress-Test Survival */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Marcos Históricos & Teste de Sangue Frio (2019–2026)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  De R$ 30 mil a quase R$ 900 mil passando por pandemia, circuit breakers e juros de 2% a 15%.
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="bg-[#121418] border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> O Primeiro Trade (22/11/2019)
                  </span>
                  <span className="font-mono text-xs text-slate-300">Há quase 7 anos</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Sua primeira ordem de bolsa registrada foi em <strong className="text-white">22/11/2019</strong>: compra de{' '}
                  <strong className="text-amber-300">10 cotas de BOVA11 a R$ 103,84</strong> (R$ 1.038,40), seguida 4 dias depois por{' '}
                  <strong className="text-white">IVVB11 a R$ 143,72</strong> (hoje o IVVB11 vale mais de R$ 411 — quase <strong className="text-emerald-400">3x o valor da sua 1ª compra</strong>!).
                </p>
              </div>

              <div className="bg-[#121418] border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Sangue Frio no Circuit Breaker da Covid-19 (Mar/2020)
                  </span>
                  <span className="font-mono text-xs text-red-400 font-bold">
                    {formatPct(stats.worstMonthEquities?.equitiesStatusInvestPct || -29.94, 2)} em RV
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Com apenas <strong className="text-slate-200">4 meses de bolsa</strong>, você enfrentou os 6 Circuit Breakers de{' '}
                  <strong className="text-white">Março de 2020</strong> (-18,32% no patrimônio total). Em vez de vender em pânico, você foi às compras em mar/abr de 2020 (<strong className="text-emerald-300">ITSA4, WEGE3, VALE3, FLRY3 e PETR4</strong>) e em{' '}
                  <strong className="text-white">Novembro de 2020</strong> teve o melhor mês da sua história (<strong className="text-emerald-400">+16,28% em Ações / +9,42% no Total</strong>)!
                </p>
              </div>

              <div className="bg-[#121418] border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    🚀 Multiplicação Patrimonial (2019 → 2026)
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-400">29,4x</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Seu patrimônio saiu de <strong className="text-white">R$ 30.460</strong> aos 21 anos (2019) para{' '}
                  <strong className="text-emerald-400">
                    {formatCurrency(
                      holdings.reduce((a, b) => a + b.marketValueBrl, 0),
                      currency,
                      ptax,
                      hideValues
                    )}
                  </strong>{' '}
                  aos 28 anos (2026) — batendo a meta anual da planilha em{' '}
                  <strong className="text-white">5 dos 7 anos fechados</strong>!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
