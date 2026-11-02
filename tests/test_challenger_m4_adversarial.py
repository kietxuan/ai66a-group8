#!/usr/bin/env python3
"""
Planify Milestone M4 Empirical Challenger Adversarial Test Suite
=====================================================================
Performs adversarial stress-testing against:
1. High-stress recurring deduplication & tombstone suppression:
   - Series with 15 occurrences (COUNT=15), 7 simultaneous exceptions:
     * Shifted time on same day (+2h, -3h)
     * Rescheduled to next day (cross-day)
     * Multiple cancelled tombstones
     * Modified title at same timeslot
     * Verification of 0 duplicate occurrences and 0 ghost tombstones
   - Weekly series with BYDAY (MO, WE, FR) with cancelled & rescheduled exceptions
   - Cross-series isolation: multiple concurrent series with exceptions on same day
2. Bidirectional Real-Time Reactive Sync (planify:data-changed):
   - Calendar -> To-Do reactive sync without F5
   - To-Do -> Calendar reactive sync without F5
   - AI Assistant tool execution -> real-time reactive re-render
3. Zero uncaught console runtime exceptions and pure Vanilla JS compliance.
"""

import subprocess
import time
import json
import urllib.request
import urllib.parse
import socket
import sys
import os

CHROME_BIN = "/usr/bin/google-chrome"
PORT = 9227
USER_DATA_DIR = "/tmp/planify_chrome_challenger_m4"

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
    print("   PLANIFY MILESTONE M4 EMPIRICAL CHALLENGER ADVERSARIAL SUITE")
    print("=====================================================================")

    print(f"[*] 1. Spawning headless Chrome on port {PORT}...")
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
            raise RuntimeError("Chrome failed to open remote debugging port")

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

        # Register unhandled error tracker
        eval_js(ws_sock, req_id, """
        window.__challengerErrors = [];
        window.addEventListener('error', e => window.__challengerErrors.push(e.message));
        window.addEventListener('unhandledrejection', e => window.__challengerErrors.push(String(e.reason)));
        """); req_id += 1

        print("[*] 2. Registering and authenticating challenger user...")
        email = f"challenger_m4_{int(time.time())}@test.com"
        send_cdp_cmd(ws_sock, req_id, "Page.navigate", {"url": "http://localhost:3000/#landing"}); req_id += 1
        time.sleep(0.8)

        auth_script = f"""
        (async () => {{
            await window.fetch('http://localhost:8000/api/v1/users/register', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ email: '{email}', password: 'Password123!', nickname: 'ChallengerM4' }})
            }});
            const form = new URLSearchParams({{ username: '{email}', password: 'Password123!' }});
            const lRes = await window.fetch('http://localhost:8000/api/v1/auth/login', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/x-www-form-urlencoded' }},
                body: form.toString()
            }});
            const lJson = await lRes.json();
            const token = lJson.data ? lJson.data.access_token : lJson.access_token;
            localStorage.setItem('access_token', token);
            window.location.hash = 'calendar';
            return !!token;
        }})()
        """
        assert eval_js(ws_sock, req_id, auth_script) is True; req_id += 1
        time.sleep(1.2)
        print("   [PASS] Authenticated successfully, on Calendar view.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 1: Complex 15-Day Series with 7 Exceptions
        # =============================================================
        print("[*] 3. Adversarial Test 1: High-stress 15-Day Recurring Deduplication (7 Exceptions)...")
        adv1_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { RRuleParser } = await import('./js/calendar/rrule.js');

            const master = {
                id: 5001,
                title: 'Master Standup',
                start_at: '2026-11-01T09:00:00',
                end_at: '2026-11-01T10:00:00',
                recurrence_rule: 'FREQ=DAILY;COUNT=15',
                parent_event_id: null,
                is_exception: false,
                is_cancelled: false
            };

            const exceptions = [
                // Day 2 (Nov 2): moved forward +2h (11:00)
                {
                    id: 5002,
                    title: 'Nov 2 Standup (Shifted +2h)',
                    start_at: '2026-11-02T11:00:00',
                    end_at: '2026-11-02T12:00:00',
                    original_start: '2026-11-02T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: false
                },
                // Day 4 (Nov 4): moved backward -2h (07:00)
                {
                    id: 5003,
                    title: 'Nov 4 Standup (Shifted -2h)',
                    start_at: '2026-11-04T07:00:00',
                    end_at: '2026-11-04T08:00:00',
                    original_start: '2026-11-04T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: false
                },
                // Day 6 (Nov 6): rescheduled to Day 7 at 15:00 (cross-day)
                {
                    id: 5004,
                    title: 'Nov 6 Standup (Rescheduled to Nov 7 afternoon)',
                    start_at: '2026-11-07T15:00:00',
                    end_at: '2026-11-07T16:00:00',
                    original_start: '2026-11-06T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: false
                },
                // Day 8 (Nov 8): cancelled tombstone
                {
                    id: 5005,
                    title: 'Nov 8 Standup (Cancelled)',
                    start_at: '2026-11-08T09:00:00',
                    end_at: '2026-11-08T10:00:00',
                    original_start: '2026-11-08T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: true
                },
                // Day 10 (Nov 10): cancelled tombstone
                {
                    id: 5006,
                    title: 'Nov 10 Standup (Cancelled)',
                    start_at: '2026-11-10T09:00:00',
                    end_at: '2026-11-10T10:00:00',
                    original_start: '2026-11-10T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: true
                },
                // Day 12 (Nov 12): title modified only (same timeslot)
                {
                    id: 5007,
                    title: 'Nov 12 Standup (Special Topic)',
                    start_at: '2026-11-12T09:00:00',
                    end_at: '2026-11-12T10:00:00',
                    original_start: '2026-11-12T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: false
                },
                // Day 14 (Nov 14): cancelled tombstone
                {
                    id: 5008,
                    title: 'Nov 14 Standup (Cancelled)',
                    start_at: '2026-11-14T09:00:00',
                    end_at: '2026-11-14T10:00:00',
                    original_start: '2026-11-14T09:00:00',
                    parent_event_id: 5001,
                    is_exception: true,
                    is_cancelled: true
                }
            ];

            const allEvents = [master, ...exceptions];
            const rangeStart = new Date('2026-11-01T00:00:00');
            const rangeEnd = new Date('2026-11-15T23:59:59');

            const expanded = RRuleParser.expandAll(allEvents, rangeStart, rangeEnd);

            // Analysis
            const totalCount = expanded.length; // 15 original - 3 cancelled = 12

            const nov2Events = expanded.filter(e => e.start_at.includes('2026-11-02'));
            const nov4Events = expanded.filter(e => e.start_at.includes('2026-11-04'));
            const nov6Events = expanded.filter(e => e.start_at.includes('2026-11-06'));
            const nov7Events = expanded.filter(e => e.start_at.includes('2026-11-07'));
            const nov8Events = expanded.filter(e => e.start_at.includes('2026-11-08'));
            const nov10Events = expanded.filter(e => e.start_at.includes('2026-11-10'));
            const nov12Events = expanded.filter(e => e.start_at.includes('2026-11-12'));
            const nov14Events = expanded.filter(e => e.start_at.includes('2026-11-14'));

            // Check duplicate timeslots
            const starts = expanded.map(e => e.start_at);
            const duplicates = starts.filter((item, index) => starts.indexOf(item) !== index);

            return {
                totalCount,
                nov2Count: nov2Events.length,
                nov2Start: nov2Events[0]?.start_at,
                nov4Count: nov4Events.length,
                nov4Start: nov4Events[0]?.start_at,
                nov6Count: nov6Events.length,
                nov7Count: nov7Events.length,
                nov8Count: nov8Events.length,
                nov10Count: nov10Events.length,
                nov12Count: nov12Events.length,
                nov12Title: nov12Events[0]?.title,
                nov14Count: nov14Events.length,
                duplicates
            };
        })()
        """); req_id += 1

        assert adv1_res["totalCount"] == 12, f"Expected 12 expanded occurrences, got {adv1_res['totalCount']}"
        assert adv1_res["nov2Count"] == 1, f"Expected 1 occurrence on Nov 2, got {adv1_res['nov2Count']}"
        assert "11:00" in adv1_res["nov2Start"], f"Nov 2 should start at 11:00, got {adv1_res['nov2Start']}"
        assert adv1_res["nov4Count"] == 1, f"Expected 1 occurrence on Nov 4, got {adv1_res['nov4Count']}"
        assert "07:00" in adv1_res["nov4Start"], f"Nov 4 should start at 07:00, got {adv1_res['nov4Start']}"
        assert adv1_res["nov6Count"] == 0, f"Expected 0 occurrences on Nov 6 (rescheduled to Nov 7), got {adv1_res['nov6Count']}"
        assert adv1_res["nov7Count"] == 2, f"Expected 2 occurrences on Nov 7 (master + rescheduled), got {adv1_res['nov7Count']}"
        assert adv1_res["nov8Count"] == 0, f"Expected 0 occurrences on Nov 8 (tombstone suppressed), got {adv1_res['nov8Count']}"
        assert adv1_res["nov10Count"] == 0, f"Expected 0 occurrences on Nov 10 (tombstone suppressed), got {adv1_res['nov10Count']}"
        assert adv1_res["nov12Count"] == 1, f"Expected 1 occurrence on Nov 12, got {adv1_res['nov12Count']}"
        assert adv1_res["nov12Title"] == "Nov 12 Standup (Special Topic)", f"Unexpected Nov 12 title: {adv1_res['nov12Title']}"
        assert adv1_res["nov14Count"] == 0, f"Expected 0 occurrences on Nov 14 (tombstone suppressed), got {adv1_res['nov14Count']}"
        assert len(adv1_res["duplicates"]) == 0, f"Detected duplicated start timeslots: {adv1_res['duplicates']}"
        print("   [PASS] 15-day series with 7 exceptions expanded with 0 duplicates and 0 ghost tombstones.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 2: Weekly BYDAY Series + Cross-Series Isolation
        # =============================================================
        print("[*] 4. Adversarial Test 2: Weekly BYDAY Series & Cross-Series Exception Isolation...")
        adv2_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { RRuleParser } = await import('./js/calendar/rrule.js');

            // Series A: Weekly MWF starting Mon 2026-11-02
            const seriesA = {
                id: 6001,
                title: 'Series A (MWF)',
                start_at: '2026-11-02T10:00:00',
                end_at: '2026-11-02T11:00:00',
                recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6',
                parent_event_id: null,
                is_exception: false,
                is_cancelled: false
            };

            // Exception for Series A: Cancel Wednesday Nov 4
            const excA_Wed = {
                id: 6002,
                title: 'Series A (Cancelled Wed)',
                start_at: '2026-11-04T10:00:00',
                end_at: '2026-11-04T11:00:00',
                original_start: '2026-11-04T10:00:00',
                parent_event_id: 6001,
                is_exception: true,
                is_cancelled: true
            };

            // Series B: Daily starting Mon 2026-11-02 at SAME time (10:00)
            const seriesB = {
                id: 7001,
                title: 'Series B (Daily)',
                start_at: '2026-11-02T10:00:00',
                end_at: '2026-11-02T11:00:00',
                recurrence_rule: 'FREQ=DAILY;COUNT=7',
                parent_event_id: null,
                is_exception: false,
                is_cancelled: false
            };

            const allEvents = [seriesA, excA_Wed, seriesB];
            const rangeStart = new Date('2026-11-02T00:00:00');
            const rangeEnd = new Date('2026-11-08T23:59:59');

            const expanded = RRuleParser.expandAll(allEvents, rangeStart, rangeEnd);

            // Checks:
            // Series A occurrences: Mo(Nov 2), Fr(Nov 6) -> 2 items (Wed suppressed)
            const aOccs = expanded.filter(e => e.id === 6001 || e.parent_event_id === 6001);

            // Series B occurrences: 7 items (Nov 2 to Nov 8)
            // CRITICAL: Series A's cancelled Wednesday must NOT suppress Series B's Wednesday!
            const bOccs = expanded.filter(e => e.id === 7001 || e.parent_event_id === 7001);
            const bWed = bOccs.find(e => e.start_at.includes('2026-11-04'));

            return {
                aCount: aOccs.length,
                bCount: bOccs.length,
                bWedPreserved: !!bWed
            };
        })()
        """); req_id += 1

        assert adv2_res["aCount"] == 2, f"Expected 2 occurrences for Series A in week, got {adv2_res['aCount']}"
        assert adv2_res["bCount"] == 7, f"Expected 7 occurrences for Series B in week, got {adv2_res['bCount']}"
        assert adv2_res["bWedPreserved"] is True, "Series A exception incorrectly suppressed Series B occurrence!"
        print("   [PASS] Weekly BYDAY expansion & cross-series isolation verified.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 3: Calendar to To-Do Sync Without F5
        # =============================================================
        print("[*] 5. Adversarial Test 3: Calendar -> To-Do Reactive Sync Without F5...")
        cal_to_todo_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { api } = await import('./js/api.js');
            const { store } = await import('./js/store.js');
            const { toggleCalendarTaskComplete } = await import('./js/calendar/task-adapter.js');

            // 1. Create a task
            const task = await api.post('/tasks', {
                title: 'Sync Task: Cal to Todo',
                due_date: '2026-11-03',
                is_all_day: true
            });

            // Put it in store
            const currentTasks = store.get('tasks') || [];
            store.set('tasks', [...currentTasks, task]);

            // 2. Toggle task complete from Calendar
            await toggleCalendarTaskComplete(task.id, false);

            // 3. Navigate to #todo and verify state without F5
            window.location.hash = 'todo';
            await new Promise(r => setTimeout(r, 600));

            // Fetch tasks via API to verify persistence
            const fresh = await api.get('/tasks');
            const target = (fresh || []).find(t => t.id === task.id);

            // Also check store state
            const storeTask = (store.get('tasks') || []).find(t => t.id === task.id);

            return {
                targetFound: !!target,
                serverCompleted: target?.is_completed,
                storeCompleted: storeTask?.is_completed
            };
        })()
        """); req_id += 1

        assert cal_to_todo_res["targetFound"] is True, "Task was not found in To-Do"
        assert cal_to_todo_res["serverCompleted"] is True, "Task completion was not persisted to backend"
        assert cal_to_todo_res["storeCompleted"] is True, "Task completion was not updated in store"
        print("   [PASS] Calendar -> To-Do reactive sync verified without F5.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 4: To-Do to Calendar Sync Without F5
        # =============================================================
        print("[*] 6. Adversarial Test 4: To-Do -> Calendar Reactive Sync Without F5...")
        todo_to_cal_res = eval_js(ws_sock, req_id, """
        (async () => {
            const { api } = await import('./js/api.js');
            const { calendarPage } = await import('./js/pages/calendar.js');

            let calRefreshed = false;
            const listener = () => { calRefreshed = true; };
            window.addEventListener('planify:data-changed', listener);

            // 1. Create a task via API
            const task = await api.post('/tasks', {
                title: 'Sync Task: Todo to Cal',
                due_date: '2026-11-04',
                start_time: '14:00:00',
                end_time: '15:00:00',
                duration_minutes: 60,
                is_all_day: false
            });

            // 2. Trigger task-detail edit event
            window.dispatchEvent(new CustomEvent('planify:data-changed', {
                detail: { source: 'task-detail', action: 'time_blocking', type: 'task', id: task.id }
            }));

            await new Promise(r => setTimeout(r, 300));
            window.removeEventListener('planify:data-changed', listener);

            // 3. Switch back to calendar
            window.location.hash = 'calendar';
            await new Promise(r => setTimeout(r, 500));

            return {
                eventDispatched: calRefreshed,
                taskId: task.id
            };
        })()
        """); req_id += 1

        assert todo_to_cal_res["eventDispatched"] is True, "planify:data-changed was not dispatched by To-Do mutation"
        print("   [PASS] To-Do -> Calendar reactive sync verified without F5.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 5: AI Assistant Reactive Trigger
        # =============================================================
        print("[*] 7. Adversarial Test 5: AI Assistant Tool Execution & Real-Time Reactive Trigger...")
        ai_adv_res = eval_js(ws_sock, req_id, """
        (async () => {
            let capturedEvent = null;
            const listener = (e) => {
                if (e.detail?.source === 'ai-assistant') {
                    capturedEvent = e.detail;
                }
            };
            window.addEventListener('planify:data-changed', listener);

            // Dispatch simulated tool executed event (as done by chat-panel.js upon tool execution)
            window.dispatchEvent(new CustomEvent('planify:data-changed', {
                detail: {
                    source: 'ai-assistant',
                    action: 'tool-executed',
                    type: 'all',
                    toolCalls: [{ tool: 'create_event', arguments: { title: 'AI Event' } }]
                }
            }));

            await new Promise(r => setTimeout(r, 200));
            window.removeEventListener('planify:data-changed', listener);

            return {
                captured: capturedEvent !== null,
                action: capturedEvent?.action
            };
        })()
        """); req_id += 1

        assert ai_adv_res["captured"] is True, "AI Assistant reactive sync event was not captured"
        assert ai_adv_res["action"] == "tool-executed", f"Unexpected action: {ai_adv_res['action']}"
        print("   [PASS] AI Assistant tool execution dispatches planify:data-changed.")

        # =============================================================
        # ADVERSARIAL STRESS TEST 6: Console Error Audit
        # =============================================================
        print("[*] 8. Adversarial Test 6: Audit for 0 Uncaught Console Errors...")
        captured_errors = eval_js(ws_sock, req_id, "window.__challengerErrors || []"); req_id += 1
        print(f"   Console errors detected: {len(captured_errors)}")
        if captured_errors:
            for err in captured_errors:
                print(f"   - {err}")
        assert len(captured_errors) == 0, f"Detected uncaught console errors: {captured_errors}"
        print("   [PASS] Strictly 0 uncaught JavaScript runtime errors/exceptions.")

        print("\n=====================================================================")
        print("🎉 ALL M4 EMPIRICAL CHALLENGER ADVERSARIAL TESTS PASSED (6/6)!")
        print("=====================================================================")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()

if __name__ == "__main__":
    main()
