import { useEffect } from "react";
import { useLocation, Link, useRoute } from "wouter";
import {
  useGetCompany,
  useUpdateCompany,
  getGetCompanyQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

const isValidMonthDay = (v: string): boolean => {
  if (!/^\d{2}-\d{2}$/.test(v)) return false;
  const [m, d] = v.split("-").map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
};

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  orgNumber: z.string().regex(/^\d{6}-\d{4}$/, "Must be in format XXXXXX-XXXX"),
  legalForm: z.enum(["AB", "HB", "KB", "EF", "Ideell", "Stiftelse"]),
  accountingFramework: z.enum(["K2", "K3"]),
  fiscalYearStart: z.string().refine(isValidMonthDay, "Must be a valid MM-DD"),
  fiscalYearEnd: z.string().refine(isValidMonthDay, "Must be a valid MM-DD"),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export function CompanyEdit() {
  const [, params] = useRoute("/companies/:companyId/edit");
  const companyId = params?.companyId || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useGetCompany(companyId, {
    query: { enabled: !!companyId, queryKey: getGetCompanyQueryKey(companyId) },
  });

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      orgNumber: "",
      legalForm: "AB",
      accountingFramework: "K2",
      fiscalYearStart: "01-01",
      fiscalYearEnd: "12-31",
      address: "",
      zipCode: "",
      city: "",
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        orgNumber: company.orgNumber,
        legalForm: (company.legalForm as CompanyFormValues["legalForm"]) ?? "AB",
        accountingFramework: company.accountingFramework,
        fiscalYearStart: company.fiscalYearStart ?? "01-01",
        fiscalYearEnd: company.fiscalYearEnd ?? "12-31",
        address: company.address ?? "",
        zipCode: company.zipCode ?? "",
        city: company.city ?? "",
      });
    }
  }, [company, form]);

  const updateCompany = useUpdateCompany();

  const onSubmit = (data: CompanyFormValues) => {
    updateCompany.mutate(
      { companyId, data },
      {
        onSuccess: (updated) => {
          toast({
            title: "Company updated",
            description: `${updated.name} has been saved.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetCompanyQueryKey(companyId) });
          setLocation(`/companies/${companyId}`);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            const data = err.data as { error?: string; field?: string; message?: string } | null;
            if (data?.field === "orgNumber" || data?.error === "duplicate_org_number") {
              form.setError("orgNumber", {
                type: "server",
                message: data.message ?? "This organisation number is already used by another company.",
              });
              toast({
                title: "Organisation number already in use",
                description:
                  data.message ??
                  "A company with this organisation number already exists.",
                variant: "destructive",
              });
              return;
            }
            toast({
              title: "Error updating company",
              description: data?.message ?? err.message,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Error updating company",
            description: "An unexpected error occurred. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading || !company) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" asChild className="h-10 w-10 shrink-0 rounded-full">
          <Link href={`/companies/${companyId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Company</h1>
          <p className="text-muted-foreground">Update the company's registered details.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-md">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Company Details</CardTitle>
                  <CardDescription>All fields below can be updated.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="orgNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Number</FormLabel>
                  <FormControl><Input {...field} className="h-11 font-mono" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="legalForm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Form</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AB">Aktiebolag (AB)</SelectItem>
                      <SelectItem value="HB">Handelsbolag (HB)</SelectItem>
                      <SelectItem value="KB">Kommanditbolag (KB)</SelectItem>
                      <SelectItem value="EF">Enskild Firma (EF)</SelectItem>
                      <SelectItem value="Ideell">Ideell förening</SelectItem>
                      <SelectItem value="Stiftelse">Stiftelse</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="accountingFramework" render={({ field }) => (
                <FormItem>
                  <FormLabel>Accounting Framework</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="K2">K2 (Mindre företag)</SelectItem>
                      <SelectItem value="K3">K3 (Huvudregelverket)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="fiscalYearStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal Start (MM-DD)</FormLabel>
                    <FormControl><Input {...field} className="h-11 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fiscalYearEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal End (MM-DD)</FormLabel>
                    <FormControl><Input {...field} className="h-11 font-mono" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              </div>

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Street Address</FormLabel>
                  <FormControl><Input {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="zipCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl><Input {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} className="h-11" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter className="flex justify-end gap-4 border-t bg-muted/20 py-4 mt-6">
              <Button variant="ghost" asChild type="button">
                <Link href={`/companies/${companyId}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={updateCompany.isPending} className="px-8">
                {updateCompany.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
