/**
 * S3-compatible client configuration.
 *
 * Uses the AWS SDK v3 S3 client with a configurable endpoint,
 * allowing the same code to work with:
 * - Garage (local development)
 * - Scaleway Object Storage (staging/production)
 *
 * Environment variables:
 * - S3_ENDPOINT: Full URL to the S3-compatible API
 * - S3_REGION: Region identifier (e.g., "garage", "fr-par")
 * - S3_BUCKET: Bucket name
 * - S3_ACCESS_KEY_ID: Access key
 * - S3_SECRET_ACCESS_KEY: Secret key
 */

import { S3Client } from '@aws-sdk/client-s3'

function getEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getS3Endpoint(): string {
  return getEnvVar('S3_ENDPOINT')
}

export function getS3Region(): string {
  return getEnvVar('S3_REGION')
}

export function getS3Bucket(): string {
  return getEnvVar('S3_BUCKET')
}

export function getS3AccessKeyId(): string {
  return getEnvVar('S3_ACCESS_KEY_ID')
}

export function getS3SecretAccessKey(): string {
  return getEnvVar('S3_SECRET_ACCESS_KEY')
}

export const s3Client = new S3Client({
  endpoint: getS3Endpoint(),
  region: getS3Region(),
  credentials: {
    accessKeyId: getS3AccessKeyId(),
    secretAccessKey: getS3SecretAccessKey(),
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
})
