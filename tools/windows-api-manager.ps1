param([switch]$Minimized)
# Eclipse Order API manager: Windows PowerShell 5.1, Node.js 22+, current Windows user.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$server=Join-Path $repo 'server'
$logs=Join-Path $env:LOCALAPPDATA 'EclipseOrder\ApiManager\logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$new=$false
$mutex=New-Object System.Threading.Mutex($true,'Local\EclipseOrderApiManager',[ref]$new)
if(-not $new){[System.Windows.Forms.MessageBox]::Show('API manager already running. Check the system tray.')|Out-Null;$mutex.Dispose();exit}
$script:child=$null
$script:stopped=$false
$script:exiting=$false
$script:attempt=[datetime]::MinValue
$script:revision=''
$script:pending=''
$script:stable=0
$script:status='Initializing...'
$script:port=3182
$envPath=Join-Path $server '.env'
if(Test-Path $envPath){
 $portLine=Get-Content $envPath | Where-Object {$_ -match '^\s*API_PORT\s*=\s*[0-9]+\s*$'} | Select-Object -Last 1
 if($portLine -match '([0-9]+)\s*$'){$script:port=[int]$Matches[1]}
}
function Revision {
 try {$v=& git -C $repo rev-parse HEAD 2>$null; if($LASTEXITCODE -eq 0){return "$v".Trim()}}catch{}
 return ''
}
function Healthy([string]$path) {
 try {
  $r=[System.Net.HttpWebRequest]::Create("http://127.0.0.1:$($script:port)$path")
  $r.Method='GET';$r.Timeout=1300;$r.Proxy=$null
  $response=$r.GetResponse()
  $ok=([int]$response.StatusCode -eq 200)
  $response.Close()
  return $ok
 }catch{return $false}
}
function StopApi {
 if($null -eq $script:child){return}
 try {
  $script:child.Refresh()
  if(-not $script:child.HasExited){Stop-Process -Id $script:child.Id -Force -ErrorAction SilentlyContinue}
  $script:child.Dispose()
 }catch{}
 $script:child=$null
}
function StartApi {
 $script:attempt=Get-Date
 if(-not (Test-Path $envPath)){$script:status='Missing private server/.env';return}
 try {$node=(Get-Command node.exe -ErrorAction Stop).Source}
 catch {$script:status='Node.js was not found on PATH';return}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
 try {
  $script:child=Start-Process -FilePath $node -ArgumentList '--env-file=.env','src/server.js' -WorkingDirectory $server -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$stamp-out.log") -RedirectStandardError (Join-Path $logs "$stamp-error.log")
  $script:status="Started API process $($script:child.Id)"
 }catch{$script:child=$null;$script:status="Start failed: $($_.Exception.Message)"}
}
function RestartApi([string]$reason){StopApi;$script:status=$reason;StartApi}
function DatabaseService {
 try {$s=Get-Service | Where-Object {$_.Name -match '^(MySQL|MariaDB)'} | Select-Object -First 1
  if($s){return "$($s.DisplayName): $($s.Status)"}
 }catch{}
 return 'No MySQL/MariaDB service found'
}
$form=New-Object System.Windows.Forms.Form
$form.Text='Eclipse Order - API Control Center'
$form.Size=New-Object System.Drawing.Size(540,320)
$form.MinimumSize=$form.Size
$form.StartPosition='CenterScreen'
$form.BackColor=[System.Drawing.Color]::FromArgb(26,37,48)
$form.ForeColor=[System.Drawing.Color]::FromArgb(231,233,231)
$form.Font=New-Object System.Drawing.Font('Segoe UI',10)
function Label([string]$text,[int]$top,[int]$height) {
 $l=New-Object System.Windows.Forms.Label
 $l.Text=$text;$l.SetBounds(22,$top,488,$height);$form.Controls.Add($l)
 return $l
}
$head=Label 'ECLIPSE ORDER  /  SERVER CONTROL' 18 34
$head.Font=New-Object System.Drawing.Font('Segoe UI',13,[System.Drawing.FontStyle]::Bold)
$head.ForeColor=[System.Drawing.Color]::FromArgb(222,191,140)
$apiLabel=Label 'API: STARTING' 67 28
$dbLabel=Label 'Database: checking' 100 28
$revLabel=Label 'Git revision: checking' 133 28
$info=Label 'Initializing...' 168 46
$info.ForeColor=[System.Drawing.Color]::FromArgb(172,189,201)
function Button([string]$name,[int]$x,[int]$width,[scriptblock]$action) {
 $b=New-Object System.Windows.Forms.Button
 $b.Text=$name;$b.SetBounds($x,225,$width,34)
 $b.FlatStyle='Flat';$b.BackColor=[System.Drawing.Color]::FromArgb(32,42,51)
 $b.ForeColor=$form.ForeColor;$b.Add_Click($action);$form.Controls.Add($b)
}
Button 'START' 22 100 {$script:stopped=$false;if(-not $script:child){StartApi}}
Button 'RESTART' 132 100 {$script:stopped=$false;RestartApi 'Manually restarted'}
Button 'STOP' 242 100 {$script:stopped=$true;StopApi;$script:status='Stopped by user'}
Button 'OPEN LOGS' 352 145 {Start-Process explorer.exe -ArgumentList $logs}
$tray=New-Object System.Windows.Forms.NotifyIcon
$tray.Icon=[System.Drawing.SystemIcons]::Application
$tray.Text='Eclipse Order API'
$tray.Visible=$true
$menu=New-Object System.Windows.Forms.ContextMenuStrip
$open=$menu.Items.Add('Open control center')
$open.Add_Click({$form.Show();$form.WindowState='Normal';$form.Activate()})
$again=$menu.Items.Add('Restart API')
$again.Add_Click({$script:stopped=$false;RestartApi 'Restarted from tray'})
$exit=$menu.Items.Add('Exit and stop API')
$exit.Add_Click({$script:exiting=$true;$form.Close()})
$tray.ContextMenuStrip=$menu
$tray.Add_DoubleClick({$form.Show();$form.WindowState='Normal';$form.Activate()})
$script:revision=Revision
StartApi
$timer=New-Object System.Windows.Forms.Timer
$timer.Interval=5000
$timer.Add_Tick({
 try{
  $now=Revision
  if($now -and $now -ne $script:revision){
   if($now -eq $script:pending){$script:stable++}else{$script:pending=$now;$script:stable=1}
   if($script:stable -ge 2){
    $script:revision=$now;$script:pending='';$script:stable=0
    if(-not $script:stopped){RestartApi 'Git revision changed, restarting API'}
   }
  }else{$script:pending='';$script:stable=0}
  if($script:child){
   $script:child.Refresh()
   if($script:child.HasExited){StopApi;$script:status='API exited; recovery scheduled'}
  }
  if(-not $script:child -and -not $script:stopped -and ((Get-Date)-$script:attempt).TotalSeconds -gt 15){StartApi}
  $online=Healthy '/health'
  $ready=if($online){Healthy '/ready'}else{$false}
  $apiLabel.Text=if($online){"API: ONLINE (port $($script:port))"}else{"API: OFFLINE (port $($script:port))"}
  $apiLabel.ForeColor=if($online){[System.Drawing.Color]::FromArgb(169,223,195)}else{[System.Drawing.Color]::FromArgb(222,142,142)}
  $dbLabel.Text="Database: $(if($ready){'CONNECTED'}else{'NOT READY'}) | $(DatabaseService)"
  $revLabel.Text="Git revision: $(if($script:revision){$script:revision.Substring(0,12)}else{'unknown'})"
  $info.Text=$script:status
  $tray.Text=if($ready){'Eclipse Order API and database ready'}elseif($online){'Eclipse Order API running, database not ready'}else{'Eclipse Order API offline'}
 }catch{$script:status="Monitor error: $($_.Exception.Message)"}
})
$timer.Start()
$form.Add_FormClosing({if(-not $script:exiting){$_.Cancel=$true;$form.Hide()}})
if($Minimized){$form.Add_Shown({$form.Hide()})}
try{[System.Windows.Forms.Application]::Run($form)}
finally{
 $timer.Stop();StopApi;$tray.Visible=$false
 $tray.Dispose();$timer.Dispose();$mutex.ReleaseMutex();$mutex.Dispose()
}
