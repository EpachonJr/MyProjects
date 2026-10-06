import React, { useState } from 'react';
import {
  Target,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  Scale,
} from 'lucide-react';
import {
  AllocationGoal,
  Holding,
} from '../types/portfolio';
import {
  CurrencyMode,
  computePortfolioSummary,
  formatCurrency,
  formatPct,
} from '../utils/calculations';
import { MACRO_COLORS } from './PatrimonyTab';

interface AllocationTabProps {
  holdings: Holding[];
  allocationGoals: AllocationGoal[];
  onUpdateGoals: (goals: AllocationGoal[]) => void;
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
  includeFgts: boolean;
}

const MACRO_GROUPS_ORDER: AllocationGoal['macroGroup'][] = [
  'Cash on Hand',
  'Stocks (US)',
  'ETFs (US)',
  'Stocks (BRA)',
  'FIIs',
  'Cryptocurrency',
  'Protection',
];

const DEFAULT_GOAL_PCTS: Record<AllocationGoal['macroGroup'], number> = {
  'Cash on Hand': 48.0,
  'Stocks (US)': 28.0,
  'ETFs (US)': 10.0,
  'Stocks (BRA)': 7.0,
  'FIIs': 4.5,
  'Cryptocurrency': 0.5,
  'Protection': 2.0,
};

