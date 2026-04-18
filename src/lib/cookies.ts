const DEFAULT_MAX_AGE = 2_592_000;

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signCookie(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const payload = new TextEncoder().encode(value);
  const sig = await crypto.subtle.sign("HMAC", key, payload);
  return `${b64urlEncode(payload)}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyCookie(
  signed: string,
  secret: string,
): Promise<string | null> {
  const dot = signed.indexOf(".");
  if (dot < 0) return null;
  const payloadPart = signed.slice(0, dot);
  const sigPart = signed.slice(dot + 1);
  const payload = b64urlDecode(payloadPart);
  const sig = b64urlDecode(sigPart);
  if (!payload || !sig) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, sig, payload);
  if (!ok) return null;
  return new TextDecoder().decode(payload);
}

export function buildSetCookie(
  name: string,
  value: string,
  opts: { path: string; maxAge?: number; secure?: boolean },
): string {
  const secure = opts.secure ?? true;
  const maxAge = opts.maxAge ?? DEFAULT_MAX_AGE;
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseCookies(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const pairs = header.split(";");
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    out[name] = value;
  }
  return out;
}
