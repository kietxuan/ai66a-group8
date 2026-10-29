"""Explicit local PostgreSQL backup + restore rehearsal into a NEW disposable DB.

Never overwrites/restores the source. Retains dump under ignored .local/backups.
Requires a development DB role allowed to CREATE DATABASE. No credentials printed.
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.core.config import get_settings


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-rehearsal',action='store_true')
    parser.add_argument('--pg-bin',type=Path,default=Path('C:/Program Files/PostgreSQL/18/bin'))
    args=parser.parse_args()
    if not args.local_rehearsal:parser.error('Explicit --local-rehearsal required')
    url=make_url(get_settings().database_url)
    if url.host not in ('localhost','127.0.0.1'):parser.error('Only local development databases; never production')
    target='todo_restore_'+uuid4().hex[:12]+'_test'
    if target==url.database:parser.error('Unsafe restore target')
    dump=ROOT/'.local/backups'/('todo-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:6]+'.dump')
    dump.parent.mkdir(parents=True,exist_ok=True)
    env={**os.environ,'PGPASSWORD':url.password or ''}
    connection={'host':url.host,'port':url.port or 5432,'user':url.username,'password':url.password or '', 'connect_timeout':5}
    common=['--host',url.host,'--port',str(url.port or 5432),'--username',url.username,'--no-password']
    def run(tool,arguments):
        suffix='.exe' if os.name=='nt' else ''
        result=subprocess.run([str(args.pg_bin/(tool+suffix)),*common,*arguments],env=env,capture_output=True,timeout=90)
        if result.returncode:raise RuntimeError(tool+' failed; no source data changed')
    created=False
    try:
        run('pg_dump',['--format=custom','--file',str(dump),'--dbname',url.database])
        with psycopg.connect(**connection,dbname='postgres',autocommit=True) as maintenance:
            maintenance.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(target)))
            created=True
        run('pg_restore',['--no-owner','--no-privileges','--exit-on-error','--dbname',target,str(dump)])
        counts=[]
        for name in (url.database,target):
            with psycopg.connect(**connection,dbname=name) as db:
                counts.append({table:db.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(table))).fetchone()[0] for table in ('users','categories','tasks')})
        if counts[0]!=counts[1]:raise RuntimeError('Source changed during snapshot or restore counts differ; rerun during idle period')
        print(json.dumps({'backup':str(dump.relative_to(ROOT)), 'restore_counts_match':True,
            'tables_checked':['users','categories','tasks'],'source_modified':False,'temporary_restore_database':target},ensure_ascii=False))
    finally:
        if created:
            # Exact fresh DB name generated in this invocation; never a user DB.
            assert target.startswith('todo_restore_') and target.endswith('_test') and target!=url.database
            with psycopg.connect(**connection,dbname='postgres',autocommit=True) as maintenance:
                maintenance.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(target)))
    return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except (RuntimeError,OSError,psycopg.Error,subprocess.TimeoutExpired) as exc:
        print(json.dumps({'error_type':type(exc).__name__,'message':'Backup rehearsal incomplete; source was not restored or reset. Check local permissions/tools.'}))
        raise SystemExit(1)
