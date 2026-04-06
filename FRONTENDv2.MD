## Prompt:

```powershell
Read the FRONTENDv2.md file carefully and use it as the single source of truth for building the VISCRETE frontend. The project is a concrete defect detection thesis demo using Next.js App Router and Tailwind CSS.
Build the following pages exactly as specified in the file:

/upload — two-column layout with job details form + drag and drop on the left + previous jobs, validation results with GPS/blur filters on the right
/preprocess/[job_id] — progress stepper for each pipeline phase + before/after image comparison per file
/detect/[job_id] — annotated images grid + defect table + generate report button
/report/[job_id] — final inspection report summary

Follow all layout descriptions, API call sequences, field names, filter behaviors, and error handling rules defined in the spec. Do not add features or pages not mentioned in the spec.
```

# VISCRETE Frontend — Page Specification

> **Stack assumption:** Next.js (App Router) with Tailwind CSS  
> **API Base URL:** `http://localhost:8000/api/v1`  
> **Purpose:** Thesis defense demo — clean, functional, easy to present

---

## Route Map

```
/                          → (optional) landing/home — start new job button
/upload                    → Create job + upload files + validation results
/preprocess/[job_id]       → Preprocessing pipeline with progress + before/after
/detect/[job_id]           → Detection results + annotated images + generate report
/report/[job_id]           → Final inspection report summary
```

---

## Page 1 — `/upload`

### Purpose

Create a job, collect job metadata, upload files, and display validation results — all in one page.

### Layout

Two-column layout (side by side on desktop, stacked on mobile):

```
┌──────────────────────────┬──────────────────────────────┐
│   LEFT COLUMN            │   RIGHT COLUMN               │
│   Job Details + Upload   │   Validation Results         │
└──────────────────────────┴──────────────────────────────┘
```

---

### Left Column — Job Details + Upload

#### Form Fields

All fields are required before upload is allowed:

| Field          | Type            | Notes                   |
| -------------- | --------------- | ----------------------- |
| Site Name      | Text input      | e.g. "Magsaysay Bridge" |
| Inspector Name | Text input      | e.g. "Juan dela Cruz"   |
| Media Type     | Radio or Select | `"image"` or `"video"`  |

#### Drag & Drop Upload Area

- Accepts multiple files
- Displays accepted MIME types based on selected media type:
  - Image: `jpg`, `png`, `bmp`, `tiff` (max 20MB each)
  - Video: `mp4`, `avi`, `mov` (max 500MB each)
- Shows file names + size + remove button after selection
- Upload button triggers:
  1. `POST /jobs` with `input_type` → receives `job_id`
  2. `POST /jobs/{job_id}/validate` with files → receives validation results
- Show a loading/spinner state while validation is running

#### Behavior

- Upload button is **disabled** until all form fields are filled and at least one file is selected
- After upload, the right column populates with results
- If all files are valid → show **"Proceed to Preprocessing →"** button
- If some files fail → still allow proceeding if at least one is valid

---

#### Previous Jobs (bottom of left column)

Shown below the upload area as a collapsible or always-visible section titled **"Previous Jobs"**.

Fetched on page load via `GET /jobs` — displays all non-deleted jobs newest first.

##### Per-Job Row

Each job displays:

| Field      | Display                                                          |
| ---------- | ---------------------------------------------------------------- |
| Site Name  | e.g. `Magsaysay Bridge`                                          |
| Status     | Badge — `completed`, `detected`, `preprocessed`, etc.            |
| Media Type | `image` or `video`                                               |
| File Count | e.g. `3 files`                                                   |
| Created At | e.g. `Apr 4, 2026 12:00 PM`                                      |
| Action     | Link → navigates to the correct page based on status (see below) |

##### Status → Route Mapping

Clicking a previous job resumes from where it left off:

| Job Status                                        | Navigates To               |
| ------------------------------------------------- | -------------------------- |
| `created` / `validating` / `validated` / `failed` | `/upload` (re-upload flow) |
| `preprocessing` / `preprocessed`                  | `/preprocess/[job_id]`     |
| `detecting` / `detected`                          | `/detect/[job_id]`         |
| `reporting` / `completed`                         | `/report/[job_id]`         |

