import { useState, FormEvent, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Briefcase, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { mapAuthErrorToKey } from "@/i18n/strings";
import {
  AuthLanguageSwitcher,
  BackToHomepageLink,
} from "@/components/auth/AuthChrome";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Detect Supabase's email-confirmation redirect (P2-3). Supabase appends
  // either `?type=signup&...` or a hash like `#access_token=...&type=signup`
  // when the user clicks the verification link. Show a friendly localized
  // toast and clean the URL so a refresh doesn't fire the toast again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash,
    );
    const type = search.get("type") ?? hash.get("type");
    const confirmed =
      search.get("confirmed") === "1" ||
      type === "signup" ||
      type === "email_change" ||
      type === "email_confirmation";
    if (!confirmed) return;
    toast({
      title: t("login.email_confirmed.title"),
      description: t("login.email_confirmed.body"),
    });
    // Strip the noisy params/hash so a manual refresh is clean.
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
    // Intentionally run only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const { error } = await signIn(email, password);

    if (error) {
      setErrorMessage(t(mapAuthErrorToKey(error.message)));
      setLoading(false);
    } else {
      navigate("/");
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <div className="auth-brand min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 relative">
      <BackToHomepageLink />
      <AuthLanguageSwitcher />
      <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Briefcase className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("login.welcome")}
          </h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <Card className="shadow-xl border-border/50">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>{t("login.card.title")}</CardTitle>
              <CardDescription>
                {t("login.card.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage ? (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="login-error"
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <Info className="size-4 mt-0.5 shrink-0 text-muted-foreground/80" />
                  <span className="leading-snug">{errorMessage}</span>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("common.password")}</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    {t("login.forgot_password")}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={loading || !canSubmit}
              >
                {loading ? t("login.submitting") : t("login.submit")}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                {t("login.no_account")}{" "}
                <Link
                  href="/register"
                  className="text-primary font-medium hover:underline"
                >
                  {t("login.signup_link")}
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
