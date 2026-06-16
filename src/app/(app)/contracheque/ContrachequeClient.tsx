"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Info, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, MESES } from "@/lib/utils";
import type { Perfil } from "@/types/database";

// —— Tabela Progressiva IR 2026 — mensal (Lei nº 15.191/2025) ——
const TABELA_IR = [
  { ate: 2428.80,  aliquota: 0,     deducao: 0 },
  { ate: 2826.65,  aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05,  aliquota: 0.15,  deducao: 394.16 },
  { ate: 4664.68,  aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 884.96 },
];

// Redutor da Lei 15.270/2025 — aplicado APÓS o cálculo pela tabela progressiva
// Até R$5.000 de rend. tributável → redução de até R$312,89 (zerando o IR)
// De R$5.000,01 a R$7.350 → redução decrescente: R$978,62 − (0,133145 × rendimentos)
function aplicarRedutor(irBruto: number, rendimentosTributaveis: number): number {
  if (rendimentosTributaveis <= 5000) {
    // Zera o IR (redução de até R$312,89)
    return 0;
  } else if (rendimentosTributaveis <= 7350) {
    const reducao = Math.max(0, 978.62 - 0.133145 * rendimentosTributaveis);
    return Math.max(0, irBruto - reducao);
  }
  return irBruto;
}

const DEP_DEDUCAO = 189.59; // dedução mensal por dependente
const AUX_PRE_ESCOLAR_BRUTO = 526.34; // Portaria MGI 2.785/2026 (reajuste abr/2026)
const COTA_PARTE_PRE_ESCOLAR_PCT = 0.05;

function calcIR(baseContrib: number, dependentes: number, rendimentosTributaveis: number): number {
  const baseAjustada = Math.max(0, baseContrib - DEP_DEDUCAO * dependentes);
  const faixa = TABELA_IR.find(f => baseAjustada <= f.ate);
  if (!faixa || faixa.aliquota === 0) return 0;
  const irBruto = Math.max(0, baseAjustada * faixa.aliquota - faixa.deducao);
  // Aplica redutor usando rendimentos tributáveis (base antes da previdência e dependentes)
  return aplicarRedutor(irBruto, rendimentosTributaveis);
}

// IR exclusivo do 13º — sem redutor (regime exclusivo na fonte, não se aplica isenção mensal)
function calcIR13(base13: number, dependentes: number): number {
  const baseAjustada = Math.max(0, base13 - DEP_DEDUCAO * dependentes);
  const faixa = TABELA_IR.find(f => baseAjustada <= f.ate);
  if (!faixa || faixa.aliquota === 0) return 0;
  return Math.max(0, baseAjustada * faixa.aliquota - faixa.deducao);
}

// —— Soldos por posto (EB 2026) ——
const SOLDOS: Record<string, number> = {
  "Soldado": 2400, "Cabo": 2800, "3º Sargento": 3200, "2º Sargento": 3600,
  "1º Sargento": 4100, "Subtenente": 4800, "Aspirante a Oficial": 5400,
  "2º Tenente": 6200, "1º Tenente": 7100, "Capitão": 9976,
  "Major": 13200, "Tenente-Coronel": 16400, "Coronel": 19800,
  "General de Brigada": 24000, "General de Divisão": 27000, "General de Exército": 30000,
};

function soldo(perfil: Perfil): number {
  return perfil.soldo_override || SOLDOS[perfil.posto] || 0;
}

interface DescontoExtra { desc: string; valor: number; }

interface SimResult {
  rendimentos: Array<{ label: string; valor: number; isento?: boolean }>;
  descontos: Array<{ label: string; valor: number }>;
  totalRendimentos: number;
  totalDescontos: number;
  previdencia: number;
  baseIR: number;
  rendTributavel: number;
  ir: number;
  liquido: number;
  temNatalino: boolean;
  parcela13Label: string;
  valor13: number;
  ir13: number;
  liquido13: number;
}

