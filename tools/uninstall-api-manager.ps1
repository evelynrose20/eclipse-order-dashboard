# Remove startup registration; does not touch SQL, secrets, or Git files.
$shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'Eclipse Order API Control Center.lnk'
if(Test-Path $shortcut){Remove-Item -LiteralPath $shortcut -Force;Write-Host 'Removed startup registration.'}
else{Write-Host 'No startup shortcut was installed.'}
Write-Host 'To stop a currently running manager, choose Exit and stop API from its tray icon.'
