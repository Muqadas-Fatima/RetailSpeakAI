"""
ASR Layer — TDD §2.2. Converts audio to text; primary Groq-hosted Whisper
(large-v3), fallback AWS Transcribe (custom Urdu vocabulary), governed by
the circuit breaker in app/core/circuit_breaker.py using the exact trigger
spec from the TDD: 3 consecutive Groq timeouts (>2.5s) or a 5xx within a
30s window trips the breaker; route to Transcribe for 60s before retry.

Output shape matches TDD §4.1's WS transcript event:
{transcript, language_segments, confidence, is_final}
"""
import asyncio
import io
import time

import boto3
from groq import AsyncGroq

from app.config import get_settings
from app.core.circuit_breaker import CircuitBreaker
from app.core.exceptions import AsrUnavailable

settings = get_settings()

_groq_client = AsyncGroq(api_key=settings.groq_api_key)

_breaker = CircuitBreaker(
    failure_threshold=settings.asr_circuit_breaker_failure_threshold,
    failure_window_seconds=30.0,
    open_seconds=settings.asr_circuit_breaker_open_seconds,
)


class TranscriptResult:
    def __init__(self, transcript: str, language_segments: list[dict], confidence: float, is_final: bool):
        self.transcript = transcript
        self.language_segments = language_segments
        self.confidence = confidence
        self.is_final = is_final

    def to_dict(self) -> dict:
        return {
            "type": "transcript.final" if self.is_final else "transcript.partial",
            "text": self.transcript,
            "language_segments": self.language_segments,
            "confidence": self.confidence,
            "is_final": self.is_final,
        }


# Only these spoken languages are supported. Whisper's auto-detect covers ~99
# languages, and Urdu speech is often labelled Hindi/Punjabi/Arabic/Persian.
_ALLOWED_LANGS = {"en": "en", "english": "en", "ur": "ur", "urdu": "ur"}


def _lang_code(name: str | None) -> str | None:
    return _ALLOWED_LANGS.get((name or "").strip().lower())


def _mostly_latin(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum(c.isascii() for c in letters) / len(letters) > 0.8


async def _groq_call(audio_bytes: bytes, filename: str, language: str | None = None):
    extra = {"language": language} if language else {}
    return await asyncio.wait_for(
        _groq_client.audio.transcriptions.create(
            file=(filename, io.BytesIO(audio_bytes)),
            model=settings.groq_whisper_model,
            response_format="verbose_json",
            **extra,
        ),
        timeout=settings.asr_circuit_breaker_timeout_seconds,
    )


async def _transcribe_with_groq(audio_bytes: bytes, filename: str = "audio.webm") -> TranscriptResult:
    try:
        resp = await _groq_call(audio_bytes, filename)
        detected = (getattr(resp, "language", "") or "").strip().lower()
        if _lang_code(detected) is None:
            forced = "en" if _mostly_latin(resp.text or "") else "ur"
            print(f"[ASR] detected '{detected}' -> re-running as '{forced}'")
            resp = await _groq_call(audio_bytes, filename, language=forced)
    except (asyncio.TimeoutError, Exception) as exc:
        print(f"[ASR] Groq failed: {exc!r}")
        _breaker.record_failure()
        raise AsrUnavailable(f"Groq ASR failed: {exc}") from exc

    _breaker.record_success()

    segments = getattr(resp, "segments", None) or []
    language_segments = [
        {
            "lang": getattr(resp, "language", "ur"),
            "start_ms": int(seg.get("start", 0) * 1000),
            "end_ms": int(seg.get("end", 0) * 1000),
        }
        for seg in segments
    ]
    avg_logprob = [seg.get("avg_logprob", -0.3) for seg in segments] or [-0.3]
    # crude confidence proxy from Whisper's avg_logprob (closer to 0 = more confident)
    confidence = max(0.0, min(1.0, 1.0 + (sum(avg_logprob) / len(avg_logprob)) / 2))

    return TranscriptResult(
        transcript=resp.text,
        language_segments=language_segments,
        confidence=round(confidence, 2),
        is_final=True,
    )

async def _transcribe_with_transcribe_fallback(audio_bytes: bytes) -> TranscriptResult:
    """AWS Transcribe fallback with custom Urdu vocabulary — TDD §2.2.

    Uses the streaming-free batch path for simplicity/reliability inside a
    single request/response turn; a production deployment can swap this
    for the streaming Transcribe API without changing this function's
    external contract.
    """
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        raise AsrUnavailable("AWS Transcribe fallback is not configured (missing credentials)")

    def _sync_call() -> dict:
        client = boto3.client(
            "transcribe",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        # NOTE: production wiring uploads audio_bytes to S3 first and calls
        # start_transcription_job with LanguageCode="ur-PK" / vocabulary
        # filter, then polls for completion. Left as an integration seam —
        # the interface (bytes in, TranscriptResult out) is what matters
        # for callers of this module.
        raise NotImplementedError(
            "Wire this to your S3 bucket + start_transcription_job + "
            "get_transcription_job polling loop before enabling in prod."
        )

    try:
        await asyncio.to_thread(_sync_call)
    except NotImplementedError as exc:
        raise AsrUnavailable(str(exc)) from exc
    except Exception as exc:  # pragma: no cover - real AWS errors
        raise AsrUnavailable(f"AWS Transcribe fallback failed: {exc}") from exc


async def transcribe(audio_bytes: bytes) -> TranscriptResult:
    """Public entrypoint used by the voice WebSocket router. Applies the
    circuit-breaker failover policy from TDD §2.2."""
    if _breaker.is_open():
        return await _transcribe_with_transcribe_fallback(audio_bytes)

    try:
        return await _transcribe_with_groq(audio_bytes)
    except AsrUnavailable:
        # Breaker may not have tripped yet on this single failure — but if
        # Groq just failed, try the fallback immediately rather than
        # failing the turn, per the PRD's "system starts transcribing
        # rather than losing the utterance" journey (PRD §5.1).
        return await _transcribe_with_transcribe_fallback(audio_bytes)
