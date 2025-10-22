# Script to install ImageMagick using the Windows installer
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-imagemagick-installer.ps1

Write-Host "Downloading ImageMagick installer..." -ForegroundColor Cyan
Write-Host ""

# Download ImageMagick Windows installer
$url = "https://imagemagick.org/archive/binaries/ImageMagick-7.1.2-7-Q16-HDRI-x64-dll.exe"
$output = "$env:TEMP\imagemagick-installer.exe"

try {
    # Download
    Write-Host "Downloading from: $url" -ForegroundColor Gray
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "[OK] Downloaded ImageMagick installer" -ForegroundColor Green
    Write-Host ""

    # Run installer silently
    Write-Host "Installing ImageMagick..." -ForegroundColor Cyan
    Write-Host "(This may take a minute...)" -ForegroundColor Gray

    # Silent install with all features
    $process = Start-Process -FilePath $output -ArgumentList "/VERYSILENT", "/NORESTART", "/DIR=C:\Program Files\ImageMagick", "/TASKS=addtopath" -Wait -PassThru

    if ($process.ExitCode -eq 0) {
        Write-Host "[OK] Installation completed" -ForegroundColor Green
        Write-Host ""

        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        # Test installation
        Write-Host "Testing installation..." -ForegroundColor Cyan
        Start-Sleep -Seconds 2  # Give PATH update a moment

        try {
            $version = & "magick" -version 2>&1 | Select-Object -First 1
            Write-Host "[OK] $version" -ForegroundColor Green
        } catch {
            $magickPath = "C:\Program Files\ImageMagick\magick.exe"
            if (Test-Path $magickPath) {
                $version = & $magickPath -version 2>&1 | Select-Object -First 1
                Write-Host "[OK] $version" -ForegroundColor Green
            } else {
                Write-Host "[WARN] Could not verify installation - please restart your terminal" -ForegroundColor Yellow
            }
        }

        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Gray
        Write-Host "[SUCCESS] ImageMagick installed successfully!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Installed at: C:\Program Files\ImageMagick" -ForegroundColor Gray
        Write-Host "   Command: magick" -ForegroundColor Gray
        Write-Host ""
        Write-Host "[IMPORTANT] Please restart your terminal/IDE for PATH changes to take effect" -ForegroundColor Yellow
        Write-Host ""

    } else {
        Write-Host "[ERROR] Installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
        exit 1
    }

    # Cleanup
    Remove-Item $output -ErrorAction SilentlyContinue

} catch {
    Write-Host "[ERROR] Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install manually from: https://imagemagick.org/script/download.php" -ForegroundColor Yellow
    exit 1
}
