from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query
from features.validation import is_image_blurry, has_exif_data, get_coordinates
from typing import List
from pathlib import Path
import logging
import mimetypes

logger = logging.getLogger(__name__)
router = APIRouter()

# Jobs storage path
JOBS_PATH = Path("storage/jobs")
JOBS_PATH.mkdir(parents=True, exist_ok=True)

@router.post("/upload_images")
async def upload_images(
    job_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Endpoint to upload image files to project folder based on job_id
    
    Parameters:
    - job_id: Unique identifier for the project/job
    - file: Image file to upload
    """
    
    # Allowed image MIME types
    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/jpg", 
        "image/png",
        "image/webp",
        "image/bmp",
        "image/tiff"
    }
    
    # Validate content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only images are allowed. Got: {file.content_type}"
        )
    
    # Read image bytes
    image_bytes = await file.read()
    
    # Check if file is empty
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Create project folder name
    project_folder_name = f"Project_{job_id}"
    project_dir = JOBS_PATH / project_folder_name
    
    # Create folder structure if it doesn't exist
    if not project_dir.exists():
        logger.info(f"Creating new project folder: {project_folder_name}")
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subfolders
        (project_dir / "original").mkdir(exist_ok=True)
        (project_dir / "processed").mkdir(exist_ok=True)
        (project_dir / "results").mkdir(exist_ok=True)
    else:
        logger.info(f"Project folder already exists: {project_folder_name}")
    
    # Save image to original folder
    original_dir = project_dir / "original"
    image_path = original_dir / file.filename
    
    with open(image_path, "wb") as f:
        f.write(image_bytes)
    
    logger.info(f"Image uploaded: {image_path}")
    
    return {
        "success": True,
        "message": f"Image {file.filename} uploaded successfully.",
        "job_id": job_id,
        "filename": file.filename
    }