import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore } from "../store";

// Auto-scrolls the editor's scroll container while generating.
// Stops auto-follow once the user scrolls manually, and resumes on next generation.
export default function AutoScrollPlugin() {
  const [editor] = useLexicalComposerContext();
  const generationState = useStore((s) => s.generationState);

  const userInterruptedRef = useRef(false);
  const lastScrollTopRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Find and cache the editor scroll container
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    // The scrollable container is the parent of the contenteditable area in StoryEditor
    const container = rootElement.parentElement as HTMLElement | null;
    if (container && container.scrollHeight > container.clientHeight) {
      scrollContainerRef.current = container;
    } else {
      // Fallback: walk up
      let parent = rootElement.parentElement;
      while (parent && parent !== document.body) {
        if (
          parent.scrollHeight > parent.clientHeight &&
          (getComputedStyle(parent).overflowY === "auto" ||
            getComputedStyle(parent).overflowY === "scroll")
        ) {
          scrollContainerRef.current = parent as HTMLElement;
          break;
        }
        parent = parent.parentElement;
      }
    }
  }, [editor]);

  // Reset interruption flag when a new generation starts
  useEffect(() => {
    if (generationState === "generating") {
      userInterruptedRef.current = false;
    }
  }, [generationState]);

  // Attach user scroll detection while generating
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onUserScroll = () => {
      // If user scrolls and it's not just our own follow-to-end behavior, mark interrupted
      const nearBottom =
        container.scrollHeight -
          (container.scrollTop + container.clientHeight) <
        8;
      // If not near bottom, assume user intent to take over scrolling
      if (!nearBottom) {
        userInterruptedRef.current = true;
      }
      lastScrollTopRef.current = container.scrollTop;
    };

    if (generationState === "generating") {
      container.addEventListener("scroll", onUserScroll as EventListener, {
        passive: true,
      });
      return () =>
        container.removeEventListener("scroll", onUserScroll as EventListener);
    }
  }, [generationState]);

  // Follow to bottom while generating unless user interrupted
  useEffect(() => {
    if (generationState !== "generating") return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId = 0;
    const tick = () => {
      if (!userInterruptedRef.current) {
        const target = container.scrollHeight - container.clientHeight;
        if (target >= 0) {
          container.scrollTo({ top: target, behavior: "auto" });
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [generationState]);

  return null;
}
