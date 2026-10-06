import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'patrimony-dashboard-data')
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'patrimony.sqlite');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'portfolio_state.json');
const PORTFOLIO_STORE_KEY = 'portfolio_state_v3';

const memoryKvStore = new Map();
let db = null;

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {}

try {
  const sqliteMod = await import('node:sqlite');
  if (sqliteMod && sqliteMod.DatabaseSync) {
    db = new sqliteMod.DatabaseSync(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
} catch {
  db = null;
}

function getStore(key) {
  if (db) {
    try {
      const stmt = db.prepare('SELECT value, updated_at FROM kv_store WHERE key = ?');
      const row = stmt.get(key);
      if (row) {
        return { data: JSON.parse(row.value), updatedAt: row.updated_at };
      }
    } catch {}
  }
  if (memoryKvStore.has(key)) {
    return memoryKvStore.get(key);
  }
  if (key === PORTFOLIO_STORE_KEY) {
    try {
      if (fs.existsSync(JSON_BACKUP_PATH)) {
        const raw = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        return { data: JSON.parse(raw), updatedAt: new Date().toISOString() };
      }
    } catch {}
  }
  return null;
}

function setStore(key, data) {
  const now = new Date().toISOString();
  memoryKvStore.set(key, { data, updatedAt: now });
  const json = JSON.stringify(data, null, 2);
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO kv_store (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      stmt.run(key, json, now);
    } catch {}
  }
  if (key === PORTFOLIO_STORE_KEY) {
    try {
      fs.writeFileSync(JSON_BACKUP_PATH, json, 'utf-8');
    } catch {}
  }
  return now;
}

// Convert DD/MM/YYYY to YYYY-MM-DD
function brDateToIso(brDate) {
  if (!brDate || typeof brDate !== 'string') return '';
  const parts = brDate.trim().split('/');
  if (parts.length !== 3) return brDate;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// 1. Fetch BCB Daily CDI (Série 12)
async function fetchBcbDailyCdi() {
  try {
    const resp = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/25?formato=json',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const dailyEntries = rows
      .map((r) => ({
        dateBr: r.data,
        dateIso: brDateToIso(r.data),
        ratePct: parseFloat(r.valor),
      }))
      .filter((r) => !Number.isNaN(r.ratePct));

    const latest = dailyEntries[dailyEntries.length - 1];
    const annualizedCdiPct = latest
      ? Number(((Math.pow(1 + latest.ratePct / 100, 252) - 1) * 100).toFixed(2))
      : 13.65;

    return {
      serie: 12,
      latestDateBr: latest?.dateBr || '',
      latestDateIso: latest?.dateIso || '',
      latestDailyRatePct: latest?.ratePct || 0.050788,
      annualizedCdiPct,
      dailyEntries,
    };
  } catch {
    return null;
  }
}

// 2. Fetch CVM Daily Fund Quota from official INF_DIARIO ZIP (Nu Reserva Imediata: 42.699.466/0001-77)
async function fetchCvmFundQuotas(targetCnpjs = ['42.699.466/0001-77']) {
  const now = new Date();
  const candidates = [];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  candidates.push(`${y}${m}`);
  const prev = new Date(y, now.getMonth() - 1, 1);
  candidates.push(`${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`);
  if (!candidates.includes('202609')) candidates.push('202609');

  for (const yyyymm of candidates) {
    try {
      const url = `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${yyyymm}.zip`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!resp.ok) continue;

      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) continue;

      const compMethod = buf.readUInt16LE(8);
      const fileNameLen = buf.readUInt16LE(26);
      const extraLen = buf.readUInt16LE(28);
      const dataStart = 30 + fileNameLen + extraLen;

      // Locate Central Directory header (0x02014b50) to know exact compressed size
      const cdOffset = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
      const compData =
        cdOffset > dataStart ? buf.subarray(dataStart, cdOffset) : buf.subarray(dataStart);

      const rawCsv =
        compMethod === 8
          ? zlib.inflateRawSync(compData).toString('latin1')
          : compData.toString('latin1');

      const results = {};
      for (const cnpj of targetCnpjs) {
        let idx = 0;
        let lastLine = null;
        while ((idx = rawCsv.indexOf(cnpj, idx)) !== -1) {
          const lineStart = rawCsv.lastIndexOf('\n', idx) + 1;
          const lineEnd = rawCsv.indexOf('\n', idx);
          lastLine = rawCsv
            .slice(lineStart, lineEnd === -1 ? rawCsv.length : lineEnd)
            .trim();
          idx = lineEnd === -1 ? rawCsv.length : lineEnd + 1;
        }
        if (lastLine) {
          const cols = lastLine.split(';');
          // Format: TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;...
          const dateIso = cols[3] || '';
          const quotaVal = parseFloat(cols[5]);
          if (!Number.isNaN(quotaVal) && quotaVal > 0) {
            results[cnpj] = {
              cnpj,
              dateIso,
              quotaValue: quotaVal,
              sourceFile: `inf_diario_fi_${yyyymm}.zip`,
            };
          }
        }
      }

      if (Object.keys(results).length > 0) {
        return results;
      }
    } catch {
      // Try next candidate month
    }
  }
  return {};
}

// 3. Fetch Tesouro Transparente Official CSV for latest Mark-to-Market PU
async function fetchTesouroDiretoPuMap() {
  try {
    const url =
      'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return {};

    const text = await resp.text();
    const lines = text.split('\n');
    const latestByBond = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (!line.startsWith('Tesouro IPCA+') && !line.startsWith('Tesouro Selic')) continue;

      const cols = line.split(';');
      if (cols.length < 8) continue;
      const tipo = cols[0];
      const vencBr = cols[1];
      const baseBr = cols[2];
      // Only keep standard Tesouro IPCA+ (not Juros Semestrais) and Tesouro Selic
      if (tipo !== 'Tesouro IPCA+' && tipo !== 'Tesouro Selic') continue;

      const key = `${tipo}|${vencBr}`;
      const dateIso = brDateToIso(baseBr);
      const prev = latestByBond[key];

      if (!prev || dateIso > prev.dateIso) {
        const taxaCompra = parseFloat((cols[3] || '0').replace(',', '.'));
        const taxaVenda = parseFloat((cols[4] || '0').replace(',', '.'));
        const puCompra = parseFloat((cols[5] || '0').replace(',', '.'));
        const puVenda = parseFloat((cols[6] || '0').replace(',', '.'));
        const puBase = parseFloat((cols[7] || '0').replace(',', '.'));

        latestByBond[key] = {
          bondKey: key,
          tipo,
          maturityBr: vencBr,
          dateBr: baseBr,
          dateIso,
          taxaCompra,
          taxaVenda,
          puCompra,
          puVenda,
          puBase,
        };
      }
    }
    return latestByBond;
  } catch {
    return {};
  }
}

