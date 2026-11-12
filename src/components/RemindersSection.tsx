import React from 'react';
import { Bell, Volume2, VolumeX, CheckCircle2, Clock, Send, Repeat, Check, Sparkles, AlertCircle } from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  QuranRandomQuizItem,
  WEEK_DAYS,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getTodayDayId,
  isPlanOverdue,
} from '@/src/data/quranData';
import { getCompactDualDate } from '@/src/utils/calendar';
import { t } from '@/src/data/translations';

interface RemindersSectionProps {
  plans: QuranPlanItem[];
  quizzes?: QuranRandomQuizItem[];
  lang: Language;
  notificationPermission: NotificationPermission | 'unsupported';
  soundEnabled: boolean;
  prepAlertsEnabled: boolean;
  onToggleSound: () => void;
  onTogglePrepAlerts: () => void;
  onRequestPermission: () => void;
  onTriggerTestReminder: (plan?: QuranPlanItem, isPrep?: boolean) => void;
  onTogglePlanReminder: (planId: string) => void;
  onUpdatePlanReminderTime: (planId: string, newTime: string) => void;
  onToggleQuizReminder?: (quizId: string) => void;
  onUpdateQuizReminderTime?: (quizId: string, newTime: string) => void;
  onStartQuiz?: (quiz: QuranRandomQuizItem) => void;
  onTriggerTestQuizReminder?: (quiz: QuranRandomQuizItem) => void;
}

