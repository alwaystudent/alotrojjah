import { Language } from './quranData';

export type MutunCategory = 'tajweed' | 'hadith' | 'aqeedah' | 'usool' | 'books';
export type AdhkarCategory = 'morning' | 'evening' | 'after_prayer' | 'sleep' | 'quranic_duas';

export interface MatnBayt {
  id: string;
  firstHalf: string;
  secondHalf?: string;
}

export interface MatnChapter {
  id: string;
  titleAr: string;
  titleEn: string;
  noteAr?: string;
  noteEn?: string;
  items: MatnBayt[];
}

export interface MatnItem {
  id: string;
  category: MutunCategory;
  titleAr: string;
  titleEn: string;
  authorAr: string;
  authorEn: string;
  descriptionAr: string;
  descriptionEn: string;
  chapters: MatnChapter[];
  externalUrl?: string;
  externalViewerMode?: 'direct' | 'pdf_viewer';
  isCustom?: boolean;
}

export interface DhikrItem {
  id: string;
  category: AdhkarCategory;
  titleAr: string;
  titleEn: string;
  textAr: string;
  transliterationEn?: string;
  meaningEn?: string;
  virtueAr?: string;
  virtueEn?: string;
  targetCount: number;
  sourceAr: string;
  sourceEn: string;
  isCustom?: boolean;
}

export const MUTUN_CATEGORIES: { id: MutunCategory; labelAr: string; labelEn: string }[] = [
  { id: 'tajweed', labelAr: 'التجويد والقراءات', labelEn: 'Tajweed' },
  { id: 'hadith', labelAr: 'الحديث والمصطلح', labelEn: 'Hadith' },
  { id: 'aqeedah', labelAr: 'العقيدة والتوحيد', labelEn: 'Creed' },
  { id: 'usool', labelAr: 'أصول العلم', labelEn: 'Foundations' },
  { id: 'books', labelAr: 'الكتب والمراجع', labelEn: 'External Books' },
];

export const ADHKAR_CATEGORIES: { id: AdhkarCategory; labelAr: string; labelEn: string }[] = [
  { id: 'morning', labelAr: 'أذكار الصباح', labelEn: 'Morning' },
  { id: 'evening', labelAr: 'أذكار المساء', labelEn: 'Evening' },
  { id: 'after_prayer', labelAr: 'بعد الصلاة', labelEn: 'After Prayer' },
  { id: 'sleep', labelAr: 'أذكار النوم', labelEn: 'Sleep' },
  { id: 'quranic_duas', labelAr: 'أدعية قرآنية', labelEn: 'Quranic Duas' },
];

