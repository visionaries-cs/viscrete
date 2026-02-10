from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Import API routers
from api.routes import detect as YOLODetect
from api.routes import validate_image as ValidateImage
from api.routes import upload_image as UploadImage

# Other imports
from typing import List
import uuid
import os
from pathlib import Path
import shutil
from features.preprocessing import apply_bilateral_filter, apply_clahe
from features.validation import is_image_blurry, has_exif_data

app = FastAPI(title="VISCRETE Image Review API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Store job information in memory (use database in production)
jobs_db = {}

app.include_router(YOLODetect.router, prefix="/api")
app.include_router(ValidateImage.router, prefix="/api")
app.include_router(UploadImage.router, prefix="/api")