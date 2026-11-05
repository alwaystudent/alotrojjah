export type Language = 'ar' | 'en';

export type PlanType = 'new_memorization' | 'sard' | 'review';

export type CurriculumScope = 'surah' | 'juz' | 'ayah';

export type DayId =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

export type PlanStatus = 'pending' | 'in_progress' | 'completed';

export type PlanEvaluation = 'muthabbat' | 'mutaraddid' | 'mutafallit';

export type QuizLevel = 'beginner' | 'intermediate' | 'advanced' | 'hafiz';

export interface SurahInfo {
  number: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
  juz: number;
  startPage: number;
  endPage: number;
  type: 'Meccan' | 'Medinan';
}

export interface JuzInfo {
  number: number;
  nameAr: string;
  nameEn: string;
  rangeAr: string;
  rangeEn: string;
  ayahCount: number;
  pages: number;
  startPage: number;
  endPage: number;
}

export interface WeekDayInfo {
  id: DayId;
  jsDay: number; // 0 = Sunday, 6 = Saturday
  nameAr: string;
  nameEn: string;
  shortAr: string;
  shortEn: string;
}

export type CalendarMode = 'both' | 'hijri' | 'gregorian';

export interface QuranPlanItem {
  id: string;
  day: DayId;
  planType: PlanType; // حفظ جديد | سرد | مراجعة
  scope: CurriculumScope; // سورة | جزء | آيات
  // When scope === 'surah'
  surahStart?: number;
  surahEnd?: number;
  selectedSurahs?: number[]; // قائمة أرقام السور المختارة من أجزاء مختلفة
  // When scope === 'juz'
  juzStart?: number;
  juzEnd?: number;
  hizbNote?: string;
  // When scope === 'ayah'
  ayahSurah?: number;
  ayahFrom?: number;
  ayahTo?: number;
  // Common fields
  reminderTime: string; // e.g. "05:30"
  reminderEnabled: boolean;
  repeatWeekly?: boolean; // خاصية تكرار الخطة أسبوعياً
  status: PlanStatus;
  evaluation?: PlanEvaluation; // مثبت | متردد | متفلت
  quizLevel?: QuizLevel; // مبتدئ | متوسط | متقدم | حافظ
  estimatedAyahs: number;
  estimatedPages: number;
  notes?: string;
  mistakesCount?: number;
  createdAt: string;
}

export const WEEK_DAYS: WeekDayInfo[] = [
  { id: 'sunday', jsDay: 0, nameAr: 'الأحد', nameEn: 'Sunday', shortAr: 'أحد', shortEn: 'Sun' },
  { id: 'monday', jsDay: 1, nameAr: 'الإثنين', nameEn: 'Monday', shortAr: 'إثنين', shortEn: 'Mon' },
  { id: 'tuesday', jsDay: 2, nameAr: 'الثلاثاء', nameEn: 'Tuesday', shortAr: 'ثلاثاء', shortEn: 'Tue' },
  { id: 'wednesday', jsDay: 3, nameAr: 'الأربعاء', nameEn: 'Wednesday', shortAr: 'أربعاء', shortEn: 'Wed' },
  { id: 'thursday', jsDay: 4, nameAr: 'الخميس', nameEn: 'Thursday', shortAr: 'خميس', shortEn: 'Thu' },
  { id: 'friday', jsDay: 5, nameAr: 'الجمعة', nameEn: 'Friday', shortAr: 'جمعة', shortEn: 'Fri' },
  { id: 'saturday', jsDay: 6, nameAr: 'السبت', nameEn: 'Saturday', shortAr: 'سبت', shortEn: 'Sat' },
];

export function getTodayDayId(): DayId {
  const jsDay = new Date().getDay();
  const found = WEEK_DAYS.find((d) => d.jsDay === jsDay);
  return found ? found.id : 'sunday';
}

/**
 * Calculates the exact Date corresponding to a given DayId in the current week.
 */
export function getWeekDayDate(dayId: DayId, baseDate = new Date()): Date {
  const target = WEEK_DAYS.find((d) => d.id === dayId);
  if (!target) return baseDate;
  const currentJsDay = baseDate.getDay();
  const diff = target.jsDay - currentJsDay;
  const d = new Date(baseDate);
  d.setDate(baseDate.getDate() + diff);
  return d;
}

/**
 * Formats a Date in the Umm al-Qura Hijri Islamic calendar.
 */
export function formatHijriDate(date: Date, lang: Language, includeYear = true): string {
  try {
    const locale = lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
    });
    const formatted = formatter.format(date);
    if (lang === 'ar' && !formatted.includes('هـ') && includeYear) {
      return `${formatted} هـ`;
    }
    if (lang === 'en' && !formatted.includes('AH') && includeYear) {
      return `${formatted} AH`;
    }
    return formatted;
  } catch {
    return '';
  }
}

/**
 * Formats a Date in the Gregorian calendar.
 */
