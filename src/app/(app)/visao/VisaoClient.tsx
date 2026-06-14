"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronLeft, ChevronRight,
  CreditCard, Wallet, Plus, Search, X,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, mesDoLanc, formatData, MESES } from "@/lib/utils";
import type { Lancamento, Conta, Cartao, Orcamento } from "@/types/database";

const PALETA = ["#2a8a72","#c9952d","#c0492f","#1d5c4f","#3b6ea5","#8a5cb8","#d17b3f","#b8456b","#5a7d3a","#6f7d77"];

// ——— Orçamento: calcula limite efetivo ———
function calcLimite(cat: string, sub: string, subsub: string, orcamentos: Orcamento[]) {
  const match = orcamentos.find(o =>
    o.cat === cat &&
    (sub ? o.sub === sub : !o.sub) &&
    (subsub ? o.subsub === subsub : !o.subsub)
  );
  return match ? Number(match.limite) : 0;
}

// ——— Inline: editar limite de orçamento ———
function LimiteInline({ cat, sub, subsub, orcamentos, workspaceId, onSalvo }: {
  cat: string; sub: string; subsub: string;
  orcamentos: Orcamento[]; workspaceId: string; onSalvo: () => void;
}) {
  const atual = calcLimite(cat, sub, subsub, orcamentos);
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(String(atual || ""));

  async function salvar() {
    const supabase = createClient();
    const existente = orcamentos.find(o =>
      o.cat === cat && (sub ? o.sub === sub : !o.sub) && (subsub ? o.subsub === subsub : !o.subsub)
    );
    const payload = { cat, sub: sub || null, subsub: subsub || null, limite: Number(val) || 0, workspace_id: workspaceId };
    if (existente) {
      await supabase.from("orcamentos").update({ limite: Number(val) || 0 } as Record<string, unknown>).eq("id", existente.id);
    } else {
      await supabase.from("orcamentos").insert(payload as Record<string, unknown>);
    }
    setEditando(false);
    onSalvo();
  }

  if (editando) {
    return (
      <form onSubmit={e => { e.preventDefault(); salvar(); }} className="flex items-center gap-1 mt-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Limite R$</span>
        <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)}
          onBlur={salvar}
          className="text-xs rounded px-1.5 py-0.5 w-20 outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--primary)", color: "var(--text)" }} />
      </form>
    );
  }

  return (
    <button onClick={() => { setVal(String(atual || "")); setEditando(true); }}
      className="text-xs mt-0.5 flex items-center gap-1"
      style={{ color: "var(--text-muted)" }}>
      {atual > 0 ? null : <Plus size={10} />}
      {atual > 0 ? `limite ${brl(atual)}` : "definir limite"}
    </button>
  );
}

