import { Link } from "wouter";
import {
  useListCompanies,
  getListCompaniesQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Plus, ArrowRight, Calendar } from "lucide-react";

export function Companies() {
  const {
    data: companies,
    isLoading,
    isError,
  } = useListCompanies({
    query: { queryKey: getListCompaniesQueryKey() },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Your client companies. Open a company to manage its annual reports.
          </p>
        </div>
        <Button asChild className="shrink-0 h-11 px-6 shadow-sm">
          <Link href="/companies/new">
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20 text-center">
          <h3 className="font-bold text-lg mb-2">Error loading companies</h3>
          <p>Could not fetch companies. Please try refreshing.</p>
        </div>
      ) : !companies || companies.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">
              No companies yet
            </h3>
            <p className="mt-1 mb-6">
              Add your first client company to start drafting annual reports.
            </p>
            <Button asChild>
              <Link href="/companies/new">
                <Plus className="mr-2 h-4 w-4" /> Create First Company
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="group block"
            >
              <Card className="shadow-sm hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="font-mono bg-muted/50"
                    >
                      {company.orgNumber}
                    </Badge>
                    <Badge variant="secondary">{company.legalForm}</Badge>
                  </div>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{company.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 pt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">
                      {company.fiscalYearStart} – {company.fiscalYearEnd}
                    </span>
                    <span className="ml-auto text-xs">
                      {company.accountingFramework}
                    </span>
                  </CardDescription>
                </CardHeader>
                {(company.address || company.city) && (
                  <CardContent className="text-sm text-muted-foreground">
                    {[company.address, company.zipCode, company.city]
                      .filter(Boolean)
                      .join(", ")}
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
