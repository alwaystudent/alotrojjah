import { QuranRiwayah } from '../data/quranData';

/**
 * Trusted Quran Verses Fetcher supporting Riwayat:
 * - Hafs 'an Asim (KFGQPC Uthmani Hafs via api.quran.com / Madinah / jsDelivr)
 * - Qalun 'an Nafi' (ara-quranqaloon)
 * - Warsh 'an Nafi' (ara-quranwarsh)
 */

export type TrustedQuranSourceId = 'kfgqpc_hafs' | 'madinah_uthmani';

export interface TrustedVerseItem {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  text: string;
  textCleanUthmani: string;
  pageNumber?: number;
  juzNumber?: number;
  sourceId: TrustedQuranSourceId;
  riwayah: QuranRiwayah;
}

export const TRUSTED_QURAN_SOURCES: {
  id: TrustedQuranSourceId;
  labelAr: string;
  labelEn: string;
  url: string;
  partnerUrl: string;
  partnerLabelAr: string;
}[] = [
  {
    id: 'kfgqpc_hafs',
    labelAr: 'مجمع الملك فهد لطباعة المصحف الشريف (الخط العثماني)',
    labelEn: 'King Fahd Complex (KFGQPC Uthmani)',
    url: 'https://qurancomplex.gov.sa',
    partnerUrl: 'https://quran.ksu.edu.sa/ayat/',
    partnerLabelAr: 'مشروع آية — مصحف المدينة',
  },
  {
    id: 'madinah_uthmani',
    labelAr: 'مصحف المدينة / موقع آية (النص العثماني الموثّق)',
    labelEn: 'Madinah Mushaf / Ayat Standard Uthmani',
    url: 'https://quran.ksu.edu.sa/ayat/',
    partnerUrl: 'https://qurancomplex.gov.sa',
    partnerLabelAr: 'مجمع الملك فهد للمصحف',
  },
];

const RIWAYAH_CDN_SLUGS: Record<QuranRiwayah, string> = {
  hafs: 'ara-quranuthmanihaf',
  qalun: 'ara-quranqaloon',
  warsh: 'ara-quranwarsh',
};

function sanitizeQuranText(raw: string): string {
  return (raw || '').replace(/\u200F/g, '').trim();
}

