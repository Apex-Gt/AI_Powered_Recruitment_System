# Windows version of restore.sh. DESTRUCTIVE: replaces the database contents and the uploaded files.
#   .\scripts\restore.ps1 -Dump .\backups\db-20261020-103000.dump -Uploads .\backups\uploads-20261020-103000.tar
param(
    [Parameter(Mandatory)][string]$Dump,
    [Parameter(Mandatory)][string]$Uploads
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

foreach ($f in $Dump, $Uploads) {
    if (-not (Test-Path $f) -or (Get-Item $f).Length -eq 0) { throw "$f not found or empty" }
}
$db = "ai_resume_db"; $user = "postgres"
if (Test-Path .env) {
    foreach ($line in Get-Content .env) {
        if ($line -match '^\s*POSTGRES_DB=(.+)$') { $db = $Matches[1].Trim() }
        if ($line -match '^\s*POSTGRES_USER=(.+)$') { $user = $Matches[1].Trim() }
    }
}

$answer = Read-Host "This REPLACES the database '$db' and the uploaded files. Type 'restore' to continue"
if ($answer -ne "restore") { Write-Host "aborted"; exit 1 }

docker compose stop backend frontend
Write-Host "Restoring PostgreSQL..."
cmd /c "docker compose exec -T postgres pg_restore -U $user -d $db --clean --if-exists --no-owner < `"$Dump`""
Write-Host "Restoring uploaded resumes..."
cmd /c "docker compose run --rm --no-deps -T --entrypoint sh backend -c `"rm -rf /data/uploads/* && tar -C /data -xf -`" < `"$Uploads`""
docker compose start backend frontend
Write-Host "Restored. Tasks that were mid-flight resume automatically (their lease expires)."
