import { useState } from "react";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

import "./Context.css";

export default function Context() {
  const { stories, setIncludeInContext } = useStore((state) => state);

  const [isOpen, setIsOpen] = useState(false);

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
        Context
      </button>
      {isOpen && (
        <div
          className="Context"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <h2>In Context</h2>
          <div className="context-list">
            {stories.map((story) => (
              <button
                className={`context-item`}
                key={story.id}
                onClick={() => {
                  console.log("clicked");
                }}
              >
                <div>
                  <span className="context-name">{story.title}</span>
                </div>
                <span
                  className="context-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIncludeInContext(story.id, !story.includeInContext);
                  }}
                >
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
          </div>
        </div>
      )}
    </>
  );
}
