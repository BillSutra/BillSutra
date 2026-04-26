"use client";

import { useEffect } from "react";

export type KeyboardShortcut = {
  key: string;
  handler: (event: KeyboardEvent) => void;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: boolean;
  allowInInput?: boolean;
  enabled?: boolean;
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toUpperCase();
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
};

const isCoarsePointerDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches &&
  window.matchMedia("(hover: none)").matches;

const matchesShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut) => {
  const normalizedEventKey = event.key.toLowerCase();
  const normalizedShortcutKey = shortcut.key.toLowerCase();

  return (
    normalizedEventKey === normalizedShortcutKey &&
    Boolean(shortcut.altKey) === event.altKey &&
    Boolean(shortcut.ctrlKey) === event.ctrlKey &&
    Boolean(shortcut.metaKey) === event.metaKey &&
    Boolean(shortcut.shiftKey) === event.shiftKey
  );
};

export const useKeyboardShortcuts = ({
  enabled = true,
  shortcuts,
}: {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
}) => {
  useEffect(() => {
    if (!enabled || isCoarsePointerDevice()) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) {
          continue;
        }

        if (!shortcut.allowInInput && isTypingTarget(event.target)) {
          continue;
        }

        if (!matchesShortcut(event, shortcut)) {
          continue;
        }

        if (shortcut.preventDefault) {
          event.preventDefault();
        }

        shortcut.handler(event);
        break;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [enabled, shortcuts]);
};

export default useKeyboardShortcuts;
