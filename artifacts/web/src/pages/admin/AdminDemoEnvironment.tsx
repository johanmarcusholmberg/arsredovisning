import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import DemoWorkspacePage from "@/pages/DemoWorkspacePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Lock } from "lucide-react";

// SECURITY TODO:
// The public marketing site (artifacts/web) currently has no real auth or
// role system. The original interactive demo workspace has been moved here
// so it remains available for internal sales / customer previews, but is
// no longer exposed publicly via /demo. Until proper admin auth is wired
// up (see arsredovisningar AuthContext or future admin role), we gate this
// route behind a simple shared passphrase stored in sessionStorage. This is
// NOT a real access control — it only prevents accidental discovery via the
// public site. Replace with a real admin guard before relying on it.
const STORAGE_KEY = "arsred:adminDemoUnlocked";
const ADMIN_PASSPHRASE =
  (import.meta.env.VITE_ADMIN_DEMO_PASSPHRASE as string | undefined) ?? "demo-admin";

export default function AdminDemoEnvironment() {
  const [, navigate] = useLocation();
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === ADMIN_PASSPHRASE) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
      setError(null);
    } else {
      setError("Felaktig kod");
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12 bg-muted/20">
        <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="size-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-primary">
              Admin
            </span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Demomiljö</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Intern demomiljö för test, kundvisning och framtida demoanpassningar.
          </p>

          <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <p>
              Tillfälligt skydd. Verklig admin-behörighet är inte aktiverad
              i marknadssajten ännu — koden här förhindrar bara att miljön
              upptäcks av misstag.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-code" className="text-sm">
                Adminkod
              </Label>
              <Input
                id="admin-code"
                type="password"
                value={input}
                autoFocus
                onChange={(e) => setInput(e.target.value)}
                placeholder="••••••••"
              />
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Lås upp
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/")}
              >
                Avbryt
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between gap-4 sticky top-14 z-50">
        <div className="flex items-center gap-2 text-xs">
          <Lock className="size-3.5" />
          <span className="font-mono uppercase tracking-wider">Admin · Demomiljö</span>
          <span className="text-slate-400 hidden sm:inline">
            Intern demo — ej publikt tillgänglig
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setUnlocked(false);
          }}
          className="text-xs text-slate-300 hover:text-white underline"
        >
          Lås
        </button>
      </div>
      <DemoWorkspacePage />
    </div>
  );
}
