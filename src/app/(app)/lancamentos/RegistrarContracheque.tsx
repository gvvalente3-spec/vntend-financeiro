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

function nomeMes(mes: string) {
  const [ano, mm] = mes.split("-").map(Number);
  return `${MESES[mm - 1]}/${ano}`;
}

// ——— Formulário de registro/edição ———
function FormContracheque({ workspaceId, inicial, onSalvo, onVoltar }: {
  workspaceId: string;
  inicial?: Contracheque | null;
  onSalvo: () => void;
  onVoltar: () => void;
}) {
  const [mes, setMes] = useState(inicial?.mes || mesAtual());
  const [tributavel, setTributavel] = useState(inicial ? String(inicial.tributavel) : "");
  const [fusex, setFusex] = useState(inicial?.fusex != null ? String(inicial.fusex) : "");
  const [pensao, setPensao] = useState(inicial?.pensao != null ? String(inicial.pensao) : "");
  const [despesaMedica, setDespesaMedica] = useState(inicial ? String(inicial.despesa_medica || 0) : "0");
  const [outrosDescontos, setOutrosDescontos] = useState(inicial ? String(inicial.outros_descontos || 0) : "0");
  const [receitasIsentas, setReceitasIsentas] = useState(inicial ? String(inicial.receitas_isentas || 0) : "0");
  const [irRetido, setIrRetido] = useState(inicial ? String(inicial.ir_retido) : "");
  const [salvando, setSalvando] = useState(false);

  // Calcula previdência e líquido em tempo real
  const previdencia = (Number(fusex) || 0) + (Number(pensao) || 0);
  const liquido = (Number(tributavel) || 0)
    + (Number(receitasIsentas) || 0)
    - previdencia
    - (Number(despesaMedica) || 0)
    - (Number(outrosDescontos) || 0)
    - (Number(irRetido) || 0);

  async function salvar() {
    if (!mes || !tributavel) return;
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      workspace_id: workspaceId,
      mes,
      tributavel: Number(tributavel) || 0,
      previdencia: previdencia || Number(inicial?.previdencia) || 0,
      fusex: fusex ? Number(fusex) : null,
      pensao: pensao ? Number(pensao) : null,
      despesa_medica: Number(despesaMedica) || 0,
      outros_descontos: Number(outrosDescontos) || 0,
      receitas_isentas: Number(receitasIsentas) || 0,
      ir_retido: Number(irRetido) || 0,
      arquivo: null,
    } as Record<string, unknown>;

    if (inicial?.id) {
      await supabase.from("contracheques").update(payload).eq("id", inicial.id);
    } else {
      await supabase.from("contracheques").upsert(payload, { onConflict: "workspace_id,mes" });
    }
    onSalvo();
    onVoltar();
    setSalvando(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header com botão voltar */}
      <div className="flex items-center gap-2">
        <button onClick={onVoltar} style={{ color: "var(--text-muted)" }}>
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-semibold">
          {inicial ? `Editar — ${nomeMes(inicial.mes)}` : "Novo contracheque"}
        </p>
      </div>

      <label style={lbl}>
        Mês de referência
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={inp} disabled={!!inicial} />
      </label>

      {/* ——— RECEITAS ——— */}
      <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: "rgba(42,138,114,0.06)", border: "1px solid rgba(42,138,114,0.2)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>Receitas do contracheque</p>

        <label style={lbl}>
          Rendimento tributável (R$)
          <input type="number" step="0.01" value={tributavel} onChange={e => setTributavel(e.target.value)}
            placeholder="Ex: 19.852,24" style={inp} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Base de cálculo do IR — campo "Rendimento Tributável" do CPEx</span>
        </label>

        <label style={lbl}>
          Receitas isentas (R$) — aux. fardamento, diárias, aux. alimentação…
          <input type="number" step="0.01" value={receitasIsentas} onChange={e => setReceitasIsentas(e.target.value)}
            placeholder="0,00" style={inp} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Não entram na base do IR mas compõem o líquido</span>
        </label>
      </div>

      {/* ——— DESCONTOS ——— */}
      <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: "rgba(192,73,47,0.05)", border: "1px solid rgba(192,73,47,0.15)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--danger)" }}>Descontos do contracheque</p>

        <div className="grid grid-cols-2 gap-2">
          <label style={lbl}>
            FuSEx (R$)
            <input type="number" step="0.01" value={fusex} onChange={e => setFusex(e.target.value)}
              placeholder="0,00" style={inp} />
          </label>
          <label style={lbl}>
            Pensão Militar (R$)
            <input type="number" step="0.01" value={pensao} onChange={e => setPensao(e.target.value)}
              placeholder="0,00" style={inp} />
          </label>
        </div>
        {previdencia > 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Previdência total: <b style={{ color: "var(--text)" }}>{brl(previdencia)}</b> (FuSEx + Pensão — deduzível do IR)
          </p>
        )}

        <label style={lbl}>
          Despesa Médica FuSEx (R$) — ND0013
          <input type="number" step="0.01" value={despesaMedica} onChange={e => setDespesaMedica(e.target.value)}
            placeholder="0,00" style={inp} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Não incide IR, só reduz o líquido</span>
        </label>

        <label style={lbl}>
          Outros descontos (R$) — FHE, empréstimos, FPHMMLO…
          <input type="number" step="0.01" value={outrosDescontos} onChange={e => setOutrosDescontos(e.target.value)}
            placeholder="0,00" style={inp} />
        </label>

        <label style={lbl}>
          Imposto de Renda retido (R$)
          <input type="number" step="0.01" value={irRetido} onChange={e => setIrRetido(e.target.value)}
            placeholder="0,00" style={inp} />
        </label>
      </div>

      {/* ——— PREVIEW LÍQUIDO ——— */}
      {tributavel && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Líquido calculado</p>
            <p className="text-lg font-bold" style={{ color: liquido >= 0 ? "#4caf82" : "var(--danger)" }}>
              {brl(liquido)}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Tributável <span style={{ color: "#4caf82" }}>{brl(Number(tributavel))}</span>
            </span>
            {Number(receitasIsentas) > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                + Isentas <span style={{ color: "#4caf82" }}>{brl(Number(receitasIsentas))}</span>
              </span>
            )}
            {previdencia > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                − Prev. <span style={{ color: "var(--danger)" }}>{brl(previdencia)}</span>
              </span>
            )}
            {Number(despesaMedica) > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                − Desp. Med. <span style={{ color: "var(--danger)" }}>{brl(Number(despesaMedica))}</span>
              </span>
            )}
            {Number(outrosDescontos) > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                − Outros <span style={{ color: "var(--danger)" }}>{brl(Number(outrosDescontos))}</span>
              </span>
            )}
            {Number(irRetido) > 0 && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                − IR <span style={{ color: "var(--danger)" }}>{brl(Number(irRetido))}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <button onClick={salvar} disabled={salvando || !mes || !tributavel}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : inicial ? "Salvar alterações" : "Registrar contracheque"}
      </button>
    </div>
  );
}

