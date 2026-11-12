# Eclipse Order Control Center installer. Run via install-api-manager.vbs (no console).
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$launcher=(Resolve-Path (Join-Path $PSScriptRoot 'launch-api-manager.vbs')).Path
$startup=[Environment]::GetFolderPath('Startup')
if(-not(Test-Path $startup)){New-Item -Path $startup -ItemType Directory -Force | Out-Null}
$shortcut=Join-Path $startup 'Eclipse Order API Control Center.lnk'
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($shortcut)
$link.TargetPath=Join-Path $env:WINDIR 'System32\wscript.exe'
$link.Arguments='"'+$launcher+'"'
$link.WorkingDirectory=(Split-Path $launcher)
$link.Description='Start Eclipse Order API Control Center without a terminal on Windows sign-in'
$link.Save()
$created=$false
$mutex=New-Object System.Threading.Mutex($false,'Local\EclipseOrderApiManager',[ref]$created)
try {
 if($created){
  Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList @('"'+$launcher+'"','/show')
  [System.Windows.Forms.MessageBox]::Show('The Eclipse Order Control Center was installed and launched without a terminal. It will start in the tray when you sign in to Windows.','Installation complete')|Out-Null
 }else{
  [System.Windows.Forms.MessageBox]::Show('Startup registration updated. The old Control Center is still running. Select Exit and stop API from its tray icon, then double-click launch-api-manager.vbs to load this new version.','Installation complete')|Out-Null
 }
}finally{$mutex.Dispose()}
