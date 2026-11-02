#!/usr/bin/env python3
"""
Reviewer 1 Independent Adversarial Frontend Test Suite (Milestone M4)
Tests RRuleParser edge cases, task adapter robustness, real ChatPanel event emission,
and cross-module synchronization directly in Headless Chrome.
"""

import subprocess
import time
import json
import urllib.request
import urllib.parse
import socket
import sys

CHROME_BIN = "/usr/bin/google-chrome"
PORT = 9228
USER_DATA_DIR = "/tmp/planify_chrome_reviewer_m4"

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def send_cdp_cmd(ws_sock, cmd_id, method, params=None):
    payload = {"id": cmd_id, "method": method, "params": params or {}}
    raw_data = json.dumps(payload).encode('utf-8')
    frame = bytearray()
    frame.append(0x81)
    length = len(raw_data)
    if length <= 125:
        frame.append(0x80 | length)
    elif length <= 65535:
        frame.append(0x80 | 126)
        frame.extend(length.to_bytes(2, 'big'))
    else:
        frame.append(0x80 | 127)
        frame.extend(length.to_bytes(8, 'big'))
    mask_key = b"\x12\x34\x56\x78"
    frame.extend(mask_key)
    masked_data = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(raw_data))
    frame.extend(masked_data)
    ws_sock.sendall(frame)

def read_cdp_msg(ws_sock):
    b1, b2 = ws_sock.recv(2)
    opcode = b1 & 0x0f
    length = b2 & 0x7f
    if length == 126:
        length = int.from_bytes(ws_sock.recv(2), 'big')
    elif length == 127:
        length = int.from_bytes(ws_sock.recv(8), 'big')
    data = bytearray()
    while len(data) < length:
        chunk = ws_sock.recv(length - len(data))
        if not chunk:
            break
        data.extend(chunk)
    return json.loads(data.decode('utf-8'))

