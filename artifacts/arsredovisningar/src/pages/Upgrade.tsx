import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, FileCheck2, ArrowRight } from "lucide-react";
import { useEntitlement } from "@/hooks/useEntitlement";

/**
 * /upgrade — the paywall landing page.
 *
 * Shown when:
 *   - A free user tries to enter /companies/new, /companies/:id or
 *     any /reports/:reportId/* route (handled by <RequirePaid />).
 *   - The user manually navigates here from a banner or sidebar.
 *
 * Stripe is not yet wired. Until then we explain the model (1 credit =
 * 1 company + 1 fiscal year + 1 report) and ask the user to contact
 * the team to be granted credits manually.
 */
export function Upgrade() {
  const { isPaid, availableProjectCredits, isAdmin } = useEntitlement();

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Lås upp ditt riktiga räkenskapsår
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          För att skapa en riktig årsredovisning behöver du minst en
          projektkredit. En kredit räcker för ett bolag, ett räkenskapsår
          och en färdig rapport.
        </p>
      </div>

      {isPaid && (
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <ShieldCheck className="h-5 w-5" />
              Du har redan tillgång
            </CardTitle>
            <CardDescription className="text-green-900/80">
              {isAdmin
                ? "Som administratör har du obegränsad åtkomst."
                : `Du har ${availableProjectCredits} oanvända projektkrediter.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">
                Gå till min översikt
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Vad ingår i en kredit
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• 1 bolag (med organisationsnummer och uppgifter)</p>
            <p>• 1 räkenskapsår</p>
            <p>• 1 färdigställd årsredovisning (PDF + Word, utan vattenmärke)</p>
            <p>• Obegränsad redigering tills rapporten exporteras</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vill du prova först?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Du kan köra hela flödet i demoarbetsytan utan kostnad. All
              export blir vattenmärkt och ingen riktig data lagras.
            </p>
            <Button variant="outline" asChild>
              <a href="/demo">Öppna demo</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {!isPaid && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Begär krediter</CardTitle>
            <CardDescription>
              Stripe-betalning är inte aktiverad ännu. Kontakta oss för att få
              krediter manuellt tilldelade till ditt konto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="mailto:hello@example.com?subject=Begär%20projektkredit">
                Mejla teamet
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
