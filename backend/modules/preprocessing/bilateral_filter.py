import cv2
import numpy as np

def apply_bilateral_filter(media):
    """
    Apply a bilateral filter to the input image or video frame.

    Parameters:
    media (numpy.ndarray): Input image or video frame in BGR format.

    Returns:
    numpy.ndarray: The filtered image or video frame.
    """
    # Define parameters for the bilateral filter
    d = 9  # Diameter of each pixel neighborhood
    sigma_color = 75  # Filter sigma in color space
    sigma_space = 75  # Filter sigma in coordinate space

    # Apply the bilateral filter
    filtered_media = cv2.bilateralFilter(media, d, sigma_color, sigma_space)

    return filtered_media

def batch_apply_bilateral_filter(media_list):
    """
    Apply a bilateral filter to a batch of images or video frames.

    Parameters:
    media_list (list of numpy.ndarray): List of input images or video frames in BGR format.

    Returns:
    list of numpy.ndarray: List of filtered images or video frames.
    """
    return [apply_bilateral_filter(media) for media in media_list]
    