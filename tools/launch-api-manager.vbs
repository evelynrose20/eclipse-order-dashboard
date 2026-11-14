' Imperium Noctis API Control Center launcher - no command window.
Option Explicit
Dim sh,fs,manager,command,showWindow
Set sh=CreateObject("WScript.Shell")
Set fs=CreateObject("Scripting.FileSystemObject")
manager=fs.BuildPath(fs.GetParentFolderName(WScript.ScriptFullName),"windows-api-manager.ps1")
showWindow=False
If WScript.Arguments.Count>0 Then
 If LCase(WScript.Arguments(0))="/show" Then showWindow=True
End If
command="powershell.exe -NoProfile -STA -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & manager & Chr(34)
If Not showWindow Then command=command & " -Minimized"
sh.Run command,0,False
