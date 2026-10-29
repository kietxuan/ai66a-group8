from fastapi.testclient import TestClient


def test_spa_deep_links_and_reserved_json_routes(tmp_path):
    from main import create_app
    (tmp_path / "index.html").write_text('<!doctype html><div id="root">app</div>', encoding="utf-8")
    with TestClient(create_app(tmp_path)) as c:
        for path in ("/", "/calendar", "/tasks/deep-link"):
            r=c.get(path)
            assert r.status_code==200 and 'text/html' in r.headers['content-type']
        for path in ("/api/missing", "/api", "/health/missing", "/docs/missing", "/missing.js", "/assets/missing.js"):
            r=c.get(path)
            assert r.status_code==404 and r.json()["error"]["code"]=="NOT_FOUND"