export const INITIAL_MUTUN_LIST: MatnItem[] = [
  {
    id: 'tuhfat-al-atfal',
    category: 'tajweed',
    titleAr: 'تحفة الأطفال والغلمان في تجويد القرآن',
    titleEn: 'Tuhfat al-Atfal (Tajweed Primer)',
    authorAr: 'الإمام سليمان الجمزوري',
    authorEn: 'Imam Sulayman al-Jamzuri',
    descriptionAr: 'منظومة تعليمية ميسرة في أحكام النون الساكنة والتنوين والميم الساكنة والمدود.',
    descriptionEn: 'Accessible foundational poem covering Noon Sakinah, Meem Sakinah, and Madd rules.',
    chapters: [
      {
        id: 'tuhfah-intro',
        titleAr: 'المقدمة',
        titleEn: 'Introduction',
        noteAr: 'استهلال الناظم بالحمد والصلاة على النبي وبيان اسم المنظومة وهدفها.',
        noteEn: 'Opening praise, salutations, and purpose of the poem.',
        items: [
          {
            id: 't1',
            firstHalf: 'يَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ',
            secondHalf: 'دَوْمًا سُلَيْمَانُ هُوَ الْجَمْزُورِي',
          },
          {
            id: 't2',
            firstHalf: 'الْحَمْدُ لِلَّهِ مُصَلِّيًا عَلَى',
            secondHalf: 'مُحَمَّدٍ وَآلِهِ وَمَنْ تَلَا',
          },
          {
            id: 't3',
            firstHalf: 'وَبَعْدُ هَذَا النَّظْمُ لِلْمُرِيدِ',
            secondHalf: 'فِي النُّونِ وَالتَّنْوِينِ وَالْمُدُودِ',
          },
          {
            id: 't4',
            firstHalf: 'سَمَّيْتُهُ بِتُحْفَةِ الْأَطْفَالِ',
            secondHalf: 'عَنْ شَيْخِنَا الْمِيهِيِّ ذِي الْكَمَالِ',
          },
          {
            id: 't5',
            firstHalf: 'أَرْجُو بِهِ أَنْ يَنْفَعَ الطُّلَّابَا',
            secondHalf: 'وَالأَجْرَ وَالْقَبُولَ وَالثَّوَابَا',
          },
        ],
      },
      {
        id: 'tuhfah-noon',
        titleAr: 'أحكام النون الساكنة والتنوين',
        titleEn: 'Rules of Noon Sakinah & Tanween',
        noteAr: 'الأحكام الأربعة: الإظهار الحلقي، الإدغام (بغنة وبغير غنة)، الإقلاب، الإخفاء الحقيقي.',
        noteEn: 'Four core rules: Izhar, Idgham, Iqlab, and Ikhfa.',
        items: [
          {
            id: 'tn1',
            firstHalf: 'لِلنُّونِ إِنْ تَسْكُنْ وَلِلتَّنْوِينِ',
            secondHalf: 'أَرْبَعُ أَحْكَامٍ فَخُذْ تَبْيِينِي',
          },
          {
            id: 'tn2',
            firstHalf: 'فَالْأَوَّلُ الْإِظْهَارُ قَبْلَ أَحْرُفِ',
            secondHalf: 'لِلْحَلْقِ سِتٌّ رُتِّبَتْ فَلْتَعْرِفِ',
          },
          {
            id: 'tn3',
            firstHalf: 'هَمْزٌ فَهَاءٌ ثُمَّ عَيْنٌ حَاءُ',
            secondHalf: 'مُهْمَلَتَانِ ثُمَّ غَيْنٌ خَاءُ',
          },
          {
            id: 'tn4',
            firstHalf: 'وَالثَّانِي إِدْغَامٌ بِسِتَّةٍ أَتَتْ',
            secondHalf: 'فِي يَرْمُلُونَ عِنْدَهُمْ قَدْ ثَبَتَتْ',
          },
          {
            id: 'tn5',
            firstHalf: 'وَالثَّالِثُ الْإِقْلَابُ عِنْدَ الْبَاءِ',
            secondHalf: 'مِيمًا بِغُنَّةٍ مَعَ الْإِخْفَاءِ',
          },
          {
            id: 'tn6',
            firstHalf: 'وَالرَّابِعُ الْإِخْفَاءُ عِنْدَ الْفَاضِلِ',
            secondHalf: 'مِنَ الْحُرُوفِ وَاجِبٌ لِلْفَاضِلِ',
          },
        ],
      },
      {
        id: 'tuhfah-meem',
        titleAr: 'أحكام النون والميم المشددتين والميم الساكنة',
        titleEn: 'Ghunnah & Meem Sakinah Rules',
        items: [
          {
            id: 'tm1',
            firstHalf: 'وَغُنَّ مِيمًا ثُمَّ نُونًا شُدِّدَا',
            secondHalf: 'وَسَمِّ كُلًّا حَرْفَ غُنَّةٍ بَدَا',
          },
          {
            id: 'tm2',
            firstHalf: 'وَالْمِيمُ إِنْ تَسْكُنْ تَجِي قَبْلَ الْهِجَا',
            secondHalf: 'لَا أَلِفٍ لَيِّنَةٍ لِذِي الْحِجَا',
          },
          {
            id: 'tm3',
            firstHalf: 'أَحْكَامُهَا ثَلَاثَةٌ لِمَنْ ضَبَطْ',
            secondHalf: 'إِخْفَاءٌ ادْغَامٌ وَإِظْهَارٌ فَقَطْ',
          },
        ],
      },
      {
        id: 'tuhfah-madd',
        titleAr: 'أقسام المد وأحكامه',
        titleEn: 'Categories & Rules of Madd',
        items: [
          {
            id: 'tmd1',
            firstHalf: 'وَالْمَدُّ أَصْلِيٌّ وَفَرْعِيٌّ لَهُ',
            secondHalf: 'وَسَمِّ أَوَّلًا طَبِيعِيًّا وَهُوْ',
          },
          {
            id: 'tmd2',
            firstHalf: 'لِلْمَدِّ أَحْكَامٌ ثَلَاثَةٌ تَدُومْ',
            secondHalf: 'وَهْيَ الْوُجُوبُ وَالْجَوَازُ وَاللُّزُومْ',
          },
        ],
      },
    ],
  },
  {
    id: 'al-jazariyyah',
    category: 'tajweed',
    titleAr: 'المقدمة الجزرية فيما يجب على قارئ القرآن أن يعلمه',
    titleEn: 'Al-Muqaddimah Al-Jazariyyah',
    authorAr: 'الإمام شمس الدين ابن الجزري',
    authorEn: 'Imam Ibn al-Jazari',
    descriptionAr: 'العمدة في علم مخارج الحروف وصفاتها وأحكام التجويد والوقف والابتداء.',
    descriptionEn: 'Classic Tajweed treatise on articulation points, letter characteristics, and stopping.',
    chapters: [
      {
        id: 'jaz-intro',
        titleAr: 'المقدمة',
        titleEn: 'Opening Verses',
        items: [
          {
            id: 'j1',
            firstHalf: 'يَقُولُ رَاجِي عَفْوِ رَبٍّ سَامِعِ',
            secondHalf: 'مُحَمَّدُ بْنُ الْجَزَرِيِّ الشَّافِعِي',
          },
          {
            id: 'j2',
            firstHalf: 'الْحَمْدُ لِلَّهِ وَصَلَّى اللَّهُ',
            secondHalf: 'عَلَى نَبِيِّهِ وَمُصْطَفَاهُ',
          },
          {
            id: 'j3',
            firstHalf: 'إِذْ وَاجِبٌ عَلَيْهِمُ مُحَتَّمُ',
            secondHalf: 'قَبْلَ الشُّرُوعِ أَوَّلًا أَنْ يَعْلَمُوا',
          },
          {
            id: 'j4',
            firstHalf: 'مَخَارِجَ الْحُرُوفِ وَالصِّفَاتِ',
            secondHalf: 'لِيَلْفِظُوا بِأَفْصَحِ اللُّغَاتِ',
          },
        ],
      },
      {
        id: 'jaz-tajweed',
        titleAr: 'باب التجويد',
        titleEn: 'Chapter on Tajweed Mastery',
        items: [
          {
            id: 'jt1',
            firstHalf: 'وَالْأَخْذُ بِالتَّجْوِيدِ حَتْمٌ لَازِمُ',
            secondHalf: 'مَنْ لَمْ يُجَوِّدِ الْقُرَانَ آثِمُ',
          },
          {
            id: 'jt2',
            firstHalf: 'لِأَنَّهُ بِهِ الْإِلَهُ أَنْزَلَا',
            secondHalf: 'وَهَكَذَا مِنْهُ إِلَيْنَا وَصَلَا',
          },
          {
            id: 'jt3',
            firstHalf: 'وَهُوَ إِعْطَاءُ الْحُرُوفِ حَقَّهَا',
            secondHalf: 'مِنْ صِفَةٍ لَهَا وَمُسْتَحَقَّهَا',
          },
          {
            id: 'jt4',
            firstHalf: 'وَرَدُّ كُلِّ وَاحِدٍ لِأَصْلِهِ',
            secondHalf: 'وَاللَّفْظُ فِي نَظِيرِهِ كَمِثْلِهِ',
          },
        ],
      },
    ],
  },
  {
    id: 'al-bayquniyyah',
    category: 'hadith',
    titleAr: 'المنظومة البيقونية في مصطلح الحديث',
    titleEn: 'Al-Manzumah al-Bayquniyyah',
    authorAr: 'الإمام عمر بن محمد البيقوني',
    authorEn: 'Imam Umar al-Bayquni',
    descriptionAr: 'منظومة مختصرة جامعة لأقسام الحديث النبوي الشريف ومصطلحاته الأساسية.',
    descriptionEn: 'Concise classical poem introducing Hadith classifications and terminology.',
    chapters: [
      {
        id: 'bayq-start',
        titleAr: 'مقدمة المنظومة والحديث الصحيح والحسن والضعيف',
        titleEn: 'Introduction & Main Classifications',
        items: [
          {
            id: 'b1',
            firstHalf: 'أَبْدَأُ بِالْحَمْدِ مُصَلِّيًا عَلَى',
            secondHalf: 'مُحَمَّدٍ خَيْرِ نَبِيٍّ أُرْسِلَا',
          },
          {
            id: 'b2',
            firstHalf: 'وَذِي مِنَ أَقْسَامِ الْحَدِيثِ عِدَّةْ',
            secondHalf: 'وَكُلُّ وَاحِدٍ أَتَى وَحَدَّهْ',
          },
          {
            id: 'b3',
            firstHalf: 'أَوَّلُهَا الصَّحِيحُ وَهْوَ مَا اتَّصَلْ',
            secondHalf: 'إِسْنَادُهُ وَلَمْ يُشَذَّ أَوْ يُعَلْ',
          },
          {
            id: 'b4',
            firstHalf: 'وَالْحَسَنُ الْمَعْرُوفُ طُرْقًا وَغَدَتْ',
            secondHalf: 'رِجَالُهُ لَا كَالصَّحِيحِ اشْتَهَرَتْ',
          },
          {
            id: 'b5',
            firstHalf: 'وَكُلُّ مَا عَنْ رُتْبَةِ الْحُسْنِ قَصُرْ',
            secondHalf: 'فَهْوَ الضَّعِيفُ وَهْوَ أَقْسَامًا كَثُرْ',
          },
        ],
      },
    ],
  },
  {
    id: 'al-arbain-selected',
    category: 'hadith',
    titleAr: 'جوامع من الأربعين النووية',
    titleEn: 'Core Selections from 40 Hadith Nawawi',
    authorAr: 'الإمام يحيى بن شرف النووي',
    authorEn: 'Imam Yahya ibn Sharaf al-Nawawi',
    descriptionAr: 'أحاديث جامعة لقواعد الدين وأصول السلوك والنية والإخلاص.',
    descriptionEn: 'Foundational Prophetic narrations covering intention, faith, and ethics.',
    chapters: [
      {
        id: 'nawawi-1',
        titleAr: 'الحديث الأول: الأعمال بالنيات',
        titleEn: 'Hadith 1: Actions are by Intentions',
        noteAr: 'رواه أمير المؤمنين أبو حفص عمر بن الخطاب رضي الله عنه.',
        noteEn: 'Narrated by Umar ibn al-Khattab (RA) - Sahih al-Bukhari & Muslim.',
        items: [
          {
            id: 'n1',
            firstHalf: '«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ».',
          },
        ],
      },
      {
        id: 'nawawi-18',
        titleAr: 'الحديث الثامن عشر: تقوى الله وحسن الخلق',
        titleEn: 'Hadith 18: Taqwa & Good Character',
        noteAr: 'رواه أبو ذر وجندب بن جنادة ومعاذ بن جبل رضي الله عنهم.',
        noteEn: 'Narrated by Abu Dharr & Muadh ibn Jabal (RA) - At-Tirmidhi.',
        items: [
          {
            id: 'n18',
            firstHalf: '«اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ».',
          },
        ],
      },
      {
        id: 'nawawi-19',
        titleAr: 'الحديث التاسع عشر: احفظ الله يحفظك',
        titleEn: 'Hadith 19: Be Mindful of Allah',
        noteAr: 'رواه عبد الله بن عباس رضي الله عنهما.',
        noteEn: 'Narrated by Abdullah ibn Abbas (RA) - At-Tirmidhi.',
        items: [
          {
            id: 'n19',
            firstHalf: '«يَا غُلَامُ إِنِّي أُعَلِّمُكَ كَلِمَاتٍ: احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ، إِذَا سَأَلْتَ فَاسْأَلِ اللَّهَ، وَإِذَا اسْتَعَنْتَ فَاسْتَعِنْ بِاللَّهِ...».',
          },
        ],
      },
    ],
  },
  {
    id: 'adab-hamalat-quran',
    category: 'usool',
    titleAr: 'قواعد في آداب حامل القرآن وحفظه',
    titleEn: 'Etiquettes of the Quran Carrier',
    authorAr: 'خلاصة مستقاة من التبيان للإمام النووي',
    authorEn: 'Summary inspired by Imam al-Nawawi',
    descriptionAr: 'ضوابط عملية للإخلاص والمواظبة وتعاهد المحفوظ وتدبر الآيات.',
    descriptionEn: 'Practical principles for sincerity, regular review, and contemplation.',
    chapters: [
      {
        id: 'adab-ch1',
        titleAr: 'الإخلاص وتصحيح النية وتعاهد القرآن',
        titleEn: 'Sincerity & Consistent Review',
        items: [
          {
            id: 'ad1',
            firstHalf: 'تصفية النية لله تعالى قبل كل وردٍ، واجتناب طلب الجاه أو الثناء بالقرآن.',
          },
          {
            id: 'ad2',
            firstHalf: 'المحافظة على السرد اليومي والمراجعة المتصلة؛ لأن القرآن أشد تفلتاً من الإبل في عقلها.',
          },
          {
            id: 'ad3',
            firstHalf: 'القراءة بخشوع وطمأنينة وتدبر معاني الآيات مع الالتزام بأحكام التجويد.',
          },
        ],
      },
    ],
  },
];

