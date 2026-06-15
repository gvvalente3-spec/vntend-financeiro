"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Eye, EyeOff, Plus, Pencil, Trash2, X,
  ChevronDown, ChevronUp, Target, Settings2, RefreshCw
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl } from "@/lib/utils";
import type { Investimento, InvestMetas } from "@/types/database";

// —— Interface Objetivos Dinâmicos ——
export interface ObjetivoCustom {
  id: string;
  emoji: string;
  nome: string;
  meta: number;
}

const DEFAULT_OBJS: ObjetivoCustom[] = [
  { id: "leilao", emoji: "🏠", nome: "Fundo leilão", meta: 100000 },
  { id: "reserva", emoji: "🛡️", nome: "Reserva emergência", meta: 30000 },
  { id: "aluguel27", emoji: "🏢", nome: "Aluguel 2027", meta: 37200 },
  { id: "pgbl", emoji: "📊", nome: "PGBL", meta: 13000 },
  { id: "consorcio", emoji: "🏡", nome: "Consórcio", meta: 200000 }
];

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

function ganhoAtivo(inv: Investimento, ptax: number) {
  const q = Number(inv.cotas || 0), pm = Number(inv.pm || 0), pa = Number(inv.preco_atual || 0);
  if (q > 0 && pm > 0 && pa > 0) {
    const pmBrl = inv.moeda === "USD" ? pm * ptax : pm;
    const paBrl = inv.moeda === "USD" ? pa * ptax : pa;
    return q * (paBrl - pmBrl);
  }
  return 0;
}

const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" };