// Cached wrapper (6-hour TTL for CVM ZIP & Tesouro CSV, 30-min TTL for BCB CDI)
let memoryFixedIncomeCache = {
  timestamp: 0,
  data: null,
};

async function getFixedIncomeLiveMarket(forceRefresh = false) {
  const nowMs = Date.now();
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  if (!forceRefresh && memoryFixedIncomeCache.data && nowMs - memoryFixedIncomeCache.timestamp < CACHE_TTL_MS) {
    return memoryFixedIncomeCache.data;
  }

  // Also check SQLite cache if server just restarted
  if (!forceRefresh && !memoryFixedIncomeCache.data) {
    const cached = getStore('fixed_income_market_cache');
    if (cached && nowMs - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS) {
      memoryFixedIncomeCache = { timestamp: nowMs, data: cached.data };
      return cached.data;
    }
  }

  const [bcbCdi, cvmQuotas, tesouroPu] = await Promise.all([
    fetchBcbDailyCdi(),
    fetchCvmFundQuotas(['42.699.466/0001-77']),
    fetchTesouroDiretoPuMap(),
  ]);

  const result = {
    syncedAt: new Date().toISOString(),
    bcbCdi: bcbCdi || {
      serie: 12,
      latestDateBr: '24/09/2026',
      latestDateIso: '2026-09-24',
      latestDailyRatePct: 0.050788,
      annualizedCdiPct: 13.65,
      dailyEntries: [],
    },
    cvmQuotas:
      Object.keys(cvmQuotas).length > 0
        ? cvmQuotas
        : {
            '42.699.466/0001-77': {
              cnpj: '42.699.466/0001-77',
              dateIso: '2026-09-24',
              quotaValue: 1.7824021,
              sourceFile: 'inf_diario_fi_202609.zip',
            },
          },
    tesouroPu,
  };

  memoryFixedIncomeCache = { timestamp: nowMs, data: result };
  setStore('fixed_income_market_cache', result);
  return result;
}

// Helper to fetch a single Yahoo Finance v8 chart quote
async function fetchYahooQuote(yahooSymbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      symbol: yahooSymbol,
      price,
      prevClose,
      changePct: Number(changePct.toFixed(2)),
      currency: meta.currency || 'USD',
      marketState: meta.marketState || 'REGULAR',
    };
  } catch {
    return null;
  }
}

// Map portfolio ticker to Yahoo Finance symbol
function mapTickerToYahoo(ticker, assetClass, broker) {
  const clean = ticker.trim().toUpperCase();
  if (clean === 'USD') return 'BRL=X';
  if (clean === 'EUR') return 'EURBRL=X';
  if (clean === 'GBP') return 'GBPBRL=X';
  if (clean === 'CHF') return 'CHFBRL=X';

  if (assetClass === 'CRYPTO') {
    if (clean.endsWith('USD')) {
      const coin = clean.replace('USD', '');
      return `${coin}-USD`;
    }
    return `${clean}-USD`;
  }

  // B3 assets (Stocks BR, FIIs, or B3 ETFs like IVVB11)
  if (
    assetClass === 'STOCKS_BR' ||
    assetClass === 'FIIS' ||
    broker === 'XP' ||
    clean === 'IVVB11' ||
    clean === 'BOVA11' ||
    clean === 'SMAL11'
  ) {
    return clean.endsWith('.SA') ? clean : `${clean}.SA`;
  }

  // US Stocks & US ETFs (e.g. BRK.B -> BRK-B)
  return clean.replace('.', '-');
}

// Helper to parse Brazilian formatted floats (e.g. "1.919,71" -> 1919.71)
function parseBrFloat(val) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  const cleaned = val.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const DEFAULT_GOOGLE_SHEET_ID = '1tjC-ToX_6GJ2AFOtHTRnBJLVDXgy2scc-0mGaWZWhBk';

async function fetchGvizTabJson(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Google Sheets HTTP ${resp.status} for gid=${gid}`);
  const text = await resp.text();
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Invalid gviz response for gid=${gid}`);
  }
  return JSON.parse(text.substring(startIdx, endIdx + 1));
}

function mapSpreadsheetClassToDashboard(ticker, rawClass) {
  const cleanTicker = ticker.trim().toUpperCase();
  const cleanClass = (rawClass || '').trim().toUpperCase();

  if (cleanTicker === 'IAU') {
    return { assetClass: 'PROTECTION', macroGroup: 'Protection' };
  }
  if (
    cleanTicker === 'IVVB11' ||
    cleanClass === 'ETF' ||
    cleanClass === 'ETF_US' ||
    cleanTicker === 'VOO' ||
    cleanTicker === 'VNQ' ||
    cleanTicker === 'CIBR' ||
    cleanTicker === 'URNM'
  ) {
    return { assetClass: 'ETFS_US', macroGroup: 'ETFs (US)' };
  }
  if (cleanClass === 'AÇÃO' || cleanClass === 'ACAO' || cleanClass === 'BDR') {
    return { assetClass: 'STOCKS_BR', macroGroup: 'Stocks (BRA)' };
  }
  if (cleanClass === 'STOCK') {
    return { assetClass: 'STOCKS_US', macroGroup: 'Stocks (US)' };
  }
  if (cleanClass === 'FII') {
    return { assetClass: 'FIIS', macroGroup: 'FIIs' };
  }
  if (cleanClass === 'CRIPTO') {
    return { assetClass: 'CRYPTO', macroGroup: 'Cryptocurrency' };
  }
  return { assetClass: 'STOCKS_BR', macroGroup: 'Stocks (BRA)' };
}

