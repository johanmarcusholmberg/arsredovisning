import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/useLanguage";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /**
   * When true, the optional caps-lock hint is shown beneath the field.
   * Defaults to true; pass `false` for fields where the hint adds noise
   * (e.g. confirm-password, where the user just retypes).
   */
  showCapsLockHint?: boolean;
};

/**
 * Password field with:
 *  - eye-toggle to reveal/hide the value (proper aria-pressed semantics).
 *  - caps-lock detection that shows a localized hint while focused with
 *    Caps Lock active. Detection is event-driven via getModifierState so
 *    we don't need a global listener and we never store the password.
 *  - sr-only label coordination delegated to the parent (caller still
 *    provides <Label htmlFor=...>).
 *
 * The trailing button keeps right-padding on the input (pr-10) so text
 * never collides with the icon.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, showCapsLockHint = true, onKeyUp, onKeyDown, onBlur, ...props },
    ref,
  ) {
    const { t } = useLanguage();
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    const checkCapsLock = (e: KeyboardEvent<HTMLInputElement>) => {
      // Some keystrokes (e.g. Tab) don't carry getModifierState reliably;
      // we just guard against missing API in non-DOM keyboard events.
      if (typeof e.getModifierState === "function") {
        setCapsLock(e.getModifierState("CapsLock"));
      }
    };

    return (
      <div className="space-y-1">
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-10", className)}
            onKeyDown={(e) => {
              checkCapsLock(e);
              onKeyDown?.(e);
            }}
            onKeyUp={(e) => {
              checkCapsLock(e);
              onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLock(false);
              onBlur?.(e);
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? t("password.hide") : t("password.show")}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* aria-live so SR users learn why their typing is being flagged. */}
        <p
          aria-live="polite"
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400",
            !(showCapsLockHint && capsLock) && "sr-only",
          )}
        >
          {showCapsLockHint && capsLock ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              {t("password.caps_lock_on")}
            </>
          ) : null}
        </p>
      </div>
    );
  },
);
