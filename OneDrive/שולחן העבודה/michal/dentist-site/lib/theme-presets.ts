export const THEME_PRESETS = {
  medical: {
    id: "medical",
    label: "רפואי נקי (כחול)",
    primaryColor: "#0369a1",
    accentColor: "#0ea5e9",
    fontFamily: "assistant"
  },
  premium: {
    id: "premium",
    label: "יוקרתי קלאסי (סגול)",
    primaryColor: "#6d28d9",
    accentColor: "#a855f7",
    fontFamily: "rubik"
  },
  calm: {
    id: "calm",
    label: "עדין טבעי (ירקרק)",
    primaryColor: "#0f766e",
    accentColor: "#14b8a6",
    fontFamily: "heebo"
  }
} as const;

export type ThemePresetId = keyof typeof THEME_PRESETS;

export function isThemePresetId(value: string): value is ThemePresetId {
  return value in THEME_PRESETS;
}
