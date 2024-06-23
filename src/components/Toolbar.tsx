import { useRef, useState } from "react";
import cx from "classnames";
import { useQueryClient } from "react-query";
import { UNDO_COMMAND, REDO_COMMAND, CUT_COMMAND, COPY_COMMAND } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { useStore } from "../store";
import "./Toolbar.css";
import ModelSettings from "./ModelSettings";
import ServerSelect from "./ServerSelect";
import ToolBarPlugin from "./ToolBarPlugin";
import {
  useSessionContext,
  signOut,
} from "supertokens-auth-react/recipe/session";

type MenuOptions = {
  [key: string]: { label: string; action: () => void }[];
};

export function Toolbar() {
  const queryClient = useQueryClient();
  const {
    cancelGeneration,
    clearContext,
    model,
    serverKey,
    createStory,
    toggleReadingMode,
    zoomIn,
    zoomOut,
    updateSyncState,
    resetZoom,
    viewSettings,
  } = useStore((state) => state);
  const generationState = useStore((state) => state.generationState);
  const [editor] = useLexicalComposerContext();
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const activeStory = stories.find((s) => s.id === activeStoryId);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = useSessionContext();
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
            editor.update(() => {
              $convertFromMarkdownString(markDown, TRANSFORMERS);
            });
          }
          getFile();
        },
      },
      {
        label: "Save",
        action: () => {
          async function save() {
            await fetch(
              `${
                import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
              }/api/notes/${activeStoryId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  id: activeStoryId,
                  body: JSON.stringify(activeStory.content),
                  title: activeStory.title,
                }),
              }
            );
            queryClient.invalidateQueries("stories");
            updateSyncState(activeStoryId, true);
          }
          if (session.loading === false && session.userId) {
            save();
          }
        },
      },
      {
        label: "Export",
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
        action: () => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        },
      },
      {
        label: "Redo",
        action: () => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        },
      },
      {
        label: "Cut",
        action: () => {
          editor.dispatchCommand(CUT_COMMAND, null);
        },
      },
      {
        label: "Copy",
        action: () => {
          editor.dispatchCommand(COPY_COMMAND, null);
        },
      },
    ],
    view: [
      {
        label: "Zoom In",
        action: () => {
          zoomIn();
        },
      },
      {
        label: "Zoom Out",
        action: () => {
          zoomOut();
        },
      },
      {
        label: "Reset Zoom",
        action: () => {
          resetZoom();
        },
      },
      {
        label: viewSettings.readingMode
          ? "Exit Reading Mode"
          : "Enter Reading Mode",
        action: () => {
          toggleReadingMode();
        },
      },
    ],
  };

  useOnClickOutside(menuRef, () => setActiveMenu(null));

  async function onLogout() {
    await signOut();
    window.location.href = "/"; // or to wherever your logic page is
  }

  return (
    <>
      <div className="menubar">
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
            <ToolBarPlugin />
          </div>
        </div>
        <div className="toolbar-right">
          <ServerSelect />
          {model && <ModelSettings model={model} />}
          {serverKey === "localOllama" && (
            <button
              className={`context ${generationState}`}
              onClick={() => {
                clearContext(activeStoryId);
              }}
              disabled={generationState !== "ready"}
            >
              <div
                style={{
                  width: `${
                    activeStory?.context?.length
                      ? Math.floor((activeStory?.context?.length / 4096) * 100)
                      : 0
                  }%`,
                }}
                className="history-percentage"
              />
              Clear Context
            </button>
          )}
          <button
            className="cancel-button"
            onClick={() => {
              generationState === "no-connection"
                ? () => {
                    queryClient.refetchQueries("models");
                  }
                : cancelGeneration();
            }}
            disabled={generationState === "ready"}
          >
            <span className={`status ${generationState}`}></span>
            {`${
              generationState === "ready" || generationState === "no-connection"
                ? ""
                : "Cancel "
            }${generationState}`}
          </button>
          {session.loading === false && session.userId ? (
            <button onClick={onLogout} className="logout">
              Sign Out
            </button>
          ) : (
            <a href="/auth" className="login">
              Sign In / Sign Up
            </a>
          )}
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