export function formatGregorianDate(date: Date, lang: Language, includeYear = true): string {
  try {
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: lang === 'ar' ? 'long' : 'short',
      ...(includeYear ? { year: 'numeric' } : {}),
    });
    const formatted = formatter.format(date);
    if (lang === 'ar' && !formatted.includes('م') && includeYear) {
      return `${formatted} م`;
    }
    return formatted;
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Unified calendar date formatter supporting 'both' (Hijri + Gregorian), 'hijri', or 'gregorian'.
 */
export function formatCalendarDate(
  date: Date,
  lang: Language,
  mode: CalendarMode = 'both',
  options?: { compact?: boolean; includeYear?: boolean }
): string {
  const includeYear = options?.includeYear ?? true;
  const isCompact = options?.compact ?? false;

  const hijriStr = formatHijriDate(date, lang, includeYear);
  const gregStr = formatGregorianDate(date, lang, includeYear);

  if (mode === 'hijri') {
    return hijriStr || gregStr;
  }
  if (mode === 'gregorian') {
    return gregStr;
  }

  // mode === 'both'
  if (isCompact) {
    const hijriShort = formatHijriDate(date, lang, false);
    const gregShort = formatGregorianDate(date, lang, false);
    return `${hijriShort} · ${gregShort}`;
  }

  return `${hijriStr} (${gregStr})`;
}

