"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Eye, EyeOff, Plus, Pencil, Trash2, X, TrendingUp,
  ChevronDown, ChevronUp, Target,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl } from "@/lib/utils";
import type { Investimento, InvestMetas } from "@/types/database";

// —— InputValor: centavos automáticos (29550 → 295,50) ——
function fmtCts(digits: string): string {
  const n = parseInt(digits || "0", 10);
  if (!digits) return "";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function InputValor({ value, onChange, style, placeholder }: {
  value: string; onChange: (d: string) => void;
  style?: React.CSSProperties; placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={fmtCts(value)}
      onChange={e => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 12);
        onChange(d);
      }}
      placeholder={placeholder ?? "0,00"}
      style={style}
    />
  );
}

// —— Paleta e categorias ——
const CAT_INFO: Record<string, { label: string; cor: string }> = {
  reserva: { label: "Reserva", cor: "#2a8a72" },
  rendaFixa: { label: "Renda Fixa", cor: "#3b6ea5" },
  rendaVar: { label: "Renda Variável", cor: "#c9952d" },
  exterior: { label: "Exterior", cor: "#8a5cb8" },
  cripto: { label: "Criptomoedas", cor: "#d17b3f" },
  pgbl: { label: "PGBL/Previdência", cor: "#1d5c4f" },
  objetivo: { label: "Objetivos", cor: "#b8456b" },
};
const CATS = Object.keys(CAT_INFO) as (keyof typeof CAT_INFO)[];

const MOEDAS = ["BRL", "USD"] as const;

function valorAtual(inv: Investimento, ptax: number): number {
  const base = inv.cotas && inv.preco_atual
    ? inv.cotas * inv.preco_atual
    : Number(inv.valor) || 0;
  return inv.moeda === "USD" ? base * ptax : base;
}

// —— Modal de ativo (novo/editar) ——
const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" };

