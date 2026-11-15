"use client";
/**
 * Backend-streaming microphone hook.
 * Same return shape as useLiveMic, but audio is recorded with MediaRecorder
 * and streamed over a WebSocket to the backend (Whisper -> catalog N-gram
 * match) instead of using browser SpeechRecognition.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIO_CONSTRAINTS,
  isSecureMicContext,
  sanitizeTranscript,
  type MicError,
  type MicErrorKind,
  type MicStatus,
} from "./live-mic";
import { VoiceSocket, type CatalogMatch, type VoiceServerEvent } from "./ws-client";

const MESSAGES: Record<MicErrorKind, string> = {
  "insecure-context": "Microphone needs a secure (HTTPS) connection.",
  unsupported: "Voice recording isn't supported in this browser — please type your order.",
  "permission-denied": "Microphone blocked. Allow mic access in your browser settings.",
  "no-device": "No microphone found. Connect one or type your order.",
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  unknown: "Voice service unavailable right now. You can type your order instead.",
};

const err = (kind: MicErrorKind, message?: string): MicError => ({
  kind,
  message: message ?? MESSAGES[kind],
});

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
}

export type UseBackendMicOptions = {
  onTranscript: (text: string) => void;
  onMatches?: (matches: CatalogMatch[], productNames: string[]) => void;
  lang?: string; // kept for API parity with useLiveMic (backend auto-detects)
  maxListenMs?: number;
  sessionTimeoutMs?: number;
};

export function useBackendMic({
  onTranscript,
  onMatches,
  maxListenMs = 12_000,
  sessionTimeoutMs = 5 * 60_000,
}: UseBackendMicOptions) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<MicError | null>(null);
  const [interim] = useState("");
  const [matches, setMatches] = useState<CatalogMatch[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(
    Math.round(sessionTimeoutMs / 1000),
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<VoiceSocket | null>(null);
  const listenTimer = useRef<number | null>(null);
  const processingTimer = useRef<number | null>(null);
  const sessionTimer = useRef<number | null>(null);
  const expiresAtRef = useRef<number>(Date.now() + sessionTimeoutMs);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onMatchesRef = useRef(onMatches);
  onMatchesRef.current = onMatches;

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearListenTimer = useCallback(() => {
    if (listenTimer.current) window.clearTimeout(listenTimer.current);
    listenTimer.current = null;
  }, []);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimer.current) window.clearTimeout(processingTimer.current);
    processingTimer.current = null;
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
      if (listenTimer.current) window.clearTimeout(listenTimer.current);
      if (processingTimer.current) window.clearTimeout(processingTimer.current);
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      releaseStream();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [touchSession, releaseStream]);

  /** Messages coming back from the backend. */
  const handleEvent = useCallback(
    (event: VoiceServerEvent) => {
      console.log("[voice] server event:", event);
      switch (event.type) {
        case "transcript.final": {
          const text = sanitizeTranscript(event.text);
          if (!text) {
            clearProcessingTimer();
            setError(err("no-speech"));
            setStatus("error");
            return;
          }
          onTranscriptRef.current(text);
          return; // catalog.matches follows
        }
        case "catalog.matches":
          clearProcessingTimer();
          setMatches(event.matches);
          onMatchesRef.current?.(event.matches, event.product_names);
          setStatus("idle");
          return;
        case "error":
          clearProcessingTimer();
          setError(err("unknown", `Voice service error: ${event.error}`));
          setStatus("error");
          return;
        default:
          return;
      }
    },
    [clearProcessingTimer],
  );

  const ensureSocket = useCallback(async (): Promise<VoiceSocket> => {
    if (socketRef.current?.isOpen) return socketRef.current;
    const socket: VoiceSocket = new VoiceSocket(handleEvent, (reason) => {
      console.info("[voice] socket closed:", reason);
      if (socketRef.current === socket) socketRef.current = null;
    });
    await socket.connect(crypto.randomUUID());
    socketRef.current = socket;
    return socket;
  }, [handleEvent]);

  const stop = useCallback(() => {
    clearListenTimer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // recorder.onstop sends end_of_turn
    } else {
      releaseStream();
      setStatus((current) => (current === "error" ? current : "idle"));
    }
  }, [clearListenTimer, releaseStream]);

  const start = useCallback(async () => {
    touchSession();
    setError(null);
    setMatches([]);

    if (!isSecureMicContext()) {
      setError(err("insecure-context"));
      setStatus("error");
      return;
    }
    const mimeType = pickMimeType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      setError(err("unsupported"));
      setStatus("error");
      return;
    }

    setStatus("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    } catch (cause) {
      const name = (cause as { name?: string })?.name ?? "";
      setError(
        err(
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

    let socket: VoiceSocket;
    try {
      socket = await ensureSocket();
    } catch (cause) {
      console.error("[voice] connect failed:", cause);
      stream.getTracks().forEach((track) => track.stop());
      setError(
        err(
          "unknown",
          "Could not reach the voice server. Is the backend running and are you signed in?",
        ),
      );
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) socket.sendAudio(event.data);
    };
    recorder.onstop = () => {
      releaseStream();
      socket.endOfTurn();
      setStatus("processing");
      clearProcessingTimer();
      processingTimer.current = window.setTimeout(() => {
        setError(err("unknown", "The voice server took too long to answer. Please try again."));
        setStatus("error");
      }, 20_000);
    };
    recorderRef.current = recorder;
    recorder.start(250); // send a chunk every 250 ms
    setStatus("listening");
    listenTimer.current = window.setTimeout(() => stop(), maxListenMs);
  }, [clearProcessingTimer, ensureSocket, maxListenMs, releaseStream, stop, touchSession]);

  const toggle = useCallback(() => {
    if (status === "listening") stop();
    else if (status === "idle" || status === "error") void start();
  }, [start, status, stop]);

  return {
    status,
    error,
    interim,
    matches,
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