export const INITIAL_ADHKAR_LIST: DhikrItem[] = [
  // Morning Adhkar
  {
    id: 'adh-morning-kursi',
    category: 'morning',
    titleAr: 'آية الكرسي',
    titleEn: 'Ayat al-Kursi',
    textAr:
      'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ: ﴿اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ﴾.',
    meaningEn: 'The Verse of the Throne (Surah Al-Baqarah 2:255).',
    virtueAr: 'من قالها حين يصبح أُجير من الجن حتى يمسي.',
    virtueEn: 'Protection throughout the day until evening.',
    targetCount: 1,
    sourceAr: 'سورة البقرة: 255',
    sourceEn: 'Quran 2:255',
  },
  {
    id: 'adh-morning-sayyid',
    category: 'morning',
    titleAr: 'سيد الاستغفار',
    titleEn: 'Master Supplication for Forgiveness',
    textAr:
      '«اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ».',
    meaningEn: 'O Allah, You are my Lord, none has the right to be worshipped except You.',
    virtueAr: 'من قالها موقناً بها حين يمسي أو يصبح فمات من يومه دخل الجنة.',
    virtueEn: 'The greatest supplication for seeking forgiveness.',
    targetCount: 1,
    sourceAr: 'صحيح البخاري',
    sourceEn: 'Sahih al-Bukhari',
  },
  {
    id: 'adh-morning-asbahna',
    category: 'morning',
    titleAr: 'أصبحنا وأصبح الملك لله',
    titleEn: 'Morning Remembrance of Sovereignty',
    textAr:
      '«أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ».',
    meaningEn: 'We have reached the morning and all sovereignty belongs to Allah.',
    targetCount: 1,
    sourceAr: 'صحيح مسلم',
    sourceEn: 'Sahih Muslim',
  },
  {
    id: 'adh-morning-bismillah',
    category: 'morning',
    titleAr: 'بسم الله الذي لا يضر مع اسمه شيء',
    titleEn: 'Seeking Protection by the Name of Allah',
    textAr:
      '«بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ».',
    meaningEn: 'In the name of Allah, with whose name nothing on earth or in heaven can harm.',
    virtueAr: 'من قالها ثلاثاً إذا أصبح لم تضره فجأة بلاء حتى يمسي.',
    virtueEn: 'Recited 3 times for protection.',
    targetCount: 3,
    sourceAr: 'أبو داود والترمذي',
    sourceEn: 'Abu Dawud & Tirmidhi',
  },
  {
    id: 'adh-morning-tasbih',
    category: 'morning',
    titleAr: 'سبحان الله وبحمده',
    titleEn: 'SubhanAllah wa Bihamdihi',
    textAr: '«سُبْحَانَ اللَّهِ وَبِحَمْدِهِ».',
    meaningEn: 'Glory be to Allah and praise Him.',
    virtueAr: 'من قالها مائة مرة حُطّت خطاياه وإن كانت مثل زبد البحر.',
    virtueEn: 'Recited 100 times morning and evening.',
    targetCount: 100,
    sourceAr: 'متفق عليه',
    sourceEn: 'Bukhari & Muslim',
  },

  // Evening Adhkar
  {
    id: 'adh-evening-amsayna',
    category: 'evening',
    titleAr: 'أمسينا وأمسى الملك لله',
    titleEn: 'Evening Remembrance of Sovereignty',
    textAr:
      '«أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا».',
    meaningEn: 'We have reached the evening and all sovereignty belongs to Allah.',
    targetCount: 1,
    sourceAr: 'صحيح مسلم',
    sourceEn: 'Sahih Muslim',
  },
  {
    id: 'adh-evening-hasbi',
    category: 'evening',
    titleAr: 'حسبي الله لا إله إلا هو',
    titleEn: 'Sufficiency in Allah',
    textAr:
      '«حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ».',
    meaningEn: 'Allah is sufficient for me; upon Him I rely.',
    virtueAr: 'من قالها حين يصبح وحين يمسي سبع مرات كفاه الله ما أهمه.',
    virtueEn: 'Recited 7 times for sufficiency against worry.',
    targetCount: 7,
    sourceAr: 'أبو داود',
    sourceEn: 'Abu Dawud',
  },
  {
    id: 'adh-evening-raditu',
    category: 'evening',
    titleAr: 'رضيت بالله رباً',
    titleEn: 'Contentment with Allah',
    textAr: '«رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا».',
    meaningEn: 'I am pleased with Allah as my Lord, Islam as my religion, and Muhammad as my Prophet.',
    targetCount: 3,
    sourceAr: 'أحمد والترمذي',
    sourceEn: 'Ahmad & Tirmidhi',
  },

  // After Prayer
  {
    id: 'adh-prayer-istighfar',
    category: 'after_prayer',
    titleAr: 'الاستغفار والسلام بعد الصلاة',
    titleEn: 'Istighfar & Peace After Salah',
    textAr:
      '«أَسْتَغْفِرُ اللَّهَ (ثلاثاً)، اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ».',
    meaningEn: 'I seek Allah forgiveness (3x). O Allah, You are Peace and from You comes peace.',
    targetCount: 3,
    sourceAr: 'صحيح مسلم',
    sourceEn: 'Sahih Muslim',
  },
  {
    id: 'adh-prayer-tasbih33',
    category: 'after_prayer',
    titleAr: 'التسبيح والتحميد والتكبير',
    titleEn: 'Tasbih, Tahmid & Takbir (33x)',
    textAr: '«سُبْحَانَ اللَّهِ» (33) · «الْحَمْدُ لِلَّهِ» (33) · «اللَّهُ أَكْبَرُ» (33).',
    meaningEn: 'SubhanAllah (33), Alhamdulillah (33), Allahu Akbar (33).',
    virtueAr: 'مع تمام المائة بقول: لا إله إلا الله وحده لا شريك له...',
    virtueEn: 'Followed by La ilaha illAllah to complete 100.',
    targetCount: 33,
    sourceAr: 'صحيح مسلم',
    sourceEn: 'Sahih Muslim',
  },

  // Sleep Adhkar
  {
    id: 'adh-sleep-bismika',
    category: 'sleep',
    titleAr: 'باسمك اللهم أموت وأحيا',
    titleEn: 'Supplication Before Sleep',
    textAr: '«بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا».',
    meaningEn: 'In Your name, O Allah, I die and I live.',
    targetCount: 1,
    sourceAr: 'صحيح البخاري',
    sourceEn: 'Sahih al-Bukhari',
  },
  {
    id: 'adh-sleep-qini',
    category: 'sleep',
    titleAr: 'اللهم قني عذابك',
    titleEn: 'Protection on the Day of Resurrection',
    textAr: '«اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ».',
    meaningEn: 'O Allah, protect me from Your punishment on the Day You resurrect Your servants.',
    targetCount: 3,
    sourceAr: 'أبو داود والترمذي',
    sourceEn: 'Abu Dawud & Tirmidhi',
  },

  // Quranic Duas
  {
    id: 'adh-dua-knowledge',
    category: 'quranic_duas',
    titleAr: 'دعاء الزيادة في العلم',
    titleEn: 'Supplication for Knowledge',
    textAr: '﴿رَّبِّ زِدْنِي عِلْمًا﴾.',
    meaningEn: 'My Lord, increase me in knowledge.',
    targetCount: 1,
    sourceAr: 'سورة طه: 114',
    sourceEn: 'Quran 20:114',
  },
  {
    id: 'adh-dua-steadfast',
    category: 'quranic_duas',
    titleAr: 'دعاء الثبات والرحمة',
    titleEn: 'Supplication for Steadfast Hearts',
    textAr: '﴿رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ الْوَهَّابُ﴾.',
    meaningEn: 'Our Lord, let not our hearts deviate after You have guided us.',
    targetCount: 1,
    sourceAr: 'سورة آل عمران: 8',
    sourceEn: 'Quran 3:8',
  },
  {
    id: 'adh-dua-hasana',
    category: 'quranic_duas',
    titleAr: 'دعاء خيري الدنيا والآخرة',
    titleEn: 'Supplication for Good in Both Worlds',
    textAr: '﴿رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ﴾.',
    meaningEn: 'Our Lord, grant us good in this world and good in the Hereafter.',
    targetCount: 1,
    sourceAr: 'سورة البقرة: 201',
    sourceEn: 'Quran 2:201',
  },
];

export function getMutunCategoryLabel(cat: MutunCategory, lang: Language): string {
  const found = MUTUN_CATEGORIES.find((c) => c.id === cat);
  return found ? (lang === 'ar' ? found.labelAr : found.labelEn) : cat;
}

export function getAdhkarCategoryLabel(cat: AdhkarCategory, lang: Language): string {
  const found = ADHKAR_CATEGORIES.find((c) => c.id === cat);
  return found ? (lang === 'ar' ? found.labelAr : found.labelEn) : cat;
}
