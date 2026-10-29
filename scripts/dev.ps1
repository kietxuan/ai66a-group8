param([switch]$StartLocalDatabase, [switch]$Build, [int]$Port=8000)
# Keep this launcher ASCII-only: Windows PowerShell 5.1 misreads UTF-8 without BOM.
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$pythonPath=Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
if(!(Test-Path -LiteralPath $pythonPath)){throw 'Missing backend/.venv. Follow docs/01_SETUP.md to install the environment first.'}
if($Port -lt 1024 -or $Port -gt 65535){throw 'Port must be in 1024..65535.'}
Push-Location -LiteralPath $projectRoot
try {
  if(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue){throw "Port $Port is already in use. Stop your previous app terminal first; this script does not kill processes."}
  & $pythonPath -X utf8 -c "import sys;sys.path.insert(0,'backend');from app.core.config import get_settings;assert 'http://127.0.0.1:'+sys.argv[1] in get_settings().origins, 'Add the exact loopback origin and port to CORS_ORIGINS before starting'" $Port
  if($LASTEXITCODE -ne 0){throw 'Missing exact Origin in CORS_ORIGINS. Do not disable the CSRF guard.'}
  if($StartLocalDatabase){
    $clusterPath=Join-Path $projectRoot '.local/pgdata'
    $pgControl='C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe'
    if(!(Test-Path -LiteralPath $clusterPath) -or !(Test-Path -LiteralPath $pgControl)){throw 'Project local cluster not found. No initdb is performed. Use your configured PostgreSQL instance.'}
    & $pythonPath -X utf8 -c "import sys;sys.path.insert(0,'backend');from app.core.config import get_settings;from sqlalchemy.engine import make_url;u=make_url(get_settings().database_url);assert u.host=='127.0.0.1' and u.port==55432, 'Local cluster switch requires loopback:55432 configuration'"
    if($LASTEXITCODE -ne 0){throw 'Local cluster configuration does not match. Stopping to avoid using the wrong database.'}
    & $pgControl -D $clusterPath status
    if($LASTEXITCODE -ne 0){
      & $pgControl -D $clusterPath -l (Join-Path $projectRoot '.local/postgres.log') -o '-h 127.0.0.1 -p 55432' start
      if($LASTEXITCODE -ne 0){throw 'Could not start PostgreSQL. Check .local/postgres.log.'}
    }
  }
  & $pythonPath -X utf8 -c "import sys;sys.path.insert(0,'backend');from app.core.database import get_engine;from sqlalchemy import text;connection=get_engine().connect();connection.execute(text('SELECT 1'));connection.close();print('Database: OK')"
  if($LASTEXITCODE -ne 0){throw 'Database is not ready. No data reset is performed. Check PostgreSQL and .env.'}
  Push-Location -LiteralPath (Join-Path $projectRoot 'backend')
  try { & $pythonPath -X utf8 -m alembic upgrade head; if($LASTEXITCODE -ne 0){throw 'Migration failed. App will not start.'} }
  finally {Pop-Location}
  if($Build -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/dist/index.html'))){
    Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    try { & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'Frontend build failed.'} }
    finally {Pop-Location}
  }
  Write-Host "Open http://127.0.0.1:$Port . Stop the app with Ctrl+C; PostgreSQL stays running to avoid interrupting other sessions."
  Push-Location -LiteralPath (Join-Path $projectRoot 'backend')
  try { & $pythonPath -X utf8 -m uvicorn main:app --host 127.0.0.1 --port $Port --workers 1 }
  finally {Pop-Location}
} finally {Pop-Location}
