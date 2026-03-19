"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, SendHorizontal, User2 } from "lucide-react";
import { translate, type Language } from "@/i18n";
import { askAssistant, type AssistantReply } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/providers/LanguageProvider";

type AssistantChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  highlights?: AssistantReply["highlights"];
  examples?: string[];
  pending?: boolean;
};

type AssistantCopy = {
  title: string;
  description: string;
  placeholder: string;
  send: string;
  thinking: string;
  error: string;
  welcome: string;
  examplesTitle: string;
  understandsTitle: string;
  roleUser: string;
  roleAssistant: string;
  quickPrompts: string[];
  understands: string[];
};

const HINDI_SCRIPT_PATTERN = /[\u0900-\u097F]/;
const HINDI_ROMANIZED_HINTS = [
  "kitna",
  "kitni",
  "kitne",
  "aapka",
  "aapki",
  "mahina",
  "mahine",
  "batao",
  "bakaya",
  "baki",
  "munafa",
  "labh",
  "nakdi",
];

const detectMessageLanguage = (message: string): Language => {
  const normalized = message.toLowerCase();
  if (HINDI_SCRIPT_PATTERN.test(message)) {
    return "hi";
  }

  return HINDI_ROMANIZED_HINTS.some((hint) => normalized.includes(hint)) ? "hi" : "en";
};

const buildAssistantCopy = (language: Language): AssistantCopy => ({
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

const AssistantChat = () => {
  const { language } = useI18n();
  const [input, setInput] = useState("");
  const uiCopy = useMemo(() => buildAssistantCopy(language), [language]);
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: "welcome-message",
      role: "assistant",
      content: uiCopy.welcome,
      examples: uiCopy.quickPrompts,
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
        },
      ];
    });
  }, [uiCopy.quickPrompts, uiCopy.welcome]);

  const assistantQuery = useMutation({
    mutationFn: askAssistant,
  });

  const submitMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || assistantQuery.isPending) return;

    const replyLanguage = detectMessageLanguage(message);
    const replyCopy = buildAssistantCopy(replyLanguage);
    const requestTime = Date.now();
    const userMessage: AssistantChatMessage = {
      id: `user-${requestTime}`,
      role: "user",
      content: message,
    };
    const pendingId = `assistant-pending-${requestTime}`;
    const pendingMessage: AssistantChatMessage = {
      id: pendingId,
      role: "assistant",
      content: replyCopy.thinking,
      pending: true,
    };

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setInput("");

    try {
      const reply = await assistantQuery.mutateAsync(message);
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId
            ? {
                id: `assistant-${requestTime}`,
                role: "assistant",
                content: reply.answer,
                highlights: reply.highlights,
                examples: reply.examples,
              }
            : entry,
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingId
            ? {
                id: `assistant-error-${requestTime}`,
                role: "assistant",
                content: replyCopy.error,
              }
            : entry,
        ),
      );
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_320px]">
      <Card className="dashboard-chart-surface rounded-[1.75rem]">
        <CardHeader className="dashboard-chart-content">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-primary/15 bg-primary/10 p-3 text-primary">
              <Bot size={18} />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">{uiCopy.title}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">{uiCopy.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="dashboard-chart-content flex flex-col gap-4">
          <div className="grid max-h-[540px] gap-3 overflow-y-auto rounded-3xl border border-border/70 bg-background/60 p-4">
            {messages.map((message) => (
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
                    {message.role === "user" ? <User2 size={14} /> : <Bot size={14} />}
                    <span>
                      {message.role === "user" ? uiCopy.roleUser : uiCopy.roleAssistant}
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
                        {uiCopy.examplesTitle}
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
            ))}
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
              disabled={assistantQuery.isPending}
              className="h-12 rounded-2xl"
            />
            <Button
              type="submit"
              disabled={assistantQuery.isPending || input.trim().length === 0}
              className="h-12 rounded-2xl px-5"
            >
              <SendHorizontal size={16} />
              {uiCopy.send}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="dashboard-chart-surface rounded-[1.75rem]">
          <CardHeader className="dashboard-chart-content">
            <CardTitle className="text-lg text-foreground">{uiCopy.examplesTitle}</CardTitle>
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
