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

    // ── App shell / sidebar ───────────────────────────────────────────────
    "shell.nav.section": "Navigation",
    "shell.nav.dashboard": "Översikt",
    "shell.nav.companies": "Företag",
    "shell.nav.active_report": "Aktiv rapport",
    "shell.nav.preview_export": "Förhandsvisa & exportera",
    "shell.nav.launch_checklist": "Lanseringscheckl.",
    "shell.nav.settings": "Inställningar",
    "shell.nav.logout": "Logga ut",
    "shell.loading": "Laddar…",

    // ── Footer ───────────────────────────────────────────────────────────
    "footer.disclaimer":
      "Årsredovisningar är ett digitalt stöd och ersätter inte professionell rådgivning. Användaren ansvarar för att den slutliga årsredovisningen är korrekt och uppfyller gällande regelverk.",
    "footer.legal.privacy": "Integritetspolicy",
    "footer.legal.terms": "Användarvillkor",
    "footer.legal.support": "Support",
    "footer.legal.security": "Säkerhet",
    "footer.legal.contact": "Kontakt",
    "footer.copyright": "Alla rättigheter förbehållna.",

    // ── Dashboard ────────────────────────────────────────────────────────
    "dashboard.title": "Översikt",
    "dashboard.subtitle": "Översikt av dina kunders årsredovisningar.",
    "dashboard.new_company": "Nytt företag",
    "dashboard.error.title": "Det gick inte att läsa in översikten",
    "dashboard.error.body": "Kunde inte hämta sammanfattningen. Försök ladda om sidan.",
    "dashboard.kpi.companies": "Antal företag",
    "dashboard.kpi.companies.sub": "Aktiva kunder",
    "dashboard.kpi.reports": "Antal rapporter",
    "dashboard.kpi.reports.sub": "Skapade i år",
    "dashboard.kpi.in_progress": "Pågående",
    "dashboard.kpi.in_progress.sub": "Utkast & granskning",
    "dashboard.kpi.complete": "Klara",
    "dashboard.kpi.complete.sub": "Redo för signering",
    "dashboard.recent.title": "Senaste rapporter",
    "dashboard.recent.percent_complete": "% klart",
    "dashboard.recent.sections": "avsnitt",
    "dashboard.empty.title": "Inga rapporter ännu",
    "dashboard.empty.body": "Skapa ett företag för att börja arbeta med årsredovisningar.",
    "dashboard.empty.cta": "Skapa första företaget",

    // Welcome / first-run hero (Phase 2)
    "dashboard.welcome.title": "Välkommen!",
    "dashboard.welcome.body":
      "Lägg till ditt första företag så hjälper vi dig att skapa en årsredovisning från grunden — import av huvudbok, kontomappning, noter, validering och export i ett samlat flöde.",
    "dashboard.welcome.cta": "Lägg till första företaget",
    "dashboard.welcome.benefits.import": "Importera SIE-fil eller huvudbok",
    "dashboard.welcome.benefits.mapping": "Automatisk kontomappning",
    "dashboard.welcome.benefits.export": "Exportera färdig PDF",

    // Report status badges (used on Dashboard + Companies)
    "report.status.draft": "Utkast",
    "report.status.in_progress": "Pågående",
    "report.status.complete": "Klar",
    "report.status.exported": "Exporterad",

    // ── Companies list ───────────────────────────────────────────────────
    "companies.title": "Företag",
    "companies.subtitle":
      "Dina kundföretag. Öppna ett företag för att hantera dess årsredovisningar.",
    "companies.new": "Nytt företag",
    "companies.error.title": "Det gick inte att läsa in företagen",
    "companies.error.body": "Kunde inte hämta listan. Försök ladda om sidan.",
    "companies.empty.title": "Inga företag ännu",
    "companies.empty.body": "Lägg till ditt första kundföretag för att börja arbeta med årsredovisningar.",
    "companies.empty.cta": "Skapa första företaget",
    "companies.col.name": "Namn",
    "companies.col.org_number": "Org.nummer",
    "companies.col.form": "Form",
    "companies.col.framework": "Regelverk",
    "companies.col.latest_report": "Senaste årsredovisning",
    "companies.col.year": "År",
    "companies.col.count": "Antal",
    "companies.col.location": "Ort",
    "companies.col.open_aria": "Öppna",
    "companies.no_report": "Ingen rapport",

    // ── Settings ─────────────────────────────────────────────────────────
    "settings.title": "Inställningar",
    "settings.subtitle": "Hantera dina kontoinställningar och appinställningar.",
    "settings.loading": "Laddar inställningar…",
    "settings.error.title": "Det gick inte att läsa in inställningarna",
    "settings.error.retry": "Försök igen",

    "settings.profile.title": "Profil",
    "settings.profile.description": "Uppdatera ditt visningsnamn och språk.",
    "settings.profile.display_name": "Visningsnamn",
    "settings.profile.email": "E-postadress",
    "settings.profile.email_change": "Ändra",
    "settings.profile.language": "Språk",
    "settings.profile.save": "Spara ändringar",
    "settings.profile.saved_toast": "Profilen uppdaterad",
    "settings.profile.save_error": "Profilen kunde inte sparas",

    "settings.notifications.title": "Notiser",
    "settings.notifications.description": "Bestäm hur du vill få aviseringar.",
    "settings.notifications.email": "E-postnotiser",
    "settings.notifications.email_desc": "Få veckosammanfattningar av rapporter.",
    "settings.notifications.deadlines": "Påminnelser om deadlines",
    "settings.notifications.deadlines_desc":
      "Bli notifierad när ett räkenskapsår närmar sig sitt slut.",
    "settings.notifications.save_error": "Inställningen kunde inte sparas",

    "settings.security.title": "Säkerhet",
    "settings.security.description": "Hantera lösenord och autentisering.",

    "settings.password.button": "Ändra lösenord",
    "settings.password.title": "Ändra lösenord",
    "settings.password.description":
      "Ange ditt nuvarande lösenord och välj ett nytt. Din session är fortsatt aktiv.",
    "settings.password.current": "Nuvarande lösenord",
    "settings.password.new": "Nytt lösenord",
    "settings.password.confirm": "Bekräfta nytt lösenord",
    "settings.password.hint": "Minst 8 tecken.",
    "settings.password.cancel": "Avbryt",
    "settings.password.submit": "Uppdatera lösenord",
    "settings.password.too_short": "Det nya lösenordet måste vara minst 8 tecken.",
    "settings.password.mismatch": "De nya lösenorden matchar inte.",
    "settings.password.current_wrong": "Det nuvarande lösenordet är felaktigt.",
    "settings.password.updated_toast": "Lösenordet är uppdaterat",
    "settings.password.updated_signin_again":
      "Lösenordet är uppdaterat — vänligen logga in igen",
    "settings.password.update_error": "Lösenordet kunde inte uppdateras",

    "settings.email.title": "Ändra e-postadress",
    "settings.email.description":
      "Vi skickar en bekräftelselänk till din nya adress. Ändringen träder i kraft när du har bekräftat den.",
    "settings.email.new": "Ny e-postadress",
    "settings.email.cancel": "Avbryt",
    "settings.email.submit": "Skicka bekräftelse",
    "settings.email.sent_title": "Bekräftelsemejl skickat",
    "settings.email.sent_desc_prefix": "Kolla ",
    "settings.email.sent_desc_suffix": " för en bekräftelselänk.",
    "settings.email.error": "E-postadressen kunde inte ändras",

    // ── Not Found ────────────────────────────────────────────────────────
    "notfound.title": "404 — Sidan hittades inte",
    "notfound.body": "Sidan du letar efter finns inte eller har flyttats.",
    "notfound.home": "Tillbaka till översikten",

    // ── Company form (new + edit) ────────────────────────────────────────
    "company.form.back_aria": "Tillbaka",
    "company.new.title": "Nytt företag",
    "company.new.subtitle": "Registrera en kund för att börja förbereda rapporter.",
    "company.edit.title": "Redigera företag",
    "company.edit.subtitle": "Uppdatera företagets registrerade uppgifter.",
    "company.edit.usage_hint":
      "Dessa uppgifter används direkt i årsredovisningen — på framsidan, i förvaltningsberättelsen och i noterna. Ändringar måste sparas innan du kan fortsätta till export.",
    "company.form.section.details": "Företagsuppgifter",
    "company.form.section.details_new_desc":
      "Ange företagets officiellt registrerade uppgifter.",
    "company.form.section.details_edit_desc":
      "Alla fält nedan kan uppdateras.",
    "company.form.field.name": "Företagsnamn",
    "company.form.field.org_number": "Organisationsnummer",
    "company.form.field.legal_form": "Bolagsform",
    "company.form.field.legal_form_placeholder": "Välj bolagsform",
    "company.form.field.framework": "Regelverk",
    "company.form.field.framework_placeholder": "Välj regelverk",
    "company.form.field.fiscal_start": "Räkenskapsår, start",
    "company.form.field.fiscal_end": "Räkenskapsår, slut",
    "company.form.section.contact": "Kontaktinformation",
    "company.form.field.address": "Gatuadress",
    "company.form.field.zip": "Postnummer",
    "company.form.field.city": "Ort",
    "company.form.cancel": "Avbryt",
    "company.form.save_new": "Spara företag",
    "company.form.save_edit": "Spara ändringar",
    "company.form.error.required_name": "Företagsnamnet är obligatoriskt.",
    "company.form.error.org_format": "Måste vara i formatet XXXXXX-XXXX.",
    "company.form.error.month_day": "Måste vara ett giltigt MM-DD.",

    "company.toast.created_title": "Företaget skapat",
    "company.toast.created_desc_prefix": "",
    "company.toast.created_desc_suffix": " har lagts till.",
    "company.toast.updated_title": "Företaget uppdaterat",
    "company.toast.updated_desc_prefix": "",
    "company.toast.updated_desc_suffix": " har sparats.",
    "company.toast.create_error_title": "Kunde inte skapa företaget",
    "company.toast.update_error_title": "Kunde inte uppdatera företaget",
    "company.toast.unexpected": "Något oväntat gick fel. Försök igen.",
    "company.toast.duplicate_org_title": "Organisationsnumret är redan registrerat",
    "company.toast.duplicate_org_desc":
      "Ett annat företag använder redan detta organisationsnummer.",

    // ── Company detail ───────────────────────────────────────────────────
    "company.detail.not_found": "Företaget hittades inte.",
    "company.detail.new_report": "Ny årsredovisning",
    "company.detail.create_dialog.title": "Skapa årsredovisning",
    "company.detail.create_dialog.body_prefix": "Starta en ny årsredovisning för ",
    "company.detail.create_dialog.fiscal_year": "Räkenskapsår",
    "company.detail.create_dialog.uses_defaults_prefix": "Använder företagets standard: regelverk ",
    "company.detail.create_dialog.uses_defaults_period": " · period ",
    "company.detail.create_dialog.cancel": "Avbryt",
    "company.detail.create_dialog.create": "Skapa",
    "company.detail.create_dialog.validation_year_title": "Valideringsfel",
    "company.detail.create_dialog.validation_year_desc": "Ange ett räkenskapsår.",
    "company.detail.create_dialog.invalid_period_title": "Fel",
    "company.detail.create_dialog.invalid_period_desc":
      "Företagets räkenskapsperiod är ogiltig. Uppdatera företaget först.",
    "company.detail.create_dialog.report_created_title": "Rapport skapad",
    "company.detail.create_dialog.report_created_desc": "En ny årsredovisning har skapats.",
    "company.detail.create_dialog.create_error_title": "Fel",
    "company.detail.create_dialog.create_error_desc": "Det gick inte att skapa rapporten.",
    "company.detail.info.title": "Företagsinfo",
    "company.detail.info.address": "Adress",
    "company.detail.info.no_address": "Ingen adress angiven",
    "company.detail.info.framework": "Regelverk",
    "company.detail.info.fiscal_default": "Standardräkenskapsår",
    "company.detail.info.edit_link": "Redigera företagsuppgifter",
    "company.detail.reports.title": "Årsredovisningar",
    "company.detail.reports.year_suffix": " års årsredovisning",
    "company.detail.reports.empty.title": "Inga rapporter ännu",
    "company.detail.reports.empty.body": "Skapa den första årsredovisningen för det här företaget.",
    "company.detail.reports.empty.cta": "Skapa första rapporten",

    // ── Report workspace chrome (kept Swedish-leaning, English mirrors) ──
    "workspace.back_to": "Tillbaka till ",
    "workspace.not_found": "Rapporten hittades inte.",
    "workspace.title_prefix": "Årsredovisning ",
    "workspace.fiscal_year": "Räkenskapsår: ",
    "workspace.mark_complete": "Markera som klar",
    "workspace.unmark_complete": "Ångra klarmarkering",
    "workspace.unmark_complete_title": "Återöppna rapporten för redigering",
    "workspace.view_summary": "Visa sammanfattning",
    "workspace.sections": "Avsnitt",
    "workspace.section.in_review": "Granskas",
    "workspace.section.upcoming": "Kommande",
    "workspace.section.new": "Ny",
    "workspace.workflow.title": "9-stegs arbetsflöde",
    "workspace.quick_actions": "Snabbåtgärder",
    "workspace.quick.statements": "Finansiella rapporter",
    "workspace.quick.preview": "Förhandsvisa & exportera",
    "workspace.quick.sign": "Skicka för signering",
    "workspace.status_changed.title": "Status uppdaterad",
    "workspace.status_changed.desc_prefix": "Rapportstatus ändrad till ",

    "workspace.section.import.title": "Importera bokföringsdata",
    "workspace.section.import.desc": "Ladda upp SIE-, Excel- eller CSV-fil och granska staging",
    "workspace.section.mapping.title": "Kontomappning",
    "workspace.section.mapping.desc": "Granska BAS → K2/K3-mappning och justera vid behov",
    "workspace.section.mgmt.title": "Förvaltningsberättelse",
    "workspace.section.mgmt.desc": "Förvaltningsberättelse och bolagsöversikt",
    "workspace.section.statements.title": "Finansiella rapporter",
    "workspace.section.statements.desc": "Resultaträkning, balansräkning och kassaflödesanalys",
    "workspace.section.notes.title": "Noter",
    "workspace.section.notes.desc": "Redovisningsprinciper och tilläggsupplysningar",
    "workspace.section.reclass.title": "Omklassificeringar mellan noter",
    "workspace.section.reclass.desc": "Förslag och kvittningar mellan noter — granska och tillämpa",
    "workspace.section.cashflow.title": "Kassaflödesanalys",
    "workspace.section.cashflow.desc": "Bedöm laglig skyldighet och bygg kassaflödesanalysen (indirekt metod)",
    "workspace.section.validation.title": "Validering",
    "workspace.section.validation.desc": "Kör regler för att hitta blockerande problem och varningar",
    "workspace.section.review.title": "Granskning & samarbete",
    "workspace.section.review.desc": "Granskningsstatus per avsnitt, kommentarer och samarbetspartners",
    "workspace.section.audit.title": "Aktivitet & revisionsspår",
    "workspace.section.audit.desc": "Komplett händelselogg och ögonblicksbilder",
    "workspace.section.signatures.title": "Underskrifter",
    "workspace.section.signatures.desc": "Styrelseledamöter och revisor",

    // ── Password input affordances (P1-3) ────────────────────────────────
    "password.show": "Visa lösenord",
    "password.hide": "Dölj lösenord",
    "password.caps_lock_on": "Caps Lock är aktivt",

    // ── Global error boundary (P3-1) ─────────────────────────────────────
    "error_boundary.title": "Något gick fel",
    "error_boundary.body":
      "Appen råkade ut för ett oväntat fel. Felet har loggats — du kan försöka ladda om sidan eller gå tillbaka till översikten.",
    "error_boundary.reload": "Ladda om sidan",
    "error_boundary.home": "Tillbaka till översikten",
    "error_boundary.details": "Tekniska detaljer",

    // ── Onboarding nudges (P2-2 / P2-3) ──────────────────────────────────
    "login.email_confirmed.title": "E-post bekräftad",
    "login.email_confirmed.body": "Logga in nedan för att komma igång.",
    "register.demo_prompt.title": "Välkommen!",
    "register.demo_prompt.body":
      "Du kom hit från demon — kom igång snabbt med ett exempelföretag.",

    // ── A11y (P4-1) ──────────────────────────────────────────────────────
    "common.skip_to_content": "Hoppa till huvudinnehåll",

    // ── Account status / license model (replaces credit wording) ─────────
    "account.status.demo.badge": "Demo-konto",
    "account.status.demo.title": "Du är i demo-läge",
    "account.status.demo.body":
      "Du kan utforska produkten med exempeldata. För att skapa en riktig årsredovisning behöver du låsa upp ett projekt. Ett köp gäller för ett bolag och ett räkenskapsår.",
    "account.status.demo.cta_demo": "Visa demo",
    "account.status.demo.cta_unlock": "Lås upp årsredovisning",
    "account.status.locked.title": "Det här ingår när du låser upp ett projekt",
    "account.status.locked.import": "Importera bokföringsdata (SIE)",
    "account.status.locked.create": "Skapa bolag och projekt",
    "account.status.locked.mapping": "Kontomappning enligt BAS",
    "account.status.locked.statements": "Generera resultat- och balansräkning",
    "account.status.locked.notes": "Noter och kassaflödesanalys",
    "account.status.locked.validate": "Validera årsredovisningen",
    "account.status.locked.export": "Exportera ren PDF/Word utan vattenmärke",
    "account.status.licenses.title": "Aktiva projekt",
    "account.status.licenses.subtitle":
      "Varje köp gäller för ett bolag och ett räkenskapsår.",
    "account.status.licenses.count_one": "1 aktivt projekt",
    "account.status.licenses.count_many": "{n} aktiva projekt",
    "account.status.licenses.admin":
      "Du är administratör – alla projekt är upplåsta.",
    "account.status.licenses.cta": "Gå till projektytan",
    "account.status.licenses.empty":
      "Inga aktiva projekt ännu. Lås upp ett projekt för att komma igång.",

    // ── Upgrade / project license page ───────────────────────────────────
    "upgrade.title": "Lås upp ditt projekt för årsredovisning",
    "upgrade.subtitle":
      "Ett köp gäller för ett bolag och ett räkenskapsår. När projektet är upplåst kan du importera bokföring, hantera noter och exportera en ren PDF.",
    "upgrade.has_access.title": "Du har redan tillgång",
    "upgrade.has_access.admin":
      "Som administratör har du obegränsad åtkomst.",
    "upgrade.has_access.body":
      "Du har en aktiv projektlicens. Gå till översikten för att fortsätta.",
    "upgrade.has_access.cta": "Gå till min översikt",
    "upgrade.included.title": "Vad ingår i en projektlicens",
    "upgrade.included.company": "1 bolag (organisationsnummer och uppgifter)",
    "upgrade.included.year": "1 räkenskapsår",
    "upgrade.included.report":
      "1 färdigställd årsredovisning (PDF + Word, utan vattenmärke)",
    "upgrade.included.editing": "Obegränsad redigering tills rapporten exporteras",
    "upgrade.try.title": "Vill du prova först?",
    "upgrade.try.body":
      "Du kan köra hela flödet i demoarbetsytan utan kostnad. All export blir vattenmärkt och ingen riktig data lagras.",
    "upgrade.try.cta": "Öppna demo",
    "upgrade.request.title": "Begär projektlicens",
    "upgrade.request.body":
      "Stripe-betalning är inte aktiverad ännu. Kontakta oss för att få en projektlicens manuellt tilldelad.",
    "upgrade.request.cta": "Mejla teamet",
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

    "shell.nav.section": "Navigation",
    "shell.nav.dashboard": "Dashboard",
    "shell.nav.companies": "Companies",
    "shell.nav.active_report": "Active report",
    "shell.nav.preview_export": "Preview & export",
    "shell.nav.launch_checklist": "Launch checklist",
    "shell.nav.settings": "Settings",
    "shell.nav.logout": "Logout",
    "shell.loading": "Loading…",

    "footer.disclaimer":
      "Årsredovisningar is digital assistance and does not replace professional advice. The user is responsible for ensuring the final annual report is accurate and complies with applicable regulations.",
    "footer.legal.privacy": "Privacy",
    "footer.legal.terms": "Terms",
    "footer.legal.support": "Support",
    "footer.legal.security": "Security",
    "footer.legal.contact": "Contact",
    "footer.copyright": "All rights reserved.",

    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Overview of your client annual reports.",
    "dashboard.new_company": "New Company",
    "dashboard.error.title": "Error loading dashboard",
    "dashboard.error.body": "Could not fetch summary data. Please try refreshing.",
    "dashboard.kpi.companies": "Total Companies",
    "dashboard.kpi.companies.sub": "Active clients",
    "dashboard.kpi.reports": "Total Reports",
    "dashboard.kpi.reports.sub": "Created this year",
    "dashboard.kpi.in_progress": "In Progress",
    "dashboard.kpi.in_progress.sub": "Drafting & Reviewing",
    "dashboard.kpi.complete": "Completed",
    "dashboard.kpi.complete.sub": "Ready for signature",
    "dashboard.recent.title": "Recent Reports",
    "dashboard.recent.percent_complete": "% Complete",
    "dashboard.recent.sections": "sections",
    "dashboard.empty.title": "No reports found",
    "dashboard.empty.body": "Create a company to start drafting annual reports.",
    "dashboard.empty.cta": "Create First Company",

    "dashboard.welcome.title": "Welcome!",
    "dashboard.welcome.body":
      "Add your first company and we'll help you build an annual report from scratch — ledger import, account mapping, notes, validation and export in one cohesive flow.",
    "dashboard.welcome.cta": "Add your first company",
    "dashboard.welcome.benefits.import": "Import SIE file or general ledger",
    "dashboard.welcome.benefits.mapping": "Automatic account mapping",
    "dashboard.welcome.benefits.export": "Export a finished PDF",

    "report.status.draft": "Draft",
    "report.status.in_progress": "In progress",
    "report.status.complete": "Complete",
    "report.status.exported": "Exported",

    "companies.title": "Companies",
    "companies.subtitle":
      "Your client companies. Open a company to manage its annual reports.",
    "companies.new": "New Company",
    "companies.error.title": "Error loading companies",
    "companies.error.body": "Could not fetch companies. Please try refreshing.",
    "companies.empty.title": "No companies yet",
    "companies.empty.body": "Add your first client company to start drafting annual reports.",
    "companies.empty.cta": "Create First Company",
    "companies.col.name": "Name",
    "companies.col.org_number": "Org. number",
    "companies.col.form": "Form",
    "companies.col.framework": "Framework",
    "companies.col.latest_report": "Latest annual report",
    "companies.col.year": "Year",
    "companies.col.count": "Count",
    "companies.col.location": "Location",
    "companies.col.open_aria": "Open",
    "companies.no_report": "No report",

    "settings.title": "Settings",
    "settings.subtitle": "Manage your account preferences and application settings.",
    "settings.loading": "Loading settings…",
    "settings.error.title": "Could not load settings",
    "settings.error.retry": "Retry",

    "settings.profile.title": "Profile Information",
    "settings.profile.description": "Update your display name and language.",
    "settings.profile.display_name": "Display Name",
    "settings.profile.email": "Email Address",
    "settings.profile.email_change": "Change",
    "settings.profile.language": "Language",
    "settings.profile.save": "Save Changes",
    "settings.profile.saved_toast": "Profile updated",
    "settings.profile.save_error": "Could not save profile",

    "settings.notifications.title": "Notifications",
    "settings.notifications.description": "Configure how you receive alerts.",
    "settings.notifications.email": "Email Notifications",
    "settings.notifications.email_desc": "Receive weekly summaries of reports.",
    "settings.notifications.deadlines": "Deadline Alerts",
    "settings.notifications.deadlines_desc":
      "Get notified when a fiscal year approaches its end.",
    "settings.notifications.save_error": "Could not save preference",

    "settings.security.title": "Security",
    "settings.security.description": "Manage password and authentication.",

    "settings.password.button": "Change Password",
    "settings.password.title": "Change Password",
    "settings.password.description":
      "Enter your current password and choose a new one. Your session stays active.",
    "settings.password.current": "Current Password",
    "settings.password.new": "New Password",
    "settings.password.confirm": "Confirm New Password",
    "settings.password.hint": "At least 8 characters.",
    "settings.password.cancel": "Cancel",
    "settings.password.submit": "Update Password",
    "settings.password.too_short": "New password must be at least 8 characters.",
    "settings.password.mismatch": "New passwords do not match.",
    "settings.password.current_wrong": "Current password is incorrect.",
    "settings.password.updated_toast": "Password updated",
    "settings.password.updated_signin_again":
      "Password updated, but please sign in again",
    "settings.password.update_error": "Could not update password",

    "settings.email.title": "Change Email",
    "settings.email.description":
      "We'll send a confirmation link to your new address. The change takes effect once you confirm it.",
    "settings.email.new": "New Email Address",
    "settings.email.cancel": "Cancel",
    "settings.email.submit": "Send Confirmation",
    "settings.email.sent_title": "Confirmation email sent",
    "settings.email.sent_desc_prefix": "Check ",
    "settings.email.sent_desc_suffix": " for a confirmation link.",
    "settings.email.error": "Could not change email",

    "notfound.title": "404 Page Not Found",
    "notfound.body": "The page you're looking for doesn't exist or has moved.",
    "notfound.home": "Back to Dashboard",

    "company.form.back_aria": "Back",
    "company.new.title": "New Company",
    "company.new.subtitle": "Register a client to begin preparing reports.",
    "company.edit.title": "Edit Company",
    "company.edit.subtitle": "Update the company's registered details.",
    "company.edit.usage_hint":
      "These details are used directly in the annual report — on the cover page, in the directors' report, and in the notes. Changes must be saved before you can continue to export.",
    "company.form.section.details": "Company Details",
    "company.form.section.details_new_desc":
      "Enter the official registered details of the company.",
    "company.form.section.details_edit_desc": "All fields below can be updated.",
    "company.form.field.name": "Company Name",
    "company.form.field.org_number": "Organization Number",
    "company.form.field.legal_form": "Legal Form",
    "company.form.field.legal_form_placeholder": "Select form",
    "company.form.field.framework": "Accounting Framework",
    "company.form.field.framework_placeholder": "Select framework",
    "company.form.field.fiscal_start": "Fiscal Start",
    "company.form.field.fiscal_end": "Fiscal End",
    "company.form.section.contact": "Contact Information",
    "company.form.field.address": "Street Address",
    "company.form.field.zip": "Postal Code",
    "company.form.field.city": "City",
    "company.form.cancel": "Cancel",
    "company.form.save_new": "Save Company",
    "company.form.save_edit": "Save Changes",
    "company.form.error.required_name": "Company name is required.",
    "company.form.error.org_format": "Must be in format XXXXXX-XXXX.",
    "company.form.error.month_day": "Must be a valid MM-DD.",

    "company.toast.created_title": "Company created",
    "company.toast.created_desc_prefix": "",
    "company.toast.created_desc_suffix": " has been added.",
    "company.toast.updated_title": "Company updated",
    "company.toast.updated_desc_prefix": "",
    "company.toast.updated_desc_suffix": " has been saved.",
    "company.toast.create_error_title": "Could not create company",
    "company.toast.update_error_title": "Could not update company",
    "company.toast.unexpected": "An unexpected error occurred. Please try again.",
    "company.toast.duplicate_org_title": "Organisation number already in use",
    "company.toast.duplicate_org_desc":
      "Another company is already using this organisation number.",

    "company.detail.not_found": "Company not found.",
    "company.detail.new_report": "New Report",
    "company.detail.create_dialog.title": "Create Annual Report",
    "company.detail.create_dialog.body_prefix": "Start a new annual report for ",
    "company.detail.create_dialog.fiscal_year": "Fiscal Year",
    "company.detail.create_dialog.uses_defaults_prefix": "Uses company defaults: framework ",
    "company.detail.create_dialog.uses_defaults_period": " · period ",
    "company.detail.create_dialog.cancel": "Cancel",
    "company.detail.create_dialog.create": "Create",
    "company.detail.create_dialog.validation_year_title": "Validation Error",
    "company.detail.create_dialog.validation_year_desc": "Please provide a fiscal year.",
    "company.detail.create_dialog.invalid_period_title": "Error",
    "company.detail.create_dialog.invalid_period_desc":
      "Company fiscal period is invalid. Please update the company first.",
    "company.detail.create_dialog.report_created_title": "Report created",
    "company.detail.create_dialog.report_created_desc": "New annual report has been created.",
    "company.detail.create_dialog.create_error_title": "Error",
    "company.detail.create_dialog.create_error_desc": "Could not create the report.",
    "company.detail.info.title": "Company Info",
    "company.detail.info.address": "Address",
    "company.detail.info.no_address": "No address provided",
    "company.detail.info.framework": "Framework",
    "company.detail.info.fiscal_default": "Default Fiscal Year",
    "company.detail.info.edit_link": "Edit Company Details",
    "company.detail.reports.title": "Annual Reports",
    "company.detail.reports.year_suffix": " Report",
    "company.detail.reports.empty.title": "No reports yet",
    "company.detail.reports.empty.body": "Create the first annual report for this company.",
    "company.detail.reports.empty.cta": "Create First Report",

    "workspace.back_to": "Back to ",
    "workspace.not_found": "Report not found.",
    "workspace.title_prefix": "Annual Report ",
    "workspace.fiscal_year": "Fiscal year: ",
    "workspace.mark_complete": "Mark as complete",
    "workspace.unmark_complete": "Reopen for editing",
    "workspace.unmark_complete_title": "Reopen the report for editing",
    "workspace.view_summary": "View summary",
    "workspace.sections": "Sections",
    "workspace.section.in_review": "In review",
    "workspace.section.upcoming": "Upcoming",
    "workspace.section.new": "New",
    "workspace.workflow.title": "9-step workflow",
    "workspace.quick_actions": "Quick actions",
    "workspace.quick.statements": "Financial statements",
    "workspace.quick.preview": "Preview & export",
    "workspace.quick.sign": "Send for signing",
    "workspace.status_changed.title": "Status updated",
    "workspace.status_changed.desc_prefix": "Report status changed to ",

    "workspace.section.import.title": "Import bookkeeping data",
    "workspace.section.import.desc": "Upload an SIE, Excel or CSV file and review staging",
    "workspace.section.mapping.title": "Account mapping",
    "workspace.section.mapping.desc": "Review BAS → K2/K3 mapping and adjust if needed",
    "workspace.section.mgmt.title": "Director's report (Förvaltningsberättelse)",
    "workspace.section.mgmt.desc": "Director's report and company overview",
    "workspace.section.statements.title": "Financial statements",
    "workspace.section.statements.desc": "Income statement, balance sheet and cash flow",
    "workspace.section.notes.title": "Notes",
    "workspace.section.notes.desc": "Accounting principles and supplementary disclosures",
    "workspace.section.reclass.title": "Reclassifications between notes",
    "workspace.section.reclass.desc": "Proposals and netting between notes — review and apply",
    "workspace.section.cashflow.title": "Cash flow statement",
    "workspace.section.cashflow.desc": "Assess legal obligation and build the cash flow statement (indirect method)",
    "workspace.section.validation.title": "Validation",
    "workspace.section.validation.desc": "Run rules to find blocking issues and warnings",
    "workspace.section.review.title": "Review & collaboration",
    "workspace.section.review.desc": "Review status per section, comments and collaborators",
    "workspace.section.audit.title": "Activity & audit trail",
    "workspace.section.audit.desc": "Complete event log and snapshots",
    "workspace.section.signatures.title": "Signatures",
    "workspace.section.signatures.desc": "Board members and auditor",

    "password.show": "Show password",
    "password.hide": "Hide password",
    "password.caps_lock_on": "Caps Lock is on",

    "error_boundary.title": "Something went wrong",
    "error_boundary.body":
      "The app hit an unexpected error. It has been logged — try reloading the page or going back to the dashboard.",
    "error_boundary.reload": "Reload page",
    "error_boundary.home": "Back to dashboard",
    "error_boundary.details": "Technical details",

    "login.email_confirmed.title": "Email confirmed",
    "login.email_confirmed.body": "Sign in below to get started.",
    "register.demo_prompt.title": "Welcome!",
    "register.demo_prompt.body":
      "You came from the demo — get started quickly with a sample company.",

    "common.skip_to_content": "Skip to main content",

    "account.status.demo.badge": "Demo account",
    "account.status.demo.title": "You're in demo mode",
    "account.status.demo.body":
      "You can explore the product with sample data. To create a real annual report, unlock a paid project. One purchase applies to one company and one financial year.",
    "account.status.demo.cta_demo": "View demo",
    "account.status.demo.cta_unlock": "Unlock annual report project",
    "account.status.locked.title": "What's included when you unlock a project",
    "account.status.locked.import": "Import accounting data (SIE)",
    "account.status.locked.create": "Create company and project",
    "account.status.locked.mapping": "Map accounts to BAS",
    "account.status.locked.statements": "Generate income statement and balance sheet",
    "account.status.locked.notes": "Notes and cash-flow statement",
    "account.status.locked.validate": "Validate the annual report",
    "account.status.locked.export": "Export clean PDF/Word without watermark",
    "account.status.licenses.title": "Active projects",
    "account.status.licenses.subtitle":
      "Each purchase applies to one company and one financial year.",
    "account.status.licenses.count_one": "1 active project",
    "account.status.licenses.count_many": "{n} active projects",
    "account.status.licenses.admin":
      "You're an administrator – all projects are unlocked.",
    "account.status.licenses.cta": "Go to project workspace",
    "account.status.licenses.empty":
      "No active projects yet. Unlock a project to get started.",

    "upgrade.title": "Unlock your annual report project",
    "upgrade.subtitle":
      "One purchase applies to one company and one financial year. Once unlocked, you can import bookkeeping, manage notes and export a clean PDF.",
    "upgrade.has_access.title": "You already have access",
    "upgrade.has_access.admin":
      "As an administrator you have unlimited access.",
    "upgrade.has_access.body":
      "You have an active project license. Go to your overview to continue.",
    "upgrade.has_access.cta": "Go to my overview",
    "upgrade.included.title": "What's in a project license",
    "upgrade.included.company": "1 company (organisation number and details)",
    "upgrade.included.year": "1 financial year",
    "upgrade.included.report":
      "1 finished annual report (PDF + Word, no watermark)",
    "upgrade.included.editing": "Unlimited editing until the report is exported",
    "upgrade.try.title": "Want to try first?",
    "upgrade.try.body":
      "You can run the whole flow in the demo workspace for free. All exports are watermarked and no real data is stored.",
    "upgrade.try.cta": "Open demo",
    "upgrade.request.title": "Request a project license",
    "upgrade.request.body":
      "Stripe payment isn't enabled yet. Contact us to have a project license assigned manually.",
    "upgrade.request.cta": "Email the team",
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
