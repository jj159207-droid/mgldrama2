$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {}

$MasterRoot = Split-Path -Parent $PSScriptRoot
$ClientRoot = 'C:\TAZA-CLIENTS'

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-WarningText([string]$Text) {
    Write-Host "[АНХААР] $Text" -ForegroundColor Yellow
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $encoding)
}

function New-HexSecret([int]$ByteCount = 24) {
    $bytes = New-Object byte[] $ByteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Convert-ToSlug([string]$Value) {
    $slug = ($Value.ToLowerInvariant() -replace '[^a-z0-9._-]+', '-').Trim('-', '.')
    $slug = $slug -replace '-+', '-'
    if ([string]::IsNullOrWhiteSpace($slug)) {
        $slug = 'taza-site-client'
    }
    if ($slug.Length -gt 80) {
        $slug = $slug.Substring(0, 80).TrimEnd('-', '.')
    }
    return $slug
}

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Invoke-Capture {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Label,
        [switch]$AllowFail
    )

    $output = & $Command @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | ForEach-Object { "$_" }) -join "`n"

    if ($exitCode -ne 0 -and -not $AllowFail) {
        throw "$Label амжилтгүй.`n$text"
    }

    return [pscustomobject]@{
        Code = $exitCode
        Text = $text
    }
}

function ConvertFrom-LooseJson([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    try {
        return ($Text | ConvertFrom-Json)
    } catch {}

    $lines = $Text -split "`r?`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $trimmed = $lines[$i].TrimStart()
        if ($trimmed.StartsWith('{') -or $trimmed.StartsWith('[')) {
            $candidate = $lines[$i..($lines.Count - 1)] -join "`n"
            try {
                return ($candidate | ConvertFrom-Json)
            } catch {}
        }
    }

    throw 'CLI-ийн JSON хариуг уншиж чадсангүй.'
}

function Ensure-WingetTool {
    param(
        [string]$Command,
        [string]$PackageId,
        [string]$DisplayName
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        return
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$DisplayName шаардлагатай боловч Windows Package Manager (winget) олдсонгүй. Microsoft App Installer-аа шинэчлээд дахин ажиллуулна уу."
    }

    Write-Step "$DisplayName суулгаж байна"
    & winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "$DisplayName автоматаар суусангүй."
    }

    Refresh-ProcessPath
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$DisplayName суусан боловч одоогийн цонхноос харагдсангүй. Компьютерээ restart хийгээд START-HERE.cmd-г дахин ажиллуулна уу."
    }
}

function Ensure-Prerequisites {
    Write-Step 'Git, Node.js, GitHub CLI шалгаж байна'
    Ensure-WingetTool -Command 'git' -PackageId 'Git.Git' -DisplayName 'Git'
    Ensure-WingetTool -Command 'node' -PackageId 'OpenJS.NodeJS.LTS' -DisplayName 'Node.js LTS'
    Ensure-WingetTool -Command 'gh' -PackageId 'GitHub.cli' -DisplayName 'GitHub CLI'
    Refresh-ProcessPath

    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        throw 'npx олдсонгүй.'
    }

    $major = [int](((& node --version).Trim()).TrimStart('v').Split('.')[0])
    if ($major -lt 22) {
        throw 'Node.js 22 буюу түүнээс шинэ LTS шаардлагатай.'
    }

    Write-Ok 'Git + Node.js + GitHub CLI бэлэн.'
}

function Add-WizardField {
    param(
        $Form,
        [string]$Label,
        [int]$Y,
        [string]$DefaultValue = '',
        [switch]$Password
    )

    $labelControl = New-Object System.Windows.Forms.Label
    $labelControl.Text = $Label
    $labelControl.Location = New-Object System.Drawing.Point(20, $Y)
    $labelControl.Size = New-Object System.Drawing.Size(210, 24)
    $Form.Controls.Add($labelControl)

    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Text = $DefaultValue
    $textBox.Location = New-Object System.Drawing.Point(235, ($Y - 2))
    $textBox.Size = New-Object System.Drawing.Size(340, 28)
    if ($Password) {
        $textBox.UseSystemPasswordChar = $true
    }
    $Form.Controls.Add($textBox)

    return $textBox
}

