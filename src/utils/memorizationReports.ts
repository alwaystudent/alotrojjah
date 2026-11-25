import {
  QuranPlanItem,
  PlanEvaluation,
  MemorizationReport,
  QuranRandomQuizItem,
  SURAH_LIST,
  formatCurriculumTitle,
} from '@/src/data/quranData';

export const STORAGE_KEY_MEMORIZATION_REPORTS = 'mishkat_memorization_reports_v1';
export const STORAGE_KEY_RANDOM_QUIZZES = 'mishkat_random_quizzes_v1';

export function cleanArabicDiacritics(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08F0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .trim();
}

export function getEvaluationRules(evaluation: PlanEvaluation) {
  switch (evaluation) {
    case 'muthabbat':
      return {
        intervalDays: 7,
        frequency: 'weekly' as const,
        frequencyLabelAr: 'مرة في الأسبوع (متقن - كل 7 أيام)',
        frequencyLabelEn: 'Once a week (Mastered - Every 7 days)',
        color: '#4A6144',
        badgeBg: 'bg-[#4A6144]',
        badgeText: 'text-white',
        descriptionAr: 'اختبار عشوائي دوري مرة كل أسبوع لضمان ترسيخ الحفظ في الذاكرة الدائمة.',
        descriptionEn: 'Weekly random quiz to solidify long-term retention.',
      };
    case 'mutaraddid':
      return {
        intervalDays: 3,
        frequency: 'three_days' as const,
        frequencyLabelAr: 'كل 3 أيام (متردد)',
        frequencyLabelEn: 'Every 3 days (Hesitant)',
        color: '#C88A14',
        badgeBg: 'bg-[#C88A14]',
        badgeText: 'text-white',
        descriptionAr: 'اختبار عشوائي مكثف كل 3 أيام لتدارك التردد وضبط الآيات المتشابهة.',
        descriptionEn: 'Intensive random quiz every 3 days to eliminate hesitation.',
      };
    case 'mutafallit':
      return {
        intervalDays: 1,
        frequency: 'next_day' as const,
        frequencyLabelAr: 'يومياً (متفلت - كل يوم)',
        frequencyLabelEn: 'Daily (Slipping - Every day)',
        color: '#A84A32',
        badgeBg: 'bg-[#A84A32]',
        badgeText: 'text-white',
        descriptionAr: 'اختبار عشوائي يومياً لإنقاذ المحفوظ وإعادة ضبطه وترسيخه من جديد.',
        descriptionEn: 'Daily catch-up quiz to restore accuracy and prevent slippage.',
      };
  }
}

export function formatDualDate(targetDate: Date): string {
  try {
    const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const gregFormatter = new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    return `${hijriFormatter.format(targetDate)} · ${gregFormatter.format(targetDate)}`;
  } catch {
    return targetDate.toLocaleDateString();
  }
}

export function createMemorizationReportAndQuiz(
  plan: QuranPlanItem,
  evaluation: PlanEvaluation,
  reciterId: string,
  reciterName: string
): { report: MemorizationReport; quiz: QuranRandomQuizItem } {
  const surahInfo = SURAH_LIST.find(
    (s) => s.number === (plan.ayahSurah || plan.surahStart || 1)
  );

  const surahNumber = surahInfo?.number || 1;
  const surahNameAr = surahInfo?.nameAr || 'الفاتحة';
  const surahNameEn = surahInfo?.nameEn || 'Al-Fatihah';

  const ayahFrom = plan.ayahFrom || 1;
  const ayahTo = plan.ayahTo || surahInfo?.ayahCount || 7;
  const ayahCount = Math.max(1, ayahTo - ayahFrom + 1);

  const evaluationRules = getEvaluationRules(evaluation);

  const now = new Date();
  const formattedToday = formatDualDate(now);

  const targetQuizDate = new Date(now);
  targetQuizDate.setDate(targetQuizDate.getDate() + evaluationRules.intervalDays);

  const yyyy = targetQuizDate.getFullYear();
  const mm = String(targetQuizDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetQuizDate.getDate()).padStart(2, '0');
  const scheduledDateYMD = `${yyyy}-${mm}-${dd}`;
  const scheduledDateFormatted = formatDualDate(targetQuizDate);

  const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const quizId = `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const planTitle = formatCurriculumTitle(plan, 'ar');

  const report: MemorizationReport = {
    id: reportId,
    planId: plan.id,
    planTitle,
    surahNumber,
    surahNameAr,
    surahNameEn,
    ayahFrom,
    ayahTo,
    ayahCount,
    pagesCount: plan.estimatedPages || 1,
    reciterId,
    reciterName,
    evaluation,
    evaluationLabelAr:
      evaluation === 'muthabbat' ? 'متقن' : evaluation === 'mutaraddid' ? 'متردد' : 'متفلت',
    completedAt: now.toISOString(),
    formattedDate: formattedToday,
    stagesCompleted: {
      stage1ListenCumulative: true,
      stage2RealtimeFadeout: true,
      stage3SmartRecitation: true,
    },
    randomQuizSchedule: {
      frequency: evaluationRules.frequency,
      frequencyLabelAr: evaluationRules.frequencyLabelAr,
      intervalDays: evaluationRules.intervalDays,
      scheduledDate: scheduledDateYMD,
      scheduledDateFormatted,
      reminderTime: plan.reminderTime || '09:00',
    },
  };

  const quiz: QuranRandomQuizItem = {
    id: quizId,
    reportId,
    planId: plan.id,
    surahNumber,
    surahNameAr,
    surahNameEn,
    ayahFrom,
    ayahTo,
    evaluation,
    frequency: evaluationRules.frequency,
    frequencyLabelAr: evaluationRules.frequencyLabelAr,
    scheduledDate: scheduledDateYMD,
    scheduledDateFormatted,
    dueDateTimestamp: targetQuizDate.getTime(),
    reminderTime: plan.reminderTime || '09:00',
    reminderEnabled: true,
    status: 'pending',
    createdAt: now.toISOString(),
  };

  return { report, quiz };
}

export function loadStoredReports(): MemorizationReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMORIZATION_REPORTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveStoredReports(reports: MemorizationReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MEMORIZATION_REPORTS, JSON.stringify(reports));
  } catch {
    // ignore
  }
}

export function loadStoredQuizzes(): QuranRandomQuizItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RANDOM_QUIZZES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveStoredQuizzes(quizzes: QuranRandomQuizItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RANDOM_QUIZZES, JSON.stringify(quizzes));
  } catch {
    // ignore
  }
}
