import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  X,
  Check,
  Share2,
  PlusSquare,
  Monitor,
  Globe,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { BrowserType, usePWAInstall } from '@/src/hooks/usePWAInstall';
import { Language } from '@/src/data/quranData';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'settings' | 'banner' | 'prominent';
}

const InstallGuideModal: React.FC<{
  lang: Language;
  browserType: BrowserType;
  onClose: () => void;
}> = ({ lang, browserType, onClose }) => (
  <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
    <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] border border-[#C5CEBF] p-4 sm:p-5 shadow-2xl text-[#161E19] space-y-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between border-b border-[#C5CEBF] pb-2.5">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#96701E]" />
          <h3 className="font-bold text-sm sm:text-base text-[#0E5C3E]">
            {lang === 'ar' ? 'تثبيت على الشاشة الرئيسية' : 'Add to Home Screen'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#F4F5EE] text-[#6A766E] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {browserType === 'ios' && (
        <div className="space-y-3 text-xs text-[#4B5650] leading-relaxed">
          <div className="p-2 rounded-lg bg-[#96701E]/10 border border-[#96701E]/20 text-[#8A6518] font-semibold flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-[#96701E] shrink-0" />
            <span>{lang === 'ar' ? 'سفاري (iPhone / iPad)' : 'Safari (iPhone / iPad)'}</span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <Share2 className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '1. اضغط أيقونة «المشاركة» في الشريط السفلي.'
                : '1. Tap the Share icon at the bottom.'}
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <PlusSquare className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '2. اختر «إضافة إلى الشاشة الرئيسية».'
                : '2. Select "Add to Home Screen".'}
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <Check className="w-4 h-4 text-[#0E6340] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '3. اضغط «إضافة» للتثبيت بتحديثات صامتة.'
                : '3. Tap "Add" for silent auto-updates.'}
            </span>
          </div>
        </div>
      )}

      {browserType === 'samsung' && (
        <div className="space-y-3 text-xs text-[#4B5650] leading-relaxed">
          <div className="p-2 rounded-lg bg-[#96701E]/10 border border-[#96701E]/20 text-[#8A6518] font-semibold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#96701E] shrink-0" />
            <span>{lang === 'ar' ? 'Samsung Internet' : 'Samsung Internet'}</span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <Download className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '1. اضغط زر القائمة (≡) أسفل الشاشة.'
                : '1. Tap the menu (≡) at the bottom.'}
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <PlusSquare className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '2. اختر «إضافة صفحة إلى» ثم «الشاشة الرئيسية».'
                : '2. Tap "Add page to" → "Home screen".'}
            </span>
          </div>
        </div>
      )}

      {browserType === 'mac_safari' && (
        <div className="space-y-3 text-xs text-[#4B5650] leading-relaxed">
          <div className="p-2 rounded-lg bg-[#96701E]/10 border border-[#96701E]/20 text-[#8A6518] font-semibold flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-[#96701E] shrink-0" />
            <span>{lang === 'ar' ? 'سفاري (macOS)' : 'Safari (macOS)'}</span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <Share2 className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? 'من شريط القوائم: «ملف» ثم «إضافة إلى شريط البرامج».'
                : 'Menu bar: File → Add to Dock.'}
            </span>
          </div>
        </div>
      )}

      {browserType !== 'ios' && browserType !== 'samsung' && browserType !== 'mac_safari' && (
        <div className="space-y-3 text-xs text-[#4B5650] leading-relaxed">
          <div className="p-2 rounded-lg bg-[#96701E]/10 border border-[#96701E]/20 text-[#8A6518] font-semibold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#96701E] shrink-0" />
            <span>{lang === 'ar' ? 'كروم / إيدج / فايرفوكس' : 'Chrome / Edge / Firefox'}</span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <Download className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '1. اضغط أيقونة التثبيت ⊕ أو قائمة المتصفح (⋮).'
                : '1. Click install ⊕ or browser menu (⋮).'}
            </span>
          </div>
          <div className="flex items-start gap-2.5 bg-[#F4F5EE] p-2.5 rounded-xl border border-[#C5CEBF]">
            <PlusSquare className="w-4 h-4 text-[#96701E] shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? '2. اختر «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية».'
                : '2. Choose "Install app" or "Add to Home Screen".'}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-[#0E5C3E] text-white text-xs font-bold hover:bg-[#0A4730] cursor-pointer transition-colors"
      >
        {lang === 'ar' ? 'حسناً' : 'Got it'}
      </button>
    </div>
  </div>
);

