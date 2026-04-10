"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bot,
  Mic,
  SendHorizontal,
  Square,
  User2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { translate, type Language } from "@/i18n";
import {
  askAssistant,
  type AssistantHistoryMessage,
  type AssistantReply,
} from "@/lib/apiClient";
import {
  detectAssistantChatLanguage,
  type AssistantChatLanguage,
} from "@/lib/assistantLanguage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useI18n } from "@/providers/LanguageProvider";

type AssistantChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  highlights?: AssistantReply["highlights"];
  examples?: string[];
  pending?: boolean;
  language?: AssistantChatLanguage;
};

type AssistantCopy = {
  thinking: string;
  error: string;
  examplesTitle: string;
  roleUser: string;
  roleAssistant: string;
};

type AssistantUiCopy = AssistantCopy & {
  title: string;
  description: string;
  placeholder: string;
  send: string;
  welcome: string;
  understandsTitle: string;
  quickPrompts: string[];
  understands: string[];
};

type VoiceCopy = {
  start: string;
  stop: string;
  replay: string;
  stopReplay: string;
  listening: string;
  thinking: string;
  speaking: string;
  transcriptTitle: string;
  fallback: string;
  helper: string;
  errorTitle: string;
};

const buildBaseAssistantCopy = (language: Language): AssistantUiCopy => ({
  title: translate(language, "assistant.chatTitle"),
  description: translate(language, "assistant.chatDescription"),
  placeholder: translate(language, "assistant.placeholder"),
  send: translate(language, "assistant.send"),
  thinking: translate(language, "assistant.thinking"),
  error: translate(language, "assistant.error"),
  welcome: translate(language, "assistant.welcome"),
  examplesTitle: translate(language, "assistant.examplesTitle"),
  understandsTitle: translate(language, "assistant.understandsTitle"),
  roleUser: translate(language, "assistant.roleUser"),
  roleAssistant: translate(language, "assistant.roleAssistant"),
  quickPrompts: [
    translate(language, "assistant.quickPrompts.profit"),
    translate(language, "assistant.quickPrompts.sales"),
    translate(language, "assistant.quickPrompts.pending"),
    translate(language, "assistant.quickPrompts.cashflow"),
  ],
  understands: [
    translate(language, "assistant.understands.profit"),
    translate(language, "assistant.understands.sales"),
    translate(language, "assistant.understands.pending"),
    translate(language, "assistant.understands.cashflow"),
  ],
});

const buildMessageCopy = (
  language: AssistantChatLanguage,
  fallbackLanguage: Language,
): AssistantCopy => {
  const baseCopy = buildBaseAssistantCopy(language ?? fallbackLanguage);
  return {
    thinking: baseCopy.thinking,
    error: baseCopy.error,
    examplesTitle: baseCopy.examplesTitle,
    roleUser: baseCopy.roleUser,
    roleAssistant: baseCopy.roleAssistant,
  };
};

const buildVoiceCopy = (language: AssistantChatLanguage): VoiceCopy => {
  if (language === "hi") {
    return {
      start: "बोलें",
      stop: "रोकें",
      replay: "सुनें",
      stopReplay: "आवाज़ रोकें",
      listening: "सुन रहा हूँ...",
      thinking: "सोच रहा हूँ...",
      speaking: "बोल रहा हूँ...",
      transcriptTitle: "Live transcript",
      fallback:
        "इस browser में voice input available नहीं है. आप text से पूछ सकते हैं.",
      helper: "माइक दबाकर हिंदी या अंग्रेज़ी में सवाल बोलिए।",
      errorTitle: "Voice issue",
    };
  }

  return {
    start: "Start voice",
    stop: "Stop voice",
    replay: "Play reply",
    stopReplay: "Stop audio",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    transcriptTitle: "Live transcript",
    fallback:
      "Voice input is not available in this browser. You can still type your question.",
    helper: "Tap the mic and ask your question in Hindi or English.",
    errorTitle: "Voice issue",
  };
};