function Show-SetupWizard {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'TAZA SITE MASTER — Шинэ клиент'
    $form.StartPosition = 'CenterScreen'
    $form.Size = New-Object System.Drawing.Size(625, 655)
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

    $header = New-Object System.Windows.Forms.Label
    $header.Text = 'Тусдаа GitHub + Supabase + Vercel + MacroDroid сайт үүсгэнэ.'
    $header.Location = New-Object System.Drawing.Point(20, 15)
    $header.Size = New-Object System.Drawing.Size(560, 35)
    $form.Controls.Add($header)

    $siteBox = Add-WizardField -Form $form -Label 'Сайтын нэр' -Y 65 -DefaultValue 'ТАЗА САЙТ'
    $repoBox = Add-WizardField -Form $form -Label 'Төслийн нэр (англи)' -Y 110 -DefaultValue 'taza-site-client'
    $bankBox = Add-WizardField -Form $form -Label 'Банкны нэр' -Y 155 -DefaultValue 'Хаан банк'
    $ownerBox = Add-WizardField -Form $form -Label 'Данс эзэмшигч' -Y 200
    $accountBox = Add-WizardField -Form $form -Label 'Дансны дугаар' -Y 245
    $senderBox = Add-WizardField -Form $form -Label 'SMS илгээгч' -Y 290 -DefaultValue 'Khan Bank'
    $messengerBox = Add-WizardField -Form $form -Label 'Messenger (заавал биш)' -Y 335
    $domainBox = Add-WizardField -Form $form -Label 'Домэйн (заавал биш)' -Y 380
    $adminBox = Add-WizardField -Form $form -Label 'Админ нууц (хоосон = auto)' -Y 425 -Password

    $info = New-Object System.Windows.Forms.Label
    $info.Text = 'Secret бүрийг шинэ клиентэд шинээр үүсгэнэ. Манай production secret ашиглагдахгүй.'
    $info.Location = New-Object System.Drawing.Point(20, 470)
    $info.Size = New-Object System.Drawing.Size(560, 40)
    $form.Controls.Add($info)

    $errorLabel = New-Object System.Windows.Forms.Label
    $errorLabel.ForeColor = [System.Drawing.Color]::Firebrick
    $errorLabel.Location = New-Object System.Drawing.Point(20, 510)
    $errorLabel.Size = New-Object System.Drawing.Size(560, 35)
    $form.Controls.Add($errorLabel)

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = 'Болих'
    $cancelButton.Location = New-Object System.Drawing.Point(260, 560)
    $cancelButton.Size = New-Object System.Drawing.Size(95, 38)
    $form.Controls.Add($cancelButton)

    $startButton = New-Object System.Windows.Forms.Button
    $startButton.Text = 'Суулгалтыг эхлүүлэх'
    $startButton.Location = New-Object System.Drawing.Point(370, 560)
    $startButton.Size = New-Object System.Drawing.Size(210, 38)
    $form.Controls.Add($startButton)

    $script:WizardResult = $null
    $cancelButton.Add_Click({ $form.Close() })
    $startButton.Add_Click({
        $siteName = $siteBox.Text.Trim()
        $repoName = Convert-ToSlug $repoBox.Text

        if ($siteName.Length -lt 2 -or $siteName -match '[<>"]') {
            $errorLabel.Text = 'Сайтын нэрээ зөв оруулна уу.'
            return
        }
        if ($ownerBox.Text.Trim().Length -lt 2) {
            $errorLabel.Text = 'Данс эзэмшигчийн нэрийг оруулна уу.'
            return
        }
        if ($accountBox.Text.Trim() -notmatch '^[A-Za-z0-9 -]{6,40}$') {
            $errorLabel.Text = 'Дансны дугаар 6–40 тэмдэгт байна.'
            return
        }
        if ($senderBox.Text.Trim().Length -lt 2) {
            $errorLabel.Text = 'SMS илгээгчийг оруулна уу.'
            return
        }
        if ($adminBox.Text.Length -gt 0 -and $adminBox.Text.Length -lt 16) {
            $errorLabel.Text = 'Админ нууц 16+ тэмдэгт эсвэл хоосон байна.'
            return
        }
        if ($messengerBox.Text.Trim() -and $messengerBox.Text.Trim() -notmatch '^https://') {
            $errorLabel.Text = 'Messenger холбоос https:// гэж эхэлнэ.'
            return
        }

        $script:WizardResult = [pscustomobject]@{
            SiteName = $siteName
            RepoName = $repoName
            BankName = $bankBox.Text.Trim()
            AccountOwner = $ownerBox.Text.Trim()
            AccountNumber = $accountBox.Text.Trim()
            SmsSender = $senderBox.Text.Trim()
            MessengerUrl = $messengerBox.Text.Trim()
            CustomDomain = $domainBox.Text.Trim()
            AdminPassword = $adminBox.Text
        }
        $form.Close()
    })

    [void]$form.ShowDialog()
    return $script:WizardResult
}

