import { useEffect, useState, FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  getGetMeQueryKey,
  useUpdateMyProfile,
  useUpdateMyPreferences,
  useChangeMyPassword,
  useChangeMyEmail,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import type { Language } from "@/i18n/strings";
import { User, Bell, Shield, Key, Loader2 } from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const { t, setLanguage: setUiLanguage } = useLanguage();
  const qc = useQueryClient();
  const meQueryKey = getGetMeQueryKey();

  const { data: me, isLoading, isError, error, refetch } = useGetMe();

  const updateProfile = useUpdateMyProfile({
    mutation: {
      onSuccess: (data) => {
        qc.setQueryData(meQueryKey, data);
        toast({ title: t("settings.profile.saved_toast") });
      },
      onError: (err: unknown) => {
        toast({
          title: t("settings.profile.save_error"),
          description: err instanceof Error ? err.message : t("auth.error.generic"),
          variant: "destructive",
        });
      },
    },
  });

  const updatePrefs = useUpdateMyPreferences({
    mutation: {
      onSuccess: (data) => {
        qc.setQueryData(meQueryKey, data);
      },
      onError: (err: unknown) => {
        toast({
          title: t("settings.notifications.save_error"),
          description: err instanceof Error ? err.message : t("auth.error.generic"),
          variant: "destructive",
        });
        qc.invalidateQueries({ queryKey: meQueryKey });
      },
    },
  });

  // ── Profile form local state, hydrated from server ──
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<Language>("sv");

  useEffect(() => {
    if (me) {
      setDisplayName(me.profile.displayName ?? "");
      setLanguage(me.profile.defaultUiLanguage);
    }
  }, [me]);

  function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    // Mirror the chosen UI language to the LanguageContext immediately so
    // the rest of the chrome (sidebar, toasts) flips without waiting for
    // the next reload.
    setUiLanguage(language);
    updateProfile.mutate({
      data: {
        displayName: displayName.trim() || null,
        defaultUiLanguage: language,
      },
    });
  }

  function handleToggle(
    field: "emailWeeklySummary" | "deadlineAlertsEnabled",
    value: boolean,
  ) {
    if (!me) return;
    qc.setQueryData(meQueryKey, {
      ...me,
      preferences: { ...me.preferences, [field]: value },
    });
    updatePrefs.mutate({ data: { [field]: value } });
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <Alert variant="destructive">
          <AlertTitle>{t("settings.error.title")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error instanceof Error ? error.message : t("auth.error.generic")}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {t("settings.error.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || !me) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("settings.loading")}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.profile.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  {t("settings.profile.display_name")}
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("settings.profile.email")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    value={me.profile.email}
                    type="email"
                    readOnly
                    disabled
                  />
                  <ChangeEmailButton />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">{t("settings.profile.language")}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as Language)}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">{t("common.language.sv")}</SelectItem>
                    <SelectItem value="en">{t("common.language.en")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t("settings.profile.save")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.notifications.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("settings.notifications.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {t("settings.notifications.email")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.notifications.email_desc")}
                </p>
              </div>
              <Switch
                checked={me.preferences.emailWeeklySummary}
                disabled={updatePrefs.isPending}
                onCheckedChange={(v) => handleToggle("emailWeeklySummary", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {t("settings.notifications.deadlines")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.notifications.deadlines_desc")}
                </p>
              </div>
              <Switch
                checked={me.preferences.deadlineAlertsEnabled}
                disabled={updatePrefs.isPending}
                onCheckedChange={(v) =>
                  handleToggle("deadlineAlertsEnabled", v)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.security.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("settings.security.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ChangePasswordButton email={me.profile.email} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Change Password dialog ──
function ChangePasswordButton({ email }: { email: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  // Ensure we're inside an AuthProvider (we use supabase directly below).
  useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = useChangeMyPassword({
    mutation: {
      onSuccess: async (_data, variables) => {
        // Supabase admin.updateUserById revokes existing sessions, so the
        // current access token is now invalid. Re-establish the session
        // using the new password before any further authenticated calls.
        const newPwd = variables?.data?.newPassword;
        if (newPwd) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password: newPwd,
          });
          if (signInErr) {
            toast({
              title: t("settings.password.updated_signin_again"),
              description: signInErr.message,
              variant: "destructive",
            });
          } else {
            toast({ title: t("settings.password.updated_toast") });
          }
        } else {
          toast({ title: t("settings.password.updated_toast") });
        }
        setOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (err: unknown) => {
        let message = t("settings.password.update_error");
        if (err && typeof err === "object" && "message" in err) {
          message = String((err as { message: unknown }).message);
        }
        // Surface the most common 401 case as a clear toast.
        const localized =
          /incorrect|invalid_credentials|401/i.test(message)
            ? t("settings.password.current_wrong")
            : message;
        toast({
          title: t("settings.password.update_error"),
          description: localized,
          variant: "destructive",
        });
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: t("settings.password.update_error"),
        description: t("settings.password.too_short"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t("settings.password.update_error"),
        description: t("settings.password.mismatch"),
        variant: "destructive",
      });
      return;
    }
    changePassword.mutate({
      data: { currentPassword, newPassword },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Key className="mr-2 h-4 w-4" /> {t("settings.password.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("settings.password.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.password.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Hidden username field so password managers can associate
                the new credential with this account. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              hidden
            />
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t("settings.password.current")}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("settings.password.new")}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.password.hint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("settings.password.confirm")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("settings.password.cancel")}
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("settings.password.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Change Email dialog ──
function ChangeEmailButton() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const changeEmail = useChangeMyEmail({
    mutation: {
      onSuccess: () => {
        toast({
          title: t("settings.email.sent_title"),
          description: `${t("settings.email.sent_desc_prefix")}${newEmail}${t("settings.email.sent_desc_suffix")}`,
        });
        setOpen(false);
        setNewEmail("");
      },
      onError: (err: unknown) => {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : t("settings.email.error");
        toast({
          title: t("settings.email.error"),
          description: message,
          variant: "destructive",
        });
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    changeEmail.mutate({ data: { newEmail } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t("settings.profile.email_change")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("settings.email.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.email.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">{t("settings.email.new")}</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("settings.email.cancel")}
            </Button>
            <Button type="submit" disabled={changeEmail.isPending}>
              {changeEmail.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t("settings.email.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
