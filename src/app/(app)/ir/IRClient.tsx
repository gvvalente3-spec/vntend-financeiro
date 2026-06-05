"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Landmark, Info, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { brl, mesAtual, MESES } from "@/lib/utils";
import { calcularMissao } from "@/lib/missao";
import {
  calcularContracheque, irAnual,
  DEDUCAO_DEPENDENTE_ANUAL, LIMITE_EDUCACAO_ANUAL, DESCONTO_SIMPLIFICADO_MAX,
} from "@/lib/contracheque";
import type { Perfil, Lancamento, Contracheque, Missao } from "@/types/database";

const ANO_ATUAL = new Date().getFullYear();

function Linha({ label, valor, destaque, muted, sublabel }: {
  label: string; valor: number; destaque?: boolean; muted?: boolean; sublabel?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <div>
        <p className="text-sm" style={{ color: muted ? "var(--text-muted)" : "var(--text)" }}>{label}</p>
        {sublabel && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sublabel}</p>}
      </div>
      <span className="text-sm font-semibold" style={{ color: destaque ? "#4caf82" : "var(--text)" }}>{brl(valor)}</span>
    </div>
  );
}

export default function IRClient({ embutido = false }: { embutido?: boolean }) {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [ano, setAno] = useState(ANO_ATUAL);
  const [perfil, setPerfil] = useState<Partial<Perfil>>({});
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contracheques, setContracheques] = useState<Contracheque[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [outrasAnual, setOutrasAnual] = useState(0);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!workspaceId) return;
    setCarregando(true);
    const supabase = createClient();
    const [{ data: perf }, { data: lancs }, { data: ccs }, { data: mis }, { data: ded }] = await Promise.all([
      supabase.from("perfil").select("*").eq("workspace_id", workspaceId).single(),
      supabase.from("lancamentos").select("*").eq("workspace_id", workspaceId),
      supabase.from("contracheques").select("*").eq("workspace_id", workspaceId),
      supabase.from("missoes").select("*").eq("workspace_id", workspaceId),
      supabase.from("deducoes").select("*").eq("workspace_id", workspaceId).single(),
    ]);
    setPerfil((perf as unknown as Perfil) || {});
    setLancamentos((lancs || []) as unknown as Lancamento[]);
    setContracheques((ccs || []) as unknown as Contracheque[]);
    setMissoes((mis || []) as unknown as Missao[]);
    setOutrasAnual(Number((ded as unknown as { outras_anual: number })?.outras_anual) || 0);
    setCarregando(false);
  }, [workspaceId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarOutras(v: number) {
    if (!workspaceId) return;
    setOutrasAnual(v);
    await createClient().from("deducoes").update({ outras_anual: v } as Record<string, unknown>).eq("workspace_id", workspaceId);
  }

  // Missões confirmadas por mês
  function missoesMes(mk: string) {
    let gr = 0, is = 0;
    missoes.forEach(m => {
      const c = calcularMissao(m, perfil);
      if (m.grat_rep_conf && (m.grat_rep_mes || mesAtual()) === mk) gr += c.gratRep;
      if (m.aux_conf && (m.aux_mes || mesAtual()) === mk) is += c.auxAlim;
      if (m.diarias_conf && (m.diarias_mes || mesAtual()) === mk) is += c.diarias;
    });
    return { gr, is };
  }

  // Mapa de contracheques oficiais do ano
  const oficiais: Record<string, Contracheque> = {};
  contracheques.forEach(c => { if ((c.mes || "").startsWith(String(ano))) oficiais[c.mes] = c; });

  // Gera as 12 linhas do ano
  const linhas = Array.from({ length: 12 }, (_, i) => {
    const mk = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const of = oficiais[mk];
    if (of) {
      return { mes: mk, nome: MESES[i], tributavel: Number(of.tributavel), previdencia: Number(of.previdencia), ir: Number(of.ir_retido), oficial: true };
    }
    const { gr, is } = missoesMes(mk);
    const cc = calcularContracheque(perfil, { gratRepMissoes: gr, isentosMissoes: is });
    return { mes: mk, nome: MESES[i], tributavel: cc.tributavel, previdencia: cc.previdencia, ir: cc.ir, oficial: false };
  });

  const tot = linhas.reduce((a, l) => ({ trib: a.trib + l.tributavel, prev: a.prev + l.previdencia, ir: a.ir + l.ir }), { trib: 0, prev: 0, ir: 0 });
  const deps = Number(perfil.dependentes) || 0;

  // Deduções automáticas dos lançamentos fiscais
  const somaFiscal = (tag: string) => lancamentos
    .filter(l => l.tipo === "despesa" && l.fiscal === tag && (l.data || "").startsWith(String(ano)))
    .reduce((s, l) => s + Number(l.valor), 0);

  const pgblLanc = somaFiscal("pgbl");
  const saudeLanc = somaFiscal("saude");
  const educLanc = somaFiscal("educacao");

  const pgbl = Math.min(pgblLanc, 0.12 * tot.trib);
  const dep  = deps * DEDUCAO_DEPENDENTE_ANUAL;
  const saude = saudeLanc;
  const educ = Math.min(educLanc, LIMITE_EDUCACAO_ANUAL * (deps + 1));
  const outras = outrasAnual;

  const baseCompleta = Math.max(0, tot.trib - tot.prev - pgbl - dep - saude - educ - outras);
  const irCompleto  = irAnual(baseCompleta);
  const descSimpl   = Math.min(0.20 * tot.trib, DESCONTO_SIMPLIFICADO_MAX);
  const baseSimpl   = Math.max(0, tot.trib - descSimpl);
  const irSimpl     = irAnual(baseSimpl);
  const melhorSimpl = irSimpl <= irCompleto;
  const irDevido    = Math.min(irCompleto, irSimpl);
  const resultado   = tot.ir - irDevido;
  const restitui    = resultado >= 0;
  const nOficiais   = Object.keys(oficiais).length;

  if (wsLoading || carregando) {
    return <div className="flex items-center justify-center h-40" style={{ color: "var(--text-muted)" }}>Carregando…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Cabeçalho + seletor de ano */}
      {!embutido && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Acompanhamento de IR</h2>
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <button onClick={() => setAno(a => a - 1)} style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>‹</button>
            <span className="text-sm font-semibold w-10 text-center">{ano}</span>
            <button onClick={() => setAno(a => a + 1)} style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>›</button>
          </div>
        </div>
      )}
      {embutido && (
        <div className="flex items-center justify-between rounded-lg px-3 py-1.5" style={{ background: "var(--surface2)", border: "1px solid var(--border)", alignSelf: "flex-start" }}>
          <button onClick={() => setAno(a => a - 1)} style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>‹</button>
          <span className="text-sm font-semibold w-10 text-center">{ano}</span>
          <button onClick={() => setAno(a => a + 1)} style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>›</button>
        </div>
      )}

      {/* Hero — resultado */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-2"
        style={{ background: restitui ? "linear-gradient(135deg,#1d5c4f,#2a8a72)" : "linear-gradient(135deg,#7a2a1d,#c0492f)" }}>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.8)" }}>
          Ajuste anual estimado · {ano}
        </p>
        <p className="text-4xl font-bold" style={{ color: "#fff" }}>{brl(Math.abs(resultado))}</p>
        <div className="flex items-center gap-2 mt-1">
          {restitui
            ? <><Check size={16} color="#fff" /><span className="text-sm font-semibold" style={{ color: "#fff" }}>A RESTITUIR — Receita te deve</span></>
            : <><span className="text-sm font-semibold" style={{ color: "#fff" }}>⚠ A PAGAR — você deve à Receita</span></>
          }
          <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.7)" }}>· modelo {melhorSimpl ? "simplificado" : "completo"}</span>
        </div>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
        <span>
          <b style={{ color: "var(--text)" }}>Restituir</b> = Receita Federal devolve. <b style={{ color: "var(--text)" }}>Pagar</b> = você recolhe a diferença. &nbsp;
          {nOficiais} mês(es) oficial(is) + {12 - nOficiais} projetado(s) pelo simulador. &nbsp;
          <b style={{ color: "var(--text)" }}>13º não entra aqui</b>: tributado exclusivamente na fonte.
        </span>
      </div>

      {/* Cards totais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={15} style={{ color: "#4caf82" }} /><p className="text-xs" style={{ color: "var(--text-muted)" }}>Tributável no ano</p></div>
          <p className="font-bold" style={{ color: "#4caf82" }}>{brl(tot.trib)}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1"><Landmark size={15} style={{ color: "var(--danger)" }} /><p className="text-xs" style={{ color: "var(--text-muted)" }}>IR retido no ano</p></div>
          <p className="font-bold" style={{ color: "var(--danger)" }}>{brl(tot.ir)}</p>
        </div>
      </div>

      {/* Mês a mês */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-3">Mês a mês</p>
        <div className="flex flex-col">
          {linhas.map(l => (
            <div key={l.mes} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <span className="text-sm capitalize">{l.nome}</span>
                <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: l.oficial ? "rgba(42,138,114,0.15)" : "var(--surface2)", color: l.oficial ? "var(--primary-light)" : "var(--text-muted)" }}>
                  {l.oficial ? "oficial" : "projeção"}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{brl(l.tributavel)}</p>
                <p className="text-xs" style={{ color: "var(--danger)" }}>IR {brl(l.ir)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deduções */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-1">Deduções do ano</p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          PGBL, saúde e educação vêm automaticamente dos lançamentos marcados como dedução de IR.
        </p>
        <Linha label="PGBL lançado" valor={pgblLanc} destaque sublabel={pgblLanc > pgbl ? `Cap. 12% → considerado ${brl(pgbl)}` : undefined} />
        <Linha label="Saúde lançada" valor={saude} destaque />
        <Linha label="Educação lançada" valor={educ} destaque sublabel={educLanc > educ ? `Limite ${brl(LIMITE_EDUCACAO_ANUAL)}/pessoa` : undefined} />
        <Linha label="Previdência (FuSEx + Pensão)" valor={tot.prev} />
        <Linha label={`Dependentes (${deps})`} valor={dep} />

        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <label className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
            Outras deduções (manual)
            <input type="number" value={outrasAnual} onChange={e => salvarOutras(Number(e.target.value))}
              className="text-sm font-semibold text-right rounded-lg px-2 py-1 w-28 outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </label>
        </div>
      </div>

      {/* Completo × Simplificado */}
      <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-3">Completo × Simplificado</p>

        <div className="flex flex-col gap-2">
          {[
            { label: "IR devido — completo", valor: irCompleto, escolhido: !melhorSimpl },
            { label: "IR devido — simplificado", valor: irSimpl, escolhido: melhorSimpl },
          ].map(({ label, valor, escolhido }) => (
            <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2.5"
              style={{ background: escolhido ? "rgba(42,138,114,0.1)" : "var(--surface2)", border: `1px solid ${escolhido ? "var(--primary)" : "var(--border)"}` }}>
              <div className="flex items-center gap-2">
                {escolhido && <Check size={13} style={{ color: "var(--primary-light)" }} />}
                <span className="text-sm">{label}</span>
                {escolhido && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--primary)", color: "#fff" }}>escolhido</span>}
              </div>
              <span className="text-sm font-bold" style={{ color: escolhido ? "var(--primary-light)" : "var(--text)" }}>{brl(valor)}</span>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg px-3 py-3 mt-1"
            style={{ background: restitui ? "rgba(42,138,114,0.12)" : "rgba(192,73,47,0.12)", border: `1px solid ${restitui ? "var(--primary)" : "var(--danger)"}` }}>
            <span className="text-sm font-semibold">{restitui ? "✓ A restituir" : "⚠ A pagar"}</span>
            <span className="text-lg font-bold" style={{ color: restitui ? "#4caf82" : "var(--danger)" }}>{brl(Math.abs(resultado))}</span>
          </div>
        </div>

        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Estimativa de referência para planejamento. A apuração oficial é feita na DIRPF da Receita Federal.
        </p>
      </div>
    </div>
  );
}

