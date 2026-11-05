import React, { useState } from 'react';
import { Smartphone, Download, X, Check, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../data/quranData';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'settings' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang, variant = 'header' }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running inside standalone app, do not show install CTA
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const label =
    lang === 'ar'
      ? isAndroid
        ? 'تثبيت على أندرويد'
        : 'تثبيت التطبيق'
      : isAndroid
      ? 'Install on Android'
      : 'Install App';

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-[#2D2218] via-[#453423] to-[#2D2218] hover:from-[#3D2E20] hover:to-[#3D2E20] border border-[#C88A14]/70 hover:border-[#EAB338] text-xs font-bold text-[#EAB338] hover:text-[#FFFDF9] shadow-xs cursor-pointer transition-all shrink-0"
          title={label}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#EAB338] shrink-0 animate-pulse" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{lang === 'ar' ? 'تثبيت' : 'App'}</span>
        </button>
      )}

      {variant === 'settings' && (
        <div className="p-3 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2D2218] border border-[#C88A14] flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-[#EAB338]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#2D2218]">
                {lang === 'ar' ? 'تثبيت الأترجة كتطبيق أندرويد' : 'Install Al-Utrujjah as an App'}
              </span>
              <span className="text-[11px] text-[#84715E]">
                {lang === 'ar'
                  ? 'يعمل بكامل الشاشة وبدون إنترنت كتطبيق أصلي على شاشة الهاتف'
                  : 'Works full-screen & offline directly from your home screen'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="mustard-gradient-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#FFFDF9] flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        </div>
      )}

      {/* Guided Installation Modal for Android / iOS when beforeinstallprompt is not auto-triggered */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-sm rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/70 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-4 py-3 earthy-gradient-banner text-[#FFFDF9] flex items-center justify-between border-b border-[#C88A14]/40">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#EAB338]" />
                <h3 className="text-sm font-bold font-display-islamic">
                  {lang === 'ar' ? 'تثبيت تطبيق الأترجة' : 'Install Al-Utrujjah'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs text-[#2D2218]">
              {/* App Identity Banner */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
                <img
                  src="/pwa-192x192.png"
                  alt="الأترجة"
                  className="w-12 h-12 rounded-xl shadow-xs border border-[#C88A14]"
                />
                <div className="flex flex-col">
                  <span className="font-bold font-display-islamic text-sm text-[#2D2218]">
                    {lang === 'ar' ? 'الأترجة — خطة القرآن' : 'Al-Utrujjah Quran'}
                  </span>
                  <span className="text-[11px] text-[#84715E]">
                    {lang === 'ar'
                      ? 'تطبيق خفيف وسريع يعمل دون إنترنت'
                      : 'Fast offline-ready Quran recitation app'}
                  </span>
                </div>
              </div>

              {/* Step by Step Instructions */}
              {isIOS ? (
                <div className="space-y-2">
                  <p className="font-bold text-[#5C4B3B]">
                    {lang === 'ar' ? 'خطوات التثبيت على آيفون / آيباد:' : 'Steps for iPhone / iPad:'}
                  </p>
                  <ol className="space-y-2 list-decimal list-inside text-[11px] text-[#5C4B3B] bg-[#FFFDF7] p-3 rounded-xl border border-[#E5DEC9]">
                    <li className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-[#C88A14] shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? 'اضغط على زر المشاركة (Share) في أسفل متصفح Safari.'
                          : 'Tap the Share icon in Safari toolbar.'}
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <PlusSquare className="w-3.5 h-3.5 text-[#C88A14] shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? 'اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                          : 'Select "Add to Home Screen".'}
                      </span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#4A6144] shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? 'اضغط "إضافة" (Add) في الزاوية العلوية.'
                          : 'Tap "Add" in the top-right corner.'}
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-bold text-[#5C4B3B]">
                    {lang === 'ar'
                      ? 'خطوات التثبيت على أجهزة أندرويد (Chrome / Samsung):'
                      : 'Steps for Android (Chrome / Samsung):'}
                  </p>
                  <ol className="space-y-2 text-[11px] text-[#5C4B3B] bg-[#FFFDF7] p-3 rounded-xl border border-[#E5DEC9]">
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[#C88A14]">١.</span>
                      <span>
                        {lang === 'ar'
                          ? 'اضغط على قائمة المتصفح (النقاط الثلاث ⋮ في أعلى المتصفح).'
                          : 'Tap browser menu (the three dots ⋮ at top right).'}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[#C88A14]">٢.</span>
                      <span>
                        {lang === 'ar'
                          ? 'اختر "تثبيت التطبيق" (Install App) أو "إضافة إلى الشاشة الرئيسية".'
                          : 'Select "Install app" or "Add to Home screen".'}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-[#4A6144]">٣.</span>
                      <span>
                        {lang === 'ar'
                          ? 'ستظهر أيقونة التطبيق على شاشة هاتفك الرئيسية ويعمل كتطبيق مستقل.'
                          : 'The app icon will be installed on your Home screen.'}
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    setShowGuideModal(false);
                  }}
                  className="w-full mustard-gradient-btn py-2.5 rounded-xl text-xs font-bold text-[#FFFDF9] flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2 rounded-xl bg-[#EFE9DC] hover:bg-[#DDD2BE] text-xs font-bold text-[#2D2218] cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'فهمت ذلك' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
