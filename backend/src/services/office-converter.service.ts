import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execPromise = promisify(exec);

/**
 * Find LibreOffice executable path based on operating system
 * REASON: Different OS have different installation paths for LibreOffice
 * WHY: Ensures cross-platform compatibility for document conversion
 */
const findLibreOfficePath = (): string => {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows - check common installation paths
    const possiblePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'LibreOffice', 'program', 'soffice.exe'),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        console.log(`✅ Found LibreOffice at: ${possiblePath}`);
        return `"${possiblePath}"`; // Quote the path for Windows
      }
    }

    throw new Error('LibreOffice not found. Please install LibreOffice from https://www.libreoffice.org/download/');
  } else if (platform === 'darwin') {
    // macOS
    const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if (fs.existsSync(macPath)) {
      return macPath;
    }
    return 'soffice'; // Fallback to PATH
  } else {
    // Linux and others
    return 'libreoffice';
  }
};

interface ConversionResult {
  success: boolean;
  pdfPath?: string;
  pdfBuffer?: Buffer;
  error?: string;
}

/**
 * REASON: Convert Microsoft Office files (DOCX, PPTX, XLSX) to PDF using LibreOffice
 * WHY: Provides universal, high-quality preview for all Office formats
 * IMPACT: Ensures consistent preview experience across all document types
 */
export const convertOfficeToPdf = async (
  inputPath: string,
  outputDir?: string,
  returnBuffer: boolean = false
): Promise<ConversionResult> => {
  let tempUserProfile: string | null = null;

  try {
    if (!outputDir) {
      outputDir = path.dirname(inputPath);
    }

    // Verify input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Check file size
    const stats = fs.statSync(inputPath);
    if (stats.size === 0) {
      throw new Error('Input file is empty');
    }

    console.log(`📄 Converting ${path.basename(inputPath)} to PDF with LibreOffice (${stats.size} bytes)...`);

    const libreOfficePath = findLibreOfficePath();

    // REASON: Create a unique temporary user profile directory for LibreOffice
    // WHY: LibreOffice requires a user profile. Using a unique temporary one for each conversion
    //      prevents conflicts when multiple conversions run in parallel, which is critical for
    //      a multi-user server environment.
    tempUserProfile = path.join(os.tmpdir(), `libreoffice-profile-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempUserProfile, { recursive: true });

    // REASON: Use an expanded set of LibreOffice flags for server stability.
    // WHY: Flags like --invisible, --nologo, and --norestore prevent GUI elements from being invoked,
    //      and -env:UserInstallation ensures our temporary profile is used, making the process stable and isolated.
    const userInstallArg = process.platform === 'win32'
      ? `-env:UserInstallation=file:///${tempUserProfile.replace(/\\/g, '/')}`
      : `-env:UserInstallation=file://${tempUserProfile}`;

    const command = `${libreOfficePath} --headless --invisible --nologo --nofirststartwizard --norestore ${userInstallArg} --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;

    console.log(`🔧 Executing LibreOffice conversion...`);

    const timeoutMs = 120000; // 2-minute timeout
    const { stdout, stderr } = await execPromise(command, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    if (stdout) {
      console.log('LibreOffice output:', stdout.trim());
    }
    if (stderr && stderr.trim()) {
      console.warn('LibreOffice stderr:', stderr.trim());
    }

    const pdfPath = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not found.');
    }

    const pdfStats = fs.statSync(pdfPath);
    console.log(`✅ PDF created: ${path.basename(pdfPath)} (${pdfStats.size} bytes)`);

    // REASON: Clean up the temporary profile directory after conversion.
    // WHY: Prevents the server's disk space from filling up with temporary profile data.
    if (tempUserProfile && fs.existsSync(tempUserProfile)) {
      fs.rmSync(tempUserProfile, { recursive: true, force: true });
      tempUserProfile = null;
    }

    if (returnBuffer) {
      const pdfBuffer = fs.readFileSync(pdfPath);
      return { success: true, pdfPath, pdfBuffer };
    }

    return { success: true, pdfPath };

  } catch (error: any) {
    console.error('❌ LibreOffice conversion error:', error.message);

    // Clean up temp profile on error
    if (tempUserProfile && fs.existsSync(tempUserProfile)) {
      try {
        fs.rmSync(tempUserProfile, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('⚠️  Failed to cleanup temp profile:', cleanupError);
      }
    }

    // Provide more helpful error messages
    if (error.message.includes('ENOENT') || error.message.includes('not found')) {
      return {
        success: false,
        error: 'LibreOffice is not installed or not in PATH. Please install LibreOffice.',
      };
    }

    if (error.killed && error.signal === 'SIGTERM') {
      return {
        success: false,
        error: 'LibreOffice conversion timeout (120 seconds exceeded)',
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

// REASON: Create convenience wrappers for backward compatibility and clarity.
// WHY: This avoids breaking existing code that calls convertDocxToPdf and provides
//      a clear, semantic function for PPTX conversion.
export const convertDocxToPdf = async (
  docxPath: string,
  outputDir?: string
): Promise<ConversionResult> => {
  return convertOfficeToPdf(docxPath, outputDir, false);
};

export const convertPptxToPdf = async (
  pptxPath: string,
  outputDir?: string
): Promise<ConversionResult> => {
  return convertOfficeToPdf(pptxPath, outputDir, false);
};

/**
 * Check if LibreOffice is installed and available
 */
export const checkLibreOfficeInstalled = async (): Promise<boolean> => {
  try {
    const libreOfficePath = findLibreOfficePath();
    const { stdout } = await execPromise(`${libreOfficePath} --version`, {
      timeout: 5000
    });
    console.log('✅ LibreOffice found:', stdout.trim());
    return true;
  } catch (error: any) {
    console.error('❌ LibreOffice not found:', error.message);
    return false;
  }
};
