# Simple ImageMagick Installation Script
# This installs to user directory (no admin required)

$downloadUrl = "https://imagemagick.org/archive/binaries/ImageMagick-7.1.2-7-portable-Q16-HDRI-x64.7z"
$installPath = "$env:USERPROFILE\ImageMagick"
$temp7z = "$env:TEMP\imagemagick.7z"

Write-Host "Installing ImageMagick to user directory..." -ForegroundColor Cyan
Write-Host ""

try {
    # Create install directory
    Write-Host "Creating installation directory: $installPath" -ForegroundColor Gray
    if (Test-Path $installPath) {
        Remove-Item $installPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null

    # Download
    Write-Host "Downloading ImageMagick..." -ForegroundColor Cyan
    Write-Host "  From: $downloadUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $downloadUrl -OutFile $temp7z -UseBasicParsing
    Write-Host "[OK] Downloaded" -ForegroundColor Green
    Write-Host ""

    # Extract 7z file
    Write-Host "Extracting files..." -ForegroundColor Cyan

    # Check if 7z is available
    $7zipPath = "C:\Program Files\7-Zip\7z.exe"
    if (Test-Path $7zipPath) {
        & $7zipPath x $temp7z "-o$installPath" -y | Out-Null
        Write-Host "[OK] Extracted with 7-Zip" -ForegroundColor Green
    } else {
        # Try using Expand-Archive (may not work with .7z)
        try {
            Expand-Archive -Path $temp7z -DestinationPath $installPath -Force
            Write-Host "[OK] Extracted" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Need 7-Zip to extract .7z file" -ForegroundColor Red
            Write-Host "  Install 7-Zip from: https://www.7-zip.org/" -ForegroundColor Yellow
            Write-Host "  Or download ZIP version from ImageMagick website" -ForegroundColor Yellow
            throw
        }
    }
    Write-Host ""

    # Add to user PATH
    Write-Host "Adding to PATH..." -ForegroundColor Cyan
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")

    if ($userPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
        $env:Path += ";$installPath"
        Write-Host "[OK] Added to user PATH" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Already in PATH" -ForegroundColor Yellow
    }

    # Cleanup
    Remove-Item $temp7z -ErrorAction SilentlyContinue
    Write-Host ""

    # Test
    Write-Host "Testing installation..." -ForegroundColor Cyan
    try {
        $version = & "$installPath\magick.exe" -version 2>&1 | Select-Object -First 1
        Write-Host "[SUCCESS] $version" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not test - try closing and reopening terminal" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host "[SUCCESS] ImageMagick installed!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Location: $installPath" -ForegroundColor Gray
    Write-Host "  Command: magick" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[IMPORTANT] Close and reopen your terminal for PATH changes" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next step: Run the slide regeneration script" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor Gray
    Write-Host "  npx ts-node scripts/regenerate-pptx-slides.ts" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "[ERROR] Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://imagemagick.org/script/download.php" -ForegroundColor Gray
    Write-Host "2. Extract to: $installPath" -ForegroundColor Gray
    Write-Host "3. Add to PATH manually" -ForegroundColor Gray
    exit 1
}