const SHEET_DAILY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (once per day)

let memoryGoogleSheetsCache = {
  timestamp: 0,
  sheetId: DEFAULT_GOOGLE_SHEET_ID,
  data: null,
};

async function fetchGoogleSheetsPortfolio(sheetId = DEFAULT_GOOGLE_SHEET_ID, forceRefresh = false) {
  const nowMs = Date.now();

  if (
    !forceRefresh &&
    memoryGoogleSheetsCache.data &&
    memoryGoogleSheetsCache.sheetId === sheetId &&
    nowMs - memoryGoogleSheetsCache.timestamp < SHEET_DAILY_TTL_MS
  ) {
    return memoryGoogleSheetsCache.data;
  }

  if (!forceRefresh) {
    const stored = getStore('google_sheets_live_cache');
    if (stored?.data && stored.updatedAt) {
      const ageMs = nowMs - new Date(stored.updatedAt).getTime();
      if (ageMs >= 0 && ageMs < SHEET_DAILY_TTL_MS) {
        memoryGoogleSheetsCache = {
          timestamp: new Date(stored.updatedAt).getTime(),
          sheetId,
          data: stored.data,
        };
        return stored.data;
      }
    }
  }

  try {
    // Only fetch op.normal (gid=778780661) and proventos (gid=212877244) once per day
    const [opsJson, provJson] = await Promise.all([
      fetchGvizTabJson(sheetId, '778780661'),
      fetchGvizTabJson(sheetId, '212877244'),
    ]);

    // 1. Parse variable-income operations from op.normal
    const transactions = [];
    const opRows = opsJson?.table?.rows || [];
    for (let i = 0; i < opRows.length; i++) {
      const c = opRows[i].c || [];
      const ticker = String(c[1]?.v || '').trim();
      const dateBr = c[2]?.f || '';
      const event = String(c[3]?.v || '').trim();
      const rawClass = String(c[12]?.v || '').trim();
      if (!ticker || !dateBr || !event) continue;
      // Skip legacy 2019 fixed-income balance entries in op.normal
      if (rawClass === 'R.FIXA' || event === 'SALDO') continue;

      const dateIso = brDateToIso(dateBr);
      const quantity = typeof c[4]?.v === 'number' ? c[4].v : parseBrFloat(c[4]?.f || c[4]?.v);
      const price = Number(
        (typeof c[5]?.v === 'number' ? c[5].v : parseBrFloat(c[5]?.f || c[5]?.v)).toFixed(4)
      );
      const fees = Number(
        (typeof c[6]?.v === 'number' ? c[6].v : parseBrFloat(c[6]?.f || c[6]?.v)).toFixed(2)
      );
      const broker = String(c[7]?.v || 'XP').trim();
      const currency = String(c[9]?.v || 'BRL').trim() === 'USD' ? 'USD' : 'BRL';
      const notes = c[10]?.v ? String(c[10].v).trim() : undefined;
      const volumeBrl = Number(
        (typeof c[14]?.v === 'number' ? c[14].v : parseBrFloat(c[14]?.f || c[14]?.v)).toFixed(2)
      );
      const profitBrl = Number(
        (typeof c[15]?.v === 'number' ? c[15].v : parseBrFloat(c[15]?.f || c[15]?.v)).toFixed(2)
      );
      const profitPct = Number(
        (typeof c[16]?.v === 'number' ? c[16].v * 100 : parseBrFloat(c[16]?.f || c[16]?.v)).toFixed(2)
      );
      const cashFlowBrl = Number(
        (typeof c[17]?.v === 'number' ? c[17].v : parseBrFloat(c[17]?.f || c[17]?.v)).toFixed(2)
      );
      const ptax = Number(
        (typeof c[22]?.v === 'number' ? c[22].v : parseBrFloat(c[22]?.f || c[22]?.v) || 1).toFixed(4)
      );

      transactions.push({
        id: `gs-tx-${i + 1}`,
        ticker,
        date: dateIso,
        event,
        quantity,
        price,
        fees,
        broker,
        currency,
        assetClass: rawClass,
        volumeBrl,
        profitBrl,
        profitPct,
        cashFlowBrl,
        ptax,
        notes,
      });
    }

    // 2. Parse all dividends & JSCP from proventos
    const dividends = [];
    const provRows = provJson?.table?.rows || [];
    let totalHistoricalDividendsBrl = 0;
    for (let i = 0; i < provRows.length; i++) {
      const c = provRows[i].c || [];
      const ticker = String(c[1]?.v || '').trim();
      const dateBr = c[2]?.f || '';
      const rawType = String(c[3]?.v || 'DIVIDENDO').trim().toUpperCase();
      if (!ticker || !dateBr) continue;

      const netValueBrl = Number(
        (typeof c[16]?.v === 'number' ? c[16].v : parseBrFloat(c[16]?.f || c[16]?.v)).toFixed(2)
      );
      if (netValueBrl <= 0) continue;

      const grossValueBrl = Number(
        (typeof c[14]?.v === 'number' ? c[14].v : parseBrFloat(c[14]?.f || c[14]?.v)).toFixed(2)
      );
      const irrfBrl = Number(
        (typeof c[15]?.v === 'number' ? c[15].v : parseBrFloat(c[15]?.f || c[15]?.v)).toFixed(2)
      );
      const broker = String(c[7]?.v || 'XP').trim();
      const rawCls = String(c[12]?.v || 'FII').trim().toUpperCase();
      const assetClass =
        rawCls === 'FII'
          ? 'FII'
          : rawCls === 'AÇÃO' || rawCls === 'ACAO'
            ? 'AÇÃO'
            : rawCls === 'ETF_US' || rawCls === 'ETF'
              ? 'ETF_US'
              : 'STOCK';

      totalHistoricalDividendsBrl += netValueBrl;

      dividends.push({
        id: `gs-div-${i + 1}`,
        ticker,
        date: brDateToIso(dateBr),
        type: rawType === 'JSCP' ? 'JSCP' : 'DIVIDENDO',
        netValueBrl,
        grossValueBrl,
        irrfBrl,
        broker,
        assetClass,
      });
    }

    // Sort dividends newest-first so recentDividends table shows the latest payments on top
    dividends.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    const result = {
      syncedAt: new Date().toISOString(),
      sheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      transactionsCount: transactions.length,
      dividendsCount: dividends.length,
      totalHistoricalDividendsBrl: Number(totalHistoricalDividendsBrl.toFixed(2)),
      transactions,
      recentDividends: dividends,
    };

    memoryGoogleSheetsCache = { timestamp: nowMs, sheetId, data: result };
    setStore('google_sheets_live_cache', result);
    return result;
  } catch (err) {
    const cached = getStore('google_sheets_live_cache');
    return cached ? cached.data : null;
  }
}

