"""
Scoreboard ROI Finder - Helper tool to locate scoreboard in cricket video
Extracts a frame and allows you to visually identify the scoreboard region
"""

import cv2
import argparse
from pathlib import Path


def extract_sample_frames(video_path: str, num_samples: int = 5, output_dir: str = "data/roi_samples"):
    """Extract sample frames from video at different timestamps"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        print(f"❌ Cannot open video: {video_path}")
        return
    
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = video.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps if fps > 0 else 0
    
    print(f"📹 Video: {Path(video_path).name}")
    print(f"   Duration: {duration:.1f}s ({duration/3600:.1f} hours)")
    print(f"   Total frames: {total_frames}")
    print(f"   FPS: {fps:.2f}")
    print()
    print(f"Extracting {num_samples} sample frames...")
    print()
    
    # Extract frames at evenly spaced intervals
    interval = total_frames // (num_samples + 1)
    
    for i in range(1, num_samples + 1):
        frame_num = i * interval
        timestamp = frame_num / fps
        
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = video.read()
        
        if ret:
            output_file = output_path / f"sample_frame_{i:02d}_{int(timestamp)}s.jpg"
            cv2.imwrite(str(output_file), frame)
            
            height, width = frame.shape[:2]
            file_size = output_file.stat().st_size / 1024
            
            print(f"✓ Frame {i}: {output_file.name}")
            print(f"   Time: {timestamp:.1f}s ({timestamp/60:.1f} minutes)")
            print(f"   Resolution: {width}x{height}")
            print(f"   Size: {file_size:.1f} KB")
            print()
    
    video.release()
    
    print("=" * 70)
    print("✅ Sample frames extracted!")
    print(f"📁 Location: {output_path.absolute()}")


def main():
    parser = argparse.ArgumentParser(
        description='Extract sample frames to locate scoreboard ROI'
    )
    parser.add_argument('--video-path', required=True, help='Path to cricket video')
    parser.add_argument('--num-samples', type=int, default=5, help='Number of sample frames (default: 5)')
    parser.add_argument('--output-dir', default='data/roi_samples', help='Output directory')
    
    args = parser.parse_args()
    
    extract_sample_frames(args.video_path, args.num_samples, args.output_dir)


if __name__ == '__main__':
    main()
