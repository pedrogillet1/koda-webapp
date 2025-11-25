const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: 'AKIAXHGIH73VJWKDPJFL',
    secretAccessKey: '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'
  }
});

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: [
        'https://koda-frontend.ngrok.app',
        'http://localhost:3000',
        'https://*.ngrok.app',
        'https://*.ngrok-free.dev'
      ],
      ExposeHeaders: [
        'ETag',
        'x-amz-server-side-encryption',
        'x-amz-request-id',
        'x-amz-id-2'
      ],
      MaxAgeSeconds: 3000
    }
  ]
};

async function checkAndApplyCORS() {
  try {
    // Check current CORS configuration
    console.log('🔍 Checking current CORS configuration for koda-user-file...\n');

    try {
      const getCommand = new GetBucketCorsCommand({ Bucket: 'koda-user-file' });
      const currentCors = await s3Client.send(getCommand);
      console.log('📋 Current CORS configuration found:');
      console.log(JSON.stringify(currentCors.CORSRules, null, 2));
      console.log('');
    } catch (error) {
      if (error.name === 'NoSuchCORSConfiguration') {
        console.log('⚠️  No CORS configuration found. Will apply new configuration.\n');
      } else {
        throw error;
      }
    }

    // Apply CORS configuration
    console.log('📝 Applying CORS configuration to koda-user-file bucket...');
    const putCommand = new PutBucketCorsCommand({
      Bucket: 'koda-user-file',
      CORSConfiguration: corsConfiguration
    });

    await s3Client.send(putCommand);

    console.log('✅ CORS configuration applied successfully!\n');
    console.log('📊 Applied CORS Rules:');
    console.log('  - Allowed Origins:');
    corsConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
      console.log(`    ✓ ${origin}`);
    });
    console.log('  - Allowed Methods:', corsConfiguration.CORSRules[0].AllowedMethods.join(', '));
    console.log('  - Allowed Headers: *');
    console.log('  - Exposed Headers:', corsConfiguration.CORSRules[0].ExposeHeaders.join(', '));
    console.log('  - Max Age: 3000 seconds (50 minutes)\n');

    console.log('✅ S3 bucket is now configured for cross-origin requests from your frontend!\n');

  } catch (error) {
    console.error('❌ Error applying CORS configuration:', error);
    console.error('\nError details:');
    console.error('  Code:', error.Code || error.name);
    console.error('  Message:', error.message);

    if (error.Code === 'AccessDenied') {
      console.error('\n💡 Note: Your IAM user may not have s3:PutBucketCors permission.');
      console.error('   The CORS configuration may need to be applied via AWS Console.');
    }

    process.exit(1);
  }
}

checkAndApplyCORS();
