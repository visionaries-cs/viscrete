const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Validate uploaded files for a given job (blur check + GPS extraction).
 * POST /api/v1/jobs/{job_id}/validate
 */
export async function uploadImage(jobId: string, file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('files', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/validate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(errorData.detail || `Failed to upload ${file.name}`);
  }

  return response.json();
}

// ─── Upload Review ─────────────────────────────────────────────────────────────

export interface ValidatedImage {
  filename?: string;
  image_name?: string;
  coordinates?: string;
}

export interface ValidateImagesResponse {
  images: ValidatedImage[];
}

/**
 * Fetch validated images and GPS metadata for a given job.
 * GET /api/v1/jobs/{job_id}
 */
export async function validateImages(jobId: string): Promise<ValidateImagesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch images' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch images`);
  }

  return response.json();
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface Detection {
  id: string;
  class_id: number;
  defect_type: string;
  confidence: number;
  bounding_box: { x1: number; y1: number; x2: number; y2: number };
}

export interface DetectionResult {
  filename: string;
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
  total_defect_count: number;
  total_defect_counts: {
    cracks: number;
    spalling: number;
    peeling: number;
    algae: number;
    staining: number;
  };
}

/**
 * Run YOLOv11 defect detection inference for a job.
 * POST /api/v1/jobs/{job_id}/detect
 */
export async function detectJob(jobId: string): Promise<DetectResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect`,
    { method: 'POST' }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to run detection' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to run detection`);
  }

  return response.json();
}

/**
 * Retrieve cached YOLOv11 detection results for a job.
 * GET /api/v1/jobs/{job_id}/detect
 */
export async function getDetectResults(jobId: string): Promise<DetectResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/detect`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch detection results' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch detection results`);
  }

  return response.json();
}

/**
 * Fetch a single result image as a blob URL.
 * Remember to call `URL.revokeObjectURL` when done.
 * GET /api/v1/jobs/{job_id}/detect (image variant — adjust path if backend exposes a dedicated image endpoint)
 */
export async function getResultImageUrl(jobId: string, imageName: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/image?image_name=${encodeURIComponent(imageName)}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch image`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
