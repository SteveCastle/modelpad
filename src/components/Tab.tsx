import { useEffect, useState } from "react";
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

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const {
    updateTitle,
    closeStory,
    closeAllStories,
    closeOtherStories,
    closeToTheRight,
  } = useStore((state) => state);

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
        <span
          contentEditable={editingTitle}
          className={[
            "editable-title",
            editingTitle ? "editing" : "",
            story.synced ? "synced" : "",
          ].join(" ")}
          onDoubleClick={() => setEditingTitle(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.textContent.length > 0) {
              updateTitle(
                story.id,
                removeNewLineChars(e.currentTarget.textContent) || ""
              );
            } else {
              e.currentTarget.textContent = story.title;
            }
            setEditingTitle(false);
          }}
        >
          {removeNewLineChars(story.title)}
        </span>
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
            <button onClick={() => closeStory(story.id)}>Close</button>
            <button onClick={closeAllStories}>Close All</button>
            <button onClick={() => closeOtherStories(story.id)}>
              Close Other Tabs
            </button>
            <button onClick={() => closeToTheRight(story.id)}>
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
