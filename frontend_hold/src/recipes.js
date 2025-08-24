// הגדרות הטפסים (UI schema) + תיאורי המתכונים
export const RECIPES = {
  "sheets_to_email": {
    title: "Google Sheets → IF → Email (proxy)",
    hint: "קרא גיליון, סנן לפי עמודה/ערך ושלח מייל דרך הפרוקסי",
    fields: [
      { key: "spreadsheetId", label: "Spreadsheet ID", placeholder: "1HoFa5M...Nd3M", required: true },
      { key: "sheetTab",      label: "שם גיליון (Tab)", placeholder: "גיליון1", required: true },
      { key: "column",        label: "שם עמודה", placeholder: "project menger", required: true },
      { key: "operator",      label: "השוואה", type: "select", options: ["equals","contains"], required: true, default: "equals" },
      { key: "value",         label: "ערך להשוואה", placeholder: "חיים שפיר", required: true },
      { key: "email.to",      label: "יעד מייל", placeholder: "user@example.com", required: true },
      { key: "email.subject", label: "נושא", placeholder: "נמצאה התאמה", default: "נמצאה התאמה" },
      { key: "email.body",    label: "תוכן", type: "textarea", placeholder: "Row: {{$json}}", default: "Row: {{$json}}" },
      { key: "schedule",      label: "תיזמון", placeholder: "manual או cron (למשל */5 * * * *)", default: "manual" }
    ]
  },

  "webhook_to_email": {
    title: "Webhook → Email (proxy)",
    hint: "קבל Webhook ושלח מייל דרך הפרוקסי",
    fields: [
      { key: "email.to",      label: "יעד מייל", placeholder: "user@example.com", required: true },
      { key: "email.subject", label: "נושא", placeholder: "Notification", default: "Notification" },
      { key: "email.body",    label: "תוכן", type: "textarea", placeholder: "{{$json}}", default: "{{$json}}" }
    ]
  },

  "webhook_to_slack": {
    title: "Webhook → Slack (proxy)",
    hint: "קבל Webhook ושלח הודעה ל־Slack דרך הפרוקסי",
    fields: [
      { key: "slack.channel", label: "Slack channel", placeholder: "#general", required: true },
      { key: "slack.text",    label: "טקסט", type: "textarea", placeholder: "{{$json}}", default: "{{$json}}" }
    ]
  }
};
