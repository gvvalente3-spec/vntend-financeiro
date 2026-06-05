"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("Email ou senha incorretos.");
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
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Financeiro</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: "var(--text-muted)" }}>
          Sem conta?{" "}
          <Link href="/cadastro" className="underline" style={{ color: "var(--primary-light)" }}>
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  );
}
