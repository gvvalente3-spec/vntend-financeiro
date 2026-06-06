"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, RefreshCw, Target, PiggyBank, Landmark, LineChart, Globe, Bitcoin, Shield, X, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl } from "@/lib/utils";
import type { Investimento, InvestMetas } from "@/types/database";

const CATS = [
  { id: "reserva",   nome: "Reserva de emergência", icon: PiggyBank, cor: "#2a8a72" },
  { id: "rendaFixa", nome: "Renda fixa",             icon: Landmark,  cor: "#3b6ea5" },
  { id: "rendaVar",  nome: "Renda variável",          icon: LineChart,  cor: "#c9952d" },
  { id: "exterior",  nome: "Exterior",                icon: Globe,     cor: "#8a5cb8" },
  { id: "cripto",    nome: "Cripto",                  icon: Bitcoin,   cor: "#d17b3f" },
  { id: "pgbl",      nome: "Previdência (PGBL)",      icon: Shield,    cor: "#1d5c4f" },
  { id: "objetivo",  nome: "Objetivo / Meta",         icon: Target,    cor: "#b8456b" },
] as const;

type CatId = (typeof CATS)[number]["id"];

interface Objetivo { id: string; emoji: string; nome: string; meta: number; }

const METAS_PADRAO: InvestMetas & { objetivos_custom?: Objetivo[] } = {
  leilao: 100000, reserva: 30000, aluguel27: 37200,
  pgbl: 13000, consorcio: 200000, ptax: 5.70,
  alvo_pct: { rendaFixa: 40, rendaVar: 20, exterior: 15, cripto: 5, pgbl: 20 },
};

const OBJETIVOS_PADRAO: Objetivo[] = [
  { id: "leilao",    emoji: "🏠", nome: "Fundo leilão",       meta: 100000 },
  { id: "reserva",   emoji: "🛡️", nome: "Reserva emergência", meta: 30000 },
  { id: "aluguel27", emoji: "🏢", nome: "Aluguel 2027",        meta: 37200 },
  { id: "pgbl",      emoji: "📊", nome: "PGBL",                meta: 13000 },
  { id: "consorcio", emoji: "🏡", nome: "Consórcio",           meta: 200000 },
];

function valorAtivo(a: Investimento, ptax: number) {
  const q = Number(a.cotas || 0), pa = Number(a.preco_atual || 0);
  if (q > 0 && pa > 0) return q * (a.moeda === "USD" ? pa * ptax : pa);
  return Number(a.valor || 0);
}

function ganhoAtivo(a: Investimento, ptax: number) {
  const q = Number(a.cotas || 0), pm = Number(a.pm || 0), pa = Number(a.preco_atual || 0);
  if (q > 0 && pm > 0 && pa > 0) {
    const pmBrl = a.moeda === "USD" ? pm * ptax : pm;
    const paBrl = a.moeda === "USD" ? pa * ptax : pa;
    return q * (paBrl - pmBrl);
  }
  return 0;
}

