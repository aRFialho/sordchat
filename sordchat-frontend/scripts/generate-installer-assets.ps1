$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$frontendRoot = Split-Path -Parent $PSScriptRoot
$installerDirectory = Join-Path $frontendRoot "electron\installer"
New-Item -ItemType Directory -Path $installerDirectory -Force | Out-Null

function New-Brush {
  param([string]$Hex)
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function New-Pen {
  param(
    [string]$Hex,
    [float]$Width = 1
  )
  return [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Hex), $Width)
}

function Save-InstallerSidebar {
  param([string]$Path)

  $bitmap = [System.Drawing.Bitmap]::new(164, 314)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 164, 314),
    [System.Drawing.ColorTranslator]::FromHtml("#061A45"),
    [System.Drawing.ColorTranslator]::FromHtml("#0A84FF"),
    60
  )
  $graphics.FillRectangle($background, 0, 0, 164, 314)

  $graphics.FillEllipse((New-Brush "#0A84FF"), 94, -28, 110, 110)
  $graphics.FillEllipse((New-Brush "#061A45"), -48, 228, 132, 132)
  $graphics.FillPolygon((New-Brush "#FFFFFF"), @(
    [System.Drawing.Point]::new(42, 42),
    [System.Drawing.Point]::new(78, 42),
    [System.Drawing.Point]::new(94, 108),
    [System.Drawing.Point]::new(72, 108)
  ))
  $graphics.FillPolygon((New-Brush "#FFFFFF"), @(
    [System.Drawing.Point]::new(122, 42),
    [System.Drawing.Point]::new(86, 42),
    [System.Drawing.Point]::new(70, 108),
    [System.Drawing.Point]::new(92, 108)
  ))
  $graphics.FillPolygon((New-Brush "#061A45"), @(
    [System.Drawing.Point]::new(83, 80),
    [System.Drawing.Point]::new(105, 80),
    [System.Drawing.Point]::new(78, 132),
    [System.Drawing.Point]::new(88, 96),
    [System.Drawing.Point]::new(66, 96)
  ))

  $titleFont = [System.Drawing.Font]::new("Segoe UI", 17, [System.Drawing.FontStyle]::Bold)
  $smallFont = [System.Drawing.Font]::new("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
  $graphics.DrawString("Volt Corp", $titleFont, (New-Brush "#F8FAFC"), 18, 172)
  $graphics.DrawString("Instalador`ninterno", $smallFont, (New-Brush "#DBEAFE"), 20, 214)
  $graphics.DrawString("Seguro para`na equipe", $smallFont, (New-Brush "#DBEAFE"), 20, 258)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-InstallerHeader {
  param([string]$Path)

  $bitmap = [System.Drawing.Bitmap]::new(150, 57)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.FillEllipse((New-Brush "#0A84FF"), 92, -26, 82, 82)
  $graphics.FillEllipse((New-Brush "#061A45"), 115, 28, 46, 46)
  $graphics.FillPolygon((New-Brush "#061A45"), @(
    [System.Drawing.Point]::new(12, 11),
    [System.Drawing.Point]::new(32, 11),
    [System.Drawing.Point]::new(42, 43),
    [System.Drawing.Point]::new(26, 43)
  ))
  $graphics.FillPolygon((New-Brush "#0A84FF"), @(
    [System.Drawing.Point]::new(46, 11),
    [System.Drawing.Point]::new(68, 11),
    [System.Drawing.Point]::new(50, 46),
    [System.Drawing.Point]::new(34, 46)
  ))

  $font = [System.Drawing.Font]::new("Segoe UI", 10.5, [System.Drawing.FontStyle]::Bold)
  $graphics.DrawString("Volt Corp", $font, (New-Brush "#0F172A"), 52, 18)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-InstallerSidebar -Path (Join-Path $installerDirectory "sidebar.bmp")
Save-InstallerHeader -Path (Join-Path $installerDirectory "header.bmp")

Write-Host "Assets do instalador gerados em $installerDirectory"
