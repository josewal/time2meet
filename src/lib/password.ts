const ITERATIONS = 100_000;
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex");
    out[i] = byte;
  }
  return out;
}

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    KEY_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

export async function hashPassword(
  password: string,
): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const hash = await derive(password, salt);
  return { salt: bytesToHex(salt), hash: bytesToHex(hash) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  let saltBytes: Uint8Array;
  let expected: Uint8Array;
  try {
    saltBytes = hexToBytes(salt);
    expected = hexToBytes(hash);
  } catch {
    return false;
  }
  const actual = await derive(password, saltBytes);
  return constantTimeEqual(actual, expected);
}
