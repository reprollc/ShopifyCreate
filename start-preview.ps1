# Starts the local Shopify theme preview for RELU ARCHIVE.
# Double-click start-preview.bat to run this script.
Set-Location -Path $PSScriptRoot
$store = 'xhnadb-ug.myshopify.com'
$passwordFile = Join-Path $PSScriptRoot '.store-password'

Write-Host ''
Write-Host '[1/2] Getting the latest theme from GitHub (git pull)...' -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) {
  Write-Host 'git pull failed. The preview will use the files already on this PC.' -ForegroundColor Yellow
}

if (Test-Path $passwordFile) {
  $password = (Get-Content -Path $passwordFile -Raw).Trim()
} else {
  Write-Host ''
  Write-Host 'Store password = Online Store > Preferences > Password protection (not your login password).'
  $password = Read-Host 'Store password'
  $save = Read-Host 'Save it on this PC so you do not need to type it next time? (y/n)'
  if ($save -eq 'y') { Set-Content -Path $passwordFile -Value $password -NoNewline }
}

Write-Host ''
Write-Host '[2/2] Starting the preview. When "success" appears, press t to open it in the browser.' -ForegroundColor Cyan
Write-Host 'To stop: press Ctrl + C.'
shopify theme dev --store $store --store-password $password

if (Test-Path $passwordFile) {
  Write-Host ''
  Write-Host 'If the store password was wrong, delete the file ".store-password" in this folder and run again.' -ForegroundColor Yellow
}
