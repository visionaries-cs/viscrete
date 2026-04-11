# CHANGEv2 — Preprocess Page Changes

File modified: `app/preprocess/[job_id]/page.tsx`

---

## 1. Execution Dashboard (New Component)

Added an `ExecutionDashboard` component rendered below the 5-step stepper while preprocessing is running.

### Sections inside the dashboard:

**Step Header**
- Shows the active step name as a bold heading
- Shows a dynamic per-step description (e.g. "Extracting visual feature vectors from each image...")
- Animated `Loader2` spinner (emerald) on the left

**Progress Bar**
- "Progress" label on the left, percentage on the right
- Teal/green gradient fill (`#10b981` → `#2ca75d`)
- Animates from 0% → 85% using CSS transition (`duration-[1400ms] ease-out`) when a new step becomes active
- Resets per step

**Metric Cards (2 cards only)**
- `STATUS` — shows "In Progress" in emerald with a pulsing dot
- `EXECUTION TIME` — live HH:MM:SS timer (monospace, tabular-nums)
- No memory usage card

**Terminal Log Preview**
- Dark background (`bg-[#0d1117]`), monospace font, 12px
- Colored tag prefixes: `[INFO]` cyan, `[FEAT]/[K-MEANS]/[IMOCS]/[CLAHE]/[BFILT]/[STEP N/M]` yellow/blue, `[OK]` emerald, `[DONE]` emerald, `[CLUST]` purple, `[TIME]` blue, `─────` gray separator
- Lines revealed one by one via `setInterval` (320ms per line)
- Auto-scrolls to bottom on each new line

---

## 2. New Interfaces Added

```ts
interface LogLine {
  tag: string;
  tagColor: string;
  message: string;
}
```

---

## 3. New Constants and Functions

**`STEP_DESCRIPTIONS`** — static record mapping each step label to a one-line description shown in the dashboard header.

**`getStepLogs(stepLabel, fileCount)`** — replaces the old static `STEP_META` constant. Generates realistic terminal log lines using real job data:
- `fileCount` from `jobMeta.file_count` (via `jobMetaRef`)
- Splits images into batches (4 batches for feature extraction, 3 for bilateral filter)
- Estimates cluster count (`estK`) from file count: `Math.max(2, Math.min(8, Math.ceil(n / 10)))`
- Covers all 9 pipeline steps: Feature Extraction, Clustering, IMOCS Optimization, CLAHE Enhancement, Bilateral Filter, Frame Sampling, Median Frame Construction, Frame Processing, Save Output

**`formatTime(totalSecs)`** — formats seconds as `HH:MM:SS` for the execution time card.

---

## 4. New State and Refs

| Name | Type | Purpose |
|---|---|---|
| `elapsedSecs` | `number` state | Drives the HH:MM:SS timer |
| `stepProgress` | `number` state | Progress bar fill percentage |
| `visibleLogs` | `LogLine[]` state | Accumulated terminal lines |
| `jobMetaRef` | `useRef<JobStatus>` | Mirrors `jobMeta` so effects can read `file_count` without adding it as a dependency |
| `progressTimerRef` | `useRef<setTimeout>` | Holds the 80ms delay before animating progress to 85% |
| `logIntervalRef` | `useRef<setInterval>` | Reveals log lines one by one |
| `lastActiveIdxRef` | `useRef<number>` | Tracks which step index was last active to avoid double-firing the step-change effect |
| `startTimeRef` | `useRef<number>` | Records `Date.now()` when the timer starts |
| `logEndRef` | `useRef<HTMLDivElement>` | Target for auto-scroll (`scrollIntoView`) |

---

## 5. Bug Fix — `Cannot read properties of undefined (reading 'tagColor')`

**Root cause:** React StrictMode double-invokes effects, causing a `setInterval` race where `queue[logIdx]` was accessed after `logIdx` exceeded the array length.

**Fix applied:**
```ts
// Before (crashes):
setVisibleLogs(prev => [...prev, queue[logIdx++]]);

// After (safe):
const item = queue[logIdx];
logIdx++;
if (item) setVisibleLogs(prev => [...prev, item]);
```

Also added a `.filter((line): line is LogLine => !!line)` guard before `.map()` in the render.

---

## 6. Terminal Behavior — No Clear Between Steps

**Before:** The terminal was cleared (`setVisibleLogs([])`) every time a new step became active.

**After:** The terminal accumulates all logs across the full pipeline run. On step change:
- A `─────` separator line is appended
- A `[STEP N/M] StepLabel` header line is appended
- New step's log lines are appended after that
- Only on step index 0 (the very first step) does it start fresh: `setVisibleLogs(idx === 0 ? [header] : [...prev, separator, header])`

---

## 7. Post-API Real Result Logs

After the API returns, real data from the response is appended to the terminal:
- `[DONE]` — actual `total_processed` count
- `[TIME]` — actual total `duration_sec` summed from `pipeline_steps`
- `[CLUST]` — one line per cluster with real `member_count`, `clip_limit`, `tile_grid_size`, and `source`

---

## 8. Design Rule Compliance — Pipeline Surface

`app/preprocess/[job_id]/` is a **Pipeline** surface page. All App-surface palette tokens were replaced with Pipeline-surface equivalents.

| Element | Before (App surface — wrong) | After (Pipeline surface — correct) |
|---|---|---|
| Page background | `bg-gray-50 dark:bg-[#0a0a0a]` | `bg-gray-100 dark:bg-gray-900` |
| Header | `bg-white dark:bg-[#111]` | `bg-white dark:bg-gray-950` |
| Main pipeline card | `bg-white dark:bg-[#161616] shadow-sm` | `bg-white dark:bg-gray-950` (no shadow) |
| Cluster section card | `bg-white dark:bg-[#161616] shadow-sm` | `bg-white dark:bg-gray-950` (no shadow) |
| Cluster header hover | `dark:hover:bg-[#1a1a1a]` | `dark:hover:bg-gray-900/50` |
| STATUS metric card | `bg-gray-50 dark:bg-[#1a1a1a] dark:border-gray-700` | `bg-gray-50 dark:bg-gray-900 dark:border-gray-800` |
| EXECUTION TIME card | `bg-gray-50 dark:bg-[#1a1a1a] dark:border-gray-700` | `bg-gray-50 dark:bg-gray-900 dark:border-gray-800` |
| ClusterCard | `bg-white dark:bg-[#1a1a1a]` | `bg-white dark:bg-gray-950` |
| Terminal container border | `dark:border-gray-700` | `dark:border-gray-800` |
| Terminal header | `bg-gray-100 dark:bg-[#161616]` | `bg-gray-100 dark:bg-gray-800` |
| Step timing even rows | `dark:bg-[#111]` | `dark:bg-gray-900/50` |
| Step timing odd rows | `dark:bg-[#161616]` | `dark:bg-gray-950` |
| BeforeAfterToggle border | `dark:border-gray-700` | `dark:border-gray-800` |
