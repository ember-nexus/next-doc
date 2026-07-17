// curl-fmt.ts — parse, validate, and format curl commands
// designed to be testable with vitest, types kept light

export interface CurlHeader {
  name: string;
  value: string;
}

export interface CurlData {
  flag: string;
  value: string;
}

export interface CurlFlag {
  flag: string;
  value?: string;
}

export interface ParsedCurl {
  url: string | null;
  method: string;
  headers: CurlHeader[];
  data: CurlData | null;
  flags: CurlFlag[];
  pipe: string;
  errors: string[];
}

export interface FormatOptions {
  headerPriority?: string[];
  domainWhitelist?: string[];
  prettyJson?: boolean;
}

// ── helpers ──

export class CurlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurlValidationError";
  }
}

export function splitPipe(raw: string): { curl: string; pipe: string } {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) { i++; continue; }
    if (!quote && (c === "'" || c === '"')) { quote = c; continue; }
    if (quote === c) { quote = null; continue; }
    if (!quote && c === "|") {
      return { curl: raw.substring(0, i).trim(), pipe: raw.substring(i).trim() };
    }
  }
  return { curl: raw.trim(), pipe: "" };
}

export function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const s = raw.trim();
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === "\\" && i + 1 < s.length && /[\n\s]/.test(s[i + 1])) { i += 2; continue; }
    if (s[i] === "'" || s[i] === '"') {
      const q = s[i];
      let tok = "";
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\" && q === '"' && i + 1 < s.length) {
          tok += s[i + 1]; i += 2;
        } else {
          tok += s[i]; i++;
        }
      }
      i++; // closing quote
      tokens.push(tok);
    } else {
      let tok = "";
      while (i < s.length && !/\s/.test(s[i])) {
        if (s[i] === "\\" && i + 1 < s.length) {
          tok += s[i + 1]; i += 2;
        } else {
          tok += s[i]; i++;
        }
      }
      tokens.push(tok);
    }
  }
  return tokens;
}

const HEADER_FLAGS = new Set(["-H", "--header"]);
const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode", "--json"]);
const METHOD_FLAGS = new Set(["-X", "--request"]);
const VALUED_FLAGS = new Set([
  "-o", "--output", "-u", "--user", "-A", "--user-agent",
  "-e", "--referer", "-b", "--cookie", "-c", "--cookie-jar",
  "--connect-timeout", "-m", "--max-time", "--retry",
  "-w", "--write-out", "--resolve", "--cert", "--key",
  "-T", "--upload-file", "-F", "--form",
]);
const BOOL_FLAGS = new Set([
  "-v", "--verbose", "-s", "--silent", "-S", "--show-error",
  "-k", "--insecure", "-L", "--location", "-I", "--head",
  "-f", "--fail", "--fail-with-body", "--compressed",
  "-G", "--get", "-#", "--progress-bar", "--http1.1", "--http2",
  "--http3", "-N", "--no-buffer", "--raw", "--tr-encoding",
  "--tcp-fastopen", "--tcp-nodelay",
]);

export function parse(raw: string): ParsedCurl {
  const { curl, pipe } = splitPipe(raw);
  const tokens = tokenize(curl);

  if (!tokens.length) {
    throw new CurlValidationError("Empty command");
  }

  let idx = 0;
  if (tokens[0].toLowerCase() === "curl") idx = 1;

  const result: ParsedCurl = {
    url: null,
    method: "GET",
    headers: [],
    data: null,
    flags: [],
    pipe,
    errors: [],
  };

  while (idx < tokens.length) {
    const tok = tokens[idx];

    if (HEADER_FLAGS.has(tok)) {
      idx++;
      if (idx < tokens.length) {
        const hval = tokens[idx];
        const colon = hval.indexOf(":");
        if (colon > 0) {
          result.headers.push({
            name: hval.substring(0, colon).trim(),
            value: hval.substring(colon + 1).trim(),
          });
        } else {
          result.errors.push(`Malformed header: ${hval}`);
        }
      }
    } else if (DATA_FLAGS.has(tok)) {
      idx++;
      if (idx < tokens.length) result.data = { flag: tok, value: tokens[idx] };
    } else if (METHOD_FLAGS.has(tok)) {
      idx++;
      if (idx < tokens.length) result.method = tokens[idx].toUpperCase();
    } else if (BOOL_FLAGS.has(tok)) {
      result.flags.push({ flag: tok });
    } else if (VALUED_FLAGS.has(tok)) {
      idx++;
      if (idx < tokens.length) result.flags.push({ flag: tok, value: tokens[idx] });
    } else if (tok.startsWith("-")) {
      if (idx + 1 < tokens.length && !tokens[idx + 1].startsWith("-") && !tokens[idx + 1].startsWith("http")) {
        result.flags.push({ flag: tok, value: tokens[idx + 1] });
        idx++;
      } else {
        result.flags.push({ flag: tok });
      }
    } else {
      if (!result.url) result.url = tok;
      else result.errors.push(`Extra positional arg: ${tok}`);
    }
    idx++;
  }

  if (!result.url) {
    throw new CurlValidationError("No URL found in command");
  }

  // infer method from data
  if (result.data && result.method === "GET") {
    result.method = "POST";
  }

  return result;
}

