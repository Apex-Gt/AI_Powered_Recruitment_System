# Windows version of backup.sh: back up the database and the uploaded resumes of a running Docker stack.
#   .\scripts\backup.ps1 [-Out .\backups]
param([string]$Out = ".\backups")
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force $Out | Out-Null

# Same defaults as docker-compose.yml; values in .env win.
$db = "ai_resume_db"; $user = "postgres"
if (Test-Path .env) {
    foreach ($line in Get-Content .env) {
        if ($line -match '^\s*POSTGRES_DB=(.+)$') { $db = $Matches[1].Trim() }
        if ($line -match '^\s*POSTGRES_USER=(.+)$') { $user = $Matches[1].Trim() }
    }
}

$dump = Join-Path $Out "db-$stamp.dump"
$tar = Join-Path $Out "uploads-$stamp.tar"

# cmd's redirection keeps the binary stream intact; PowerShell 5.1's pipeline would re-encode it.
Write-Host "Dumping PostgreSQL ($db)..."
cmd /c "docker compose exec -T postgres pg_dump -U $user -d $db -Fc --no-owner > `"$dump`""
Write-Host "Archiving uploaded resumes..."
cmd /c "docker compose exec -T backend tar -C /data -cf - uploads > `"$tar`""

foreach ($f in $dump, $tar) {
    if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) {
        Remove-Item $f -ErrorAction SilentlyContinue
        throw "$f is empty: the backup failed"
    }
}
Get-Item $dump, $tar | Select-Object Name, @{n = "MB"; e = { [math]::Round($_.Length / 1MB, 2) } }
Write-Host "Copy these off the machine. A backup on the same disk does not survive the disk."
