' Double-click this installer: uses WScript, never leaves a terminal open.
Option Explicit
Dim sh,fs,installer,command
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
installer=fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName),"install-api-manager.ps1")
command="powershell.exe -NoProfile -STA -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & installer & Chr(34)
sh.Run command,0,False
