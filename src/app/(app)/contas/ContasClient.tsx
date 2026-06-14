"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, ChevronDown, Wallet, CreditCard, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, formatData, mesAtual, MESES, mesDoLanc } from "@/lib/utils";
import type { Conta, Cartao, Lancamento } from "@/types/database";

const inputStyle = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

// ——— Modal ———
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

// ——— Form Conta ———
function FormConta({ workspaceId, fechar, onSalvo, inicial }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void; inicial?: Conta;
}) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [tipo, setTipo] = useState<Conta["tipo"]>(inicial?.tipo || "corrente");
  const [saldo, setSaldo] = useState(inicial ? String(inicial.saldo) : "0");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const supabase = createClient();
    if (inicial) {
      await supabase.from("contas").update({ nome, tipo, saldo: Number(saldo) } as Record<string, unknown>).eq("id", inicial.id);
    } else {
      await supabase.from("contas").insert({ workspace_id: workspaceId, nome, tipo, saldo: Number(saldo) } as Record<string, unknown>);
    }
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <Modal titulo={inicial ? "Editar conta" : "Nova conta"} fechar={fechar}>
      <label style={labelStyle}>Nome<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Nubank" style={inputStyle} /></label>
      <label style={labelStyle}>
        Tipo
        <select value={tipo} onChange={e => setTipo(e.target.value as Conta["tipo"])} style={inputStyle}>
          <option value="corrente">Corrente</option>
          <option value="poupanca">Poupança</option>
          <option value="investimento">Investimento</option>
          <option value="outro">Outro</option>
        </select>
      </label>
      <label style={labelStyle}>Saldo atual (R$)<input type="number" value={saldo} onChange={e => setSaldo(e.target.value)} style={inputStyle} /></label>
      <button onClick={salvar} disabled={salvando || !nome}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Salvar conta"}
      </button>
    </Modal>
  );
}

// ——— Form Cartão ———
function FormCartao({ workspaceId, fechar, onSalvo, inicial }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void; inicial?: Cartao;
}) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [limite, setLimite] = useState(inicial ? String(inicial.limite) : "");
  const [venc, setVenc] = useState(inicial ? String(inicial.venc) : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const supabase = createClient();
    if (inicial) {
      await supabase.from("cartoes").update({ nome, limite: Number(limite), venc: Number(venc) } as Record<string, unknown>).eq("id", inicial.id);
    } else {
      await supabase.from("cartoes").insert({ workspace_id: workspaceId, nome, limite: Number(limite), venc: Number(venc) } as Record<string, unknown>);
    }
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <Modal titulo={inicial ? "Editar cartão" : "Novo cartão"} fechar={fechar}>
      <label style={labelStyle}>Nome<input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Itaú Visa" style={inputStyle} /></label>
      <label style={labelStyle}>Limite (R$)<input type="number" value={limite} onChange={e => setLimite(e.target.value)} placeholder="0,00" style={inputStyle} /></label>
      <label style={labelStyle}>Dia do vencimento<input type="number" min={1} max={31} value={venc} onChange={e => setVenc(e.target.value)} placeholder="10" style={inputStyle} /></label>
      <button onClick={salvar} disabled={salvando || !nome}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Salvar cartão"}
      </button>
    </Modal>
  );
}

// ——— Form Editar Item da Fatura ———
function FormEditarItem({ lanc, fechar, onSalvo }: {
  lanc: Lancamento; fechar: () => void; onSalvo: () => void;
}) {
  const [descricao, setDescricao] = useState(lanc.descricao || "");
  const [valor, setValor] = useState(String(lanc.valor));
  const [data, setData] = useState(lanc.data);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    await createClient().from("lancamentos").update({
      descricao, valor: Number(valor), data,
    } as Record<string, unknown>).eq("id", lanc.id);
    onSalvo(); fechar(); setSalvando(false);
  }

  return (
    <Modal titulo="Editar item da fatura" fechar={fechar}>
      <label style={labelStyle}>Descrição<input value={descricao} onChange={e => setDescricao(e.target.value)} style={inputStyle} /></label>
      <label style={labelStyle}>Valor (R$)<input type="number" value={valor} onChange={e => setValor(e.target.value)} style={inputStyle} /></label>
      <label style={labelStyle}>Data<input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} /></label>
      <button onClick={salvar} disabled={salvando}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </Modal>
  );
}

