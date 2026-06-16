"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, X, TrendingUp, TrendingDown,
  FileText, ChevronLeft, ChevronRight, Pencil, Trash2, Upload, Layers
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, mesDoLanc, formatData, MESES } from "@/lib/utils";
import type { Lancamento, Conta, Cartao } from "@/types/database";
import { iconeDaCategoria, corDaCategoria, type CatMeta } from "@/components/layout/categoryIcons";
import RegistrarContracheque from "./RegistrarContracheque";
import ImportarFatura from "./ImportarFatura";

interface CategoriaRow {
  id: string; tipo: "despesa" | "receita";
  cat: string; sub: string | null; subsub: string | null; ordem: number;
}

// —— InputValor: centavos automáticos ——
function fmtCts(digits: string): string {
  const n = parseInt(digits || "0", 10);
  if (!digits) return "";
  return (n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function InputValor({ value, onChange, style, autoFocus }: {
  value: string; onChange: (d: string) => void;
  style?: React.CSSProperties; autoFocus?: boolean;
}) {
  return (
    <input
      type="text" inputMode="numeric" autoFocus={autoFocus}
      value={fmtCts(value)}
      onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
      placeholder="0,00" style={style}
    />
  );
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

function CampoBusca({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl text-sm outline-none"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 36px" }} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X size={13} style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}

function ItemLanc({ l, catMeta, onEditar, onDeletar }: {
  l: Lancamento; catMeta: CatMeta[];
  onEditar: (l: Lancamento) => void; onDeletar: (id: string) => void;
}) {
  const isRec = l.tipo === "receita";
  const Icone = iconeDaCategoria(l.cat, catMeta, l.tipo);
  const cor = isRec ? "#4caf82" : corDaCategoria(l.cat, catMeta, l.tipo);
  
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${cor}1a`, color: cor }}>
        <Icone size={17} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{l.descricao || (isRec ? "Receita" : "Despesa")}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {l.cat}{l.sub ? ` › ${l.sub}` : ""} · {formatData(l.data)}
          {l.parcela_num ? ` · ${l.parcela_num}/${l.parcela_total}` : ""}
          {l.cartao_id && !l.pago ? " · em aberto" : ""}
        </p>
      </div>
      <span className="text-sm font-semibold flex-shrink-0 mr-1" style={{ color: isRec ? "#4caf82" : "var(--danger)" }}>
        {isRec ? "+" : "−"}{brl(Number(l.valor))}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onEditar(l)} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
        <button onClick={() => onDeletar(l.id)} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

const inp = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" };

// —— Modal de lançamento (com parcelamento) ——
function ModalLanc({ workspaceId, contas, cartoes, categorias, lancamento, fechar, onSalvo }: {
  workspaceId: string;
  contas: Conta[]; cartoes: Cartao[]; categorias: CategoriaRow[];
  lancamento?: Lancamento | null;
  fechar: () => void; onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<"receita" | "despesa">(lancamento?.tipo || "despesa");
  const [valorCts, setValorCts] = useState(lancamento ? String(Math.round(Number(lancamento.valor) * 100)) : "");
  const [descricao, setDescricao] = useState(lancamento?.descricao || "");
  const [data, setData] = useState(lancamento?.data || new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState(lancamento?.cat || "");
  const [sub, setSub] = useState(lancamento?.sub || "");
  const [contaId, setContaId] = useState(lancamento?.conta_id || "");
  const [cartaoId, setCartaoId] = useState(lancamento?.cartao_id || "");
  const [pago, setPago] = useState(lancamento?.pago ?? true);
  // Parcelamento
  const [parcelado, setParcelado] = useState(false);
  const [nParcelas, setNParcelas] = useState(2);
  const [salvando, setSalvando] = useState(false);

  const valorNum = parseInt(valorCts || "0", 10) / 100;
  const valorParcela = parcelado && nParcelas > 1 ? valorNum / nParcelas : valorNum;

  const catsDoTipo = categorias.filter(c => c.tipo === tipo);
  const cats1 = [...new Set(catsDoTipo.map(c => c.cat))].sort();
  const subs = cat
    ? [...new Set(catsDoTipo.filter(c => c.cat === cat && c.sub).map(c => c.sub as string))].sort()
    : [];

  async function salvar() {
    if (!valorCts || !data || !cat) return;
    setSalvando(true);
    const supabase = createClient();

    if (lancamento?.id) {
      // Edição simples
      const payload = {
        tipo, valor: valorNum, descricao: descricao || null, data,
        cat, sub: sub || null, subsub: null,
        conta_id: contaId || null,
        cartao_id: tipo === "despesa" ? (cartaoId || null) : null,
        pago,
      } as Record<string, unknown>;

      const contaAnterior = lancamento.conta_id;
      const contaNova = contaId || null;
      const valorAnterior = Number(lancamento.valor);
      const tipoAnterior = lancamento.tipo;

      await supabase.from("lancamentos").update(payload).eq("id", lancamento.id);

      if (contaAnterior && lancamento.pago && !lancamento.cartao_id) {
        const contaObj = contas.find(c => c.id === contaAnterior);
        if (contaObj) {
          const reverter = tipoAnterior === "receita" ? -valorAnterior : valorAnterior;
          await supabase.from("contas").update({ saldo: Number(contaObj.saldo) + reverter } as Record<string, unknown>).eq("id", contaAnterior);
        }
      }
      if (contaNova && pago && !cartaoId) {
        const { data: contaAtual } = await supabase.from("contas").select("saldo").eq("id", contaNova).single();
        const saldoAtual = Number((contaAtual as Record<string, unknown>)?.saldo ?? 0);
        const delta = tipo === "receita" ? valorNum : -valorNum;
        await supabase.from("contas").update({ saldo: saldoAtual + delta } as Record<string, unknown>).eq("id", contaNova);
      }
    } else {
      // Inserção nova — com ou sem parcelamento
      const ehCartao = !!cartaoId;
      const qtd = parcelado && nParcelas > 1 ? nParcelas : 1;
      const grupoId = qtd > 1 ? `grp_${Date.now().toString(36)}` : null;

      const lancs: Record<string, unknown>[] = [];
      for (let i = 0; i < qtd; i++) {
        const d = new Date(data + "T00:00:00");
        d.setMonth(d.getMonth() + i);
        const dataISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const descFinal = qtd > 1 ? `${descricao || cat} (${i + 1}/${qtd})` : (descricao || null);
        lancs.push({
          workspace_id: workspaceId,
          tipo,
          valor: qtd > 1 ? valorParcela : valorNum,
          descricao: descFinal,
          data: dataISO,
          cat, sub: sub || null, subsub: null,
          conta_id: ehCartao ? null : (contaId || null),
          cartao_id: ehCartao ? cartaoId : null,
          pago: ehCartao ? false : pago,
          fiscal: "", rec_id: null,
          parcela_num: qtd > 1 ? i + 1 : null,
          parcela_total: qtd > 1 ? qtd : null,
          grupo_parcelamento: grupoId,
        });
      }

      await supabase.from("lancamentos").insert(lancs);

      // Ajusta saldo da conta (só para o primeiro lançamento, valor total)
      if (!ehCartao && contaId && pago) {
        const contaObj = contas.find(c => c.id === contaId);
        if (contaObj) {
          const delta = tipo === "receita" ? valorNum : -valorNum;
          await supabase.from("contas").update({ saldo: Number(contaObj.saldo) + delta } as Record<string, unknown>).eq("id", contaId);
        }
      }
    }

    onSalvo();
    fechar();
    setSalvando(false);
  }

  const modoEdicao = !!lancamento;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          maxHeight: "85vh",
        }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">{modoEdicao ? "Editar lançamento" : "Novo lançamento"}</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-4 flex flex-col gap-3" style={{ minHeight: 0, flex: "1 1 auto" }}>
          <div className="grid grid-cols-2 gap-2">
            {(["receita", "despesa"] as const).map(t => (
              <button key={t} onClick={() => { setTipo(t); setCat(""); setSub(""); setParcelado(false); }}
                className="py-2 rounded-xl text-sm font-medium"
                style={{
                  background: tipo === t ? (t === "receita" ? "#4caf82" : "var(--danger)") : "var(--surface2)",
                  color: tipo === t ? "#fff" : "var(--text-muted)", border: "1px solid var(--border)",
                }}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>

          <label style={lbl}>
            {parcelado && nParcelas > 1 ? `Valor total (${nParcelas}x de ${brl(valorParcela)})` : "Valor (R$)"}
            <InputValor value={valorCts} onChange={setValorCts} style={inp} autoFocus />
          </label>

          <label style={lbl}>
            Descrição
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Supermercado" style={inp} />
          </label>

          <label style={lbl}>
            Data {parcelado && nParcelas > 1 ? "(1ª parcela)" : ""}
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label style={lbl}>
              Categoria
              <select value={cat} onChange={e => { setCat(e.target.value); setSub(""); }} style={inp}>
                <option value="">Selecione…</option>
                {cats1.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={lbl}>
              Subcategoria
              <select value={sub} onChange={e => setSub(e.target.value)} style={inp} disabled={subs.length === 0}>
                <option value="">{subs.length === 0 ? "—" : "Opcional"}</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {tipo === "despesa" && cartoes.length > 0 && (
            <label style={lbl}>
              Cartão (opcional)
              <select value={cartaoId} onChange={e => setCartaoId(e.target.value)} style={inp}>
                <option value="">— Débito / Direto —</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          {!cartaoId && contas.length > 0 && (
            <label style={lbl}>
              Conta
              <select value={contaId} onChange={e => setContaId(e.target.value)} style={inp}>
                <option value="">— Selecione —</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          {tipo === "despesa" && !cartaoId && !modoEdicao && (
            <button onClick={() => setPago(v => !v)}
              className="flex items-center gap-2 py-2 px-3 rounded-xl text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: pago ? "var(--primary)" : "var(--surface)", border: `1px solid ${pago ? "var(--primary)" : "var(--border)"}` }}>
                {pago && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
              </span>
              Pago / já debitado
            </button>
          )}

          {/* ——— PARCELAMENTO (só para nova despesa) ——— */}
          {!modoEdicao && tipo === "despesa" && (
            <div className="flex flex-col gap-2">
              <button onClick={() => setParcelado(v => !v)}
                className="flex items-center gap-2 py-2 px-3 rounded-xl text-sm"
                style={{ background: parcelado ? "rgba(42,138,114,0.08)" : "var(--surface2)", border: `1px solid ${parcelado ? "var(--primary)" : "var(--border)"}`, color: "var(--text)" }}>
                <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: parcelado ? "var(--primary)" : "var(--surface)", border: `1px solid ${parcelado ? "var(--primary)" : "var(--border)"}` }}>
                  {parcelado && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                </span>
                Compra parcelada
              </button>

              {parcelado && (
                <div className="flex flex-col gap-2 px-3 py-3 rounded-xl" style={{ background: "rgba(42,138,114,0.06)", border: "1px solid rgba(42,138,114,0.2)" }}>
                  <label style={lbl}>
                    Número de parcelas
                    <input
                      type="number" min={2} max={60} value={nParcelas}
                      onChange={e => setNParcelas(Math.max(2, Math.min(60, Number(e.target.value) || 2)))}
                      style={inp}
                    />
                  </label>
                  {valorNum > 0 && (
                    <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>Valor por parcela</span>
                      <span className="font-semibold" style={{ color: "var(--primary)" }}>{brl(valorParcela)}</span>
                    </div>
                  )}
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Serão criados <b style={{ color: "var(--text)" }}>{nParcelas} lançamentos</b>, um por mês a partir de {data ? formatData(data) : "—"}.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={salvar} disabled={salvando || !valorCts || !data || !cat}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {salvando
              ? "Salvando…"
              : !cat
                ? "Escolha uma categoria"
                : modoEdicao
                  ? "Salvar alterações"
                  : parcelado && nParcelas > 1
                    ? `Criar ${nParcelas} parcelas`
                    : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// —— Modal de edição de parcelas em lote ——
function ModalEdicaoParcelas({ lancamento, fechar, onSalvo, categorias }: {
  lancamento: Lancamento & { grupo_parcelamento?: string | null };
  fechar: () => void;
  onSalvo: () => void;
  categorias: CategoriaRow[];
}) {
  const [modo, setModo] = useState<null | "esta" | "todas" | "futuras">(null);
  const [cat, setCat] = useState(lancamento.cat || "");
  const [sub, setSub] = useState(lancamento.sub || "");
  const [descricao, setDescricao] = useState(lancamento.descricao || "");
  const [salvando, setSalvando] = useState(false);

  const catsDoTipo = categorias.filter(c => c.tipo === lancamento.tipo);
  const cats1 = [...new Set(catsDoTipo.map(c => c.cat))].sort();
  const subs = cat ? [...new Set(catsDoTipo.filter(c => c.cat === cat && c.sub).map(c => c.sub as string))].sort() : [];

  const temGrupo = !!(lancamento as Record<string, unknown>).grupo_parcelamento;

  async function aplicar() {
    if (!modo) return;
    setSalvando(true);
    const supabase = createClient();
    const upd: Record<string, unknown> = { cat, sub: sub || null, descricao: descricao || null };

    if (modo === "esta" || !temGrupo) {
      await supabase.from("lancamentos").update(upd).eq("id", lancamento.id);
    } else if (modo === "todas") {
      const grupo = (lancamento as Record<string, unknown>).grupo_parcelamento as string;
      await supabase.from("lancamentos").update(upd).eq("grupo_parcelamento", grupo);
    } else if (modo === "futuras") {
      const grupo = (lancamento as Record<string, unknown>).grupo_parcelamento as string;
      const numAtual = lancamento.parcela_num ?? 0;
      await supabase.from("lancamentos").update(upd)
        .eq("grupo_parcelamento", grupo)
        .gte("parcela_num", numAtual);
    }

    onSalvo();
    fechar();
    setSalvando(false);
  }

  async function excluir() {
    if (!modo) return;
    if (!confirm("Confirmar exclusão?")) return;
    setSalvando(true);
    const supabase = createClient();
    if (modo === "esta" || !temGrupo) {
      await supabase.from("lancamentos").delete().eq("id", lancamento.id);
    } else if (modo === "todas") {
      const grupo = (lancamento as Record<string, unknown>).grupo_parcelamento as string;
      await supabase.from("lancamentos").delete().eq("grupo_parcelamento", grupo);
    } else if (modo === "futuras") {
      const grupo = (lancamento as Record<string, unknown>).grupo_parcelamento as string;
      const numAtual = lancamento.parcela_num ?? 0;
      await supabase.from("lancamentos").delete()
        .eq("grupo_parcelamento", grupo)
        .gte("parcela_num", numAtual);
    }
    onSalvo();
    fechar();
    setSalvando(false);
  }

  const eParcela = lancamento.parcela_num !== null && lancamento.parcela_total !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-12 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="font-semibold">Editar lançamento</h3>
            {eParcela && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Parcela {lancamento.parcela_num}/{lancamento.parcela_total}</p>}
          </div>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {eParcela && temGrupo && !modo && (
          <div className="p-5 flex flex-col gap-3">
            <p className="text-sm font-medium">Aplicar alterações a…</p>
            {[
              { v: "esta" as const, label: "Só esta parcela", sub: `Parcela ${lancamento.parcela_num}/${lancamento.parcela_total}` },
              { v: "futuras" as const, label: "Esta e as próximas", sub: `Da parcela ${lancamento.parcela_num} em diante` },
              { v: "todas" as const, label: "Todas as parcelas", sub: `Todas as ${lancamento.parcela_total} parcelas` },
            ].map(op => (
              <button key={op.v} onClick={() => setModo(op.v)}
                className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-colors"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <span className="text-sm font-medium">{op.label}</span>
                <span className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{op.sub}</span>
              </button>
            ))}
          </div>
        )}

        {(!eParcela || !temGrupo || modo) && (
          <div className="overflow-y-auto p-5 flex flex-col gap-3" style={{ minHeight: 0, flex: "1 1 auto" }}>
            {modo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(42,138,114,0.08)", border: "1px solid rgba(42,138,114,0.2)", color: "var(--primary)" }}>
                <Layers size={13} />
                {modo === "esta" && "Editando só esta parcela"}
                {modo === "futuras" && `Editando parcelas ${lancamento.parcela_num} a ${lancamento.parcela_total}`}
                {modo === "todas" && `Editando todas as ${lancamento.parcela_total} parcelas`}
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              Descrição
              <input value={descricao} onChange={e => setDescricao(e.target.value)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14 }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Categoria
                <select value={cat} onChange={e => { setCat(e.target.value); setSub(""); }}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14 }}>
                  <option value="">Selecione…</option>
                  {cats1.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                Subcategoria
                <select value={sub} onChange={e => setSub(e.target.value)} disabled={subs.length === 0}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14 }}>
                  <option value="">{subs.length === 0 ? "—" : "Opcional"}</option>
                  {subs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {(!eParcela || !temGrupo || modo) && (
          <div className="flex gap-2 px-5 pb-5 pt-3 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={excluir} disabled={salvando}
              className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
              Excluir
            </button>
            <button onClick={aplicar} disabled={salvando || !cat}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--primary)", color: "#fff" }}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// —— Componente principal ——
export default function LancamentosClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [mes, setMes] = useState(mesAtual());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRow[]>([]);
  const [catMeta, setCatMeta] = useState<CatMeta[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEd, setLancamentoEd] = useState<Lancamento | null>(null);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);
  const [contrachequeAberto, setContrachequeAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aba, setAba] = useState<"todos" | "receita" | "despesa">("todos");

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: lancs }, { data: cts }, { data: carts }, { data: cat }, { data: cm }] = await Promise.all([
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId).order("data", { ascending: false }),
      supabase.from("contas").select("*").eq("workspace_id", workspaceId),
      supabase.from("cartoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("ordem"),
      supabase.from("cat_meta").select("*").eq("workspace_id", workspaceId),
    ]);
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContas((cts || []) as unknown as Conta[]);
    setCartoes((carts || []) as unknown as Cartao[]);
    setCategorias((cat || []) as unknown as CategoriaRow[]);
    setCatMeta((cm || []) as unknown as CatMeta[]);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function deletar(id: string) {
    if (!confirm("Remover este lançamento?")) return;
    await createClient().from("lancamentos").delete().eq("id", id);
    setLancamentos(l => l.filter(x => x.id !== id));
  }

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function abrirNovo() { setLancamentoEd(null); setModalAberto(true); }
  function abrirEditar(l: Lancamento) {
    setLancamentoEd(l);
    if (l.parcela_num !== null && l.parcela_total !== null) {
      setModalParcelasAberto(true);
    } else {
      setModalAberto(true);
    }
  }

  const [ano, mesNum] = mes.split("-").map(Number);
  const labelMes = `${MESES[mesNum - 1]}/${ano}`;
  const doMes = lancamentos.filter(l => mesDoLanc(l.data) === mes);
  const ql = searchQuery.toLowerCase().trim();
  const filtrados = doMes.filter(l => aba === "todos" || l.tipo === aba).filter(l => matchSearch(l, ql));

  const totalReceitas = doMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = doMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);

  const catsObj = { receita: {} as Record<string, string[]>, despesa: {} as Record<string, string[]> };
  categorias.forEach(c => {
    if (c.tipo === "receita" || c.tipo === "despesa") {
      if (!catsObj[c.tipo][c.cat]) catsObj[c.tipo][c.cat] = [];
      if (c.sub && !catsObj[c.tipo][c.cat].includes(c.sub)) {
        catsObj[c.tipo][c.cat].push(c.sub);
      }
    }
  });

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <button onClick={() => mudarMes(-1)} style={{ color: "var(--text-muted)" }}><ChevronLeft size={20} /></button>
        <span className="font-medium capitalize text-sm">{labelMes}</span>
        <button onClick={() => mudarMes(1)} style={{ color: "var(--text-muted)" }}><ChevronRight size={20} /></button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} style={{ color: "#4caf82" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Receitas</span>
          </div>
          <p className="font-bold" style={{ color: "#4caf82" }}>+{brl(totalReceitas)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} style={{ color: "var(--danger)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Despesas</span>
          </div>
          <p className="font-bold" style={{ color: "var(--danger)" }}>−{brl(totalDespesas)}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={abrirNovo}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--primary)", color: "#fff" }}>
            <Plus size={16} /> Novo lançamento
          </button>
          <button onClick={() => setContrachequeAberto(true)}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
            <FileText size={16} /> Contracheque
          </button>
        </div>
        <button onClick={() => setImportarAberto(true)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium w-full"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
          <Upload size={16} /> Importar Fatura CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface2)" }}>
        {([["todos", "Todos"], ["receita", "Receitas"], ["despesa", "Despesas"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setAba(v)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: aba === v ? "var(--surface)" : "transparent", color: aba === v ? "var(--text)" : "var(--text-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="flex flex-col gap-1">
        <CampoBusca value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por descrição, categoria, data ou valor…" />
        {ql && (
          <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>
            {filtrados.length} resultado(s)
            {filtrados.length > 0 ? ` · total ${brl(filtrados.reduce((s, l) => s + Number(l.valor), 0))}` : ""}
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {filtrados.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            {ql ? `Nenhum resultado para "${searchQuery}".` : "Nenhum lançamento neste mês."}
          </p>
        ) : (
          filtrados.map(l => (
            <ItemLanc key={l.id} l={l} catMeta={catMeta} onEditar={abrirEditar} onDeletar={deletar} />
          ))
        )}
      </div>

      {/* Modais */}
      {modalAberto && (
        <ModalLanc
          workspaceId={workspaceId!}
          contas={contas} cartoes={cartoes} categorias={categorias}
          lancamento={lancamentoEd}
          fechar={() => setModalAberto(false)}
          onSalvo={carregar}
        />
      )}
      {modalParcelasAberto && lancamentoEd && (
        <ModalEdicaoParcelas
          lancamento={lancamentoEd}
          fechar={() => { setModalParcelasAberto(false); setLancamentoEd(null); }}
          onSalvo={carregar}
          categorias={categorias}
        />
      )}
      {contrachequeAberto && workspaceId && (
        <RegistrarContracheque workspaceId={workspaceId} fechar={() => setContrachequeAberto(false)} onSalvo={carregar} />
      )}
      {importarAberto && workspaceId && (
        <ImportarFatura
          workspaceId={workspaceId}
          cartoes={cartoes}
          lancamentos={lancamentos}
          cats={catsObj}
          fechar={() => setImportarAberto(false)}
          onSalvo={carregar}
        />
      )}
    </div>
  );
}
