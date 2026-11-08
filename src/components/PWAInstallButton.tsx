import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share2, PlusSquare, Monitor, Globe, Compass } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';
import { Language } from '@/src/data/quranData';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'settings' | 'banner' | 'prominent';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, browserType, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3000);
      }
    } else {
      // Show instructional modal tailored to the user's browser
      setShowGuideModal(true);
    }
  };

  // If already installed and running standalone, show an indicator in settings or clear badge
  if (isInstalled && variant === 'settings') {
    return (
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#4A6144]/15 border border-[#88B87E]/30 text-xs text-[#261C14]">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-[#4A6144] shrink-0" />
          <span className="font-semibold">
            {lang === 'ar' ? 'التطبيق مثبت ويعمل كنسخة أصلية على جهازك' : 'App is installed as PWA'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="text-[11px] text-[#C88A14] hover:underline font-bold cursor-pointer shrink-0"
        >
          {lang === 'ar' ? 'دليل التثبيت' : 'Guide'}
        </button>
      </div>
    );
  }

  const buttonClasses =
    variant === 'header'
      ? 'mustard-gradient-btn text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border border-[#EAB338]/40'
      : variant === 'prominent'
      ? 'mustard-gradient-btn text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#EAB338]/50'
      : variant === 'settings'
      ? 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer mustard-gradient-btn text-white shadow-2xs'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#2D2218] text-[#FFFDF9] hover:bg-[#3D2F22]';

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={buttonClasses}
        title={lang === 'ar' ? 'تثبيت التطبيق على مختلف المتصفحات والأجهزة' : 'Install App across browsers'}
      >
        {installSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-300" />
            <span>{lang === 'ar' ? 'تم التثبيت' : 'Installed'}</span>
          </>
        ) : isInstalled ? (
          <>
            <Check className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="whitespace-nowrap">
              {lang === 'ar' ? 'مُثبّت' : 'Installed'}
            </span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">
              {variant === 'settings'
                ? lang === 'ar'
                  ? 'تثبيت على جهازك'
                  : 'Install on Device'
                : lang === 'ar'
                ? 'تثبيت'
                : 'Install'}
            </span>
          </>
        )}
      </button>

      {/* Comprehensive Multi-Browser Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-4 sm:p-5 shadow-2xl text-[#261C14] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#DDD2BE] pb-2.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#C88A14]" />
                <h3 className="font-bold text-sm sm:text-base text-[#2D2218]">
                  {lang === 'ar' ? 'تثبيت المنصة على مختلف المتصفحات' : 'Install App on Your Browser'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F3EB] text-[#84715E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* iOS Safari Guide */}
            {browserType === 'ios' && (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <div className="p-2 rounded-lg bg-[#C88A14]/10 border border-[#C88A14]/20 text-[#9E650C] font-semibold flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span>{lang === 'ar' ? 'متصفح سفاري (Safari) على آيفون وآيباد' : 'Safari on iPhone & iPad'}</span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Share2 className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '1. اضغط على أيقونة "المشاركة" (Share) في شريط المتصفح أسفل الشاشة.'
                      : '1. Tap the Share button in the Safari bottom bar.'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <PlusSquare className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '2. مرر للأعلى واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                      : '2. Scroll up/down and tap "Add to Home Screen".'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Check className="w-4 h-4 text-[#4A6144] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '3. اضغط على زر "إضافة" (Add) أعلى اليمين لتظهر المنصة كتطبيق أصلي.'
                      : '3. Tap "Add" in the top corner to complete installation.'}
                  </span>
                </div>
              </div>
            )}

            {/* Samsung Internet Guide */}
            {browserType === 'samsung' && (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <div className="p-2 rounded-lg bg-[#C88A14]/10 border border-[#C88A14]/20 text-[#9E650C] font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span>{lang === 'ar' ? 'متصفح سامسونج إنترنت (Samsung Internet)' : 'Samsung Internet Browser'}</span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Download className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '1. اضغط على زر القائمة (≡) في أسفل يمين المتصفح.'
                      : '1. Tap the menu button (≡) at the bottom corner.'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <PlusSquare className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '2. اختر "إضافة صفحة إلى" (Add page to) ثم "الشاشة الرئيسية" (Home screen).'
                      : '2. Select "Add page to" then "Home screen".'}
                  </span>
                </div>
              </div>
            )}

            {/* Mac Safari Guide */}
            {browserType === 'mac_safari' && (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <div className="p-2 rounded-lg bg-[#C88A14]/10 border border-[#C88A14]/20 text-[#9E650C] font-semibold flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span>{lang === 'ar' ? 'متصفح سفاري على أجهزة ماك (macOS)' : 'Safari on macOS'}</span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Share2 className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? 'من شريط القوائم العلوي: اختر "ملف" (File) ثم "إضافة إلى شريط البرامج" (Add to Dock).'
                      : 'From menu bar: Select "File" then "Add to Dock".'}
                  </span>
                </div>
              </div>
            )}

            {/* Chrome, Edge, Brave, Firefox, and other Chromium browsers */}
            {browserType !== 'ios' && browserType !== 'samsung' && browserType !== 'mac_safari' && (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <div className="p-2 rounded-lg bg-[#C88A14]/10 border border-[#C88A14]/20 text-[#9E650C] font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#C88A14] shrink-0" />
                  <span>{lang === 'ar' ? 'متصفح كروم / إيدج / فايرفوكس (مختلف الأجهزة)' : 'Chrome, Edge, Firefox (All Devices)'}</span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Download className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '1. اضغط على أيقونة التثبيت ⊕ الظاهرة في شريط عنوان المتصفح (Address Bar).'
                      : '1. Click the install icon ⊕ in the browser address bar.'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <PlusSquare className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '2. أو افتح قائمة المتصفح (⋮) واختر "تثبيت التطبيق" (Install App) أو "إضافة إلى الشاشة الرئيسية".'
                      : '2. Or open browser menu (⋮) and click "Install app" or "Add to Home Screen".'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#2D2218] text-white text-xs font-bold hover:bg-[#3D2F22] cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'تم، فهمت الخطوات' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
