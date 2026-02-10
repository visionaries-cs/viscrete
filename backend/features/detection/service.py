from ultralytics import YOLO
from pathlib import Path
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = Path("models/YOLOv11-SAMPLE.pt")

try:
    model = YOLO(MODEL_PATH)
    logger.info(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    logger.error(f"Error loading model: {e}. Please check your model path.")
    model = None

def run_detection_image(image_bytes: bytes, conf_threshold=0.05, iou_threshold=0.45):
    """
    Performs inference on an image and returns detections.
    
    Args:
        image_bytes: Raw image bytes from uploaded file
        conf_threshold: Confidence threshold for detections
        iou_threshold: IOU threshold for NMS
        
    Returns:
        list: List of detections with defect type, id, confidence, and bounding box
    """
    
    if not image_bytes:
        raise ValueError("No image provided for detection.")
    
    if model is None:
        raise RuntimeError("Model not loaded. Check model path.")
    
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image")
        
        # Run inference
        results = model(image, conf=conf_threshold, iou=iou_threshold)
        
    except Exception as e:
        raise RuntimeError(f"Model inference failed: {str(e)}")
    
    # Prepare detection info
    detection_info = []
    
    for idx, box in enumerate(results[0].boxes):
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
        
        detection_info.append({
            "id": idx,
            "class_id": cls_id,
            "defect_type": cls_name,
            "confidence": round(conf, 2),
            "bounding_box": {
                "x1": round(bbox[0], 2),
                "y1": round(bbox[1], 2),
                "x2": round(bbox[2], 2),
                "y2": round(bbox[3], 2)
            }
        })
    
    return detection_info


def run_detection_on_job(original_folder_path: str, conf_threshold=0.05, iou_threshold=0.45):
    """
    Run detection on all images in a job's original folder.
    
    Args:
        original_folder_path: Path to the folder containing original images
        conf_threshold: Confidence threshold for detections
        iou_threshold: IOU threshold for NMS
        
    Returns:
        list: List of results for each image with filename and detections
    """
    original_folder = Path(original_folder_path)
    
    # Supported image extensions
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}
    
    # Get all image files
    image_files = [f for f in original_folder.iterdir() if f.suffix.lower() in image_extensions]
    
    if not image_files:
        logger.warning(f"No images found in {original_folder_path}")
        return []
    
    results = []
    
    for image_file in image_files:
        logger.info(f"Processing image: {image_file.name}")
        
        try:
            # Read image as bytes
            with open(image_file, "rb") as f:
                image_bytes = f.read()
            
            # Run detection
            detections = run_detection_image(image_bytes, conf_threshold, iou_threshold)
            
            # Count defects by type
            defect_counts = {}
            for detection in detections:
                defect_type = detection["defect_type"]
                defect_counts[defect_type] = defect_counts.get(defect_type, 0) + 1
            
            results.append({
                "filename": image_file.name,
                "total_defects": len(detections),
                "defect_counts": defect_counts,
                "detections": detections
            })
            
            logger.info(f"Completed {image_file.name}: {len(detections)} defects found")
            
        except Exception as e:
            logger.error(f"Error processing {image_file.name}: {str(e)}")
            results.append({
                "filename": image_file.name,
                "error": str(e),
                "total_defects": 0,
                "defect_counts": {},
                "detections": []
            })
    
    return results
