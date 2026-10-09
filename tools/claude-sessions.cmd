@echo off
rem Wrapper for claude-sessions.ps1 (avoids PowerShell execution-policy prompts).
rem Usage: tools\claude-sessions.cmd export | import
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0claude-sessions.ps1" %1