export async function fetchTrustedSurahVerses(
  surahNumber: number,
  ayahFrom: number,
  ayahTo: number,
  preferredSource: TrustedQuranSourceId = 'kfgqpc_hafs',
  riwayah: QuranRiwayah = 'hafs'
): Promise<{ verses: TrustedVerseItem[]; usedSource: TrustedQuranSourceId }> {
  // For Qalun and Warsh, fetch from verified KFGQPC/fawazahmed0 Riwayat CDN
  if (riwayah === 'qalun' || riwayah === 'warsh') {
    const slug = RIWAYAH_CDN_SLUGS[riwayah];
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${slug}/${surahNumber}.min.json`
    );
    if (!res.ok) throw new Error(`Riwayah ${riwayah} endpoint unavailable`);
    const json = await res.json();
    const list: Array<{ chapter: number; verse: number; text: string }> = json?.chapter || [];
    const verses = list
      .map((item) => {
        const clean = sanitizeQuranText(item.text);
        const ayahNum = Number(item.verse);
        return {
          verseKey: `${surahNumber}:${ayahNum}`,
          surahNumber,
          ayahNumber: ayahNum,
          text: clean,
          textCleanUthmani: clean,
          sourceId: 'kfgqpc_hafs' as const,
          riwayah,
        };
      })
      .filter((v) => v.ayahNumber >= ayahFrom && v.ayahNumber <= ayahTo);
    return { verses, usedSource: 'kfgqpc_hafs' };
  }

  const fetchKfgqpcHafs = async (): Promise<TrustedVerseItem[]> => {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}?language=ar&words=false&fields=text_uthmani,text_qpc_hafs,page_number&per_page=300`
    );
    if (!res.ok) throw new Error('KFGQPC endpoint unavailable');
    const json = await res.json();
    const list: Array<{
      verse_key: string;
      verse_number?: number;
      text_uthmani?: string;
      text_qpc_hafs?: string;
      page_number?: number;
    }> = json?.verses || [];

    return list
      .map((v) => {
        const ayahNumber = Number(
          v.verse_number || parseInt((v.verse_key || '0:0').split(':')[1] || '0', 10)
        );
        const rawUthmani = sanitizeQuranText(v.text_uthmani || v.text_qpc_hafs || '');
        const preferredText = sanitizeQuranText(v.text_qpc_hafs || rawUthmani);
        return {
          verseKey: v.verse_key || `${surahNumber}:${ayahNumber}`,
          surahNumber,
          ayahNumber,
          text: preferredText,
          textCleanUthmani: rawUthmani,
          pageNumber: v.page_number,
          sourceId: 'kfgqpc_hafs' as const,
          riwayah: 'hafs' as const,
        };
      })
      .filter((v) => v.ayahNumber >= ayahFrom && v.ayahNumber <= ayahTo);
  };

  const fetchMadinahStandardHafs = async (): Promise<TrustedVerseItem[]> => {
    const res = await fetch(
      `https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`
    );
    if (!res.ok) throw new Error('Madinah Uthmani endpoint unavailable');
    const json = await res.json();
    const ayahs: Array<{
      numberInSurah: number;
      text: string;
      page?: number;
    }> = json?.data?.ayahs || [];

    return ayahs
      .map((a) => {
        const clean = sanitizeQuranText(a.text);
        return {
          verseKey: `${surahNumber}:${a.numberInSurah}`,
          surahNumber,
          ayahNumber: Number(a.numberInSurah),
          text: clean,
          textCleanUthmani: clean,
          pageNumber: a.page,
          sourceId: 'madinah_uthmani' as const,
          riwayah: 'hafs' as const,
        };
      })
      .filter((v) => v.ayahNumber >= ayahFrom && v.ayahNumber <= ayahTo);
  };

  if (preferredSource === 'kfgqpc_hafs') {
    try {
      const verses = await fetchKfgqpcHafs();
      if (verses.length > 0) return { verses, usedSource: 'kfgqpc_hafs' };
    } catch {
      // fallback below
    }
    const verses = await fetchMadinahStandardHafs();
    return { verses, usedSource: 'madinah_uthmani' };
  } else {
    try {
      const verses = await fetchMadinahStandardHafs();
      if (verses.length > 0) return { verses, usedSource: 'madinah_uthmani' };
    } catch {
      // fallback below
    }
    const verses = await fetchKfgqpcHafs();
    return { verses, usedSource: 'kfgqpc_hafs' };
  }
}

