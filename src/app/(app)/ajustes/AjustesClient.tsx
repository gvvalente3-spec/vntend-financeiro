"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, FolderTree, ChevronDown, Plus, Trash2, Pencil, X, LogOut, Tag, Home, Car, Utensils, ShoppingCart, Heart, Plane, Gift, Smartphone, Dumbbell, GraduationCap, PiggyBank, Briefcase, Zap, Coffee, DollarSign, Baby, Wrench, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CATS_DEFAULT, type CatStore } from "@/lib/utils";
import { POSTOS } from "@/lib/missao";
import type { Perfil } from "@/types/database";
import { useRouter } from "next/navigation";

const PALETA = ["#2a8a72","#c9952d","#c0492f","#1d5c4f","#3b6ea5","#8a5cb8","#d17b3f","#b8456b","#5a7d3a","#6f7d77"];

const ICONES_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  tag: Tag, casa: Home, carro: Car, comida: Utensils, mercado: ShoppingCart,
  saude: Heart, viagem: Plane, presente: Gift, fone: Smartphone,
  academia: Dumbbell, escola: GraduationCap, cofre: PiggyBank, trabalho: Briefcase,
  energia: Zap, cafe: Coffee, dinheiro: DollarSign, bebe: Baby, ferramenta: Wrench,
};
const ICONES_KEYS = Object.keys(ICONES_MAP);

