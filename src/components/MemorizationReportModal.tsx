import React from 'react';
import {
  X,
  Award,
  CheckCircle2,
  Calendar,
  Clock,
  BookOpen,
  Sparkles,
  Volume2,
  ChevronLeft,
  Bell,
  BarChart3,
  Play,
  RotateCcw,
} from 'lucide-react';
import { MemorizationReport, Language } from '@/src/data/quranData';

interface MemorizationReportModalProps {
  report: MemorizationReport;
  lang: Language;
  onClose: () => void;
  onStartQuizNow: () => void;
  onViewInAnalytics: () => void;
}

export const MemorizationReportModal: React.FC<MemorizationReportModalProps> = ({
  report,
  lang,
  onClose,
  onStartQuizNow,
  onViewInAnalytics,
}) => {
  const isMuthabbat = report.evaluation === 'muthabbat';
  const isMutaraddid = report.evaluation === 'mutaraddid';
  const isMutafallit = report.evaluation === 'mutafallit';

  const badgeColorClass = isMuthabbat
    ? 'bg-[#4A6144] text-white border-[#3D5237]'
    : isMutaraddid
    ? 'bg-[#C88A14] text-white border-[#B3780C]'
    : 'bg-[#A84A32] text-white border-[#913E28]';

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-xl rounded-3xl bg-[#FFFDF9] border-2 border-[#C88A14] shadow-2xl text-[#261C14] overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <header className="px-5 py-4 bg-[#FBF5E6] border-b border-[#E8D29F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#4A6144]/15 border border-[#4A6144]/30 flex items-center justify-center text-[#4A6144]">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display-islamic text-[#2D2218]">
                {lang === 'ar' ? 'تقرير إنجاز الحفظ الذكي المعتمد' : 'Memorization Certified Report'}
              </h2>
              <p className="text-[11px] text-[#84715E]">
                {lang === 'ar'
                  ? 'تم حفظ التقرير في الإحصائيات مع جدولة الاختبارات العشوائية والتذكيرات'
                  : 'Report saved to stats with scheduled random quizzes and reminders'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#84715E] hover:text-[#2D2218] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Certified Evaluation Badge Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs ${badgeColorClass}`}
          >
            <div className="space-y-0.5">
              <span className="text-[11px] opacity-90 block">
                {lang === 'ar' ? 'التقييم المعتمد بعد إتمام المراحل الثلاث:' : 'Certified Rating:'}
              </span>
              <h3 className="text-base sm:text-lg font-bold font-display-islamic">
                {isMuthabbat && '🟩 مُتقَن (اعتماد الحفظ والمباعدة الزمنية)'}
                {isMutaraddid && '🟨 مُتردِّد (تكثيف المراجعة كل 3 أيام)'}
                {isMutafallit && '🟥 مُتفلِّت (استدراك فوري غداً في اليوم الموالي)'}
              </h3>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-xs text-xs font-bold shrink-0">
              {report.evaluationLabelAr}
            </div>
          </div>

          {/* Curriculum Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-0.5">
              <span className="text-[10px] text-[#84715E] block">السورة المقررة</span>
              <span className="font-bold text-[#2D2218] font-display-islamic text-sm">
                سورة {report.surahNameAr} ({report.surahNumber})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-0.5">
              <span className="text-[10px] text-[#84715E] block">نطاق الآيات</span>
              <span className="font-bold text-[#2D2218] font-mono-tabular text-sm">
                الآيات {report.ayahFrom} - {report.ayahTo} ({report.ayahCount} آية)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-0.5">
              <span className="text-[10px] text-[#84715E] block">القارئ المعتمد للتلقين</span>
              <span className="font-bold text-[#2D2218] text-xs truncate block">
                {report.reciterName}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] space-y-0.5">
              <span className="text-[10px] text-[#84715E] block">تاريخ الإتمام</span>
              <span className="font-bold text-[#2D2218] text-xs">
                {report.formattedDate}
              </span>
            </div>
          </div>

          {/* Completed Stages Strip */}
          <div className="p-3.5 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] space-y-2">
            <span className="text-[11px] font-bold text-[#5C4B3B] block">
              حالة المراحل الثلاث لمنظومة الحفظ:
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[#4A6144]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#4A6144]" />
                  <span>المرحلة الأولى: التلقين والاستماع التراكمي</span>
                </div>
                <span className="font-bold text-[11px]">مكتملة بنجاح ✓</span>
              </div>

              <div className="flex items-center justify-between text-[#4A6144]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#4A6144]" />
                  <span>المرحلة الثانية: المحاذاة اللحظية والتلاشي التدريجي</span>
                </div>
                <span className="font-bold text-[11px]">مكتملة بنجاح ✓</span>
              </div>

              <div className="flex items-center justify-between text-[#4A6144]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#4A6144]" />
                  <span>المرحلة الثالثة: التسميع الغيبي الذكي والتقييم الصوتي</span>
                </div>
                <span className="font-bold text-[11px]">مطابقة 100% ✓</span>
              </div>
            </div>
          </div>

          {/* Scheduled Random Quiz Box */}
          <div className="p-4 rounded-2xl bg-[#FBF5E6] border border-[#E8D29F] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C88A14]" />
                <h4 className="text-xs font-bold text-[#2D2218]">
                  {lang === 'ar' ? 'الاختبار العشوائي المجدول التلقائي:' : 'Scheduled Random Quiz:'}
                </h4>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4A6144] px-2 py-0.5 rounded-md bg-[#4A6144]/15">
                <Bell className="w-3 h-3" />
                <span>التذكير مفعّل</span>
              </span>
            </div>

            <div className="text-xs text-[#5C4B3B] space-y-1 leading-relaxed">
              <p>
                <strong>دورية الاختبار:</strong>{' '}
                <span className="text-[#C88A14] font-bold">
                  {report.randomQuizSchedule.frequencyLabelAr}
                </span>
              </p>
              <p>
                <strong>موعد الاختبار القادم:</strong>{' '}
                <span className="text-[#2D2218] font-semibold">
                  {report.randomQuizSchedule.scheduledDateFormatted} (الساعة{' '}
                  {report.randomQuizSchedule.reminderTime})
                </span>
              </p>
              <p className="text-[11px] text-[#84715E]">
                * يتضمن النظام تنبيهاً قبل موعد الاختبار بـ 10 دقائق لضمان الاستعداد.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="p-4 bg-[#F7F3EB] border-t border-[#DDD2BE] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewInAnalytics}
              className="px-3.5 py-2 rounded-xl border border-[#DDD2BE] bg-[#FFFDF9] hover:bg-[#FBF5E6] text-xs font-bold text-[#2D2218] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4 text-[#C88A14]" />
              <span>عرض في الإحصائيات</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartQuizNow}
              className="px-4 py-2 rounded-xl bg-[#C88A14] hover:bg-[#B3780C] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>بدء اختبار عشوائي الآن</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3D5237] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              {lang === 'ar' ? 'تم ومتابعة الجدول' : 'Done & Continue'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
