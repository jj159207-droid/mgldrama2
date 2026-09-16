$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $OutputEncoding = [Console]::OutputEncoding
} catch {}

$MasterRoot = Split-Path -Parent $PSScriptRoot
$ClientRoot = 'C:\TAZA-CLIENTS'

function Write-Step([string]$Text) {
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
  Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
  Write-Host "[АНХААР] $Text" -ForegroundColor Yellow
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function New-HexSecret([int]$Bytes = 24) {
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return ([System.BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}

function Normalize-Slug([string]$Value) {
  $s = ($Value.ToLowerInvariant() -replace '[^a-z0-9._-]+','-').Trim('-','.')
  $s = $s -replace '-+','-'
  if ([string]::IsNullOrWhiteSpace($s)) { $s = 'taza-site-client' }
  if ($s.Length -gt 80) { $s = $s.Substring(0,80).TrimEnd('-','.') }
  return $s
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path','Machine')
  $user = [Environment]::GetEnvironmentVariable('Path','User')
  $env:Path = "$machine;$user"
}

function Ensure-WingetTool([string]$Command, [string]$PackageId, [string]$DisplayName) {
  if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "$DisplayName суулгах шаардлагатай боловч Windows Package Manager (winget) олдсонгүй. Windows App Installer-аа шинэчлээд дахин ажиллуулна уу."
  }
  Write-Step "$DisplayName суулгаж байна"
  & winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "$DisplayName автоматаар суусангүй." }
  Refresh-Path
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { throw "$DisplayName суусан боловч энэ цонхноос харагдсангүй. Компьютерээ restart хийгээд START-HERE.cmd-г дахин ажиллуулна уу." }
}

function Invoke-Capture([string]$Command, [string[]]$Arguments, [string]$Label, [switch]$AllowFail) {
  $lines = & $Command @Arguments 2>&1
  $code = $LASTEXITCODE
  $text = ($lines | ForEach-Object { "$_" }) -join "`n"
  if ($code -ne 0 -and -not $AllowFail) {
    throw "$Label амжилтгүй.`n$text"
  }
  return [pscustomobject]@{ Code=$code; Text=$text }
}

function Parse-LooseJson([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  try { return ($Text | ConvertFrom-Json) } catch {}
  $lines = $Text -split "`r?`n"
  for ($i=0; $i -lt $lines.Count; $i++) {
    $trim = $lines[$i].TrimStart()
    if ($trim.StartsWith('{') -or $trim.StartsWith('[')) {
      $candidate = ($lines[$i..($lines.Count-1)] -join "`n")
      try { return ($candidate | ConvertFrom-Json) } catch {}
    }
  }
  throw "CLI-ийн JSON хариуг уншиж чадсангүй."
}

function Show-Wizard {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'TAZA SITE MASTER — Шинэ харилцагч'
  $form.StartPosition = 'CenterScreen'
  $form.Size = New-Object System.Drawing.Size(620,650)
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.Font = New-Object System.Drawing.Font('Segoe UI',10)

  $title = New-Object System.Windows.Forms.Label
  $title.Text = 'Шинэ сайтыг тусдаа GitHub + Supabase + Vercel + MacroDroid-оор үүсгэнэ.'
  $title.AutoSize = $false; $title.Size = New-Object System.Drawing.Size(570,45); $title.Location = New-Object System.Drawing.Point(20,15)
  $form.Controls.Add($title)

  function Add-Field([string]$Label,[int]$Y,[string]$Default='',[bool]$Password=$false) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text=$Label; $l.Location=New-Object System.Drawing.Point(20,$Y); $l.Size=New-Object System.Drawing.Size(210,24)
    $form.Controls.Add($l)
    $t = New-Object System.Windows.Forms.TextBox
    $t.Text=$Default; $t.Location=New-Object System.Drawing.Point(235,$Y-2); $t.Size=New-Object System.Drawing.Size(340,28)
    if($Password){$t.UseSystemPasswordChar=$true}
    $form.Controls.Add($t)
    return $t
  }

  $site = Add-Field 'Сайтын нэр' 75 'ТАЗА САЙТ'
  $repo = Add-Field 'GitHub / төслийн нэр' 120 'taza-site-client'
  $bank = Add-Field 'Банкны нэр' 165 'Хаан банк'
  $owner = Add-Field 'Данс эзэмшигч' 210 ''
  $account = Add-Field 'Дансны дугаар' 255 ''
  $sender = Add-Field 'Банкны SMS илгээгч' 300 'Khan Bank'
  $messenger = Add-Field 'Messenger холбоос (заавал биш)' 345 ''
  $domain = Add-Field 'Өөрийн домэйн (заавал биш)' 390 ''
  $admin = Add-Field 'Админ нууц (хоосон = автоматаар)' 435 '' $true

  $note = New-Object System.Windows.Forms.Label
  $note.Text = 'Нууц түлхүүрүүдийг энэ суулгац шинэ клиент бүрт шинээр үүсгэнэ. Манай production сайтын нууц энд ашиглагдахгүй.'
  $note.Location=New-Object System.Drawing.Point(20,480); $note.Size=New-Object System.Drawing.Size(555,48)
  $form.Controls.Add($note)

  $errorLabel = New-Object System.Windows.Forms.Label
  $errorLabel.ForeColor = [System.Drawing.Color]::Firebrick
  $errorLabel.Location=New-Object System.Drawing.Point(20,525); $errorLabel.Size=New-Object System.Drawing.Size(555,35)
  $form.Controls.Add($errorLabel)

  $go = New-Object System.Windows.Forms.Button
  $go.Text='Суулгалтыг эхлүүлэх'; $go.Location=New-Object System.Drawing.Point(360,565); $go.Size=New-Object System.Drawing.Size(215,38)
  $form.Controls.Add($go)
  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text='Болих'; $cancel.Location=New-Object System.Drawing.Point(245,565); $cancel.Size=New-Object System.Drawing.Size(100,38)
  $form.Controls.Add($cancel)

  $script:WizardResult=$null
  $cancel.Add_Click({$form.Close()})
  $go.Add_Click({
    $siteName=$site.Text.Trim(); $repoName=Normalize-Slug $repo.Text
    if($siteName.Length -lt 2 -or $siteName -match '[<>"''`$]'){$errorLabel.Text='Сайтын нэрээ зөв оруулна уу.';return}
    if($owner.Text.Trim().Length -lt 2){$errorLabel.Text='Данс эзэмшигчийн нэрийг оруулна уу.';return}
    if($account.Text.Trim() -notmatch '^[A-Za-z0-9 -]{6,40}$'){$errorLabel.Text='Дансны дугаар 6–40 тэмдэгт байна.';return}
    if($sender.Text.Trim().Length -lt 2){$errorLabel.Text='Банкны SMS илгээгчийг оруулна уу.';return}
    if($admin.Text.Length -gt 0 -and $admin.Text.Length -lt 16){$errorLabel.Text='Админ нууц 16+ тэмдэгт эсвэл хоосон байна.';return}
    if($messenger.Text.Trim() -and $messenger.Text.Trim() -notmatch '^https://'){$errorLabel.Text='Messenger холбоос https:// гэж эхэлнэ.';return}
    $script:WizardResult=[pscustomobject]@{
      SiteName=$siteName; RepoName=$repoName; BankName=$bank.Text.Trim(); AccountOwner=$owner.Text.Trim(); AccountNumber=$account.Text.Trim();
      SmsSender=$sender.Text.Trim(); Messenger=$messenger.Text.Trim(); Domain=$domain.Text.Trim(); AdminPassword=$admin.Text
    }
    $form.Close()
  })
  [void]$form.ShowDialog()
  return $script:WizardResult
}

function Json-Inner([string]$Value) {
  $q = $Value | ConvertTo-Json -Compress
  if($q.Length -ge 2){ return $q.Substring(1,$q.Length-2) }
  return ''
}

function Patch-ClientSource($Config,[string]$TargetDir) {
  Write-Step 'Клиентийн нэр, дансны мэдээллээр кодыг тусгаарлаж байна'
  $pagePath=Join-Path $TargetDir 'app\page.tsx'
  $page=Get-Content $pagePath -Raw -Encoding UTF8
  $bankJson=$Config.BankName | ConvertTo-Json -Compress
  $numberJson=$Config.AccountNumber | ConvertTo-Json -Compress
  $ownerJson=$Config.AccountOwner | ConvertTo-Json -Compress
  $replacement="const DEFAULT_BANK_ACCOUNT = {`n  bank: $bankJson,`n  number: $numberJson,`n  name: $ownerJson,`n};"
  $next=[regex]::Replace($page,'const DEFAULT_BANK_ACCOUNT = \{[\s\S]*?\};',$replacement,1)
  if($next -eq $page){throw 'Дансны default тохиргооны anchor олдсонгүй.'}
  Write-Utf8NoBom $pagePath $next

  foreach($folder in @('app','public')){
    $root=Join-Path $TargetDir $folder
    if(Test-Path $root){
      Get-ChildItem $root -Recurse -File | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx','.json','.css','.webmanifest','.html') } | ForEach-Object {
        $text=Get-Content $_.FullName -Raw -Encoding UTF8
        if($text.Contains('ТАЗА САЙТ')){ Write-Utf8NoBom $_.FullName ($text.Replace('ТАЗА САЙТ',$Config.SiteName)) }
      }
    }
  }
  Write-Ok 'Production мэдээллээс тусдаа client source үүслээ.'
}