const AssistantChat = () => {
  const { language } = useI18n();
  const [input, setInput] = useState("");
  const uiCopy = useMemo(() => buildBaseAssistantCopy(language), [language]);
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: "welcome-message",
      role: "assistant",
      content: uiCopy.welcome,
      examples: uiCopy.quickPrompts,
      language,
    },
  ]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.id !== "welcome-message") {
        return current;
      }

      return [
        {
          id: "welcome-message",
          role: "assistant",
          content: uiCopy.welcome,
          examples: uiCopy.quickPrompts,
          language,
        },
      ];
    });
  }, [language, uiCopy.quickPrompts, uiCopy.welcome]);

  const assistantQuery = useMutation({
    mutationFn: ({
      message,
      history,
    }: {
      message: string;
      history: AssistantHistoryMessage[];
    }) => askAssistant(message, history),
  });

  const submitMessage = async (
    rawMessage: string,
    options?: {
      source?: "text" | "voice";
      languageOverride?: AssistantChatLanguage;
    },
  ): Promise<AssistantReply | null> => {
    const message = rawMessage.trim();
    if (!message || assistantQuery.isPending) return null;

    const replyLanguage =
      options?.languageOverride ?? detectAssistantChatLanguage(message);
    const replyCopy = buildMessageCopy(replyLanguage, language);
    const requestTime = Date.now();
    const userMessage: AssistantChatMessage = {
      id: `user-${requestTime}`,
      role: "user",
      content: message,
      language: replyLanguage,
    };
    const pendingId = `assistant-pending-${requestTime}`;
    const pendingMessage: AssistantChatMessage = {
      id: pendingId,
      role: "assistant",
      content: replyCopy.thinking,
      pending: true,
      language: replyLanguage,
    };
    const history = messages
      .filter((entry) => !entry.pending)
      .slice(-6)
      .map<AssistantHistoryMessage>((entry) => ({
        role: entry.role,
        content: entry.content,
      }));

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setInput("");

    try {
      const reply = await assistantQuery.mutateAsync({ message, history });
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId
            ? {
                id: `assistant-${requestTime}`,
                role: "assistant",
                content: reply.answer,
                highlights: reply.highlights,
                examples: reply.examples,
                language: reply.language,
              }
            : entry,
        ),
      );
      return reply;
    } catch {
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId
            ? {
                id: `assistant-error-${requestTime}`,
                role: "assistant",
                content: replyCopy.error,
                language: replyLanguage,
              }
            : entry,
        ),
      );

      if (options?.source === "voice") {
        throw new Error(replyCopy.error);
      }

      return null;
    }
  };

  const voiceAssistant = useVoiceAssistant({
    preferredLanguage: language,
    onVoiceQuery: async (transcript, transcriptLanguage) => {
      const reply = await submitMessage(transcript, {
        source: "voice",
        languageOverride: transcriptLanguage,
      });

      if (!reply) {
        return null;
      }

      return {
        text: reply.answer,
        language: reply.language,
      };
    },
  });

  const voiceUiLanguage =
    voiceAssistant.transcript?.language ??
    (voiceAssistant.isSpeaking
      ? messages
          .slice()
          .reverse()
          .find((message) => message.role === "assistant" && !message.pending)
          ?.language
      : null) ??
    language;
  const voiceCopy = buildVoiceCopy(voiceUiLanguage);
  const latestAssistantReply = messages
    .slice()
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        !message.pending &&
        message.id !== "welcome-message",
    );
  const voiceStatusLabel = voiceAssistant.isListening
    ? voiceCopy.listening
    : voiceAssistant.isProcessing
      ? voiceCopy.thinking
      : voiceAssistant.isSpeaking
        ? voiceCopy.speaking
        : !voiceAssistant.sttSupported
          ? voiceCopy.fallback
          : voiceCopy.helper;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_320px]">
      <Card className="dashboard-chart-surface rounded-[1.75rem]">
        <CardHeader className="dashboard-chart-content">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-3 text-primary">
              <Bot size={18} />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">
                {uiCopy.title}
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {uiCopy.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="dashboard-chart-content flex flex-col gap-4">
          <div className="grid max-h-[540px] gap-3 overflow-y-auto rounded-3xl border border-border/70 bg-background/60 p-4">
            {messages.map((message) => {
              const messageCopy = buildMessageCopy(
                message.language ??
                  (message.role === "user"
                    ? detectAssistantChatLanguage(message.content)
                    : language),
                language,
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
                      {message.role === "user" ? (
                        <User2 size={14} />
                      ) : (
                        <Bot size={14} />
                      )}
                      <span>
                        {message.role === "user"
                          ? messageCopy.roleUser
                          : messageCopy.roleAssistant}
                      </span>
                    </div>
                    <p className="text-sm leading-6">{message.content}</p>

                    {message.highlights && message.highlights.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.highlights.map((item) => (
                          <span
                            key={`${message.id}-${item.label}`}
                            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground"
                          >
                            {item.label}: {item.value}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {message.examples && message.examples.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {messageCopy.examplesTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.examples.map((example) => (
                            <button
                              key={`${message.id}-${example}`}
                              type="button"
                              onClick={() => void submitMessage(example)}
                              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                            >
                              {example}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            className="flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage(input);
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={uiCopy.placeholder}
              disabled={assistantQuery.isPending || voiceAssistant.isProcessing}
              className="h-12 rounded-2xl"
            />
            <Button
              type="button"
              variant={voiceAssistant.isListening ? "secondary" : "outline"}
              size="icon"
              disabled={assistantQuery.isPending || voiceAssistant.isProcessing}
              onClick={() => {
                if (voiceAssistant.isListening) {
                  voiceAssistant.stopListening();
                  return;
                }

                voiceAssistant.startListening();
              }}
              aria-label={
                voiceAssistant.isListening ? voiceCopy.stop : voiceCopy.start
              }
              className="h-12 w-12 rounded-2xl"
            >
              {voiceAssistant.isListening ? (
                <Square size={16} />
              ) : (
                <Mic size={16} />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!latestAssistantReply}
              onClick={() => {
                if (voiceAssistant.isSpeaking) {
                  voiceAssistant.stopSpeaking();
                  return;
                }

                if (!latestAssistantReply) {
                  return;
                }

                void voiceAssistant.speakReply(
                  latestAssistantReply.content,
                  latestAssistantReply.language ??
                    detectAssistantChatLanguage(latestAssistantReply.content),
                );
              }}
              aria-label={
                voiceAssistant.isSpeaking
                  ? voiceCopy.stopReplay
                  : voiceCopy.replay
              }
              className="h-12 w-12 rounded-2xl"
            >
              {voiceAssistant.isSpeaking ? (
                <VolumeX size={16} />
              ) : (
                <Volume2 size={16} />
              )}
            </Button>
            <Button
              type="submit"
              disabled={
                assistantQuery.isPending ||
                voiceAssistant.isProcessing ||
                input.trim().length === 0
              }
              className="h-12 rounded-2xl px-5"
            >
              <SendHorizontal size={16} />
              {uiCopy.send}
            </Button>
          </form>

          <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">
                {voiceStatusLabel}
              </p>
              {voiceAssistant.liveTranscript ? (
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {voiceCopy.transcriptTitle}
                </span>
              ) : null}
            </div>

            {voiceAssistant.liveTranscript ? (
              <p className="mt-3 text-sm leading-6 text-foreground">
                {voiceAssistant.liveTranscript}
              </p>
            ) : null}

            {voiceAssistant.error ? (
              <p className="mt-3 text-sm text-destructive">
                {voiceCopy.errorTitle}: {voiceAssistant.error}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="dashboard-chart-surface rounded-[1.75rem]">
          <CardHeader className="dashboard-chart-content">
            <CardTitle className="text-lg text-foreground">
              {uiCopy.examplesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="dashboard-chart-content grid gap-2">
            {uiCopy.quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void submitMessage(prompt)}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition hover:border-primary/40 hover:bg-primary/5"
              >
                {prompt}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="dashboard-chart-surface rounded-[1.75rem]">
          <CardHeader className="dashboard-chart-content">
            <CardTitle className="text-lg text-foreground">
              {uiCopy.understandsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="dashboard-chart-content grid gap-2 text-sm text-muted-foreground">
            {uiCopy.understands.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssistantChat;
