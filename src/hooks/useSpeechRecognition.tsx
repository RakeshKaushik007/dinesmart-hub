import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const getRecognitionCtor = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

/**
 * Thin wrapper around the browser Web Speech API. Falls back to `supported = false`
 * on browsers without it (notably Firefox). Streams interim transcripts so the
 * calling component can show live text and append the final result on stop.
 */
export const useSpeechRecognition = ({
  lang = "en-IN",
  onFinal,
}: {
  lang?: string;
  onFinal?: (text: string) => void;
} = {}) => {
  const supported = !!getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);
    setInterim("");
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (event: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText && onFinalRef.current) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      const friendly =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone permission denied. Enable it in your browser settings."
          : code === "no-speech"
            ? "I didn't hear anything — try again."
            : code === "audio-capture"
              ? "No microphone detected."
              : `Voice input failed (${code}).`;
      setError(friendly);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start voice input.");
      setListening(false);
    }
  }, [lang]);

  useEffect(() => () => { try { recognitionRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, interim, error, start, stop };
};