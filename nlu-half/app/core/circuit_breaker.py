"""
Circuit breaker for ASR provider failover — TDD §2.2:
"3 consecutive Groq timeouts (>2.5s) or a 5xx within a 30s window trips
the breaker; requests route to Transcribe for 60s before a health-check
retry to Groq."

Implemented as a small in-process state machine. In a multi-worker
deployment this should be backed by Redis so all workers share breaker
state; the interface below is written so swapping the backing store later
doesn't change call sites (asr_service.py only calls is_open()/record_*()).
"""
import time
from dataclasses import dataclass, field


@dataclass
class CircuitBreakerState:
    consecutive_failures: int = 0
    opened_at: float | None = None
    failure_window_start: float | None = None


class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int,
        failure_window_seconds: float,
        open_seconds: float,
    ):
        self.failure_threshold = failure_threshold
        self.failure_window_seconds = failure_window_seconds
        self.open_seconds = open_seconds
        self._state: CircuitBreakerState = field(default_factory=CircuitBreakerState)
        self._state = CircuitBreakerState()

    def is_open(self) -> bool:
        if self._state.opened_at is None:
            return False
        elapsed = time.monotonic() - self._state.opened_at
        if elapsed >= self.open_seconds:
            # health-check retry window elapsed — half-open: allow one probe
            self._state.opened_at = None
            self._state.consecutive_failures = 0
            self._state.failure_window_start = None
            return False
        return True

    def record_success(self) -> None:
        self._state.consecutive_failures = 0
        self._state.failure_window_start = None
        self._state.opened_at = None

    def record_failure(self) -> None:
        now = time.monotonic()
        if (
            self._state.failure_window_start is None
            or (now - self._state.failure_window_start) > self.failure_window_seconds
        ):
            # start (or restart) the 30s failure-counting window
            self._state.failure_window_start = now
            self._state.consecutive_failures = 0

        self._state.consecutive_failures += 1
        if self._state.consecutive_failures >= self.failure_threshold:
            self._state.opened_at = now
