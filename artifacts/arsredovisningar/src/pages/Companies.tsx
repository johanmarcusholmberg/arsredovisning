import { Link } from "wouter";
import {
  useListCompanies,
  getListCompaniesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building, Plus, ChevronRight } from "lucide-react";

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
        <Card className="shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
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
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%]">Name</TableHead>
                <TableHead className="w-[16%]">Org. number</TableHead>
                <TableHead className="w-[10%]">Form</TableHead>
                <TableHead className="w-[14%]">Fiscal year</TableHead>
                <TableHead className="w-[10%]">Framework</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="w-[40px]" aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const location = [company.zipCode, company.city]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <TableRow
                    key={company.id}
                    className="group cursor-pointer"
                    onClick={(e) => {
                      // Let the inner <Link> handle clicks; this is a
                      // backup so the whole row is clickable for users who
                      // miss the title link.
                      const target = e.target as HTMLElement;
                      if (target.closest("a")) return;
                      const link = e.currentTarget.querySelector<HTMLAnchorElement>(
                        "a[data-row-link]"
                      );
                      link?.click();
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/companies/${company.id}`}
                        data-row-link
                        className="hover:underline focus:outline-none focus-visible:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {company.orgNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {company.legalForm}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {company.fiscalYearStart} – {company.fiscalYearEnd}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {company.accountingFramework}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                      {location || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors inline" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
