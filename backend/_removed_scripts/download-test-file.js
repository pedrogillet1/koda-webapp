/**
 * Download test files from S3
 */
require('dotenv').config();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function downloadFile(s3Key, localPath) {
  try {
    console.log(`📥 Downloading ${s3Key}...`);

    const command = new GetObjectCommand({
      Bucket: 'koda-user-file',
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const stream = response.Body;

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Write to file
    fs.writeFileSync(localPath, buffer);
    console.log(`✅ Downloaded to ${localPath} (${buffer.length} bytes)`);

    return true;
  } catch (error) {
    console.error(`❌ Error downloading ${s3Key}:`, error.message);
    return false;
  }
}

async function main() {
  const files = [
    {
      s3Key: 'test-user-backend/9cdd9618-0092-40cb-9f11-eafa9e9443d4-1764403553196',
      localPath: './test-markdown.md'
    },
    {
      s3Key: 'test-user-backend/94ea4e2f-5374-4ff6-9945-b1af05f00cae-1764403585938',
      localPath: './test-document.pdf'
    }
  ];

  for (const file of files) {
    await downloadFile(file.s3Key, file.localPath);
  }
}

main().catch(console.error);
