import os
import sys
import time
import uuid
from datetime import date

import jwt
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main  # noqa: E402


# --- extract_json ---

def test_extract_json_plain():
    assert main.extract_json('[{"name": "x"}]') == [{"name": "x"}]


def test_extract_json_fenced():
    assert main.extract_json('```json\n[{"a": 1}]\n```') == [{"a": 1}]


def test_extract_json_prose_wrapped():
    assert main.extract_json('Here is your plan:\n[{"a": 1}]\nEnjoy!') == [{"a": 1}]


def test_extract_json_garbage():
    assert main.extract_json("I cannot help with that.") is None
    assert main.extract_json("") is None
    assert main.extract_json(None) is None


# --- sanitize_items ---

def test_sanitize_daily_strips_unknown_keys():
    items = [{"name": "Gym", "start": "9:00 AM", "end": "10:00 AM",
              "evil": "<script>", "user_id": "someone-else"}]
    out = main.sanitize_items("daily", items)
    assert out == [{"name": "Gym", "start": "9:00 AM", "end": "10:00 AM"}]


def test_sanitize_monthly_range_checks():
    items = [{"name": "ok", "day": 15}, {"name": "zero", "day": 0},
             {"name": "high", "day": 32}, {"name": "nan", "day": "abc"}]
    out = main.sanitize_items("monthly", items)
    assert out == [{"name": "ok", "day": 15}]


def test_sanitize_monthly_respects_month_length():
    items = [{"name": "feb30", "day": 30}]
    assert main.sanitize_items("monthly", items, max_day=28) == []
    assert main.sanitize_items("monthly", items, max_day=30) == [{"name": "feb30", "day": 30}]


def test_sanitize_yearly_range_checks():
    items = [{"name": "ok", "month": 12}, {"name": "bad", "month": 13}]
    assert main.sanitize_items("yearly", items) == [{"name": "ok", "month": 12}]


def test_sanitize_preserves_done_flag():
    items = [{"name": "a", "day": 1, "done": True},
             {"name": "b", "day": 2, "done": "yes"}]  # non-bool done dropped
    out = main.sanitize_items("monthly", items)
    assert out[0]["done"] is True
    assert "done" not in out[1]


def test_sanitize_truncates_long_strings():
    out = main.sanitize_items("daily", [{"name": "x" * 500, "start": "", "end": ""}])
    assert len(out[0]["name"]) == 200


def test_sanitize_skips_non_dicts_and_rejects_non_list():
    assert main.sanitize_items("daily", ["a", 1, None]) == []
    with pytest.raises(Exception):
        main.sanitize_items("daily", {"not": "a list"})


def test_sanitize_caps_item_count():
    items = [{"name": f"t{i}", "day": 1} for i in range(500)]
    assert len(main.sanitize_items("monthly", items)) == 200


# --- API auth / limits ---

@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        yield c


def make_token(sub="11111111-1111-1111-1111-111111111111", **overrides):
    claims = {
        "sub": sub,
        "aud": "authenticated",
        "iss": f"{os.environ['SUPABASE_URL']}/auth/v1",
        "exp": int(time.time()) + 3600,
        **overrides,
    }
    return jwt.encode(claims, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


def test_health_is_public(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_schedules_requires_auth(client):
    assert client.get("/api/schedules").status_code == 401
    assert client.post("/api/generate", json={}).status_code == 401


def test_rejects_garbage_token(client):
    res = client.get("/api/schedules", headers={"Authorization": "Bearer nope"})
    assert res.status_code == 401
    assert "nope" not in res.text  # no token echo


def test_rejects_wrong_issuer(client):
    bad = make_token(iss="https://attacker.example.com/auth/v1")
    res = client.get("/api/schedules", headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_rejects_wrong_audience(client):
    bad = make_token(aud="anon")
    res = client.get("/api/schedules", headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_rejects_expired_token(client):
    bad = make_token(exp=int(time.time()) - 3600)
    res = client.get("/api/schedules", headers={"Authorization": f"Bearer {bad}"})
    assert res.status_code == 401


def test_generate_validates_body(client):
    token = make_token()
    res = client.post(
        "/api/generate",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "daily", "period_start": "not-a-date",
              "events": [{"name": "x"}]},
    )
    assert res.status_code == 422  # malformed date rejected, not a 500


def test_update_requires_uuid(client):
    token = make_token()
    res = client.put(
        "/api/schedules/not-a-uuid",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "daily", "period_start": "2026-01-01", "items": []},
    )
    assert res.status_code == 422


def test_oversized_body_rejected(client):
    token = make_token()
    res = client.post(
        "/api/generate",
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        content=b'{"pad": "' + b"x" * 1_100_000 + b'"}',
    )
    assert res.status_code == 413


def test_security_headers_present(client):
    res = client.get("/api/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in res.headers


def test_rate_limiter_blocks_after_limit():
    rl = main.RateLimiter(limit=3, window=60)
    for _ in range(3):
        rl.check("user-a")
    with pytest.raises(Exception):
        rl.check("user-a")
    rl.check("user-b")  # other users unaffected


@pytest.mark.skipif(not os.path.isdir(main.DIST), reason="frontend not built")
def test_spa_path_traversal_blocked(client):
    res = client.get("/..%2f..%2fBackend%2f.env")
    # Must fall through to index.html, never serve files outside dist/.
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "GROQ" not in res.text
