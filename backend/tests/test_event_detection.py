"""
Unit tests for event detection logic - Wicket-prioritized detection system.
Tests FOUR, SIX, and WICKET detection with fuzzy parsing support.
"""
import sys
from pathlib import Path
from typing import Optional, Dict
import pytest

# Add scripts directory to path
scripts_dir = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

from scripts.ocr_engine import EventDetector, ScoreState, EventType


class TestEventDetector:
    """Test suite for the EventDetector class"""
    
    @pytest.fixture
    def detector(self):
        """Create a fresh EventDetector for each test"""
        detector = EventDetector()
        detector.reset()
        return detector
    
    def test_four_detection(self, detector):
        """Test detection of FOUR (4 runs)"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(100, 2), 1.0)
        
        # Trigger FOUR: 100 -> 104
        for _ in range(5):
            event = detector.detect_event(ScoreState(104, 2), 5.0)
        
        assert event is not None
        assert event['type'] == EventType.FOUR
        assert event['runs'] == 104
        assert event['wickets'] == 2
    
    def test_six_detection_fuzzy(self, detector):
        """Test detection of SIX with fuzzy matching (5, 6, 7 runs accepted)"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(150, 3), 1.0)
        
        # Test fuzzy SIX: runs_diff = 5 (OCR misread '6' as '5')
        for _ in range(5):
            event = detector.detect_event(ScoreState(155, 3), 5.0)
        
        assert event is not None
        assert event['type'] == EventType.SIX
        
        # Reset and test exact SIX
        detector.reset()
        for _ in range(5):
            detector.detect_event(ScoreState(150, 3), 10.0)
        
        for _ in range(5):
            event = detector.detect_event(ScoreState(156, 3), 15.0)
        
        assert event is not None
        assert event['type'] == EventType.SIX
        
        # Reset and test fuzzy SIX: runs_diff = 7 (OCR misread '6' as '8', then corrected)
        detector.reset()
        for _ in range(5):
            detector.detect_event(ScoreState(150, 3), 20.0)
        
        for _ in range(5):
            event = detector.detect_event(ScoreState(157, 3), 25.0)
        
        assert event is not None
        assert event['type'] == EventType.SIX
    
    def test_wicket_priority(self, detector):
        """Test that WICKET detection has priority over boundary detection"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(200, 4), 1.0)
        
        # Wicket + runs: 200/4 -> 204/5 (should detect WICKET, not FOUR)
        for _ in range(5):
            event = detector.detect_event(ScoreState(204, 5), 5.0)
        
        assert event is not None
        assert event['type'] == EventType.WICKET
        assert event['wickets'] == 5
    
    def test_wicket_without_runs(self, detector):
        """Test WICKET detection without run change (run out)"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(175, 2), 1.0)
        
        # Run out: 175/2 -> 175/3 (no runs added)
        for _ in range(5):
            event = detector.detect_event(ScoreState(175, 3), 5.0)
        
        assert event is not None
        assert event['type'] == EventType.WICKET
        assert event['runs'] == 175
        assert event['wickets'] == 3
    
    def test_no_event_on_huge_jump(self, detector):
        """Test that huge score jumps don't trigger false events"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(224, 0), 1.0)
        
        # Huge jump (missed intermediate events): 224 -> 257
        for _ in range(5):
            event = detector.detect_event(ScoreState(257, 1), 5.0)
        
        # Should update baseline but not trigger event (jump too large)
        assert event is None
        
        # Verify baseline updated
        assert detector.last_stable_score == ScoreState(257, 1)
        
        # Next FOUR from new baseline: 257 -> 261
        for _ in range(5):
            event = detector.detect_event(ScoreState(261, 1), 10.0)
        
        assert event is not None
        assert event['type'] == EventType.FOUR
    
    def test_median_smoothing(self, detector):
        """Test median smoothing prevents flickering false positives"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(100, 2), 1.0)
        
        # Flicker: 100 -> 104 -> 100 -> 104 (OCR instability)
        # Should NOT trigger event until median stabilizes
        event1 = detector.detect_event(ScoreState(104, 2), 5.0)
        event2 = detector.detect_event(ScoreState(100, 2), 6.0)
        event3 = detector.detect_event(ScoreState(104, 2), 7.0)
        
        # No event yet (median unstable)
        assert event1 is None
        assert event2 is None
        assert event3 is None
        
        # Stabilize at 104
        for _ in range(5):
            event = detector.detect_event(ScoreState(104, 2), 8.0)
        
        assert event is not None
        assert event['type'] == EventType.FOUR
    
    def test_cooldown_period(self, detector):
        """Test cooldown period prevents duplicate event detection"""
        # Establish baseline
        for _ in range(5):
            detector.detect_event(ScoreState(100, 2), 1.0)
        
        # First FOUR: 100 -> 104
        for _ in range(5):
            event1 = detector.detect_event(ScoreState(104, 2), 5.0)
        
        assert event1 is not None
        assert event1['type'] == EventType.FOUR
        
        # Try to trigger same event again within cooldown
        for _ in range(5):
            event2 = detector.detect_event(ScoreState(104, 2), 7.0)  # Only 2s later
        
        # Should not trigger (cooldown active)
        assert event2 is None
        
        # After cooldown (10s default)
        for _ in range(5):
            detector.detect_event(ScoreState(108, 2), 16.0)  # 11s later
        
        # Should trigger new FOUR
        event3 = detector.detect_event(ScoreState(108, 2), 17.0)
        assert event3 is not None
        assert event3['type'] == EventType.FOUR


