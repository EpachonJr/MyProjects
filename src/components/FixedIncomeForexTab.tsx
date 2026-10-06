import React, { useState } from 'react';
import {
  Landmark,
  Calculator,
  Plus,
  Zap,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  FixedIncomeProductSummary,
} from '../types/portfolio';
import {
  CurrencyMode,
  formatCurrency,
  formatPct,
} from '../utils/calculations';

export interface FixedIncomeLiveMeta {
  syncedAt?: string;
  bcbCdi?: {
    latestDateBr: string;
    latestDateIso: string;
    latestDailyRatePct: number;
    annualizedCdiPct: number;
  };
  cvmQuotas?: Record<
    string,
    {
      cnpj: string;
      dateIso: string;
      quotaValue: number;
      sourceFile?: string;
    }
  >;
  tesouroPu?: Record<
    string,
    {
      bondKey: string;
      dateBr: string;
      dateIso: string;
      taxaVenda: number;
      puVenda: number;
    }
  >;
}

interface FixedIncomeForexTabProps {
  products: FixedIncomeProductSummary[];
  onUpdateProducts: (products: FixedIncomeProductSummary[]) => void;
  currency: CurrencyMode;
  ptax: number;
  hideValues: boolean;
  liveMeta?: FixedIncomeLiveMeta | null;
}

