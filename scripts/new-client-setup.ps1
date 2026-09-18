$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Ask([string]$Label, [string]$Default = "") {
  if ($Default) {
    $v = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($v)) { return $Default }
    return $v.Trim()
  }
  while ($true) {
    $v = Read-Host $Label
    if (-not [string]::IsNullOrWhiteSpace($v)) { return $v.Trim() }
    Write-Host "Hooson baij bolohgui." -ForegroundColor Yellow
  }
}

function Read-Secret([string]$Label) {
  $secure = Read-Host $Label -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function New-Token([int]$Bytes = 24) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Fill($b)
  return ([Convert]::ToBase64String($b)).TrimEnd("=").Replace("+","-").Replace("/","_")
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  KINO SITE - SHINE CLIENT SETUP" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Client buriin nuuts, ner, dans tusdaa uusne."
Write-Host "Urd clientiin .env.local file-iig hezee ch huulj ashiglahgui." -ForegroundColor Yellow
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js oldsongui. Node.js 22 esvel 24 LTS suulgana uu."
}
$nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
if ($nodeMajor -ne 22 -and $nodeMajor -ne 24) {
  throw "Node.js 22 esvel 24 shaardlagatai. Odoogiin version: $(node -v)"
}

$siteName = Ask "1/10 Saitiin ner" "KINO SITE"
$shortName = Ask "2/10 Bogino ner" $siteName
$description = Ask "3/10 Saitiin tovch tailbar" "Монгол, гадаад, хятад кино үзэх сайт."
$siteUrl = Ask "4/10 HTTPS domain (jishee https://kino.mn)"
$supabaseUrl = Ask "5/10 Supabase Project URL"
$supabaseKey = Read-Secret "6/10 Supabase service_role / sb_secret key"
$bankName = Ask "7/10 Banknii ner" "Хаан банк"
$bankAccount = Ask "8/10 DANSNII DUGAAR"
$bankOwner = Ask "9/10 Dans ezemshigchiin ner"
$messenger = Read-Host "10/10 Messenger HTTPS link (zaaval bish)"

$adminPassword = New-Token 24
$enableSms = (Read-Host "SMS automatic batalgaa ashiglah uu? (y/N)").Trim().ToLower() -eq "y"
$smsSecret = ""
$smsSender = ""
if ($enableSms) {
  $smsSecret = New-Token 32
  $smsSender = Ask "Banknii SMS ilgeegchiin ner/dugaar (yag taarna)"
}

$lines = @(
  "NEXT_PUBLIC_SITE_NAME=$siteName",
  "NEXT_PUBLIC_SITE_SHORT_NAME=$shortName",
  "NEXT_PUBLIC_SITE_DESCRIPTION=$description",
  "SITE_URL=$siteUrl",
  "SUPABASE_URL=$supabaseUrl",
  "SUPABASE_SERVICE_ROLE_KEY=$supabaseKey",
  "SUPABASE_SECRET_KEY=",
  "ADMIN_PASSWORD=$adminPassword",
  "BANK_NAME=$bankName",
  "BANK_ACCOUNT=$bankAccount",
  "BANK_ACCOUNT_NAME=$bankOwner",
  "MESSENGER_URL=$messenger",
  "SMS_WEBHOOK_SECRET=$smsSecret",
  "SMS_ALLOWED_SENDER=$smsSender"
)

Set-Content -LiteralPath ".env.local" -Value $lines -Encoding utf8

Write-Host ""
Write-Host ".env.local uuslee." -ForegroundColor Green
Write-Host "ADMIN PASSWORD (ene clientiinх):" -ForegroundColor Yellow
Write-Host $adminPassword -ForegroundColor White
try {
  Set-Clipboard $adminPassword
  Write-Host "Admin password clipboard-d huulagdsan." -ForegroundColor Green
} catch {}
if ($enableSms) {
  Write-Host "SMS WEBHOOK SECRET:" -ForegroundColor Yellow
  Write-Host $smsSecret
}

Write-Host ""
Write-Host "Package suulgaj shalgaj baina..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install amjiltgui." }

npm run client:check
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Client check deer zasah yum baina. .env.local-iig zasaarai." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "LOCAL TEST: npm run dev" -ForegroundColor Cyan
Write-Host "DATABASE: Supabase SQL Editor deer supabase/CLIENT-FRESH-INSTALL.sql-iig NEG UDAA run hiine." -ForegroundColor Cyan
Write-Host "DEPLOY: Vercel environment variables-d .env.local-iin utguudiig oruulna." -ForegroundColor Cyan
Write-Host "NUUTS: .env.local-iig ZIP/GitHub/chat ruu hezee ch bitgii yavuul." -ForegroundColor Yellow
