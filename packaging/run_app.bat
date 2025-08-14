@echo off
set EXE=invoice_dashboard.exe
if exist dist\invoice_dashboard\%EXE% (
  start "" dist\invoice_dashboard\%EXE%
) else (
  echo [!] Build not found. Run: pyinstaller build.spec
)
