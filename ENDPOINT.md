# VISCRETE API — Frontend Integration Guide

> **Base URL:** `http://localhost:8000/api/v1`  
> **Static Files:** `http://localhost:8000/static/jobs/{job_id}/...`  
> **Swagger UI:** `http://localhost:8000/docs`

All endpoints return JSON. Errors follow the shape `{ "detail": "..." }`.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Job Status Reference](#job-status-reference)
3. [Error Codes Reference](#error-codes-reference)
4. [Health Check](#health-check)
5. [Job Management](#job-management)
   - [Create Job](#1-create-job)
   - [List All Jobs](#2-list-all-jobs)
   - [Get Job Status](#3-get-job-status)
   - [Delete Job](#4-delete-job)
6. [Input Validation](#input-validation)
   - [Upload & Validate Files](#5-upload--validate-files)
   - [Update File Locations](#6-update-file-locations)
7. [Preprocessing](#preprocessing)
   - [Run Preprocessing](#7-run-preprocessing)
8. [Detection](#detection)
   - [Run Detection](#8-run-detection)
   - [Get Cached Detection](#9-get-cached-detection)
9. [Report](#report)
   - [Generate Report](#10-generate-report)
   - [Get Cached Report](#11-get-cached-report)

---

## Pipeline Overview

A complete inspection session follows these sequential steps. Each step requires
the job to be in the correct status before it can run.

```
1. POST /api/v1/jobs                        → creates job (status: "created")
2. POST /api/v1/jobs/{job_id}/validate      → upload files (status: "validated")
   PATCH /api/v1/jobs/{job_id}/location     → (optional) assign GPS to files
3. POST /api/v1/jobs/{job_id}/preprocess    → IMOCS → CLAHE → BF (status: "preprocessed")
4. POST /api/v1/jobs/{job_id}/detect        → YOLOv11 inference (status: "detected")
5. POST /api/v1/jobs/{job_id}/report        → aggregate results (status: "completed")
```

---

## Job Status Reference

| Status | Meaning |
|---|---|
| `created` | Job initialized, awaiting file upload |
| `validating` | Blur check + GPS extraction in progress |
| `validated` | All files passed — ready for preprocessing |
| `preprocessing` | IMOCS → CLAHE → Bilateral Filter running |
| `preprocessed` | All files preprocessed — ready for detection |
| `detecting` | YOLOv11 inference running |
| `detected` | Detection complete — ready for report |
| `reporting` | Report being assembled |
| `completed` | Pipeline done — report available |
| `failed` | One or more files failed validation |

---

## Error Codes Reference

| HTTP Code | When it occurs |
|---|---|
| `400` | File unreadable or fails blur check |
| `404` | `job_id` or resource does not exist |
| `409` | Pipeline step called out of order, or report already exists |
| `413` | File exceeds size limit (images: 20 MB, videos: 500 MB) |
| `415` | Unsupported file type |
| `422` | Missing or invalid request body field |
| `500` | Internal pipeline error (IMOCS, YOLO, disk I/O) |

---

## Health Check

### `GET /ping`

Confirms the server is running. No authentication required.

**Response `200`**
```json
{
  "message": "pong",
  "status": "ok"
}
```

---

## Job Management

### 1. Create Job

**`POST /api/v1/jobs`**

Creates a job container before any files are uploaded. Returns the `job_id` used in every subsequent call.

**Request Body**
```json
{
  "input_type": "image"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `input_type` | `string` | ✅ | `"image"` or `"video"` |

**Response `201`** — `JobCreateResponse`
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "created",
  "input_type": "image",
  "file_count": 0,
  "created_at": "2026-04-09T08:00:00.000000+00:00"
}
```

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID — use this in all subsequent calls |
| `status` | `string` | Always `"created"` on creation |
| `input_type` | `string` | `"image"` or `"video"` |
| `file_count` | `integer` | Always `0` at creation |
| `created_at` | `string` | ISO 8601 UTC timestamp |

---

### 2. List All Jobs

**`GET /api/v1/jobs`**

Returns all non-deleted jobs ordered by `created_at` descending.

**Response `200`** — `Array<JobStatusResponse>`
```json
[
  {
    "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "completed",
    "input_type": "image",
    "file_count": 3,
    "created_at": "2026-04-09T08:00:00.000000+00:00",
    "updated_at": "2026-04-09T08:05:12.000000+00:00",
    "files": [
      {
        "file_id": "a1b2c3d4-...",
        "filename": "crack_01.jpg",
        "status": "detected",
        "laplacian_score": 142.56
      }
    ]
  }
]
```

---

### 3. Get Job Status

**`GET /api/v1/jobs/{job_id}`**

Returns the current status of a job and per-file statuses. Poll this to track pipeline progress.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID from Create Job |

**Response `200`** — `JobStatusResponse`
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "preprocessed",
  "input_type": "image",
  "file_count": 2,
  "created_at": "2026-04-09T08:00:00.000000+00:00",
  "updated_at": "2026-04-09T08:03:45.000000+00:00",
  "files": [
    {
      "file_id": "a1b2c3d4-...",
      "filename": "crack_01.jpg",
      "status": "preprocessed",
      "laplacian_score": 142.56
    },
    {
      "file_id": "b2c3d4e5-...",
      "filename": "spall_02.jpg",
      "status": "invalid",
      "laplacian_score": 18.30
    }
  ]
}
```

**`JobStatusResponse` fields**

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Job UUID |
| `status` | `string` | Current pipeline status (see Job Status Reference) |
| `input_type` | `string` | `"image"` or `"video"` |
| `file_count` | `integer` | Number of valid files in the job |
| `created_at` | `string` | ISO 8601 timestamp |
| `updated_at` | `string\|null` | ISO 8601 timestamp of last update |
| `files` | `array` | Per-file status items (see below) |

**`FileStatusItem` fields**

| Field | Type | Description |
|---|---|---|
| `file_id` | `string` | File UUID |
| `filename` | `string` | Original uploaded filename |
| `status` | `string` | `"pending"` \| `"validated"` \| `"invalid"` \| `"preprocessed"` \| `"detected"` |
| `laplacian_score` | `float\|null` | Blur metric from validation |

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |

---

### 4. Delete Job

**`DELETE /api/v1/jobs/{job_id}`**

Soft-deletes the job record and permanently removes all files from disk (`app/database/jobs/{job_id}/`).

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID from Create Job |

**Response `200`**
```json
{
  "deleted": true,
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |

---

## Input Validation

### 5. Upload & Validate Files

**`POST /api/v1/jobs/{job_id}/validate`**

Uploads one or more files to the job, runs the Laplacian blur check on each file, and extracts EXIF GPS data. All files are saved to disk regardless of validation outcome.

**Content-Type:** `multipart/form-data`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID from Create Job — must be in `"created"` status |

**Form Fields**

| Field | Type | Description |
|---|---|---|
| `files` | `File[]` | One or more files. All must be the same type (all images or all video) |

**Accepted file types**

| Type | MIME types | Size limit |
|---|---|---|
| Image | `image/jpeg`, `image/png`, `image/bmp`, `image/tiff` | 20 MB each |
| Video | `video/mp4`, `video/avi`, `video/quicktime` | 500 MB each |

**Response `200`** — `Array<InputValidationResponse>`
```json
[
  {
    "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "file_id": "a1b2c3d4-5678-...",
    "filename": "crack_01.jpg",
    "file_type": "image",
    "status": "valid",
    "is_valid": true,
    "laplacian_score": 142.56,
    "blur_threshold": 100.0,
    "gps_data": {
      "latitude": 14.5995,
      "longitude": 120.9842,
      "altitude": 15.0
    },
    "original_path": "jobs/3fa85f64-.../original/a1b2c3d4....jpg",
    "message": "File validated successfully."
  },
  {
    "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "file_id": "b2c3d4e5-...",
    "filename": "blurry.jpg",
    "file_type": "image",
    "status": "invalid",
    "is_valid": false,
    "laplacian_score": 18.30,
    "blur_threshold": 100.0,
    "gps_data": {
      "latitude": null,
      "longitude": null,
      "altitude": null
    },
    "original_path": "jobs/3fa85f64-.../original/b2c3d4e5....jpg",
    "message": "File too blurry (Laplacian score=18.3)."
  }
]
```

**`InputValidationResponse` fields**

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Parent job UUID |
| `file_id` | `string` | UUID assigned to this file |
| `filename` | `string` | Original uploaded filename |
| `file_type` | `string` | `"image"` or `"video"` |
| `status` | `string` | `"valid"` or `"invalid"` |
| `is_valid` | `boolean` | `true` if file passed all checks |
| `laplacian_score` | `float` | Blur metric — higher means sharper |
| `blur_threshold` | `float` | Cutoff value — files below this are rejected |
| `gps_data` | `object` | `{ latitude, longitude, altitude }` — fields are `null` if no EXIF GPS |
| `original_path` | `string` | Relative storage path — prefix with `/static/` to build a URL |
| `message` | `string` | Human-readable result description |

> **Note:** If any file fails validation, the job status is set to `"failed"`. All files are still saved to disk and recorded with their individual status so the frontend can show which files were rejected and why.

**Building original file URLs**
```js
const url = `http://localhost:8000/static/${original_path}`;
```

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |
| `409` | Job is not in `"created"` status |
| `413` | A file exceeds the size limit |
| `415` | A file's MIME type is not allowed |

---

### 6. Update File Locations

**`PATCH /api/v1/jobs/{job_id}/location`**

Assigns GPS coordinates to file records. Useful when images were captured without EXIF GPS data. Supports three modes via the optional `file_ids` field:

- **Batch** (`file_ids` omitted): updates all files in the job that have no GPS data
- **Selected** (`file_ids` with multiple IDs): updates only those specific files
- **Single** (`file_ids` with one ID): updates a single file

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID — any non-deleted job |

**Request Body**
```json
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "altitude": 15.0,
  "file_ids": ["a1b2c3d4-...", "b2c3d4e5-..."]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `latitude` | `float` | ✅ | Decimal degrees |
| `longitude` | `float` | ✅ | Decimal degrees |
| `altitude` | `float\|null` | ❌ | Meters above sea level |
| `file_ids` | `string[]\|null` | ❌ | Omit to update all files missing GPS |

**Response `200`** — `LocationUpdateResponse`
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "updated_count": 2,
  "skipped_count": 1,
  "files": [
    {
      "file_id": "a1b2c3d4-...",
      "filename": "crack_01.jpg",
      "latitude": 14.5995,
      "longitude": 120.9842,
      "altitude": 15.0
    },
    {
      "file_id": "b2c3d4e5-...",
      "filename": "spall_02.jpg",
      "latitude": 14.5995,
      "longitude": 120.9842,
      "altitude": 15.0
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Job UUID |
| `updated_count` | `integer` | Number of files that were updated |
| `skipped_count` | `integer` | Number of files not in the target set |
| `files` | `array` | Each updated file with its assigned coordinates |

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |

---

## Preprocessing

### 7. Run Preprocessing

**`POST /api/v1/jobs/{job_id}/preprocess`**

Runs the full VISCRETE preprocessing pipeline on all validated files. No request body required — the service reads validated files from the job's metadata.

The pipeline differs by `input_type`:

- **Image:** Feature Extraction → Clustering → IMOCS Optimization → CLAHE Enhancement → Bilateral Filter
- **Video:** Frame Sampling → Median Frame Construction → IMOCS Optimization → Frame Processing → Save Output

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID — must be in `"validated"` status |

**Response `200`** — `PreprocessResponse`

**Image pipeline example:**
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "success",
  "pipeline_type": "image",
  "total_processed": 3,
  "pipeline_steps": [
    {
      "step": 1,
      "name": "Feature Extraction",
      "status": "completed",
      "duration_sec": 0.12,
      "detail": "3 image(s) analyzed"
    },
    {
      "step": 2,
      "name": "Clustering",
      "status": "completed",
      "duration_sec": 0.03,
      "detail": "3 image(s) grouped into 2 cluster(s)"
    },
    {
      "step": 3,
      "name": "IMOCS Optimization",
      "status": "completed",
      "duration_sec": 4.82,
      "detail": "2 CLAHE config(s) optimized"
    },
    {
      "step": 4,
      "name": "CLAHE Enhancement",
      "status": "completed",
      "duration_sec": 0.07,
      "detail": "3 image(s) enhanced"
    },
    {
      "step": 5,
      "name": "Bilateral Filter",
      "status": "completed",
      "duration_sec": 0.07,
      "detail": "3 image(s) filtered"
    }
  ],
  "cluster_info": [
    {
      "cluster_id": 0,
      "representative_file_id": "a1b2c3d4-...",
      "member_count": 2,
      "clahe_params": {
        "clip_limit": 2.75,
        "tile_grid_size": [8, 8],
        "source": "imocs"
      }
    },
    {
      "cluster_id": 1,
      "representative_file_id": "b2c3d4e5-...",
      "member_count": 1,
      "clahe_params": {
        "clip_limit": 3.50,
        "tile_grid_size": [12, 12],
        "source": "imocs"
      }
    }
  ]
}
```

**Video pipeline example:**
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "success",
  "pipeline_type": "video",
  "total_processed": 1,
  "pipeline_steps": [
    {
      "step": 1,
      "name": "Frame Sampling",
      "status": "completed",
      "duration_sec": 0.51,
      "detail": "20 frame(s) sampled"
    },
    {
      "step": 2,
      "name": "Median Frame Construction",
      "status": "completed",
      "duration_sec": 0.09,
      "detail": "Median frame built from 20 sample(s)"
    },
    {
      "step": 3,
      "name": "IMOCS Optimization",
      "status": "completed",
      "duration_sec": 1.84,
      "detail": "clip_limit=2.50, tile_grid=[8, 8]"
    },
    {
      "step": 4,
      "name": "Frame Processing",
      "status": "completed",
      "duration_sec": 44.20,
      "detail": "1200 frame(s) processed"
    },
    {
      "step": 5,
      "name": "Save Output",
      "status": "completed",
      "duration_sec": 0.0,
      "detail": "Saved to abc123_clahe.mp4"
    }
  ],
  "cluster_info": [
    {
      "cluster_id": 0,
      "representative_file_id": "c3d4e5f6-...",
      "member_count": 1,
      "clahe_params": {
        "clip_limit": 2.50,
        "tile_grid_size": [8, 8],
        "source": "imocs_video_median"
      }
    }
  ]
}
```

**`PreprocessResponse` fields**

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Job UUID |
| `status` | `string` | `"success"` or `"failed"` |
| `pipeline_type` | `string` | `"image"` or `"video"` — use to render the correct stepper |
| `total_processed` | `integer` | Number of images or videos processed |
| `pipeline_steps` | `array` | Ordered step results — one entry per pipeline stage |
| `cluster_info` | `array` | CLAHE parameters determined by IMOCS per cluster |

**`PipelineStep` fields**

| Field | Type | Description |
|---|---|---|
| `step` | `integer` | 1-based index — maps directly to stepper position |
| `name` | `string` | Human-readable step label for display |
| `status` | `string` | `"completed"` or `"failed"` |
| `duration_sec` | `float` | Wall-clock time this step took in seconds |
| `detail` | `string` | Short summary of the step's output |

**`ClusterInfoSchema` fields**

| Field | Type | Description |
|---|---|---|
| `cluster_id` | `integer` | Zero-based cluster index |
| `representative_file_id` | `string` | `file_id` of the image IMOCS ran on for this cluster |
| `member_count` | `integer` | How many images share this cluster's CLAHE parameters |
| `clahe_params.clip_limit` | `float` | CLAHE clip limit found by IMOCS |
| `clahe_params.tile_grid_size` | `int[2]` | `[width, height]` of the CLAHE tile grid |
| `clahe_params.source` | `string` | `"imocs"` for images, `"imocs_video_median"` for video |

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found or no validated files found on disk |
| `409` | Job is not in `"validated"` status |
| `500` | Internal pipeline error (IMOCS, CLAHE, or file I/O) |

---

## Detection

### 8. Run Detection

**`POST /api/v1/jobs/{job_id}/detect`**

Runs YOLOv11 inference on all preprocessed files. Computes defect severity per detection and saves annotated bounding-box overlays to disk.

No request body required.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID — must be in `"preprocessed"` status |

**Response `200`** — `DetectionResponse`
```json
{
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "file_id": "a1b2c3d4-...",
  "total_defects": 3,
  "detections": [
    {
      "defect_type": "crack",
      "confidence": 0.92,
      "bounding_box": {
        "x1": 120.5,
        "y1": 80.0,
        "x2": 340.0,
        "y2": 210.5
      },
      "severity": "High",
      "crack_width_mm": 7.2,
      "area_px": null
    },
    {
      "defect_type": "spalling",
      "confidence": 0.87,
      "bounding_box": {
        "x1": 400.0,
        "y1": 150.0,
        "x2": 580.0,
        "y2": 300.0
      },
      "severity": "Medium",
      "crack_width_mm": null,
      "area_px": 27000.0
    }
  ],
  "annotated_paths": [
    "jobs/3fa85f64-.../annotated/a1b2c3d4_annotated.jpg"
  ]
}
```

**`DetectionResponse` fields**

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Job UUID |
| `file_id` | `string` | UUID of the last processed file |
| `total_defects` | `integer` | Total defect count across all files in this job |
| `detections` | `array` | All detected defects (see `DefectDetection` below) |
| `annotated_paths` | `string[]` | Relative paths to annotated output images |

**`DefectDetection` fields**

| Field | Type | Description |
|---|---|---|
| `defect_type` | `string` | `"crack"`, `"spalling"`, `"corrosion"`, etc. |
| `confidence` | `float` | YOLO confidence score `[0.0, 1.0]` |
| `bounding_box` | `object` | `{ x1, y1, x2, y2 }` in pixels |
| `severity` | `string` | `"Low"`, `"Medium"`, or `"High"` |
| `crack_width_mm` | `float\|null` | Estimated width in mm — present only for `"crack"` type |
| `area_px` | `float\|null` | Bounding box area in pixels — present only for non-crack types |

**Severity thresholds**

| Type | Low | Medium | High |
|---|---|---|---|
| Crack | `< 1.5 mm` | `1.5 – 6 mm` | `> 6 mm` |
| Other | Small bbox area | Medium bbox area | Large bbox area |

**Building annotated image URLs**
```js
const url = `http://localhost:8000/static/${annotated_path}`;
// e.g. http://localhost:8000/static/jobs/3fa85f64-.../annotated/a1b2c3d4_annotated.jpg
```

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |
| `409` | Job is not in `"preprocessed"` status |
| `500` | YOLO inference failed |

---

### 9. Get Cached Detection

**`GET /api/v1/jobs/{job_id}/detect`**

Returns the stored detection result for a job that has already completed detection. Same response shape as Run Detection.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID of a job in `"detected"` or `"completed"` status |

**Response `200`** — `DetectionResponse` (same shape as [Run Detection](#8-run-detection))

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found, or detection has not been run yet |

---

## Report

### 10. Generate Report

**`POST /api/v1/jobs/{job_id}/report`**

Aggregates all detection results for the job into a single structured report. Includes GPS data per file, severity breakdowns, and all annotated image paths.

No request body required.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID — must be in `"detected"` status |

**Response `201`** — `ReportResponse`
```json
{
  "report_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "input_type": "image",
  "file_count": 3,
  "gps_data": [
    { "latitude": 14.5995, "longitude": 120.9842, "altitude": 15.0 },
    { "latitude": 14.6001, "longitude": 120.9850, "altitude": null },
    { "latitude": null,    "longitude": null,     "altitude": null }
  ],
  "detections": [
    {
      "defect_type": "crack",
      "confidence": 0.92,
      "bounding_box": { "x1": 120.5, "y1": 80.0, "x2": 340.0, "y2": 210.5 },
      "severity": "High",
      "crack_width_mm": 7.2,
      "area_px": null
    }
  ],
  "summary": {
    "total_defects": 5,
    "severity_counts": {
      "Low": 1,
      "Medium": 2,
      "High": 2
    },
    "dominant_severity": "High",
    "defect_types": ["crack", "spalling"]
  },
  "annotated_paths": [
    "jobs/3fa85f64-.../annotated/a1b2c3d4_annotated.jpg",
    "jobs/3fa85f64-.../annotated/b2c3d4e5_annotated.jpg",
    "jobs/3fa85f64-.../annotated/c3d4e5f6_annotated.jpg"
  ],
  "created_at": "2026-04-09T08:10:00.000000+00:00"
}
```

**`ReportResponse` fields**

| Field | Type | Description |
|---|---|---|
| `report_id` | `string` | UUID for this report |
| `job_id` | `string` | Parent job UUID |
| `input_type` | `string` | `"image"` or `"video"` |
| `file_count` | `integer` | Number of files in the job |
| `gps_data` | `array` | One `GPSData` entry per file — `latitude`/`longitude`/`altitude` are `null` if GPS was unavailable |
| `detections` | `array` | All defects found across all files (same `DefectDetection` shape as Detection) |
| `summary` | `object` | Aggregated statistics (see `ReportSummary` below) |
| `annotated_paths` | `string[]` | All annotated image paths — prefix with `/static/` to build URLs |
| `created_at` | `string` | ISO 8601 timestamp |

**`ReportSummary` fields**

| Field | Type | Description |
|---|---|---|
| `total_defects` | `integer` | Total defect count across all files |
| `severity_counts` | `object` | `{ "Low": N, "Medium": N, "High": N }` |
| `dominant_severity` | `string` | Severity level with the highest count |
| `defect_types` | `string[]` | Unique defect type names found in this job |

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found |
| `409` | Job is not in `"detected"` status, or report already exists — use GET to retrieve it |
| `500` | Report aggregation failed |

---

### 11. Get Cached Report

**`GET /api/v1/jobs/{job_id}/report`**

Returns the stored report for a job that has already been completed. Same response shape as Generate Report.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | `string` | UUID of a job in `"completed"` status |

**Response `200`** — `ReportResponse` (same shape as [Generate Report](#10-generate-report))

**Errors**

| Code | Reason |
|---|---|
| `404` | Job not found, or report has not been generated yet |
