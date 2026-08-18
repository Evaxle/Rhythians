import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash || !/^[0-9a-f]+$/i.test(hash)) return false;
    const hashBuffer = Buffer.from(hash, "hex");
    if (hashBuffer.length !== 64) return false;
    const derivedKey = await scrypt(password, salt, 64);
    return timingSafeEqual(hashBuffer, derivedKey);
  } catch {
    return false;
  }
}
