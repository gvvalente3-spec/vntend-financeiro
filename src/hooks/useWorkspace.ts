"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      supabase
        .from("workspace_users")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          const row = data as { workspace_id: string } | null;
          setWorkspaceId(row?.workspace_id ?? null);
          setLoading(false);
        });
    });
  }, []);

  return { workspaceId, loading };
}
