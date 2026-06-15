"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, ListPlus, Wallet, TrendingUp, MoreHorizontal,
  FileText, Repeat, Compass, Receipt, SlidersHorizontal, X,
} from "lucide-react";

// 4 abas fixas + "Mais"
const ABAS = [
  { href: "/", icon: LayoutGrid, label: "Visão" },
  { href: "/lancamentos", icon: ListPlus, label: "Lançar" },
  { href: "/contas", icon: Wallet, label: "Contas" },
  { href: "/investimentos", icon: TrendingUp, label: "Investir" },
] as const;

// Menu "Mais" — Contracheque aqui (sem duplicata no bar principal)
const MAIS = [
  { href: "/contracheque", icon: FileText, label: "Contracheque", desc: "Simulador e histórico" },
  { href: "/recorrencias", icon: Repeat, label: "Fixas", desc: "Receitas e despesas recorrentes" },
  { href: "/missoes", icon: Compass, label: "Missões", desc: "Diárias e gratificações" },
  { href: "/ir", icon: Receipt, label: "Imposto de Renda", desc: "Projeção anual do IR" },
  { href: "/ajustes", icon: SlidersHorizontal, label: "Ajustes", desc: "Categorias, cartões e perfil" },
] as const;

export default function NavBar() {
  const path = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const maisAtivo = MAIS.some(m => path.startsWith(m.href));

  return (
    <>
      {/* Sheet "Mais" */}
      {maisAberto && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setMaisAberto(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-4 pb-24 flex flex-col gap-1"
            style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">Mais opções</p>
              <button onClick={() => setMaisAberto(false)} aria-label="Fechar" style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            {MAIS.map(({ href, icon: Icon, label, desc }) => {
              const ativo = path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMaisAberto(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3"
                  style={{ background: ativo ? "var(--surface2)" : "transparent" }}
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--surface2)", color: ativo ? "var(--primary)" : "var(--text-muted)" }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: ativo ? "var(--primary)" : "var(--text)" }}>
                      {label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex border-t"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {ABAS.map(({ href, icon: Icon, label }) => {
          const ativo = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMaisAberto(false)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors"
              style={{ color: ativo && !maisAberto ? "var(--primary)" : "var(--text-muted)" }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMaisAberto(v => !v)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors"
          style={{ color: maisAberto || maisAtivo ? "var(--primary)" : "var(--text-muted)" }}
        >
          <MoreHorizontal size={20} />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
