# LibreOffice Installation Script
Write-Host "=================================="
Write-Host "LibreOffice Installation Script"
Write-Host "=================================="
Write-Host ""

# Download URL (latest stable version)
$url = "https://download.documentfoundation.org/libreoffice/stable/24.8.4/win/x86_64/LibreOffice_24.8.4_Win_x86-64.msi"
$output = "$env:TEMP\LibreOffice_Installer.msi"

Write-Host "Step 1: Downloading LibreOffice installer..."
Write-Host "URL: $url"
Write-Host ""

try {
    # Download the installer
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing

    $fileSize = (Get-Item $output).length / 1MB
    Write-Host "Download complete!"
    Write-Host "File: $output"
    Write-Host "Size: $($fileSize.ToString('0.00')) MB"
    Write-Host ""

} catch {
    Write-Host "Primary download failed, trying mirror..."
    $url = "https://ftp.acc.umu.se/mirror/libreoffice/stable/24.8.4/win/x86_64/LibreOffice_24.8.4_Win_x86-64.msi"
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "Download complete from mirror!"
    Write-Host ""
}

Write-Host "Step 2: Installing LibreOffice..."
Write-Host "This will open an installer window. Please follow the prompts."
Write-Host ""

# Install LibreOffice
$msiArgs = @(
    "/i"
    $output
    "/qb"
    "/norestart"
)

Start-Process "msiexec.exe" -ArgumentList $msiArgs -Wait -Verb RunAs

Write-Host ""
Write-Host "=================================="
Write-Host "Installation Complete!"
Write-Host "=================================="
Write-Host ""
Write-Host "LibreOffice has been installed to:"
Write-Host "C:\Program Files\LibreOffice\"
Write-Host ""
Write-Host "You can now run the test script:"
Write-Host "cd backend"
Write-Host "npx ts-node scripts/test-slide-generation.ts"
Write-Host ""
