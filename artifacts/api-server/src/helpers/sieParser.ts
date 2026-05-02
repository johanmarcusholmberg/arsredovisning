/**
 * SIE parser — server-side only. Never import in browser code.
 *
 * Parses SIE 4 format files (the Swedish standard for accounting data export).
 * Reference: https://www.sie.se/
 *
 * Supported records:
 *   #FLAGGA, #PROGRAM, #FORMAT, #GEN, #SIETYP, #PTYP, #FNR, #ORGNR
 *   #FNAMN, #ADRESS, #RAR, #TAXAR, #KONTO, #KTYP, #ENHET
 *   #IB, #UB, #OIB, #OUB, #RES, #PSALDO, #PBUDGET
 *   #VER (with nested #TRANS / #RTRANS / #BTRANS)
 *
 * Unsupported records are collected into parsingErrors with severity "warning"
 * so the caller can display them clearly — they are NEVER silently ignored.
 *
 * Encoding: SIE files are typically CP437 or ISO-8859-1. We attempt UTF-8 first
 * and fall back to latin1. The caller should pass the raw Buffer.
 */

export interface SIEAccount {
  accountNumber: string;
  accountName: string | null;
}

export interface SIEBalance {
  accountNumber: string;
  balanceType: string;
  yearOffset: number;
  period?: number;
  amount: number;
}

export interface SIETransaction {
  verificationNumber: string | null;
  transactionDate: string | null;
  accountNumber: string;
  amount: number;
  description: string | null;
  period?: number;
}

export interface SIEParseError {
  section: string;
  message: string;
  severity: "warning" | "error";
}

export interface SIEParseResult {
  companyName: string | null;
  orgNumber: string | null;
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  sieType: string | null;
  accounts: SIEAccount[];
  balances: SIEBalance[];
  transactions: SIETransaction[];
  errors: SIEParseError[];
  unsupportedSections: string[];
}

const SUPPORTED_RECORDS = new Set([
  "FLAGGA", "PROGRAM", "FORMAT", "GEN", "SIETYP", "PTYP",
  "FNR", "ORGNR", "FNAMN", "ADRESS", "RAR", "TAXAR",
  "KONTO", "KTYP", "ENHET", "DIM", "UNDERDIM", "OBJEKT",
  "IB", "UB", "OIB", "OUB", "RES", "PSALDO", "PBUDGET",
  "VER", "TRANS", "RTRANS", "BTRANS",
]);

