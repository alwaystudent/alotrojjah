import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';
import { Language } from '@/src/data/quranData';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'settings' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  // If already installed and running standalone, show an indicator in settings or hide in header
  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#4A6144]/15 border border-[#88B87E]/30 text-xs text-[#261C14]">
          <Check className="w-4 h-4 text-[#4A6144] shrink-0" />
          <span className="font-semibold">
            {lang === 'ar' ? 'التطبيق مثبت ويعمل كنسخة أصلية' : 'App is installed as PWA'}
          </span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3000);
      }
    } else {
      // Show instructional modal (for iOS or browsers without native prompt)
      setShowGuideModal(true);
    }
  };

  const buttonClasses =
    variant === 'header'
      ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#C88A14]/15 hover:bg-[#C88A14]/25 text-[#9E650C] border border-[#C88A14]/30 shadow-2xs'
      : variant === 'settings'
      ? 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer mustard-gradient-btn text-white shadow-2xs'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#2D2218] text-[#FFFDF9] hover:bg-[#3D2F22]';

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={buttonClasses}
        title={lang === 'ar' ? 'تثبيت التطبيق على الجهاز' : 'Install App'}
      >
        {installSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'ar' ? 'تم التثبيت' : 'Installed'}</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>
              {variant === 'settings'
                ? lang === 'ar'
                  ? 'تثبيت تطبيق الأترجة على جهازك'
                  : 'Install Al-Utrujjah App'
                : lang === 'ar'
                ? 'تثبيت التطبيق'
                : 'Install App'}
            </span>
          </>
        )}
      </button>

      {/* Guide Modal for iOS Safari / Unsupported prompt browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-5 shadow-2xl text-[#261C14] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#DDD2BE] pb-2.5">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#C88A14]" />
                <h3 className="font-bold text-sm sm:text-base text-[#2D2218]">
                  {lang === 'ar' ? 'تثبيت التطبيق على جهازك' : 'Install App on Your Device'}
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

            {isIOS ? (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <p className="font-semibold text-[#2D2218]">
                  {lang === 'ar'
                    ? 'لتثبيت التطبيق على أجهزة آيفون أو آيباد (Safari):'
                    : 'To install on iPhone or iPad (Safari):'}
                </p>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Share2 className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '1. اضغط على زر "مشاركة" (Share) في شريط المتصفح السفلي.'
                      : '1. Tap the Share button in the Safari toolbar.'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <PlusSquare className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '2. مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                      : '2. Scroll down and tap "Add to Home Screen".'}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Check className="w-4 h-4 text-[#4A6144] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? '3. اضغط على "إضافة" (Add) في الزاوية العلوية.'
                      : '3. Tap "Add" in the top corner.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-[#5C4B3B] leading-relaxed">
                <p className="font-semibold text-[#2D2218]">
                  {lang === 'ar'
                    ? 'لتثبيت التطبيق على أجهزة أندرويد والكمبيوتر (Chrome/Edge):'
                    : 'To install on Android or Desktop (Chrome/Edge):'}
                </p>
                <div className="flex items-start gap-2.5 bg-[#F7F3EB] p-2.5 rounded-xl border border-[#DDD2BE]">
                  <Download className="w-4 h-4 text-[#C88A14] shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ar'
                      ? 'اضغط على رمز التثبيت ⊕ في شريط عنوان المتصفح، أو من قائمة المتصفح (⋮) اختر "تثبيت التطبيق" أو "Install App".'
                      : 'Click the install icon ⊕ in your address bar, or choose "Install App" from browser menu (⋮).'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 rounded-xl bg-[#2D2218] text-white text-xs font-bold hover:bg-[#3D2F22] cursor-pointer"
            >
              {lang === 'ar' ? 'فهمت ذلك' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
