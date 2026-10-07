$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $repositoryRoot ".tools"
$destination = Join-Path $toolsDirectory "cloudflared.exe"
$temporaryFile = Join-Path $env:TEMP "transport-copilot-cloudflared.exe"
$downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

New-Item -ItemType Directory -Force -Path $toolsDirectory | Out-Null

Write-Host "Descargando cloudflared desde la distribución oficial de Cloudflare..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $temporaryFile

$signature = Get-AuthenticodeSignature -FilePath $temporaryFile
if ($signature.Status -ne "Valid" -or $signature.SignerCertificate.Subject -notmatch "Cloudflare") {
  Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue
  throw "La firma Authenticode de cloudflared no es válida o no pertenece a Cloudflare."
}

Move-Item -LiteralPath $temporaryFile -Destination $destination -Force
Write-Host "cloudflared instalado localmente (ignorado por Git): $destination"
& $destination --version
