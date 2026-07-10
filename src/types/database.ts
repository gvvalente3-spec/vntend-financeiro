export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: { id: string; nome: string; created_at: string };
        Insert: { id?: string; nome: string; created_at?: string };
        Update: { nome?: string };
      };
      workspace_users: {
        Row: { workspace_id: string; user_id: string; role: "owner" | "member" };
        Insert: { workspace_id: string; user_id: string; role?: "owner" | "member" };
        Update: { role?: "owner" | "member" };
      };
      contas: {
        Row: Conta & { workspace_id: string; created_at: string };
        Insert: Omit<Conta, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Conta>;
      };
      cartoes: {
        Row: Cartao & { workspace_id: string; created_at: string };
        Insert: Omit<Cartao, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Cartao>;
      };
      lancamentos: {
        Row: Lancamento & { workspace_id: string; created_at: string };
        Insert: Omit<Lancamento, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Lancamento>;
      };
      orcamentos: {
        Row: Orcamento & { workspace_id: string; created_at: string };
        Insert: Omit<Orcamento, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Orcamento>;
      };
      recorrencias: {
        Row: Recorrencia & { workspace_id: string; created_at: string };
        Insert: Omit<Recorrencia, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Recorrencia>;
      };
      missoes: {
        Row: Missao & { workspace_id: string; created_at: string };
        Insert: Omit<Missao, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Missao>;
      };
      contracheques: {
        Row: Contracheque & { workspace_id: string; created_at: string };
        Insert: Omit<Contracheque, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Contracheque>;
      };
      investimentos: {
        Row: Investimento & { workspace_id: string; created_at: string };
        Insert: Omit<Investimento, "id"> & { id?: string; workspace_id: string };
        Update: Partial<Investimento>;
      };
      invest_metas: {
        Row: InvestMetas & { workspace_id: string };
        Insert: InvestMetas & { workspace_id: string };
        Update: Partial<InvestMetas>;
      };
      perfil: {
        Row: Perfil & { workspace_id: string };
        Insert: Perfil & { workspace_id: string };
        Update: Partial<Perfil>;
      };
      deducoes: {
        Row: { workspace_id: string; outras_anual: number };
        Insert: { workspace_id: string; outras_anual?: number };
        Update: { outras_anual?: number };
      };
      cat_meta: {
        Row: { workspace_id: string; chave: string; cor: string; icone: string };
        Insert: { workspace_id: string; chave: string; cor: string; icone: string };
        Update: { cor?: string; icone?: string };
      };
      categorias: {
        Row: { id: string; workspace_id: string; tipo: "despesa" | "receita"; cat: string; sub: string | null; subsub: string | null; ordem: number };
        Insert: { id?: string; workspace_id: string; tipo: "despesa" | "receita"; cat: string; sub?: string | null; subsub?: string | null; ordem?: number };
        Update: { cat?: string; sub?: string | null; subsub?: string | null; ordem?: number };
      };
      pagamentos_fatura: {
        Row: PagamentoFatura & { workspace_id: string; created_at: string };
        Insert: Omit<PagamentoFatura, "id"> & { id?: string; workspace_id: string };
        Update: Partial<PagamentoFatura>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};

// ——— Tipos do domínio ———

export interface Conta {
  id: string;
  nome: string;
  tipo: "corrente" | "poupanca" | "investimento" | "outro";
  saldo: number;
}

export interface Cartao {
  id: string;
  nome: string;
  limite: number;
  venc: number;
}

export interface Lancamento {
  id: string;
  tipo: "despesa" | "receita";
  valor: number;
  descricao: string;
  data: string;
  cat: string;
  sub: string | null;
  subsub: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  pago: boolean;
  fiscal: "" | "pgbl" | "saude" | "educacao";
  rec_id: string | null;
  parcela_num: number | null;
  parcela_total: number | null;
  grupo_parcelamento: string | null;
}

export interface PagamentoFatura {
  id: string;
  cartao_id: string;
  conta_id: string | null;
  valor: number;
  data_pagamento: string;   // YYYY-MM-DD
  mes_referencia: string;   // YYYY-MM
}

export interface Orcamento {
  id: string;
  cat: string;
  sub: string | null;
  subsub: string | null;
  limite: number;
}

export interface Recorrencia {
  id: string;
  tipo: "despesa" | "receita";
  descricao: string;
  valor: number;
  dia: number;
  cat: string;
  sub: string | null;
  subsub: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  postados: string[];
}

export interface Missao {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  etapas: number;
  grat_rep_pct: number;
  diarias: number;
  grat_rep_conf: boolean;
  grat_rep_mes: string | null;
  aux_conf: boolean;
  aux_mes: string | null;
  diarias_conf: boolean;
  diarias_mes: string | null;
  obs: string;
}

export interface Contracheque {
  id: string;
  mes: string; // YYYY-MM
  tributavel: number;
  previdencia: number;   // total fusex + pensao (mantido para retrocompat com IRClient)
  fusex: number | null;  // FuSEx separado (ND0001)
  pensao: number | null; // Pensão Militar separada (ND0002)
  despesa_medica: number;   // Despesa Médica FuSEx — ND0013 (não incide IR)
  outros_descontos: number; // FHE, FPHMMLO, empréstimos consignados, etc.
  receitas_isentas: number; // Aux. fardamento, diárias, aux. alimentação, etc.
  ir_retido: number;
  arquivo: string | null;
}

export interface Investimento {
  id: string;
  nome: string;
  ticker: string | null;
  categoria: "reserva" | "rendaFixa" | "rendaVar" | "exterior" | "cripto" | "pgbl" | "objetivo";
  cotas: number | null;
  pm: number | null;
  preco_atual: number | null;
  moeda: "BRL" | "USD";
  valor: number | null;
  obj: "reserva" | "leilao" | "aluguel27" | null;
  hidden: boolean;
}

export interface InvestMetas {
  leilao: number;
  reserva: number;
  aluguel27: number;
  pgbl: number;
  consorcio: number;
  ptax: number;
  alvo_pct: {
    rendaFixa: number;
    rendaVar: number;
    exterior: number;
    cripto: number;
    pgbl: number;
  };
}

export interface Perfil {
  posto: string;
  om: string;
  cidade: string;
  gle_categoria: "A" | "B" | "nenhuma";
  compensacao_organica: boolean;
  compensacao_pct: number;
  dependentes: number;
  dependentes_pre_escolar: number;
  grat_representacao: boolean;
  soldo_override: number | null;
  habilitacao_pct: number;
  adicional_militar_pct: number;
  comp_disp_mil_pct: number;
  fusex_pct: number;
  pensao_pct: number;
  cc_receitas_extras: Array<{ id: string; desc: string; valor: number }>;
  cc_descontos_extras: Array<{ id: string; desc: string; valor: number }>;
  valor_etapa: number;
  pnr_ativo: boolean;
  pnr_taxa: number;
}
