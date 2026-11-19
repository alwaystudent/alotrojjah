import React from 'react';
import { Bell, Volume2, VolumeX, CheckCircle2, Clock, Send, Repeat, Check, Sparkles } from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  QuranRandomQuizItem,
  WEEK_DAYS,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getTodayDayId,
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
    <section className="rounded-2xl p-3 sm:p-4 bg-[#EAF0E7] border border-[#C5CEBF] shadow-sm space-y-3.5 text-[#161E19]">
      {/* Compact Header & Controls Strip */}
      <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E5C3E]">
            <CheckCircle2
              className={`w-4 h-4 ${
                notificationPermission === 'granted' ? 'text-[#0E6340]' : 'text-[#96701E]'
              }`}
            />
            <span>{dict.browserPermissionStatus}:</span>
            <span className="text-[#4B5650] font-semibold">
              {notificationPermission === 'granted'
                ? dict.permissionGranted
                : notificationPermission === 'denied'
                ? dict.permissionDenied
                : dict.permissionDefault}
            </span>
          </div>

          <span className="text-[#C5CEBF]">|</span>

          <button
            type="button"
            onClick={onToggleSound}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0E5C3E] cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#96701E]" />
            <span>{dict.soundAlertToggle}:</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                soundEnabled
                  ? 'bg-[#0E6340] text-[#FFFFFF] border-[#0E6340]'
                  : 'bg-[#EAF0E7] text-[#4B5650] border-[#C5CEBF]'
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
              className="px-3 py-1.5 rounded-lg border border-[#C5CEBF] bg-[#F4F5EE] text-xs font-semibold text-[#0E5C3E] hover:bg-[#EAF0E7] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5 text-[#96701E]" />
              <span>{dict.enableNotificationsBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onTriggerTestReminder()}
            className="mustard-gradient-btn px-3 py-1.5 rounded-lg text-xs font-bold text-[#FFFFFF] shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" />
            <span>{dict.testNotificationBtn}</span>
          </button>
        </div>
      </div>

      {/* Preparation Alerts Card (تنبيهات الاستعداد قبل موعد الخطة بـ 10 دقائق) */}
      <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E5C3E]">
            <Clock className="w-4 h-4 text-[#96701E] shrink-0" />
            <span>{dict.prepAlertsTitle}</span>
          </div>
          <p className="text-[11px] text-[#4B5650] leading-relaxed">
            {dict.prepAlertsDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePrepAlerts}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              prepAlertsEnabled
                ? 'bg-[#0E6340] text-[#FFFFFF] border-[#0E6340] shadow-2xs'
                : 'bg-[#F4F5EE] text-[#4B5650] border-[#C5CEBF] hover:bg-[#EAF0E7]'
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
            className="px-2.5 py-1.5 rounded-lg border border-[#C5CEBF] bg-[#F4F5EE] text-xs font-semibold text-[#0E5C3E] hover:bg-[#EAF0E7] transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'تجربة' : 'Test'}
          </button>
        </div>
      </div>

      {/* Automatic Silent Mode Banner for Recitation Sessions */}
      <div className="p-2.5 rounded-xl bg-[#FBF5E6] border border-[#D3BF8C] flex items-center gap-2 text-xs text-[#4B5650]">
        <VolumeX className="w-4 h-4 text-[#96701E] shrink-0" />
        <span className="leading-relaxed">
          {lang === 'ar'
            ? 'تصمت التنبيهات تلقائياً أثناء جلسات السرد والحفظ والمراجعة.'
            : 'Alerts auto-silence during active recitation and quiz sessions.'}
        </span>
      </div>

      {/* Scheduled Reminders Table */}
      <div className="rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] overflow-hidden shadow-2xs">
        <div className="px-4 py-2.5 bg-[#E7DEC9] border-b border-[#C5CEBF] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#0E5C3E]">{dict.upcomingRemindersTitle}</h3>
          <span className="text-xs text-[#4B5650] font-mono-tabular font-semibold">
            {plans.filter((p) => p.reminderEnabled).length}/{sortedPlans.length}
          </span>
        </div>

        <div className="divide-y divide-[#EAF0E7]">
          {sortedPlans.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6A766E]">
              {lang === 'ar'
                ? 'لا توجد خطط مجدولة للتذكير حالياً.'
                : 'No scheduled plan reminders yet.'}
            </div>
          ) : (
            sortedPlans.map((plan) => {
              const dayInfo = WEEK_DAYS.find((d) => d.id === plan.day);
              const isToday = plan.day === todayId;
              return (
                <div
                  key={plan.id}
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                    isToday ? 'bg-[#F7F1DF]/65' : 'hover:bg-[#F4F5EE]/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#161E19]">
                      {formatCurriculumTitle(plan, lang)}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-bold text-[#8A6518] bg-[#F5ECD4] px-1.5 py-0.5 rounded">
                        {dict.todayBadge}
                      </span>
                    )}
                    <span className="text-[#4B5650]">
                      · {dayInfo ? (lang === 'ar' ? dayInfo.nameAr : dayInfo.nameEn) : ''}{' '}
                      ({getCompactDualDate(plan.day, lang).hijri} · {getCompactDualDate(plan.day, lang).greg}) ·{' '}
                      {getPlanTypeLabel(plan.planType, lang)} · {plan.estimatedAyahs} {dict.ayahsUnit}
                    </span>
                    {plan.repeatWeekly && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#96701E]/15 text-[#8A6518] border border-[#96701E]/25">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>{dict.repeatWeeklyBadge}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#96701E]" />
                      <input
                        type="time"
                        value={plan.reminderTime}
                        onChange={(e) => onUpdatePlanReminderTime(plan.id, e.target.value)}
                        className="px-2 py-0.5 rounded-md bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onTogglePlanReminder(plan.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap border ${
                        plan.reminderEnabled
                          ? 'bg-[#0E6340] text-[#FFFFFF] border-[#0E6340] hover:bg-[#3E5239]'
                          : 'bg-[#EAF0E7] text-[#4B5650] border-[#C5CEBF] hover:bg-[#D3DDD0]'
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
                      className="px-2 py-1 rounded-md border border-[#C5CEBF] bg-[#F4F5EE] text-xs font-semibold text-[#0E5C3E] hover:bg-[#EAF0E7] transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'تجربة' : 'Test'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Scheduled Random Tests Reminders (الاختبارات العشوائية المجدولة والتذكيرات) */}
      <div className="rounded-xl bg-[#FFFFFF] border border-[#C5CEBF] overflow-hidden space-y-0 shadow-2xs">
        <div className="px-4 py-2.5 bg-[#E7DEC9] border-b border-[#C5CEBF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#96701E]" />
            <h3 className="text-xs font-bold text-[#0E5C3E]">
              {lang === 'ar'
                ? 'تذكيرات الاختبارات العشوائية لتثبيت الحفظ (المتقن · المتردد · المتفلت)'
                : 'Random Retention Tests Reminders'}
            </h3>
          </div>
          <span className="text-xs text-[#4B5650] font-mono-tabular font-semibold">
            {quizzes.filter((q) => q.reminderEnabled).length}/{quizzes.length}
          </span>
        </div>

        {quizzes.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#6A766E]">
            {lang === 'ar'
              ? 'لا توجد اختبارات عشوائية مجدولة حالياً. يتم إنشاء الاختبارات وتذكيراتها تلقائياً فور اعتماد تقييم أي مقرر بعد إتمام مراحل الحفظ الثلاث.'
              : 'No scheduled random tests yet. Tests and reminders are created automatically once a memorization plan is completed and rated.'}
          </div>
        ) : (
          <div className="divide-y divide-[#EAF0E7]">
            {quizzes.map((quiz) => {
              const isDueToday =
                new Date(quiz.dueDateTimestamp).toDateString() === new Date().toDateString();

              return (
                <div
                  key={quiz.id}
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                    isDueToday ? 'bg-[#F7F1DF]/65' : 'hover:bg-[#F4F5EE]/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 border border-[#C5CEBF] ${
                        quiz.evaluation === 'muthabbat'
                          ? 'bg-[#0E6340]'
                          : quiz.evaluation === 'mutaraddid'
                          ? 'bg-[#96701E]'
                          : 'bg-[#A84A32]'
                      }`}
                    />
                    <span className="font-bold text-[#161E19]">
                      سورة {quiz.surahNameAr} ({quiz.ayahFrom} - {quiz.ayahTo})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#EAF0E7] text-[#4B5650] border border-[#C5CEBF] text-[10.5px] font-semibold">
                      {quiz.frequencyLabelAr}
                    </span>
                    <span className="text-[#4B5650] text-[11px]">
                      · الموعد: {quiz.scheduledDateFormatted}
                    </span>
                    {isDueToday && (
                      <span className="text-[10.5px] font-bold text-[#8A6518] px-1.5 py-0.5 rounded-sm bg-[#F5ECD4] border border-[#96701E]/35">
                        حان اليوم!
                      </span>
                    )}
                    {quiz.score !== undefined && (
                      <span className="text-[10.5px] font-bold text-[#0E6340] font-mono-tabular">
                        آخر نتيجة: {quiz.score}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#96701E]" />
                      <input
                        type="time"
                        value={quiz.reminderTime}
                        onChange={(e) =>
                          onUpdateQuizReminderTime &&
                          onUpdateQuizReminderTime(quiz.id, e.target.value)
                        }
                        className="px-2 py-0.5 rounded-md bg-[#F4F5EE] border border-[#C5CEBF] text-xs font-mono-tabular text-[#161E19] focus:outline-none focus:border-[#96701E]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleQuizReminder && onToggleQuizReminder(quiz.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap border ${
                        quiz.reminderEnabled
                          ? 'bg-[#0E6340] text-[#FFFFFF] border-[#0E6340] hover:bg-[#3E5239]'
                          : 'bg-[#EAF0E7] text-[#4B5650] border-[#C5CEBF] hover:bg-[#D3DDD0]'
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
                      className="px-2 py-1 rounded-md border border-[#C5CEBF] bg-[#F4F5EE] text-xs font-semibold text-[#0E5C3E] hover:bg-[#EAF0E7] transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'تجربة إشعار الاختبار' : 'Test Alert'}
                    >
                      {lang === 'ar' ? 'تنبيه' : 'Alert'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onStartQuiz && onStartQuiz(quiz)}
                      className="mustard-gradient-btn px-3 py-1 rounded-md text-[#FFFFFF] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
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