// Official King Fahd Glorious Quran Printing Complex (Madinah Mushaf) Juz pages (1 - 604)
export const JUZ_LIST: JuzInfo[] = [
  { number: 1, nameAr: 'الجزء الأول (الم)', nameEn: 'Juz 1 (Alif Lam Mim)', rangeAr: 'الفاتحة ١ - البقرة ١٤١', rangeEn: 'Al-Fatihah 1 - Al-Baqarah 141', ayahCount: 148, pages: 21, startPage: 1, endPage: 21 },
  { number: 2, nameAr: 'الجزء الثاني (سيقول)', nameEn: 'Juz 2 (Sayaqul)', rangeAr: 'البقرة ١٤٢ - البقرة ٢٥٢', rangeEn: 'Al-Baqarah 142 - 252', ayahCount: 111, pages: 20, startPage: 22, endPage: 41 },
  { number: 3, nameAr: 'الجزء الثالث (تلك الرسل)', nameEn: 'Juz 3 (Tilka Ar-Rusul)', rangeAr: 'البقرة ٢٥٣ - آل عمران ٩٢', rangeEn: 'Al-Baqarah 253 - Ali Imran 92', ayahCount: 126, pages: 20, startPage: 42, endPage: 61 },
  { number: 4, nameAr: 'الجزء الرابع (لن تنالوا)', nameEn: 'Juz 4 (Lan Tanalu)', rangeAr: 'آل عمران ٩٣ - النساء ٢٣', rangeEn: 'Ali Imran 93 - An-Nisa 23', ayahCount: 131, pages: 20, startPage: 62, endPage: 81 },
  { number: 5, nameAr: 'الجزء الخامس (والمحصنات)', nameEn: 'Juz 5 (Wal-Muhsanat)', rangeAr: 'النساء ٢٤ - النساء ١٤٧', rangeEn: 'An-Nisa 24 - 147', ayahCount: 124, pages: 20, startPage: 82, endPage: 101 },
  { number: 6, nameAr: 'الجزء السادس (لا يحب الله)', nameEn: 'Juz 6 (La Yuhibbullah)', rangeAr: 'النساء ١٤٨ - المائدة ٨١', rangeEn: 'An-Nisa 148 - Al-Maidah 81', ayahCount: 110, pages: 20, startPage: 102, endPage: 121 },
  { number: 7, nameAr: 'الجزء السابع (وإذا سمعوا)', nameEn: 'Juz 7 (Wa Idha Samiu)', rangeAr: 'المائدة ٨٢ - الأنعام ١١٠', rangeEn: 'Al-Maidah 82 - Al-Anam 110', ayahCount: 149, pages: 20, startPage: 122, endPage: 141 },
  { number: 8, nameAr: 'الجزء الثامن (ولو أننا)', nameEn: 'Juz 8 (Wa Law Annana)', rangeAr: 'الأنعام ١١١ - الأعراف ٨٧', rangeEn: 'Al-Anam 111 - Al-Araf 87', ayahCount: 142, pages: 20, startPage: 142, endPage: 161 },
  { number: 9, nameAr: 'الجزء التاسع (قال الملأ)', nameEn: 'Juz 9 (Qalal-Mala)', rangeAr: 'الأعراف ٨٨ - الأنفال ٤٠', rangeEn: 'Al-Araf 88 - Al-Anfal 40', ayahCount: 159, pages: 20, startPage: 162, endPage: 181 },
  { number: 10, nameAr: 'الجزء العاشر (واعلموا)', nameEn: 'Juz 10 (Wa A’lamu)', rangeAr: 'الأنفال ٤١ - التوبة ٩٢', rangeEn: 'Al-Anfal 41 - At-Tawbah 92', ayahCount: 127, pages: 20, startPage: 182, endPage: 201 },
  { number: 11, nameAr: 'الجزء الحادي عشر (يعتذرون)', nameEn: 'Juz 11 (Yatazhirun)', rangeAr: 'التوبة ٩٣ - هود ٥', rangeEn: 'At-Tawbah 93 - Hud 5', ayahCount: 151, pages: 20, startPage: 202, endPage: 221 },
  { number: 12, nameAr: 'الجزء الثاني عشر (وما من دابة)', nameEn: 'Juz 12 (Wa Ma Min Dabbah)', rangeAr: 'هود ٦ - يوسف ٥٢', rangeEn: 'Hud 6 - Yusuf 52', ayahCount: 170, pages: 20, startPage: 222, endPage: 241 },
  { number: 13, nameAr: 'الجزء الثالث عشر (وما أبرئ)', nameEn: 'Juz 13 (Wa Ma Ubarri’u)', rangeAr: 'يوسف ٥٣ - إبراهيم ٥٢', rangeEn: 'Yusuf 53 - Ibrahim 52', ayahCount: 154, pages: 20, startPage: 242, endPage: 261 },
  { number: 14, nameAr: 'الجزء الرابع عشر (ربما)', nameEn: 'Juz 14 (Rubama)', rangeAr: 'الحجر ١ - النحل ١٢٨', rangeEn: 'Al-Hijr 1 - An-Nahl 128', ayahCount: 227, pages: 20, startPage: 262, endPage: 281 },
  { number: 15, nameAr: 'الجزء الخامس عشر (سبحان الذي)', nameEn: 'Juz 15 (Subhanalladhi)', rangeAr: 'الإسراء ١ - الكهف ٧٤', rangeEn: 'Al-Isra 1 - Al-Kahf 74', ayahCount: 185, pages: 20, startPage: 282, endPage: 301 },
  { number: 16, nameAr: 'الجزء السادس عشر (قال ألم)', nameEn: 'Juz 16 (Qala Alam)', rangeAr: 'الكهف ٧٥ - طه ١٣٥', rangeEn: 'Al-Kahf 75 - Taha 135', ayahCount: 269, pages: 20, startPage: 302, endPage: 321 },
  { number: 17, nameAr: 'الجزء السابع عشر (اقترب للناس)', nameEn: 'Juz 17 (Iqtaraba)', rangeAr: 'الأنبياء ١ - الحج ٧٨', rangeEn: 'Al-Anbiya 1 - Al-Hajj 78', ayahCount: 190, pages: 20, startPage: 322, endPage: 341 },
  { number: 18, nameAr: 'الجزء الثامن عشر (قد أفلح)', nameEn: 'Juz 18 (Qad Aflaha)', rangeAr: 'المؤمنون ١ - الفرقان ٢٠', rangeEn: 'Al-Muminun 1 - Al-Furqan 20', ayahCount: 202, pages: 20, startPage: 342, endPage: 361 },
  { number: 19, nameAr: 'الجزء التاسع عشر (وقال الذين)', nameEn: 'Juz 19 (Wa Qalalladhina)', rangeAr: 'الفرقان ٢١ - النمل ٥٥', rangeEn: 'Al-Furqan 21 - An-Naml 55', ayahCount: 339, pages: 20, startPage: 362, endPage: 381 },
  { number: 20, nameAr: 'الجزء العشرون (أمن خلق)', nameEn: 'Juz 20 (Amman Khalaqa)', rangeAr: 'النمل ٥٦ - العنكبوت ٤٥', rangeEn: 'An-Naml 56 - Al-Ankabut 45', ayahCount: 171, pages: 20, startPage: 382, endPage: 401 },
  { number: 21, nameAr: 'الجزء الحادي والعشرون (اتل ما أوحي)', nameEn: 'Juz 21 (Utlu Ma Uhiya)', rangeAr: 'العنكبوت ٤٦ - الأحزاب ٣٠', rangeEn: 'Al-Ankabut 46 - Al-Ahzab 30', ayahCount: 178, pages: 20, startPage: 402, endPage: 421 },
  { number: 22, nameAr: 'الجزء الثاني والعشرون (ومن يقنت)', nameEn: 'Juz 22 (Wa Man Yaqnut)', rangeAr: 'الأحزاب ٣١ - يس ٢٧', rangeEn: 'Al-Ahzab 31 - Ya-Sin 27', ayahCount: 169, pages: 20, startPage: 422, endPage: 441 },
  { number: 23, nameAr: 'الجزء الثالث والعشرون (وما لي)', nameEn: 'Juz 23 (Wa Mali)', rangeAr: 'يس ٢٨ - الزمر ٣١', rangeEn: 'Ya-Sin 28 - Az-Zumar 31', ayahCount: 357, pages: 20, startPage: 442, endPage: 461 },
  { number: 24, nameAr: 'الجزء الرابع والعشرون (فمن أظلم)', nameEn: 'Juz 24 (Faman Azlamu)', rangeAr: 'الزمر ٣٢ - فصلت ٤٦', rangeEn: 'Az-Zumar 32 - Fussilat 46', ayahCount: 175, pages: 20, startPage: 462, endPage: 481 },
  { number: 25, nameAr: 'الجزء الخامس والعشرون (إليه يرد)', nameEn: 'Juz 25 (Ilayhi Yuraddu)', rangeAr: 'فصلت ٤٧ - الجاثية ٣٧', rangeEn: 'Fussilat 47 - Al-Jathiyah 37', ayahCount: 246, pages: 20, startPage: 482, endPage: 501 },
  { number: 26, nameAr: 'الجزء السادس والعشرون (حم - الأحقاف)', nameEn: 'Juz 26 (Ha Mim)', rangeAr: 'الأحقاف ١ - الذاريات ٣٠', rangeEn: 'Al-Ahqaf 1 - Adh-Dhariyat 30', ayahCount: 195, pages: 20, startPage: 502, endPage: 521 },
  { number: 27, nameAr: 'الجزء السابع والعشرون (قال فما خطبكم)', nameEn: 'Juz 27 (Qala Fama Khatbukum)', rangeAr: 'الذاريات ٣١ - الحديد ٢٩', rangeEn: 'Adh-Dhariyat 31 - Al-Hadid 29', ayahCount: 399, pages: 20, startPage: 522, endPage: 541 },
  { number: 28, nameAr: 'الجزء الثامن والعشرون (قد سمع الله)', nameEn: 'Juz 28 (Qad Sami Allah)', rangeAr: 'المجادلة ١ - التحريم ١٢', rangeEn: 'Al-Mujadila 1 - At-Tahrim 12', ayahCount: 137, pages: 20, startPage: 542, endPage: 561 },
  { number: 29, nameAr: 'الجزء التاسع والعشرون (تبارك)', nameEn: 'Juz 29 (Tabarak)', rangeAr: 'الملك ١ - المرسلات ٥٠', rangeEn: 'Al-Mulk 1 - Al-Mursalat 50', ayahCount: 431, pages: 20, startPage: 562, endPage: 581 },
  { number: 30, nameAr: 'الجزء الثلاثون (عمّ)', nameEn: 'Juz 30 (Amma)', rangeAr: 'النبأ ١ - الناس ٦', rangeEn: 'An-Naba 1 - An-Nas 6', ayahCount: 564, pages: 23, startPage: 582, endPage: 604 },
];

