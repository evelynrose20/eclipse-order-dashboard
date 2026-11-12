# Eclipse Order API manager maintenance helpers. Only runs in local Windows user process.
$script:checking=$null
$script:checkOut=$null
$script:checkErr=$null
$script:checkedAt=[datetime]::MinValue
$script:migrationStatus='Checking database migrations...'
$script:migrationPending=-1
$script:updating=$null
$script:updatingOut=$null
$script:updatingErr=$null
$script:resumeAfterUpdate=$false

function New-HiddenNodeProcess([string]$arguments,[bool]$writableInput=$false) {
 $node=(Get-Command node.exe -ErrorAction Stop).Source
 $info=New-Object System.Diagnostics.ProcessStartInfo
 $info.FileName=$node
 $info.Arguments=$arguments
 $info.WorkingDirectory=$server
 $info.UseShellExecute=$false
 $info.CreateNoWindow=$true
 $info.WindowStyle=[System.Diagnostics.ProcessWindowStyle]::Hidden
 $info.RedirectStandardOutput=$true
 $info.RedirectStandardError=$true
 $info.RedirectStandardInput=$writableInput
 return [System.Diagnostics.Process]::Start($info)
}
function Start-MigrationCheck {
 if($script:checking -or $script:updating){return}
 try {
  $script:checking=New-HiddenNodeProcess '--env-file=.env src/migration-status.js'
  $script:checkOut=$script:checking.StandardOutput.ReadToEndAsync()
  $script:checkErr=$script:checking.StandardError.ReadToEndAsync()
  $script:migrationStatus='Checking database migrations...'
 } catch {
  $script:migrationStatus='Migration status unavailable; check Node.js configuration.'
  $script:checkedAt=Get-Date
 }
}
function Finish-MigrationCheck {
 if(-not $script:checking){return}
 $script:checking.Refresh()
 if(-not $script:checking.HasExited){return}
 try {
  $text=$script:checkOut.GetAwaiter().GetResult().Trim()
  $result=$text | ConvertFrom-Json
  if($script:checking.ExitCode -eq 0 -and $result.status -eq 'current'){
   $script:migrationPending=0
   $script:migrationStatus="DATABASE SCHEMA: CURRENT ($($result.checked) tracked updates)"
  } elseif($script:checking.ExitCode -eq 0 -and $result.status -eq 'update_available'){
   $script:migrationPending=[int]$result.pending
   $script:migrationStatus="DATABASE UPDATE REQUIRED: $($result.pending) missing tracked updates"
  }else{
   $script:migrationPending=-1
   $script:migrationStatus='DATABASE SCHEMA: UNKNOWN - check API/SQL credentials'
  }
 }catch{
  $script:migrationPending=-1
  $script:migrationStatus='DATABASE SCHEMA: could not verify migration versions'
 }finally{
  $script:checking.Dispose()
  $script:checking=$null
  $script:checkedAt=Get-Date
 }
}
function Show-DatabaseUpdateDialog {
 if($script:updating){return}
 $dialog=New-Object System.Windows.Forms.Form
 $dialog.Text='Apply database updates'
 $dialog.Size=New-Object System.Drawing.Size(510,377)
 $dialog.StartPosition='CenterParent'
 $dialog.FormBorderStyle='FixedDialog'
 $dialog.MaximizeBox=$false;$dialog.MinimizeBox=$false
 $dialog.BackColor=$form.BackColor;$dialog.ForeColor=$form.ForeColor;$dialog.Font=$form.Font
 $explain=New-Object System.Windows.Forms.Label
 $explain.Text="This runs the Order's database setup on this PC. Existing member records are retained, but database updates can fail. Create and verify a restorable backup first."
 $explain.SetBounds(22,20,450,64)
 $dialog.Controls.Add($explain)
 $backup=New-Object System.Windows.Forms.CheckBox
 $backup.Text='I have made and verified a current database backup.'
 $backup.SetBounds(22,98,450,30)
 $dialog.Controls.Add($backup)
 $passLabel=New-Object System.Windows.Forms.Label
 $passLabel.Text='Local MySQL administrator password (if configured)'
 $passLabel.SetBounds(22,145,440,25)
 $dialog.Controls.Add($passLabel)
 $password=New-Object System.Windows.Forms.TextBox
 $password.SetBounds(22,174,448,31)
 $password.UseSystemPasswordChar=$true
 $dialog.Controls.Add($password)
 $noPassword=New-Object System.Windows.Forms.CheckBox
 $noPassword.Text='My local MySQL administrator account has no password.'
 $noPassword.SetBounds(22,211,460,28)
 $noPassword.Add_CheckedChanged({
  $password.Enabled= -not $noPassword.Checked
  if($noPassword.Checked){$password.Clear()}
 })
 $dialog.Controls.Add($noPassword)
 $ok=New-Object System.Windows.Forms.Button
 $ok.Text='APPLY UPDATES'
 $ok.SetBounds(22,270,218,38)
 $ok.FlatStyle='Flat';$ok.BackColor=[System.Drawing.Color]::FromArgb(59,78,91)
 $ok.ForeColor=$form.ForeColor
 $dialog.Controls.Add($ok)
 $cancel=New-Object System.Windows.Forms.Button
 $cancel.Text='CANCEL';$cancel.SetBounds(252,270,218,38)
 $cancel.FlatStyle='Flat';$cancel.BackColor=[System.Drawing.Color]::FromArgb(32,42,51)
 $cancel.ForeColor=$form.ForeColor
 $cancel.DialogResult=[System.Windows.Forms.DialogResult]::Cancel
 $dialog.Controls.Add($cancel)
 $dialog.CancelButton=$cancel
 $ok.Add_Click({
  if(-not $backup.Checked -or (-not $noPassword.Checked -and [string]::IsNullOrEmpty($password.Text))){
   [System.Windows.Forms.MessageBox]::Show($dialog,'Confirm your verified database backup and enter your password, or explicitly select No password.','Database update') | Out-Null
   return
  }
  $dialog.DialogResult=[System.Windows.Forms.DialogResult]::OK
  $dialog.Close()
 })
 try {
  if($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK){
   $entered=if($noPassword.Checked){''}else{$password.Text}
   $password.Clear()
   try { Start-DatabaseUpdate $entered }
   finally { $entered=$null }
  }
 }finally{$password.Clear();$dialog.Dispose()}
}
function Start-DatabaseUpdate([string]$secret) {
 if($script:updating){return}
 if(UnmanagedApi){
  $script:status="Database setup blocked: another process owns port $($script:port). Stop that API first."
  $script:migrationStatus='DATABASE UPDATE: BLOCKED BY UNMANAGED API'
  [System.Windows.Forms.MessageBox]::Show($form,'Another process is running on the API port. Close the old Node server before applying database migrations. This Control Center will not kill that process.','API still running') | Out-Null
  return
 }
 $script:resumeAfterUpdate= -not $script:stopped
 StopApi
 $script:migrationStatus='DATABASE UPDATE: RUNNING - do not close this application'
 $script:status='Applying local MySQL migrations...'
 try {
  $script:updating=New-HiddenNodeProcess '--env-file=.env src/setup-local.js --admin-password-stdin' $true
  $script:updatingOut=$script:updating.StandardOutput.ReadToEndAsync()
  $script:updatingErr=$script:updating.StandardError.ReadToEndAsync()
  $script:updating.StandardInput.WriteLine($secret)
  $script:updating.StandardInput.Close()
 } catch {
  if($script:updating){try{$script:updating.Kill()}catch{};$script:updating.Dispose()}
  $script:updating=$null
  $script:migrationStatus='DATABASE UPDATE: FAILED TO START'
  $script:status="Could not launch database update: $($_.Exception.Message)"
  if($script:resumeAfterUpdate){StartApi}
 }
}
function Finish-DatabaseUpdate {
 if(-not $script:updating){return}
 $script:updating.Refresh()
 if(-not $script:updating.HasExited){return}
 $exitCode=$script:updating.ExitCode
 try {
  $stdout=$script:updatingOut.GetAwaiter().GetResult()
  $stderr=$script:updatingErr.GetAwaiter().GetResult()
  $file=Join-Path $logs ('database-update-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
  [System.IO.File]::WriteAllText($file,($stdout+[Environment]::NewLine+$stderr))
  if($exitCode -eq 0){
   $script:migrationStatus='DATABASE UPDATE: COMPLETED'
   $script:status='Database updated. Checking the new schema...'
  }else{
   $script:migrationStatus='DATABASE UPDATE: FAILED - OPEN LOGS'
   $script:status='Database setup failed. See the latest database-update log.'
  }
 }catch{
  $script:migrationStatus='DATABASE UPDATE: ERROR - OPEN LOGS'
  $script:status="Could not read update result: $($_.Exception.Message)"
 }finally{
  $script:updating.Dispose()
  $script:updating=$null
  $script:checkedAt=[datetime]::MinValue
  if($script:resumeAfterUpdate){StartApi}
 }
}
