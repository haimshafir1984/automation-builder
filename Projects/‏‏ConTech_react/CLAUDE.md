# ConTech React — Project Memory (CLAUDE.md)

> קובץ זה נקרא אוטומטית על ידי Claude Code בתחילת כל session.
> עדכן אותו כשמוסיפים פיצ'רים משמעותיים, מתקנים באגים קריטיים, או משנים ארכיטקטורה.

---

## Stack
- React 18.2 + TypeScript + Vite 5 + Tailwind CSS + Axios
- RTL (Hebrew right-to-left) — all layouts use RTL grid conventions
- Backend: Python FastAPI on Render (cold-start restarts lose in-memory data)
- Live URL: https://contech-frontend-react.onrender.com/

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/pages/WorkshopPage.tsx` | Plan upload + card grid + plan detail |
| `frontend/src/pages/PlanningPage.tsx` | 5-step planning wizard (most complex) |
| `frontend/src/pages/WorkerPage.tsx` | Worker measurement canvas + reports |
| `frontend/src/pages/DashboardPage.tsx` | KPI cards + BOQ table + CSV/PDF export |
| `frontend/src/styles/index.css` | CSS custom properties (design tokens) |
| `frontend/tailwind.config.cjs` | Tailwind config |
| `contech-redesign.html` | **Authoritative visual design reference** (HTML mockup of all 4 screens) |
| `STABILITY_PLAN.md` | Breakdown of 8 approved performance/stability changes (step-by-step) |
| `STABILITY_PROMPT.md` | Ready-to-paste Claude Code prompt for implementing STABILITY_PLAN |

### Backend file routing — important!
`backend/brain.py`, `backend/database.py` etc. are **thin wrappers** via `_compat.py`.
The real implementations live at the **root level**: `brain.py`, `database.py`, `vision_analyzer.py`.
**Always edit root-level files**, never the `backend/` wrappers.

---

## CSS Design Tokens (actual values in `index.css :root`)

```css
--navy: #1e3a5f       --navy-dark: #152d4a   --navy-light: #2a4d7a
--navy-2: #1B3A6B

--orange: #e67e22     --orange-dark: #c96a10

--blue: #2563EB       --blue-h: #1D4ED8
--blue-50: #EFF6FF    --blue-100: #DBEAFE

--green: #15803d      --green-light: #dcfce7  --green-50: #ECFDF5
--amber: #b45309      --amber-light: #fef3c7  --amber-50: #FFFBEB
--red: #DC2626        --red-light: #fee2e2    --red-50: #FEF2F2

--text-1: #1e293b     --text-2: #475569       --text-3: #94a3b8

