"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ListPlus, Wallet, Repeat, Compass, SlidersHorizontal, FileText } from "lucide-react";

const ABAS = [
  { href: "/", icon: LayoutGrid, label: "Visão" },
  { href: "/lancamentos", icon: ListPlus, label: "Lançar" },
  { href: "/contas", icon: Wallet, label: "Contas" },
  { href: "/recorrencias", icon: Repeat, label: "Fixas" },
  { href: "/missoes", icon: Compass, label: "Missões" },
  { href: "/contracheque", icon: FileText, label: "Contra." },
  { href: "/ajustes", icon: SlidersHorizontal, label: "Ajustes" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex border-t"
      style={{ background: "#ffffff", borderColor: "var(--border)" }}>
      {ABAS.map(({ href, icon: Icon, label }) => {
        const ativo = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors"
            style={{ color: ativo ? "var(--primary)" : "var(--text-muted)" }}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
