import { DayId, Language, WEEK_DAYS } from '@/src/data/quranData';

export interface DualDateInfo {
  hijriDate: string;
  gregorianDate: string;
  combined: string;
  dayName: string;
}

/**
 * Format date in both Hijri (Umm al-Qura) and Gregorian calendars
 */
export function getDualDate(date: Date = new Date(), lang: Language = 'ar'): DualDateInfo {
  let hijriDate = '';
  try {
    const hijriFormatter = new Intl.DateTimeFormat(
      lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
    hijriDate = hijriFormatter.format(date);
    if (lang === 'ar' && !hijriDate.includes('هـ')) {
      hijriDate += ' هـ';
    }
  } catch {
    hijriDate = lang === 'ar' ? '١٤٤٨ هـ' : '1448 AH';
  }

  let gregorianDate = '';
  try {
    const gregFormatter = new Intl.DateTimeFormat(
      lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
    gregorianDate = gregFormatter.format(date);
    if (lang === 'ar' && !gregorianDate.includes('م')) {
      gregorianDate += ' م';
    }
  } catch {
    gregorianDate = date.toLocaleDateString();
  }

  const dayFormatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
  });
  const dayName = dayFormatter.format(date);

  const combined =
    lang === 'ar'
      ? `${dayName}، ${hijriDate} · ${gregorianDate}`
      : `${dayName}, ${hijriDate} · ${gregorianDate}`;

  return {
    hijriDate,
    gregorianDate,
    combined,
    dayName,
  };
}

/**
 * Get date for a specific DayId in the current active week
 */
export function getDateForWeekDay(dayId: DayId): Date {
  const targetDay = WEEK_DAYS.find((d) => d.id === dayId);
  const targetJsDay = targetDay ? targetDay.jsDay : 0;

  const now = new Date();
  const currentJsDay = now.getDay();
  // Difference relative to current week (Sunday as first day 0, Saturday as 6)
  const diff = targetJsDay - currentJsDay;

  const res = new Date(now);
  res.setDate(now.getDate() + diff);
  return res;
}

/**
 * Get compact dual date for week day chips and tables
 */
export function getCompactDualDate(dayId: DayId, lang: Language): { hijri: string; greg: string } {
  const d = getDateForWeekDay(dayId);
  try {
    const hFormat = new Intl.DateTimeFormat(
      lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura',
      { day: 'numeric', month: 'short' }
    );
    const gFormat = new Intl.DateTimeFormat(
      lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US',
      { day: 'numeric', month: 'short' }
    );

    const hijri = hFormat.format(d);
    const greg = gFormat.format(d);
    return {
      hijri: lang === 'ar' ? `${hijri} هـ` : `${hijri}`,
      greg: lang === 'ar' ? `${greg} م` : `${greg}`,
    };
  } catch {
    return {
      hijri: '',
      greg: `${d.getDate()}/${d.getMonth() + 1}`,
    };
  }
}

export type DateFormatPreference = 'both' | 'hijri' | 'gregorian';

export function formatDateByPreference(
  dual: DualDateInfo,
  pref: DateFormatPreference = 'both'
): { primary: string; secondary?: string; singleLine: string } {
  if (pref === 'hijri') {
    return {
      primary: dual.hijriDate,
      secondary: undefined,
      singleLine: dual.hijriDate,
    };
  }
  if (pref === 'gregorian') {
    return {
      primary: dual.gregorianDate,
      secondary: undefined,
      singleLine: dual.gregorianDate,
    };
  }
  return {
    primary: dual.hijriDate,
    secondary: dual.gregorianDate,
    singleLine: `${dual.hijriDate} · ${dual.gregorianDate}`,
  };
}

export function formatCompactDateByPreference(
  compact: { hijri: string; greg: string },
  pref: DateFormatPreference = 'both'
): string {
  if (pref === 'hijri') return compact.hijri;
  if (pref === 'gregorian') return compact.greg;
  return `${compact.hijri} · ${compact.greg}`;
}
