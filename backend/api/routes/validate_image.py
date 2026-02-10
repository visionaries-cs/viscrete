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


@router.get("/validate_images")
async def validate_images(
    job_id: str = Query(..., description="Unique identifier for the project/job")
):
    """
    Endpoint to validate all uploaded images for a job_id and return their information
    
    Parameters:
    - job_id: Unique identifier for the project/job
    
    Returns:
    - List of image information including validation status, coordinates, file type, etc.
    """
    
    try:
        # Create project folder name
        project_folder_name = f"Project_{job_id}"
        project_dir = JOBS_PATH / project_folder_name
        original_dir = project_dir / "original"
        
        # Check if project folder exists
        if not project_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Project folder not found for job_id: {job_id}"
            )
        
        # Check if original folder exists and has images
        if not original_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Original images folder not found for job_id: {job_id}"
            )
        
        # Get all image files
        image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}
        image_files = [f for f in original_dir.iterdir() if f.is_file() and f.suffix.lower() in image_extensions]
        
        if not image_files:
            return {
                "success": True,
                "message": "No images found in project folder",
                "job_id": job_id,
                "total_images": 0,
                "images": []
            }
        
        # Process each image
        images_info = []
        for image_path in image_files:
            try:
                # Read image bytes for validation
                with open(image_path, "rb") as f:
                    image_bytes = f.read()
                
                # Check for blur
                try:
                    is_blurry = is_image_blurry(image_bytes)
                    # Convert numpy bool to Python bool for JSON serialization
                    is_blurry = bool(is_blurry) if is_blurry is not None else None
                except Exception as blur_error:
                    logger.warning(f"Could not check blur for {image_path.name}: {str(blur_error)}")
                    is_blurry = None
                
                # Extract coordinates from EXIF
                try:
                    coordinates = get_coordinates(image_bytes)
                except Exception as coord_error:
                    logger.warning(f"Could not extract coordinates for {image_path.name}: {str(coord_error)}")
                    coordinates = None
                
                # Get file type
                file_type = mimetypes.guess_type(str(image_path))[0] or "unknown"
                
                # Create message based on blur status
                if is_blurry is True:
                    message = "Blurry image detected"
                elif is_blurry is False:
                    message = "Image validated successfully"
                else:
                    message = "Image uploaded, blur check unavailable"
                
                images_info.append({
                    "success": True,
                    "message": message,
                    "job_id": job_id,
                    "image_name": image_path.name,
                    "coordinates": coordinates,
                    "file_type": file_type,
                    "filename": image_path.name,
                    "is_blurry": is_blurry
                })
                
            except Exception as e:
                logger.error(f"Error processing image {image_path.name}: {str(e)}")
                images_info.append({
                    "success": False,
                    "message": f"Error processing image: {str(e)}",
                    "job_id": job_id,
                    "image_name": image_path.name,
                    "coordinates": None,
                    "file_type": "unknown",
                    "filename": image_path.name,
                    "is_blurry": None
                })
        
        return {
            "success": True,
            "message": f"Validated {len(images_info)} images for job {job_id}",
            "job_id": job_id,
            "total_images": len(images_info),
            "images": images_info
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in validate_images for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error while validating images: {str(e)}"
        )

    
