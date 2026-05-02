import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ActionCardProps {
  title: string;
  description: string;
  action: ReactNode;
}

export function ActionCard({ title, description, action }: ActionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {action}
      </CardContent>
    </Card>
  );
}
