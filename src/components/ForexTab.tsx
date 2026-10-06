import React, { useState } from 'react';
import {
  Coins,
  Globe,
  Filter,
} from 'lucide-react';
import {
  ForexPurchase,
} from '../types/portfolio';
import {
  CurrencyMode,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

export interface ForexSummaryItem {
  code: 'USD' | 'GBP' | 'EUR' | 'CHF';
  title: string;
  flag: string;
  currentEx: number;
  avgPaidEx: number;
  cashOnHand: string;
  cashOnHandForeign?: number;
  valueBrl: number;
  paidBrl: number;
  taxPaidBrl: number;
  profitPct: number;
  profitBrl: number;
  patrimonyProtectionBrl?: number;
}

interface ForexTabProps {
  forexPurchases: ForexPurchase[];
  forexSummaries?: ForexSummaryItem[];
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
}

const DEFAULT_FX_SUMMARIES: ForexSummaryItem[] = [
  {
    code: 'USD',
    title: 'DOLLAR (US$)',
    flag: '🇺🇸',
    currentEx: 5.19,
    avgPaidEx: 4.13,
    cashOnHand: '$ 851,83',
    valueBrl: 4424.99,
    paidBrl: 3575.48,
    taxPaidBrl: 51.06,
    profitPct: 24.1,
    profitBrl: 849.51,
  },
  {
    code: 'GBP',
    title: 'POUNDS (£)',
    flag: '🇬🇧',
    currentEx: 6.87,
    avgPaidEx: 6.76,
    cashOnHand: '£ 842,25',
    valueBrl: 5787.26,
    paidBrl: 5795.53,
    taxPaidBrl: 101.87,
    profitPct: -0.1,
    profitBrl: -8.27,
  },
  {
    code: 'EUR',
    title: 'EURO (€)',
    flag: '🇪🇺',
    currentEx: 5.93,
    avgPaidEx: 5.94,
    cashOnHand: '€ 774,26',
    valueBrl: 4593.96,
    paidBrl: 4682.90,
    taxPaidBrl: 80.31,
    profitPct: -1.9,
    profitBrl: -88.94,
  },
  {
    code: 'CHF',
    title: 'SWISS FRANC (CHF)',
    flag: '🇨🇭',
    currentEx: 6.25,
    avgPaidEx: 6.44,
    cashOnHand: 'CHF 850,67',
    valueBrl: 5314.70,
    paidBrl: 5700.43,
    taxPaidBrl: 227.12,
    profitPct: -7.0,
    profitBrl: -385.73,
  },
];

export const ForexTab: React.FC<ForexTabProps> = ({
  forexPurchases,
  forexSummaries,
  currency,
  ptax,
  hideValues,
}) => {
  const [selectedFxCurrency, setSelectedFxCurrency] = useState<'ALL' | 'USD' | 'GBP' | 'EUR' | 'CHF'>('ALL');

  const fxSummaries: ForexSummaryItem[] =
    forexSummaries && forexSummaries.length > 0
      ? forexSummaries.map((s) =>
          s.code === 'USD' && ptax > 0
            ? { ...s, currentEx: ptax }
            : s
        )
      : DEFAULT_FX_SUMMARIES.map((s) =>
          s.code === 'USD' && ptax > 0 ? { ...s, currentEx: ptax } : s
        );

  const totalPaidBrl = Number(fxSummaries.reduce((acc, s) => acc + s.paidBrl, 0).toFixed(2));
  const totalCurrentBrl = Number(fxSummaries.reduce((acc, s) => acc + s.valueBrl, 0).toFixed(2));
  const totalProfitBrl = Number(fxSummaries.reduce((acc, s) => acc + s.profitBrl, 0).toFixed(2));
  const totalProfitPct = totalPaidBrl > 0 ? Number(((totalProfitBrl / totalPaidBrl) * 100).toFixed(1)) : 0;
  const totalTaxesBrl = Number(fxSummaries.reduce((acc, s) => acc + s.taxPaidBrl, 0).toFixed(2));

  const filteredForex = forexPurchases.filter(
    (fx) => selectedFxCurrency === 'ALL' || fx.currency === selectedFxCurrency
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#2b303b]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              Controle de Moedas Estrangeiras & Câmbio
              <a
                href="https://docs.google.com/spreadsheets/d/1k4QgQBC0TiBC0zRnKDxm8RRtqJ6pg-9D8k4mJ2pCk5w/edit#gid=1898740221"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full transition-colors"
              >
                Google Sheets (Currency • {forexPurchases.length} remessas)
              </a>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Acompanhamento de reservas cambiais em Dólar (US$), Libra Esterlina (£), Euro (€) e Franco Suíço (CHF) sincronizado com Patrimony Analysis 2.0.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3.5 py-2">
              <div className="text-[10px] font-sans text-slate-400">Total Pago</div>
              <div className="font-bold text-white mt-0.5">
                {formatCurrency(totalPaidBrl, currency, ptax, hideValues)}
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3.5 py-2">
              <div className="text-[10px] font-sans text-slate-400">Saldo Atual Consolidado</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                {formatCurrency(totalCurrentBrl, currency, ptax, hideValues)}
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3.5 py-2">
              <div className="text-[10px] font-sans text-slate-400">Resultado Cambial</div>
              <div className={`font-bold mt-0.5 ${totalProfitBrl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalProfitBrl >= 0 ? '+' : ''}
                {formatCurrency(totalProfitBrl, currency, ptax, hideValues)} ({formatPct(totalProfitPct, 1, true)})
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3.5 py-2">
              <div className="text-[10px] font-sans text-slate-400">IOF / Taxas Pagas</div>
              <div className="font-bold text-amber-400 mt-0.5">
                {formatCurrency(totalTaxesBrl, currency, ptax, hideValues)}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Currency Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 font-mono text-xs">
          {fxSummaries.map((s) => (
            <div
              key={s.code}
              onClick={() => setSelectedFxCurrency(s.code as any)}
              className={`bg-[#121418] border rounded-xl p-4 cursor-pointer transition-all ${
                selectedFxCurrency === s.code
                  ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'border-[#2b303b] hover:border-slate-600'
              }`}
            >
              <div className="font-sans font-bold text-white text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{s.flag}</span> {s.title}
                </span>
                <span
                  className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                    s.profitPct >= 0
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {formatPct(s.profitPct, 1, true)}
                </span>
              </div>

              <div className="text-lg font-extrabold text-amber-400 mt-2">{s.cashOnHand}</div>
              <div className="text-xs text-slate-300 mt-0.5">
                Equivalente: <strong className="text-white">{formatCurrency(s.valueBrl, currency, ptax, hideValues)}</strong>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#2b303b]/60 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Câmbio Médio Pago:</span>
                  <span className="text-slate-200 font-semibold">R$ {s.avgPaidEx.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Cotação Atual:</span>
                  <span className="text-white font-semibold">R$ {s.currentEx.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Lucro / Prejuízo:</span>
                  <span className={s.profitBrl >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {s.profitBrl >= 0 ? '+' : ''}
                    {formatCurrency(s.profitBrl, currency, ptax, hideValues)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase History Table */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#2b303b]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Histórico de Remessas e Compras de Câmbio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro detalhado de todas as compras de moeda estrangeira, taxas de câmbio e IOF.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-slate-400">Filtrar Moeda:</span>
            <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-lg border border-[#2b303b]">
              {(['ALL', 'USD', 'GBP', 'EUR', 'CHF'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedFxCurrency(c)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    selectedFxCurrency === c
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c === 'ALL' ? 'Todas' : c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="border-b border-[#2b303b] text-[11px] text-slate-400 uppercase font-sans">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Moeda</th>
                <th className="py-2.5 px-3 text-right">Valor Comprado</th>
                <th className="py-2.5 px-3 text-right">Câmbio Pago</th>
                <th className="py-2.5 px-3 text-right">IOF / Taxa (R$)</th>
                <th className="py-2.5 px-3 text-right">Total Pago (R$)</th>
                <th className="py-2.5 px-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b303b]/50">
              {filteredForex.map((fx) => (
                <tr key={fx.id} className="hover:bg-[#23272f]/50">
                  <td className="py-2.5 px-3 text-slate-300">{fx.date}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{fx.currency}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                    {fx.amountForeign.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {fx.exchangeRate === 1 ? 'Provento / Transf.' : `R$ ${fx.exchangeRate.toFixed(4)}`}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    R$ {fx.taxBrl.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-white font-semibold">
                    {fx.exchangeRate > 1
                      ? formatCurrency(
                          fx.amountForeign * fx.exchangeRate + fx.taxBrl,
                          currency,
                          ptax,
                          hideValues
                        )
                      : '-'}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-xs text-slate-400">
                    {fx.note || '-'}
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
