# Copies Claude Code's session history/memory for THIS project between its normal home
# (%USERPROFILE%\.claude\projects\<cartella-con-trattini>) and claude-sessions\ inside the repo,
# so moving the repo folder to a new PC also moves the conversations.
#
#   tools\claude-sessions.cmd export    # Claude -> repo   (run before copying the folder)
#   tools\claude-sessions.cmd import    # repo -> Claude   (run once on the new PC)
#
# Never overwrites a newer file with an older one. claude-sessions\ is gitignored on purpose: the
# transcripts can contain sensitive data and the repository is public.
param([Parameter(Mandatory = $true)][ValidateSet('export', 'import')][string]$Mode)

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Claude Code names the project folder after the working directory, every non-alphanumeric char -> '-'
$projectName = $repo -replace '[^A-Za-z0-9]', '-'
$live = Join-Path $env:USERPROFILE ".claude\projects\$projectName"
$copy = Join-Path $repo 'claude-sessions'

if ($Mode -eq 'export') { $src = $live; $dst = $copy } else { $src = $copy; $dst = $live }
if (-not (Test-Path $src)) { Write-Error "Cartella di origine non trovata: $src"; exit 1 }

New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /E /XO /NFL /NDL /NJH /NP | Out-Host
# robocopy exit codes below 8 mean success
if ($LASTEXITCODE -ge 8) { Write-Error "Copia non riuscita (robocopy $LASTEXITCODE)"; exit 1 }
Write-Host "Fatto: $src -> $dst"
exit 0
