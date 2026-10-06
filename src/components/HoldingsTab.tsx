import React, { useState, useMemo } from 'react';
import {
  Search,
  Trophy,
  AlertTriangle,
  Edit3,
  Check,
  X,
  Info,
  Plus,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { AssetClass, Holding } from '../types/portfolio';
import { CurrencyMode, formatCurrency, formatPct } from '../utils/calculations';

interface HoldingsTabProps {
  holdings: Holding[];
  onUpdateHolding: (updated: Holding) => void;
  onAddHolding: (newHolding: Holding) => void;
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

export const HoldingsTab: React.FC<HoldingsTabProps> = ({
  holdings,
  onUpdateHolding,
  onAddHolding,
  currency,
  ptax,
  hideValues,
}) => {
  const [classFilter, setClassFilter] = useState<'ALL' | 'VARIABLE_ONLY' | AssetClass>('VARIABLE_ONLY');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'marketValueBrl' | 'openProfitPct' | 'dividendsBrl' | 'tirAnnualPct' | 'ticker'>('marketValueBrl');
  const [sortDesc, setSortDesc] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPriceBrl, setEditPriceBrl] = useState<number>(0);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Asset Modal State
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState<AssetClass>('STOCKS_BR');
  const [newBroker, setNewBroker] = useState('XP');
  const [newQty, setNewQty] = useState(10);
  const [newAvgPrice, setNewAvgPrice] = useState(20);
  const [newCurPrice, setNewCurPrice] = useState(22);

  // Compute Summary by Type
  const variableHoldings = useMemo(
    () => holdings.filter((h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS' && !h.isManual),
    [holdings]
  );

  const summaryByType = useMemo(() => {
    const groups: Array<{ label: string; cls: AssetClass; filterFn: (h: Holding) => boolean }> = [
      { label: 'ETFs US', cls: 'ETFS_US', filterFn: (h) => h.assetClass === 'ETFS_US' },
      { label: 'Stocks BR', cls: 'STOCKS_BR', filterFn: (h) => h.assetClass === 'STOCKS_BR' },
      { label: 'Stocks US', cls: 'STOCKS_US', filterFn: (h) => h.assetClass === 'STOCKS_US' },
      { label: 'FIIs', cls: 'FIIS', filterFn: (h) => h.assetClass === 'FIIS' },
      { label: 'Crypto', cls: 'CRYPTO', filterFn: (h) => h.assetClass === 'CRYPTO' },
      { label: 'Protection (IAU)', cls: 'PROTECTION', filterFn: (h) => h.ticker === 'IAU' },
    ];

    return groups.map((g) => {
      const items = holdings.filter(g.filterFn);
      const invested = items.reduce((a, b) => a + b.investedBrl, 0);
      const market = items.reduce((a, b) => a + b.marketValueBrl, 0);
      const profit = items.reduce((a, b) => a + b.openProfitBrl, 0);
      const dividends = items.reduce((a, b) => a + b.dividendsBrl, 0);
      const variationPct = invested > 0 ? (profit / invested) * 100 : 0;
      return {
        label: g.label,
        cls: g.cls,
        invested,
        market,
        profit,
        variationPct,
        dividends,
      };
    });
  }, [holdings]);

  const totalVarInvested = summaryByType.reduce((a, b) => a + b.invested, 0);
  const totalVarMarket = summaryByType.reduce((a, b) => a + b.market, 0);
  const totalVarProfit = summaryByType.reduce((a, b) => a + b.profit, 0);
  const totalVarDividends = summaryByType.reduce((a, b) => a + b.dividends, 0);
  const totalVarPct = totalVarInvested > 0 ? (totalVarProfit / totalVarInvested) * 100 : 0;

  // Compute Best & Worst Rank
  const ranks = useMemo(() => {
    const getBestWorst = (cls: AssetClass) => {
      const list = variableHoldings
        .filter((h) => h.assetClass === cls)
        .sort((a, b) => b.openProfitPct - a.openProfitPct);
      return {
        best: list[0] || null,
        worst: list[list.length - 1] || null,
      };
    };
    return {
      etfsUs: getBestWorst('ETFS_US'),
      stocksBr: getBestWorst('STOCKS_BR'),
      stocksUs: getBestWorst('STOCKS_US'),
      fiis: getBestWorst('FIIS'),
      crypto: getBestWorst('CRYPTO'),
    };
  }, [variableHoldings]);

  // Filtered and sorted holdings for main table
  const filteredHoldings = useMemo(() => {
    return holdings
      .filter((h) => {
        if (classFilter === 'VARIABLE_ONLY') {
          if (h.assetClass === 'FIXED_INCOME' || h.assetClass === 'FGTS' || h.isManual) return false;
        } else if (classFilter !== 'ALL') {
          if (h.assetClass !== classFilter) return false;
        }
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          return (
            h.ticker.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q) ||
            h.sector.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'ticker') {
          return sortDesc ? b.ticker.localeCompare(a.ticker) : a.ticker.localeCompare(b.ticker);
        }
        const diff = (a[sortBy] as number) - (b[sortBy] as number);
        return sortDesc ? -diff : diff;
      });
  }, [holdings, classFilter, searchQuery, sortBy, sortDesc]);

  const filteredTotalMarket = filteredHoldings.reduce((acc, h) => acc + h.marketValueBrl, 0);

  const startEditing = (h: Holding) => {
    setEditingId(h.id);
    setEditQty(h.quantity);
    setEditPriceBrl(h.currentPriceBrl);
  };

  const saveEdit = (h: Holding) => {
    const newMarketBrl = Number((editQty * editPriceBrl).toFixed(2));
    const newInvestedBrl = Number((editQty * h.avgPriceBrl).toFixed(2));
    const newOpenProfitBrl = Number((newMarketBrl - newInvestedBrl).toFixed(2));
    const newOpenProfitPct = newInvestedBrl > 0 ? Number(((newOpenProfitBrl / newInvestedBrl) * 100).toFixed(2)) : 0;
    const newTotalProfitBrl = Number((newOpenProfitBrl + h.tradesProfitBrl + h.dividendsBrl).toFixed(2));

    onUpdateHolding({
      ...h,
      quantity: editQty,
      currentPriceBrl: editPriceBrl,
      investedBrl: newInvestedBrl,
      marketValueBrl: newMarketBrl,
      openProfitBrl: newOpenProfitBrl,
      openProfitPct: newOpenProfitPct,
      totalProfitBrl: newTotalProfitBrl,
    });
    setEditingId(null);
  };

  const handleCreateHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;
    const investedBrl = Number((newQty * newAvgPrice).toFixed(2));
    const marketValueBrl = Number((newQty * newCurPrice).toFixed(2));
    const openProfitBrl = Number((marketValueBrl - investedBrl).toFixed(2));
    const openProfitPct = investedBrl > 0 ? Number(((openProfitBrl / investedBrl) * 100).toFixed(2)) : 0;

    const macroMap: Record<AssetClass, Holding['macroGroup']> = {
      FIXED_INCOME: 'Cash on Hand',
      STOCKS_BR: 'Stocks (BRA)',
      STOCKS_US: 'Stocks (US)',
      ETFS_US: 'ETFs (US)',
      FIIS: 'FIIs',
      CRYPTO: 'Cryptocurrency',
      PROTECTION: 'Protection',
      FGTS: 'FGTS',
    };

    onAddHolding({
      id: `custom-${Date.now()}`,
      ticker: newTicker.toUpperCase().trim(),
      name: newName.trim() || newTicker.toUpperCase().trim(),
      assetClass: newClass,
      macroGroup: macroMap[newClass],
      broker: newBroker,
      quantity: newQty,
      avgPriceBrl: newAvgPrice,
      currentPriceBrl: newCurPrice,
      investedBrl,
      marketValueBrl,
      dailyChangeBrl: 0,
      dailyChangePct: 0,
      openProfitBrl,
      openProfitPct,
      tradesProfitBrl: 0,
      dividendsBrl: 0,
      totalProfitBrl: openProfitBrl,
      tirMonthlyPct: 0.8,
      tirAnnualPct: 10.0,
      sector: newClass,
      riskLevel: newClass === 'FIXED_INCOME' ? 'Very low' : newClass === 'CRYPTO' ? 'High' : 'Medium',
      info: `${newTicker.toUpperCase()} adicionado manualmente ao portfólio.`,
    });
    setShowAddModal(false);
    setNewTicker('');
    setNewName('');
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDesc((v) => !v);
    else {
      setSortBy(col);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Summary by Type + Best/Worst Rank Card */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Summary by Type Table */}
        <div className="xl:col-span-7 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-[#2b303b]">
            <div>
              <h3 className="text-base font-bold text-white">
                Resumo de Renda Variável & Custódia
              </h3>
              <p className="text-xs text-slate-400">
                Consolidado por classe de ativo com custo investido, valor de mercado, lucro e proventos.
              </p>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs text-slate-400">Total Custódia Ativa</div>
              <div className="text-base font-extrabold text-amber-400">
                {formatCurrency(totalVarMarket, currency, ptax, hideValues)}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[#2b303b] text-[11px] text-slate-400 uppercase font-sans">
                  <th className="py-2.5 px-2">Type</th>
                  <th className="py-2.5 px-2 text-right">Volume Invested</th>
                  <th className="py-2.5 px-2 text-right">Market Value</th>
                  <th className="py-2.5 px-2 text-right">Profit (Aberto)</th>
                  <th className="py-2.5 px-2 text-right">Variation %</th>
                  <th className="py-2.5 px-2 text-right">Dividends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60">
                {summaryByType.map((row) => (
                  <tr key={row.label} className="hover:bg-[#23272f]/50">
                    <td className="py-2.5 px-2 font-sans font-semibold text-white">{row.label}</td>
                    <td className="py-2.5 px-2 text-right text-slate-300">
                      {formatCurrency(row.invested, currency, ptax, hideValues)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-white font-semibold">
                      {formatCurrency(row.market, currency, ptax, hideValues)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-semibold ${
                        row.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {row.profit >= 0 ? '+' : ''}
                      {formatCurrency(row.profit, currency, ptax, hideValues)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-bold ${
                        row.variationPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatPct(row.variationPct, 1, true)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-amber-400">
                      {formatCurrency(row.dividends, currency, ptax, hideValues)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#14171c] font-bold text-white border-t-2 border-[#2b303b]">
                  <td className="py-3 px-2 font-sans">Total Custódia</td>
                  <td className="py-3 px-2 text-right">
                    {formatCurrency(totalVarInvested, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right text-amber-400">
                    {formatCurrency(totalVarMarket, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right text-emerald-400">
                    +{formatCurrency(totalVarProfit, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right text-emerald-400">
                    {formatPct(totalVarPct, 1, true)}
                  </td>
                  <td className="py-3 px-2 text-right text-amber-400">
                    {formatCurrency(totalVarDividends, currency, ptax, hideValues)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Best & Worst Rank Card */}
        <div className="xl:col-span-5 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <h3 className="text-base font-bold text-white pb-3 border-b border-[#2b303b] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Ranking: Melhores e Piores Ativos por Classe
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs font-mono">
            {/* Best Column */}
            <div className="space-y-2">
              <div className="text-[11px] font-sans font-bold uppercase text-emerald-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Maiores Altas (Desde a Compra)
              </div>
              {[
                { label: 'BEST ETF US', item: ranks.etfsUs.best },
                { label: 'BEST STOCK BR', item: ranks.stocksBr.best },
                { label: 'BEST STOCK US', item: ranks.stocksUs.best },
                { label: 'BEST FII', item: ranks.fiis.best },
                { label: 'BEST CRYPTO', item: ranks.crypto.best },
              ].map((r) => (
                <div
                  key={r.label}
                  className="bg-[#121418] border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[10px] font-sans text-slate-400">{r.label}</div>
                    <div className="font-bold text-white">{r.item?.ticker || '-'}</div>
                  </div>
                  <span className="text-emerald-400 font-bold text-sm">
                    {r.item ? formatPct(r.item.openProfitPct, 1, true) : '-'}
                  </span>
                </div>
              ))}
            </div>

            {/* Worst Column */}
            <div className="space-y-2">
              <div className="text-[11px] font-sans font-bold uppercase text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Menores Retornos / Baixas
              </div>
              {[
                { label: 'WORST ETF US', item: ranks.etfsUs.worst },
                { label: 'WORST STOCK BR', item: ranks.stocksBr.worst },
                { label: 'WORST STOCK US', item: ranks.stocksUs.worst },
                { label: 'WORST FII', item: ranks.fiis.worst },
                { label: 'WORST CRYPTO', item: ranks.crypto.worst },
              ].map((r) => (
                <div
                  key={r.label}
                  className="bg-[#121418] border border-red-500/20 rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="text-[10px] font-sans text-slate-400">{r.label}</div>
                    <div className="font-bold text-white">{r.item?.ticker || '-'}</div>
                  </div>
                  <span
                    className={`font-bold text-sm ${
                      (r.item?.openProfitPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {r.item ? formatPct(r.item.openProfitPct, 1, true) : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Full Custody Table with Dropdown Filter, Search & Inline Editing */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          {/* Dropdown Menu Filter for Ticker Table */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Filtrar Classe:
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as any)}
                className="bg-[#121418] border border-[#2b303b] hover:border-slate-600 rounded-lg px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="VARIABLE_ONLY">Custódia Renda Variável ({variableHoldings.length} Ativos)</option>
                <option value="ALL">Todos os Ativos (+ Renda Fixa & FGTS)</option>
                <option value="STOCKS_BR">Ações Brasil (STOCKS_BR)</option>
                <option value="STOCKS_US">Stocks US (STOCKS_US)</option>
                <option value="ETFS_US">ETFs US (ETFS_US)</option>
                <option value="FIIS">Fundos Imobiliários (FIIs)</option>
                <option value="CRYPTO">Criptomoedas (CRYPTO)</option>
                <option value="PROTECTION">Proteção / Ouro (PROTECTION)</option>
                <option value="FIXED_INCOME">Renda Fixa & Caixa (FIXED_INCOME)</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Exibindo <strong className="text-white">{filteredHoldings.length}</strong> ativos • Total:{' '}
              <strong className="text-amber-400">
                {formatCurrency(filteredTotalMarket, currency, ptax, hideValues)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar ticker ou setor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121418] border border-[#2b303b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Ativo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2b303b] text-[11px] font-semibold uppercase text-slate-400">
                <th
                  className="py-3 px-2 cursor-pointer hover:text-white"
                  onClick={() => handleSort('ticker')}
                >
                  <div className="flex items-center gap-1">
                    Ativo / Corretora <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">Peso %</th>
                <th className="py-3 px-2 text-right">Qtd</th>
                <th className="py-3 px-2 text-right">PM (PM Ajust)</th>
                <th className="py-3 px-2 text-right">Cotação</th>
                <th className="py-3 px-2 text-right">Valor Investido</th>
                <th
                  className="py-3 px-2 text-right cursor-pointer hover:text-white"
                  onClick={() => handleSort('marketValueBrl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Valor Mercado <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-2 text-right cursor-pointer hover:text-white"
                  onClick={() => handleSort('openProfitPct')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Lucro Aberto <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-2 text-right cursor-pointer hover:text-white"
                  onClick={() => handleSort('dividendsBrl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Proventos <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">Lucro Total</th>
                <th
                  className="py-3 px-2 text-right cursor-pointer hover:text-white"
                  onClick={() => handleSort('tirAnnualPct')}
                >
                  <div className="flex items-center justify-end gap-1">
                    TIR <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b303b]/60 font-mono">
              {filteredHoldings.map((h) => {
                const isEditing = editingId === h.id;
                const weightPct = filteredTotalMarket > 0 ? (h.marketValueBrl / filteredTotalMarket) * 100 : 0;
                const isExpanded = expandedInfoId === h.id;

                return (
                  <React.Fragment key={h.id}>
                    <tr className="hover:bg-[#23272f]/60 transition-colors">
                      <td className="py-3 px-2 font-sans">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {h.ticker}
                              {h.subType && (
                                <span className="px-1.5 py-0.2 text-[10px] rounded bg-purple-500/20 text-purple-300">
                                  {h.subType}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {h.name} • <span className="text-slate-500">{h.broker}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        {formatPct(weightPct, 1)}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-200">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={editQty}
                            onChange={(e) => setEditQty(parseFloat(e.target.value) || 0)}
                            className="w-20 bg-[#121418] border border-amber-500 rounded px-1.5 py-0.5 text-right text-white"
                          />
                        ) : (
                          h.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        <div>{formatCurrency(h.avgPriceBrl, currency, ptax, hideValues)}</div>
                        {h.avgPriceAdjustedBrl && (
                          <div className="text-[10px] text-slate-500">
                            ({formatCurrency(h.avgPriceAdjustedBrl, currency, ptax, hideValues)})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-white font-semibold">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={editPriceBrl}
                            onChange={(e) => setEditPriceBrl(parseFloat(e.target.value) || 0)}
                            className="w-24 bg-[#121418] border border-amber-500 rounded px-1.5 py-0.5 text-right text-amber-400"
                          />
                        ) : (
                          formatCurrency(h.currentPriceBrl, currency, ptax, hideValues)
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-300">
                        {formatCurrency(h.investedBrl, currency, ptax, hideValues)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-white">
                        {formatCurrency(h.marketValueBrl, currency, ptax, hideValues)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div
                          className={`font-semibold ${
                            h.openProfitBrl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {h.openProfitBrl >= 0 ? '+' : ''}
                          {formatCurrency(h.openProfitBrl, currency, ptax, hideValues)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            h.openProfitPct >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'
                          }`}
                        >
                          ({formatPct(h.openProfitPct, 1, true)})
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-amber-400">
                        {formatCurrency(h.dividendsBrl, currency, ptax, hideValues)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-bold ${
                          h.totalProfitBrl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {h.totalProfitBrl >= 0 ? '+' : ''}
                        {formatCurrency(h.totalProfitBrl, currency, ptax, hideValues)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="text-slate-200">{formatPct(h.tirMonthlyPct, 1)} a.m.</div>
                        <div className="text-[10px] text-slate-400">{formatPct(h.tirAnnualPct, 1)} a.a.</div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(h)}
                                className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(h)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400"
                                title="Editar Quantidade ou Cotação"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setExpandedInfoId(isExpanded ? null : h.id)}
                                className={`p-1 rounded hover:bg-slate-800 ${
                                  isExpanded ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                                }`}
                                title="Ver Descrição do Ativo"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#14171c]">
                        <td colSpan={12} className="p-3 font-sans text-xs text-slate-300">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <strong className="text-amber-400">{h.ticker} ({h.sector}):</strong>{' '}
                              {h.info}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono text-slate-400">
                              <span>Risco: <strong className="text-white">{h.riskLevel}</strong></span>
                              {h.targetWeightInClassPct && (
                                <span>Meta na Classe: <strong className="text-amber-400">{h.targetWeightInClassPct}%</strong></span>
                              )}
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

      {/* Modal to Add New Holding */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2b303b]">
              <h3 className="text-base font-bold text-white">Adicionar Novo Ativo à Carteira</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateHolding} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Ticker / Código</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: WEGE3, NVDA"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Classe</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value as AssetClass)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="STOCKS_BR">Ações Brasil</option>
                    <option value="STOCKS_US">Stocks US</option>
                    <option value="ETFS_US">ETFs US</option>
                    <option value="FIIS">FIIs</option>
                    <option value="CRYPTO">Criptomoedas</option>
                    <option value="PROTECTION">Proteção</option>
                    <option value="FIXED_INCOME">Renda Fixa / Caixa</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nome da Empresa / Fundo</label>
                  <input
                    type="text"
                    placeholder="Ex: WEG ON"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Corretora / Instituição</label>
                  <input
                    type="text"
                    value={newBroker}
                    onChange={(e) => setNewBroker(e.target.value)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Quantidade</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Médio (R$)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newAvgPrice}
                    onChange={(e) => setNewAvgPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Cotação Atual (R$)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newCurPrice}
                    onChange={(e) => setNewCurPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#2b303b]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                >
                  Salvar Ativo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
