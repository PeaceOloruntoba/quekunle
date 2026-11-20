import {
  createECDH,
  createPrivateKey,
  createSign,
  hkdfSync,
  randomBytes,
  createCipheriv,
} from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { database } from "@/lib/db";

export const pushCategories = [
  "messages",
  "timeline",
  "memories",
  "profile",
  "wallpaper",
  "receipts",
] as const;
export type PushCategory = (typeof pushCategories)[number];
type Subscription = { endpoint: string; p256dh: string; auth: string };
type PushPayload = { title: string; body: string; url?: string; tag?: string };
const b64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");
const fromB64url = (value: string) => Buffer.from(value, "base64url");
function hkdf(secret: Buffer, salt: Buffer, info: Buffer, size: number) {
  return Buffer.from(hkdfSync("sha256", secret, salt, info, size));
}
function vapidToken(endpoint: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey)
    throw new Error(
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured for web push.",
    );
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: process.env.VAPID_SUBJECT || "mailto:hello@quekunle.app",
    }),
  );
  const unsigned = `${header}.${claims}`;
  const d = fromB64url(privateKey);
  const x = fromB64url(publicKey).subarray(1, 33);
  const y = fromB64url(publicKey).subarray(33, 65);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: b64url(d), x: b64url(x), y: b64url(y) },
    format: "jwk",
  });
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
function encryptPayload(subscription: Subscription, payload: PushPayload) {
  const clientPublic = fromB64url(subscription.p256dh);
  const auth = fromB64url(subscription.auth);
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(clientPublic);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    clientPublic,
    serverPublic,
  ]);
  const inputKey = hkdf(sharedSecret, auth, keyInfo, 32);
  const salt = randomBytes(16);
  const cek = hkdf(
    inputKey,
    salt,
    Buffer.from("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = hkdf(
    inputKey,
    salt,
    Buffer.from("Content-Encoding: nonce\0"),
    12,
  );
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(payload)),
    Buffer.from([2]),
  ]);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublic.length]),
    serverPublic,
    ciphertext,
  ]);
}

export async function notifyUser(
  userId: string,
  category: PushCategory,
  actorId: string,
  payload: PushPayload,
) {
  if (
    userId === actorId ||
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  )
    return;
  const sql = database();
  let rows;
  try {
    rows =
      await sql`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId} AND COALESCE((preferences->>${category})::boolean, true) = true`;
  } catch (error) {
    console.error(
      "[push] could not load subscriptions; run npm run db:seed",
      error,
    );
    return;
  }
  await Promise.all(
    rows.map(async (row) => {
      try {
        const subscription = {
          endpoint: String(row.endpoint),
          p256dh: String(row.p256dh),
          auth: String(row.auth),
        };
        const encrypted = encryptPayload(subscription, payload);
        const response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${vapidToken(subscription.endpoint)}, k=${process.env.VAPID_PUBLIC_KEY}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
            Urgency: "normal",
          },
          body: new Uint8Array(encrypted),
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404 || response.status === 410)
          await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`;
        else if (!response.ok)
          console.error("[push] provider returned", response.status);
      } catch (error) {
        console.error("[push] delivery failed", error);
      }
    }),
  );
}

export function schedulePush(
  userId: string,
  category: PushCategory,
  actorId: string,
  payload: PushPayload,
) {
  const delivery = notifyUser(userId, category, actorId, payload);
  if (process.env.VERCEL === "1") {
    try {
      waitUntil(delivery);
      return;
    } catch {
      return delivery;
    }
  }
  return delivery;
}
