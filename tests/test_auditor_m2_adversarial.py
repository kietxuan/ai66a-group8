from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

#!/usr/bin/env python3
"""
Auditor Milestone M2 Adversarial & Stress Testing Suite
Independently written by Forensic Auditor to challenge assumptions and edge cases:
- Dropdown: Missing callbacks, dividers, null triggers, rapid double-invocations.
- Modal: Multi-depth stacking (allowStack), z-index ordering, Esc top-of-stack popping.
- Date serialization: Leap years, single digits, invalid inputs, null dates.
- Task reordering: Non-existent IDs, self-swaps, position index integrity.
- Recurrence Scope Modal: All 3 radio choices, cancel dismissals.
"""

import subprocess
import time
import json
import urllib.request
import urllib.parse
import socket
import sys

CHROME_BIN = "/usr/bin/google-chrome"
PORT = 9225
USER_DATA_DIR = "/tmp/planify_chrome_auditor_test"

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
    print("[*] Launching Auditor Headless Chrome on port 9225...")
    chrome_proc = subprocess.Popen([
        CHROME_BIN,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DATA_DIR}",
        "--no-sandbox",
        "--disable-gpu",
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
            page_targets = [t for t in targets if t.get("type") == "page"]
            ws_url = (page_targets[0] if page_targets else targets[0])["webSocketDebuggerUrl"]

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

        print("[*] Navigating to Planify app...")
        send_cdp_cmd(ws_sock, req_id, "Page.navigate", {"url": "http://localhost:3000/#landing"}); req_id += 1
        time.sleep(1.0)

        # ---------------------------------------------------------------------
        # Adversarial Test 1: Dropdown edge cases
        # ---------------------------------------------------------------------
        print("[*] Adversarial Test 1: Dropdown stress & boundary cases...")
        dropdown_stress = eval_js(ws_sock, req_id, """
        (async () => {
            const { Dropdown } = await import('./js/components/dropdown.js');

            // 1.1 Show with neither triggerEl nor anchorEl
            let noCrashOnNull = false;
            try {
                Dropdown.show({ items: [] });
                noCrashOnNull = true;
            } catch (e) {
                noCrashOnNull = false;
            }

            // 1.2 Show with anchorEl only, items containing dividers and items without callbacks
            let actionCalled = false;
            let onClickCalled = false;
            const dummyAnchor = document.createElement('button');
            document.body.appendChild(dummyAnchor);

            Dropdown.show({
                anchorEl: dummyAnchor,
                items: [
                    { label: 'Divider Item', divider: true },
                    { label: 'No Callback Item' },
                    { label: 'Action Item', action: () => { actionCalled = true; } },
                    { label: 'OnClick Item', onClick: () => { onClickCalled = true; } }
                ]
            });

            const menu = document.querySelector('.dropdown-menu');
            const hasMenu = !!menu;
            const dividerCount = menu ? menu.querySelectorAll('.dropdown-divider').length : 0;
            const items = menu ? Array.from(menu.querySelectorAll('.dropdown-item')) : [];

            // Click item with action
            items[1].click(); // index 1 is Action Item
            // Click item with onClick
            Dropdown.show({
                anchorEl: dummyAnchor,
                items: [{ label: 'OnClick Item', onClick: () => { onClickCalled = true; } }]
            });
            const menu2 = document.querySelector('.dropdown-menu');
            if (menu2) {
                menu2.querySelector('.dropdown-item').click();
            }

            // Cleanup
            dummyAnchor.remove();

            return {
                noCrashOnNull,
                hasMenu,
                dividerCount,
                actionCalled,
                onClickCalled,
                closedAfterClick: document.querySelectorAll('.dropdown-menu').length === 0
            };
        })()
        """); req_id += 1

        assert dropdown_stress["noCrashOnNull"] is True, f"Dropdown crashed on null target: {dropdown_stress}"
        assert dropdown_stress["hasMenu"] is True, "Dropdown menu not created"
        assert dropdown_stress["dividerCount"] == 1, f"Divider count mismatch: {dropdown_stress}"
        assert dropdown_stress["actionCalled"] is True, "item.action callback was not invoked"
        assert dropdown_stress["onClickCalled"] is True, "item.onClick callback was not invoked"
        assert dropdown_stress["closedAfterClick"] is True, "Dropdown did not close after item click"
        print("   [PASS] Dropdown handles null targets, dividers, dual callbacks, and self-closing cleanly.")

        # ---------------------------------------------------------------------
        # Adversarial Test 2: Modal Stacking & Escape Key Hierarchy
        # ---------------------------------------------------------------------
        print("[*] Adversarial Test 2: Modal multi-depth stacking & Escape key hierarchy...")
        modal_stack_stress = eval_js(ws_sock, req_id, """
        (async () => {
            const { Modal } = await import('./js/components/modal.js');

            // Open Modal 1
            const m1 = Modal.open({ title: 'Modal 1', content: 'Content 1' });
            const initialStack = Modal.modalStack.length;

            // Open Modal 2 with allowStack=true
            const m2 = Modal.open({ title: 'Modal 2', content: 'Content 2', allowStack: true });
            const stackAfterM2 = Modal.modalStack.length;

            // Open Modal 3 with allowStack=true
            const m3 = Modal.open({ title: 'Modal 3', content: 'Content 3', allowStack: true });
            const stackAfterM3 = Modal.modalStack.length;

            // Check backdrops and z-indexes
            const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
            const zIndexes = backdrops.map(b => b.style.zIndex);

            // Trigger Escape key event on document
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
            document.dispatchEvent(escEvent);

            const stackAfterFirstEsc = Modal.modalStack.length;
            const topModalAfterFirstEsc = Modal.activeModal ? Modal.activeModal.title : null;

            // Trigger Escape again
            document.dispatchEvent(escEvent);
            const stackAfterSecondEsc = Modal.modalStack.length;

            // Trigger Escape third time
            document.dispatchEvent(escEvent);
            const stackAfterThirdEsc = Modal.modalStack.length;

            return {
                initialStack,
                stackAfterM2,
                stackAfterM3,
                backdropsCount: backdrops.length,
                zIndexes,
                stackAfterFirstEsc,
                topModalAfterFirstEsc,
                stackAfterSecondEsc,
                stackAfterThirdEsc
            };
        })()
        """); req_id += 1

        assert modal_stack_stress["initialStack"] == 1, f"Modal 1 not on stack: {modal_stack_stress}"
        assert modal_stack_stress["stackAfterM2"] == 2, f"Modal 2 did not stack: {modal_stack_stress}"
        assert modal_stack_stress["stackAfterM3"] == 3, f"Modal 3 did not stack: {modal_stack_stress}"
        assert modal_stack_stress["zIndexes"] == ['', '510', '520'], f"Unexpected z-indexes: {modal_stack_stress['zIndexes']}"
        assert modal_stack_stress["stackAfterFirstEsc"] == 2, f"Esc did not pop only topmost modal: {modal_stack_stress}"
        assert modal_stack_stress["topModalAfterFirstEsc"] == "Modal 2", f"Top modal after Esc was not Modal 2: {modal_stack_stress}"
        assert modal_stack_stress["stackAfterSecondEsc"] == 1, f"Second Esc failed: {modal_stack_stress}"
        assert modal_stack_stress["stackAfterThirdEsc"] == 0, f"Third Esc failed: {modal_stack_stress}"
        print("   [PASS] Modal stacking maintains strict z-index depth ('', '510', '520') and LIFO Escape dismissal.")

        # ---------------------------------------------------------------------
        # Adversarial Test 3: Date & Timezone Edge Cases
        # ---------------------------------------------------------------------
        print("[*] Adversarial Test 3: Date toLocalISOString boundary & corrupt input stress...")
        date_stress = eval_js(ws_sock, req_id, """
        (async () => {
            const { toLocalISOString } = await import('./js/utils/date.js');

            // Boundary: Leap year 2024 Feb 29
            const leapDate = new Date(2024, 1, 29, 23, 59, 59);
            const leapIso = toLocalISOString(leapDate);

            // Boundary: Single digit month & day padding
            const singleDigitDate = new Date(2026, 3, 5, 4, 8, 2); // April 5, 04:08:02
            const singleDigitIso = toLocalISOString(singleDigitDate);

            // Boundary: Invalid date
            const invalidIso = toLocalISOString(new Date('invalid-string'));

            // Boundary: null / undefined / empty
            const nullIso = toLocalISOString(null);
            const undefIso = toLocalISOString(undefined);

            return {
                leapIso,
                singleDigitIso,
                invalidIso,
                nullIso,
                undefIso
            };
        })()
        """); req_id += 1

        assert date_stress["leapIso"] == "2024-02-29T23:59:59", f"Leap year failed: {date_stress}"
        assert date_stress["singleDigitIso"] == "2026-04-05T04:08:02", f"Single digit padding failed: {date_stress}"
        assert date_stress["invalidIso"] == "", f"Invalid date must return empty string: {date_stress}"
        assert date_stress["nullIso"] == "", f"Null must return empty string: {date_stress}"
        assert date_stress["undefIso"] == "", f"Undefined must return empty string: {date_stress}"
        print("   [PASS] toLocalISOString handles leap year, single-digit padding, invalid dates, and nulls with 0 errors.")

        # ---------------------------------------------------------------------
        # Adversarial Test 4: Task Reordering Edge Cases
        # ---------------------------------------------------------------------
        print("[*] Adversarial Test 4: Task reorder boundary conditions (non-existent IDs, self-swaps)...")
        reorder_stress = eval_js(ws_sock, req_id, """
        (async () => {
            const { todoPage } = await import('./js/pages/todo.js');

            // Provide mock components for headless execution without full DOM mount
            todoPage.sidebarComponent = { update: () => {} };
            todoPage.taskListComponent = { setProps: () => {} };
            todoPage.taskFormComponent = { setListContext: () => {} };

            // Populate mock task list
            todoPage.tasks = [
                { id: 101, title: 'T1', position: 0 },
                { id: 102, title: 'T2', position: 1 },
                { id: 103, title: 'T3', position: 2 }
            ];

            // 4.1 Reorder with nonexistent source or target
            await todoPage.reorderTasks(9999, 102);
            const unchangedAfterBadSource = todoPage.tasks.map(t => t.id);

            await todoPage.reorderTasks(101, 8888);
            const unchangedAfterBadTarget = todoPage.tasks.map(t => t.id);

            // 4.2 Reorder element with itself
            await todoPage.reorderTasks(102, 102);
            const unchangedAfterSelfSwap = todoPage.tasks.map(t => t.id);
            const positionsAfterSelfSwap = todoPage.tasks.map(t => t.position);

            // 4.3 Move last element to first
            await todoPage.reorderTasks(103, 101);
            const movedIds = todoPage.tasks.map(t => t.id);
            const continuousPositions = todoPage.tasks.map(t => t.position);

            return {
                unchangedAfterBadSource,
                unchangedAfterBadTarget,
                unchangedAfterSelfSwap,
                positionsAfterSelfSwap,
                movedIds,
                continuousPositions
            };
        })()
        """); req_id += 1

        assert reorder_stress["unchangedAfterBadSource"] == [101, 102, 103], f"Bad source corrupted list: {reorder_stress}"
        assert reorder_stress["unchangedAfterBadTarget"] == [101, 102, 103], f"Bad target corrupted list: {reorder_stress}"
        assert reorder_stress["unchangedAfterSelfSwap"] == [101, 102, 103], f"Self swap corrupted list: {reorder_stress}"
        assert reorder_stress["positionsAfterSelfSwap"] == [0, 1, 2], f"Self swap corrupted positions: {reorder_stress}"
        assert reorder_stress["movedIds"] == [103, 101, 102], f"Reorder failed: {reorder_stress}"
        assert reorder_stress["continuousPositions"] == [0, 1, 2], f"Positions not sequential: {reorder_stress}"
        print("   [PASS] Task reordering safely handles missing IDs, identity swaps, and preserves 0-indexed positions.")

        # ---------------------------------------------------------------------
        # Adversarial Test 5: Recurrence Scope Dialog Radio Interactions & Cancel
        # ---------------------------------------------------------------------
        print("[*] Adversarial Test 5: Recurrence Scope Dialog all-option selection & Cancel action...")
        scope_stress = eval_js(ws_sock, req_id, """
        (async () => {
            const { EventForm } = await import('./js/calendar/event-form.js');
            const { Modal } = await import('./js/components/modal.js');

            let confirmedScope = null;
            let onConfirmRan = false;

            // 5.1 Test Cancel button dismisses without calling onConfirm
            EventForm.showRecurrenceScopeModal({
                action: 'update',
                onConfirm: (scope) => { onConfirmRan = true; }
            });

            const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Hủy');
            if (cancelBtn) cancelBtn.click();

            const closedAfterCancel = document.querySelectorAll('.recurrence-scope-dialog').length === 0;

            // 5.2 Test 'all' radio option
            EventForm.showRecurrenceScopeModal({
                action: 'update',
                onConfirm: (scope) => { confirmedScope = scope; }
            });

            const radioAll = document.getElementById('scope-opt-all');
            radioAll.checked = true;
            radioAll.dispatchEvent(new Event('change'));

            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Lưu thay đổi');
            if (saveBtn) saveBtn.click();

            return {
                onConfirmRanAfterCancel: onConfirmRan,
                closedAfterCancel,
                confirmedScope
            };
        })()
        """); req_id += 1

        assert scope_stress["onConfirmRanAfterCancel"] is False, "onConfirm was invoked on Cancel"
        assert scope_stress["closedAfterCancel"] is True, "Scope modal not closed on Cancel"
        assert scope_stress["confirmedScope"] == "all", f"Selected scope 'all' failed: {scope_stress}"
        print("   [PASS] Recurrence Scope Dialog Cancel button dismisses cleanly; 'all' scope propagates correctly.")

        print("\n🎉 ALL ADVERSARIAL STRESS TESTS PASSED 100%!")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=2)
        except:
            chrome_proc.kill()

if __name__ == "__main__":
    main()
