import { PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { s3Client, getS3Bucket } from '../src/lib/s3-client.server.ts'

async function setupCors() {
  const bucketName = getS3Bucket()
  console.log(`[garage-cors] Setting up CORS for bucket: ${bucketName}`)

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })

    await s3Client.send(command)
    console.log('[garage-cors] CORS configuration applied successfully!')
  } catch (error) {
    console.error('[garage-cors] Failed to apply CORS configuration:', error)
    process.exit(1)
  }
}

setupCors()
