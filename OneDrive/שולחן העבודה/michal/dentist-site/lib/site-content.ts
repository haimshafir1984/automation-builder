import { promises as fs } from "fs";
import path from "path";
import { isThemePresetId, THEME_PRESETS, type ThemePresetId } from "@/lib/theme-presets";

export type Item = { title: string; text: string; badge?: string };
export type FaqItem = { q: string; a: string };
export type TestimonialItem = { name: string; text: string };
export type PublicationItem = {
  title: string;
  year: number;
  journal: string;
  doi?: string;
  doiUrl?: string;
  pubmedUrl?: string;
};

export type SiteContent = {
  shared: {
    doctorName: string;
    specialty: string;
    navCtaLabel: string;
    logoImageUrl?: string;
    theme: {
      presetId: ThemePresetId;
      primaryColor: string;
      accentColor: string;
      fontFamily: "heebo" | "rubik" | "assistant";
    };
    address: string;
    phone: string;
    mobile: string;
    whatsapp?: string;
    email: string;
    social: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
    };
    mapEmbedUrl?: string;
    footerTagline: string;
    footerDisclaimer: string;
  };
  home: {
    pill: string;
    heroTitle: string;
    heroSubtitle: string;
    primaryCta: string;
    secondaryCta: string;
    heroImageUrl?: string;
    valueCards: Item[];
    clinicalTitle: string;
    clinicalBullets: string[];
    professionalMessageTitle: string;
    professionalMessage: string;
    treatmentsTitle: string;
    treatmentsSubtitle: string;
    treatmentsCards: Item[];
    processTitle: string;
    processSubtitle: string;
    processSteps: Item[];
    testimonialsTitle: string;
    testimonialsSubtitle: string;
    faqTitle: string;
    faqSubtitle: string;
    bottomCtaTitle: string;
    bottomCtaSubtitle: string;
    bottomCtaButton: string;
  };
  about: {
    title: string;
    subtitle: string;
    profileImageUrl?: string;
    introTitle: string;
    introText: string;
    introBullets: string[];
    approachTitle: string;
    approachText: string;
    approachItems: Item[];
    principlesTitle: string;
    principles: Item[];
  };
  treatments: {
    title: string;
    subtitle: string;
    cards: Item[];
    suitableTitle: string;
    suitableText: string;
    ctaLabel: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    factors: Item[];
    summary: string;
    ctaLabel: string;
  };
  contact: {
    title: string;
    subtitle: string;
    infoTitle: string;
    prepTitle: string;
    prepItems: string[];
    formLabels: {
      fullName: string;
      phone: string;
      email: string;
      preferredTime: string;
      message: string;
      submit: string;
      loading: string;
      privacy: string;
      fullNamePlaceholder: string;
      phonePlaceholder: string;
      emailPlaceholder: string;
      messagePlaceholder: string;
    };
  };
  faq: {
    items: FaqItem[];
  };
  testimonials: {
    badgeLabel: string;
    items: TestimonialItem[];
  };
  publications: {
    title: string;
    subtitle: string;
    items: PublicationItem[];
  };
};

export const editableSections = [
  "shared",
  "home",
  "about",
  "treatments",
  "pricing",
  "contact",
  "faq",
  "testimonials",
  "publications"
] as const;

export type EditableSection = (typeof editableSections)[number];