/**
 * Smart Single Space-Saving PWA Alert:
 * - Automatically detects if the app is already added to Home Screen / installed.
 * - Shows ONLY ONE compact floating prompt when NOT installed (zero static layout height used).
 * - Immediately disappears when installed or dismissed, and stays synced with silent SW updates.
 */
export const SmartPWAInstallAlert: React.FC<{ lang: Language }> = ({ lang }) => {
  const {
    isInstallable,
    isInstalled,
    shouldShowSingleAlert,
    dismissSingleAlert,
    browserType,
    install,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled || !shouldShowSingleAlert) {
    return showGuideModal ? (
      <InstallGuideModal
        lang={lang}
        browserType={browserType}
        onClose={() => setShowGuideModal(false)}
      />
    ) : null;
  }

  const handleAction = async () => {
    const result = await install();
    if (result === 'accepted') {
      dismissSingleAlert();
    } else if (result === 'unavailable') {
      setShowGuideModal(true);
      dismissSingleAlert();
    }
  };

  const isAr = lang === 'ar';

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-[68px] inset-x-3 sm:inset-x-auto sm:end-5 sm:max-w-sm z-40 rounded-2xl bg-[#0E5C3E]/95 backdrop-blur-md text-[#FFFFFF] border border-[#96701E]/60 shadow-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#96701E]/20 border border-[#E6C25A]/40 text-[#E6C25A] flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[#FFFFFF] truncate">
              {isAr ? 'أضف «الأترجة» للشاشة الرئيسية' : 'Add Al-Utrujjah to Home Screen'}
            </p>
            <p className="text-[10.5px] text-[#E6D7BE] flex items-center gap-1 truncate">
              <RefreshCw className="w-2.5 h-2.5 text-[#86EFAC] shrink-0" />
              <span>
                {isInstallable
                  ? isAr
                    ? 'تثبيت مباشر بضغطة واحدة · تحديثات صامتة'
                    : 'One-tap direct install · Silent auto-updates'
                  : isAr
                  ? 'حفظ مساحة · تحديثات صامتة'
                  : 'Saves space · Silent auto-updates'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="mustard-gradient-btn text-[#FFFFFF] px-3 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer whitespace-nowrap shadow-2xs"
          >
            {isAr ? 'تثبيت' : 'Install'}
          </button>
          <button
            type="button"
            onClick={dismissSingleAlert}
            aria-label={isAr ? 'إغلاق التنبيه' : 'Dismiss alert'}
            className="p-1.5 rounded-lg text-[#E6D7BE] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showGuideModal && (
        <InstallGuideModal
          lang={lang}
          browserType={browserType}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </>
  );
};

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'header',
}) => {
  const { isInstalled, browserType, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  const handleInstallClick = async () => {
    const result = await install();
    if (result === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 3000);
    } else if (result === 'unavailable') {
      setShowGuideModal(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  const buttonClasses =
    variant === 'header'
      ? 'mustard-gradient-btn text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border border-[#E6C25A]/40'
      : variant === 'prominent'
      ? 'mustard-gradient-btn text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#E6C25A]/50'
      : variant === 'settings'
      ? 'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer mustard-gradient-btn text-white shadow-2xs'
      : 'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#0E5C3E] text-[#FFFFFF] hover:bg-[#0A4730]';

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

      {showGuideModal && (
        <InstallGuideModal
          lang={lang}
          browserType={browserType}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </>
  );
};
