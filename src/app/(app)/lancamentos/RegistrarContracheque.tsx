"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl, mesAtual, MESES } from "@/lib/utils";

const inp = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "8px 10px", width: "100%", fontSize: 14 };
const lbl = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 13, color: "var(--text-muted)" };

export default function RegistrarContracheque({ workspaceId, fechar, onSalvo }: {
  workspaceId: string; fechar: () => void; onSalvo: () => void;
}) {
  const [mes, setMes] = useState(mesAtual());
  const [tributavel, setTributavel] = useState("");
  const [previdencia, setPrevidencia] = useState("");
  const [irRetido, setIrRetido] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  const [mAno, mNum] = mes.split("-").map(Number);
  const nomeMes = mes ? `${MESES[mNum - 1]}/${mAno}` : "";

  async function tentarExtrairPDF(f: File) {
    setExtraindo(true);
    setMsg("Tentando extrair do PDF…");
    try {
      // Carrega pdf.js via CDN dinamicamente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pdfjsLib: any = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => res(); s.onerror = rej;
          document.head.appendChild(s);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfjsLib = (window as any).pdfjsLib;
      }
      if (!pdfjsLib) { setMsg("pdf.js indisponível — preencha manualmente."); setExtraindo(false); return; }
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let texto = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const tc = await pg.getTextContent();
        texto += " " + (tc.items as Array<{ str: string }>).map(it => it.str).join(" ");
      }
      // Extrai IR
      const irMatch = texto.match(/IMPOSTO DE RENDA[^\d-]*([\d.]+,\d{2})/i);
      if (irMatch) setIrRetido(irMatch[1].replace(/\./g, "").replace(",", "."));
      // Extrai tributável (base IR)
      const baseMatch = texto.match(/BASE DE CALCULO[^\d]*([\d.]+,\d{2})/i) || texto.match(/TRIBUTAVEL[^\d]*([\d.]+,\d{2})/i);
      if (baseMatch) setTributavel(baseMatch[1].replace(/\./g, "").replace(",", "."));
      // Extrai previdência (FuSEx + Pensão)
      const prevMatch = texto.match(/PREVIDENCIA[^\d]*([\d.]+,\d{2})/i) || texto.match(/FUSE[^\d]*([\d.]+,\d{2})/i);
      if (prevMatch) setPrevidencia(prevMatch[1].replace(/\./g, "").replace(",", "."));
      // Extrai mês
      const mmMatch = texto.match(/M[ÊE]S\s+([A-ZÇÃÉ]+)\s*\/\s*(\d{4})/i);
      if (mmMatch) {
        const nomesMap: Record<string, string> = {
          "JAN": "01","FEV": "02","MAR": "03","ABR": "04","MAI": "05","JUN": "06",
          "JUL": "07","AGO": "08","SET": "09","OUT": "10","NOV": "11","DEZ": "12",
        };
        const mn = mmMatch[1].slice(0, 3).toUpperCase();
        if (nomesMap[mn]) setMes(`${mmMatch[2]}-${nomesMap[mn]}`);
      }
      setMsg(irMatch || baseMatch ? "✓ Extração parcial — confira os valores." : "Não encontrei os valores automaticamente — preencha manualmente.");
    } catch {
      setMsg("Falha na extração — preencha manualmente.");
    }
    setExtraindo(false);
  }

  function onFilePDF(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    tentarExtrairPDF(f);
  }

  async function salvar() {
    if (!mes || !tributavel) return;
    setSalvando(true);
    const supabase = createClient();
    await supabase.from("contracheques").upsert({
      workspace_id: workspaceId,
      mes,
      tributavel: Number(tributavel) || 0,
      previdencia: Number(previdencia) || 0,
      ir_retido: Number(irRetido) || 0,
      arquivo: arquivo?.name || null,
    } as Record<string, unknown>, { onConflict: "workspace_id,mes" });
    onSalvo();
    fechar();
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={fechar}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Registrar contracheque</h3>
          <button onClick={fechar} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Registre os valores do contracheque oficial (PDF do CPEx) para o acompanhamento de IR ser preciso.
        </p>

        {/* Upload PDF */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
          style={{ background: "var(--surface2)", border: "1px dashed var(--border)" }}>
          <FileText size={20} style={{ color: "var(--primary)" }} />
          <div className="flex-1">
            <p className="text-sm font-medium">{arquivo ? arquivo.name : "Selecionar PDF do CPEx (opcional)"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {extraindo ? "Extraindo…" : msg || "Tentará extrair os valores automaticamente"}
            </p>
          </div>
          <input type="file" accept=".pdf" className="hidden" onChange={onFilePDF} />
        </label>

        <label style={lbl}>
          Mês de referência
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} style={inp} />
        </label>

        {nomeMes && <p className="text-xs font-medium" style={{ color: "var(--primary)" }}>→ {nomeMes}</p>}

        <div className="grid grid-cols-1 gap-3">
          <label style={lbl}>
            Rendimento tributável (R$)
            <input type="number" step="0.01" value={tributavel} onChange={e => setTributavel(e.target.value)}
              placeholder="Ex: 19.852,24" style={inp} />
          </label>
          <label style={lbl}>
            Previdência (FuSEx + Pensão, R$)
            <input type="number" step="0.01" value={previdencia} onChange={e => setPrevidencia(e.target.value)}
              placeholder="Ex: 2.680,06" style={inp} />
          </label>
          <label style={lbl}>
            IR retido na fonte (R$)
            <input type="number" step="0.01" value={irRetido} onChange={e => setIrRetido(e.target.value)}
              placeholder="Ex: 4.910,98" style={inp} />
          </label>
        </div>

        {tributavel && irRetido && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface2)", color: "var(--text-muted)" }}>
            Tributável: <b style={{ color: "var(--text)" }}>{brl(Number(tributavel))}</b>
            {" · "}IR: <b style={{ color: "var(--danger)" }}>{brl(Number(irRetido))}</b>
            {previdencia && <>{" · "}Prev: <b style={{ color: "var(--text)" }}>{brl(Number(previdencia))}</b></>}
          </div>
        )}

        <button onClick={salvar} disabled={salvando || !mes || !tributavel}
          className="py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--primary)", color: "#fff" }}>
          {salvando ? "Salvando…" : "Salvar contracheque"}
        </button>
      </div>
    </div>
  );
}
