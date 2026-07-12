"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// O workspace do usuário praticamente nunca muda, mas era rebuscado
// (2 idas ao servidor) em TODA página. Agora: resolução instantânea
// via memória/localStorage + validação silenciosa em segundo plano
// (corrige primeiro acesso e troca de conta no mesmo navegador).

const LS_KEY = "vntend:workspace_id";
let memoria: string | null = null;

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Resolução instantânea via cache
    let resolvido = memoria;
    if (!resolvido) {
      try { resolvido = window.localStorage.getItem(LS_KEY); } catch { resolvido = null; }
      if (resolvido) memoria = resolvido;
    }
    if (resolvido) {
      setWorkspaceId(resolvido);
      setLoading(false);
    }

    // 2) Validação em segundo plano (não bloqueia a página quando há cache)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        memoria = null;
        try { window.localStorage.removeItem(LS_KEY); } catch { /* noop */ }
        setWorkspaceId(null);
        setLoading(false);
        return;
      }
      supabase
        .from("workspace_users")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          const row = data as { workspace_id: string } | null;
          const real = row?.workspace_id ?? null;
          if (real !== memoria) {
            memoria = real;
            try {
              if (real) window.localStorage.setItem(LS_KEY, real);
              else window.localStorage.removeItem(LS_KEY);
            } catch { /* noop */ }
            setWorkspaceId(real);
          }
          setLoading(false);
        });
    });
  }, []);

  return { workspaceId, loading };
}
