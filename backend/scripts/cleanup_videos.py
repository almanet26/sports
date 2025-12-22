"""
Cleanup script to remove downloaded videos
"""

import os
import shutil
from pathlib import Path

storage_path = Path("./storage/videos")

if storage_path.exists():
    print(f"Cleaning up: {storage_path.absolute()}")
    for file in storage_path.glob("*"):
        print(f"  Removing: {file.name}")
        if file.is_file():
            file.unlink()
        elif file.is_dir():
            shutil.rmtree(file)
    print("Cleanup complete")
else:
    print("No storage directory found")
