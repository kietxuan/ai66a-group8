/**
 * Lightweight RFC 5545 RRULE Parser and Expansion Utility
 */

export class RRuleParser {
  /**
   * Parse RRULE string: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;UNTIL=20261231"
   */
  static parse(rruleStr) {
    if (!rruleStr) return null;
    const parts = rruleStr.replace(/^RRULE:/i, '').split(';');
    const rule = {
      freq: null,
      interval: 1,
      byday: [],
      until: null,
      count: null
    };

    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (!key || !value) return;
      const upperKey = key.toUpperCase();
      if (upperKey === 'FREQ') rule.freq = value.toUpperCase();
      else if (upperKey === 'INTERVAL') rule.interval = parseInt(value, 10) || 1;
      else if (upperKey === 'BYDAY') rule.byday = value.split(',').map(s => s.trim().toUpperCase());
      else if (upperKey === 'UNTIL') rule.until = value;
      else if (upperKey === 'COUNT') rule.count = parseInt(value, 10);
    });

    return rule;
  }

  /**
   * Build RRULE string from options
   */
  static build(options = {}) {
    if (!options.freq) return null;
    const parts = [`FREQ=${options.freq.toUpperCase()}`];
    if (options.interval && options.interval > 1) {
      parts.push(`INTERVAL=${options.interval}`);
    }
    if (options.byday && options.byday.length > 0) {
      parts.push(`BYDAY=${options.byday.join(',')}`);
    }
    if (options.until) {
      const untilStr = options.until.replace(/[-:]/g, '').slice(0, 8);
      parts.push(`UNTIL=${untilStr}`);
    }
    return parts.join(';');
  }

  /**
   * Expand occurrences within a range [rangeStart, rangeEnd]
   */
  static getOccurrences(startDate, rruleStr, rangeStart, rangeEnd, maxOccurrences = 100) {
    const rule = this.parse(rruleStr);
    if (!rule || !rule.freq) return [new Date(startDate)];

    const occurrences = [];
    const cur = new Date(startDate);
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    let count = 0;

    const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
    const targetDays = (rule.byday || []).map(d => dayMap[d]).filter(d => d !== undefined);

    while (cur.getTime() <= endMs && count < maxOccurrences) {
      if (rule.until) {
        // Simple until check
        const untilDate = new Date(
          rule.until.slice(0, 4) + '-' + rule.until.slice(4, 6) + '-' + rule.until.slice(6, 8)
        );
        if (cur.getTime() > untilDate.getTime()) break;
      }

      if (cur.getTime() >= startMs) {
        if (rule.freq === 'WEEKLY' && targetDays.length > 0) {
          if (targetDays.includes(cur.getDay())) {
            occurrences.push(new Date(cur));
            count++;
          }
        } else {
          occurrences.push(new Date(cur));
          count++;
        }
      }

      // Increment cur based on frequency
      if (rule.freq === 'DAILY') {
        cur.setDate(cur.getDate() + (rule.interval || 1));
      } else if (rule.freq === 'WEEKLY') {
        if (targetDays.length > 0) {
          cur.setDate(cur.getDate() + 1);
        } else {
          cur.setDate(cur.getDate() + (7 * (rule.interval || 1)));
        }
      } else if (rule.freq === 'MONTHLY') {
        cur.setMonth(cur.getMonth() + (rule.interval || 1));
      } else if (rule.freq === 'YEARLY') {
        cur.setFullYear(cur.getFullYear() + (rule.interval || 1));
      } else {
        break;
      }
    }

    return occurrences;
  }
}

