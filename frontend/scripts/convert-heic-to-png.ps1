<#
 HEIC（拡張子が .png や .webp でも、中身が HEIC のもの）を PNG に変換する（Windows の画像機能を使用）。
 使い方:  powershell -File scripts/convert-heic-to-png.ps1 -InputDir <変換元フォルダ> -OutputDir <出力先フォルダ>
 中身が PNG/JPEG/WebP の通常の画像は、そのままコピーする。
#>
param(
  [Parameter(Mandatory = $true)][string]$InputDir,
  [Parameter(Mandatory = $true)][string]$OutputDir
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$asTaskOp = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAct = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Await($op, $type) { $t = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AwaitAction($op) { $t = $asTaskAct.Invoke($null, @($op)); $t.Wait(-1) | Out-Null }

New-Item -ItemType Directory -Force $OutputDir | Out-Null
foreach ($f in Get-ChildItem $InputDir -File) {
  $head = [System.IO.File]::ReadAllBytes($f.FullName)[0..11]
  $isHeif = ([System.Text.Encoding]::ASCII.GetString($head[4..7]) -eq 'ftyp')
  $dst = Join-Path $OutputDir (([IO.Path]::GetFileNameWithoutExtension($f.Name)) + '.png')
  if (-not $isHeif) { Copy-Item $f.FullName $dst -Force; "$($f.Name): コピー（HEICではない）"; continue }
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    if (Test-Path $dst) { Remove-Item $dst -Force }
    $null = New-Item -ItemType File -Force $dst
    $outFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $dst).Path)) ([Windows.Storage.StorageFile])
    $os = Await ($outFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
    $enc = Await ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::PngEncoderId, $os)) ([Windows.Graphics.Imaging.BitmapEncoder])
    $enc.SetSoftwareBitmap($bmp)
    AwaitAction ($enc.FlushAsync())
    $os.Dispose(); $stream.Dispose()
    "$($f.Name): $($dec.PixelWidth)x$($dec.PixelHeight) -> $([IO.Path]::GetFileName($dst))"
  } catch { "$($f.Name): 失敗 $($_.Exception.Message)" }
}