function Copy-ClientSource([string]$TargetDir) {
    Write-Step 'MASTER-ээс тусдаа client source хуулж байна'
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

    $excludedDirectories = @(
        '.git', '.github', '.next', 'node_modules', 'installer', '.vercel', '.supabase', 'OUTPUT'
    )

    $arguments = @(
        $MasterRoot, $TargetDir,
        '/E', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD'
    ) + $excludedDirectories + @(
        '/XF', 'START-HERE.cmd', '.env', '.env.local', '*.log'
    )

    & robocopy @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "MASTER код хуулж чадсангүй. Robocopy code: $LASTEXITCODE"
    }

    Write-Ok $TargetDir
}

function Patch-ClientSource($Config, [string]$TargetDir) {
    Write-Step 'Клиентийн брэнд ба дансыг кодонд тохируулж байна'

    $pagePath = Join-Path $TargetDir 'app\page.tsx'
    $page = Get-Content $pagePath -Raw -Encoding UTF8
    $bankJson = $Config.BankName | ConvertTo-Json -Compress
    $numberJson = $Config.AccountNumber | ConvertTo-Json -Compress
    $ownerJson = $Config.AccountOwner | ConvertTo-Json -Compress

    $replacement = "const DEFAULT_BANK_ACCOUNT = {`n  bank: $bankJson,`n  number: $numberJson,`n  name: $ownerJson,`n};"
    $patched = [regex]::Replace(
        $page,
        'const DEFAULT_BANK_ACCOUNT = \{[\s\S]*?\};',
        $replacement,
        1
    )

    if ($patched -eq $page) {
        throw 'Дансны default тохиргооны anchor олдсонгүй.'
    }
    Write-Utf8NoBom -Path $pagePath -Text $patched

    foreach ($folder in @('app', 'public')) {
        $root = Join-Path $TargetDir $folder
        if (-not (Test-Path $root)) {
            continue
        }

        Get-ChildItem $root -Recurse -File |
            Where-Object { $_.Extension -in @('.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.webmanifest', '.html') } |
            ForEach-Object {
                $text = Get-Content $_.FullName -Raw -Encoding UTF8
                if ($text.Contains('ТАЗА САЙТ')) {
                    Write-Utf8NoBom -Path $_.FullName -Text ($text.Replace('ТАЗА САЙТ', $Config.SiteName))
                }
            }
    }

    Write-Ok 'Клиентийн брэнд/дансны fallback тусгаарлагдлаа.'
}

function Setup-GitHub($Config, [string]$TargetDir) {
    Write-Step 'GitHub private repo үүсгэж байна'

    & gh auth status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Browser дээр КЛИЕНТИЙН GitHub аккаунтаар нэвтэрнэ үү.' -ForegroundColor Yellow
        & gh auth login --web --git-protocol https
        if ($LASTEXITCODE -ne 0) {
            throw 'GitHub login амжилтгүй.'
        }
    }

    $login = (& gh api user -q .login).Trim()
    if (-not $login) {
        throw 'GitHub хэрэглэгчийн нэр олдсонгүй.'
    }

    & gh repo view "$login/$($Config.RepoName)" *> $null
    if ($LASTEXITCODE -eq 0) {
        throw "GitHub repo '$($Config.RepoName)' аль хэдийн байна. Төслийн өөр нэр сонгоод дахин эхлүүлнэ үү."
    }

    Push-Location $TargetDir
    try {
        & git init -b main | Out-Null
        & git config user.name $login
        & git config user.email "$login@users.noreply.github.com"
        & git add .
        & git commit -m 'Initial client site' | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'Git commit үүссэнгүй.'
        }

        $null = Invoke-Capture -Command 'gh' -Arguments @(
            'repo', 'create', $Config.RepoName,
            '--private', '--source', '.', '--remote', 'origin', '--push'
        ) -Label 'GitHub private repo'

        $repoUrl = (& gh repo view --json url -q .url).Trim()
        if (-not $repoUrl) {
            throw 'GitHub repo URL олдсонгүй.'
        }

        Write-Ok "Private repo: $repoUrl"
        return $repoUrl
    } finally {
        Pop-Location
    }
}

function Ensure-SupabaseLogin {
    $probe = Invoke-Capture -Command 'npx' -Arguments @(
        '--yes', 'supabase@latest', 'projects', 'list', '-o', 'json'
    ) -Label 'Supabase auth probe' -AllowFail

    if ($probe.Code -ne 0) {
        Write-Host 'КЛИЕНТИЙН Supabase аккаунтаар browser login хийнэ үү.' -ForegroundColor Yellow
        & npx --yes supabase@latest login
        if ($LASTEXITCODE -ne 0) {
            throw 'Supabase login амжилтгүй.'
        }
    }
}

