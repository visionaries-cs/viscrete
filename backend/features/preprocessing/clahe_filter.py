import cv2
import numpy as np

def apply_clahe(image: np.ndarray, clip_limit: float = 2.0, tile_grid_size: tuple = (8, 8)) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to the input image.

    Parameters:
    - image: np.ndarray
        The input image in grayscale.
    - clip_limit: float
        Threshold for contrast limiting.
    - tile_grid_size: tuple
        Size of grid for histogram equalization. Input image will be divided into
        equally sized rectangular tiles.

    Returns:
    - np.ndarray
        The image after applying CLAHE.
    """
    # Create a CLAHE object with the specified clip limit and tile grid size
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    
    # Apply CLAHE to the input image
    clahe_image = clahe.apply(image)
    
    return clahe_image

