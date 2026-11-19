import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Heart,
  Search,
  RotateCcw,
  CheckCircle2,
  Check,
  Sun,
  Moon,
  Sparkles,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Type,
  Trash2,
  Edit3,
  ScrollText,
  BookMarked,
  Link2,
  ExternalLink,
  Eye,
  FileText,
} from 'lucide-react';
import { Language } from '@/src/data/quranData';
import {
  MutunCategory,
  AdhkarCategory,
  MatnItem,
  MatnChapter,
  DhikrItem,
  MUTUN_CATEGORIES,
  ADHKAR_CATEGORIES,
  INITIAL_MUTUN_LIST,
  INITIAL_ADHKAR_LIST,
  getMutunCategoryLabel,
  getAdhkarCategoryLabel,
} from '@/src/data/mutunAndAdhkarData';

interface MutunAdhkarSectionProps {
  lang: Language;
}

type ReaderSurface = 'ivory' | 'sepia' | 'night';

const STORAGE_MUTUN_LIBRARY = 'alutrujjah_mutun_library_v2';
const STORAGE_CUSTOM_MUTUN_LEGACY = 'alutrujjah_custom_mutun_v1';
const STORAGE_CUSTOM_ADHKAR = 'alutrujjah_custom_adhkar_v1';
const STORAGE_ADHKAR_COUNTS = 'alutrujjah_adhkar_counts_v1';
const STORAGE_MUTUN_DONE = 'alutrujjah_mutun_done_v1';
const STORAGE_READER_PREFS = 'alutrujjah_reader_prefs_v1';

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function serializeChaptersToText(chapters: MatnChapter[]): string {
  if (!chapters || chapters.length === 0) return '';
  return chapters
    .map((ch) => {
      const header = `=== ${ch.titleAr} ===`;
      const lines = ch.items
        .map((it) => (it.secondHalf ? `${it.firstHalf} | ${it.secondHalf}` : it.firstHalf))
        .join('\n');
      return `${header}\n${lines}`;
    })
    .join('\n\n');
}

function parseTextToChapters(rawText: string, defaultChapterTitle: string): MatnChapter[] {
  const blocks = rawText
    .split(/\n(?====\s*.+?\s*===)/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) return [];

  const chapters: MatnChapter[] = [];
  blocks.forEach((block, chIdx) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let title = defaultChapterTitle;
    let contentLines = lines;

    const match = lines[0]?.match(/^===\s*(.+?)\s*===$/);
    if (match) {
      title = match[1].trim() || defaultChapterTitle;
      contentLines = lines.slice(1);
    }

    const items = contentLines.map((line, idx) => {
      const parts = line
        .split(/[*|—–\/]{1,3}| {3,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return {
          id: `item-${Date.now()}-${chIdx}-${idx}`,
          firstHalf: parts[0],
          secondHalf: parts.slice(1).join(' '),
        };
      }
      return {
        id: `item-${Date.now()}-${chIdx}-${idx}`,
        firstHalf: line,
      };
    });

    if (items.length > 0 || match) {
      chapters.push({
        id: `ch-${Date.now()}-${chIdx}`,
        titleAr: title,
        titleEn: title,
        items,
      });
    }
  });

  return chapters;
}

