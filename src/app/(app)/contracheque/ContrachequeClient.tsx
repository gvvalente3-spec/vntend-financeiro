"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, MESES } from "@/lib/utils";
import type { Perfil } from "@/types/database";

// —— Tabelas do IR 2026 ——
const TABELA_IR = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 3751.05, aliquota: 0.075, deducao: 182.16 },
  { ate: 4664.68, aliquota: 0.15, deducao: 394.16 },
  { ate: 6101.06, aliquota: 0.225, deducao: 744.15 },
  { ate: Infinity, aliquota: 0.275, deducao: 1049.41 },
];

const DEP_DEDUCAO = 189.59; // por dependente
const COTA_PRE_ESCOLAR = 321.00; // Valor base Exército 

function calcIR(base: number, dependentes: number): number {
  const baseAjustada = Math.max(0, base - DEP_DEDUCAO * dependentes);
  const faixa = TABELA_IR.find(f => baseAjustada <= f.ate);
  if (!faixa || faixa.aliquota === 0) return 0;
  return Math.max(0, baseAjustada * faixa.aliquota - faixa.deducao);
}

// —— Soldo base por posto (valores aproximados EB 2026) ——
const SOLDOS: Record<string, number> = {
  "Soldado": 2400,
  "Cabo": 2800,
  "3º Sargento": 3200,
  "2º Sargento": 3600,
  "1º Sargento": 4100,
  "Subtenente": 4800,
  "Aspirante a Oficial": 5400,
  "2º Tenente": 6200,
  "1º Tenente": 7100,
  "Capitão": 9976,
  "Major": 13200,
  "Tenente-Coronel": 16400,
  "Coronel": 19800,
  "General de Brigada": 24000,
  "General de Divisão": 27000,
  "General de Exército": 30000,
};

function soldo(perfil: Perfil): number {
  return perfil.soldo_override || SOLDOS[perfil.posto] || 0;
}

interface SimResult {
  rendimentos: Array<{ label: string; valor: number }>;
  descontos: Array<{ label: string; valor: number }>;
  totalRendimentos: number;
  totalDescontos: number;
  previdencia: number;
  baseIR: number;
  ir: number;
  liquido: number;
}

function simularCC(perfil: Perfil, extras: { missaoLiq: number; outroValor: number; outroDesc: string }): SimResult {
  const s = soldo(perfil);
  const hab = s * (perfil.habilitacao_pct / 100);
  const gle = perfil.gle_categoria !== "nenhuma" ? s * 0.2 : 0;
  const comp = perfil.compensacao_organica ? s * (perfil.compensacao_pct / 100) : 0;
  const adMil = s * (perfil.adicional_militar_pct / 100);
  const cdm = s * (perfil.comp_disp_mil_pct / 100);
  const grat = perfil.grat_representacao ? s * 0.1 : 0; // estimativa

  const depPreEscolar = perfil.dependentes_pre_escolar || 0;
  const auxPreEscolar = depPreEscolar * COTA_PRE_ESCOLAR;
  const cotaPreEscolar = auxPreEscolar * 0.05; // 5% de cota-parte

  const rendimentos: Array<{ label: string; valor: number }> = [
    { label: "Soldo", valor: s },
    ...(hab > 0 ? [{ label: "Adicional de Habilitação", valor: hab }] : []),
    ...(gle > 0 ? [{ label: `GLE — Cat. ${perfil.gle_categoria}`, valor: gle }] : []),
    ...(comp > 0 ? [{ label: "Compensação Orgânica", valor: comp }] : []),
    ...(adMil > 0 ? [{ label: "Adicional Militar", valor: adMil }] : []),
    ...(cdm > 0 ? [{ label: "Comp. Disponibilidade Militar", valor: cdm }] : []),
    ...(grat > 0 ? [{ label: "Grat. Representação", valor: grat }] : []),
    ...(extras.missaoLiq > 0 ? [{ label: "Ressarcimento Missão (líq.)", valor: extras.missaoLiq }] : []),
    ...(auxPreEscolar > 0 ? [{ label: `Auxílio Pré-escolar (${depPreEscolar} dep.)`, valor: auxPreEscolar }] : []),
    ...(extras.outroValor > 0 ? [{ label: extras.outroDesc || "Outro adicional", valor: extras.outroValor }] : []),
    ...(perfil.cc_receitas_extras || []).map(e => ({ label: e.desc, valor: e.valor })),
  ];

  const totalRendimentos = rendimentos.reduce((sum, r) => sum + r.valor, 0);

  // PREVIDÊNCIA: Incide apenas sobre Base de Contribuição (Soldo + Hab + Comp + AdMil + CDM)
  const baseContrib = s + hab + comp + adMil + cdm;
  const fusex = baseContrib * (perfil.fusex_pct / 100);
  const pensao = baseContrib * (perfil.pensao_pct / 100);
  const previdencia = fusex + pensao;

  // IR: Exclui receitas isentas (Ressarcimento missão, Aux Pré-escolar, etc)
  const totalExtrasReceitas = (perfil.cc_receitas_extras || []).reduce((acc, e) => acc + e.valor, 0);
  const baseTributavel = s + hab + gle + comp + adMil + cdm + grat + extras.outroValor + totalExtrasReceitas;
  const baseIR = Math.max(0, baseTributavel - previdencia);
  const ir = calcIR(baseIR, perfil.dependentes || 0);

  const descontos: Array<{ label: string; valor: number }> = [
    { label: `FuSEx (${perfil.fusex_pct}%)`, valor: fusex },
    { label: `Pensão Militar (${perfil.pensao_pct}%)`, valor: pensao },
    ...(cotaPreEscolar > 0 ? [{ label: "Cota-parte Pré-escolar (5%)", valor: cotaPreEscolar }] : []),
    { label: "Imposto de Renda", valor: ir },
    ...(perfil.cc_descontos_extras || []).map(e => ({ label: e.desc, valor: e.valor })),
  ];

  const totalDescontos = descontos.reduce((sum, d) => sum + d.valor, 0);
  const liquido = totalRendimentos - totalDescontos;

  return { rendimentos, descontos, totalRendimentos, totalDescontos, previdencia, baseIR, ir, liquido };
}

