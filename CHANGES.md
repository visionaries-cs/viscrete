# VISCRETE — Frontend Changes (FRONTENDv2)

> **Applied:** April 6, 2026  
> **Spec source:** `FRONTENDv2.MD`  
> **Stack:** Next.js App Router + Tailwind CSS  
> **API Base:** `http://localhost:8000/api/v1`

---

## Overview

This document describes all UI and code changes made to the VISCRETE frontend when applying the `FRONTENDv2.MD` specification. The spec restructured the app into a clear 4-step inspection pipeline:

```
/upload  →  /preprocess/[job_id]  →  /detect/[job_id]  →  /report/[job_id]
```

---

## Files Changed

| File | Status | Description |
|------|--------|-------------|
| `lib/api.ts` | Modified | Full rewrite — new types and API functions |
| `app/upload/page.tsx` | Modified | Full rewrite — new layout, inline validation results |
| `app/preprocess/[job_id]/page.tsx` | **Created** | Brand new page (did not exist before) |
| `app/detect/[job_id]/page.tsx` | **Created** | Brand new page (did not exist before) |
| `app/report/[job_id]/page.tsx` | **Created** | Brand new page (did not exist before) |

### Files NOT changed (kept as-is)

| File | Reason kept |
|------|-------------|
| `app/page.tsx` | Landing page — not part of the spec |
| `app/results/[job_id]/page.tsx` | Old detection page — kept for backward compatibility |
| `app/upload-review/[job_id]/page.tsx` | Old validation review page — kept for backward compatibility |
| `app/inspection/page.tsx` | Old upload form — kept for backward compatibility |
| `app/globals.css` | No changes needed |
| `app/layout.tsx` | No changes needed |

---

## 1. `lib/api.ts` — API Client

### What was removed
- Nothing was deleted — old functions were kept but marked `@deprecated`

### What was added

#### New functions

| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| `listJobs()` | GET | `/jobs` | Fetch all jobs (for Previous Jobs list) |
| `validateFiles(jobId, files[])` | POST | `/jobs/{id}/validate` | Upload **multiple** files at once and get per-file results |
| `preprocessJob(jobId)` | POST | `/jobs/{id}/preprocess` | Run the preprocessing pipeline |
| `generateReport(jobId)` | POST | `/jobs/{id}/report` | Generate the final inspection report |
| `getReport(jobId)` | GET | `/jobs/{id}/report` | Fetch an existing report |
| `getOriginalImageUrl(jobId, filename)` | — | `/static/jobs/{id}/original/{file}` | Returns static URL string (no fetch) |
| `getProcessedImageUrl(jobId, filename)` | — | `/static/jobs/{id}/processed/{file}` | Returns static URL string (no fetch) |
| `getAnnotatedImageUrl(jobId, filename)` | — | `/static/jobs/{id}/annotated/{file}` | Returns static URL string (no fetch) |

#### New TypeScript types

| Type | Used for |
|------|----------|
| `JobStatusResponse` | Shape of each job from `GET /jobs` |
| `ValidationResult` | Per-file result from `POST /validate` |
| `ClusterInfo` | One cluster entry from preprocess response |
| `PreprocessResponse` | Full response from `POST /preprocess` |
| `ReportDefect` | One defect entry inside a report |
| `ReportResponse` | Full response from `GET /report` |

#### What changed in existing functions
- `uploadImage()` — now marked `@deprecated`, replaced by `validateFiles()`
- `getResultImageUrl()` — now marked `@deprecated`, replaced by `getAnnotatedImageUrl()`
- `createJob()` — return type updated from `JobResponse` to `JobStatusResponse`

---

## 2. `/upload` — Upload Page

### What was on the old version
- **Left column:** Job Details form (Site Name, Inspector Name, File Type select) + drag & drop area
- **Right column:** "Your Previous Report" — a grid of hardcoded mock thumbnail cards (no real data)
- A search bar labeled "Enter Keyword"
- "Cancel" and "Continue" buttons at the bottom
- Clicking "Continue" → uploaded files one-by-one → navigated to `/upload-review/[job_id]`
- Validation results were shown on the **separate page** `/upload-review`, not here