function Copy-ClientSource([string]$TargetDir) {
  Write-Step 'MASTER кодыг клиентын компьютерт хуулж байна'
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $excludeDirs=@('.git','.github','.next','node_modules','installer','.vercel','.supabase','OUTPUT')
  $args=@($MasterRoot,$TargetDir,'/E','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD')+$excludeDirs+@('/XF','START-HERE.cmd','.env','.env.local','*.log')
  & robocopy @args | Out-Null
  if($LASTEXITCODE -ge 8){throw "MASTER код хуулж чадсангүй. Robocopy code: $LASTEXITCODE"}
  Write-Ok $TargetDir
}

function Ensure-Prerequisites {
  Write-Step 'Компьютерийн хэрэгслүүдийг шалгаж байна'
  Ensure-WingetTool 'git' 'Git.Git' 'Git'
  Ensure-WingetTool 'node' 'OpenJS.NodeJS.LTS' 'Node.js LTS'
  Ensure-WingetTool 'gh' 'GitHub.cli' 'GitHub CLI'
  Refresh-Path
  if(-not (Get-Command npm -ErrorAction SilentlyContinue)){throw 'npm олдсонгүй.'}
  if(-not (Get-Command npx -ErrorAction SilentlyContinue)){throw 'npx олдсонгүй.'}
  $major=[int](((& node --version).Trim()).TrimStart('v').Split('.')[0])
  if($major -lt 22){throw 'Node.js 22 буюу түүнээс шинэ LTS шаардлагатай.'}
  Write-Ok 'Git + Node.js + GitHub CLI бэлэн.'
}

