// src/app/api/cotacoes/route.ts
// API Route Next.js — busca cotações no servidor (sem CORS)
// Suporta: ações BR (.SA), ações EXT, cripto (-BRL), PTAX (Banco Central)

import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 8000;

async function fetchYahoo(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const preco = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof preco === "number" && preco > 0 ? preco : null;
  } catch {
    return null;
  }
}

async function fetchYahooFallback(ticker: string): Promise<number | null> {
  // Fallback: query2
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const preco = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof preco === "number" && preco > 0 ? preco : null;
  } catch {
    return null;
  }
}

async function fetchPtax(): Promise<number | null> {
  try {
    // Data de hoje no formato MM-DD-YYYY que o BC exige
    const hoje = new Date();
    // Tenta hoje, se não tiver (fim de semana/feriado) tenta os 5 dias anteriores
    for (let i = 0; i < 5; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dataStr = `${mm}-${dd}-${yyyy}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataStr}'&$top=1&$format=json&$select=cotacaoVenda`;
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      const data = await res.json();
      const ptax = data?.value?.[0]?.cotacaoVenda;
      if (typeof ptax === "number" && ptax > 0) return ptax;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body.tickers: Array<{ id: string; ticker: string; tipo: "br" | "ext" | "cripto" }>
    const { tickers } = body as {
      tickers: { id: string; ticker: string; tipo: "br" | "ext" | "cripto" }[];
    };

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ resultados: [], ptax: null });
    }

    // Montar os tickers Yahoo: BR = TICKER.SA, EXT = TICKER, cripto = TICKER-BRL
    const yahooTickers = tickers.map((t) => {
      if (t.tipo === "br") return { ...t, yahooTicker: `${t.ticker.replace(".SA", "").toUpperCase()}.SA` };
      if (t.tipo === "cripto") return { ...t, yahooTicker: `${t.ticker.toUpperCase()}-BRL` };
      return { ...t, yahooTicker: t.ticker.toUpperCase() };
    });

    // Buscar cotações em paralelo com fallback
    const promises = yahooTickers.map(async (t) => {
      let preco = await fetchYahoo(t.yahooTicker);
      if (!preco) preco = await fetchYahooFallback(t.yahooTicker);
      return { id: t.id, ticker: t.ticker, tipo: t.tipo, preco };
    });

    const [resultados, ptax] = await Promise.all([
      Promise.all(promises),
      fetchPtax(),
    ]);

    return NextResponse.json({ resultados, ptax });
  } catch (e) {
    console.error("Erro na rota /api/cotacoes:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}