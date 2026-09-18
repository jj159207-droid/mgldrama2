$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "client-packages"
$stage = Join-Path $env:TEMP ("kino-client-" + [Guid]::NewGuid().ToString("N"))
$zip = Join-Path $outDir ("kino-site-client-" + $stamp + ".zip")

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$excludeDirs = @(".git", ".next", "node_modules", ".vercel", "client-packages", "coverage", "poster-backups")
$excludeFiles = @(".env.local", ".env.production", ".env.development", ".env", "*.log", "*.pem", "*.tsbuildinfo")

try {
  $args = @($root, $stage, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
  foreach ($d in $excludeDirs) { $args += @("/XD", (Join-Path $root $d)) }
  foreach ($f in $excludeFiles) { $args += @("/XF", $f) }

  & robocopy @args | Out-Null
  $code = $LASTEXITCODE
  if ($code -ge 8) { throw "robocopy failed with code $code" }

  if (Test-Path (Join-Path $stage ".env.client.example")) {
    Copy-Item (Join-Path $stage ".env.client.example") (Join-Path $stage ".env.example") -Force
  }

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal -Force
  Write-Host ""
  Write-Host "CLEAN CLIENT ZIP READY:" -ForegroundColor Green
  Write-Host $zip -ForegroundColor White
  Write-Host ""
  Write-Host "Excluded: .env secrets, node_modules, .next, .git, .vercel, local logs." -ForegroundColor Yellow
} finally {
  if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
}