--s50..--s900: slate scale (s50=#F8FAFC … s900=#0F172A)
--s700: #334155

--sh1: 0 1px 3px rgba(0,0,0,.06)   --sh2: 0 4px 16px rgba(0,0,0,.08)
--r: 12px   --r-sm: 8px

.worker-main-grid: grid-template-columns 1fr 320px (canvas left, panel right)
```

---

## Page Layout Architecture
- `App.tsx` → sidebar (fixed right, navy `#1e3a5f`) + `<main style="flex:1;padding:20px 24px 32px;overflowY:auto">`
- Pages render inside padded scrollable main container
- RTL: in CSS grid, columns run right-to-left, so `grid-template-columns: 1fr 360px` → 1fr is on the RIGHT

---

## Design Concept Key Patterns

### Workshop
- Upload zone: `border: 2px dashed var(--s300)`, `background: #fff`, hover→`var(--blue-50)`
- Plan cards: gradient thumbnail, status badge top-right, `border-radius: var(--r)`, hover shadow+translateY(-2px)
- **STATUS**: ✅ Fully implemented

### Planning (Step 3)
- `.wizard-steps` / `.wizard-step` classes for the step bar (no emoji in circles)
- `.plan-layout`: `grid-template-columns: 1fr 360px` → canvas(1fr) left + panel(360px) right
- Canvas: `background: #1A2744`, centered image, floating tools pill bottom-center
- Panel: white, flex-column: tabs + scrollable body + foot with nav buttons
- **STATUS**: ✅ Restructured (canvas-left dark + panel-right white)

### Worker
- Stats strip: `background: #fff`, `border-bottom: 1px solid var(--s200)`, `display:flex;gap:20`
- `.worker-main-grid`: `grid-template-columns: 1fr 320px` (canvas left, panel right)
- Canvas area: `background: #1A2744` (dark navy), floating toolbar
- Right panel: white, tab bar (notes/history), scrollable body
- **STATUS**: ✅ Fully implemented

### Dashboard
- KPI grid: `grid-template-columns: repeat(4, 1fr)`, each card: `border-top: 3px solid <color>`
- KPI value: `font-size: 30px; font-weight: 800; letter-spacing: -1.5px`
- `.dash-grid`: `grid-template-columns: 1fr 330px` → BOQ table left, category bars + activity feed right
- BOQ table: `.boq-table` → th: 9px 16px padding, s400 text, s50 bg; td: 10px 16px, s100 border
- **STATUS**: ✅ Overview tab fully restructured

---

## Emoji Policy (important!)

**All UI emoji removed** from WorkshopPage, WorkerPage, DashboardPage, App.tsx (navigation).
Icons replaced with inline SVG only.

**Exception — PlanningPage:** emoji in `PlanningPage.tsx` are **data/categorization logic** (🚰 🚿 🛋️ 🚪 🪟 🧱 🔧 etc.) inside `getFixGroupLabel()` and fixture/wall group headers. Do NOT remove these — they serve as visual category markers in the analysis panel, not decorative UI.

---

## API Types

### DashboardResponse
- `percent_complete`, `built_m`, `remaining_m`, `total_planned_m`
- `planned_walls_m`, `built_walls_m`, `planned_floor_m2`, `built_floor_m2`
- `boq_progress[]`: `{label, unit, planned_qty, built_qty, remaining_qty, progress_percent}`
- `recent_reports[]`: `{id, date, shift, report_type, total_length_m, total_area_m2, note?}`
- `timeline[]`: `{date, quantity_m}`

---

## PlanningPage — Auto-Analyze Panel (Step 3, tab "auto")

### Backend segment types
- Walls: `element_class="wall"`, `suggested_type="קירות"`, `suggested_subtype="בטון"|"בלוקים"`
- Fixtures: `element_class="fixture"`, `suggested_type="אביזר"` (always same!), subtype varies:
  - `"פרט קטן"` — area < 0.12 m², small unidentifiable shapes (majority)
  - `"כיור / אסלה"` — area 0.12–0.45 m², squarish
  - `"אמבטיה / מקלחת"` — area up to 1.2 m², elongated
  - `"ריהוט / מכשיר"` — larger shapes

### Collapsible group structure
```
🧱 קירות וקטעים (N)         ← open by default
🔧 אביזרים (N)               ← closed by default
  🏠 אביזרים מזוהים (N)     ← subtype != "פרט קטן"
    🚰 כיורים ואסלות (N)
    🚿 אמבטיות ומקלחות (N)
    🛋️ ריהוט ומכשירים (N)
  📌 פרטים לא מזוהים (N)   ← subtype == "פרט קטן", closed+grayed
```
- State: `expandedGroups: Set<string>` — keys: `"walls"`, `"fixtures"`, `"fix_k_<subtype>"`, `"fix_unknown"`
- Helper: `getFixGroupLabel(subtype)` maps `suggested_subtype` → Hebrew label + emoji
- **KEY**: must group by `suggested_subtype`, NOT `suggested_type` (all fixtures share same type)
- "הוסף קטגוריה" pinned at TOP of shared panel (above categories list), always visible

### Auto-analysis data persistence
`autoSegments` is **React state only** — it resets on every page reload/navigation.
The analysis IS stored in the database (`db_save_auto_segments`) and reloaded via `db_get_auto_segments`.
After a server restart (Render cold-start) the stored segments are read from DB; user can re-run analysis to refresh.
The backend DOES try to reload project arrays from DB BLOBs after restart (see `_ensure_arrays_loaded`).

### thick_walls mask — important limitation
`thick_walls` contains **ONLY wall pixels** — plumbing fixtures, furniture symbols etc. are NOT in this mask.
When the skeleton of `thick_walls` yields 0 fixtures (common after server restart with reloaded mask),
`manager_auto_analyze` runs a **Step 5b fallback**: detects compact shapes from the original image.
- Thresholds dark-on-light pixels → removes dilated wall region → connected-components
- Keeps shapes: aspect 0.25–4.0, area 0.08–2.5 m² (skips "פרט קטן" entirely)
- Classifies as: `כיור / אסלה` / `אמבטיה / מקלחת` / `ריהוט / מכשיר`

### Canvas display filter
`autoSegments` with `suggested_subtype === "פרט קטן"` are filtered OUT from the canvas SVG overlay
to prevent 1000+ tiny shapes creating a "purple fog". They remain in the segment list/panel.

### Step 3 UX — New Features (added after commit ~feat/step3-ux)

#### Auto-approve by confidence threshold
- State: `autoApproveThreshold` (70–100, default 90) + `autoApproveToast` (toast message string)
- UI: slider + button "✅ אשר הכל מעל X% ביטחון" pinned above the segment list
- Handler: `handleAutoApproveByThreshold()` — filters segments by `confidence >= threshold/100`,
  calls `confirmAutoSegments` in batch, then shows toast "✅ אושרו X פריטים אוטומטית"
- Toggle: `showPendingOnly` — when ON, hides already-confirmed segments from the list

#### Bidirectional highlight: list ↔ canvas
- State: `selectedSegmentId: string | null` + `segmentListRefs: Map<string, HTMLElement>`
- List → canvas: selecting a row highlights the matching SVG bbox in amber/orange
- Canvas → list: clicking an SVG bbox sets `selectedSegmentId` → scrolls list to the row
- Note: canvas pan (scroll to bbox position) is NOT yet implemented — canvas is SVG, not scrollable.
  To add: use `canvasContainerRef.current.scrollTo()` with `bbox[0] * zoomRatio`

#### Context menu (right-click on canvas segment)
- State: `contextMenu: { x, y, segId } | null`
- Shows top-5 categories from `CATEGORY_SUBTYPES` in a floating mini-menu
- Selection calls `handleConfirmSingleSegment(segId, catKey)`

#### Bulk categorize "פרטים קטנים"
- State: `bulkSmallCat: string`
- Segments with `suggested_subtype === "פרט קטן"` are grouped into a collapsible card
- Card shows quick-assign buttons (חשמל / אינסטלציה / טיח / אחר)
- Selection calls `handleBulkConfirmGroup(segIds, catKey)`

#### Bulk-assign row improvements (שיוך מהיר לפי סוג)
- Each row now shows: colored dot + detected type + count → category select → "שייך הכל ←" button
- After assignment: row shows "✅ שויך" indicator

### visionCatSuggestions — auto-create banner
State: `visionCatSuggestions: { type, subtype, paramValue }[]`
Populated in `handleAutoAnalyze` after analysis:
- **Primary source**: unique `(type, subtype)` pairs from `autoSegments` walls (reliable, always present)
- **Secondary source**: Vision AI materials / legend OCR via `matchMaterialToCategory()`
Triggers green banner "✨ זוהו N קטגוריות מהמקרא" → button "צור קטגוריות ושייך אוטומטית"
→ calls `handleAutoCreateCategoriesFromVision()` which creates categories + auto-assigns matching segments.

### "הוסף קטגוריה" — sticky placement
The add-category form is a `<details>` element placed as `flexShrink: 0` **between the tab bar and the
scrollable panel body** — visible on every tab without scrolling. (Removed from the old position inside the scrollable area.)

---

## Performance & Stability — Pending Changes

8 approved changes await implementation. See `STABILITY_PLAN.md` for full breakdown.
Use `STABILITY_PROMPT.md` as ready-to-paste Claude Code prompt.

**Already done (do not repeat):**
- `ThreadPoolExecutor(max_workers=4)` — already set in `main.py` line 169

**Pending (safe→risky order):**
1. `vision_analyzer.py` — `pix = None` after pixmap use (LOW)
2. `WorkerPage.tsx` — `.slice(-50)` history list limit (LOW)
3. `DashboardPage.tsx` — `.slice(-50)` reports list limit (LOW)
4. `brain.py` (root) — add `logging` + replace bare `except:` (LOW)
5. `WorkerPage.tsx` — fix `loadReports` → `setReports(await listWorkerReports(...))` (LOW, bug fix)
6. `WorkerPage.tsx` + `workerApi.ts` — AbortController for plan-switch fetch (MEDIUM)
7. `WorkerPage.tsx` — `useCallback` for `handleDrawComplete` (MEDIUM)
8. `database.py` (root) — cache `information_schema` check in `_plans_cols_cache` (MEDIUM)
9. `DashboardPage.tsx` — move CSS injection from module-level to `useEffect` (MEDIUM)

---

## Important Notes

- **Hebrew in Windows path**: `שולחן העבודה` in path causes Python to fail; use Node.js for file operations
- **RTL quirk**: CSS grid columns run right-to-left, so `1fr 360px` puts 1fr on the right side
- **Touch support**: `makeTouchHandler` wrapper exists in PlanningPage.tsx for SVG surfaces
- **Print/PDF**: `printBoqReport()` opens new window, writes HTML, calls window.print()
- **CSV export**: `exportBoqCsv()` creates blob with BOM (`\uFEFF`) for Hebrew Excel compatibility
- **CRLF warning**: Windows checkout marks ~70 files as "modified" in git (CRLF vs LF). These are NOT real changes — confirmed by equal insertion/deletion counts in diffs. Use `git diff` carefully.
- **Render cold-start**: in-memory `PROJECTS` dict is cleared on every deploy. Users must re-upload or re-trigger analysis after server restart.

---

## Commits Timeline

| Commit | Description |
|--------|-------------|
| `c1c477a` | UI redesign session 1 (WorkerPage full redesign, CSS tokens, CSV export) |
| `58d9d7d` | WorkshopPage upload zone + plan cards CTA; PlanningPage steps-bar flat strip |
| `db406d0` | DashboardPage overview tab restructured to match design concept |
| `f3dc250` | PlanningPage auto tab: collapsible group headers + "הוסף קטגוריה" moved to top |
| `959e398` | PlanningPage auto tab: correct fixture split (known vs "פרטים לא מזוהים") |
| `ea6d4d8` | fix(planning): exclude unidentified fixtures from auto-selection |
| `51cf3d6` | fix(security): patch XSS, race condition, memory leak |
| `38bc1c7` | fix(stability): error boundary, wheel comment, partial assign recovery |
| `824875b` | perf(upload): parallelize LLM+Vision analysis, fix event-loop blocking |
| `ad295ff` | feat(ui): redesign visual layer — navy/orange design system, SVG icons in Nav |
| `12af027` | UI redesign: CSS design-system classes applied across all 4 pages |
| `8542ae4` | fix(ui): remove all emoji from WorkerPage, DashboardPage, WorkshopPage |
| `d8ae90f` | stability: memory fix, list limits, logging, AbortController, useCallback, schema cache |
| `e5f5708` | feat(ui): expand category types + bulk-assign panel in auto tab |
| `ac1cdb4` | feat(planning): undo last item, line snap, live BOQ strip, focus on item |
| `79f655a` | feat(planning): smart auto-category creation + UX improvements steps 2-3-4 |
| `7378a7b` | fix(planning): sticky add-category bar + reliable banner from autoSegments |
| `13c0072` | fix(auto-analyze): fallback fixture detection from original image |
| *(pending)* | feat: improve Step 3 UX — auto-approve by confidence, bulk categorize, bidirectional highlight |
