import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ShieldCheck,
  PieChart as PieChartIcon,
  Globe,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  AllocationGoal,
  Holding,
  MarketIndicator,
} from '../types/portfolio';
import {
  CurrencyMode,
  computePortfolioSummary,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

interface PatrimonyTabProps {
  holdings: Holding[];
  allocationGoals: AllocationGoal[];
  marketIndicators: MarketIndicator[];
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
  includeFgts: boolean;
}

export const MACRO_COLORS: Record<string, string> = {
  'Cash on Hand': '#3b82f6',
  'Stocks (US)': '#ef4444',
  'ETFs (US)': '#8b5cf6',
  'Stocks (BRA)': '#f59e0b',
  'FIIs': '#10b981',
  'Cryptocurrency': '#f97316',
  'Protection': '#06b6d4',
};

const RISK_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  'Very low': { bg: 'bg-emerald-500/15', text: 'text-emerald-300', bar: '#10b981' },
  'Low': { bg: 'bg-blue-500/15', text: 'text-blue-300', bar: '#3b82f6' },
  'Medium': { bg: 'bg-amber-500/15', text: 'text-amber-300', bar: '#f59e0b' },
  'High': { bg: 'bg-red-500/15', text: 'text-red-300', bar: '#ef4444' },
};

const SLICE_PALETTE = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
  '#6366f1', '#eab308',
];

const MACRO_GROUPS_ORDER: AllocationGoal['macroGroup'][] = [
  'Cash on Hand',
  'Stocks (US)',
  'ETFs (US)',
  'Stocks (BRA)',
  'FIIs',
  'Cryptocurrency',
  'Protection',
];