##### Pagination

- Show **5 jobs per page**
- Pagination controls at the bottom: `← Previous` · `Page 1 of N` · `Next →`
- Pagination is client-side (fetch all from `GET /jobs`, paginate in-component)
- Show a soft separator or divider between the upload area and this section

##### API Call

```
GET /jobs    → array of JobStatusResponse (on page load)
```

---

### Right Column — Validation Results

#### Filters (shown after results load)

Two toggle filters at the top of the results column:

| Filter | Options                            |
| ------ | ---------------------------------- |
| GPS    | `All` · `With GPS` · `Without GPS` |
| Blur   | `All` · `Sharp` · `Blurry`         |

Filters apply client-side on the already-returned results — no re-fetching needed.

#### Per-File Result Card

Each uploaded file gets a card showing:

| Field               | Display                                |
| ------------------- | -------------------------------------- |
| Filename            | e.g. `crack_photo.jpg`                 |
| Status              | ✅ `Valid` or ❌ `Invalid` badge       |
| Laplacian Score     | e.g. `312.5` (higher = sharper)        |
| Blur threshold note | Show `(threshold: 100.0)` as hint      |
| GPS                 | 📍 `14.5995, 120.9842` or `—` if none  |
| Reason (if invalid) | e.g. `"File too blurry (score: 42.1)"` |

#### Summary Line

Above the file cards, show a summary:

```
3 files uploaded  •  2 valid  •  1 invalid
```

#### API Calls (in order)

```
POST /jobs                        → { job_id, status: "created" }
POST /jobs/{job_id}/validate      → array of per-file validation results
```

---

## Page 2 — `/preprocess/[job_id]`

### Purpose

Run the preprocessing pipeline and show a step-by-step progress stepper alongside before/after image comparisons.

### Layout

Two sections stacked vertically:

1. **Progress Stepper** — top of the page
2. **Before/After Results** — below, populated as processing completes

---

### Section 1 — Progress Stepper

Show each phase of the preprocessing pipeline as a horizontal (or vertical on mobile) stepper:

```
[1] Feature Extraction  →  [2] K-Means Clustering  →  [3] IMOCS  →  [4] CLAHE  →  [5] Bilateral Filter
```

#### Step States

| State     | Visual                |
| --------- | --------------------- |
| Pending   | Gray, not yet started |
| Active    | Highlighted + spinner |
| Completed | Checkmark + green     |
| Failed    | Red X + error message |

#### Behavior

- On page load, automatically trigger `POST /jobs/{job_id}/preprocess`
- Since the API returns only after full completion, simulate step progression:
  - Show steps advancing with timed delays (e.g. every 1.5s) while the request is in-flight
  - On response → mark all steps complete and show results
- Alternatively, if a polling approach is available, update steps based on job status

#### "Run Preprocessing" Button

- Shown before processing starts
- Disabled and shows spinner while processing is in-flight
- Hidden once processing is complete

---

### Section 2 — Cluster Info + Before/After

Shown after `POST /preprocess` returns successfully.

#### Cluster Summary Cards

One card per cluster from `cluster_info[]`:

| Field            | Display                    |
| ---------------- | -------------------------- |
| Cluster ID       | `Cluster 0`                |
| Member Count     | `2 images`                 |
| CLAHE Clip Limit | `3.5`                      |
| Tile Grid Size   | `8 × 8`                    |
| Source           | `IMOCS` or `Default` badge |

#### Before / After Image Comparison

For each file in the job, show a side-by-side or slider comparison:

```
┌─────────────────────┬─────────────────────┐
│   ORIGINAL          │   PROCESSED         │
│   /original/file    │   /processed/file   │
└─────────────────────┴─────────────────────┘
```

- Images served from:
  - `GET /static/jobs/{job_id}/original/{filename}`
  - `GET /static/jobs/{job_id}/processed/{filename}`
