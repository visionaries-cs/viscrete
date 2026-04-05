const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a single image file for a given job.
 */
export async function uploadImage(jobId: string, file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('job_id', jobId);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/v1/upload_images`, {
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
 * Fetch and validate images for a given job, including GPS metadata.
 */
export async function validateImages(jobId: string): Promise<ValidateImagesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/validate_images?job_id=${encodeURIComponent(jobId)}`
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
 * Run defect detection for a job and return full results.
 */
export async function detectJob(jobId: string): Promise<DetectResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/detect?job_id=${encodeURIComponent(jobId)}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch images' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch images`);
  }

  return response.json();
}

/**
 * Fetch a single result image as a blob URL.
 * Remember to call `URL.revokeObjectURL` when done.
 */
export async function getResultImageUrl(jobId: string, imageName: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/get_image?job_id=${encodeURIComponent(jobId)}&image_name=${encodeURIComponent(imageName)}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch image`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
