import bcrypt from "bcryptjs";

/** Matches the cost factor used by `scripts/seed-admin.ts`. */
const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Validate a proposed password. Throws an Error whose message is safe to surface
 * as a 400. Deliberately only enforces length: length beats composition rules for
 * real-world strength, and the admin count here is tiny.
 */
export const validatePassword = (raw: unknown): string => {
  if (typeof raw !== "string") throw new Error("password required");
  if (raw.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (raw.trim().length === 0) throw new Error("password cannot be blank");
  return raw;
};

export const hashPassword = (raw: string): Promise<string> =>
  bcrypt.hash(raw, BCRYPT_ROUNDS);

/** Normalise an email for storage and for the `byEmail` GSI lookup in login. */
export const normaliseEmail = (raw: unknown): string => {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("email required");
  const email = raw.trim().toLowerCase();
  // Deliberately loose: enough to catch typos, not to police valid addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid email");
  return email;
};
