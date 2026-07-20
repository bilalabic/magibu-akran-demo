import "server-only";

import bcrypt from "bcryptjs";

// NFR-1.1 / FR-1.6: Şifreler yalnızca bcrypt hash olarak saklanır.
const DEFAULT_ROUNDS = 12;

function rounds(): number {
  const value = Number(process.env.BCRYPT_ROUNDS ?? DEFAULT_ROUNDS);
  return Number.isInteger(value) && value >= 10 && value <= 15 ? value : DEFAULT_ROUNDS;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, rounds());
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
