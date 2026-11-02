import { toLocalISOString } from '../utils/date.js';

export class RRuleParser {
  static parse(rruleStr) {
    if (!rruleStr) return null;
    const parts = rruleStr.split(';');
    const rule = {
      freq: null,
      interval: 1,
      byday: null,
      count: null,
      until: null
    };

    for (const part of parts) {
      const [rawKey, rawVal] = part.split('=');
      if (!rawKey || !rawVal) continue;
      const key = rawKey.trim().toUpperCase();
      const val = rawVal.trim().toUpperCase();

      if (key === 'FREQ') rule.freq = val;
      else if (key === 'INTERVAL') rule.interval = parseInt(val, 10) || 1;
      else if (key === 'BYDAY') rule.byday = val.split(',').map(d => d.trim());
      else if (key === 'COUNT') rule.count = parseInt(val, 10);
      else if (key === 'UNTIL') {
        rule.until = this.parseUntilDate(val);
      }
    }
    return rule.freq ? rule : null;
  }

  static parseUntilDate(str) {
    if (!str) return null;
    if (str.includes('-')) return new Date(str);
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const d = parseInt(str.substring(6, 8), 10);
    let hh = 23, mm = 59, ss = 59;
    if (str.includes('T')) {
      const timePart = str.split('T')[1];
      hh = parseInt(timePart.substring(0, 2), 10) || 0;
      mm = parseInt(timePart.substring(2, 4), 10) || 0;
      ss = parseInt(timePart.substring(4, 6), 10) || 0;
    }
    return new Date(Date.UTC(y, m, d, hh, mm, ss));
  }

  static DAY_INDEX_MAP = {
    'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
  };

  /**
   * Check if a candidate occurrence date matches an exception original_start anchor
   */
  static matchesOriginalStart(excOriginalStart, occStartDate) {
    if (!excOriginalStart || !occStartDate) return false;
    const excDate = new Date(excOriginalStart);
    const occDate = new Date(occStartDate);
    if (isNaN(excDate.getTime()) || isNaN(occDate.getTime())) return false;

    // 1. Exact or close timestamp comparison (tolerance within 60s)
    if (Math.abs(excDate.getTime() - occDate.getTime()) <= 60000) {
      return true;
    }

    // 2. Local date & time comparison (YYYY-MM-DD HH:mm)
    const pad = (n) => String(n).padStart(2, '0');
    const localKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (localKey(excDate) === localKey(occDate)) {
      return true;
    }

    // 3. UTC date & time comparison (YYYY-MM-DD HH:mm)
    const utcKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    if (utcKey(excDate) === utcKey(occDate)) {
      return true;
    }

    // 4. Date-only comparison if string is YYYY-MM-DD
    const str = String(excOriginalStart).trim();
    if (str.length === 10) {
      const localDate = `${occDate.getFullYear()}-${pad(occDate.getMonth() + 1)}-${pad(occDate.getDate())}`;
      const utcDate = `${occDate.getUTCFullYear()}-${pad(occDate.getUTCMonth() + 1)}-${pad(occDate.getUTCDate())}`;
      if (str === localDate || str === utcDate) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if an occurrence matches any exception in the list
   */
  static isOccurrenceSuppressed(occDate, exceptions = []) {
    if (!exceptions || exceptions.length === 0) return false;
    return exceptions.some(exc => {
      const targetAnchor = exc.original_start || exc.start_at;
      return this.matchesOriginalStart(targetAnchor, occDate);
    });
  }

  /**
   * Generates occurrences for an event within [rangeStart, rangeEnd],
   * suppressing occurrences matching child exceptions.
   */
  static expand(event, rangeStart, rangeEnd, exceptions = []) {
    if (!event.recurrence_rule) {
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      return (s <= rangeEnd && e >= rangeStart) ? [event] : [];
    }

    const rule = this.parse(event.recurrence_rule);
    if (!rule) {
      return [event];
    }

    const origStart = new Date(event.start_at);
    const origEnd = new Date(event.end_at);
    const durationMs = Math.max(0, origEnd.getTime() - origStart.getTime());

    let until = rule.until;
    if (event.recurrence_end) {
      const recEnd = new Date(event.recurrence_end);
      if (!until || recEnd < until) until = recEnd;
    }

    const occurrences = [];
    let countSoFar = 0;
    const maxCount = rule.count || 500;
    const interval = Math.max(1, rule.interval || 1);

    const rStart = new Date(rangeStart);
    const rEnd = new Date(rangeEnd);

    if (rule.freq === 'DAILY') {
      let cur = new Date(origStart);
      let iter = 0;
      while (iter < 1000 && countSoFar < maxCount) {
        if (until && cur > until) break;
        if (cur > rEnd) break;

        const curEnd = new Date(cur.getTime() + durationMs);
        if (curEnd >= rStart && cur <= rEnd) {
          if (!this.isOccurrenceSuppressed(cur, exceptions)) {
            occurrences.push(this.cloneOccurrence(event, cur, curEnd));
          }
        }

        countSoFar++;
        cur = new Date(cur.getTime() + interval * 86400000);
        iter++;
      }
    } else if (rule.freq === 'WEEKLY') {
      const bydays = rule.byday && rule.byday.length > 0 
        ? rule.byday.map(d => this.DAY_INDEX_MAP[d]).filter(d => d !== undefined)
        : [origStart.getDay()];

      let weekStart = new Date(origStart);
      const dayOffset = (weekStart.getDay() === 0 ? -6 : 1 - weekStart.getDay());
      weekStart.setDate(weekStart.getDate() + dayOffset);
      weekStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), origStart.getMilliseconds());

      let weekIter = 0;
      let stop = false;

      while (weekIter < 200 && !stop && countSoFar < maxCount) {
        for (const targetDay of bydays) {
          const offsetFromMon = targetDay === 0 ? 6 : targetDay - 1;
          const occDate = new Date(weekStart);
          occDate.setDate(occDate.getDate() + offsetFromMon);

          if (occDate < origStart) continue;

          if (until && occDate > until) {
            stop = true;
            break;
          }

          if (occDate > rEnd) {
            stop = true;
            break;
          }

          const occEnd = new Date(occDate.getTime() + durationMs);
          if (occEnd >= rStart && occDate <= rEnd) {
            if (!this.isOccurrenceSuppressed(occDate, exceptions)) {
              occurrences.push(this.cloneOccurrence(event, occDate, occEnd));
            }
          }

          countSoFar++;
          if (countSoFar >= maxCount) {
            stop = true;
            break;
          }
        }

        weekStart.setDate(weekStart.getDate() + interval * 7);
        weekIter++;
      }
    } else if (rule.freq === 'MONTHLY') {
      let cur = new Date(origStart);
      let iter = 0;
      while (iter < 240 && countSoFar < maxCount) {
        if (until && cur > until) break;
        if (cur > rEnd) break;

        const curEnd = new Date(cur.getTime() + durationMs);
        if (curEnd >= rStart && cur <= rEnd) {
          if (!this.isOccurrenceSuppressed(cur, exceptions)) {
            occurrences.push(this.cloneOccurrence(event, cur, curEnd));
          }
        }

        countSoFar++;
        cur = new Date(cur);
        cur.setMonth(cur.getMonth() + interval);
        iter++;
      }
    } else if (rule.freq === 'YEARLY') {
      let cur = new Date(origStart);
      let iter = 0;
      while (iter < 50 && countSoFar < maxCount) {
        if (until && cur > until) break;
        if (cur > rEnd) break;

        const curEnd = new Date(cur.getTime() + durationMs);
        if (curEnd >= rStart && cur <= rEnd) {
          if (!this.isOccurrenceSuppressed(cur, exceptions)) {
            occurrences.push(this.cloneOccurrence(event, cur, curEnd));
          }
        }

        countSoFar++;
        cur = new Date(cur);
        cur.setFullYear(cur.getFullYear() + interval);
        iter++;
      }
    } else {
      occurrences.push(event);
    }

    return occurrences;
  }

