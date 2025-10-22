# Script to install ImageMagick for PDF rendering with proper font support
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-imagemagick.ps1

Write-Host "Downloading ImageMagick..." -ForegroundColor Cyan
Write-Host ""

# Download ImageMagick for Windows (portable version)
$url = "https://imagemagick.org/archive/binaries/ImageMagick-7.1.2-7-portable-Q16-x64.7z"
$output = "$env:TEMP\imagemagick.7z"
$extractPath = "C:\Program Files\ImageMagick"

try {
    # Download
    Write-Host "Downloading from: $url" -ForegroundColor Gray
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "[OK] Downloaded ImageMagick" -ForegroundColor Green
    Write-Host ""

    # Extract (requires 7-Zip or built-in support)
    Write-Host "Extracting to: $extractPath" -ForegroundColor Cyan
    if (Test-Path $extractPath) {
        Remove-Item $extractPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

    # Try using 7-Zip if available, otherwise download and use it
    $sevenZipPath = "C:\Program Files\7-Zip\7z.exe"
    if (-not (Test-Path $sevenZipPath)) {
        $sevenZipPath = "C:\Program Files (x86)\7-Zip\7z.exe"
    }

    if (Test-Path $sevenZipPath) {
        & $sevenZipPath x $output -o"$extractPath" -y | Out-Null
    } else {
        # Try using PowerShell's native support for .7z (Windows 10+)
        try {
            Expand-Archive -Path $output -DestinationPath $extractPath -Force
        } catch {
            Write-Host "[ERROR] 7-Zip not found. Please install 7-Zip or manually extract the file." -ForegroundColor Red
            Write-Host "Download 7-Zip from: https://www.7-zip.org/" -ForegroundColor Yellow
            exit 1
        }
    }

    Write-Host "[OK] Extracted" -ForegroundColor Green
    Write-Host ""

    # Add to PATH
    Write-Host "Adding to System PATH..." -ForegroundColor Cyan
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

    if ($currentPath -notlike "*$extractPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$extractPath", "Machine")
        $env:Path += ";$extractPath"
        Write-Host "[OK] Added to PATH: $extractPath" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Already in PATH" -ForegroundColor Yellow
    }

    # Cleanup
    Remove-Item $output
    Write-Host ""

    # Test installation
    Write-Host "Testing installation..." -ForegroundColor Cyan
    try {
        $version = & "$extractPath\magick.exe" -version 2>&1 | Select-Object -First 1
        Write-Host "[OK] $version" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not verify installation" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host "[SUCCESS] ImageMagick installed successfully!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Installed at: $extractPath" -ForegroundColor Gray
    Write-Host "   Command: magick" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[IMPORTANT] Please restart your terminal/IDE for PATH changes to take effect" -ForegroundColor Yellow
    Write-Host ""

} catch {
    Write-Host "[ERROR] Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install manually from: https://imagemagick.org/script/download.php" -ForegroundColor Yellow
    exit 1
}
