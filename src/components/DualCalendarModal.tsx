import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Moon, Sun } from 'lucide-react';
import { Language, QuranPlanItem, WEEK_DAYS } from '@/src/data/quranData';
import { getDualDate } from '@/src/utils/calendar';

interface DualCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  plans: QuranPlanItem[];
  onSelectDay?: (dayId: string) => void;
}

export const DualCalendarModal: React.FC<DualCalendarModalProps> = ({
  isOpen,
  onClose,
  lang,
  plans,
  onSelectDay,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  if (!isOpen) return null;

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // First day of current month
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const todayDual = getDualDate(today, lang);

  // Month title in Gregorian and Hijri
  const gregMonthFormatter = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
  const hijriMonthFormatter = new Intl.DateTimeFormat(
    lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura' : 'en-u-ca-islamic-umalqura',
    {
      month: 'long',
      year: 'numeric',
    }
  );

  const daysGrid: { dayNumber: number; date: Date; hijriDay: string }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    let hijriDay = '';
    try {
      const hFormat = new Intl.DateTimeFormat(
        lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura',
        { day: 'numeric' }
      );
      hijriDay = hFormat.format(d);
    } catch {
      hijriDay = '';
    }
    daysGrid.push({ dayNumber: i, date: d, hijriDay });
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 sm:p-5 shadow-2xl text-[#261C14] space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDD2BE] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#C88A14]/15 text-[#C88A14]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#2D2218]">
                {lang === 'ar' ? 'التقويم الهجري والميلادي' : 'Hijri & Gregorian Calendar'}
              </h3>
              <p className="text-[11px] text-[#84715E]">{todayDual.combined}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F7F3EB] text-[#84715E] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between bg-[#F7F3EB] px-3 py-2 rounded-xl border border-[#DDD2BE]">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-white text-[#2D2218] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>

          <div className="text-center">
            <div className="text-xs sm:text-sm font-bold text-[#2D2218] flex items-center justify-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#C88A14]" />
              <span>{gregMonthFormatter.format(currentMonthDate)}</span>
            </div>
            <div className="text-[11px] font-semibold text-[#84715E] flex items-center justify-center gap-1.5 mt-0.5">
              <Moon className="w-3 h-3 text-[#4A6144]" />
              <span>
                {hijriMonthFormatter.format(currentMonthDate)}
                {lang === 'ar' ? ' هـ' : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-white text-[#2D2218] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#84715E]">
          {WEEK_DAYS.map((wd) => (
            <div key={wd.id} className="py-1">
              {lang === 'ar' ? wd.shortAr : wd.shortEn}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-12 rounded-lg bg-transparent" />
          ))}

          {daysGrid.map(({ dayNumber, date, hijriDay }) => {
            const isToday =
              date.getDate() === today.getDate() &&
              date.getMonth() === today.getMonth() &&
              date.getFullYear() === today.getFullYear();

            // Match dayId
            const jsDay = date.getDay();
            const weekDay = WEEK_DAYS.find((w) => w.jsDay === jsDay);
            const matchingPlans = weekDay
              ? plans.filter((p) => p.day === weekDay.id)
              : [];
            const hasCompletedPlans =
              matchingPlans.length > 0 && matchingPlans.some((p) => p.status === 'completed');

            return (
              <button
                key={dayNumber}
                type="button"
                onClick={() => {
                  if (weekDay && onSelectDay) {
                    onSelectDay(weekDay.id);
                    onClose();
                  }
                }}
                className={`h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border relative p-1 ${
                  isToday
                    ? 'bg-[#C88A14] text-white border-[#C88A14] shadow-xs'
                    : 'bg-[#F7F3EB]/70 hover:bg-[#F2E8D5] border-[#DDD2BE]/60 text-[#261C14]'
                }`}
              >
                {/* Gregorian Day (Big) */}
                <span className="text-xs font-bold leading-none">{dayNumber}</span>

                {/* Hijri Day (Small Subscript with Crescent) */}
                <span
                  className={`text-[10px] font-mono-tabular font-medium mt-0.5 leading-none ${
                    isToday ? 'text-[#FFFDF9]/90' : 'text-[#84715E]'
                  }`}
                >
                  {hijriDay}
                </span>

                {/* Small indicator dot for plans on this weekday */}
                {matchingPlans.length > 0 && (
                  <span
                    className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${
                      isToday
                        ? 'bg-white'
                        : hasCompletedPlans
                        ? 'bg-[#4A6144]'
                        : 'bg-[#C88A14]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-[#DDD2BE] text-xs text-[#84715E]">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#4A6144]" />
            <span>{lang === 'ar' ? 'خطط منجزة' : 'Done plans'}</span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#C88A14] ms-2" />
            <span>{lang === 'ar' ? 'خطط مجدولة' : 'Scheduled plans'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#2D2218] text-white text-xs font-bold hover:bg-[#3D2F22] cursor-pointer"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
