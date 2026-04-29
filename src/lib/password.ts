import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2 = promisify(pbkdf2Callback);
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const PREFIX = "pbkdf2";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return [PREFIX, ITERATIONS, salt, hash.toString("base64url")].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) return false;
  const [prefix, iterationsRaw, salt, hashRaw] = storedHash.split("$");
  const iterations = Number(iterationsRaw);
  if (prefix !== PREFIX || !Number.isFinite(iterations) || !salt || !hashRaw) {
    return false;
  }

  const expected = Buffer.from(hashRaw, "base64url");
  // Reject malformed hashes whose decoded length doesn't match the format
  // we produce. Without this, a stored hash with the wrong byte count would
  // produce a 0/odd-length pbkdf2 output and timingSafeEqual could pass on
  // edge inputs.
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await pbkdf2(password, salt, iterations, KEY_LENGTH, DIGEST);
  return timingSafeEqual(expected, actual);
}

// Minimum password policy: 10+ chars and at least 3 of 4 character classes
// (lowercase, uppercase, digit, symbol). Stops `aaaaaaaaaa` style passwords
// while not requiring all four classes (avoids forcing symbols on users
// whose keyboards make them awkward).
export function isStrongEnoughPassword(password: string): boolean {
  if (typeof password !== "string" || password.length < 10) return false;
  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  return classes >= 3;
}