// Official King Fahd Complex Madinah Mushaf Surah list with exact startPage and endPage
const RAW_SURAHS: [number, string, string, number, number, number, 'Meccan' | 'Medinan'][] = [
  [1, 'الفاتحة', 'Al-Fatihah', 7, 1, 1, 'Meccan'],
  [2, 'البقرة', 'Al-Baqarah', 286, 1, 2, 'Medinan'],
  [3, 'آل عمران', "Ali 'Imran", 200, 3, 50, 'Medinan'],
  [4, 'النساء', 'An-Nisa', 176, 4, 77, 'Medinan'],
  [5, 'المائدة', "Al-Ma'idah", 120, 6, 106, 'Medinan'],
  [6, 'الأنعام', "Al-An'am", 165, 7, 128, 'Meccan'],
  [7, 'الأعراف', "Al-A'raf", 206, 8, 151, 'Meccan'],
  [8, 'الأنفال', 'Al-Anfal', 75, 9, 177, 'Medinan'],
  [9, 'التوبة', 'At-Tawbah', 129, 10, 187, 'Medinan'],
  [10, 'يونس', 'Yunus', 109, 11, 208, 'Meccan'],
  [11, 'هود', 'Hud', 123, 11, 221, 'Meccan'],
  [12, 'يوسف', 'Yusuf', 111, 12, 235, 'Meccan'],
  [13, 'الرعد', "Ar-Ra'd", 43, 13, 249, 'Medinan'],
  [14, 'إبراهيم', 'Ibrahim', 52, 13, 255, 'Meccan'],
  [15, 'الحجر', 'Al-Hijr', 99, 14, 262, 'Meccan'],
  [16, 'النحل', 'An-Nahl', 128, 14, 267, 'Meccan'],
  [17, 'الإسراء', 'Al-Isra', 111, 15, 282, 'Meccan'],
  [18, 'الكهف', 'Al-Kahf', 110, 15, 293, 'Meccan'],
  [19, 'مريم', 'Maryam', 98, 16, 305, 'Meccan'],
  [20, 'طه', 'Taha', 135, 16, 312, 'Meccan'],
  [21, 'الأنبياء', 'Al-Anbiya', 112, 17, 322, 'Meccan'],
  [22, 'الحج', 'Al-Hajj', 78, 17, 332, 'Medinan'],
  [23, 'المؤمنون', "Al-Mu'minun", 118, 18, 342, 'Meccan'],
  [24, 'النور', 'An-Nur', 64, 18, 350, 'Medinan'],
  [25, 'الفرقان', 'Al-Furqan', 77, 18, 359, 'Meccan'],
  [26, 'الشعراء', "Ash-Shu'ara", 227, 19, 367, 'Meccan'],
  [27, 'النمل', 'An-Naml', 93, 19, 377, 'Meccan'],
  [28, 'القصص', 'Al-Qasas', 88, 20, 385, 'Meccan'],
  [29, 'العنكبوت', "Al-'Ankabut", 69, 20, 396, 'Meccan'],
  [30, 'الروم', 'Ar-Rum', 60, 21, 404, 'Meccan'],
  [31, 'لقمان', 'Luqman', 34, 21, 411, 'Meccan'],
  [32, 'السجدة', 'As-Sajdah', 30, 21, 415, 'Meccan'],
  [33, 'الأحزاب', 'Al-Ahzab', 73, 21, 418, 'Medinan'],
  [34, 'سبأ', 'Saba', 54, 22, 428, 'Meccan'],
  [35, 'فاطر', 'Fatir', 45, 22, 434, 'Meccan'],
  [36, 'يس', 'Ya-Sin', 83, 22, 440, 'Meccan'],
  [37, 'الصافات', 'As-Saffat', 182, 23, 446, 'Meccan'],
  [38, 'ص', 'Sad', 88, 23, 453, 'Meccan'],
  [39, 'الزمر', 'Az-Zumar', 75, 23, 458, 'Meccan'],
  [40, 'غافر', 'Ghafir', 85, 24, 467, 'Meccan'],
  [41, 'فصلت', 'Fussilat', 54, 24, 477, 'Meccan'],
  [42, 'الشورى', 'Ash-Shuraa', 53, 25, 483, 'Meccan'],
  [43, 'الزخرف', 'Az-Zukhruf', 89, 25, 489, 'Meccan'],
  [44, 'الدخان', 'Ad-Dukhan', 59, 25, 496, 'Meccan'],
  [45, 'الجاثية', 'Al-Jathiyah', 37, 25, 499, 'Meccan'],
  [46, 'الأحقاف', 'Al-Ahqaf', 35, 26, 502, 'Meccan'],
  [47, 'محمد', 'Muhammad', 38, 26, 507, 'Medinan'],
  [48, 'الفتح', 'Al-Fath', 29, 26, 511, 'Medinan'],
  [49, 'الحجرات', 'Al-Hujurat', 18, 26, 515, 'Medinan'],
  [50, 'ق', 'Qaf', 45, 26, 518, 'Meccan'],
  [51, 'الذاريات', 'Adh-Dhariyat', 60, 26, 520, 'Meccan'],
  [52, 'الطور', 'At-Tur', 49, 27, 523, 'Meccan'],
  [53, 'النجم', 'An-Najm', 62, 27, 526, 'Meccan'],
  [54, 'القمر', 'Al-Qamar', 55, 27, 528, 'Meccan'],
  [55, 'الرحمن', 'Ar-Rahman', 78, 27, 531, 'Medinan'],
  [56, 'الواقعة', "Al-Waqi'ah", 96, 27, 534, 'Meccan'],
  [57, 'الحديد', 'Al-Hadid', 29, 27, 537, 'Medinan'],
  [58, 'المجادلة', 'Al-Mujadila', 22, 28, 542, 'Medinan'],
  [59, 'الحشر', 'Al-Hashr', 24, 28, 545, 'Medinan'],
  [60, 'الممتحنة', 'Al-Mumtahanah', 13, 28, 549, 'Medinan'],
  [61, 'الصف', 'As-Saf', 14, 28, 551, 'Medinan'],
  [62, 'الجمعة', "Al-Jumu'ah", 11, 28, 553, 'Medinan'],
  [63, 'المنافقون', 'Al-Munafiqun', 11, 28, 554, 'Medinan'],
  [64, 'التغابن', 'At-Taghabun', 18, 28, 556, 'Medinan'],
  [65, 'الطلاق', 'At-Talaq', 12, 28, 558, 'Medinan'],
  [66, 'التحريم', 'At-Tahrim', 12, 28, 560, 'Medinan'],
  [67, 'الملك', 'Al-Mulk', 30, 29, 562, 'Meccan'],
  [68, 'القلم', 'Al-Qalam', 52, 29, 564, 'Meccan'],
  [69, 'الحاقة', 'Al-Haqqah', 52, 29, 566, 'Meccan'],
  [70, 'المعارج', "Al-Ma'arij", 44, 29, 568, 'Meccan'],
  [71, 'نوح', 'Nuh', 28, 29, 570, 'Meccan'],
  [72, 'الجن', 'Al-Jinn', 28, 29, 572, 'Meccan'],
  [73, 'المزمل', 'Al-Muzzammil', 20, 29, 574, 'Meccan'],
  [74, 'المدثر', 'Al-Muddaththir', 56, 29, 575, 'Meccan'],
  [75, 'القيامة', 'Al-Qiyamah', 40, 29, 577, 'Meccan'],
  [76, 'الإنسان', 'Al-Insan', 31, 29, 578, 'Medinan'],
  [77, 'المرسلات', 'Al-Mursalat', 50, 29, 580, 'Meccan'],
  [78, 'النبأ', 'An-Naba', 40, 30, 582, 'Meccan'],
  [79, 'النازعات', "An-Nazi'at", 46, 30, 583, 'Meccan'],
  [80, 'عبس', "'Abasa", 42, 30, 585, 'Meccan'],
  [81, 'التكوير', 'At-Takwir', 29, 30, 586, 'Meccan'],
  [82, 'الانفطار', 'Al-Infitar', 19, 30, 587, 'Meccan'],
  [83, 'المطففين', 'Al-Mutaffifin', 36, 30, 587, 'Meccan'],
  [84, 'الانشقاق', 'Al-Inshiqaq', 25, 30, 589, 'Meccan'],
  [85, 'البروج', 'Al-Buruj', 22, 30, 590, 'Meccan'],
  [86, 'الطارق', 'At-Tariq', 17, 30, 591, 'Meccan'],
  [87, 'الأعلى', "Al-A'la", 19, 30, 591, 'Meccan'],
  [88, 'الغاشية', 'Al-Ghashiyah', 26, 30, 592, 'Meccan'],
  [89, 'الفجر', 'Al-Fajr', 30, 30, 593, 'Meccan'],
  [90, 'البلد', 'Al-Balad', 20, 30, 594, 'Meccan'],
  [91, 'الشمس', 'Ash-Shams', 15, 30, 595, 'Meccan'],
  [92, 'الليل', 'Al-Layl', 21, 30, 595, 'Meccan'],
  [93, 'الضحى', 'Ad-Duhaa', 11, 30, 596, 'Meccan'],
  [94, 'الشرح', 'Ash-Sharh', 8, 30, 596, 'Meccan'],
  [95, 'التين', 'At-Tin', 8, 30, 597, 'Meccan'],
  [96, 'العلق', "Al-'Alaq", 19, 30, 597, 'Meccan'],
  [97, 'القدر', 'Al-Qadr', 5, 30, 598, 'Meccan'],
  [98, 'البينة', 'Al-Bayyinah', 8, 30, 598, 'Medinan'],
  [99, 'الزلزلة', 'Az-Zalzalah', 8, 30, 599, 'Medinan'],
  [100, 'العاديات', "Al-'Adiyat", 11, 30, 599, 'Meccan'],
  [101, 'القارعة', "Al-Qari'ah", 11, 30, 600, 'Meccan'],
  [102, 'التكاثر', 'At-Takathur', 8, 30, 600, 'Meccan'],
  [103, 'العصر', "Al-'Asr", 3, 30, 601, 'Meccan'],
  [104, 'الهمزة', 'Al-Humazah', 9, 30, 601, 'Meccan'],
  [105, 'الفيل', 'Al-Fil', 5, 30, 601, 'Meccan'],
  [106, 'قريش', 'Quraysh', 4, 30, 602, 'Meccan'],
  [107, 'الماعون', "Al-Ma'un", 7, 30, 602, 'Meccan'],
  [108, 'الكوثر', 'Al-Kawthar', 3, 30, 602, 'Meccan'],
  [109, 'الكافرون', 'Al-Kafirun', 6, 30, 603, 'Meccan'],
  [110, 'النصر', 'An-Nasr', 3, 30, 603, 'Medinan'],
  [111, 'المسد', 'Al-Masad', 5, 30, 603, 'Meccan'],
  [112, 'الإخلاص', 'Al-Ikhlas', 4, 30, 604, 'Meccan'],
  [113, 'الفلق', 'Al-Falaq', 5, 30, 604, 'Meccan'],
  [114, 'الناس', 'An-Nas', 6, 30, 604, 'Meccan'],
];