// —— Componente principal ——
export default function ContrachequeClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Variáveis da simulação
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [missaoLiq, setMissaoLiq] = useState("");
  const [outroValor, setOutroValor] = useState("");
  const [outroDesc, setOutroDesc] = useState("");
  const [expandido, setExpandido] = useState(true);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const { data } = await createClient()
      .from("perfil")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    setPerfil(data as unknown as Perfil | null);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  if (!perfil || !perfil.posto) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Configure seu posto e percentuais em <b>Ajustes → Perfil Militar</b> para usar o simulador.
        </p>
      </div>
    );
  }

  const resultado = simularCC(perfil, {
    missaoLiq: Number(missaoLiq) || 0,
    outroValor: Number(outroValor) || 0,
    outroDesc,
  });

  // Mês de pagamento = mês seguinte ao de referência
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const labelPag = `1º dia útil de ${MESES[proxMes - 1]}/${proxAno}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Header + mês de referência */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Simulador de Contracheque</p>
          <button onClick={carregar} style={{ color: "var(--text-muted)" }}><RefreshCw size={15} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Mês de <b>referência</b> → pagamento no {labelPag}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Mês de referência
            <select value={mes} onChange={e => setMes(Number(e.target.value))}
              className="rounded-lg px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {MESES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Ano
            <select value={ano} onChange={e => setAno(Number(e.target.value))}
              className="rounded-lg px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Variáveis extras */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button className="flex items-center justify-between w-full"
          onClick={() => setExpandido(v => !v)}>
          <p className="text-sm font-semibold">Adicionais deste mês</p>
          {expandido ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
        </button>
        {expandido && (
          <div className="flex flex-col gap-2.5">
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Ressarcimento de missão — líquido (R$)
              <input type="number" step="0.01" value={missaoLiq}
                onChange={e => setMissaoLiq(e.target.value)} placeholder="0,00"
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Outro adicional (R$)
                <input type="number" step="0.01" value={outroValor}
                  onChange={e => setOutroValor(e.target.value)} placeholder="0,00"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Descrição
                <input type="text" value={outroDesc}
                  onChange={e => setOutroDesc(e.target.value)} placeholder="Ex: Aux. Natalidade"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Card líquido principal */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-1"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Líquido estimado — {MESES[mes - 1]}/{ano}
        </p>
        <p className="text-3xl font-bold" style={{ color: resultado.liquido < 0 ? "var(--danger)" : "#4caf82" }}>
          {brl(resultado.liquido)}
        </p>
        <div className="flex gap-4 mt-1 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Rendimentos <span style={{ color: "#4caf82" }}>{brl(resultado.totalRendimentos)}</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Descontos <span style={{ color: "var(--danger)" }}>{brl(resultado.totalDescontos)}</span>
          </span>
        </div>
      </div>

      {/* Detalhamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Rendimentos */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "#4caf82" }}>Rendimentos</p>
          <div className="flex flex-col gap-1">
            {resultado.rendimentos.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.label}</span>
                <span className="text-xs font-medium">{brl(r.valor)}</span>
              </div>
            ))}
            <div className="border-t mt-1 pt-1 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold">Total</span>
              <span className="text-xs font-bold" style={{ color: "#4caf82" }}>{brl(resultado.totalRendimentos)}</span>
            </div>
          </div>
        </div>

        {/* Descontos */}
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--danger)" }}>Descontos</p>
          <div className="flex flex-col gap-1">
            {resultado.descontos.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.label}</span>
                <span className="text-xs font-medium">−{brl(d.valor)}</span>
              </div>
            ))}
            <div className="border-t mt-1 pt-1 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold">Total</span>
              <span className="text-xs font-bold" style={{ color: "var(--danger)" }}>−{brl(resultado.totalDescontos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Base IR */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Cálculo do IR (estimado)</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Rend. Trib. <b style={{ color: "var(--text)" }}>{brl(resultado.baseIR + resultado.previdencia)}</b>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Previdência <b style={{ color: "var(--text)" }}>{brl(resultado.previdencia)}</b>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Dep. ({perfil.dependentes}) <b style={{ color: "var(--text)" }}>{brl(DEP_DEDUCAO * (perfil.dependentes || 0))}</b>
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            = Base IR <b style={{ color: "var(--text)" }}>{brl(resultado.baseIR - (DEP_DEDUCAO * (perfil.dependentes || 0)))}</b>
            {" · "}IR <b style={{ color: "var(--danger)" }}>{brl(resultado.ir)}</b>
          </span>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          * Simulação. Valores reais no CPEx podem diferir. Para cálculo preciso do IR anual, use <b>Mais → Imposto de Renda</b>.
        </p>
      </div>
    </div>
  );
}
