import { useState } from "react";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

import "./Context.css";

export default function Context() {
  const { stories, activeStoryId, setIncludeInContext, useRag, setUseRag } =
    useStore((state) => state);

  const [isOpen, setIsOpen] = useState(false);

  const sortedStories = stories.sort((a, b) => {
    if (a.id === activeStoryId) return -1;
    if (b.id === activeStoryId) return 1;
    return 0;
  });

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), shift()],
  });

  const click = useClick(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click]);

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  return (
    <>
      <button
        className="context-button"
        {...getReferenceProps()}
        ref={refs.setReference}
      >
        Context Settings
      </button>
      {isOpen && (
        <div
          className="Context"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <h2>Tabs</h2>
          <div className="context-list">
            {sortedStories.map((story) => (
              <button
                className={`context-item`}
                key={story.id}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIncludeInContext(story.id, !story.includeInContext);
                }}
              >
                <div>
                  <span className="context-name">
                    {story.id === activeStoryId
                      ? `${story.title} (Active Tab)`
                      : story.title}
                  </span>
                </div>
                <span className="context-edit">
                  {story.includeInContext ? (
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="check-icon"
                    />
                  ) : (
                    <XCircleIcon className="x-icon" />
                  )}
                </span>
              </button>
            ))}
            <h2 className="rag-header">RAG Settings</h2>
            <div className="context-list">
              <button
                className={`context-item`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setUseRag(!useRag);
                }}
              >
                <div>
                  <span className="context-name">
                    Use Related Documents in Context
                  </span>
                </div>
                <span className="context-edit">
                  {useRag ? (
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="check-icon"
                    />
                  ) : (
                    <XCircleIcon className="x-icon" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
