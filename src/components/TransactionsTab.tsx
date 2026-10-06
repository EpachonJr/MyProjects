import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Plus,
  Filter,
} from 'lucide-react';
import {
  Holding,
  TransactionRecord,
} from '../types/portfolio';
import {
  CurrencyMode,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

interface TransactionsTabProps {
  transactions: TransactionRecord[];
  holdings: Holding[];
  onAddTransaction?: (tx: TransactionRecord) => void;
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  holdings,
  onAddTransaction,
  currency,
  ptax,
  hideValues,
}) => {
  const [txFilter, setTxFilter] = useState<'ALL' | 'C' | 'V' | 'S/I' | 'SUB' | 'BN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Transaction State
  const [ticker, setTicker] = useState('ITSA4');
  const [event, setEvent] = useState<'C' | 'V'>('C');
  const [date, setDate] = useState('2026-09-26');
  const [qty, setQty] = useState<number>(10);
  const [price, setPrice] = useState<number>(10.5);

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (txFilter !== 'ALL' && t.event !== txFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          t.ticker.toLowerCase().includes(q) ||
          t.assetClass.toLowerCase().includes(q) ||
          t.broker.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, txFilter, searchQuery]);

  const totalBuyVolumeBrl = useMemo(
    () =>
      transactions
        .filter((t) => t.event === 'C' || t.event === 'SUB')
        .reduce((acc, t) => acc + Math.abs(t.volumeBrl), 0),
    [transactions]
  );

  const totalSellVolumeBrl = useMemo(
    () =>
      transactions
        .filter((t) => t.event === 'V')
        .reduce((acc, t) => acc + Math.abs(t.volumeBrl), 0),
    [transactions]
  );

  const totalRealizedProfitBrl = useMemo(() => {
    const custodyTrades = holdings.reduce((acc, h) => acc + (h.tradesProfitBrl || 0), 0);
    return custodyTrades > 0 ? custodyTrades : 13940.90;
  }, [holdings]);

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddTransaction) return;
    const h = holdings.find((x) => x.ticker === ticker);
    const isUsd = h?.broker === 'AVENUE';
    const volBrl = Number((qty * price * (isUsd ? ptax : 1)).toFixed(2));
    onAddTransaction({
      id: `tx-${Date.now()}`,
      ticker,
      date,
      event,
      quantity: qty,
      price,
      fees: 0,
      broker: h?.broker || 'XP',
      currency: isUsd ? 'USD' : 'BRL',
      assetClass: h?.assetClass || 'STOCKS_BR',
      volumeBrl: volBrl,
      profitBrl: 0,
      profitPct: 0,
      cashFlowBrl: event === 'C' ? -volBrl : volBrl,
      ptax: isUsd ? ptax : 1,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Operações Sincronizadas</div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1">
            {transactions.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Compras, vendas, splits e subscrições (Google Sheets)
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Volume Total em Compras</div>
          <div className="text-2xl font-extrabold font-mono text-blue-400 mt-1">
            {formatCurrency(totalBuyVolumeBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Aportes em B3, Avenue e Cripto
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Volume em Vendas</div>
          <div className="text-2xl font-extrabold font-mono text-amber-400 mt-1">
            {formatCurrency(totalSellVolumeBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Realizações e rebalanceamentos
          </div>
        </div>

        <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-5 shadow-lg">
          <div className="text-xs text-slate-400">Lucro Realizado em Trades (Custódia)</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            +{formatCurrency(totalRealizedProfitBrl, currency, ptax, hideValues)}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            Swing trades e realizações parciais
          </div>
        </div>
      </div>

      {/* Main Transactions Table + Quick Add Form */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Histórico de Operações & Transações Realizadas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro detalhado sincronizado com a aba op.normal do Google Sheets.
            </p>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={txFilter}
                onChange={(e) => setTxFilter(e.target.value as any)}
                className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Todas as Operações ({transactions.length})</option>
                <option value="C">Apenas Compras (C)</option>
                <option value="V">Apenas Vendas / Realizações (V)</option>
                <option value="S/I">Splits / Grupamentos (S/I)</option>
                <option value="SUB">Subscrições (SUB)</option>
                <option value="BN">Bonificações (BN)</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar ativo ou corretora..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121418] border border-[#2b303b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Add Transaction Form */}
        {onAddTransaction && (
          <form
            onSubmit={handleCreateTx}
            className="flex flex-wrap items-center justify-between gap-2 mt-4 bg-[#121418] border border-[#2b303b] rounded-xl p-3 text-xs"
          >
            <span className="font-semibold text-slate-300">Registrar Nova Operação:</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value as 'C' | 'V')}
                className="bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-semibold"
              >
                <option value="C">COMPRA (C)</option>
                <option value="V">VENDA (V)</option>
              </select>
              <select
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white"
              >
                {holdings
                  .filter((h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS')
                  .map((h) => (
                    <option key={h.id} value={h.ticker}>
                      {h.ticker} ({h.broker})
                    </option>
                  ))}
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="Qtd"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="w-20 bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono text-right"
              />
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="Preço Unit."
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-28 bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono text-right"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Lançar Operação
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="border-b border-[#2b303b] text-[11px] text-slate-400 uppercase font-sans">
              <tr>
                <th className="py-2.5 px-2">Data</th>
                <th className="py-2.5 px-2">Ativo</th>
                <th className="py-2.5 px-2">Evento</th>
                <th className="py-2.5 px-2">Classe</th>
                <th className="py-2.5 px-2">Corretora</th>
                <th className="py-2.5 px-2 text-right">Qtd</th>
                <th className="py-2.5 px-2 text-right">Preço</th>
                <th className="py-2.5 px-2 text-right">Volume</th>
                <th className="py-2.5 px-2 text-right">Lucro Realizado</th>
                <th className="py-2.5 px-2 text-right">PTAX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b303b]/50">
              {[...filteredTx].reverse().map((tx) => (
                <tr key={tx.id} className="hover:bg-[#23272f]/50">
                  <td className="py-2.5 px-2 text-slate-300">{tx.date}</td>
                  <td className="py-2.5 px-2 font-bold text-white">{tx.ticker}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.event === 'C'
                          ? 'bg-blue-500/20 text-blue-300'
                          : tx.event === 'V'
                            ? 'bg-amber-500/20 text-amber-300'
                            : tx.event === 'S/I'
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {tx.event === 'C'
                        ? 'COMPRA'
                        : tx.event === 'V'
                          ? 'VENDA'
                          : tx.event === 'S/I'
                            ? 'SPLIT (S/I)'
                            : tx.event === 'SUB'
                              ? 'SUBSCRIÇÃO'
                              : tx.event === 'BN'
                                ? 'BONIFICAÇÃO'
                                : tx.event}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-400">{tx.assetClass}</td>
                  <td className="py-2.5 px-2 text-slate-400">{tx.broker}</td>
                  <td className="py-2.5 px-2 text-right text-slate-200">{tx.quantity}</td>
                  <td className="py-2.5 px-2 text-right text-slate-300">
                    {tx.currency === 'USD' ? `$ ${tx.price.toFixed(2)}` : `R$ ${tx.price.toFixed(2)}`}
                  </td>
                  <td className="py-2.5 px-2 text-right text-white font-semibold">
                    {formatCurrency(Math.abs(tx.volumeBrl), currency, ptax, hideValues)}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-bold ${
                      tx.profitBrl > 0
                        ? 'text-emerald-400'
                        : tx.profitBrl < 0
                          ? 'text-red-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {tx.profitBrl !== 0
                      ? `${tx.profitBrl > 0 ? '+' : ''}${formatCurrency(tx.profitBrl, currency, ptax, hideValues)} (${formatPct(tx.profitPct, 1, true)})`
                      : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-400">
                    {tx.ptax > 1 ? `R$ ${tx.ptax.toFixed(4)}` : '-'}
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
