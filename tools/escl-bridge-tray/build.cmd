@echo off
rem Builds bridge-dist\RomaOfficeSharing-ScannerBridge.exe with the C# compiler that ships with Windows
rem (.NET Framework 4.x) - nothing to install. Usage: tools\escl-bridge-tray\build.cmd
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
set "OUT=%~dp0..\..\bridge-dist"
if not exist "%OUT%" mkdir "%OUT%"
"%CSC%" /nologo /target:winexe /optimize+ /codepage:65001 /win32icon:"%~dp0bridge.ico" /out:"%OUT%\RomaOfficeSharing-ScannerBridge.exe" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Net.Http.dll /r:System.Web.Extensions.dll "%~dp0Program.cs"
if errorlevel 1 exit /b 1
echo Creato %OUT%\RomaOfficeSharing-ScannerBridge.exe
