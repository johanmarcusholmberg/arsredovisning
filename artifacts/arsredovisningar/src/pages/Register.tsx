import { useState, FormEvent, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { track } from "@/lib/track";
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
import { useToast } from "@/hooks/use-toast";
import { mapAuthErrorToKey } from "@/i18n/strings";
import {
  AuthLanguageSwitcher,
  BackToHomepageLink,
} from "@/components/auth/AuthChrome";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Persist the "from=demo" referral so the post-signup Dashboard can show
  // a one-time prompt even after Supabase email confirmation forces a
  // detour through /login. Read once on mount so a stale URL doesn't
  // overwrite a fresher value.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "demo") {
      try {
        window.localStorage.setItem("ar.signupSource", "demo");
      } catch {
        /* ignore */
      }
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    track("register_start");

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("register.error.toast_title"),
        description: t("register.error.password_mismatch"),
      });
      return;
    }
    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: t("register.error.toast_title"),
        description: t("register.error.password_too_short"),
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);

    if (error) {
      toast({
        variant: "destructive",
        title: t("register.error.toast_title"),
        description: t(mapAuthErrorToKey(error.message)),
      });
      setLoading(false);
    } else {
      track("register_success");
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="auth-brand min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 relative">
        <BackToHomepageLink />
        <AuthLanguageSwitcher />
        <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-500 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              {t("register.success.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("register.success.body_prefix")}
              <span className="font-medium text-foreground">{email}</span>
              {t("register.success.body_suffix")}
            </p>
            <Button variant="outline" onClick={() => navigate("/login")}>
              {t("register.success.go_signin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-brand min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 relative">
      <BackToHomepageLink />
      <AuthLanguageSwitcher />
      <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
            <Briefcase className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("register.title")}
          </h1>
          <p className="text-muted-foreground">{t("register.subtitle")}</p>
        </div>

        <Card className="shadow-xl border-border/50">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>{t("register.card.title")}</CardTitle>
              <CardDescription>
                {t("register.card.description")}
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
              <div className="space-y-2">
                <Label htmlFor="password">{t("common.password")}</Label>
                <PasswordInput
                  id="password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("register.confirm_password")}
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  className="h-11"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  showCapsLockHint={false}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={
                  loading ||
                  !email.trim() ||
                  !password ||
                  !confirmPassword
                }
              >
                {loading ? t("register.submitting") : t("register.submit")}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                {t("register.has_account")}{" "}
                <Link
                  href="/login"
                  className="text-primary font-medium hover:underline"
                >
                  {t("register.signin_link")}
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
