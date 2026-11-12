# Run once in Windows PowerShell. No administrator access required for startup at sign-in.
$ErrorActionPreference='Stop'
$manager=(Resolve-Path (Join-Path $PSScriptRoot 'windows-api-manager.ps1')).Path
$startup=[Environment]::GetFolderPath('Startup')
if(-not (Test-Path $startup)){New-Item -Path $startup -ItemType Directory -Force | Out-Null}
$shortcut=Join-Path $startup 'Eclipse Order API Control Center.lnk'
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($shortcut)
$link.TargetPath=Join-Path $PSHOME 'powershell.exe'
$link.Arguments='-NoProfile -STA -ExecutionPolicy Bypass -File "'+$manager+'" -Minimized'
$link.WorkingDirectory=(Split-Path $manager)
$link.Description='Start the Eclipse Order API tray control center at Windows sign-in'
$link.Save()
Write-Host "Installed startup shortcut: $shortcut"
Write-Host 'The API manager starts at your next Windows sign-in, or you can launch it now.'
try {
 $mysql=Get-Service | Where-Object {$_.Name -match '^(MySQL|MariaDB)'} | Select-Object -First 1
 if($mysql){
  Write-Host "Database service: $($mysql.Name) ($($mysql.Status)); verify its Windows Startup type is Automatic."
 }else{Write-Warning 'No MySQL/MariaDB Windows service found. Configure your database service separately.'}
}catch{Write-Warning 'Could not inspect database services.'}
Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"'+$manager+'"'))
