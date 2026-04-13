The backend doesn't stream per-step progress — it only transitions from "preprocessing" to "preprocessed" when the entire pipeline finishes. The stepper needs to handle this gracefully.                                                                                           
                                                                                                                                                                                                                                                                                      
  ---                                                                                                                                                                                                                                                                                 
  Updated PREPROCESS.md
                                                                                                                                                                                                                                                                                      
  ---             
  After calling POST /jobs/{job_id}/preprocess, the backend returns 202 Accepted immediately and runs the pipeline in the background. The stepper must reflect this two-phase flow:

  Phase 1 — While polling (status === "preprocessing")
  - Show all pipeline steps in a pending/waiting state.
  - Animate step 1 with a spinner to indicate the pipeline is actively running.
  - Display a note: "This may take several minutes for large videos."
  - Poll GET /jobs/{job_id} every 5 seconds — do not attempt to render step details yet.

  Phase 2 — On status === "preprocessed"
  - Stop polling.
  - Populate each stepper step from preprocessing_result.pipeline_steps[]:
    - step → step number
    - name → step label
    - status → mark as completed or failed
    - duration_sec → show as "completed in Xs"
    - detail → show as subtitle (e.g. "20 frames sampled", "3 clusters formed")
  - Mark all steps completed and reveal the processed video/images.

  Phase 3 — On status === "failed"
  - Stop polling and mark the active step as failed with an error state.

  ▎ Step names by pipeline type (use input_type from job metadata to label steps before results arrive):
  ▎
  ▎ - Image (5 steps): Feature Extraction → Clustering → IMOCS Optimization → CLAHE Enhancement → Bilateral Filter
  ▎ - Video (5 steps): Frame Sampling → Median Frame Construction → IMOCS Optimization → Frame Processing → Save Output
  ▎
  ▎ Never render processed file URLs until status === "preprocessed" — the files do not exist on disk before that.
  ▎
  ▎ Timeout: stop polling after 30 minutes and show a timeout error if still "preprocessing".