export const defaultSiteContent: SiteContent = {
  shared: {
    doctorName: "ד״ר בני פרדמן",
    specialty: "מומחה לשיקום הפה",
    navCtaLabel: "לתיאום ייעוץ",
    logoImageUrl: "",
    theme: {
      presetId: THEME_PRESETS.medical.id,
      primaryColor: THEME_PRESETS.medical.primaryColor,
      accentColor: THEME_PRESETS.medical.accentColor,
      fontFamily: THEME_PRESETS.medical.fontFamily
    },
    address: "הנדיב 71, הרצליה",
    phone: "09-7790809",
    mobile: "053-4534916",
    whatsapp: "053-4534916",
    email: "benny.ferdman@gmail.com",
    social: {
      facebook: "",
      instagram: "",
      linkedin: ""
    },
    mapEmbedUrl:
      "https://www.google.com/maps?q=%D7%94%D7%A0%D7%93%D7%99%D7%91+71+%D7%94%D7%A8%D7%A6%D7%9C%D7%99%D7%94&output=embed",
    footerTagline:
      "שיקום הפה בגישה רפואית מדויקת, תכנון דיגיטלי מתקדם, פתרונות למקרים מורכבים ויחס אישי רגוע.",
    footerDisclaimer:
      "התוכן באתר אינו מהווה ייעוץ רפואי. אבחון יינתן בבדיקה בלבד."
  },
  home: {
    pill: "ד״ר בני פרדמן • מומחה לשיקום הפה • הרצליה",
    heroTitle: "שיקום הפה ואסתטיקה דנטלית בהרצליה",
    heroSubtitle: "תכנון דיגיטלי, דיוק, ויחס אישי רגוע — משלב האבחון ועד החיוך.",
    primaryCta: "לתיאום ייעוץ",
    secondaryCta: "תחומי טיפול",
    heroImageUrl: "",
    valueCards: [
      { title: "מומחה בשיקום הפה", text: "דיוק שיקומי במקרים פשוטים ומורכבים" },
      { title: "תכנון דיגיטלי מתקדם", text: "קבלת החלטות על בסיס תכנון והדמיה" },
      { title: "תהליך מסודר וליווי אישי", text: "שקיפות מלאה ותיאום ציפיות בכל שלב" }
    ],
    clinicalTitle: "הגישה הקלינית",
    clinicalBullets: [
      "אבחון יסודי ותיאום ציפיות רפואי",
      "תכנון שיקומי דיגיטלי לכל מקרה",
      "התאמה אישית של פתרונות אסתטיים ותפקודיים",
      "ביצוע מדורג ושמירה על נוחות לאורך התהליך",
      "בקרה ומעקב לטווח ארוך"
    ],
    professionalMessageTitle: "מסר מקצועי",
    professionalMessage:
      "שיקום הפה בגישה רפואית מדויקת, תכנון דיגיטלי מתקדם, פתרונות למקרים מורכבים, יחס אישי רגוע.",
    treatmentsTitle: "תחומי טיפול עיקריים",
    treatmentsSubtitle:
      "שיקום ואסתטיקה דנטלית המותאמים למצב הרפואי, לצורך התפקודי ולמטרות האסתטיות.",
    treatmentsCards: [
      {
        title: "שיקום פה מורכב",
        text: "בניית תכנית טיפול מלאה למקרים עם שחיקה, שיניים חסרות או שחזורים מרובים.",
        badge: "שיקום"
      },
      {
        title: "שיקום על גבי שתלים",
        text: "תכנון וביצוע שיקומי מדויק על שתלים כחלק ממענה תפקודי ואסתטי.",
        badge: "שתלים"
      },
      {
        title: "כתרים ושחזורים אסתטיים",
        text: "שחזורים מתקדמים כמו זירקוניה/חרסינה לשילוב בין חוזק, נראות ונוחות.",
        badge: "אסתטיקה"
      },
      {
        title: "תכנון דיגיטלי וסריקה ממוחשבת",
        text: "שימוש בכלים דיגיטליים לצורך תכנון מדויק, הדמיה ושיפור חוויית הטיפול.",
        badge: "דיגיטלי"
      },
      {
        title: "פתרונות לחוסר שיניים",
        text: "בחירת פתרון מותאם אישית לשיקום לעיסה, יציבות ואסתטיקה.",
        badge: "פתרונות"
      },
      {
        title: "שיפור חיוך בגישה רפואית",
        text: "תכנון שמרני עם דגש על תוצאה טבעית, תפקוד נכון ושמירה על רקמות השן.",
        badge: "גישה אישית"
      }
    ],
    processTitle: "איך זה עובד",
    processSubtitle: "תהליך מסודר שמתחיל באבחון וממשיך לביצוע מדורג ובקרה לאורך זמן.",
    processSteps: [
      { title: "1. אבחון", text: "בדיקה קלינית, איסוף נתונים והגדרת מטרות טיפול." },
      { title: "2. תכנון דיגיטלי", text: "בניית תכנית טיפול מדויקת עם חלופות ברורות." },
      { title: "3. ביצוע מדורג", text: "יישום התכנית בשלבים, בקצב מותאם ונוח." },
      { title: "4. בקרה ותחזוקה", text: "מעקב והנחיות לשמירה על התוצאה לאורך זמן." }
    ],
    testimonialsTitle: "מה אומרים מטופלים",
    testimonialsSubtitle: "דוגמאות כלליות לצורך המחשה.",
    faqTitle: "שאלות נפוצות",
    faqSubtitle: "תשובות קצרות בנושאים נפוצים בשיקום הפה ותהליך הטיפול.",
    bottomCtaTitle: "לתכנון שיקומי מדויק מתחילים באבחון",
    bottomCtaSubtitle: "אפשר להשאיר פרטים ונחזור לתיאום ייעוץ אישי.",
    bottomCtaButton: "לתיאום ייעוץ"
  },
  about: {
    title: "אודות ד״ר בני פרדמן",
    subtitle:
      "מומחה לשיקום הפה ואסתטיקה דנטלית, עם דגש על תכנון מדויק, שקיפות קלינית ויחס אישי רגוע.",
    profileImageUrl: "",
    introTitle: "ד״ר בני פרדמן",
    introText:
      "ד״ר בני פרדמן מטפל במקרים שיקומיים ותפקודיים, כולל מקרים מורכבים הדורשים ראייה רחבה ותכנון רב-שלבי. תהליך העבודה משלב אבחון מעמיק, תכנון דיגיטלי, ושיח מקצועי ברור עם המטופל לכל אורך הדרך.",
    introBullets: [
      "מומחה לשיקום הפה ואסתטיקה דנטלית",
      "טיפול במקרים מורכבים עם תכנון פרטני",
      "גישה רפואית מדויקת עם תקשורת בגובה העיניים"
    ],
    approachTitle: "גישה טיפולית",
    approachText:
      "בכל תכנית טיפול מושם דגש על תפקוד, אסתטיקה ויציבות לטווח ארוך. לפני כל שלב מוצגות האפשרויות, המשמעויות והשלבים הבאים בצורה ברורה.",
    approachItems: [
      { title: "שקיפות ותיאום ציפיות", text: "הסבר קליני ברור על החלופות, השלבים וההחלטות הטיפוליות." },
      { title: "תכנון קפדני", text: "תכנון שיקומי דיגיטלי והגדרה מדויקת של מטרות טיפול." },
      { title: "אקדמיה ומחקר", text: "מעורבות מתמשכת בתחומי חומרים דנטליים והדבקה כחלק מחשיבה קלינית עדכנית." }
    ],
    principlesTitle: "עקרונות עבודה",
    principles: [
      { title: "דיוק רפואי", text: "קבלת החלטות קליניות על בסיס אבחון יסודי ותכנון מדויק." },
      { title: "שמרנות", text: "בחירה בפתרונות שמאזנים בין שיקום איכותי לשמירה על רקמות בריאות." },
      { title: "אסתטיקה טבעית", text: "תוצאה הרמונית שמתאימה למבנה הפנים ולחיוך האישי של כל מטופל." },
      { title: "תיאום ציפיות", text: "שיח פתוח וברור על תהליך, שלבים ויעדים קליניים לפני תחילת הטיפול." }
    ]
  },
  treatments: {
    title: "תחומי טיפול",
    subtitle: "שיקום הפה ואסתטיקה דנטלית בגישה קלינית מדויקת, עם תכנון אישי לכל מקרה.",
    cards: [
      { title: "בדיקה מקיפה + תכנית טיפול", text: "אבחון מקיף ותכנון שיקומי מדורג הכולל מטרות תפקוד ואסתטיקה.", badge: "אבחון" },
      { title: "שיקום פה מורכב", text: "פתרונות שיקומיים למקרים עם שחיקה, חסרים מרובים או שחזורים ישנים.", badge: "שיקום" },
      { title: "שיקום על גבי שתלים", text: "תכנון וביצוע שחזורים על שתלים תוך התאמה תפקודית ואסתטית.", badge: "שתלים" },
      { title: "כתרים ושחזורים אסתטיים", text: "שחזורים מתקדמים (זירקוניה/חרסינה) לשיפור יציבות, נראות ונוחות.", badge: "אסתטיקה" },
      { title: "תכנון דיגיטלי וסריקה ממוחשבת", text: "שימוש בכלים דיגיטליים לצורך תכנון מדויק וקבלת החלטות קלינית מבוססת.", badge: "דיגיטלי" },
      { title: "פתרונות לחוסר שיניים", text: "התאמת אפשרות טיפולית לפי מצב הלסת, עומסים תפקודיים ומטרות המטופל.", badge: "פתרונות" }
    ],
    suitableTitle: "למי זה מתאים?",
    suitableText:
      "למטופלים עם שחזורים ישנים, שיניים חסרות, קושי בלעיסה, שחיקה מתקדמת או רצון לשיפור אסתטיקת החיוך במסגרת תכנית רפואית מסודרת.",
    ctaLabel: "לתיאום ייעוץ"
  },
  pricing: {
    title: "איך נקבעת עלות הטיפול",
    subtitle: "במקום מחירון קשיח, העלות נקבעת לאחר בדיקה קלינית ותכנון אישי בהתאם למאפייני המקרה.",
    factors: [
      { title: "מורכבות קלינית", text: "רמת המורכבות הרפואית והצורך בשלבים שיקומיים מרובים." },
      { title: "מספר השיניים המעורבות", text: "היקף האזור המטופל משפיע על משך התהליך והיקף העבודה." },
      { title: "סוג השחזור הנדרש", text: "בחירת חומרים וטכניקות (כגון זירקוניה/חרסינה) מותאמת לכל מקרה." },
      { title: "רכיבים משלימים", text: "במקרים מסוימים נדרשים שתלים, מעבדה או הליכים משלימים נוספים." },
      { title: "מספר שלבי הטיפול", text: "תכנית טיפול מדורגת כוללת שלבים שונים של תכנון, ביצוע ובקרה." }
    ],
    summary:
      "לאחר בדיקה ותיאום ציפיות מתקבלת הערכה מסודרת הכוללת שלבים קליניים, אפשרויות טיפול ועלויות צפויות.",
    ctaLabel: "לקבלת הערכה מסודרת לאחר בדיקה"
  },
  contact: {
    title: "תיאום ייעוץ",
    subtitle: "השאירו פרטים ונחזור אליכם לתיאום שיחה ראשונית.",
    infoTitle: "פרטי קשר",
    prepTitle: "לפני פגישת ייעוץ",
    prepItems: ["רשימת תרופות קבועות", "רגישויות ידועות", "צילומים או סיכומים קודמים אם קיימים"],
    formLabels: {
      fullName: "שם מלא",
      phone: "טלפון לחזרה",
      email: "אימייל (אופציונלי)",
      preferredTime: "מועד מועדף לחזרה",
      message: "סיבת הפנייה",
      submit: "חזרו אליי",
      loading: "שולח...",
      privacy:
        "אין לשלוח מידע רפואי רגיש בטופס. במקרה חירום רפואי יש לפנות למוקד מתאים.",
      fullNamePlaceholder: "שם מלא",
      phonePlaceholder: "05x-xxxxxxx",
      emailPlaceholder: "name@email.com",
      messagePlaceholder: "תיאור קצר של הצורך או המטרה לטיפול"
    }
  },
  faq: {
    items: [
      {
        q: "כמה זמן נמשך תהליך שיקום הפה?",
        a: "משך הטיפול משתנה לפי מורכבות המקרה. לאחר בדיקה ותכנון תקבלו סדר שלבים ברור ולוחות זמנים משוערים."
      },
      {
        q: "כמה מפגשים נדרשים בדרך כלל?",
        a: "לעיתים מדובר במספר מצומצם של מפגשים ולעיתים בתהליך מדורג. התכנית מותאמת אישית למצב הקליני וליעדי הטיפול."
      },
      {
        q: "האם הטיפול כרוך בכאב?",
        a: "הטיפולים מבוצעים עם אלחוש מקומי וטכניקות עדינות לפי צורך, תוך הקפדה על נוחות המטופל לאורך כל התהליך."
      },
      {
        q: "איך שומרים על תוצאות הטיפול?",
        a: "בסיום התהליך ניתנות הנחיות תחזוקה וביקורות תקופתיות, כדי לשמור על תפקוד ואסתטיקה לאורך זמן."
      }
    ]
  },
  testimonials: {
    badgeLabel: "דוגמאות כלליות",
    items: [
      { name: "מטופל/ת", text: "הרגשתי שיש תהליך מסודר, הסבר ברור ויחס אישי לכל אורך הטיפול." },
      { name: "מטופל/ת", text: "התכנון היה מדויק, הביצוע רגוע, והתוצאה נראית טבעית." },
      { name: "מטופל/ת", text: "קיבלתי מענה מקצועי למקרה מורכב ותחושת ביטחון לאורך כל הדרך." }
    ]
  },
  publications: {
    title: "אקדמיה ופרסומים",
    subtitle: "מעורבות מחקרית ופרסומים בתחום החומרים הדנטליים והדבקה לדנטין (דוגמאות).",
    items: [
      {
        title:
          "Effect of Silica-Modified Aluminum Oxide Abrasion on Adhesion to Dentin, Using Total-Etch and Self-Etch Systems",
        year: 2023,
        journal: "Polymers",
        doi: "10.3390/polym15020446",
        doiUrl: "https://doi.org/10.3390/polym15020446",
        pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/36679840/"
      },
      {
        title: "Ultrastructure and bonding properties of tribochemical silica-coated zirconia",
        year: 2018,
        journal: "Dental Materials Journal",
        doi: "10.4012/dmj.2017-397",
        doiUrl: "https://doi.org/10.4012/dmj.2017-397"
      }
    ]
  }
};