export const MutunAdhkarSection: React.FC<MutunAdhkarSectionProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'mutun' | 'adhkar'>('mutun');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Comfortable reading preferences
  const [fontScale, setFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_READER_PREFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.fontScale === 'number') return parsed.fontScale;
      }
    } catch {
      // ignore
    }
    return 2;
  });

  const [readerSurface, setReaderSurface] = useState<ReaderSurface>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_READER_PREFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.readerSurface === 'ivory' ||
          parsed.readerSurface === 'sepia' ||
          parsed.readerSurface === 'night'
        ) {
          return parsed.readerSurface;
        }
      }
    } catch {
      // ignore
    }
    return 'sepia';
  });

  const [wideLineSpacing, setWideLineSpacing] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_READER_PREFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.wideLineSpacing === 'boolean') return parsed.wideLineSpacing;
      }
    } catch {
      // ignore
    }
    return true;
  });

  const [isFocusReader, setIsFocusReader] = useState<boolean>(false);
  const [externalEyeComfortFilter, setExternalEyeComfortFilter] = useState<boolean>(true);
  const [externalViewerOverride, setExternalViewerOverride] = useState<
    'direct' | 'pdf_viewer' | null
  >(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_READER_PREFS,
        JSON.stringify({ fontScale, readerSurface, wideLineSpacing })
      );
    } catch {
      // ignore
    }
  }, [fontScale, readerSurface, wideLineSpacing]);

  // Full Editable & Deletable Mutun + Books Library
  const [mutunList, setMutunList] = useState<MatnItem[]>(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_MUTUN_LIBRARY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed)) return parsed;
      }
      const legacyCustomRaw = localStorage.getItem(STORAGE_CUSTOM_MUTUN_LEGACY);
      if (legacyCustomRaw) {
        const legacy = JSON.parse(legacyCustomRaw);
        if (Array.isArray(legacy) && legacy.length > 0) {
          return [...legacy, ...INITIAL_MUTUN_LIST];
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_MUTUN_LIST;
  });

  const [customAdhkar, setCustomAdhkar] = useState<DhikrItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_ADHKAR);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MUTUN_LIBRARY, JSON.stringify(mutunList));
    } catch {
      // ignore
    }
  }, [mutunList]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_ADHKAR, JSON.stringify(customAdhkar));
    } catch {
      // ignore
    }
  }, [customAdhkar]);

  // Progress & Counters
  const [adhkarCounts, setAdhkarCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ADHKAR_COUNTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [completedMutunIds, setCompletedMutunIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MUTUN_DONE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ADHKAR_COUNTS, JSON.stringify(adhkarCounts));
    } catch {
      // ignore
    }
  }, [adhkarCounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MUTUN_DONE, JSON.stringify(completedMutunIds));
    } catch {
      // ignore
    }
  }, [completedMutunIds]);

  // Navigation & Confirm States
  const [selectedMutunCat, setSelectedMutunCat] = useState<'all' | MutunCategory>('all');
  const [activeMatnId, setActiveMatnId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>('all');
  const [confirmDeleteMatnId, setConfirmDeleteMatnId] = useState<string | null>(null);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] = useState<string | null>(null);
  const [confirmRestoreDefaults, setConfirmRestoreDefaults] = useState<boolean>(false);

  // Adhkar state
  const [selectedAdhkarCat, setSelectedAdhkarCat] = useState<'all' | AdhkarCategory>('morning');

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMatnId, setEditingMatnId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'matn' | 'book' | 'dhikr'>('matn');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newAuthorOrSource, setNewAuthorOrSource] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newCategoryMutun, setNewCategoryMutun] = useState<MutunCategory>('tajweed');
  const [newCategoryAdhkar, setNewCategoryAdhkar] = useState<AdhkarCategory>('morning');
  const [newExternalUrl, setNewExternalUrl] = useState<string>('');
  const [newExternalViewerMode, setNewExternalViewerMode] = useState<'direct' | 'pdf_viewer'>(
    'direct'
  );
  const [newContentText, setNewContentText] = useState<string>('');
  const [newTargetCount, setNewTargetCount] = useState<number>(3);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Inline Chapter Quick-Edit / Add Modal inside Matn Reader
  const [chapterModalOpen, setChapterModalOpen] = useState<boolean>(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterTitleInput, setChapterTitleInput] = useState<string>('');
  const [chapterNoteInput, setChapterNoteInput] = useState<string>('');
  const [chapterItemsInput, setChapterItemsInput] = useState<string>('');

  const allAdhkar = useMemo(() => [...customAdhkar, ...INITIAL_ADHKAR_LIST], [customAdhkar]);

  const filteredMutun = useMemo(() => {
    return mutunList.filter((m) => {
      if (selectedMutunCat !== 'all' && m.category !== selectedMutunCat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hitMeta =
          m.titleAr.toLowerCase().includes(q) ||
          m.titleEn.toLowerCase().includes(q) ||
          m.authorAr.toLowerCase().includes(q) ||
          m.descriptionAr.toLowerCase().includes(q) ||
          (m.externalUrl || '').toLowerCase().includes(q);
        const hitVerse = m.chapters.some(
          (c) =>
            c.titleAr.toLowerCase().includes(q) ||
            c.items.some(
              (v) =>
                v.firstHalf.toLowerCase().includes(q) ||
                (v.secondHalf || '').toLowerCase().includes(q)
            )
        );
        if (!hitMeta && !hitVerse) return false;
      }
      return true;
    });
  }, [mutunList, selectedMutunCat, searchQuery]);

  const filteredAdhkar = useMemo(() => {
    return allAdhkar.filter((d) => {
      if (selectedAdhkarCat !== 'all' && d.category !== selectedAdhkarCat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          d.titleAr.toLowerCase().includes(q) ||
          d.titleEn.toLowerCase().includes(q) ||
          d.textAr.toLowerCase().includes(q) ||
          (d.virtueAr || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allAdhkar, selectedAdhkarCat, searchQuery]);

  const activeMatn = useMemo(
    () => mutunList.find((m) => m.id === activeMatnId) || null,
    [mutunList, activeMatnId]
  );

  // Surface styling tokens for comfortable reading
  const surfaceStyles = useMemo(() => {
    if (readerSurface === 'night') {
      return {
        cardBg: 'bg-[#1F1914]',
        innerBg: 'bg-[#2A221B]',
        border: 'border-[#4A3B2D]',
        textPrimary: 'text-[#F5ECD9]',
        textSecondary: 'text-[#D6C7AF]',
        textMuted: 'text-[#A6947C]',
        accentText: 'text-[#EAB338]',
        badgeBg: 'bg-[#362B22] border-[#524030] text-[#EAB338]',
      };
    }
    if (readerSurface === 'sepia') {
      return {
        cardBg: 'bg-[#F5ECD9]',
        innerBg: 'bg-[#EFE3CA]',
        border: 'border-[#DCCCB0]',
        textPrimary: 'text-[#261C14]',
        textSecondary: 'text-[#4D3D2E]',
        textMuted: 'text-[#7A6754]',
        accentText: 'text-[#9E650C]',
        badgeBg: 'bg-[#E9D9B8] border-[#D5C199] text-[#8B5908]',
      };
    }
    return {
      cardBg: 'bg-[#FFFDF9]',
      innerBg: 'bg-[#F7F3EB]',
      border: 'border-[#DDD2BE]',
      textPrimary: 'text-[#261C14]',
      textSecondary: 'text-[#5C4B3B]',
      textMuted: 'text-[#84715E]',
      accentText: 'text-[#9E650C]',
      badgeBg: 'bg-[#F6E9C8] border-[#E5C983] text-[#9E650C]',
    };
  }, [readerSurface]);

  const fontClass = useMemo(() => {
    const leading = wideLineSpacing ? 'leading-[2.25]' : 'leading-[1.8]';
    switch (fontScale) {
      case 1:
        return `text-base sm:text-lg ${leading}`;
      case 2:
        return `text-lg sm:text-xl ${leading}`;
      case 3:
        return `text-xl sm:text-2xl ${leading}`;
      case 4:
        return `text-2xl sm:text-3xl ${leading}`;
      default:
        return `text-lg sm:text-xl ${leading}`;
    }
  }, [fontScale, wideLineSpacing]);

  const handleTapDhikr = (dhikr: DhikrItem) => {
    setAdhkarCounts((prev) => {
      const current = prev[dhikr.id] || 0;
      if (current >= dhikr.targetCount) return prev;
      return { ...prev, [dhikr.id]: current + 1 };
    });
  };

  const handleResetDhikr = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdhkarCounts((prev) => ({ ...prev, [id]: 0 }));
  };

  const handleResetCategoryAdhkar = () => {
    setAdhkarCounts((prev) => {
      const next = { ...prev };
      filteredAdhkar.forEach((d) => {
        next[d.id] = 0;
      });
      return next;
    });
  };

  const handleToggleMatnDone = (id: string) => {
    setCompletedMutunIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateModal = (mode: 'matn' | 'book' | 'dhikr') => {
    setEditingMatnId(null);
    setAddMode(mode);
    setNewTitle('');
    setNewAuthorOrSource('');
    setNewDescription('');
    setNewCategoryMutun(mode === 'book' ? 'books' : 'tajweed');
    setNewCategoryAdhkar(selectedAdhkarCat === 'all' ? 'morning' : selectedAdhkarCat);
    setNewExternalUrl('');
    setNewExternalViewerMode('direct');
    setNewContentText('');
    setNewTargetCount(3);
    setUrlError(null);
    setIsAddModalOpen(true);
  };

  const openEditMatnModal = (matn: MatnItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMatnId(matn.id);
    setAddMode(matn.externalUrl ? 'book' : 'matn');
    setNewTitle(matn.titleAr);
    setNewAuthorOrSource(matn.authorAr);
    setNewDescription(matn.descriptionAr);
    setNewCategoryMutun(matn.category);
    setNewExternalUrl(matn.externalUrl || '');
    setNewExternalViewerMode(matn.externalViewerMode || 'direct');
    setNewContentText(serializeChaptersToText(matn.chapters));
    setUrlError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveCustomOrEditedItem = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!newTitle.trim()) return;

    if (addMode === 'dhikr') {
      if (!newContentText.trim()) return;
      const created: DhikrItem = {
        id: `custom-dhikr-${Date.now()}`,
        category: newCategoryAdhkar,
        titleAr: newTitle.trim(),
        titleEn: newTitle.trim(),
        textAr: newContentText.trim(),
        targetCount: Math.max(1, Math.min(1000, newTargetCount || 1)),
        sourceAr: newAuthorOrSource.trim() || (lang === 'ar' ? 'ذكر مضاف' : 'Personal Dhikr'),
        sourceEn: newAuthorOrSource.trim() || 'Personal Dhikr',
        isCustom: true,
      };
      setCustomAdhkar((prev) => [created, ...prev]);
      setActiveTab('adhkar');
      setSelectedAdhkarCat(newCategoryAdhkar);
      setIsAddModalOpen(false);
      return;
    }

    // Mode: 'matn' or 'book'
    if (addMode === 'book') {
      if (!newExternalUrl.trim() || !isSafeHttpUrl(newExternalUrl)) {
        setUrlError(
          lang === 'ar'
            ? 'يرجى إدخال رابط صحيح يبدأ بـ https:// أو http://'
            : 'Please enter a valid URL starting with https:// or http://'
        );
        return;
      }
    } else if (!newContentText.trim() && !editingMatnId) {
      return;
    }

    const parsedChapters = newContentText.trim()
      ? parseTextToChapters(newContentText, newTitle.trim())
      : [];

    const cleanedUrl = newExternalUrl.trim() || undefined;
    const isPdfUrl = cleanedUrl ? cleanedUrl.toLowerCase().includes('.pdf') : false;
    const resolvedViewerMode =
      addMode === 'book'
        ? newExternalViewerMode || (isPdfUrl ? 'pdf_viewer' : 'direct')
        : undefined;

    if (editingMatnId) {
      setMutunList((prev) =>
        prev.map((m) =>
          m.id === editingMatnId
            ? {
                ...m,
                category: newCategoryMutun,
                titleAr: newTitle.trim(),
                titleEn: newTitle.trim(),
                authorAr: newAuthorOrSource.trim() || m.authorAr,
                authorEn: newAuthorOrSource.trim() || m.authorEn,
                descriptionAr:
                  newDescription.trim() ||
                  (cleanedUrl
                    ? lang === 'ar'
                      ? 'كتاب مضاف عبر رابط خارجي للعرض المريح على المنصة.'
                      : 'External book displayed in the platform reader.'
                    : m.descriptionAr),
                descriptionEn: newDescription.trim() || m.descriptionEn,
                externalUrl: addMode === 'book' ? cleanedUrl : undefined,
                externalViewerMode: addMode === 'book' ? resolvedViewerMode : undefined,
                chapters: parsedChapters.length > 0 ? parsedChapters : addMode === 'book' ? [] : m.chapters,
              }
            : m
        )
      );
      setExternalViewerOverride(null);
    } else {
      const created: MatnItem = {
        id: `${addMode === 'book' ? 'book' : 'matn'}-${Date.now()}`,
        category: newCategoryMutun,
        titleAr: newTitle.trim(),
        titleEn: newTitle.trim(),
        authorAr:
          newAuthorOrSource.trim() ||
          (addMode === 'book'
            ? lang === 'ar'
              ? 'كتاب عبر رابط خارجي'
              : 'External Book'
            : lang === 'ar'
            ? 'إضافة شخصية'
            : 'Personal Note'),
        authorEn: newAuthorOrSource.trim() || 'External / Custom',
        descriptionAr:
          newDescription.trim() ||
          (addMode === 'book'
            ? lang === 'ar'
              ? 'كتاب مضاف عبر رابط خارجي ومهيأ للقراءة المريحة داخل المنصة.'
              : 'External book configured for comfortable in-app reading.'
            : lang === 'ar'
            ? 'متن مضاف في مكتبتك الخاصة.'
            : 'Custom added text.'),
        descriptionEn: newDescription.trim() || 'Custom library item.',
        externalUrl: cleanedUrl,
        externalViewerMode: resolvedViewerMode,
        chapters: parsedChapters,
        isCustom: true,
      };
      setMutunList((prev) => [created, ...prev]);
      setActiveTab('mutun');
      setActiveMatnId(created.id);
      setActiveChapterId('all');
      setExternalViewerOverride(null);
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteMatn = (id: string) => {
    setMutunList((prev) => prev.filter((m) => m.id !== id));
    if (activeMatnId === id) {
      setActiveMatnId(null);
    }
    setConfirmDeleteMatnId(null);
  };

  const openChapterModal = (ch?: MatnChapter) => {
    if (ch) {
      setEditingChapterId(ch.id);
      setChapterTitleInput(ch.titleAr);
      setChapterNoteInput(ch.noteAr || '');
      setChapterItemsInput(
        ch.items
          .map((it) => (it.secondHalf ? `${it.firstHalf} | ${it.secondHalf}` : it.firstHalf))
          .join('\n')
      );
    } else {
      setEditingChapterId(null);
      setChapterTitleInput('');
      setChapterNoteInput('');
      setChapterItemsInput('');
    }
    setChapterModalOpen(true);
  };

  const handleSaveChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatn || !chapterTitleInput.trim()) return;

    const lines = chapterItemsInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedItems = lines.map((line, idx) => {
      const parts = line
        .split(/[*|—–\/]{1,3}| {3,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return {
          id: `chitem-${Date.now()}-${idx}`,
          firstHalf: parts[0],
          secondHalf: parts.slice(1).join(' '),
        };
      }
      return {
        id: `chitem-${Date.now()}-${idx}`,
        firstHalf: line,
      };
    });

    setMutunList((prev) =>
      prev.map((m) => {
        if (m.id !== activeMatn.id) return m;
        if (editingChapterId) {
          return {
            ...m,
            chapters: m.chapters.map((ch) =>
              ch.id === editingChapterId
                ? {
                    ...ch,
                    titleAr: chapterTitleInput.trim(),
                    titleEn: chapterTitleInput.trim(),
                    noteAr: chapterNoteInput.trim() || undefined,
                    noteEn: chapterNoteInput.trim() || undefined,
                    items: parsedItems,
                  }
                : ch
            ),
          };
        }
        const newChapter: MatnChapter = {
          id: `ch-${Date.now()}`,
          titleAr: chapterTitleInput.trim(),
          titleEn: chapterTitleInput.trim(),
          noteAr: chapterNoteInput.trim() || undefined,
          noteEn: chapterNoteInput.trim() || undefined,
          items: parsedItems,
        };
        return {
          ...m,
          chapters: [...m.chapters, newChapter],
        };
      })
    );

    setChapterModalOpen(false);
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (!activeMatn) return;
    setMutunList((prev) =>
      prev.map((m) =>
        m.id === activeMatn.id
          ? { ...m, chapters: m.chapters.filter((c) => c.id !== chapterId) }
          : m
      )
    );
    if (activeChapterId === chapterId) {
      setActiveChapterId('all');
    }
    setConfirmDeleteChapterId(null);
  };

  const handleRestoreDefaultMutun = () => {
    setMutunList((prev) => {
      const customBooksAndNotes = prev.filter((item) => item.isCustom);
      return [...customBooksAndNotes, ...INITIAL_MUTUN_LIST];
    });
    setConfirmRestoreDefaults(false);
  };

  const handleDeleteCustomDhikr = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomAdhkar((prev) => prev.filter((d) => d.id !== id));
  };

  const completedAdhkarCount = filteredAdhkar.filter(
    (d) => (adhkarCounts[d.id] || 0) >= d.targetCount
  ).length;

  const effectiveExternalMode: 'direct' | 'pdf_viewer' = useMemo(() => {
    if (externalViewerOverride) return externalViewerOverride;
    if (activeMatn?.externalViewerMode) return activeMatn.externalViewerMode;
    if (activeMatn?.externalUrl?.toLowerCase().includes('.pdf')) return 'pdf_viewer';
    return 'direct';
  }, [activeMatn, externalViewerOverride]);

  const embeddedExternalSrc = useMemo(() => {
    if (!activeMatn?.externalUrl || !isSafeHttpUrl(activeMatn.externalUrl)) return '';
    if (effectiveExternalMode === 'pdf_viewer') {
      return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
        activeMatn.externalUrl
      )}`;
    }
    return activeMatn.externalUrl;
  }, [activeMatn, effectiveExternalMode]);

  return (
    <section
      className={
        isFocusReader
          ? 'fixed inset-0 z-50 overflow-y-auto bg-[#EFE9DC] p-3 sm:p-6 space-y-4'
          : 'max-w-5xl mx-auto space-y-4'
      }
    >
      {/* Top Banner & Section Switcher */}
      <div className="earthy-gradient-banner rounded-2xl p-4 sm:p-5 text-[#FFFDF9] border border-[#8F681E]/40 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#EAB338] shrink-0" />
            <h1 className="text-lg sm:text-2xl font-extrabold font-display-islamic text-[#FFFDF9]">
              {lang === 'ar'
                ? 'المكتبة'
                : 'The Library'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#E6D7BE]">
            {lang === 'ar'
              ? 'المتون العلمية، وإضافة الكتب عبر روابط خارجية، والأذكار اليومية بمظهر مريح للقراءة'
              : 'Islamic Mutun texts, external book links for comfortable reading, and daily Adhkar'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Primary Segmented Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-black/25 border border-[#EAB338]/30">
            <button
              type="button"
              onClick={() => {
                setActiveTab('mutun');
                setActiveMatnId(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'mutun'
                  ? 'bg-[#EAB338] text-[#261C14] shadow-xs'
                  : 'text-[#F5ECD9] hover:bg-white/10'
              }`}
            >
              <ScrollText className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'المتون والكتب' : 'Mutun & Books'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('adhkar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'adhkar'
                  ? 'bg-[#EAB338] text-[#261C14] shadow-xs'
                  : 'text-[#F5ECD9] hover:bg-white/10'
              }`}
            >
              <Heart className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'الأذكار اليومية' : 'Daily Adhkar'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openCreateModal('book')}
            className="px-3 py-2 rounded-xl bg-[#C88A14] hover:bg-[#AD750E] text-[#FFFDF9] border border-[#F6D365]/40 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Link2 className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة كتاب برابط' : 'Add Book Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal(activeTab === 'mutun' ? 'matn' : 'dhikr')}
            className="px-3 py-2 rounded-xl bg-[#4A6144] hover:bg-[#3B4F36] text-[#FFFDF9] border border-[#82A879]/40 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeTab === 'mutun'
                ? lang === 'ar'
                  ? 'إضافة متن'
                  : 'Add Text'
                : lang === 'ar'
                ? 'إضافة ذكر'
                : 'Add Dhikr'}
            </span>
          </button>
        </div>
      </div>

      {/* Comfortable Reading Controls Bar */}
      <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#84715E] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'mutun'
                ? lang === 'ar'
                  ? 'ابحث في المتون والكتب...'
                  : 'Search texts or books...'
                : lang === 'ar'
                ? 'ابحث في الأذكار والأدعية...'
                : 'Search adhkar & duas...'
            }
            className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] placeholder-[#84715E] focus:outline-none focus:border-[#C88A14]"
          />
        </div>

        {/* Reading Comfort Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Font Scale Control */}
          <div
            className="inline-flex items-center gap-1 bg-[#F7F3EB] border border-[#DDD2BE] rounded-xl px-2 py-1"
            title={lang === 'ar' ? 'حجم خط القراءة' : 'Reading Font Size'}
          >
            <Type className="w-3.5 h-3.5 text-[#C88A14]" />
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.max(1, s - 1))}
              disabled={fontScale <= 1}
              className="px-1.5 py-0.5 rounded-md hover:bg-[#EFE9DC] disabled:opacity-40 text-xs font-bold text-[#2D2218] cursor-pointer"
            >
              -
            </button>
            <span className="text-[11px] font-bold text-[#5C4B3B] px-1 select-none font-mono-tabular">
              {fontScale === 1
                ? lang === 'ar'
                  ? 'صغير'
                  : 'S'
                : fontScale === 2
                ? lang === 'ar'
                  ? 'متوسط'
                  : 'M'
                : fontScale === 3
                ? lang === 'ar'
                  ? 'كبير'
                  : 'L'
                : lang === 'ar'
                ? 'مُكَبّر'
                : 'XL'}
            </span>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.min(4, s + 1))}
              disabled={fontScale >= 4}
              className="px-1.5 py-0.5 rounded-md hover:bg-[#EFE9DC] disabled:opacity-40 text-xs font-bold text-[#2D2218] cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Paper / Lighting Theme Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE]">
            <button
              type="button"
              onClick={() => setReaderSurface('ivory')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors ${
                readerSurface === 'ivory'
                  ? 'bg-[#FFFDF9] text-[#2D2218] shadow-2xs border border-[#DDD2BE]'
                  : 'text-[#5C4B3B] hover:text-[#261C14]'
              }`}
              title={lang === 'ar' ? 'خلفية عاجية ناصعة' : 'Ivory Paper'}
            >
              <Sun className="w-3 h-3 text-[#C88A14]" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'عاجي' : 'Ivory'}</span>
            </button>

            <button
              type="button"
              onClick={() => setReaderSurface('sepia')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors ${
                readerSurface === 'sepia'
                  ? 'bg-[#EFE3CA] text-[#2D2218] shadow-2xs border border-[#D5C199]'
                  : 'text-[#5C4B3B] hover:text-[#261C14]'
              }`}
              title={lang === 'ar' ? 'رق دافئ مريح للعين' : 'Warm Sepia'}
            >
              <BookOpen className="w-3 h-3 text-[#9E650C]" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'دافئ' : 'Sepia'}</span>
            </button>

            <button
              type="button"
              onClick={() => setReaderSurface('night')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors ${
                readerSurface === 'night'
                  ? 'bg-[#2D2218] text-[#EAB338] shadow-2xs'
                  : 'text-[#5C4B3B] hover:text-[#261C14]'
              }`}
              title={lang === 'ar' ? 'الوضع الليلي المريح' : 'Night Reading'}
            >
              <Moon className="w-3 h-3" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'ليلي' : 'Night'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setWideLineSpacing((w) => !w)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${
              wideLineSpacing
                ? 'bg-[#4A6144]/15 border-[#4A6144]/40 text-[#4A6144]'
                : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#5C4B3B]'
            }`}
          >
            {lang === 'ar' ? 'تباعد مريح' : 'Spacing'}
          </button>

          <button
            type="button"
            onClick={() => setIsFocusReader((f) => !f)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 transition-colors ${
              isFocusReader
                ? 'bg-[#2D2218] border-[#2D2218] text-[#EAB338]'
                : 'bg-[#F7F3EB] border-[#DDD2BE] text-[#2D2218] hover:bg-[#EFE9DC]'
            }`}
          >
            {isFocusReader ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إنهاء التركيز' : 'Exit Focus'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#C88A14]" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'وضع القراءة' : 'Focus'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: MUTUN & EXTERNAL BOOKS                                     */}
      {/* ================================================================= */}
      {activeTab === 'mutun' && (
        <div className="space-y-4">
          {!activeMatn ? (
            <>
              {/* Category Filter Chips + Restore Defaults */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMutunCat('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      selectedMutunCat === 'all'
                        ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                        : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                    }`}
                  >
                    {lang === 'ar' ? 'الكل' : 'All'} ({mutunList.length})
                  </button>
                  {MUTUN_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedMutunCat(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        selectedMutunCat === cat.id
                          ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                          : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                      }`}
                    >
                      {lang === 'ar' ? cat.labelAr : cat.labelEn}
                    </button>
                  ))}
                </div>

                {!confirmRestoreDefaults ? (
                  <button
                    type="button"
                    onClick={() => setConfirmRestoreDefaults(true)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#DDD2BE] bg-[#FFFDF9] hover:bg-[#EFE9DC] text-[11px] font-semibold text-[#5C4B3B] cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3 text-[#C88A14]" />
                    <span>{lang === 'ar' ? 'استعادة الافتراضي' : 'Restore Defaults'}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-[#FBF3DF] border border-[#C88A14]/40 px-2.5 py-1 rounded-xl text-[11px]">
                    <span className="font-bold text-[#2D2218]">
                      {lang === 'ar' ? 'استعادة المتون الأساسية؟' : 'Restore built-in?'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRestoreDefaultMutun}
                      className="px-2 py-0.5 rounded bg-[#4A6144] text-white font-bold cursor-pointer"
                    >
                      {lang === 'ar' ? 'نعم' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreDefaults(false)}
                      className="px-2 py-0.5 rounded bg-[#EFE9DC] text-[#5C4B3B] font-bold cursor-pointer"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>

              {/* Mutun & External Books Cards */}
              {filteredMutun.length === 0 ? (
                <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-8 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-[#84715E]">
                    {lang === 'ar'
                      ? 'لا توجد متون أو كتب مطابقة حالياً.'
                      : 'No matching texts or books found.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCreateModal('matn')}
                      className="mustard-gradient-btn px-4 py-2 rounded-xl text-xs font-bold text-[#FFFDF9] cursor-pointer"
                    >
                      {lang === 'ar' ? 'إضافة متن جديد' : 'Add Text'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateModal('book')}
                      className="px-4 py-2 rounded-xl bg-[#4A6144] text-xs font-bold text-[#FFFDF9] cursor-pointer"
                    >
                      {lang === 'ar' ? 'إضافة كتاب برابط' : 'Add Book Link'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMutun.map((matn) => {
                    const isDone = !!completedMutunIds[matn.id];
                    const totalLines = matn.chapters.reduce((acc, ch) => acc + ch.items.length, 0);
                    const isConfirmingDel = confirmDeleteMatnId === matn.id;

                    return (
                      <div
                        key={matn.id}
                        onClick={() => {
                          setActiveMatnId(matn.id);
                          setActiveChapterId('all');
                          setExternalViewerOverride(null);
                        }}
                        className="earthy-card-gradient rounded-2xl border border-[#DDD2BE] hover:border-[#C88A14] p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#F6E9C8] text-[#9E650C] border border-[#E5C983]">
                                {getMutunCategoryLabel(matn.category, lang)}
                              </span>
                              {matn.externalUrl && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-[#2D2218] text-[#EAB338] inline-flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'كتاب برابط' : 'External Book'}</span>
                                </span>
                              )}
                            </div>

                            {/* Edit & Delete Controls on EVERY Matn / Book */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isDone && (
                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg bg-[#4A6144]/15 text-[#4A6144] border border-[#4A6144]/30 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span className="hidden sm:inline">
                                    {lang === 'ar' ? 'مقروء' : 'Read'}
                                  </span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => openEditMatnModal(matn, e)}
                                className="p-1.5 rounded-lg text-[#5C4B3B] hover:text-[#2D2218] hover:bg-[#EFE9DC] transition-colors cursor-pointer"
                                title={lang === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {!isConfirmingDel ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMatnId(matn.id)}
                                  className="p-1.5 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-1 bg-[#FAF0ED] border border-[#A84A32]/40 px-1.5 py-0.5 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMatn(matn.id)}
                                    className="px-1.5 py-0.5 rounded bg-[#A84A32] text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'تأكيد الحذف' : 'Delete'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteMatnId(null)}
                                    className="px-1.5 py-0.5 rounded bg-[#EFE9DC] text-[#5C4B3B] text-[10px] font-bold cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'إلغاء' : 'No'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h2 className="text-lg sm:text-xl font-extrabold font-display-islamic text-[#261C14] group-hover:text-[#9E650C] transition-colors leading-snug">
                              {lang === 'ar' ? matn.titleAr : matn.titleEn}
                            </h2>
                            <p className="text-xs font-bold text-[#8B6514] mt-0.5">
                              {lang === 'ar' ? matn.authorAr : matn.authorEn}
                            </p>
                          </div>

                          <p className="text-xs sm:text-sm text-[#5C4B3B] leading-relaxed">
                            {lang === 'ar' ? matn.descriptionAr : matn.descriptionEn}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E5DEC9]">
                          <span className="text-xs font-mono-tabular text-[#84715E]">
                            {matn.externalUrl
                              ? lang === 'ar'
                                ? 'عرض مريح على المنصة'
                                : 'In-App Reader'
                              : `${matn.chapters.length} ${lang === 'ar' ? 'أبواب' : 'Chapters'} · ${totalLines} ${
                                  lang === 'ar' ? 'مقاطع' : 'Items'
                                }`}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D2218] bg-[#EFE9DC] group-hover:bg-[#C88A14] group-hover:text-[#FFFDF9] px-3.5 py-1.5 rounded-full transition-colors">
                            <span>{lang === 'ar' ? 'فتح للقراءة' : 'Open Reader'}</span>
                            {lang === 'ar' ? (
                              <ArrowLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ============================================================= */
            /* DEDICATED COMFORTABLE MATN & EXTERNAL BOOK READER VIEW        */
            /* ============================================================= */
            <div
              className={`rounded-2xl border p-4 sm:p-6 md:p-8 shadow-sm space-y-6 transition-colors ${surfaceStyles.cardBg} ${surfaceStyles.border}`}
            >
              {/* Reader Header */}
              <div
                className={`flex flex-wrap items-start justify-between gap-3 pb-4 border-b ${surfaceStyles.border}`}
              >
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMatnId(null);
                      setConfirmDeleteMatnId(null);
                    }}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg border cursor-pointer transition-colors mb-1 ${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textPrimary}`}
                  >
                    {lang === 'ar' ? (
                      <ArrowRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowLeft className="w-3.5 h-3.5" />
                    )}
                    <span>{lang === 'ar' ? 'العودة لقائمة المتون والكتب' : 'Back to Library'}</span>
                  </button>

                  <h2
                    className={`text-xl sm:text-3xl font-extrabold font-display-islamic ${surfaceStyles.textPrimary}`}
                  >
                    {lang === 'ar' ? activeMatn.titleAr : activeMatn.titleEn}
                  </h2>
                  <p className={`text-xs sm:text-sm font-bold ${surfaceStyles.accentText}`}>
                    {lang === 'ar' ? activeMatn.authorAr : activeMatn.authorEn}
                  </p>
                </div>

                {/* Reader Actions: Edit, Delete, Add Chapter, Mark Complete */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditMatnModal(activeMatn)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 border transition-colors ${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textPrimary}`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#C88A14]" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>

                  {!activeMatn.externalUrl && (
                    <button
                      type="button"
                      onClick={() => openChapterModal()}
                      className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 border transition-colors ${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textPrimary}`}
                    >
                      <Plus className="w-3.5 h-3.5 text-[#4A6144]" />
                      <span>{lang === 'ar' ? 'إضافة باب' : 'Add Chapter'}</span>
                    </button>
                  )}

                  {confirmDeleteMatnId !== activeMatn.id ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMatnId(activeMatn.id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 border border-[#A84A32]/40 bg-[#A84A32]/10 text-[#A84A32] hover:bg-[#A84A32]/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 bg-[#FAF0ED] border border-[#A84A32]/50 px-2.5 py-1.5 rounded-xl text-xs">
                      <span className="font-bold text-[#A84A32]">
                        {lang === 'ar' ? 'تأكيد الحذف؟' : 'Confirm?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteMatn(activeMatn.id)}
                        className="px-2 py-0.5 rounded bg-[#A84A32] text-white font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'نعم' : 'Yes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMatnId(null)}
                        className="px-2 py-0.5 rounded bg-[#EFE9DC] text-[#5C4B3B] font-bold cursor-pointer"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'No'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleMatnDone(activeMatn.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 border transition-all ${
                      completedMutunIds[activeMatn.id]
                        ? 'bg-[#4A6144] text-[#FFFDF9] border-[#4A6144]'
                        : `${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textPrimary}`
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {completedMutunIds[activeMatn.id]
                        ? lang === 'ar'
                          ? 'تمت القراءة والحفظ'
                          : 'Completed'
                        : lang === 'ar'
                        ? 'تحديد كمقروء'
                        : 'Mark as Read'}
                    </span>
                  </button>
                </div>
              </div>

              {/* EXTERNAL BOOK COMFORTABLE READER FRAME */}
              {activeMatn.externalUrl && isSafeHttpUrl(activeMatn.externalUrl) && (
                <div
                  className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${surfaceStyles.innerBg} ${surfaceStyles.border}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-bold inline-flex items-center gap-1.5 ${surfaceStyles.accentText}`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>
                          {lang === 'ar' ? 'عارض الكتاب المريح على المنصة' : 'In-App Book Reader'}
                        </span>
                      </span>

                      <div
                        className={`inline-flex p-0.5 rounded-lg border ${surfaceStyles.cardBg} ${surfaceStyles.border}`}
                      >
                        <button
                          type="button"
                          onClick={() => setExternalViewerOverride('direct')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                            effectiveExternalMode === 'direct'
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : surfaceStyles.textSecondary
                          }`}
                        >
                          {lang === 'ar' ? 'عرض مباشر' : 'Direct View'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExternalViewerOverride('pdf_viewer')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                            effectiveExternalMode === 'pdf_viewer'
                              ? 'bg-[#2D2218] text-[#EAB338]'
                              : surfaceStyles.textSecondary
                          }`}
                        >
                          {lang === 'ar' ? 'عارض PDF' : 'PDF Viewer'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExternalEyeComfortFilter((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 ${
                          externalEyeComfortFilter
                            ? 'bg-[#4A6144] text-[#FFFDF9] border-[#4A6144]'
                            : `${surfaceStyles.cardBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`
                        }`}
                        title={
                          lang === 'ar'
                            ? 'تخفيف سطوع الصفحات الخارجية ومواءمتها لراحة العين'
                            : 'Apply eye-comfort filter to external pages'
                        }
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'راحة العين' : 'Eye Comfort'}</span>
                      </button>
                    </div>

                    <a
                      href={activeMatn.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#2D2218] hover:bg-[#3D2F22] text-[#EAB338] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'فتح المصدر الأصلي' : 'Open Source'}</span>
                    </a>
                  </div>

                  {/* Embedded Comfortable Frame */}
                  <div
                    className={`rounded-xl overflow-hidden border ${surfaceStyles.border} bg-[#FFFDF9]`}
                  >
                    <iframe
                      title={activeMatn.titleAr}
                      src={embeddedExternalSrc}
                      className="w-full h-[65vh] min-h-[460px] border-0 transition-all"
                      style={
                        externalEyeComfortFilter
                          ? readerSurface === 'night'
                            ? { filter: 'invert(0.88) hue-rotate(180deg) sepia(0.18) contrast(0.92)' }
                            : readerSurface === 'sepia'
                            ? { filter: 'sepia(0.28) brightness(0.96) contrast(0.96)' }
                            : { filter: 'sepia(0.08) brightness(0.98)' }
                          : undefined
                      }
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <p className={`text-[11px] leading-relaxed ${surfaceStyles.textMuted}`}>
                    {lang === 'ar'
                      ? 'ملاحظة: بعض المواقع الخارجية تمنع العرض المدمج من إعدادات موقعها؛ في حال لم تظهر الصفحة داخل الإطار يمكنك استخدام خيار «عارض PDF» لملفات PDF أو «فتح المصدر الأصلي» أو تعديل الكتاب لإضافة نصه المقروء مباشرة.'
                      : 'Note: If a third-party host restricts embedding, switch to PDF Viewer for PDF files, open the original link, or edit the book to attach readable text notes.'}
                  </p>
                </div>
              )}

              {/* Chapter Navigator */}
              {activeMatn.chapters.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveChapterId('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                      activeChapterId === 'all'
                        ? 'bg-[#C88A14] text-[#FFFDF9] border-[#C88A14]'
                        : `${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`
                    }`}
                  >
                    {lang === 'ar' ? 'كل الأبواب' : 'All Chapters'}
                  </button>
                  {activeMatn.chapters.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveChapterId(ch.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                        activeChapterId === ch.id
                          ? 'bg-[#C88A14] text-[#FFFDF9] border-[#C88A14]'
                          : `${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`
                      }`}
                    >
                      {lang === 'ar' ? ch.titleAr : ch.titleEn}
                    </button>
                  ))}
                </div>
              )}

              {/* Chapters & Comfortable Poetic/Prose Rendering */}
              {activeMatn.chapters.length > 0 && (
                <div className="space-y-6">
                  {activeMatn.chapters
                    .filter((ch) => activeChapterId === 'all' || ch.id === activeChapterId)
                    .map((chapter) => (
                      <div
                        key={chapter.id}
                        className={`rounded-2xl border p-4 sm:p-6 space-y-4 ${surfaceStyles.innerBg} ${surfaceStyles.border}`}
                      >
                        <div
                          className={`pb-2.5 border-b flex flex-wrap items-start justify-between gap-2 ${surfaceStyles.border}`}
                        >
                          <div>
                            <h3
                              className={`text-base sm:text-lg font-extrabold font-display-islamic ${surfaceStyles.accentText}`}
                            >
                              {lang === 'ar' ? chapter.titleAr : chapter.titleEn}
                            </h3>
                            {(chapter.noteAr || chapter.noteEn) && (
                              <p className={`text-xs mt-1 ${surfaceStyles.textMuted}`}>
                                {lang === 'ar' ? chapter.noteAr : chapter.noteEn}
                              </p>
                            )}
                          </div>

                          {/* Chapter Edit & Delete Controls */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openChapterModal(chapter)}
                              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${surfaceStyles.cardBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`}
                              title={lang === 'ar' ? 'تعديل الباب' : 'Edit Chapter'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {confirmDeleteChapterId !== chapter.id ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteChapterId(chapter.id)}
                                className="p-1.5 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 cursor-pointer"
                                title={lang === 'ar' ? 'حذف الباب' : 'Delete Chapter'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1 bg-[#FAF0ED] border border-[#A84A32]/40 px-2 py-0.5 rounded-lg text-[10.5px]">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChapter(chapter.id)}
                                  className="px-1.5 py-0.5 rounded bg-[#A84A32] text-white font-bold cursor-pointer"
                                >
                                  {lang === 'ar' ? 'حذف' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteChapterId(null)}
                                  className="px-1.5 py-0.5 rounded bg-[#EFE9DC] text-[#5C4B3B] font-bold cursor-pointer"
                                >
                                  {lang === 'ar' ? 'إلغاء' : 'No'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {chapter.items.map((item, idx) => (
                            <div
                              key={item.id}
                              className={`rounded-xl border p-3.5 sm:p-4 transition-colors ${surfaceStyles.cardBg} ${surfaceStyles.border}`}
                            >
                              {item.secondHalf ? (
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`w-7 h-7 rounded-full border text-xs font-bold font-mono-tabular flex items-center justify-center shrink-0 mt-1 ${surfaceStyles.badgeBg}`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <div
                                    dir="rtl"
                                    className={`flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6 font-display-islamic font-semibold ${fontClass} ${surfaceStyles.textPrimary}`}
                                  >
                                    <div className="text-center md:text-start">{item.firstHalf}</div>
                                    <div className="text-center md:text-end">{item.secondHalf}</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`w-7 h-7 rounded-full border text-xs font-bold font-mono-tabular flex items-center justify-center shrink-0 mt-1 ${surfaceStyles.badgeBg}`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <p
                                    dir="rtl"
                                    className={`flex-1 font-display-islamic ${fontClass} ${surfaceStyles.textPrimary}`}
                                  >
                                    {item.firstHalf}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: ADHKAR                                                     */}
      {/* ================================================================= */}
      {activeTab === 'adhkar' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedAdhkarCat('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  selectedAdhkarCat === 'all'
                    ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                    : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                }`}
              >
                {lang === 'ar' ? 'الكل' : 'All'}
              </button>
              {ADHKAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedAdhkarCat(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedAdhkarCat === cat.id
                      ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                      : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE] hover:bg-[#EFE9DC]'
                  }`}
                >
                  {lang === 'ar' ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold font-mono-tabular text-[#2D2218]">
                {completedAdhkarCount}/{filteredAdhkar.length}{' '}
                {lang === 'ar' ? 'مكتمل' : 'Done'}
              </span>
              <button
                type="button"
                onClick={handleResetCategoryAdhkar}
                className="px-3 py-1.5 rounded-xl bg-[#FFFDF9] hover:bg-[#EFE9DC] border border-[#DDD2BE] text-xs font-bold text-[#5C4B3B] cursor-pointer inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#C88A14]" />
                <span>{lang === 'ar' ? 'تصفير العداد' : 'Reset'}</span>
              </button>
            </div>
          </div>

          {filteredAdhkar.length === 0 ? (
            <div className="rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-8 text-center text-xs sm:text-sm text-[#84715E]">
              {lang === 'ar' ? 'لا توجد أذكار مطابقة لبحثك.' : 'No matching adhkar found.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAdhkar.map((dhikr) => {
                const count = adhkarCounts[dhikr.id] || 0;
                const isDone = count >= dhikr.targetCount;
                const progressPct = Math.min(100, Math.round((count / dhikr.targetCount) * 100));

                return (
                  <div
                    key={dhikr.id}
                    onClick={() => handleTapDhikr(dhikr)}
                    className={`rounded-2xl border p-4 sm:p-6 shadow-xs transition-all cursor-pointer select-none space-y-4 ${
                      surfaceStyles.cardBg
                    } ${
                      isDone
                        ? 'border-[#4A6144] ring-1 ring-[#4A6144]/30'
                        : `${surfaceStyles.border} hover:border-[#C88A14]`
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${surfaceStyles.badgeBg}`}
                        >
                          {getAdhkarCategoryLabel(dhikr.category, lang)}
                        </span>
                        <h3 className={`text-sm sm:text-base font-extrabold ${surfaceStyles.textPrimary}`}>
                          {lang === 'ar' ? dhikr.titleAr : dhikr.titleEn}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold ${surfaceStyles.textMuted}`}>
                          {lang === 'ar' ? dhikr.sourceAr : dhikr.sourceEn}
                        </span>
                        {dhikr.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomDhikr(dhikr.id, e)}
                            className="p-1 rounded-lg text-[#A84A32] hover:bg-[#A84A32]/10 cursor-pointer"
                            title={lang === 'ar' ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p
                      dir="rtl"
                      className={`font-display-islamic ${fontClass} ${surfaceStyles.textPrimary} py-1`}
                    >
                      {dhikr.textAr}
                    </p>

                    {lang === 'en' && dhikr.meaningEn && (
                      <p className={`text-xs sm:text-sm italic ${surfaceStyles.textSecondary}`}>
                        {dhikr.meaningEn}
                      </p>
                    )}

                    {(dhikr.virtueAr || dhikr.virtueEn) && (
                      <div
                        className={`rounded-xl px-3 py-2 border text-xs flex items-start gap-2 ${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#C88A14] shrink-0 mt-0.5" />
                        <span>{lang === 'ar' ? dhikr.virtueAr : dhikr.virtueEn}</span>
                      </div>
                    )}

                    <div className="pt-2 space-y-2">
                      <div className="w-full h-1.5 rounded-full bg-[#DDD2BE]/40 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            isDone ? 'bg-[#4A6144]' : 'bg-[#C88A14]'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-medium ${surfaceStyles.textMuted}`}>
                          {isDone
                            ? lang === 'ar'
                              ? 'اكتمل التكرار المطلوب'
                              : 'Completed'
                            : lang === 'ar'
                            ? 'اضغط على البطاقة للعدّ'
                            : 'Tap card to count'}
                        </span>

                        <div className="flex items-center gap-2">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={(e) => handleResetDhikr(dhikr.id, e)}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${surfaceStyles.innerBg} ${surfaceStyles.border} ${surfaceStyles.textSecondary}`}
                              title={lang === 'ar' ? 'إعادة ضبط' : 'Reset'}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <span
                            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold font-mono-tabular inline-flex items-center gap-1.5 shadow-2xs ${
                              isDone
                                ? 'bg-[#4A6144] text-[#FFFDF9]'
                                : 'mustard-gradient-btn text-[#FFFDF9]'
                            }`}
                          >
                            {isDone && <CheckCircle2 className="w-4 h-4" />}
                            <span>
                              {count} / {dhikr.targetCount}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* ADD / EDIT MATN, EXTERNAL BOOK, OR DHIKR MODAL                    */}
      {/* ================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/60 shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 py-3 earthy-gradient-banner text-[#FFFDF9] flex items-center justify-between border-b border-[#C88A14]/40">
              <div className="flex items-center gap-2">
                {editingMatnId ? (
                  <Edit3 className="w-4 h-4 text-[#EAB338]" />
                ) : (
                  <Plus className="w-4 h-4 text-[#EAB338]" />
                )}
                <h2 className="text-base font-bold font-display-islamic">
                  {editingMatnId
                    ? lang === 'ar'
                      ? 'تعديل المتن أو الكتاب'
                      : 'Edit Text or Book'
                    : lang === 'ar'
                    ? 'إضافة متن أو كتاب عبر رابط أو ذكر'
                    : 'Add Matn, External Book, or Dhikr'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCustomOrEditedItem}
              className="p-4 overflow-y-auto space-y-3.5 text-xs sm:text-sm"
            >
              {/* Type Selector (hidden for Dhikr when editing existing Matn/Book) */}
              <div
                className={`grid ${
                  editingMatnId ? 'grid-cols-2' : 'grid-cols-3'
                } gap-1.5 p-1 rounded-xl bg-[#EFE9DC] border border-[#DDD2BE]`}
              >
                <button
                  type="button"
                  onClick={() => setAddMode('matn')}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    addMode === 'matn' ? 'bg-[#2D2218] text-[#EAB338]' : 'text-[#5C4B3B]'
                  }`}
                >
                  {lang === 'ar' ? 'متن علمي' : 'Scientific Text'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode('book');
                    if (!editingMatnId) setNewCategoryMutun('books');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    addMode === 'book' ? 'bg-[#2D2218] text-[#EAB338]' : 'text-[#5C4B3B]'
                  }`}
                >
                  {lang === 'ar' ? 'كتاب برابط خارجي' : 'Book via Link'}
                </button>
                {!editingMatnId && (
                  <button
                    type="button"
                    onClick={() => setAddMode('dhikr')}
                    className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      addMode === 'dhikr' ? 'bg-[#2D2218] text-[#EAB338]' : 'text-[#5C4B3B]'
                    }`}
                  >
                    {lang === 'ar' ? 'ذكر / دعاء' : 'Dhikr / Dua'}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2218] mb-1">
                  {lang === 'ar' ? 'العنوان' : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    addMode === 'book'
                      ? lang === 'ar'
                        ? 'مثال: التبيان في آداب حملة القرآن'
                        : 'Book title...'
                      : addMode === 'matn'
                      ? lang === 'ar'
                        ? 'مثال: تحفة الأطفال أو نونية القحطاني'
                        : 'Matn title...'
                      : lang === 'ar'
                      ? 'مثال: دعاء دخول المسجد'
                      : 'Dhikr title...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2D2218] mb-1">
                    {lang === 'ar' ? 'التصنيف' : 'Category'}
                  </label>
                  {addMode === 'dhikr' ? (
                    <select
                      value={newCategoryAdhkar}
                      onChange={(e) => setNewCategoryAdhkar(e.target.value as AdhkarCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {ADHKAR_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {lang === 'ar' ? c.labelAr : c.labelEn}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={newCategoryMutun}
                      onChange={(e) => setNewCategoryMutun(e.target.value as MutunCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    >
                      {MUTUN_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {lang === 'ar' ? c.labelAr : c.labelEn}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {addMode === 'dhikr' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#2D2218] mb-1">
                      {lang === 'ar' ? 'عدد التكرار' : 'Target Repetitions'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={newTargetCount}
                      onChange={(e) => setNewTargetCount(Number(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs font-mono-tabular text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#2D2218] mb-1">
                      {lang === 'ar' ? 'المؤلف / المصنف' : 'Author'}
                    </label>
                    <input
                      type="text"
                      value={newAuthorOrSource}
                      onChange={(e) => setNewAuthorOrSource(e.target.value)}
                      placeholder={lang === 'ar' ? 'اسم المؤلف...' : 'Author name...'}
                      className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                  </div>
                )}
              </div>

              {/* External Link Fields for Books */}
              {addMode === 'book' && (
                <div className="p-3 rounded-xl bg-[#FBF5E6] border border-[#E6D19E] space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#2D2218] mb-1">
                      {lang === 'ar'
                        ? 'الرابط الخارجي للكتاب (PDF أو صفحة قراءة)'
                        : 'External Book URL (PDF or Web Page)'}
                    </label>
                    <input
                      type="url"
                      required
                      dir="ltr"
                      value={newExternalUrl}
                      onChange={(e) => setNewExternalUrl(e.target.value)}
                      placeholder="https://example.com/book.pdf"
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFDF9] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                    />
                    {urlError && (
                      <p className="text-[11px] font-bold text-[#A84A32] mt-1">{urlError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2D2218] mb-1">
                      {lang === 'ar' ? 'طريقة العرض على المنصة' : 'In-App Viewer Mode'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewExternalViewerMode('direct')}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          newExternalViewerMode === 'direct'
                            ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                            : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE]'
                        }`}
                      >
                        {lang === 'ar' ? 'عرض الصفحة مباشرة' : 'Direct Embed'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewExternalViewerMode('pdf_viewer')}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          newExternalViewerMode === 'pdf_viewer'
                            ? 'bg-[#2D2218] text-[#EAB338] border-[#2D2218]'
                            : 'bg-[#FFFDF9] text-[#5C4B3B] border-[#DDD2BE]'
                        }`}
                      >
                        {lang === 'ar' ? 'عارض مستندات PDF' : 'PDF Document Viewer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {addMode !== 'dhikr' && (
                <div>
                  <label className="block text-xs font-bold text-[#2D2218] mb-1">
                    {lang === 'ar' ? 'وصف مختصر (اختياري)' : 'Short Description (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={lang === 'ar' ? 'نبذة موجزة عن الكتاب أو المتن...' : 'Short summary...'}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#2D2218] mb-1">
                  {addMode === 'book'
                    ? lang === 'ar'
                      ? 'فوائد أو نص مقروء إضافي (اختياري)'
                      : 'Optional Readable Notes / Excerpts'
                    : addMode === 'matn'
                    ? lang === 'ar'
                      ? 'المحتوى والأبيات (استخدم === اسم الباب === لتقسيم الأبواب، و | بين شطري البيت)'
                      : 'Content (use === Chapter === for chapters, and | between hemistichs)'
                    : lang === 'ar'
                    ? 'نص الذكر أو الدعاء'
                    : 'Dhikr Text'}
                </label>
                <textarea
                  required={addMode !== 'book'}
                  rows={6}
                  value={newContentText}
                  onChange={(e) => setNewContentText(e.target.value)}
                  placeholder={
                    addMode === 'matn'
                      ? lang === 'ar'
                        ? '=== المقدمة ===\nالشطر الأول | الشطر الثاني'
                        : '=== Chapter ===\nFirst half | Second half'
                      : addMode === 'book'
                      ? lang === 'ar'
                        ? 'يمكنك إضافة ملاحظات أو فصول مقروءة تظهر تحت إطار الكتاب...'
                        : 'Optional notes...'
                      : lang === 'ar'
                      ? 'اكتب نص الذكر هنا...'
                      : 'Enter dhikr text...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs leading-relaxed text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDD2BE]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFE9DC] text-[#5C4B3B] text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="mustard-gradient-btn px-5 py-2 rounded-xl text-[#FFFDF9] text-xs font-bold cursor-pointer shadow-xs"
                >
                  {editingMatnId
                    ? lang === 'ar'
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : lang === 'ar'
                    ? 'حفظ وإضافة'
                    : 'Save & Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CHAPTER ADD / EDIT MODAL INSIDE READER                            */}
      {/* ================================================================= */}
      {chapterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#FFFDF9] border-2 border-[#C88A14]/60 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 earthy-gradient-banner text-[#FFFDF9] flex items-center justify-between border-b border-[#C88A14]/40">
              <h2 className="text-base font-bold font-display-islamic">
                {editingChapterId
                  ? lang === 'ar'
                    ? 'تعديل الباب'
                    : 'Edit Chapter'
                  : lang === 'ar'
                  ? 'إضافة باب جديد'
                  : 'Add New Chapter'}
              </h2>
              <button
                type="button"
                onClick={() => setChapterModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChapter} className="p-4 overflow-y-auto space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-[#2D2218] mb-1">
                  {lang === 'ar' ? 'عنوان الباب' : 'Chapter Title'}
                </label>
                <input
                  type="text"
                  required
                  value={chapterTitleInput}
                  onChange={(e) => setChapterTitleInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2218] mb-1">
                  {lang === 'ar' ? 'شرح أو تنبيه مختصر (اختياري)' : 'Optional Note'}
                </label>
                <input
                  type="text"
                  value={chapterNoteInput}
                  onChange={(e) => setChapterNoteInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D2218] mb-1">
                  {lang === 'ar'
                    ? 'الأبيات أو الفقرات (كل سطر مقطع، وافصل الشطرين بـ | )'
                    : 'Lines / Verses (one per line, separate hemistichs with | )'}
                </label>
                <textarea
                  required
                  rows={6}
                  value={chapterItemsInput}
                  onChange={(e) => setChapterItemsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EB] border border-[#DDD2BE] text-xs leading-relaxed text-[#261C14] focus:outline-none focus:border-[#C88A14]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDD2BE]">
                <button
                  type="button"
                  onClick={() => setChapterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFE9DC] text-[#5C4B3B] text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="mustard-gradient-btn px-5 py-2 rounded-xl text-[#FFFDF9] text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ الباب' : 'Save Chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
