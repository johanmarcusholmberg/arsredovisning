import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { mapApiErrorToKey } from "@/lib/errorMap";
import type { StringKey } from "@/i18n/strings";

/**
 * Convenience hook (P3-2) that takes any thrown/awaited error and shows
 * a localized destructive toast for it. Centralises the
 *
 *   toast({
 *     variant: "destructive",
 *     title: t("..."),
 *     description: t(mapApiErrorToKey(err)),
 *   })
 *
 * boilerplate scattered across the app. Pages that already surface
 * field-level errors (e.g. duplicate org number) should keep their
 * special-case handling and only fall through to this hook for the
 * generic case.
 */
export function useErrorToast(): (err: unknown, titleKey?: StringKey) => void {
  const { toast } = useToast();
  const { t } = useLanguage();

  return useCallback(
    (err: unknown, titleKey: StringKey = "error_boundary.title") => {
      toast({
        variant: "destructive",
        title: t(titleKey),
        description: t(mapApiErrorToKey(err)),
      });
    },
    [toast, t],
  );
}
