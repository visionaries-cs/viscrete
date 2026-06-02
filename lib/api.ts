export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://viscrete-core.shares.zrok.io';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobStatusResponse {
  job_id: string;
  status: string;
  input_type: string;
  site_name?: string;
  site_location?: string; // backend may return either field name
  inspector_name?: string;
  file_count?: number;
  created_at?: string;
  updated_at?: string;
  pdf_path?: string | null;
}

export interface ValidationResult {
  file_id?: string;
  filename: string;
  is_valid: boolean;
  laplacian_score: number;
  blur_threshold: number;
  is_blurry: boolean;
  original_path?: string | null;
  // Actual API shape — gps_data is nested with latitude/longitude/altitude
  gps_data?: { latitude: number | null; longitude: number | null; altitude?: number | null } | null;
  // Legacy shape used by upload page (lat/lng flat)
  gps?: { lat: number; lng: number } | null;
  reason?: string | null;
  // Set locally after a PATCH /location — backend reflects this on FileStatusItem
  location_label?: string | null;
  // Set locally after PATCH /override
  blur_override?: boolean;
}

export interface FileStatusItem {
  file_id: string;
  filename: string;
  status: string;
  laplacian_score?: number;
  blur_override?: boolean;
  gps_data?: { latitude: number | null; longitude: number | null; altitude?: number | null } | null;
  location_label?: string | null;
}

export interface FileOverrideResponse {
  file_id: string;
  blur_override: boolean;
  status: string;
}

export interface LocationUpdateRequest {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  location_label?: string;
  file_ids?: string[];
}

export interface ClusterInfo {
  cluster_id: number;
  member_count: number;
  clahe_clip_limit: number;
  tile_grid_size: [number, number];
  source: 'IMOCS' | 'Default';
}

export interface PreprocessResponse {
  job_id: string;
  status: string;
  cluster_info: ClusterInfo[];
  total_processed: number;
  filenames: string[];
}

export interface DetectionLocation {
  type: 'geo' | 'pixel';
  latitude?: number | null;
  longitude?: number | null;
  altitude_m?: number | null;
  pixel_x?: number | null;
  pixel_y?: number | null;
}

export interface Detection {
  id: string;
  class_id: number;
  defect_type: string;
  confidence: number;
  severity?: 'Low' | 'Medium' | 'High';
  crack_width_mm?: number | null;
  area_px?: number | null;
  bounding_box: { x1: number; y1: number; x2: number; y2: number };
  location?: DetectionLocation | null;
  frame_index?: number | null;
}

export interface DetectionResult {
  filename: string;
  annotated_path?: string;
  defect_counts: {
    crack: number;
    spalling: number;
    peeling: number;
    algae: number;
  };
  total_defects: number;
  detections: Detection[];
}

export interface DetectResponse {
  results: DetectionResult[];
  annotated_paths: string[];
  total_defect_count: number;
  total_defect_counts: {
    crack: number;
    spalling: number;
    peeling: number;
    algae: number;
  };
  conf_threshold?: number;
}

export interface ReportDefect {
  filename: string;
  defect_type: string;
  confidence: number;
  severity: 'Low' | 'Medium' | 'High';
  crack_width_mm?: number | null;
  area_px?: number | null;
}

export interface ReportResponse {
  report_id: string;
  job_id: string;
  generated_at: string;
  site_name: string;
  inspector_name: string;
  total_defects: number;
  dominant_severity: 'Low' | 'Medium' | 'High' | null;
  defect_types_found: string[];
  severity_breakdown: { Low: number; Medium: number; High: number };
  gps_locations: { filename: string; lat: number; lng: number }[];
  defects: ReportDefect[];
  annotated_filenames: string[];
}



// ─── Jobs ─────────────────────────────────────────────────────────────────────

/** GET /api/v1/jobs/{job_id} — get full job record including status */
export async function getJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`);
  return handleResponse<JobStatusResponse>(res);
}

/** GET /api/v1/jobs/{job_id} — get job status including per-file list */
export async function getJobFiles(jobId: string): Promise<FileStatusItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`);
  const data = await handleResponse<{ files?: FileStatusItem[] }>(res);
  return data.files ?? [];
}

/** PATCH /api/v1/jobs/{job_id}/location — update location for files without GPS
 *  - Batch: omit file_ids — backend updates all files missing both GPS and label
 *  - Select-toggle / Single: pass file_ids array
 *  Must supply latitude+longitude together, or location_label, or both.
 */
export async function updateLocation(
  jobId: string,
  payload: LocationUpdateRequest,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/location`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  await handleResponse<unknown>(res);
}

/** GET /api/v1/jobs — list all non-deleted jobs newest first */
export async function listJobs(): Promise<JobStatusResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs`);
  return handleResponse<JobStatusResponse[]>(res);
}