const SURAH_END_PAGES: number[] = [
  1, 49, 76, 106, 127, 150, 176, 186, 207, 221,
  235, 248, 255, 261, 267, 281, 293, 304, 312, 321,
  331, 341, 349, 359, 366, 376, 385, 396, 404, 410,
  414, 417, 427, 434, 440, 445, 452, 458, 467, 476,
  482, 489, 495, 498, 502, 506, 510, 515, 517, 520,
  523, 525, 528, 531, 534, 537, 541, 545, 548, 551,
  552, 554, 555, 557, 559, 561, 564, 566, 568, 570,
  571, 573, 575, 577, 578, 580, 581, 583, 584, 585,
  586, 587, 589, 589, 590, 591, 592, 592, 594, 594,
  595, 596, 596, 596, 597, 597, 598, 599, 599, 600,
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603,
  603, 604, 604, 604,
];

export const SURAH_LIST: SurahInfo[] = RAW_SURAHS.map((row, idx) => ({
  number: row[0],
  nameAr: row[1],
  nameEn: row[2],
  ayahCount: row[3],
  juz: row[4],
  startPage: row[5],
  endPage: SURAH_END_PAGES[idx] || row[5],
  type: row[6],
}));

export function getPlanMushafPages(plan: QuranPlanItem): number[] {
  if (plan.scope === 'surah' && plan.selectedSurahs && plan.selectedSurahs.length > 0) {
    const pagesSet = new Set<number>();
    plan.selectedSurahs.forEach((surahNum) => {
      const s = SURAH_LIST.find((item) => item.number === surahNum);
      if (s) {
        for (let p = s.startPage; p <= s.endPage; p++) {
          pagesSet.add(p);
        }
      }
    });
    const sorted = Array.from(pagesSet).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [1];
  }

  const range = getPlanMushafPageRange(plan);
  const arr: number[] = [];
  for (let p = range.startPage; p <= range.endPage; p++) {
    arr.push(p);
  }
  return arr.length > 0 ? arr : [1];
}

