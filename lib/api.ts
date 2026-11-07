export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://viscrete-core.shares.zrok.io';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Returns Authorization header with the current Supabase JWT, or empty object. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // zrok's hosted free-tier frontend serves an HTML interstitial to browser
  // user agents unless this header is present. Without it, the request never
  // reaches FastAPI and the browser reports the HTML response as a CORS error.
  const headers: Record<string, string> = {
    skip_zrok_interstitial: 'true',
  };

  if (typeof window === 'undefined') return headers;
  try {
    const { getSupabase } = await import('@/lib/supabase');
    const supabase = getSupabase();

    // Register listener BEFORE getSession to avoid missing INITIAL_SESSION microtask
    const token = await new Promise<string | null>(resolve => {
      const timer = setTimeout(() => { sub.unsubscribe(); resolve(null); }, 5000);
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_e, s) => {
        if (s?.access_token) {
          clearTimeout(timer);
          sub.unsubscribe();
          resolve(s.access_token);
        }
      });
      // Also check immediately — resolves fast path if session already in memory
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          clearTimeout(timer);
          sub.unsubscribe();
          resolve(session.access_token);
        }
      });
    });
    if (token) return { ...headers, Authorization: `Bearer ${token}` };
  } catch {
    // supabase not configured — gracefully degrade
  }
  return headers;
}

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
  floor?: string | null;
  file_count?: number;
  total_defects?: number;
  created_at?: string;
  updated_at?: string;
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
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<JobStatusResponse>(res);
}

/** GET /api/v1/jobs/{job_id} — get job status including per-file list */
export async function getJobFiles(jobId: string): Promise<FileStatusItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers: await getAuthHeaders(),
  });
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
  const auth = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/location`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(payload),
    },
  );
  await handleResponse<unknown>(res);
}

/** GET /api/v1/jobs — list all non-deleted jobs newest first */
export async function listJobs(): Promise<JobStatusResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<JobStatusResponse[]>(res);
}

/** DELETE /api/v1/jobs/{job_id} — soft-delete job and remove files from disk */
export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  await handleResponse<unknown>(res);
}

/** POST /api/v1/jobs — create a new job */
export async function createJob(
  inputType: 'image',
  siteName: string,
  inspectorName: string,
  siteId?: string | null,
  floor?: string | null,
): Promise<JobStatusResponse> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      input_type: inputType,
      site_location: siteName,
      inspector_name: inspectorName,
      ...(siteId ? { site_id: siteId } : {}),
      ...(floor ? { floor } : {}),
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
    headers: await getAuthHeaders(),
    body: formData,
  });
  return handleResponse<ValidationResult[]>(res);
}

/** PATCH /api/v1/jobs/{job_id}/files/{file_id}/override — accept a blurry file as-is */
export async function overrideFile(jobId: string, fileId: string): Promise<FileOverrideResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}/override`,
    { method: 'PATCH', headers: await getAuthHeaders() },
  );
  return handleResponse<FileOverrideResponse>(res);
}

/** PUT /api/v1/jobs/{job_id}/files/{file_id} — replace a file with a new upload */
export async function replaceFile(jobId: string, fileId: string, file: File): Promise<ValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}`,
    { method: 'PUT', headers: await getAuthHeaders(), body: formData },
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
    { method: 'POST', headers: await getAuthHeaders() }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(errData.detail || `HTTP ${res.status}`);
  }
  // 202 Accepted — pipeline started in background, no body
}

// ─── Detect ───────────────────────────────────────────────────────────────────

export type SensitivityLevel = 'conservative' | 'balanced' | 'aggressive';
export interface PerClassSensitivity {
  crack?: SensitivityLevel;
  spalling?: SensitivityLevel;
  peeling?: SensitivityLevel;
  algae?: SensitivityLevel;
}

/** POST /api/v1/jobs/{job_id}/detect — queues detection in background, returns 202.
 *  Pass per-class sensitivity levels to control confidence thresholds per defect class. */
export async function detectJob(
  jobId: string,
  sensitivity?: PerClassSensitivity,
): Promise<{ status: string; job_id: string }> {
  const params = new URLSearchParams();
  if (sensitivity?.crack)    params.set('crack',    sensitivity.crack);
  if (sensitivity?.spalling) params.set('spalling', sensitivity.spalling);
  if (sensitivity?.peeling)  params.set('peeling',  sensitivity.peeling);
  if (sensitivity?.algae)    params.set('algae',    sensitivity.algae);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect${query}`,
    { method: 'POST', headers: await getAuthHeaders() }
  );
  return handleResponse<{ status: string; job_id: string }>(res);
}

/** GET /api/v1/jobs/{job_id}/detect — retrieve cached detection results */
export async function getDetectResults(jobId: string): Promise<DetectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<DetectResponse>(res);
}


// ─── Remarks ──────────────────────────────────────────────────────────────────

export interface RemarksResponse {
  job_id: string;
  remarks: Record<string, string>;
}

/** PATCH /api/v1/jobs/{job_id}/remarks — merge remarks keyed by def_id (e.g. "DEF-001").
 *  PATCH is additive: sending one def_id preserves all others.
 *  Send empty string to clear a remark for a specific defect. */
export async function patchRemarks(
  jobId: string,
  remarks: Record<string, string>,
): Promise<RemarksResponse> {
  const auth = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/remarks`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ remarks }),
    },
  );
  return handleResponse<RemarksResponse>(res);
}

// ─── Report ───────────────────────────────────────────────────────────────────

/** POST /api/v1/jobs/{job_id}/report — generate PDF report. Pass regenerate=true to overwrite an existing one. */
export async function generateReport(jobId: string, regenerate = false): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report${regenerate ? '?regenerate=true' : ''}`;
  const res = await fetch(url, { method: 'POST', headers: await getAuthHeaders() });
  if (res.status === 201 || res.status === 409) return;
  const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
  throw new Error(errData.detail || `HTTP ${res.status}`);
}