def eval_js(ws_sock, req_id, expr):
    send_cdp_cmd(ws_sock, req_id, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    while True:
        resp = read_cdp_msg(ws_sock)
        if resp.get("id") == req_id:
            if "exceptionDetails" in resp.get("result", {}):
                raise RuntimeError(f"JS Exception: {resp['result']['exceptionDetails']}")
            result = resp.get("result", {}).get("result", {})
            if "value" in result:
                return result["value"]
            return result

def main():
    print("=====================================================================")
    print("   REVIEWER 1 INDEPENDENT ADVERSARIAL VERIFICATION (M4)")
    print("=====================================================================")

    chrome_proc = subprocess.Popen([
        CHROME_BIN,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DATA_DIR}",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-dev-shm-usage",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        for _ in range(30):
            if is_port_open(PORT):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("Chrome failed to open debugging port")

        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as res:
            targets = json.loads(res.read().decode())
            page_target = next((t for t in targets if t.get("type") == "page"), targets[0])
            ws_url = page_target["webSocketDebuggerUrl"]

        parsed = urllib.parse.urlparse(ws_url)
        ws_sock = socket.create_connection((parsed.hostname, parsed.port))

        key = "dGhlIHNhbXBsZSBub25jZQ=="
        handshake = (
            f"GET {parsed.path} HTTP/1.1\r\n"
            f"Host: {parsed.netloc}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        ws_sock.sendall(handshake.encode())
        ws_sock.recv(1024)

        req_id = 1
        send_cdp_cmd(ws_sock, req_id, "Runtime.enable"); req_id += 1
        send_cdp_cmd(ws_sock, req_id, "Page.enable"); req_id += 1

        # Navigate to application
        send_cdp_cmd(ws_sock, req_id, "Page.navigate", {"url": "http://localhost:3000/#landing"}); req_id += 1
        time.sleep(1.0)

        # Track runtime errors after page load
        eval_js(ws_sock, req_id, """
        window.__advErrors = [];
        window.addEventListener('error', e => window.__advErrors.push(e.message));
        window.addEventListener('unhandledrejection', e => window.__advErrors.push(String(e.reason)));
        """); req_id += 1

        # -------------------------------------------------------------
        # PROBE 1: RRuleParser Edge Cases & Invalidation Scenarios
        # -------------------------------------------------------------
        print("\n[*] Probe 1: Testing RRuleParser Adversarial Invalidation Scenarios...")
        probe1_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { RRuleParser } = await import('./js/calendar/rrule.js');

            // Test 1: matchesOriginalStart tolerance boundaries
            const t0 = '2026-11-05T09:00:00';
            const tWithin = '2026-11-05T09:00:50'; // 50s difference -> should match
            const tOutside = '2026-11-05T09:01:30'; // 90s difference -> should NOT match
            const matchWithin = RRuleParser.matchesOriginalStart(t0, tWithin);
            const matchOutside = RRuleParser.matchesOriginalStart(t0, tOutside);

            // Test 2: Inverted range [rangeEnd, rangeStart]
            const master = {
                id: 2001,
                title: 'Weekly Standup',
                start_at: '2026-11-02T10:00:00',
                end_at: '2026-11-02T10:30:00',
                recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6',
                is_exception: false,
                is_cancelled: false
            };
            const inverted = RRuleParser.expandAll([master], new Date('2026-11-10'), new Date('2026-11-01'));

            // Test 3: Weekly series with Wednesday cancelled
            const excCancelledWed = {
                id: 2002,
                title: 'Weekly Standup (Cancelled Wed)',
                start_at: '2026-11-04T10:00:00',
                end_at: '2026-11-04T10:30:00',
                original_start: '2026-11-04T10:00:00',
                parent_event_id: 2001,
                is_exception: true,
                is_cancelled: true
            };
            const weeklyExpanded = RRuleParser.expandAll(
                [master, excCancelledWed],
                new Date('2026-11-01T00:00:00'),
                new Date('2026-11-08T23:59:59')
            );
            const wedItems = weeklyExpanded.filter(e => e.start_at.includes('2026-11-04'));
            const monItems = weeklyExpanded.filter(e => e.start_at.includes('2026-11-02'));
            const friItems = weeklyExpanded.filter(e => e.start_at.includes('2026-11-06'));

            return {
                matchWithin,
                matchOutside,
                invertedLength: inverted.length,
                weeklyTotal: weeklyExpanded.length,
                wedCount: wedItems.length,
                monCount: monItems.length,
                friCount: friItems.length
            };
        })()
        """); req_id += 1

        assert probe1_res["matchWithin"] is True, "50s difference should match within 60s tolerance"
        assert probe1_res["matchOutside"] is False, "90s difference should NOT match"
        assert probe1_res["invertedLength"] == 0, "Inverted date range should return 0 items"
        assert probe1_res["wedCount"] == 0, "Cancelled Wednesday occurrence must be suppressed"
        assert probe1_res["monCount"] == 1, "Monday occurrence must be preserved"
        assert probe1_res["friCount"] == 1, "Friday occurrence must be preserved"
        print("   [PASS] RRuleParser boundary tolerances and weekly BYDAY tombstone suppression verified")

        # -------------------------------------------------------------
        # PROBE 2: Task Adapter Edge Cases
        # -------------------------------------------------------------
        print("\n[*] Probe 2: Testing Task Adapter Edge Cases & Store State...")
        probe2_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { adaptTaskForCalendar } = await import('./js/calendar/task-adapter.js');

            // 1. Missing due date
            const noDue = adaptTaskForCalendar({ id: 1, title: 'No due' });

            // 2. All-day task
            const allDay = adaptTaskForCalendar({ id: 2, title: 'All day', due_date: '2026-11-05', is_all_day: true });

            // 3. Timed task with end_time <= start_time (inverted or invalid end time)
            const invertedTime = adaptTaskForCalendar({
                id: 3,
                title: 'Inverted times',
                due_date: '2026-11-05',
                start_time: '14:00',
                end_time: '13:00',
                duration_minutes: 45,
                is_all_day: false
            });

            return {
                noDueNull: noDue === null,
                allDayIsAllDay: allDay?.is_all_day === true,
                allDayStart: allDay?.start_at,
                invertedEndCorrect: invertedTime?.end_at.includes('14:45')
            };
        })()
        """); req_id += 1

        assert probe2_res["noDueNull"] is True, "Task without due_date must return null"
        assert probe2_res["allDayIsAllDay"] is True, "All-day task must have is_all_day: true"
        assert probe2_res["invertedEndCorrect"] is True, "Inverted end time must fallback to duration_minutes"
        print("   [PASS] Task adapter correctly handles all-day, missing due_date, and inverted time fallbacks")

        # -------------------------------------------------------------
        # PROBE 3: Real ChatPanel planify:data-changed Event Verification
        # -------------------------------------------------------------
        print("\n[*] Probe 3: Testing Real ChatPanel planify:data-changed Trigger...")
        probe3_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { ChatPanel } = await import('./js/ai/chat-panel.js');
            const { api } = await import('./js/api.js');

            const panel = ChatPanel.init();

            let caughtEvent = null;
            const listener = (e) => {
                caughtEvent = e.detail;
            };
            window.addEventListener('planify:data-changed', listener);

            // Mock api.post once to simulate an AI response with tool_calls
            const originalPost = api.post;
            api.post = async (url, data) => {
                if (url.includes('/ai/chat') || url.includes('/ai/conversations')) {
                    return {
                        conversation_id: 9999,
                        content: 'Đã hoàn thành tạo sự kiện!',
                        tool_calls: [
                            { tool: 'create_event', arguments: { title: 'Test Meeting' }, result: { success: true } }
                        ],
                        created_at: new Date().toISOString()
                    };
                }
                return originalPost.call(api, url, data);
            };

            await panel.sendMessage('Lên lịch họp thử nghiệm');

            // Restore api.post
            api.post = originalPost;
            window.removeEventListener('planify:data-changed', listener);

            return {
                eventDispatched: caughtEvent !== null,
                source: caughtEvent?.source,
                action: caughtEvent?.action,
                toolCallsLength: caughtEvent?.toolCalls?.length
            };
        })()
        """); req_id += 1

        assert probe3_res["eventDispatched"] is True, "ChatPanel did NOT dispatch planify:data-changed on tool execution!"
        assert probe3_res["source"] == "ai-assistant", f"Expected source 'ai-assistant', got {probe3_res['source']}"
        assert probe3_res["action"] == "tool-executed", f"Expected action 'tool-executed', got {probe3_res['action']}"
        assert probe3_res["toolCallsLength"] == 1, "Tool calls detail missing in event payload"
        print("   [PASS] Genuine ChatPanel instance verified emitting planify:data-changed on AI tool execution")

        # -------------------------------------------------------------
        # PROBE 4: Check Uncaught Errors
        # -------------------------------------------------------------
        errors = eval_js(ws_sock, req_id, "window.__advErrors"); req_id += 1
        print(f"\n[*] Probe 4: Checking uncaught browser errors: {len(errors)} found.")
        assert len(errors) == 0, f"Uncaught errors during adversarial testing: {errors}"
        print("   [PASS] 0 uncaught errors during full adversarial probe execution")

        print("\n=====================================================================")
        print("🎉 ALL INDEPENDENT ADVERSARIAL REVIEW TESTS PASSED (4/4)!")
        print("=====================================================================")

    finally:
        chrome_proc.terminate()
        chrome_proc.wait()

if __name__ == "__main__":
    main()
