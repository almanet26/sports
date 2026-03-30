"""
Services Package

Background task handlers and business logic services.
"""
# Lazy imports to avoid loading heavy dependencies at startup
__all__ = ["run_ocr_processing", "get_job_status", "retry_failed_job"]

def __getattr__(name):
    if name in __all__:
        from .ocr_task import run_ocr_processing, get_job_status, retry_failed_job
        return globals()[name]
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
