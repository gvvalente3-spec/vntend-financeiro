"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, X, TrendingUp, TrendingDown,
  FileText, ChevronLeft, ChevronRight, Pencil, Trash2, Upload
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, mesDoLanc, formatData, MESES } from "@/lib/utils";
import type { Lancamento, Conta, Cartao } from "@/types/database";
import { iconeDaCategoria, corDaCategoria, type CatMeta } from "@/components/layout/categoryIcons";
import RegistrarContracheque from "./RegistrarContracheque";
import ImportarFatura from "./ImportarFatura";

// Tipo da árvore de categorias (tabela "categorias")
interface CategoriaRow {
  id: string; tipo: "despesa" | "receita";
  cat: string; sub: string | null; subsub: string | null; ordem: number;
}

// —— InputValor: centavos automáticos (29550 → 295,50) ——
function fmtCts(digits: string): string {
  const n = parseInt(digits || "0", 10);
  if (!digits) return "";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function InputValor({ value, onChange, style, autoFocus }: {
  value: string; onChange: (d: string) => void;
  style?: React.CSSProperties; autoFocus?: boolean;
}) {
  return (
    <input
      type="text" inputMode="numeric" autoFocus={autoFocus}
      value={fmtCts(value)}
      onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
      placeholder="0,00" style={style}
    />
  );
}

function matchSearch(l: Lancamento, ql: string): boolean {
  if (!ql) return true;
  if ((l.descricao || "").toLowerCase().includes(ql)) return true;
  if ((l.cat || "").toLowerCase().includes(ql)) return true;
  if ((l.sub || "").toLowerCase().includes(ql)) return true;
  if (formatData(l.data).includes(ql)) return true;
  const isNum = /^[\d,\.]+$/.test(ql);
  if (isNum) {
    const qd = ql.replace(/\D/g, "");
    if (qd.length >= 2 && brl(Number(l.valor)).replace(/\D/g, "").startsWith(qd)) return true;
  }
  return false;
}

// —— Campo de busca ——
function CampoBusca({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl text-sm outline-none"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 36px" }} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X size={13} style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}