export function getPlanMushafPageRange(plan: QuranPlanItem): { startPage: number; endPage: number } {
  if (plan.scope === 'surah' && plan.selectedSurahs && plan.selectedSurahs.length > 0) {
    const pages = getPlanMushafPages(plan);
    return {
      startPage: pages[0],
      endPage: pages[pages.length - 1],
    };
  }

  if (plan.scope === 'juz') {
    const j1 = Math.min(plan.juzStart || 1, plan.juzEnd || plan.juzStart || 1);
    const j2 = Math.max(plan.juzStart || 1, plan.juzEnd || plan.juzStart || 1);
    const info1 = JUZ_LIST.find((j) => j.number === j1);
    const info2 = JUZ_LIST.find((j) => j.number === j2);
    return {
      startPage: info1 ? info1.startPage : 1,
      endPage: info2 ? info2.endPage : 21,
    };
  }

  if (plan.scope === 'surah') {
    const s1 = Math.min(plan.surahStart || 1, plan.surahEnd || plan.surahStart || 1);
    const s2 = Math.max(plan.surahStart || 1, plan.surahEnd || plan.surahStart || 1);
    const info1 = SURAH_LIST.find((s) => s.number === s1);
    const info2 = SURAH_LIST.find((s) => s.number === s2);
    return {
      startPage: info1 ? info1.startPage : 1,
      endPage: info2 ? info2.endPage : 1,
    };
  }

  // scope === 'ayah'
  const surah = SURAH_LIST.find((s) => s.number === (plan.ayahSurah || 1));
  if (!surah) return { startPage: 1, endPage: 1 };
  const fromAyah = Math.max(1, plan.ayahFrom || 1);
  const toAyah = Math.min(surah.ayahCount, plan.ayahTo || surah.ayahCount);
  const totalPages = Math.max(1, surah.endPage - surah.startPage + 1);
  const startOffset = Math.floor(((fromAyah - 1) / surah.ayahCount) * totalPages);
  const endOffset = Math.floor(((toAyah - 1) / surah.ayahCount) * totalPages);
  return {
    startPage: Math.min(604, surah.startPage + startOffset),
    endPage: Math.min(604, surah.startPage + endOffset),
  };
}

