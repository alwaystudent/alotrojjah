import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const APP_OWNER_EMAIL = 'informastvces@gmail.com';

export function isAppOwnerUser(user: User | null | undefined): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === APP_OWNER_EMAIL;
}

export type TelemetryDeviceType = 'mobile' | 'tablet' | 'desktop';
export type TelemetryOSName = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Other';
export type TelemetryBrowserName = 'Chrome' | 'Safari' | 'Edge' | 'Firefox' | 'Samsung' | 'Other';
export type TelemetryInstallSource = 'standalone' | 'pwa_prompt' | 'web';

export interface DeviceTelemetryRecord {
  deviceId: string;
  installed: boolean;
  installSource: TelemetryInstallSource;
  deviceType: TelemetryDeviceType;
  osName: TelemetryOSName;
  browserName: TelemetryBrowserName;
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
  totalSessions: number;
  totalSessionSeconds: number;
  lastSessionSeconds: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const STORAGE_KEY_DEVICE_ID = 'alutrujjah_telemetry_device_id_v1';
const STORAGE_KEY_DOC_CREATED = 'alutrujjah_telemetry_doc_created_v1';
const STORAGE_KEY_GEO_CACHE = 'alutrujjah_telemetry_geo_cache_v1';
const STORAGE_KEY_PWA_INSTALLED = 'alutrujjah_pwa_installed_v1';
const STORAGE_KEY_PWA_INSTALL_SOURCE = 'alutrujjah_pwa_install_source_v1';
const SESSION_KEY_COUNTED = 'alutrujjah_telemetry_session_counted_v1';

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Asia/Riyadh': 'SA',
  'Africa/Cairo': 'EG',
  'Asia/Dubai': 'AE',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Damascus': 'SY',
  'Asia/Baghdad': 'IQ',
  'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS',
  'Asia/Jerusalem': 'PS',
  'Asia/Aden': 'YE',
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Khartoum': 'SD',
  'Africa/Nouakchott': 'MR',
  'Africa/Djibouti': 'DJ',
  'Africa/Mogadishu': 'SO',
  'Indian/Comoro': 'KM',
  'Asia/Istanbul': 'TR',
  'Europe/Istanbul': 'TR',
  'Asia/Jakarta': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Singapore': 'SG',
  'Asia/Brunei': 'BN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Tehran': 'IR',
  'Asia/Kabul': 'AF',
  'Asia/Tashkent': 'UZ',
  'Asia/Almaty': 'KZ',
  'Asia/Baku': 'AZ',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Moscow': 'RU',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Sao_Paulo': 'BR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Africa/Lagos': 'NG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Nairobi': 'KE',
};

const COUNTRY_NAME_FALLBACK: Record<string, { ar: string; en: string }> = {
  SA: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
  EG: { ar: 'مصر', en: 'Egypt' },
  AE: { ar: 'الإمارات العربية المتحدة', en: 'United Arab Emirates' },
  KW: { ar: 'الكويت', en: 'Kuwait' },
  QA: { ar: 'قطر', en: 'Qatar' },
  BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'عُمان', en: 'Oman' },
  JO: { ar: 'الأردن', en: 'Jordan' },
  LB: { ar: 'لبنان', en: 'Lebanon' },
  SY: { ar: 'سوريا', en: 'Syria' },
  IQ: { ar: 'العراق', en: 'Iraq' },
  PS: { ar: 'فلسطين', en: 'Palestine' },
  YE: { ar: 'اليمن', en: 'Yemen' },
  MA: { ar: 'المغرب', en: 'Morocco' },
  DZ: { ar: 'الجزائر', en: 'Algeria' },
  TN: { ar: 'تونس', en: 'Tunisia' },
  LY: { ar: 'ليبيا', en: 'Libya' },
  SD: { ar: 'السودان', en: 'Sudan' },
  MR: { ar: 'موريتانيا', en: 'Mauritania' },
  TR: { ar: 'تركيا', en: 'Turkey' },
  ID: { ar: 'إندونيسيا', en: 'Indonesia' },
  MY: { ar: 'ماليزيا', en: 'Malaysia' },
  PK: { ar: 'باكستان', en: 'Pakistan' },
  BD: { ar: 'بنغلاديش', en: 'Bangladesh' },
  IN: { ar: 'الهند', en: 'India' },
  GB: { ar: 'المملكة المتحدة', en: 'United Kingdom' },
  FR: { ar: 'فرنسا', en: 'France' },
  DE: { ar: 'ألمانيا', en: 'Germany' },
  US: { ar: 'الولايات المتحدة', en: 'United States' },
  CA: { ar: 'كندا', en: 'Canada' },
  AU: { ar: 'أستراليا', en: 'Australia' },
  UN: { ar: 'غير محدد', en: 'Unknown' },
};

