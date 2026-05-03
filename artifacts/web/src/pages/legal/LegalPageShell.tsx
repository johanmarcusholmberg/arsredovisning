import { ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface Section {
  title: string;
  body: string;
}

interface LegalPageShellProps {
  title: string;
  intro: string;
  sections: ReadonlyArray<Section>;
  /** Optional extra content rendered after the standard sections. */
  children?: ReactNode;
}

/** Shared layout for placeholder legal/support pages. Renders a clear
 *  "this is a placeholder" banner so it's obvious the copy is not final. */
export function LegalPageShell({ title, intro, sections, children }: LegalPageShellProps) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("legal.back")}
        </Link>
      </div>

      <div
        role="note"
        className="mb-8 flex items-start gap-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60"
      >
        <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-xs leading-relaxed">
          {t("legal.placeholder.banner")}
        </p>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-4 text-base text-muted-foreground leading-relaxed">{intro}</p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{section.body}</p>
          </section>
        ))}
        {children}
      </div>
    </div>
  );
}
