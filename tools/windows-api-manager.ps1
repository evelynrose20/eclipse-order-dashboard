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
$script:botChild=$null
$script:botStopped=$false
$script:botAttempt=[datetime]::MinValue
$script:botStatus='Not configured'
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
# A TCP listener can be present without being our API; do not take ownership.
function PortOccupied {
 $client=New-Object System.Net.Sockets.TcpClient
 try{
  $attempt=$client.BeginConnect('127.0.0.1',$script:port,$null,$null)
  if(-not $attempt.AsyncWaitHandle.WaitOne(500)){return $false}
  try{$client.EndConnect($attempt);return $true}catch{return $false}
 }catch{return $false}finally{$client.Close()}
}
function UnmanagedApi {
 return ($null -eq $script:child -and (PortOccupied))
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
 if($script:child){return}
 if(PortOccupied){
  $script:status="Port $($script:port) already in use. The Control Center will not start a duplicate. Stop the original API to hand over control."
  return
 }
 if(-not (Test-Path $envPath)){$script:status='Missing private server/.env';return}
 try {$node=(Get-Command node.exe -ErrorAction Stop).Source}
 catch {$script:status='Node.js was not found on PATH';return}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
 try {
  $script:child=Start-Process -FilePath $node -ArgumentList '--env-file=.env','src/server.js' -WorkingDirectory $server -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$stamp-out.log") -RedirectStandardError (Join-Path $logs "$stamp-error.log")
  $script:status="Started API process $($script:child.Id)"
 }catch{$script:child=$null;$script:status="Start failed: $($_.Exception.Message)"}
}
function RestartApi([string]$reason){
 if(UnmanagedApi){
  $script:status="Cannot restart: port $($script:port) belongs to a process not started by this Control Center."
  return
 }
 StopApi
 $script:status=$reason
 StartApi
}

# Discord event announcement bot: separate supervised child, no API port.
function BotConfigured {
 if(-not (Test-Path $envPath)){return $false}
 $value=Get-Content $envPath | Where-Object {$_ -match '^\s*DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID\s*=\s*[0-9]{15,25}\s*$'} | Select-Object -First 1
 return [bool]$value
}
function StopBot {
 if($null -eq $script:botChild){return}
 try{
  $script:botChild.Refresh()
  if(-not $script:botChild.HasExited){Stop-Process -Id $script:botChild.Id -Force -ErrorAction SilentlyContinue}
  $script:botChild.Dispose()
 }catch{}
 $script:botChild=$null
}
function StartBot {
 $script:botAttempt=Get-Date
 if($script:botChild){return}
 if(-not (BotConfigured)){$script:botStatus='Set DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID in server/.env';return}
 if(-not (Test-Path (Join-Path $server 'node_modules\discord.js'))){$script:botStatus='Run npm install in server folder';return}
 try{$node=(Get-Command node.exe -ErrorAction Stop).Source}
 catch{$script:botStatus='Node.js not found on PATH';return}
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
 try{
  $script:botChild=Start-Process -FilePath $node -ArgumentList '--env-file=.env','src/discord-event-bot.js' -WorkingDirectory $server -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$stamp-bot-out.log") -RedirectStandardError (Join-Path $logs "$stamp-bot-error.log")
  $script:botStatus="Started bot PID $($script:botChild.Id)"
 }catch{$script:botChild=$null;$script:botStatus="Bot start failed: $($_.Exception.Message)"}
}
function RestartBot {
 StopBot
 if(-not $script:botStopped){StartBot}
}

