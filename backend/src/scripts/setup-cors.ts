import { Storage } from '@google-cloud/storage';
import { config } from '../config/env';
import fs from 'fs';

async function setupCORS() {
  try {
    if (!fs.existsSync(config.GCS_KEY_FILE)) {
      console.error('❌ GCS key file not found');
      process.exit(1);
    }

    const storage = new Storage({
      projectId: config.GCS_PROJECT_ID,
      keyFilename: config.GCS_KEY_FILE,
    });

    const bucket = storage.bucket(config.GCS_BUCKET_NAME);

    // CORS configuration
    const corsConfiguration = [
      {
        origin: ['https://koda-frontend.ngrok.app', 'http://localhost:3000'],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        responseHeader: [
          'Content-Type',
          'Content-Length',
          'Content-Range',
          'Content-Encoding',
          'Content-Disposition',
          'X-Goog-*',
          'Authorization',
          'Range'
        ],
        maxAgeSeconds: 3600,
      },
    ];

    await bucket.setCorsConfiguration(corsConfiguration);

    console.log('✅ CORS configuration applied successfully!');
    console.log('Allowed origins:');
    console.log('  - https://koda-frontend.ngrok.app');
    console.log('  - http://localhost:3000');
    console.log('\nAllowed methods: GET, HEAD, PUT, POST, DELETE');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting CORS configuration:', error);
    process.exit(1);
  }
}

setupCORS();
