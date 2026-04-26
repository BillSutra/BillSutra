"use client";

import { Bot, Sparkles } from "lucide-react";

type AIChatPreviewProps = {
  chatLabel: string;
  chatTitle: string;
  userQuestion: string;
  assistantAnswer: string;
  followupLabel: string;
  typingLabel: string;
  prompts: string[];
  inputPlaceholder: string;
};

const AIChatPreview = ({
  chatLabel,
  chatTitle,
  userQuestion,
  assistantAnswer,
  followupLabel,
  typingLabel,
  prompts,
  inputPlaceholder,
}: AIChatPreviewProps) => {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_34px_80px_-46px_rgba(15,23,42,0.2)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_30px_74px_-44px_rgba(0,0,0,0.56)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(37,99,235,0.98),rgba(99,102,241,0.72),rgba(14,165,233,0.9))]" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
            {chatLabel}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
            {chatTitle}
          </h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          <Sparkles className="h-3.5 w-3.5" />
          Live AI
        </div>
      </div>

      <div className="mt-5 space-y-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="ml-auto max-w-[85%] rounded-[1.35rem] rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-6 text-white dark:bg-blue-600">
          {userQuestion}
        </div>
        <div className="max-w-[88%] rounded-[1.35rem] rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            <Bot className="h-3.5 w-3.5" />
            {followupLabel}
          </div>
          {assistantAnswer}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:240ms]" />
          </span>
          {typingLabel}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <span
            key={prompt}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {prompt}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
        <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm text-slate-400 dark:text-zinc-500">
          {inputPlaceholder}
        </span>
      </div>
    </div>
  );
};

export default AIChatPreview;
