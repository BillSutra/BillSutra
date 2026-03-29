import type { AssistantChatLanguage } from "@/lib/assistantLanguage";

export type VoiceAssistantPhase =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type VoiceAssistantLocale = "en-IN" | "hi-IN";

export type VoiceTranscriptSnapshot = {
  finalTranscript: string;
  interimTranscript: string;
  language: AssistantChatLanguage;
  locale: VoiceAssistantLocale;
};

export type SpeechRecognitionSessionOptions = {
  locale: VoiceAssistantLocale;
  onTranscript: (snapshot: VoiceTranscriptSnapshot) => void;
  onError: (message: string) => void;
  onStart?: () => void;
  onEnd?: (snapshot: VoiceTranscriptSnapshot) => void;
};

export type SpeakTextOptions = {
  text: string;
  language: AssistantChatLanguage;
  rate?: number;
  pitch?: number;
};

export interface SpeechToTextSession {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface SpeechToTextProvider {
  isSupported: () => boolean;
  createSession: (options: SpeechRecognitionSessionOptions) => SpeechToTextSession;
}

export interface TextToSpeechProvider {
  isSupported: () => boolean;
  speak: (options: SpeakTextOptions) => Promise<void>;
  stop: () => void;
}