function Ensure-GitHub([string]$TargetDir,[string]$RepoName) {
  Write-Step 'GitHub аккаунтыг холбоно'
  & gh auth status *> $null
  if($LASTEXITCODE -ne 0){
    Write-Host 'Browser нээгдэнэ. КЛИЕНТИЙН GitHub аккаунтаар нэвтэрнэ үү.' -ForegroundColor Yellow
    & gh auth login --web --git-protocol https
    if($LASTEXITCODE -ne 0){throw 'GitHub login амжилтгүй.'}
  }
  $login=(& gh api user -q .login).Trim()
  if(-not $login){throw 'GitHub хэрэглэгчийн нэр олдсонгүй.'}
  Push-Location $TargetDir
  try {
    & git init -b main | Out-Null
    & git config user.name $login
    & git config user.email "$login@users.noreply.github.com"
    & git add .
    & git commit -m 'Initial client site' | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Git commit үүссэнгүй.'}
    $create=Invoke-Capture 'gh' @('repo','create',$RepoName,'--private','--source','.','--remote','origin','--push') 'GitHub private repo'
    $repoUrl=(& gh repo view --json url -q .url).Trim()
    if(-not $repoUrl){throw 'GitHub repo URL олдсонгүй.'}
    Write-Ok "GitHub private repo: $repoUrl"
    return $repoUrl
  } finally { Pop-Location }
}

