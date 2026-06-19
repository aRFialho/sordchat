param(
  [string]$CertificatePath = ""
)

$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path -Parent $PSScriptRoot
$certificateName = "SorDChat-Internal-Code-Signing.cer"

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Add-CertificateToStoreIfMissing {
  param(
    [string]$ResolvedCertificatePath,
    [string]$StoreName,
    [string]$Thumbprint,
    [switch]$CurrentUser
  )

  $storePath = if ($CurrentUser) { "Cert:\CurrentUser\$StoreName" } else { "Cert:\LocalMachine\$StoreName" }
  $existingCertificate = Get-ChildItem -Path $StorePath -ErrorAction SilentlyContinue |
    Where-Object { $_.Thumbprint -eq $Thumbprint } |
    Select-Object -First 1

  if ($existingCertificate) {
    Write-Host "Ja confiado em $StorePath"
    return
  }

  $certutilArguments = @()
  if ($CurrentUser) {
    $certutilArguments += "-user"
  }
  $certutilArguments += @("-addstore", "-f", $StoreName, $ResolvedCertificatePath)

  & "$env:SystemRoot\System32\certutil.exe" @certutilArguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao confiar o certificado em $storePath"
  }

  Write-Host "Confiado em $StorePath"
}

if (-not $CertificatePath) {
  $candidates = @(
    (Join-Path $PSScriptRoot $certificateName),
    (Join-Path $frontendRoot "electron\certificates\$certificateName"),
    (Join-Path $frontendRoot "dist-desktop\certificates\$certificateName")
  )

  $CertificatePath = $candidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}

if (-not $CertificatePath -or -not (Test-Path -LiteralPath $CertificatePath)) {
  throw "Certificado nao encontrado. Rode primeiro: npm run desktop:cert:setup"
}

$resolvedCertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path
$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($resolvedCertificatePath)

if (Test-IsAdministrator) {
  $stores = @("Root", "TrustedPublisher")
  $useCurrentUserStore = $false
  Write-Host "Instalando certificado para todos os usuarios desta maquina."
} else {
  $stores = @("TrustedPublisher")
  $useCurrentUserStore = $true
  Write-Warning "Sem administrador: sera registrado apenas TrustedPublisher do usuario atual."
  Write-Warning "Para confiar a raiz interna e validar completamente o .exe, rode este script como administrador."
}

foreach ($storeName in $stores) {
  Add-CertificateToStoreIfMissing `
    -ResolvedCertificatePath $resolvedCertificatePath `
    -StoreName $storeName `
    -Thumbprint $certificate.Thumbprint `
    -CurrentUser:$useCurrentUserStore
}

Write-Host "Certificado interno SorDChat instalado."
Write-Host "Subject: $($certificate.Subject)"
Write-Host "Thumbprint: $($certificate.Thumbprint)"
