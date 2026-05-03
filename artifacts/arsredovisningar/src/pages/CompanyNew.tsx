import { useLocation, Link } from "wouter";
import { useCreateCompany, ApiError } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLanguage } from "@/hooks/useLanguage";

const isValidMonthDay = (v: string): boolean => {
  if (!/^\d{2}-\d{2}$/.test(v)) return false;
  const [m, d] = v.split("-").map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
};

// We use translation *keys* as the zod error messages and resolve them at
// render time via `t()`. This keeps validation message text reactive to
// language switches.
const companySchema = z.object({
  name: z.string().min(1, "company.form.error.required_name"),
  orgNumber: z.string().regex(/^\d{6}-\d{4}$/, "company.form.error.org_format"),
  legalForm: z.enum(["AB", "HB", "KB", "EF", "Ideell", "Stiftelse"]),
  accountingFramework: z.enum(["K2", "K3"]),
  fiscalYearStart: z.string().refine(isValidMonthDay, "company.form.error.month_day"),
  fiscalYearEnd: z.string().refine(isValidMonthDay, "company.form.error.month_day"),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export function CompanyNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

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

  const createCompany = useCreateCompany();

  // P4-4: fire `first_company_created` once per browser. Cheap heuristic —
  // the server has the authoritative count if we ever care to dedupe more
  // accurately. Importing inline to keep the helper out of the hot path.
  const trackFirstCompanyOnce = () => {
    try {
      if (
        typeof window !== "undefined" &&
        !window.localStorage.getItem("ar.firstCompanyTracked")
      ) {
        void import("@/lib/track").then(({ track }) =>
          track("first_company_created"),
        );
        window.localStorage.setItem("ar.firstCompanyTracked", "1");
      }
    } catch {
      /* ignore */
    }
  };

  const onSubmit = (data: CompanyFormValues) => {
    createCompany.mutate(
      { data },
      {
        onSuccess: (company) => {
          trackFirstCompanyOnce();
          toast({
            title: t("company.toast.created_title"),
            description: `${t("company.toast.created_desc_prefix")}${company.name}${t("company.toast.created_desc_suffix")}`,
          });
          setLocation(`/companies/${company.id}`);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            const data = err.data as
              | { error?: string; field?: string; message?: string }
              | null;
            if (
              data?.field === "orgNumber" ||
              data?.error === "duplicate_org_number"
            ) {
              form.setError("orgNumber", {
                type: "server",
                message: data.message ?? t("company.toast.duplicate_org_desc"),
              });
              toast({
                title: t("company.toast.duplicate_org_title"),
                description:
                  data.message ?? t("company.toast.duplicate_org_desc"),
                variant: "destructive",
              });
              return;
            }
            toast({
              title: t("company.toast.create_error_title"),
              description: data?.message ?? err.message,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: t("company.toast.create_error_title"),
            description: t("company.toast.unexpected"),
            variant: "destructive",
          });
        },
      },
    );
  };

  // Resolve a possibly-i18n-key validation message back into a localized
  // string. Plain literal messages (defensive) are returned as-is.
  const tMsg = (m?: string): string | undefined => {
    if (!m) return undefined;
    if (m.startsWith("company.form.error.")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return t(m as any);
    }
    return m;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="icon"
          asChild
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={t("company.form.back_aria")}
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("company.new.title")}
          </h1>
          <p className="text-muted-foreground">{t("company.new.subtitle")}</p>
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
                  <CardTitle>{t("company.form.section.details")}</CardTitle>
                  <CardDescription>
                    {t("company.form.section.details_new_desc")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t("company.form.field.name")}</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" />
                    </FormControl>
                    <FormMessage>{tMsg(fieldState.error?.message)}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgNumber"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("company.form.field.org_number")}</FormLabel>
                    <FormControl>
                      <Input placeholder="556000-1234" {...field} className="h-11 font-mono" />
                    </FormControl>
                    <FormMessage>{tMsg(fieldState.error?.message)}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legalForm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("company.form.field.legal_form")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={t("company.form.field.legal_form_placeholder")} />
                        </SelectTrigger>
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
                )}
              />

              <FormField
                control={form.control}
                name="accountingFramework"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("company.form.field.framework")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={t("company.form.field.framework_placeholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="K2">K2 (Mindre företag)</SelectItem>
                        <SelectItem value="K3">K3 (Huvudregelverket)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fiscalYearStart"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{t("company.form.field.fiscal_start")}</FormLabel>
                      <FormControl>
                        <Input placeholder="MM-DD" {...field} className="h-11 font-mono" />
                      </FormControl>
                      <FormMessage>{tMsg(fieldState.error?.message)}</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fiscalYearEnd"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{t("company.form.field.fiscal_end")}</FormLabel>
                      <FormControl>
                        <Input placeholder="MM-DD" {...field} className="h-11 font-mono" />
                      </FormControl>
                      <FormMessage>{tMsg(fieldState.error?.message)}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-4">
                  {t("company.form.section.contact")}
                </h3>
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t("company.form.field.address")}</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("company.form.field.zip")}</FormLabel>
                    <FormControl>
                      <Input placeholder="123 45" {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("company.form.field.city")}</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-4 border-t bg-muted/20 py-4 mt-6">
              <Button variant="ghost" asChild type="button">
                <Link href="/">{t("company.form.cancel")}</Link>
              </Button>
              <Button type="submit" disabled={createCompany.isPending} className="px-8">
                {createCompany.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("company.form.save_new")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
