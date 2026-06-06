"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, MESES, CATS_DEFAULT, type CatStore } from "@/lib/utils";
import type { Recorrencia, Conta, Cartao } from "@/types/database";

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

const inputStyle = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

function FormRecorrencia({ workspaceId, fechar, onSalvo, inicial, contas, cartoes, cats }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void;
  inicial?: Recorrencia; contas: Conta[]; cartoes: Cartao[]; cats: CatStore;
}) {
  const modoEdicao = !!inicial;
  const [tipo, setTipo] = useState<"despesa" | "receita">(inicial?.tipo || "despesa");
  const [descricao, setDescricao] = useState(inicial?.descricao || "");
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : "");
  const [cat, setCat] = useState(inicial?.cat || "");
  const [origem, setOrigem] = useState(() => {
    if (inicial?.cartao_id) return `cartao:${inicial.cartao_id}`;
    if (inicial?.conta_id) return `conta:${inicial.conta_id}`;
    return "";
  });
  const [salvando, setSalvando] = useState(false);

  const nivel1 = Object.keys(cats[tipo] || {});

  async function salvar() {
    if (!descricao || !valor) return;
    setSalvando(true);
    const ehCartao = origem.startsWith("cartao:");
    const origemId = origem.split(":")[1] || null;
    const supabase = createClient();

    const payload = {
      tipo, descricao, valor: Number(valor), dia: Number(dia) || 1, cat,
      sub: null, subsub: null,
      conta_id: ehCartao ? null : origemId,
      cartao_id: ehCartao ? origemId : null,
    };

    if (modoEdicao && inicial) {
      await supabase.from("recorrencias").update(payload as Record<string, unknown>).eq("id", inicial.id);
    } else {
      await supabase.from("recorrencias").insert({ workspace_id: workspaceId, ...payload, postados: [] } as Record<string, unknown>);
    }
    onSalvo();
    fechar();
    setSalvando(false);
  }

  return (
    <Modal titulo={modoEdicao ? "Editar recorrência" : "Nova recorrência"} fechar={fechar}>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Tipo</span>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button onClick={() => { setTipo("despesa"); setCat(""); }}
            className="flex-1 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: tipo === "despesa" ? "var(--danger)" : "transparent", color: tipo === "despesa" ? "#fff" : "var(--text-muted)" }}>
            Despesa
          </button>
          <button onClick={() => { setTipo("receita"); setCat(""); }}
            className="flex-1 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: tipo === "receita" ? "#4caf82" : "transparent", color: tipo === "receita" ? "#fff" : "var(--text-muted)" }}>
            Receita
          </button>
        </div>
      </div>

      <label style={labelStyle}>Descrição<input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Internet, Netflix…" style={inputStyle} /></label>

      <div className="flex gap-3">
        <label style={{ ...labelStyle, flex: 2 }}>Valor (R$)<input type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inputStyle} /></label>
        <label style={{ ...labelStyle, flex: 1 }}>Dia do mês<input type="number" min={1} max={31} value={dia} onChange={e => setDia(e.target.value)} placeholder="5" style={inputStyle} /></label>
      </div>

      <label style={labelStyle}>
        Categoria
        <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
          <option value="">Selecione…</option>
          {nivel1.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label style={labelStyle}>
        {tipo === "receita" ? "Destino" : "Pago com"}
        <select value={origem} onChange={e => setOrigem(e.target.value)} style={inputStyle}>
          <option value="">Sem vínculo</option>
          {contas.map(c => <option key={c.id} value={`conta:${c.id}`}>Conta · {c.nome}</option>)}
          {tipo === "despesa" && cartoes.map(c => <option key={c.id} value={`cartao:${c.id}`}>Cartão · {c.nome}</option>)}
        </select>
      </label>

      <button onClick={salvar} disabled={salvando || !descricao || !valor}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : modoEdicao ? "Salvar alterações" : "Criar recorrência"}
      </button>
    </Modal>
  );
}