function simularCC(
  perfil: Perfil,
  mes: number,
  extras: { missaoLiq: number; outroValor: number; outroDesc: string; descontosLivres: DescontoExtra[] }
): SimResult {
  const s = soldo(perfil);
  const hab = s * (perfil.habilitacao_pct / 100);
  const gle = perfil.gle_categoria !== "nenhuma" ? s * 0.2 : 0;
  const comp = perfil.compensacao_organica ? s * (perfil.compensacao_pct / 100) : 0;
  const adMil = s * (perfil.adicional_militar_pct / 100);
  const cdm = s * (perfil.comp_disp_mil_pct / 100);

  const depPreEscolar = perfil.dependentes_pre_escolar || 0;
  const auxPreEscolarBruto = depPreEscolar > 0 ? depPreEscolar * AUX_PRE_ESCOLAR_BRUTO : 0;
  const cotaPartePreEscolar = auxPreEscolarBruto * COTA_PARTE_PRE_ESCOLAR_PCT;

  // Rendimentos tributáveis (sem isentos)
  const rendTributavel = s + hab + gle + comp + adMil + cdm
    + (extras.outroValor || 0)
    + (perfil.cc_receitas_extras || []).reduce((a, e) => a + e.valor, 0);

  // Previdência: base = Soldo + Hab + Comp + AdMil + CDM
  const baseContrib = s + hab + comp + adMil + cdm;
  const fusex = baseContrib * (perfil.fusex_pct / 100);
  const pensao = baseContrib * (perfil.pensao_pct / 100);
  const previdencia = fusex + pensao;

  // Base IR = rendTributavel − previdência
  const baseIR = Math.max(0, rendTributavel - previdencia);
  // Redutor usa rendTributavel (bruto antes de previdência, conforme orientação RF)
  const ir = calcIR(baseIR, perfil.dependentes || 0, rendTributavel);

  // PNR
  const pnrAtivo = !!(perfil as any).pnr_ativo;
  const pnrTaxa = (perfil as any).pnr_taxa || 0;

  const rendimentos: Array<{ label: string; valor: number; isento?: boolean }> = [
    { label: "Soldo", valor: s },
    ...(hab > 0 ? [{ label: "Adicional de Habilitação", valor: hab }] : []),
    ...(gle > 0 ? [{ label: `GLE — Cat. ${perfil.gle_categoria}`, valor: gle }] : []),
    ...(comp > 0 ? [{ label: "Compensação Orgânica", valor: comp }] : []),
    ...(adMil > 0 ? [{ label: "Adicional Militar", valor: adMil }] : []),
    ...(cdm > 0 ? [{ label: "Comp. Disponibilidade Militar", valor: cdm }] : []),
    ...(auxPreEscolarBruto > 0 ? [{ label: `Aux. Pré-escolar (${depPreEscolar} dep.) — isento IR`, valor: auxPreEscolarBruto, isento: true }] : []),
    ...(extras.missaoLiq > 0 ? [{ label: "Ressarcimento Missão (líq.) — isento", valor: extras.missaoLiq, isento: true }] : []),
    ...(extras.outroValor > 0 ? [{ label: extras.outroDesc || "Outro adicional", valor: extras.outroValor }] : []),
    ...(perfil.cc_receitas_extras || []).map(e => ({ label: e.desc, valor: e.valor })),
  ];

  const totalRend = rendimentos.reduce((sum, r) => sum + r.valor, 0);

  const descontos: Array<{ label: string; valor: number }> = [
    { label: `FuSEx (${perfil.fusex_pct}%)`, valor: fusex },
    { label: `Pensão Militar (${perfil.pensao_pct}%)`, valor: pensao },
    ...(cotaPartePreEscolar > 0 ? [{ label: "Cota-parte Pré-escolar (5%)", valor: cotaPartePreEscolar }] : []),
    ...(pnrAtivo && pnrTaxa > 0 ? [{ label: "Taxa PNR", valor: pnrTaxa }] : []),
    { label: "Imposto de Renda", valor: ir },
    // descontos livres do simulador (consignados, etc.)
    ...extras.descontosLivres.filter(d => d.valor > 0).map(d => ({ label: d.desc || "Desconto", valor: d.valor })),
    // descontos extras do perfil
    ...(perfil.cc_descontos_extras || []).map(e => ({ label: e.desc, valor: e.valor })),
  ];

  const totalDescontos = descontos.reduce((sum, d) => sum + d.valor, 0);
  const liquido = totalRend - totalDescontos;

  // —— ADICIONAL NATALINO ——
  let temNatalino = false;
  let parcela13Label = "";
  let valor13 = 0;
  let ir13 = 0;
  let liquido13 = 0;
  const baseNatalino = rendTributavel;

  if (mes === 6) {
    temNatalino = true;
    parcela13Label = "1ª Parcela — Adicional Natalino (A84)";
    valor13 = Math.round(baseNatalino * 0.5 * 100) / 100;
    ir13 = 0;
    liquido13 = valor13;
  } else if (mes === 11) {
    temNatalino = true;
    parcela13Label = "2ª Parcela — Adicional Natalino (A85)";
    const bruto2a = baseNatalino;
    const descG84 = Math.round(bruto2a * 0.5 * 100) / 100;
    const valorBruto2a = bruto2a - descG84;
    ir13 = calcIR13(bruto2a, perfil.dependentes || 0);
    valor13 = valorBruto2a;
    liquido13 = valorBruto2a - ir13;
  }

  return {
    rendimentos, descontos, totalRendimentos: totalRend, totalDescontos,
    previdencia, baseIR, rendTributavel, ir, liquido,
    temNatalino, parcela13Label, valor13, ir13, liquido13,
  };
}

