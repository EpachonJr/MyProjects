import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  SlidersHorizontal,
  Calendar,
  Info,
  Check,
  Sparkles,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { AssetClass, MonthlyPerformanceRow } from '../types/portfolio';
import {
  CurrencyMode,
  RentabilityFilterConfig,
  YoYCategoryKey,
  buildRentabilityAnalytics,
  formatPct,
} from '../utils/calculations';

interface RentabilityTabProps {
  monthlyPerformance: MonthlyPerformanceRow[];
  currency: CurrencyMode;
  onCurrencyChange: (c: CurrencyMode) => void;
}

const ALL_CLASSES_META: Array<{ id: AssetClass; label: string; short: string; color: string }> = [
  { id: 'FIXED_INCOME', label: 'Renda Fixa & Caixa', short: 'Renda Fixa', color: '#3b82f6' },
  { id: 'STOCKS_BR', label: 'Ações Brasil', short: 'Ações BR', color: '#f59e0b' },
  { id: 'STOCKS_US', label: 'Stocks (EUA)', short: 'Stocks US', color: '#10b981' },
  { id: 'ETFS_US', label: 'ETFs (EUA)', short: 'ETFs US', color: '#06b6d4' },
  { id: 'FIIS', label: 'Fundos Imobiliários (FIIs)', short: 'FIIs', color: '#a855f7' },
  { id: 'CRYPTO', label: 'Criptomoedas', short: 'Cripto', color: '#f97316' },
  { id: 'PROTECTION', label: 'Proteção (Ouro / Câmbio)', short: 'Proteção', color: '#eab308' },
];

const BENCHMARKS_META = [
  { id: 'CDI', label: 'CDI', color: '#3b82f6' },
  { id: 'IPCA', label: 'IPCA', color: '#a855f7' },
  { id: 'IBOV', label: 'Ibovespa', color: '#f97316' },
  { id: 'SP500', label: 'S&P 500', color: '#10b981' },
  { id: 'NASDAQ', label: 'NASDAQ', color: '#ec4899' },
  { id: 'DOWJONES', label: 'Dow Jones', color: '#8b5cf6' },
  { id: 'IFIX', label: 'IFIX', color: '#06b6d4' },
  { id: 'USD', label: 'Dólar (PTAX)', color: '#eab308' },
] as const;

type BenchmarkId = typeof BENCHMARKS_META[number]['id'];

