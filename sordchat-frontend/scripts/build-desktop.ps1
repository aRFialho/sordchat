param(
  [switch]$Directory
)

$ErrorActionPreference = "Stop"
$frontendRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Comando falhou: $Command $($Arguments -join ' ')"
  }
}

function Get-WindowsSignToolPath {
  $candidateRoots = @(
    "C:\Program Files (x86)\Windows Kits\10\bin",
    "C:\Program Files\Windows Kits\10\bin",
    "C:\Program Files (x86)\Windows Kits\10\App Certification Kit"
  )

  $candidates = foreach ($root in $candidateRoots) {
    if (Test-Path -LiteralPath $root) {
      Get-ChildItem -Path $root -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" -or $_.FullName -match "App Certification Kit\\signtool\.exe$" }
    }
  }

  return $candidates |
    Sort-Object -Property FullName -Descending |
    Select-Object -First 1
}

function Get-RceditPath {
  $bundledRceditPath = Join-Path $frontendRoot "electron\tools\rcedit-x64.exe"
  if (Test-Path -LiteralPath $bundledRceditPath) {
    return Get-Item -LiteralPath $bundledRceditPath
  }

  $candidateRoots = @(
    (Join-Path $env:LOCALAPPDATA "electron-builder\Cache\winCodeSign"),
    (Join-Path $frontendRoot ".electron-builder-cache\winCodeSign")
  )

  $candidates = foreach ($root in $candidateRoots) {
    if (Test-Path -LiteralPath $root) {
      Get-ChildItem -Path $root -Recurse -Filter "rcedit-x64.exe" -ErrorAction SilentlyContinue
    }
  }

  return $candidates |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -First 1
}

function Invoke-EditExecutableResources {
  param(
    [string]$FilePath,
    [string]$RceditPath
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return
  }

  $iconPath = Join-Path $frontendRoot "electron\assets\icon.ico"
  Write-Host "Aplicando icone e metadados em $FilePath"

  $resourceArguments = @(
    $FilePath,
    "--set-icon", $iconPath,
    "--set-version-string", "FileDescription", "Volt Corp web and desktop client",
    "--set-version-string", "ProductName", "Volt Corp",
    "--set-version-string", "CompanyName", "Volt Corp",
    "--set-version-string", "InternalName", "Volt Corp",
    "--set-version-string", "OriginalFilename", "Volt Corp.exe",
    "--set-file-version", "0.1.0",
    "--set-product-version", "0.1.0"
  )

  & $RceditPath @resourceArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar icone/metadados em $FilePath"
  }
}

function Invoke-SignFile {
  param(
    [string]$FilePath,
    [string]$SignToolPath,
    [string]$Thumbprint
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return
  }

  Write-Host "Assinando $FilePath"
  $signArguments = @(
    "sign",
    "/sha1", $Thumbprint,
    "/fd", "sha256",
    "/tr", "http://timestamp.digicert.com",
    "/td", "sha256",
    "/d", "Volt Corp",
    "/debug",
    $FilePath
  )

  & $SignToolPath @signArguments
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Falha ao assinar com timestamp. Tentando assinatura local sem timestamp..."
    $fallbackArguments = @(
      "sign",
      "/sha1", $Thumbprint,
      "/fd", "sha256",
      "/d", "Volt Corp",
      "/debug",
      $FilePath
    )

    & $SignToolPath @fallbackArguments
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao assinar $FilePath"
    }
  }
}

Set-Location $frontendRoot

& (Join-Path $PSScriptRoot "setup-internal-code-signing.ps1")
& (Join-Path $PSScriptRoot "generate-installer-assets.ps1")

$publicCertificatePath = Join-Path $frontendRoot "electron\certificates\VoltCorp-Internal-Code-Signing.cer"
$publicCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($publicCertificatePath)
$env:VOLTCORP_SIGN_CERT_SHA1 = $publicCertificate.Thumbprint
$env:VOLTCORP_SIGN_CERT_SUBJECT = "Volt Corp Internal Code Signing"
Write-Host "Usando certificado Volt Corp thumbprint=$($publicCertificate.Thumbprint)"

$npm = (Get-Command "npm.cmd" -ErrorAction Stop).Source
Invoke-Checked -Command $npm -Arguments @("run", "build")

$signTool = Get-WindowsSignToolPath
if ($signTool) {
  $env:SIGNTOOL_PATH = $signTool.FullName
  Write-Host "Usando SIGNTOOL_PATH=$($signTool.FullName)"
} else {
  throw "signtool.exe do Windows SDK nao foi encontrado. Instale o Windows SDK ou defina SIGNTOOL_PATH."
}

$rcedit = Get-RceditPath
if ($rcedit) {
  Write-Host "Usando RCEDIT=$($rcedit.FullName)"
} else {
  throw "rcedit-x64.exe nao foi encontrado no cache do electron-builder. Gere uma vez com electron-builder ou habilite Developer Mode para popular o cache."
}

$electronBuilder = Join-Path $frontendRoot "node_modules\.bin\electron-builder.cmd"
$winUnpackedDirectory = Join-Path $frontendRoot "dist-desktop\win-unpacked"

Invoke-Checked -Command $electronBuilder -Arguments @("--dir")

$mainExecutable = Join-Path $winUnpackedDirectory "Volt Corp.exe"
Invoke-EditExecutableResources -FilePath $mainExecutable -RceditPath $rcedit.FullName

Get-ChildItem -Path $winUnpackedDirectory -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Invoke-SignFile -FilePath $_.FullName -SignToolPath $env:SIGNTOOL_PATH -Thumbprint $env:VOLTCORP_SIGN_CERT_SHA1
  }

if ($Directory) {
  exit 0
}

Invoke-Checked -Command $electronBuilder -Arguments @("--prepackaged", $winUnpackedDirectory)

Get-ChildItem -Path (Join-Path $frontendRoot "dist-desktop") -Filter "Volt-Corp-Setup-*.exe" -ErrorAction SilentlyContinue |
  Sort-Object -Property LastWriteTime -Descending |
  Select-Object -First 1 |
  ForEach-Object {
    Invoke-SignFile -FilePath $_.FullName -SignToolPath $env:SIGNTOOL_PATH -Thumbprint $env:VOLTCORP_SIGN_CERT_SHA1
  }
