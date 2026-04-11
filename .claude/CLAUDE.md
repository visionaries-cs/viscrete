# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test runner is configured in this project.

## Environment

Set `NEXT_PUBLIC_API_URL` to point at the backend. Defaults to `http://localhost:8000`.

## Architecture

VISCRETE is a concrete defect detection frontend — a thesis demo built with **Next.js 16 App Router**, **Tailwind CSS v4**, and **shadcn/ui** (New York style, neutral base).

### Page Flow (job pipeline)

Each inspection is a **job** identified by a `job_id` (UUID from the backend). The URL carries the `job_id` — no global state manager is used.

```
/ (landing)
/upload                   → create job + upload files + validation results
/preprocess/[job_id]      → CLAHE preprocessing pipeline with before/after images
/detect/[job_id]          → YOLOv11 inference results + annotated images
/report/[job_id]          → final structured inspection report
```

Status-to-route mapping for resuming jobs from Previous Jobs list:

| Job Status | Route |
|---|---|
| `created` / `validating` / `validated` / `failed` | `/upload` |
| `preprocessing` / `preprocessed` | `/preprocess/[job_id]` |
| `detecting` / `detected` | `/detect/[job_id]` |
| `reporting` / `completed` | `/report/[job_id]` |

### API Layer (`lib/api.ts`)

All backend calls go through `lib/api.ts`. Base URL is `http://localhost:8000` (override with `NEXT_PUBLIC_API_URL`). Swagger docs at `/docs`.

**Endpoints**

| Method | Path | Required job status | Description |
|---|---|---|---|
| `POST` | `/api/v1/jobs` | — | Create job → `job_id` |
| `GET` | `/api/v1/jobs` | — | List all jobs (newest first) |
| `GET` | `/api/v1/jobs/{job_id}` | — | Job + per-file statuses |
| `DELETE` | `/api/v1/jobs/{job_id}` | — | Soft-delete + remove files from disk |
| `POST` | `/api/v1/jobs/{job_id}/validate` | `created` | Upload files, blur check, extract GPS |
| `PATCH` | `/api/v1/jobs/{job_id}/location` | any | Assign GPS to files missing EXIF data |
| `POST` | `/api/v1/jobs/{job_id}/preprocess` | `validated` | Run IMOCS → CLAHE → Bilateral Filter |
| `POST` | `/api/v1/jobs/{job_id}/detect` | `preprocessed` | Run YOLOv11 inference |
| `GET` | `/api/v1/jobs/{job_id}/detect` | `detected`/`completed` | Retrieve cached detections |
| `POST` | `/api/v1/jobs/{job_id}/report` | `detected` | Generate report |
| `GET` | `/api/v1/jobs/{job_id}/report` | `completed` | Retrieve cached report |
| `GET` | `/ping` | — | Health check |

**Key response shape notes** (the types in `lib/api.ts` are partially out of date — trust ENDPOINT.md):

- **Validation** (`InputValidationResponse`): each file now returns `file_id`, `gps_data: { latitude, longitude, altitude }` (nested, not flat), `original_path`, `status` (`"valid"` / `"invalid"`), and `message`. Job status becomes `"failed"` if any file fails — but all files are saved.
- **`JobStatusResponse`** now includes `updated_at` and a `files` array of `FileStatusItem` (`file_id`, `filename`, `status`, `laplacian_score`).
- **Preprocess** (`PreprocessResponse`): now includes `pipeline_type` (`"image"` / `"video"`), `pipeline_steps` (ordered step results with `step`, `name`, `status`, `duration_sec`, `detail`), and `cluster_info` where CLAHE params are nested under `clahe_params: { clip_limit, tile_grid_size, source }` with a `representative_file_id` field.
- **Detection** (`DetectionResponse`): flat structure — `job_id`, `file_id`, `total_defects`, `detections[]`, `annotated_paths[]`. Not a per-file array.
- **Report** (`ReportResponse`): `gps_data[]` (one entry per file with nullable lat/lng/alt), `detections[]` (all defects flat), `summary: { total_defects, severity_counts, dominant_severity, defect_types }`, `annotated_paths[]`.

**Building static image URLs**

Do not use the old helper functions `getOriginalImageUrl` / `getProcessedImageUrl` / `getAnnotatedImageUrl` — the API now returns relative paths directly in `original_path` and `annotated_paths`. Prefix them with the base URL:

```ts
const url = `${API_BASE_URL}/static/${path}`;
// e.g. http://localhost:8000/static/jobs/{job_id}/annotated/file_annotated.jpg
```

**Error codes**: `400` bad file, `404` not found, `409` wrong pipeline status or report exists, `413` file too large, `415` unsupported type, `422` missing field, `500` internal pipeline error.

### Component Structure

- `components/ui/` — shadcn/ui primitives (button, card, input, select, etc.)
- `components/` — page-level sections and landing page blocks (HeroSection, StatsSection, etc.)
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `config/site.ts` — site-wide metadata

### UI Stack

- **shadcn/ui** components added via `npx shadcn@latest add <component>`
- **lucide-react** for icons
- **next-themes** with `ThemeProvider` wrapping the app (dark/light/system)
- **MUI** (`@mui/material`) is installed alongside shadcn — prefer shadcn/ui components for consistency
- Tailwind v4 with PostCSS; CSS variables defined in `app/globals.css`
