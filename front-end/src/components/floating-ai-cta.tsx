"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  MessageSquareText,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";
import { queryLandingAssistant } from "@/lib/landingAssistant";
import type {
  LandingAssistantAction,
  LandingAssistantHistoryMessage,
  LandingAssistantLanguage,
} from "../../../server/src/modules/landing-assistant/landingAssistant.contract";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: LandingAssistantAction[];
  pending?: boolean;
};

const COPY = {
  en: {
    button: "Ask BillSutra",
    title: "BillSutra Assistant",
    status: "Online",
    subtitle: "Sales + support guide",
    welcome:
      "Hi! I can explain BillSutra, pricing, inventory, and why teams switch from Excel. Ask me anything.",
    placeholder: "Ask about features, pricing, inventory, or setup...",
    quickLabel: "Quick questions",
    quickQuestions: [
      "What does BillSutra do?",
      "Is it free?",
      "What are pricing plans?",
      "Can it manage inventory?",
      "How is it better than Excel?",
      "How do I get started?",
    ],
    typing: "BillSutra Assistant is typing",
    helper: "Usually replies in a few seconds",
    send: "Send",
    close: "Close assistant",
    open: "Open assistant",
    error:
      "I’m having trouble live right now, but BillSutra can still help you with billing, stock, GST-ready invoices, and clearer cash flow.",
    fallbackActions: [
      { label: "Start Free", href: "/register", variant: "primary" as const },
      { label: "View Pricing", href: "/pricing", variant: "secondary" as const },
    ],
  },
  hi: {
    button: "BillSutra से पूछें",
    title: "BillSutra Assistant",
    status: "ऑनलाइन",
    subtitle: "सेल्स + सपोर्ट गाइड",
    welcome:
      "नमस्ते! मैं BillSutra, pricing, inventory और Excel से switch करने के फायदे जल्दी समझा सकता हूँ. कुछ भी पूछिए.",
    placeholder: "features, pricing, inventory या setup के बारे में पूछें...",
    quickLabel: "जल्दी पूछें",
    quickQuestions: [
      "BillSutra क्या करता है?",
      "क्या यह free है?",
      "Pricing plans क्या हैं?",
      "क्या यह inventory manage करता है?",
      "यह Excel से बेहतर कैसे है?",
      "मैं कैसे शुरू करूँ?",
    ],
    typing: "BillSutra Assistant जवाब तैयार कर रहा है",
    helper: "आमतौर पर कुछ ही सेकंड में जवाब",
    send: "भेजें",
    close: "Assistant बंद करें",
    open: "Assistant खोलें",
    error:
      "अभी live जवाब में दिक्कत है, लेकिन BillSutra फिर भी billing, stock, GST-ready invoices और better cash-flow visibility में मदद करता है.",
    fallbackActions: [
      { label: "फ्री शुरू करें", href: "/register", variant: "primary" as const },
      { label: "प्राइसिंग देखें", href: "/pricing", variant: "secondary" as const },
    ],
  },
} satisfies Record<
  LandingAssistantLanguage,
  {
    button: string;
    title: string;
    status: string;
    subtitle: string;
    welcome: string;
    placeholder: string;
    quickLabel: string;
    quickQuestions: string[];
    typing: string;
    helper: string;
    send: string;
    close: string;
    open: string;
    error: string;
    fallbackActions: LandingAssistantAction[];
  }
>;

