"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, mesDoLanc, CATS_DEFAULT, type CatStore } from "@/lib/utils";
import type { Lancamento, Cartao } from "@/types/database";

interface LinhaCSV {
  incluir: boolean;
  data: string;
  descricao: string;
  valor: number;
  cat: string;
  duplicata: boolean;
}

const inp = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 6, padding: "4px 8px", fontSize: 13, width: "100%" };

export default function ImportarFatura({ workspaceId, cartoes, lancamentos, cats, fechar, onSalvo }: {
  workspaceId: string;
  cartoes: Cartao[];
  lancamentos: Lancamento[];
  cats: CatStore;
  fechar: () => void;
  onSalvo: () => void;
}) {
  const [etapa, setEtapa] = useState<"upload" | "mapear" | "revisar">("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colData, setColData] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [colValor, setColValor] = useState("");
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id || "");
  const [linhas, setLinhas] = useState<LinhaCSV[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const nivel1Despesa = Object.keys(cats.despesa || CATS_DEFAULT.despesa);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro("");
    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []) as Record<string, string>[];
        const hs: string[] = res.meta?.fields || (data[0] ? Object.keys(data[0]) : []);
        if (!data.length || !hs.length) { setErro("Não consegui ler linhas/colunas neste arquivo."); return; }
        setHeaders(hs);
        setRows(data);
        const g = (cands: string[]) => hs.find(h => cands.some(c => h.toLowerCase().includes(c))) || "";
        setColData(g(["data", "date", "dt"]));
        setColDesc(g(["desc", "lanç", "lanc", "histó", "histo", "title", "estabelec", "merchant", "memo"]));
        setColValor(g(["valor", "amount", "montante", "value", "r$", "brl"]));
        setEtapa("mapear");
      },
      error: () => setErro("Falha ao processar o CSV."),
    });
  }

  function parseValorBR(v: string) {
    if (!v) return 0;
    let s = String(v).replace(/[^\d,.\-]/g, "").trim();
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.abs(n);
  }

  function normalizaData(d: string) {
    if (!d) return "";
    const s = String(d).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    }
    return "";
  }

  function revisar() {
    if (!colValor) { setErro("Escolha ao menos a coluna do valor."); return; }
    const novas: LinhaCSV[] = rows.map(r => {
      const data = normalizaData(r[colData] || "");
      const descricao = (r[colDesc] || "").trim();
      const valor = parseValorBR(r[colValor] || "");
      const duplicata = lancamentos.some(l =>
        l.cartao_id === cartaoId &&
        l.data === data &&
        Math.abs(Number(l.valor) - valor) < 0.01 &&
        l.descricao === descricao
      );
      return { incluir: !duplicata, data, descricao, valor, cat: "", duplicata };
    }).filter(r => r.valor > 0);
    setLinhas(novas);
    setEtapa("revisar");
  }

  async function importar() {
    const selecionadas = linhas.filter(l => l.incluir);
    if (!selecionadas.length) return;
    setSalvando(true);
    await createClient().from("lancamentos").insert(
      selecionadas.map(l => ({
        workspace_id: workspaceId,
        tipo: "despesa",
        valor: l.valor,
        descricao: l.descricao,
        data: l.data || new Date().toISOString().slice(0, 10),
        cat: l.cat || "",
        sub: null, subsub: null,
        conta_id: null,
        cartao_id: cartaoId || null,
        pago: false,
        fiscal: "",
        parcela_num: null, parcela_total: null,
      } as Record<string, unknown>))
    );
    onSalvo();
    fechar();
    setSalvando(false);
  }

  function setLinha(i: number, campo: keyof LinhaCSV, valor: unknown) {
    setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[90vh]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold">Importar fatura (CSV)</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Etapa 1: Upload */}
          {etapa === "upload" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Selecione o arquivo CSV da fatura do cartão.</p>
              <label className="flex flex-col items-center gap-3 py-8 rounded-xl cursor-pointer transition-colors"
                style={{ border: "2px dashed var(--border)", background: "var(--surface2)" }}>
                <Upload size={28} style={{ color: "var(--primary)" }} />
                <span className="text-sm font-medium">Clique para selecionar o CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={onFile} />
              </label>
              {erro && <p className="text-xs" style={{ color: "var(--danger)" }}>{erro}</p>}
            </div>
          )}

          {/* Etapa 2: Mapear colunas */}
          {etapa === "mapear" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">{rows.length} linhas lidas. Mapeie as colunas:</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cartão de destino", content: (
                    <select value={cartaoId} onChange={e => setCartaoId(e.target.value)} style={inp}>
                      <option value="">Sem cartão</option>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )},
                  { label: "Coluna da data", content: (
                    <select value={colData} onChange={e => setColData(e.target.value)} style={inp}>
                      <option value="">—</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )},
                  { label: "Coluna da descrição", content: (
                    <select value={colDesc} onChange={e => setColDesc(e.target.value)} style={inp}>
                      <option value="">—</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )},
                  { label: "Coluna do valor", content: (
                    <select value={colValor} onChange={e => setColValor(e.target.value)} style={inp}>
                      <option value="">—</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )},
                ].map(({ label, content }) => (
                  <label key={label} className="flex flex-col gap-1" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {label}{content}
                  </label>
                ))}
              </div>
              {erro && <p className="text-xs" style={{ color: "var(--danger)" }}>{erro}</p>}
              <button onClick={revisar}
                className="py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}>
                Revisar lançamentos →
              </button>
            </div>
          )}

          {/* Etapa 3: Revisar */}
          {etapa === "revisar" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{linhas.filter(l => l.incluir).length} de {linhas.length} selecionados</p>
                <button onClick={() => setLinhas(ls => ls.map(l => ({ ...l, incluir: true })))}
                  className="text-xs" style={{ color: "var(--primary)" }}>marcar todos</button>
              </div>
              <div className="flex flex-col gap-1">
                {linhas.map((l, i) => (
                  <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2"
                    style={{ background: l.duplicata ? "rgba(192,73,47,0.06)" : "var(--surface2)", border: `1px solid ${l.duplicata ? "rgba(192,73,47,0.2)" : "var(--border)"}`, opacity: l.incluir ? 1 : 0.5 }}>
                    <input type="checkbox" checked={l.incluir} onChange={e => setLinha(i, "incluir", e.target.checked)} className="flex-shrink-0" />
                    <span className="text-xs w-20 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{l.data || "—"}</span>
                    <input value={l.descricao} onChange={e => setLinha(i, "descricao", e.target.value)}
                      className="flex-1 text-xs outline-none rounded px-1"
                      style={{ background: "transparent", color: "var(--text)", minWidth: 0 }} />
                    <input type="number" value={l.valor} onChange={e => setLinha(i, "valor", Number(e.target.value))}
                      className="text-xs outline-none rounded px-1 w-20 text-right"
                      style={{ background: "transparent", color: "var(--text)" }} />
                    <select value={l.cat} onChange={e => setLinha(i, "cat", e.target.value)}
                      className="text-xs outline-none rounded px-1"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", maxWidth: 110 }}>
                      <option value="">Categoria…</option>
                      {nivel1Despesa.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {l.duplicata && <span className="text-xs flex-shrink-0" style={{ color: "var(--danger)" }}>dup</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {etapa === "revisar" && (
          <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={importar} disabled={salvando || linhas.filter(l => l.incluir).length === 0}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--primary)", color: "#fff" }}>
              {salvando ? "Importando…" : `Importar ${linhas.filter(l => l.incluir).length} lançamentos`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
