"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, X, TrendingUp, TrendingDown, FileText, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, mesDoLanc, formatData, MESES } from "@/lib/utils";
import type { Lancamento, Conta, Cartao } from "@/types/database";
import { iconeDaCategoria, corDaCategoria, type CatMeta } from "@/components/layout/categoryIcons";
import RegistrarContracheque from "./RegistrarContracheque";

interface CategoriaRow { id: string; tipo: "despesa" | "receita"; cat: string; sub: string | null; subsub: string | null; ordem: number; }

function fmtCts(digits: string): string {
  const n = parseInt(digits || "0", 10);
  if (!digits) return "";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InputValor({ value, onChange, style, autoFocus }: { value: string; onChange: (d: string) => void; style?: React.CSSProperties; autoFocus?: boolean; }) {
  return <input type="text" inputMode="numeric" autoFocus={autoFocus} value={fmtCts(value)} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="0,00" style={style} />;
}

function matchSearch(l: Lancamento, ql: string): boolean {
  if (!ql) return true;
  if ((l.descricao || "").toLowerCase().includes(ql)) return true;
  if ((l.cat || "").toLowerCase().includes(ql)) return true;
  if ((l.sub || "").toLowerCase().includes(ql)) return true;
  if (formatData(l.data).includes(ql)) return true;
  const isNum = /^[\d,\.]+$/.test(ql);
  if (isNum) {
    const qd = ql.replace(/\D/g, "");
    if (qd.length >= 2 && brl(Number(l.valor)).replace(/\D/g, "").startsWith(qd)) return true;
  }
  return false;
}

function CampoBusca({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string; }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl text-sm outline-none" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 36px" }} />
      {value && <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={13} style={{ color: "var(--text-muted)" }} /></button>}
    </div>
  );
}

function ItemLanc({ l, catMeta, onEditar, onDeletar }: { l: Lancamento; catMeta: CatMeta[]; onEditar: (l: Lancamento) => void; onDeletar: (id: string) => void; }) {
  const isRec = l.tipo === "receita";
  const Icone = iconeDaCategoria(l.cat, catMeta, l.tipo);
  const cor = isRec ? "#4caf82" : corDaCategoria(l.cat, catMeta, l.tipo);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cor}1a`, color: cor }}><Icone size={17} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{l.descricao || (isRec ? "Receita" : "Despesa")}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}</p>
      </div>
      <span className="text-sm font-semibold flex-shrink-0 mr-1" style={{ color: isRec ? "#4caf82" : "var(--danger)" }}>{isRec ? "+" : "−"}{brl(Number(l.valor))}</span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onEditar(l)} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
        <button onClick={() => onDeletar(l.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

// ... Resto da estrutura do Modal e Componente (mantive o que você já tinha, apenas a otimização de select na função abaixo)

export default function LancamentosClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  // ... (Estados mantidos)
  
  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    // OTIMIZAÇÃO: selecionando apenas campos vitais
    const [{ data: lancs }, { data: cts }, { data: carts }, { data: cat }, { data: cm }] = await Promise.all([
      supabase.from("lancamentos")
        .select("id, tipo, valor, descricao, data, cat, sub, conta_id, cartao_id, pago")
        .eq("workspace_id", workspaceId).order("data", { ascending: false }),
      supabase.from("contas").select("id, nome").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("id, nome").eq("workspace_id", workspaceId),
      supabase.from("categorias").select("id, tipo, cat, sub, subsub").eq("workspace_id", workspaceId).order("ordem"),
      supabase.from("cat_meta").select("chave, cor, icone").eq("workspace_id", workspaceId),
    ]);
    // ... (restante da função)
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    // ... (setters)
    setCarregando(false);
  }, [workspaceId]);

  // ... (restante do componente)
}
