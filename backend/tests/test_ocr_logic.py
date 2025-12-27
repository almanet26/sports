"""
Unit tests for OCR engine event detection logic.
Tests the refactored wicket-prioritized detection system.
"""

import unittest
import sys
import logging
from pathlib import Path

# Add scripts directory to path to import ocr_engine
scripts_dir = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from scripts.ocr_engine import EventDetector, ScoreState

# Configure logging to show output during tests
logging.basicConfig(level=logging.INFO)
# Set ocr_engine logger to DEBUG to see decision process
logging.getLogger("ocr_engine").setLevel(logging.DEBUG)


class TestEventDetector(unittest.TestCase):
    def setUp(self):
        self.detector = EventDetector()
        self.detector.reset()

    def test_jump_persistence_recovery(self):
        """Test that huge jump properly updates baseline immediately (per reference logic)"""
        print("\n--- Test Huge Jump Recovery ---")
        # Establish low score
        for i in range(5):
            self.detector.detect_event(ScoreState(224, 0), i * 1.0)

        # Big jump (224 -> 257) - legitimate but missed intermediate events
        # Should be accepted as new baseline IMMEDIATELY once median stabilizes (3 frames),
        # but NO event triggered.
        timestamp = 10.0

        # Feed 1st frame (median still 224)
        self.detector.detect_event(ScoreState(257, 1), timestamp)
        # Feed 2nd frame (median still 224)
        self.detector.detect_event(ScoreState(257, 1), timestamp + 1.0)
        # Feed 3rd frame (median becomes 257) -> Trigger Jump Update!
        event = self.detector.detect_event(ScoreState(257, 1), timestamp + 2.0)

        self.assertIsNone(event)

        # Verify baseline was updated immediately
        self.assertEqual(
            self.detector.last_stable_score,
            ScoreState(257, 1),
            "Should accept huge jump as new baseline immediately after median stabilization",
        )

        # Next frame: 257 -> 261 (Four) - should be detected relative to new baseline
        timestamp += 3.0
        self.detector.detect_event(ScoreState(261, 1), timestamp)  # Add to history
        self.detector.detect_event(ScoreState(261, 1), timestamp + 1.0)  # Confirm

        # Trigger
        event = self.detector.detect_event(ScoreState(261, 1), timestamp + 2.0)

        self.assertIsNotNone(event)
        if event:
            self.assertEqual(event["type"], "FOUR")

    def test_normal_sequences(self):
        """Test normal score progression"""
        print("\n--- Test Normal Sequences ---")

        # Initial score
        self.detector.detect_event(ScoreState(10, 0), 1.0)
        self.detector.detect_event(ScoreState(10, 0), 2.0)
        self.detector.detect_event(ScoreState(10, 0), 3.0)  # Stable

        # Single
        event = self.detector.detect_event(ScoreState(11, 0), 4.0)
        self.assertIsNone(event, "Single run should not trigger boundary event")

        # Four
        # Need multiple frames to confirm if using median/confirmation logic
        # Current logic might need a few frames to stabilize new score
        self.detector.detect_event(ScoreState(15, 0), 5.0)
        self.detector.detect_event(ScoreState(15, 0), 6.0)
        event = self.detector.detect_event(ScoreState(15, 0), 7.0)

        self.assertIsNotNone(event, "Four should be detected")
        if event:
            self.assertEqual(event["type"], "FOUR")
            # print(f"Detected: {event}") # Commented out to avoid encoding errors

    def test_score_drop_noise(self):
        """Test that score drops (OCR noise) are ignored"""
        print("\n--- Test Score Drop Noise ---")

        # Establish baseline
        for i in range(10):
            self.detector.detect_event(ScoreState(50, 0), i * 1.0)

        # Drop noise (e.g. 50 -> 5)
        # We process this "noise" for a few frames to verify it doesn't takeover
        event = self.detector.detect_event(ScoreState(5, 0), 10.0)
        self.assertIsNone(event, "Score drop should simply be ignored/buffered")

        # Back to normal
        event = self.detector.detect_event(ScoreState(50, 0), 11.0)
        self.assertIsNone(event)

        # Valid Boundary
        # Need to re-stabilize on higher score
        self.detector.detect_event(ScoreState(56, 0), 12.0)
        self.detector.detect_event(ScoreState(56, 0), 13.0)
        event = self.detector.detect_event(ScoreState(56, 0), 14.0)

        self.assertIsNotNone(event, "Should detect SIX after ignoring noise")
        if event:
            self.assertEqual(event["type"], "SIX")

    def test_oscillating_noise(self):
        """Test rapid oscillation 52 -> 5 -> 52"""
        print("\n--- Test Oscillating Noise ---")
        # Establish baseline 52/0
        for i in range(5):
            self.detector.detect_event(ScoreState(52, 0), i)

        # Noise: 5/0
        self.detector.detect_event(ScoreState(5, 0), 10)
        # Returning to baseline
        event = self.detector.detect_event(ScoreState(52, 0), 11)
        self.assertIsNone(
            event, "Returning to baseline from noise should not trigger event"
        )

        # Wicket drop noise
        # Establish 52/1
        # Need to trigger the wicket event first probably, or just force state
        self.detector.detect_event(ScoreState(52, 1), 20)
        self.detector.detect_event(ScoreState(52, 1), 21)
        self.detector.detect_event(ScoreState(52, 1), 22)  # WICKET event here

        # Now drop wicket count
        self.detector.detect_event(ScoreState(52, 0), 30)
        # Restore
        event = self.detector.detect_event(ScoreState(52, 1), 31)
        self.assertIsNone(
            event, "Wicket dropping then returning should not trigger event"
        )

    def test_new_innings_reset(self):
        """Test that sustained low score eventually resets the detector"""
        print("\n--- Test New Innings Reset ---")
        # Establish high score
        for i in range(5):
            self.detector.detect_event(ScoreState(200, 5), i)

        # New innings starts (0/0)
        # Should be ignored initially
        print("Feeding 0/0 (new innings)...")
        event = self.detector.detect_event(ScoreState(0, 0), 10)
        self.assertIsNone(event)

        # Persist for a while to trigger reset
        # Based on config, let's say 60 seconds
        timestamp = 10.0
        for i in range(70):
            timestamp += 1.0
            event = self.detector.detect_event(ScoreState(0, 0), timestamp)
            if event:
                self.fail(
                    f"Should not trigger event during reset stabilization, got {event}"
                )

        print("Stabilization period over, checking for new events...")
        # After stabilization, a new event (0 -> 4) should work
        timestamp += 1.0
        # Need some frames to confirm 0/0 is the new baseline if logic requires it
        # Then 4/0
        # Feed enough frames to stabilize the new score (median filter lag)
        found_event = None
        for i in range(10):
            timestamp += 1.0
            event = self.detector.detect_event(ScoreState(4, 0), timestamp)
            # print(f"DEBUG: FEED 4/0, ts={timestamp}, event={event}")
            if event:
                found_event = event
                break

        self.assertIsNotNone(found_event, "Should accept new events after reset")
        if found_event:
            self.assertEqual(found_event["type"], "FOUR")


if __name__ == "__main__":
    unittest.main()