export async function fetchMushafPageByRiwayah(
  pageNumber: number,
  riwayah: QuranRiwayah = 'hafs'
): Promise<{ surahNumber: number; ayahNumber: number; textUthmani: string; juz?: number }[]> {
  const safePage = Math.max(1, Math.min(604, pageNumber));

  if (riwayah === 'qalun' || riwayah === 'warsh') {
    const slug = RIWAYAH_CDN_SLUGS[riwayah];
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${slug}/pages/${safePage}.min.json`
    );
    if (!res.ok) throw new Error(`Riwayah ${riwayah} page ${safePage} unavailable`);
    const json = await res.json();
    const list: Array<{ chapter: number; verse: number; text: string }> = json?.pages || [];
    if (list.length > 0) {
      return list.map((item) => ({
        surahNumber: Number(item.chapter),
        ayahNumber: Number(item.verse),
        textUthmani: sanitizeQuranText(item.text),
      }));
    }
  }

  // Hafs primary: api.quran.com v4
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_page/${safePage}?words=false&fields=text_uthmani,chapter_id,verse_number,juz_number&per_page=50`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.verses) && data.verses.length > 0) {
        return data.verses.map((v: any) => ({
          surahNumber: Number(v.chapter_id || String(v.verse_key).split(':')[0]),
          ayahNumber: Number(v.verse_number || String(v.verse_key).split(':')[1]),
          textUthmani: sanitizeQuranText(v.text_uthmani || ''),
          juz: Number(v.juz_number || 1),
        }));
      }
    }
  } catch {
    // Fallback below
  }

  // Hafs secondary: alquran.cloud
  try {
    const res2 = await fetch(`https://api.alquran.cloud/v1/page/${safePage}/quran-uthmani`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2?.data?.ayahs?.length > 0) {
        return data2.data.ayahs.map((a: any) => ({
          surahNumber: Number(a.surah.number),
          ayahNumber: Number(a.numberInSurah),
          textUthmani: sanitizeQuranText(a.text || ''),
          juz: Number(a.juz || 1),
        }));
      }
    }
  } catch {
    // Fallback to jsDelivr Hafs
  }

  const res3 = await fetch(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/${RIWAYAH_CDN_SLUGS.hafs}/pages/${safePage}.min.json`
  );
  if (!res3.ok) throw new Error('Unable to fetch Mushaf page');
  const data3 = await res3.json();
  const list3: Array<{ chapter: number; verse: number; text: string }> = data3?.pages || [];
  return list3.map((item) => ({
    surahNumber: Number(item.chapter),
    ayahNumber: Number(item.verse),
    textUthmani: sanitizeQuranText(item.text),
  }));
}

export async function fetchTrustedPageRangeVerses(
  pageFrom: number,
  pageTo: number,
  riwayah: QuranRiwayah = 'hafs'
): Promise<TrustedVerseItem[]> {
  const start = Math.max(1, Math.min(pageFrom, pageTo));
  // Cap single fetch batch to max 10 pages so session loads quickly and stays responsive
  const end = Math.min(604, Math.max(pageFrom, pageTo), start + 9);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const results = await Promise.all(
    pages.map(async (p) => {
      const raw = await fetchMushafPageByRiwayah(p, riwayah);
      return raw.map((item) => ({
        verseKey: `${item.surahNumber}:${item.ayahNumber}`,
        surahNumber: item.surahNumber,
        ayahNumber: item.ayahNumber,
        text: item.textUthmani,
        textCleanUthmani: item.textUthmani,
        pageNumber: p,
        juzNumber: item.juz,
        sourceId: 'kfgqpc_hafs' as const,
        riwayah,
      }));
    })
  );

  return results.flat();
}

export async function fetchTrustedCurriculumVerses(params: {
  curriculumMode: 'surah' | 'ayah' | 'page';
  surahNumber: number;
  surahEnd?: number;
  ayahFrom: number;
  ayahTo: number;
  pageFrom?: number;
  pageTo?: number;
  riwayah: QuranRiwayah;
  preferredSource?: TrustedQuranSourceId;
}): Promise<{ verses: TrustedVerseItem[]; usedSource: TrustedQuranSourceId }> {
  const {
    curriculumMode,
    surahNumber,
    surahEnd,
    ayahFrom,
    ayahTo,
    pageFrom = 1,
    pageTo = 1,
    riwayah,
    preferredSource = 'kfgqpc_hafs',
  } = params;

  if (curriculumMode === 'page') {
    const verses = await fetchTrustedPageRangeVerses(pageFrom, pageTo, riwayah);
    return { verses, usedSource: 'kfgqpc_hafs' };
  }

  if (curriculumMode === 'surah') {
    const s1 = Math.max(1, Math.min(surahNumber, surahEnd || surahNumber));
    const s2 = Math.min(114, Math.max(surahNumber, surahEnd || surahNumber), s1 + 4);
    const surahNums: number[] = [];
    for (let s = s1; s <= s2; s++) surahNums.push(s);

    const batches = await Promise.all(
      surahNums.map((sNum) =>
        fetchTrustedSurahVerses(sNum, 1, 286, preferredSource, riwayah)
      )
    );
    return {
      verses: batches.flatMap((b) => b.verses),
      usedSource: batches[0]?.usedSource || preferredSource,
    };
  }

  return fetchTrustedSurahVerses(surahNumber, ayahFrom, ayahTo, preferredSource, riwayah);
}
