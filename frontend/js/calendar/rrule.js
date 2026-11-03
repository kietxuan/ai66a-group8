import { toLocalISOString, businessWallTime } from '../utils/date.js';

export function recurrenceContext(event) {
  return (event.recurrence_rule || event.is_occurrence || event.parent_event_id || event.original_start)
    ? { scope: 'this', original_start: event.original_start || event.start_at } : {};
}

export function eventDeleteUrl(event) {
  const context = recurrenceContext(event);
  return `/events/${event.id}${context.original_start ? `?scope=this&occurrence_date=${encodeURIComponent(context.original_start + (/(Z|[+-]\d{2}:\d{2})$/.test(context.original_start) ? '' : '+07:00'))}` : ''}`;
}

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
      else if (key === 'BYMONTHDAY') rule.bymonthday = val.split(',').map(Number);
      else if (key === 'COUNT') rule.count = parseInt(val, 10);
      else if (key === 'UNTIL') {
        rule.until = this.parseUntilDate(val);
      }
    }
    return rule.freq ? rule : null;
  }

  static parseUntilDate(str) {
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T23:59:59`);
    if (str.includes('-')) return new Date(businessWallTime(str));
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
    if (!str.includes('T')) return new Date(y, m, d, 23, 59, 59);
    const date = new Date(Date.UTC(y, m, d, hh, mm, ss));
    return new Date(str.endsWith('Z') ? businessWallTime(date.toISOString()) : new Date(y, m, d, hh, mm, ss));
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
    const origStart = new Date(event.start_at), origEnd = new Date(event.end_at);
    const rStart = new Date(rangeStart), rEnd = new Date(rangeEnd);
    if (!event.recurrence_rule) return origStart < rEnd && origEnd > rStart ? [event] : [];
    const rule = this.parse(event.recurrence_rule);
    if (!rule || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) return [];
    const interval = Math.max(1, rule.interval || 1);
    const duration = origEnd - origStart;
    let until = rule.until;
    if (event.recurrence_end) {
      const end = new Date(event.recurrence_end);
      until = !until || end < until ? end : until;
    }
    const dayNumber = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
    const originDay = dayNumber(origStart);
    const monday = originDay - ((origStart.getDay() + 6) % 7);
    const cur = new Date(origStart);
    if (!rule.count && rStart - duration > origStart) {
      const near = new Date(rStart - duration);
      cur.setFullYear(near.getFullYear(), near.getMonth(), near.getDate());
    }
    let count = 0, examined = 0;
    const occurrences = [];
    while (cur <= rEnd && (!until || cur <= until)) {
      if (++examined > 366000) throw new Error('Khoảng tính lịch lặp quá lớn.');
      const days = dayNumber(cur) - originDay;
      const months = (cur.getFullYear() - origStart.getFullYear()) * 12 + cur.getMonth() - origStart.getMonth();
      const byDay = !rule.byday || rule.byday.some(code => {
        const match = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(code);
        if (!match || this.DAY_INDEX_MAP[match[2]] !== cur.getDay()) return false;
        if (!match[1]) return true;
        const ordinal = Number(match[1]);
        const position = rule.freq === 'YEARLY' ? dayNumber(cur) - dayNumber(new Date(cur.getFullYear(), 0, 1)) : cur.getDate() - 1;
        const remaining = rule.freq === 'YEARLY' ? dayNumber(new Date(cur.getFullYear(), 11, 31)) - dayNumber(cur) : new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate() - cur.getDate();
        return ordinal > 0 ? Math.floor(position / 7) + 1 === ordinal : -(Math.floor(remaining / 7) + 1) === ordinal;
      });
      const monthDay = rule.bymonthday ? rule.bymonthday.includes(cur.getDate()) : (rule.byday ? true : cur.getDate() === origStart.getDate());
      let matches = false;
      if (rule.freq === 'DAILY') matches = days % interval === 0 && byDay;
      if (rule.freq === 'WEEKLY') matches = Math.floor((dayNumber(cur) - monday) / 7) % interval === 0 && (rule.byday ? byDay : cur.getDay() === origStart.getDay());
      if (rule.freq === 'MONTHLY') matches = months % interval === 0 && monthDay && byDay;
      if (rule.freq === 'YEARLY') matches = (cur.getFullYear() - origStart.getFullYear()) % interval === 0 && (rule.byday || rule.bymonthday || cur.getMonth() === origStart.getMonth()) && monthDay && byDay;
      if (rule.bymonthday) matches = matches && monthDay;
      if (matches && cur >= origStart) {
        count++;
        if (rule.count && count > rule.count) break;
        const end = new Date(cur.getTime() + duration);
        if (end > rStart && cur < rEnd && !this.isOccurrenceSuppressed(cur, exceptions)) occurrences.push(this.cloneOccurrence(event, cur, end));
      }
      cur.setDate(cur.getDate() + 1);
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
      original_start: sIso,
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


