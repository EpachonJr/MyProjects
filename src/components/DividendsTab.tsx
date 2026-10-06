import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Coins,
  TrendingUp,
  Award,
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import {
  DividendRecord,
  Holding,
  TransactionRecord,
} from '../types/portfolio';
import { INITIAL_DIVIDEND_MONTHLY_SERIES } from '../data/seedData';
import {
  CurrencyMode,
  computeLatest3mAvgDividendsBrl,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

interface AutoDetectedDividend {
  id: string;
  ticker: string;
  date: string;
  type: 'DIVIDENDO' | 'JSCP';
  qtyOnExDate: number;
  divPerShare: number;
  currency: 'BRL' | 'USD';
  grossValueBrl: number;
  irrfBrl: number;
  netValueBrl: number;
  broker: string;
  assetClass: DividendRecord['assetClass'];
  alreadyInSheet: boolean;
  matchedSheetDate: string | null;
}

interface DividendsTabProps {
  holdings: Holding[];
  transactions?: TransactionRecord[];
  recentDividends: DividendRecord[];
  onAddDividend: (div: DividendRecord) => void;
  onAddDividendsBatch?: (divs: DividendRecord[]) => void;
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

export const DividendsTab: React.FC<DividendsTabProps> = ({
  holdings,
  transactions = [],
  recentDividends,
  onAddDividend,
  onAddDividendsBatch,
  currency,
  ptax,
  hideValues,
}) => {
  const [chartGroupMode, setChartGroupMode] = useState<'YEARLY' | 'DETAILED'>('YEARLY');
  const [ticker, setTicker] = useState('XPLG11');
  const [date, setDate] = useState('2026-09-26');
  const [divType, setDivType] = useState<'DIVIDENDO' | 'JSCP'>('DIVIDENDO');
  const [netValBrl, setNetValBrl] = useState<number>(85.0);

  // Automatic Dividend Scanner state
  const [autoScanning, setAutoScanning] = useState(false);
  const [autoMonthsBack, setAutoMonthsBack] = useState<number>(3);
  const [autoDetected, setAutoDetected] = useState<AutoDetectedDividend[] | null>(null);
  const [autoFilter, setAutoFilter] = useState<'NEW_ONLY' | 'ALL'>('NEW_ONLY');
  const [copiedSheetRows, setCopiedSheetRows] = useState(false);

  const activeCustodyDividendsBrl = useMemo(
    () => holdings.reduce((acc, h) => acc + h.dividendsBrl, 0),
    [holdings]
  );

  const activeFiiDividendsBrl = useMemo(
    () => holdings.filter((h) => h.assetClass === 'FIIS').reduce((acc, h) => acc + h.dividendsBrl, 0),
    [holdings]
  );

  const activeStocksBrDividendsBrl = useMemo(
    () => holdings.filter((h) => h.assetClass === 'STOCKS_BR').reduce((acc, h) => acc + h.dividendsBrl, 0),
    [holdings]
  );

  const avg3mInfo = useMemo(
    () => computeLatest3mAvgDividendsBrl(recentDividends),
    [recentDividends]
  );

  // Dynamically compute historical totals & yearly/monthly chart series when full Google Sheets proventos are synced
  const isFullSheetSynced = recentDividends.length > 50;

  const totalHistoricalDividendsBrl = useMemo(() => {
    if (!isFullSheetSynced) return 40486.14;
    return Number(recentDividends.reduce((acc, d) => acc + d.netValueBrl, 0).toFixed(2));
  }, [recentDividends, isFullSheetSynced]);

  const total2026Brl = useMemo(() => {
    if (!isFullSheetSynced) return 11924.14;
    return Number(
      recentDividends
        .filter((d) => d.date.startsWith('2026-'))
        .reduce((acc, d) => acc + d.netValueBrl, 0)
        .toFixed(2)
    );
  }, [recentDividends, isFullSheetSynced]);

  const total2025Brl = useMemo(() => {
    if (!isFullSheetSynced) return 14849.21;
    return Number(
      recentDividends
        .filter((d) => d.date.startsWith('2025-'))
        .reduce((acc, d) => acc + d.netValueBrl, 0)
        .toFixed(2)
    );
  }, [recentDividends, isFullSheetSynced]);

  // Yearly aggregated series for chart
  const yearlyChartData = useMemo(() => {
    const factor = currency === 'USD' ? 1 / ptax : 1;
    if (isFullSheetSynced) {
      const map = new Map<number, { year: string; FIIs: number; AcoesBR: number; StocksUS: number; ETFsUS: number; total: number }>();
      for (const d of recentDividends) {
        const y = parseInt(d.date.slice(0, 4), 10);
        if (Number.isNaN(y) || y < 2019) continue;
        if (!map.has(y)) {
          map.set(y, { year: String(y), FIIs: 0, AcoesBR: 0, StocksUS: 0, ETFsUS: 0, total: 0 });
        }
        const entry = map.get(y)!;
        const val = d.netValueBrl * factor;
        if (d.assetClass === 'FII') entry.FIIs = Number((entry.FIIs + val).toFixed(2));
        else if (d.assetClass === 'AÇÃO') entry.AcoesBR = Number((entry.AcoesBR + val).toFixed(2));
        else if (d.assetClass === 'ETF_US') entry.ETFsUS = Number((entry.ETFsUS + val).toFixed(2));
        else entry.StocksUS = Number((entry.StocksUS + val).toFixed(2));
        entry.total = Number((entry.total + val).toFixed(2));
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v);
    }

    const map = new Map<number, { year: string; FIIs: number; AcoesBR: number; StocksUS: number; ETFsUS: number; total: number }>();
    for (const item of INITIAL_DIVIDEND_MONTHLY_SERIES) {
      if (!map.has(item.year)) {
        map.set(item.year, { year: String(item.year), FIIs: 0, AcoesBR: 0, StocksUS: 0, ETFsUS: 0, total: 0 });
      }
      const entry = map.get(item.year)!;
      entry.FIIs = Number((entry.FIIs + item.fiiBrl * factor).toFixed(2));
      entry.AcoesBR = Number((entry.AcoesBR + item.acoesBrBrl * factor).toFixed(2));
      entry.StocksUS = Number((entry.StocksUS + item.stocksUsBrl * factor).toFixed(2));
      entry.ETFsUS = Number((entry.ETFsUS + item.etfsUsBrl * factor).toFixed(2));
      entry.total = Number((entry.total + item.totalBrl * factor).toFixed(2));
    }
    return Array.from(map.values());
  }, [recentDividends, isFullSheetSynced, currency, ptax]);

  const detailedChartData = useMemo(() => {
    const factor = currency === 'USD' ? 1 / ptax : 1;
    if (isFullSheetSynced) {
      const map = new Map<string, { period: string; FIIs: number; AcoesBR: number; StocksUS: number; ETFsUS: number; total: number }>();
      for (const d of recentDividends) {
        const ym = d.date.slice(0, 7);
        if (!ym || ym < '2024-01') continue; // Show monthly detail from 2024 onwards for crisp readability
        if (!map.has(ym)) {
          map.set(ym, { period: ym, FIIs: 0, AcoesBR: 0, StocksUS: 0, ETFsUS: 0, total: 0 });
        }
        const entry = map.get(ym)!;
        const val = d.netValueBrl * factor;
        if (d.assetClass === 'FII') entry.FIIs = Number((entry.FIIs + val).toFixed(2));
        else if (d.assetClass === 'AÇÃO') entry.AcoesBR = Number((entry.AcoesBR + val).toFixed(2));
        else if (d.assetClass === 'ETF_US') entry.ETFsUS = Number((entry.ETFsUS + val).toFixed(2));
        else entry.StocksUS = Number((entry.StocksUS + val).toFixed(2));
        entry.total = Number((entry.total + val).toFixed(2));
      }
      return Array.from(map.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([, v]) => v);
    }

    return INITIAL_DIVIDEND_MONTHLY_SERIES.map((item) => ({
      period: item.month,
      FIIs: Number((item.fiiBrl * factor).toFixed(2)),
      AcoesBR: Number((item.acoesBrBrl * factor).toFixed(2)),
      StocksUS: Number((item.stocksUsBrl * factor).toFixed(2)),
      ETFsUS: Number((item.etfsUsBrl * factor).toFixed(2)),
      total: Number((item.totalBrl * factor).toFixed(2)),
    }));
  }, [recentDividends, isFullSheetSynced, currency, ptax]);

  // Top dividend payers across all active holdings
  const topDividendHoldings = useMemo(() => {
    return [...holdings]
      .filter((h) => h.dividendsBrl > 0)
      .sort((a, b) => b.dividendsBrl - a.dividendsBrl);
  }, [holdings]);

  const handleCreateDividend = (e: React.FormEvent) => {
    e.preventDefault();
    const h = holdings.find((x) => x.ticker === ticker);
    const cls: DividendRecord['assetClass'] =
      h?.assetClass === 'FIIS'
        ? 'FII'
        : h?.assetClass === 'STOCKS_BR'
          ? 'AÇÃO'
          : h?.assetClass === 'ETFS_US'
            ? 'ETF_US'
            : 'STOCK';

    onAddDividend({
      id: `div-${Date.now()}`,
      ticker,
      date,
      type: divType,
      netValueBrl: netValBrl,
      grossValueBrl: netValBrl,
      irrfBrl: 0,
      broker: h?.broker || 'XP',
      assetClass: cls,
    });
  };

  // Scan Yahoo Finance for dividends across all active Stocks, FIIs, and US ETFs
  const handleAutoScanDividends = async (months = autoMonthsBack) => {
    setAutoScanning(true);
    try {
      const resp = await fetch('/api/auto-dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings,
          transactions,
          recentDividends,
          ptax,
          monthsBack: months,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.items)) {
          setAutoDetected(data.items);
        }
      }
    } catch {
      // ignore network error
    } finally {
      setAutoScanning(false);
    }
  };

  // Toggle between DIVIDENDO (0% tax) and JSCP (15% tax) for B3 stocks
  const handleToggleAutoType = (id: string) => {
    setAutoDetected((prev) =>
      prev
        ? prev.map((item) => {
            if (item.id !== id) return item;
            const nextType = item.type === 'DIVIDENDO' ? 'JSCP' : 'DIVIDENDO';
            const taxRate = nextType === 'JSCP' ? 0.15 : item.currency === 'USD' ? 0.3 : 0;
            const irrfBrl = Number((item.grossValueBrl * taxRate).toFixed(2));
            const netValueBrl = Number((item.grossValueBrl - irrfBrl).toFixed(2));
            return { ...item, type: nextType, irrfBrl, netValueBrl };
          })
        : prev
    );
  };

  const handleIncorporateItem = (item: AutoDetectedDividend) => {
    const record: DividendRecord = {
      id: item.id,
      ticker: item.ticker,
      date: item.date,
      type: item.type,
      netValueBrl: item.netValueBrl,
      grossValueBrl: item.grossValueBrl,
      irrfBrl: item.irrfBrl,
      broker: item.broker,
      assetClass: item.assetClass,
    };
    onAddDividend(record);
    setAutoDetected((prev) =>
      prev ? prev.map((d) => (d.id === item.id ? { ...d, alreadyInSheet: true } : d)) : prev
    );
  };

  const newDetectedItems = useMemo(
    () => (autoDetected ? autoDetected.filter((d) => !d.alreadyInSheet) : []),
    [autoDetected]
  );

  const visibleDetectedItems = useMemo(() => {
    if (!autoDetected) return [];
    return autoFilter === 'NEW_ONLY' ? newDetectedItems : autoDetected;
  }, [autoDetected, autoFilter, newDetectedItems]);

  const handleIncorporateAllNew = () => {
    if (newDetectedItems.length === 0) return;
    const records: DividendRecord[] = newDetectedItems.map((item) => ({
      id: item.id,
      ticker: item.ticker,
      date: item.date,
      type: item.type,
      netValueBrl: item.netValueBrl,
      grossValueBrl: item.grossValueBrl,
      irrfBrl: item.irrfBrl,
      broker: item.broker,
      assetClass: item.assetClass,
    }));
    if (onAddDividendsBatch) {
      onAddDividendsBatch(records);
    } else {
      records.forEach((r) => onAddDividend(r));
    }
    setAutoDetected((prev) =>
      prev ? prev.map((d) => ({ ...d, alreadyInSheet: true })) : prev
    );
  };

  const handleCopyNewForSheet = () => {
    if (newDetectedItems.length === 0) return;
    const lines = newDetectedItems.map((d) => {
      const [yyyy, mm, dd] = d.date.split('-');
      const brDate = `${dd}/${mm}/${yyyy}`;
      const brGross = d.grossValueBrl.toFixed(2).replace('.', ',');
      const brIrrf = d.irrfBrl.toFixed(2).replace('.', ',');
      const brNet = d.netValueBrl.toFixed(2).replace('.', ',');
      return `${d.ticker}\t${brDate}\t${d.type}\t${brGross}\t${brIrrf}\t${brNet}\t${d.broker}\t${d.assetClass}`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSheetRows(true);
    setTimeout(() => setCopiedSheetRows(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Proventos Históricos Totais</div>
          <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
            {formatCurrency(totalHistoricalDividendsBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {recentDividends.length} lançamentos sincronizados (2019–2026)
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Proventos da Custódia Ativa</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            {formatCurrency(activeCustodyDividendsBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            FIIs: {formatCurrency(activeFiiDividendsBrl, currency, ptax, hideValues)} • Ações BR: {formatCurrency(activeStocksBrDividendsBrl, currency, ptax, hideValues)}
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Média Mensal (Últimos 3 Meses - Automático)</div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1">
            {formatCurrency(avg3mInfo.avg3mBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Meses base: {avg3mInfo.latest3Months.map((m) => m.month).join(', ')}
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Total 2026 (Acumulado)</div>
          <div className="text-2xl font-extrabold font-mono text-blue-400 mt-1">
            {formatCurrency(total2026Brl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            2025 Completo: {formatCurrency(total2025Brl, currency, ptax, hideValues)}
          </div>
        </div>
      </div>

      {/* Automatic Dividend Pull / Radar (Yahoo Finance B3 & US) */}
      <div className="bg-gradient-to-r from-[#1b1e24] via-[#1b1e24] to-emerald-950/25 border border-emerald-500/30 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                Radar Automático de Proventos (B3 & EUA — Yahoo Finance)
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Cruzamento Automático c/ Custódia
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Busca automaticamente todos os dividendos pagos pelos seus FIIs, Ações BR, Stocks US e ETFs US, calcula a quantidade exata que você tinha na Data Com e identifica o que ainda não foi lançado na planilha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={autoMonthsBack}
              onChange={(e) => {
                const m = Number(e.target.value);
                setAutoMonthsBack(m);
                if (autoDetected) handleAutoScanDividends(m);
              }}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-xs text-white font-medium"
            >
              <option value={1}>Último 1 mês</option>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>

            <button
              type="button"
              onClick={() => handleAutoScanDividends(autoMonthsBack)}
              disabled={autoScanning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoScanning ? 'animate-spin' : ''}`} />
              {autoScanning ? 'Buscando na B3 & NYSE...' : 'Buscar Proventos Automaticamente'}
            </button>
          </div>
        </div>

        {autoDetected && (
          <div className="mt-4 pt-4 border-t border-[#2b303b]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                  {newDetectedItems.length} novos proventos encontrados (Total:{' '}
                  {formatCurrency(
                    newDetectedItems.reduce((a, b) => a + b.netValueBrl, 0),
                    currency,
                    ptax,
                    hideValues
                  )}
                  )
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium">
                  {autoDetected.length - newDetectedItems.length} já constam na planilha
                </span>

                <div className="flex items-center bg-[#121418] p-0.5 rounded-lg border border-[#2b303b]">
                  <button
                    type="button"
                    onClick={() => setAutoFilter('NEW_ONLY')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      autoFilter === 'NEW_ONLY'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Apenas Novos ({newDetectedItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      autoFilter === 'ALL'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({autoDetected.length})
                  </button>
                </div>
              </div>

              {newDetectedItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyNewForSheet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121418] hover:bg-slate-800 border border-[#2b303b] text-xs font-semibold text-slate-200 transition-colors"
                    title="Copia as linhas prontas para colar (Ctrl+V) na aba proventos do Google Sheets"
                  >
                    {copiedSheetRows ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copiado p/ Planilha!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        Copiar Linhas p/ Google Sheets
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleIncorporateAllNew}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Incorporar Todos os Novos ({newDetectedItems.length})
                  </button>
                </div>
              )}
            </div>

            {visibleDetectedItems.length === 0 ? (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                ✓ Todos os proventos detectados nos últimos {autoMonthsBack} meses já estão registrados na sua carteira!
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[280px]">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="sticky top-0 bg-[#1b1e24] border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                    <tr>
                      <th className="py-2 px-2.5">Ativo</th>
                      <th className="py-2 px-2.5">Data Ex</th>
                      <th className="py-2 px-2.5">Tipo (IR)</th>
                      <th className="py-2 px-2.5 text-right">Qtd na Data</th>
                      <th className="py-2 px-2.5 text-right">Valor/Cota</th>
                      <th className="py-2 px-2.5 text-right">Líquido (R$)</th>
                      <th className="py-2 px-2.5 text-right">Status / Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b303b]/50">
                    {visibleDetectedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#23272f]/50">
                        <td className="py-2 px-2.5 font-bold text-white">
                          {item.ticker}{' '}
                          <span className="text-[10px] font-sans font-normal text-slate-400">
                            ({item.assetClass})
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-300">{item.date}</td>
                        <td className="py-2 px-2.5">
                          {item.assetClass === 'AÇÃO' && !item.alreadyInSheet ? (
                            <button
                              type="button"
                              onClick={() => handleToggleAutoType(item.id)}
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] border border-amber-500/30"
                              title="Clique para alternar entre Dividendo (Isento) e JSCP (-15% IR)"
                            >
                              {item.type === 'JSCP' ? 'JSCP (-15%)' : 'DIVIDENDO (0%)'} ↻
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {item.currency === 'USD' ? 'DIV US (-30%)' : item.type}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-300">{item.qtyOnExDate}</td>
                        <td className="py-2 px-2.5 text-right text-slate-400">
                          {item.currency === 'USD' ? 'US$ ' : 'R$ '}
                          {item.divPerShare.toFixed(4).replace('.', ',')}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-emerald-400">
                          +{formatCurrency(item.netValueBrl, currency, ptax, hideValues)}
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          {item.alreadyInSheet ? (
                            <span className="text-[10px] text-slate-500 font-sans">
                              ✓ Já lançado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleIncorporateItem(item)}
                              className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-sans font-bold"
                            >
                              + Incorporar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Stacked Bar Chart + Top Payers Ranking */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Stacked Bar Chart */}
        <div className="xl:col-span-7 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#2b303b]">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Evolução de Proventos por Classe (2019–2026)
              </h3>
              <p className="text-xs text-slate-400">
                Crescimento da sua renda passiva em FIIs, Ações BR, Stocks US e ETFs US.
              </p>
            </div>

            <div className="flex items-center bg-[#121418] p-1 rounded-lg border border-[#2b303b]">
              <button
                onClick={() => setChartGroupMode('YEARLY')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  chartGroupMode === 'YEARLY'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anual (2019-2026)
              </button>
              <button
                onClick={() => setChartGroupMode('DETAILED')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  chartGroupMode === 'DETAILED'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Detalhado (Trimestral/Mensal)
              </button>
            </div>
          </div>

          <div className="h-[340px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartGroupMode === 'YEARLY' ? yearlyChartData : detailedChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#262b35" vertical={false} />
                <XAxis
                  dataKey={chartGroupMode === 'YEARLY' ? 'year' : 'period'}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(v) => (currency === 'BRL' ? `R$${v}` : `$${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121418',
                    borderColor: '#2b303b',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="FIIs" name="FIIs" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="AcoesBR" name="Ações BR" stackId="a" fill="#f59e0b" />
                <Bar dataKey="StocksUS" name="Stocks US" stackId="a" fill="#3b82f6" />
                <Bar dataKey="ETFsUS" name="ETFs US" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Payers Ranking (Page 6) */}
        <div className="xl:col-span-5 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white pb-3 border-b border-[#2b303b] flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Top Pagadores de Proventos & Yield on Cost
          </h3>
          <div className="overflow-y-auto max-h-[345px] mt-3 pr-1">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-[#1b1e24] border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                <tr>
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Ativo</th>
                  <th className="py-2 px-2 text-right">Total Recebido</th>
                  <th className="py-2 px-2 text-right">YoC Acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60">
                {topDividendHoldings.map((h, idx) => {
                  const yocPct = h.investedBrl > 0 ? (h.dividendsBrl / h.investedBrl) * 100 : 0;
                  return (
                    <tr key={h.id} className="hover:bg-[#23272f]/50">
                      <td className="py-2 px-2 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2 font-bold text-white">
                        {h.ticker}{' '}
                        <span className="text-[10px] font-sans font-normal text-slate-400">
                          ({h.macroGroup})
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-amber-400 font-semibold">
                        {formatCurrency(h.dividendsBrl, currency, ptax, hideValues)}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-400">
                        {formatPct(yocPct, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Dividends Log + Add New Dividend */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <h3 className="text-base font-bold text-white">
              Registro de Proventos Recebidos
            </h3>
            <p className="text-xs text-slate-400">
              Últimos dividendos e JSCP creditados e formulário rápido para novos lançamentos.
            </p>
          </div>

          <form onSubmit={handleCreateDividend} className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white"
            >
              {holdings
                .filter((h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS')
                .map((h) => (
                  <option key={h.id} value={h.ticker}>
                    {h.ticker}
                  </option>
                ))}
            </select>
            <select
              value={divType}
              onChange={(e) => setDivType(e.target.value as 'DIVIDENDO' | 'JSCP')}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white"
            >
              <option value="DIVIDENDO">DIVIDENDO</option>
              <option value="JSCP">JSCP</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
            <input
              type="number"
              step="any"
              required
              placeholder="Valor Líquido (R$)"
              value={netValBrl}
              onChange={(e) => setNetValBrl(parseFloat(e.target.value) || 0)}
              className="w-28 bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Provento
            </button>
          </form>
        </div>

        <div className="overflow-x-auto mt-4 max-h-[300px]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 bg-[#1b1e24] border-b border-[#2b303b] text-[11px] text-slate-400 uppercase font-sans">
              <tr>
                <th className="py-2.5 px-3">Ativo</th>
                <th className="py-2.5 px-3">Data Pagamento</th>
                <th className="py-2.5 px-3">Evento</th>
                <th className="py-2.5 px-3">Classe</th>
                <th className="py-2.5 px-3">Corretora</th>
                <th className="py-2.5 px-3 text-right">Valor Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b303b]/50">
              {recentDividends.map((d) => (
                <tr key={d.id} className="hover:bg-[#23272f]/50">
                  <td className="py-2 px-3 font-bold text-white">{d.ticker}</td>
                  <td className="py-2 px-3 text-slate-300">{d.date}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px]">
                      {d.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">{d.assetClass}</td>
                  <td className="py-2 px-3 text-slate-400">{d.broker}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-400">
                    +{formatCurrency(d.netValueBrl, currency, ptax, hideValues)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
