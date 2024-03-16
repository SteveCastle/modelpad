import { useEffect, useRef, useState } from "react";
import cx from "classnames";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { $wrapNodes } from "@lexical/selection";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { useStore } from "../store";
import { IconButton } from "./IconButton";
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
    host,
    createStory,
    cycleModel,
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
          createStory("Untitled");
        },
      },
      {
        label: "Open",
        action: () => {
          async function getFile() {
            // Open file picker and destructure the result the first handle
            const [fileHandle] = await window.showOpenFilePicker({
              types: [
                {
                  description: "Markdown file",
                  accept: {
                    "text/markdown": [".md"],
                    "text/plain": [".txt"],
                  },
                },
              ],
            });
            const file = await fileHandle.getFile();
            createStory(file.name);
            const markDown = await file.text();
            console.log("creating story");
            editor.update(() => {
              console.log("applying markdown");
              $convertFromMarkdownString(markDown, TRANSFORMERS);
            });
          }
          getFile();
        },
      },
      {
        label: "Save",
        action: () => {
          async function saveFile() {
            // create a new handle
            const newHandle = await window.showSaveFilePicker({
              suggestedName: activeStory?.title
                ? `${activeStory.title.toLocaleLowerCase()}.md`
                : "new.md",
              types: [
                {
                  description: "Markdown file",
                  accept: {
                    "text/markdown": [".md"],
                    "text/plain": [".txt"],
                  },
                },
              ],
            });

            // create a FileSystemWritableFileStream to write to
            const writableStream = await newHandle.createWritable();
            let markdown = "";
            editor.update(() => {
              markdown = $convertToMarkdownString(TRANSFORMERS);
            });
            await writableStream.write(markdown);

            // close the file and write the contents to disk.
            await writableStream.close();
          }
          saveFile();
        },
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
          setTextFormat({
            isBold: selection.hasFormat("bold"),
            isCode:
              $isCodeNode(selection.getNodes()[0].getParent()) ||
              $isCodeNode(selection.getNodes()[0]),
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
                editor.focus();
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
              }}
            />
            <IconButton
              icon="italic"
              aria-label="Format text as italics"
              active={textFormat.isItalic}
              onClick={() => {
                editor.focus();
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
              }}
            />
            <IconButton
              icon="underline"
              aria-label="Format text to underlined"
              active={textFormat.isUnderline}
              onClick={() => {
                editor.focus();
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
              }}
            />
            <IconButton
              icon="strike"
              aria-label="Format text with a strikethrough"
              active={textFormat.isStrikethrough}
              onClick={() => {
                editor.focus();
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
              }}
            />
            <IconButton
              icon="code"
              aria-label="Format text with inline code"
              active={textFormat.isCode}
              onClick={() => {
                editor.focus();
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
                editor.update(() => {
                  const selection = $getSelection();

                  if ($isRangeSelection(selection)) {
                    $wrapNodes(selection, () => $createCodeNode());
                  }
                });
              }}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <span className="server">{host}</span>
          <button
            className={`model ${generationState}`}
            onClick={() => {
              clearContext(activeStoryId);
              cycleModel();
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
