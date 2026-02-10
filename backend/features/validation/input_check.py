# laplaction operator, extract exif, etc
import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS
import io

def is_image_blurry(image_bytes: bytes, threshold: float = 100.0) -> bool:
    """
    Check if the input image is blurry using the Laplacian operator.

    Parameters:
    - image_bytes: bytes
        The raw image bytes.
    - threshold: float
        The threshold value to determine if the image is blurry.

    Returns:
    - bool
        True if the image is blurry, False otherwise.
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        if image is None:
            raise ValueError("Failed to decode image")
        
        # Compute the Laplacian of the image
        laplacian = cv2.Laplacian(image, cv2.CV_64F)
        
        # Calculate the variance of the Laplacian
        variance = laplacian.var()
        
        # If the variance is less than the threshold, the image is considered blurry
        return variance < threshold
    except Exception as e:
        raise ValueError(f"Error processing image: {str(e)}")

def has_exif_data(image_bytes: bytes) -> tuple[bool, dict]:
    """
    Check if the image bytes contain EXIF metadata.

    Parameters:
    - image_bytes: bytes
        The raw image bytes.

    Returns:
    - tuple[bool, dict]
        A tuple containing:
        - bool: True if the image has EXIF data, False otherwise.
        - dict: The EXIF data dictionary with readable tag names, or empty dict if no EXIF data.
    """

    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif_data = image._getexif()
        
        if exif_data is not None and len(exif_data) > 0:
            # Convert EXIF data to readable format
            readable_exif = {}
            for tag_id, value in exif_data.items():
                tag_name = TAGS.get(tag_id, tag_id)
                readable_exif[tag_name] = value
            
            return True, readable_exif
        else:
            return False, {}
    except Exception:
        # If there's an error (e.g., file not found, not an image), return False and empty dict
        return False, {}
    
def get_coordinates(image_bytes: bytes) -> str | None:
    """
    Extract GPS coordinates from image EXIF data.
    
    Parameters:
    - image_bytes: bytes
        The raw image bytes.
    
    Returns:
    - str | None
        GPS coordinates as "latitude, longitude" string, or None if not found.
    """
    hasExif, exifData = has_exif_data(image_bytes)
    if hasExif:
        gpsInfo = exifData.get("GPSInfo", {})
        if gpsInfo:
            lat = gpsInfo.get(2)
            lon = gpsInfo.get(4)
            if lat and lon:
                # Convert GPS coordinates to decimal format
                def convert_to_degrees(value):
                    d, m, s = value
                    return d + (m / 60.0) + (s / 3600.0)
                
                latitude = convert_to_degrees(lat)
                longitude = convert_to_degrees(lon)
                return f"{latitude}, {longitude}"
    return None