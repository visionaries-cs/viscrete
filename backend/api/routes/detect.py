from fastapi import APIRouter, HTTPException, Query
from features.detection.service import run_detection_on_job
from pathlib import Path
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Jobs storage path
JOBS_PATH = Path("storage/jobs")

@router.get("/detect")
async def detect_defects(job_id: str = Query(..., description="Job ID to process")):
    """
    Endpoint to detect defects in all images for a given job ID.
    
    Parameters:
    - job_id: The job ID to process images from
    
    Returns:
    - JSON with detection results for all images in the job
    """
    # Construct project folder path
    project_folder = JOBS_PATH / f"Project_{job_id}"
    original_folder = project_folder / "original"
    
    # Check if project folder exists
    if not project_folder.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Job ID '{job_id}' not found. Project folder does not exist."
        )
    
    # Check if original folder exists
    if not original_folder.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Original images folder not found for job ID '{job_id}'."
        )
    
    # Check if there are any images
    image_files = list(original_folder.glob("*"))
    image_files = [f for f in image_files if f.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"]]
    
    if not image_files:
        raise HTTPException(
            status_code=404,
            detail=f"No images found in job ID '{job_id}'."
        )
    
    try:
        # Run detection on all images in the job
        results = run_detection_on_job(str(original_folder))
        
        return {
            "success": True,
            "job_id": job_id,
            "total_images": len(results),
            "total_defect_count": sum([r["total_defects"] for r in results]),
            "total_defect_counts": {
                defect_type: sum(r["defect_counts"].get(defect_type, 0) for r in results)
                for defect_type in {"cracks", "spalling", "peeling", "algae", "stain"}
            },
            "results": results
        }
    except Exception as e:
        logger.error(f"Detection failed for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Detection failed: {str(e)}"
        )
