# Remove both current and legacy startup registrations; preserve SQL, secrets and Git files.
$startup=[Environment]::GetFolderPath('Startup')
$removed=$false
foreach($name in @('Imperium Noctis API Control Center.lnk','Eclipse Order API Control Center.lnk')){
 $shortcut=Join-Path $startup $name
 if(Test-Path $shortcut){Remove-Item -LiteralPath $shortcut -Force;$removed=$true}
}
if($removed){Write-Host 'Removed startup registration.'}
else{Write-Host 'No startup shortcut was installed.'}
Write-Host 'To stop a currently running manager, choose Exit and stop API from its tray icon.'