function Ensure-SupabaseLogin {
  $probe=Invoke-Capture 'npx' @('--yes','supabase@latest','projects','list','-o','json') 'Supabase auth probe' -AllowFail
  if($probe.Code -ne 0){
    Write-Host 'Supabase login хийнэ. КЛИЕНТИЙН Supabase аккаунтаар нэвтэрнэ үү.' -ForegroundColor Yellow
    & npx --yes supabase@latest login
    if($LASTEXITCODE -ne 0){throw 'Supabase login амжилтгүй.'}
  }
}

function Select-SupabaseOrg {
  $r=Invoke-Capture 'npx' @('--yes','supabase@latest','orgs','list','-o','json') 'Supabase organizations'
  $data=Parse-LooseJson $r.Text
  $items=@($data)
  if($data.organizations){$items=@($data.organizations)}
  if($items.Count -eq 0){throw 'Supabase organization олдсонгүй.'}
  if($items.Count -eq 1){return $items[0].id}
  Write-Host 'Supabase organization сонгоно:' -ForegroundColor Yellow
  for($i=0;$i -lt $items.Count;$i++){Write-Host "  $($i+1). $($items[$i].name)  [$($items[$i].id)]"}
  do{$choice=Read-Host 'Дугаар'}while(-not [int]::TryParse($choice,[ref]$n) -or $n -lt 1 -or $n -gt $items.Count)
  return $items[$n-1].id
}

function Prepare-FreshMigrations($Config,[string]$WorkRoot) {
  & npx --yes supabase@latest init --workdir $WorkRoot | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Supabase temporary workdir үүссэнгүй.'}
  $mig=Join-Path $WorkRoot 'supabase\migrations'
  New-Item -ItemType Directory -Force -Path $mig | Out-Null
  Get-ChildItem $mig -File -ErrorAction SilentlyContinue | Remove-Item -Force

  $sources=@(
    @('20260916090001_core.sql','supabase\review-install.sql'),
    @('20260916090002_https.sql','supabase\HTTPS-UPGRADE.sql'),
    @('20260916090003_chat.sql','supabase\migrations\20260915183329_private_support_chat.sql'),
    @('20260916090004_chat_actions.sql','supabase\migrations\20260915200520_chat_access_actions.sql'),
    @('20260916090005_appearance.sql','supabase\migrations\20260916032117_site_appearance.sql'),
    @('20260916090006_trailers.sql','supabase\trailers.sql')
  )
  foreach($pair in $sources){
    $src=Join-Path $TargetDir $pair[1]
    if(-not(Test-Path $src)){throw "Migration source олдсонгүй: $($pair[1])"}
    Write-Utf8NoBom (Join-Path $mig $pair[0]) (Get-Content $src -Raw -Encoding UTF8)
  }

  $settings=[ordered]@{messengerUrl=$Config.Messenger;bankName=$Config.BankName;bankAccount=$Config.AccountNumber;accountName=$Config.AccountOwner} | ConvertTo-Json -Compress
  $settingsSql=$settings.Replace("'","''")
  Write-Utf8NoBom (Join-Path $mig '20260916090007_client_settings.sql') "select * from public.kino_save_settings('$settingsSql');`n"

  $cleanup=@"
create extension if not exists pg_cron with schema pg_catalog;
do `$cleanup`$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname='cleanup-old-payment-records';
end
`$cleanup`$;
select cron.schedule('cleanup-old-payment-records','15 3 * * *',`$job`$
  delete from public.pending_payments where status in ('pending','revoked') and created_at < now() - interval '30 days';
  delete from public.sms_logs where created_at < now() - interval '30 days' and coalesce(key,'') <> 'site_settings';
`$job`$);
"@
  Write-Utf8NoBom (Join-Path $mig '20260916090008_cleanup.sql') $cleanup
}

