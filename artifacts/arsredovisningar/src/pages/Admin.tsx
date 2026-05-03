import { useState } from "react";
import { Redirect } from "wouter";
import {
  useAdminListUsers,
  useAdminGrantCredits,
  useAdminSetAdmin,
  useAdminSetUserStatus,
  useAdminListProjects,
  useAdminGrantProjectEntitlement,
  useAdminRevokeProjectEntitlement,
  useAdminGetStats,
  useAdminListPayments,
  useAdminListAudit,
  getAdminListUsersQueryKey,
  getAdminListProjectsQueryKey,
  getAdminGetStatsQueryKey,
  getAdminListPaymentsQueryKey,
  getAdminListAuditQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useToast } from "@/hooks/use-toast";

/**
 * /admin — site-admin console.
 *
 * Tabs:
 *   - Overview      → platform-wide counts
 *   - Users         → role/status/credits, block & promote actions
 *   - Projects      → metadata + entitlement & export status
 *   - Payments      → entitlement / Stripe records
 *   - Demo Content  → placeholder for future demo asset management
 *   - Audit Log     → recent admin & system events
 *
 * All admin checks are enforced server-side. This component additionally
 * redirects non-admins away — but security does NOT depend on this guard.
 */
export function Admin() {
  const { isLoading: entLoading, isAdmin } = useEntitlement();

  if (entLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return <Redirect to="/" />;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Intern hantering av användare, projekt och betalningar.
        </p>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Översikt</TabsTrigger>
          <TabsTrigger value="users">Användare</TabsTrigger>
          <TabsTrigger value="projects">Projekt</TabsTrigger>
          <TabsTrigger value="payments">Betalningar</TabsTrigger>
          <TabsTrigger value="demo">Demoinnehåll</TabsTrigger>
          <TabsTrigger value="audit">Loggar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="demo">
          <DemoContentTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}

function OverviewTab() {
  const statsQ = useAdminGetStats({
    query: { queryKey: getAdminGetStatsQueryKey() },
  });
  const usersQ = useAdminListUsers({
    query: { queryKey: getAdminListUsersQueryKey() },
  });
  const projectsQ = useAdminListProjects({
    query: { queryKey: getAdminListProjectsQueryKey() },
  });

  if (statsQ.isLoading) return <Skeleton className="h-64 w-full" />;
  const s = statsQ.data;
  if (!s) return <div className="text-muted-foreground">Ingen statistik ännu.</div>;

  const recentUsers = (usersQ.data?.users ?? []).slice(0, 5);
  const recentProjects = (projectsQ.data?.projects ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Registrerade användare" value={s.totalUsers} />
        <StatCard label="Betalande" value={s.paidUsers} />
        <StatCard label="Demo / fri" value={s.demoUsers} />
        <StatCard label="Adminer" value={s.adminUsers} />
        <StatCard label="Blockerade" value={s.blockedUsers} />
        <StatCard label="Projekt totalt" value={s.totalProjects} />
        <StatCard label="Riktiga projekt" value={s.realProjects} />
        <StatCard label="Demoprojekt" value={s.demoProjects} />
        <StatCard
          label="Exporter"
          value={s.totalExports}
          hint={s.failedExports > 0 ? `${s.failedExports} misslyckade` : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Senaste användare</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentUsers.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span className="font-mono text-xs truncate">{u.email}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("sv-SE")}
                  </span>
                </li>
              ))}
              {recentUsers.length === 0 ? (
                <li className="text-muted-foreground">Inga användare ännu.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Senaste projekt</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentProjects.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="truncate">{p.companyName}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {p.isDemo ? "Demo" : p.status}
                  </span>
                </li>
              ))}
              {recentProjects.length === 0 ? (
                <li className="text-muted-foreground">Inga projekt ännu.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const variant: Record<string, string> = {
    admin: "bg-primary text-primary-foreground",
    paid_user: "bg-green-600 text-white",
    demo_user: "bg-muted text-muted-foreground",
    blocked: "bg-destructive text-destructive-foreground",
  };
  const label: Record<string, string> = {
    admin: "Admin",
    paid_user: "Betalande",
    demo_user: "Demo",
    blocked: "Blockerad",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        variant[role] ?? "bg-muted"
      }`}
    >
      {label[role] ?? role}
    </span>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const usersQ = useAdminListUsers({
    query: { queryKey: getAdminListUsersQueryKey() },
  });
  const grantCredits = useAdminGrantCredits();
  const setAdmin = useAdminSetAdmin();
  const setStatus = useAdminSetUserStatus();
  const [pendingDeltaByUser, setPendingDeltaByUser] = useState<
    Record<string, string>
  >({});

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
  };

  const handleGrant = (profileId: string, deltaInput: string) => {
    const delta = parseInt(deltaInput, 10);
    if (!Number.isFinite(delta) || delta === 0) {
      toast({
        title: "Ogiltigt antal",
        description: "Ange ett heltal som inte är 0",
        variant: "destructive",
      });
      return;
    }
    grantCredits.mutate(
      { profileId, data: { delta } },
      {
        onSuccess: () => {
          toast({ title: "Krediter uppdaterade" });
          setPendingDeltaByUser((p) => ({ ...p, [profileId]: "" }));
          refresh();
        },
        onError: () => toast({ title: "Misslyckades", variant: "destructive" }),
      },
    );
  };

  const handleToggleAdmin = (profileId: string, next: boolean, isProtected: boolean) => {
    if (isProtected && !next) {
      toast({
        title: "Skyddad admin",
        description: "Huvudadmin kan inte demoteras.",
        variant: "destructive",
      });
      return;
    }
    setAdmin.mutate(
      { profileId, data: { isAdmin: next } },
      {
        onSuccess: () => {
          toast({
            title: next ? "Användare är nu admin" : "Adminbehörighet borttagen",
          });
          refresh();
        },
        onError: () =>
          toast({ title: "Misslyckades", variant: "destructive" }),
      },
    );
  };

  const handleToggleBlocked = (
    profileId: string,
    nextBlocked: boolean,
    isProtected: boolean,
  ) => {
    if (isProtected && nextBlocked) {
      toast({
        title: "Skyddad admin",
        description: "Huvudadmin kan inte blockeras.",
        variant: "destructive",
      });
      return;
    }
    setStatus.mutate(
      {
        profileId,
        data: { status: nextBlocked ? "blocked" : "active" },
      },
      {
        onSuccess: () => {
          toast({
            title: nextBlocked ? "Användare blockerad" : "Användare upplåst",
          });
          refresh();
        },
        onError: () =>
          toast({ title: "Misslyckades", variant: "destructive" }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Användare</CardTitle>
        <CardDescription>
          Hantera roll, status och projektkrediter. Huvudadmin är skyddad mot
          ändringar härifrån.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {usersQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">E-post</th>
                  <th className="py-2">Roll</th>
                  <th className="py-2">Projekt</th>
                  <th className="py-2">Krediter</th>
                  <th className="py-2">Senast inloggad</th>
                  <th className="py-2">Skapad</th>
                  <th className="py-2">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {usersQ.data?.users?.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/30">
                    <td className="py-2">
                      <div className="font-mono text-xs">{u.email}</div>
                      {u.displayName ? (
                        <div className="text-xs text-muted-foreground">
                          {u.displayName}
                        </div>
                      ) : null}
                      {u.isProtected ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          Skyddad
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2">
                      <RoleBadge role={u.accountRole} />
                    </td>
                    <td className="py-2 font-mono">{u.projectCount}</td>
                    <td className="py-2 font-mono">
                      {u.availableProjectCredits}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {u.lastSignInAt
                        ? new Date(u.lastSignInAt).toLocaleString("sv-SE")
                        : "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("sv-SE")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          type="number"
                          placeholder="±"
                          className="w-20 h-8"
                          value={pendingDeltaByUser[u.id] ?? ""}
                          onChange={(e) =>
                            setPendingDeltaByUser((p) => ({
                              ...p,
                              [u.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            handleGrant(u.id, pendingDeltaByUser[u.id] ?? "")
                          }
                          disabled={grantCredits.isPending}
                        >
                          Krediter
                        </Button>
                        <Button
                          size="sm"
                          variant={u.isAdmin ? "default" : "outline"}
                          onClick={() =>
                            handleToggleAdmin(u.id, !u.isAdmin, u.isProtected)
                          }
                          disabled={setAdmin.isPending || u.isProtected}
                          title={
                            u.isProtected
                              ? "Skyddad admin – kan inte ändras"
                              : undefined
                          }
                        >
                          {u.isAdmin ? "Ta bort admin" : "Gör admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            u.status === "blocked" ? "default" : "outline"
                          }
                          onClick={() =>
                            handleToggleBlocked(
                              u.id,
                              u.status !== "blocked",
                              u.isProtected,
                            )
                          }
                          disabled={setStatus.isPending || u.isProtected}
                          title={
                            u.isProtected
                              ? "Skyddad admin – kan inte blockeras"
                              : undefined
                          }
                        >
                          {u.status === "blocked" ? "Lås upp" : "Blockera"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Projects ────────────────────────────────────────────────────────────────

function ProjectsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectsQ = useAdminListProjects({
    query: { queryKey: getAdminListProjectsQueryKey() },
  });
  const grantEnt = useAdminGrantProjectEntitlement();
  const revokeEnt = useAdminRevokeProjectEntitlement();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getAdminListProjectsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projekt</CardTitle>
        <CardDescription>
          Endast metadata visas här. Detaljerade redovisningsdata är fortfarande
          skyddade per projekt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projectsQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Bolag</th>
                  <th className="py-2">Org.nr</th>
                  <th className="py-2">Räkenskapsår</th>
                  <th className="py-2">Ägare</th>
                  <th className="py-2">Typ</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Aktivering</th>
                  <th className="py-2">Senaste export</th>
                  <th className="py-2">Skapad</th>
                  <th className="py-2">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {projectsQ.data?.projects?.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-2">{p.companyName}</td>
                    <td className="py-2 font-mono text-xs">
                      {p.companyOrgNumber ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {p.fiscalYearStart} → {p.fiscalYearEnd}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {p.ownerEmail ?? "—"}
                    </td>
                    <td className="py-2">
                      {p.isDemo ? (
                        <Badge variant="outline">Demo</Badge>
                      ) : (
                        <Badge>Riktigt</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline">{p.status}</Badge>
                    </td>
                    <td className="py-2">
                      {p.hasActiveEntitlement ? (
                        <Badge className="bg-green-600">Aktivt</Badge>
                      ) : (
                        <Badge variant="outline">Inaktivt</Badge>
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {p.latestExportStatus ? (
                        <>
                          <Badge variant="outline">{p.latestExportStatus}</Badge>
                          {p.latestExportAt ? (
                            <div className="text-muted-foreground mt-0.5">
                              {new Date(p.latestExportAt).toLocaleDateString(
                                "sv-SE",
                              )}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("sv-SE")}
                    </td>
                    <td className="py-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          grantEnt.mutate(
                            { projectId: p.id },
                            {
                              onSuccess: () => {
                                toast({ title: "Aktivering tilldelad" });
                                refresh();
                              },
                              onError: () =>
                                toast({
                                  title: "Misslyckades",
                                  variant: "destructive",
                                }),
                            },
                          )
                        }
                        disabled={grantEnt.isPending}
                      >
                        Aktivera
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          revokeEnt.mutate(
                            { projectId: p.id },
                            {
                              onSuccess: () => {
                                toast({ title: "Aktivering borttagen" });
                                refresh();
                              },
                              onError: () =>
                                toast({
                                  title: "Misslyckades",
                                  variant: "destructive",
                                }),
                            },
                          )
                        }
                        disabled={revokeEnt.isPending}
                      >
                        Inaktivera
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

function PaymentsTab() {
  const paymentsQ = useAdminListPayments({
    query: { queryKey: getAdminListPaymentsQueryKey() },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Betalningar och aktiveringar</CardTitle>
        <CardDescription>
          Visar varje aktivering — manuell tilldelning, Stripe-betalning eller
          prenumeration. Stripe-ID:n fylls i automatiskt när webhook är aktiv.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {paymentsQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Användare</th>
                  <th className="py-2">Bolag</th>
                  <th className="py-2">Typ</th>
                  <th className="py-2">Källa</th>
                  <th className="py-2">Stripe</th>
                  <th className="py-2">Aktivt</th>
                  <th className="py-2">Skapad</th>
                </tr>
              </thead>
              <tbody>
                {paymentsQ.data?.payments?.map((pay) => (
                  <tr key={pay.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-mono text-xs">
                      {pay.payerEmail ?? "—"}
                    </td>
                    <td className="py-2">{pay.companyName ?? "—"}</td>
                    <td className="py-2">
                      <Badge variant="outline">{pay.entitlementType}</Badge>
                    </td>
                    <td className="py-2 text-xs">{pay.source}</td>
                    <td className="py-2 font-mono text-[10px]">
                      {pay.stripePaymentIntentId ??
                        pay.stripeSubscriptionId ??
                        "—"}
                    </td>
                    <td className="py-2">
                      {pay.isActive ? (
                        <Badge className="bg-green-600">Aktivt</Badge>
                      ) : (
                        <Badge variant="outline">Inaktivt</Badge>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(pay.createdAt).toLocaleString("sv-SE")}
                    </td>
                  </tr>
                ))}
                {paymentsQ.data?.payments?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-muted-foreground"
                    >
                      Inga betalningar ännu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Demo Content ───────────────────────────────────────────────────────────

function DemoContentTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demoinnehåll</CardTitle>
        <CardDescription>
          Här kommer hantering av demoslides, demo-PDF och exempeldata att ske.
          Demobolaget och dess projekt skapas redan via fröning av databasen.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          Just nu visas publicerat demoinnehåll endast på den publika webbplatsen.
          Redigering är reserverad för administratörer; inga frontend-rutter
          låter vanliga användare ändra demoinnehåll.
        </p>
        <p>
          Kommande funktioner: ladda upp / publicera demo-PDF, redigera
          slidetexter, byta exempelbolag.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

function AuditTab() {
  const auditQ = useAdminListAudit(
    { limit: 200 },
    { query: { queryKey: getAdminListAuditQueryKey({ limit: 200 }) } },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitetslogg</CardTitle>
        <CardDescription>
          De 200 senaste händelserna. Innehåller alla admin-åtgärder
          (rollbyten, blockeringar, manuella aktiveringar, kreditjusteringar)
          samt övriga systemhändelser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Tid</th>
                  <th className="py-2">Händelse</th>
                  <th className="py-2">Aktör</th>
                  <th className="py-2">Projekt</th>
                  <th className="py-2">Detaljer</th>
                </tr>
              </thead>
              <tbody>
                {auditQ.data?.events?.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30 align-top">
                    <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("sv-SE")}
                    </td>
                    <td className="py-2 font-mono text-xs">{e.eventType}</td>
                    <td className="py-2 font-mono text-xs">
                      {e.actorEmail ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-[10px] text-muted-foreground">
                      {e.projectId ?? "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {e.eventData ? (
                        <pre className="font-mono text-[10px] bg-muted/40 rounded p-2 max-w-md overflow-auto">
                          {JSON.stringify(e.eventData, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {auditQ.data?.events?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-muted-foreground"
                    >
                      Inga händelser loggade ännu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
