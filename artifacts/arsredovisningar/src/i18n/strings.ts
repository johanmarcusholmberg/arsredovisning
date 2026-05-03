// Translations for the auth and high-traffic pages of the arsredovisningar
// app. We share the same `lang` localStorage key as the web (marketing)
// artifact so a user who picks Swedish on the homepage continues to see
// Swedish across login, register, password reset, etc.

export type Language = "sv" | "en";

export const strings = {
  sv: {
    // ── Common ────────────────────────────────────────────────────────────
    "common.back_to_homepage": "Till startsidan",
    "common.email": "E-postadress",
    "common.password": "Lösenord",
    "common.language": "Språk",
    "common.language.sv": "Svenska",
    "common.language.en": "English",

    // ── Login ─────────────────────────────────────────────────────────────
    "login.welcome": "Välkommen tillbaka",
    "login.subtitle": "Ange dina uppgifter för att logga in på ditt konto",
    "login.card.title": "Logga in",
    "login.card.description": "Använd din e-post och ditt lösenord för att logga in.",
    "login.forgot_password": "Glömt lösenord?",
    "login.submit": "Logga in",
    "login.submitting": "Loggar in…",
    "login.no_account": "Har du inget konto?",
    "login.signup_link": "Skapa konto",
    "login.error.toast_title": "Inloggning misslyckades",

    // ── Register ──────────────────────────────────────────────────────────
    "register.title": "Skapa ett konto",
    "register.subtitle": "Börja hantera årsredovisningar professionellt",
    "register.card.title": "Registrera",
    "register.card.description": "Fyll i uppgifterna nedan för att skapa ditt konto.",
    "register.confirm_password": "Bekräfta lösenord",
    "register.submit": "Skapa konto",
    "register.submitting": "Skapar konto…",
    "register.has_account": "Har du redan ett konto?",
    "register.signin_link": "Logga in",
    "register.success.title": "Kolla din e-post",
    "register.success.body_prefix": "Vi har skickat en bekräftelselänk till ",
    "register.success.body_suffix":
      ". Klicka på länken för att aktivera ditt konto, sedan kan du logga in.",
    "register.success.go_signin": "Gå till inloggning",
    "register.error.password_mismatch": "Lösenorden stämmer inte överens.",
    "register.error.password_too_short": "Lösenordet måste vara minst 8 tecken.",
    "register.error.toast_title": "Registreringen misslyckades",

    // ── Forgot password ───────────────────────────────────────────────────
    "forgot.title": "Glömt lösenord?",
    "forgot.subtitle": "Vi skickar en länk till din e-post så att du kan välja ett nytt.",
    "forgot.card.title": "Återställ lösenord",
    "forgot.card.description": "Ange e-postadressen som är kopplad till ditt konto.",
    "forgot.submit": "Skicka återställningslänk",
    "forgot.submitting": "Skickar…",
    "forgot.back_to_signin": "Tillbaka till inloggning",
    "forgot.success.title": "Kolla din inkorg",
    "forgot.success.body_prefix": "Om ett konto finns för ",
    "forgot.success.body_suffix":
      " så får du strax ett mejl med en länk för att återställa lösenordet. Länken är giltig en begränsad tid.",
    "forgot.success.spam_hint":
      "Fick du inget? Kolla skräpposten eller försök igen med en annan adress.",
    "forgot.success.use_other": "Använd en annan e-post",

    // ── Reset password (recovery landing) ────────────────────────────────
    "reset.title": "Välj ett nytt lösenord",
    "reset.subtitle": "Välj ett starkt lösenord som du inte har använt tidigare.",
    "reset.verifying.title": "Verifierar länk…",
    "reset.verifying.description": "Vi kontrollerar din återställningslänk just nu.",
    "reset.invalid.title": "Länken är ogiltig eller har gått ut",
    "reset.invalid.description":
      "Den här återställningslänken fungerar inte längre. Länkar går ut kort efter att de skickats och kan bara användas en gång.",
    "reset.invalid.hint":
      "Begär en ny återställningslänk och klicka på den senaste e-posten du fick.",
    "reset.invalid.supabase_reported": "Supabase rapporterade:",
    "reset.invalid.request_new": "Begär ny länk",
    "reset.success.title": "Lösenordet uppdaterat",
    "reset.success.description":
      "Ditt lösenord har ändrats. Skickar dig vidare till översikten…",
    "reset.success.signed_in": "Klart — du är inloggad.",
    "reset.form.title": "Nytt lösenord",
    "reset.form.description": "Välj ett lösenord på minst 8 tecken.",
    "reset.form.new_password": "Nytt lösenord",
    "reset.form.confirm_password": "Bekräfta nytt lösenord",
    "reset.form.submit": "Uppdatera lösenord",
    "reset.form.submitting": "Uppdaterar…",
    "reset.error.too_short": "Lösenordet måste vara minst 8 tecken.",
    "reset.error.mismatch": "De båda lösenorden matchar inte.",

    // ── Auth error mapping (Supabase) ─────────────────────────────────────
    "auth.error.invalid_credentials": "Felaktig e-post eller lösenord.",
    "auth.error.user_already_registered":
      "Den här e-postadressen är redan registrerad. Försök logga in i stället.",
    "auth.error.email_rate_limit":
      "För många försök. Vänta en liten stund och försök igen.",
    "auth.error.weak_password": "Lösenordet är för svagt. Välj ett starkare lösenord.",
    "auth.error.email_not_confirmed":
      "E-postadressen är inte bekräftad. Klicka på länken i bekräftelsemejlet först.",
    "auth.error.generic": "Något gick fel. Försök igen.",
  },

  en: {
    "common.back_to_homepage": "Back to homepage",
    "common.email": "Email",
    "common.password": "Password",
    "common.language": "Language",
    "common.language.sv": "Svenska",
    "common.language.en": "English",

    "login.welcome": "Welcome back",
    "login.subtitle": "Enter your credentials to access your account",
    "login.card.title": "Sign In",
    "login.card.description": "Use your email and password to log in.",
    "login.forgot_password": "Forgot password?",
    "login.submit": "Sign In",
    "login.submitting": "Signing in…",
    "login.no_account": "Don't have an account?",
    "login.signup_link": "Sign up",
    "login.error.toast_title": "Sign in failed",

    "register.title": "Create an account",
    "register.subtitle": "Start managing annual reports professionally",
    "register.card.title": "Register",
    "register.card.description": "Enter your details below to create your account.",
    "register.confirm_password": "Confirm Password",
    "register.submit": "Create Account",
    "register.submitting": "Creating account…",
    "register.has_account": "Already have an account?",
    "register.signin_link": "Sign in",
    "register.success.title": "Check your email",
    "register.success.body_prefix": "We've sent a confirmation link to ",
    "register.success.body_suffix":
      ". Click the link to activate your account, then sign in.",
    "register.success.go_signin": "Go to Sign In",
    "register.error.password_mismatch": "Passwords do not match.",
    "register.error.password_too_short": "Password must be at least 8 characters.",
    "register.error.toast_title": "Registration failed",

    "forgot.title": "Forgot your password?",
    "forgot.subtitle": "We'll email you a link to set a new one.",
    "forgot.card.title": "Reset password",
    "forgot.card.description": "Enter the email address associated with your account.",
    "forgot.submit": "Send reset link",
    "forgot.submitting": "Sending…",
    "forgot.back_to_signin": "Back to sign in",
    "forgot.success.title": "Check your inbox",
    "forgot.success.body_prefix": "If an account exists for ",
    "forgot.success.body_suffix":
      ", you'll receive an email with a link to reset your password. The link is valid for a limited time.",
    "forgot.success.spam_hint":
      "Didn't get it? Check your spam folder, or try again with a different email address.",
    "forgot.success.use_other": "Use a different email",

    "reset.title": "Set a new password",
    "reset.subtitle": "Choose a strong password you haven't used before.",
    "reset.verifying.title": "Verifying link…",
    "reset.verifying.description": "Hang tight while we validate your reset link.",
    "reset.invalid.title": "Link invalid or expired",
    "reset.invalid.description":
      "This reset link is no longer valid. Reset links expire shortly after they're sent and can only be used once.",
    "reset.invalid.hint":
      "Please request a new password reset email and click the most recent link.",
    "reset.invalid.supabase_reported": "Supabase reported:",
    "reset.invalid.request_new": "Request new link",
    "reset.success.title": "Password updated",
    "reset.success.description":
      "Your password has been changed. Redirecting you to the dashboard…",
    "reset.success.signed_in": "Success — you're signed in.",
    "reset.form.title": "New password",
    "reset.form.description": "Pick a password with at least 8 characters.",
    "reset.form.new_password": "New password",
    "reset.form.confirm_password": "Confirm new password",
    "reset.form.submit": "Update password",
    "reset.form.submitting": "Updating…",
    "reset.error.too_short": "Password must be at least 8 characters.",
    "reset.error.mismatch": "The two passwords do not match.",

    "auth.error.invalid_credentials": "Incorrect email or password.",
    "auth.error.user_already_registered":
      "This email is already registered. Try signing in instead.",
    "auth.error.email_rate_limit":
      "Too many attempts. Please wait a moment and try again.",
    "auth.error.weak_password": "The password is too weak. Choose a stronger one.",
    "auth.error.email_not_confirmed":
      "Email not confirmed yet. Click the link in the confirmation email first.",
    "auth.error.generic": "Something went wrong. Please try again.",
  },
} as const satisfies Record<Language, Record<string, string>>;

export type StringKey = keyof typeof strings.sv;

/**
 * Map a Supabase auth error message/code to a user-facing translation key.
 * Falls back to `auth.error.generic` for anything we don't recognise so the
 * UI never leaks raw backend text in a different language than the user
 * has chosen.
 */
export function mapAuthErrorToKey(message: string | undefined | null): StringKey {
  if (!message) return "auth.error.generic";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "auth.error.invalid_credentials";
  }
  if (m.includes("already registered") || m.includes("user_already_exists")) {
    return "auth.error.user_already_registered";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "auth.error.email_rate_limit";
  }
  if (m.includes("weak") && m.includes("password")) {
    return "auth.error.weak_password";
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "auth.error.email_not_confirmed";
  }
  return "auth.error.generic";
}