function Select-SupabaseOrganization {
    $response = Invoke-Capture -Command 'npx' -Arguments @(
        '--yes', 'supabase@latest', 'orgs', 'list', '-o', 'json'
    ) -Label 'Supabase organizations'

    $data = ConvertFrom-LooseJson $response.Text
    $organizations = @($data)
    if ($data -and $data.PSObject.Properties.Name -contains 'organizations') {
        $organizations = @($data.organizations)
    }

    if ($organizations.Count -eq 0) {
        throw 'Supabase organization олдсонгүй.'
    }
    if ($organizations.Count -eq 1) {
        return $organizations[0].id
    }

    Write-Host 'Supabase organization сонгоно:' -ForegroundColor Yellow
    for ($i = 0; $i -lt $organizations.Count; $i++) {
        Write-Host "  $($i + 1). $($organizations[$i].name)"
    }

    $number = 0
    do {
        $choice = Read-Host 'Дугаар'
        $parsed = [int]::TryParse($choice, [ref]$number)
    } while (-not $parsed -or $number -lt 1 -or $number -gt $organizations.Count)

    return $organizations[$number - 1].id
}

function Copy-MigrationFile([string]$Source, [string]$Destination) {
    if (-not (Test-Path $Source)) {
        throw "Migration source олдсонгүй: $Source"
    }
    Write-Utf8NoBom -Path $Destination -Text (Get-Content $Source -Raw -Encoding UTF8)
}

function Build-FreshMigrations($Config, [string]$TargetDir, [string]$WorkRoot) {
    Push-Location $WorkRoot
    try {
        & npx --yes supabase@latest init | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'supabase init амжилтгүй.'
        }
    } finally {
        Pop-Location
    }

    $migrationDir = Join-Path $WorkRoot 'supabase\migrations'
    New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null
    Get-ChildItem $migrationDir -File -ErrorAction SilentlyContinue | Remove-Item -Force

    $migrationSources = @(
        @('20260916090001_core.sql', 'supabase\review-install.sql'),
        @('20260916090002_https.sql', 'supabase\HTTPS-UPGRADE.sql'),
        @('20260916090003_chat.sql', 'supabase\migrations\20260915183329_private_support_chat.sql'),
        @('20260916090004_chat_actions.sql', 'supabase\migrations\20260915200520_chat_access_actions.sql'),
        @('20260916090005_appearance.sql', 'supabase\migrations\20260916032117_site_appearance.sql'),
        @('20260916090006_trailers.sql', 'supabase\trailers.sql')
    )

    foreach ($pair in $migrationSources) {
        Copy-MigrationFile \
            -Source (Join-Path $TargetDir $pair[1]) \
            -Destination (Join-Path $migrationDir $pair[0])
    }

    $settingsJson = [ordered]@{
        messengerUrl = $Config.MessengerUrl
        bankName = $Config.BankName
        bankAccount = $Config.AccountNumber
        accountName = $Config.AccountOwner
    } | ConvertTo-Json -Compress
    $escapedSettings = $settingsJson.Replace("'", "''")
    Write-Utf8NoBom \
        -Path (Join-Path $migrationDir '20260916090007_client_settings.sql') \
        -Text "select * from public.kino_save_settings('$escapedSettings');`n"

    $cleanupSql = @'
create extension if not exists pg_cron with schema pg_catalog;
do $cleanup$
begin
  perform cron.unschedule(j.jobid)
  from cron.job j
  where j.jobname = 'cleanup-old-payment-records';
end
$cleanup$;
select cron.schedule(
  'cleanup-old-payment-records',
  '15 3 * * *',
  $job$
    delete from public.pending_payments
    where status in ('pending','revoked')
      and created_at < now() - interval '30 days';

    delete from public.sms_logs
    where created_at < now() - interval '30 days'
      and coalesce(key,'') <> 'site_settings';
  $job$
);
'@
    Write-Utf8NoBom -Path (Join-Path $migrationDir '20260916090008_cleanup.sql') -Text $cleanupSql
}

function Wait-SupabaseProject([string]$ProjectRef) {
    Write-Step 'Supabase project бэлэн болохыг хүлээж байна'

    for ($attempt = 0; $attempt -lt 72; $attempt++) {
        Start-Sleep -Seconds 5
        $response = Invoke-Capture -Command 'npx' -Arguments @(
            '--yes', 'supabase@latest', 'projects', 'list', '-o', 'json'
        ) -Label 'Supabase project status'
        $projects = @(ConvertFrom-LooseJson $response.Text)
        $project = $projects | Where-Object {
            $_.id -eq $ProjectRef -or $_.ref -eq $ProjectRef
        } | Select-Object -First 1

        if ($project) {
            $status = "$($project.status)"
            if (-not $status -or $status -match 'ACTIVE|HEALTHY') {
                return
            }
        }
    }

    throw 'Supabase project 6 минутын дотор ready болсонгүй.'
}

