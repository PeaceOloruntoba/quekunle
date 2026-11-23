import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "twofold_session";
const LEGACY_COOKIE = "quekunle_session";
const SESSION_SECONDS = 60 * 60 * 24 * 90;
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(secret);
}
export async function createSession(user: {
  id: string;
  username: string;
  display_name: string;
}) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    expires: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
}
export async function getSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, key())).payload as {
      id: string;
      username: string;
      display_name: string;
    };
  } catch {
    return null;
  }
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(LEGACY_COOKIE);
}
