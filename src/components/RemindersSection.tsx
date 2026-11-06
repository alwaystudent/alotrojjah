import React from 'react';
import { Bell, Volume2, VolumeX, CheckCircle2, Clock, Send, Repeat } from 'lucide-react';
import {
  Language,
  QuranPlanItem,
  WEEK_DAYS,
  formatCurriculumTitle,
  getPlanTypeLabel,
  getTodayDayId,
} from '@/src/data/quranData';
import { getCompactDualDate } from '@/src/utils/calendar';
import { t } from '@/src/data/translations';

interface RemindersSectionProps {
  plans: QuranPlanItem[];
  lang: Language;
  notificationPermission: NotificationPermission | 'unsupported';
  soundEnabled: boolean;
  onToggleSound: () => void;
  onRequestPermission: () => void;
  onTriggerTestReminder: (plan?: QuranPlanItem) => void;
  onTogglePlanReminder: (planId: string) => void;
  onUpdatePlanReminderTime: (planId: string, newTime: string) => void;
}

export const RemindersSection: React.FC<RemindersSectionProps> = ({
  plans,
  lang,
  notificationPermission,
  soundEnabled,
  onToggleSound,
  onRequestPermission,
  onTriggerTestReminder,
  onTogglePlanReminder,
  onUpdatePlanReminderTime,
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
          <h3 className="text-xs font-bold text-[#261C14]">{dict.upcomingRemindersTitle}</h3>
          <span className="text-xs text-[#84715E] font-mono-tabular">
            {plans.filter((p) => p.reminderEnabled).length}/{sortedPlans.length}
          </span>
        </div>

        <div className="divide-y divide-[#EFE9DC]">
          {sortedPlans.map((plan) => {
            const dayInfo = WEEK_DAYS.find((d) => d.id === plan.day);
            const isToday = plan.day === todayId;
            return (
              <div
                key={plan.id}
                className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 transition-colors ${
                  isToday ? 'bg-[#FBF5E6]/60' : 'hover:bg-[#F7F3EB]/60'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-[#261C14]">
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
    </section>
  );
};
