import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Mic,
  Database,
  RefreshCw,
  BookOpen,
  FileCheck2,
  Scale,
} from 'lucide-react';
import { Language } from '@/src/data/quranData';

interface PrivacyTermsModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  lang,
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;
  const isAr = lang === 'ar';

  const privacySections = isAr
    ? [
        {
          icon: Lock,
          title: '١. تشفير الاتصال الصوتي وحماية الـ IP (WebRTC E2EE)',
          body: 'تعتمد مكالمات السرد الثنائي على التشفير المباشر (DTLS-SRTP) بالصوت فقط مع تعطيل قنوات تبادل الملفات (RTCDataChannel) تماماً. عند تفعيل وضع الخصوصية العالية وإعداد خادم TURN تُخفى عناوين الـ IP، وتُغلق مسارات الميكروفون وتُحذف بيانات الجلسة فور إنهائها دون أي تسجيل صوتي.',
        },
        {
          icon: ShieldCheck,
          title: '٢. حسابات المستخدمين وإضافة الأصدقاء (Google & Firebase)',
          body: 'يتم تسجيل الدخول عبر Firebase Authentication (البريد الإلكتروني الموثّق أو حساب Google) وفق سياسة بيانات مستخدمي خدمات Google API، مع حفظ بيانات الحساب والخطط في قواعد آمنة تقتصر صلاحية الوصول فيها على أصحابها. لا تُضاف أي جهة اتصال إلا عبر رابط دعوة قابل للإلغاء وبموافقة صريحة من الطرفين.',
        },
        {
          icon: Mic,
          title: '٣. إذن الميكروفون والإشعارات',
          body: 'يُطلب إذن الميكروفون حصراً أثناء التلاوة أو المكالمات الصوتية المباشرة، وإذن الإشعارات الاختياري للتنبيه بمواعيد الورد أو المكالمات الواردة، ولا يتم تسجيل أو تخزين أي صوت على الخوادم.',
        },
        {
          icon: Database,
          title: '٤. التخزين المحلي والتحديث الصامت (PWA)',
          body: 'تُحفظ خططك وجداولك وتقارير الحفظ محلياً داخل متصفحك (LocalStorage / IndexedDB) لضمان السرعة والعمل دون اتصال، مع تطبيق التحديثات تلقائياً في الخلفية دون مسح بياناتك.',
        },
      ]
    : [
        {
          icon: Lock,
          title: '1. Encrypted Voice Calls & IP Protection (WebRTC E2EE)',
          body: 'Duo Recitation uses strict audio-only DTLS-SRTP encryption with RTCDataChannel file transfer disabled. When High Privacy Mode and a TURN relay are configured, peer IP addresses are masked, and mic tracks close immediately on hang-up with zero server audio recording.',
        },
        {
          icon: ShieldCheck,
          title: '2. Accounts & Consent-Based Friends (Google & Firebase)',
          body: 'Authentication runs via Firebase Auth (verified email or Google Sign-In) aligned with the Google API Services User Data Policy. Account data is strictly owner-scoped via Firestore security rules, and friends connect only via revocable invite links with mutual approval.',
        },
        {
          icon: Mic,
          title: '3. Microphone & Notification Permissions',
          body: 'Microphone access is used exclusively during active recitation or live calls. Optional browser notifications alert you for scheduled plans or incoming calls. No audio is ever recorded or stored.',
        },
        {
          icon: Database,
          title: '4. Local Storage & Silent PWA Updates',
          body: 'Your schedules, plans, and memorization reports remain in browser storage for fast offline-ready access, while silent background updates keep the app current without clearing your data.',
        },
      ];

  const termsSections = isAr
    ? [
        {
          icon: Scale,
          title: '١. نطاق الاستخدام المشروع والالتزام بسياسات المنصات',
          body: 'منصة «مشكاة السرد» مخصصة لمراجعة القرآن الكريم وتدارس الروايات المعتمدة، ويلتزم المستخدم بعدم إساءة استخدام روابط الدعوة أو نظام الإشارات الصوتية أو إرسال رسائل مزعجة، وذلك وفق شروط خدمة Google وFirebase ومعايير متصفحات الويب.',
        },
        {
          icon: BookOpen,
          title: '٢. حقوق النصوص القرآنية والمصادر الخارجية',
          body: 'تُعرض الآيات بروايات حفص وقالون وورش عبر واجهات برمجية ومصادر قرآنية موثوقة (مجمع الملك فهد، موقع آية، AlQuran Cloud). أما الروابط والملفات التي يضيفها المستخدم داخل المكتبة فتخضع لاختياره ومسؤوليته مع احترام حقوق الملكية الفكرية.',
        },
        {
          icon: RefreshCw,
          title: '٣. توفر الخدمة والتعديلات التلقائية',
          body: 'تُحدّث الواجهة ومصادر القراءة تلقائياً لتحسين الأداء والاستقرار دون الحاجة لإعادة التثبيت، مع إمكانية تعليق الجلسات الصوتية أو تقييد الروابط عند رصد أي استخدام مخالف.',
        },
        {
          icon: FileCheck2,
          title: '٤. التحكم بالبيانات والحذف الفوري',
          body: 'يحق للمستخدم في أي وقت إزالة أي صديق، أو إلغاء رابط الدعوة وإصدار رابط جديد، أو مسح بيانات الخطط المحلية بالكامل من صفحة الإعدادات، أو تسجيل الخروج متى شاء.',
        },
      ]
    : [
        {
          icon: Scale,
          title: '1. Acceptable Use & Platform Compliance',
          body: 'Mishkat Al-Sard is built for Quran memorization and peer recitation. Users agree not to misuse invite links, voice signaling, or notifications, in full compliance with Google, Firebase, and modern web browser policies.',
        },
        {
          icon: BookOpen,
          title: '2. Quranic Text Sources & Library Content',
          body: 'Hafs, Qalun, and Warsh texts load from verified Quranic APIs (King Fahd Complex, AlQuran Cloud, Ayah CDN). Any external library links added by the user remain under user choice and copyright responsibility.',
        },
        {
          icon: RefreshCw,
          title: '3. Service Availability & Automatic Updates',
          body: 'Updates roll out seamlessly in the background for reliability and security without manual reinstallation. Abusive invites or signaling attempts may be restricted to protect users.',
        },
        {
          icon: FileCheck2,
          title: '4. User Data Control & Deletion',
          body: 'You may remove any friend, revoke and regenerate invite links, wipe local schedules/plans from Settings, or sign out at any time.',
        },
      ];

  const activeList = activeTab === 'privacy' ? privacySections : termsSections;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#FFFFFF] border border-[#C5CEBF] shadow-2xl overflow-hidden text-[#161E19]"
      >
        <div className="px-4 sm:px-5 py-3.5 bg-[#0E5C3E] text-[#FFFFFF] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E6C25A]" />
            <h2 className="text-sm sm:text-base font-extrabold">
              {isAr ? 'سياسة الخصوصية وشروط الاستخدام' : 'Privacy Policy & Terms of Use'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Switch Tabs between Privacy Policy and Terms of Use */}
        <div className="px-4 pt-3 pb-1 bg-[#FFFFFF] shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F5EE] border border-[#D3DDD0]">
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`py-2 px-3 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                activeTab === 'privacy'
                  ? 'bg-[#0E5C3E] text-[#E6C25A] shadow-2xs'
                  : 'text-[#4B5650] hover:text-[#161E19]'
              }`}
            >
              {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`py-2 px-3 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                activeTab === 'terms'
                  ? 'bg-[#0E5C3E] text-[#E6C25A] shadow-2xs'
                  : 'text-[#4B5650] hover:text-[#161E19]'
              }`}
            >
              {isAr ? 'شروط الاستخدام' : 'Terms of Use'}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-xs sm:text-sm leading-relaxed">
          <div className="rounded-xl bg-[#ECFDF3] border border-[#86EFAC] px-3.5 py-2 text-xs font-bold text-[#15803D]">
            {isAr
              ? 'متوافقة مع سياسات Google وFirebase، ومعايير تشفير الويب (WebRTC DTLS-SRTP)، وأذونات المتصفح وتطبيقات الويب.'
              : 'Compliant with Google/Firebase policies, WebRTC DTLS-SRTP encryption, and modern browser PWA permission standards.'}
          </div>

          {activeList.map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.title}
                className="rounded-xl bg-[#F4F5EE] border border-[#D3DDD0] p-3.5 space-y-1.5"
              >
                <h3 className="font-extrabold text-[#0E5C3E] flex items-center gap-2 text-xs sm:text-sm">
                  <Icon className="w-4 h-4 text-[#96701E] shrink-0" />
                  <span>{sec.title}</span>
                </h3>
                <p className="text-xs text-[#4B5650] leading-relaxed">{sec.body}</p>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-5 py-3 bg-[#F4F5EE] border-t border-[#C5CEBF] flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-[#6A766E]">
            {isAr ? 'آخر تحديث: ٢٠٢٦ · تحديثات تلقائية نشطة' : 'Updated 2026 · Auto-Updates Active'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="mustard-gradient-btn px-5 py-1.5 rounded-xl text-xs font-bold text-[#FFFFFF] cursor-pointer"
          >
            {isAr ? 'إغلاق وموافقة' : 'Accept & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