// —— Item de lançamento (com ícone da categoria) ——
function ItemLanc({ l, catMeta, onEditar, onDeletar }: {
  l: Lancamento; catMeta: CatMeta[];
  onEditar: (l: Lancamento) => void; onDeletar: (id: string) => void;
}) {
  const isRec = l.tipo === "receita";
  const Icone = iconeDaCategoria(l.cat, catMeta, l.tipo);
  const cor = isRec ? "#4caf82" : corDaCategoria(l.cat, catMeta, l.tipo);
  
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      {/* Ícone da categoria */}
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${cor}1a`, color: cor }}>
        <Icone size={17} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{l.descricao || (isRec ? "Receita" : "Despesa")}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}
          {l.cartao_id && !l.pago ? " · em aberto" : ""}
        </p>
      </div>
      <span className="text-sm font-semibold flex-shrink-0 mr-1" style={{ color: isRec ? "#4caf82" : "var(--danger)" }}>
        {isRec ? "+" : "−"}{brl(Number(l.valor))}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onEditar(l)} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
        <button onClick={() => onDeletar(l.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" };

// —— Modal de lançamento ——
function ModalLanc({ workspaceId, contas, cartoes, categorias, lancamento, fechar, onSalvo }: {
  workspaceId: string;
  contas: Conta[]; cartoes: Cartao[]; categorias: CategoriaRow[];
  lancamento?: Lancamento | null;
  fechar: () => void; onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<"receita" | "despesa">(lancamento?.tipo || "despesa");
  const [valorCts, setValorCts] = useState(lancamento ? String(Math.round(Number(lancamento.valor) * 100)) : "");
  const [descricao, setDescricao] = useState(lancamento?.descricao || "");
  const [data, setData] = useState(lancamento?.data || new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState(lancamento?.cat || "");
  const [sub, setSub] = useState(lancamento?.sub || "");
  const [contaId, setContaId] = useState(lancamento?.conta_id || "");
  const [cartaoId, setCartaoId] = useState(lancamento?.cartao_id || "");
  const [pago, setPago] = useState(lancamento?.pago ?? true);
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseInt(valorCts || "0", 10) / 100;

  // Categorias filtradas pelo tipo selecionado
  const catsDoTipo = categorias.filter(c => c.tipo === tipo);
  // Categorias de nível 1 (cat distintas)
  const cats1 = [...new Set(catsDoTipo.map(c => c.cat))].sort();
  // Subcategorias da categoria escolhida
  const subs = cat
    ? [...new Set(catsDoTipo.filter(c => c.cat === cat && c.sub).map(c => c.sub as string))].sort()
    : [];

  async function salvar() {
    if (!valorCts || !data || !cat) return;
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      workspace_id: workspaceId, tipo, valor: valorNum,
      descricao: descricao || null, data,
      cat, sub: sub || null, subsub: null,
      conta_id: contaId || null,
      cartao_id: tipo === "despesa" ? (cartaoId || null) : null,
      pago, fiscal: "", rec_id: null, parcela_num: null, parcela_total: null,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          maxHeight: "80vh",
          height: "auto",
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header fixo */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">{lancamento ? "Editar lançamento" : "Novo lançamento"}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* Campos roláveis */}
        <div className="overflow-y-auto p-4 flex flex-col gap-3" style={{ minHeight: 0, flex: "1 1 auto" }}>
          <div className="grid grid-cols-2 gap-2">
            {(["receita", "despesa"] as const).map(t => (
              <button key={t} onClick={() => { setTipo(t); setCat(""); setSub(""); }}
                className="py-2 rounded-xl text-sm font-medium"
                style={{
                  background: tipo === t ? (t === "receita" ? "#4caf82" : "var(--danger)") : "var(--surface2)",
                  color: tipo === t ? "#fff" : "var(--text-muted)", border: "1px solid var(--border)",
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

          {/* Categoria via SELECT carregado da tabela */}
          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>
              Categoria
              <select value={cat} onChange={e => { setCat(e.target.value); setSub(""); }} style={inp}>
                <option value="">Selecione…</option>
                {cats1.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={lbl}>
              Subcategoria
              <select value={sub} onChange={e => setSub(e.target.value)} style={inp} disabled={subs.length === 0}>
                <option value="">{subs.length === 0 ? "—" : "Opcional"}</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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

        {/* Botão fixo */}
        <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando || !valorCts || !data || !cat}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando ? "Salvando…" : !cat ? "Escolha uma categoria" : lancamento ? "Salvar alterações" : "Registrar"}
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
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [catMeta, setCatMeta] = useState<CatMeta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEd, setLancamentoEd] = useState<Lancamento | null>(null);
  const [contrachequeAberto, setContrachequeAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false); // Adicionado controle do modal
  const [searchQuery, setSearchQuery] = useState("");
  const [aba, setAba] = useState<"todos" | "receita" | "despesa">("todos");

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: lancs }, { data: cts }, { data: carts }, { data: cat }, { data: cm }] = await Promise.all([
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId).order("data", { ascending: false }),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("ordem"),
      supabase.from("cat_meta").select("*").eq("workspace_id", workspaceId),
    ]);
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);
    setCategorias((cat || []) as unknown as CategoriaRow[]);
    setCatMeta((cm || []) as unknown as CatMeta[]);
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
  const filtrados = doMes.filter(l => aba === "todos" || l.tipo === aba).filter(l => matchSearch(l, ql));

  const totalReceitas = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);

  // Constrói o objeto de categorias exigido pelo ImportarFatura
  const catsObj = { receita: {} as Record<string, string[]>, despesa: {} as Record<string, string[]> };
  categorias.forEach(c => {
    if (c.tipo === "receita" || c.tipo === "despesa") {
      if (!catsObj[c.tipo][c.cat]) catsObj[c.tipo][c.cat] = [];
      if (c.sub && !catsObj[c.tipo][c.cat].includes(c.sub)) {
        catsObj[c.tipo][c.cat].push(c.sub);
      }
    }
  });

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

      {/* Resumo */}
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

      {/* Ações Atualizadas */}
      <div className="flex flex-col gap-2">
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
        <button onClick={() => setImportarAberto(true)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium w-full"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
          <Upload size={16} /> Importar Fatura CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface2)" }}>
        {([["todos", "Todos"], ["receita", "Receitas"], ["despesa", "Despesas"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setAba(v)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: aba === v ? "var(--surface)" : "transparent", color: aba === v ? "var(--text)" : "var(--text-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="flex flex-col gap-1">
        <CampoBusca value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por descrição, categoria, data ou valor…" />
        {ql && (
          <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
            {filtrados.length} resultado(s)
            {filtrados.length > 0 ? ` · total ${brl(filtrados.reduce((s, l) => s + Number(l.valor), 0))}` : ""}
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            {ql ? `Nenhum resultado para "${searchQuery}".` : "Nenhum lançamento neste mês."}
          </p>
        ) : (
          filtrados.map(l => (
            <ItemLanc key={l.id} l={l} catMeta={catMeta} onEditar={abrirEditar} onDeletar={deletar} />
          ))
        )}
      </div>

      {/* Modais */}
      {modalAberto && (
        <ModalLanc
          workspaceId={workspaceId!}
          contas={contas} cartoes={cartoes} categorias={categorias}
          lancamento={lancamentoEd}
          fechar={() => setModalAberto(false)}
          onSalvo={carregar}
        />
      )}
      {contrachequeAberto && workspaceId && (
        <RegistrarContracheque workspaceId={workspaceId} fechar={() => setContrachequeAberto(false)} onSalvo={carregar} />
      )}
      {importarAberto && workspaceId && (
        <ImportarFatura
          workspaceId={workspaceId}
          cartoes={cartoes}
          lancamentos={lancamentos}
          cats={catsObj}
          fechar={() => setImportarAberto(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
