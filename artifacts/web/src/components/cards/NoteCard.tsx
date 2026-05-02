import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NoteCardProps {
  number: number;
  title: string;
  content: string;
  tags?: string[];
}

export function NoteCard({ number, title, content, tags }: NoteCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center bg-muted rounded size-6 text-xs font-bold text-muted-foreground">
              {number}
            </span>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {tags && tags.length > 0 && (
            <div className="flex gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/50">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/20 p-4 rounded-md border border-border/50">
          {content}
        </div>
      </CardContent>
    </Card>
  );
}