. (Join-Path $PSScriptRoot 'windows-api-maintenance.ps1')
$form=New-Object System.Windows.Forms.Form
$form.Text='Eclipse Order - API Control Center'
$form.Size=New-Object System.Drawing.Size(590,480)
$form.MinimumSize=$form.Size
$form.StartPosition='CenterScreen'
$form.BackColor=[System.Drawing.Color]::FromArgb(26,37,48)
$form.ForeColor=[System.Drawing.Color]::FromArgb(231,233,231)
$form.Font=New-Object System.Drawing.Font('Segoe UI',10)
function Label([string]$text,[int]$top,[int]$height) {
 $l=New-Object System.Windows.Forms.Label
 $l.Text=$text;$l.SetBounds(22,$top,530,$height);$form.Controls.Add($l)
 return $l
}
$head=Label 'ECLIPSE ORDER  /  SERVER CONTROL' 18 34
$head.Font=New-Object System.Drawing.Font('Segoe UI',13,[System.Drawing.FontStyle]::Bold)
$head.ForeColor=[System.Drawing.Color]::FromArgb(222,191,140)
$apiLabel=Label 'API: STARTING' 67 28
$dbLabel=Label 'Database: checking' 99 28
$migrationLabel=Label 'Database updates: checking' 132 28
$revLabel=Label 'Git revision: checking' 164 28
$botLabel=Label 'Discord bot: checking' 196 27
$info=Label 'Initializing...' 225 33
$info.ForeColor=[System.Drawing.Color]::FromArgb(172,189,201)
function Button([string]$name,[int]$x,[int]$width,[scriptblock]$action) {
 $b=New-Object System.Windows.Forms.Button
 $b.Text=$name;$b.SetBounds($x,270,$width,35)
 $b.FlatStyle='Flat';$b.BackColor=[System.Drawing.Color]::FromArgb(32,42,51)
 $b.ForeColor=$form.ForeColor;$b.Add_Click($action);$form.Controls.Add($b)
}
Button 'START' 22 108 {if(-not $script:updating){$script:stopped=$false;if(-not $script:child){StartApi}}}
Button 'RESTART' 138 108 {if(-not $script:updating){$script:stopped=$false;RestartApi 'Manually restarted'}}
Button 'STOP' 254 108 {if(-not $script:updating){
 $script:stopped=$true
 if(UnmanagedApi){$script:status='Unmanaged server detected. STOP will not terminate another process.'}
 else{StopApi;$script:status='Stopped by user'}
}}
Button 'OPEN LOGS' 370 186 {Start-Process explorer.exe -ArgumentList $logs}
$updateButton=New-Object System.Windows.Forms.Button
$updateButton.Text='CHECK / APPLY DATABASE UPDATES'
$updateButton.SetBounds(22,361,534,37)
function BotButton([string]$name,[int]$x,[int]$width,[scriptblock]$action) {
 $b=New-Object System.Windows.Forms.Button
 $b.Text=$name;$b.SetBounds($x,314,$width,35)
 $b.FlatStyle='Flat';$b.BackColor=[System.Drawing.Color]::FromArgb(32,42,51)
 $b.ForeColor=$form.ForeColor;$b.Add_Click($action);$form.Controls.Add($b)
}
BotButton 'START BOT' 22 170 {$script:botStopped=$false;StartBot}
BotButton 'RESTART BOT' 199 170 {$script:botStopped=$false;RestartBot}
BotButton 'STOP BOT' 376 180 {$script:botStopped=$true;StopBot;$script:botStatus='Stopped by user'}