// —— Modal de ativo (novo/editar) ——
function ModalAtivo({
  workspaceId, inv, ptax, objetivos, fechar, onSalvo,
}: {
  workspaceId: string; inv?: Investimento | null; ptax: number;
  objetivos: ObjetivoCustom[]; fechar: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState(inv?.nome || "");
  const [ticker, setTicker] = useState(inv?.ticker || "");
  const [categoria, setCategoria] = useState<string>(inv?.categoria || "rendaFixa");
  const [obj, setObj] = useState(inv?.obj || "");
  const [cotas, setCotas] = useState(inv?.cotas != null ? String(inv.cotas) : "");
  const [pm, setPm] = useState(inv?.pm != null ? String(Math.round(Number(inv.pm) * 100)) : "");
  const [precoAtual, setPrecoAtual] = useState(inv?.preco_atual != null ? String(Math.round(Number(inv.preco_atual) * 100)) : "");
  const [moeda, setMoeda] = useState<"BRL" | "USD">(inv?.moeda || "BRL");
  const [valorDir, setValorDir] = useState(inv?.valor != null ? String(Math.round(Number(inv.valor) * 100)) : "");
  const [salvando, setSalvando] = useState(false);

  const pmNum = parseInt(pm || "0", 10) / 100;
  const precoNum = parseInt(precoAtual || "0", 10) / 100;
  const valorDirNum = parseInt(valorDir || "0", 10) / 100;

  const usaCotas = !!cotas && !!precoAtual;
  const totalBRL = usaCotas ? Number(cotas) * precoNum * (moeda === "USD" ? ptax : 1) : valorDirNum;

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const payload = {
      workspace_id: workspaceId, nome, ticker: ticker || null, categoria,
      cotas: cotas ? Number(cotas) : null, pm: pmNum || null, preco_atual: precoNum || null,
      moeda, valor: cotas ? null : (valorDirNum || null),
      obj: obj || null, hidden: inv?.hidden ?? false,
    } as Record<string, unknown>;
    
    const supabase = createClient();
    if (inv?.id) {
      await supabase.from("investimentos").update(payload).eq("id", inv.id);
    } else {
      await supabase.from("investimentos").insert(payload);
    }
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">{inv ? "Editar ativo" : "Novo ativo"}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-3" style={{ minHeight: 0, flex: "1 1 auto" }}>
          <label style={lbl}>Nome do ativo<input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Tesouro IPCA+ 2035" style={inp} autoFocus /></label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>Ticker (opcional)<input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="Ex: XPML11" style={inp} /></label>
            <label style={lbl}>Moeda<select value={moeda} onChange={e => setMoeda(e.target.value as "BRL" | "USD")} style={inp}>{MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>

          <label style={lbl}>Categoria<select value={categoria} onChange={e => setCategoria(e.target.value)} style={inp}>{CATS.map(c => <option key={c} value={c}>{CAT_INFO[c].label}</option>)}</select></label>
          
          <label style={lbl}>
            Vincular a um Objetivo
            <select value={obj} onChange={e => setObj(e.target.value)} style={inp}>
              <option value="">— Sem vínculo —</option>
              {objetivos.map(o => <option key={o.id} value={o.id}>{o.emoji} {o.nome}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>Qtd./Cotas<input type="number" step="0.000001" value={cotas} onChange={e => setCotas(e.target.value)} placeholder="0" style={inp} /></label>
            <label style={lbl}>Preço atual ({moeda})<InputValor value={precoAtual} onChange={setPrecoAtual} style={inp} placeholder="0,00" /></label>
          </div>

          {cotas && <label style={lbl}>Preço médio ({moeda})<InputValor value={pm} onChange={setPm} style={inp} placeholder="0,00" /></label>}

          {!usaCotas && (
            <label style={lbl}>Valor total em BRL (alternativo)<InputValor value={valorDir} onChange={setValorDir} style={inp} placeholder="0,00" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Use quando não tem cotas (ex: CDB, poupança)</span></label>
          )}

          {(usaCotas || valorDirNum > 0) && (
            <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total estimado BRL: </span><span className="text-sm font-bold" style={{ color: "#4caf82" }}>{brl(totalBRL)}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando || !nome} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando ? "Salvando…" : inv ? "Salvar alterações" : "Adicionar ativo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Modal Aporte ——
function FormAporte({ ativo, fechar, onSalvo }: { ativo: Investimento; fechar: () => void; onSalvo: () => void; }) {
  const [novasCotas, setNovasCotas] = useState("");
  const [precoCompra, setPrecoCompra] = useState(ativo.preco_atual ? String(Math.round(ativo.preco_atual * 100)) : (ativo.pm ? String(Math.round(ativo.pm * 100)) : ""));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const nc = Number(novasCotas) || 0, np = parseInt(precoCompra || "0", 10) / 100;
    if (!nc || !np) return;
    setSalvando(true);
    const oldCotas = Number(ativo.cotas) || 0, oldPm = Number(ativo.pm) || 0;
    const newCotas = oldCotas + nc;
    const newPm = newCotas ? ((oldCotas * oldPm) + (nc * np)) / newCotas : np;
    await createClient().from("investimentos").update({ cotas: newCotas, pm: newPm, preco_atual: np } as Record<string, unknown>).eq("id", ativo.id);
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Aportar em {ativo.nome}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}>✕</button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>O preço médio será recalculado automaticamente.</p>
        <div className="flex gap-3">
          <label style={{ ...lbl, flex: 1 }}>Novas cotas<input type="number" value={novasCotas} onChange={e => setNovasCotas(e.target.value)} placeholder="0" style={inp} /></label>
          <label style={{ ...lbl, flex: 1 }}>Preço de compra<InputValor value={precoCompra} onChange={setPrecoCompra} style={inp} placeholder="0,00" /></label>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          PM atual: {ativo.moeda === "USD" ? "$" : "R$"}{Number(ativo.pm || 0).toFixed(2)} · {Number(ativo.cotas || 0)} cotas
        </p>
        <button onClick={salvar} disabled={salvando} className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#fff" }}>
          {salvando ? "Salvando…" : "Aportar"}
        </button>
      </div>
    </div>
  );
}

// —— Modal Gerenciar Objetivos ——
function ModalObjetivos({ workspaceId, objetivosAtuais, fechar, onSalvo }: {
  workspaceId: string; objetivosAtuais: ObjetivoCustom[]; fechar: () => void; onSalvo: () => void;
}) {
  const [lista, setLista] = useState<ObjetivoCustom[]>(JSON.parse(JSON.stringify(objetivosAtuais)));
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  function add() {
    setLista([...lista, { id: `obj_${Date.now()}`, emoji: "🎯", nome: "Novo Objetivo", meta: 0 }]);
  }

  function remover(id: string) {
    if (!confirm("Remover este objetivo? Os ativos vinculados a ele perderão o vínculo automaticamente.")) return;
    setRemovidos(prev => [...prev, id]);
    setLista(lista.filter(o => o.id !== id));
  }

  function update(id: string, campo: keyof ObjetivoCustom, valor: any) {
    setLista(lista.map(o => o.id === id ? { ...o, [campo]: valor } : o));
  }

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("invest_metas").update({ objetivos_custom: lista } as any).eq("workspace_id", workspaceId);

    if (removidos.length > 0) {
      await supabase.from("investimentos").update({ obj: null } as any).in("obj", removidos).eq("workspace_id", workspaceId);
    }
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">Gerenciar Objetivos</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-3">
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Defina suas metas. Excluir um objetivo não apaga seus investimentos, apenas remove o vínculo.</p>
          {lista.map(o => (
            <div key={o.id} className="flex gap-2 items-center p-2 rounded-xl" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <input value={o.emoji} onChange={e => update(o.id, 'emoji', e.target.value)} className="w-10 h-10 text-center rounded-lg text-lg outline-none" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <div className="flex-1 flex flex-col gap-1">
                <input value={o.nome} onChange={e => update(o.id, 'nome', e.target.value)} placeholder="Nome do objetivo" className="text-sm px-2 py-1 rounded outline-none" style={{ background: "transparent", color: "var(--text)", fontWeight: 500 }} />
                <div className="flex items-center gap-1 px-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Meta R$</span>
                  <InputValor value={String(Math.round(o.meta * 100))} onChange={v => update(o.id, 'meta', parseInt(v || "0", 10) / 100)} style={{ background: "transparent", fontSize: 13, color: "var(--primary)", fontWeight: 600, width: "100%", outline: "none" }} />
                </div>
              </div>
              <button onClick={() => remover(o.id)} className="p-2 transition-colors" style={{ color: "var(--danger)" }}><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={add} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium mt-1" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
            <Plus size={16} /> Adicionar objetivo
          </button>
        </div>
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Edição inline do PTAX ——
function PtaxInline({ valorAtual, workspaceId, onSalvo }: {
  valorAtual: number; workspaceId: string; onSalvo: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(String(valorAtual));
  const [salvando, setSalvando] = useState(false);

  async function salvarManual() {
    setSalvando(true);
    await createClient().from("invest_metas").update({ ptax: Number(val) || valorAtual } as Record<string, unknown>).eq("workspace_id", workspaceId);
    setEditando(false); setSalvando(false); onSalvo();
  }

  if (editando) {
    return (
      <input autoFocus type="number" step="0.0001" value={val} onChange={e => setVal(e.target.value)} onBlur={salvarManual} onKeyDown={e => { if (e.key === "Enter") salvarManual(); }} disabled={salvando} className="text-sm rounded px-1.5 py-0.5 w-24 outline-none text-right" style={{ background: "var(--surface)", border: "1px solid var(--primary)", color: "var(--text)" }} />
    );
  }
  return (
    <button onClick={() => { setVal(String(valorAtual)); setEditando(true); }} className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
      R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
    </button>
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
  const [modalObjAberto, setModalObjAberto] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [aportando, setAportando] = useState<Investimento | null>(null);
  const [catAberta, setCatAberta] = useState<Record<string, boolean>>({});
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [atualizandoCotacoes, setAtualizandoCotacoes] = useState(false);

  const ptax = metas?.ptax || 5.0;
  const objetivosCustom: ObjetivoCustom[] = (metas?.objetivos_custom as unknown as ObjetivoCustom[]) || DEFAULT_OBJS;

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

  // Função Global de Atualização de Cotações via API Interna
  async function atualizarTodasCotacoes() {
    if (!workspaceId) return;
    setAtualizandoCotacoes(true);
    try {
      const ativosComTicker = itens.filter(i => i.ticker);
      const payload = ativosComTicker.map(i => ({
        id: i.id,
        ticker: i.ticker,
        tipo: i.categoria === "cripto" ? "cripto" : i.categoria === "exterior" ? "ext" : "br"
      }));

      // Chama a rota interna /api/cotacoes
      const res = await fetch("/api/cotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: payload })
      });

      if (!res.ok) throw new Error("Erro na resposta da API");
      const data = await res.json();

      const supabase = createClient();
      let houveAtualizacao = false;

      // 1. Atualizar o PTAX (Dólar) se encontrou valor
      if (data.ptax && data.ptax > 0) {
        await supabase.from("invest_metas").update({ ptax: data.ptax } as any).eq("workspace_id", workspaceId);
        houveAtualizacao = true;
      }

      // 2. Atualizar todos os ativos que retornaram preço
      if (data.resultados && data.resultados.length > 0) {
        for (const ativo of data.resultados) {
          if (ativo.preco && ativo.preco > 0) {
            await supabase.from("investimentos").update({ preco_atual: ativo.preco } as any).eq("id", ativo.id);
            houveAtualizacao = true;
          }
        }
      }

      if (houveAtualizacao) {
        await carregar(); // Recarrega os dados visuais na tela
        alert("Cotações e Dólar atualizados com sucesso!");
      } else {
        alert("Nenhuma cotação nova encontrada no momento.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao tentar atualizar as cotações. Tente novamente mais tarde.");
    } finally {
      setAtualizandoCotacoes(false);
    }
  }

  async function toggleHidden(inv: Investimento) {
    const novoValor = !inv.hidden;
    setItens(prev => prev.map(i => i.id === inv.id ? { ...i, hidden: novoValor } : i));
    const { error } = await createClient().from("investimentos").update({ hidden: novoValor } as Record<string, unknown>).eq("id", inv.id);
    if (error) setItens(prev => prev.map(i => i.id === inv.id ? { ...i, hidden: !novoValor } : i));
  }

  async function deletar(id: string) {
    if (!confirm("Remover este ativo?")) return;
    await createClient().from("investimentos").delete().eq("id", id);
    setItens(prev => prev.filter(i => i.id !== id));
  }

  function abrirNovo() { setEditando(null); setModalAberto(true); }
  function abrirEditar(inv: Investimento) { setEditando(inv); setModalAberto(true); }
  function toggleCat(cat: string) { setCatAberta(prev => ({ ...prev, [cat]: !prev[cat] })); }

  const visiveis = itens.filter(i => !i.hidden);
  const ocultos = itens.filter(i => i.hidden);
  const totalGeral = visiveis.reduce((s, i) => s + valorAtual(i, ptax), 0);

  const pizzaData = CATS.map(cat => ({
    cat, label: CAT_INFO[cat].label, cor: CAT_INFO[cat].cor,
    value: visiveis.filter(i => i.categoria === cat).reduce((s, i) => s + valorAtual(i, ptax), 0),
  })).filter(d => d.value > 0);

  const itensPorCat = (cat: string) => itens.filter(i => i.categoria === cat);

  if (wsLoading || carregando) return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Hero — total visível */}
      <div className="rounded-2xl px-5 py-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Patrimônio total</p>
        <p className="text-3xl font-bold mt-0.5" style={{ color: "#4caf82" }}>{brl(totalGeral)}</p>
        {ocultos.length > 0 && (
          <button onClick={() => setMostrarOcultos(v => !v)} className="text-xs mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <EyeOff size={12} />
            {ocultos.length} ativo{ocultos.length !== 1 ? "s" : ""} oculto{ocultos.length !== 1 ? "s" : ""} ({brl(ocultos.reduce((s, i) => s + valorAtual(i, ptax), 0))} excluído)
            {" · "}<span style={{ color: "var(--primary)" }}>{mostrarOcultos ? "Ocultar" : "Mostrar"}</span>
          </button>
        )}
        {mostrarOcultos && ocultos.length > 0 && (
          <button onClick={async () => {
            const ids = ocultos.map(i => i.id);
            setItens(prev => prev.map(i => ids.includes(i.id) ? { ...i, hidden: false } : i));
            await createClient().from("investimentos").update({ hidden: false } as Record<string, unknown>).in("id", ids);
          }} className="text-xs mt-1 underline" style={{ color: "var(--primary)" }}>Mostrar todos no total</button>
        )}
      </div>

      {/* Pizza de alocação */}
      {pizzaData.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2">Alocação</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", overflow: "hidden" }}>
            <div style={{ width: 110, height: 110, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pizzaData} cx="50%" cy="50%" outerRadius={50} dataKey="value" nameKey="label">{pizzaData.map((d, i) => <Cell key={i} fill={d.cor} />)}</Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {pizzaData.map(d => (
                <div key={d.cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{d.label}</span>
                  <span style={{ flexShrink: 0, fontWeight: 600 }}>{totalGeral ? ((d.value / totalGeral) * 100).toFixed(0) : 0}%</span>
                  <span style={{ flexShrink: 0, color: "var(--text-muted)", fontSize: 10 }}>{brl(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Botões de Ação Principais */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={abrirNovo} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Novo ativo
        </button>
        <button 
          onClick={atualizarTodasCotacoes} 
          disabled={atualizandoCotacoes}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors" 
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <RefreshCw size={16} className={atualizandoCotacoes ? "animate-spin" : ""} />
          {atualizandoCotacoes ? "Atualizando..." : "Atualizar Cotações"}
        </button>
      </div>

      {/* Lista por categoria */}
      {CATS.map(cat => {
        const grupo = itensPorCat(cat);
        if (grupo.length === 0) return null;
        const totalCat = grupo.filter(i => !i.hidden).reduce((s, i) => s + valorAtual(i, ptax), 0);
        const info = CAT_INFO[cat];
        const aberta = catAberta[cat] !== false;

        return (
          <div key={cat} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <button className="w-full flex items-center gap-2 px-4 py-3" onClick={() => toggleCat(cat)}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.cor }} />
              <p className="text-sm font-semibold flex-1 text-left">{info.label}</p>
              <span className="text-xs flex-shrink-0 mr-1" style={{ color: "var(--text-muted)" }}>{grupo.length} ativo{grupo.length !== 1 ? "s" : ""}</span>
              <span className="text-sm font-bold flex-shrink-0 mr-1" style={{ color: "#4caf82" }}>{brl(totalCat)}</span>
              {aberta ? <ChevronUp size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            </button>

            {aberta && (
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                {grupo.map(inv => {
                  const val = valorAtual(inv, ptax);
                  const gan = ganhoAtivo(inv, ptax);
                  const ganPct = inv.cotas && inv.pm && inv.preco_atual ? ((Number(inv.preco_atual) / Number(inv.pm) - 1) * 100) : null;
                  const oculto = inv.hidden;
                  const vinculadoObj = objetivosCustom.find(o => o.id === inv.obj);

                  return (
                    <div key={inv.id} className="flex flex-col gap-2 px-4 py-3 border-b last:border-0" style={{ borderColor: "var(--border)", opacity: oculto ? 0.45 : 1, transition: "opacity 0.15s" }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {oculto && <EyeOff size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                            <p className="text-sm truncate font-medium">{inv.nome}</p>
                            {inv.ticker && <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>{inv.ticker}</span>}
                          </div>
                          {inv.cotas && (
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              {inv.cotas} cotas · PM {inv.moeda === "USD" ? "$" : "R$"}{Number(inv.pm).toFixed(2)}
                              {inv.preco_atual && ` · Atual ${inv.moeda === "USD" ? "$" : "R$"}${Number(inv.preco_atual).toFixed(2)}`}
                            </p>
                          )}
                          {vinculadoObj && <p className="text-[10px] mt-0.5" style={{ color: "var(--primary-light)" }}>↳ {vinculadoObj.emoji} {vinculadoObj.nome}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-bold" style={{ color: "#4caf82" }}>{brl(val)}</p>
                          {ganPct !== null && (
                            <p className="text-xs" style={{ color: ganPct >= 0 ? "#4caf82" : "var(--danger)" }}>
                              {ganPct >= 0 ? "+" : ""}{ganPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Controles: Aportar, Ocultar, Editar, Excluir */}
                      <div className="flex gap-2 items-center flex-wrap">
                        {inv.cotas && (
                          <button onClick={() => setAportando(inv)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-transparent" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                            <Plus size={10} /> aportar
                          </button>
                        )}
                        <div className="flex gap-2 items-center ml-auto">
                          <button onClick={() => toggleHidden(inv)} title={oculto ? "Incluir no total" : "Excluir do total"} style={{ color: oculto ? "var(--primary)" : "var(--text-muted)" }}>{oculto ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                          <button onClick={() => abrirEditar(inv)} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
                          <button onClick={() => deletar(inv.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Objetivos — dinâmicos */}
      {metas && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} style={{ color: "var(--primary)" }} />
            <p className="text-sm font-semibold flex-1">Objetivos e Metas</p>
            <button onClick={() => setModalObjAberto(true)} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors" style={{ background: "var(--surface2)", color: "var(--text)" }}>
              <Settings2 size={12} /> Gerenciar
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            {objetivosCustom.map(obj => {
              const meta = Number(obj.meta) || 0;
              // Mantemos retrocompatibilidade com a categoria "pgbl" antiga apenas para fallback
              const atual = visiveis.filter(i => i.obj === obj.id || (obj.id === 'pgbl' && i.categoria === 'pgbl')).reduce((s, i) => s + valorAtual(i, ptax), 0);
              const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
              return (
                <div key={obj.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{obj.emoji} {obj.nome}</span>
                    <span className="text-xs font-medium">{brl(atual)} / <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{meta > 0 ? brl(meta) : "S/ Meta"}</span></span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--surface2)" }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "#4caf82" : "var(--primary)" }} />
                  </div>
                  {meta > 0 && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{pct.toFixed(0)}% atingido</p>}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Cotação USD (PTAX)</span>
            <PtaxInline valorAtual={ptax} workspaceId={workspaceId!} onSalvo={carregar} />
          </div>
        </div>
      )}

      {/* Modais */}
      {modalAberto && <ModalAtivo workspaceId={workspaceId!} inv={editando} ptax={ptax} objetivos={objetivosCustom} fechar={() => setModalAberto(false)} onSalvo={carregar} />}
      {aportando && <FormAporte ativo={aportando} fechar={() => setAportando(null)} onSalvo={carregar} />}
      {modalObjAberto && <ModalObjetivos workspaceId={workspaceId!} objetivosAtuais={objetivosCustom} fechar={() => setModalObjAberto(false)} onSalvo={carregar} />}
    </div>
  );
}
