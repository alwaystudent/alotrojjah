import { QuranPlanItem, DayId, WEEK_DAYS } from '@/src/data/quranData';

export interface SpacedReviewScheduleItem {
  stageNumber: number;
  labelAr: string;
  labelEn: string;
  targetDate: Date;
  dayId: DayId;
  dateFormattedAr: string;
}

const REVIEW_INTERVALS = [
  { days: 1, labelAr: 'المراجعة الأولى (بعد يوم)', labelEn: '1st Review (After 1 day)' },
  { days: 3, labelAr: 'المراجعة الثانية (بعد 3 أيام)', labelEn: '2nd Review (After 3 days)' },
  { days: 7, labelAr: 'المراجعة الثالثة (بعد أسبوع)', labelEn: '3rd Review (After 1 week)' },
  { days: 30, labelAr: 'المراجعة الرابعة (بعد شهر)', labelEn: '4th Review (After 1 month)' },
];

export function generateSpacedReviews(basePlan: QuranPlanItem): QuranPlanItem[] {
  const newPlans: QuranPlanItem[] = [];
  const baseDate = new Date();

  REVIEW_INTERVALS.forEach((interval, idx) => {
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + interval.days);

    const jsDay = targetDate.getDay();
    const dayInfo = WEEK_DAYS.find((d) => d.jsDay === jsDay) || WEEK_DAYS[0];

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

    const dateFormatted = `${hijriFormatter.format(targetDate)} · ${gregFormatter.format(targetDate)}`;

    const reviewPlan: QuranPlanItem = {
      ...basePlan,
      id: `spaced-review-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      planType: 'review',
      day: dayInfo.id,
      status: 'pending',
      completedAt: undefined,
      evaluation: undefined,
      notes: `${interval.labelAr} - تثبيت الحفظ المتقن (${dateFormatted})`,
      createdAt: new Date().toISOString(),
    };

    newPlans.push(reviewPlan);
  });

  return newPlans;
}
