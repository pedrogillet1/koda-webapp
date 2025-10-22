/**
 * Quick check to verify ImageMagick is detected
 * Run with: npx ts-node scripts/check-imagemagick.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

async function checkImageMagick() {
  console.log('🔍 Checking ImageMagick Installation\n');

  // Test 1: Check if magick is in PATH
  console.log('Test 1: Checking if "magick" command is available...');
  try {
    const { stdout } = await execAsync('magick -version', { timeout: 5000 });
    console.log('✅ SUCCESS: magick command found in PATH\n');
    console.log(stdout);
    return true;
  } catch (error) {
    console.log('❌ FAILED: magick command not in PATH');
  }

  // Test 2: Check user directory
  console.log('\nTest 2: Checking C:\\Users\\Pedro\\ImageMagick...');
  const userMagickPath = path.join(process.env.USERPROFILE || '', 'ImageMagick', 'magick.exe');

  if (fs.existsSync(userMagickPath)) {
    console.log(`✅ Found ImageMagick at: ${userMagickPath}`);

    try {
      const { stdout } = await execAsync(`"${userMagickPath}" -version`, { timeout: 5000 });
      console.log('✅ SUCCESS: ImageMagick executable works!\n');
      console.log(stdout);
      console.log('\n⚠️  NOTE: ImageMagick works but is not in PATH.');
      console.log('The slide generator will use the full path automatically.\n');
      return true;
    } catch (error) {
      console.log('❌ FAILED: ImageMagick executable exists but failed to run');
      console.error(error);
    }
  } else {
    console.log(`❌ FAILED: ImageMagick not found at ${userMagickPath}`);
  }

  // Test 3: Check common installation paths
  console.log('\nTest 3: Checking common installation paths...');
  const commonPaths = [
    'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe',
    'C:\\Program Files\\ImageMagick\\magick.exe',
    'C:\\Program Files (x86)\\ImageMagick\\magick.exe',
  ];

  for (const testPath of commonPaths) {
    if (fs.existsSync(testPath)) {
      console.log(`✅ Found at: ${testPath}`);
      try {
        const { stdout } = await execAsync(`"${testPath}" -version`, { timeout: 5000 });
        console.log('✅ SUCCESS: This installation works!\n');
        console.log(stdout);
        return true;
      } catch (error) {
        console.log('❌ Found but failed to execute');
      }
    }
  }

  console.log('\n❌ ImageMagick not found anywhere.');
  console.log('\n📝 To install ImageMagick:');
  console.log('1. Run: powershell .\\install-imagemagick-simple.ps1');
  console.log('2. Or manually install from: https://imagemagick.org/script/download.php');
  console.log('3. Restart your terminal after installation\n');

  return false;
}

// Run check
checkImageMagick()
  .then(success => {
    if (success) {
      console.log('🎉 ImageMagick is properly configured!');
      console.log('✅ Slide generation will use ImageMagick for high-quality font rendering.\n');
      process.exit(0);
    } else {
      console.log('⚠️  ImageMagick is not configured.');
      console.log('❌ Slide generation will use fallback method with poor font rendering.\n');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