export function getCountryFlagEmoji(countryCode: string): string {
  const code = (countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'UN') return '🌍';
  const offset = 127397;
  return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
}

function resolveCountryNames(codeInput: string): {
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
} {
  const raw = (codeInput || '').trim().toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(raw) ? raw : 'UN';
  if (countryCode === 'UN') {
    return {
      countryCode: 'UN',
      countryNameAr: COUNTRY_NAME_FALLBACK.UN.ar,
      countryNameEn: COUNTRY_NAME_FALLBACK.UN.en,
    };
  }

  let nameAr = COUNTRY_NAME_FALLBACK[countryCode]?.ar || '';
  let nameEn = COUNTRY_NAME_FALLBACK[countryCode]?.en || '';

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      if (!nameAr) {
        const arDisplay = new Intl.DisplayNames(['ar'], { type: 'region' });
        nameAr = arDisplay.of(countryCode) || '';
      }
      if (!nameEn) {
        const enDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
        nameEn = enDisplay.of(countryCode) || '';
      }
    }
  } catch {
    // Ignore Intl.DisplayNames failure
  }

  return {
    countryCode,
    countryNameAr: (nameAr || countryCode).slice(0, 64),
    countryNameEn: (nameEn || countryCode).slice(0, 64),
  };
}

function getFallbackCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
  } catch {
    // ignore
  }
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      if (!l) continue;
      const parts = l.replace('_', '-').split('-');
      const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
      if (/^[A-Z]{2}$/.test(region) && region !== '001') {
        return region;
      }
    }
  } catch {
    // ignore
  }
  return 'UN';
}

