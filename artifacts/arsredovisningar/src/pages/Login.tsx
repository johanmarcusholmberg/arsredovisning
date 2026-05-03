import { useState, FormEvent } from "react";
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
import { Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/hooks/use-toast";
import { mapAuthErrorToKey } from "@/i18n/strings";
import {
  AuthLanguageSwitcher,
  BackToHomepageLink,
} from "@/components/auth/AuthChrome";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      // Surface as a transient toast instead of an inline alert so the form
      // doesn't grow taller and shift fields around when validation fails.
      toast({
        variant: "destructive",
        title: t("login.error.toast_title"),
        description: t(mapAuthErrorToKey(error.message)),
      });
      setLoading(false);
    } else {
      navigate("/");
    }
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
                <Input
                  id="password"
                  type="password"
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
                disabled={loading}
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