// ——— Componente principal ———
export default function ContasClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(mesAtual());
  const [cartaoAberto, setCartaoAberto] = useState<string | null>(null);
  const [formConta, setFormConta] = useState(false);
  const [formCartao, setFormCartao] = useState(false);
  const [editConta, setEditConta] = useState<Conta | null>(null);
  const [editCartao, setEditCartao] = useState<Cartao | null>(null);
  const [editItem, setEditItem] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: cts }, { data: carts }, { data: lancs }] = await Promise.all([
      supabase.from("contas").select("*").eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId).order("created_at"),
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId)
        .not("cartao_id", "is", null).order("data", { ascending: false }),
    ]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function delConta(id: string) {
    if (!confirm("Remover esta conta?")) return;
    await createClient().from("contas").delete().eq("id", id);
    setContas(c => c.filter(x => x.id !== id));
  }

  async function delCartao(id: string) {
    if (!confirm("Remover este cartão?")) return;
    await createClient().from("cartoes").delete().eq("id", id);
    setCartoes(c => c.filter(x => x.id !== id));
  }

  async function delItem(id: string) {
    if (!confirm("Remover este item da fatura?")) return;
    await createClient().from("lancamentos").delete().eq("id", id);
    setLancamentos(l => l.filter(x => x.id !== id));
  }

  async function toggleFatura(cartaoId: string, pagar: boolean) {
    const supabase = createClient();
    const ids = lancamentos
      .filter(l => l.cartao_id === cartaoId && mesDoLanc(l.data) === mes && l.pago !== pagar)
      .map(l => l.id);
    if (!ids.length) return;
    await supabase.from("lancamentos").update({ pago: pagar } as Record<string, unknown>).in("id", ids);
    setLancamentos(prev => prev.map(l => ids.includes(l.id) ? { ...l, pago: pagar } : l));
  }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;
  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo), 0);

  const itensMes = (cartaoId: string) =>
    lancamentos.filter(l => l.cartao_id === cartaoId && mesDoLanc(l.data) === mes)
      .sort((a, b) => a.data < b.data ? 1 : -1);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* ——— CONTAS ——— */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Contas</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Saldo total: <span style={{ color: saldoTotal >= 0 ? "#4caf82" : "var(--danger)" }}>{brl(saldoTotal)}</span>
          </p>
        </div>
        <button onClick={() => setFormConta(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Conta
        </button>
      </div>

      {contas.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Cadastre suas contas para acompanhar o saldo.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contas.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface2)" }}>
                <Wallet size={18} style={{ color: "var(--primary-light)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.nome}</p>
                <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{c.tipo}</p>
              </div>
              <span className="text-sm font-semibold" style={{ color: Number(c.saldo) < 0 ? "var(--danger)" : "#4caf82" }}>
                {brl(c.saldo)}
              </span>
              <button onClick={() => setEditConta(c)} style={{ color: "var(--text-muted)" }}><Pencil size={14} /></button>
              <button onClick={() => delConta(c.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ——— CARTÕES ——— */}
      <div className="flex items-center justify-between mt-2">
        <h2 className="text-lg font-semibold">Cartões</h2>
        <button onClick={() => setFormCartao(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Cartão
        </button>
      </div>

      {/* Seletor de mês das faturas */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-sm font-medium capitalize">{labelMes}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>faturas do mês</p>
        </div>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {cartoes.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Cadastre seus cartões para somar as faturas abertas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cartoes.map(c => {
            const itens = itensMes(c.id);
            const fatura = itens.reduce((s, l) => s + Number(l.valor), 0);
            const todaoPaga = itens.length > 0 && itens.every(l => l.pago);
            const algumAberto = itens.some(l => !l.pago);
            const aberto = cartaoAberto === c.id;

            return (
              <div key={c.id} className="rounded-xl overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setCartaoAberto(a => a === c.id ? null : c.id)}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface2)" }}>
                    <CreditCard size={18} style={{ color: "var(--warning)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      vence dia {c.venc || "—"} · limite {brl(c.limite)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {todaoPaga && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: "rgba(42,138,114,0.15)", color: "var(--primary)" }}>
                        <Check size={11} /> paga
                      </span>
                    )}
                    <span className="text-sm font-semibold"
                      style={{ color: fatura > 0 ? (todaoPaga ? "var(--text-muted)" : "var(--danger)") : "var(--text-muted)" }}>
                      {fatura > 0 ? `${todaoPaga ? "" : "−"}${brl(fatura)}` : brl(0)}
                    </span>
                    <ChevronDown size={16} style={{ color: "var(--text-muted)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditCartao(c); }} style={{ color: "var(--text-muted)" }}><Pencil size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); delCartao(c.id); }} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
                </div>

                {aberto && (
                  <div className="border-t px-4 pb-3 pt-2 flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {itens.length} item(s) · {labelMes}
                        {todaoPaga && <span style={{ color: "var(--primary)" }}> · fatura paga ✓</span>}
                      </p>
                      {algumAberto && fatura > 0 && (
                        <button onClick={() => toggleFatura(c.id, true)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ background: "var(--primary)", color: "#fff" }}>
                          <Check size={12} /> Pagar fatura
                        </button>
                      )}
                      {todaoPaga && (
                        <button onClick={() => toggleFatura(c.id, false)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                          <X size={12} /> Desmarcar
                        </button>
                      )}
                    </div>

                    {itens.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Sem lançamentos neste mês.</p>
                    ) : itens.map(l => (
                      <div key={l.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: l.pago ? "rgba(42,138,114,0.07)" : "var(--surface2)", border: `1px solid ${l.pago ? "rgba(42,138,114,0.2)" : "var(--border)"}` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ textDecoration: l.pago ? "line-through" : "none", color: l.pago ? "var(--text-muted)" : "var(--text)" }}>
                            {l.descricao || "Despesa"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}
                            {l.pago && " · pago"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold flex-shrink-0"
                          style={{ color: l.pago ? "var(--text-muted)" : "var(--danger)" }}>
                          −{brl(l.valor)}
                        </span>
                        <button onClick={() => setEditItem(l)} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
                        <button onClick={() => delItem(l.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
                      </div>
                    ))}

                    {itens.length > 0 && (
                      <div className="flex justify-between pt-1 border-t text-sm font-semibold"
                        style={{ borderColor: "var(--border)" }}>
                        <span>Total</span>
                        <span style={{ color: todaoPaga ? "var(--text-muted)" : "var(--danger)" }}>
                          −{brl(fatura)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {formConta && workspaceId && <FormConta workspaceId={workspaceId} fechar={() => setFormConta(false)} onSalvo={carregar} />}
      {editConta && workspaceId && <FormConta workspaceId={workspaceId} fechar={() => setEditConta(null)} onSalvo={carregar} inicial={editConta} />}
      {formCartao && workspaceId && <FormCartao workspaceId={workspaceId} fechar={() => setFormCartao(false)} onSalvo={carregar} />}
      {editCartao && workspaceId && <FormCartao workspaceId={workspaceId} fechar={() => setEditCartao(null)} onSalvo={carregar} inicial={editCartao} />}
      {editItem && <FormEditarItem lanc={editItem} fechar={() => setEditItem(null)} onSalvo={carregar} />}
    </div>
  );
}
