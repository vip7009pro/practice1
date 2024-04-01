@echo off
:START
start "ERP BACKEND" "BE.exe"
ping -n 5 127.0.0.1 > nul
tasklist /FI "IMAGENAME eq BE.exe" | find /i "BE.exe" > nul
if errorlevel 1 goto START