function Create-Supabase($Config,[string]$TargetDir,[string]$DbPassword) {
  Write-Step 'Шинэ Supabase project үүсгэж байна'
  Ensure-SupabaseLogin
  $orgId=Select-SupabaseOrg
  $projectName="$($Config.RepoName)-$(Get-Date -Format 'MMddHHmm')"
  $created=Invoke-Capture 'npx' @('--yes','supabase@latest','projects','create',$projectName,'--org-id',$orgId,'--db-password',$DbPassword,'--region','ap-southeast-1','-o','json') 'Supabase project create'
  $obj=Parse-LooseJson $created.Text
  $projectRef=$obj.id
  if(-not $projectRef){$projectRef=$obj.ref}
  if(-not $projectRef){$projectRef=$obj.project_ref}

  for($try=0;$try -lt 60 -and -not $projectRef;$try++){
    Start-Sleep -Seconds 5
    $list=Parse-LooseJson (Invoke-Capture 'npx' @('--yes','supabase@latest','projects','list','-o','json') 'Supabase project list').Text
    $match=@($list) | Where-Object {$_.name -eq $projectName} | Select-Object -First 1
    if($match){$projectRef=$match.id;if(-not $projectRef){$projectRef=$match.ref}}
  }
  if(-not $projectRef){throw 'Шинэ Supabase project ref олдсонгүй.'}

  Write-Host "Project ref: $projectRef"
  $work=Join-Path $env:TEMP ("taza-supabase-"+$Config.RepoName+'-'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  try {
    Prepare-FreshMigrations $Config $work
    Push-Location $work
    try {
      $linked=Invoke-Capture 'npx' @('--yes','supabase@latest','link','--project-ref',$projectRef,'--password',$DbPassword) 'Supabase link'
      $pushed=Invoke-Capture 'npx' @('--yes','supabase@latest','db','push','--linked','--password',$DbPassword,'--yes') 'Supabase migrations'
    } finally {Pop-Location}
  } finally {Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue}

  $keysObj=Parse-LooseJson (Invoke-Capture 'npx' @('--yes','supabase@latest','projects','api-keys','--project-ref',$projectRef,'-o','json') 'Supabase API keys').Text
  $keys=@($keysObj)
  if($keysObj.api_keys){$keys=@($keysObj.api_keys)}
  $secret=$keys | Where-Object { $_.name -match 'secret' -or $_.api_key -like 'sb_secret_*' } | Select-Object -First 1
  $service=$keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1
  $chosen=if($secret){$secret}else{$service}
  if(-not $chosen){throw 'Supabase server key олдсонгүй.'}
  $keyValue=$chosen.api_key;if(-not $keyValue){$keyValue=$chosen.key};if(-not $keyValue){$keyValue=$chosen.value}
  if(-not $keyValue){throw 'Supabase server key хоосон байна.'}
  $envName=if($chosen.name -match 'secret' -or $keyValue -like 'sb_secret_*'){'SUPABASE_SECRET_KEY'}else{'SUPABASE_SERVICE_ROLE_KEY'}
  Write-Ok 'Supabase schema + storage + chat + cleanup бэлэн.'
  return [pscustomobject]@{ Ref=$projectRef; Url="https://$projectRef.supabase.co"; ServerKey=$keyValue; ServerEnvName=$envName }
}

function Ensure-VercelLogin {
  $probe=Invoke-Capture 'npx' @('--yes','vercel@latest','whoami') 'Vercel auth probe' -AllowFail
  if($probe.Code -ne 0){
    Write-Host 'Vercel login хийнэ. КЛИЕНТИЙН Vercel аккаунтаар нэвтэрнэ үү.' -ForegroundColor Yellow
    & npx --yes vercel@latest login
    if($LASTEXITCODE -ne 0){throw 'Vercel login амжилтгүй.'}
  }
}

function Add-VercelEnv([string]$Name,[string]$Value) {
  $tmp=Join-Path $env:TEMP ('taza-env-'+[guid]::NewGuid().ToString('N')+'.txt')
  try {
    Write-Utf8NoBom $tmp $Value
    Get-Content $tmp -Raw | & npx --yes vercel@latest env add $Name production --yes *> $null
    if($LASTEXITCODE -ne 0){throw "Vercel env нэмэгдсэнгүй: $Name"}
  } finally {Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
}

function Get-VercelUrl([string]$Text) {
  $alias=[regex]::Matches($Text,'(?im)Aliased:\s*(https://[A-Za-z0-9.-]+\.vercel\.app)')
  if($alias.Count){return $alias[$alias.Count-1].Groups[1].Value.TrimEnd('/')}
  $all=[regex]::Matches($Text,'https://[A-Za-z0-9.-]+\.vercel\.app')
  if($all.Count){return $all[$all.Count-1].Value.TrimEnd('/')}
  return $null
}

function Create-Vercel($Config,[string]$TargetDir,$Supabase,[string]$AdminPassword,[string]$SmsSecret,[string]$RepoUrl) {
  Write-Step 'Vercel project + environment variables тохируулж байна'
  Ensure-VercelLogin
  Push-Location $TargetDir
  try {
    $link=Invoke-Capture 'npx' @('--yes','vercel@latest','link','--yes','--project',$Config.RepoName) 'Vercel link' -AllowFail
    if($link.Code -ne 0){
      Write-Warn 'Project-ийг нэг удаа гараар сонгох/үүсгэх цонх гарна.'
      & npx --yes vercel@latest link
      if($LASTEXITCODE -ne 0){throw 'Vercel project link амжилтгүй.'}
    }
    $gitConnect=Invoke-Capture 'npx' @('--yes','vercel@latest','git','connect',$RepoUrl,'--yes') 'Vercel Git connect' -AllowFail
    if($gitConnect.Code -ne 0){Write-Warn 'Git auto-deploy холболтыг CLI автоматаар хийсэнгүй. Сайт deploy болох боловч дараа Vercel → Git дээр repo-г холбоно.'}

    Add-VercelEnv 'SUPABASE_URL' $Supabase.Url
    Add-VercelEnv $Supabase.ServerEnvName $Supabase.ServerKey
    Add-VercelEnv 'ADMIN_PASSWORD' $AdminPassword
    Add-VercelEnv 'SMS_WEBHOOK_SECRET' $SmsSecret
    Add-VercelEnv 'SMS_ALLOWED_SENDER' $Config.SmsSender
    if($Config.Messenger){Add-VercelEnv 'MESSENGER_URL' $Config.Messenger}

    $first=Invoke-Capture 'npx' @('--yes','vercel@latest','--prod','--yes') 'Vercel first deploy'
    $siteUrl=Get-VercelUrl $first.Text
    if(-not $siteUrl){throw 'Vercel production URL автоматаар олдсонгүй.'}
    Add-VercelEnv 'SITE_URL' $siteUrl
    $second=Invoke-Capture 'npx' @('--yes','vercel@latest','--prod','--yes') 'Vercel final deploy'
    $final=Get-VercelUrl $second.Text
    if($final){$siteUrl=$final}
    Write-Ok "Production: $siteUrl"
    return $siteUrl
  } finally {Pop-Location}
}

function Expand-MacroTemplate([string]$B64Path) {
  $b64=(Get-Content $B64Path -Raw).Trim()
  $bytes=[Convert]::FromBase64String($b64)
  $input=New-Object IO.MemoryStream(,$bytes)
  $gzip=New-Object IO.Compression.GZipStream($input,[IO.Compression.CompressionMode]::Decompress)
  $reader=New-Object IO.StreamReader($gzip,[Text.Encoding]::UTF8)
  try{return $reader.ReadToEnd()}finally{$reader.Dispose();$gzip.Dispose();$input.Dispose()}
}

function Create-MacroDroid($Config,[string]$SiteUrl,[string]$SmsSecret,[string]$TargetDir) {
  Write-Step 'Клиентэд зориулсан MacroDroid backup үүсгэж байна'
  $template=Expand-MacroTemplate (Join-Path $PSScriptRoot 'macro-template.mdr.gz.b64')
  $macro=$template.Replace('__TAZA_SMS_ENDPOINT__',(Json-Inner "$SiteUrl/api/sms"))
  $macro=$macro.Replace('__TAZA_SMS_SECRET__',(Json-Inner $SmsSecret))
  $macro=$macro.Replace('__TAZA_SMS_SENDER__',(Json-Inner $Config.SmsSender))
  if($macro -match '__TAZA_'){throw 'MacroDroid placeholder бүрэн солигдсонгүй.'}
  try{$null=$macro|ConvertFrom-Json}catch{throw 'Үүссэн MacroDroid файл JSON биш байна.'}
  $out=Join-Path $TargetDir 'OUTPUT'
  New-Item -ItemType Directory -Force -Path $out | Out-Null
  $path=Join-Path $out ($Config.RepoName+'-macrodroid.mdr')
  Write-Utf8NoBom $path $macro
  Write-Ok $path
  return $path
}

function Test-Http200([string]$Url) {
  for($i=0;$i -lt 18;$i++){
    try{
      $r=Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
      if($r.StatusCode -eq 200){return $true}
    }catch{}
    Start-Sleep -Seconds 5
  }
  return $false
}

function Test-Deployment([string]$SiteUrl,[string]$SmsSecret,[string]$Sender) {
  Write-Step 'Live сайтыг шалгаж байна'
  foreach($path in @('/api/health','/api/settings','/api/catalog')){
    if(-not(Test-Http200 ($SiteUrl+$path))){throw "Live шалгалт унав: $path"}
    Write-Ok "$path 200"
  }
  $code=0
  try{
    $headers=@{Authorization="Bearer $SmsSecret";'X-SMS-Sender'=$Sender}
    $r=Invoke-WebRequest -Uri ($SiteUrl+'/api/sms') -Method Post -Headers $headers -ContentType 'text/plain' -Body 'KINO_QUEUE_TEST_V1' -UseBasicParsing -TimeoutSec 20
    $code=[int]$r.StatusCode
  }catch{
    if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}
  }
  if($code -ne 400){throw "SMS endpoint test expected 400, got $code. Secret/sender/env-г шалгана уу."}
  Write-Ok 'SMS endpoint + secret + sender баталгаажлаа (аюулгүй fake test).'
}

function Write-Recovery($Config,[string]$TargetDir,[string]$SiteUrl,[string]$RepoUrl,$Supabase,[string]$AdminPassword,[string]$SmsSecret,[string]$DbPassword,[string]$MacroPath) {
  $out=Join-Path $TargetDir 'OUTPUT';New-Item -ItemType Directory -Force -Path $out|Out-Null
  $recovery=@"
КЛИЕНТИЙН НУУЦ СЭРГЭЭХ МЭДЭЭЛЭЛ
================================
Энэ файлыг зөвхөн тухайн клиент хадгална. Плаш дээр үлдээж болохгүй.

Сайт: $($Config.SiteName)
Production URL: $SiteUrl
GitHub: $RepoUrl
Supabase project ref: $($Supabase.Ref)
Supabase DB password: $DbPassword
Админ нууц: $AdminPassword
SMS sender: $($Config.SmsSender)
SMS webhook secret: $SmsSecret
MacroDroid файл: $MacroPath
Өөрийн домэйн хүсэлт: $($Config.Domain)

Supabase server/service key нь энэ файлд зориуд бичигдээгүй. Тэр нь Vercel Environment Variables-д хадгалагдсан.
"@
  Write-Utf8NoBom (Join-Path $out 'CLIENT-RECOVERY.txt') $recovery
  $next=@"
ДАРААГИЙН 5 АЛХАМ
=================
1. Android утсанд MacroDroid суулгана.
2. $([IO.Path]::GetFileName($MacroPath))-г Import хийнэ.
3. SMS / Notification permission өгч, Battery-г Unrestricted болгоно.
4. MacroDroid → 03 Холболт турших: эхлээд Wi-Fi + дата OFF, macro-г ажиллуулаад дараа интернетээ ON. "ОФЛАЙН ТУРШИЛТ АМЖИЛТТАЙ" бол зөв.
5. Сайт → Админ → Тохиргоо дээр банкны нэр/эзэмшигч/дансны дугаарыг дахин нүдээр шалгана.

Хэрэв өөрийн домэйн оруулсан бол Vercel Domains хэсэгт DNS-ээ холбоод, дараа SITE_URL environment variable-ийг https://домэйн утгаар шинэчилж production deploy хийнэ.
Кино контентын түгээх эрхийг клиент өөрөө хариуцна.
"@
  Write-Utf8NoBom (Join-Path $out 'NEXT-STEPS.txt') $next
}

try {
  Write-Host 'TAZA SITE MASTER — ШИНЭ КЛИЕНТ СУУЛГАЦ' -ForegroundColor Green
  Write-Host 'Production ТАЗА САЙТ руу энэ скрипт бичихгүй.' -ForegroundColor DarkGray

  $config=Show-Wizard
  if(-not $config){Write-Host 'Цуцлагдлаа.';exit 2}
  $config.RepoName=Normalize-Slug $config.RepoName
  $adminPassword=if($config.AdminPassword){$config.AdminPassword}else{New-HexSecret 20}
  $smsSecret=New-HexSecret 32
  $dbPassword=New-HexSecret 24

  Ensure-Prerequisites
  New-Item -ItemType Directory -Force -Path $ClientRoot | Out-Null
  $TargetDir=Join-Path $ClientRoot $config.RepoName
  if(Test-Path $TargetDir){$TargetDir=Join-Path $ClientRoot ($config.RepoName+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))}
  Copy-ClientSource $TargetDir
  Patch-ClientSource $config $TargetDir

  $repoUrl=Ensure-GitHub $TargetDir $config.RepoName
  $supabase=Create-Supabase $config $TargetDir $dbPassword
  $siteUrl=Create-Vercel $config $TargetDir $supabase $adminPassword $smsSecret $repoUrl
  $macroPath=Create-MacroDroid $config $siteUrl $smsSecret $TargetDir
  Test-Deployment $siteUrl $smsSecret $config.SmsSender
  Write-Recovery $config $TargetDir $siteUrl $repoUrl $supabase $adminPassword $smsSecret $dbPassword $macroPath

  Write-Host ''
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host '  ✅ СУУЛГАЛТ АМЖИЛТТАЙ' -ForegroundColor Green
  Write-Host "  Сайт: $siteUrl" -ForegroundColor Green
  Write-Host "  Файлууд: $TargetDir\OUTPUT" -ForegroundColor Green
  Write-Host '============================================================' -ForegroundColor Green
  Start-Process $siteUrl
  Start-Process (Join-Path $TargetDir 'OUTPUT')
  try{[System.Windows.Forms.MessageBox]::Show("Суулгалт амжилттай.`n$siteUrl`n`nОдоо OUTPUT хавтас дахь NEXT-STEPS.txt-ийг дагана уу.",'TAZA SETUP',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Information)|Out-Null}catch{}
  exit 0
} catch {
  Write-Host ''
  Write-Host ('[АЛДАА] '+$_.Exception.Message) -ForegroundColor Red
  Write-Host 'Production сайт өөрчлөгдөөгүй. Алдааг зассаны дараа дахин ажиллуулж болно.' -ForegroundColor Yellow
  try{Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'TAZA SETUP — Алдаа',[System.Windows.Forms.MessageBoxButtons]::OK,[System.Windows.Forms.MessageBoxIcon]::Error)|Out-Null}catch{}
  exit 1
}
