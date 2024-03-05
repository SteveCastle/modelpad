import { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { useStore } from "../store";
import { IconButton } from "./IconButton";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import "./Toolbar.css";
type TextFormattingState = {
  isBold: boolean;
  isCode: boolean;
  isItalic: boolean;
  isStrikethrough: boolean;
  isUnderline: boolean;
};

type MenuOptions = {
  [key: string]: { label: string; action: () => void }[];
};

export function Toolbar() {
  const {
    cancelGeneration,
    clearContext,
    generationState,
    modelSettings,
    createStory,
  } = useStore((state) => state);
  const [editor] = useLexicalComposerContext();
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const [textFormat, setTextFormat] = useState<TextFormattingState>({
    isBold: false,
    isCode: false,
    isItalic: false,
    isStrikethrough: false,
    isUnderline: false,
  });

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menuOptions: MenuOptions = {
    file: [
      {
        label: "New",
        action: () => {
          console.log("new");
          createStory();
        },
      },
      {
        label: "Open",
        action: () => {},
      },
      {
        label: "Save",
        action: () => {},
      },
    ],
    edit: [
      {
        label: "Undo",
        action: () => {},
      },
      {
        label: "Redo",
        action: () => {},
      },
      {
        label: "Cut",
        action: () => {},
      },
      {
        label: "Copy",
        action: () => {},
      },
      {
        label: "Paste",
        action: () => {},
      },
    ],
    view: [
      {
        label: "Zoom In",
        action: () => {},
      },
      {
        label: "Zoom Out",
        action: () => {},
      },
      {
        label: "Reset Zoom",
        action: () => {},
      },
    ],
  };

  useOnClickOutside(menuRef, () => setActiveMenu(null));
  useEffect(() => {
    const unregisterListener = editor.registerUpdateListener(
      ({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          console.log("selection", selection.hasFormat("bold"));
          setTextFormat({
            isBold: selection.hasFormat("bold"),
            isCode: selection.hasFormat("code"),
            isItalic: selection.hasFormat("italic"),
            isStrikethrough: selection.hasFormat("strikethrough"),
            isUnderline: selection.hasFormat("underline"),
          });
        });
      }
    );
    return unregisterListener;
  }, [editor]);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <button
            className="item"
            onClick={() => {
              // if already open close by setting to null
              setActiveMenu(activeMenu === "file" ? null : "file");
            }}
            onMouseOver={() => {
              if (activeMenu) {
                setActiveMenu("file");
              }
            }}
          >
            File
          </button>
          <button
            className="item"
            onClick={() => {
              // if already open close by setting to null
              setActiveMenu(activeMenu === "edit" ? null : "edit");
            }}
            onMouseOver={() => {
              if (activeMenu) {
                setActiveMenu("edit");
              }
            }}
          >
            Edit
          </button>
          <button
            className="item"
            onClick={() => {
              // if already open close by setting to null
              setActiveMenu(activeMenu === "view" ? null : "view");
            }}
            onMouseOver={() => {
              if (activeMenu) {
                setActiveMenu("view");
              }
            }}
          >
            View
          </button>
          <div className="style-tools">
            <IconButton
              icon="bold"
              aria-label="Format text as bold"
              active={textFormat.isBold}
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
              }}
            />
            <IconButton
              icon="italic"
              aria-label="Format text as italics"
              active={textFormat.isItalic}
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
              }}
            />
            <IconButton
              icon="underline"
              aria-label="Format text to underlined"
              active={textFormat.isUnderline}
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
              }}
            />
            <IconButton
              icon="strike"
              aria-label="Format text with a strikethrough"
              active={textFormat.isStrikethrough}
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
              }}
            />
            <IconButton
              icon="code"
              aria-label="Format text with inline code"
              active={textFormat.isCode}
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
              }}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <button
            className={`model ${generationState}`}
            onClick={() => {
              clearContext(activeStoryId);
            }}
            disabled={generationState !== "idle"}
          >{`${modelSettings.model}`}</button>
          <button
            className={`context ${generationState}`}
            onClick={() => {
              clearContext(activeStoryId);
            }}
            disabled={generationState !== "idle"}
          >{`${
            activeStory?.context?.length ? activeStory.context?.length : "0"
          }/4096`}</button>
          <button
            className="cancel-button"
            onClick={() => cancelGeneration()}
            disabled={generationState === "idle"}
          >
            <span className={`status ${generationState}`}></span>
            {`${generationState === "idle" ? "" : "Cancel "}${generationState}`}
          </button>
        </div>
      </div>
      <div className={cx("drop-down-menu", activeMenu)} ref={menuRef}>
        {menuOptions[activeMenu || "file"].map((option) => (
          <button
            key={option.label}
            className="item"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("clicked", option.label);
              option.action();
              setActiveMenu(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useOnClickOutside = (ref: any, handler: any) => {
  useEffect(() => {
    const listener = (event: Event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
};

export default useOnClickOutside;
