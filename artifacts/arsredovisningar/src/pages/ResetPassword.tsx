import { useEffect, useState, FormEvent } from "react";
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
import { Briefcase, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Recovery landing page for the Supabase password-reset email link.
 *
 * Flow:
 *   1. User clicks the link in their inbox → Supabase redirects here with
 *      `#access_token=…&type=recovery&…` in the URL hash.
 *   2. The supabase-js client auto-detects the recovery hash, creates a
 *      session, and fires a `PASSWORD_RECOVERY` auth-state event.
 *   3. We accept that event as the signal that this page is "armed" and
 *      let the user pick a new password via `auth.updateUser`.
 *
 * If the page is opened without a recovery link AND there's no logged-in
 * session, we show a "link expired or invalid" state instead of silently
 * failing later.
 */
export function ResetPassword() {
  const { updatePassword, session } = useAuth();
  const [, navigate] = useLocation();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Tracks whether we've observed a valid auth context for setting a new
  // password — either a fresh `PASSWORD_RECOVERY` event from the magic
  // link, or an already-active session at mount time. Starts as null
  // (unknown) so we can show a loading shell briefly while supabase-js
  // parses the URL hash.
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);
  // Captures Supabase-side errors that arrive on the URL itself
  // (e.g. `?error=access_denied&error_code=otp_expired`). Without this
  // the user just sees a generic "link invalid" message — surfacing the
  // Supabase reason makes it easier to diagnose dashboard misconfigs.
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase reports recovery-link problems via either the query string
    // (`?error=...&error_description=...`) when using the PKCE/code flow,
    // or the URL hash (`#error=...&error_description=...`) when using the
    // implicit flow. Check both before deciding the link is valid.
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errCode = search.get("error_code") ?? hash.get("error_code");
    const errDesc = search.get("error_description") ?? hash.get("error_description");
    const err = search.get("error") ?? hash.get("error");
    if (err || errCode || errDesc) {
      setLinkError(
        (errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : null) ||
          errCode ||
          err ||
          "Unknown error"
      );
      setRecoveryReady(false);
      return;
    }

    // If a session already exists at mount (either pre-authed user or
    // supabase-js has already finished hash parsing), accept it.
    if (session) {
      setRecoveryReady(true);
      return;
    }
    // Otherwise listen for the recovery event. If it doesn't arrive within
    // a short window we mark the link as invalid/expired.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setRecoveryReady(true);
      }
    });
    const timer = window.setTimeout(() => {
      setRecoveryReady((prev) => (prev === null ? false : prev));
    }, 2000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [session]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    // Send the user to the dashboard after a brief confirmation; they're
    // already authenticated by virtue of the recovery session.
    window.setTimeout(() => navigate("/"), 1500);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 relative">
      {/* Plain anchor (not wouter Link): the marketing homepage lives in a
          different artifact at "/", so we need a real navigation. */}
      <a
        href="/"
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to homepage
      </a>
      <div className="w-full max-w-md space-y-6 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Briefcase className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
          <p className="text-muted-foreground">
            Choose a strong password you haven't used before.
          </p>
        </div>

        <Card className="shadow-xl border-border/50">
          {recoveryReady === null ? (
            <>
              <CardHeader>
                <CardTitle>Verifying link…</CardTitle>
                <CardDescription>
                  Hang tight while we validate your reset link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-11" />
              </CardContent>
            </>
          ) : recoveryReady === false ? (
            <>
              <CardHeader>
                <CardTitle>Link invalid or expired</CardTitle>
                <CardDescription>
                  This reset link is no longer valid. Reset links expire shortly
                  after they're sent and can only be used once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Please request a new password reset email and click the
                    most recent link.
                  </span>
                </div>
                {linkError && (
                  <p className="text-xs text-muted-foreground">
                    Supabase reported: <span className="font-mono">{linkError}</span>
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-3">
                <Button
                  className="w-full h-11"
                  onClick={() => navigate("/forgot-password")}
                >
                  Request new link
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Back to sign in
                </Link>
              </CardFooter>
            </>
          ) : success ? (
            <>
              <CardHeader>
                <CardTitle>Password updated</CardTitle>
                <CardDescription>
                  Your password has been changed. Redirecting you to the
                  dashboard…
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Success — you're signed in.
                </div>
              </CardContent>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>New password</CardTitle>
                <CardDescription>
                  Pick a password with at least {MIN_PASSWORD_LENGTH} characters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    className="h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    className="h-11"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={loading || !password || !confirm}
                >
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