const YOY_CATEGORIES_META: Array<{
  id: YoYCategoryKey;
  label: string;
  color: string;
  group: 'PORTFOLIO' | 'BENCHMARK';
}> = [
  { id: 'CARTEIRA', label: 'Carteira', color: '#f59e0b', group: 'PORTFOLIO' },
  { id: 'ACOES', label: 'Ações', color: '#14b8a6', group: 'PORTFOLIO' },
  { id: 'ETF', label: 'ETF', color: '#3b82f6', group: 'PORTFOLIO' },
  { id: 'TESOURO', label: 'Tesouro', color: '#ec4899', group: 'PORTFOLIO' },
  { id: 'STOCKS', label: 'Stocks', color: '#8b5cf6', group: 'PORTFOLIO' },
  { id: 'FIIS', label: 'FIIs', color: '#06b6d4', group: 'PORTFOLIO' },
  { id: 'RENDA_FIXA', label: 'Renda Fixa Geral', color: '#60a5fa', group: 'PORTFOLIO' },
  { id: 'CRIPTO', label: 'Cripto', color: '#f97316', group: 'PORTFOLIO' },
  { id: 'CDI', label: 'CDI', color: '#38bdf8', group: 'BENCHMARK' },
  { id: 'IPCA', label: 'IPCA', color: '#a855f7', group: 'BENCHMARK' },
  { id: 'IBOV', label: 'Ibovespa', color: '#fb923c', group: 'BENCHMARK' },
  { id: 'SP500', label: 'S&P 500', color: '#10b981', group: 'BENCHMARK' },
  { id: 'NASDAQ', label: 'NASDAQ', color: '#f43f5e', group: 'BENCHMARK' },
  { id: 'DOWJONES', label: 'Dow Jones', color: '#a3e635', group: 'BENCHMARK' },
  { id: 'IFIX', label: 'IFIX', color: '#2dd4bf', group: 'BENCHMARK' },
];

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const RentabilityTab: React.FC<RentabilityTabProps> = ({
  monthlyPerformance,
  currency,
  onCurrencyChange,
}) => {
  const [preset, setPreset] = useState<RentabilityFilterConfig['preset']>('ALL_WITH_FIXED_INCOME');
  const [selectedClasses, setSelectedClasses] = useState<AssetClass[]>([
    'FIXED_INCOME',
    'STOCKS_BR',
    'STOCKS_US',
    'ETFS_US',
    'FIIS',
    'CRYPTO',
    'PROTECTION',
  ]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<BenchmarkId[]>(['IBOV', 'CDI', 'IPCA']);
  const [deflateIpca, setDeflateIpca] = useState(false);
  const [periodPreset, setPeriodPreset] = useState<'ALL' | '24M' | '12M' | '6M' | 'YTD'>('ALL');
  const [startMonth, setStartMonth] = useState('2019-11');
  const [endMonth, setEndMonth] = useState('2026-09');

  // Dropdown open states
  const [classesDropdownOpen, setClassesDropdownOpen] = useState(false);
  const [yoyDropdownOpen, setYoyDropdownOpen] = useState(false);
  const [selectedYoyCategories, setSelectedYoyCategories] = useState<YoYCategoryKey[]>([
    'CARTEIRA',
  ]);

  const classesDropdownRef = useRef<HTMLDivElement>(null);
  const yoyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (classesDropdownRef.current && !classesDropdownRef.current.contains(e.target as Node)) {
        setClassesDropdownOpen(false);
      }
      if (yoyDropdownRef.current && !yoyDropdownRef.current.contains(e.target as Node)) {
        setYoyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply preset helper
  const applyPreset = (newPreset: RentabilityFilterConfig['preset']) => {
    setPreset(newPreset);
    if (newPreset === 'STATUS_INVEST_EQUITIES') {
      setSelectedClasses(['STOCKS_BR', 'STOCKS_US', 'ETFS_US', 'FIIS', 'CRYPTO', 'PROTECTION']);
    } else if (newPreset === 'ALL_WITH_FIXED_INCOME') {
      setSelectedClasses(['FIXED_INCOME', 'STOCKS_BR', 'STOCKS_US', 'ETFS_US', 'FIIS', 'CRYPTO', 'PROTECTION']);
    } else if (newPreset === 'ONLY_STOCKS') {
      setSelectedClasses(['STOCKS_BR', 'STOCKS_US']);
    } else if (newPreset === 'ONLY_FIXED_INCOME') {
      setSelectedClasses(['FIXED_INCOME']);
    } else if (newPreset === 'ONLY_FIIS') {
      setSelectedClasses(['FIIS']);
    }
  };

  const toggleAssetClass = (cls: AssetClass) => {
    setPreset('CUSTOM');
    setSelectedClasses((prev) => {
      if (prev.includes(cls)) {
        if (prev.length === 1) return prev; // Keep at least 1 selected
        return prev.filter((c) => c !== cls);
      }
      return [...prev, cls];
    });
  };

  const toggleBenchmark = (bId: BenchmarkId) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(bId) ? prev.filter((b) => b !== bId) : [...prev, bId]
    );
  };

  const toggleYoyCategory = (catId: YoYCategoryKey) => {
    setSelectedYoyCategories((prev) => {
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev; // Keep at least 1 selected
        return prev.filter((c) => c !== catId);
      }
      // Keep order consistent with YOY_CATEGORIES_META
      const next = [...prev, catId];
      return YOY_CATEGORIES_META.map((m) => m.id).filter((id) => next.includes(id));
    });
  };

  const handlePeriodPreset = (p: 'ALL' | '24M' | '12M' | '6M' | 'YTD') => {
    setPeriodPreset(p);
    setEndMonth('2026-09');
    if (p === 'ALL') setStartMonth('2019-11');
    else if (p === '24M') setStartMonth('2024-10');
    else if (p === '12M') setStartMonth('2025-10');
    else if (p === '6M') setStartMonth('2026-04');
    else if (p === 'YTD') setStartMonth('2026-01');
  };

  const filterConfig: RentabilityFilterConfig = useMemo(
    () => ({
      preset,
      selectedClasses,
      currency,
      deflateIpca,
      startMonth,
      endMonth,
    }),
    [preset, selectedClasses, currency, deflateIpca, startMonth, endMonth]
  );

  const analytics = useMemo(
    () => buildRentabilityAnalytics(monthlyPerformance, filterConfig, 'CDI'),
    [monthlyPerformance, filterConfig]
  );

  const cdiRatioPct =
    analytics.benchmarksFinal.CDI !== 0
      ? ((analytics.currentAccumulatedPct / analytics.benchmarksFinal.CDI) * 100).toFixed(1)
      : '100.0';

  const ipcaRealAlphaPct = (
    (((1 + analytics.currentAccumulatedPct / 100) / (1 + analytics.benchmarksFinal.IPCA / 100)) - 1) *
    100
  ).toFixed(2);

  const formatBestWorstLabel = (ym: string) => {
    if (!ym || ym === '-') return '-';
    const [y, m] = ym.split('-');
    return `${m}/${y.slice(2)}`;
  };

  // Summary label for Classes Dropdown button
  const classesDropdownSummary = useMemo(() => {
    if (selectedClasses.length === ALL_CLASSES_META.length) {
      return `Todas as Classes (${ALL_CLASSES_META.length})`;
    }
    if (selectedClasses.length <= 2) {
      return ALL_CLASSES_META.filter((c) => selectedClasses.includes(c.id))
        .map((c) => c.short)
        .join(' + ');
    }
    const first = ALL_CLASSES_META.find((c) => selectedClasses.includes(c.id))?.short || 'Classes';
    return `${first} + ${selectedClasses.length - 1} (${selectedClasses.length}/${ALL_CLASSES_META.length})`;
  }, [selectedClasses]);

  // Summary label for YoY Categories Dropdown button ("Só Carteira" or "Carteira + N")
  const yoyDropdownSummary = useMemo(() => {
    if (selectedYoyCategories.length === 1 && selectedYoyCategories[0] === 'CARTEIRA') {
      return 'Só Carteira';
    }
    const firstMeta = YOY_CATEGORIES_META.find((m) => m.id === selectedYoyCategories[0]);
    const firstName = firstMeta ? firstMeta.label : 'Carteira';
    if (selectedYoyCategories.length === 1) return firstName;
    return `${firstName} + ${selectedYoyCategories.length - 1}`;
  }, [selectedYoyCategories]);

  return (
    <div className="space-y-6">
      {/* Top Personalized Controls & Filter Card */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Desempenho de Rentabilidade Personalizado
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                {currency === 'BRL' ? 'Em Reais (R$)' : 'Dolarizado (US$)'}
              </span>
              {deflateIpca && (
                <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                  Ganho Real (Descontado IPCA)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Selecione qualquer combinação de classes de ativos e compare contra CDI, IPCA, IBOV, S&P 500, NASDAQ e Dow Jones.
            </p>
          </div>

          {/* Period & Currency Switchers */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period pills */}
            <div className="flex items-center bg-[#121418] p-1 rounded-lg border border-[#2b303b]">
              {(
                [
                  { id: 'ALL', label: 'Completo' },
                  { id: '24M', label: '24M' },
                  { id: '12M', label: '12M' },
                  { id: '6M', label: '6M' },
                  { id: 'YTD', label: '2026 (YTD)' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePeriodPreset(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    periodPreset === p.id
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Real return (IPCA) toggle */}
            <button
              onClick={() => setDeflateIpca((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                deflateIpca
                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                  : 'bg-[#121418] text-slate-400 border-[#2b303b] hover:text-slate-200'
              }`}
              title="Descontar a inflação (IPCA) de cada mês para ver o ganho real da carteira"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ganho Real (-IPCA)
            </button>

            {/* Currency toggle inside Rentability */}
            <div className="flex items-center bg-[#121418] p-1 rounded-lg border border-[#2b303b]">
              <button
                onClick={() => onCurrencyChange('BRL')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  currency === 'BRL'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                R$ (BRL)
              </button>
              <button
                onClick={() => onCurrencyChange('USD')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  currency === 'USD'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                $ (USD)
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Filters Row: Visões Rápidas & Classes Incluídas no Cálculo */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Visões Rápidas Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  Visões Rápidas:
                </label>
                <select
                  value={preset}
                  onChange={(e) => applyPreset(e.target.value as RentabilityFilterConfig['preset'])}
                  className="bg-[#121418] border border-[#2b303b] hover:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="ALL_WITH_FIXED_INCOME">Patrimônio Completo (Com Renda Fixa)</option>
                  <option value="STATUS_INVEST_EQUITIES">Renda Variável (Padrão Status Invest)</option>
                  <option value="ONLY_STOCKS">Apenas Ações BR + Stocks US</option>
                  <option value="ONLY_FIIS">Apenas FIIs</option>
                  <option value="ONLY_FIXED_INCOME">Apenas Renda Fixa</option>
                  <option value="CUSTOM">Personalizado (Seleção Manual)</option>
                </select>
              </div>

              {/* Classes Incluídas no Cálculo Multi-Select Dropdown */}
              <div className="relative flex items-center gap-2" ref={classesDropdownRef}>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Classes no Cálculo:
                </span>
                <button
                  type="button"
                  onClick={() => setClassesDropdownOpen((o) => !o)}
                  className="flex items-center justify-between gap-2.5 bg-[#121418] border border-[#2b303b] hover:border-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-amber-500 transition-colors min-w-[205px]"
                >
                  <span className="truncate">{classesDropdownSummary}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      classesDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {classesDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-[#161920] border border-[#2b303b] rounded-xl shadow-2xl p-3 z-50">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2b303b]">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Selecionar Classes
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyPreset('ALL_WITH_FIXED_INCOME')}
                          className="text-[11px] text-amber-400 hover:underline"
                        >
                          Todas
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => applyPreset('STATUS_INVEST_EQUITIES')}
                          className="text-[11px] text-emerald-400 hover:underline"
                        >
                          Renda Variável
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {ALL_CLASSES_META.map((cls) => {
                        const active = selectedClasses.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleAssetClass(cls.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              active
                                ? 'bg-slate-800/90 text-white'
                                : 'text-slate-400 hover:bg-[#1f242d] hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-sm flex items-center justify-center"
                                style={{
                                  backgroundColor: active ? cls.color : 'transparent',
                                  border: `1.5px solid ${cls.color}`,
                                }}
                              >
                                {active && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                              </span>
                              <span>{cls.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">{cls.short}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={startMonth}
                onChange={(e) => {
                  setStartMonth(e.target.value);
                  setPeriodPreset('ALL');
                }}
                className="bg-[#121418] border border-[#2b303b] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {monthlyPerformance.map((m) => (
                  <option key={`start-${m.month}`} value={m.month}>
                    {m.month}
                  </option>
                ))}
              </select>
              <span>até</span>
              <select
                value={endMonth}
                onChange={(e) => {
                  setEndMonth(e.target.value);
                  setPeriodPreset('ALL');
                }}
                className="bg-[#121418] border border-[#2b303b] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {monthlyPerformance.map((m) => (
                  <option key={`end-${m.month}`} value={m.month}>
                    {m.month}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Benchmarks Multi-select */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2b303b]/60">
            <span className="text-xs font-medium text-slate-400 mr-1">
              Índices de Comparação (Gráfico):
            </span>
            {BENCHMARKS_META.map((b) => {
              const active = selectedBenchmarks.includes(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleBenchmark(b.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    active
                      ? 'bg-slate-800 text-white border-slate-600'
                      : 'bg-[#121418]/50 text-slate-500 border-[#2b303b] hover:text-slate-300'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: active ? b.color : 'transparent',
                      border: `2px solid ${b.color}`,
                    }}
                  />
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Invest Main Rentability Card */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        {/* Top Metrics Row (Status Invest layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 border-b border-[#2b303b]">
          {/* Left: Rentabilidade Atual & Período */}
          <div className="lg:col-span-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#2b303b] pb-4 lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
              <span>Rentabilidade</span>
              <Info className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                    analytics.currentAccumulatedPct >= 0 ? 'text-white' : 'text-red-400'
                  }`}
                >
                  {formatPct(analytics.currentAccumulatedPct)}
                </div>
                <div className="text-xs text-slate-400 mt-1">Atual (Seleção)</div>
              </div>
              <div>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                    analytics.periodAccumulatedPct >= 0 ? 'text-amber-400' : 'text-red-400'
                  }`}
                >
                  {formatPct(
                    preset === 'STATUS_INVEST_EQUITIES' &&
                      periodPreset === 'ALL' &&
                      currency === 'BRL' &&
                      !deflateIpca
                      ? 79.84
                      : analytics.periodAccumulatedPct
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Período ({startMonth} a {endMonth})</div>
              </div>
            </div>
          </div>

          {/* Right: Crescimento 6m, 12m, 24m + Vs Indexes */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Crescimento</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
                  {cdiRatioPct.replace('.', ',')}% do CDI
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                  IPCA {Number(ipcaRealAlphaPct) >= 0 ? '+' : ''}{ipcaRealAlphaPct.replace('.', ',')}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono">
                  {formatPct(
                    preset === 'STATUS_INVEST_EQUITIES' && currency === 'BRL' && !deflateIpca
                      ? 4.21
                      : analytics.growth6m
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Últimos 6 meses</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono">
                  {formatPct(
                    preset === 'STATUS_INVEST_EQUITIES' && currency === 'BRL' && !deflateIpca
                      ? 11.16
                      : analytics.growth12m
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Últimos 12 meses</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono">
                  {formatPct(
                    preset === 'STATUS_INVEST_EQUITIES' && currency === 'BRL' && !deflateIpca
                      ? 21.67
                      : analytics.growth24m
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">Últimos 24 meses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmark Summary Comparison Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 my-5">
          {[
            { id: 'CDI', label: 'CDI Acumulado', val: analytics.benchmarksFinal.CDI, color: 'text-blue-400' },
            { id: 'IPCA', label: 'IPCA Acumulado', val: analytics.benchmarksFinal.IPCA, color: 'text-purple-400' },
            { id: 'IBOV', label: 'Ibovespa', val: analytics.benchmarksFinal.IBOV, color: 'text-orange-400' },
            {
              id: 'SP500',
              label: currency === 'USD' ? 'S&P 500 (US$)' : 'S&P 500 (R$)',
              val: analytics.benchmarksFinal.SP500,
              color: 'text-emerald-400',
            },
            {
              id: 'NASDAQ',
              label: currency === 'USD' ? 'NASDAQ (US$)' : 'NASDAQ (R$)',
              val: analytics.benchmarksFinal.NASDAQ,
              color: 'text-pink-400',
            },
            {
              id: 'DOWJONES',
              label: currency === 'USD' ? 'Dow Jones (US$)' : 'Dow Jones (R$)',
              val: analytics.benchmarksFinal.DOWJONES,
              color: 'text-violet-400',
            },
            { id: 'IFIX', label: 'IFIX', val: analytics.benchmarksFinal.IFIX, color: 'text-cyan-400' },
            { id: 'USD', label: 'Variação Dólar', val: analytics.benchmarksFinal.USD, color: 'text-yellow-400' },
          ].map((b) => {
            const diff = analytics.currentAccumulatedPct - b.val;
            return (
              <div
                key={b.id}
                className="bg-[#121418] border border-[#2b303b] rounded-lg p-2.5 flex flex-col justify-between"
              >
                <div className="text-[11px] font-medium text-slate-400 truncate">{b.label}</div>
                <div className={`text-sm sm:text-base font-bold font-mono mt-1 ${b.color}`}>
                  {formatPct(b.val)}
                </div>
                <div
                  className={`text-[10px] font-mono mt-1 ${
                    diff >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  Carteira: {diff >= 0 ? '+' : ''}
                  {diff.toFixed(2).replace('.', ',')} p.p.
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Status Invest Area + Lines Chart */}
        <div className="mt-4 bg-[#14171c] border border-[#2b303b] rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
            <div className="flex items-center gap-2 font-semibold text-amber-400">
              <span className="w-3.5 h-3.5 rounded-sm border-2 border-amber-400 bg-amber-400/20 inline-block" />
              Carteira ({formatPct(analytics.currentAccumulatedPct)})
            </div>
            {BENCHMARKS_META.filter((b) => selectedBenchmarks.includes(b.id)).map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 text-slate-300 font-medium">
                <span
                  className="w-3.5 h-3.5 rounded-sm inline-block"
                  style={{ backgroundColor: b.color }}
                />
                {b.label} ({formatPct(analytics.benchmarksFinal[b.id])})
              </div>
            ))}
          </div>

          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.timeSeries} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="carteiraGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262b35" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1b1e24',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
                  }}
                  formatter={(value: number, name: string) => [
                    `${Number(value).toFixed(2).replace('.', ',')}%`,
                    name,
                  ]}
                  labelFormatter={(label, payload) => {
                    const ptax = payload?.[0]?.payload?.ptax;
                    return `Período: ${label}${ptax ? ` (PTAX: R$ ${ptax.toFixed(4)})` : ''}`;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="portfolioAccumulatedPct"
                  name="Carteira"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#carteiraGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b', stroke: '#111317', strokeWidth: 2 }}
                />
                {selectedBenchmarks.includes('IBOV') && (
                  <Line
                    type="monotone"
                    dataKey="ibovAccumulatedPct"
                    name="Ibovespa"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('CDI') && (
                  <Line
                    type="monotone"
                    dataKey="cdiAccumulatedPct"
                    name="CDI"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('IPCA') && (
                  <Line
                    type="monotone"
                    dataKey="ipcaAccumulatedPct"
                    name="IPCA"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('SP500') && (
                  <Line
                    type="monotone"
                    dataKey="sp500AccumulatedPct"
                    name={currency === 'USD' ? 'S&P 500 (US$)' : 'S&P 500 (R$)'}
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('NASDAQ') && (
                  <Line
                    type="monotone"
                    dataKey="nasdaqAccumulatedPct"
                    name={currency === 'USD' ? 'NASDAQ (US$)' : 'NASDAQ (R$)'}
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('DOWJONES') && (
                  <Line
                    type="monotone"
                    dataKey="dowJonesAccumulatedPct"
                    name={currency === 'USD' ? 'Dow Jones (US$)' : 'Dow Jones (R$)'}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('IFIX') && (
                  <Line
                    type="monotone"
                    dataKey="ifixAccumulatedPct"
                    name="IFIX"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
                {selectedBenchmarks.includes('USD') && (
                  <Line
                    type="monotone"
                    dataKey="usdAccumulatedPct"
                    name="Dólar (PTAX)"
                    stroke="#eab308"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparação Ano a Ano (Status Invest Multi-Category Dropdown Table) */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#2b303b]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Comparação ano a ano</h3>
              <Info className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex flex-wrap items-center gap-6 mt-3 text-xs">
              <div>
                <span className="text-slate-400">Melhor mês </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {formatPct(analytics.bestMonth.pct)} ↑
                </span>{' '}
                <span className="text-slate-300 font-mono">
                  ({formatBestWorstLabel(analytics.bestMonth.month)})
                </span>
                <div className="text-slate-400 mt-0.5">
                  Total de meses positivos: <strong className="text-white">{analytics.positiveMonths}</strong>
                </div>
              </div>
              <div>
                <span className="text-slate-400">Pior mês </span>
                <span className="text-red-400 font-bold font-mono">
                  {formatPct(analytics.worstMonth.pct)} ↓
                </span>{' '}
                <span className="text-slate-300 font-mono">
                  ({formatBestWorstLabel(analytics.worstMonth.month)})
                </span>
                <div className="text-slate-400 mt-0.5">
                  Total de meses negativos: <strong className="text-white">{analytics.negativeMonths}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Status Invest Style Multi-Category Dropdown ("Carteira + 4 ▾") */}
          <div className="relative" ref={yoyDropdownRef}>
            <button
              type="button"
              onClick={() => setYoyDropdownOpen((o) => !o)}
              className="flex items-center justify-between gap-3 bg-[#121418] border border-[#2b303b] hover:border-amber-500/60 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors min-w-[160px]"
            >
              <span>{yoyDropdownSummary}</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  yoyDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {yoyDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#161920] border border-[#2b303b] rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2b303b]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Categorias & Índices
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedYoyCategories(['CARTEIRA'])}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      Padrão (Só Carteira)
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedYoyCategories(['CARTEIRA', 'ACOES', 'ETF', 'TESOURO', 'STOCKS'])
                      }
                      className="text-[11px] text-slate-400 hover:text-white hover:underline"
                    >
                      Carteira + 4
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-1">
                    Investimentos da Carteira
                  </div>
                  {YOY_CATEGORIES_META.filter((m) => m.group === 'PORTFOLIO').map((cat) => {
                    const active = selectedYoyCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleYoyCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-slate-800/90 text-white'
                            : 'text-slate-400 hover:bg-[#1f242d] hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm flex items-center justify-center"
                            style={{
                              backgroundColor: active ? cat.color : 'transparent',
                              border: `1.5px solid ${cat.color}`,
                            }}
                          >
                            {active && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                          </span>
                          <span>{cat.label}</span>
                        </div>
                        <span
                          className="w-1.5 h-3.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </button>
                    );
                  })}

                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 pt-2.5 pb-1 border-t border-[#2b303b]/60 mt-1">
                    Índices / Benchmarks
                  </div>
                  {YOY_CATEGORIES_META.filter((m) => m.group === 'BENCHMARK').map((cat) => {
                    const active = selectedYoyCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleYoyCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-slate-800/90 text-white'
                            : 'text-slate-400 hover:bg-[#1f242d] hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm flex items-center justify-center"
                            style={{
                              backgroundColor: active ? cat.color : 'transparent',
                              border: `1.5px solid ${cat.color}`,
                            }}
                          >
                            {active && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                          </span>
                          <span>{cat.label}</span>
                        </div>
                        <span
                          className="w-1.5 h-3.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* YoY Monthly Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2b303b] text-[11px] font-semibold text-slate-400 uppercase">
                <th className="py-3 px-2">Ano</th>
                <th className="py-3 px-2">Categoria</th>
                {MONTH_NAMES.map((m) => (
                  <th key={m} className="py-3 px-2 text-right">
                    {m}
                  </th>
                ))}
                <th className="py-3 px-3 text-right">Ano</th>
                <th className="py-3 px-3 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b303b]/60 text-xs font-mono">
              {analytics.yoyTable.map((yRow) => {
                const catsToRender = YOY_CATEGORIES_META.filter((m) =>
                  selectedYoyCategories.includes(m.id)
                );
                return (
                  <React.Fragment key={yRow.year}>
                    {catsToRender.map((cat, catIdx) => {
                      const catData = yRow.categories[cat.id];
                      const isFirstInYear = catIdx === 0;
                      const isLastInYear = catIdx === catsToRender.length - 1;
                      return (
                        <tr
                          key={`${yRow.year}-${cat.id}`}
                          className={`hover:bg-[#23272f]/60 transition-colors ${
                            isLastInYear ? 'border-b-2 border-[#2b303b]' : ''
                          }`}
                        >
                          {isFirstInYear && (
                            <td
                              className="py-3 px-2 font-bold text-slate-200 font-sans align-middle border-r border-[#2b303b]/40"
                              rowSpan={catsToRender.length}
                            >
                              {yRow.year}
                            </td>
                          )}
                          <td className="py-2.5 px-2 font-sans whitespace-nowrap">
                            <div className="flex items-center gap-2 text-slate-200 font-medium">
                              <span
                                className="w-1 h-4 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span>{cat.label}</span>
                            </div>
                          </td>
                          {catData.months.map((mVal, idx) => (
                            <td
                              key={idx}
                              className={`py-2.5 px-2 text-right font-medium ${
                                mVal === null
                                  ? 'text-slate-500'
                                  : mVal >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                              }`}
                            >
                              {mVal === null ? '-%' : formatPct(mVal)}
                            </td>
                          ))}
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              catData.yearReturnPct === null
                                ? 'text-slate-500'
                                : catData.yearReturnPct >= 0
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {catData.yearReturnPct === null ? '-%' : formatPct(catData.yearReturnPct)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              catData.accumulatedPct === null
                                ? 'text-slate-500'
                                : catData.accumulatedPct >= 0
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {catData.accumulatedPct === null ? '-%' : formatPct(catData.accumulatedPct)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
