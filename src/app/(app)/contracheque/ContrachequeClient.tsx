"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { SlidersHorizontal, Plus, Trash2, Compass, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, MESES } from "@/lib/utils";
import { calcularMissao, SOLDOS_2026 } from "@/lib/missao";
import { calcularContracheque, DEDUCAO_DEPENDENTE_IR, type OpcoesMes } from "@/lib/contracheque";
import type { Perfil, Missao } from "@/types/database";
import IRClient from "../ir/IRClient";

const inputStyle = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", fontSize: 14,
};

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1" style={{ fontSize: 13, color: "var(--text-muted)" }}>
      {label}
      <div className="flex items-center gap-1">
        <input type="number" min={0} max={100} step={0.5} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ ...inputStyle, width: 70 }} />
        <span style={{ color: "var(--text-muted)" }}>%</span>
      </div>
    </label>
  );
}

function Rubrica({ cod, valor, pct, positivo, destaque }: { cod: string; valor: number; pct?: number; positivo: boolean; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm flex-1" style={{ color: destaque ? "var(--text-muted)" : "var(--text)" }}>
        {cod}{pct ? <em className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>· {pct}%</em> : null}
      </span>
      <span className="text-sm font-semibold" style={{ color: positivo ? "#4caf82" : "var(--danger)" }}>
        {positivo ? "+" : "−"}{brl(valor)}
      </span>
    </div>
  );
}

function TotalRubrica({ label, valor, positivo }: { label: string; valor: number; positivo: boolean }) {
  return (
    <div className="flex items-center justify-between pt-2 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-sm font-bold" style={{ color: positivo ? "#4caf82" : "var(--danger)" }}>
        {positivo ? "+" : "−"}{brl(valor)}
      </span>
    </div>
  );
}

