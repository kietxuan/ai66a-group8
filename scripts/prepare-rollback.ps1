param(
    [Parameter(Mandatory = $true)]
    [string]$BaseCommit
)
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$commitOutput = & git -C $repoRoot rev-parse --verify "$BaseCommit^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'BaseCommit phải là commit đã có trong repository local.' }
$resolvedCommit = ([string]$commitOutput).Trim()
$tracked = & git -C $repoRoot ls-tree -r --name-only $resolvedCommit
if ($LASTEXITCODE -ne 0) { throw 'Không đọc được source của commit quay lui.' }
foreach ($name in $tracked) {
    if (($name -match '(^|/)\.env(\..*)?$' -and $name -notmatch '(^|/)\.env\.(example|koyeb\.example|render\.example)$') -or $name -match '\.(pem|key|p12|pfx|dump)$') {
        throw "Commit chứa file nhạy cảm cần kiểm tra trước khi đóng gói: $name"
    }
}
$bundleRoot = Join-Path $repoRoot ('.local/rollback-' + $resolvedCommit.Substring(0, 8) + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $bundleRoot | Out-Null
$archive = Join-Path $bundleRoot 'source.zip'
$sourceRoot = Join-Path $bundleRoot 'source'
& git -C $repoRoot archive --format=zip --output=$archive $resolvedCommit
if ($LASTEXITCODE -ne 0) { throw 'Không xuất được source quay lui.' }
Expand-Archive -LiteralPath $archive -DestinationPath $sourceRoot
# Keep the complete CURRENT migration graph in the old application's image.
# Otherwise its entrypoint cannot recognise the newer database revision.
$migrations = Join-Path $repoRoot 'backend/alembic'
foreach ($file in (Get-ChildItem -LiteralPath $migrations -Filter '*.py' -File -Recurse)) {
    $relative = [System.IO.Path]::GetRelativePath($migrations, $file.FullName)
    $destination = Join-Path $sourceRoot (Join-Path 'backend/alembic' $relative)
    New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}
Write-Output "Rollback base: $resolvedCommit"
Write-Output "Rollback source: $sourceRoot"
Write-Output 'Đây là code cũ kèm migration hiện tại, KHÔNG hạ database và KHÔNG push Git.'
Write-Output "Build: docker build --platform linux/amd64 -f `"$sourceRoot/Dockerfile.render`" -t planify-rollback-compatible:local `"$sourceRoot`""
