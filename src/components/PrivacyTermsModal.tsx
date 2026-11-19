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
          title: '١. سرية الاتصال الصوتي المباشر (WebRTC E2EE)',
          body: 'جميع مكالمات السرد الثنائي مشفرة من طرف إلى طرف (DTLS-SRTP) وتعمل بالصوت فقط (Strict Audio-Only) مع تعطيل قنوات تبادل الملفات والبيانات كلياً (RTCDataChannel Disabled). كما يعمل وضع الخصوصية العالية على تمرير الصوت عبر خادم TURN الوسيط لإخفاء عنوان الـ IP الحقيقي عن الطرف الآخر، وتُغلق مسارات الميكروفون وتُمسح من الذاكرة فور إنهاء المكالمة دون أي تسجيل صوتي.',
        },
        {
          icon: ShieldCheck,
          title: '٢. المصادقة وإضافة الأصدقاء بالموافقة الصريحة',
          body: 'يتم تسجيل الدخول عبر Firebase Authentication (البريد الموثّق أو حساب Google) وفق سياسات الأمان المعتمدة. يُعزل البريد الإلكتروني في سجل خاص بالمالك فقط ولا يُعرض للآخرين، كما تقتصر إضافة الأصدقاء على مشاركة رابط دعوة شخصي قابل للإلغاء ولا تكتمل الإضافة إلا بعد موافقة الطرف المستلم.',
        },
        {
          icon: Mic,
          title: '٣. أذونات الميكروفون والتحقق الصوتي الذاتي',
          body: 'يُطلب إذن الميكروفون حصراً أثناء تشغيل جلسات التلاوة الذاتية أو مكالمات السرد الثنائي، وتُعالج بيانات التعرف الصوتي محلياً داخل المتصفح دون الاحتفاظ بتسجيلات أو مشاركتها مع أطراف تسويقية.',
        },
        {
          icon: BookOpen,
          title: '٤. مصادر المصحف الموثوقة والروابط الخارجية',
          body: 'يستمد التطبيق النصوص القرآنية بروايات حفص وقالون وورش من واجهات موثوقة (مجمع الملك فهد لطباعة المصحف الشريف، موقع آية، AlQuran Cloud، وCDN المصاحف المعتمدة)، كما يعرض فقط المصادر والروابط العلمية التي يضيفها المستخدم طوعاً في المكتبة.',
        },
        {
          icon: Database,
          title: '٥. التخزين المحلي والتحديثات التلقائية (PWA)',
          body: 'تُحفظ خططك وإحصائياتك ومكتبتك في ذاكرة متصفحك المحلية (localStorage) وذاكرة التخزين المؤقت للعمل دون اتصال. يقوم التطبيق بتحديث ملفاته تلقائياً في الخلفية فور صدور أي نسخة جديدة دون الحاجة لمسح ذاكرة المتصفح أو إعادة التثبيت، مع الحفاظ الكامل على خططك وبياناتك.',
        },
        {
          icon: RefreshCw,
          title: '٦. شروط الاستخدام والالتزام بقوانين المنصات',
          body: 'باستخدامك لمنصة «الأترجة / السرد»، فإنك توافق على استخدام خصائص الاتصال الصوتي ومشاركة الروابط في التلاوة وتدارُس القرآن الكريم فقط، والالتزام بشروط مزودي الخدمة المرتبطين (Google Firebase ومتصفحات الويب). يملك المستخدم كامل الحق في حذف أصدقائه أو بياناته المحلية أو تسجيل الخروج في أي وقت.',
        },
      ]
    : [
        {
          icon: Lock,
          title: '1. End-to-End Encrypted Audio & IP Masking',
          body: 'Duo Recitation calls use strict audio-only WebRTC (DTLS-SRTP) with data/file channels blocked (RTCDataChannel disabled). High Privacy Mode routes audio via TURN relay to mask real IP addresses. Microphone tracks and peer connections are closed and purged from memory immediately when a call ends, with zero server recording.',
        },
        {
          icon: ShieldCheck,
          title: '2. Authentication & Consent-Based Friend Invites',
          body: 'Authentication is powered by Firebase Auth (verified email or Google Sign-In). Your email is isolated strictly to your private owner record. Friends are added exclusively through revocable invite links that require explicit recipient approval before calls are permitted.',
        },
        {
          icon: Mic,
          title: '3. Microphone & Self-Recitation Speech Recognition',
          body: 'Microphone access is requested only when you start self-recitation alignment or a Duo audio call. Audio is never stored or sold to third-party trackers.',
        },
        {
          icon: BookOpen,
          title: '4. Trusted Quran Sources & User Library',
          body: 'Quran text across Hafs, Qalun, and Warsh narrations is fetched from trusted public endpoints (King Fahd Complex/Quran.com, AlQuran Cloud, FawazAhmed0 CDN). External book links in the Library remain under user control.',
        },
        {
          icon: Database,
          title: '5. Local Storage & Seamless Automatic Updates',
          body: 'Your plans, statistics, and library reside locally in browser storage and Service Worker caches for offline reliability. App updates apply automatically in the background without clearing browser cache or reinstalling, keeping your local plans intact.',
        },
        {
          icon: RefreshCw,
          title: '6. Platform-Compliant Terms of Service',
          body: 'By using Al-Utrujjah / Assard, you agree to use calling and invite features responsibly for Quran study, complying with linked infrastructure terms (Google Firebase and standard browser policies). You may remove friends, clear plans, or sign out at any time.',
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
              {isAr ? 'سياسة الخصوصية وشروط الاستخدام' : 'Privacy Policy & Terms of Service'}
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
          <div className="rounded-xl bg-[#ECFDF3] border border-[#86EFAC] px-3.5 py-2.5 text-xs font-bold text-[#15803D]">
            {isAr
              ? 'مُحدَّث ليتوافق مع سياسات Google / Firebase ومتصفحات الويب ومعايير الخصوصية الصوتية المشفّرة.'
              : 'Updated for compliance with Google/Firebase, modern browser PWA, and encrypted WebRTC privacy standards.'}
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
            {isAr ? 'تحديثات تلقائية نشطة · الأداء مُحسَّن' : 'Auto-Updates Active · High Performance'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] cursor-pointer"
          >
            {isAr ? 'موافق وإغلاق' : 'Accept & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
