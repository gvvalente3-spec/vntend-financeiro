"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, Trash2, Plus, RefreshCw, Shield, Tag, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Perfil } from "@/types/database";

// ——— helpers ———
const inputCls = "rounded-lg px-3 py-2 text-sm outline-none w-full";
const inputStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };
const labelCls = "flex flex-col gap-1 text-xs";
const labelColor = { color: "var(--text-muted)" };

const POSTOS = [
  "Soldado", "Cabo", "3º Sargento", "2º Sargento", "1º Sargento", "Subtenente",
  "Aspirante a Oficial", "2º Tenente", "1º Tenente", "Capitão",
  "Major", "Tenente-Coronel", "Coronel",
  "General de Brigada", "General de Divisão", "General de Exército",
];

const GLE_CATS = ["nenhuma", "A", "B", "C"];

// Percentuais padrão do EB (podem ser sobrescritos)
const DEFAULTS: Partial<Perfil> = {
  habilitacao_pct: 0,
  adicional_militar_pct: 0,
  comp_disp_mil_pct: 10,
  compensacao_organica: false,
  compensacao_pct: 37.5,
  gle_categoria: "nenhuma",
  fusex_pct: 3.5,
  pensao_pct: 7.5,
  dependentes: 0,
  dependentes_pre_escolar: 0,
};

interface PerfilForm extends Partial<Perfil> {
  pnr_ativo?: boolean;
  pnr_taxa?: number;
}

