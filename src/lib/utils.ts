export function brl(n: number | string | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function mesDoLanc(dataISO: string) {
  return (dataISO || "").slice(0, 7);
}

// Mês da FATURA de uma compra no cartão: compra com dia posterior ao
// fechamento entra na fatura do mês seguinte. Sem fechamento definido
// (null/0), agrupa pelo mês-calendário da compra, como antes.
export function mesFatura(dataISO: string, fechamento?: number | null) {
  const mesCal = mesDoLanc(dataISO);
  const f = Number(fechamento || 0);
  if (!f || !mesCal) return mesCal;
  const dia = Number((dataISO || "").slice(8, 10));
  if (dia > f) {
    const [y, m] = mesCal.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return mesCal;
}

export function mesAnterior(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function formatData(dataISO: string) {
  return dataISO.split("-").reverse().join("/");
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export type CatTree = Record<string, Record<string, string[]>>;
export type CatStore = { despesa: CatTree; receita: CatTree };

export const CATS_DEFAULT: CatStore = {
  despesa: {
    "Necessidades básicas": {
      "Saúde": ["Farmácia", "Academia", "Plano de saúde", "Consultas"],
      "Alimentação": ["Mercado", "Restaurante", "Padaria"],
      "Moradia": ["Aluguel", "Energia", "Água", "Internet", "Condomínio"],
    },
    "Transporte": {
      "Veículo": ["Combustível", "Manutenção", "Seguro", "IPVA"],
      "Outros": ["Aplicativos", "Passagens"],
    },
    "Lazer": {
      "Entretenimento": ["Streaming", "Cinema", "Viagens"],
      "Pessoal": ["Roupas", "Presentes"],
    },
    "Financeiro": {
      "Empréstimos": ["Consignado", "Outros"],
      "Investimentos": ["Aporte"],
    },
  },
  receita: {
    "Vencimentos": { "Exército": ["Contracheque", "Diárias", "Gratificações"] },
    "Outros": { "Extras": ["Restituição", "Investimentos", "Diversos"] },
  },
};