export const RemindersSection: React.FC<RemindersSectionProps> = ({
  plans,
  quizzes = [],
  lang,
  notificationPermission,
  soundEnabled,
  prepAlertsEnabled,
  onToggleSound,
  onTogglePrepAlerts,
  onRequestPermission,
  onTriggerTestReminder,
  onTogglePlanReminder,
  onUpdatePlanReminderTime,
  onToggleQuizReminder,
  onUpdateQuizReminderTime,
  onStartQuiz,
  onTriggerTestQuizReminder,
}) => {
  const dict = t(lang);
  const todayId = getTodayDayId();

  const sortedPlans = [...plans].sort((a, b) => {
    const dayIdxA = WEEK_DAYS.findIndex((d) => d.id === a.day);
    const dayIdxB = WEEK_DAYS.findIndex((d) => d.id === b.day);
    if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;
    return a.reminderTime.localeCompare(b.reminderTime);
  });

  return (
    <section className="space-y-3.5">
      {/* Compact Header & Controls Strip */}
      <div className="p-3 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#261C14]">
            <CheckCircle2
              className={`w-4 h-4 ${
                notificationPermission === 'granted' ? 'text-[#4A6144]' : 'text-[#C88A14]'
              }`}
            />
            <span>{dict.browserPermissionStatus}:</span>
            <span className="text-[#5C4B3B]">
              {notificationPermission === 'granted'
                ? dict.permissionGranted
                : notificationPermission === 'denied'
                ? dict.permissionDenied
                : dict.permissionDefault}
            </span>
          </div>

          <span className="text-[#DDD2BE]">|</span>

          <button
            type="button"
            onClick={onToggleSound}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#261C14] cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#C88A14]" />
            <span>{dict.soundAlertToggle}:</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                soundEnabled ? 'bg-[#2D2218] text-[#FFFDF9]' : 'bg-[#EFE9DC] text-[#5C4B3B]'
              }`}
            >
              {soundEnabled
                ? lang === 'ar'
                  ? 'مفعّل'
                  : 'On'
                : lang === 'ar'
                ? 'صامت'
                : 'Off'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="px-3 py-1.5 rounded-lg border border-[#C88A14] bg-[#FBF5E6] text-xs font-semibold text-[#261C14] hover:bg-[#F6E9C8] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5 text-[#C88A14]" />
              <span>{dict.enableNotificationsBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onTriggerTestReminder()}
            className="mustard-gradient-btn px-3 py-1.5 rounded-lg text-xs font-bold text-[#FFFDF9] shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            <span>{dict.testNotificationBtn}</span>
          </button>
        </div>
      </div>

      {/* Preparation Alerts Card (تنبيهات الاستعداد قبل موعد الخطة بـ 10 دقائق) */}
      <div className="p-3 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#261C14]">
            <Clock className="w-4 h-4 text-[#C88A14] shrink-0" />
            <span>{dict.prepAlertsTitle}</span>
          </div>
          <p className="text-[11px] text-[#5C4B3B] leading-relaxed">
            {dict.prepAlertsDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePrepAlerts}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              prepAlertsEnabled
                ? 'bg-[#4A6144] text-white shadow-2xs'
                : 'bg-[#EFE9DC] text-[#5C4B3B] hover:bg-[#DDD2BE]'
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${prepAlertsEnabled ? 'opacity-100' : 'opacity-0'}`} />
            <span>
              {prepAlertsEnabled
                ? lang === 'ar'
                  ? 'مفعّل'
                  : 'Enabled'
                : lang === 'ar'
                ? 'معطّل'
                : 'Disabled'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onTriggerTestReminder(undefined, true)}
            className="px-2.5 py-1.5 rounded-lg border border-[#C88A14] bg-[#FBF5E6] text-xs font-medium text-[#261C14] hover:bg-[#F6E9C8] transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'تجربة' : 'Test'}
          </button>
        </div>
      </div>

      {/* Automatic Silent Mode Banner for Recitation Sessions */}
      <div className="p-2.5 rounded-xl bg-[#FBF5E6] border border-[#E8D29F] flex items-center gap-2 text-xs text-[#2D2218]">
        <VolumeX className="w-4 h-4 text-[#C88A14] shrink-0" />
        <span className="leading-relaxed">
          {lang === 'ar'
            ? 'يتم تحويل التنبيهات والأصوات تلقائياً إلى الوضع الصامت أثناء جلسات السرد والحفظ والمراجعة لضمان الخشوع والتركيز دون تشويش.'
            : 'Alerts and sound chimes are automatically silenced during active recitation, memorization, and quiz sessions to ensure complete focus.'}
        </span>
      </div>

      {/* Scheduled Reminders Table */}
      <div className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F7F3EB] border-b border-[#DDD2BE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[#261C14]">{dict.upcomingRemindersTitle}</h3>
            {plans.filter((p) => isPlanOverdue(p, todayId)).length > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-white bg-[#C53030] px-2 py-0.5 rounded-full shadow-xs ring-2 ring-[#C53030]/25 animate-pulse"
                title={lang === 'ar' ? 'يوجد مهام متأخرة' : 'Overdue tasks present'}
              >
                <AlertCircle className="w-3 h-3 text-white" />
                <span>
                  {plans.filter((p) => isPlanOverdue(p, todayId)).length} {lang === 'ar' ? 'متأخرة' : 'overdue'}
                </span>
              </span>
            )}
          </div>
          <span className="text-xs text-[#84715E] font-mono-tabular">
            {plans.filter((p) => p.reminderEnabled).length}/{sortedPlans.length}
          </span>
        </div>

        <div className="divide-y divide-[#EFE9DC]">
          {sortedPlans.map((plan) => {
            const dayInfo = WEEK_DAYS.find((d) => d.id === plan.day);
            const isToday = plan.day === todayId;
            const isOverdue = isPlanOverdue(plan, todayId);
            return (
              <div
                key={plan.id}
                className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                  isOverdue ? 'bg-[#FFF2EF] border-s-4 border-s-[#C53030]' : isToday ? 'bg-[#FBF5E6]/60' : 'hover:bg-[#F7F3EB]/60'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {isOverdue && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#C53030] px-2 py-0.5 rounded-md shadow-xs ring-2 ring-[#C53030]/25 animate-pulse"
                      title={lang === 'ar' ? 'خطة متأخرة لم تكتمل في موعدها' : 'Overdue task'}
                    >
                      <AlertCircle className="w-3 h-3 text-white" />
                      <span>{lang === 'ar' ? 'متأخرة' : 'Overdue'}</span>
                    </span>
                  )}
                  <span className={`font-bold ${isOverdue ? 'text-[#9B1C1C]' : 'text-[#261C14]'}`}>
                    {formatCurriculumTitle(plan, lang)}
                  </span>
                  {isToday && (
                    <span className="text-[11px] font-semibold text-[#C88A14]">
                      · {dict.todayBadge}
                    </span>
                  )}
                  <span className="text-[#84715E]">
                    · {dayInfo ? (lang === 'ar' ? dayInfo.nameAr : dayInfo.nameEn) : ''}{' '}
                    ({getCompactDualDate(plan.day, lang).hijri} · {getCompactDualDate(plan.day, lang).greg}) ·{' '}
                    {getPlanTypeLabel(plan.planType, lang)} · {plan.estimatedAyahs} {dict.ayahsUnit}
                  </span>
                  {plan.repeatWeekly && (
                    <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-[#8F681E]/10 text-[#8F681E] border border-[#8F681E]/20">
                      <Repeat className="w-2.5 h-2.5" />
                      <span>{dict.repeatWeeklyBadge}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#C88A14]" />
                    <input
                      type="time"
                      value={plan.reminderTime}
                      onChange={(e) => onUpdatePlanReminderTime(plan.id, e.target.value)}
                      className="px-2 py-0.5 rounded-md bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onTogglePlanReminder(plan.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      plan.reminderEnabled
                        ? 'bg-[#4A6144] text-white'
                        : 'bg-[#EFE9DC] text-[#84715E]'
                    }`}
                  >
                    {plan.reminderEnabled
                      ? lang === 'ar'
                        ? 'مفعّل'
                        : 'On'
                      : lang === 'ar'
                      ? 'متوقف'
                      : 'Off'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerTestReminder(plan)}
                    className="px-2 py-1 rounded-md border border-[#DDD2BE] text-xs font-medium text-[#5C4B3B] hover:border-[#C88A14] hover:text-[#261C14] transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'تجربة' : 'Test'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Random Tests Reminders (الاختبارات العشوائية المجدولة والتذكيرات) */}
      <div className="rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] overflow-hidden space-y-0">
        <div className="px-4 py-2.5 bg-[#FBF5E6] border-b border-[#E8D29F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C88A14]" />
            <h3 className="text-xs font-bold text-[#261C14]">
              {lang === 'ar'
                ? 'تذكيرات الاختبارات العشوائية لتثبيت الحفظ (المتقن · المتردد · المتفلت)'
                : 'Random Retention Tests Reminders'}
            </h3>
          </div>
          <span className="text-xs text-[#84715E] font-mono-tabular">
            {quizzes.filter((q) => q.reminderEnabled).length}/{quizzes.length}
          </span>
        </div>

        {quizzes.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#84715E]">
            {lang === 'ar'
              ? 'لا توجد اختبارات عشوائية مجدولة حالياً. يتم إنشاء الاختبارات وتذكيراتها تلقائياً فور اعتماد تقييم أي مقرر بعد إتمام مراحل الحفظ الثلاث.'
              : 'No scheduled random tests yet. Tests and reminders are created automatically once a memorization plan is completed and rated.'}
          </div>
        ) : (
          <div className="divide-y divide-[#EFE9DC]">
            {quizzes.map((quiz) => {
              const isDueToday =
                new Date(quiz.dueDateTimestamp).toDateString() === new Date().toDateString();
              const isOverdue = quiz.dueDateTimestamp < Date.now() && !isDueToday;

              return (
                <div
                  key={quiz.id}
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                    isOverdue
                      ? 'bg-[#FFF2EF] border-s-4 border-s-[#C53030]'
                      : isDueToday
                      ? 'bg-[#FBF5E6]/70'
                      : 'hover:bg-[#F7F3EB]/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        quiz.evaluation === 'muthabbat'
                          ? 'bg-[#4A6144]'
                          : quiz.evaluation === 'mutaraddid'
                          ? 'bg-[#C88A14]'
                          : 'bg-[#C53030]'
                      }`}
                    />
                    <span className={`font-bold ${isOverdue ? 'text-[#9B1C1C]' : 'text-[#261C14]'}`}>
                      سورة {quiz.surahNameAr} ({quiz.ayahFrom} - {quiz.ayahTo})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#EFE9DC] text-[#5C4B3B] text-[10.5px] font-semibold">
                      {quiz.frequencyLabelAr}
                    </span>
                    <span className="text-[#84715E] text-[11px]">
                      · الموعد: {quiz.scheduledDateFormatted}
                    </span>
                    {isDueToday && (
                      <span className="text-[10px] font-bold text-[#4A6144] px-1.5 py-0.5 rounded-sm bg-[#4A6144]/15">
                        حان اليوم!
                      </span>
                    )}
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-white bg-[#C53030] px-2 py-0.5 rounded-md shadow-xs ring-2 ring-[#C53030]/25 animate-pulse">
                        <AlertCircle className="w-3 h-3 text-white" />
                        <span>{lang === 'ar' ? 'متأخر' : 'Overdue'}</span>
                      </span>
                    )}
                    {quiz.score !== undefined && (
                      <span className="text-[10px] font-bold text-[#C88A14] font-mono-tabular">
                        آخر نتيجة: {quiz.score}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C88A14]" />
                      <input
                        type="time"
                        value={quiz.reminderTime}
                        onChange={(e) =>
                          onUpdateQuizReminderTime &&
                          onUpdateQuizReminderTime(quiz.id, e.target.value)
                        }
                        className="px-2 py-0.5 rounded-md bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleQuizReminder && onToggleQuizReminder(quiz.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        quiz.reminderEnabled
                          ? 'bg-[#4A6144] text-white'
                          : 'bg-[#EFE9DC] text-[#84715E]'
                      }`}
                    >
                      {quiz.reminderEnabled
                        ? lang === 'ar'
                          ? 'مفعّل'
                          : 'On'
                        : lang === 'ar'
                        ? 'متوقف'
                        : 'Off'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onTriggerTestQuizReminder && onTriggerTestQuizReminder(quiz)
                      }
                      className="px-2 py-1 rounded-md border border-[#DDD2BE] text-xs font-medium text-[#5C4B3B] hover:border-[#C88A14] hover:text-[#261C14] transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'تجربة إشعار الاختبار' : 'Test Alert'}
                    >
                      {lang === 'ar' ? 'تنبيه' : 'Alert'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onStartQuiz && onStartQuiz(quiz)}
                      className="px-3 py-1 rounded-md bg-[#C88A14] hover:bg-[#B3780C] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                    >
                      <span>{lang === 'ar' ? 'بدء الاختبار' : 'Quiz'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