export function formatCurriculumTitle(item: QuranPlanItem, lang: Language): string {
  if (item.scope === 'surah') {
    if (item.selectedSurahs && item.selectedSurahs.length > 0) {
      const surahs = item.selectedSurahs
        .map((num) => SURAH_LIST.find((s) => s.number === num))
        .filter(Boolean) as SurahInfo[];

      if (surahs.length === 0) return '';
      if (surahs.length === 1) {
        return lang === 'ar' ? `سورة ${surahs[0].nameAr}` : `Surah ${surahs[0].nameEn}`;
      }
      if (surahs.length === 2) {
        return lang === 'ar'
          ? `سورة ${surahs[0].nameAr} وسورة ${surahs[1].nameAr}`
          : `Surahs ${surahs[0].nameEn} & ${surahs[1].nameEn}`;
      }
      if (surahs.length === 3) {
        return lang === 'ar'
          ? `سور ${surahs[0].nameAr}، ${surahs[1].nameAr}، ${surahs[2].nameAr}`
          : `Surahs ${surahs[0].nameEn}, ${surahs[1].nameEn}, ${surahs[2].nameEn}`;
      }
      const remaining = surahs.length - 2;
      return lang === 'ar'
        ? `سور ${surahs[0].nameAr}، ${surahs[1].nameAr} (+${remaining} سور)`
        : `Surahs ${surahs[0].nameEn}, ${surahs[1].nameEn} (+${remaining} more)`;
    }

    const start = SURAH_LIST.find((s) => s.number === (item.surahStart || 1));
    const end = SURAH_LIST.find((s) => s.number === (item.surahEnd || item.surahStart || 1));
    if (!start) return '';
    if (!end || start.number === end.number) {
      return lang === 'ar' ? `سورة ${start.nameAr}` : `Surah ${start.nameEn}`;
    }
    return lang === 'ar'
      ? `من سورة ${start.nameAr} إلى ${end.nameAr}`
      : `Surah ${start.nameEn} to ${end.nameEn}`;
  }

  if (item.scope === 'juz') {
    const jStart = item.juzStart || 1;
    const jEnd = item.juzEnd || jStart;
    if (jStart === jEnd) {
      const info = JUZ_LIST.find((j) => j.number === jStart);
      if (lang === 'ar') {
        return info ? info.nameAr : `الجزء ${jStart}`;
      }
      return info ? info.nameEn : `Juz ${jStart}`;
    }
    return lang === 'ar' ? `الأجزاء ${jStart} – ${jEnd}` : `Juz ${jStart} – ${jEnd}`;
  }

  const surah = SURAH_LIST.find((s) => s.number === (item.ayahSurah || 2));
  const from = item.ayahFrom || 1;
  const to = item.ayahTo || 10;
  if (!surah) return '';
  return lang === 'ar'
    ? `سورة ${surah.nameAr} · الآيات ${from}–${to}`
    : `Surah ${surah.nameEn} · Ayahs ${from}–${to}`;
}

