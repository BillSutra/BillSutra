"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/i18n";
import type { AssistantChatLanguage } from "@/lib/assistantLanguage";
import {
  browserSpeechRecognitionProvider,
  resolveRecognitionLocale,
} from "@/lib/voice/speechRecognition";
import { browserTextToSpeechProvider } from "@/lib/voice/textToSpeech";
import type {
  SpeechToTextSession,
  VoiceAssistantPhase,
  VoiceTranscriptSnapshot,
} from "@/lib/voice/voiceTypes";

type VoiceAssistantReply = {
  text: string;
  language: AssistantChatLanguage;
};

type UseVoiceAssistantOptions = {
  preferredLanguage: Language;
  onVoiceQuery: (
    transcript: string,
    transcriptLanguage: AssistantChatLanguage,
  ) => Promise<VoiceAssistantReply | null>;
};

export const useVoiceAssistant = ({
  preferredLanguage,
  onVoiceQuery,
}: UseVoiceAssistantOptions) => {
  const [phase, setPhase] = useState<VoiceAssistantPhase>("idle");
  const [transcript, setTranscript] = useState<VoiceTranscriptSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const sessionRef = useRef<SpeechToTextSession | null>(null);
  const recognitionErrorRef = useRef(false);
  const isListening = phase === "listening";
  const isProcessing = phase === "processing";
  const isSpeaking = phase === "speaking";
  const liveTranscript =
    transcript?.interimTranscript || transcript?.finalTranscript || "";

  const resetTranscript = () => {
    setTranscript(null);
  };

  const stopSpeaking = () => {
    browserTextToSpeechProvider.stop();
    setPhase((current) => (current === "speaking" ? "idle" : current));
  };

  const stopListening = () => {
    sessionRef.current?.stop();
  };

  const cancelListening = () => {
    sessionRef.current?.abort();
    sessionRef.current = null;
    resetTranscript();
    setPhase("idle");
  };

  const speakReply = async (text: string, language: AssistantChatLanguage) => {
    if (!ttsSupported || !text.trim()) {
      return;
    }

    setError(null);
    setPhase("speaking");

    try {
      await browserTextToSpeechProvider.speak({ text, language });
      setPhase("idle");
    } catch (speakError) {
      setPhase("error");
      setError(
        speakError instanceof Error
          ? speakError.message
          : "Voice playback failed. You can still read the answer on screen.",
      );
    }
  };

  const startListening = () => {
    if (!sttSupported) {
      setPhase("error");
      setError("Voice input is not supported here. Please use text input.");
      return;
    }

    stopSpeaking();
    resetTranscript();
    setError(null);

    const locale = resolveRecognitionLocale(preferredLanguage);

    sessionRef.current = browserSpeechRecognitionProvider.createSession({
      locale,
      onStart: () => {
        recognitionErrorRef.current = false;
        setPhase("listening");
      },
      onTranscript: (snapshot) => {
        setTranscript(snapshot);
      },
      onError: (message) => {
        recognitionErrorRef.current = true;
        setPhase("error");
        setError(message);
      },
      onEnd: async (snapshot) => {
        sessionRef.current = null;

        if (recognitionErrorRef.current) {
          recognitionErrorRef.current = false;
          return;
        }

        if (!snapshot.finalTranscript.trim()) {
          setPhase("idle");
          return;
        }

        setTranscript(snapshot);
        setPhase("processing");

        try {
          // The chat layer stays the single source of truth for finance logic;
          // this hook only orchestrates voice capture and playback around it.
          const reply = await onVoiceQuery(
            snapshot.finalTranscript,
            snapshot.language,
          );

          if (!reply) {
            setPhase("idle");
            return;
          }

          if (!ttsSupported) {
            setPhase("idle");
            return;
          }

          await speakReply(reply.text, reply.language);
        } catch (voiceError) {
          setPhase("error");
          setError(
            voiceError instanceof Error
              ? voiceError.message
              : "Voice request failed. Please try again or type your question.",
          );
        }
      },
    });

    sessionRef.current.start();
  };

  useEffect(() => {
    setSttSupported(browserSpeechRecognitionProvider.isSupported());
    setTtsSupported(browserTextToSpeechProvider.isSupported());
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
      browserTextToSpeechProvider.stop();
    };
  }, []);

  const statusText = useMemo(() => {
    if (phase === "listening") {
      return "Listening...";
    }

    if (phase === "processing") {
      return "Thinking...";
    }

    if (phase === "speaking") {
      return "Speaking...";
    }

    if (!sttSupported) {
      return "Voice input is unavailable in this browser.";
    }

    return null;
  }, [phase, sttSupported]);

  return {
    phase,
    error,
    transcript,
    liveTranscript,
    statusText,
    sttSupported,
    ttsSupported,
    isListening,
    isProcessing,
    isSpeaking,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    speakReply,
    resetTranscript,
    clearVoiceError: () => {
      setError(null);
      setPhase("idle");
    },
  };
};
