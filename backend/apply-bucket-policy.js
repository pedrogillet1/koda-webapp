const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const bucketPolicy = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowIAMUserFullAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::496488677098:user/koda-backend"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::koda-user-file",
        "arn:aws:s3:::koda-user-file/*"
      ]
    },
    {
      "Sid": "AllowPresignedUrlUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::koda-user-file/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
};

async function applyBucketPolicy() {
  const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: 'AKIAXHGIH73VJWKDPJFL',
      secretAccessKey: '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'
    }
  });

  try {
    console.log('📝 Applying bucket policy to koda-user-file...');

    const command = new PutBucketPolicyCommand({
      Bucket: 'koda-user-file',
      Policy: JSON.stringify(bucketPolicy)
    });

    await s3Client.send(command);

    console.log('✅ Bucket policy applied successfully!');
    console.log('The bucket now allows:');
    console.log('  1. IAM user koda-backend to perform all S3 operations');
    console.log('  2. Presigned URL uploads with server-side encryption');
  } catch (error) {
    console.error('❌ Error applying bucket policy:', error);
    process.exit(1);
  }
}

applyBucketPolicy();
