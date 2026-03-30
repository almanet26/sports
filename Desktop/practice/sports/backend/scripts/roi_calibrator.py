#!/usr/bin/env python3
"""
ROI Calibrator: Interactive tool to find correct scoreboard ROI coordinates.
Displays a video frame with ROI rectangles overlaid, allowing manual adjustments.
"""

import cv2
import sys
import argparse
from pathlib import Path

class ROICalibrator:
    def __init__(self, video_path: str, timestamp: float = 10.0):
        self.video_path = video_path
        self.timestamp = timestamp
        self.frame = None
        self.display = None
        
        # Current ROI settings (editable)
        self.rois = {
            'score': {'x': 140, 'y': 620, 'w': 100, 'h': 50, 'color': (0, 255, 0)},
            'overs': {'x': 140, 'y': 670, 'w': 60, 'h': 30, 'color': (255, 0, 0)},
            'batsman_stats': {'x': 274, 'y': 620, 'w': 530, 'h': 40, 'color': (0, 0, 255)},
        }
        self.selected_roi = 'batsman_stats'
        self.load_frame()

    def load_frame(self):
        """Load a specific frame from video at timestamp."""
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            print(f"❌ Failed to open video: {self.video_path}")
            sys.exit(1)
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_idx = int(self.timestamp * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print(f"❌ Failed to load frame at {self.timestamp}s")
            sys.exit(1)
        
        self.frame = frame
        self.display = frame.copy()
        print(f"✅ Loaded frame at {self.timestamp}s (frame #{frame_idx})")
        print(f"   Frame size: {frame.shape[1]}x{frame.shape[0]}")

    def draw_rois(self):
        """Draw all ROI rectangles on the frame."""
        self.display = self.frame.copy()
        
        for roi_name, roi_data in self.rois.items():
            x, y, w, h = roi_data['x'], roi_data['y'], roi_data['w'], roi_data['h']
            color = roi_data['color']
            thickness = 3 if roi_name == self.selected_roi else 2
            
            # Draw rectangle
            cv2.rectangle(self.display, (x, y), (x+w, y+h), color, thickness)
            
            # Draw label
            label = f"{roi_name} ({w}x{h})"
            if roi_name == self.selected_roi:
                label += " [SELECTED]"
            cv2.putText(self.display, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 
                       0.5, color, 2)

    def show_instructions(self):
        """Print keyboard instructions."""
        print("\n" + "="*60)
        print("🎯 ROI CALIBRATOR - KEYBOARD COMMANDS")
        print("="*60)
        print(f"\n📍 Currently editing: {self.selected_roi.upper()}")
        print("\n🔄 SELECT ROI:")
        print("   1 = Score ROI")
        print("   2 = Overs ROI")
        print("   3 = Batsman Stats ROI (RUNS/BALLS)")
        print("\n⬅️ ➡️ ⬆️ ⬇️ = Move selected ROI (Arrow keys)")
        print("+/- = Increase/Decrease width")
        print("[/] = Increase/Decrease height")
        print("\nShift + Arrow = Move 10px")
        print("Shift + +/- = Change width by 10")
        print("Shift + [/] = Change height by 10")
        print("\np = Print current ROI config")
        print("s = Save config to JSON")
        print("q = Quit")
        print("="*60 + "\n")

    def extract_roi(self, roi_name: str) -> None:
        """Extract and save the current ROI to disk for inspection."""
        roi_data = self.rois[roi_name]
        x, y, w, h = roi_data['x'], roi_data['y'], roi_data['w'], roi_data['h']
        
        roi_crop = self.frame[y:y+h, x:x+w]
        output_path = f"debug_ocr/{roi_name}_current.jpg"
        cv2.imwrite(output_path, roi_crop)
        print(f"✅ Saved {roi_name} ROI to {output_path}")

    def print_config(self):
        """Print current ROI configuration."""
        print("\n📋 CURRENT ROI CONFIG:")
        print("="*60)
        for roi_name, roi_data in self.rois.items():
            x, y, w, h = roi_data['x'], roi_data['y'], roi_data['w'], roi_data['h']
            print(f"{roi_name:20} x={x:4d} y={y:4d} w={w:4d} h={h:4d}")
        print("="*60 + "\n")

    def save_config(self):
        """Save configuration to JSON file."""
        import json
        config = {
            'score': {'x': self.rois['score']['x'], 'y': self.rois['score']['y'], 
                     'roi_width': self.rois['score']['w'], 'roi_height': self.rois['score']['h']},
            'overs': {'roi_x': self.rois['overs']['x'], 'roi_y': self.rois['overs']['y'],
                     'roi_width': self.rois['overs']['w'], 'roi_height': self.rois['overs']['h']},
            'batsman_name': {'x': self.rois['batsman_stats']['x'], 'y': self.rois['batsman_stats']['y'],
                            'width': self.rois['batsman_stats']['w'], 'height': self.rois['batsman_stats']['h']},
        }
        output_path = "scoreboard_config.json"
        with open(output_path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"✅ Config saved to {output_path}")

    def run(self):
        """Main interaction loop."""
        self.show_instructions()
        
        while True:
            self.draw_rois()
            cv2.imshow("ROI Calibrator", self.display)
            
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                print("👋 Exiting...")
                break
            elif key == ord('1'):
                self.selected_roi = 'score'
                print(f"✅ Selected: {self.selected_roi}")
            elif key == ord('2'):
                self.selected_roi = 'overs'
                print(f"✅ Selected: {self.selected_roi}")
            elif key == ord('3'):
                self.selected_roi = 'batsman_stats'
                print(f"✅ Selected: {self.selected_roi}")
            elif key == ord('p'):
                self.print_config()
            elif key == ord('s'):
                self.save_config()
            elif key == ord('e'):
                self.extract_roi(self.selected_roi)
            
            # Arrow keys
            elif key == 82:  # UP arrow
                self.rois[self.selected_roi]['y'] -= 1
                print(f"  ↑ Y: {self.rois[self.selected_roi]['y']}")
            elif key == 84:  # DOWN arrow
                self.rois[self.selected_roi]['y'] += 1
                print(f"  ↓ Y: {self.rois[self.selected_roi]['y']}")
            elif key == 81:  # LEFT arrow
                self.rois[self.selected_roi]['x'] -= 1
                print(f"  ← X: {self.rois[self.selected_roi]['x']}")
            elif key == 83:  # RIGHT arrow
                self.rois[self.selected_roi]['x'] += 1
                print(f"  → X: {self.rois[self.selected_roi]['x']}")
            
            # Width/Height adjustments
            elif key == ord('+') or key == ord('='):
                self.rois[self.selected_roi]['w'] += 1
                print(f"  Width: {self.rois[self.selected_roi]['w']}")
            elif key == ord('-') or key == ord('_'):
                self.rois[self.selected_roi]['w'] -= 1
                print(f"  Width: {self.rois[self.selected_roi]['w']}")
            elif key == ord(']'):
                self.rois[self.selected_roi]['h'] += 1
                print(f"  Height: {self.rois[self.selected_roi]['h']}")
            elif key == ord('['):
                self.rois[self.selected_roi]['h'] -= 1
                print(f"  Height: {self.rois[self.selected_roi]['h']}")
        
        cv2.destroyAllWindows()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Interactive ROI calibrator for cricket scoreboard')
    parser.add_argument('--video-path', required=True, help='Path to video file')
    parser.add_argument('--timestamp', type=float, default=10.0, 
                       help='Timestamp to extract frame from (default: 10s)')
    args = parser.parse_args()
    
    calibrator = ROICalibrator(args.video_path, args.timestamp)
    calibrator.run()
