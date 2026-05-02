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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { User, Bell, Shield, Key, Loader2 } from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const meQueryKey = getGetMeQueryKey();

  const { data: me, isLoading, isError, error, refetch } = useGetMe();

  const updateProfile = useUpdateMyProfile({
    mutation: {
      onSuccess: (data) => {
        qc.setQueryData(meQueryKey, data);
        toast({ title: "Profile updated" });
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not save profile",
          description: err instanceof Error ? err.message : "Unknown error",
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
          title: "Could not save preference",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        qc.invalidateQueries({ queryKey: meQueryKey });
      },
    },
  });

  // ── Profile form local state, hydrated from server ──
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<"sv" | "en">("sv");

  useEffect(() => {
    if (me) {
      setDisplayName(me.profile.displayName ?? "");
      setLanguage(me.profile.defaultUiLanguage);
    }
  }, [me]);

  function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    updateProfile.mutate({
      data: {
        displayName: displayName.trim() || null,
        defaultUiLanguage: language,
      },
    });
  }

  function handleToggle(field: "emailWeeklySummary" | "deadlineAlertsEnabled", value: boolean) {
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
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || !me) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences and application settings.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your display name and language.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input id="email" value={me.profile.email} type="email" readOnly disabled />
                  <ChangeEmailButton />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as "sv" | "en")}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">Svenska</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure how you receive alerts.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summaries of reports.
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
                <Label className="text-base">Deadline Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a fiscal year approaches its end.
                </p>
              </div>
              <Switch
                checked={me.preferences.deadlineAlertsEnabled}
                disabled={updatePrefs.isPending}
                onCheckedChange={(v) => handleToggle("deadlineAlertsEnabled", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage password and authentication.</CardDescription>
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
  // Ensure we're inside an AuthProvider (we use supabase directly below).
  useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
              title: "Password updated, but please sign in again",
              description: signInErr.message,
              variant: "destructive",
            });
          } else {
            toast({ title: "Password updated" });
          }
        } else {
          toast({ title: "Password updated" });
        }
        setOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
      },
      onError: (err: unknown) => {
        let message = "Could not update password";
        if (err && typeof err === "object" && "message" in err) {
          message = String((err as { message: unknown }).message);
        }
        // Surface the most common 401 case as a clear inline error.
        if (/incorrect|invalid_credentials|401/i.test(message)) {
          setError("Current password is incorrect.");
        } else {
          setError(message);
        }
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    changePassword.mutate({
      data: { currentPassword, newPassword },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Key className="mr-2 h-4 w-4" /> Change Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. Your session stays active.
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
              <Label htmlFor="currentPassword">Current Password</Label>
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
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
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
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changeEmail = useChangeMyEmail({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Confirmation email sent",
          description: `Check ${newEmail} for a confirmation link.`,
        });
        setOpen(false);
        setNewEmail("");
        setError(null);
      },
      onError: (err: unknown) => {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not change email";
        setError(message);
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    changeEmail.mutate({ data: { newEmail } });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Change
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              We'll send a confirmation link to your new address. The change takes effect once
              you confirm it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={changeEmail.isPending}>
              {changeEmail.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Confirmation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