export default function AjustesClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const supabase = createClient();

  const [perfil, setPerfil] = useState<PerfilForm>({ ...DEFAULTS });
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string; icone?: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [zerarConfirm, setZerarConfirm] = useState(false);
  const [zerando, setZerando] = useState(false);

  // Estado para nova categoria
  const [novaCatNome, setNovaCatNome] = useState("");
  const [novaCatTipo, setNovaCatTipo] = useState<"despesa" | "receita">("despesa");
  const [novaCatIcone, setNovaCatIcone] = useState("");

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    const [{ data: p }, { data: cats }] = await Promise.all([
      supabase.from("perfil").select("*").eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("nome"),
    ]);
    if (p) setPerfil({ ...DEFAULTS, ...p } as PerfilForm);
    if (cats) setCategorias(cats);
  }, [workspaceId]);

  useEffect(() => { if (!wsLoading) carregar(); }, [wsLoading, carregar]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500); };

  // ——— Salvar perfil ———
  const salvarPerfil = async () => {
    if (!workspaceId) return;
    setSalvando(true);
    const payload = {
      workspace_id: workspaceId,
      posto: perfil.posto,
      soldo_override: perfil.soldo_override || null,
      habilitacao_pct: Number(perfil.habilitacao_pct) || 0,
      adicional_militar_pct: Number(perfil.adicional_militar_pct) || 0,
      comp_disp_mil_pct: Number(perfil.comp_disp_mil_pct) || 0,
      compensacao_organica: !!perfil.compensacao_organica,
      compensacao_pct: Number(perfil.compensacao_pct) || 0,
      gle_categoria: perfil.gle_categoria || "nenhuma",
      fusex_pct: Number(perfil.fusex_pct) || 0,
      pensao_pct: Number(perfil.pensao_pct) || 0,
      dependentes: Number(perfil.dependentes) || 0,
      dependentes_pre_escolar: Number(perfil.dependentes_pre_escolar) || 0,
      valor_etapa: Number(perfil.valor_etapa) || null,
      pnr_ativo: !!perfil.pnr_ativo,
      pnr_taxa: Number(perfil.pnr_taxa) || 0,
      cc_receitas_extras: perfil.cc_receitas_extras || [],
      cc_descontos_extras: perfil.cc_descontos_extras || [],
    };
    const { error } = await supabase.from("perfil").upsert(payload, { onConflict: "workspace_id" });
    setSalvando(false);
    if (error) flash("Erro ao salvar: " + error.message);
    else flash("✓ Perfil salvo");
  };

  // ——— Categorias ———
  const salvarCategoria = async () => {
    if (!workspaceId || !novaCatNome.trim()) return;
    setSalvandoCat(true);
    const { error } = await supabase.from("categorias").insert({
      workspace_id: workspaceId,
      nome: novaCatNome.trim(),
      tipo: novaCatTipo,
      icone: novaCatIcone.trim() || null,
    });
    setSalvandoCat(false);
    if (!error) {
      setNovaCatNome(""); setNovaCatIcone("");
      carregar();
      flash("✓ Categoria adicionada");
    }
  };

  const removerCategoria = async (id: string) => {
    await supabase.from("categorias").delete().eq("id", id);
    carregar();
  };

  // ——— Zerar app ———
  const zerarApp = async () => {
    if (!workspaceId) return;
    setZerando(true);
    await Promise.all([
      supabase.from("lancamentos").delete().eq("workspace_id", workspaceId),
      supabase.from("contas").delete().eq("workspace_id", workspaceId),
      supabase.from("cartoes").delete().eq("workspace_id", workspaceId),
      supabase.from("investimentos").delete().eq("workspace_id", workspaceId),
      supabase.from("missoes").delete().eq("workspace_id", workspaceId),
      supabase.from("recorrencias").delete().eq("workspace_id", workspaceId),
      supabase.from("contracheques").delete().eq("workspace_id", workspaceId),
    ]);
    setZerando(false);
    setZerarConfirm(false);
    flash("✓ Dados apagados (perfil e categorias mantidos)");
  };

  const set = (field: keyof PerfilForm, value: unknown) =>
    setPerfil(prev => ({ ...prev, [field]: value }));

  if (wsLoading) return (
    <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>
      Carregando…
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">

      {/* Toast */}
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: "var(--primary)", color: "#fff" }}>
          {msg}
        </div>
      )}

      {/* ——— Perfil Militar ——— */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Shield size={16} style={{ color: "var(--primary)" }} />
          <p className="text-sm font-semibold">Perfil Militar</p>
        </div>

        {/* Posto + Soldo */}
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls} style={labelColor}>
            Posto / Graduação
            <select value={perfil.posto || ""} onChange={e => set("posto", e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Selecione…</option>
              {POSTOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className={labelCls} style={labelColor}>
            Soldo manual (R$)
            <input type="number" step="0.01" placeholder="Deixe vazio para usar tabela"
              value={perfil.soldo_override || ""}
              onChange={e => set("soldo_override", e.target.value ? Number(e.target.value) : null)}
              className={inputCls} style={inputStyle} />
          </label>
        </div>

        {/* Percentuais de vencimentos */}
        <p className="text-xs font-medium -mb-2" style={{ color: "var(--text-muted)" }}>Percentuais de vencimentos (%)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls} style={labelColor}>
            Habilitação (%)
            <input type="number" step="0.01" value={perfil.habilitacao_pct ?? ""}
              onChange={e => set("habilitacao_pct", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
          <label className={labelCls} style={labelColor}>
            Adicional Militar (%)
            <input type="number" step="0.01" value={perfil.adicional_militar_pct ?? ""}
              onChange={e => set("adicional_militar_pct", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
          <label className={labelCls} style={labelColor}>
            Comp. Disp. Militar (%)
            <input type="number" step="0.01" value={perfil.comp_disp_mil_pct ?? ""}
              onChange={e => set("comp_disp_mil_pct", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
          <label className={labelCls} style={labelColor}>
            GLE — Categoria
            <select value={perfil.gle_categoria || "nenhuma"} onChange={e => set("gle_categoria", e.target.value)}
              className={inputCls} style={inputStyle}>
              {GLE_CATS.map(c => <option key={c} value={c}>{c === "nenhuma" ? "Sem GLE" : `Cat. ${c} (20%)`}</option>)}
            </select>
          </label>
        </div>

        {/* Compensação Orgânica */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${perfil.compensacao_organica ? "bg-green-500" : "bg-gray-400"}`}
              onClick={() => set("compensacao_organica", !perfil.compensacao_organica)}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${perfil.compensacao_organica ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs" style={labelColor}>Ocupa Compensação Orgânica</span>
          </label>
          {perfil.compensacao_organica && (
            <label className={labelCls} style={labelColor}>
              Percentual de Compensação (%)
              <input type="number" step="0.01" value={perfil.compensacao_pct ?? ""}
                onChange={e => set("compensacao_pct", Number(e.target.value))}
                className={inputCls} style={inputStyle} placeholder="Ex: 37.5" />
            </label>
          )}
        </div>

        {/* Previdência */}
        <p className="text-xs font-medium -mb-2" style={{ color: "var(--text-muted)" }}>Previdência (%)</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls} style={labelColor}>
            FuSEx (%)
            <input type="number" step="0.01" value={perfil.fusex_pct ?? ""}
              onChange={e => set("fusex_pct", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
          <label className={labelCls} style={labelColor}>
            Pensão Militar (%)
            <input type="number" step="0.01" value={perfil.pensao_pct ?? ""}
              onChange={e => set("pensao_pct", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
        </div>

        {/* Dependentes */}
        <p className="text-xs font-medium -mb-2" style={{ color: "var(--text-muted)" }}>Dependentes</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls} style={labelColor}>
            Dependentes (total)
            <input type="number" min="0" value={perfil.dependentes ?? 0}
              onChange={e => set("dependentes", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
          <label className={labelCls} style={labelColor}>
            Dependentes pré-escolares (&lt;7 anos)
            <input type="number" min="0" value={perfil.dependentes_pre_escolar ?? 0}
              onChange={e => set("dependentes_pre_escolar", Number(e.target.value))}
              className={inputCls} style={inputStyle} />
          </label>
        </div>

        {/* Etapa */}
        <label className={labelCls} style={labelColor}>
          Valor da Etapa diária (R$) — usado em Missões
          <input type="number" step="0.01" value={perfil.valor_etapa ?? ""}
            onChange={e => set("valor_etapa", e.target.value ? Number(e.target.value) : null)}
            className={inputCls} style={inputStyle} placeholder="Ex: 220.00" />
        </label>

        {/* ——— PNR ——— */}
        <div className="rounded-xl px-4 py-3 flex flex-col gap-3"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Posto de Natureza Real (PNR)</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${perfil.pnr_ativo ? "bg-green-500" : "bg-gray-400"}`}
              onClick={() => set("pnr_ativo", !perfil.pnr_ativo)}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${perfil.pnr_ativo ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs" style={labelColor}>Ocupa PNR (desconto de taxa)</span>
          </label>
          {perfil.pnr_ativo && (
            <label className={labelCls} style={labelColor}>
              Taxa PNR mensal (R$)
              <input type="number" step="0.01" value={perfil.pnr_taxa ?? ""}
                onChange={e => set("pnr_taxa", Number(e.target.value))}
                className={inputCls} style={inputStyle} placeholder="Ex: 150.00" />
            </label>
          )}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Quando ativo, a taxa PNR é descontada automaticamente no Simulador de Contracheque.
          </p>
        </div>

        {/* Botão salvar */}
        <button onClick={salvarPerfil} disabled={salvando}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity"
          style={{ background: "var(--primary)", color: "#fff", opacity: salvando ? 0.6 : 1 }}>
          <Save size={15} />
          {salvando ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>

      {/* ——— Categorias ——— */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Tag size={16} style={{ color: "var(--primary)" }} />
          <p className="text-sm font-semibold">Categorias</p>
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-1.5">
          {categorias.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>Nenhuma categoria cadastrada.</p>
          )}
          {categorias.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                {cat.icone && <span>{cat.icone}</span>}
                <span className="text-sm">{cat.nome}</span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: cat.tipo === "receita" ? "rgba(76,175,130,0.12)" : "rgba(239,68,68,0.1)",
                    color: cat.tipo === "receita" ? "var(--primary)" : "var(--danger)"
                  }}>
                  {cat.tipo}
                </span>
              </div>
              <button onClick={() => removerCategoria(cat.id)} style={{ color: "var(--danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Nova categoria */}
        <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-medium" style={labelColor}>Nova categoria</p>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls} style={labelColor}>
              Nome
              <input type="text" value={novaCatNome} onChange={e => setNovaCatNome(e.target.value)}
                placeholder="Ex: Alimentação" className={inputCls} style={inputStyle} />
            </label>
            <label className={labelCls} style={labelColor}>
              Ícone (emoji)
              <input type="text" value={novaCatIcone} onChange={e => setNovaCatIcone(e.target.value)}
                placeholder="🍔" className={inputCls} style={inputStyle} />
            </label>
          </div>
          <label className={labelCls} style={labelColor}>
            Tipo
            <select value={novaCatTipo} onChange={e => setNovaCatTipo(e.target.value as "despesa" | "receita")}
              className={inputCls} style={inputStyle}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </label>
          <button onClick={salvarCategoria} disabled={salvandoCat || !novaCatNome.trim()}
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", opacity: !novaCatNome.trim() ? 0.5 : 1 }}>
            <Plus size={14} />
            {salvandoCat ? "Adicionando…" : "Adicionar categoria"}
          </button>
        </div>
      </div>

      {/* ——— Dados / Zerar App ——— */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
          <p className="text-sm font-semibold">Dados</p>
        </div>

        {!zerarConfirm ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Apaga lançamentos, contas, cartões, investimentos, missões, recorrências e contracheques.
              O perfil e as categorias são mantidos.
            </p>
            <button onClick={() => setZerarConfirm(true)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
              <Trash2 size={15} />
              Zerar todos os dados
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid var(--danger)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
              ⚠️ Confirmar exclusão de todos os dados?
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setZerarConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                Cancelar
              </button>
              <button onClick={zerarApp} disabled={zerando}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--danger)", color: "#fff", opacity: zerando ? 0.6 : 1 }}>
                {zerando ? "Apagando…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refresh */}
      <button onClick={carregar} className="flex items-center justify-center gap-1.5 py-2 text-xs rounded-xl"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
        <RefreshCw size={12} />
        Recarregar
      </button>

    </div>
  );
}
