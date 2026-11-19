import { generateKeyPairSync } from 'node:crypto';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const decode = (value: string) => Buffer.from(value, 'base64url');
const rawPublic = Buffer.concat([Buffer.from([4]), decode(pub.x!), decode(pub.y!)]);
console.log(`VAPID_PUBLIC_KEY=${rawPublic.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
console.log('VAPID_SUBJECT=mailto:your-email@example.com');
