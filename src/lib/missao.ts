import type { Missao, Perfil } from "@/types/database";

export const SOLDOS_2026: Record<string, number> = {
  "Soldado": 1580, "Cabo": 1665, "Terceiro-Sargento": 4177,
  "Segundo-Sargento": 5209, "Primeiro-Sargento": 5988, "Subtenente": 6737,
  "Aspirante a Oficial": 7988, "Segundo-Tenente": 8179, "Primeiro-Tenente": 9004,
  "Capitão": 9976, "Major": 12108, "Tenente-Coronel": 12285, "Coronel": 12505,
  "General de Brigada": 13640, "General de Divisão": 14100, "General de Exército": 14711,
};

export const POSTOS = Object.keys(SOLDOS_2026);
export const VALOR_ETAPA_PADRAO = 13.50;
export const GRAT_REP_PCT_DIA = 2;

export function resolveSoldo(perfil: Partial<Perfil>) {
  return Number(perfil.soldo_override) > 0
    ? Number(perfil.soldo_override)
    : (SOLDOS_2026[perfil.posto || ""] || 0);
}

export function diasMissao(inicio: string, fim: string) {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio + "T00:00:00");
  const b = new Date(fim + "T00:00:00");
  const d = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return d > 0 ? d : 0;
}

export function calcularMissao(m: Partial<Missao>, perfil: Partial<Perfil>) {
  const soldo = resolveSoldo(perfil);
  const dias = diasMissao(m.inicio || "", m.fim || "");
  const valorEtapa = Number(perfil.valor_etapa) > 0 ? Number(perfil.valor_etapa) : VALOR_ETAPA_PADRAO;
  const gratRepPct = m.grat_rep_pct != null ? Number(m.grat_rep_pct) : GRAT_REP_PCT_DIA;

  const gratRep = dias > 0 && soldo > 0 ? dias * soldo * (gratRepPct / 100) : 0;
  const etapas = Number(m.etapas || 0);
  const auxAlim = etapas > 0 ? etapas * valorEtapa : 0;
  const diarias = Number(m.diarias || 0);

  // Grat. rep e diárias não são cumulativas
  const gratRepEfetiva = diarias > 0 ? 0 : gratRep;

  return {
    dias, soldo, valorEtapa, gratRepPct,
    gratRep: gratRepEfetiva,
    auxAlim, diarias,
    total: gratRepEfetiva + auxAlim + diarias,
    cumulatividade: diarias > 0 && gratRep > 0,
  };
}
