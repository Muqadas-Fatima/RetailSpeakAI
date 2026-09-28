"use client";
/**
 * Frontend-only live microphone capture for the voice ordering screen.
 *
 * Responsibilities (all browser-side, no backend):
 * - request the real microphone via getUserMedia with browser audio
 *   enhancements (noise suppression, echo cancellation, auto gain control)
 * - transcribe speech with the browser SpeechRecognition API when available
 * - surface permission / secure-context / hardware error states for the UI
 * - auto-stop after a silence timeout and expose an idle session timeout
 * - sanitize the recognised transcript before it reaches the order pipeline
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "requesting" | "listening" | "processing" | "error";

export type MicErrorKind =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "no-device"
  | "no-speech"
  | "unknown";

export type MicError = { kind: MicErrorKind; message: string };

/** Browser audio enhancements — enabled where the browser supports them. */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  channelCount: 1,
};

const ERROR_MESSAGES: Record<MicErrorKind, string> = {
  "insecure-context": "Microphone needs a secure (HTTPS) connection.",
  unsupported: "Live voice input isn't supported in this browser — please type your order.",
  "permission-denied": "Microphone blocked. Allow mic access in your browser settings.",
  "no-device": "No microphone found. Connect one or type your order.",
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  unknown: "Microphone unavailable right now. You can type your order instead.",
};

const micError = (kind: MicErrorKind): MicError => ({ kind, message: ERROR_MESSAGES[kind] });

/**
 * Unicode bidirectional / invisible formatting characters.
 * These can visually reorder text (RTL spoofing) — important because the
 * assistant also handles Urdu, where bidi runs are legitimate but embedded
 * overrides in recognised speech are not.
 */
const BIDI_AND_INVISIBLE =
  /[\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/g;

/** Strip control/bidi characters and markup, then cap length. */
export function sanitizeTranscript(value: string, maxLength = 240): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(BIDI_AND_INVISIBLE, "")
    .replace(/[<>{}$`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** True only when the page can legally access the microphone. */
export function isSecureMicContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true || window.location.hostname === "localhost";
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export type UseLiveMicOptions = {
  /** Called with the sanitized final transcript. */
  onTranscript: (text: string) => void;
  /** BCP-47 tag, e.g. "en-US" or "ur-PK". */
  lang?: string;
  /** Auto-stop listening after this many ms with no final result. */
  maxListenMs?: number;
  /** Idle time before the mic session is considered expired. */
  sessionTimeoutMs?: number;
};

export function useLiveMic({
  onTranscript,
  lang = "en-US",
  maxListenMs = 12_000,
  sessionTimeoutMs = 5 * 60_000,
}: UseLiveMicOptions) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<MicError | null>(null);
  const [interim, setInterim] = useState("");
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(
    Math.round(sessionTimeoutMs / 1000),
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listenTimer = useRef<number | null>(null);
  const sessionTimer = useRef<number | null>(null);
  const expiresAtRef = useRef<number>(Date.now() + sessionTimeoutMs);
  const transcriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (listenTimer.current) window.clearTimeout(listenTimer.current);
    listenTimer.current = null;
  }, []);

  /** Observe the browser permission state when the API is available. */
  useEffect(() => {
    let active = true;
    const permissions = navigator.permissions as Navigator["permissions"] | undefined;
    if (!permissions?.query) return;
    permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (!active) return;
        setPermission(result.state);
        result.onchange = () => setPermission(result.state);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  /** Idle session timeout: releases the mic and shows a resume prompt. */
  const touchSession = useCallback(() => {
    setSessionExpired(false);
    expiresAtRef.current = Date.now() + sessionTimeoutMs;
    setSessionSecondsLeft(Math.round(sessionTimeoutMs / 1000));
    if (sessionTimer.current) window.clearTimeout(sessionTimer.current);
    sessionTimer.current = window.setTimeout(() => {
      setSessionExpired(true);
      setSessionSecondsLeft(0);
      releaseStream();
      setStatus("idle");
    }, sessionTimeoutMs);
  }, [releaseStream, sessionTimeoutMs]);

  /** Tick the visible session countdown once a second. */
  useEffect(() => {
    const id = window.setInterval(() => {
      setSessionSecondsLeft(Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    touchSession();
    return () => {
      if (sessionTimer.current) window.clearTimeout(sessionTimer.current);
      clearTimers();
      recognitionRef.current?.abort();
      releaseStream();
    };
  }, [touchSession, clearTimers, releaseStream]);

  const stop = useCallback(() => {
    clearTimers();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    releaseStream();
    setInterim("");
    setStatus((current) => (current === "error" ? current : "idle"));
  }, [clearTimers, releaseStream]);

  const start = useCallback(async () => {
    touchSession();
    setError(null);
    setInterim("");
    transcriptRef.current = "";

    if (!isSecureMicContext()) {
      setError(micError("insecure-context"));
      setStatus("error");
      return;
    }
    // Permission already blocked: show guidance instead of re-prompting in a loop.
    if (permission === "denied") {
      setError(micError("permission-denied"));
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(micError("unsupported"));
      setStatus("error");
      return;
    }

    setStatus("requesting");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (cause) {
      const name = (cause as { name?: string })?.name ?? "";
      setError(
        micError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "permission-denied"
            : name === "NotFoundError" || name === "DevicesNotFoundError"
              ? "no-device"
              : "unknown",
        ),
      );
      setStatus("error");
      return;
    }

    const Recognition = recognitionCtor();
    if (!Recognition) {
      releaseStream();
      setError(micError("unsupported"));
      setStatus("error");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += text;
        else interimText += text;
      }
      if (interimText) setInterim(sanitizeTranscript(interimText));
      if (finalText) transcriptRef.current = finalText;
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error ?? "");
      setError(
        micError(
          code === "not-allowed" || code === "service-not-allowed"
            ? "permission-denied"
            : code === "no-speech"
              ? "no-speech"
              : code === "audio-capture"
                ? "no-device"
                : "unknown",
        ),
      );
      setStatus("error");
      clearTimers();
      releaseStream();
    };

    recognition.onend = () => {
      clearTimers();
      releaseStream();
      setInterim("");
      const text = sanitizeTranscript(transcriptRef.current);
      transcriptRef.current = "";
      recognitionRef.current = null;
      if (text) {
        setStatus("processing");
        onTranscriptRef.current(text);
        setStatus("idle");
      } else {
        setStatus((current) => (current === "error" ? current : "idle"));
      }
      touchSession();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
      listenTimer.current = window.setTimeout(() => recognition.stop(), maxListenMs);
    } catch {
      releaseStream();
      setError(micError("unknown"));
      setStatus("error");
    }
  }, [clearTimers, lang, maxListenMs, permission, releaseStream, touchSession]);

  const toggle = useCallback(() => {
    if (status === "listening" || status === "requesting") stop();
    else void start();
  }, [start, status, stop]);

  return {
    status,
    error,
    interim,
    permission,
    sessionExpired,
    sessionSecondsLeft,
    isListening: status === "listening",
    isBusy: status === "requesting" || status === "processing",
    start,
    stop,
    toggle,
    resumeSession: touchSession,
    dismissError: () => {
      setError(null);
      setStatus("idle");
    },
  };
}
