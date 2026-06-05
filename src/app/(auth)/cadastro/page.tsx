"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    if (error) {
      setErro(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--primary-light)" }}>
            VNT·END
          </span>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Criar conta</p>
        </div>

        <form onSubmit={handleCadastro} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              minLength={6}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>

          {erro && <p className="text-xs text-center" style={{ color: "var(--danger)" }}>{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {loading ? "Criando conta…" : "Criar conta"}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: "var(--text-muted)" }}>
          Já tem conta?{" "}
          <Link href="/login" className="underline" style={{ color: "var(--primary-light)" }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
