| Endpoint | Params | Description |
|---|---|---|
| `[POST /api/v1/jobs]` | `input_type` | Creates a new inspection job container. |
| `[GET /api/v1/jobs]` | None | Lists all active inspection jobs. |
| `[GET /api/v1/jobs/{job_id}]` | `job_id` | Retrieves current job status breakdown. |
| `[DELETE /api/v1/jobs/{job_id}]` | `job_id` | Soft-deletes job and local storage. |
| `[POST /api/v1/jobs/{job_id}/validate]` | `job_id`, `files` | Validates file blur and extracts GPS. |
| `[POST /api/v1/jobs/{job_id}/preprocess]` | `job_id` | Runs preprocessing pipeline on validated files. |
| `[POST /api/v1/jobs/{job_id}/detect]` | `job_id` | Runs YOLOv11 defect detection inference. |
| `[GET /api/v1/jobs/{job_id}/detect]` | `job_id` | Retrieves cached YOLOv11 detection results. |
| `[POST /api/v1/jobs/{job_id}/report]` | `job_id` | Generates a structured inspection report. |
| `[GET /api/v1/jobs/{job_id}/report]` | `job_id` | Retrieves a cached inspection report. |
| `[GET /api/v1/ping]` | None | Confirms the server is running. |
