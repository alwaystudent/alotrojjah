import React from 'react';
import { X, ShieldCheck, Lock, Mic, Database, RefreshCw, BookOpen } from 'lucide-react';
import { Language } from '@/src/data/quranData';

interface PrivacyTermsModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  lang,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  const isAr = lang === 'ar';

  const sections = isAr
    ? [
        {
          icon: Lock,
          title: '١. سرية الاتصال الصوتي (WebRTC E2EE)',
          body: 'مكالمات السرد الثنائي مشفّرة (DTLS-SRTP) بالصوت فقط مع تعطيل تبادل الملفات (RTCDataChannel). يمرّر وضع الخصوصية الصوت عبر خادم TURN لإخفاء IP، وتُغلق مسارات الميكروفون فور إنهاء المكالمة دون تسجيل.',
        },
        {
          icon: ShieldCheck,
          title: '٢. المصادقة وإضافة الأصدقاء بالموافقة',
          body: 'الدخول عبر Firebase Auth (البريد الموثّق أو Google)، ويُحفظ البريد في سجل خاص بالمالك فقط. إضافة الأصدقاء تتم عبر رابط شخصي قابل للإلغاء وبموافقة المستلم.',
        },
        {
          icon: Mic,
          title: '٣. الميكروفون والتسميع',
          body: 'يُستخدم الميكروفون أثناء جلسات التلاوة والمكالمات فقط، ولا تُحفظ أي تسجيلات صوتية.',
        },
        {
          icon: BookOpen,
          title: '٤. مصادر المصحف والمكتبة',
          body: 'تُجلب الآيات (حفص، قالون، ورش) من مصادر موثوقة (مجمع الملك فهد، موقع آية، AlQuran Cloud)، وتخضع روابط المكتبة لاختيار المستخدم.',
        },
        {
          icon: Database,
          title: '٥. التخزين المحلي والتحديث الصامت',
          body: 'تُحفظ خططك محلياً في المتصفح، ويحدَّث التطبيق تلقائياً في الخلفية دون مسح البيانات أو إعادة التثبيت.',
        },
        {
          icon: RefreshCw,
          title: '٦. شروط الاستخدام',
          body: 'استخدام المكالمات والروابط مخصص لتدارس القرآن الكريم وفق سياسات Google Firebase والمتصفحات، مع حق حذف البيانات أو الأصدقاء في أي وقت.',
        },
      ]
    : [
        {
          icon: Lock,
          title: '1. Encrypted Audio & IP Masking',
          body: 'Duo calls use strict audio-only WebRTC (DTLS-SRTP) with data channels disabled. High Privacy routes audio via TURN to mask IPs, and mic tracks purge immediately on hang-up with zero recording.',
        },
        {
          icon: ShieldCheck,
          title: '2. Auth & Consent-Based Invites',
          body: 'Powered by Firebase Auth (verified email or Google), with emails kept private. Friends connect only via revocable links requiring recipient approval.',
        },
        {
          icon: Mic,
          title: '3. Microphone Usage',
          body: 'Mic access is used strictly during active recitation and calls, with no audio stored.',
        },
        {
          icon: BookOpen,
          title: '4. Quran Sources & Library',
          body: 'Verses (Hafs, Qalun, Warsh) load from trusted sources (King Fahd Complex, AlQuran Cloud, FawazAhmed0 CDN). Library links remain user-managed.',
        },
        {
          icon: Database,
          title: '5. Local Storage & Silent Updates',
          body: 'Plans reside in browser storage. App updates apply silently in the background without cache clearing or reinstalling.',
        },
        {
          icon: RefreshCw,
          title: '6. Terms of Service',
          body: 'Calling and invite tools are for Quran study in compliance with Google Firebase and browser policies. You may delete friends or local data anytime.',
        },
      ];

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] shadow-2xl overflow-hidden text-[#261C14]"
      >
        <div className="px-4 sm:px-5 py-3.5 bg-[#2D2218] text-[#FFFDF9] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#EAB338]" />
            <h2 className="text-sm sm:text-base font-extrabold">
              {isAr ? 'الخصوصية وشروط الاستخدام' : 'Privacy & Terms'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 text-[#FFFDF9] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs sm:text-sm leading-relaxed">
          <div className="rounded-xl bg-[#ECFDF3] border border-[#86EFAC] px-3.5 py-2 text-xs font-bold text-[#15803D]">
            {isAr
              ? 'متوافقة مع سياسات Google / Firebase ومتصفحات الويب ومعايير التشفير الصوتي.'
              : 'Compliant with Google/Firebase, browser PWA, and encrypted WebRTC standards.'}
          </div>

          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.title}
                className="rounded-xl bg-[#F7F3EB] border border-[#E5DEC9] p-3.5 space-y-1.5"
              >
                <h3 className="font-extrabold text-[#2D2218] flex items-center gap-2 text-xs sm:text-sm">
                  <Icon className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span>{sec.title}</span>
                </h3>
                <p className="text-xs text-[#5C4B3B] leading-relaxed">{sec.body}</p>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-5 py-3 bg-[#F7F3EB] border-t border-[#DDD2BE] flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-[#84715E]">
            {isAr ? 'تحديثات تلقائية نشطة' : 'Auto-Updates Active'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] cursor-pointer"
          >
            {isAr ? 'موافق' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
};
