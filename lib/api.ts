const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
  inspector_name?: string;
  file_count?: number;
  created_at?: string;
}

export interface ValidationResult {
  filename: string;
  is_valid: boolean;
  laplacian_score: number;
  blur_threshold: number;
  is_blurry: boolean;
  gps?: { lat: number; lng: number } | null;
  reason?: string | null;
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

export interface Detection {
  id: string;
  class_id: number;
  defect_type: string;
  confidence: number;
  severity?: 'Low' | 'Medium' | 'High';
  crack_width_mm?: number | null;
  area_px?: number | null;
  bounding_box: { x1: number; y1: number; x2: number; y2: number };
}

export interface DetectionResult {
  filename: string;
  annotated_path?: string;
  defect_counts: {
    cracks: number;
    spalling: number;
    peeling: number;
    algae: number;
    staining: number;
  };
  total_defects: number;
  detections: Detection[];
}

export interface DetectResponse {
  results: DetectionResult[];
  annotated_paths: string[];
  total_defect_count: number;
  total_defect_counts: {
    cracks: number;
    spalling: number;
    peeling: number;
    algae: number;
    staining: number;
  };
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

/** GET /api/v1/jobs — list all non-deleted jobs newest first */
export async function listJobs(): Promise<JobStatusResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs`);
  return handleResponse<JobStatusResponse[]>(res);
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

/** @deprecated use validateFiles instead */
export async function uploadImage(jobId: string, file: File): Promise<unknown> {
  return validateFiles(jobId, [file]);
}

// ─── Preprocess ───────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/preprocess — run preprocessing pipeline */
export async function preprocessJob(jobId: string): Promise<PreprocessResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/preprocess`,
    { method: 'POST' }
  );
  return handleResponse<PreprocessResponse>(res);
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

// ─── Report ───────────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/report — generate inspection report */
export async function generateReport(jobId: string): Promise<ReportResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report`,
    { method: 'POST' }
  );
  return handleResponse<ReportResponse>(res);
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
