"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, X, TrendingUp, TrendingDown, CreditCard, Wallet,
  FileText, ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, mesDoLanc, formatData, MESES } from "@/lib/utils";
import type { Lancamento, Conta, Cartao } from "@/types/database";
import RegistrarContracheque from "./RegistrarContracheque";

// —— Helpers ——

function matchSearch(l: Lancamento, ql: string): boolean {
  if (!ql) return true;
  if ((l.descricao || "").toLowerCase().includes(ql)) return true;
  if ((l.cat || "").toLowerCase().includes(ql)) return true;
  if ((l.sub || "").toLowerCase().includes(ql)) return true;
  if (formatData(l.data).includes(ql)) return true;
  // Busca por valor (ex: "1500" ou "1.500")
  const isNum = /^[\d,\.]+$/.test(ql);
  if (isNum) {
    const qd = ql.replace(/\D/g, "");
    if (qd.length >= 2) {
      const vd = brl(Number(l.valor)).replace(/\D/g, "");
      if (vd.startsWith(qd)) return true;
    }
  }
  return false;
}

// —— InputValor: centavos automáticos (29550 → 295,50) ——
function fmtCts(digits: string): string {
  const n = parseInt(digits || "0", 10);
  if (!digits) return "";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function InputValor({ value, onChange, style, placeholder, autoFocus }: {
  value: string; onChange: (d: string) => void;
  style?: React.CSSProperties; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
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

// —— Campo de busca reutilizável ——
function CampoBusca({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--text-muted)" }} />
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
        <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X size={13} style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}

// —— Item de lançamento na lista ——
function ItemLanc({
  l, onEditar, onDeletar,
}: { l: Lancamento; onEditar: (l: Lancamento) => void; onDeletar: (id: string) => void }) {
  const isRec = l.tipo === "receita";
  const cor = isRec ? "#4caf82" : "var(--danger)";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: cor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{l.descricao || (isRec ? "Receita" : "Despesa")}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}
          {l.cartao_id && !l.pago ? " · em aberto" : ""}
        </p>
      </div>
      <span className="text-sm font-semibold flex-shrink-0 mr-1" style={{ color: cor }}>
        {isRec ? "+" : "−"}{brl(Number(l.valor))}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onEditar(l)} style={{ color: "var(--text-muted)" }}>
          <Pencil size={13} />
        </button>
        <button onClick={() => onDeletar(l.id)} style={{ color: "var(--text-muted)" }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// —— Modal de lançamento (novo / editar) ——
const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" };

function ModalLanc({
  workspaceId, contas, cartoes, lancamento, fechar, onSalvo,
}: {
  workspaceId: string;
  contas: Conta[];
  cartoes: Cartao[];
  lancamento?: Lancamento | null;
  fechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<"receita" | "despesa">(lancamento?.tipo || "despesa");
  // Valor armazenado em centavos (string de dígitos): "29550" = R$ 295,50
  const [valorCts, setValorCts] = useState(
    lancamento ? String(Math.round(Number(lancamento.valor) * 100)) : ""
  );
  const [descricao, setDescricao] = useState(lancamento?.descricao || "");
  const [data, setData] = useState(lancamento?.data || new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState(lancamento?.cat || "");
  const [sub, setSub] = useState(lancamento?.sub || "");
  const [contaId, setContaId] = useState(lancamento?.conta_id || "");
  const [cartaoId, setCartaoId] = useState(lancamento?.cartao_id || "");
  const [pago, setPago] = useState(lancamento?.pago ?? true);
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseInt(valorCts || "0", 10) / 100;

  async function salvar() {
    if (!valorCts || !data) return;
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      workspace_id: workspaceId,
      tipo,
      valor: valorNum,
      descricao: descricao || null,
      data,
      cat: cat || null,
      sub: sub || null,
      subsub: null,
      conta_id: contaId || null,
      cartao_id: tipo === "despesa" ? (cartaoId || null) : null,
      pago,
      fiscal: "",
      rec_id: null,
      parcela_num: null,
      parcela_total: null,
    } as Record<string, unknown>;

    if (lancamento?.id) {
      await supabase.from("lancamentos").update(payload).eq("id", lancamento.id);
    } else {
      await supabase.from("lancamentos").insert(payload);
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
          <h3 className="font-semibold">{lancamento ? "Editar lançamento" : "Novo lançamento"}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Campos roláveis */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {(["receita", "despesa"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className="py-2 rounded-xl text-sm font-medium"
                style={{
                  background: tipo === t ? (t === "receita" ? "#4caf82" : "var(--danger)") : "var(--surface2)",
                  color: tipo === t ? "#fff" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          <label style={lbl}>
            Valor (R$)
            <InputValor value={valorCts} onChange={setValorCts} style={inp} autoFocus />
          </label>

          <label style={lbl}>
            Descrição
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Supermercado" style={inp} />
          </label>

          <label style={lbl}>
            Data
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>
              Categoria
              <input type="text" value={cat} onChange={e => setCat(e.target.value)}
                placeholder="Ex: Alimentação" style={inp} />
            </label>
            <label style={lbl}>
              Subcategoria
              <input type="text" value={sub} onChange={e => setSub(e.target.value)}
                placeholder="Opcional" style={inp} />
            </label>
          </div>

          {tipo === "despesa" && cartoes.length > 0 && (
            <label style={lbl}>
              Cartão (opcional)
              <select value={cartaoId} onChange={e => setCartaoId(e.target.value)} style={inp}>
                <option value="">— Débito / Direto —</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          {!cartaoId && contas.length > 0 && (
            <label style={lbl}>
              Conta
              <select value={contaId} onChange={e => setContaId(e.target.value)} style={inp}>
                <option value="">— Selecione —</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          {tipo === "despesa" && !cartaoId && (
            <button onClick={() => setPago(v => !v)}
              className="flex items-center gap-2 py-2 px-3 rounded-xl text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: pago ? "var(--primary)" : "var(--surface)", border: `1px solid ${pago ? "var(--primary)" : "var(--border)"}` }}>
                {pago && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
              </span>
              Pago / já debitado
            </button>
          )}
        </div>

        {/* Botão fixo na base — sempre visível */}
        <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando || !valorCts || !data}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando ? "Salvando…" : lancamento ? "Salvar alterações" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Componente principal ——
export default function LancamentosClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [mes, setMes] = useState(mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // UI state
  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEd, setLancamentoEd] = useState<Lancamento | null>(null);
  const [contrachequeAberto, setContrachequeAberto] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aba, setAba] = useState<"todos" | "receita" | "despesa">("todos");

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: lancs }, { data: cts }, { data: carts }] = await Promise.all([
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId)
        .order("data", { ascending: false }),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
    ]);
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function deletar(id: string) {
    if (!confirm("Remover este lançamento?")) return;
    await createClient().from("lancamentos").delete().eq("id", id);
    setLancamentos(l => l.filter(x => x.id !== id));
  }

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function abrirNovo() { setLancamentoEd(null); setModalAberto(true); }
  function abrirEditar(l: Lancamento) { setLancamentoEd(l); setModalAberto(true); }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;

  const doMes = lancamentos.filter(l => mesDoLanc(l.data) === mes);
  const ql = searchQuery.toLowerCase().trim();
  const filtrados = doMes
    .filter(l => aba === "todos" || l.tipo === aba)
    .filter(l => matchSearch(l, ql));

  const totalReceitas = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <span className="font-medium capitalize text-sm">{labelMes}</span>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} style={{ color: "#4caf82" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Receitas</span>
          </div>
          <p className="font-bold" style={{ color: "#4caf82" }}>+{brl(totalReceitas)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} style={{ color: "var(--danger)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Despesas</span>
          </div>
          <p className="font-bold" style={{ color: "var(--danger)" }}>−{brl(totalDespesas)}</p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={abrirNovo}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Novo lançamento
        </button>
        <button onClick={() => setContrachequeAberto(true)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
          <FileText size={16} /> Contracheque
        </button>
      </div>

      {/* Filtros de tipo */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface2)" }}>
        {([["todos", "Todos"], ["receita", "Receitas"], ["despesa", "Despesas"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setAba(v)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: aba === v ? "var(--surface)" : "transparent",
              color: aba === v ? "var(--text)" : "var(--text-muted)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Campo de busca */}
      <div className="flex flex-col gap-1">
        <CampoBusca value={searchQuery} onChange={v => setSearchQuery(v)}
          placeholder="Buscar por descrição, categoria, data ou valor…" />
        {ql && (
          <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
            {filtrados.length} resultado(s)
            {filtrados.length > 0 ? ` · total ${brl(filtrados.reduce((s, l) => s + Number(l.valor), 0))}` : ""}
          </p>
        )}
      </div>

      {/* Lista de lançamentos */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            {ql ? `Nenhum resultado para "${searchQuery}".` : "Nenhum lançamento neste mês."}
          </p>
        ) : (
          filtrados.map(l => (
            <ItemLanc key={l.id} l={l} onEditar={abrirEditar} onDeletar={deletar} />
          ))
        )}
      </div>

      {/* Modais */}
      {modalAberto && (
        <ModalLanc
          workspaceId={workspaceId!}
          contas={contas}
          cartoes={cartoes}
          lancamento={lancamentoEd}
          fechar={() => setModalAberto(false)}
          onSalvo={carregar}
        />
      )}

      {contrachequeAberto && workspaceId && (
        <RegistrarContracheque
          workspaceId={workspaceId}
          fechar={() => setContrachequeAberto(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