  static cloneOccurrence(event, start, end) {
    const sIso = toLocalISOString(start);
    const eIso = toLocalISOString(end);
    return {
      ...event,
      start_at: sIso,
      end_at: eIso,
      is_occurrence: true,
      recurrence_instance_date: sIso.split('T')[0]
    };
  }

  /**
   * Expands all events, deduplicating recurring master series against child exceptions.
   * - Suppresses master occurrences that match cancelled tombstones (is_cancelled === true)
   * - Suppresses master occurrences that match modified child exceptions (is_exception === true && !is_cancelled)
   * - Renders modified exceptions exactly once within the requested time window
   */
  static expandAll(events, rangeStart, rangeEnd) {
    if (!events || !Array.isArray(events)) return [];

    const rStart = new Date(rangeStart);
    const rEnd = new Date(rangeEnd);

    // 1. Group all child exceptions by parent_event_id
    const exceptionsByParent = new Map();
    for (const ev of events) {
      if (ev.parent_event_id && (ev.is_exception || ev.original_start)) {
        const pId = ev.parent_event_id;
        if (!exceptionsByParent.has(pId)) {
          exceptionsByParent.set(pId, []);
        }
        exceptionsByParent.get(pId).push(ev);
      }
    }

    const list = [];
    for (const ev of events) {
      // 2. Suppress cancelled tombstones from being directly rendered
      if (ev.is_cancelled) continue;

      // 3. Child exceptions (modified occurrences)
      if (ev.is_exception && ev.parent_event_id) {
        const s = new Date(ev.start_at);
        const e = new Date(ev.end_at);
        if (s <= rEnd && e >= rStart) {
          list.push({
            ...ev,
            is_occurrence: true,
            recurrence_instance_date: toLocalISOString(s).split('T')[0]
          });
        }
      } else {
        // 4. Master recurring events or non-recurring single events
        const childExceptions = exceptionsByParent.get(ev.id) || [];
        const occs = this.expand(ev, rangeStart, rangeEnd, childExceptions);
        list.push(...occs);
      }
    }

    return list;
  }
}


