import { useEffect, useRef, useState } from "react";
import { Story } from "../store";
import { offset, shift } from "@floating-ui/dom";
import {
  useFloating,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import "./Tab.css";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";

type Props = {
  story: Story;
  activeStoryId: string;
  setActive: (id: string) => void;
};

export function Tab({ story, activeStoryId, setActive }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const titleRef = useRef<HTMLInputElement>(null);
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), shift({ padding: 8 })],
    placement: "bottom-start",
    strategy: "fixed",
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([]);

  useEffect(() => {
    if (isOpen) return;
    const virtualReference = {
      getBoundingClientRect() {
        return {
          width: 0,
          height: 0,
          x: mousePosition.x,
          y: mousePosition.y,
          top: mousePosition.y,
          left: mousePosition.x,
          right: mousePosition.x,
          bottom: mousePosition.y,
        };
      },
    };
    refs.setReference(virtualReference);
  }, [refs, mousePosition, isOpen]);

  const [editingTitle, setEditingTitle] = useState(false);
  const {
    newTitle,
    setNewTitle,
    updateTitle,
    closeStory,
    closeAllStories,
    closeOtherStories,
    closeToTheRight,
  } = useStore((state) => state);

  useOnClickOutside(titleRef, () => {
    if (newTitle.length > 0) {
      updateTitle(story.id, removeNewLineChars(newTitle) || "");
      setNewTitle("");
      setEditingTitle(false);
    }
  });

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  return (
    <>
      <a
        className={["tab", story.id === activeStoryId ? "active" : ""].join(
          " "
        )}
        key={story.id}
        onMouseMove={(e) => {
          setMousePosition({ x: e.clientX, y: e.clientY });
        }}
        onAuxClick={(e) => {
          e.preventDefault();
          if (e.button == 1) {
            closeStory(story.id);
          }
        }}
        {...getReferenceProps({
          onClick: (e) => {
            e.preventDefault();
            setActive(story.id);
          },
          onContextMenu: (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          },
        })}
      >
        {editingTitle ? (
          <input
            ref={titleRef}
            className={[
              "editable-title",
              editingTitle ? "editing" : "",
              story.synced ? "synced" : "",
            ].join(" ")}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" ||
                ((e.ctrlKey || e.metaKey) && e.key === "s")
              ) {
                e.preventDefault();
                updateTitle(story.id, removeNewLineChars(newTitle) || "");
                setEditingTitle(false);
                setNewTitle("");
              }
            }}
            onChange={(e) => {
              e.preventDefault();
              setNewTitle(e.currentTarget.value);
            }}
            onBlur={() => {
              updateTitle(story.id, removeNewLineChars(newTitle) || "");
              setEditingTitle(false);
              setNewTitle("");
            }}
            value={newTitle}
          />
        ) : (
          <span
            className={[
              "editable-title",
              editingTitle ? "editing" : "",
              story.synced ? "synced" : "",
            ].join(" ")}
            onDoubleClick={() => {
              setNewTitle(story.title);
              setEditingTitle(true);
            }}
          >
            {removeNewLineChars(story.title)}
          </span>
        )}
        <button
          className="close"
          onClick={(e) => {
            e.stopPropagation();
            closeStory(story.id);
          }}
        >
          <XMarkIcon />
        </button>
      </a>
      {isOpen && (
        <FloatingPortal>
          <div
            className="tab-actions"
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <button
              onClick={() => {
                closeStory(story.id);
                setIsOpen(false);
              }}
            >
              Close
            </button>
            <button
              onClick={() => {
                closeAllStories();
                setIsOpen(false);
              }}
            >
              Close All
            </button>
            <button
              onClick={() => {
                closeOtherStories(story.id);
                setIsOpen(false);
              }}
            >
              Close Other Tabs
            </button>
            <button
              onClick={() => {
                closeToTheRight(story.id);
                setIsOpen(false);
              }}
            >
              Close to the Right
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

function removeNewLineChars(text: string) {
  return text.replace(/(\r\n|\n|\r)/gm, "");
}
