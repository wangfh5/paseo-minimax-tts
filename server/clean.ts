// Clean markdown, URLs, long file paths, inline math, and opaque hashes before sending text to TTS.

const genericFiles = new Set([
  "index", "main", "mod", "lib", "init", "__init__", "app", "server", "client",
  "config", "settings", "package.json", "tsconfig.json", "readme.md", "skill.md",
  "agents.md", "claude.md", "dockerfile", "makefile", "cargo.toml", "pyproject.toml",
  "go.mod", "src", "dist", "build", "logs", "tmp", "audio",
]);
const noisyRoots = new Set(["home", "users", "private", "var", "opt", "volumes"]);
const relativeHints = new Set(["src", "lib", "app", "server", "client", "shared", "packages", "docs", "test", "tests", "worktrees", "node_modules", "scripts", "config", "dist", "build"]);
const linkTarget = /^(?:(?:https?|wss?|file|mailto|conversation):|\/|\.\.?\/|~\/|#|\S+\.[a-z0-9]{1,8}(?:[#?]\S*)?$|\S+\/\S+)/i;
const loopbackHost = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|::1)$/i;
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hexHash = /^(?=.*\d)(?=.*[a-f])[0-9a-f]{16,}$/i;
const trailingPunct = /[.,;:!?'")\]}>。，；：！？）】》”’]+$/;
const locationSuffix = /(?:#L\d+(?:-L?\d+)?|:\d+(?::\d+)?)$/;

function isOpaque(segment: string): boolean {
  const stem = segment.replace(/\.[^.]+$/, "");
  return uuidLike.test(stem) || hexHash.test(stem);
}

function isGenericSegment(segment: string): boolean {
  const lower = segment.toLowerCase();
  const stem = lower.replace(/\.[^.]+$/, "");
  return genericFiles.has(lower) || genericFiles.has(stem);
}

function shortenHashFilename(name: string): string {
  const match = name.match(/^([^.]+)(\.[^.]+)$/);
  if (match && isOpaque(match[1])) return `${match[1].slice(0, 7)}${match[2]}`;
  if (isOpaque(name)) return name.slice(0, 8);
  return name;
}

export function shortenPath(raw: string, force = false): string {
  const withoutLoc = raw.replace(locationSuffix, "");
  const isWindows = /^[A-Za-z]:[\\/]/.test(withoutLoc);
  const isHome = withoutLoc.startsWith("~/");
  const isDotRel = /^\.\.?\//.test(withoutLoc);
  const isAbsUnix = withoutLoc.startsWith("/");
  const hasPrefix = isWindows || isHome || isDotRel || isAbsUnix;
  const cleaned = isWindows ? withoutLoc.slice(2) : isHome ? withoutLoc.slice(2) : withoutLoc;
  const segments = cleaned.split(/[\\/]+/).filter(s => s && s !== "." && s !== "..");
  if (!segments.length) return raw;
  // Never touch dates or numeric ratios like 2026/11/25 or 1/2/3.
  if (segments.every(s => /^\d+$/.test(s))) return raw;

  const last = segments[segments.length - 1];
  const hasExtension = /\.[A-Za-z0-9]{1,8}$/.test(last);
  const hasNoisyRoot = (isAbsUnix && noisyRoots.has(segments[0].toLowerCase())) || isHome || isWindows;
  const hasOpaqueSegment = segments.some(isOpaque);

  if (!force) {
    if (!hasPrefix) {
      // Preserve short 2-segment tokens (e.g. antigravity/gemini-4-carbon, server/minimax.ts)
      // and slash-separated word lists (e.g. Off/Synthesize/Play).
      if (segments.length < 3) return raw;
      const looksLikePath = hasExtension || hasOpaqueSegment || segments.some(s => relativeHints.has(s.toLowerCase()) || s.startsWith("."));
      if (!looksLikePath && segments.length < 4) return raw;
    } else {
      // Keep very short absolute/relative paths like /tmp, /etc/hosts, ./README.md unless noisy or deep.
      if (segments.length <= 2 && !hasNoisyRoot && !hasOpaqueSegment && withoutLoc.length <= 24) return raw;
    }
  }

  const tail = shortenHashFilename(last);
  if (segments.length >= 2 && isGenericSegment(last)) {
    const parent = segments[segments.length - 2];
    if (!parent.startsWith(".") && !isOpaque(parent) && !noisyRoots.has(parent.toLowerCase()) && parent.length <= 28) {
      return `${parent}/${tail}`;
    }
  }
  return tail;
}

// Balanced scanner for Markdown links [label](url) and images ![alt](url).
function stripMarkdownLinks(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const isImage = text[i] === "!" && text[i + 1] === "[";
    const openBracket = isImage ? i + 1 : text[i] === "[" ? i : -1;
    if (openBracket === -1 || (!isImage && i > 0 && /[A-Za-z0-9_$]/.test(text[i - 1]))) {
      out += text[i++];
      continue;
    }
    let depth = 0, j = openBracket;
    while (j < text.length) {
      if (text[j] === "\\" && j + 1 < text.length) { j += 2; continue; }
      if (text[j] === "[") depth++;
      else if (text[j] === "]") { depth--; if (depth === 0) break; }
      j++;
    }
    if (j >= text.length || text[j] !== "]") { out += text[i++]; continue; }
    const label = text.slice(openBracket + 1, j);

    // Inline link [label](target)
    if (text[j + 1] === "(") {
      let pDepth = 0, k = j + 1;
      while (k < text.length) {
        if (text[k] === "\\" && k + 1 < text.length) { k += 2; continue; }
        if (text[k] === "(") pDepth++;
        else if (text[k] === ")") { pDepth--; if (pDepth === 0) break; }
        k++;
      }
      if (k < text.length && text[k] === ")") {
        const inner = text.slice(j + 2, k).trim().replace(/^<|>$/g, "");
        const target = inner.split(/\s+/)[0] ?? "";
        if (isImage || linkTarget.test(target)) {
          out += isImage ? label.trim() : label;
          i = k + 1;
          continue;
        }
      }
    }
    // Reference link [label][ref]
    if (text[j + 1] === "[") {
      const closeRef = text.indexOf("]", j + 2);
      if (closeRef !== -1 && !text.slice(j + 2, closeRef).includes("\n")) {
        out += isImage ? label.trim() : label;
        i = closeRef + 1;
        continue;
      }
    }
    out += text[i++];
  }
  return out;
}

function cleanUrl(raw: string): string {
  // Preserve trailing sentence punctuation, keeping a closing ')' if it balances an '(' in the URL.
  let url = raw, suffix = "";
  while (url.length) {
    const ch = url[url.length - 1];
    if (!trailingPunct.test(ch)) break;
    if (ch === ")" && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
    suffix = ch + suffix;
    url = url.slice(0, -1);
  }
  if (/^file:\/\//i.test(url)) {
    const path = url.replace(/^file:\/\/(?:localhost)?/i, "");
    return shortenPath(path, true) + suffix;
  }
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (loopbackHost.test(parsed.hostname) && segments.length >= 3) {
      return shortenPath(parsed.pathname, true) + suffix;
    }
    const host = parsed.hostname.replace(/^www\./i, "");
    const withPort = parsed.port && loopbackHost.test(parsed.hostname) ? `${host}:${parsed.port}` : host;
    return withPort + suffix;
  } catch {
    return raw;
  }
}

function cleanLatex(expr: string): string {
  let s = expr.trim()
    .replace(/\\\\/g, "\\")
    .replace(/\\_/g, "_")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1 / $2")
    .replace(/\\(?:rm|mathrm|text|textrm|textit|textbf|mathbf|mathit|mathcal|mathbb|operatorname|left|right|big|Big|bigg|Bigg|displaystyle|scriptstyle|quad|qquad)\b/g, " ")
    .replace(/\\[,;:!]/g, " ")
    .replace(/\\times\b/g, " × ")
    .replace(/\\cdot\b/g, " · ")
    .replace(/\\pm\b/g, " ± ")
    .replace(/\\mp\b/g, " ∓ ")
    .replace(/\\approx\b/g, " ≈ ")
    .replace(/\\sim\b/g, " ~ ")
    .replace(/\\(?:neq|ne)\b/g, " ≠ ")
    .replace(/\\(?:leq|le)\b/g, " ≤ ")
    .replace(/\\(?:geq|ge)\b/g, " ≥ ")
    .replace(/\\(?:rightarrow|to)\b/g, " → ")
    .replace(/\\leftarrow\b/g, " ← ")
    .replace(/\\infty\b/g, " ∞ ")
    .replace(/\\propto\b/g, " ∝ ")
    .replace(/\^(?:\{2\}|2(?![0-9]))/g, "²")
    .replace(/\^(?:\{3\}|3(?![0-9]))/g, "³")
    .replace(/\\([A-Za-z]+)/g, " $1 ")
    .replace(/[_^{}]/g, " ")
    .replace(/\s+([²³])/g, "$1")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function cleanMath(text: string): string {
  // Display math $$...$$
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => cleanLatex(expr));
  // Inline math $...$ (avoid currency like "$5", "$10 to $20", "$10-$20" and shell vars "$HOME").
  out = out.replace(/(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (match, expr: string) => {
    // Reject obvious currency ranges such as "$10 and $20" if they ever slipped through.
    if (/^\d[\d,.]*(?:\s+\w+|\s*-\s*)$/.test(expr)) return match;
    return cleanLatex(expr);
  });
  return out;
}

function cleanPaths(text: string): string {
  // Windows paths (e.g. C:\Users\alice\project\file.ts)
  let out = text.replace(/(?<![A-Za-z0-9_])([A-Za-z]:[\\/][A-Za-z0-9._@+~:#\\/-]+)/g, raw => {
    const punct = raw.match(trailingPunct)?.[0] ?? "";
    const core = punct ? raw.slice(0, -punct.length) : raw;
    return shortenPath(core) + punct;
  });
  // Unix absolute (/a/b), home (~/a/b), dot-relative (./a/b, ../a/b), and multi-segment relative paths (a/b/c.ts).
  out = out.replace(/(?<![A-Za-z0-9_/])((?:~\/|\.\.?\/|\/|[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._@+~-]+){2,})[A-Za-z0-9._@+~:#/-]*)/g, raw => {
    if (!raw.includes("/")) return raw;
    const punct = raw.match(trailingPunct)?.[0] ?? "";
    const core = punct ? raw.slice(0, -punct.length) : raw;
    return shortenPath(core) + punct;
  });
  return out;
}

function cleanIdentifiers(text: string): string {
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, id => id.slice(0, 8))
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{24,}\b/gi, hash => hash.slice(0, 7));
}

export function prepareSpeechText(text: string): string {
  let out = text.replace(/\r\n?/g, "\n");
  // Drop reference-style link definition lines: [ref]: https://...
  out = out.replace(/^[ \t]*\[[^\]]+\]:[ \t]*\S+(?:[ \t]+["'(].*["')])?[ \t]*$/gm, "");
  // Strip fenced code block delimiters (keep inner text so code-only replies still speak).
  out = out.replace(/^[ \t]*(?:```|~~~)[^\n]*$/gm, "");
  // Drop markdown horizontal rules and table divider lines.
  out = out.replace(/^[ \t]*(?:[-*_][ \t]*){3,}(?:\n|$)/gm, "");
  out = out.replace(/^[ \t]*\|?(?:[ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-{2,}:?[ \t]*\|?[ \t]*(?:\n|$)/gm, "");
  // Format markdown table rows into comma-separated cells.
  out = out.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, row: string) => row.split("|").map(cell => cell.trim()).filter(Boolean).join(", "));
  // Unwrap Markdown links and images before stripping backticks, URLs, and paths.
  out = stripMarkdownLinks(out);
  // Unwrap autolinks <https://...> and inline code backticks.
  out = out.replace(/<((?:https?|wss?|file):\/\/[^>\s]+)>/gi, "$1");
  out = out.replace(/(`+)([\s\S]*?)\1/g, (_, _ticks: string, code: string) => code);
  // Clean bare URLs, long file paths, inline math, and standalone hashes/UUIDs before emphasis stripping
  // so subscripts like $\chi_\mu$ and $\eta_\phi$ or URLs with underscores are never mangled by _italic_.
  out = out.replace(/(?:https?|wss?|file):\/\/[^\s<>'"`“”‘’（）【】《》，。；：！？、]+/gi, cleanUrl);
  out = cleanPaths(out);
  out = cleanMath(out);
  out = cleanIdentifiers(out);
  // Strip block-level markdown markers (headings, blockquotes, list bullets).
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  out = out.replace(/^[ \t]{0,3}(?:>[ \t]?)+/gm, "");
  out = out.replace(/^[ \t]*[-*+][ \t]+/gm, "");
  // Strip inline emphasis (**bold**, __bold__, ~~strike~~, *italic*, _italic_).
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/~~([^~\n]+)~~/g, "$1");
  out = out.replace(/(?<!\*)\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, "$1");
  out = out.replace(/(?<![A-Za-z0-9_\\])_(?!\s)([^_\n]+?)(?<!\s)_(?![A-Za-z0-9_])/g, "$1");
  // Unescape remaining markdown backslash escapes in prose (e.g. \* \_ \[ \]).
  out = out.replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, "$1");
  // Normalize spacing and blank lines.
  out = out.split("\n").map(line => line.replace(/[ \t]{2,}/g, " ").trim()).join("\n");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}