export const PatrimonyTab: React.FC<PatrimonyTabProps> = ({
  holdings,
  allocationGoals,
  marketIndicators,
  currency,
  ptax,
  hideValues,
  includeFgts,
}) => {
  const [selectedBreakdownGroup, setSelectedBreakdownGroup] =
    useState<AllocationGoal['macroGroup']>('Stocks (US)');

  // Avenue leftovers are always included
  const summary = computePortfolioSummary(holdings, includeFgts);
  const fgtsHolding = holdings.find((h) => h.assetClass === 'FGTS');
  const fgtsValueBrl = fgtsHolding ? fgtsHolding.marketValueBrl : 72456.16;

  // Build ordered distribution rows
  const distributionRows = MACRO_GROUPS_ORDER.map((macroGroup) => {
    const stats = summary.byMacroGroup[macroGroup] ?? {
      marketBrl: 0,
      investedBrl: 0,
      profitBrl: 0,
      dividendsBrl: 0,
      sharePct: 0,
    };
    const goalObj = allocationGoals.find((g) => g.macroGroup === macroGroup);
    return {
      macroGroup,
      marketBrl: stats.marketBrl,
      investedBrl: stats.investedBrl,
      profitBrl: stats.profitBrl,
      dividendsBrl: stats.dividendsBrl,
      sharePct: stats.sharePct,
      targetPct: goalObj?.targetPct ?? 0,
    };
  });

  // Breakdown items for the selected category donut chart
  const breakdownHoldings = holdings
    .filter((h) => h.macroGroup === selectedBreakdownGroup && h.marketValueBrl > 0)
    .sort((a, b) => b.marketValueBrl - a.marketValueBrl);

  const breakdownTotal = breakdownHoldings.reduce((acc, h) => acc + h.marketValueBrl, 0);
  const breakdownChartData = breakdownHoldings.map((h, i) => ({
    name: h.ticker,
    fullName: h.name,
    value: h.marketValueBrl,
    pct: breakdownTotal > 0 ? (h.marketValueBrl / breakdownTotal) * 100 : 0,
    color: SLICE_PALETTE[i % SLICE_PALETTE.length],
  }));

  return (
    <div className="space-y-6">
      {/* Row 1: Patrimony Distribution Table + Donut Chart + Risk Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Distribuição do Patrimônio Table */}
        <div className="xl:col-span-7 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#2b303b]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-amber-400" />
                Distribuição do Patrimônio por Classe
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidação patrimonial com Stocks (US) e ETFs (US) separados (incluindo IVVB11 em ETFs US).
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/25 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Leftovers Avenue incluído no Caixa
            </span>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2b303b] text-[11px] font-semibold uppercase text-slate-400">
                  <th className="py-2.5 px-2">Classe de Ativo</th>
                  <th className="py-2.5 px-2 text-right">Custo / Aplicado</th>
                  <th className="py-2.5 px-2 text-right">Patrimônio Atual</th>
                  <th className="py-2.5 px-2 text-right">Lucro Aberto</th>
                  <th className="py-2.5 px-2 text-right">Proventos</th>
                  <th className="py-2.5 px-2 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60 text-xs font-mono">
                {distributionRows.map((row) => (
                  <tr
                    key={row.macroGroup}
                    onClick={() => setSelectedBreakdownGroup(row.macroGroup)}
                    className="hover:bg-[#23272f]/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-2 font-sans font-semibold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: MACRO_COLORS[row.macroGroup] }}
                      />
                      {row.macroGroup}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-400">
                      {formatCurrency(row.investedBrl, currency, ptax, hideValues)}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-100">
                      {formatCurrency(row.marketBrl, currency, ptax, hideValues)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-semibold ${
                        row.profitBrl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {row.profitBrl >= 0 ? '+' : ''}
                      {formatCurrency(row.profitBrl, currency, ptax, hideValues)}
                    </td>
                    <td className="py-3 px-2 text-right text-amber-300">
                      {row.dividendsBrl > 0
                        ? formatCurrency(row.dividendsBrl, currency, ptax, hideValues)
                        : '-'}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-white">
                      {formatPct(row.sharePct, 1)}
                    </td>
                  </tr>
                ))}

                {/* Subtotal without FGTS */}
                <tr className="bg-[#14171c] font-bold text-white border-t-2 border-[#2b303b]">
                  <td className="py-3 px-2 font-sans">Total (Sem FGTS)</td>
                  <td className="py-3 px-2 text-right text-slate-300">
                    {formatCurrency(
                      distributionRows.reduce((acc, r) => acc + r.investedBrl, 0),
                      currency,
                      ptax,
                      hideValues
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-amber-400">
                    {formatCurrency(summary.nonFgtsTotalBrl, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right text-emerald-400">
                    +{formatCurrency(
                      distributionRows.reduce((acc, r) => acc + r.profitBrl, 0),
                      currency,
                      ptax,
                      hideValues
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-amber-300">
                    {formatCurrency(summary.totalDividendsBrl, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right">100,0%</td>
                </tr>

                {/* FGTS Row */}
                <tr className="text-slate-300 bg-[#14171c]/50">
                  <td className="py-2.5 px-2 font-sans flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/15 text-emerald-300">
                      Very low
                    </span>
                    FGTS
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-400">
                    {formatCurrency(fgtsValueBrl, currency, ptax, hideValues)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {formatCurrency(fgtsValueBrl, currency, ptax, hideValues)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-2 text-right text-[11px] font-sans text-slate-400">
                    Fundo de Garantia
                  </td>
                </tr>

                {/* Total with FGTS */}
                <tr className="bg-emerald-500/10 font-extrabold text-white">
                  <td className="py-3 px-2 font-sans text-emerald-300">Total com FGTS</td>
                  <td className="py-3 px-2 text-right text-slate-300">
                    {formatCurrency(
                      distributionRows.reduce((acc, r) => acc + r.investedBrl, 0) + fgtsValueBrl,
                      currency,
                      ptax,
                      hideValues
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-emerald-300 text-sm">
                    {formatCurrency(summary.nonFgtsTotalBrl + fgtsValueBrl, currency, ptax, hideValues)}
                  </td>
                  <td colSpan={3} className="py-3 px-2 text-right font-mono text-xs text-slate-300">
                    Em Dólar (PTAX R$ {ptax.toFixed(2)}):{' '}
                    <strong className="text-white">
                      {formatCurrency(summary.nonFgtsTotalBrl + fgtsValueBrl, 'USD', ptax, hideValues)}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Patrimony Donut + Risk Analysis Card */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* Donut Chart Card */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg flex-1">
            <h3 className="text-sm font-bold text-white mb-2">Exposição Atual por Classe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="h-[215px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionRows}
                      dataKey="marketBrl"
                      nameKey="macroGroup"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {distributionRows.map((entry) => (
                        <Cell
                          key={entry.macroGroup}
                          fill={MACRO_COLORS[entry.macroGroup] || '#3b82f6'}
                          stroke="#1b1e24"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#121418',
                        borderColor: '#2b303b',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                      formatter={(val: number) => formatCurrency(val, currency, ptax, hideValues)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-xs">
                {distributionRows.map((r) => (
                  <div key={r.macroGroup} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: MACRO_COLORS[r.macroGroup] }}
                      />
                      <span className="text-slate-300 font-medium">{r.macroGroup}</span>
                    </div>
                    <div className="font-mono">
                      <span className="text-white font-semibold">{formatPct(r.sharePct, 1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Analysis Card */}
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Risk Analysis (Com FGTS)
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Total: {formatCurrency(summary.withFgtsTotalBrl, currency, ptax, hideValues)}
              </span>
            </div>
            <div className="space-y-2.5">
              {(['Very low', 'Low', 'Medium', 'High'] as const).map((rLevel) => {
                const item = summary.byRisk[rLevel];
                const style = RISK_COLORS[rLevel];
                return (
                  <div key={rLevel} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded font-semibold ${style.bg} ${style.text}`}>
                        {rLevel}
                      </span>
                      <div className="font-mono">
                        <span className="text-white font-semibold">
                          {formatCurrency(item.marketBrl, currency, ptax, hideValues)}
                        </span>
                        <span className="text-slate-400 ml-2">({formatPct(item.sharePct, 1)})</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-[#121418] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, item.sharePct)}%`,
                          backgroundColor: style.bar,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Interactive Category Breakdown Donut & Table */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Composição Interna por Classe de Ativo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualize a participação de cada ativo dentro de sua respectiva classe.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MACRO_GROUPS_ORDER.map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedBreakdownGroup(grp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedBreakdownGroup === grp
                    ? 'bg-amber-500 text-slate-950 font-semibold border-amber-500'
                    : 'bg-[#121418] text-slate-300 border-[#2b303b] hover:border-slate-600'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-center">
          <div className="lg:col-span-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={1.5}
                >
                  {breakdownChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="#1b1e24" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121418',
                    borderColor: '#2b303b',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                  formatter={(val: number, _name: string, props: any) => [
                    `${formatCurrency(val, currency, ptax, hideValues)} (${formatPct(props.payload.pct, 1)})`,
                    props.payload.fullName,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-7 max-h-[290px] overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#1b1e24] border-b border-[#2b303b] text-[11px] text-slate-400 uppercase">
                <tr>
                  <th className="py-2 px-2">Ativo</th>
                  <th className="py-2 px-2">Nome / Setor</th>
                  <th className="py-2 px-2 text-right">Patrimônio</th>
                  <th className="py-2 px-2 text-right">% na Classe</th>
                  <th className="py-2 px-2 text-right">Lucro Aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60 font-mono">
                {breakdownHoldings.map((h, i) => {
                  const pct = breakdownTotal > 0 ? (h.marketValueBrl / breakdownTotal) * 100 : 0;
                  return (
                    <tr key={h.id} className="hover:bg-[#23272f]/50">
                      <td className="py-2 px-2 font-bold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                          style={{ backgroundColor: SLICE_PALETTE[i % SLICE_PALETTE.length] }}
                        />
                        {h.ticker}
                      </td>
                      <td className="py-2 px-2 font-sans text-slate-300 truncate max-w-[190px]">
                        {h.name}
                      </td>
                      <td className="py-2 px-2 text-right text-white font-semibold">
                        {formatCurrency(h.marketValueBrl, currency, ptax, hideValues)}
                      </td>
                      <td className="py-2 px-2 text-right text-amber-400 font-semibold">
                        {formatPct(pct, 1)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right ${
                          h.openProfitPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {formatPct(h.openProfitPct, 1, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Market Indicators Strip */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          Indicadores de Mercado & Câmbio (Referência 268 Dias / YTD)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {marketIndicators.map((ind) => (
            <div
              key={ind.ticker}
              className="bg-[#121418] border border-[#2b303b] rounded-lg p-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{ind.ticker}</span>
                <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{ind.name}</span>
              </div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-1.5">
                {ind.currency === 'BRL'
                  ? `R$ ${ind.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                  : ind.currency === 'USD'
                    ? `$ ${ind.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : ind.value.toLocaleString('pt-BR')}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono mt-1.5 pt-1.5 border-t border-[#2b303b]/60">
                <span className="text-slate-400">268d / YTD:</span>
                <span
                  className={`font-semibold ${
                    ind.ytdChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatPct(ind.ytdChangePct, 2, true)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
