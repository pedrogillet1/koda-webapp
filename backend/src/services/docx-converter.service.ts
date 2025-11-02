import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Find LibreOffice executable path based on operating system
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
  error?: string;
}

/**
 * Convert DOCX file to PDF using LibreOffice headless mode
 * Requires LibreOffice to be installed on the system
 */
export const convertDocxToPdf = async (
  docxPath: string,
  outputDir?: string
): Promise<ConversionResult> => {
  try {
    // Use same directory if not specified
    if (!outputDir) {
      outputDir = path.dirname(docxPath);
    }

    console.log(`📄 Converting ${path.basename(docxPath)} to PDF with LibreOffice...`);

    // Verify input file exists
    if (!fs.existsSync(docxPath)) {
      throw new Error(`Input file not found: ${docxPath}`);
    }

    // Find LibreOffice executable
    const libreOfficePath = findLibreOfficePath();

    // Use LibreOffice to convert DOCX to PDF
    // --headless: run without GUI
    // --convert-to pdf: convert to PDF format
    // --outdir: specify output directory
    const command = `${libreOfficePath} --headless --convert-to pdf --outdir "${outputDir}" "${docxPath}"`;

    console.log(`🔧 Executing: ${command}`);

    // Execute LibreOffice with 60 second timeout
    const { stdout, stderr } = await execPromise(command, {
      timeout: 60000, // 60 seconds
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    if (stdout) {
      console.log('LibreOffice output:', stdout);
    }
    if (stderr) {
      console.warn('LibreOffice stderr:', stderr);
    }

    // Determine expected PDF path
    const fileName = path.basename(docxPath, path.extname(docxPath));
    const pdfPath = path.join(outputDir, `${fileName}.pdf`);

    // Check if PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF conversion failed - output file not found');
    }

    const stats = fs.statSync(pdfPath);
    console.log(`✅ PDF created: ${pdfPath} (${stats.size} bytes)`);

    return {
      success: true,
      pdfPath: pdfPath,
    };
  } catch (error: any) {
    console.error('❌ LibreOffice DOCX to PDF conversion error:', error.message);

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
        error: 'LibreOffice conversion timeout (60 seconds exceeded)',
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
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