const inputCls = "rounded-lg px-3 py-2 text-sm outline-none w-full";
const inputStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

export default function ContrachequeClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [missaoLiq, setMissaoLiq] = useState("");
  const [outroValor, setOutroValor] = useState("");
  const [outroDesc, setOutroDesc] = useState("");
  const [expandido, setExpandido] = useState(true);

  // Descontos livres (consignados, etc.)
  const [descontosLivres, setDescontosLivres] = useState<DescontoExtra[]>([]);

  const addDesconto = () => setDescontosLivres(v => [...v, { desc: "", valor: 0 }]);
  const removeDesconto = (i: number) => setDescontosLivres(v => v.filter((_, j) => j !== i));
  const updateDesconto = (i: number, field: keyof DescontoExtra, val: string) =>
    setDescontosLivres(v => v.map((d, j) => j === i ? { ...d, [field]: field === "valor" ? Number(val) || 0 : val } : d));

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const { data } = await createClient()
      .from("perfil").select("*").eq("workspace_id", workspaceId).maybeSingle();
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

  const resultado = simularCC(perfil, mes, {
    missaoLiq: Number(missaoLiq) || 0,
    outroValor: Number(outroValor) || 0,
    outroDesc,
    descontosLivres,
  });

  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const labelPag = `1º dia útil de ${MESES[proxMes - 1]}/${proxAno}`;
  const liquidoTotal = resultado.liquido + (resultado.temNatalino ? resultado.liquido13 : 0);

  // Verifica se o redutor está sendo aplicado
  const comReducao = resultado.rendTributavel <= 7350 && resultado.rendTributavel > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Header + mês */}
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
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={inputStyle}>
              {MESES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Ano
            <select value={ano} onChange={e => setAno(Number(e.target.value))} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={inputStyle}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Adicionais / Descontos deste mês */}
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button className="flex items-center justify-between w-full" onClick={() => setExpandido(v => !v)}>
          <p className="text-sm font-semibold">Adicionais e descontos deste mês</p>
          {expandido ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
        </button>
        {expandido && (
          <div className="flex flex-col gap-3">
            {/* Missão */}
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Ressarcimento de missão — líquido (R$) — isento IR
              <input type="number" step="0.01" value={missaoLiq} onChange={e => setMissaoLiq(e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
            </label>

            {/* Outro adicional */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Outro adicional (R$)
                <input type="number" step="0.01" value={outroValor} onChange={e => setOutroValor(e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Descrição
                <input type="text" value={outroDesc} onChange={e => setOutroDesc(e.target.value)} placeholder="Ex: Aux. Natalidade" className={inputCls} style={inputStyle} />
              </label>
            </div>

            {/* Descontos livres (consignados etc.) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Outros descontos (consignado, etc.)</span>
                <button onClick={addDesconto}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <Plus size={12} /> Adicionar
                </button>
              </div>
              {descontosLivres.map((d, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 items-end">
                  <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Descrição
                    <input type="text" value={d.desc} onChange={e => updateDesconto(i, "desc", e.target.value)} placeholder="Ex: Consignado FHE" className={inputCls} style={inputStyle} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Valor (R$)
                    <div className="flex gap-1">
                      <input type="number" step="0.01" value={d.valor || ""} onChange={e => updateDesconto(i, "valor", e.target.value)} placeholder="0,00" className={inputCls} style={inputStyle} />
                      <button onClick={() => removeDesconto(i)} style={{ color: "var(--danger)", flexShrink: 0 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card líquido */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Líquido estimado — {MESES[mes - 1]}/{ano}
          {resultado.temNatalino && <span style={{ color: "var(--primary)" }}> · inclui Natalino</span>}
        </p>
        <p className="text-3xl font-bold" style={{ color: liquidoTotal < 0 ? "var(--danger)" : "#4caf82" }}>
          {brl(resultado.temNatalino ? liquidoTotal : resultado.liquido)}
        </p>
        <div className="flex gap-4 mt-1 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Rendimentos <span style={{ color: "#4caf82" }}>{brl(resultado.totalRendimentos)}</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Descontos <span style={{ color: "var(--danger)" }}>{brl(resultado.totalDescontos)}</span>
          </span>
          {resultado.temNatalino && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              + Natalino líq. <span style={{ color: "#4caf82" }}>{brl(resultado.liquido13)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Natalino */}
      {resultado.temNatalino && (
        <div className="rounded-xl px-4 py-3" style={{ background: "rgba(42,138,114,0.07)", border: "1px solid var(--primary)" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--primary)" }}>
            🎄 {resultado.parcela13Label}
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--text-muted)" }}>Valor bruto da parcela</span>
              <span className="font-semibold" style={{ color: "#4caf82" }}>{brl(resultado.valor13)}</span>
            </div>
            {resultado.ir13 > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>IR exclusivo na fonte (Z33)</span>
                <span className="font-semibold" style={{ color: "var(--danger)" }}>−{brl(resultado.ir13)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t" style={{ borderColor: "var(--border)" }}>
              <span>Líquido do Natalino</span>
              <span style={{ color: "#4caf82" }}>{brl(resultado.liquido13)}</span>
            </div>
          </div>
          {mes === 6 && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>1ª parcela (A84) — sem IR. 2ª parcela em novembro (A85) com IR exclusivo (Z33).</p>}
          {mes === 11 && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>2ª parcela (A85) = remuneração integral. G84 abatido. IR exclusivo (Z33) — sem dedução de FuSEx/Pensão; dedução de dependentes aplicada.</p>}
        </div>
      )}

      {/* Detalhamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "#4caf82" }}>Rendimentos</p>
          <div className="flex flex-col gap-1">
            {resultado.rendimentos.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs flex-1" style={{ color: r.isento ? "var(--primary)" : "var(--text-muted)" }}>
                  {r.isento ? "⊕ " : ""}{r.label}
                </span>
                <span className="text-xs font-medium ml-2 flex-shrink-0">{brl(r.valor)}</span>
              </div>
            ))}
            <div className="border-t mt-1 pt-1 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold">Total</span>
              <span className="text-xs font-bold" style={{ color: "#4caf82" }}>{brl(resultado.totalRendimentos)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--danger)" }}>Descontos</p>
          <div className="flex flex-col gap-1">
            {resultado.descontos.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs flex-1" style={{ color: "var(--text-muted)" }}>{d.label}</span>
                <span className="text-xs font-medium ml-2 flex-shrink-0">−{brl(d.valor)}</span>
              </div>
            ))}
            <div className="border-t mt-1 pt-1 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold">Total</span>
              <span className="text-xs font-bold" style={{ color: "var(--danger)" }}>−{brl(resultado.totalDescontos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso pré-escolar */}
      {(perfil.dependentes_pre_escolar || 0) > 0 && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: "rgba(42,138,114,0.06)", border: "1px solid rgba(42,138,114,0.2)", color: "var(--text-muted)" }}>
          <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
          <span>
            <b style={{ color: "var(--text)" }}>Auxílio Pré-escolar</b> — R$ {AUX_PRE_ESCOLAR_BRUTO.toFixed(2)} bruto/dep. (Portaria MGI 2.785/2026).
            Cota-parte 5% = R$ {(AUX_PRE_ESCOLAR_BRUTO * COTA_PARTE_PRE_ESCOLAR_PCT).toFixed(2)}.
            Líquido: <b style={{ color: "var(--text)" }}>R$ {(AUX_PRE_ESCOLAR_BRUTO * 0.95).toFixed(2)}/dep.</b> — isento de IR.
          </span>
        </div>
      )}

      {/* Base IR */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Cálculo do IR mensal (estimado)</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Rend. Trib. <b style={{ color: "var(--text)" }}>{brl(resultado.rendTributavel)}</b>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Previdência <b style={{ color: "var(--text)" }}>{brl(resultado.previdencia)}</b>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            − Dep. ({perfil.dependentes}) <b style={{ color: "var(--text)" }}>{brl(DEP_DEDUCAO * (perfil.dependentes || 0))}</b>
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            = Base <b style={{ color: "var(--text)" }}>{brl(resultado.baseIR - DEP_DEDUCAO * (perfil.dependentes || 0))}</b>
            {" · "}IR <b style={{ color: "var(--danger)" }}>{brl(resultado.ir)}</b>
          </span>
        </div>
        {comReducao && (
          <p className="text-xs mt-1.5" style={{ color: "var(--primary)" }}>
            ✓ Redutor Lei 15.270/2025 aplicado (isenção efetiva até R$ 5.000 / parcial até R$ 7.350 de rend. tributável)
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          * Simulação. Tabela progressiva 2026 + redutor Lei 15.270/2025. Valores reais no CPEx podem diferir.
          {resultado.temNatalino && mes === 11 && " IR do 13º (Z33) calculado separado acima."}
        </p>
      </div>
    </div>
  );
}
