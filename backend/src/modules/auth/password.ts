import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
const KEY_LENGTH = 64;
const N = 16_384;
const R = 8;
const P = 1;

function scrypt(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expected)
    return false;
  try {
    const expectedBuffer = Buffer.from(expected, "base64url");
    const actual = await scrypt(
      password,
      Buffer.from(salt, "base64url"),
      expectedBuffer.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      },
    );
    return (
      actual.length === expectedBuffer.length &&
      timingSafeEqual(actual, expectedBuffer)
    );
  } catch {
    return false;
  }
}
