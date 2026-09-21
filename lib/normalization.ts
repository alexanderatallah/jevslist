import { AppError } from "./errors";
export function normalizeText(text: string) { return text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
export async function hash(text: string) { const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, "0")).join(""); }
export function inputUrl(input: string): URL | null {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(?:javascript|data|file|mailto):/i.test(value)) {
    try { return validateUrl(new URL(value)); } catch(e) { if(e instanceof AppError) throw e; throw new AppError("That link doesn’t look valid. Please use a complete public web URL."); }
  }
  if (/^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/:?#][^\s]*)?$/i.test(value)) {
    try { return validateUrl(new URL(`https://${value}`)); } catch(e) { if(e instanceof AppError) throw e; throw new AppError("That link doesn’t look valid."); }
  }
  return null;
}
export function validateUrl(url: URL) {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port || !host.includes(".") || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host) || host === "metadata.google.internal") throw new AppError("Please use a public HTTP or HTTPS link.");
  url.hostname = host; url.hash = "";
  return url;
}
export function tweetId(url: URL) {
  if (!/^(www\.|mobile\.)?(x\.com|twitter\.com)$/.test(url.hostname)) return null;
  return url.pathname.match(/\/(?:[^/]+\/status|i\/web\/status|i\/status)\/(\d+)(?:\/|$)/)?.[1] ?? null;
}
export function canonicalUrl(url: URL) {
  const tweet = tweetId(url); if (tweet) return `https://x.com/i/status/${tweet}`;
  const value = new URL(url); value.hash = ""; value.hostname = value.hostname.replace(/^www\./, "");
  for (const key of [...value.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$)/i.test(key)) value.searchParams.delete(key);
  value.searchParams.sort(); value.pathname = value.pathname.replace(/\/+$/, "") || "/";
  return value.toString();
}
export async function submissionHash(input: string, url: URL | null) { return hash(url ? `url:${canonicalUrl(url).replace(/^https?:/, "")}` : `text:${normalizeText(input)}`); }
