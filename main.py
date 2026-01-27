#!/usr/bin/env python3
"""
Cricket Highlight Generator - Main CLI Entry Point
===================================================
Offline OCR-based highlight detection system.

Usage:
    python main.py --video-path "backend/storage/raw/match.mp4" --gpu
    python main.py --video-path "path/to/match.mp4" --debug
    python main.py --help
"""
import sys
from pathlib import Path
from api.routes import player
app.include_router(player.router)


# Add backend/scripts to Python path for imports
backend_scripts = Path(__file__).parent / "backend" / "scripts"
sys.path.insert(0, str(backend_scripts))


def main():
    """Main entry point - delegates to ocr_engine CLI."""
    try:
        from ocr_engine import main as ocr_main
        ocr_main()
    except ImportError as e:
        print(f"❌ Error: Could not import ocr_engine module.")
        print(f"Details: {e}")
        print("\nMake sure you're running from the project root and dependencies are installed:")
        print("  pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
