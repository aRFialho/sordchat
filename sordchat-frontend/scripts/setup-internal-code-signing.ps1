param(
  [string]$Subject = "CN=SorDChat Internal Code Signing",
  [int]$ValidYears = 3,
  [switch]$TrustForAllUsers
)

$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path -Parent $PSScriptRoot
$publicCertificateName = "SorDChat-Internal-Code-Signing.cer"
$sourceCertificateDirectory = Join-Path $frontendRoot "electron\certificates"
$distributionCertificateDirectory = Join-Path $frontendRoot "dist-desktop\certificates"
$publicCertificatePath = Join-Path $sourceCertificateDirectory $publicCertificateName
$distributionCertificatePath = Join-Path $distributionCertificateDirectory $publicCertificateName
$minimumExpiration = (Get-Date).AddDays(30)

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Add-CertificateToStoreIfMissing {
  param(
    [string]$CertificatePath,
    [string]$StoreName,
    [string]$Thumbprint,
    [switch]$CurrentUser
  )

  $storePath = if ($CurrentUser) { "Cert:\CurrentUser\$StoreName" } else { "Cert:\LocalMachine\$StoreName" }
  $alreadyTrusted = Get-ChildItem -Path $StorePath -ErrorAction SilentlyContinue |
    Where-Object { $_.Thumbprint -eq $Thumbprint } |
    Select-Object -First 1

  if (-not $alreadyTrusted) {
    $certutilArguments = @()
    if ($CurrentUser) {
      $certutilArguments += "-user"
    }
    $certutilArguments += @("-addstore", "-f", $StoreName, $CertificatePath)

    & "$env:SystemRoot\System32\certutil.exe" @certutilArguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao confiar o certificado em $storePath"
    }
  }
}

$certificate = Get-ChildItem -Path "Cert:\CurrentUser\My" |
  Where-Object {
    $_.Subject -eq $Subject -and
    $_.HasPrivateKey -and
    $_.NotAfter -gt $minimumExpiration
  } |
  Sort-Object -Property NotAfter -Descending |
  Select-Object -First 1

if (-not $certificate) {
  $certificate = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $Subject `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears($ValidYears)
}

New-Item -ItemType Directory -Path $sourceCertificateDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $distributionCertificateDirectory -Force | Out-Null
Export-Certificate -Cert $certificate -FilePath $publicCertificatePath -Force | Out-Null
Copy-Item -LiteralPath $publicCertificatePath -Destination $distributionCertificatePath -Force

Add-CertificateToStoreIfMissing `
  -CertificatePath $publicCertificatePath `
  -StoreName "TrustedPublisher" `
  -Thumbprint $certificate.Thumbprint `
  -CurrentUser

if ($TrustForAllUsers) {
  if (-not (Test-IsAdministrator)) {
    throw "Para confiar o certificado em LocalMachine, execute este script como administrador."
  }

  foreach ($storeName in @("Root", "TrustedPublisher")) {
    Add-CertificateToStoreIfMissing `
      -CertificatePath $publicCertificatePath `
      -StoreName $storeName `
      -Thumbprint $certificate.Thumbprint
  }
}

Write-Host "Certificado interno pronto."
Write-Host "Subject: $($certificate.Subject)"
Write-Host "Thumbprint: $($certificate.Thumbprint)"
Write-Host "Valido ate: $($certificate.NotAfter.ToString('yyyy-MM-dd'))"
Write-Host "Certificado publico do projeto: $publicCertificatePath"
Write-Host "Certificado para distribuicao: $distributionCertificatePath"
Write-Host "A chave privada fica somente no store Cert:\CurrentUser\My desta maquina."
Write-Host "Em outros dispositivos, instale o .cer em Root e TrustedPublisher antes ou durante a instalacao."
Write-Host "Para confiar em Root nesta maquina, rode scripts\install-internal-certificate.ps1 como administrador."
