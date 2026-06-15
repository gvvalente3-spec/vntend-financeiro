"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, mesAtual, MESES } from "@/lib/utils";
import type { Contracheque } from "@/types/database";

const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

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
      onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 12); onChange(d); }}
      placeholder={placeholder ?? "0,00"}
      style={style}
    />
  );
}

function numToCts(v: number | null | undefined): string {
  if (!v) return "";
  return String(Math.round(v * 100));
}
function ctsToNum(d: string): number {
  return parseInt(d || "0", 10) / 100;
}
function nomeMes(mes: string) {
  const [ano, mm] = mes.split("-").map(Number);
  return `${MESES[mm - 1]}/${ano}`;
}

// —— Componente principal (modal) ——
export default function RegistrarContracheque({ workspaceId, fechar, onSalvo }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void;
}) {
  const [lista, setLista] = useState<Contracheque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Contracheque | "novo" | null>(null);

  // Estados do formulário (aqui no modal para controlar o layout)
  const cc = editando !== null && editando !== "novo" ? editando : null;
  const [mes, setMes] = useState(cc?.mes || mesAtual());
  const [tributavel, setTributavel] = useState(numToCts(cc?.tributavel));
  const [fusex, setFusex] = useState(numToCts(cc?.fusex));
  const [pensao, setPensao] = useState(numToCts(cc?.pensao));
  const [despesaMedica, setDespesaMedica] = useState(numToCts(cc?.despesa_medica));
  const [outrosDescontos, setOutrosDescontos] = useState(numToCts(cc?.outros_descontos));
  const [receitasIsentas, setReceitasIsentas] = useState(numToCts(cc?.receitas_isentas));
  const [irRetido, setIrRetido] = useState(numToCts(cc?.ir_retido));
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setMes(mesAtual()); setTributavel(""); setFusex(""); setPensao("");
    setDespesaMedica(""); setOutrosDescontos(""); setReceitasIsentas(""); setIrRetido("");
    setEditando("novo");
  }

  function abrirEditar(item: Contracheque) {
    setMes(item.mes);
    setTributavel(numToCts(item.tributavel));
    setFusex(numToCts(item.fusex));
    setPensao(numToCts(item.pensao));
    setDespesaMedica(numToCts(item.despesa_medica));
    setOutrosDescontos(numToCts(item.outros_descontos));
    setReceitasIsentas(numToCts(item.receitas_isentas));
    setIrRetido(numToCts(item.ir_retido));
    setEditando(item);
  }

  const tributavelNum = ctsToNum(tributavel);
  const fusexNum = ctsToNum(fusex);
  const pensaoNum = ctsToNum(pensao);
  const despesaMedicaNum = ctsToNum(despesaMedica);
  const outrosDescontosNum = ctsToNum(outrosDescontos);
  const receitasIsentasNum = ctsToNum(receitasIsentas);
  const irRetidoNum = ctsToNum(irRetido);
  const previdencia = fusexNum + pensaoNum;
  const liquido = tributavelNum + receitasIsentasNum - previdencia - despesaMedicaNum - outrosDescontosNum - irRetidoNum;

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    const { data } = await createClient()
      .from("contracheques").select("*")
      .eq("workspace_id", workspaceId)
      .order("mes", { ascending: false });
    setLista((data || []) as unknown as Contracheque[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  async function salvar() {
    if (!mes || !tributavel) return;
    setSalvando(true);
    const payload = {
      workspace_id: workspaceId, mes,
      tributavel: tributavelNum,
      previdencia: previdencia || (cc ? Number(cc.previdencia) : 0),
      fusex: fusexNum || null, pensao: pensaoNum || null,
      despesa_medica: despesaMedicaNum, outros_descontos: outrosDescontosNum,
      receitas_isentas: receitasIsentasNum, ir_retido: irRetidoNum, arquivo: null,
    } as Record<string, unknown>;
    const supabase = createClient();
    if (cc?.id) {
      await supabase.from("contracheques").update(payload).eq("id", cc.id);
    } else {
      await supabase.from("contracheques").upsert(payload, { onConflict: "workspace_id,mes" });
    }
    await carregarLista();
    onSalvo();
    setEditando(null);
    setSalvando(false);
  }

  async function deletar(id: string) {
    if (!confirm("Remover este contracheque?")) return;
    await createClient().from("contracheques").delete().eq("id", id);
    setLista(l => l.filter(x => x.id !== id));
    onSalvo();
  }

  const modoForm = editando !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "92vh" }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header fixo ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}>
          {modoForm ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditando(null)} style={{ color: "var(--text-muted)" }}>
                <ChevronLeft size={20} />
              </button>
              <h3 className="font-semibold">
                {editando === "novo" ? "Novo contracheque" : `Editar — ${nomeMes(cc!.mes)}`}
              </h3>
            </div>
          ) : (
            <h3 className="font-semibold">Contracheques registrados</h3>
          )}
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {/* ── Conteúdo rolável ── */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">

          {modoForm ? (
            // ── MODO FORMULÁRIO ──
            <>
              <label style={lbl}>
                Mês de referência
                <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={inp} disabled={!!cc} />
              </label>

              {/* Receitas */}
              <div className="rounded-xl p-3 flex flex-col gap-2.5"
                style={{ background: "rgba(42,138,114,0.06)", border: "1px solid rgba(42,138,114,0.2)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>
                  Receitas do contracheque
                </p>
                <label style={lbl}>
                  Rendimento tributável (R$)
                  <InputValor value={tributavel} onChange={setTributavel} style={inp} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Base de cálculo do IR — campo "Rendimento Tributável" do CPEx
                  </span>
                </label>
                <label style={lbl}>
                  Receitas isentas (R$) — aux. fardamento, diárias…
                  <InputValor value={receitasIsentas} onChange={setReceitasIsentas} style={inp} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Não entram na base do IR mas compõem o líquido
                  </span>
                </label>
              </div>

              {/* Descontos */}
              <div className="rounded-xl p-3 flex flex-col gap-2.5"
                style={{ background: "rgba(192,73,47,0.05)", border: "1px solid rgba(192,73,47,0.15)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--danger)" }}>
                  Descontos do contracheque
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label style={lbl}>FuSEx (R$)
                    <InputValor value={fusex} onChange={setFusex} style={inp} />
                  </label>
                  <label style={lbl}>Pensão Militar (R$)
                    <InputValor value={pensao} onChange={setPensao} style={inp} />
                  </label>
                </div>
                {previdencia > 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Previdência total: <b style={{ color: "var(--text)" }}>{brl(previdencia)}</b> (dedutível do IR)
                  </p>
                )}
                <label style={lbl}>
                  Despesa Médica FuSEx (R$) — ND0013
                  <InputValor value={despesaMedica} onChange={setDespesaMedica} style={inp} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Não incide IR, só reduz o líquido</span>
                </label>
                <label style={lbl}>
                  Outros descontos (R$) — FHE, empréstimos, FPHMMLO…
                  <InputValor value={outrosDescontos} onChange={setOutrosDescontos} style={inp} />
                </label>
                <label style={lbl}>
                  Imposto de Renda retido (R$)
                  <InputValor value={irRetido} onChange={setIrRetido} style={inp} />
                </label>
              </div>

              {/* Preview líquido */}
              {tributavel && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Líquido calculado</p>
                    <p className="text-lg font-bold" style={{ color: liquido >= 0 ? "#4caf82" : "var(--danger)" }}>
                      {brl(liquido)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {[
                      { label: "Trib.", v: tributavelNum, cor: "#4caf82" },
                      ...(receitasIsentasNum > 0 ? [{ label: "+ Isentas", v: receitasIsentasNum, cor: "#4caf82" }] : []),
                      ...(previdencia > 0 ? [{ label: "− Prev.", v: previdencia, cor: "var(--danger)" }] : []),
                      ...(despesaMedicaNum > 0 ? [{ label: "− D.Med.", v: despesaMedicaNum, cor: "var(--danger)" }] : []),
                      ...(outrosDescontosNum > 0 ? [{ label: "− Outros", v: outrosDescontosNum, cor: "var(--danger)" }] : []),
                      ...(irRetidoNum > 0 ? [{ label: "− IR", v: irRetidoNum, cor: "var(--danger)" }] : []),
                    ].map(({ label, v, cor }) => (
                      <span key={label} className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {label} <span style={{ color: cor }}>{brl(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // ── MODO LISTA ──
            <>
              <button onClick={abrirNovo}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--primary)", color: "#fff" }}>
                <Plus size={16} /> Registrar novo mês
              </button>

              {carregando ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Carregando…</p>
              ) : lista.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  Nenhum contracheque registrado ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lista.map(item => {
                    const prev = item.fusex != null && item.pensao != null
                      ? Number(item.fusex) + Number(item.pensao)
                      : Number(item.previdencia);
                    const liq = Number(item.tributavel) + Number(item.receitas_isentas || 0)
                      - prev - Number(item.despesa_medica || 0)
                      - Number(item.outros_descontos || 0) - Number(item.ir_retido);
                    return (
                      <div key={item.id} className="rounded-xl px-4 py-3"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold capitalize">{nomeMes(item.mes)}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Trib. <b style={{ color: "var(--text)" }}>{brl(item.tributavel)}</b>
                              </span>
                              {prev > 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Prev. <b style={{ color: "var(--danger)" }}>{brl(prev)}</b>
                              </span>}
                              {Number(item.despesa_medica) > 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                D.Med. <b style={{ color: "var(--danger)" }}>{brl(Number(item.despesa_medica))}</b>
                              </span>}
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                IR <b style={{ color: "var(--danger)" }}>{brl(item.ir_retido)}</b>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: liq >= 0 ? "#4caf82" : "var(--danger)" }}>
                              {brl(liq)}
                            </p>
                            <div className="flex gap-1.5">
                              <button onClick={() => abrirEditar(item)} style={{ color: "var(--text-muted)" }}>
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deletar(item.id)} style={{ color: "var(--text-muted)" }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                Valores usados em <b>Mais → Imposto de Renda</b> para cálculo preciso.
              </p>
            </>
          )}
        </div>

        {/* ── Botão salvar fixo (só no modo formulário) ── */}
        {modoForm && (
          <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={salvar} disabled={salvando || !mes || !tributavel}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--primary)", color: "#fff" }}>
              {salvando ? "Salvando…" : cc ? "Salvar alterações" : "Registrar contracheque"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