### What is on the new version

#### Left column — Job Details (changed)
| Field | Before | After |
|-------|--------|-------|
| Site Name | Text input | Text input (same) |
| Inspector Name | Text input | Text input (same) |
| Media Type | `<Select>` dropdown | Radio buttons (Images / Videos) with icons |

#### Left column — Upload Area (changed)
| Feature | Before | After |
|---------|--------|-------|
| Accepted types hint | "images only" / "videos only" | Shows actual formats: `JPG, PNG, BMP, TIFF — max 20 MB each` or `MP4, AVI, MOV — max 500 MB each` |
| File list display | Count badge only (`✓ 3 image(s)`) | Full list with filename + size + remove (🗑) button per file |
| Upload action | Uploads one-by-one, then navigates away | Uploads all at once, stays on page |
| After upload | Navigates to `/upload-review/[job_id]` | Shows validation results inline in right column |

#### Left column — Buttons (changed)
| Button | Before | After |
|--------|--------|-------|
| Cancel | Present | **Removed** |
| need help? | Present | **Removed** |
| Continue | Present, always visible | **Removed** |
| Upload & Validate | Not present | **Added** — disabled until form + files are ready |
| Proceed to Preprocessing → | Not present | **Added** — appears after at least 1 file is valid |

#### Left column — Previous Jobs (completely replaced)
| Feature | Before | After |
|---------|--------|-------|
| Data source | 6 hardcoded mock entries | Real data from `GET /jobs` |
| Layout | Grid of thumbnail cards with "No image" placeholder | Vertical list rows |
| Per-row info | Title + date only | Site Name, Status badge, Media Type, File Count, Created At |
| Status badge | None | Color-coded badge (created / validated / preprocessed / detected / completed / etc.) |
| Click action | Nothing | Navigates to correct page based on job status |
| Pagination | None | 5 jobs per page — `← Previous · Page N of M · Next →` |
| Search bar | Present ("Enter Keyword") | **Removed** |
| Section title | "Your Previous Report" | "Previous Jobs" |

#### Right column (completely replaced)
| Feature | Before | After |
|---------|--------|-------|
| Content | Mock report thumbnail grid | Empty placeholder until upload runs, then validation result cards |
| GPS filter | Not present | **Added** — `All / With GPS / Without GPS` |
| Blur filter | Not present | **Added** — `All / Sharp / Blurry` |
| Summary line | Not present | **Added** — `"N files uploaded • N valid • N invalid"` |
| Per-file card | Not present | **Added** — shows filename, ✅/❌ badge, Laplacian score, blur threshold hint, GPS coords, failure reason |

---

## 3. `/preprocess/[job_id]` — Preprocessing Pipeline

**This page did not exist before. It is entirely new.**

### What it does
1. On page load, automatically triggers `POST /jobs/{job_id}/preprocess`
2. While the API request is in-flight, shows a **5-step stepper** with simulated progression (1.8s per step):
   - Feature Extraction → K-Means Clustering → IMOCS → CLAHE → Bilateral Filter
3. Each step has 4 visual states:
   - **Pending** — gray number
   - **Active** — blue spinner
   - **Completed** — green checkmark
   - **Failed** — red X with error message
4. When the API responds, all steps flip to Completed
5. Shows **Cluster Summary cards** from `cluster_info[]` in the response:
   - Cluster ID, Member Count, CLAHE Clip Limit, Tile Grid Size, Source badge (IMOCS / Default)
6. Shows a **Before/After drag slider** for each file:
   - Left side: original image (`/static/jobs/{id}/original/{file}`)
   - Right side: processed image (`/static/jobs/{id}/processed/{file}`)
   - Draggable divider with chevron handle
7. Shows **"Proceed to Detection →"** button after completion → navigates to `/detect/[job_id]`

### Error handling
- If API fails: marks current step as Failed, shows error message with a Retry button

