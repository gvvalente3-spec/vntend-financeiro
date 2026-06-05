import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/layout/NavBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="flex items-center justify-between px-4 py-3"
        style={{ background: "#0f2a26", color: "#f4efe4" }}>
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 leading-none"
            style={{ background: "#c9952d", color: "#0f2a26" }}>
            <span className="font-black text-sm tracking-tight">VNT</span>
            <span className="font-black text-sm tracking-tight" style={{ marginTop: -2 }}>END</span>
          </div>
          <div>
            <p className="font-bold tracking-tight leading-none text-sm" style={{ color: "#f4efe4" }}>VNTEND</p>
            <p className="text-xs leading-none mt-0.5" style={{ color: "#9fc4ba" }}>Financeiro</p>
          </div>
        </div>
        <span className="text-xs" style={{ color: "#9fc4ba" }}>{user.email}</span>
      </header>
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>
      <NavBar />
    </div>
  );
}
