/**
 * Create S3 Bucket Script
 *
 * Creates the AWS S3 bucket needed for document storage
 *
 * Usage:
 *   npx ts-node scripts/create-s3-bucket.ts
 */

import 'dotenv/config';
import { S3Client, CreateBucketCommand, PutBucketCorsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'koda-user-files';

// Validate configuration
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env');
  process.exit(1);
}

// Create S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
  }
});

async function createBucket() {
  console.log(`🚀 Creating S3 bucket: ${AWS_S3_BUCKET} in region ${AWS_REGION}...\n`);

  try {
    // Check if bucket already exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: AWS_S3_BUCKET }));
      console.log(`✅ Bucket "${AWS_S3_BUCKET}" already exists!`);
      console.log('📝 Skipping bucket creation...\n');
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        // Bucket doesn't exist, create it
        console.log(`📦 Bucket doesn't exist. Creating...`);

        const createCommand = new CreateBucketCommand({
          Bucket: AWS_S3_BUCKET,
          // Note: For us-east-1, we don't specify LocationConstraint
          ...(AWS_REGION !== 'us-east-1' && {
            CreateBucketConfiguration: {
              LocationConstraint: AWS_REGION as any
            }
          })
        });

        await s3Client.send(createCommand);
        console.log(`✅ Bucket "${AWS_S3_BUCKET}" created successfully!`);
      } else {
        throw error;
      }
    }

    // Configure CORS for the bucket (allows direct uploads from frontend)
    console.log('\n📝 Configuring CORS for bucket...');
    const corsCommand = new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'], // In production, restrict this to your domain
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000
          }
        ]
      }
    });

    await s3Client.send(corsCommand);
    console.log('✅ CORS configuration applied successfully!\n');

    console.log('✅ S3 bucket setup complete!');
    console.log(`📦 Bucket name: ${AWS_S3_BUCKET}`);
    console.log(`🌍 Region: ${AWS_REGION}`);
    console.log('\n✅ You can now upload files to S3!');

  } catch (error: any) {
    console.error('\n❌ Error creating bucket:', error);

    if (error.Code === 'BucketAlreadyOwnedByYou') {
      console.log('✅ Bucket already exists and is owned by you!');
    } else if (error.Code === 'BucketAlreadyExists') {
      console.error('❌ Bucket name is already taken. Please choose a different name in .env');
    } else {
      console.error('Error details:', error);
    }

    process.exit(1);
  }
}

// Run the script
createBucket()
  .then(() => {
    console.log('\n👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
