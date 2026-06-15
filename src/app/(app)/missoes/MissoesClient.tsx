"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check, Info, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, MESES, formatData } from "@/lib/utils";
import { calcularMissao, POSTOS, GRAT_REP_PCT_DIA, VALOR_ETAPA_PADRAO } from "@/lib/missao";
import type { Missao, Perfil } from "@/types/database";

function Modal({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
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

function FormMissao({ workspaceId, fechar, onSalvo }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [etapas, setEtapas] = useState("");
  const [gratRepPct, setGratRepPct] = useState(GRAT_REP_PCT_DIA);
  const [diarias, setDiarias] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome) return;
    setSalvando(true);
    const mesPadrao = mesAtual();
    await createClient().from("missoes").insert({
      workspace_id: workspaceId,
      nome, inicio, fim,
      etapas: Number(etapas) || 0,
      grat_rep_pct: Number(gratRepPct) || GRAT_REP_PCT_DIA,
      diarias: Number(diarias) || 0,
      grat_rep_conf: false, grat_rep_mes: mesPadrao,
      aux_conf: false, aux_mes: mesPadrao,
      diarias_conf: false, diarias_mes: mesPadrao,
      obs,
    } as Record<string, unknown>);
    onSalvo();
    fechar();
    setSalvando(false);
  }

  return (
    <Modal titulo="Nova missão" fechar={fechar}>
      <label style={labelStyle}>
        Nome / destino
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Operação Ágata" style={inputStyle} />
      </label>
      <div className="flex gap-3">
        <label style={{ ...labelStyle, flex: 1 }}>Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={inputStyle} /></label>
        <label style={{ ...labelStyle, flex: 1 }}>Fim<input type="date" value={fim} onChange={e => setFim(e.target.value)} style={inputStyle} /></label>
      </div>
      <div className="flex gap-3">
        <label style={{ ...labelStyle, flex: 1 }}>
          Nº de etapas (alimentação)
          <input type="number" inputMode="numeric" value={etapas} onChange={e => setEtapas(e.target.value)} placeholder="0" style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Grat. rep (%/dia)
          <div className="flex items-center gap-1">
            <input type="number" step="0.5" value={gratRepPct} onChange={e => setGratRepPct(Number(e.target.value))} style={{ ...inputStyle }} />
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>%</span>
          </div>
        </label>
      </div>
      <label style={labelStyle}>
        Diárias (R$ total — exclui grat. rep se houver)
        <input type="number" inputMode="decimal" value={diarias} onChange={e => setDiarias(e.target.value)} placeholder="0,00" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Observações
        <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" style={inputStyle} />
      </label>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        A grat. de representação (2%/dia do soldo) e o auxílio (etapas × R${VALOR_ETAPA_PADRAO.toFixed(2)}) são calculados automaticamente a partir das datas e do posto definido em Ajustes.
      </p>
      <button onClick={salvar} disabled={salvando || !nome}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : "Salvar missão"}
      </button>
    </Modal>
  );
}

