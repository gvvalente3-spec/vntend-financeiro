"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Upload, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, hojeISO, mesDoLanc, formatData, MESES, CATS_DEFAULT, type CatTree, type CatStore } from "@/lib/utils";
import ImportarFatura from "./ImportarFatura";
import RegistrarContracheque from "./RegistrarContracheque";
import type { Lancamento, Conta, Cartao } from "@/types/database";

// ——— Modal genérico ———
function Modal({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{titulo}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ——— Formulário de lançamento ———
function FormLancamento({
  fechar, inicial, workspaceId, contas, cartoes, cats, onSalvo, onUpdateConta,
}: {
  fechar: () => void;
  inicial?: Lancamento | null;
  workspaceId: string;
  contas: Conta[];
  cartoes: Cartao[];
  cats: CatStore;
  onSalvo: () => void;
  onUpdateConta?: (id: string, novoSaldo: number) => void;
}) {
  const modoEdicao = !!inicial;
  const [tipo, setTipo] = useState<"despesa" | "receita">(inicial?.tipo || "despesa");
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [descricao, setDescricao] = useState(inicial?.descricao || "");
  const [data, setData] = useState(inicial?.data || hojeISO());
  const [cat, setCat] = useState(inicial?.cat || "");
  const [sub, setSub] = useState(inicial?.sub || "");
  const [subsub, setSubsub] = useState(inicial?.subsub || "");
  const [fiscal, setFiscal] = useState<"" | "pgbl" | "saude" | "educacao">(inicial?.fiscal || "");
  const [origem, setOrigem] = useState(() => {
    if (inicial?.cartao_id) return `cartao:${inicial.cartao_id}`;
    if (inicial?.conta_id) return `conta:${inicial.conta_id}`;
    return "";
  });
  const [parcelado, setParcelado] = useState(false);
  const [nParcelas, setNParcelas] = useState(2);
  const [salvando, setSalvando] = useState(false);

  const arvore = cats[tipo] || {};
  const nivel1 = Object.keys(arvore);
  const nivel2 = cat ? Object.keys(arvore[cat] || {}) : [];
  const nivel3 = cat && sub ? ((arvore[cat]?.[sub] as string[]) || []) : [];

  const valorNum = Number(valor) || 0;
  const valorParcela = parcelado && nParcelas > 1 ? valorNum / nParcelas : valorNum;

  async function salvar() {
    if (!valor || !cat) return;
    setSalvando(true);
    const supabase = createClient();

    if (modoEdicao && inicial) {
      await supabase.from("lancamentos").update({
        tipo, valor: valorNum, descricao, data, cat,
        sub: sub || null, subsub: subsub || null, fiscal,
      }).eq("id", inicial.id);
      onSalvo();
      fechar();
      setSalvando(false);
      return;
    }

    const ehCartao = origem.startsWith("cartao:");
    const destId = origem.split(":")[1] || null;

    const lancs: Record<string, unknown>[] = [];
    const qtd = parcelado && nParcelas > 1 ? nParcelas : 1;
    for (let i = 0; i < qtd; i++) {
      const d = new Date(data + "T00:00:00");
      d.setMonth(d.getMonth() + i);
      const dataISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      lancs.push({
        workspace_id: workspaceId,
        tipo,
        valor: valorParcela,
        descricao: qtd > 1 ? `${descricao} (${i + 1}/${qtd})` : descricao,
        data: dataISO,
        cat,
        sub: sub || null,
        subsub: subsub || null,
        conta_id: ehCartao ? null : destId,
        cartao_id: ehCartao ? destId : null,
        pago: !ehCartao,
        fiscal: tipo === "despesa" ? fiscal : "",
        parcela_num: qtd > 1 ? i + 1 : null,
        parcela_total: qtd > 1 ? qtd : null,
      });
    }

    await supabase.from("lancamentos").insert(lancs);

    // Ajusta saldo da conta se vinculado — usa estado local (evita race condition com DB read)
    if (!ehCartao && destId) {
      const delta = tipo === "receita" ? valorNum : -valorNum;
      const contaLocal = contas.find(c => c.id === destId);
      const novoSaldo = Number(contaLocal?.saldo ?? 0) + delta;
      await supabase.from("contas").update({ saldo: novoSaldo } as Record<string, unknown>).eq("id", destId);
      onUpdateConta?.(destId, novoSaldo);
    }

    // Se PGBL, soma no investimento PGBL
    if (tipo === "despesa" && fiscal === "pgbl") {
      const { data: pgbl } = await supabase.from("investimentos")
        .select("id, valor").eq("workspace_id", workspaceId).eq("categoria", "pgbl").limit(1).single() as { data: { id: string; valor: number | null } | null };
      if (pgbl) {
        await supabase.from("investimentos").update({ valor: Number(pgbl.valor || 0) + valorNum } as Record<string, unknown>).eq("id", pgbl.id);
      }
    }

    onSalvo();
    fechar();
    setSalvando(false);
  }

  const inputStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
  };
  const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

  return (
    <Modal titulo={modoEdicao ? "Editar lançamento" : "Novo lançamento"} fechar={fechar}>
      {/* Tipo */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Tipo</span>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button onClick={() => { setTipo("despesa"); setCat(""); setSub(""); setSubsub(""); setFiscal(""); }}
            className="flex-1 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: tipo === "despesa" ? "var(--danger)" : "transparent", color: tipo === "despesa" ? "#fff" : "var(--text-muted)" }}>
            Despesa
          </button>
          <button onClick={() => { setTipo("receita"); setCat(""); setSub(""); setSubsub(""); setFiscal(""); }}
            className="flex-1 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: tipo === "receita" ? "#4caf82" : "transparent", color: tipo === "receita" ? "#fff" : "var(--text-muted)" }}>
            Receita
          </button>
        </div>
      </div>

      <label style={labelStyle}>
        Valor total
        <input type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Descrição
        <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: mercado do mês" style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Data
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} />
      </label>

      <label style={labelStyle}>
        Categoria
        <select value={cat} onChange={e => { setCat(e.target.value); setSub(""); setSubsub(""); }} style={inputStyle}>
          <option value="">Selecione…</option>
          {nivel1.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      {nivel2.length > 0 && (
        <label style={labelStyle}>
          Subcategoria
          <select value={sub} onChange={e => { setSub(e.target.value); setSubsub(""); }} style={inputStyle}>
            <option value="">—</option>
            {nivel2.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      {nivel3.length > 0 && (
        <label style={labelStyle}>
          Sub-subcategoria
          <select value={subsub} onChange={e => setSubsub(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {nivel3.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      {!modoEdicao && (
        <label style={labelStyle}>
          {tipo === "receita" ? "Destino" : "Pago com"}
          <select value={origem} onChange={e => setOrigem(e.target.value)} style={inputStyle}>
            <option value="">Não vincular (não mexe no saldo)</option>
            {contas.map(c => <option key={c.id} value={`conta:${c.id}`}>Conta · {c.nome}</option>)}
            {tipo === "despesa" && cartoes.map(c => <option key={c.id} value={`cartao:${c.id}`}>Cartão · {c.nome} (vai pra fatura)</option>)}
          </select>
        </label>
      )}

      {!modoEdicao && tipo === "despesa" && (
        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <input type="checkbox" checked={parcelado} onChange={e => setParcelado(e.target.checked)} />
          Compra parcelada
        </label>
      )}

      {parcelado && (
        <div className="flex gap-3">
          <label style={{ ...labelStyle, flex: 1 }}>
            Nº de parcelas
            <input type="number" min={2} max={60} value={nParcelas} onChange={e => setNParcelas(Number(e.target.value) || 2)} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Valor por parcela
            <input type="number" value={valorParcela.toFixed(2)} readOnly style={{ ...inputStyle, opacity: 0.6 }} />
          </label>
        </div>
      )}

      {parcelado && nParcelas > 1 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Serão criadas <b style={{ color: "var(--text)" }}>{nParcelas} despesas</b> de <b style={{ color: "var(--text)" }}>{brl(valorParcela)}</b> a partir de {formatData(data)}, uma por mês.
        </p>
      )}

      {tipo === "despesa" && (
        <label style={labelStyle}>
          Dedução de IR / destino fiscal
          <select value={fiscal} onChange={e => setFiscal(e.target.value as typeof fiscal)} style={inputStyle}>
            <option value="">Nenhum</option>
            <option value="pgbl">Aporte PGBL (deduz IR + vai pro fundo)</option>
            <option value="saude">Saúde (dedução de IR)</option>
            <option value="educacao">Educação (dedução de IR)</option>
          </select>
        </label>
      )}

      <button onClick={salvar} disabled={salvando || !valor || !cat}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : parcelado && nParcelas > 1 ? `Criar ${nParcelas} parcelas` : "Salvar lançamento"}
      </button>
    </Modal>
  );
}

// ——— Componente principal ———
export default function LancamentosClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [mes, setMes] = useState(mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<CatStore>(CATS_DEFAULT);
  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [impFatura, setImpFatura] = useState(false);
  const [regContra, setRegContra] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();

    const [{ data: lancs }, { data: cts }, { data: carts }, { data: catRows }] = await Promise.all([
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId).order("data", { ascending: false }),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("ordem"),
    ]);

    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);

    // Monta árvore de categorias (se tiver no banco, usa; senão usa default)
    if (catRows && catRows.length > 0) {
      const tree: { despesa: CatTree; receita: CatTree } = { despesa: {}, receita: {} };
      for (const r of catRows) {
        const tipo = r.tipo as "despesa" | "receita";
        if (!tree[tipo][r.cat]) tree[tipo][r.cat] = {};
        if (r.sub) {
          if (!tree[tipo][r.cat][r.sub]) tree[tipo][r.cat][r.sub] = [];
          if (r.subsub) (tree[tipo][r.cat][r.sub] as string[]).push(r.subsub);
        }
      }
      setCats(tree);
    }

    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function remover(id: string) {
    if (!confirm("Remover este lançamento?")) return;
    const supabase = createClient();
    await supabase.from("lancamentos").delete().eq("id", id);
    setLancamentos(l => l.filter(x => x.id !== id));
  }

  async function togglePago(lanc: Lancamento) {
    const supabase = createClient();
    await supabase.from("lancamentos").update({ pago: !lanc.pago }).eq("id", lanc.id);
    setLancamentos(l => l.map(x => x.id === lanc.id ? { ...x, pago: !x.pago } : x));
  }

  // Navegar entre meses
  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;
  const doMes = lancamentos.filter(l => mesDoLanc(l.data) === mes);
  const totalReceitas = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lançamentos</h2>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Botões de importação */}
      <div className="flex gap-2">
        <button onClick={() => setImpFatura(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <Upload size={14} /> Fatura CSV
        </button>
        <button onClick={() => setRegContra(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <FileText size={14} /> Contracheque PDF
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <span className="font-medium capitalize">{labelMes}</span>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Receitas</p>
          <p className="font-semibold" style={{ color: "#4caf82" }}>+{brl(totalReceitas)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Despesas</p>
          <p className="font-semibold" style={{ color: "var(--danger)" }}>−{brl(totalDespesas)}</p>
        </div>
      </div>

      {/* Lista */}
      {doMes.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum lançamento em {labelMes}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {doMes.map(l => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {/* Barra colorida lateral */}
              <div className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: l.tipo === "receita" ? "#4caf82" : "var(--danger)" }} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.descricao || (l.tipo === "receita" ? "Receita" : "Despesa")}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {l.cat}{l.sub ? ` › ${l.sub}` : ""}{l.subsub ? ` › ${l.subsub}` : ""}
                  {" · "}{formatData(l.data)}
                  {l.cartao_id ? " · cartão" : ""}
                  {l.fiscal ? ` · ${l.fiscal === "pgbl" ? "PGBL" : l.fiscal === "saude" ? "saúde" : "educação"}` : ""}
                  {l.parcela_num ? ` · ${l.parcela_num}/${l.parcela_total}` : ""}
                </p>
              </div>

              {/* Valor + status */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-semibold" style={{ color: l.tipo === "receita" ? "#4caf82" : "var(--danger)" }}>
                  {l.tipo === "receita" ? "+" : "−"}{brl(l.valor)}
                </span>
                {l.cartao_id && (
                  <button onClick={() => togglePago(l)}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: l.pago ? "var(--primary)" : "var(--surface2)", color: l.pago ? "#fff" : "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {l.pago ? "paga" : "em aberto"}
                  </button>
                )}
              </div>

              {/* Ações */}
              <button onClick={() => setEditando(l)} style={{ color: "var(--text-muted)" }}><Pencil size={14} /></button>
              <button onClick={() => remover(l.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {form && workspaceId && (
        <FormLancamento fechar={() => setForm(false)} workspaceId={workspaceId}
          contas={contas} cartoes={cartoes} cats={cats} onSalvo={carregar}
          onUpdateConta={(id, novoSaldo) => setContas(prev => prev.map(c => c.id === id ? { ...c, saldo: novoSaldo } : c))} />
      )}
      {editando && workspaceId && (
        <FormLancamento fechar={() => setEditando(null)} inicial={editando} workspaceId={workspaceId}
          contas={contas} cartoes={cartoes} cats={cats} onSalvo={carregar}
          onUpdateConta={(id, novoSaldo) => setContas(prev => prev.map(c => c.id === id ? { ...c, saldo: novoSaldo } : c))} />
      )}
      {impFatura && workspaceId && (
        <ImportarFatura workspaceId={workspaceId} cartoes={cartoes} lancamentos={lancamentos}
          cats={cats} fechar={() => setImpFatura(false)} onSalvo={carregar} />
      )}
      {regContra && workspaceId && (
        <RegistrarContracheque workspaceId={workspaceId} fechar={() => setRegContra(false)} onSalvo={carregar} />
      )}
    </div>
  );
}