class TestScoreState:
    """Test suite for ScoreState dataclass"""
    
    def test_score_state_creation(self):
        """Test ScoreState creation and equality"""
        score1 = ScoreState(145, 3)
        score2 = ScoreState(145, 3)
        score3 = ScoreState(150, 3)
        
        assert score1 == score2
        assert score1 != score3
    
    def test_score_state_string_representation(self):
        """Test ScoreState string formatting"""
        score = ScoreState(145, 3)
        assert str(score) == "145/3"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
    
    def is_score_stable(self, score: ScoreState) -> bool:
        """Check if score has been stable for enough frames"""
        if not self.previous_score or score != self.previous_score:
            self.same_score_count = 1
            return False
        
        self.same_score_count += 1
        return self.same_score_count >= self.stability_threshold
    
    def detect_event(self, current_score: ScoreState, timestamp: float) -> Optional[Dict]:
        """Detect event based on score change"""
        if not current_score:
            return None
        
        if self.is_outlier(current_score):
            return None
        
        if timestamp - self.last_event_timestamp < self.cooldown_seconds:
            self.previous_score = current_score
            return None
        
        if not self.is_score_stable(current_score):
            self.previous_score = current_score
            return None
        
        event = None
        
        if self.last_stable_score:
            runs_diff = current_score.runs - self.last_stable_score.runs
            wickets_diff = current_score.wickets - self.last_stable_score.wickets
            
            if runs_diff == 0 and wickets_diff == 0:
                self.previous_score = current_score
                return None
            
            if runs_diff == 4 and wickets_diff == 0:
                event = {
                    'type': 'FOUR',
                    'timestamp': timestamp,
                    'score_before': str(self.last_stable_score),
                    'score_after': str(current_score),
                    'description': f'Score: {self.last_stable_score} → {current_score}'
                }
            
            elif runs_diff == 6 and wickets_diff == 0:
                event = {
                    'type': 'SIX',
                    'timestamp': timestamp,
                    'score_before': str(self.last_stable_score),
                    'score_after': str(current_score),
                    'description': f'Score: {self.last_stable_score} → {current_score}'
                }
            
            elif wickets_diff == 1:
                event = {
                    'type': 'WICKET',
                    'timestamp': timestamp,
                    'score_before': str(self.last_stable_score),
                    'score_after': str(current_score),
                    'description': f'Wicket fell: {self.last_stable_score} → {current_score}'
                }
        
        if event:
            self.last_event_timestamp = timestamp
            self.last_stable_score = current_score
        else:
            if self.last_stable_score is None or current_score != self.last_stable_score:
                self.last_stable_score = current_score
        
        self.score_history.append(current_score)
        self.previous_score = current_score
        
        return event


def test_state_change_detection():
    """Test that events only trigger on state changes"""
    print("=== Test 1: State Change Detection ===")
    detector = EventDetector()
    
    # Simulate same score read multiple times (should NOT trigger events)
    score1 = ScoreState(runs=28, wickets=0)
    
    events = []
    for i in range(5):
        event = detector.detect_event(score1, timestamp=10.0 + i)
        if event:
            events.append(event)
    
    print(f"Same score read 5 times: {len(events)} events detected")
    assert len(events) == 0, "FAILED: Should not detect events for unchanged score"
    print("✅ PASSED: No duplicate events on same score\n")


