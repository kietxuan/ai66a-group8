from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

import asyncio
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def unwrap(res):
    j = res.json()
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j

async def test_ai_phase5():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0) as client:
        # 1. Register user
        email = f"ai_user_{int(datetime.now().timestamp())}@example.com"
        pwd = "SecretPassword123!"
        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": "AI Tester",
            "password": pwd
        })
        assert reg.status_code == 201, reg.text

        # 2. Login
        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        print("[*] 1. Testing AI Conversation Management...")
        conv_res = await client.post("/ai/conversations", json={"title": "Test Planning"}, headers=headers)
        assert conv_res.status_code == 201, conv_res.text
        conv = unwrap(conv_res)
        conv_id = conv["id"]
        assert conv["title"] == "Test Planning"

        list_res = await client.get("/ai/conversations", headers=headers)
        assert list_res.status_code == 200
        convs = unwrap(list_res)
        assert any(c["id"] == conv_id for c in convs)

        print("[*] 2. Testing AI Chat Message Flow & Guardrails...")
        # Out-of-scope query
        msg_out_of_scope = await client.post(
            f"/ai/conversations/{conv_id}/messages",
            json={"content": "Hãy giải phương trình toán bậc hai x^2 - 4 = 0 cho tôi"},
            headers=headers
        )
        assert msg_out_of_scope.status_code == 200, msg_out_of_scope.text
        reply = unwrap(msg_out_of_scope)
        assert reply["role"] == "assistant"
        print(f"   [Guardrail Response]: {reply['content'][:120]}...")

        # In-scope time management query
        print("[*] 3. Testing Time Management & Advisory Query...")
        msg_advice = await client.post(
            f"/ai/conversations/{conv_id}/messages",
            json={"content": "Cho tôi 3 lời khuyên ngắn gọn để quản lý thời gian hiệu quả hơn hôm nay"},
            headers=headers
        )
        assert msg_advice.status_code == 200, msg_advice.text
        advice_reply = unwrap(msg_advice)
        assert advice_reply["role"] == "assistant"
        print(f"   [Advice Response]: {advice_reply['content'][:120]}...")

        # Quick Chat endpoint
        print("[*] 4. Testing Quick Chat Endpoint (/ai/chat)...")
        qc_res = await client.post(
            "/ai/chat",
            json={"content": "Lịch hôm nay của tôi có gì không?"},
            headers=headers
        )
        assert qc_res.status_code == 200, qc_res.text
        qc_reply = unwrap(qc_res)
        assert qc_reply["role"] == "assistant"

        print("[*] 5. Testing Rate Limiting (>30 msgs/min)...")
        tasks = [
            client.post("/ai/chat", json={"content": f"Ping test {i}"}, headers=headers)
            for i in range(35)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        hit_429 = any(getattr(r, "status_code", None) == 429 for r in results)
        assert hit_429, "Rate limit of 30 msgs/min should have triggered HTTP 429"
        print("   [OK] Successfully triggered HTTP 429 Rate Limit!")

        print("🎉 ALL PHASE 5 AI AGENT AUTOMATED TESTS PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(test_ai_phase5())