export const FixedIncomeForexTab: React.FC<FixedIncomeForexTabProps> = ({
  products,
  onUpdateProducts,
  currency,
  ptax,
  hideValues,
  liveMeta,
}) => {
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'WITHDRAWN'>('ACTIVE');

  const activeProducts = products.filter((p) => p.status !== 'WITHDRAWN' && p.marketValueBrl > 0);
  const withdrawnProducts = products.filter((p) => p.status === 'WITHDRAWN' || p.marketValueBrl === 0);

  const displayedProducts = viewMode === 'ACTIVE' ? activeProducts : withdrawnProducts;
  const [selectedProductId, setSelectedProductId] = useState<string>(activeProducts[0]?.id || products[0]?.id || '');

  // Gross-up calculator state
  const [lcaRatePct, setLcaRatePct] = useState<number>(92.0);
  const [daysHeld, setDaysHeld] = useState<number>(699);

  // Add monthly record / Aporte-Resgate state
  const [newMonth, setNewMonth] = useState('2026-10');
  const [newDepositBrl, setNewDepositBrl] = useState<number>(0);
  const [newMarketValBrl, setNewMarketValBrl] = useState<number>(0);
  const [editQtyInput, setEditQtyInput] = useState<string>('');

  const taxAliquot =
    daysHeld <= 180 ? 22.5 : daysHeld <= 360 ? 20.0 : daysHeld <= 720 ? 17.5 : 15.0;
  const grossUpEquivalent = lcaRatePct / (1 - taxAliquot / 100);

  // Active Custody Totals
  const totalInvestedActive = activeProducts.reduce((a, b) => a + b.totalInvestedBrl, 0);
  const totalMarketGrossActive = activeProducts.reduce((a, b) => a + b.marketValueBrl, 0);
  const totalTaxesAndFeesActive = activeProducts.reduce((a, b) => a + (b.taxesAndFeesBrl || 0), 0);
  const totalMarketNetActive = activeProducts.reduce(
    (a, b) => a + (b.netValueBrl ?? b.marketValueBrl - (b.taxesAndFeesBrl || 0)),
    0
  );
  const totalProfitActive = activeProducts.reduce((a, b) => a + b.absoluteProfitBrl, 0);
  const totalRentPctActive =
    totalInvestedActive > 0 ? (totalProfitActive / totalInvestedActive) * 100 : 0;

  // Withdrawn / Realized Totals
  const totalInvestedWithdrawn = withdrawnProducts.reduce((a, b) => a + (b.initialDepositBrl || b.totalInvestedBrl), 0);
  const totalProfitWithdrawn = withdrawnProducts.reduce((a, b) => a + b.absoluteProfitBrl, 0);
  const totalRentPctWithdrawn =
    totalInvestedWithdrawn > 0 ? (totalProfitWithdrawn / totalInvestedWithdrawn) * 100 : 0;

  // Combined Totals
  const totalAllTimeProfit = totalProfitActive + totalProfitWithdrawn;

  const activeProduct =
    displayedProducts.find((p) => p.id === selectedProductId) ||
    products.find((p) => p.id === selectedProductId) ||
    displayedProducts[0] ||
    products[0];

  const handleSelectProduct = (prod: FixedIncomeProductSummary) => {
    setSelectedProductId(prod.id);
    if (prod.automationType === 'CVM_QUOTA' && prod.fundQuotas) {
      setEditQtyInput(String(prod.fundQuotas));
    } else if (prod.automationType === 'TESOURO_DIRETO' && prod.tesouroTitlesQty) {
      setEditQtyInput(String(prod.tesouroTitlesQty));
    } else {
      setEditQtyInput('');
    }
  };

  // Allow updating exact quantity of quotas/titles after an aporte or redemption
  const handleUpdateQuotasOrTitles = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    const parsedQty = parseFloat(editQtyInput);
    if (Number.isNaN(parsedQty) || parsedQty <= 0) return;

    let updated: FixedIncomeProductSummary = { ...activeProduct };
    if (activeProduct.automationType === 'CVM_QUOTA') {
      const unitQuota =
        liveMeta?.cvmQuotas?.[activeProduct.cvmCnpj || '42.699.466/0001-77']?.quotaValue ||
        activeProduct.lastQuotaValue ||
        1.7824021;
      const newGross = Number((parsedQty * unitQuota).toFixed(2));
      const newProfit = Number((newGross - activeProduct.totalInvestedBrl).toFixed(2));
      const newTaxes = Number(Math.max(0, newProfit * 0.15).toFixed(2));
      updated = {
        ...activeProduct,
        fundQuotas: parsedQty,
        lastQuotaValue: unitQuota,
        marketValueBrl: newGross,
        absoluteProfitBrl: newProfit,
        rentabilityPct:
          activeProduct.totalInvestedBrl > 0
            ? Number(((newProfit / activeProduct.totalInvestedBrl) * 100).toFixed(2))
            : 0,
        taxesAndFeesBrl: newTaxes,
        netValueBrl: Number((newGross - newTaxes).toFixed(2)),
      };
    } else if (activeProduct.automationType === 'TESOURO_DIRETO') {
      const unitPu =
        activeProduct.lastTesouroPu ||
        activeProduct.marketValueBrl / (activeProduct.tesouroTitlesQty || 1);
      const newGross = Number((parsedQty * unitPu).toFixed(2));
      const newProfit = Number((newGross - activeProduct.totalInvestedBrl).toFixed(2));
      const taxRatio =
        activeProduct.marketValueBrl > 0
          ? (activeProduct.taxesAndFeesBrl || 0) / activeProduct.marketValueBrl
          : 0.02;
      const newTaxes = Number((newGross * taxRatio).toFixed(2));
      updated = {
        ...activeProduct,
        tesouroTitlesQty: parsedQty,
        marketValueBrl: newGross,
        absoluteProfitBrl: newProfit,
        rentabilityPct:
          activeProduct.totalInvestedBrl > 0
            ? Number(((newProfit / activeProduct.totalInvestedBrl) * 100).toFixed(2))
            : 0,
        taxesAndFeesBrl: newTaxes,
        netValueBrl: Number((newGross - newTaxes).toFixed(2)),
      };
    }

    onUpdateProducts(products.map((p) => (p.id === activeProduct.id ? updated : p)));
  };

  const handleAddMonthlyEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct || newMarketValBrl <= 0) return;

    const history = [...activeProduct.monthlyHistory];
    const last = history[history.length - 1];
    const prevMarket = last ? last.marketValueBrl : activeProduct.initialDepositBrl;
    const baseForMonth = prevMarket + newDepositBrl;
    const monthlyReturnPct =
      baseForMonth > 0 ? Number((((newMarketValBrl - baseForMonth) / baseForMonth) * 100).toFixed(2)) : 0;
    const newInvested = activeProduct.totalInvestedBrl + newDepositBrl;
    const newProfit = newMarketValBrl - newInvested;
    const newAccPct =
      newInvested > 0 ? Number(((newProfit / newInvested) * 100).toFixed(2)) : 0;

    // Also update quotas/titles proportionally if applicable
    let nextQuotas = activeProduct.fundQuotas;
    let nextTitles = activeProduct.tesouroTitlesQty;
    if (activeProduct.automationType === 'CVM_QUOTA' && activeProduct.lastQuotaValue) {
      nextQuotas = Number((newMarketValBrl / activeProduct.lastQuotaValue).toFixed(4));
    } else if (activeProduct.automationType === 'TESOURO_DIRETO' && activeProduct.lastTesouroPu) {
      nextTitles = Number((newMarketValBrl / activeProduct.lastTesouroPu).toFixed(2));
    }

    const updatedProduct: FixedIncomeProductSummary = {
      ...activeProduct,
      totalInvestedBrl: newInvested,
      marketValueBrl: newMarketValBrl,
      absoluteProfitBrl: newProfit,
      rentabilityPct: newAccPct,
      fundQuotas: nextQuotas,
      tesouroTitlesQty: nextTitles,
      monthlyHistory: [
        ...history,
        {
          month: newMonth,
          depositWithdrawalBrl: newDepositBrl,
          marketValueBrl: newMarketValBrl,
          monthlyReturnPct,
          accumulatedReturnPct: newAccPct,
        },
      ],
    };

    onUpdateProducts(
      products.map((p) => (p.id === activeProduct.id ? updatedProduct : p))
    );
    setNewDepositBrl(0);
    setNewMarketValBrl(0);
  };

  const bcbDailyRate = liveMeta?.bcbCdi?.latestDailyRatePct ?? 0.050788;
  const bcbAnnualRate = liveMeta?.bcbCdi?.annualizedCdiPct ?? 13.65;
  const bcbDateBr = liveMeta?.bcbCdi?.latestDateBr ?? '24/09/2026';
  const nuQuotaObj = liveMeta?.cvmQuotas?.['42.699.466/0001-77'];
  const nuQuotaVal = nuQuotaObj?.quotaValue ?? 1.7824021;
  const nuQuotaDate = nuQuotaObj?.dateIso ?? '2026-09-24';

  const getAutomationBadge = (prod: FixedIncomeProductSummary) => {
    if (prod.status === 'WITHDRAWN') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Resgatado ({prod.withdrawnMonth || prod.expirationDate || 'Histórico'})
        </span>
      );
    }
    if (prod.automationType === 'BCB_CDI') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <Zap className="w-2.5 h-2.5" />
          BCB CDI ({prod.cdiPct || 100}%)
        </span>
      );
    }
    if (prod.automationType === 'CVM_QUOTA') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <Zap className="w-2.5 h-2.5" />
          CVM Cota Diária
        </span>
      );
    }
    if (prod.automationType === 'TESOURO_DIRETO') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Zap className="w-2.5 h-2.5" />
          Tesouro PU ({prod.tesouroTitlesQty} tít.)
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Live Official Brazilian APIs Status Strip */}
      <div className="bg-gradient-to-r from-[#171b22] via-[#1b2029] to-[#171b22] border border-emerald-500/30 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
              Motor de Automação de Renda Fixa & Fundos Ativo
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                100% Automatizado (Marcação a Mercado)
              </span>
              <a
                href="https://docs.google.com/spreadsheets/d/1k4QgQBC0TiBC0zRnKDxm8RRtqJ6pg-9D8k4mJ2pCk5w/edit#gid=445356284"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full transition-colors"
              >
                Google Sheets (Fixed Income • {products.length} títulos)
              </a>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Aportes, resgates e histórico mensal sincronizados com Patrimony Analysis 2.0 + rentabilidade diária via Banco Central (CDI), CVM e Tesouro Direto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="bg-[#111317] border border-[#2b303b] rounded-lg px-3 py-1.5">
            <span className="text-slate-400 font-sans text-[10px] block">BCB CDI Diário ({bcbDateBr})</span>
            <span className="text-emerald-400 font-bold">
              +{bcbDailyRate.toFixed(6)}% a.d. ({bcbAnnualRate.toFixed(2)}% a.a.)
            </span>
          </div>
          <div className="bg-[#111317] border border-[#2b303b] rounded-lg px-3 py-1.5">
            <span className="text-slate-400 font-sans text-[10px] block">CVM 42.699.466/0001-77 ({nuQuotaDate})</span>
            <span className="text-purple-300 font-bold">Cota: R$ {nuQuotaVal.toFixed(7)}</span>
          </div>
          <div className="bg-[#111317] border border-[#2b303b] rounded-lg px-3 py-1.5">
            <span className="text-slate-400 font-sans text-[10px] block">Tesouro Direto (4 Títulos)</span>
            <span className="text-amber-400 font-bold">Qtd × PU Marcação a Mercado</span>
          </div>
        </div>
      </div>

      {/* Row 1: Fixed Income Consolidated Banner + 8 Product Cards */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-[#2b303b]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-400" />
              Controle de Renda Fixa, Fundos & Tesouro Direto (Bruto vs. Líquido)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saldos sincronizados com seus dados reais do Nubank e XP (Saldo Separado, Caixinha RDB, Nu Reserva Imediata, LCA e Tesouro Direto).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 font-mono text-xs">
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2">
              <div className="text-[10px] font-sans text-slate-400">Total Aplicado (Ativo)</div>
              <div className="font-bold text-white mt-0.5">
                {formatCurrency(totalInvestedActive, currency, ptax, hideValues)}
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2">
              <div className="text-[10px] font-sans text-slate-400">Saldo Bruto Atual</div>
              <div className="font-bold text-blue-400 mt-0.5">
                {formatCurrency(totalMarketGrossActive, currency, ptax, hideValues)}
              </div>
            </div>
            <div className="bg-[#121418] border border-emerald-500/30 rounded-lg px-3 py-2">
              <div className="text-[10px] font-sans text-emerald-300">Saldo Líquido Real</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                {formatCurrency(totalMarketNetActive, currency, ptax, hideValues)}
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2">
              <div className="text-[10px] font-sans text-slate-400">Lucro em Custódia</div>
              <div className="font-bold text-emerald-400 mt-0.5">
                +{formatCurrency(totalProfitActive, currency, ptax, hideValues)} ({formatPct(totalRentPctActive, 1, true)})
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2">
              <div className="text-[10px] font-sans text-slate-400">Lucro Resgatado</div>
              <div className="font-bold text-amber-400 mt-0.5">
                +{formatCurrency(totalProfitWithdrawn, currency, ptax, hideValues)} ({withdrawnProducts.length} títulos)
              </div>
            </div>
            <div className="bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-sans text-slate-400">Lucro Total Histórico</div>
              <div className="font-bold text-amber-300 mt-0.5">
                +{formatCurrency(totalAllTimeProfit, currency, ptax, hideValues)}
              </div>
            </div>
          </div>
        </div>

        {/* Active vs Withdrawn Switcher */}
        <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
          <div className="flex items-center bg-[#121418] p-1 rounded-xl border border-[#2b303b]">
            <button
              onClick={() => {
                setViewMode('ACTIVE');
                if (activeProducts[0]) setSelectedProductId(activeProducts[0].id);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'ACTIVE'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Ativos em Custódia ({activeProducts.length})</span>
            </button>
            <button
              onClick={() => {
                setViewMode('WITHDRAWN');
                if (withdrawnProducts[0]) setSelectedProductId(withdrawnProducts[0].id);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'WITHDRAWN'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Aplicações Resgatadas / Históricas ({withdrawnProducts.length})</span>
            </button>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {viewMode === 'ACTIVE'
              ? `${activeProducts.length} títulos gerando rentabilidade diária na carteira`
              : `${withdrawnProducts.length} títulos encerrados com histórico e lucro realizado computados`}
          </span>
        </div>

        {/* Product Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {displayedProducts.map((prod) => {
            const isSelected = prod.id === activeProduct?.id;
            const netVal = prod.netValueBrl ?? prod.marketValueBrl - (prod.taxesAndFeesBrl || 0);
            const isWithdrawn = prod.status === 'WITHDRAWN';
            return (
              <button
                key={prod.id}
                onClick={() => handleSelectProduct(prod)}
                className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? isWithdrawn
                      ? 'bg-amber-500/15 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-blue-500/15 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                    : 'bg-[#121418] border-[#2b303b] hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {prod.issuer}
                    </span>
                    {getAutomationBadge(prod)}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="text-xs font-bold text-white line-clamp-1">{prod.name}</div>
                    <span className={`text-xs font-mono font-bold shrink-0 ${prod.rentabilityPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {prod.rentabilityPct >= 0 ? '+' : ''}{formatPct(prod.rentabilityPct, 2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{prod.indexer}</div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#2b303b]/60 grid grid-cols-2 gap-2 font-mono text-xs">
                  <div>
                    <div className="text-[10px] font-sans text-slate-500">
                      {isWithdrawn ? 'Valor Aplicado' : 'Saldo Bruto'}
                    </div>
                    <div className="font-bold text-white">
                      {formatCurrency(isWithdrawn ? (prod.initialDepositBrl || prod.totalInvestedBrl) : prod.marketValueBrl, currency, ptax, hideValues)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-sans text-slate-500">
                      {isWithdrawn ? 'Lucro Realizado' : 'Valor Líquido'}
                    </div>
                    <div className={`font-bold ${isWithdrawn ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isWithdrawn
                        ? `${prod.absoluteProfitBrl >= 0 ? '+' : ''}${formatCurrency(prod.absoluteProfitBrl, currency, ptax, hideValues)}`
                        : formatCurrency(netVal, currency, ptax, hideValues)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Product Automation Breakdown + Sub-Tranches + Monthly History */}
        {activeProduct && (
          <div className="mt-6 bg-[#121418] border border-[#2b303b] rounded-xl p-5 space-y-5">
            {/* Sub-header with Automation Details & Quick Quantity Editor */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#2b303b]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-bold text-white">
                    {activeProduct.name}
                  </h4>
                  {getAutomationBadge(activeProduct)}
                  {activeProduct.expirationDate && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Vencimento: {activeProduct.expirationDate}
                    </span>
                  )}
                </div>
                {activeProduct.status === 'WITHDRAWN' ? (
                  <div className="text-xs text-slate-400 mt-1 font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      Aplicado: <strong className="text-white">{formatCurrency(activeProduct.initialDepositBrl || activeProduct.totalInvestedBrl, currency, ptax, hideValues)}</strong>
                    </span>
                    <span>
                      Lucro Realizado: <strong className="text-amber-400">{activeProduct.absoluteProfitBrl >= 0 ? '+' : ''}{formatCurrency(activeProduct.absoluteProfitBrl, currency, ptax, hideValues)}</strong>
                    </span>
                    <span>
                      Rentabilidade: <strong className={activeProduct.rentabilityPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{activeProduct.rentabilityPct >= 0 ? '+' : ''}{formatPct(activeProduct.rentabilityPct, 2)}</strong>
                    </span>
                    <span>
                      Status: <strong className="text-slate-300">Resgatado em {activeProduct.withdrawnMonth || activeProduct.expirationDate || ''}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mt-1 font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      Aplicado: <strong className="text-white">{formatCurrency(activeProduct.totalInvestedBrl, currency, ptax, hideValues)}</strong>
                    </span>
                    <span>
                      Bruto: <strong className="text-blue-400">{formatCurrency(activeProduct.marketValueBrl, currency, ptax, hideValues)}</strong>
                    </span>
                    <span>
                      IR / B3: <strong className="text-rose-400">-{formatCurrency(activeProduct.taxesAndFeesBrl || 0, currency, ptax, hideValues)}</strong>
                    </span>
                    <span>
                      Líquido: <strong className="text-emerald-400">{formatCurrency(activeProduct.netValueBrl ?? activeProduct.marketValueBrl, currency, ptax, hideValues)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* If CVM Fund or Tesouro Direto, show exact Quotas/Titles calculator */}
              {(activeProduct.automationType === 'CVM_QUOTA' ||
                activeProduct.automationType === 'TESOURO_DIRETO') && (
                <form
                  onSubmit={handleUpdateQuotasOrTitles}
                  className="flex flex-wrap items-center gap-2 bg-[#1b1e24] border border-[#2b303b] rounded-lg px-3 py-2 text-xs"
                >
                  <div className="font-mono">
                    <span className="text-slate-400 font-sans block text-[10px]">
                      {activeProduct.automationType === 'CVM_QUOTA'
                        ? `CNPJ ${activeProduct.cvmCnpj} • Cota R$ ${(activeProduct.lastQuotaValue || 1.7824021).toFixed(6)}`
                        : `${activeProduct.automationIdentifier} • PU R$ ${(activeProduct.lastTesouroPu || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                    <span className="text-white font-bold">
                      {activeProduct.automationType === 'CVM_QUOTA'
                        ? `Qtd. Cotas: ${activeProduct.fundQuotas?.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`
                        : `Qtd. Títulos: ${activeProduct.tesouroTitlesQty?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder={
                      activeProduct.automationType === 'CVM_QUOTA' ? 'Nova Qtd. Cotas' : 'Nova Qtd. Títulos'
                    }
                    value={editQtyInput}
                    onChange={(e) => setEditQtyInput(e.target.value)}
                    className="w-32 bg-[#121418] border border-[#2b303b] rounded px-2 py-1 text-white font-mono text-xs"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    Atualizar Qtd.
                  </button>
                </form>
              )}
            </div>

            {/* Sub-Tranches Table for NuBank Invest (Saldo Separado + Caixinha RDB Resgate Imediato) */}
            {activeProduct.subTranches && activeProduct.subTranches.length > 0 && (
              <div className="bg-[#181b21] border border-blue-500/25 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Composição Interna — {activeProduct.name} (Saldo Separado + Depósitos da Caixinha RDB)
                  </h5>
                  <span className="text-[11px] font-mono text-emerald-400">
                    Indexador: 100% do CDI (Série 12 BCB em dias úteis)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#2b303b] text-[10px] text-slate-400 uppercase font-sans">
                        <th className="py-2 px-2.5">Sub-Conta / Depósito</th>
                        <th className="py-2 px-2.5">Data / Vencimento</th>
                        <th className="py-2 px-2.5 text-right">Principal Aplicado</th>
                        <th className="py-2 px-2.5 text-right">Valor Bruto</th>
                        <th className="py-2 px-2.5 text-right">Alíquota IR</th>
                        <th className="py-2 px-2.5 text-right">Imposto (IR/IOF)</th>
                        <th className="py-2 px-2.5 text-right">Valor Líquido</th>
                        <th className="py-2 px-2.5">Regra de Automação & Tributação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b303b]/60">
                      {activeProduct.subTranches.map((tr) => (
                        <tr key={tr.id} className="hover:bg-[#1f242d]">
                          <td className="py-2.5 px-2.5 font-sans font-semibold text-white">
                            {tr.label}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-300">
                            {tr.depositDate}
                            {tr.maturityDate ? ` → ${tr.maturityDate}` : ''}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-slate-300">
                            {formatCurrency(tr.appliedBrl, currency, ptax, hideValues)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-blue-400">
                            {formatCurrency(tr.grossValueBrl, currency, ptax, hideValues)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-amber-300">
                            {tr.irAliquotPct > 0 ? `${tr.irAliquotPct.toFixed(1)}%` : 'Isento no Saldo'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-rose-400">
                            {tr.taxBrl > 0
                              ? `-${formatCurrency(tr.taxBrl, currency, ptax, hideValues)}`
                              : 'R$ 0,00'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-emerald-400">
                            {formatCurrency(tr.netValueBrl, currency, ptax, hideValues)}
                          </td>
                          <td className="py-2.5 px-2.5 font-sans text-[11px] text-slate-400">
                            {tr.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly History & Manual Month Entry Form */}
            <div>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  Histórico Mensal de Evolução
                </div>

                <form onSubmit={handleAddMonthlyEntry} className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="month"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    className="bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Novo Aporte/Resgate (R$)"
                    value={newDepositBrl || ''}
                    onChange={(e) => setNewDepositBrl(parseFloat(e.target.value) || 0)}
                    className="w-40 bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Novo Saldo Bruto (R$)"
                    value={newMarketValBrl || ''}
                    onChange={(e) => setNewMarketValBrl(parseFloat(e.target.value) || 0)}
                    className="w-40 bg-[#1b1e24] border border-[#2b303b] rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar Aporte / Mês
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto max-h-[250px] border border-[#2b303b] rounded-lg">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="sticky top-0 bg-[#181b21] border-b border-[#2b303b] text-[11px] text-slate-400 uppercase font-sans">
                    <tr>
                      <th className="py-2 px-3">Mês / Ano</th>
                      <th className="py-2 px-3 text-right">Aporte / Resgate</th>
                      <th className="py-2 px-3 text-right">Valor de Mercado (Bruto)</th>
                      <th className="py-2 px-3 text-right">% A.M.</th>
                      <th className="py-2 px-3 text-right">Rent. Acumulada (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b303b]/50">
                    {activeProduct.monthlyHistory.map((mRow) => (
                      <tr key={mRow.month} className="hover:bg-[#1b1e24]">
                        <td className="py-2 px-3 font-bold text-slate-200">{mRow.month}</td>
                        <td
                          className={`py-2 px-3 text-right ${
                            mRow.depositWithdrawalBrl > 0
                              ? 'text-emerald-400'
                              : mRow.depositWithdrawalBrl < 0
                                ? 'text-red-400'
                                : 'text-slate-500'
                          }`}
                        >
                          {mRow.depositWithdrawalBrl !== 0
                            ? formatCurrency(mRow.depositWithdrawalBrl, currency, ptax, hideValues)
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-white">
                          {formatCurrency(mRow.marketValueBrl, currency, ptax, hideValues)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            mRow.monthlyReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatPct(mRow.monthlyReturnPct, 2, true)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-bold ${
                            mRow.accumulatedReturnPct >= 0 ? 'text-amber-400' : 'text-red-400'
                          }`}
                        >
                          {formatPct(mRow.accumulatedReturnPct, 2, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Gross-up Calculator (LCA / LCI Isenta vs. CDB) */}
      <div className="bg-[#1b1e24] border border-[#2b303b] rounded-xl p-6 shadow-lg">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
          <div className="xl:col-span-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-[#2b303b]">
              <Calculator className="w-4 h-4 text-amber-400" />
              Gross-up Calculator (LCA / LCI Isenta vs. CDB Tributado)
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Calcule quanto um CDB tributado precisa render do CDI para empatar com uma LCA/LCI isenta de Imposto de Renda.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Taxa Isenta LCA/LCI (% CDI)</label>
                <input
                  type="number"
                  step="0.5"
                  value={lcaRatePct}
                  onChange={(e) => setLcaRatePct(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Prazo em Dias Corridos</label>
                <input
                  type="number"
                  value={daysHeld}
                  onChange={(e) => setDaysHeld(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#121418] border border-[#2b303b] rounded-lg px-3 py-2 text-white font-mono font-bold"
                />
              </div>
            </div>

            <div className="mt-4 bg-[#121418] border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">
                  Alíquota IR Regressivo: <strong className="text-white">{formatPct(taxAliquot, 1)}</strong>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Equivalência Bruta (Gross-up CDB):</div>
              </div>
              <div className="text-2xl font-extrabold font-mono text-amber-400">
                {formatPct(grossUpEquivalent, 1)} do CDI
              </div>
            </div>
          </div>

          {/* Registered LCAs */}
          <div className="xl:col-span-6 bg-[#121418] border border-[#2b303b] rounded-xl p-5">
            <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
              <span>Histórico de LCAs Registradas:</span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Isento de IR
              </span>
            </div>
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[#2b303b] text-[10px] text-slate-500 uppercase font-sans">
                  <th className="py-2">Emissor / Produto</th>
                  <th className="py-2 text-right">Taxa</th>
                  <th className="py-2 text-right">Prazo</th>
                  <th className="py-2 text-right">IR Eq.</th>
                  <th className="py-2 text-right">Gross-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b303b]/50">
                <tr>
                  <td className="py-2.5 font-sans text-slate-300">Banco Original LCA (2024-2025)</td>
                  <td className="py-2.5 text-right text-white">95,5%</td>
                  <td className="py-2.5 text-right text-slate-400">540d</td>
                  <td className="py-2.5 text-right text-slate-400">17,5%</td>
                  <td className="py-2.5 text-right text-emerald-400 font-bold">115,8%</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-sans text-white font-semibold">Banco Original LCA (2026-2028)</td>
                  <td className="py-2.5 text-right text-white">92,0%</td>
                  <td className="py-2.5 text-right text-slate-400">699d</td>
                  <td className="py-2.5 text-right text-slate-400">17,5%</td>
                  <td className="py-2.5 text-right text-amber-400 font-bold">111,5%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
