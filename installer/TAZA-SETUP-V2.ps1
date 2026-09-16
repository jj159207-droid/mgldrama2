$ErrorActionPreference='Stop'
Set-StrictMode -Version 2.0
try{[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false);$OutputEncoding=[Console]::OutputEncoding}catch{}

$MasterRoot=Split-Path -Parent $PSScriptRoot
$ClientRoot='C:\TAZA-CLIENTS'

function Step([string]$s){Write-Host '';Write-Host "==> $s" -ForegroundColor Cyan}
function Ok([string]$s){Write-Host "[OK] $s" -ForegroundColor Green}
function Warn([string]$s){Write-Host "[АНХААР] $s" -ForegroundColor Yellow}
function Utf8([string]$p,[string]$s){[IO.File]::WriteAllText($p,$s,(New-Object Text.UTF8Encoding($false)))}
function Secret([int]$n=24){$b=New-Object byte[] $n;$r=[Security.Cryptography.RandomNumberGenerator]::Create();try{$r.GetBytes($b)}finally{$r.Dispose()};([BitConverter]::ToString($b)).Replace('-','').ToLowerInvariant()}
function Slug([string]$s){$x=($s.ToLowerInvariant()-replace '[^a-z0-9._-]+','-').Trim('-','.');$x=$x-replace '-+','-';if(!$x){$x='taza-site-client'};if($x.Length-gt 80){$x=$x.Substring(0,80).TrimEnd('-','.')};$x}
function RefreshPath{$env:Path=([Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'))}

function Capture([string]$cmd,[string[]]$args,[string]$label,[switch]$AllowFail){
  $o=& $cmd @args 2>&1;$c=$LASTEXITCODE;$t=($o|ForEach-Object{"$_"})-join"`n"
  if($c-ne 0-and !$AllowFail){throw "$label амжилтгүй.`n$t"}
  [pscustomobject]@{Code=$c;Text=$t}
}
function LooseJson([string]$t){
  if(!$t){return $null};try{return $t|ConvertFrom-Json}catch{}
  $l=$t-split"`r?`n";for($i=0;$i-lt$l.Count;$i++){if($l[$i].TrimStart().StartsWith('{')-or$l[$i].TrimStart().StartsWith('[')){try{return(($l[$i..($l.Count-1)]-join"`n")|ConvertFrom-Json)}catch{}}};throw 'CLI JSON хариуг уншиж чадсангүй.'
}
function EnsureTool([string]$cmd,[string]$id,[string]$name){
  if(Get-Command $cmd -ErrorAction SilentlyContinue){return};if(!(Get-Command winget -ErrorAction SilentlyContinue)){throw "$name хэрэгтэй. winget/App Installer олдсонгүй."}
  Step "$name суулгаж байна";& winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  if($LASTEXITCODE-ne 0){throw "$name суусангүй."};RefreshPath;if(!(Get-Command $cmd -ErrorAction SilentlyContinue)){throw "$name суусан. Компьютер restart хийгээд START-HERE.cmd-г дахин ажиллуулна уу."}
}
function Prereqs{
  Step 'Git, Node.js, GitHub CLI шалгаж байна';EnsureTool git Git.Git Git;EnsureTool node OpenJS.NodeJS.LTS 'Node.js LTS';EnsureTool gh GitHub.cli 'GitHub CLI';RefreshPath
  if(!(Get-Command npx -ErrorAction SilentlyContinue)){throw 'npx олдсонгүй.'};$m=[int](((& node -v).Trim()).TrimStart('v').Split('.')[0]);if($m-lt22){throw 'Node.js 22+ шаардлагатай.'};Ok 'Үндсэн хэрэгслүүд бэлэн.'
}

function Field($form,[string]$label,[int]$y,[string]$value='',[switch]$Password){$l=New-Object Windows.Forms.Label;$l.Text=$label;$l.Location=New-Object Drawing.Point(20,$y);$l.Size=New-Object Drawing.Size(205,24);$form.Controls.Add($l);$t=New-Object Windows.Forms.TextBox;$t.Text=$value;$t.Location=New-Object Drawing.Point(230,$y-2);$t.Size=New-Object Drawing.Size(350,28);if($Password){$t.UseSystemPasswordChar=$true};$form.Controls.Add($t);$t}
function Wizard{
  Add-Type -AssemblyName System.Windows.Forms;Add-Type -AssemblyName System.Drawing
  $f=New-Object Windows.Forms.Form;$f.Text='TAZA SITE MASTER — Шинэ клиент';$f.StartPosition='CenterScreen';$f.Size=New-Object Drawing.Size(625,655);$f.FormBorderStyle='FixedDialog';$f.MaximizeBox=$false;$f.Font=New-Object Drawing.Font('Segoe UI',10)
  $h=New-Object Windows.Forms.Label;$h.Text='Тусдаа GitHub + Supabase + Vercel + MacroDroid сайт үүсгэнэ.';$h.Location=New-Object Drawing.Point(20,15);$h.Size=New-Object Drawing.Size(560,35);$f.Controls.Add($h)
  $site=Field $f 'Сайтын нэр' 65 'ТАЗА САЙТ';$repo=Field $f 'Төслийн нэр (англи)' 110 'taza-site-client';$bank=Field $f 'Банкны нэр' 155 'Хаан банк';$owner=Field $f 'Данс эзэмшигч' 200;$acct=Field $f 'Дансны дугаар' 245;$sender=Field $f 'SMS илгээгч' 290 'Khan Bank';$msg=Field $f 'Messenger (заавал биш)' 335;$domain=Field $f 'Домэйн (заавал биш)' 380;$admin=Field $f 'Админ нууц (хоосон=auto)' 425 '' -Password
  $info=New-Object Windows.Forms.Label;$info.Text='Secret бүрийг шинэ клиентэд шинээр үүсгэнэ. Манай production secret ашиглагдахгүй.';$info.Location=New-Object Drawing.Point(20,470);$info.Size=New-Object Drawing.Size(560,40);$f.Controls.Add($info)
  $err=New-Object Windows.Forms.Label;$err.ForeColor=[Drawing.Color]::Firebrick;$err.Location=New-Object Drawing.Point(20,510);$err.Size=New-Object Drawing.Size(560,35);$f.Controls.Add($err)
  $cancel=New-Object Windows.Forms.Button;$cancel.Text='Болих';$cancel.Location=New-Object Drawing.Point(260,560);$cancel.Size=New-Object Drawing.Size(95,38);$f.Controls.Add($cancel)
  $go=New-Object Windows.Forms.Button;$go.Text='Суулгалтыг эхлүүлэх';$go.Location=New-Object Drawing.Point(370,560);$go.Size=New-Object Drawing.Size(210,38);$f.Controls.Add($go)
  $script:R=$null;$cancel.Add_Click({$f.Close()});$go.Add_Click({
    $sn=$site.Text.Trim();$rn=Slug $repo.Text;if($sn.Length-lt2-or$sn-match'[<>"]'){$err.Text='Сайтын нэр буруу.';return};if($owner.Text.Trim().Length-lt2){$err.Text='Данс эзэмшигчийн нэр оруул.';return};if($acct.Text.Trim()-notmatch'^[A-Za-z0-9 -]{6,40}$'){$err.Text='Дансны дугаар 6–40 тэмдэгт.';return};if($sender.Text.Trim().Length-lt2){$err.Text='SMS илгээгч оруул.';return};if($admin.Text.Length-gt0-and$admin.Text.Length-lt16){$err.Text='Админ нууц 16+ тэмдэгт эсвэл хоосон.';return};if($msg.Text.Trim()-and$msg.Text.Trim()-notmatch'^https://'){$err.Text='Messenger https:// гэж эхэлнэ.';return}
    $script:R=[pscustomobject]@{Site=$sn;Repo=$rn;Bank=$bank.Text.Trim();Owner=$owner.Text.Trim();Account=$acct.Text.Trim();Sender=$sender.Text.Trim();Messenger=$msg.Text.Trim();Domain=$domain.Text.Trim();Admin=$admin.Text};$f.Close()
  });[void]$f.ShowDialog();$script:R
}

function CopySource([string]$target){
  Step 'MASTER-ээс тусдаа client source хуулж байна';New-Item -ItemType Directory -Force $target|Out-Null
  $xd=@('.git','.github','.next','node_modules','installer','.vercel','.supabase','OUTPUT');$a=@($MasterRoot,$target,'/E','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD')+$xd+@('/XF','START-HERE.cmd','.env','.env.local','*.log')
  & robocopy @a|Out-Null;if($LASTEXITCODE-ge8){throw "Файл хуулалт алдаа: $LASTEXITCODE"};Ok $target
}
function PatchSource($c,[string]$target){
  Step 'Клиентийн брэнд ба дансыг кодонд тохируулж байна';$p=Join-Path $target 'app\page.tsx';$s=Get-Content $p -Raw -Encoding UTF8;$bj=$c.Bank|ConvertTo-Json -Compress;$nj=$c.Account|ConvertTo-Json -Compress;$oj=$c.Owner|ConvertTo-Json -Compress;$rep="const DEFAULT_BANK_ACCOUNT = {`n  bank: $bj,`n  number: $nj,`n  name: $oj,`n};";$n=[regex]::Replace($s,'const DEFAULT_BANK_ACCOUNT = \{[\s\S]*?\};',$rep,1);if($n-eq$s){throw 'Bank default anchor олдсонгүй.'};Utf8 $p $n
  foreach($d in @('app','public')){$r=Join-Path $target $d;if(Test-Path$r){Get-ChildItem $r -Recurse -File|Where-Object{$_.Extension-in@('.ts','.tsx','.js','.jsx','.json','.css','.webmanifest','.html')}|ForEach-Object{$x=Get-Content $_.FullName -Raw -Encoding UTF8;if($x.Contains('ТАЗА САЙТ')){Utf8 $_.FullName ($x.Replace('ТАЗА САЙТ',$c.Site))}}}}
  Ok 'Брэнд/дансны fallback тусгаарлагдлаа.'
}

function GitHubSetup($c,[string]$target){
  Step 'GitHub private repo үүсгэж байна';& gh auth status *> $null;if($LASTEXITCODE-ne0){Write-Host 'Browser дээр КЛИЕНТИЙН GitHub-аар нэвтэрнэ.' -ForegroundColor Yellow;& gh auth login --web --git-protocol https;if($LASTEXITCODE-ne0){throw 'GitHub login алдаа.'}}
  $u=(& gh api user -q .login).Trim();& gh repo view "$u/$($c.Repo)" *> $null;if($LASTEXITCODE-eq0){throw "GitHub repo $($c.Repo) аль хэдийн байна. Төслийн өөр нэр сонгоод дахин эхлүүлнэ үү."}
  Push-Location $target;try{& git init -b main|Out-Null;& git config user.name $u;& git config user.email "$u@users.noreply.github.com";& git add .;& git commit -m 'Initial client site'|Out-Null;if($LASTEXITCODE-ne0){throw 'Git commit алдаа.'};$null=Capture gh @('repo','create',$c.Repo,'--private','--source','.','--remote','origin','--push') 'GitHub repo';$url=(& gh repo view --json url -q .url).Trim();Ok "Private repo: $url";$url}finally{Pop-Location}
}

function SupaLogin{$q=Capture npx @('--yes','supabase@latest','projects','list','-o','json') 'Supabase auth' -AllowFail;if($q.Code-ne0){Write-Host 'КЛИЕНТИЙН Supabase аккаунтаар browser login хийнэ.' -ForegroundColor Yellow;& npx --yes supabase@latest login;if($LASTEXITCODE-ne0){throw 'Supabase login алдаа.'}}}
function SupaOrg{
  $d=LooseJson (Capture npx @('--yes','supabase@latest','orgs','list','-o','json') 'Supabase orgs').Text;$a=@($d);if($d-and$d.PSObject.Properties.Name-contains'organizations'){$a=@($d.organizations)};if(!$a.Count){throw 'Supabase organization байхгүй.'};if($a.Count-eq1){return$a[0].id};Write-Host 'Supabase organization сонго:' -ForegroundColor Yellow;for($i=0;$i-lt$a.Count;$i++){Write-Host " $($i+1). $($a[$i].name)"};$n=0;do{$z=Read-Host 'Дугаар';$ok=[int]::TryParse($z,[ref]$n)}while(!$ok-or$n-lt1-or$n-gt$a.Count);$a[$n-1].id
}
function CopyMig([string]$src,[string]$dst){if(!(Test-Path$src)){throw "Migration олдсонгүй: $src"};Utf8 $dst (Get-Content $src -Raw -Encoding UTF8)}
function BuildMigrations($c,[string]$target,[string]$work){
  Push-Location $work;try{& npx --yes supabase@latest init|Out-Null;if($LASTEXITCODE-ne0){throw 'supabase init алдаа.'}}finally{Pop-Location};$m=Join-Path $work 'supabase\migrations';New-Item -ItemType Directory -Force $m|Out-Null;Get-ChildItem$m -File -ErrorAction SilentlyContinue|Remove-Item -Force
  $x=@(@('20260916090001_core.sql','supabase\review-install.sql'),@('20260916090002_https.sql','supabase\HTTPS-UPGRADE.sql'),@('20260916090003_chat.sql','supabase\migrations\20260915183329_private_support_chat.sql'),@('20260916090004_chat_actions.sql','supabase\migrations\20260915200520_chat_access_actions.sql'),@('20260916090005_appearance.sql','supabase\migrations\20260916032117_site_appearance.sql'),@('20260916090006_trailers.sql','supabase\trailers.sql'));foreach($q in$x){CopyMig (Join-Path$target $q[1]) (Join-Path$m $q[0])}
  $settings=[ordered]@{messengerUrl=$c.Messenger;bankName=$c.Bank;bankAccount=$c.Account;accountName=$c.Owner}|ConvertTo-Json -Compress;$settings=$settings.Replace("'","''");Utf8 (Join-Path$m '20260916090007_client_settings.sql') "select * from public.kino_save_settings('$settings');`n"
  $cl=@"
create extension if not exists pg_cron with schema pg_catalog;
do `$c`$ begin perform cron.unschedule(j.jobid) from cron.job j where j.jobname='cleanup-old-payment-records'; end `$c`$;
select cron.schedule('cleanup-old-payment-records','15 3 * * *',`$j`$
 delete from public.pending_payments where status in ('pending','revoked') and created_at < now()-interval '30 days';
 delete from public.sms_logs where created_at < now()-interval '30 days' and coalesce(key,'')<>'site_settings';
`$j`$);
"@;Utf8 (Join-Path$m '20260916090008_cleanup.sql') $cl
}
function SupabaseSetup($c,[string]$target,[string]$dbpass){
  Step 'Supabase project + database үүсгэж байна';SupaLogin;$org=SupaOrg;$pn="$($c.Repo)-$(Get-Date -Format 'MMddHHmm')";$o=LooseJson (Capture npx @('--yes','supabase@latest','projects','create',$pn,'--org-id',$org,'--db-password',$dbpass,'--region','ap-southeast-1','-o','json') 'Supabase project create').Text;$ref=$o.id;if(!$ref){$ref=$o.ref};if(!$ref){$ref=$o.project_ref};if(!$ref){throw 'Supabase project ref олдсонгүй.'}
  Write-Host "Project ref: $ref";Step 'Supabase project бэлэн болохыг хүлээж байна';$ready=$false;for($i=0;$i-lt72;$i++){Start-Sleep -Seconds 5;$ls=LooseJson (Capture npx @('--yes','supabase@latest','projects','list','-o','json') 'Supabase project status').Text;$p=@($ls)|Where-Object{($_.id-eq$ref)-or($_.ref-eq$ref)}|Select-Object -First 1;if($p){$st="$($p.status)";if(!$st-or$st-match'ACTIVE|HEALTHY'){$ready=$true;break}}};if(!$ready){throw 'Supabase project 6 минутын дотор ready болсонгүй.'}
  $w=Join-Path$env:TEMP('taza-supa-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Force $w|Out-Null;try{BuildMigrations $c $target $w;Push-Location$w;try{$null=Capture npx @('--yes','supabase@latest','link','--project-ref',$ref,'--password',$dbpass) 'Supabase link';$null=Capture npx @('--yes','supabase@latest','db','push','--linked','--password',$dbpass,'--yes') 'Supabase db push'}finally{Pop-Location}}finally{Remove-Item$w -Recurse -Force -ErrorAction SilentlyContinue}
  $ko=LooseJson (Capture npx @('--yes','supabase@latest','projects','api-keys','--project-ref',$ref,'-o','json') 'Supabase keys').Text;$ka=@($ko);if($ko-and$ko.PSObject.Properties.Name-contains'api_keys'){$ka=@($ko.api_keys)};$chosen=$ka|Where-Object{$_.name-match'secret'-or$_.api_key-like'sb_secret_*'}|Select-Object -First 1;if(!$chosen){$chosen=$ka|Where-Object{$_.name-eq'service_role'}|Select-Object -First 1};if(!$chosen){throw 'Supabase server key олдсонгүй.'};$kv=$chosen.api_key;if(!$kv){$kv=$chosen.key};if(!$kv){$kv=$chosen.value};if(!$kv){throw 'Supabase server key хоосон.'};$en=if($chosen.name-match'secret'-or$kv-like'sb_secret_*'){'SUPABASE_SECRET_KEY'}else{'SUPABASE_SERVICE_ROLE_KEY'};Ok 'Database + storage + chat + cleanup бэлэн.';[pscustomobject]@{Ref=$ref;Url="https://$ref.supabase.co";Key=$kv;Env=$en}
}

function VLogin{$q=Capture npx @('--yes','vercel@latest','whoami') 'Vercel auth' -AllowFail;if($q.Code-ne0){Write-Host 'КЛИЕНТИЙН Vercel аккаунтаар login хийнэ.' -ForegroundColor Yellow;& npx --yes vercel@latest login;if($LASTEXITCODE-ne0){throw 'Vercel login алдаа.'}}}
function VEnv([string]$n,[string]$v){$p=Join-Path$env:TEMP('taza-env-'+[guid]::NewGuid().ToString('N'));try{Utf8$p$v;Get-Content$p -Raw|& npx --yes vercel@latest env add $n production --force *> $null;if($LASTEXITCODE-ne0){throw "Vercel env алдаа: $n"}}finally{Remove-Item$p -Force -ErrorAction SilentlyContinue}}
function VUrl([string]$t){$m=[regex]::Matches($t,'(?im)Aliased:\s*(https://[A-Za-z0-9.-]+\.vercel\.app)');if($m.Count){return$m[$m.Count-1].Groups[1].Value.TrimEnd('/')};$m=[regex]::Matches($t,'https://[A-Za-z0-9.-]+\.vercel\.app');if($m.Count){return$m[$m.Count-1].Value.TrimEnd('/')};$null}
function VercelSetup($c,[string]$target,$s,[string]$admin,[string]$sms){
  Step 'Vercel + Git auto deploy тохируулж байна';VLogin;Push-Location$target;try{$q=Capture npx @('--yes','vercel@latest','link','--yes','--project',$c.Repo) 'Vercel link' -AllowFail;if($q.Code-ne0){Warn 'Vercel scope/project-оо нэг удаа сонгоно.';& npx --yes vercel@latest link;if($LASTEXITCODE-ne0){throw 'Vercel link алдаа.'}};$g=Capture npx @('--yes','vercel@latest','git','connect','--yes') 'Vercel Git connect' -AllowFail;if($g.Code-ne0){Warn 'Git integration auto холбоогүй. CLI deploy ажиллана; Vercel Dashboard → Git дээр дараа repo холбоно.'}
    VEnv SUPABASE_URL $s.Url;VEnv $s.Env $s.Key;VEnv ADMIN_PASSWORD $admin;VEnv SMS_WEBHOOK_SECRET $sms;VEnv SMS_ALLOWED_SENDER $c.Sender;if($c.Messenger){VEnv MESSENGER_URL $c.Messenger}
    $d=Capture npx @('--yes','vercel@latest','--prod','--yes') 'Vercel deploy';$url=VUrl$d.Text;if(!$url){throw 'Vercel URL олдсонгүй.'};VEnv SITE_URL $url;$d2=Capture npx @('--yes','vercel@latest','--prod','--yes') 'Vercel final deploy';$u2=VUrl$d2.Text;if($u2){$url=$u2};if($c.Domain){$dom=Capture npx @('--yes','vercel@latest','domains','add',$c.Domain,$c.Repo) 'Custom domain add' -AllowFail;if($dom.Code-ne0){Warn 'Custom domain автоматаар нэмэгдээгүй. NEXT-STEPS.txt-д заавар үлдээнэ.'}};Ok "Production: $url";$url
  }finally{Pop-Location}
}

function Inner([string]$v){$q=$v|ConvertTo-Json -Compress;if($q.Length-ge2){$q.Substring(1,$q.Length-2)}else{''}}
function MacroText{$b=(Get-Content (Join-Path$PSScriptRoot'macro-template.mdr.gz.b64') -Raw).Trim();$a=[Convert]::FromBase64String($b);$ms=New-Object IO.MemoryStream(,$a);$gz=New-Object IO.Compression.GZipStream($ms,[IO.Compression.CompressionMode]::Decompress);$rd=New-Object IO.StreamReader($gz,[Text.Encoding]::UTF8);try{$rd.ReadToEnd()}finally{$rd.Dispose();$gz.Dispose();$ms.Dispose()}}
function MakeMacro($c,[string]$url,[string]$sms,[string]$target){Step 'MacroDroid backup үүсгэж байна';$x=MacroText;$x=$x.Replace('__TAZA_SMS_ENDPOINT__',(Inner "$url/api/sms")).Replace('__TAZA_SMS_SECRET__',(Inner$sms)).Replace('__TAZA_SMS_SENDER__',(Inner$c.Sender));if($x-match'__TAZA_'){throw 'Macro placeholder үлдсэн.'};try{$null=$x|ConvertFrom-Json}catch{throw 'Macro JSON алдаа.'};$o=Join-Path$target'OUTPUT';New-Item -ItemType Directory -Force$o|Out-Null;$p=Join-Path$o($c.Repo+'-macrodroid.mdr');Utf8$p$x;Ok$p;$p}
function Http200([string]$u){for($i=0;$i-lt18;$i++){try{$r=Invoke-WebRequest$u -UseBasicParsing -TimeoutSec 20;if($r.StatusCode-eq200){return$true}}catch{};Start-Sleep 5};$false}
function Verify([string]$url,[string]$sms,[string]$sender){Step 'Live site шалгаж байна';foreach($p in@('/api/health','/api/settings','/api/catalog')){if(!(Http200($url+$p))){throw "Live test failed: $p"};Ok "$p 200"};$code=0;try{$h=@{Authorization="Bearer $sms";'X-SMS-Sender'=$sender};$r=Invoke-WebRequest($url+'/api/sms') -Method Post -Headers$h -ContentType'text/plain' -Body'KINO_QUEUE_TEST_V1' -UseBasicParsing -TimeoutSec20;$code=[int]$r.StatusCode}catch{if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}};if($code-ne400){throw "SMS endpoint test: expected 400, got $code"};Ok 'SMS endpoint/secret/sender зөв.'}
function Recovery($c,[string]$target,[string]$url,[string]$repo,$s,[string]$admin,[string]$sms,[string]$db,[string]$macro){$o=Join-Path$target'OUTPUT';$r=@"
КЛИЕНТИЙН НУУЦ СЭРГЭЭХ МЭДЭЭЛЭЛ
================================
Зөвхөн клиент хадгална. Плаш дээр бүү үлдээ.

Сайт: $($c.Site)
Production URL: $url
GitHub: $repo
Supabase ref: $($s.Ref)
Supabase DB password: $db
Админ нууц: $admin
SMS sender: $($c.Sender)
SMS webhook secret: $sms
MacroDroid: $macro
Custom domain: $($c.Domain)

Supabase server secret нь зориуд энд бичигдээгүй; Vercel Environment Variables-д хадгалагдсан.
"@;Utf8(Join-Path$o'CLIENT-RECOVERY.txt')$r;$n=@"
ДАРААГИЙН АЛХАМ
================
1. Android утсанд MacroDroid суулгана.
2. $([IO.Path]::GetFileName($macro))-г Import хийнэ.
3. SMS/Notification permission өгч, Battery → Unrestricted болгоно.
4. Wi‑Fi + дата OFF → 03 Холболт турших → дараа интернет ON. kino_sms_test_ok=True, kino_sms_status=ОФЛАЙН ТУРШИЛТ АМЖИЛТТАЙ бол зөв.
5. Сайт → Админ → Тохиргоо дээр банкны нэр/эзэмшигч/дансыг нүдээр шалгана.
6. Custom domain ашиглах бол DNS бүрэн холбогдсоны дараа Vercel дахь SITE_URL-ийг https://домэйн болгож production redeploy хийнэ. MacroDroid endpoint-ийг заавал солих шаардлагагүй.

Кино/видео контентын түгээх эрхийг клиент өөрөө хариуцна.
"@;Utf8(Join-Path$o'NEXT-STEPS.txt')$n}

try{
  Write-Host 'TAZA SITE MASTER — ШИНЭ КЛИЕНТ СУУЛГАЦ' -ForegroundColor Green;Write-Host 'Production main сайт өөрчлөгдөхгүй.' -ForegroundColor DarkGray
  $c=Wizard;if(!$c){Write-Host'Цуцлагдлаа.';exit 2};$c.Repo=Slug$c.Repo;$admin=if($c.Admin){$c.Admin}else{Secret 20};$sms=Secret 32;$db=Secret 24
  Prereqs;New-Item -ItemType Directory -Force$ClientRoot|Out-Null;$target=Join-Path$ClientRoot$c.Repo;if(Test-Path$target){$target=Join-Path$ClientRoot($c.Repo+'-'+(Get-Date -Format'yyyyMMdd-HHmmss'))};CopySource$target;PatchSource$c$target
  $repo=GitHubSetup$c$target;$s=SupabaseSetup$c$target$db;$url=VercelSetup$c$target$s$admin$sms;$macro=MakeMacro$c$url$sms$target;Verify$url$sms$c.Sender;Recovery$c$target$url$repo$s$admin$sms$db$macro
  Write-Host '';Write-Host '============================================================' -ForegroundColor Green;Write-Host ' ✅ СУУЛГАЛТ АМЖИЛТТАЙ' -ForegroundColor Green;Write-Host " $url" -ForegroundColor Green;Write-Host " $target\OUTPUT" -ForegroundColor Green;Write-Host '============================================================' -ForegroundColor Green;Start-Process$url;Start-Process(Join-Path$target'OUTPUT');try{[Windows.Forms.MessageBox]::Show("Суулгалт амжилттай.`n$url`n`nOUTPUT → NEXT-STEPS.txt-ийг дагана уу.",'TAZA SETUP')|Out-Null}catch{};exit 0
}catch{Write-Host '';Write-Host('[АЛДАА] '+$_.Exception.Message)-ForegroundColor Red;Write-Host'Production сайт өөрчлөгдөөгүй. Алдааг зассаны дараа дахин оролдож болно.'-ForegroundColor Yellow;try{Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($_.Exception.Message,'TAZA SETUP — Алдаа')|Out-Null}catch{};exit 1}