// Linha de destino de cada componente da missão
function DestinoLinha({ rotulo, valor, conf, mes, onMes, onConf }: {
  rotulo: string; valor: number; conf: boolean; mes: string;
  onMes: (v: string) => void; onConf: () => void;
}) {
  const [ano, mesNum] = mes ? mes.split("-").map(Number) : [0, 0];
  const labelMes = mes ? `${MESES[mesNum - 1]}/${ano}` : "—";

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: conf ? "rgba(42,138,114,0.1)" : "var(--surface2)", border: `1px solid ${conf ? "var(--primary)" : "var(--border)"}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{rotulo}</p>
        <p className="text-sm font-semibold" style={{ color: "#4caf82" }}>{brl(valor)}</p>
      </div>
      <input type="month" value={mes} onChange={e => onMes(e.target.value)}
        className="text-xs rounded-md px-2 py-1 outline-none"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 12 }} />
      <button onClick={onConf}
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: conf ? "var(--primary)" : "var(--surface)", border: `1px solid ${conf ? "var(--primary)" : "var(--border)"}` }}
        title={conf ? `Confirmado para ${labelMes}` : "Confirmar envio ao contracheque"}>
        <Check size={15} style={{ color: conf ? "#fff" : "var(--text-muted)" }} />
      </button>
    </div>
  );
}

export default function MissoesClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [perfil, setPerfil] = useState<Partial<Perfil>>({});
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(false);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: mis }, { data: perf }] = await Promise.all([
      supabase.from("missoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("perfil").select("*").eq("workspace_id", workspaceId).single(),
    ]);
    setMissoes(((mis || []) as unknown as Missao[]).sort((a, b) =>
      (b.fim || b.inicio || "") > (a.fim || a.inicio || "") ? 1 : -1
    ));
    setPerfil((perf as unknown as Perfil) || {});
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function del(id: string) {
    if (!confirm("Remover esta missão?")) return;
    await createClient().from("missoes").delete().eq("id", id);
    setMissoes(m => m.filter(x => x.id !== id));
  }

  async function atualizarCampo(id: string, campo: string, valor: unknown) {
    await createClient().from("missoes").update({ [campo]: valor } as Record<string, unknown>).eq("id", id);
    setMissoes(ms => ms.map(m => m.id === id ? { ...m, [campo]: valor } : m));
  }

  async function salvarValorEtapa(v: number) {
    if (!workspaceId) return;
    await createClient().from("perfil").update({ valor_etapa: v } as Record<string, unknown>).eq("workspace_id", workspaceId);
    setPerfil(p => ({ ...p, valor_etapa: v }));
  }

  const semPosto = !perfil.posto || !POSTOS.includes(perfil.posto);
  const totalGeral = missoes.reduce((s, m) => s + calcularMissao(m, perfil).total, 0);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Missões</h2>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: "var(--primary)", color: "#fff" }}>
          <Plus size={16} /> Missão
        </button>
      </div>

      {/* Aviso sem posto */}
      {semPosto && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(201,149,45,0.12)", border: "1px solid rgba(201,149,45,0.3)", color: "var(--warning)" }}>
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <span>Defina o posto em <b>Ajustes → Perfil militar</b> para a grat. de representação calcular automaticamente.</span>
        </div>
      )}

      {/* Total geral */}
      {missoes.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Total estimado (todas as missões)</p>
          <p className="text-lg font-bold" style={{ color: "#4caf82" }}>{brl(totalGeral)}</p>
        </div>
      )}

      {/* Lista */}
      {missoes.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>
          Registre suas missões — a grat. rep e o auxílio saem das datas e das etapas.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {missoes.map(m => {
            const c = calcularMissao(m, perfil);
            return (
              <div key={m.id} className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {/* Cabeçalho */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{m.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {m.inicio ? formatData(m.inicio) : "—"} → {m.fim ? formatData(m.fim) : "—"}
                      {c.dias ? ` · ${c.dias} dia(s)` : ""}
                      {c.soldo > 0 ? ` · soldo ${brl(c.soldo)}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>total</p>
                    <p className="font-bold" style={{ color: "#4caf82" }}>{brl(c.total)}</p>
                  </div>
                  <button onClick={() => del(m.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
                </div>

                {/* Avisos */}
                {c.cumulatividade && (
                  <div className="mx-4 mb-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(192,73,47,0.1)", color: "var(--danger)" }}>
                    <AlertTriangle size={13} />
                    Grat. rep e diárias não são cumulativas — com diárias, a grat. rep foi zerada.
                  </div>
                )}
                {m.obs && (
                  <p className="mx-4 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>{m.obs}</p>
                )}

                {/* Destinos */}
                <div className="px-4 pb-3 flex flex-col gap-2">
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Enviar ao contracheque (cada um no seu mês)</p>

                  {c.gratRep > 0 && (
                    <DestinoLinha
                      rotulo={`Grat. rep (${c.gratRepPct}%/dia) — tributável`}
                      valor={c.gratRep}
                      conf={!!m.grat_rep_conf}
                      mes={m.grat_rep_mes || mesAtual()}
                      onMes={v => atualizarCampo(m.id, "grat_rep_mes", v)}
                      onConf={() => atualizarCampo(m.id, "grat_rep_conf", !m.grat_rep_conf)}
                    />
                  )}
                  {c.auxAlim > 0 && (
                    <DestinoLinha
                      rotulo={`Aux. alimentação (${m.etapas} etapas) — isento`}
                      valor={c.auxAlim}
                      conf={!!m.aux_conf}
                      mes={m.aux_mes || mesAtual()}
                      onMes={v => atualizarCampo(m.id, "aux_mes", v)}
                      onConf={() => atualizarCampo(m.id, "aux_conf", !m.aux_conf)}
                    />
                  )}
                  {c.diarias > 0 && (
                    <DestinoLinha
                      rotulo="Diárias — isento"
                      valor={c.diarias}
                      conf={!!m.diarias_conf}
                      mes={m.diarias_mes || mesAtual()}
                      onMes={v => atualizarCampo(m.id, "diarias_mes", v)}
                      onConf={() => atualizarCampo(m.id, "diarias_conf", !m.diarias_conf)}
                    />
                  )}

                  {c.gratRep === 0 && c.auxAlim === 0 && c.diarias === 0 && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Nenhum valor calculado. {!c.soldo ? "Defina o posto em Ajustes." : "Verifique as datas e etapas."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && workspaceId && (
        <FormMissao workspaceId={workspaceId} fechar={() => setForm(false)} onSalvo={carregar} />
      )}
    </div>
  );
}
