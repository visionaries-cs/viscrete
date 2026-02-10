from fastapi import APIRouter, UploadFile, File, HTTPException
from features.detection.service import run_detection_image
from typing import List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Allowed image MIME types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff"
}

# Allowed file extensions
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}

@router.post("/detect")
async def detect_defects(file: UploadFile = File(...)):
    """
    Endpoint to detect defects in uploaded image
    """
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
    
    try:
        # Run detection
        detections = run_detection_image(image_bytes)
        
        return {
            "success": True,
            "total_defects": len(detections),
            "detections": detections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")
