# laplaction operator, extract exif, etc
import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS

def is_image_blurry(image: np.ndarray, threshold: float = 100.0) -> bool:
    """
    Check if the input image is blurry using the Laplacian operator.

    Parameters:
    - image: np.ndarray
        The input image in grayscale.
    - threshold: float
        The threshold value to determine if the image is blurry.

    Returns:
    - bool
        True if the image is blurry, False otherwise.
    """
    # Compute the Laplacian of the image
    laplacian = cv2.Laplacian(image, cv2.CV_64F)
    
    # Calculate the variance of the Laplacian
    variance = laplacian.var()
    
    # If the variance is less than the threshold, the image is considered blurry
    return variance < threshold

def has_exif_data(image_path: str) -> bool:
    """
    Check if the image at the given path contains EXIF metadata.

    Parameters:
    - image_path: str
        The file path to the image.

    Returns:
    - bool
        True if the image has EXIF data, False otherwise.
    """

    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        
        # If exif_data is not None and contains tags, return True
        return exif_data is not None and len(exif_data) > 0
    except Exception:
        # If there's an error (e.g., file not found, not an image), return False
        return False