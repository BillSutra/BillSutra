import type { Language } from "@/i18n";
import {
  detectAssistantChatLanguage,
  type AssistantChatLanguage,
} from "@/lib/assistantLanguage";
import type {
  SpeechRecognitionSessionOptions,
  SpeechToTextProvider,
  SpeechToTextSession,
  VoiceAssistantLocale,
  VoiceTranscriptSnapshot,
} from "@/lib/voice/voiceTypes";

type BrowserSpeechRecognitionResultAlternative = {
  transcript: string;
  confidence: number;
};

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  0: BrowserSpeechRecognitionResultAlternative;
};

type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const getSpeechRecognitionConstructor = () =>
  typeof window === "undefined"
    ? null
    : (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null);

const mapRecognitionError = (errorCode: string) => {
  if (errorCode === "no-speech") {
    return "I could not hear that clearly. Please try again.";
  }

  if (errorCode === "audio-capture") {
    return "Microphone access is unavailable. Please check your device permissions.";
  }

  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Microphone permission is blocked. Please allow mic access and try again.";
  }

  if (errorCode === "network") {
    return "Speech recognition hit a network issue. You can still type your question.";
  }

  return "Voice capture did not complete. Please try again or use text input.";
};

export const isBrowserSpeechRecognitionSupported = () =>
  !!getSpeechRecognitionConstructor();

export const resolveRecognitionLocale = (
  preferredLanguage: Language | AssistantChatLanguage,
): VoiceAssistantLocale => (preferredLanguage === "hi" ? "hi-IN" : "en-IN");

const buildTranscriptSnapshot = (
  locale: VoiceAssistantLocale,
  finalTranscript: string,
  interimTranscript: string,
): VoiceTranscriptSnapshot => {
  // We infer response language from the freshest transcript so replies stay
  // aligned with the latest user input.
  const combinedTranscript = `${finalTranscript} ${interimTranscript}`.trim();

  return {
    finalTranscript: finalTranscript.trim(),
    interimTranscript: interimTranscript.trim(),
    language: combinedTranscript
      ? detectAssistantChatLanguage(combinedTranscript)
      : locale === "hi-IN"
        ? "hi"
        : "en",
    locale,
  };
};

class BrowserSpeechRecognitionProvider implements SpeechToTextProvider {
  isSupported() {
    return isBrowserSpeechRecognitionSupported();
  }

  createSession(options: SpeechRecognitionSessionOptions): SpeechToTextSession {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionCtor) {
      return {
        start: () =>
          options.onError("Voice input is not supported in this browser."),
        stop: () => undefined,
        abort: () => undefined,
      };
    }

    // This browser-backed provider keeps the interface small so a remote
    // Google STT or Whisper provider can replace it later without UI changes.
    const recognition = new SpeechRecognitionCtor();
    let finalTranscript = "";
    let interimTranscript = "";

    recognition.lang = options.locale;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      options.onStart?.();
    };

    recognition.onresult = (event) => {
      interimTranscript = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcriptChunk = result?.[0]?.transcript?.trim() ?? "";

        if (!transcriptChunk) {
          continue;
        }

        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcriptChunk}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcriptChunk}`.trim();
        }
      }

      options.onTranscript(
        buildTranscriptSnapshot(
          options.locale,
          finalTranscript,
          interimTranscript,
        ),
      );
    };

    recognition.onerror = (event) => {
      options.onError(mapRecognitionError(event.error));
    };

    recognition.onend = () => {
      options.onEnd?.(
        buildTranscriptSnapshot(
          options.locale,
          finalTranscript,
          interimTranscript,
        ),
      );
    };

    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
    };
  }
}

export const browserSpeechRecognitionProvider =
  new BrowserSpeechRecognitionProvider();