- Optional: image drag-slider overlay (single image with a draggable divider) for a more impressive demo

#### Proceed Button

```
[ Proceed to Detection → ]
```

- Navigates to `/detect/[job_id]`
- Only shown after preprocessing is complete

#### API Calls

```
POST /jobs/{job_id}/preprocess    → cluster_info + total_processed
GET  /static/jobs/{job_id}/original/{filename}
GET  /static/jobs/{job_id}/processed/{filename}
```

---

## Page 3 — `/detect/[job_id]`

### Purpose

Run YOLOv11 inference and display annotated images with a per-file defect breakdown.

> **Note:** No changes to the existing design — documented here for completeness.

### Layout

Two sections:

1. **Annotated Images** — grid or list of annotated output images
2. **Defect List** — per-detection breakdown table

---

### Section 1 — Annotated Images

- Images served from `GET /static/jobs/{job_id}/annotated/{filename}`
- Show bounding box labels (defect type + severity) already drawn on image by backend
- Image grid (2–3 columns)

---

### Section 2 — Defect List

Per-detection table:

| Column      | Value                                  |
| ----------- | -------------------------------------- |
| Defect Type | `crack`, `spalling`, `corrosion`, etc. |
| Confidence  | `92%`                                  |
| Severity    | `Low` / `Medium` / `High` badge        |
| Crack Width | `2.6 mm` or `—`                        |
| Area        | `18,000 px²` or `—`                    |

Summary line above table:

```
3 defects detected  •  1 Low  •  1 Medium  •  1 High
```

---

### Generate Report Button

```
[ Generate Report ]
```

- Triggers `POST /jobs/{job_id}/report`
- Shows spinner while in-flight
- On success → redirect to `/report/[job_id]`

#### API Calls

```
POST /jobs/{job_id}/detect           → detections array + annotated_paths
GET  /static/jobs/{job_id}/annotated/{filename}
POST /jobs/{job_id}/report           → on button click
```

---

## Page 4 — `/report/[job_id]`

### Purpose

Display the final structured inspection report.

### Sections

#### Header

- Report ID, Job ID, Date generated
- Inspector name, Site name (from job metadata)

#### Summary Card

| Field              | Value                        |
| ------------------ | ---------------------------- |
| Total Defects      | `3`                          |
| Dominant Severity  | `Medium` badge               |
| Defect Types Found | `crack`, `spalling`          |
| Severity Breakdown | Low: 1 · Medium: 1 · High: 1 |

#### GPS Locations

- List of latitude/longitude per file
- Optional: small map embed if GPS data is present

#### Full Defect Table

Same table as detection page, but read-only and printable.

#### Annotated Images

Same grid as detection page.

#### API Calls

```
GET /jobs/{job_id}/report    → full report object
```

---

## Shared UI Components

| Component                                  | Used On                    |
| ------------------------------------------ | -------------------------- |
| File status badge (`Valid` / `Invalid`)    | `/upload`                  |
| Severity badge (`Low` / `Medium` / `High`) | `/detect`, `/report`       |
| Progress stepper                           | `/preprocess/[job_id]`     |
| Before/after image viewer                  | `/preprocess/[job_id]`     |
| Loading spinner / skeleton                 | All pages during API calls |
| Error toast / alert                        | All pages on API errors    |

---

## State Management Notes

- `job_id` is obtained on `/upload` after `POST /jobs` and passed via URL to all subsequent pages
- No global state manager required — `job_id` from the URL param is enough for all API calls
- Validation results and detection results can be stored in local component state (no persistence needed for demo)

---

## Error Handling (Minimum Required)

| Scenario                     | Behavior                                                  |
| ---------------------------- | --------------------------------------------------------- |
| Job not found (404)          | Show "Job not found" message + link back to `/upload`     |
| Job in wrong status (409)    | Show "This step has already been completed" message       |
| File too blurry / wrong type | Shown inline in validation results card                   |
| API unreachable              | Show "Backend unavailable — is the server running?" toast |