/** DELETE /api/v1/jobs/{job_id} — soft-delete job and remove files from disk */
export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  await handleResponse<unknown>(res);
}

/** POST /api/v1/jobs — create a new job */
export async function createJob(
  inputType: 'image' | 'video',
  siteName: string,
  inspectorName: string,
): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_type: inputType,
      site_location: siteName,
      inspector_name: inspectorName,
    }),
  });
  return handleResponse<JobStatusResponse>(res);
}

// ─── Validate ─────────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/validate — upload multiple files & receive per-file validation */
export async function validateFiles(jobId: string, files: File[]): Promise<ValidationResult[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/validate`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<ValidationResult[]>(res);
}

/** PATCH /api/v1/jobs/{job_id}/files/{file_id}/override — accept a blurry file as-is */
export async function overrideFile(jobId: string, fileId: string): Promise<FileOverrideResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}/override`,
    { method: 'PATCH' },
  );
  return handleResponse<FileOverrideResponse>(res);
}

/** PUT /api/v1/jobs/{job_id}/files/{file_id} — replace a file with a new upload */
export async function replaceFile(jobId: string, fileId: string, file: File): Promise<ValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`,
    { method: 'PUT', body: formData },
  );
  return handleResponse<ValidationResult>(res);
}

/** @deprecated use validateFiles instead */
export async function uploadImage(jobId: string, file: File): Promise<unknown> {
  return validateFiles(jobId, [file]);
}

// ─── Preprocess ───────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/preprocess — start preprocessing pipeline (202 Accepted) */
export async function preprocessJob(jobId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/preprocess`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  // 202 Accepted — pipeline started in background, no body
}

// ─── Detect ───────────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/detect — run YOLOv11 inference */
export async function detectJob(jobId: string): Promise<DetectResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect`,
    { method: 'POST' }
  );
  return handleResponse<DetectResponse>(res);
}

/** GET /api/v1/jobs/{job_id}/detect — retrieve cached detection results */
export async function getDetectResults(jobId: string): Promise<DetectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect`);
  return handleResponse<DetectResponse>(res);
}

// ─── Static files ─────────────────────────────────────────────────────────────

/** Build URL for original image: GET /static/{job_id}/original/{filename} */
export function getOriginalImageUrl(jobId: string, filename: string): string {
  return `${API_BASE_URL}/static/${encodeURIComponent(jobId)}/original/${encodeURIComponent(filename)}`;
}

/** Build URL for processed image: GET /static/{job_id}/processed/{filename} */
export function getProcessedImageUrl(jobId: string, filename: string): string {
  return `${API_BASE_URL}/static/${encodeURIComponent(jobId)}/processed/${encodeURIComponent(filename)}`;
}

/** Build URL for annotated image: GET /static/{job_id}/annotated/{filename} */
export function getAnnotatedImageUrl(jobId: string, filename: string): string {
  return `${API_BASE_URL}/static/${encodeURIComponent(jobId)}/annotated/${encodeURIComponent(filename)}`;
}

/** @deprecated — use getAnnotatedImageUrl instead */
export async function getResultImageUrl(jobId: string, imageName: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/image?image_name=${encodeURIComponent(imageName)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch image`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Remarks ──────────────────────────────────────────────────────────────────

export interface RemarksResponse {
  job_id: string;
  remarks: Record<string, string>;
}

/** PATCH /api/v1/jobs/{job_id}/remarks — merge remarks keyed by file_id.
 *  PATCH is additive: sending one file_id preserves all others.
 *  Send empty string to clear a remark for a specific file. */
export async function patchRemarks(
  jobId: string,
  remarks: Record<string, string>,
): Promise<RemarksResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/remarks`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks }),
    },
  );
  return handleResponse<RemarksResponse>(res);
}

// ─── Report ───────────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/report — generate PDF report. Pass regenerate=true to overwrite an existing one. */
export async function generateReport(jobId: string, regenerate = false): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report${regenerate ? '?regenerate=true' : ''}`;
  const res = await fetch(url, { method: 'POST' });
  if (res.status === 201 || res.status === 409) return;
  const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
  throw new Error(errData.detail || `HTTP ${res.status}`);
}

/** GET /api/v1/jobs/{job_id}/report — fetch existing report */
export async function getReport(jobId: string): Promise<ReportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report`);
  return handleResponse<ReportResponse>(res);
}

// ─── Legacy helpers (kept for upload-review & results pages) ──────────────────

export interface ValidatedImage {
  filename?: string;
  image_name?: string;
  coordinates?: string;
}

export interface ValidateImagesResponse {
  images: ValidatedImage[];
}

export async function validateImages(jobId: string): Promise<ValidateImagesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`);
  return handleResponse<ValidateImagesResponse>(res);
}