// ── domain validation ──

export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    const m = url.match(/^https?:\/\/([^/:?#]+)/);
    return m ? m[1] : null;
  }
}

export function validateDomain(url: string, whitelist: string[]): void {
  if (!whitelist.length) return;
  const domain = extractDomain(url);
  if (!domain) {
    throw new CurlValidationError(`Could not extract domain from URL: ${url}`);
  }
  const ok = whitelist.some(w => domain === w || domain.endsWith("." + w));
  if (!ok) {
    throw new CurlValidationError(`Domain '${domain}' is not in the whitelist [${whitelist.join(", ")}]`);
  }
}

// ── formatting ──

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function tryPrettyJson(str: string): { text: string; isJson: boolean } {
  try {
    let val = str;
    if (val.startsWith("$'") || val.startsWith('$"')) val = val.slice(1);
    const obj = JSON.parse(val);
    return { text: JSON.stringify(obj, null, 2), isJson: true };
  } catch {
    return { text: str, isJson: false };
  }
}

export function format(parsed: ParsedCurl, opts: FormatOptions = {}): string {
  const { headerPriority = [], prettyJson = true } = opts;

  const lines: string[] = [];
  lines.push(`curl -X ${parsed.method}`);

  // sort headers
  const prioMap: Record<string, number> = {};
  headerPriority.forEach((h, i) => (prioMap[h.toLowerCase()] = i));

  const sorted = [...parsed.headers].sort((a, b) => {
    const pa = prioMap[a.name.toLowerCase()] ?? 9999;
    const pb = prioMap[b.name.toLowerCase()] ?? 9999;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  for (const h of sorted) {
    lines.push(`  -H ${shellQuote(`${h.name}: ${h.value}`)}`);
  }

  for (const f of parsed.flags) {
    lines.push(f.value !== undefined ? `  ${f.flag} ${shellQuote(f.value)}` : `  ${f.flag}`);
  }

  if (parsed.data) {
    const { text, isJson } = prettyJson
      ? tryPrettyJson(parsed.data.value)
      : { text: parsed.data.value, isJson: false };

    const flag = parsed.data.flag;
    if (isJson && text.includes("\n")) {
      const jsonLines = text.split("\n");
      const inner = jsonLines.slice(1, -1);
      const indent = "       "; // 7 spaces
      const block =
        `  ${flag} '{` +
        "\n" +
        inner.map((l) => indent + l).join("\n") +
        "\n" +
        indent +
        `}'`;
      lines.push(block);
    } else {
      lines.push(`  ${flag} ${shellQuote(text)}`);
    }
  }

  lines.push(`  ${shellQuote(parsed.url!)}`);

  let out = lines.join(" \\\n");
  if (parsed.pipe) out += "\n  " + parsed.pipe;
  return out;
}

// ── main entry point ──

/**
 * Parse, validate and format a curl command string.
 * Returns the formatted string.
 * Throws CurlValidationError on validation failure (bad domain, missing URL, etc).
 */
export function curlfmt(input: string, opts: FormatOptions = {}): string {
  const parsed = parse(input);

  if (opts.domainWhitelist?.length && parsed.url) {
    validateDomain(parsed.url, opts.domainWhitelist);
  }

  return format(parsed, opts);
}

export default curlfmt;