function normalizeContent(data: Partial<SiteContent> | null | undefined): SiteContent {
  const theme = {
    ...defaultSiteContent.shared.theme,
    ...data?.shared?.theme
  };
  const safeTheme = {
    presetId: isThemePresetId(theme.presetId)
      ? theme.presetId
      : defaultSiteContent.shared.theme.presetId,
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(theme.primaryColor)
      ? theme.primaryColor
      : defaultSiteContent.shared.theme.primaryColor,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(theme.accentColor)
      ? theme.accentColor
      : defaultSiteContent.shared.theme.accentColor,
    fontFamily: ["assistant", "heebo", "rubik"].includes(theme.fontFamily)
      ? theme.fontFamily
      : defaultSiteContent.shared.theme.fontFamily
  } as SiteContent["shared"]["theme"];

  return {
    ...defaultSiteContent,
    ...data,
    shared: {
      ...defaultSiteContent.shared,
      ...data?.shared,
      social: {
        ...defaultSiteContent.shared.social,
        ...data?.shared?.social
      },
      theme: safeTheme
    },
    home: {
      ...defaultSiteContent.home,
      ...data?.home,
      valueCards: Array.isArray(data?.home?.valueCards)
        ? data.home.valueCards
        : defaultSiteContent.home.valueCards,
      clinicalBullets: Array.isArray(data?.home?.clinicalBullets)
        ? data.home.clinicalBullets
        : defaultSiteContent.home.clinicalBullets,
      treatmentsCards: Array.isArray(data?.home?.treatmentsCards)
        ? data.home.treatmentsCards
        : defaultSiteContent.home.treatmentsCards,
      processSteps: Array.isArray(data?.home?.processSteps)
        ? data.home.processSteps
        : defaultSiteContent.home.processSteps
    },
    about: {
      ...defaultSiteContent.about,
      ...data?.about,
      introBullets: Array.isArray(data?.about?.introBullets)
        ? data.about.introBullets
        : defaultSiteContent.about.introBullets,
      approachItems: Array.isArray(data?.about?.approachItems)
        ? data.about.approachItems
        : defaultSiteContent.about.approachItems,
      principles: Array.isArray(data?.about?.principles)
        ? data.about.principles
        : defaultSiteContent.about.principles
    },
    treatments: {
      ...defaultSiteContent.treatments,
      ...data?.treatments,
      cards: Array.isArray(data?.treatments?.cards)
        ? data.treatments.cards
        : defaultSiteContent.treatments.cards
    },
    pricing: {
      ...defaultSiteContent.pricing,
      ...data?.pricing,
      factors: Array.isArray(data?.pricing?.factors)
        ? data.pricing.factors
        : defaultSiteContent.pricing.factors
    },
    contact: {
      ...defaultSiteContent.contact,
      ...data?.contact,
      prepItems: Array.isArray(data?.contact?.prepItems)
        ? data.contact.prepItems
        : defaultSiteContent.contact.prepItems,
      formLabels: {
        ...defaultSiteContent.contact.formLabels,
        ...data?.contact?.formLabels
      }
    },
    faq: {
      items: Array.isArray(data?.faq?.items) ? data.faq.items : defaultSiteContent.faq.items
    },
    testimonials: {
      badgeLabel: data?.testimonials?.badgeLabel || defaultSiteContent.testimonials.badgeLabel,
      items: Array.isArray(data?.testimonials?.items)
        ? data.testimonials.items
        : defaultSiteContent.testimonials.items
    },
    publications: {
      ...defaultSiteContent.publications,
      ...data?.publications,
      items: Array.isArray(data?.publications?.items)
        ? data.publications.items
        : defaultSiteContent.publications.items
    }
  };
}

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "content.json");
const legacyFilePath = path.join(dataDir, "site-content.json");

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultSiteContent;
    }
    return normalizeContent(parsed);
  } catch {
    try {
      const rawLegacy = await fs.readFile(legacyFilePath, "utf8");
      const parsedLegacy = JSON.parse(rawLegacy);
      if (!parsedLegacy || typeof parsedLegacy !== "object") {
        return defaultSiteContent;
      }
      return normalizeContent(parsedLegacy);
    } catch {
      return defaultSiteContent;
    }
  }
}

export async function writeSiteContent(content: SiteContent): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf8");
}

export async function updateSiteContentSection(
  section: EditableSection,
  value: unknown
): Promise<SiteContent> {
  const current = await getSiteContent();
  const next: SiteContent = { ...current, [section]: value } as SiteContent;
  const normalized = normalizeContent(next);
  await writeSiteContent(normalized);
  return normalized;
}
