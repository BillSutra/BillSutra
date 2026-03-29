import type {
  SpeakTextOptions,
  TextToSpeechProvider,
  VoiceAssistantLocale,
} from "@/lib/voice/voiceTypes";

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;

const resolveSynthesisLocale = ({
  text,
  language,
}: SpeakTextOptions): VoiceAssistantLocale => {
  if (language === "hi" || DEVANAGARI_PATTERN.test(text)) {
    return "hi-IN";
  }

  return "en-IN";
};

const getVoiceCandidates = (locale: VoiceAssistantLocale, voices: SpeechSynthesisVoice[]) => {
  const exactLocale = voices.filter((voice) => voice.lang === locale);
  const sameLanguage = voices.filter((voice) => voice.lang.startsWith(locale.slice(0, 2)));
  const indianVoices = sameLanguage.filter(
    (voice) =>
      voice.lang.includes("IN") ||
      /india|indian/i.test(`${voice.name} ${voice.voiceURI}`),
  );

  return [...indianVoices, ...exactLocale, ...sameLanguage, ...voices];
};

const resolvePreferredVoice = (
  locale: VoiceAssistantLocale,
  voices: SpeechSynthesisVoice[],
) => getVoiceCandidates(locale, voices).find(Boolean) ?? null;

const loadSpeechVoices = () =>
  new Promise<SpeechSynthesisVoice[]>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const immediateVoices = synth.getVoices();
    if (immediateVoices.length > 0) {
      resolve(immediateVoices);
      return;
    }

    const handleVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    };

    synth.addEventListener("voiceschanged", handleVoicesChanged, { once: true });
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(synth.getVoices());
    }, 300);
  });

export const isBrowserTextToSpeechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

class BrowserTextToSpeechProvider implements TextToSpeechProvider {
  isSupported() {
    return isBrowserTextToSpeechSupported();
  }

  stop() {
    if (!isBrowserTextToSpeechSupported()) {
      return;
    }

    window.speechSynthesis.cancel();
  }

  async speak(options: SpeakTextOptions) {
    if (!isBrowserTextToSpeechSupported()) {
      throw new Error("Voice playback is not supported in this browser.");
    }

    const locale = resolveSynthesisLocale(options);
    const voices = await loadSpeechVoices();

    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.lang = locale;
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      // Prefer Indian voices first so Hindi and Indian-English replies sound
      // more natural when the browser has them available.
      utterance.voice = resolvePreferredVoice(locale, voices);
      utterance.onend = () => resolve();
      utterance.onerror = () =>
        reject(new Error("Voice playback did not complete. Please try again."));

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }
}

export const browserTextToSpeechProvider = new BrowserTextToSpeechProvider();