def test_boundary_detection():
    """Test that boundaries are correctly detected"""
    print("=== Test 2: Boundary Detection ===")
    detector = EventDetector()
    
    # Establish baseline
    score1 = ScoreState(runs=28, wickets=0)
    for i in range(4):  # Stabilize score
        detector.detect_event(score1, timestamp=10.0 + i)
    
    # Detect FOUR (28 → 32)
    score2 = ScoreState(runs=32, wickets=0)
    for i in range(4):  # Stabilize new score
        event = detector.detect_event(score2, timestamp=20.0 + i)
        if event:
            print(f"FOUR detected at {event['timestamp']}s: {event['description']}")
            assert event['type'] == 'FOUR', f"Expected FOUR, got {event['type']}"
            break
    
    # Detect SIX (32 → 38)
    score3 = ScoreState(runs=38, wickets=0)
    for i in range(4):  # Stabilize new score
        event = detector.detect_event(score3, timestamp=30.0 + i)
        if event:
            print(f"SIX detected at {event['timestamp']}s: {event['description']}")
            assert event['type'] == 'SIX', f"Expected SIX, got {event['type']}"
            break
    
    print("✅ PASSED: Boundaries detected correctly\n")


def test_wicket_detection():
    """Test wicket detection with +1 validation"""
    print("=== Test 3: Wicket Detection ===")
    detector = EventDetector()
    
    # Establish baseline
    score1 = ScoreState(runs=45, wickets=2)
    for i in range(4):
        detector.detect_event(score1, timestamp=40.0 + i)
    
    # Detect wicket (2 → 3)
    score2 = ScoreState(runs=45, wickets=3)
    for i in range(4):
        event = detector.detect_event(score2, timestamp=50.0 + i)
        if event:
            print(f"WICKET detected at {event['timestamp']}s: {event['description']}")
            assert event['type'] == 'WICKET', f"Expected WICKET, got {event['type']}"
            break
    
    print("✅ PASSED: Wicket detected correctly\n")


def test_outlier_rejection():
    """Test outlier rejection (impossible score jumps)"""
    print("=== Test 4: Outlier Rejection ===")
    detector = EventDetector()
    
    # Establish baseline
    score1 = ScoreState(runs=100, wickets=5)
    for i in range(4):
        detector.detect_event(score1, timestamp=60.0 + i)
    
    # OCR misread: Jump from 5 wickets to 8 wickets (impossible)
    score_error = ScoreState(runs=100, wickets=8)
    event = detector.detect_event(score_error, timestamp=70.0)
    
    print(f"Impossible wicket jump (5 → 8): Event = {event}")
    assert event is None, "FAILED: Should reject impossible wicket jump"
    print("✅ PASSED: Outlier rejected\n")


def test_debouncing():
    """Test 10-second cooldown after events"""
    print("=== Test 5: Debouncing (10s cooldown) ===")
    detector = EventDetector()
    
    # Establish baseline
    score1 = ScoreState(runs=50, wickets=1)
    for i in range(4):
        detector.detect_event(score1, timestamp=100.0 + i)
    
    # Trigger FOUR event
    score2 = ScoreState(runs=54, wickets=1)
    event1 = None
    for i in range(4):
        event = detector.detect_event(score2, timestamp=110.0 + i)
        if event:
            event1 = event
            print(f"Event 1 at {event['timestamp']}s: {event['type']}")
            break
    
    assert event1 is not None, "First event should trigger"
    
    # Try to trigger another event immediately (should be blocked by cooldown)
    score3 = ScoreState(runs=58, wickets=1)
    for i in range(4):
        event2 = detector.detect_event(score3, timestamp=115.0 + i)
        if event2:
            print(f"❌ FAILED: Event detected during cooldown at {event2['timestamp']}s")
            assert False, "Events should not trigger during cooldown"
    
    print("✅ PASSED: Cooldown working (no events within 10s)\n")


if __name__ == "__main__":
    print("Testing OCR Event Detection Logic\n")
    print("=" * 50)
    
    try:
        test_state_change_detection()
        test_boundary_detection()
        test_wicket_detection()
        test_outlier_rejection()
        test_debouncing()
        
        print("=" * 50)
        print("🎉 ALL TESTS PASSED!")
        print("The event detection logic is working correctly.")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
