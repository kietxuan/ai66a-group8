from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

"""
Adversarial Recurrence Engine & Stress Test Suite
Challenger: teamwork_challenger_m1_1
Target: backend/app/services/task_service.py & backend/app/services/event_service.py

Test Categories:
1. Century Leap Years & Leap Day Boundaries (2000, 1900, 2100, 2024, 2028, 2096, 2104)
2. Month-End Sequences (31 -> 28/29, 31 -> 30, full 12-month cascade, multi-month INTERVAL)
3. Year-Boundary Crossings & Bi-Weekly Intervals (Dec 25 -> Jan 8, bi-monthly, etc.)
4. BYDAY Combinations & High-Frequency Sequences (All 7 days, disordered, positional, invalid)
5. COUNT Limits & Termination Edge Cases (COUNT=0, COUNT=1, COUNT=2, negative, malformed)
6. UNTIL Limits & Timezone Variations (UTC, offset +07:00, exact boundary, past date, invalid)
7. Realistic Fuzzing & Malformed Input Robustness (Exotic strings, negative intervals, missing keys)
8. Live HTTP API & Database Integrity Tests (Leap day task, century 1900 task, COUNT=2 termination, UNTIL expiration, event scope='this')
9. Adversarial Exploit Probes: Unbounded INTERVAL Overflow & Year Out-of-Range (Empirical defect reproduction)
"""

import sys
import os
import random
import string
import calendar
from datetime import datetime, date, timedelta
import asyncio
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.task_service import task_service

BASE_URL = "http://localhost:8000/api/v1"

def unwrap(res):
    j = res.json()
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j

class TestFailure(Exception):
    pass

total_assertions = 0

def check(condition, msg):
    global total_assertions
    total_assertions += 1
    if not condition:
        raise TestFailure(f"FAILED ASSERTION: {msg}")