/** GET /api/v1/jobs/{job_id}/report — fetch existing report */
export async function getReport(jobId: string): Promise<ReportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<ReportResponse>(res);
}

/** GET /api/v1/jobs/{job_id}/report/url — get a signed URL to download the PDF */
export async function getReportUrl(jobId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/report/url`,
    { headers: await getAuthHeaders() },
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
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
  const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<ValidateImagesResponse>(res);
}

// ─── Sites ────────────────────────────────────────────────────────────────────

export interface SiteResponse {
  site_id:        string;
  name:           string;
  address:        string;
  description:    string;
  inspector_name: string;
  created_at:     string;
  updated_at:     string | null;
}

export interface SiteCreatePayload {
  name:           string;
  address?:       string;
  description?:   string;
  inspector_name?: string;
}

export interface SiteUpdatePayload {
  name?:           string;
  address?:        string;
  description?:    string;
  inspector_name?: string;
}

/** POST /api/v1/sites */
export async function createSite(payload: SiteCreatePayload): Promise<SiteResponse> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(payload),
  });
  return handleResponse<SiteResponse>(res);
}

/** GET /api/v1/sites */
export async function listSites(): Promise<SiteResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sites`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<SiteResponse[]>(res);
}

/** GET /api/v1/sites/{site_id} */
export async function getSite(siteId: string): Promise<SiteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sites/${encodeURIComponent(siteId)}`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<SiteResponse>(res);
}

/** PATCH /api/v1/sites/{site_id} */
export async function updateSite(siteId: string, payload: SiteUpdatePayload): Promise<SiteResponse> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/api/v1/sites/${encodeURIComponent(siteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(payload),
  });
  return handleResponse<SiteResponse>(res);
}

/** DELETE /api/v1/sites/{site_id} */
export async function deleteSite(siteId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sites/${encodeURIComponent(siteId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  await handleResponse<unknown>(res);
}

/** GET /api/v1/sites/{site_id}/jobs */
export async function getJobsForSite(siteId: string): Promise<JobStatusResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/sites/${encodeURIComponent(siteId)}/jobs`, {
    headers: await getAuthHeaders(),
  });
  return handleResponse<JobStatusResponse[]>(res);
}

// ─── Defects ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  status:     string;
  changed_at: string;
  note:       string;
}

export interface DefectItem {
  defect_id:     string;
  job_id:        string;
  file_id:       string;
  filename:      string;
  floor:         string | null;
  room:          string | null;
  area_tag:      string | null;
  defect_type:   string;
  confidence:    number;
  severity:      string;
  item_status:   string;
  gps_latitude:  number | null;
  gps_longitude: number | null;
  audit_trail:   AuditEntry[];
  annotated_path: string | null;
}

export interface SiteDefectsResponse {
  site_id: string;
  total:   number;
  defects: DefectItem[];
}

export interface SiteItemsFilter {
  floor?:       string;
  room?:        string;
  defect_type?: string;
  item_status?: string;
}

/** GET /api/v1/sites/{site_id}/items */
export async function getSiteItems(siteId: string, filters?: SiteItemsFilter): Promise<SiteDefectsResponse> {
  const params = new URLSearchParams();
  if (filters?.floor)       params.set('floor',       filters.floor);
  if (filters?.room)        params.set('room',         filters.room);
  if (filters?.defect_type) params.set('defect_type',  filters.defect_type);
  if (filters?.item_status) params.set('item_status',  filters.item_status);
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/sites/${encodeURIComponent(siteId)}/items${qs ? `?${qs}` : ''}`,
    { headers: await getAuthHeaders() },
  );
  return handleResponse<SiteDefectsResponse>(res);
}

/** PATCH /api/v1/jobs/{job_id}/defects/{defect_id}/status */
export async function updateDefectStatus(
  jobId: string,
  defectId: string,
  itemStatus: 'open' | 'in_progress' | 'resolved',
  note = '',
): Promise<DefectItem> {
  const auth = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/defects/${encodeURIComponent(defectId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ item_status: itemStatus, note }),
    },
  );
  return handleResponse<DefectItem>(res);
}

/** PATCH /api/v1/jobs/{job_id}/files/{file_id}/location */
export async function setFileLocation(
  jobId: string,
  fileId: string,
  location: { floor?: string | null; room?: string | null; area_tag?: string | null },
): Promise<void> {
  const auth = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}/location`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(location),
    },
  );
  await handleResponse<unknown>(res);
}

/** POST /api/v1/jobs/{job_id}/site */
export async function assignJobToSite(jobId: string, siteId: string | null): Promise<void> {
  const auth = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/site`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ site_id: siteId }),
    },
  );
  await handleResponse<unknown>(res);
}

/** GET /api/v1/files/{file_id}/url — get a signed URL for a file by its file_id */
export async function getFileUrl(fileId: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/files/${encodeURIComponent(fileId)}/url`,
    { headers: await getAuthHeaders() },
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}

/** GET /api/v1/jobs/{job_id}/storage/url?key=... — get a signed URL for any storage key owned by a job */
export async function getJobStorageUrl(jobId: string, key: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/storage/url?key=${encodeURIComponent(key)}`,
    { headers: await getAuthHeaders() },
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}