// ——— Componente principal (modal) ———
export default function RegistrarContracheque({ workspaceId, fechar, onSalvo }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void;
}) {
  const [lista, setLista] = useState<Contracheque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Contracheque | "novo" | null>(null);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    const { data } = await createClient()
      .from("contracheques")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("mes", { ascending: false });
    setLista((data || []) as unknown as Contracheque[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  async function deletar(id: string) {
    if (!confirm("Remover este contracheque?")) return;
    await createClient().from("contracheques").delete().eq("id", id);
    setLista(l => l.filter(x => x.id !== id));
    onSalvo();
  }

  function handleSalvo() {
    carregarLista();
    onSalvo();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92vh]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">Contracheques registrados</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">

          {/* ——— MODO FORMULÁRIO ——— */}
          {editando !== null ? (
            <FormContracheque
              workspaceId={workspaceId}
              inicial={editando === "novo" ? null : editando}
              onSalvo={handleSalvo}
              onVoltar={() => setEditando(null)}
            />
          ) : (
            <>
              {/* Botão novo */}
              <button
                onClick={() => setEditando("novo")}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Plus size={16} /> Registrar novo mês
              </button>

              {/* ——— LISTA ——— */}
              {carregando ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Carregando…</p>
              ) : lista.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  Nenhum contracheque registrado ainda. Registre o primeiro mês para o IR ficar preciso.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lista.map(cc => {
                    const previdencia = cc.fusex != null && cc.pensao != null
                      ? Number(cc.fusex) + Number(cc.pensao)
                      : Number(cc.previdencia);
                    const liquido = Number(cc.tributavel)
                      + Number(cc.receitas_isentas || 0)
                      - previdencia
                      - Number(cc.despesa_medica || 0)
                      - Number(cc.outros_descontos || 0)
                      - Number(cc.ir_retido);

                    return (
                      <div key={cc.id} className="rounded-xl px-4 py-3"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold capitalize">{nomeMes(cc.mes)}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Trib. <b style={{ color: "var(--text)" }}>{brl(cc.tributavel)}</b>
                              </span>
                              {previdencia > 0 && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Prev. <b style={{ color: "var(--danger)" }}>{brl(previdencia)}</b>
                                </span>
                              )}
                              {Number(cc.despesa_medica) > 0 && (
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  D.Med. <b style={{ color: "var(--danger)" }}>{brl(Number(cc.despesa_medica))}</b>
                                </span>
                              )}
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                IR <b style={{ color: "var(--danger)" }}>{brl(cc.ir_retido)}</b>
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-sm font-bold" style={{ color: liquido >= 0 ? "#4caf82" : "var(--danger)" }}>
                              {brl(liquido)}
                            </p>
                            <div className="flex gap-1.5">
                              <button onClick={() => setEditando(cc)} style={{ color: "var(--text-muted)" }}>
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deletar(cc.id)} style={{ color: "var(--text-muted)" }}>
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
                Os valores registrados são usados na aba <b>IR no ano</b> para cálculo preciso da restituição.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
