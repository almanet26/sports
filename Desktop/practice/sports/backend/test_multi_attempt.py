"""
Test new multi-attempt YouTube download strategy
"""
from utils.youtube import download_youtube_video
from pathlib import Path

url = 'https://www.youtube.com/watch?v=OaoL5mv16OI'
output_dir = Path('storage/test_yt')
output_dir.mkdir(parents=True, exist_ok=True)

print(f"Testing download with 5 fallback strategies: {url}")
print("-" * 70)

try:
    result = download_youtube_video(url, output_dir)
    
    print("\n" + "=" * 70)
    print("✅ DOWNLOAD SUCCESSFUL!")
    print("=" * 70)
    print(f"Video ID:   {result['video_id']}")
    print(f"Title:      {result['title']}")
    print(f"File:       {result['file_path']}")
    print(f"Size:       {result['file_size'] / (1024*1024*1024):.2f} GB")
    print(f"Duration:   {result['duration']/60:.1f} minutes ({result['duration']/3600:.2f} hours)")
    print("=" * 70)
    
    # Clean up test file
    import os
    if os.path.exists(result['file_path']):
        print(f"\n🗑️  Cleaning up test file...")
        os.remove(result['file_path'])
        print("✅ Test file deleted")
    
except Exception as e:
    print("\n" + "=" * 70)
    print("❌ ALL ATTEMPTS FAILED")
    print("=" * 70)
    print(f"Final Error: {e}")
    print("=" * 70)
    print("\nThis video may require:")
    print("  1. Manual cookie export from browser")
    print("  2. The video to be public (not private/unlisted)")
    print("  3. A different video URL for testing")
