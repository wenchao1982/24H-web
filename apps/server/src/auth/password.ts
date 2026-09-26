import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(pw: string): Promise<string> {
  return hash(pw);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await verify(hash, pw);
  } catch {
    return false;
  }
}