$updateButton.FlatStyle='Flat'
$updateButton.BackColor=[System.Drawing.Color]::FromArgb(69,79,83)
$updateButton.ForeColor=[System.Drawing.Color]::FromArgb(241,218,188)
$updateButton.Add_Click({if(-not $script:updating){Show-DatabaseUpdateDialog}})
$form.Controls.Add($updateButton)
$tray=New-Object System.Windows.Forms.NotifyIcon
$tray.Icon=[System.Drawing.SystemIcons]::Application
$tray.Text='Eclipse Order API'
$tray.Visible=$true
$menu=New-Object System.Windows.Forms.ContextMenuStrip
$open=$menu.Items.Add('Open control center')
$open.Add_Click({$form.Show();$form.WindowState='Normal';$form.Activate()})
$again=$menu.Items.Add('Restart API')
$again.Add_Click({if(-not $script:updating){$script:stopped=$false;RestartApi 'Restarted from tray'}})
$exit=$menu.Items.Add('Exit and stop API')
$exit.Add_Click({if($script:updating){[System.Windows.Forms.MessageBox]::Show('Database setup is still running. Keep this app open until it completes.')|Out-Null;return};$script:exiting=$true;$form.Close()})
$tray.ContextMenuStrip=$menu
$tray.Add_DoubleClick({$form.Show();$form.WindowState='Normal';$form.Activate()})
$script:revision=Revision
StartBot
StartApi
Start-MigrationCheck
$timer=New-Object System.Windows.Forms.Timer
$timer.Interval=5000
$timer.Add_Tick({
 try{
  Finish-MigrationCheck
  Finish-DatabaseUpdate
  if(-not $script:checking -and -not $script:updating -and ((Get-Date)-$script:checkedAt).TotalSeconds -ge 60){Start-MigrationCheck}
  $now=Revision
  if($now -and $now -ne $script:revision){
   if($now -eq $script:pending){$script:stable++}else{$script:pending=$now;$script:stable=1}
   if($script:stable -ge 2){
    $script:revision=$now;$script:pending='';$script:stable=0
    if(-not $script:stopped -and -not $script:updating){RestartApi 'Git revision changed, restarting API'}
    if(-not $script:botStopped){RestartBot}
   }
  }else{$script:pending='';$script:stable=0}
  if($script:child){
   $script:child.Refresh()
   if($script:child.HasExited){StopApi;$script:status='API exited; recovery scheduled'}
  }
  if(-not $script:child -and -not $script:stopped -and -not $script:updating -and ((Get-Date)-$script:attempt).TotalSeconds -gt 15){StartApi}
  if($script:botChild){
   $script:botChild.Refresh()
   if($script:botChild.HasExited){StopBot;$script:botStatus='Bot exited; recovery scheduled'}
  }
  if(-not $script:botChild -and -not $script:botStopped -and (BotConfigured) -and ((Get-Date)-$script:botAttempt).TotalSeconds -gt 20){StartBot}
  $botLabel.Text=if($script:botChild){"Discord bot: RUNNING (PID $($script:botChild.Id))"}elseif($script:botStopped){'Discord bot: STOPPED'}elseif(-not (BotConfigured)){'Discord bot: NOT CONFIGURED'}else{'Discord bot: OFFLINE'}
  $botLabel.ForeColor=if($script:botChild){[System.Drawing.Color]::FromArgb(169,223,195)}else{[System.Drawing.Color]::FromArgb(222,191,140)}
  $online=Healthy '/health'
  $ready=if($online){Healthy '/ready'}else{$false}
  $apiLabel.Text=if($online -and (UnmanagedApi)){"API: ONLINE - EXTERNAL PROCESS (port $($script:port))"}elseif($online){"API: ONLINE (port $($script:port))"}elseif(PortOccupied){"API: PORT $($script:port) IN USE (unknown service)"}else{"API: OFFLINE (port $($script:port))"}
  $apiLabel.ForeColor=if($online){[System.Drawing.Color]::FromArgb(169,223,195)}else{[System.Drawing.Color]::FromArgb(222,142,142)}
  $dbLabel.Text="Database: $(if($ready){'CONNECTED'}else{'NOT READY'})"
  $migrationLabel.Text=$script:migrationStatus
  $migrationLabel.ForeColor=if($script:migrationPending -gt 0){[System.Drawing.Color]::FromArgb(222,191,140)}else{[System.Drawing.Color]::FromArgb(172,189,201)}
  $updateButton.Enabled=(-not [bool]$script:updating)
  $revLabel.Text="Git revision: $(if($script:revision){$script:revision.Substring(0,12)}else{'unknown'})"
  $info.Text="$($script:status) | Bot: $($script:botStatus)"
  $tray.Text=if($ready){'Eclipse Order API and database ready'}elseif($online){'Eclipse Order API running, database not ready'}else{'Eclipse Order API offline'}
 }catch{$script:status="Monitor error: $($_.Exception.Message)"}
})
$timer.Start()
$form.Add_FormClosing({if(-not $script:exiting){$_.Cancel=$true;$form.Hide()}})
if($Minimized){$form.Add_Shown({$form.Hide()})}
try{[System.Windows.Forms.Application]::Run($form)}
finally{
 $timer.Stop();StopBot;StopApi;$tray.Visible=$false
 $tray.Dispose();$timer.Dispose();$mutex.ReleaseMutex();$mutex.Dispose()
}
