import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Rocket,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  DividendRecord,
  LifeGoalRow,
} from '../types/portfolio';
import {
  CurrencyMode,
  computeLatest3mAvgDividendsBrl,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

interface GoalsAndTransactionsTabProps {
  lifeGoals: LifeGoalRow[];
  cashflowProfile: {
    grossSalaryBrl: number;
    incomeTaxPct: number;
    incomeTaxBrl: number;
    netSalaryBrl: number;
    avgDividends3mBrl: number;
    avgExpenses3mBrl: number;
    monthlyLeftoverBrl: number;
  };
  onUpdateCashflow: (profile: GoalsAndTransactionsTabProps['cashflowProfile']) => void;
  recentDividends: DividendRecord[];
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

export const GoalsAndTransactionsTab: React.FC<GoalsAndTransactionsTabProps> = ({
  lifeGoals,
  cashflowProfile,
  onUpdateCashflow,
  recentDividends,
  currency,
  ptax,
  hideValues,
}) => {
  const [expectedAnnualYieldPct, setExpectedAnnualYieldPct] = useState<number>(11.5);
  const [showAllYears, setShowAllYears] = useState(false);

  // Automatically calculate 3-month dividend average from Proventos tab
  const avg3mInfo = useMemo(
    () => computeLatest3mAvgDividendsBrl(recentDividends),
    [recentDividends]
  );

  const autoAvgDividends3mBrl = avg3mInfo.avg3mBrl;
  const effectiveMonthlyLeftoverBrl = Number(
    (
      cashflowProfile.netSalaryBrl +
      autoAvgDividends3mBrl -
      cashflowProfile.avgExpenses3mBrl
    ).toFixed(2)
  );

  const handleProfileChange = (
    field: 'grossSalaryBrl' | 'incomeTaxPct' | 'avgExpenses3mBrl',
    val: number
  ) => {
    const next = {
      ...cashflowProfile,
      [field]: val,
      avgDividends3mBrl: autoAvgDividends3mBrl,
    };
    next.incomeTaxBrl = Number(((next.grossSalaryBrl * next.incomeTaxPct) / 100).toFixed(2));
    next.netSalaryBrl = Number((next.grossSalaryBrl - next.incomeTaxBrl).toFixed(2));
    next.monthlyLeftoverBrl = Number(
      (next.netSalaryBrl + autoAvgDividends3mBrl - next.avgExpenses3mBrl).toFixed(2)
    );
    onUpdateCashflow(next);
  };

  // Build projected patrimony series from 2019 to 2048
  const goalsWithProjection = useMemo(() => {
    let runningProjBrl = 896220; // 2026 actual with FGTS
    const annualContribution = effectiveMonthlyLeftoverBrl * 12;
    const r = expectedAnnualYieldPct / 100;

    return lifeGoals.map((row) => {
      if (row.year <= 2026 && row.patrimonyBrl !== null) {
        runningProjBrl = row.patrimonyBrl;
        return {
          ...row,
          projectedBrl: row.patrimonyBrl,
        };
      } else {
        runningProjBrl = Math.round(runningProjBrl * (1 + r) + annualContribution);
        return {
          ...row,
          projectedBrl: runningProjBrl,
        };
      }
    });
  }, [lifeGoals, effectiveMonthlyLeftoverBrl, expectedAnnualYieldPct]);

  const chartData = useMemo(() => {
    const slice = showAllYears ? goalsWithProjection : goalsWithProjection.filter((g) => g.year <= 2035);
    const factor = currency === 'USD' ? 1 / ptax : 1;
    return slice.map((g) => ({
      year: `${g.year} (${g.age}a)`,
      Meta: Math.round(g.goalBrl * factor),
      Realizado: g.patrimonyBrl !== null ? Math.round(g.patrimonyBrl * factor) : null,
      Projecao: g.year >= 2026 ? Math.round(g.projectedBrl * factor) : null,
    }));
  }, [goalsWithProjection, showAllYears, currency, ptax]);

  return (
    <div className="space-y-6">
      {/* Row 1: Cashflow & Savings Calculator */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Fluxo de Caixa Pessoal & Capacidade de Aporte Mensal
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Parâmetros de salário, imposto de renda, média de dividendos (sincronizada automaticamente da aba Proventos) e gastos mensais.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
            <div>
              <div className="text-[11px] text-emerald-300 font-medium">Sobras Mensais para Aporte</div>
              <div className="text-xl font-extrabold font-mono text-emerald-400">
                {formatCurrency(effectiveMonthlyLeftoverBrl, currency, ptax, hideValues)} / mês
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 text-xs">
          <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-3">
            <label className="block text-slate-400 text-[11px] mb-1">Salário Bruto (R$)</label>
            <input
              type="number"
              value={cashflowProfile.grossSalaryBrl}
              onChange={(e) => handleProfileChange('grossSalaryBrl', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-mono font-bold text-sm text-white focus:outline-none border-b border-slate-700 focus:border-amber-500"
            />
          </div>
          <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-3">
            <label className="block text-slate-400 text-[11px] mb-1">Alíquota IR (%)</label>
            <input
              type="number"
              step="0.5"
              value={cashflowProfile.incomeTaxPct}
              onChange={(e) => handleProfileChange('incomeTaxPct', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-mono font-bold text-sm text-red-400 focus:outline-none border-b border-slate-700 focus:border-amber-500"
            />
            <div className="text-[10px] font-mono text-slate-500 mt-1">
              -{formatCurrency(cashflowProfile.incomeTaxBrl, currency, ptax, hideValues)}
            </div>
          </div>
          <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-3">
            <div className="text-slate-400 text-[11px] mb-1">Salário Líquido</div>
            <div className="font-mono font-bold text-sm text-white">
              {formatCurrency(cashflowProfile.netSalaryBrl, currency, ptax, hideValues)}
            </div>
          </div>
          <div className="bg-[#121418] border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300 font-medium">Média Dividendos 3m</span>
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold">
                <Zap className="w-2.5 h-2.5" /> Auto
              </span>
            </div>
            <div className="font-mono font-bold text-sm text-amber-400">
              {formatCurrency(autoAvgDividends3mBrl, currency, ptax, hideValues)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 truncate" title="Sincronizado automaticamente da aba Proventos">
              Aba Proventos ({avg3mInfo.latest3Months.map((m) => m.month.slice(5)).join('/')})
            </div>
          </div>
          <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-3">
            <label className="block text-slate-400 text-[11px] mb-1">Média Gastos (3m)</label>
            <input
              type="number"
              value={cashflowProfile.avgExpenses3mBrl}
              onChange={(e) => handleProfileChange('avgExpenses3mBrl', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-mono font-bold text-sm text-orange-400 focus:outline-none border-b border-slate-700 focus:border-amber-500"
            />
          </div>
          <div className="bg-[#121418] border border-[#2b303b] rounded-lg p-3">
            <label className="block text-slate-400 text-[11px] mb-1">Taxa Projeção (% a.a.)</label>
            <input
              type="number"
              step="0.5"
              value={expectedAnnualYieldPct}
              onChange={(e) => setExpectedAnnualYieldPct(parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent font-mono font-bold text-sm text-blue-400 focus:outline-none border-b border-slate-700 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Life Goals Chart & Table (Ages 21 to 50) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Chart */}
        <div className="xl:col-span-7 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#2b303b]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400" />
                  Evolução Patrimonial vs. Meta (Dos 21 aos 50 Anos)
                </h3>
                <p className="text-xs text-slate-400">
                  Histórico realizado (2019–2026) + Projeção composta até 2048.
                </p>
              </div>
              <button
                onClick={() => setShowAllYears((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-[#121418] border border-[#2b303b] text-xs font-semibold text-amber-400 hover:border-amber-500"
              >
                {showAllYears ? 'Focar 2019–2035' : 'Ver Até 2048 (50 Anos)'}
              </button>
            </div>

            <div className="h-[380px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262b35" vertical={false} />
                  <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : `${(v / 1_000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#121418',
                      borderColor: '#2b303b',
                      borderRadius: '0.5rem',
                      fontSize: '12px',
                    }}
                    formatter={(val: number) =>
                      val ? formatCurrency(currency === 'USD' ? val * ptax : val, currency, ptax, hideValues) : '-'
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="Meta"
                    name="Meta (Goal)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="Realizado"
                    name="Patrimônio Realizado"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="Projecao"
                    name={`Projeção (${expectedAnnualYieldPct}% a.a.)`}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#2b303b] flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>
              Meta 2026 (28 anos): <strong className="text-white">R$ 1.000.000</strong> • Atual:{' '}
              <strong className="text-emerald-400">R$ 896.220 (90%)</strong>
            </span>
            <span>
              Faltam <strong className="text-amber-400">R$ 103.780</strong> para o Primeiro Milhão!
            </span>
          </div>
        </div>

        {/* Right: Life Goals Table */}
        <div className="xl:col-span-5 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white pb-3 border-b border-[#2b303b]">
            Tabela de Metas por Idade (21 aos 50 Anos)
          </h3>
          <div className="overflow-y-auto max-h-[415px] mt-3 pr-1">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-[#1b1e24] border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                <tr>
                  <th className="py-2 px-1.5">Idade</th>
                  <th className="py-2 px-1.5">Ano</th>
                  <th className="py-2 px-1.5 text-right">Meta (Goal)</th>
                  <th className="py-2 px-1.5 text-right">Real / Proj.</th>
                  <th className="py-2 px-1.5 text-right">Status</th>
                  <th className="py-2 px-1.5 text-right">% Var</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60">
                {goalsWithProjection.map((row) => {
                  const isReal = row.patrimonyBrl !== null;
                  return (
                    <tr
                      key={row.year}
                      className={`hover:bg-[#23272f]/50 ${
                        row.year === 2026 ? 'bg-amber-500/10 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 px-1.5 text-slate-300">{row.age}</td>
                      <td className="py-2 px-1.5 font-bold text-white">{row.year}</td>
                      <td className="py-2 px-1.5 text-right text-slate-300">
                        {formatCurrency(row.goalBrl, currency, ptax, hideValues, true)}
                      </td>
                      <td
                        className={`py-2 px-1.5 text-right font-semibold ${
                          isReal ? 'text-emerald-400' : 'text-blue-400/80'
                        }`}
                      >
                        {formatCurrency(
                          isReal ? (row.patrimonyBrl as number) : row.projectedBrl,
                          currency,
                          ptax,
                          hideValues,
                          true
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right">
                        {isReal ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.statusPct >= 100
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {row.statusPct}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Proj.</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 text-right text-slate-300">
                        {row.yoyVarPct !== null ? formatPct(row.yoyVarPct, 1, true) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
