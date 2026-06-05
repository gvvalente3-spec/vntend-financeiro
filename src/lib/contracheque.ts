import type { Perfil } from "@/types/database";
import { SOLDOS_2026 } from "@/lib/missao";

export const PADROES = {
  habilitacao_pct: 45,
  adicional_militar_pct: 22,
  comp_disp_mil_pct: 12,
  compensacao_pct: 20,
  fusex_pct: 3,
  pensao_pct: 10.5,
  gle_pct_a: 20,
  gle_pct_b: 10,
};

export const TABELA_IR_MENSAL = [
  { ate: 2259.20,  aliq: 0,     deduz: 0 },
  { ate: 2826.65,  aliq: 0.075, deduz: 169.44 },
  { ate: 3751.05,  aliq: 0.15,  deduz: 381.44 },
  { ate: 4664.68,  aliq: 0.225, deduz: 662.77 },
  { ate: Infinity, aliq: 0.275, deduz: 908.73 },
];

export const TABELA_IR_ANUAL = [
  { ate: 27110.40,  aliq: 0,     deduz: 0 },
  { ate: 33919.80,  aliq: 0.075, deduz: 2033.28 },
  { ate: 45012.60,  aliq: 0.15,  deduz: 4577.28 },
  { ate: 55976.16,  aliq: 0.225, deduz: 7953.24 },
  { ate: Infinity,  aliq: 0.275, deduz: 10904.76 },
];

export const DEDUCAO_DEPENDENTE_IR    = 189.59;
export const DEDUCAO_DEPENDENTE_ANUAL = 2275.08;
export const LIMITE_EDUCACAO_ANUAL    = 3561.50;
export const DESCONTO_SIMPLIFICADO_MAX = 16754.34;

export function irMensal(base: number) {
  if (base <= 0) return 0;
  const f = TABELA_IR_MENSAL.find(f => base <= f.ate)!;
  return Math.max(0, base * f.aliq - f.deduz);
}

export function irAnual(base: number) {
  if (base <= 0) return 0;
  const f = TABELA_IR_ANUAL.find(f => base <= f.ate)!;
  return Math.max(0, base * f.aliq - f.deduz);
}

export interface OpcoesMes {
  gratRepMissoes?: number;
  isentosMissoes?: number;
  parcela13?: 0 | 1 | 2;
}

export interface RubrIca {
  cod: string; valor: number; pct?: number;
  missao?: boolean; isento?: boolean; sazonal?: boolean; extra?: boolean;
}

export function calcularContracheque(perfil: Partial<Perfil>, opcoes: OpcoesMes = {}) {
  const P = { ...PADROES, ...perfil };
  const soldo = Number(perfil.soldo_override) > 0
    ? Number(perfil.soldo_override)
    : (SOLDOS_2026[perfil.posto || ""] || 0);

  const habilitacao  = soldo * (Number(P.habilitacao_pct) || 0) / 100;
  const adicionalMil = soldo * (Number(P.adicional_militar_pct) || 0) / 100;
  const compDispMil  = soldo * (Number(P.comp_disp_mil_pct) || 0) / 100;
  const compensacao  = perfil.compensacao_organica ? soldo * (Number(P.compensacao_pct) || 0) / 100 : 0;
  const gle = perfil.gle_categoria === "A" ? soldo * (PADROES.gle_pct_a / 100)
            : perfil.gle_categoria === "B" ? soldo * (PADROES.gle_pct_b / 100) : 0;

  const baseContrib = soldo + habilitacao + compensacao + adicionalMil + compDispMil;
  const fusex  = baseContrib * (Number(P.fusex_pct) || 0) / 100;
  const pensao = baseContrib * (Number(P.pensao_pct) || 0) / 100;

  const gratRepMissoes = Number(opcoes.gratRepMissoes) || 0;
  const isentosMissoes = Number(opcoes.isentosMissoes) || 0;
  const tributavel = soldo + habilitacao + gle + compensacao + adicionalMil + compDispMil + gratRepMissoes;
  const deps = Number(perfil.dependentes) || 0;
  const baseIR = Math.max(0, tributavel - fusex - pensao - deps * DEDUCAO_DEPENDENTE_IR);
  const ir = irMensal(baseIR);

  // Listas completas de rubricas
  const receitas: RubrIca[] = [
    { cod: "Soldo", valor: soldo },
    { cod: "Adicional de habilitação", valor: habilitacao, pct: Number(P.habilitacao_pct) },
    ...(gle > 0 ? [{ cod: `GLE categoria ${perfil.gle_categoria}`, valor: gle }] : []),
    ...(compensacao > 0 ? [{ cod: "Compensação orgânica", valor: compensacao, pct: Number(P.compensacao_pct) }] : []),
    { cod: "Adicional militar", valor: adicionalMil, pct: Number(P.adicional_militar_pct) },
    { cod: "Ad. comp. disponibilidade militar", valor: compDispMil, pct: Number(P.comp_disp_mil_pct) },
    ...(gratRepMissoes > 0 ? [{ cod: "Grat. representação (missões)", valor: gratRepMissoes, missao: true }] : []),
    ...(isentosMissoes > 0 ? [{ cod: "Aux. alimentação + diárias (missões)", valor: isentosMissoes, missao: true, isento: true }] : []),
  ];

  // Extras do perfil
  const ccReceitas = Array.isArray(perfil.cc_receitas_extras) ? perfil.cc_receitas_extras : [];
  const ccDescontos = Array.isArray(perfil.cc_descontos_extras) ? perfil.cc_descontos_extras : [];
  ccReceitas.forEach(r => receitas.push({ cod: r.desc || "Receita extra", valor: Number(r.valor) || 0, extra: true }));

  // 13º
  let natalino = 0;
  if (opcoes.parcela13 === 1) natalino = tributavel * 0.5;
  else if (opcoes.parcela13 === 2) natalino = tributavel * 0.5 - ir;
  if (natalino) receitas.push({ cod: `13º — ${opcoes.parcela13 === 1 ? "1ª" : "2ª"} parcela`, valor: natalino, sazonal: true });

  const descontos: RubrIca[] = [
    { cod: "FuSEx", valor: fusex, pct: Number(P.fusex_pct) },
    { cod: "Pensão militar", valor: pensao, pct: Number(P.pensao_pct) },
    { cod: "Imposto de renda", valor: ir },
  ];
  ccDescontos.forEach(d => descontos.push({ cod: d.desc || "Desconto extra", valor: Number(d.valor) || 0, extra: true }));

  const totalReceitas  = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0);

  return {
    soldo, tributavel, previdencia: fusex + pensao, fusex, pensao, ir, baseIR, deps,
    receitas, descontos, totalReceitas, totalDescontos,
    liquido: totalReceitas - totalDescontos,
  };
}