const FloatingAiCta = () => {
  const { language } = useI18n();
  const uiLanguage: LandingAssistantLanguage = language === "hi" ? "hi" : "en";
  const copy = COPY[uiLanguage];
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: "assistant-welcome",
        role: "assistant",
        text: copy.welcome,
      },
    ]);
  }, [copy.welcome]);

  useEffect(() => {
    if (!open) {
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  const conversationHistory = useMemo<LandingAssistantHistoryMessage[]>(
    () =>
      messages
        .filter((message) => !message.pending)
        .map((message) => ({
          role: message.role,
          content: message.text,
        })),
    [messages],
  );

  const userMessageCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

  const shouldShowQuickQuestions =
    !isLoading && userMessageCount < 2 && messages.length <= 3;

  const submitMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isLoading) {
      return;
    }

    const requestId = Date.now();
    const nextUserTurnCount = userMessageCount + 1;
    const userEntry: ChatMessage = {
      id: `user-${requestId}`,
      role: "user",
      text: message,
    };
    const pendingEntry: ChatMessage = {
      id: `assistant-pending-${requestId}`,
      role: "assistant",
      text: copy.typing,
      pending: true,
    };

    setOpen(true);
    setInputValue("");
    setIsLoading(true);
    setMessages((current) => [...current, userEntry, pendingEntry]);

    try {
      const reply = await queryLandingAssistant({
        message,
        language: uiLanguage,
        history: conversationHistory.slice(-6),
      });

      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingEntry.id
            ? {
                id: `assistant-${requestId}`,
                role: "assistant",
                text: reply.answer,
                actions: nextUserTurnCount >= 2 ? reply.actions : undefined,
              }
            : entry,
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((entry) =>
          entry.id === pendingEntry.id
            ? {
                id: `assistant-error-${requestId}`,
                role: "assistant",
                text: copy.error,
                actions:
                  nextUserTurnCount >= 2 ? copy.fallbackActions : undefined,
              }
            : entry,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className={`fixed right-3 bottom-3 z-50 w-[calc(100vw-1.5rem)] max-w-[24rem] transition-all duration-300 sm:right-5 sm:bottom-5 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_30px_90px_-36px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_28px_80px_-36px_rgba(0,0,0,0.58)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_60%,#4f46e5_100%)] px-5 py-4 text-white dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.4)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold">{copy.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.18)]" />
                      {copy.status}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-medium">
                      {uiLanguage === "hi" ? "हिंदी" : "EN"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/75">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/10 p-2 text-white/85 transition hover:bg-white/15"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-4 dark:bg-[linear-gradient(180deg,#111113_0%,#09090b_100%)]">
            <div className="max-h-[25rem] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "rounded-br-md bg-slate-950 text-white dark:bg-blue-600"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    }`}
                  >
                    {message.pending ? (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                        <span className="flex gap-1">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:120ms]" />
                          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:240ms]" />
                        </span>
                        <span>{message.text}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line">{message.text}</p>
                    )}

                    {message.actions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <Button
                            key={`${message.id}-${action.href}-${action.label}`}
                            asChild
                            size="sm"
                            variant={
                              action.variant === "primary" ? "default" : "outline"
                            }
                            className="h-9 rounded-full px-4"
                          >
                            <Link href={action.href}>{action.label}</Link>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {shouldShowQuickQuestions ? (
                <div className="rounded-[1.35rem] border border-slate-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                    {copy.quickLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {copy.quickQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void submitMessage(question)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[1rem] bg-slate-50 px-3 py-2 dark:bg-zinc-900">
                  <MessageSquareText className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submitMessage(inputValue);
                      }
                    }}
                    rows={1}
                    placeholder={copy.placeholder}
                    className="max-h-28 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  disabled={isLoading || !inputValue.trim()}
                  onClick={() => void submitMessage(inputValue)}
                  aria-label={copy.send}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">
                {copy.helper}
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`fixed right-5 bottom-5 z-40 inline-flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_22px_48px_-30px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_56px_-30px_rgba(37,99,235,0.36)] dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-white dark:shadow-[0_20px_46px_-28px_rgba(0,0,0,0.52)] ${
          open ? "scale-95 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        }`}
        aria-label={copy.open}
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563eb,#6366f1)] text-white shadow-[0_18px_32px_-24px_rgba(37,99,235,0.42)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/25" />
          <Bot className="relative h-4 w-4" />
        </span>
        <span className="hidden sm:inline">{copy.button}</span>
      </button>
    </>
  );
};

export default FloatingAiCta;
