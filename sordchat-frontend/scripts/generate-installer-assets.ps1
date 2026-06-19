$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$frontendRoot = Split-Path -Parent $PSScriptRoot
$installerDirectory = Join-Path $frontendRoot "electron\installer"
$logoPath = Join-Path $frontendRoot "public\brand\ICO.jpeg"
$iconPath = Join-Path $frontendRoot "public\brand\LOGO.jpeg"
New-Item -ItemType Directory -Path $installerDirectory -Force | Out-Null

function New-Brush {
  param([string]$Hex)
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function Draw-ContainedImage {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$ImagePath,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height
  )

  $image = [System.Drawing.Image]::FromFile($ImagePath)
  try {
    $scale = [Math]::Min($Width / $image.Width, $Height / $image.Height)
    $drawWidth = $image.Width * $scale
    $drawHeight = $image.Height * $scale
    $drawX = $X + (($Width - $drawWidth) / 2)
    $drawY = $Y + (($Height - $drawHeight) / 2)
    $Graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
  } finally {
    $image.Dispose()
  }
}

function Save-InstallerSidebar {
  param([string]$Path)

  $bitmap = [System.Drawing.Bitmap]::new(164, 314)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $graphics.Clear([System.Drawing.Color]::White)
  Draw-ContainedImage -Graphics $graphics -ImagePath $iconPath -X 20 -Y 34 -Width 124 -Height 124
  Draw-ContainedImage -Graphics $graphics -ImagePath $logoPath -X 10 -Y 165 -Width 144 -Height 58

  $smallFont = [System.Drawing.Font]::new("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
  $graphics.DrawString("Instalador interno", $smallFont, (New-Brush "#64748B"), 30, 238)
  $graphics.DrawString("Volt Corp", $smallFont, (New-Brush "#0F172A"), 50, 258)
  $smallFont.Dispose()

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-InstallerHeader {
  param([string]$Path)

  $bitmap = [System.Drawing.Bitmap]::new(150, 57)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $graphics.Clear([System.Drawing.Color]::White)
  Draw-ContainedImage -Graphics $graphics -ImagePath $logoPath -X 8 -Y 6 -Width 134 -Height 45

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-InstallerSidebar -Path (Join-Path $installerDirectory "sidebar.bmp")
Save-InstallerHeader -Path (Join-Path $installerDirectory "header.bmp")

Write-Host "Assets do instalador gerados com a logo oficial em $installerDirectory"