const DEFAULT_PATRIMONY_SHEET_ID = '1k4QgQBC0TiBC0zRnKDxm8RRtqJ6pg-9D8k4mJ2pCk5w';

const PT_MONTHS = {
  janeiro: '01',
  fevereiro: '02',
  'março': '03',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

const FI_COL_ID_MAP = {
  3: 'fi-nubank-invest',
  7: 'fi-nubank-cdb-107',
  11: 'fi-caixinha-uv',
  15: 'fi-lca-original',
  19: 'fi-lca-original-95',
  23: 'fi-nu-reserva',
  27: 'fi-nubank-cdb-200',
  31: 'fi-reserva-emergencia',
  35: 'fi-picpay',
  39: 'fi-td-selic-2027',
  43: 'fi-td-pre-2025',
  47: 'fi-td-ipca-2035',
  51: 'fi-td-ipca-2029',
  55: 'fi-td-ipca-2032',
  59: 'fi-td-pre-2021',
  63: 'fi-alaska-black',
};

let memoryPatrimonySheetCache = {
  timestamp: 0,
  sheetId: DEFAULT_PATRIMONY_SHEET_ID,
  data: null,
};

async function fetchPatrimonyAnalysisSheet(
  sheetId = DEFAULT_PATRIMONY_SHEET_ID,
  forceRefresh = false
) {
  const nowMs = Date.now();

  if (
    !forceRefresh &&
    memoryPatrimonySheetCache.data &&
    memoryPatrimonySheetCache.sheetId === sheetId &&
    nowMs - memoryPatrimonySheetCache.timestamp < SHEET_DAILY_TTL_MS
  ) {
    return memoryPatrimonySheetCache.data;
  }

  if (!forceRefresh) {
    const stored = getStore('patrimony_sheet_live_cache');
    if (stored?.data && stored.updatedAt) {
      const ageMs = nowMs - new Date(stored.updatedAt).getTime();
      if (ageMs >= 0 && ageMs < SHEET_DAILY_TTL_MS) {
        memoryPatrimonySheetCache = {
          timestamp: new Date(stored.updatedAt).getTime(),
          sheetId,
          data: stored.data,
        };
        return stored.data;
      }
    }
  }

  try {
    // Only fetch Fixed Income, Currency, and Manual Leftovers once per day
    const [patJson, fiJson, currJson] = await Promise.all([
      fetchGvizTabJson(sheetId, '1016513211'), // Patrimony (for manual leftovers & currency protection BRL only)
      fetchGvizTabJson(sheetId, '445356284'),  // Fixed Income
      fetchGvizTabJson(sheetId, '1898740221'), // Currency
    ]);

    // 1. Parse Manual Cash on Hand / Leftovers & Protection Currency Balances ONLY
    const patRows = patJson?.table?.rows || [];
    const manualCashItems = [];
    const protectionCurrencyBrl = {};

    let inCashOnHandSection = false;
    let inProtectionSection = false;

    for (let i = 0; i < patRows.length; i++) {
      const c = patRows[i].c || [];
      const col0 = String(c[0]?.v || '').trim();
      const col2 = String(c[2]?.v || '').trim();
      const col3 = typeof c[3]?.v === 'number' ? c[3].v : parseBrFloat(c[3]?.f || c[3]?.v);
      const col4 = String(c[4]?.v || '').trim();

      if (col2 === 'CASH ON HAND SHARE') {
        inCashOnHandSection = true;
        continue;
      }
      if (inCashOnHandSection && (col2 === 'Total' || col2 === 'STOCKS (BRA)')) {
        inCashOnHandSection = false;
      }

      if (inCashOnHandSection && col2 && col2 !== 'Types of Investment') {
        const isManual = col4.toLowerCase() === 'manual';
        if (isManual) {
          manualCashItems.push({
            name: col2,
            valueBrl: Number(col3.toFixed(2)),
            riskLevel: ['Very low', 'Low', 'Medium', 'High'].includes(col0) ? col0 : 'Very low',
          });
        }
      }

      if (col2 === 'PROTECTION') {
        inProtectionSection = true;
        continue;
      }
      if (inProtectionSection && col2 && col2 !== 'Types of Investment') {
        if (col2 === 'Dollar') protectionCurrencyBrl.USD = Number(col3.toFixed(2));
        if (col2 === 'Euro') protectionCurrencyBrl.EUR = Number(col3.toFixed(2));
        if (col2.startsWith('Pound')) protectionCurrencyBrl.GBP = Number(col3.toFixed(2));
        if (col2 === 'Swiss Franc') protectionCurrencyBrl.CHF = Number(col3.toFixed(2));
      }
    }

    // 2. Parse Currency Tab (Câmbio summaries & purchase history)
    const currRows = currJson?.table?.rows || [];
    const r0 = currRows[0]?.c || [];
    const r1 = currRows[1]?.c || [];
    const r2 = currRows[2]?.c || [];

    const currencyDefs = [
      { code: 'USD', title: 'DOLLAR (US$)', flag: '🇺🇸', sym: '$', colDate: 1, colAmt: 2, colEx: 3, colTax: 4 },
      { code: 'GBP', title: 'POUNDS (£)', flag: '🇬🇧', sym: '£', colDate: 6, colAmt: 7, colEx: 8, colTax: 9 },
      { code: 'EUR', title: 'EURO (€)', flag: '🇪🇺', sym: '€', colDate: 11, colAmt: 12, colEx: 13, colTax: 14 },
      { code: 'CHF', title: 'SWISS FRANC (CHF)', flag: '🇨🇭', sym: 'CHF', colDate: 16, colAmt: 17, colEx: 18, colTax: 19 },
    ];

    const forexSummaries = currencyDefs.map((def) => {
      const currentEx = Number(
        (typeof r0[def.colAmt]?.v === 'number' ? r0[def.colAmt].v : parseBrFloat(r0[def.colAmt]?.f)).toFixed(4)
      );
      const avgPaidEx = Number(
        (typeof r0[def.colTax]?.v === 'number' ? r0[def.colTax].v : parseBrFloat(r0[def.colTax]?.f)).toFixed(4)
      );
      const cashForeign = Number(
        (typeof r1[def.colAmt]?.v === 'number' ? r1[def.colAmt].v : parseBrFloat(r1[def.colAmt]?.f)).toFixed(2)
      );
      const taxPaidBrl = Number(
        (typeof r1[def.colTax]?.v === 'number' ? r1[def.colTax].v : parseBrFloat(r1[def.colTax]?.f)).toFixed(2)
      );
      const profitPct = Number(
        (typeof r2[def.colAmt]?.v === 'number' ? r2[def.colAmt].v * 100 : parseBrFloat(r2[def.colAmt]?.f)).toFixed(2)
      );
      const profitBrl = Number(
        (typeof r2[def.colTax]?.v === 'number' ? r2[def.colTax].v : parseBrFloat(r2[def.colTax]?.f)).toFixed(2)
      );
      const valueBrl = Number((cashForeign * currentEx).toFixed(2));
      const paidBrl = Number((valueBrl - profitBrl).toFixed(2));

      return {
        code: def.code,
        title: def.title,
        flag: def.flag,
        cashOnHandForeign: cashForeign,
        cashOnHand: `${def.sym} ${cashForeign.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currentEx,
        avgPaidEx,
        valueBrl,
        paidBrl,
        taxPaidBrl,
        profitPct,
        profitBrl,
        patrimonyProtectionBrl: protectionCurrencyBrl[def.code] || valueBrl,
      };
    });

    const forexPurchases = [];
    for (const def of currencyDefs) {
      let seq = 1;
      for (let i = 4; i < currRows.length; i++) {
        const c = currRows[i].c || [];
        const dateStr = c[def.colDate]?.f || '';
        const amt =
          typeof c[def.colAmt]?.v === 'number' ? c[def.colAmt].v : parseBrFloat(c[def.colAmt]?.f);
        if (!dateStr || !amt || amt <= 0) continue;
        const exRate =
          typeof c[def.colEx]?.v === 'number' ? c[def.colEx].v : parseBrFloat(c[def.colEx]?.f) || 1;
        const taxBrl =
          typeof c[def.colTax]?.v === 'number' ? c[def.colTax].v : parseBrFloat(c[def.colTax]?.f) || 0;
        forexPurchases.push({
          id: `fx-${def.code.toLowerCase()}-${seq++}`,
          currency: def.code,
          date: dateStr.trim(),
          amountForeign: Number(amt.toFixed(2)),
          exchangeRate: Number(exRate.toFixed(4)),
          taxBrl: Number(taxBrl.toFixed(2)),
          note: exRate === 1 ? 'Proventos / Transferência' : undefined,
        });
      }
    }

    // 3. Parse Fixed Income Tab (all active 4-col blocks)
    const fiCols = fiJson?.table?.cols || [];
    const fiRows = fiJson?.table?.rows || [];
    const fiR1 = fiRows[1]?.c || [];
    const fiR2 = fiRows[2]?.c || [];

    const fixedIncomeSheetProducts = [];
    for (let col = 3; col < fiCols.length; col += 4) {
      const rawTitle = (fiCols[col]?.label || '').trim();
      if (!rawTitle) continue;

      const profitBrl = Number(
        (typeof fiR1[col + 1]?.v === 'number' ? fiR1[col + 1].v : parseBrFloat(fiR1[col + 1]?.f)).toFixed(2)
      );
      const initialDepositBrl = Number(
        (typeof fiR1[col + 3]?.v === 'number' ? fiR1[col + 3].v : parseBrFloat(fiR1[col + 3]?.f)).toFixed(2)
      );
      const rentabilityPct = Number(
        (typeof fiR2[col + 1]?.v === 'number' ? fiR2[col + 1].v * 100 : parseBrFloat(fiR2[col + 1]?.f)).toFixed(2)
      );
      const marketValueBrl = Number(
        (typeof fiR2[col + 3]?.v === 'number' ? fiR2[col + 3].v : parseBrFloat(fiR2[col + 3]?.f)).toFixed(2)
      );
      const totalInvestedBrl = Number((marketValueBrl - profitBrl).toFixed(2));

      const monthlyHistory = [];
      let currentYear = 2021;
      for (let r = 4; r < fiRows.length; r++) {
        const c = fiRows[r].c || [];
        if (typeof c[1]?.v === 'number') currentYear = c[1].v;
        const monthName = String(c[2]?.v || '').trim().toLowerCase();
        const mm = PT_MONTHS[monthName];
        if (!mm) continue;

        const depRaw =
          c[col]?.v !== undefined && c[col]?.v !== null ? parseBrFloat(c[col]?.f || c[col]?.v) : 0;
        const mktRaw =
          c[col + 1]?.v !== undefined && c[col + 1]?.v !== null
            ? parseBrFloat(c[col + 1]?.f || c[col + 1]?.v)
            : 0;
        const amRaw =
          typeof c[col + 2]?.v === 'number'
            ? c[col + 2].v * 100
            : parseBrFloat(c[col + 2]?.f || c[col + 2]?.v);
        const acumRaw =
          typeof c[col + 3]?.v === 'number'
            ? c[col + 3].v * 100
            : parseBrFloat(c[col + 3]?.f || c[col + 3]?.v);

        if (mktRaw > 0 || depRaw !== 0) {
          monthlyHistory.push({
            month: `${currentYear}-${mm}`,
            depositWithdrawalBrl: Number(depRaw.toFixed(2)),
            marketValueBrl: Number(mktRaw.toFixed(2)),
            monthlyReturnPct: Number(amRaw.toFixed(2)),
            accumulatedReturnPct: Number(acumRaw.toFixed(2)),
          });
        }
      }

      const lastEntry = monthlyHistory[monthlyHistory.length - 1];
      const isActive =
        lastEntry && lastEntry.month >= '2026-01' && lastEntry.marketValueBrl > 0 && marketValueBrl > 0;

      const mappedHoldingId = FI_COL_ID_MAP[col] || `fi-sheet-col-${col}`;
      const mappedProductId = FI_COL_ID_MAP[col]
        ? FI_COL_ID_MAP[col].replace(/^fi-/, 'fip-')
        : `fip-sheet-col-${col}`;

      if (isActive) {
        fixedIncomeSheetProducts.push({
          id: mappedProductId,
          holdingId: mappedHoldingId,
          colIndex: col,
          rawTitle: rawTitle.replace(/\s+/g, ' '),
          initialDepositBrl,
          totalInvestedBrl,
          marketValueBrl,
          absoluteProfitBrl: profitBrl,
          rentabilityPct,
          status: 'ACTIVE',
          latestMonth: lastEntry?.month || '2026-10',
          monthlyHistoryCount: monthlyHistory.length,
          monthlyHistory,
        });
      } else {
        // Withdrawn / Historical investments (previous investments withdrawn a while ago)
        const finalWithdrawalVal = Number(
          (lastEntry?.marketValueBrl || marketValueBrl || (initialDepositBrl + profitBrl)).toFixed(2)
        );
        fixedIncomeSheetProducts.push({
          id: mappedProductId,
          holdingId: mappedHoldingId,
          colIndex: col,
          rawTitle: rawTitle.replace(/\s+/g, ' '),
          initialDepositBrl,
          totalInvestedBrl: initialDepositBrl > 0 ? initialDepositBrl : totalInvestedBrl,
          marketValueBrl: 0, // Balance is 0 so current active patrimony is NOT inflated
          finalWithdrawalValueBrl: finalWithdrawalVal,
          absoluteProfitBrl: profitBrl,
          rentabilityPct,
          status: 'WITHDRAWN',
          withdrawnMonth: lastEntry?.month || 'Resgatado',
          latestMonth: lastEntry?.month || '',
          monthlyHistoryCount: monthlyHistory.length,
          monthlyHistory,
        });
      }
    }

    const result = {
      syncedAt: new Date().toISOString(),
      sheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      manualCashItems,
      forexSummaries,
      forexPurchases,
      fixedIncomeSheetProducts,
    };

    memoryPatrimonySheetCache = { timestamp: nowMs, sheetId, data: result };
    setStore('patrimony_sheet_live_cache', result);
    return result;
  } catch (err) {
    const cached = getStore('patrimony_sheet_live_cache');
    return cached ? cached.data : null;
  }
}

function sanitizePortfolioState(state) {
  if (!state || typeof state !== 'object') return state;
  const next = { ...state };
  if (Array.isArray(next.holdings)) {
    const seenIds = new Set();
    next.holdings = next.holdings.filter((h) => {
      if (!h || !h.id || seenIds.has(h.id)) return false;
      seenIds.add(h.id);
      return true;
    });
  }
  if (Array.isArray(next.fixedIncomeProducts)) {
    const byHoldingId = new Map();
    for (const p of next.fixedIncomeProducts) {
      if (!p) continue;
      const key = p.holdingId || p.id;
      const existing = byHoldingId.get(key);
      if (!existing) {
        byHoldingId.set(key, p);
      } else if (String(p.id).startsWith('fip-') && !String(existing.id).startsWith('fip-')) {
        byHoldingId.set(key, p);
      }
    }
    next.fixedIncomeProducts = Array.from(byHoldingId.values());
  }
  return next;
}

export function createApiApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  // Get stored portfolio state
  app.get('/api/portfolio', (req, res) => {
    const stored = getStore(PORTFOLIO_STORE_KEY);
    const cleanState = stored && stored.data ? sanitizePortfolioState(stored.data) : null;
    res.json({
      initialized: !!stored,
      state: cleanState,
      updatedAt: stored ? stored.updatedAt : null,
    });
  });

  // Save/sync full portfolio state to SQLite + JSON backup
  app.put('/api/portfolio', (req, res) => {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'Invalid portfolio state payload' });
    }
    const cleanState = sanitizePortfolioState(state);
    const updatedAt = setStore(PORTFOLIO_STORE_KEY, cleanState);
    res.json({ ok: true, updatedAt });
  });

  // Dedicated Google Sheets manual/on-demand sync endpoint (both spreadsheets)
  app.post('/api/google-sheets-sync', async (req, res) => {
    const {
      sheetId = DEFAULT_GOOGLE_SHEET_ID,
      patrimonySheetId = DEFAULT_PATRIMONY_SHEET_ID,
    } = req.body || {};
    const [data, patrimonyData] = await Promise.all([
      fetchGoogleSheetsPortfolio(sheetId, true),
      fetchPatrimonyAnalysisSheet(patrimonySheetId, true),
    ]);
    if (!data && !patrimonyData) {
      return res.status(502).json({ ok: false, error: 'Não foi possível sincronizar com o Google Sheets.' });
    }
    res.json({ ok: true, googleSheetsLive: data, patrimonySheetLive: patrimonyData });
  });

  // Automatic Dividends Pull from Yahoo Finance (B3 Stocks, FIIs, US Stocks & ETFs)
  app.post('/api/auto-dividends', async (req, res) => {
    const {
      holdings = [],
      transactions = [],
      recentDividends = [],
      ptax = 5.1842,
      monthsBack = 6,
    } = req.body || {};

    const eligibleHoldings = (Array.isArray(holdings) ? holdings : []).filter(
      (h) =>
        h &&
        h.qty > 0 &&
        ['STOCKS_BR', 'FIIS', 'STOCKS_US', 'ETFS_US'].includes(h.assetClass)
    );

    const cutoffMs = Date.now() - Number(monthsBack || 6) * 31 * 24 * 60 * 60 * 1000;
    const detected = [];

    const chunkSize = 8;
    for (let i = 0; i < eligibleHoldings.length; i += chunkSize) {
      const batch = eligibleHoldings.slice(i, i + chunkSize);
      await Promise.all(
        batch.map(async (h) => {
          const yahooSym = mapTickerToYahoo(h.ticker, h.assetClass, h.broker);
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=1y&interval=1d&events=div`;
            const resp = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(6000),
            });
            if (!resp.ok) return;
            const json = await resp.json();
            const result = json?.chart?.result?.[0];
            const divEvents = result?.events?.dividends;
            if (!divEvents || typeof divEvents !== 'object') return;

            const currency = result?.meta?.currency || (yahooSym.endsWith('.SA') ? 'BRL' : 'USD');
            const isUsd = currency === 'USD' && !yahooSym.endsWith('.SA');

            // Reconstruct quantity held on ex-date by walking backwards from current holding.qty
            const tickerTxs = (Array.isArray(transactions) ? transactions : []).filter(
              (t) => t && String(t.ticker).toUpperCase() === String(h.ticker).toUpperCase()
            );

            for (const ev of Object.values(divEvents)) {
              if (!ev || typeof ev.amount !== 'number' || ev.amount <= 0) continue;
              const eventMs = ev.date * 1000;
              if (eventMs < cutoffMs) continue;

              const exDateIso = new Date(eventMs).toISOString().slice(0, 10);
              let qtyOnExDate = Number(h.qty) || 0;
              for (const tx of tickerTxs) {
                if (tx.date > exDateIso) {
                  if (tx.type === 'COMPRA' || tx.type === 'DESDOBRAMENTO') {
                    qtyOnExDate -= Number(tx.qty) || 0;
                  } else if (tx.type === 'VENDA') {
                    qtyOnExDate += Number(tx.qty) || 0;
                  }
                }
              }

              if (qtyOnExDate <= 0) continue;

              const divPerShare = ev.amount;
              const grossOriginal = qtyOnExDate * divPerShare;
              const grossValueBrl = Number((isUsd ? grossOriginal * ptax : grossOriginal).toFixed(2));

              // Tax rules:
              // - FIIs: 0% tax
              // - US Stocks / US ETFs (except B3-listed like IVVB11): 30% US withholding tax
              // - B3 Stocks: 0% for Dividendo (user can switch to JCP 15% in UI)
              const taxRate = isUsd ? 0.3 : 0;
              const irrfBrl = Number((grossValueBrl * taxRate).toFixed(2));
              const netValueBrl = Number((grossValueBrl - irrfBrl).toFixed(2));

              if (netValueBrl < 0.05) continue;

              const divAssetClass =
                h.assetClass === 'FIIS'
                  ? 'FII'
                  : h.assetClass === 'STOCKS_BR'
                    ? 'AÇÃO'
                    : h.assetClass === 'ETFS_US'
                      ? 'ETF_US'
                      : 'STOCK';

              // Check if already in recentDividends (same ticker and within 22 days or same YYYY-MM with close value)
              const exMonth = exDateIso.slice(0, 7);
              const existingMatch = (Array.isArray(recentDividends) ? recentDividends : []).find(
                (d) => {
                  if (!d || String(d.ticker).toUpperCase() !== String(h.ticker).toUpperCase()) {
                    return false;
                  }
                  const dMs = new Date(d.date).getTime();
                  const daysDiff = Math.abs(dMs - eventMs) / (1000 * 60 * 60 * 24);
                  const sameMonth = String(d.date).slice(0, 7) === exMonth;
                  const valRatio =
                    d.netValueBrl > 0 ? Math.abs(d.netValueBrl - netValueBrl) / d.netValueBrl : 1;
                  return (daysDiff <= 25 || sameMonth) && valRatio <= 0.28;
                }
              );

              detected.push({
                id: `auto-div-${h.ticker}-${exDateIso}`,
                ticker: h.ticker,
                date: exDateIso,
                type: 'DIVIDENDO',
                qtyOnExDate: Number(qtyOnExDate.toFixed(4)),
                divPerShare: Number(divPerShare.toFixed(4)),
                currency: isUsd ? 'USD' : 'BRL',
                grossValueBrl,
                irrfBrl,
                netValueBrl,
                broker: h.broker || (isUsd ? 'Avenue' : 'XP'),
                assetClass: divAssetClass,
                alreadyInSheet: Boolean(existingMatch),
                matchedSheetDate: existingMatch?.date || null,
              });
            }
          } catch {}
        })
      );
    }

    detected.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    res.json({
      ok: true,
      scannedAt: new Date().toISOString(),
      totalDetected: detected.length,
      newCount: detected.filter((d) => !d.alreadyInSheet).length,
      items: detected,
    });
  });

  // Full live market sync: fetches FX, Indices, BCB CDI/IPCA, CVM Quotas, Tesouro Direto PU, and portfolio holdings
  // (plus Google Sheets ONLY once per day when includeGoogleSheets or forceGoogleSheets is true)
  app.post('/api/live-sync', async (req, res) => {
    const {
      tickers = [],
      forceFixedIncome = false,
      includeGoogleSheets = false,
      forceGoogleSheets = false,
      sheetId = DEFAULT_GOOGLE_SHEET_ID,
      patrimonySheetId = DEFAULT_PATRIMONY_SHEET_ID,
    } = req.body || {};
    const fetchedAt = new Date().toISOString();
    const shouldFetchSheets = Boolean(includeGoogleSheets || forceGoogleSheets);

    const indexSymbols = [
      { key: 'USDBRL', yahoo: 'BRL=X' },
      { key: 'EURBRL', yahoo: 'EURBRL=X' },
      { key: 'GBPBRL', yahoo: 'GBPBRL=X' },
      { key: 'CADBRL', yahoo: 'CADBRL=X' },
      { key: 'CHFBRL', yahoo: 'CHFBRL=X' },
      { key: 'IBOV', yahoo: '^BVSP' },
      { key: '.INX', yahoo: '^GSPC' },
      { key: '.IXIC', yahoo: '^IXIC' },
      { key: '.DJI', yahoo: '^DJI' },
      { key: 'BTCUSD', yahoo: 'BTC-USD' },
      { key: 'ETHUSD', yahoo: 'ETH-USD' },
      { key: 'IAU', yahoo: 'IAU' },
      { key: 'BRENT', yahoo: 'BZ=F' },
      { key: 'WTI', yahoo: 'CL=F' },
    ];

    const [googleSheetsLive, patrimonySheetLive, indexEntries] = await Promise.all([
      shouldFetchSheets ? fetchGoogleSheetsPortfolio(sheetId, Boolean(forceGoogleSheets)) : Promise.resolve(null),
      shouldFetchSheets ? fetchPatrimonyAnalysisSheet(patrimonySheetId, Boolean(forceGoogleSheets)) : Promise.resolve(null),
      Promise.all(
        indexSymbols.map(async (item) => {
          const q = await fetchYahooQuote(item.yahoo);
          return [item.key, q];
        })
      ),
    ]);

    const marketQuotes = Object.fromEntries(indexEntries.filter(([, q]) => q !== null));

    // Determine live USD/BRL rate
    let liveUsdBrl = marketQuotes.USDBRL?.price || 5.1842;

    // Also check AwesomeAPI as backup for BRL exchange rates
    try {
      const fxResp = await fetch(
        'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL,CAD-BRL,CHF-BRL',
        { signal: AbortSignal.timeout(3500) }
      );
      if (fxResp.ok) {
        const fxData = await fxResp.json();
        if (fxData.USDBRL?.bid) {
          liveUsdBrl = parseFloat(fxData.USDBRL.bid);
          marketQuotes.USDBRL = {
            price: liveUsdBrl,
            changePct: parseFloat(fxData.USDBRL.pctChange || '0'),
            currency: 'BRL',
          };
        }
        if (fxData.EURBRL?.bid && !marketQuotes.EURBRL) {
          marketQuotes.EURBRL = { price: parseFloat(fxData.EURBRL.bid), changePct: parseFloat(fxData.EURBRL.pctChange || '0'), currency: 'BRL' };
        }
        if (fxData.GBPBRL?.bid && !marketQuotes.GBPBRL) {
          marketQuotes.GBPBRL = { price: parseFloat(fxData.GBPBRL.bid), changePct: parseFloat(fxData.GBPBRL.pctChange || '0'), currency: 'BRL' };
        }
        if (fxData.CHFBRL?.bid && !marketQuotes.CHFBRL) {
          marketQuotes.CHFBRL = { price: parseFloat(fxData.CHFBRL.bid), changePct: parseFloat(fxData.CHFBRL.pctChange || '0'), currency: 'BRL' };
        }
      }
    } catch {}

    // 2. Fetch quotes for client tickers
    const tickerMap = new Map();
    if (Array.isArray(tickers)) {
      for (const t of tickers) {
        if (t && t.ticker) tickerMap.set(t.ticker, t);
      }
    }
    const validTickers = Array.from(tickerMap.values());
    const holdingQuotes = {};

    // Run in chunks of 10 to be fast and polite
    const chunkSize = 10;
    for (let i = 0; i < validTickers.length; i += chunkSize) {
      const batch = validTickers.slice(i, i + chunkSize);
      await Promise.all(
        batch.map(async (t) => {
          const yahooSym = mapTickerToYahoo(t.ticker, t.assetClass, t.broker);
          const q = await fetchYahooQuote(yahooSym);
          if (!q) return;

          // If quote is in USD (US Stocks, US ETFs, Crypto), convert to BRL using liveUsdBrl
          const isBrlQuote = q.currency === 'BRL' || yahooSym.endsWith('.SA') || yahooSym.endsWith('BRL=X');
          const priceBrl = isBrlQuote ? q.price : q.price * liveUsdBrl;
          const prevCloseBrl = isBrlQuote ? q.prevClose : q.prevClose * liveUsdBrl;
          const changePct = q.changePct;

          holdingQuotes[t.ticker] = {
            ticker: t.ticker,
            yahooSymbol: yahooSym,
            rawPrice: q.price,
            rawCurrency: q.currency,
            priceBrl: Number(priceBrl.toFixed(4)),
            prevCloseBrl: Number(prevCloseBrl.toFixed(4)),
            changePct: Number(changePct.toFixed(2)),
          };
        })
      );
    }

    // 3. Fetch BCB CDI / IPCA latest monthly rates + Fixed Income Live Market Data
    const bcb = {};
    let fixedIncomeLive = null;
    try {
      const [ipcaResp, cdiResp, fiMarket] = await Promise.all([
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/2?formato=json', { signal: AbortSignal.timeout(3500) }).catch(() => null),
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados/ultimos/2?formato=json', { signal: AbortSignal.timeout(3500) }).catch(() => null),
        getFixedIncomeLiveMarket(Boolean(forceFixedIncome)),
      ]);
      if (ipcaResp && ipcaResp.ok) bcb.ipca = await ipcaResp.json();
      if (cdiResp && cdiResp.ok) bcb.cdi = await cdiResp.json();
      fixedIncomeLive = fiMarket;
    } catch {}

    res.json({
      ok: true,
      fetchedAt,
      liveUsdBrl: Number(liveUsdBrl.toFixed(4)),
      marketQuotes,
      holdingQuotes,
      bcb,
      fixedIncomeLive,
      googleSheetsLive,
      patrimonySheetLive,
    });
  });

  // Serve production frontend build (dist/) when available so single-port cloud/LAN hosting works out of the box
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

if (process.argv[1] === __filename) {
  const app = createApiApp();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Patrimony API] SQLite DB ready at ${DB_PATH}`);
    console.log(`[Patrimony API] Server listening on http://0.0.0.0:${PORT}`);
  });
}

