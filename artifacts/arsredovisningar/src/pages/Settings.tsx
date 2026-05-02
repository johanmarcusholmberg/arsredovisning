import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, Key } from "lucide-react";

export function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and application settings.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your professional details.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input defaultValue="Admin" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input defaultValue="User" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input defaultValue="admin@example.com" type="email" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

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
                <p className="text-sm text-muted-foreground">Receive weekly summaries of reports.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Deadline Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified when a fiscal year approaches its end.</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
           <CardHeader className="border-b bg-muted/20 pb-4 text-destructive">
             <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage password and authentication.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
              <Key className="mr-2 h-4 w-4" /> Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