async function detectCountry(): Promise<{
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
}> {
  try {
    const rawCache = localStorage.getItem(STORAGE_KEY_GEO_CACHE);
    if (rawCache) {
      const parsed = JSON.parse(rawCache) as {
        countryCode?: string;
        ts?: number;
      };
      if (
        parsed?.countryCode &&
        /^[A-Z]{2}$/.test(parsed.countryCode) &&
        parsed.countryCode !== 'UN' &&
        typeof parsed.ts === 'number' &&
        Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000
      ) {
        return resolveCountryNames(parsed.countryCode);
      }
    }
  } catch {
    // ignore
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.country.is/', {
      signal: controller.signal,
      cache: 'no-store',
    });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { country?: string };
      const code = (data?.country || '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) {
        try {
          localStorage.setItem(
            STORAGE_KEY_GEO_CACHE,
            JSON.stringify({ countryCode: code, ts: Date.now() })
          );
        } catch {
          // ignore
        }
        return resolveCountryNames(code);
      }
    }
  } catch {
    // Offline or blocked; fall back cleanly to timezone / locale
  }

  return resolveCountryNames(getFallbackCountryCode());
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (existing && /^[a-zA-Z0-9_\-]{8,64}$/.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(12);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const newId = `dev_${hex}`.slice(0, 64);
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, newId);
    return newId;
  } catch {
    return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`.slice(0, 64);
  }
}

export function detectDeviceHardware(): {
  deviceType: TelemetryDeviceType;
  osName: TelemetryOSName;
  browserName: TelemetryBrowserName;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { deviceType: 'desktop', osName: 'Other', browserName: 'Other' };
  }

  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  let osName: TelemetryOSName = 'Other';
  if (/android/i.test(ua)) {
    osName = 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) {
    osName = 'iOS';
  } else if (/windows/i.test(ua)) {
    osName = 'Windows';
  } else if (/mac os x|macintosh/i.test(ua)) {
    osName = 'macOS';
  } else if (/linux/i.test(ua)) {
    osName = 'Linux';
  }

  let browserName: TelemetryBrowserName = 'Other';
  if (/samsungbrowser/i.test(ua)) {
    browserName = 'Samsung';
  } else if (/edg/i.test(ua)) {
    browserName = 'Edge';
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = 'Firefox';
  } else if (/chrome|crios/i.test(ua) && !/edg|opr|opera/i.test(ua)) {
    browserName = 'Chrome';
  } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    browserName = 'Safari';
  }

  let deviceType: TelemetryDeviceType = 'desktop';
  const isIPad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
  const isAndroidTablet = /android/i.test(ua) && !/mobile/i.test(ua);
  const isOtherTablet = /tablet|playbook|silk/i.test(uaLower);

  if (isIPad || isAndroidTablet || isOtherTablet) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(uaLower)) {
    deviceType = 'mobile';
  } else if (osName === 'Android' || osName === 'iOS') {
    deviceType = Math.min(window.screen?.width || 800, window.screen?.height || 800) >= 600 ? 'tablet' : 'mobile';
  }

  return { deviceType, osName, browserName };
}

export function detectInstallationState(): {
  installed: boolean;
  installSource: TelemetryInstallSource;
} {
  if (typeof window === 'undefined') {
    return { installed: false, installSource: 'web' };
  }
  const nav = window.navigator as unknown as { standalone?: boolean };
  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    nav.standalone === true ||
    document.referrer.startsWith('android-app://');

  if (isStandaloneDisplay) {
    try {
      localStorage.setItem(STORAGE_KEY_PWA_INSTALLED, 'true');
      localStorage.setItem(STORAGE_KEY_PWA_INSTALL_SOURCE, 'standalone');
    } catch {
      // ignore
    }
    return { installed: true, installSource: 'standalone' };
  }

  try {
    if (localStorage.getItem(STORAGE_KEY_PWA_INSTALLED) === 'true') {
      const savedSrc = localStorage.getItem(STORAGE_KEY_PWA_INSTALL_SOURCE);
      const src: TelemetryInstallSource =
        savedSrc === 'standalone' || savedSrc === 'pwa_prompt' ? savedSrc : 'pwa_prompt';
      return { installed: true, installSource: src };
    }
  } catch {
    // ignore
  }

  return { installed: false, installSource: 'web' };
}

export function markTelemetryInstalled(source: TelemetryInstallSource = 'pwa_prompt'): void {
  try {
    localStorage.setItem(STORAGE_KEY_PWA_INSTALLED, 'true');
    localStorage.setItem(STORAGE_KEY_PWA_INSTALL_SOURCE, source);
  } catch {
    // ignore
  }
}

export function startDeviceTelemetryTracker(): () => void {
  if (typeof window === 'undefined') return () => {};

  const deviceId = getOrCreateDeviceId();
  const hardware = detectDeviceHardware();

  let stopped = false;
  let flushInFlight = false;
  let activeSinceMs: number | null = document.visibilityState === 'visible' ? Date.now() : null;
  let accumulatedSessionMs = 0;
  let pendingSyncSeconds = 0;
  let sessionCountedInThisTab = false;
  let cachedGeo: { countryCode: string; countryNameAr: string; countryNameEn: string } | null = null;

  try {
    sessionCountedInThisTab = sessionStorage.getItem(SESSION_KEY_COUNTED) === '1';
  } catch {
    sessionCountedInThisTab = false;
  }

  const collectElapsedNow = () => {
    if (activeSinceMs !== null) {
      const now = Date.now();
      const deltaMs = Math.max(0, now - activeSinceMs);
      activeSinceMs = now;
      accumulatedSessionMs += deltaMs;
      const wholeSeconds = Math.floor(accumulatedSessionMs / 1000);
      if (wholeSeconds > 0) {
        accumulatedSessionMs -= wholeSeconds * 1000;
        pendingSyncSeconds += wholeSeconds;
      }
    }
  };

  let totalCurrentSessionSeconds = 0;

  const flushToFirestore = async (forceCreateCheck = false) => {
    if (stopped || flushInFlight) return;
    flushInFlight = true;
    try {
      collectElapsedNow();
      const deltaSeconds = Math.min(86400, Math.max(0, pendingSyncSeconds));
      const { installed, installSource } = detectInstallationState();
      if (!cachedGeo) {
        cachedGeo = await detectCountry();
      }
      if (stopped) return;

      const docRef = doc(db, 'deviceTelemetry', deviceId);
      let isDocCreated = false;
      try {
        isDocCreated = localStorage.getItem(STORAGE_KEY_DOC_CREATED) === 'true';
      } catch {
        isDocCreated = false;
      }

      const needSessionIncrement = !sessionCountedInThisTab;
      totalCurrentSessionSeconds = Math.min(86400, totalCurrentSessionSeconds + deltaSeconds);

      if (!isDocCreated || forceCreateCheck) {
        try {
          await setDoc(docRef, {
            deviceId,
            installed,
            installSource,
            deviceType: hardware.deviceType,
            osName: hardware.osName,
            browserName: hardware.browserName,
            countryCode: cachedGeo.countryCode,
            countryNameAr: cachedGeo.countryNameAr,
            countryNameEn: cachedGeo.countryNameEn,
            totalSessions: 1,
            totalSessionSeconds: totalCurrentSessionSeconds,
            lastSessionSeconds: totalCurrentSessionSeconds,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          pendingSyncSeconds = Math.max(0, pendingSyncSeconds - deltaSeconds);
          sessionCountedInThisTab = true;
          try {
            localStorage.setItem(STORAGE_KEY_DOC_CREATED, 'true');
            sessionStorage.setItem(SESSION_KEY_COUNTED, '1');
          } catch {
            // ignore
          }
          return;
        } catch (createErr: unknown) {
          const createMsg =
            createErr instanceof Error
              ? createErr.message.toLowerCase()
              : String(createErr).toLowerCase();
          if (createMsg.includes('permission') || createMsg.includes('already-exists')) {
            try {
              localStorage.setItem(STORAGE_KEY_DOC_CREATED, 'true');
            } catch {
              // ignore
            }
          } else {
            return;
          }
        }
      }

      try {
        await updateDoc(docRef, {
          installed,
          installSource,
          deviceType: hardware.deviceType,
          osName: hardware.osName,
          browserName: hardware.browserName,
          countryCode: cachedGeo.countryCode,
          countryNameAr: cachedGeo.countryNameAr,
          countryNameEn: cachedGeo.countryNameEn,
          totalSessions: increment(needSessionIncrement ? 1 : 0),
          totalSessionSeconds: increment(deltaSeconds),
          lastSessionSeconds: totalCurrentSessionSeconds,
          updatedAt: serverTimestamp(),
        });
        pendingSyncSeconds = Math.max(0, pendingSyncSeconds - deltaSeconds);
        if (needSessionIncrement) {
          sessionCountedInThisTab = true;
          try {
            sessionStorage.setItem(SESSION_KEY_COUNTED, '1');
          } catch {
            // ignore
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('not-found') || msg.includes('no document to update')) {
          try {
            localStorage.removeItem(STORAGE_KEY_DOC_CREATED);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Telemetry failures must stay non-fatal
    } finally {
      flushInFlight = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      collectElapsedNow();
      activeSinceMs = null;
      void flushToFirestore();
    } else if (document.visibilityState === 'visible') {
      if (activeSinceMs === null) {
        activeSinceMs = Date.now();
      }
    }
  };

  const handlePageHide = () => {
    collectElapsedNow();
    activeSinceMs = null;
    void flushToFirestore();
  };

  const handleAppInstalled = () => {
    markTelemetryInstalled('pwa_prompt');
    void flushToFirestore();
  };

  // Initial registration slightly after boot so app render stays unblocked
  const initTimer = window.setTimeout(() => {
    void flushToFirestore();
  }, 1800);

  // Periodic foreground session duration heartbeat every 45s
  const heartbeatInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void flushToFirestore();
    }
  }, 45000);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('alutrujjah:pwa-installed', handleAppInstalled);

  return () => {
    stopped = true;
    window.clearTimeout(initTimer);
    window.clearInterval(heartbeatInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('appinstalled', handleAppInstalled);
    window.removeEventListener('alutrujjah:pwa-installed', handleAppInstalled);
  };
}

export function subscribeOwnerDeviceTelemetry(
  onData: (records: DeviceTelemetryRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const telemetryQuery = query(
    collection(db, 'deviceTelemetry'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    telemetryQuery,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as DeviceTelemetryRecord);
      onData(items);
    },
    (error) => {
      if (onError) {
        onError(error);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, 'deviceTelemetry');
    }
  );
}

export async function deleteOwnerTelemetryRecord(deviceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'deviceTelemetry', deviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `deviceTelemetry/${deviceId}`);
  }
}