async function fetchCotacao(ticker: string): Promise<number | null> {
  try {
    const upper = ticker.toUpperCase().replace(/\.SA$/i, "");
    const yahooTicker = `${upper}.SA`;

    const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
    const res1 = await fetch(url1, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (res1.ok) {
      const data = await res1.json();
      const preco = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (preco && preco > 0) return preco;
    }

    const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (res2.ok) {
      const data = await res2.json();
      const preco = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (preco && preco > 0) return preco;
    }

    const res3 = await fetch(`https://brapi.dev/api/quote/${upper}?token=anonymous`, { signal: AbortSignal.timeout(5000) });
    const data3 = await res3.json();
    return data3?.results?.[0]?.regularMarketPrice || null;
  } catch { return null; }
}

function Modal({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14 };
const lbl = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

function FormAtivo({ workspaceId, fechar, onSalvo, inicial }: { workspaceId: string; fechar: () => void; onSalvo: () => void; inicial?: Investimento }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [ticker, setTicker] = useState(inicial?.ticker || "");
  const [categoria, setCategoria] = useState<CatId>((inicial?.categoria as CatId) || "rendaFixa");
  const [moeda, setMoeda] = useState<"BRL" | "USD">(inicial?.moeda || "BRL");
  const [obj, setObj] = useState(inicial?.obj || "");
  const [cotas, setCotas] = useState(inicial?.cotas != null ? String(inicial.cotas) : "");
  const [pm, setPm] = useState(inicial?.pm != null ? String(inicial.pm) : "");
  const [preco, setPreco] = useState(inicial?.preco_atual != null ? String(inicial.preco_atual) : "");
  const [valor, setValor] = useState(inicial?.valor != null ? String(inicial.valor) : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const payload = {
      nome, ticker: ticker || null, categoria, moeda,
      obj: obj || null,
      cotas: cotas ? Number(cotas) : null,
      pm: pm ? Number(pm) : null,
      preco_atual: preco ? Number(preco) : null,
      valor: valor ? Number(valor) : null,
    };
    const supabase = createClient();
    if (inicial) {
      await supabase.from("investimentos").update(payload as Record<string, unknown>).eq("id", inicial.id);
    } else {
      await supabase.from("investimentos").insert({ workspace_id: workspaceId, ...payload } as Record<string, unknown>);
    }
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <Modal titulo={inicial ? "Editar ativo" : "Novo ativo"} fechar={fechar}>
      <div className="flex gap-3">
        <label style={{ ...lbl, flex: 2 }}>Nome<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Tesouro Selic, ITSA4…" style={inp} /></label>
        <label style={{ ...lbl, flex: 1 }}>Ticker<input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="PETR4" style={inp} /></label>
      </div>
      <label style={lbl}>Categoria
        <select value={categoria} onChange={e => setCategoria(e.target.value as CatId)} style={inp}>
          {CATS.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <div className="flex gap-3">
        <label style={{ ...lbl, flex: 1 }}>Moeda
          <select value={moeda} onChange={e => setMoeda(e.target.value as "BRL" | "USD")} style={inp}>
            <option value="BRL">R$ Real</option>
            <option value="USD">US$ Dólar</option>
          </select>
        </label>
        <label style={{ ...lbl, flex: 1 }}>Objetivo
          <select value={obj} onChange={e => setObj(e.target.value)} style={inp}>
            <option value="">—</option>
            <option value="reserva">Reserva emergência</option>
            <option value="leilao">Fundo leilão</option>
            <option value="aluguel27">Aluguel 2027</option>
          </select>
        </label>
      </div>
      {!ticker && <label style={lbl}>Valor atual (R$) — para ativos sem cotas<input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inp} /></label>}
      <div className="grid grid-cols-3 gap-2">
        <label style={lbl}>Cotas<input type="number" value={cotas} onChange={e => setCotas(e.target.value)} placeholder="0" style={inp} /></label>
        <label style={lbl}>PM<input type="number" value={pm} onChange={e => setPm(e.target.value)} placeholder="0,00" style={inp} /></label>
        <label style={lbl}>Preço atual<input type="number" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" style={inp} /></label>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cotas × preço atual = valor. Sem cotas: use "valor manual".</p>
      <button onClick={salvar} disabled={salvando || !nome}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Salvar ativo"}
      </button>
    </Modal>
  );
}

function FormAporte({ ativo, fechar, onSalvo, ptax }: { ativo: Investimento; fechar: () => void; onSalvo: () => void; ptax: number }) {
  const [novasCotas, setNovasCotas] = useState("");
  const [precoCompra, setPrecoCompra] = useState(String(ativo.preco_atual || ativo.pm || ""));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const nc = Number(novasCotas) || 0, np = Number(precoCompra) || 0;
    if (!nc || !np) return;
    setSalvando(true);
    const oldCotas = Number(ativo.cotas) || 0, oldPm = Number(ativo.pm) || 0;
    const newCotas = oldCotas + nc;
    const newPm = newCotas ? ((oldCotas * oldPm) + (nc * np)) / newCotas : np;
    await createClient().from("investimentos").update({ cotas: newCotas, pm: newPm, preco_atual: np } as Record<string, unknown>).eq("id", ativo.id);
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <Modal titulo={`Aportar em ${ativo.nome}`} fechar={fechar}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>O preço médio será recalculado automaticamente.</p>
      <div className="flex gap-3">
        <label style={{ ...lbl, flex: 1 }}>Novas cotas<input type="number" value={novasCotas} onChange={e => setNovasCotas(e.target.value)} placeholder="0" style={inp} /></label>
        <label style={{ ...lbl, flex: 1 }}>Preço de compra<input type="number" value={precoCompra} onChange={e => setPrecoCompra(e.target.value)} placeholder="0,00" style={inp} /></label>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        PM atual: {ativo.moeda === "USD" ? "$" : "R$"}{Number(ativo.pm || 0).toFixed(2)} · {Number(ativo.cotas || 0)} cotas
      </p>
      <button onClick={salvar} disabled={salvando}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Aportar"}
      </button>
    </Modal>
  );
}

export default function InvestimentosClient({ inline = false }: { inline?: boolean }) {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [itens, setItens] = useState<Investimento[]>([]);
  const [metas, setMetas] = useState<InvestMetas>(METAS_PADRAO);
  const [objetivos, setObjetivos] = useState<Objetivo[]>(OBJETIVOS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [aportando, setAportando] = useState<Investimento | null>(null);
  const [buscando, setBuscando] = useState<Record<string, boolean>>({});
  const [editMetas, setEditMetas] = useState(false);
  const [editAlvo, setEditAlvo] = useState(false);
  const [alvoLocal, setAlvoLocal] = useState<Record<string, number>>({});

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: inv }, { data: im }] = await Promise.all([
      supabase.from("investimentos").select("*").eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("invest_metas").select("*").eq("workspace_id", workspaceId).single(),
    ]);
    setItens((inv || []) as unknown as Investimento[]);
    if (im) {
      setMetas(im as unknown as InvestMetas);
      const imAny = im as unknown as Record<string, unknown>;
      if (Array.isArray(imAny.objetivos_custom) && imAny.objetivos_custom.length > 0) {
        setObjetivos(imAny.objetivos_custom as Objetivo[]);
      }
      // Carrega alvos salvos
      const alvos = (imAny.alvo_pct as Record<string, number>) || {};
      setAlvoLocal(alvos);
    }
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function del(id: string) {
    if (!confirm("Remover este ativo?")) return;
    await createClient().from("investimentos").delete().eq("id", id);
    setItens(i => i.filter(x => x.id !== id));
  }

  async function buscarCotacao(id: string, ticker: string) {
    setBuscando(b => ({ ...b, [id]: true }));
    const preco = await fetchCotacao(ticker);
    setBuscando(b => ({ ...b, [id]: false }));
    if (preco) {
      await createClient().from("investimentos").update({ preco_atual: preco } as Record<string, unknown>).eq("id", id);
      setItens(inv => inv.map(x => x.id === id ? { ...x, preco_atual: preco } : x));
    }
  }

  async function salvarMetas(novas: InvestMetas) {
    setMetas(novas);
    if (!workspaceId) return;
    await createClient().from("invest_metas").update(novas as unknown as Record<string, unknown>).eq("workspace_id", workspaceId);
  }

  async function salvarObjetivos(novos: Objetivo[]) {
    setObjetivos(novos);
    if (!workspaceId) return;
    await createClient().from("invest_metas").update({ objetivos_custom: novos } as Record<string, unknown>).eq("workspace_id", workspaceId);
  }

  async function salvarAlvos() {
    if (!workspaceId) return;
    await createClient().from("invest_metas").update({ alvo_pct: alvoLocal } as Record<string, unknown>).eq("workspace_id", workspaceId);
    setMetas(m => ({ ...m, alvo_pct: alvoLocal }));
    setEditAlvo(false);
  }

  function addObjetivo() {
    const novos = [...objetivos, { id: Date.now().toString(36), emoji: "🎯", nome: "Novo objetivo", meta: 0 }];
    salvarObjetivos(novos);
  }

  function editObjetivo(id: string, campo: keyof Objetivo, valor: string | number) {
    const novos = objetivos.map(o => o.id === id ? { ...o, [campo]: valor } : o);
    salvarObjetivos(novos);
  }

  function delObjetivo(id: string) {
    salvarObjetivos(objetivos.filter(o => o.id !== id));
  }

  const ptax = Number(metas.ptax) || 5.70;
  const total = itens.reduce((s, x) => s + valorAtivo(x, ptax), 0);

  const porCat: Record<string, number> = {};
  itens.forEach(x => { const c = x.categoria || "rendaFixa"; porCat[c] = (porCat[c] || 0) + valorAtivo(x, ptax); });

  const porObj: Record<string, number> = {};
  itens.forEach(x => { if (x.obj) porObj[x.obj] = (porObj[x.obj] || 0) + valorAtivo(x, ptax); });

  const pizzaData = CATS.map(c => ({ ...c, valor: porCat[c.id] || 0, pct: total ? ((porCat[c.id] || 0) / total) * 100 : 0 })).filter(c => c.valor > 0);
  const grupos = CATS.map(c => ({ ...c, itens: itens.filter(x => (x.categoria || "rendaFixa") === c.id) })).filter(g => g.itens.length > 0);

  // Soma total dos alvos para mostrar aviso
  const totalAlvo = Object.values(alvoLocal).reduce((s, v) => s + v, 0);

  if (wsLoading || carregando) return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;

  return (
    <div className={inline ? "flex flex-col gap-4 py-4" : "max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4"}>

      {/* Hero */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-2" style={{ background: "linear-gradient(135deg,#1d5c4f,#2a8a72)" }}>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.8)" }}>Total investido</p>
        <p className="text-4xl font-bold text-white">{brl(total)}</p>
        <div className="flex items-center gap-2 mt-1">
          <Info size={12} style={{ color: "rgba(255,255,255,0.6)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>PTAX (R$/US$ p/ ativos em dólar)</span>
          <input type="number" step="0.01" value={ptax}
            onChange={e => salvarMetas({ ...metas, ptax: Number(e.target.value) })}
            className="text-sm font-semibold rounded-lg px-2 py-1 w-20 outline-none ml-1"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }} />
        </div>
      </div>

      {/* Grid distribuição + objetivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pizza */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2">Distribuição</p>
          {pizzaData.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>Sem ativos cadastrados.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pizzaData} cx="50%" cy="50%" outerRadius={60} dataKey="valor" nameKey="nome">
                    {pizzaData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1">
                {pizzaData.map(d => (
                  <span key={d.id} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.cor }} />
                    {d.nome.split(" ")[0]} {d.pct.toFixed(0)}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Objetivos */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Objetivos</p>
            <button onClick={() => setEditMetas(v => !v)} style={{ color: "var(--text-muted)" }}><Pencil size={14} /></button>
          </div>
          {editMetas ? (
            <div className="flex flex-col gap-2">
              {objetivos.map(o => (
                <div key={o.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <input value={o.emoji} onChange={e => editObjetivo(o.id, "emoji", e.target.value)}
                    className="w-8 text-center text-sm outline-none bg-transparent" />
                  <input value={o.nome} onChange={e => editObjetivo(o.id, "nome", e.target.value)}
                    className="flex-1 text-xs outline-none bg-transparent"
                    style={{ color: "var(--text)" }} placeholder="Nome do objetivo" />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>R$</span>
                  <input type="number" value={o.meta} onChange={e => editObjetivo(o.id, "meta", Number(e.target.value))}
                    className="w-24 text-xs text-right outline-none rounded px-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  <button onClick={() => delObjetivo(o.id)} style={{ color: "var(--text-muted)" }}><X size={13} /></button>
                </div>
              ))}
              <button onClick={addObjetivo}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs"
                style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                <Plus size={12} /> Novo objetivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {objetivos.map(o => {
                const val = porObj[o.id] || (o.id === "pgbl" ? porCat.pgbl || 0 : 0);
                const pct = o.meta ? Math.min((val / o.meta) * 100, 100) : 0;
                return (
                  <div key={o.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{o.emoji} {o.nome}</span>
                      <span style={{ color: "var(--text-muted)" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--surface2)" }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                    </div>
                    <div className="flex justify-between text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <span>{brl(val)}</span><span>meta {brl(o.meta)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Alocação atual × alvo — COM EDIÇÃO */}
      {pizzaData.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Alocação atual × alvo</p>
            {editAlvo ? (
              <div className="flex gap-2">
                {totalAlvo !== 100 && (
                  <span className="text-xs" style={{ color: totalAlvo > 100 ? "var(--danger)" : "var(--text-muted)" }}>
                    Total: {totalAlvo}%
                  </span>
                )}
                <button onClick={salvarAlvos}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: "var(--primary)", color: "#fff" }}>
                  Salvar
                </button>
                <button onClick={() => { setEditAlvo(false); setAlvoLocal(metas.alvo_pct as Record<string, number>); }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditAlvo(true); setAlvoLocal({ ...(metas.alvo_pct as Record<string, number>) }); }}
                style={{ color: "var(--text-muted)" }}>
                <Pencil size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {CATS.filter(c => porCat[c.id] || (metas.alvo_pct as Record<string, number>)[c.id] || alvoLocal[c.id]).map(c => {
              const pct = total ? ((porCat[c.id] || 0) / total) * 100 : 0;
              const alvo = editAlvo ? (alvoLocal[c.id] || 0) : ((metas.alvo_pct as Record<string, number>)[c.id] || 0);
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-center text-xs mb-1 gap-2">
                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                      <c.icon size={12} style={{ color: c.cor, flexShrink: 0 }} />
                      <span className="truncate">{c.nome}</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span style={{ color: pct > alvo + 5 ? "var(--danger)" : pct < alvo - 5 ? "#c9952d" : "#4caf82", fontWeight: 600 }}>
                        {pct.toFixed(1)}%
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>alvo</span>
                      {editAlvo ? (
                        <input
                          type="number" min={0} max={100} step={1}
                          value={alvoLocal[c.id] ?? 0}
                          onChange={e => setAlvoLocal(a => ({ ...a, [c.id]: Number(e.target.value) }))}
                          className="w-12 text-xs text-right outline-none rounded px-1 py-0.5"
                          style={{ background: "var(--surface2)", border: "1px solid var(--primary)", color: "var(--text)" }}
                        />
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>{alvo}%</span>
                      )}
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full" style={{ background: "var(--surface2)" }}>
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: c.cor }} />
                    {alvo > 0 && (
                      <div className="absolute inset-y-0 w-0.5 opacity-50" style={{ left: `${Math.min(alvo, 100)}%`, background: "var(--text)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!editAlvo && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              🟢 dentro do alvo · 🟡 abaixo · 🔴 acima · linha vertical = alvo
            </p>
          )}
          {editAlvo && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Idealmente os alvos somam 100%. Clique em Salvar para confirmar.
            </p>
          )}
        </div>
      )}

      {/* Ativos */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Ativos</h3>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Ativo
        </button>
      </div>

      {itens.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          Cadastre ativos: ações, FIIs, renda fixa, cripto, reserva…
        </p>
      )}

      {grupos.map(g => (
        <div key={g.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
            <g.icon size={15} style={{ color: g.cor }} />
            <span className="font-semibold text-sm flex-1" style={{ color: g.cor }}>{g.nome}</span>
            <span className="text-sm font-semibold">{brl(g.itens.reduce((s, x) => s + valorAtivo(x, ptax), 0))}</span>
          </div>
          {g.itens.map(a => {
            const va = valorAtivo(a, ptax);
            const gan = ganhoAtivo(a, ptax);
            const ganPct = a.cotas && a.pm && a.preco_atual ? ((Number(a.preco_atual) / Number(a.pm) - 1) * 100) : null;
            return (
              <div key={a.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.ticker && <span className="text-sm font-bold">{a.ticker}</span>}
                      <span className="text-sm truncate" style={{ color: a.ticker ? "var(--text-muted)" : "var(--text)" }}>{a.nome}</span>
                      {a.obj && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--primary)", color: "#fff" }}>{a.obj}</span>}
                    </div>
                    {a.cotas && a.pm && (
                      <div className="flex gap-3 mt-1 flex-wrap text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{Number(a.cotas)} cotas</span>
                        <span>PM {a.moeda === "USD" ? "$" : "R$"}{Number(a.pm).toFixed(2)}</span>
                        {a.preco_atual && <span>Atual {a.moeda === "USD" ? "$" : "R$"}{Number(a.preco_atual).toFixed(2)}</span>}
                        {gan !== 0 && <span style={{ color: gan >= 0 ? "#4caf82" : "var(--danger)" }}>{gan >= 0 ? "+" : ""}{brl(Math.abs(gan))}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: "#4caf82" }}>{brl(va)}</p>
                    {ganPct !== null && (
                      <p className="text-xs" style={{ color: ganPct >= 0 ? "#4caf82" : "var(--danger)" }}>
                        {ganPct >= 0 ? "+" : ""}{ganPct.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {a.ticker && (
                    <button onClick={() => buscarCotacao(a.id, a.ticker!)} disabled={buscando[a.id]}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <RefreshCw size={11} className={buscando[a.id] ? "animate-spin" : ""} />
                      {buscando[a.id] ? "buscando…" : "cotação"}
                    </button>
                  )}
                  <button onClick={() => setAportando(a)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    <Plus size={11} /> aportar
                  </button>
                  <button onClick={() => setEditando(a)} style={{ color: "var(--text-muted)", marginLeft: "auto" }}><Pencil size={14} /></button>
                  <button onClick={() => del(a.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {form && workspaceId && <FormAtivo workspaceId={workspaceId} fechar={() => setForm(false)} onSalvo={carregar} />}
      {editando && workspaceId && <FormAtivo workspaceId={workspaceId} fechar={() => setEditando(null)} onSalvo={carregar} inicial={editando} />}
      {aportando && <FormAporte ativo={aportando} fechar={() => setAportando(null)} onSalvo={carregar} ptax={ptax} />}
    </div>
  );
}