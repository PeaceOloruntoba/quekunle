import { S3Client } from "@aws-sdk/client-s3";

const globalForS3 = globalThis as typeof globalThis & { quekunleS3?: S3Client };
export function getStorage() {
  const {
    AWS_ENDPOINT_URL_S3,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_REGION,
  } = process.env;
  if (
    !AWS_ENDPOINT_URL_S3 ||
    !AWS_ACCESS_KEY_ID ||
    !AWS_SECRET_ACCESS_KEY ||
    !AWS_REGION
  )
    throw new Error("Neon Object Storage credentials are incomplete.");
  if (!globalForS3.quekunleS3)
    globalForS3.quekunleS3 = new S3Client({
      endpoint: AWS_ENDPOINT_URL_S3,
      region: AWS_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  return globalForS3.quekunleS3;
}
export function bucketName() {
  return process.env.S3_BUCKET || "quekunle";
}