export const AllocationTab: React.FC<AllocationTabProps> = ({
  holdings,
  allocationGoals,
  onUpdateGoals,
  currency,
  ptax,
  hideValues,
  includeFgts,
}) => {
  // Interactive Buy/Sell Side state
  const [buyOrders, setBuyOrders] = useState([
    { id: 'b1', done: false, market: 'USA', ticker: 'AMZN', unitsToBuy: 2 },
    { id: 'b2', done: false, market: 'USA', ticker: 'WM', unitsToBuy: 2 },
    { id: 'b3', done: false, market: 'USA', ticker: 'VOO', unitsToBuy: 2 },
  ]);
  const [sellOrders, setSellOrders] = useState([
    { id: 's1', done: false, market: 'BRAZIL', ticker: 'MLAS3', unitsToSell: 1207 },
  ]);
  const [newOrderTicker, setNewOrderTicker] = useState('ITSA4');
  const [newOrderSide, setNewOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [newOrderUnits, setNewOrderUnits] = useState(10);

  // Avenue leftovers are always included
  const summary = computePortfolioSummary(holdings, includeFgts);
  const fgtsHolding = holdings.find((h) => h.assetClass === 'FGTS');
  const fgtsValueBrl = fgtsHolding ? fgtsHolding.marketValueBrl : 72456.16;

  // Ensure all 7 macro groups (including separated ETFs (US)) exist in the allocation table
  const normalizedGoals: AllocationGoal[] = MACRO_GROUPS_ORDER.map((macroGroup) => {
    const existing = allocationGoals.find((g) => g.macroGroup === macroGroup);
    const actualBrl = summary.byMacroGroup[macroGroup]?.marketBrl ?? 0;
    const actualPct = summary.nonFgtsTotalBrl > 0 ? (actualBrl / summary.nonFgtsTotalBrl) * 100 : 0;
    const targetPct = existing ? existing.targetPct : DEFAULT_GOAL_PCTS[macroGroup];
    const targetBrl = (targetPct / 100) * summary.nonFgtsTotalBrl;
    const missingBrl = targetBrl - actualBrl;
    return {
      macroGroup,
      currentBrl: actualBrl,
      currentPct: actualPct,
      targetPct,
      targetBrl,
      missingBrl,
    };
  });

  const handleGoalPctChange = (macroGroup: AllocationGoal['macroGroup'], newPct: number) => {
    if (Number.isNaN(newPct) || newPct < 0 || newPct > 100) return;
    const updated = normalizedGoals.map((g) =>
      g.macroGroup === macroGroup ? { ...g, targetPct: newPct } : g
    );
    onUpdateGoals(updated);
  };

  const handleAddSimulatedOrder = () => {
    const found = holdings.find((h) => h.ticker === newOrderTicker);
    if (!found) return;
    const market = found.broker === 'AVENUE' ? 'USA' : 'BRAZIL';
    if (newOrderSide === 'BUY') {
      setBuyOrders((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, done: false, market, ticker: found.ticker, unitsToBuy: newOrderUnits },
      ]);
    } else {
      setSellOrders((prev) => [
        ...prev,
        { id: `s-${Date.now()}`, done: false, market, ticker: found.ticker, unitsToSell: newOrderUnits },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Metas de Alocação & Rebalanceamento */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Metas de Alocação Table */}
        <div className="xl:col-span-8 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#2b303b]">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                Metas de Alocação & Rebalanceamento
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ajuste a meta percentual de cada classe para calcular quanto aportar ou rebalancear (Stocks US e ETFs US separados).
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/25 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Leftovers Avenue incluído
            </span>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2b303b] text-[11px] font-semibold uppercase text-slate-400">
                  <th className="py-2.5 px-2">Types of Investment</th>
                  <th className="py-2.5 px-2 text-right">Invested Patrimony</th>
                  <th className="py-2.5 px-2 text-right">Share %</th>
                  <th className="py-2.5 px-2 text-right">Goal %</th>
                  <th className="py-2.5 px-2 text-right">Goal ({currency})</th>
                  <th className="py-2.5 px-2 text-right">Missing (Falta/Sobra)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/60 text-xs font-mono">
                {normalizedGoals.map((row) => (
                  <tr key={row.macroGroup} className="hover:bg-[#23272f]/50 transition-colors">
                    <td className="py-3 px-2 font-sans font-semibold text-white flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: MACRO_COLORS[row.macroGroup] }}
                      />
                      {row.macroGroup}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-100">
                      {formatCurrency(row.currentBrl, currency, ptax, hideValues)}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-300">
                      {formatPct(row.currentPct, 1)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="inline-flex items-center bg-[#121418] border border-[#2b303b] rounded px-1.5 py-0.5">
                        <input
                          type="number"
                          step="0.5"
                          value={row.targetPct}
                          onChange={(e) =>
                            handleGoalPctChange(row.macroGroup, parseFloat(e.target.value))
                          }
                          className="w-12 bg-transparent text-right text-amber-400 font-semibold focus:outline-none"
                        />
                        <span className="text-slate-500 ml-0.5">%</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-slate-400">
                      {formatCurrency(row.targetBrl, currency, ptax, hideValues)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-bold ${
                        row.missingBrl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {row.missingBrl >= 0 ? '+' : ''}
                      {formatCurrency(row.missingBrl, currency, ptax, hideValues)}
                    </td>
                  </tr>
                ))}

                {/* Subtotal without FGTS */}
                <tr className="bg-[#14171c] font-bold text-white border-t-2 border-[#2b303b]">
                  <td className="py-3 px-2 font-sans">Total (Sem FGTS)</td>
                  <td className="py-3 px-2 text-right text-amber-400">
                    {formatCurrency(summary.nonFgtsTotalBrl, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right">100,0%</td>
                  <td className="py-3 px-2 text-right">
                    {formatPct(
                      normalizedGoals.reduce((acc, r) => acc + r.targetPct, 0),
                      1
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatCurrency(summary.nonFgtsTotalBrl, currency, ptax, hideValues)}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-400">-</td>
                </tr>

                {/* FGTS Row */}
                <tr className="text-slate-300 bg-[#14171c]/50">
                  <td className="py-2.5 px-2 font-sans flex items-center gap-2">
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/15 text-emerald-300">
                      Very low
                    </span>
                    FGTS
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {formatCurrency(fgtsValueBrl, currency, ptax, hideValues)}
                  </td>
                  <td colSpan={4} className="py-2.5 px-2 text-right text-[11px] font-sans text-slate-400">
                    Fundo de Garantia
                  </td>
                </tr>

                {/* Total with FGTS */}
                <tr className="bg-emerald-500/10 font-extrabold text-white">
                  <td className="py-3 px-2 font-sans text-emerald-300">Total com FGTS</td>
                  <td className="py-3 px-2 text-right text-emerald-300 text-sm">
                    {formatCurrency(summary.nonFgtsTotalBrl + fgtsValueBrl, currency, ptax, hideValues)}
                  </td>
                  <td colSpan={4} className="py-3 px-2 text-right font-mono text-xs text-slate-300">
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

        {/* Right: Visual Comparison Bars (Share % vs Goal %) */}
        <div className="xl:col-span-4 bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-amber-400" />
              Radar de Rebalanceamento (Atual vs. Meta)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Valores positivos indicam onde aportar para atingir a meta; valores negativos indicam exposição acima da meta.
            </p>

            <div className="space-y-3.5">
              {normalizedGoals.map((r) => {
                const diffPct = r.targetPct - r.currentPct;
                return (
                  <div key={r.macroGroup} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-200">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: MACRO_COLORS[r.macroGroup] }}
                        />
                        <span>{r.macroGroup}</span>
                      </div>
                      <div className="font-mono text-[11px]">
                        <span className="text-white font-semibold">{formatPct(r.currentPct, 1)}</span>
                        <span className="text-slate-500"> / Meta {formatPct(r.targetPct, 1)}</span>
                        <span
                          className={`ml-2 font-bold ${
                            diffPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          ({diffPct >= 0 ? '+' : ''}
                          {diffPct.toFixed(1).replace('.', ',')} p.p.)
                        </span>
                      </div>
                    </div>
                    <div className="relative w-full h-2.5 bg-[#121418] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, r.currentPct)}%`,
                          backgroundColor: MACRO_COLORS[r.macroGroup],
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
                        style={{ left: `${Math.min(99, r.targetPct)}%` }}
                        title={`Meta: ${r.targetPct}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#2b303b] text-xs text-slate-400 flex items-center justify-between">
            <span>Soma das Metas:</span>
            <span
              className={`font-mono font-bold ${
                Math.abs(normalizedGoals.reduce((a, b) => a + b.targetPct, 0) - 100) < 0.05
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {formatPct(
                normalizedGoals.reduce((a, b) => a + b.targetPct, 0),
                1
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: BUY SIDE / SELL SIDE Simulator */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#2b303b]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Planejador de Compras e Vendas (BUY SIDE & SELL SIDE)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule quantas cotas/ações comprar ou vender em Reais (R$) e Dólares (US$) antes de enviar ordens na corretora.
            </p>
          </div>

          {/* Add ticker to simulator */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newOrderSide}
              onChange={(e) => setNewOrderSide(e.target.value as 'BUY' | 'SELL')}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-xs text-white"
            >
              <option value="BUY">BUY SIDE (Compra)</option>
              <option value="SELL">SELL SIDE (Venda)</option>
            </select>
            <select
              value={newOrderTicker}
              onChange={(e) => setNewOrderTicker(e.target.value)}
              className="bg-[#121418] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-xs text-white"
            >
              {holdings
                .filter((h) => h.assetClass !== 'FIXED_INCOME' && h.assetClass !== 'FGTS')
                .map((h) => (
                  <option key={h.id} value={h.ticker}>
                    {h.ticker} ({h.name})
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="1"
              value={newOrderUnits}
              onChange={(e) => setNewOrderUnits(parseFloat(e.target.value) || 1)}
              className="w-16 bg-[#121418] border border-[#2b303b] rounded-lg px-2 py-1.5 text-xs text-white font-mono text-right"
            />
            <button
              onClick={handleAddSimulatedOrder}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
          {/* BUY SIDE */}
          <div className="bg-[#121418] border border-[#2b303b] rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center justify-between">
              <span>BUY SIDE (Ordens Planejadas de Compra)</span>
              <span className="font-mono">
                Total:{' '}
                {formatCurrency(
                  buyOrders.reduce((acc, o) => {
                    const h = holdings.find((x) => x.ticker === o.ticker);
                    return acc + (h ? h.currentPriceBrl * o.unitsToBuy : 0);
                  }, 0),
                  currency,
                  ptax,
                  hideValues
                )}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                    <th className="py-2 px-1">OK</th>
                    <th className="py-2 px-1.5">Ativo</th>
                    <th className="py-2 px-1.5 text-right">Preço (R$)</th>
                    <th className="py-2 px-1.5 text-right">Atual</th>
                    <th className="py-2 px-1.5 text-right">Comprar</th>
                    <th className="py-2 px-1.5 text-right">Valor (R$)</th>
                    <th className="py-2 px-1.5 text-right">Valor (US$)</th>
                    <th className="py-2 px-1.5 text-right">Pos. Final</th>
                    <th className="py-2 px-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b303b]/50">
                  {buyOrders.map((ord) => {
                    const h = holdings.find((x) => x.ticker === ord.ticker);
                    const priceBrl = h ? h.currentPriceBrl : 0;
                    const posBrl = h ? h.marketValueBrl : 0;
                    const curUnits = h ? h.quantity : 0;
                    const amountBrl = priceBrl * ord.unitsToBuy;
                    const finalBrl = posBrl + amountBrl;

                    return (
                      <tr key={ord.id} className={ord.done ? 'opacity-50 line-through' : ''}>
                        <td className="py-2 px-1">
                          <input
                            type="checkbox"
                            checked={ord.done}
                            onChange={(e) =>
                              setBuyOrders((prev) =>
                                prev.map((x) =>
                                  x.id === ord.id ? { ...x, done: e.target.checked } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="py-2 px-1.5 font-bold text-white">{ord.ticker}</td>
                        <td className="py-2 px-1.5 text-right text-slate-300">
                          {formatCurrency(priceBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-slate-400">{curUnits}</td>
                        <td className="py-2 px-1.5 text-right">
                          <input
                            type="number"
                            min="0"
                            value={ord.unitsToBuy}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setBuyOrders((prev) =>
                                prev.map((x) => (x.id === ord.id ? { ...x, unitsToBuy: val } : x))
                              );
                            }}
                            className="w-12 bg-[#1b1e24] border border-[#2b303b] rounded px-1 py-0.5 text-right text-emerald-400 font-bold"
                          />
                        </td>
                        <td className="py-2 px-1.5 text-right text-emerald-400 font-semibold">
                          {formatCurrency(amountBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-slate-300">
                          {formatCurrency(amountBrl, 'USD', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-white">
                          {formatCurrency(finalBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1 text-right">
                          <button
                            onClick={() =>
                              setBuyOrders((prev) => prev.filter((x) => x.id !== ord.id))
                            }
                            className="text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SELL SIDE */}
          <div className="bg-[#121418] border border-[#2b303b] rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center justify-between">
              <span>SELL SIDE (Ordens Planejadas de Venda)</span>
              <span className="font-mono">
                Total a Receber:{' '}
                {formatCurrency(
                  sellOrders.reduce((acc, o) => {
                    const h = holdings.find((x) => x.ticker === o.ticker);
                    return acc + (h ? h.currentPriceBrl * o.unitsToSell : 0);
                  }, 0),
                  currency,
                  ptax,
                  hideValues
                )}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                    <th className="py-2 px-1">OK</th>
                    <th className="py-2 px-1.5">Ativo</th>
                    <th className="py-2 px-1.5 text-right">Preço (R$)</th>
                    <th className="py-2 px-1.5 text-right">Atual</th>
                    <th className="py-2 px-1.5 text-right">Vender</th>
                    <th className="py-2 px-1.5 text-right">Valor (R$)</th>
                    <th className="py-2 px-1.5 text-right">Pos. Final</th>
                    <th className="py-2 px-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b303b]/50">
                  {sellOrders.map((ord) => {
                    const h = holdings.find((x) => x.ticker === ord.ticker);
                    const priceBrl = h ? h.currentPriceBrl : 0;
                    const posBrl = h ? h.marketValueBrl : 0;
                    const curUnits = h ? h.quantity : 0;
                    const amountBrl = priceBrl * ord.unitsToSell;
                    const finalBrl = Math.max(0, posBrl - amountBrl);

                    return (
                      <tr key={ord.id} className={ord.done ? 'opacity-50 line-through' : ''}>
                        <td className="py-2 px-1">
                          <input
                            type="checkbox"
                            checked={ord.done}
                            onChange={(e) =>
                              setSellOrders((prev) =>
                                prev.map((x) =>
                                  x.id === ord.id ? { ...x, done: e.target.checked } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="py-2 px-1.5 font-bold text-white">{ord.ticker}</td>
                        <td className="py-2 px-1.5 text-right text-slate-300">
                          {formatCurrency(priceBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-slate-400">{curUnits}</td>
                        <td className="py-2 px-1.5 text-right">
                          <input
                            type="number"
                            min="0"
                            value={ord.unitsToSell}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSellOrders((prev) =>
                                prev.map((x) => (x.id === ord.id ? { ...x, unitsToSell: val } : x))
                              );
                            }}
                            className="w-16 bg-[#1b1e24] border border-[#2b303b] rounded px-1 py-0.5 text-right text-amber-400 font-bold"
                          />
                        </td>
                        <td className="py-2 px-1.5 text-right text-amber-400 font-semibold">
                          {formatCurrency(amountBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1.5 text-right text-white">
                          {formatCurrency(finalBrl, 'BRL', ptax, hideValues)}
                        </td>
                        <td className="py-2 px-1 text-right">
                          <button
                            onClick={() =>
                              setSellOrders((prev) => prev.filter((x) => x.id !== ord.id))
                            }
                            className="text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
};
