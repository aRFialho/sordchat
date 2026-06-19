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
    [System.Drawing.ColorTranslator]::FromHtml("#0F172A"),
    [System.Drawing.ColorTranslator]::FromHtml("#0F766E"),
    60
  )
  $graphics.FillRectangle($background, 0, 0, 164, 314)

  $graphics.FillEllipse((New-Brush "#2DD4BF"), 95, -34, 112, 112)
  $graphics.FillEllipse((New-Brush "#2563EB"), -46, 228, 132, 132)
  $graphics.FillRectangle((New-Brush "#FFFFFF"), 28, 42, 108, 82)
  $graphics.FillRectangle((New-Brush "#FFFFFF"), 50, 112, 26, 30)
  $graphics.FillRectangle((New-Brush "#0F172A"), 42, 58, 80, 10)
  $graphics.FillRectangle((New-Brush "#0F766E"), 42, 78, 58, 10)
  $graphics.FillEllipse((New-Brush "#0F172A"), 108, 96, 18, 18)

  $titleFont = [System.Drawing.Font]::new("Segoe UI", 17, [System.Drawing.FontStyle]::Bold)
  $smallFont = [System.Drawing.Font]::new("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
  $graphics.DrawString("SorDChat", $titleFont, (New-Brush "#F8FAFC"), 18, 172)
  $graphics.DrawString("Instalador`ninterno", $smallFont, (New-Brush "#CCFBF1"), 20, 214)
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
  $graphics.FillEllipse((New-Brush "#2DD4BF"), 92, -26, 82, 82)
  $graphics.FillEllipse((New-Brush "#2563EB"), 115, 28, 46, 46)
  $graphics.FillRectangle((New-Brush "#0F172A"), 12, 12, 32, 24)
  $graphics.FillRectangle((New-Brush "#0F172A"), 20, 34, 8, 10)
  $graphics.FillRectangle((New-Brush "#2DD4BF"), 18, 19, 20, 4)
  $graphics.FillRectangle((New-Brush "#F8FAFC"), 18, 27, 14, 4)

  $font = [System.Drawing.Font]::new("Segoe UI", 10.5, [System.Drawing.FontStyle]::Bold)
  $graphics.DrawString("SorDChat", $font, (New-Brush "#0F172A"), 52, 18)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-InstallerSidebar -Path (Join-Path $installerDirectory "sidebar.bmp")
Save-InstallerHeader -Path (Join-Path $installerDirectory "header.bmp")

Write-Host "Assets do instalador gerados em $installerDirectory"
