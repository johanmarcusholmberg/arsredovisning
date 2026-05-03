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
import { Briefcase, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Fire and forget — we deliberately ignore the result so the response
    // is identical whether or not the address has an account. Surfacing
    // backend error text here would leak account existence (or at minimum
    // produce distinguishable behaviour) to unauthenticated callers.
    // Real transport errors are silently swallowed; the user can simply
    // re-request a new link if no email arrives.
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
          <h1 className="text-3xl font-bold tracking-tight">Forgot your password?</h1>
          <p className="text-muted-foreground">
            We'll email you a link to set a new one.
          </p>
        </div>

        <Card className="shadow-xl border-border/50">
          {submitted ? (
            <>
              <CardHeader>
                <CardTitle>Check your inbox</CardTitle>
                <CardDescription>
                  If an account exists for <span className="font-medium">{email}</span>,
                  you'll receive an email with a link to reset your password.
                  The link is valid for a limited time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Didn't get it? Check your spam folder, or try again with a
                    different email address.
                  </span>
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
                  Use a different email
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Back to sign in
                </Link>
              </CardFooter>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Reset password</CardTitle>
                <CardDescription>
                  Enter the email address associated with your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
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
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Back to sign in
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
