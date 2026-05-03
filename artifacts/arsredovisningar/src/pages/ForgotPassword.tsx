import { useState, FormEvent } from "react";
import { Link } from "wouter";
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
import { Briefcase, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import {
  AuthLanguageSwitcher,
  BackToHomepageLink,
} from "@/components/auth/AuthChrome";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useLanguage();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Fire and forget — we deliberately ignore the result so the response
    // is identical whether or not the address has an account. Surfacing
    // backend error text here would leak account existence (or at minimum
    // produce distinguishable behaviour) to unauthenticated callers.
    void resetPassword(email.trim()).catch(() => {
      /* swallow */
    });

    // Brief delay so the request actually leaves the browser before we
    // flip the UI — keeps timing roughly uniform across cases.
    window.setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 400);
  }

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
            {t("forgot.title")}
          </h1>
          <p className="text-muted-foreground">{t("forgot.subtitle")}</p>
        </div>

        <Card className="shadow-xl border-border/50">
          {submitted ? (
            <>
              <CardHeader>
                <CardTitle>{t("forgot.success.title")}</CardTitle>
                <CardDescription>
                  {t("forgot.success.body_prefix")}
                  <span className="font-medium">{email}</span>
                  {t("forgot.success.body_suffix")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{t("forgot.success.spam_hint")}</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                >
                  {t("forgot.success.use_other")}
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t("forgot.back_to_signin")}
                </Link>
              </CardFooter>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>{t("forgot.card.title")}</CardTitle>
                <CardDescription>
                  {t("forgot.card.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={loading || !email.trim()}
                >
                  {loading ? t("forgot.submitting") : t("forgot.submit")}
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t("forgot.back_to_signin")}
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