function AddExtra({ placeholder, onAdd }: { placeholder: string; onAdd: (desc: string, valor: number) => void }) {
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  function enviar() {
    if (!desc.trim() || !valor) return;
    onAdd(desc.trim(), Number(valor));
    setDesc(""); setValor("");
  }
  return (
    <div className="flex gap-2 mt-2">
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === "Enter") enviar(); }}
        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      <input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
        onKeyDown={e => { if (e.key === "Enter") enviar(); }}
        className="rounded-lg px-2 py-2 text-sm outline-none w-24"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      <button onClick={enviar}
        className="px-3 rounded-lg"
        style={{ background: "var(--primary)", color: "#fff" }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

export default function ContrachequeClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [perfil, setPerfil] = useState<Partial<Perfil>>({});
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [mes, setMes] = useState(mesAtual());
  const [parcela13, setParcela13] = useState<0 | 1 | 2>(0);
  const [vista, setVista] = useState<"mes" | "ir">("mes");
  const [ajustar, setAjustar] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: perf }, { data: mis }] = await Promise.all([
      supabase.from("perfil").select("*").eq("workspace_id", workspaceId).single(),
      supabase.from("missoes").select("*").eq("workspace_id", workspaceId),
    ]);
    setPerfil((perf as unknown as Perfil) || {});
    setMissoes((mis || []) as unknown as Missao[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarPerfil(novo: Partial<Perfil>) {
    setPerfil(novo);
    if (!workspaceId) return;
    await createClient().from("perfil").update(novo as Record<string, unknown>).eq("workspace_id", workspaceId);
  }

  function set(campo: string, valor: unknown) {
    salvarPerfil({ ...perfil, [campo]: valor });
  }

  function addExtra(chave: "cc_receitas_extras" | "cc_descontos_extras", desc: string, valor: number) {
    const lista = Array.isArray(perfil[chave]) ? [...(perfil[chave] as Array<{id:string;desc:string;valor:number}>)] : [];
    lista.push({ id: Date.now().toString(36), desc, valor });
    set(chave, lista);
  }

  function delExtra(chave: "cc_receitas_extras" | "cc_descontos_extras", id: string) {
    const lista = (Array.isArray(perfil[chave]) ? perfil[chave] as Array<{id:string}> : []).filter(x => x.id !== id);
    set(chave, lista);
  }

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Missões confirmadas para este mês
  const { gratRepMissoes, isentosMissoes, itensMissoes } = useMemo(() => {
    let gr = 0, is = 0;
    const itens: Array<{ id: string; nome: string; tipo: string; valor: number }> = [];
    missoes.forEach(m => {
      const c = calcularMissao(m, perfil);
      if (m.grat_rep_conf && (m.grat_rep_mes || mesAtual()) === mes && c.gratRep > 0) {
        gr += c.gratRep;
        itens.push({ id: m.id + "-gr", nome: m.nome, tipo: "Grat. representação", valor: c.gratRep });
      }
      if (m.aux_conf && (m.aux_mes || mesAtual()) === mes && c.auxAlim > 0) {
        is += c.auxAlim;
        itens.push({ id: m.id + "-ax", nome: m.nome, tipo: "Aux. alimentação", valor: c.auxAlim });
      }
      if (m.diarias_conf && (m.diarias_mes || mesAtual()) === mes && c.diarias > 0) {
        is += c.diarias;
        itens.push({ id: m.id + "-di", nome: m.nome, tipo: "Diárias", valor: c.diarias });
      }
    });
    return { gratRepMissoes: gr, isentosMissoes: is, itensMissoes: itens };
  }, [missoes, perfil, mes]);

  const cc = useMemo(() =>
    calcularContracheque(perfil, { parcela13, gratRepMissoes, isentosMissoes } as OpcoesMes),
    [perfil, parcela13, gratRepMissoes, isentosMissoes]
  );

  const [ano, mesNum] = mes.split("-").map(Number);
  const nomeMes = `${MESES[mesNum - 1]}/${ano}`;
  const soldoPadrao = SOLDOS_2026[perfil.posto || ""];

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  if (!perfil.posto) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-4">
        <h2 className="text-lg font-semibold mb-4">Simulador de Contracheque</h2>
        <div className="rounded-xl px-4 py-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Defina seu posto em <b style={{ color: "var(--text)" }}>Ajustes → Perfil militar</b> para o simulador estimar suas rubricas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contracheque</h2>
        {vista === "mes" && <button onClick={() => setAjustar(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: ajustar ? "var(--primary)" : "var(--surface)", color: ajustar ? "#fff" : "var(--text-muted)", border: "1px solid var(--border)" }}>
          <SlidersHorizontal size={15} /> Parâmetros
        </button>}
      </div>

      {/* Segmented control Mês / IR */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {(["mes", "ir"] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className="flex-1 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: vista === v ? "var(--primary)" : "transparent", color: vista === v ? "#fff" : "var(--text-muted)" }}>
            {v === "mes" ? "Mês (simulador)" : "IR no ano"}
          </button>
        ))}
      </div>

      {vista === "ir" && <IRClient embutido />}

      {vista === "mes" && <>
      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <span className="font-medium capitalize text-sm">{nomeMes}</span>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
        <span>
          Simulador de <b style={{ color: "var(--text)" }}>referência</b> para o posto <b style={{ color: "var(--text)" }}>{perfil.posto}</b>.
          A fonte oficial do IR e dos valores é sempre o <b style={{ color: "var(--text)" }}>contracheque em PDF do CPEx</b>.
        </span>
      </div>

      {/* Hero — líquido */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-2" style={{ background: "linear-gradient(135deg,#1d5c4f,#2a8a72)" }}>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.8)" }}>Líquido estimado · {nomeMes}</p>
        <p className="text-4xl font-bold" style={{ color: cc.liquido < 0 ? "#ffd9cf" : "#fff" }}>{brl(cc.liquido)}</p>
        <div className="flex gap-4 mt-1 flex-wrap">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>Receitas <b style={{ color: "#fff" }}>{brl(cc.totalReceitas)}</b></span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>− Descontos <b style={{ color: "#ffd9cf" }}>{brl(cc.totalDescontos)}</b></span>
        </div>
      </div>

      {/* 13º */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-2">13º salário (Adicional Natalino)</p>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([0, 1, 2] as const).map(v => (
            <button key={v} onClick={() => setParcela13(v)}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{ background: parcela13 === v ? "var(--primary)" : "transparent", color: parcela13 === v ? "#fff" : "var(--text-muted)" }}>
              {v === 0 ? "Nenhum" : v === 1 ? "1ª parcela" : "2ª parcela"}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          1ª parcela ≈ metade da remuneração, sem IR; 2ª parcela, com IR do 13º retido na fonte.
        </p>
      </div>

      {/* Receitas */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-1">Receitas</p>
        {cc.receitas.map((r, i) => (
          <Rubrica key={i} cod={r.cod} valor={r.valor} pct={r.pct} positivo={true} destaque={r.isento} />
        ))}
        <TotalRubrica label="Total de receitas" valor={cc.totalReceitas} positivo={true} />
      </div>

      {/* Descontos */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-1">Descontos</p>
        {cc.descontos.map((d, i) => (
          <Rubrica key={i} cod={d.cod} valor={d.valor} pct={d.pct} positivo={false} />
        ))}
        <TotalRubrica label="Total de descontos" valor={cc.totalDescontos} positivo={false} />
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Base IR: {brl(cc.baseIR)} · {cc.deps} dependente(s){cc.deps ? ` (−${brl(cc.deps * DEDUCAO_DEPENDENTE_IR)})` : ""}.
          FuSEx e pensão não incidem sobre a GLE.
        </p>
      </div>

      {/* Missões do mês */}
      {itensMissoes.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Compass size={15} style={{ color: "var(--primary-light)" }} />
            <p className="text-sm font-semibold">Missões neste mês</p>
          </div>
          {itensMissoes.map(it => (
            <div key={it.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm">{it.nome} <em className="text-xs" style={{ color: "var(--text-muted)" }}>· {it.tipo}</em></span>
              <span className="text-sm font-semibold" style={{ color: "#4caf82" }}>+{brl(it.valor)}</span>
            </div>
          ))}
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Grat. de representação entra na base do IR. Auxílio alimentação e diárias entram isentos.
          </p>
        </div>
      )}

      {/* Receitas extras */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-1">Receitas extras</p>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Lançamentos avulsos — entram líquidos, sem recalcular IR. Para missões, use a aba Missões.
        </p>
        {(Array.isArray(perfil.cc_receitas_extras) ? perfil.cc_receitas_extras : []).map(it => (
          <div key={it.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm flex-1">{it.desc}</span>
            <span className="text-sm font-semibold mr-3" style={{ color: "#4caf82" }}>+{brl(it.valor)}</span>
            <button onClick={() => delExtra("cc_receitas_extras", it.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
          </div>
        ))}
        {(!perfil.cc_receitas_extras || perfil.cc_receitas_extras.length === 0) && (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Nada lançado ainda.</p>
        )}
        <AddExtra placeholder="Ex: ressarcimento" onAdd={(d, v) => addExtra("cc_receitas_extras", d, v)} />
      </div>

      {/* Descontos extras */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-1">Descontos extras</p>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Empréstimos consignados, FHE, mensalidades e outros descontos da folha.
        </p>
        {(Array.isArray(perfil.cc_descontos_extras) ? perfil.cc_descontos_extras : []).map(it => (
          <div key={it.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm flex-1">{it.desc}</span>
            <span className="text-sm font-semibold mr-3" style={{ color: "var(--danger)" }}>−{brl(it.valor)}</span>
            <button onClick={() => delExtra("cc_descontos_extras", it.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button>
          </div>
        ))}
        {(!perfil.cc_descontos_extras || perfil.cc_descontos_extras.length === 0) && (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Nada lançado ainda.</p>
        )}
        <AddExtra placeholder="Ex: Empréstimo consignado" onAdd={(d, v) => addExtra("cc_descontos_extras", d, v)} />
      </div>

      {/* Painel de parâmetros */}
      {ajustar && (
        <div className="rounded-xl px-4 py-3 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--primary)" }}>
          <p className="text-sm font-semibold flex items-center gap-2">
            <SlidersHorizontal size={15} style={{ color: "var(--primary-light)" }} /> Ajustar parâmetros
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Soldo padrão do posto <b style={{ color: "var(--text)" }}>{perfil.posto}</b>: {soldoPadrao ? brl(soldoPadrao) : "—"}.
            Deixe o override em branco para usar o padrão.
          </p>

          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Soldo (override)
            <input type="number" inputMode="decimal"
              value={perfil.soldo_override ?? ""}
              placeholder={soldoPadrao ? String(soldoPadrao) : "0,00"}
              onChange={e => set("soldo_override", e.target.value ? Number(e.target.value) : null)}
              style={{ ...inputStyle, width: "100%" }} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <PctField label="Adicional habilitação" value={perfil.habilitacao_pct ?? 45} onChange={v => set("habilitacao_pct", v)} />
            <PctField label="Adicional militar" value={perfil.adicional_militar_pct ?? 22} onChange={v => set("adicional_militar_pct", v)} />
            <PctField label="Ad. disp. militar" value={perfil.comp_disp_mil_pct ?? 12} onChange={v => set("comp_disp_mil_pct", v)} />
            <PctField label="Compensação orgânica" value={perfil.compensacao_pct ?? 20} onChange={v => set("compensacao_pct", v)} />
            <PctField label="FuSEx" value={perfil.fusex_pct ?? 3} onChange={v => set("fusex_pct", v)} />
            <PctField label="Pensão militar" value={perfil.pensao_pct ?? 10.5} onChange={v => set("pensao_pct", v)} />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            GLE ({perfil.gle_categoria || "não faz jus"}), compensação orgânica e dependentes vêm de Ajustes → Perfil militar.
          </p>
        </div>
      )}
      </>}
    </div>
  );
}

