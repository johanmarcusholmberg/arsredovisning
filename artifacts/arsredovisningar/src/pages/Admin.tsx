import { useState } from "react";
import { Redirect } from "wouter";
import {
  useAdminListUsers,
  useAdminGrantCredits,
  useAdminSetAdmin,
  useAdminListProjects,
  useAdminGrantProjectEntitlement,
  useAdminRevokeProjectEntitlement,
  getAdminListUsersQueryKey,
  getAdminListProjectsQueryKey,
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
import { useEntitlement } from "@/hooks/useEntitlement";
import { useToast } from "@/hooks/use-toast";

/**
 * /admin — site-admin console.
 *
 * Grants project credits, toggles admin flags, and lets support staff
 * manually issue or revoke per-project entitlements (used for refunds /
 * customer-support credit-recovery flows). Stripe webhooks will eventually
 * automate the credit-grant path; for now this is the only way to give
 * a user access to the real workspace.
 */
export function Admin() {
  const { isLoading: entLoading, isAdmin } = useEntitlement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usersQ = useAdminListUsers({
    query: { enabled: isAdmin, queryKey: getAdminListUsersQueryKey() },
  });
  const projectsQ = useAdminListProjects({
    query: { enabled: isAdmin, queryKey: getAdminListProjectsQueryKey() },
  });
  const grantCredits = useAdminGrantCredits();
  const setAdmin = useAdminSetAdmin();
  const grantEnt = useAdminGrantProjectEntitlement();
  const revokeEnt = useAdminRevokeProjectEntitlement();

  const [pendingDeltaByUser, setPendingDeltaByUser] = useState<Record<string, string>>({});

  if (entLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return <Redirect to="/" />;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminListProjectsQueryKey() });
  };

  const handleGrant = (profileId: string, deltaInput: string) => {
    const delta = parseInt(deltaInput, 10);
    if (!Number.isFinite(delta) || delta === 0) {
      toast({ title: "Ogiltigt antal", description: "Ange ett heltal som inte är 0", variant: "destructive" });
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
        onError: () => {
          toast({ title: "Misslyckades", variant: "destructive" });
        },
      },
    );
  };

  const handleToggleAdmin = (profileId: string, next: boolean) => {
    setAdmin.mutate(
      { profileId, data: { isAdmin: next } },
      {
        onSuccess: () => {
          toast({ title: next ? "Användare är nu admin" : "Adminbehörighet borttagen" });
          refresh();
        },
        onError: () => toast({ title: "Misslyckades", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-300">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Hantera projektkrediter, adminbehörigheter och projektaktivering.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Användare</CardTitle>
          <CardDescription>
            Lägg till eller dra tillbaka projektkrediter. Negativa värden
            sänker saldot men kan inte gå under 0.
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
                    <th className="py-2">Namn</th>
                    <th className="py-2">Krediter</th>
                    <th className="py-2">Admin</th>
                    <th className="py-2">Justera krediter</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQ.data?.users?.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 font-mono text-xs">{u.email}</td>
                      <td className="py-2">{u.displayName ?? "—"}</td>
                      <td className="py-2 font-mono">{u.availableProjectCredits}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant={u.isAdmin ? "default" : "outline"}
                          onClick={() => handleToggleAdmin(u.id, !u.isAdmin)}
                          disabled={setAdmin.isPending}
                        >
                          {u.isAdmin ? "Admin" : "Gör admin"}
                        </Button>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="±"
                            className="w-20 h-8"
                            value={pendingDeltaByUser[u.id] ?? ""}
                            onChange={(e) =>
                              setPendingDeltaByUser((p) => ({ ...p, [u.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            onClick={() => handleGrant(u.id, pendingDeltaByUser[u.id] ?? "")}
                            disabled={grantCredits.isPending}
                          >
                            Tillämpa
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

      <Card>
        <CardHeader>
          <CardTitle>Projekt</CardTitle>
          <CardDescription>
            Manuellt ge eller dra tillbaka projektaktivering (för support
            och refund-flöden).
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
                    <th className="py-2">Räkenskapsår</th>
                    <th className="py-2">Ägare</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Aktivt</th>
                    <th className="py-2">Åtgärd</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsQ.data?.projects?.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="py-2">{p.companyName}</td>
                      <td className="py-2 font-mono text-xs">
                        {p.fiscalYearStart} → {p.fiscalYearEnd}
                      </td>
                      <td className="py-2 font-mono text-xs">{p.ownerEmail ?? "—"}</td>
                      <td className="py-2">
                        {p.isDemo ? <Badge variant="outline">Demo</Badge> : <Badge>{p.status}</Badge>}
                      </td>
                      <td className="py-2">
                        {p.hasActiveEntitlement ? (
                          <Badge className="bg-green-600">Aktivt</Badge>
                        ) : (
                          <Badge variant="outline">Inaktivt</Badge>
                        )}
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
                                onError: () => toast({ title: "Misslyckades", variant: "destructive" }),
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
                                onError: () => toast({ title: "Misslyckades", variant: "destructive" }),
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
    </div>
  );
}