function Setup-Supabase($Config, [string]$TargetDir, [string]$DbPassword) {
    Write-Step 'Шинэ Supabase project + database үүсгэж байна'
    Ensure-SupabaseLogin
    $organizationId = Select-SupabaseOrganization
    $projectName = "$($Config.RepoName)-$(Get-Date -Format 'MMddHHmm')"

    $createResponse = Invoke-Capture -Command 'npx' -Arguments @(
        '--yes', 'supabase@latest', 'projects', 'create', $projectName,
        '--org-id', $organizationId,
        '--db-password', $DbPassword,
        '--region', 'ap-southeast-1',
        '-o', 'json'
    ) -Label 'Supabase project create'

    $created = ConvertFrom-LooseJson $createResponse.Text
    $projectRef = $created.id
    if (-not $projectRef) { $projectRef = $created.ref }
    if (-not $projectRef) { $projectRef = $created.project_ref }
    if (-not $projectRef) {
        throw 'Шинэ Supabase project ref олдсонгүй.'
    }

    Write-Host "Project ref: $projectRef"
    Wait-SupabaseProject -ProjectRef $projectRef

    $workRoot = Join-Path $env:TEMP ('taza-supabase-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

    try {
        Build-FreshMigrations -Config $Config -TargetDir $TargetDir -WorkRoot $workRoot
        Push-Location $workRoot
        try {
            $null = Invoke-Capture -Command 'npx' -Arguments @(
                '--yes', 'supabase@latest', 'link',
                '--project-ref', $projectRef,
                '--password', $DbPassword
            ) -Label 'Supabase link'

            $null = Invoke-Capture -Command 'npx' -Arguments @(
                '--yes', 'supabase@latest', 'db', 'push',
                '--linked', '--password', $DbPassword, '--yes'
            ) -Label 'Supabase migrations'
        } finally {
            Pop-Location
        }
    } finally {
        Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    $keysResponse = Invoke-Capture -Command 'npx' -Arguments @(
        '--yes', 'supabase@latest', 'projects', 'api-keys',
        '--project-ref', $projectRef, '-o', 'json'
    ) -Label 'Supabase API keys'

    $keysData = ConvertFrom-LooseJson $keysResponse.Text
    $keys = @($keysData)
    if ($keysData -and $keysData.PSObject.Properties.Name -contains 'api_keys') {
        $keys = @($keysData.api_keys)
    }

    $chosen = $keys | Where-Object {
        $_.name -match 'secret' -or $_.api_key -like 'sb_secret_*'
    } | Select-Object -First 1

    if (-not $chosen) {
        $chosen = $keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1
    }
    if (-not $chosen) {
        throw 'Supabase server secret/service_role key олдсонгүй.'
    }

    $keyValue = $chosen.api_key
    if (-not $keyValue) { $keyValue = $chosen.key }
    if (-not $keyValue) { $keyValue = $chosen.value }
    if (-not $keyValue) {
        throw 'Supabase server key хоосон байна.'
    }

    $environmentName = 'SUPABASE_SERVICE_ROLE_KEY'
    if ($chosen.name -match 'secret' -or $keyValue -like 'sb_secret_*') {
        $environmentName = 'SUPABASE_SECRET_KEY'
    }

    Write-Ok 'Database + storage + private chat + trailer + 30 хоногийн cleanup бэлэн.'
    return [pscustomobject]@{
        Ref = $projectRef
        Url = "https://$projectRef.supabase.co"
        ServerKey = $keyValue
        ServerEnvName = $environmentName
    }
}

function Ensure-VercelLogin {
    $probe = Invoke-Capture -Command 'npx' -Arguments @(
        '--yes', 'vercel@latest', 'whoami'
    ) -Label 'Vercel auth probe' -AllowFail

    if ($probe.Code -ne 0) {
        Write-Host 'КЛИЕНТИЙН Vercel аккаунтаар нэвтэрнэ үү.' -ForegroundColor Yellow
        & npx --yes vercel@latest login
        if ($LASTEXITCODE -ne 0) {
            throw 'Vercel login амжилтгүй.'
        }
    }
}

function Set-VercelEnvironment {
    param(
        [string]$Name,
        [string]$Value,
        [switch]$Sensitive
    )

    $tempPath = Join-Path $env:TEMP ('taza-env-' + [guid]::NewGuid().ToString('N') + '.txt')
    try {
        Write-Utf8NoBom -Path $tempPath -Text $Value
        if ($Sensitive) {
            Get-Content $tempPath -Raw | & npx --yes vercel@latest env add $Name production --force --sensitive *> $null
        } else {
            Get-Content $tempPath -Raw | & npx --yes vercel@latest env add $Name production --force *> $null
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Vercel environment variable нэмэгдсэнгүй: $Name"
        }
    } finally {
        Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-VercelProductionUrl([string]$Text) {
    $aliases = [regex]::Matches(
        $Text,
        '(?im)Aliased:\s*(https://[A-Za-z0-9.-]+\.vercel\.app)'
    )
    if ($aliases.Count -gt 0) {
        return $aliases[$aliases.Count - 1].Groups[1].Value.TrimEnd('/')
    }

    $urls = [regex]::Matches($Text, 'https://[A-Za-z0-9.-]+\.vercel\.app')
    if ($urls.Count -gt 0) {
        return $urls[$urls.Count - 1].Value.TrimEnd('/')
    }

    return $null
}

function Setup-Vercel($Config, [string]$TargetDir, $Supabase, [string]$AdminPassword, [string]$SmsSecret) {
    Write-Step 'Vercel project + Git auto deploy тохируулж байна'
    Ensure-VercelLogin

    Push-Location $TargetDir
    try {
        $link = Invoke-Capture -Command 'npx' -Arguments @(
            '--yes', 'vercel@latest', 'link', '--yes', '--project', $Config.RepoName
        ) -Label 'Vercel link' -AllowFail

        if ($link.Code -ne 0) {
            Write-WarningText 'Vercel scope/project-оо нэг удаа гараар сонгоно.'
            & npx --yes vercel@latest link
            if ($LASTEXITCODE -ne 0) {
                throw 'Vercel project link амжилтгүй.'
            }
        }

        $gitConnect = Invoke-Capture -Command 'npx' -Arguments @(
            '--yes', 'vercel@latest', 'git', 'connect', '--yes'
        ) -Label 'Vercel Git connect' -AllowFail
        if ($gitConnect.Code -ne 0) {
            Write-WarningText 'Git auto-deploy автоматаар холбогдсонгүй. CLI deploy ажиллана; дараа Vercel → Git хэсэгт repo-г холбоно.'
        }

        Set-VercelEnvironment -Name 'SUPABASE_URL' -Value $Supabase.Url
        Set-VercelEnvironment -Name $Supabase.ServerEnvName -Value $Supabase.ServerKey -Sensitive
        Set-VercelEnvironment -Name 'ADMIN_PASSWORD' -Value $AdminPassword -Sensitive
        Set-VercelEnvironment -Name 'SMS_WEBHOOK_SECRET' -Value $SmsSecret -Sensitive
        Set-VercelEnvironment -Name 'SMS_ALLOWED_SENDER' -Value $Config.SmsSender
        if ($Config.MessengerUrl) {
            Set-VercelEnvironment -Name 'MESSENGER_URL' -Value $Config.MessengerUrl
        }

        $firstDeploy = Invoke-Capture -Command 'npx' -Arguments @(
            '--yes', 'vercel@latest', '--prod', '--yes'
        ) -Label 'Vercel first production deploy'

        $siteUrl = Get-VercelProductionUrl $firstDeploy.Text
        if (-not $siteUrl) {
            throw 'Vercel production URL автоматаар олдсонгүй.'
        }

        Set-VercelEnvironment -Name 'SITE_URL' -Value $siteUrl

        $finalDeploy = Invoke-Capture -Command 'npx' -Arguments @(
            '--yes', 'vercel@latest', '--prod', '--yes'
        ) -Label 'Vercel final production deploy'

        $finalUrl = Get-VercelProductionUrl $finalDeploy.Text
        if ($finalUrl) {
            $siteUrl = $finalUrl
        }

        if ($Config.CustomDomain) {
            $domainResult = Invoke-Capture -Command 'npx' -Arguments @(
                '--yes', 'vercel@latest', 'domains', 'add',
                $Config.CustomDomain, $Config.RepoName
            ) -Label 'Vercel custom domain' -AllowFail
            if ($domainResult.Code -ne 0) {
                Write-WarningText 'Custom domain автоматаар нэмэгдээгүй. NEXT-STEPS.txt-д заавар үлдээнэ.'
            }
        }

        Write-Ok "Production: $siteUrl"
        return $siteUrl
    } finally {
        Pop-Location
    }
}

function Convert-ToJsonInner([string]$Value) {
    $quoted = $Value | ConvertTo-Json -Compress
    if ($quoted.Length -ge 2) {
        return $quoted.Substring(1, $quoted.Length - 2)
    }
    return ''
}

function Read-MacroTemplate {
    $base64Path = Join-Path $PSScriptRoot 'macro-template.mdr.gz.b64'
    $base64 = (Get-Content $base64Path -Raw).Trim()
    $bytes = [Convert]::FromBase64String($base64)
    $input = New-Object IO.MemoryStream(, $bytes)
    $gzip = New-Object IO.Compression.GZipStream($input, [IO.Compression.CompressionMode]::Decompress)
    $reader = New-Object IO.StreamReader($gzip, [Text.Encoding]::UTF8)
    try {
        return $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
        $gzip.Dispose()
        $input.Dispose()
    }
}

function New-ClientMacroDroid($Config, [string]$SiteUrl, [string]$SmsSecret, [string]$TargetDir) {
    Write-Step 'Клиентэд зориулсан MacroDroid backup үүсгэж байна'

    $macro = Read-MacroTemplate
    $macro = $macro.Replace('__TAZA_SMS_ENDPOINT__', (Convert-ToJsonInner "$SiteUrl/api/sms"))
    $macro = $macro.Replace('__TAZA_SMS_SECRET__', (Convert-ToJsonInner $SmsSecret))
    $macro = $macro.Replace('__TAZA_SMS_SENDER__', (Convert-ToJsonInner $Config.SmsSender))

    if ($macro -match '__TAZA_') {
        throw 'MacroDroid placeholder бүрэн солигдсонгүй.'
    }

    try {
        $null = $macro | ConvertFrom-Json
    } catch {
        throw 'Үүссэн MacroDroid файл JSON биш байна.'
    }

    $outputDir = Join-Path $TargetDir 'OUTPUT'
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    $macroPath = Join-Path $outputDir ($Config.RepoName + '-macrodroid.mdr')
    Write-Utf8NoBom -Path $macroPath -Text $macro

    Write-Ok $macroPath
    return $macroPath
}

function Test-Http200([string]$Url) {
    for ($attempt = 0; $attempt -lt 18; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 5
    }
    return $false
}

function Test-Deployment([string]$SiteUrl, [string]$SmsSecret, [string]$Sender) {
    Write-Step 'Live сайтыг шалгаж байна'

    foreach ($path in @('/api/health', '/api/settings', '/api/catalog')) {
        if (-not (Test-Http200 ($SiteUrl + $path))) {
            throw "Live шалгалт унав: $path"
        }
        Write-Ok "$path 200"
    }

    $statusCode = 0
    try {
        $headers = @{
            Authorization = "Bearer $SmsSecret"
            'X-SMS-Sender' = $Sender
        }
        $response = Invoke-WebRequest \
            -Uri ($SiteUrl + '/api/sms') \
            -Method Post \
            -Headers $headers \
            -ContentType 'text/plain' \
            -Body 'KINO_QUEUE_TEST_V1' \
            -UseBasicParsing \
            -TimeoutSec 20
        $statusCode = [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
    }

    if ($statusCode -ne 400) {
        throw "SMS endpoint fake test 400 хариу өгөх ёстой, харин $statusCode ирлээ. Secret/sender/env-г шалгана уу."
    }

    Write-Ok 'SMS endpoint + secret + sender баталгаажлаа (аюулгүй fake test).'
}

function Write-RecoveryFiles {
    param(
        $Config,
        [string]$TargetDir,
        [string]$SiteUrl,
        [string]$RepoUrl,
        $Supabase,
        [string]$AdminPassword,
        [string]$SmsSecret,
        [string]$DbPassword,
        [string]$MacroPath
    )

    $outputDir = Join-Path $TargetDir 'OUTPUT'
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

    $recovery = @"
КЛИЕНТИЙН НУУЦ СЭРГЭЭХ МЭДЭЭЛЭЛ
================================
Зөвхөн тухайн клиент хадгална. Өөрийн плаш дээр бүү үлдээ.

Сайт: $($Config.SiteName)
Production URL: $SiteUrl
GitHub: $RepoUrl
Supabase project ref: $($Supabase.Ref)
Supabase DB password: $DbPassword
Админ нууц: $AdminPassword
SMS sender: $($Config.SmsSender)
SMS webhook secret: $SmsSecret
MacroDroid файл: $MacroPath
Custom domain: $($Config.CustomDomain)

Supabase server secret/service key нь зориуд энэ файлд бичигдээгүй.
Тэр нь Vercel Environment Variables-д хадгалагдсан.
"@
    Write-Utf8NoBom -Path (Join-Path $outputDir 'CLIENT-RECOVERY.txt') -Text $recovery

    $nextSteps = @"
ДАРААГИЙН АЛХАМ
================
1. Android утсанд MacroDroid суулгана.
2. $([IO.Path]::GetFileName($MacroPath))-г Import хийнэ.
3. SMS / Notification permission өгч, Battery → Unrestricted болгоно.
4. Wi-Fi + дата OFF → 03 Холболт турших → дараа интернет ON.
   kino_sms_test_ok=True, kino_sms_status=ОФЛАЙН ТУРШИЛТ АМЖИЛТТАЙ бол зөв.
5. Сайт → Админ → Тохиргоо дээр банкны нэр / эзэмшигч / дансны дугаарыг нүдээр шалгана.
6. Custom domain ашиглах бол DNS бүрэн холбогдсоны дараа Vercel дахь SITE_URL-ийг
   https://домэйн утгаар update хийгээд production redeploy хийнэ.
   MacroDroid endpoint-ийг Vercel URL дээр хэвээр үлдээж болно.

Кино / видео контентын түгээх эрхийг клиент өөрөө хариуцна.
"@
    Write-Utf8NoBom -Path (Join-Path $outputDir 'NEXT-STEPS.txt') -Text $nextSteps
}

try {
    Write-Host 'TAZA SITE MASTER — ШИНЭ КЛИЕНТ СУУЛГАЦ' -ForegroundColor Green
    Write-Host 'Production main сайт руу энэ installer бичихгүй.' -ForegroundColor DarkGray

    $config = Show-SetupWizard
    if (-not $config) {
        Write-Host 'Цуцлагдлаа.'
        exit 2
    }

    $config.RepoName = Convert-ToSlug $config.RepoName
    $adminPassword = if ($config.AdminPassword) { $config.AdminPassword } else { New-HexSecret 20 }
    $smsSecret = New-HexSecret 32
    $dbPassword = New-HexSecret 24

    Ensure-Prerequisites
    New-Item -ItemType Directory -Force -Path $ClientRoot | Out-Null

    $targetDir = Join-Path $ClientRoot $config.RepoName
    if (Test-Path $targetDir) {
        $targetDir = Join-Path $ClientRoot ($config.RepoName + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    }

    Copy-ClientSource -TargetDir $targetDir
    Patch-ClientSource -Config $config -TargetDir $targetDir

    $repoUrl = Setup-GitHub -Config $config -TargetDir $targetDir
    $supabase = Setup-Supabase -Config $config -TargetDir $targetDir -DbPassword $dbPassword
    $siteUrl = Setup-Vercel \
        -Config $config \
        -TargetDir $targetDir \
        -Supabase $supabase \
        -AdminPassword $adminPassword \
        -SmsSecret $smsSecret

    $macroPath = New-ClientMacroDroid \
        -Config $config \
        -SiteUrl $siteUrl \
        -SmsSecret $smsSecret \
        -TargetDir $targetDir

    Test-Deployment -SiteUrl $siteUrl -SmsSecret $smsSecret -Sender $config.SmsSender
    Write-RecoveryFiles \
        -Config $config \
        -TargetDir $targetDir \
        -SiteUrl $siteUrl \
        -RepoUrl $repoUrl \
        -Supabase $supabase \
        -AdminPassword $adminPassword \
        -SmsSecret $smsSecret \
        -DbPassword $dbPassword \
        -MacroPath $macroPath

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '  ✅ СУУЛГАЛТ АМЖИЛТТАЙ' -ForegroundColor Green
    Write-Host "  Сайт: $siteUrl" -ForegroundColor Green
    Write-Host "  Файлууд: $targetDir\OUTPUT" -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green

    Start-Process $siteUrl
    Start-Process (Join-Path $targetDir 'OUTPUT')
    try {
        [System.Windows.Forms.MessageBox]::Show(
            "Суулгалт амжилттай.`n$siteUrl`n`nOUTPUT → NEXT-STEPS.txt-ийг дагана уу.",
            'TAZA SETUP'
        ) | Out-Null
    } catch {}

    exit 0
} catch {
    Write-Host ''
    Write-Host ('[АЛДАА] ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Production сайт өөрчлөгдөөгүй. Алдааг зассаны дараа дахин ажиллуулж болно.' -ForegroundColor Yellow
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            'TAZA SETUP — Алдаа'
        ) | Out-Null
    } catch {}
    exit 1
}
