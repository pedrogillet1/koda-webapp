# Script to install MuPDF mutool for PDF rendering
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-mutool.ps1

Write-Host "📥 Downloading MuPDF (mutool)..." -ForegroundColor Cyan

# Download MuPDF for Windows
$url = "https://mupdf.com/downloads/archive/mupdf-1.24.9-windows.zip"
$output = "$env:TEMP\mupdf.zip"
$extractPath = "C:\Program Files\MuPDF"

try {
    # Download
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "✅ Downloaded MuPDF" -ForegroundColor Green

    # Extract
    Write-Host "📦 Extracting..." -ForegroundColor Cyan
    Expand-Archive -Path $output -DestinationPath $extractPath -Force

    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $mupdfBinPath = "$extractPath\mupdf-1.24.9-windows"

    if ($currentPath -notlike "*$mupdfBinPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$mupdfBinPath", "Machine")
        Write-Host "✅ Added to PATH: $mupdfBinPath" -ForegroundColor Green
    }

    # Cleanup
    Remove-Item $output

    Write-Host ""
    Write-Host "✅ MuPDF installed successfully!" -ForegroundColor Green
    Write-Host "   Installed at: $mupdfBinPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  Please restart your terminal/IDE for PATH changes to take effect" -ForegroundColor Yellow

} catch {
    Write-Host "❌ Installation failed: $_" -ForegroundColor Red
    exit 1
}
