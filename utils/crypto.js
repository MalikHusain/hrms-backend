// utils/crypto.js  (ES Module)
// AES-256-GCM encryption for PII fields (email, phone)
// Uses Node.js built-in crypto — no extra packages needed.
//
// Encrypted format stored in DB:
//   "iv:authTag:ciphertext"  (all hex-encoded, colon-separated)
//
// If a value is already plain text (legacy unencrypted data),
// decrypt() returns it as-is so old records still display correctly.

import crypto from "crypto";

const ALGORITHM  = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes — must be exactly 32 for AES-256

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) throw new Error("ENCRYPTION_KEY is not set in .env");
  // Accept any string — hash it to get exactly 32 bytes
  return crypto.createHash("sha256").update(raw).digest();
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────
// Returns "iv:authTag:ciphertext" or null if value is null/undefined
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const text = String(plaintext);
  const key  = getKey();
  const iv   = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────
// Returns the original plaintext, or the input as-is if it's not encrypted
export function decrypt(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return null;
  const str = String(ciphertext);

  // Legacy plain text — not in "iv:authTag:cipher" format, return as-is
  const parts = str.split(":");
  if (parts.length !== 3) return str;

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key       = getKey();
    const iv        = Buffer.from(ivHex,       "hex");
    const authTag   = Buffer.from(authTagHex,  "hex");
    const encrypted = Buffer.from(encryptedHex,"hex");

    const decipher  = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
  } catch {
    // Decryption failed — return original (handles plain text with colons)
    return str;
  }
}

// ─── Helper: decrypt all PII fields in a row object ──────────────────────────
export function decryptRow(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.email !== undefined) out.email = decrypt(out.email);
  if (out.phone !== undefined) out.phone = decrypt(out.phone);
  return out;
}

export function decryptRows(rows) {
  return rows.map(decryptRow);
}