---

## 4. `/detect/[job_id]` — Detection Results

**This page did not exist before. It is entirely new.**  
The old detection page was at `/results/[job_id]` and is kept unchanged.

### Comparison: old `/results` vs new `/detect`

| Feature | `/results/[job_id]` (old, kept) | `/detect/[job_id]` (new) |
|---------|--------------------------------|--------------------------|
| Image display | Carousel — one image at a time | Grid — 2–3 columns, all images visible |
| Bounding boxes | Drawn in JavaScript on the browser using coordinates from API | **Not drawn by browser** — backend already burned annotations into the image |
| Overlay toggles | Bounding Boxes / Labels / Heatmap toggles | Not needed — annotations are server-side |
| Defect counts | Color-coded count cards (cracks / spalling / peeling / algae / stain) | Not shown as cards |
| Defect table | Not present | **Added** — per-detection rows |
| Severity column | Not shown | **Added** — Low / Medium / High badge |
| Confidence column | Not shown | **Added** — percentage |
| Crack Width column | Not shown | **Added** — in mm or `—` |
| Area column | Not shown | **Added** — in px² or `—` |
| Summary line | Risk Score (always 0 / 100) | `"N defects detected • N Low • N Medium • N High"` |
| Generate Report button | Download PDF (no API call) | Calls `POST /jobs/{id}/report`, redirects to `/report/[job_id]` |

### Behavior on load
- Automatically calls `POST /jobs/{job_id}/detect`
- Shows spinner while running
- Images are served from `GET /static/jobs/{job_id}/annotated/{filename}`

---

## 5. `/report/[job_id]` — Inspection Report

**This page did not exist before. It is entirely new.**

### What it shows
Fetched via `GET /jobs/{job_id}/report`

| Section | Content |
|---------|---------|
| **Report Header** | Report ID, Job ID, date generated, site name, inspector name |
| **Summary Card** | Total Defects count, Dominant Severity (color-coded), Defect Types Found, Severity Breakdown (Low / Medium / High counts) |
| **GPS Locations** | List of lat/lng per filename (only shown if GPS data exists) |
| **Full Defect Table** | Same columns as detection page: File, Defect Type, Confidence, Severity, Crack Width, Area |
| **Annotated Images** | Same grid as detection page |

### Actions
- **Print / Save PDF** button — calls `window.print()` (browser print dialog)
- Print-friendly styles applied (header hides on print, clean layout)

### Error handling
- 404 → "Report not found" message + back link to `/upload`
- Network error → error message shown inline

---

## Route Map Summary

```
Before:
  /                          → Landing page (unchanged)
  /upload                    → Form + mock previous jobs grid + navigates to /upload-review
  /upload-review/[job_id]    → Validation results (separate page)
  /inspection                → Old upload form (duplicate)
  /results/[job_id]          → Detection carousel with JS bounding boxes

After (new routes added, old routes kept):
  /                          → Landing page (unchanged)
  /upload                    → Form + real previous jobs + inline validation results ✏️
  /upload-review/[job_id]    → Still exists (untouched)
  /inspection                → Still exists (untouched)
  /results/[job_id]          → Still exists (untouched)
  /preprocess/[job_id]       → NEW — preprocessing stepper + before/after
  /detect/[job_id]           → NEW — annotated grid + defect table + generate report
  /report/[job_id]           → NEW — full inspection report summary
```

---

## How to Revert

Since the project uses Git, you can undo any of these changes:

```bash
# Revert just one file
git checkout HEAD -- app/upload/page.tsx
git checkout HEAD -- lib/api.ts

# Revert both modified files at once
git checkout HEAD -- app/upload/page.tsx lib/api.ts

# The 3 new pages didn't exist before — just delete them to remove
Remove-Item -Recurse app/preprocess
Remove-Item -Recurse app/detect
Remove-Item -Recurse app/report
```

> **Note:** `git checkout HEAD -- <file>` only works if you have committed your code before these changes were applied. If not, you can use `git diff` to see what changed and manually restore.
