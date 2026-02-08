from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uuid
import os
from pathlib import Path
import shutil
from modules.preprocessing import apply_bilateral_filter, apply_clahe
from modules.validation import is_image_blurry, has_exif_data

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


@app.get("/")
def read_root():
    return {"message": "VISCRETE Image Review API", "status": "running"}


@app.post("/api/upload")
async def upload_images(
    files: List[UploadFile] = File(...),
    project_name: str = "Untitled Project",
    inspector: str = "Unknown",
    file_type: str = "image"
):
    """Upload multiple images or videos for inspection"""
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    uploaded_files = []
    
    for file in files:
        # Validate file type
        content_type = file.content_type or ""
        if file_type == "image" and not content_type.startswith("image/"):
            continue
        if file_type == "video" and not content_type.startswith("video/"):
            continue
        
        # Save file
        file_path = job_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        uploaded_files.append({
            "filename": file.filename,
            "size": os.path.getsize(file_path),
            "path": str(file_path)
        })
    
    # Store job info
    jobs_db[job_id] = {
        "job_id": job_id,
        "project_name": project_name,
        "inspector": inspector,
        "file_type": file_type,
        "files": uploaded_files,
        "status": "uploaded",
        "total_files": len(uploaded_files)
    }
    
    return {
        "job_id": job_id,
        "message": f"Successfully uploaded {len(uploaded_files)} files",
        "files": uploaded_files
    }


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get job status and information"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs_db[job_id]


@app.get("/api/jobs")
async def list_jobs():
    """List all jobs"""
    return {"jobs": list(jobs_db.values())}


@app.post("/api/jobs/{job_id}/process")
async def process_job(job_id: str):
    """Process uploaded images for inspection"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs_db[job_id]
    job["status"] = "processing"
    
    # TODO: Add actual image processing logic here
    # - Apply preprocessing (bilateral filter, CLAHE)
    # - Run defect detection
    # - Generate report
    
    processed_results = []
    for file_info in job["files"]:
        # Placeholder for actual processing
        processed_results.append({
            "filename": file_info["filename"],
            "processed": True,
            "defects_found": 0,  # Placeholder
            "quality_score": 0.95  # Placeholder
        })
    
    job["status"] = "completed"
    job["results"] = processed_results
    
    return {
        "job_id": job_id,
        "status": "completed",
        "results": processed_results
    }


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its files"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete files
    job_dir = UPLOAD_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir)
    
    # Delete from database
    del jobs_db[job_id]
    
    return {"message": f"Job {job_id} deleted successfully"}