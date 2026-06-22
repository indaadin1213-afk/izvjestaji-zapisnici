@echo off
echo Osvjezavanje izvjestaja...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0refresh.ps1"
node "%~dp0generate_report.js"
echo Izvjestaj je spreman!
pause