function unquote(val: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSIELine(line: string): { tag: string; tokens: string[] } | null {
  const stripped = line.trim();
  if (!stripped.startsWith("#")) return null;
  const spaceIdx = stripped.indexOf(" ");
  const tag = spaceIdx === -1 ? stripped.slice(1) : stripped.slice(1, spaceIdx);
  const rest = spaceIdx === -1 ? "" : stripped.slice(spaceIdx + 1).trim();
  const tokens = tokenizeSIE(rest);
  return { tag: tag.toUpperCase(), tokens };
}

function tokenizeSIE(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && line[i] === " ") i++;
    if (i >= line.length) break;
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      tokens.push(line.slice(i + 1, j));
      i = j + 1;
    } else if (line[i] === "{") {
      let depth = 0;
      let j = i;
      while (j < line.length) {
        if (line[j] === "{") depth++;
        else if (line[j] === "}") { depth--; if (depth === 0) { j++; break; } }
        j++;
      }
      tokens.push(line.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < line.length && line[j] !== " ") j++;
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

function formatSIEDate(raw: string): string | null {
  const s = raw.replace(/\D/g, "");
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return null;
}

export function parseSIEContent(content: string): SIEParseResult {
  const result: SIEParseResult = {
    companyName: null,
    orgNumber: null,
    fiscalYearStart: null,
    fiscalYearEnd: null,
    sieType: null,
    accounts: [],
    balances: [],
    transactions: [],
    errors: [],
    unsupportedSections: [],
  };

  const seenUnsupported = new Set<string>();
  const lines = content.split(/\r?\n/);
  let currentVer: { series: string; number: string; date: string | null; text: string | null } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith(";")) continue;

    const parsed = parseSIELine(line);
    if (!parsed) continue;

    const { tag, tokens } = parsed;

    if (!SUPPORTED_RECORDS.has(tag)) {
      if (!seenUnsupported.has(tag)) {
        seenUnsupported.add(tag);
        result.unsupportedSections.push(tag);
        result.errors.push({
          section: `#${tag}`,
          message: `SIE-sektion #${tag} stöds inte och ignorerades. Data under denna sektion inkluderades inte i importen.`,
          severity: "warning",
        });
      }
      continue;
    }

    try {
      switch (tag) {
        case "FNAMN":
          result.companyName = unquote(tokens[0] ?? "");
          break;
        case "ORGNR":
          result.orgNumber = tokens[0] ?? null;
          break;
        case "SIETYP":
          result.sieType = tokens[0] ?? null;
          break;
        case "RAR": {
          const yearOffset = parseInt(tokens[0] ?? "0", 10);
          if (yearOffset === 0) {
            result.fiscalYearStart = formatSIEDate(tokens[1] ?? "");
            result.fiscalYearEnd = formatSIEDate(tokens[2] ?? "");
          }
          break;
        }
        case "KONTO":
          result.accounts.push({
            accountNumber: tokens[0] ?? "",
            accountName: unquote(tokens[1] ?? "") || null,
          });
          break;
        case "IB":
        case "UB":
        case "OIB":
        case "OUB": {
          const yearOffset = parseInt(tokens[0] ?? "0", 10);
          const accountNumber = tokens[1] ?? "";
          const amount = parseFloat(tokens[2] ?? "0");
          if (accountNumber) {
            result.balances.push({
              accountNumber,
              balanceType: tag,
              yearOffset,
              amount,
            });
          }
          break;
        }
        case "RES": {
          const yearOffset = parseInt(tokens[0] ?? "0", 10);
          const accountNumber = tokens[1] ?? "";
          const amount = parseFloat(tokens[2] ?? "0");
          if (accountNumber) {
            result.balances.push({
              accountNumber,
              balanceType: "RES",
              yearOffset,
              amount,
            });
          }
          break;
        }
        case "PSALDO":
        case "PBUDGET": {
          const yearOffset = parseInt(tokens[0] ?? "0", 10);
          const period = parseInt(tokens[1] ?? "0", 10);
          const accountNumber = tokens[2] ?? "";
          const amount = parseFloat(tokens[4] ?? "0");
          if (accountNumber) {
            result.balances.push({
              accountNumber,
              balanceType: tag,
              yearOffset,
              period,
              amount,
            });
          }
          break;
        }
        case "VER": {
          const series = tokens[0] ?? "";
          const number = tokens[1] ?? "";
          const date = formatSIEDate(tokens[2] ?? "");
          const text = tokens[3] ? unquote(tokens[3]) : null;
          currentVer = { series, number: `${series} ${number}`.trim(), date, text };
          break;
        }
        case "TRANS":
        case "RTRANS":
        case "BTRANS": {
          const accountNumber = tokens[0] ?? "";
          const amount = parseFloat(tokens[2] ?? "0");
          const txDate = tokens[3] ? formatSIEDate(tokens[3]) : null;
          const description = tokens[4] ? unquote(tokens[4]) : currentVer?.text ?? null;
          if (accountNumber && !isNaN(amount)) {
            result.transactions.push({
              verificationNumber: currentVer?.number ?? null,
              transactionDate: txDate ?? currentVer?.date ?? null,
              accountNumber,
              amount,
              description,
            });
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      result.errors.push({
        section: `#${tag} (rad ${i + 1})`,
        message: `Fel vid tolkning av #${tag}: ${err instanceof Error ? err.message : String(err)}`,
        severity: "warning",
      });
    }
  }

  if (!result.fiscalYearStart) {
    result.errors.push({
      section: "#RAR",
      message: "Räkenskapsår (#RAR) hittades inte i SIE-filen. Kontrollera att filen innehåller en giltig #RAR-post.",
      severity: "warning",
    });
  }

  return result;
}

export function parseSIEBuffer(buffer: Buffer): SIEParseResult {
  let content: string;
  try {
    content = buffer.toString("utf-8");
    if (content.includes("\uFFFD")) {
      content = buffer.toString("latin1");
    }
  } catch {
    content = buffer.toString("latin1");
  }
  return parseSIEContent(content);
}