// ——— Painel de orçamento ———
function OrcamentosPanel({ lancamentos, orcamentos, workspaceId, onSalvo }: {
  lancamentos: Lancamento[]; orcamentos: Orcamento[]; workspaceId: string; onSalvo: () => void;
}) {
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const tree: Record<string, { total: number; subs: Record<string, { total: number; subsubs: Record<string, number> }> }> = {};
  lancamentos.filter(l => l.tipo === "despesa").forEach(l => {
    const cat = l.cat || "Sem categoria";
    const sub = l.sub || "";
    const ss = l.subsub || "";
    if (!tree[cat]) tree[cat] = { total: 0, subs: {} };
    tree[cat].total += Number(l.valor);
    if (sub) {
      if (!tree[cat].subs[sub]) tree[cat].subs[sub] = { total: 0, subsubs: {} };
      tree[cat].subs[sub].total += Number(l.valor);
      if (ss) tree[cat].subs[sub].subsubs[ss] = (tree[cat].subs[sub].subsubs[ss] || 0) + Number(l.valor);
    }
  });

  const totalMes = Object.values(tree).reduce((s, v) => s + v.total, 0);
  if (!totalMes) return <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Nenhuma despesa este mês.</p>;

  const toggle = (k: string) => setExpandido(e => ({ ...e, [k]: !e[k] }));

  return (
    <div className="flex flex-col gap-1">
      {Object.entries(tree).sort((a, b) => b[1].total - a[1].total).map(([cat, catData], idx) => {
        const cor = PALETA[idx % PALETA.length];
        const lim = calcLimite(cat, "", "", orcamentos);
        const pct = lim > 0 ? Math.min((catData.total / lim) * 100, 100) : (totalMes ? (catData.total / totalMes) * 100 : 0);
        const estourou = lim > 0 && catData.total > lim;
        const aberta = expandido[cat];

        return (
          <div key={cat}>
            <button className="flex items-center gap-2 w-full text-left py-1.5" onClick={() => toggle(cat)}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cor }} />
              <span className="flex-1 text-sm truncate">{cat}</span>
              <span className="text-sm font-semibold flex-shrink-0" style={{ color: estourou ? "var(--danger)" : "var(--text)" }}>
                {brl(catData.total)}{lim > 0 ? <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {brl(lim)}</span> : null}
              </span>
              <ChevronDown size={13} style={{ color: "var(--text-muted)", transform: aberta ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
            </button>

            <div className="h-1 rounded-full mb-1" style={{ background: "var(--surface2)" }}>
              <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: estourou ? "var(--danger)" : cor }} />
            </div>
            <LimiteInline cat={cat} sub="" subsub="" orcamentos={orcamentos} workspaceId={workspaceId} onSalvo={onSalvo} />

            {aberta && Object.entries(catData.subs).sort((a, b) => b[1].total - a[1].total).map(([sub, subData]) => {
              const limSub = calcLimite(cat, sub, "", orcamentos);
              const pctSub = limSub > 0 ? Math.min((subData.total / limSub) * 100, 100) : 0;
              return (
                <div key={sub} className="ml-4 mt-1">
                  <div className="flex items-center gap-2 py-1">
                    <span className="flex-1 text-xs" style={{ color: "var(--text-muted)" }}>{sub}</span>
                    <span className="text-xs font-medium">{brl(subData.total)}{limSub > 0 ? <span style={{ color: "var(--text-muted)" }}> / {brl(limSub)}</span> : null}</span>
                  </div>
                  {limSub > 0 && (
                    <div className="h-0.5 rounded-full mb-1" style={{ background: "var(--surface2)" }}>
                      <div className="h-0.5 rounded-full" style={{ width: `${pctSub}%`, background: cor, opacity: 0.65 }} />
                    </div>
                  )}
                  <LimiteInline cat={cat} sub={sub} subsub="" orcamentos={orcamentos} workspaceId={workspaceId} onSalvo={onSalvo} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ——— Item de lançamento ———
function ItemLanc({ l }: { l: Lancamento }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: l.tipo === "receita" ? "#4caf82" : "var(--danger)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{l.descricao || (l.tipo === "receita" ? "Receita" : "Despesa")}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}
          {l.cartao_id && !l.pago ? " · em aberto" : ""}
        </p>
      </div>
      <span className="text-sm font-semibold flex-shrink-0" style={{ color: l.tipo === "receita" ? "#4caf82" : "var(--danger)" }}>
        {l.tipo === "receita" ? "+" : "−"}{brl(l.valor)}
      </span>
    </div>
  );
}

// ——— Campo de busca ———
function CampoBusca({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl text-sm outline-none"
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          padding: "8px 36px",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X size={13} style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}

// ——— Componente principal ———
export default function VisaoClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [mes, setMes] = useState(mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<"receita" | "despesa" | null>(null);

  // Busca e estado de grupos retráteis
  const [searchQuery, setSearchQuery] = useState("");
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: lancs }, { data: cts }, { data: carts }, { data: orcs }] = await Promise.all([
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId).order("data", { ascending: false }),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("orcamentos").select("*").eq("workspace_id", workspaceId),
    ]);
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);
    setOrcamentos((orcs || []) as unknown as Orcamento[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (workspaceId) carregar(); }, []);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Abre/fecha seção, resetando busca e estado dos grupos
  function handleToggleSecao(tipo: "receita" | "despesa") {
    setAberto(prev => {
      const next = prev === tipo ? null : tipo;
      setSearchQuery("");
      setGruposAbertos({});
      return next;
    });
  }

  // Retrair/expandir grupo individual (default: expandido)
  function toggleGrupo(key: string) {
    setGruposAbertos(prev => {
      const aberto = prev[key] !== false; // undefined = expandido por padrão
      return { ...prev, [key]: !aberto };
    });
  }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;
  const doMes = lancamentos.filter(l => mesDoLanc(l.data) === mes);
  const receitas = doMes.filter(l => l.tipo === "receita").sort((a, b) => Number(b.valor) - Number(a.valor));
  const despesas = doMes.filter(l => l.tipo === "despesa").sort((a, b) => Number(b.valor) - Number(a.valor));
  const receitasMes = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const despesasMes = despesas.reduce((s, l) => s + Number(l.valor), 0);
  const disponivel = receitasMes - despesasMes;

  // Pizza (sem filtro de busca — mostra totais reais)
  const agrupDespesa: Record<string, number> = {};
  despesas.forEach(l => { const k = l.cat || "Sem categoria"; agrupDespesa[k] = (agrupDespesa[k] || 0) + Number(l.valor); });
  const pizzaData = Object.entries(agrupDespesa).sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([nome, value], i) => ({ nome, value, cor: PALETA[i % PALETA.length] }));

  // Mapa de nomes dos cartões
  const cartoesMap = Object.fromEntries(cartoes.map(c => [c.id, c.nome]));

  // Filtro de busca (aplicado na lista, não nos totais)
  const q = searchQuery.toLowerCase().trim();
  const despesasFiltradas = !q ? despesas : despesas.filter(l =>
    (l.descricao || "").toLowerCase().includes(q) ||
    (l.cat || "").toLowerCase().includes(q) ||
    (l.sub || "").toLowerCase().includes(q) ||
    (l.subsub || "").toLowerCase().includes(q) ||
    formatData(l.data).includes(q)
  );
  const receitasFiltradas = !q ? receitas : receitas.filter(l =>
    (l.descricao || "").toLowerCase().includes(q) ||
    (l.cat || "").toLowerCase().includes(q) ||
    (l.sub || "").toLowerCase().includes(q) ||
    formatData(l.data).includes(q)
  );

  // Agrupa despesas filtradas por cartão / diretas
  const gruposDespesa = (() => {
    const g: Record<string, Lancamento[]> = {};
    despesasFiltradas.forEach(l => {
      const k = l.cartao_id || "_diretas";
      (g[k] = g[k] || []).push(l);
    });
    return [...cartoes.map(c => c.id), "_diretas"]
      .filter(k => g[k])
      .map(k => ({
        key: k,
        nome: k === "_diretas" ? "Despesas diretas" : (cartoesMap[k] || "Cartão"),
        cartao: k !== "_diretas",
        itens: g[k],
        total: g[k].reduce((s, x) => s + Number(x.valor), 0),
      }));
  })();

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <span className="font-medium capitalize text-sm">{labelMes}</span>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Hero — Disponível */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Disponível</p>
        <p className="text-3xl font-bold" style={{ color: disponivel < 0 ? "var(--danger)" : "#4caf82" }}>{brl(disponivel)}</p>
        <div className="flex gap-3 mt-1 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Receitas <span style={{ color: "#4caf82" }}>{brl(receitasMes)}</span></span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>− Despesas <span style={{ color: despesasMes > 0 ? "var(--danger)" : "var(--text-muted)" }}>{brl(despesasMes)}</span></span>
        </div>
      </div>

      {/* Cards receita / despesa */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { tipo: "receita" as const, icon: TrendingUp, valor: receitasMes, cor: "#4caf82", label: "Receitas" },
          { tipo: "despesa" as const, icon: TrendingDown, valor: despesasMes, cor: "var(--danger)", label: "Despesas" },
        ].map(({ tipo, icon: Icon, valor, cor, label }) => (
          <button key={tipo} onClick={() => handleToggleSecao(tipo)}
            className="rounded-xl px-4 py-3 text-left flex flex-col gap-1 transition-colors"
            style={{ background: aberto === tipo ? "var(--surface2)" : "var(--surface)", border: `1px solid ${aberto === tipo ? cor : "var(--border)"}` }}>
            <div className="flex items-center justify-between">
              <Icon size={16} style={{ color: cor }} />
              <ChevronDown size={13} style={{ color: "var(--text-muted)", transform: aberto === tipo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="font-bold" style={{ color: cor }}>{tipo === "receita" ? "+" : "−"}{brl(valor)}</p>
          </button>
        ))}
      </div>

      {/* ——— RECEITAS expandidas ——— */}
      {aberto === "receita" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Receitas · {receitas.length}</p>
              {q && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{receitasFiltradas.length} resultado(s)</p>}
            </div>
            <CampoBusca value={searchQuery} onChange={setSearchQuery} placeholder="Buscar receitas…" />
          </div>
          {receitasFiltradas.length === 0 ? (
            <p className="text-xs px-4 pb-3" style={{ color: "var(--text-muted)" }}>
              {q ? "Nenhuma receita encontrada." : "Nada lançado."}
            </p>
          ) : (
            receitasFiltradas.map(l => <ItemLanc key={l.id} l={l} />)
          )}
        </div>
      )}

      {/* ——— DESPESAS expandidas — grupos retráteis ——— */}
      {aberto === "despesa" && (
        <div className="flex flex-col gap-3">

          {/* Campo de busca + contador */}
          <div className="flex flex-col gap-1.5">
            <CampoBusca value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por descrição, categoria, data…" />
            {q && (
              <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
                {despesasFiltradas.length} resultado(s) · total {brl(despesasFiltradas.reduce((s, l) => s + Number(l.valor), 0))}
              </p>
            )}
          </div>

          {/* Grupos */}
          {gruposDespesa.length === 0 ? (
            <div className="rounded-xl py-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {q ? `Nenhuma despesa encontrada para "${searchQuery}".` : "Nenhuma despesa este mês."}
              </p>
            </div>
          ) : (
            gruposDespesa.map(g => {
              const isOpen = gruposAbertos[g.key] !== false; // default: expandido
              return (
                <div key={g.key} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

                  {/* Header clicável */}
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3"
                    onClick={() => toggleGrupo(g.key)}
                  >
                    {g.cartao
                      ? <CreditCard size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
                      : <Wallet size={14} style={{ color: "var(--primary-light)", flexShrink: 0 }} />
                    }
                    <p className="text-sm font-semibold flex-1 text-left">
                      {g.cartao ? `Fatura · ${g.nome}` : g.nome}
                    </p>
                    <span className="text-xs flex-shrink-0 mr-1" style={{ color: "var(--text-muted)" }}>
                      {g.itens.length} item{g.itens.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-bold flex-shrink-0 mr-1" style={{ color: "var(--danger)" }}>
                      −{brl(g.total)}
                    </span>
                    <ChevronDown
                      size={15}
                      style={{
                        color: "var(--text-muted)",
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {/* Itens — visíveis apenas quando expandido */}
                  {isOpen && (
                    <div className="border-t" style={{ borderColor: "var(--border)" }}>
                      {g.itens.map(l => <ItemLanc key={l.id} l={l} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ——— Pizza + Orçamento ——— */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pizza */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2">Distribuição</p>
          {pizzaData.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Sem despesas.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pizzaData} cx="50%" cy="50%" outerRadius={60} dataKey="value" nameKey="nome">
                    {pizzaData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1 mt-1">
                {pizzaData.map(d => (
                  <div key={d.nome} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.cor }} />
                    <span className="flex-1 truncate" style={{ color: "var(--text-muted)" }}>{d.nome}</span>
                    <span style={{ color: "var(--text)" }}>{despesasMes ? ((d.value / despesasMes) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Orçamento */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2">Orçamento vs realizado</p>
          {workspaceId && (
            <OrcamentosPanel
              lancamentos={doMes}
              orcamentos={orcamentos}
              workspaceId={workspaceId}
              onSalvo={carregar}
            />
          )}
        </div>
      </div>
    </div>
  );
}
