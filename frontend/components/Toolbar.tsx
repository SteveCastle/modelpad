import { useState } from "react";
import { useQueryClient } from "react-query";
import { UNDO_COMMAND, REDO_COMMAND, CUT_COMMAND, COPY_COMMAND } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
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
import useCtrlHotkey from "../hooks/useCtrlHotkey";
import Context from "./Context";
import { CloudArrowUpIcon } from "@heroicons/react/24/solid";

type MenuOptions = {
  [key: string]: { label: string; action: () => void }[];
};

export function Toolbar() {
  const queryClient = useQueryClient();
  const {
    newTitle,
    cancelGeneration,
    model,
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

  // Individual states for each dropdown
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  const session = useSessionContext();

  // Floating UI setup for File menu
  const {
    refs: fileRefs,
    floatingStyles: fileFloatingStyles,
    context: fileContext,
  } = useFloating({
    open: isFileMenuOpen,
    onOpenChange: setIsFileMenuOpen,
    middleware: [offset(10), shift()],
    placement: "bottom-start",
  });

  const fileClick = useClick(fileContext);
  const {
    getReferenceProps: getFileReferenceProps,
    getFloatingProps: getFileFloatingProps,
  } = useInteractions([fileClick]);

  // Floating UI setup for Edit menu
  const {
    refs: editRefs,
    floatingStyles: editFloatingStyles,
    context: editContext,
  } = useFloating({
    open: isEditMenuOpen,
    onOpenChange: setIsEditMenuOpen,
    middleware: [offset(10), shift()],
    placement: "bottom-start",
  });

  const editClick = useClick(editContext);
  const {
    getReferenceProps: getEditReferenceProps,
    getFloatingProps: getEditFloatingProps,
  } = useInteractions([editClick]);

  // Floating UI setup for View menu
  const {
    refs: viewRefs,
    floatingStyles: viewFloatingStyles,
    context: viewContext,
  } = useFloating({
    open: isViewMenuOpen,
    onOpenChange: setIsViewMenuOpen,
    middleware: [offset(10), shift()],
    placement: "bottom-start",
  });

  const viewClick = useClick(viewContext);
  const {
    getReferenceProps: getViewReferenceProps,
    getFloatingProps: getViewFloatingProps,
  } = useInteractions([viewClick]);

  // Close dropdowns when clicking outside
  useOnClickOutside(fileRefs.floating, () => setIsFileMenuOpen(false));
  useOnClickOutside(editRefs.floating, () => setIsEditMenuOpen(false));
  useOnClickOutside(viewRefs.floating, () => setIsViewMenuOpen(false));

  const saveDocument = () => {
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
            title: newTitle ? newTitle : activeStory.title,
          }),
        }
      );
      queryClient.invalidateQueries("stories");
      updateSyncState(activeStoryId, true);
    }
    if (session.loading === false && session.userId) {
      save();
    }
  };

  useCtrlHotkey(saveDocument, "s");

  const menuOptions: MenuOptions = {
    file: [
      {
        label: "New",
        action: () => {
          createStory("Untitled");
          setIsFileMenuOpen(false);
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
          setIsFileMenuOpen(false);
        },
      },
      {
        label: "Save",
        action: () => {
          saveDocument();
          setIsFileMenuOpen(false);
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
          setIsFileMenuOpen(false);
        },
      },
    ],
    edit: [
      {
        label: "Undo",
        action: () => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
          setIsEditMenuOpen(false);
        },
      },
      {
        label: "Redo",
        action: () => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
          setIsEditMenuOpen(false);
        },
      },
      {
        label: "Cut",
        action: () => {
          editor.dispatchCommand(CUT_COMMAND, null);
          setIsEditMenuOpen(false);
        },
      },
      {
        label: "Copy",
        action: () => {
          editor.dispatchCommand(COPY_COMMAND, null);
          setIsEditMenuOpen(false);
        },
      },
    ],
    view: [
      {
        label: "Zoom In",
        action: () => {
          zoomIn();
          setIsViewMenuOpen(false);
        },
      },
      {
        label: "Zoom Out",
        action: () => {
          zoomOut();
          setIsViewMenuOpen(false);
        },
      },
      {
        label: "Reset Zoom",
        action: () => {
          resetZoom();
          setIsViewMenuOpen(false);
        },
      },
      {
        label: viewSettings.readingMode
          ? "Exit Reading Mode"
          : "Enter Reading Mode",
        action: () => {
          toggleReadingMode();
          setIsViewMenuOpen(false);
        },
      },
    ],
  };

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
            {...getFileReferenceProps()}
            ref={fileRefs.setReference}
          >
            File
          </button>
          <button
            className="item"
            {...getEditReferenceProps()}
            ref={editRefs.setReference}
          >
            Edit
          </button>
          <button
            className="item"
            {...getViewReferenceProps()}
            ref={viewRefs.setReference}
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
          <Context />
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
              Sign In
            </a>
          )}
          {session.loading === false && session.userId ? (
            <button
              className="save"
              onClick={() => {
                saveDocument();
              }}
            >
              <CloudArrowUpIcon />
            </button>
          ) : null}
        </div>
      </div>

      {/* File Menu Dropdown */}
      {isFileMenuOpen && (
        <div
          className="floating-dropdown"
          ref={fileRefs.setFloating}
          style={fileFloatingStyles}
          {...getFileFloatingProps()}
        >
          {menuOptions.file.map((option) => (
            <button
              key={option.label}
              className="dropdown-item"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                option.action();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Edit Menu Dropdown */}
      {isEditMenuOpen && (
        <div
          className="floating-dropdown"
          ref={editRefs.setFloating}
          style={editFloatingStyles}
          {...getEditFloatingProps()}
        >
          {menuOptions.edit.map((option) => (
            <button
              key={option.label}
              className="dropdown-item"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                option.action();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* View Menu Dropdown */}
      {isViewMenuOpen && (
        <div
          className="floating-dropdown"
          ref={viewRefs.setFloating}
          style={viewFloatingStyles}
          {...getViewFloatingProps()}
        >
          {menuOptions.view.map((option) => (
            <button
              key={option.label}
              className="dropdown-item"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                option.action();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