export default function RecorrenciasClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [mes, setMes] = useState(mesAtual());
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [cats, setCats] = useState<CatStore>(CATS_DEFAULT);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: recs }, { data: cts }, { data: carts }, { data: catRows }] = await Promise.all([
      supabase.from("recorrencias").select("*").eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("ordem"),
    ]);
    setRecorrencias((recs || []) as unknown as Recorrencia[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);

    // Monta árvore de categorias do banco
    if (catRows && catRows.length > 0) {
      const tree: CatStore = { despesa: {}, receita: {} };
      for (const r of catRows as Array<{ tipo: string; cat: string; sub: string | null; subsub: string | null }>) {
        const t = r.tipo as "despesa" | "receita";
        if (!tree[t][r.cat]) tree[t][r.cat] = {};
        if (r.sub) {
          if (!tree[t][r.cat][r.sub]) tree[t][r.cat][r.sub] = [];
          if (r.subsub) (tree[t][r.cat][r.sub] as string[]).push(r.subsub);
        }
      }
      setCats(tree);
    }

    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function toggleLancar(r: Recorrencia) {
    const postados: string[] = Array.isArray(r.postados) ? r.postados : [];
    const jaLancado = postados.includes(mes);
    const supabase = createClient();

    if (jaLancado) {
      await supabase.from("lancamentos").delete().eq("rec_id", r.id).like("data", `${mes}%`);
      const novosPostados = postados.filter(m => m !== mes);
      await supabase.from("recorrencias").update({ postados: novosPostados } as Record<string, unknown>).eq("id", r.id);
    } else {
      const data = `${mes}-${String(r.dia || 1).padStart(2, "0")}`;
      const ehCartao = !!r.cartao_id;
      await supabase.from("lancamentos").insert({
        workspace_id: workspaceId,
        tipo: r.tipo, valor: Number(r.valor), descricao: r.descricao,
        data, cat: r.cat, sub: r.sub, subsub: r.subsub,
        conta_id: r.conta_id, cartao_id: r.cartao_id,
        pago: !ehCartao, rec_id: r.id, fiscal: "",
        parcela_num: null, parcela_total: null,
      } as Record<string, unknown>);

      if (!ehCartao && r.conta_id) {
        const delta = r.tipo === "receita" ? Number(r.valor) : -Number(r.valor);
        const contaLocal = contas.find(c => c.id === r.conta_id);
        const novoSaldo = Number(contaLocal?.saldo ?? 0) + delta;
        await supabase.from("contas").update({ saldo: novoSaldo } as Record<string, unknown>).eq("id", r.conta_id);
      }

      const novosPostados = [...postados, mes];
      await supabase.from("recorrencias").update({ postados: novosPostados } as Record<string, unknown>).eq("id", r.id);
    }

    carregar();
  }

  async function del(id: string) {
    if (!confirm("Remover esta recorrência?")) return;
    await createClient().from("recorrencias").delete().eq("id", id);
    setRecorrencias(r => r.filter(x => x.id !== id));
  }

  function labelDestino(r: Recorrencia) {
    if (r.cartao_id) {
      const c = cartoes.find(x => x.id === r.cartao_id);
      return c ? `Cartão · ${c.nome}` : "Cartão";
    }
    if (r.conta_id) {
      const c = contas.find(x => x.id === r.conta_id);
      return c ? `Conta · ${c.nome}` : "Conta";
    }
    return "Sem vínculo";
  }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;
  const totalDespesas = recorrencias.filter(r => r.tipo === "despesa").reduce((s, r) => s + Number(r.valor), 0);
  const totalReceitas = recorrencias.filter(r => r.tipo === "receita").reduce((s, r) => s + Number(r.valor), 0);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recorrências</h2>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Nova
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="font-medium capitalize">{labelMes}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>mês de lançamento</p>
        </div>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Fixas / mês</p>
          <p className="font-semibold" style={{ color: "var(--danger)" }}>−{brl(totalDespesas)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Receitas fixas</p>
          <p className="font-semibold" style={{ color: "#4caf82" }}>+{brl(totalReceitas)}</p>
        </div>
      </div>

      {/* Lista */}
      {recorrencias.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
          Cadastre contas fixas e lance com um toque a cada mês.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {recorrencias.map(r => {
            const postados: string[] = Array.isArray(r.postados) ? r.postados : [];
            const lancado = postados.includes(mes);
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{ background: r.tipo === "receita" ? "#4caf82" : "var(--danger)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.descricao}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {r.cat ? `${r.cat} · ` : ""}dia {r.dia} · {labelDestino(r)}
                  </p>
                </div>
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: r.tipo === "receita" ? "#4caf82" : "var(--danger)" }}>
                  {r.tipo === "receita" ? "+" : "−"}{brl(r.valor)}
                </span>
                <button onClick={() => toggleLancar(r)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors"
                  style={{
                    background: lancado ? "var(--primary)" : "var(--surface2)",
                    color: lancado ? "#fff" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}>
                  {lancado && <Check size={12} />}
                  {lancado ? "lançado" : "lançar"}
                </button>
                <button onClick={() => setEditando(r)} style={{ color: "var(--text-muted)" }}><Pencil size={14} /></button>
                <button onClick={() => del(r.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {form && workspaceId && (
        <FormRecorrencia workspaceId={workspaceId} fechar={() => setForm(false)} onSalvo={carregar}
          contas={contas} cartoes={cartoes} cats={cats} />
      )}
      {editando && workspaceId && (
        <FormRecorrencia workspaceId={workspaceId} fechar={() => setEditando(null)} onSalvo={carregar}
          inicial={editando} contas={contas} cartoes={cartoes} cats={cats} />
      )}
    </div>
  );
}