const inputStyle = {
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14,
};
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full rounded-xl px-4 py-3 text-sm text-left transition-colors"
      style={{ background: "var(--surface2)", border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}` }}>
      <span style={{ color: "var(--text)" }}>{label}</span>
      <div className="relative w-10 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: checked ? "var(--primary)" : "var(--border)" }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }} />
      </div>
    </button>
  );
}

function Secao({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button className="flex items-center justify-between w-full px-4 py-3" onClick={() => setAberto(v => !v)}>
        <div className="flex items-center gap-2 font-semibold text-sm">{icone}{titulo}</div>
        <ChevronDown size={16} style={{ color: "var(--text-muted)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {aberto && <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: "var(--border)" }}><div className="pt-3" />{children}</div>}
    </div>
  );
}

// ——— Perfil Militar ———
function PerfilMilitar({ workspaceId }: { workspaceId: string }) {
  const [perfil, setPerfil] = useState<Partial<Perfil>>({});
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    createClient().from("perfil").select("*").eq("workspace_id", workspaceId).single()
      .then(({ data }) => { if (data) setPerfil(data as unknown as Perfil); });
  }, [workspaceId]);

  async function salvar() {
    setSalvando(true);
    await createClient().from("perfil").update(perfil as Record<string, unknown>).eq("workspace_id", workspaceId);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function set(campo: string, valor: unknown) {
    setPerfil(p => ({ ...p, [campo]: valor }));
  }

  return (
    <div className="flex flex-col gap-3">
      <label style={labelStyle}>
        Posto / graduação
        <select value={perfil.posto || ""} onChange={e => set("posto", e.target.value)} style={inputStyle}>
          <option value="">Selecione…</option>
          {POSTOS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>

      <div className="flex gap-3">
        <label style={{ ...labelStyle, flex: 1 }}>OM<input value={perfil.om || ""} onChange={e => set("om", e.target.value)} placeholder="Ex: 1º BIS" style={inputStyle} /></label>
        <label style={{ ...labelStyle, flex: 1 }}>Cidade<input value={perfil.cidade || ""} onChange={e => set("cidade", e.target.value)} placeholder="Ex: Manaus" style={inputStyle} /></label>
      </div>

      <label style={labelStyle}>
        Localidade especial (GLE)
        <select value={perfil.gle_categoria || "nenhuma"} onChange={e => set("gle_categoria", e.target.value)} style={inputStyle}>
          <option value="nenhuma">Não faz jus</option>
          <option value="A">Categoria A (20%)</option>
          <option value="B">Categoria B (10%)</option>
        </select>
      </label>

      <div className="flex gap-3">
        <label style={{ ...labelStyle, flex: 1 }}>Dependentes<input type="number" min={0} value={perfil.dependentes ?? 0} onChange={e => set("dependentes", Number(e.target.value))} style={inputStyle} /></label>
        <label style={{ ...labelStyle, flex: 1 }}>Dep. &lt;7 anos<input type="number" min={0} value={perfil.dependentes_pre_escolar ?? 0} onChange={e => set("dependentes_pre_escolar", Number(e.target.value))} style={inputStyle} /></label>
      </div>

      <Toggle label="Recebo compensação orgânica" checked={!!perfil.compensacao_organica} onChange={v => set("compensacao_organica", v)} />
      {perfil.compensacao_organica && (
        <label style={labelStyle}>
          Percentual da compensação orgânica
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={100} step={1} value={perfil.compensacao_pct ?? 20} onChange={e => set("compensacao_pct", Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
            <span style={{ color: "var(--text-muted)" }}>%</span>
          </div>
        </label>
      )}

      <Toggle label="Exerço função com gratificação de representação" checked={!!perfil.grat_representacao} onChange={v => set("grat_representacao", v)} />

      <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Parâmetros do contracheque (calibrados jan/fev 2026)</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { campo: "habilitacao_pct", label: "Adicional habilitação %" },
            { campo: "adicional_militar_pct", label: "Adicional militar %" },
            { campo: "comp_disp_mil_pct", label: "Comp. disponib. mil. %" },
            { campo: "fusex_pct", label: "FuSEx %" },
            { campo: "pensao_pct", label: "Pensão Militar %" },
          ].map(({ campo, label }) => (
            <label key={campo} style={labelStyle}>
              {label}
              <input type="number" step={0.5} value={(perfil as Record<string, unknown>)[campo] as number ?? 0}
                onChange={e => set(campo, Number(e.target.value))} style={inputStyle} />
            </label>
          ))}
        </div>
      </div>

      <div className="pt-1 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-medium">Valor da etapa de alimentação</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Auxílio = nº etapas × este valor (R$13,50 desde jul/2025)</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>R$</span>
          <input type="number" step="0.01"
            value={perfil.valor_etapa ?? 13.5}
            onChange={e => set("valor_etapa", Number(e.target.value))}
            className="text-sm font-semibold text-right rounded-lg px-2 py-1 w-20 outline-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
      </div>

      <button onClick={salvar} disabled={salvando}
        className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
        style={{ background: salvo ? "#4caf82" : "var(--primary)", color: "#fff" }}>
        {salvando ? "Salvando…" : salvo ? "Salvo ✓" : "Salvar perfil"}
      </button>
    </div>
  );
}

// ——— Categorias ———
function Categorias({ workspaceId }: { workspaceId: string }) {
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [cats, setCats] = useState<CatStore>(CATS_DEFAULT);
  const [catMeta, setCatMeta] = useState<Record<string, { cor: string; icone: string }>>({});
  const [aberta, setAberta] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<{ cat: string; nome: string } | null>(null);
  const [novaSubMap, setNovaSubMap] = useState<Record<string, string>>({});
  const [novaSubsubMap, setNovaSubsubMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("categorias").select("*").eq("workspace_id", workspaceId).order("ordem"),
      supabase.from("cat_meta").select("*").eq("workspace_id", workspaceId),
    ]).then(([{ data: catRows }, { data: metaRows }]) => {
      if (catRows && catRows.length > 0) {
        const tree: CatStore = { despesa: {}, receita: {} };
        for (const r of catRows as Array<{ tipo: string; cat: string; sub: string | null; subsub: string | null }>) {
          const t = r.tipo as "despesa" | "receita";
          if (!tree[t][r.cat]) tree[t][r.cat] = {};
          if (r.sub) {
            if (!tree[t][r.cat][r.sub]) tree[t][r.cat][r.sub] = [];
            if (r.subsub) (tree[t][r.cat][r.sub] as string[]).push(r.subsub);
          }
        }
        setCats(tree);
      }
      if (metaRows && metaRows.length > 0) {
        const m: Record<string, { cor: string; icone: string }> = {};
        for (const r of metaRows as Array<{ chave: string; cor: string; icone: string }>) {
          m[r.chave] = { cor: r.cor, icone: r.icone };
        }
        setCatMeta(m);
      }
    });
  }, [workspaceId]);

  async function salvarMeta(chave: string, cor: string, icone: string) {
    const supabase = createClient();
    const novo = { workspace_id: workspaceId, chave, cor, icone };
    await supabase.from("cat_meta").upsert(novo as Record<string, unknown>, { onConflict: "workspace_id,chave" });
    setCatMeta(m => ({ ...m, [chave]: { cor, icone } }));
  }

  async function sincronizar(novaTree: CatStore) {
    setCats(novaTree);
    const supabase = createClient();
    await supabase.from("categorias").delete().eq("workspace_id", workspaceId);
    const rows: Record<string, unknown>[] = [];
    let ordem = 0;
    for (const t of ["despesa", "receita"] as const) {
      for (const cat of Object.keys(novaTree[t])) {
        rows.push({ workspace_id: workspaceId, tipo: t, cat, sub: null, subsub: null, ordem: ordem++ });
        for (const sub of Object.keys(novaTree[t][cat])) {
          rows.push({ workspace_id: workspaceId, tipo: t, cat, sub, subsub: null, ordem: ordem++ });
          for (const ss of (novaTree[t][cat][sub] as string[])) {
            rows.push({ workspace_id: workspaceId, tipo: t, cat, sub, subsub: ss, ordem: ordem++ });
          }
        }
      }
    }
    if (rows.length > 0) await supabase.from("categorias").insert(rows);
  }

  function clone(): CatStore { return JSON.parse(JSON.stringify(cats)); }

  function addCat() {
    const nome = prompt("Nome da nova categoria:")?.trim();
    if (!nome) return;
    const c = clone();
    if (!c[tipo][nome]) c[tipo][nome] = {};
    sincronizar(c);
  }

  function delCat(cat: string) {
    if (!confirm(`Remover "${cat}" e todas as subcategorias?`)) return;
    const c = clone();
    delete c[tipo][cat];
    sincronizar(c);
  }

  async function renameCat(oldNome: string, novoNome: string) {
    if (!novoNome.trim() || novoNome === oldNome) { setRenomeando(null); return; }
    const c = clone();
    c[tipo][novoNome] = c[tipo][oldNome];
    delete c[tipo][oldNome];
    sincronizar(c);
    setRenomeando(null);

    // Propaga o novo nome para o histórico — sem isso, lançamentos antigos
    // ficariam "órfãos" apontando para a categoria com o nome antigo
    const supabase = createClient();
    await Promise.all([
      supabase.from("lancamentos").update({ cat: novoNome } as Record<string, unknown>)
        .eq("workspace_id", workspaceId).eq("tipo", tipo).eq("cat", oldNome),
      supabase.from("recorrencias").update({ cat: novoNome } as Record<string, unknown>)
        .eq("workspace_id", workspaceId).eq("tipo", tipo).eq("cat", oldNome),
      supabase.from("orcamentos").update({ cat: novoNome } as Record<string, unknown>)
        .eq("workspace_id", workspaceId).eq("cat", oldNome),
      supabase.from("cat_meta").update({ chave: novoNome } as Record<string, unknown>)
        .eq("workspace_id", workspaceId).eq("chave", oldNome),
    ]);
  }

  function addSub(cat: string) {
    const nome = novaSubMap[cat]?.trim();
    if (!nome) return;
    const c = clone();
    if (!c[tipo][cat][nome]) c[tipo][cat][nome] = [];
    sincronizar(c);
    setNovaSubMap(m => ({ ...m, [cat]: "" }));
  }

  function delSub(cat: string, sub: string) {
    const c = clone();
    delete c[tipo][cat][sub];
    sincronizar(c);
  }

  function addSubsub(cat: string, sub: string) {
    const key = `${cat}:${sub}`;
    const nome = novaSubsubMap[key]?.trim();
    if (!nome) return;
    const c = clone();
    if (!(c[tipo][cat][sub] as string[]).includes(nome)) {
      (c[tipo][cat][sub] as string[]).push(nome);
    }
    sincronizar(c);
    setNovaSubsubMap(m => ({ ...m, [key]: "" }));
  }

  function delSubsub(cat: string, sub: string, ss: string) {
    const c = clone();
    c[tipo][cat][sub] = (c[tipo][cat][sub] as string[]).filter(x => x !== ss);
    sincronizar(c);
  }

  const arvore = cats[tipo];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {(["despesa", "receita"] as const).map(t => (
          <button key={t} onClick={() => { setTipo(t); setAberta(null); }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{ background: tipo === t ? "var(--primary)" : "transparent", color: tipo === t ? "#fff" : "var(--text-muted)" }}>
            {t === "despesa" ? "Despesas" : "Receitas"}
          </button>
        ))}
      </div>

      {Object.keys(arvore).map(cat => {
        const estaRenomeando = renomeando?.cat === cat;
        const subCount = Object.keys(arvore[cat]).length;
        const chave = `${tipo}:${cat}`;
        const meta = catMeta[chave] || { cor: PALETA[0], icone: "tag" };
        const IconeCat = ICONES_MAP[meta.icone] || Tag;
        return (
          <div key={cat} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
              style={{ background: "var(--surface2)" }}
              onClick={() => !estaRenomeando && setAberta(a => a === cat ? null : cat)}>
              <ChevronDown size={15} style={{ color: "var(--text-muted)", transform: aberta === cat ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: meta.cor }}>
                <IconeCat size={12} color="#fff" />
              </div>
              {estaRenomeando ? (
                <input autoFocus value={renomeando.nome}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenomeando({ cat, nome: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") renameCat(cat, renomeando.nome); if (e.key === "Escape") setRenomeando(null); e.stopPropagation(); }}
                  onBlur={() => renameCat(cat, renomeando.nome)}
                  className="flex-1 text-sm font-semibold outline-none rounded px-1"
                  style={{ background: "var(--surface)", border: "1px solid var(--primary)", color: "var(--text)" }} />
              ) : (
                <span className="flex-1 text-sm font-semibold">{cat}</span>
              )}
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{subCount} sub</span>
              <button onClick={e => { e.stopPropagation(); setRenomeando({ cat, nome: cat }); }} style={{ color: "var(--text-muted)" }}><Pencil size={13} /></button>
              <button onClick={e => { e.stopPropagation(); delCat(cat); }} style={{ color: "var(--text-muted)" }}><Trash2 size={13} /></button>
            </div>

            {aberta === cat && (
              <div className="px-3 pb-3 flex flex-col gap-2 pt-2">
                <div className="flex flex-col gap-1.5 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cor</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PALETA.map(cor => (
                      <button key={cor} onClick={() => salvarMeta(chave, cor, meta.icone)}
                        className="w-6 h-6 rounded-full transition-transform"
                        style={{ background: cor, transform: meta.cor === cor ? "scale(1.25)" : "scale(1)", outline: meta.cor === cor ? `2px solid ${cor}` : "none", outlineOffset: 2 }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium mt-1" style={{ color: "var(--text-muted)" }}>Ícone</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ICONES_KEYS.map(key => {
                      const Ic = ICONES_MAP[key];
                      return (
                        <button key={key} onClick={() => salvarMeta(chave, meta.cor, key)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ background: meta.icone === key ? meta.cor : "var(--surface2)", border: `1px solid ${meta.icone === key ? meta.cor : "var(--border)"}` }}>
                          <Ic size={14} color={meta.icone === key ? "#fff" : "var(--text-muted)"} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {Object.keys(arvore[cat]).map(sub => (
                  <div key={sub}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium flex-1" style={{ color: "var(--text-muted)" }}>{sub}</span>
                      <button onClick={() => delSub(cat, sub)} style={{ color: "var(--text-muted)" }}><Trash2 size={12} /></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {(arvore[cat][sub] as string[]).map(ss => (
                        <span key={ss} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                          {ss}
                          <button onClick={() => delSubsub(cat, sub, ss)} style={{ color: "var(--text-muted)", lineHeight: 0 }}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input value={novaSubsubMap[`${cat}:${sub}`] || ""} placeholder="+ sub-sub"
                        onChange={e => setNovaSubsubMap(m => ({ ...m, [`${cat}:${sub}`]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") addSubsub(cat, sub); }}
                        className="text-xs rounded-lg px-2 py-1 flex-1 outline-none"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                      <button onClick={() => addSubsub(cat, sub)}
                        className="px-2 rounded-lg text-xs"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-1 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <input value={novaSubMap[cat] || ""} placeholder="Nova subcategoria…"
                    onChange={e => setNovaSubMap(m => ({ ...m, [cat]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") addSub(cat); }}
                    className="text-xs rounded-lg px-2 py-1.5 flex-1 outline-none"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  <button onClick={() => addSub(cat)}
                    className="px-3 rounded-lg text-xs font-medium"
                    style={{ background: "var(--primary)", color: "#fff" }}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addCat}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
        style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
        <Plus size={15} /> Nova categoria
      </button>
    </div>
  );
}

// ——— Zerar App ———
function ZerarApp({ workspaceId }: { workspaceId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [zerado, setZerado] = useState(false);

  async function zerar() {
    setZerando(true);
    const supabase = createClient();
    // Apaga todos os dados financeiros, mantém perfil e categorias
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
    setZerado(true);
    setConfirmando(false);
    setTimeout(() => setZerado(false), 3000);
  }

  if (zerado) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium"
        style={{ background: "rgba(76,175,130,0.1)", border: "1px solid #4caf82", color: "#4caf82" }}>
        ✓ App zerado com sucesso! Pode começar a lançar.
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ background: "rgba(192,73,47,0.08)", border: "1px solid var(--danger)" }}>
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Tem certeza?</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Isso vai apagar permanentemente todos os lançamentos, contas, cartões, investimentos, missões e recorrências. O perfil militar e as categorias serão mantidos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={zerar} disabled={zerando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--danger)", color: "#fff" }}>
            {zerando ? "Zerando…" : "Sim, zerar tudo"}
          </button>
          <button onClick={() => setConfirmando(false)} disabled={zerando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Apaga lançamentos, contas, cartões, investimentos, missões e recorrências. Perfil e categorias são mantidos.
      </p>
      <button onClick={() => setConfirmando(true)}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
        style={{ background: "var(--surface2)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
        <Trash2 size={15} /> Zerar app
      </button>
    </div>
  );
}

// ——— Componente principal ———
export default function AjustesClient() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  async function sair() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (wsLoading || !workspaceId) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ajustes</h2>

      <Secao titulo="Perfil militar" icone={<Shield size={16} style={{ color: "var(--primary-light)" }} />}>
        <PerfilMilitar workspaceId={workspaceId} />
      </Secao>

      <Secao titulo="Categorias" icone={<FolderTree size={16} style={{ color: "var(--primary-light)" }} />}>
        <Categorias workspaceId={workspaceId} />
      </Secao>

      <Secao titulo="Dados" icone={<AlertTriangle size={16} style={{ color: "var(--danger)" }} />}>
        <ZerarApp workspaceId={workspaceId} />
      </Secao>

      {/* Logout */}
      <button onClick={sair}
        className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium mt-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--danger)" }}>
        <LogOut size={16} /> Sair da conta
      </button>
    </div>
  );
}