function ModalAtivo({
  workspaceId, inv, ptax, fechar, onSalvo,
}: {
  workspaceId: string;
  inv?: Investimento | null;
  ptax: number;
  fechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(inv?.nome || "");
  const [ticker, setTicker] = useState(inv?.ticker || "");
  const [categoria, setCategoria] = useState<string>(inv?.categoria || "rendaFixa");
  const [cotas, setCotas] = useState(inv?.cotas != null ? String(inv.cotas) : "");
  // Campos de preço em centavos (string de dígitos)
  const [pm, setPm] = useState(
    inv?.pm != null ? String(Math.round(Number(inv.pm) * 100)) : ""
  );
  const [precoAtual, setPrecoAtual] = useState(
    inv?.preco_atual != null ? String(Math.round(Number(inv.preco_atual) * 100)) : ""
  );
  const [moeda, setMoeda] = useState<"BRL" | "USD">(inv?.moeda || "BRL");
  const [valorDir, setValorDir] = useState(
    inv?.valor != null ? String(Math.round(Number(inv.valor) * 100)) : ""
  );
  const [salvando, setSalvando] = useState(false);

  const pmNum = parseInt(pm || "0", 10) / 100;
  const precoNum = parseInt(precoAtual || "0", 10) / 100;
  const valorDirNum = parseInt(valorDir || "0", 10) / 100;

  // Preview
  const usaCotas = !!cotas && !!precoAtual;
  const totalBRL = usaCotas
    ? Number(cotas) * precoNum * (moeda === "USD" ? ptax : 1)
    : valorDirNum;

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const payload = {
      workspace_id: workspaceId,
      nome,
      ticker: ticker || null,
      categoria,
      cotas: cotas ? Number(cotas) : null,
      pm: pmNum || null,
      preco_atual: precoNum || null,
      moeda,
      valor: cotas ? null : (valorDirNum || null),
      obj: null,
      hidden: inv?.hidden ?? false,
    } as Record<string, unknown>;
    const supabase = createClient();
    if (inv?.id) {
      await supabase.from("investimentos").update(payload).eq("id", inv.id);
    } else {
      await supabase.from("investimentos").insert(payload);
    }
    onSalvo();
    fechar();
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "92vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Header fixo */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">{inv ? "Editar ativo" : "Novo ativo"}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Campos roláveis */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          <label style={lbl}>
            Nome do ativo
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Tesouro IPCA+ 2035" style={inp} autoFocus />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>
              Ticker (opcional)
              <input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="Ex: XPML11" style={inp} />
            </label>
            <label style={lbl}>
              Moeda
              <select value={moeda} onChange={e => setMoeda(e.target.value as "BRL" | "USD")} style={inp}>
                {MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>

          <label style={lbl}>
            Categoria
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inp}>
              {CATS.map(c => <option key={c} value={c}>{CAT_INFO[c].label}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>
              Qtd./Cotas
              <input type="number" step="0.000001" value={cotas} onChange={e => setCotas(e.target.value)}
                placeholder="0" style={inp} />
            </label>
            <label style={lbl}>
              Preço atual ({moeda})
              <InputValor value={precoAtual} onChange={setPrecoAtual} style={inp} placeholder="0,00" />
            </label>
          </div>

          {cotas && (
            <label style={lbl}>
              Preço médio ({moeda})
              <InputValor value={pm} onChange={setPm} style={inp} placeholder="0,00" />
            </label>
          )}

          {!usaCotas && (
            <label style={lbl}>
              Valor total em BRL (alternativo)
              <InputValor value={valorDir} onChange={setValorDir} style={inp} placeholder="0,00" />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Use quando não tem cotas (ex: CDB, poupança)</span>
            </label>
          )}

          {(usaCotas || valorDirNum > 0) && (
            <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total estimado BRL: </span>
              <span className="text-sm font-bold" style={{ color: "#4caf82" }}>{brl(totalBRL)}</span>
            </div>
          )}
        </div>

        {/* Botão fixo na base */}
        <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando || !nome}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando ? "Salvando…" : inv ? "Salvar alterações" : "Adicionar ativo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Componente principal ——
export default function InvestimentosClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [itens, setItens] = useState<Investimento[]>([]);
  const [metas, setMetas] = useState<InvestMetas | null>(null);
  const [carregando, setCarregando] = useState(true);

  // UI
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [catAberta, setCatAberta] = useState<Record<string, boolean>>({});
  const [mostrarOcultos, setMostrarOcultos] = useState(false);

  const ptax = metas?.ptax || 5.0;

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: invs }, { data: meta }] = await Promise.all([
      supabase.from("investimentos").select("*").eq("workspace_id", workspaceId).order("categoria"),
      supabase.from("invest_metas").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    ]);
    setItens((invs || []) as unknown as Investimento[]);
    setMetas(meta as unknown as InvestMetas | null);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  // —— Toggle hidden no Supabase ——
  async function toggleHidden(inv: Investimento) {
    const novoValor = !inv.hidden;
    // Atualiza otimisticamente
    setItens(prev => prev.map(i => i.id === inv.id ? { ...i, hidden: novoValor } : i));
    const { error } = await createClient()
      .from("investimentos")
      .update({ hidden: novoValor } as Record<string, unknown>)
      .eq("id", inv.id);
    if (error) {
      // Reverte se erro
      setItens(prev => prev.map(i => i.id === inv.id ? { ...i, hidden: !novoValor } : i));
    }
  }

  async function deletar(id: string) {
    if (!confirm("Remover este ativo?")) return;
    await createClient().from("investimentos").delete().eq("id", id);
    setItens(prev => prev.filter(i => i.id !== id));
  }

  function abrirNovo() { setEditando(null); setModalAberto(true); }
  function abrirEditar(inv: Investimento) { setEditando(inv); setModalAberto(true); }
  function toggleCat(cat: string) { setCatAberta(prev => ({ ...prev, [cat]: !prev[cat] })); }

  // —— Cálculos ——
  // Itens visíveis (não ocultos) = usados no total e no gráfico
  const visiveis = itens.filter(i => !i.hidden);
  const ocultos = itens.filter(i => i.hidden);
  const totalGeral = visiveis.reduce((s, i) => s + valorAtual(i, ptax), 0);

  // Pizza por categoria (apenas visíveis)
  const pizzaData = CATS
    .map(cat => ({
      cat,
      label: CAT_INFO[cat].label,
      cor: CAT_INFO[cat].cor,
      value: visiveis.filter(i => i.categoria === cat).reduce((s, i) => s + valorAtual(i, ptax), 0),
    }))
    .filter(d => d.value > 0);

  // Itens por categoria (todos — visíveis + ocultos)
  const itensPorCat = (cat: string) => itens.filter(i => i.categoria === cat);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Hero — total visível */}
      <div className="rounded-2xl px-5 py-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Patrimônio total</p>
        <p className="text-3xl font-bold mt-0.5" style={{ color: "#4caf82" }}>{brl(totalGeral)}</p>
        {ocultos.length > 0 && (
          <button
            onClick={() => setMostrarOcultos(v => !v)}
            className="text-xs mt-2 flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}>
            <EyeOff size={12} />
            {ocultos.length} ativo{ocultos.length !== 1 ? "s" : ""} oculto{ocultos.length !== 1 ? "s" : ""} (
            {brl(ocultos.reduce((s, i) => s + valorAtual(i, ptax), 0))} excluído do total)
            {" · "}<span style={{ color: "var(--primary)" }}>{mostrarOcultos ? "Ocultar" : "Mostrar"}</span>
          </button>
        )}
        {mostrarOcultos && ocultos.length > 0 && (
          <button
            onClick={async () => {
              // Mostrar todos = setar hidden=false em todos
              const ids = ocultos.map(i => i.id);
              setItens(prev => prev.map(i => ids.includes(i.id) ? { ...i, hidden: false } : i));
              await createClient().from("investimentos")
                .update({ hidden: false } as Record<string, unknown>)
                .in("id", ids);
            }}
            className="text-xs mt-1 underline"
            style={{ color: "var(--primary)" }}>
            Mostrar todos no total
          </button>
        )}
      </div>

      {/* Pizza de alocação */}
      {pizzaData.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2">Alocação</p>
          {/* flex com chart fixo à esquerda e legenda à direita com overflow controlado */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", overflow: "hidden" }}>
            <div style={{ width: 110, height: 110, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pizzaData} cx="50%" cy="50%" outerRadius={50} dataKey="value" nameKey="label">
                    {pizzaData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {pizzaData.map(d => (
                <div key={d.cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                    {d.label}
                  </span>
                  <span style={{ flexShrink: 0, fontWeight: 600 }}>
                    {totalGeral ? ((d.value / totalGeral) * 100).toFixed(0) : 0}%
                  </span>
                  <span style={{ flexShrink: 0, color: "var(--text-muted)", fontSize: 10 }}>
                    {brl(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Botão novo ativo */}
      <button onClick={abrirNovo}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
        style={{ background: "var(--primary)", color: "#fff" }}>
        <Plus size={16} /> Novo ativo
      </button>

      {/* Lista por categoria */}
      {CATS.map(cat => {
        const grupo = itensPorCat(cat);
        if (grupo.length === 0) return null;
        const totalCat = grupo.filter(i => !i.hidden).reduce((s, i) => s + valorAtual(i, ptax), 0);
        const info = CAT_INFO[cat];
        const aberta = catAberta[cat] !== false; // default: expandido

        return (
          <div key={cat} className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {/* Header da categoria */}
            <button className="w-full flex items-center gap-2 px-4 py-3" onClick={() => toggleCat(cat)}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.cor }} />
              <p className="text-sm font-semibold flex-1 text-left">{info.label}</p>
              <span className="text-xs flex-shrink-0 mr-1" style={{ color: "var(--text-muted)" }}>
                {grupo.length} ativo{grupo.length !== 1 ? "s" : ""}
              </span>
              <span className="text-sm font-bold flex-shrink-0 mr-1" style={{ color: "#4caf82" }}>
                {brl(totalCat)}
              </span>
              {aberta
                ? <ChevronUp size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                : <ChevronDown size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              }
            </button>

            {/* Itens */}
            {aberta && (
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                {grupo.map(inv => {
                  const val = valorAtual(inv, ptax);
                  const oculto = inv.hidden;
                  return (
                    <div key={inv.id}
                      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0"
                      style={{
                        borderColor: "var(--border)",
                        opacity: oculto ? 0.45 : 1,
                        transition: "opacity 0.15s",
                      }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {oculto && <EyeOff size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                          <p className="text-sm truncate font-medium">{inv.nome}</p>
                          {inv.ticker && (
                            <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
                              {inv.ticker}
                            </span>
                          )}
                        </div>
                        {inv.cotas && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {inv.cotas} cotas · PM {inv.pm ? brl(inv.pm) : "—"}
                            {inv.moeda === "USD" ? " (USD)" : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold flex-shrink-0 mr-1" style={{ color: "#4caf82" }}>
                        {brl(val)}
                      </span>
                      {/* Controles */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleHidden(inv)}
                          title={oculto ? "Incluir no total" : "Excluir do total"}
                          style={{ color: oculto ? "var(--primary)" : "var(--text-muted)" }}>
                          {oculto ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => abrirEditar(inv)} style={{ color: "var(--text-muted)" }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deletar(inv.id)} style={{ color: "var(--text-muted)" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Objetivos */}
      {metas && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} style={{ color: "var(--primary)" }} />
            <p className="text-sm font-semibold">Objetivos</p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: "Reserva de emergência", meta: metas.reserva },
              { label: "Fundo de leilão", meta: metas.leilao },
              { label: "Aluguel 2027", meta: metas.aluguel27 },
              { label: "PGBL", meta: metas.pgbl },
            ]
              .filter(o => o.meta > 0)
              .map(obj => {
                const atual = visiveis
                  .filter(i => {
                    if (obj.label === "Reserva de emergência") return i.obj === "reserva";
                    if (obj.label === "Fundo de leilão") return i.obj === "leilao";
                    if (obj.label === "Aluguel 2027") return i.obj === "aluguel27";
                    if (obj.label === "PGBL") return i.categoria === "pgbl";
                    return false;
                  })
                  .reduce((s, i) => s + valorAtual(i, ptax), 0);
                const pct = obj.meta > 0 ? Math.min((atual / obj.meta) * 100, 100) : 0;
                return (
                  <div key={obj.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{obj.label}</span>
                      <span className="text-xs font-medium">
                        {brl(atual)} <span style={{ color: "var(--text-muted)" }}>/ {brl(obj.meta)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--surface2)" }}>
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct >= 100 ? "#4caf82" : "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <ModalAtivo
          workspaceId={workspaceId!}
          inv={editando}
          ptax={ptax}
          fechar={() => setModalAberto(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