def run_century_and_leap_tests():
    print("\n--- [Category 1: Century Leap Years & Leap Day Boundaries] ---")

    # 1.1 Year 2000: Century Leap Year (divisible by 400 -> LEAP)
    # Jan 31, 2000 + MONTHLY -> Feb 29, 2000
    res = task_service._calculate_next_due_date(date(2000, 1, 31), "FREQ=MONTHLY")
    check(res == date(2000, 2, 29), f"Expected 2000-02-29, got {res}")
    print("  [PASS] Century leap year 2000: Jan 31 -> Feb 29 (clamped to leap day)")

    # Feb 29, 2000 + YEARLY -> Feb 28, 2001 (non-leap year clamping)
    res = task_service._calculate_next_due_date(date(2000, 2, 29), "FREQ=YEARLY")
    check(res == date(2001, 2, 28), f"Expected 2001-02-28, got {res}")
    print("  [PASS] Century leap year 2000: Feb 29 -> Feb 28, 2001")

    # Feb 29, 1996 + YEARLY;INTERVAL=4 -> Feb 29, 2000
    res = task_service._calculate_next_due_date(date(1996, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    check(res == date(2000, 2, 29), f"Expected 2000-02-29, got {res}")
    print("  [PASS] Leap year 1996 + 4 years -> Century leap year 2000 (Feb 29 preserved)")

    # Feb 29, 2000 + YEARLY;INTERVAL=4 -> Feb 29, 2004
    res = task_service._calculate_next_due_date(date(2000, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    check(res == date(2004, 2, 29), f"Expected 2004-02-29, got {res}")
    print("  [PASS] Century leap year 2000 + 4 years -> Leap year 2004 (Feb 29 preserved)")

    # 1.2 Year 1900: Century Common Year (divisible by 100, NOT 400 -> NOT LEAP)
    # Jan 31, 1900 + MONTHLY -> Feb 28, 1900
    res = task_service._calculate_next_due_date(date(1900, 1, 31), "FREQ=MONTHLY")
    check(res == date(1900, 2, 28), f"Expected 1900-02-28, got {res}")
    print("  [PASS] Century non-leap year 1900: Jan 31 -> Feb 28")

    # Feb 29, 1896 (leap) + YEARLY;INTERVAL=4 -> Feb 28, 1900 (clamped to 28)
    res = task_service._calculate_next_due_date(date(1896, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    check(res == date(1900, 2, 28), f"Expected 1900-02-28, got {res}")
    print("  [PASS] Leap year 1896 + 4 years -> Century non-leap 1900 clamped to Feb 28")

    # 1.3 Year 2100: Century Common Year (divisible by 100, NOT 400 -> NOT LEAP)
    # Jan 31, 2100 + MONTHLY -> Feb 28, 2100
    res = task_service._calculate_next_due_date(date(2100, 1, 31), "FREQ=MONTHLY")
    check(res == date(2100, 2, 28), f"Expected 2100-02-28, got {res}")
    print("  [PASS] Century non-leap year 2100: Jan 31 -> Feb 28")

    # Feb 29, 2096 (leap) + YEARLY;INTERVAL=4 -> Feb 28, 2100 (clamped to 28)
    res = task_service._calculate_next_due_date(date(2096, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    check(res == date(2100, 2, 28), f"Expected 2100-02-28, got {res}")
    print("  [PASS] Leap year 2096 + 4 years -> Century non-leap 2100 clamped to Feb 28")

    # 1.4 Consecutive Leap Cycles across 2024 -> 2028 -> 2032
    res = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    check(res == date(2028, 2, 29), f"Expected 2028-02-29, got {res}")
    res2 = task_service._calculate_next_due_date(res, "FREQ=YEARLY;INTERVAL=4")
    check(res2 == date(2032, 2, 29), f"Expected 2032-02-29, got {res2}")
    print("  [PASS] Chained 4-year leap cycles (2024 -> 2028 -> 2032) preserve Feb 29")

    # 1.5 Leap day edge with DAILY
    res = task_service._calculate_next_due_date(date(2024, 2, 28), "FREQ=DAILY")
    check(res == date(2024, 2, 29), f"Expected 2024-02-29, got {res}")
    res = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=DAILY")
    check(res == date(2024, 3, 1), f"Expected 2024-03-01, got {res}")
    print("  [PASS] Daily transitions across leap day: Feb 28 -> Feb 29 -> Mar 1")

def run_month_end_tests():
    print("\n--- [Category 2: Month-End Sequences & Full Year Cascades] ---")

    # 2.1 Month-end transitions across all months of a non-leap year (2026)
    expected_month_ends_2026 = [
        (date(2026, 1, 31), date(2026, 2, 28)), # Jan 31 -> Feb 28
        (date(2026, 3, 31), date(2026, 4, 30)), # Mar 31 -> Apr 30
        (date(2026, 5, 31), date(2026, 6, 30)), # May 31 -> Jun 30
        (date(2026, 7, 31), date(2026, 8, 31)), # Jul 31 -> Aug 31
        (date(2026, 8, 31), date(2026, 9, 30)), # Aug 31 -> Sep 30
        (date(2026, 10, 31), date(2026, 11, 30)), # Oct 31 -> Nov 30
        (date(2026, 12, 31), date(2027, 1, 31)), # Dec 31 -> Jan 31
    ]
    for start_d, expected_next in expected_month_ends_2026:
        res = task_service._calculate_next_due_date(start_d, "FREQ=MONTHLY")
        check(res == expected_next, f"For {start_d}, expected {expected_next}, got {res}")
    print("  [PASS] All 31-day month boundaries properly clamped in 2026")

    # 2.2 Month-end transitions across a leap year (2024)
    res = task_service._calculate_next_due_date(date(2024, 1, 31), "FREQ=MONTHLY")
    check(res == date(2024, 2, 29), f"Expected 2024-02-29, got {res}")
    res = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=MONTHLY")
    check(res == date(2024, 3, 29), f"Expected 2024-03-29, got {res}")
    print("  [PASS] Leap year 2024: Jan 31 -> Feb 29 -> Mar 29")

    # 2.3 Cascaded 12-Month Completion Chain
    curr = date(2026, 1, 31)
    chain = [curr]
    for _ in range(12):
        curr = task_service._calculate_next_due_date(curr, "FREQ=MONTHLY")
        chain.append(curr)
    
    for i in range(len(chain) - 1):
        d_from = chain[i]
        d_to = chain[i+1]
        check(d_to > d_from, f"Sequence must be monotonic: {d_from} -> {d_to}")
        expected_month = (d_from.month % 12) + 1
        check(d_to.month == expected_month, f"Month should be {expected_month}, got {d_to.month}")
    print(f"  [PASS] 12-month sequential cascade from Jan 31 completed without error ({chain[0]} -> {chain[-1]})")

    # 2.4 Multi-month INTERVALs (INTERVAL=2, 3, 5, 6, 12)
    res = task_service._calculate_next_due_date(date(2026, 1, 31), "FREQ=MONTHLY;INTERVAL=2")
    check(res == date(2026, 3, 31), f"Expected 2026-03-31, got {res}")

    res = task_service._calculate_next_due_date(date(2026, 1, 31), "FREQ=MONTHLY;INTERVAL=3")
    check(res == date(2026, 4, 30), f"Expected 2026-04-30, got {res}")

    res = task_service._calculate_next_due_date(date(2026, 8, 31), "FREQ=MONTHLY;INTERVAL=6")
    check(res == date(2027, 2, 28), f"Expected 2027-02-28, got {res}")

    res = task_service._calculate_next_due_date(date(2026, 1, 31), "FREQ=MONTHLY;INTERVAL=12")
    check(res == date(2027, 1, 31), f"Expected 2027-01-31, got {res}")
    print("  [PASS] Multi-month intervals (INTERVAL=2, 3, 6, 12) calculate and clamp accurately")

def run_year_boundary_and_biweekly_tests():
    print("\n--- [Category 3: Year-Boundary Crossings & Bi-Weekly Intervals] ---")

    # 3.1 Bi-weekly across Dec 25 -> Jan 8
    res = task_service._calculate_next_due_date(date(2025, 12, 25), "FREQ=WEEKLY;INTERVAL=2")
    check(res == date(2026, 1, 8), f"Expected 2026-01-08, got {res}")
    print("  [PASS] Bi-weekly crossing year boundary: Dec 25, 2025 -> Jan 8, 2026")

    # 3.2 Bi-weekly with BYDAY on Thursday: Dec 25, 2025 (Thursday) -> Jan 8, 2026 (Thursday)
    check(date(2025, 12, 25).weekday() == 3, "Dec 25 2025 must be Thursday")
    res = task_service._calculate_next_due_date(date(2025, 12, 25), "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH")
    check(res == date(2026, 1, 8), f"Expected 2026-01-08, got {res}")
    print("  [PASS] Bi-weekly with BYDAY=TH crossing year boundary: Dec 25 -> Jan 8")

    # 3.3 Multi-week crossing year boundary: Dec 15, 2025 + 4 weeks
    res = task_service._calculate_next_due_date(date(2025, 12, 15), "FREQ=WEEKLY;INTERVAL=4")
    check(res == date(2026, 1, 12), f"Expected 2026-01-12, got {res}")
    print("  [PASS] 4-week interval crossing year boundary: Dec 15, 2025 -> Jan 12, 2026")

    # 3.4 Dec 31 to Jan 1 with DAILY
    res = task_service._calculate_next_due_date(date(2025, 12, 31), "FREQ=DAILY;INTERVAL=1")
    check(res == date(2026, 1, 1), f"Expected 2026-01-01, got {res}")
    print("  [PASS] Year-end transition: Dec 31, 2025 -> Jan 1, 2026")

def run_byday_tests():
    print("\n--- [Category 4: BYDAY Combinations & Extreme Sequences] ---")

    # 4.1 All 7 weekdays: BYDAY=MO,TU,WE,TH,FR,SA,SU
    base = date(2026, 11, 2)
    check(base.weekday() == 0, "Nov 2, 2026 must be Monday")
    rrule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU"
    
    d1 = task_service._calculate_next_due_date(base, rrule)
    check(d1 == date(2026, 11, 3), f"Expected Tue 2026-11-03, got {d1}")
    d2 = task_service._calculate_next_due_date(d1, rrule)
    check(d2 == date(2026, 11, 4), f"Expected Wed 2026-11-04, got {d2}")
    d3 = task_service._calculate_next_due_date(d2, rrule)
    check(d3 == date(2026, 11, 5), f"Expected Thu 2026-11-05, got {d3}")
    d4 = task_service._calculate_next_due_date(d3, rrule)
    check(d4 == date(2026, 11, 6), f"Expected Fri 2026-11-06, got {d4}")
    d5 = task_service._calculate_next_due_date(d4, rrule)
    check(d5 == date(2026, 11, 7), f"Expected Sat 2026-11-07, got {d5}")
    d6 = task_service._calculate_next_due_date(d5, rrule)
    check(d6 == date(2026, 11, 8), f"Expected Sun 2026-11-08, got {d6}")
    d7 = task_service._calculate_next_due_date(d6, rrule)
    check(d7 == date(2026, 11, 9), f"Expected Mon 2026-11-09, got {d7}")
    print("  [PASS] All 7 weekdays (BYDAY=MO,TU,WE,TH,FR,SA,SU) step through full week and wrap to Monday")

    # 4.2 All 7 weekdays with INTERVAL=2
    res = task_service._calculate_next_due_date(date(2026, 11, 8), "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR,SA,SU")
    check(res == date(2026, 11, 16), f"Expected 2026-11-16 (skip 1 week), got {res}")
    print("  [PASS] Bi-weekly all 7 weekdays: Sun wraps with 2-week interval to next alternate Monday")

    # 4.3 Disordered and duplicate BYDAY tokens
    res = task_service._calculate_next_due_date(date(2026, 11, 2), "FREQ=WEEKLY;BYDAY=SU,FR,MO,TU,FR,MO")
    check(res == date(2026, 11, 3), f"Expected 2026-11-03, got {res}")
    print("  [PASS] Disordered and duplicate BYDAY list handled correctly")

    # 4.4 RFC 5545 Positional prefix stripping (+1MO, -2FR)
    res = task_service._calculate_next_due_date(date(2026, 11, 2), "FREQ=WEEKLY;BYDAY=+1MO,2WE,-1FR")
    check(res == date(2026, 11, 4), f"Expected 2026-11-04, got {res}")
    print("  [PASS] Positional weekday prefixes (+1MO, -1FR) stripped cleanly")

    # 4.5 Base date not on any scheduled day
    res = task_service._calculate_next_due_date(date(2026, 11, 7), "FREQ=WEEKLY;BYDAY=MO,WE")
    check(res == date(2026, 11, 9), f"Expected 2026-11-09, got {res}")
    print("  [PASS] Base date outside scheduled days smoothly jumps to first upcoming weekday")

    # 4.6 Single Day Schedule (BYDAY=WE)
    res = task_service._calculate_next_due_date(date(2026, 11, 4), "FREQ=WEEKLY;BYDAY=WE")
    check(res == date(2026, 11, 11), f"Expected 2026-11-11, got {res}")
    print("  [PASS] Single weekday BYDAY=WE advances 7 days to next Wednesday")

def run_count_tests():
    print("\n--- [Category 5: COUNT Limits & Termination Edge Cases] ---")

    # 5.1 COUNT=1 immediate termination
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;COUNT=1")
    check(res is None, f"Expected None for COUNT=1, got {res}")
    print("  [PASS] COUNT=1 returns None")

    # 5.2 COUNT=0 immediate termination
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;COUNT=0")
    check(res is None, f"Expected None for COUNT=0, got {res}")
    print("  [PASS] COUNT=0 returns None")

    # 5.3 Negative COUNT
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;COUNT=-5")
    check(res is None, f"Expected None for COUNT=-5, got {res}")
    print("  [PASS] Negative COUNT returns None")

    # 5.4 Decrement string helper
    r1 = task_service._decrement_count_in_rrule("FREQ=DAILY;COUNT=5;INTERVAL=1")
    check("COUNT=4" in r1, f"Expected COUNT=4 in {r1}")
    r2 = task_service._decrement_count_in_rrule("COUNT=2;FREQ=WEEKLY")
    check("COUNT=1" in r2, f"Expected COUNT=1 in {r2}")
    r3 = task_service._decrement_count_in_rrule("FREQ=MONTHLY")
    check(r3 == "FREQ=MONTHLY", f"Expected unchanged rule without COUNT, got {r3}")
    print("  [PASS] _decrement_count_in_rrule decrements COUNT accurately")

    # 5.5 Multi-step COUNT simulation
    rule = "FREQ=DAILY;COUNT=3"
    d = date(2026, 11, 1)
    d_next = task_service._calculate_next_due_date(d, rule)
    check(d_next == date(2026, 11, 2), f"Occurrence 2 expected, got {d_next}")
    rule = task_service._decrement_count_in_rrule(rule)
    check("COUNT=2" in rule, f"Rule should have COUNT=2, got {rule}")

    d_next2 = task_service._calculate_next_due_date(d_next, rule)
    check(d_next2 == date(2026, 11, 3), f"Occurrence 3 expected, got {d_next2}")
    rule = task_service._decrement_count_in_rrule(rule)
    check("COUNT=1" in rule, f"Rule should have COUNT=1, got {rule}")

    d_next3 = task_service._calculate_next_due_date(d_next2, rule)
    check(d_next3 is None, f"Expected None after 3 occurrences, got {d_next3}")
    print("  [PASS] COUNT=3 exact lifecycle: exactly 3 occurrences produced, terminates on 3rd")

def run_until_tests():
    print("\n--- [Category 6: UNTIL Limits & Timezone Variations] ---")

    # 6.1 Basic date UNTIL
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;UNTIL=20261105")
    check(res == date(2026, 11, 2), f"Expected 2026-11-02, got {res}")
    res = task_service._calculate_next_due_date(date(2026, 11, 5), "FREQ=DAILY;UNTIL=20261105")
    check(res is None, f"Expected None for next date past UNTIL, got {res}")
    print("  [PASS] Basic date UNTIL permits inclusive date and terminates after")

    # 6.2 ISO string with dashes: UNTIL=2026-11-05
    res = task_service._calculate_next_due_date(date(2026, 11, 5), "FREQ=DAILY;UNTIL=2026-11-05")
    check(res is None, f"Expected None for next date past 2026-11-05, got {res}")
    print("  [PASS] Dashed UNTIL format (YYYY-MM-DD) parsed and enforced")

    # 6.3 UTC Timestamp with Z: UNTIL=20261105T235959Z
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;UNTIL=20261105T235959Z")
    check(res == date(2026, 11, 2), f"Expected 2026-11-02, got {res}")
    res = task_service._calculate_next_due_date(date(2026, 11, 5), "FREQ=DAILY;UNTIL=20261105T235959Z")
    check(res is None, f"Expected None for next date > 2026-11-05, got {res}")
    print("  [PASS] UTC UNTIL timestamp with Z (YYYYMMDDTHHMMSSZ) parsed and enforced")

    # 6.4 ISO timestamp with timezone offset: UNTIL=2026-11-05T17:00:00+07:00
    res = task_service._calculate_next_due_date(date(2026, 11, 5), "FREQ=DAILY;UNTIL=2026-11-05T17:00:00+07:00")
    check(res is None, f"Expected None for next date > 2026-11-05, got {res}")
    print("  [PASS] Offset UNTIL timestamp (+07:00) parsed and enforced")

    # 6.5 UNTIL already in the past
    res = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=DAILY;UNTIL=20200101")
    check(res is None, f"Expected None for historical UNTIL, got {res}")
    print("  [PASS] Historical UNTIL terminates immediately")

    # 6.6 UNTIL on Leap Day 2024-02-29
    res = task_service._calculate_next_due_date(date(2024, 2, 28), "FREQ=DAILY;UNTIL=20240229")
    check(res == date(2024, 2, 29), f"Expected 2024-02-29, got {res}")
    res = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=DAILY;UNTIL=20240229")
    check(res is None, f"Expected None after leap day UNTIL, got {res}")
    print("  [PASS] UNTIL on leap day (20240229) operates accurately")

def run_bounded_robustness_tests():
    print("\n--- [Category 7: Bounded Input Robustness & Fuzzing] ---")

    bounded_inputs = [
        "",
        ";;;;;",
        "===",
        "FREQ=",
        "FREQ=UNKNOWN_FREQ",
        "FREQ=HOURLY",
        "FREQ=SECONDLY",
        "FREQ=MINUTELY",
        "FREQ=DAILY;INTERVAL=-10",
        "FREQ=DAILY;INTERVAL=0",
        "FREQ=DAILY;INTERVAL=invalid",
        "FREQ=DAILY;INTERVAL=365",
        "FREQ=WEEKLY;BYDAY=",
        "FREQ=WEEKLY;BYDAY=,,,,,",
        "FREQ=WEEKLY;BYDAY=FOO,BAR,BAZ,123",
        "FREQ=WEEKLY;BYDAY=MO,TU,FOO,FR",
        "FREQ=MONTHLY;BYDAY=1MO,-2TU",
        "COUNT=",
        "COUNT=-1",
        "COUNT=0",
        "COUNT=abc",
        "COUNT=1.5",
        "UNTIL=",
        "UNTIL=invalid_date_string",
        "UNTIL=2026-02-31",
        "UNTIL=99999999T999999Z",
        "UNTIL=00000000",
        "FREQ=YEARLY;INTERVAL=-5",
        "FREQ=MONTHLY;INTERVAL=0",
        "FREQ=WEEKLY;INTERVAL=-1;BYDAY=MO",
        "FREQ=MONTHLY;BYDAY=月,火",
        "FREQ=DAILY;UNTIL=2026🚀1231",
        "\x00\x01\x02FREQ=DAILY",
        "FREQ=DAILY;" * 50,
    ]

    for raw in bounded_inputs:
        try:
            res = task_service._calculate_next_due_date(date(2026, 11, 1), raw)
            check(res is None or isinstance(res, date), f"Result must be date or None, got {type(res)}")
        except Exception as e:
            raise TestFailure(f"CRASH on input '{raw}': {type(e).__name__}: {e}")

    # Random combinatorial fuzzer (500 iterations with realistic parameter bounds)
    freqs = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "UNKNOWN", ""]
    intervals = ["-1", "0", "1", "2", "7", "30", "100", "abc", ""]
    bydays = ["MO", "TU,TH", "MO,WE,FR", "SA,SU", "MO,TU,WE,TH,FR,SA,SU", "XYZ", ""]
    counts = ["-5", "0", "1", "2", "10", "abc", ""]
    untils = ["20261101", "20261130T235959Z", "20200101", "invalid", ""]

    random.seed(42)
    for _ in range(500):
        parts = []
        if random.random() > 0.1: parts.append(f"FREQ={random.choice(freqs)}")
        if random.random() > 0.3: parts.append(f"INTERVAL={random.choice(intervals)}")
        if random.random() > 0.4: parts.append(f"BYDAY={random.choice(bydays)}")
        if random.random() > 0.4: parts.append(f"COUNT={random.choice(counts)}")
        if random.random() > 0.4: parts.append(f"UNTIL={random.choice(untils)}")
        rrule_fuzz = ";".join(parts)

        yr = random.randint(1900, 2050)
        mo = random.randint(1, 12)
        max_d = calendar.monthrange(yr, mo)[1]
        da = random.randint(1, max_d)
        base_d = date(yr, mo, da)

        try:
            res = task_service._calculate_next_due_date(base_d, rrule_fuzz)
            check(res is None or isinstance(res, date), "Fuzz result must be date or None")
        except Exception as e:
            raise TestFailure(f"FUZZ CRASH with base {base_d} and rrule '{rrule_fuzz}': {type(e).__name__}: {e}")

    print("  [PASS] 500 bounded combinatorial fuzzing iterations completed with 0 crashes")

async def run_live_api_and_db_tests():
    print("\n--- [Category 8: Live HTTP API & Database Integrity Tests] ---")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        uid = int(datetime.now().timestamp() * 1000)
        email = f"adv_tester_{uid}@example.com"
        pwd = "AdversarialPass123!"

        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": f"Challenger_{uid}",
            "password": pwd
        })
        check(reg.status_code == 201, f"User registration failed: {reg.text}")

        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        check(login.status_code == 200, f"Login failed: {login.text}")
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 8.1 Live Leap Day Task Creation & Clamping: Jan 31 -> Feb 29 (2024 leap year)
        t1_res = await client.post("/tasks", headers=headers, json={
            "title": "Leap Day Monthly Task",
            "due_date": "2024-01-31",
            "recurrence_rule": "FREQ=MONTHLY"
        })
        check(t1_res.status_code == 201, f"Failed creating task: {t1_res.text}")
        t1 = t1_res.json()

        c1_res = await client.patch(f"/tasks/{t1['id']}/complete", headers=headers, json={"is_completed": True})
        check(c1_res.status_code == 200, f"Failed completing task: {c1_res.text}")

        tasks_res = await client.get("/tasks", headers=headers)
        all_tasks = tasks_res.json()
        spawned_t1 = next((t for t in all_tasks if t["id"] != t1["id"] and "Leap Day" in t["title"]), None)
        check(spawned_t1 is not None, "Spawned recurrence task not found in database!")
        check(spawned_t1["due_date"] == "2024-02-29", f"Expected clamped leap day 2024-02-29, got {spawned_t1['due_date']}")
        print(f"  [PASS] Live DB: Jan 31 leap year auto-spawned task clamped to {spawned_t1['due_date']}")

        # 8.2 Live Century Non-Leap Year Task: Jan 31, 1900 -> Feb 28, 1900
        t2_res = await client.post("/tasks", headers=headers, json={
            "title": "Century 1900 Task",
            "due_date": "1900-01-31",
            "recurrence_rule": "FREQ=MONTHLY"
        })
        check(t2_res.status_code == 201, f"Failed creating task: {t2_res.text}")
        t2 = t2_res.json()
        await client.patch(f"/tasks/{t2['id']}/complete", headers=headers, json={"is_completed": True})
        all_tasks = (await client.get("/tasks", headers=headers)).json()
        spawned_t2 = next((t for t in all_tasks if t["id"] != t2["id"] and "Century 1900" in t["title"]), None)
        check(spawned_t2 is not None, "Spawned 1900 task not found")
        check(spawned_t2["due_date"] == "1900-02-28", f"Expected 1900-02-28, got {spawned_t2['due_date']}")
        print(f"  [PASS] Live DB: Century 1900 task auto-spawned clamped to {spawned_t2['due_date']}")

        # 8.3 Live COUNT=2 exact series completion termination
        t3_res = await client.post("/tasks", headers=headers, json={
            "title": "Count 2 Task",
            "due_date": "2026-11-01",
            "recurrence_rule": "FREQ=DAILY;COUNT=2"
        })
        t3 = t3_res.json()
        await client.patch(f"/tasks/{t3['id']}/complete", headers=headers, json={"is_completed": True})
        all_tasks = (await client.get("/tasks", headers=headers)).json()
        spawned_t3 = next((t for t in all_tasks if t["id"] != t3["id"] and "Count 2" in t["title"]), None)
        check(spawned_t3 is not None, "Instance 2 for COUNT=2 task was not created")
        check("COUNT=1" in spawned_t3["recurrence_rule"], f"Expected COUNT=1 in {spawned_t3['recurrence_rule']}")

        await client.patch(f"/tasks/{spawned_t3['id']}/complete", headers=headers, json={"is_completed": True})
        all_tasks_after = (await client.get("/tasks", headers=headers)).json()
        count_tasks = [t for t in all_tasks_after if "Count 2" in t["title"]]
        check(len(count_tasks) == 2, f"Expected exactly 2 tasks for COUNT=2, found {len(count_tasks)}")
        print("  [PASS] Live DB: COUNT=2 series generated exactly 2 tasks and terminated with 0 extra records")

        # 8.4 Live UNTIL limit termination
        t4_res = await client.post("/tasks", headers=headers, json={
            "title": "Until Expired Task",
            "due_date": "2026-11-01",
            "recurrence_rule": "FREQ=DAILY;UNTIL=20261101"
        })
        t4 = t4_res.json()
        await client.patch(f"/tasks/{t4['id']}/complete", headers=headers, json={"is_completed": True})
        all_tasks_until = (await client.get("/tasks", headers=headers)).json()
        until_tasks = [t for t in all_tasks_until if "Until Expired" in t["title"]]
        check(len(until_tasks) == 1, f"Expected exactly 1 task for expired UNTIL, found {len(until_tasks)}")
        print("  [PASS] Live DB: UNTIL limit prevented subsequent task generation")

        # 8.5 Live Recurring Event Exception & Deletion Stress Test
        cal_res = await client.get("/calendars", headers=headers)
        cals = cal_res.json()
        check(len(cals) > 0, "Default calendar should be auto-seeded")
        cal_id = cals[0]["id"]

        ev_res = await client.post("/events", headers=headers, json={
            "calendar_id": cal_id,
            "title": "Master Bi-Weekly Sync",
            "start_at": "2026-11-02T09:00:00Z",
            "end_at": "2026-11-02T10:00:00Z",
            "recurrence_rule": "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"
        })
        check(ev_res.status_code == 201, f"Failed creating event: {ev_res.text}")
        master_ev = ev_res.json()

        up_res = await client.put(f"/events/{master_ev['id']}", headers=headers, json={
            "scope": "this",
            "original_start": "2026-11-16T09:00:00Z",
            "title": "Modified Sync Instance",
            "start_at": "2026-11-16T11:00:00Z",
            "end_at": "2026-11-16T12:00:00Z"
        })
        check(up_res.status_code == 200, f"Failed updating event scope='this': {up_res.text}")
        ex_ev = up_res.json()
        check(ex_ev["is_exception"] is True, "Expected is_exception=True on modified instance")
        check(ex_ev["parent_event_id"] == master_ev["id"], "Parent event ID must link to master")
        check(ex_ev["original_start"].startswith("2026-11-16"), f"original_start mismatch: {ex_ev['original_start']}")

        del_res = await client.delete(
            f"/events/{master_ev['id']}?scope=this&occurrence_date=2026-11-30T09:00:00Z",
            headers=headers
        )
        check(del_res.status_code in [200, 204], f"Failed deleting single instance: {del_res.text}")

        get_master = await client.get(f"/events/{master_ev['id']}", headers=headers)
        check(get_master.status_code == 200, "Master recurring event was mistakenly deleted!")
        print("  [PASS] Live DB: Event scope='this' update and delete preserved master series and stored exceptions")

async def run_adversarial_exploit_probes():
    print("\n--- [Category 9: Adversarial Exploit Probes & Defect Reproduction] ---")
    defects_found = []

    # Probe 9.1: Uncapped INTERVAL Overflow in timedelta
    try:
        task_service._calculate_next_due_date(date(2026, 1, 1), "FREQ=DAILY;INTERVAL=999999999999999999999999999999999999999999")
    except OverflowError as oe:
        defects_found.append({
            "type": "OverflowError",
            "rule": "FREQ=DAILY;INTERVAL=999999999999999999999999999999999999999999",
            "detail": f"timedelta days parameter exceeded: {oe}"
        })
        print(f"  [DEFECT CONFIRMED] Uncaught OverflowError: {oe}")

    # Probe 9.2: Year Out-of-Range (> 9999) in YEARLY recurrence
    try:
        task_service._calculate_next_due_date(date(2026, 1, 1), "FREQ=YEARLY;INTERVAL=9999")
    except ValueError as ve:
        defects_found.append({
            "type": "ValueError",
            "rule": "FREQ=YEARLY;INTERVAL=9999",
            "detail": f"date target_year out of range: {ve}"
        })
        print(f"  [DEFECT CONFIRMED] Uncaught ValueError: {ve}")

    # Probe 9.3: Year Out-of-Range (> 9999) in MONTHLY recurrence
    try:
        task_service._calculate_next_due_date(date(2026, 1, 1), "FREQ=MONTHLY;INTERVAL=120000")
    except ValueError as ve:
        defects_found.append({
            "type": "ValueError",
            "rule": "FREQ=MONTHLY;INTERVAL=120000",
            "detail": f"date target_year out of range: {ve}"
        })
        print(f"  [DEFECT CONFIRMED] Uncaught ValueError: {ve}")

    # Probe 9.4: Live HTTP API crash (500 Internal Server Error)
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        uid = int(datetime.now().timestamp() * 1000) + 999
        email = f"exploit_user_{uid}@example.com"
        pwd = "ExploitPass123!"
        await client.post("/users/register", json={"email": email, "nickname": "Exploit", "password": pwd})
        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        t_res = await client.post("/tasks", headers=headers, json={
            "title": "Exploit Task",
            "recurrence_rule": "FREQ=DAILY;INTERVAL=999999999999999999999999999999999999999999"
        })
        t_id = t_res.json()["id"]

        comp_res = await client.patch(f"/tasks/{t_id}/complete", headers=headers, json={"is_completed": True})
        if comp_res.status_code == 500:
            defects_found.append({
                "type": "Unhandled 500 SYSTEM_ERROR",
                "endpoint": f"PATCH /api/v1/tasks/{t_id}/complete",
                "detail": f"HTTP 500 returned on task completion due to unhandled OverflowError in task_service.toggle_complete"
            })
            print(f"  [DEFECT CONFIRMED] Live HTTP 500 Server Crash reproduced on PATCH /tasks/{t_id}/complete")

    return defects_found

async def main_async():
    run_century_and_leap_tests()
    run_month_end_tests()
    run_year_boundary_and_biweekly_tests()
    run_byday_tests()
    run_count_tests()
    run_until_tests()
    run_bounded_robustness_tests()
    await run_live_api_and_db_tests()
    defects = await run_adversarial_exploit_probes()
    return defects

def main():
    print("==================================================================")
    print("  ADVERSARIAL RECURRENCE ENGINE & DATE-MATH STRESS TEST SUITE     ")
    print("==================================================================")

    try:
        defects = asyncio.run(main_async())
        print("\n==================================================================")
        print(f"ADVERSARIAL STRESS TEST SUMMARY ({total_assertions} standard assertions verified):")
        print(f"- Categories 1-8 (Leap Century, Month-End, Bi-Weekly, BYDAY, COUNT, UNTIL, DB Integrity): 100% PASSED")
        if defects:
            print(f"- Category 9: {len(defects)} DEFECTS EMPIRICALLY CONFIRMED:")
            for d in defects:
                print(f"    * {d['type']}: {d.get('rule') or d.get('endpoint')} -> {d['detail']}")
            print("==================================================================")
            # Exit with code 3 to signal defects found
            sys.exit(3)
        else:
            print("- Category 9: 0 DEFECTS FOUND (100% CLEAN)")
            print("==================================================================")
            sys.exit(0)
    except TestFailure as tf:
        print(f"\n❌ REGRESSION TEST FAILED: {tf}")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 UNEXPECTED HARNESS EXCEPTION: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(2)

if __name__ == "__main__":
    main()