export function getPlanTypeLabel(type: PlanType, lang: Language): string {
  if (type === 'new_memorization') {
    return lang === 'ar' ? 'حفظ جديد' : 'New Memorization';
  }
  if (type === 'sard') {
    return lang === 'ar' ? 'سرد' : 'Sard (Continuous Recitation)';
  }
  return lang === 'ar' ? 'مراجعة' : 'Review';
}

export function getScopeLabel(scope: CurriculumScope, lang: Language): string {
  if (scope === 'surah') return lang === 'ar' ? 'سور' : 'Surahs';
  if (scope === 'juz') return lang === 'ar' ? 'أجزاء' : "Juz'";
  return lang === 'ar' ? 'آيات' : 'Ayahs';
}

export function getEvaluationLabel(evalType: PlanEvaluation, lang: Language): string {
  if (evalType === 'muthabbat') return lang === 'ar' ? 'مُثبَّت' : 'Mastered (Muthabbat)';
  if (evalType === 'mutaraddid') return lang === 'ar' ? 'مُتردِّد' : 'Hesitant (Mutaraddid)';
  return lang === 'ar' ? 'مُتفلِّت' : 'Slipping (Mutafallit)';
}

export function calculateMetrics(
  scope: CurriculumScope,
  surahStart: number,
  surahEnd: number,
  juzStart: number,
  juzEnd: number,
  ayahSurah: number,
  ayahFrom: number,
  ayahTo: number,
  selectedSurahs?: number[]
): { estimatedAyahs: number; estimatedPages: number } {
  if (scope === 'surah') {
    if (selectedSurahs && selectedSurahs.length > 0) {
      let totalAyahs = 0;
      const pagesSet = new Set<number>();
      selectedSurahs.forEach((num) => {
        const s = SURAH_LIST.find((x) => x.number === num);
        if (s) {
          totalAyahs += s.ayahCount;
          for (let p = s.startPage; p <= s.endPage; p++) {
            pagesSet.add(p);
          }
        }
      });
      return { estimatedAyahs: totalAyahs, estimatedPages: Math.max(1, pagesSet.size) };
    }

    const s1 = Math.min(surahStart, surahEnd);
    const s2 = Math.max(surahStart, surahEnd);
    let totalAyahs = 0;
    for (let i = s1; i <= s2; i++) {
      const s = SURAH_LIST.find((x) => x.number === i);
      if (s) totalAyahs += s.ayahCount;
    }
    const info1 = SURAH_LIST.find((x) => x.number === s1);
    const info2 = SURAH_LIST.find((x) => x.number === s2);
    const pages =
      info1 && info2
        ? Math.max(1, info2.endPage - info1.startPage + 1)
        : Math.max(1, Math.round((totalAyahs / 6236) * 604 * 10) / 10);
    return { estimatedAyahs: totalAyahs, estimatedPages: pages };
  }

  if (scope === 'juz') {
    const j1 = Math.min(juzStart, juzEnd);
    const j2 = Math.max(juzStart, juzEnd);
    let totalAyahs = 0;
    let totalPages = 0;
    for (let i = j1; i <= j2; i++) {
      const j = JUZ_LIST.find((x) => x.number === i);
      if (j) {
        totalAyahs += j.ayahCount;
        totalPages += j.pages;
      }
    }
    return { estimatedAyahs: totalAyahs, estimatedPages: totalPages };
  }

  const count = Math.max(1, Math.abs(ayahTo - ayahFrom) + 1);
  const pages = Math.max(0.5, Math.round((count / 15) * 10) / 10);
  return { estimatedAyahs: count, estimatedPages: pages };
}

// Empty initial plans as requested ("احذف الخطط المقترحة")
export const INITIAL_PLANS: QuranPlanItem[] = [];
