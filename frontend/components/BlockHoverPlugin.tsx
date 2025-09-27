import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $getRoot,
  $createParagraphNode,
} from "lexical";
import type { LexicalNode } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { mergeRegister } from "@lexical/utils";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useStore, PromptTemplate } from "../store";
import { useState, useCallback, useEffect, useLayoutEffect, JSX } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";

import "./BlockHoverPlugin.css";

/************************************************************
 * Generic floating‑UI wrapper
 ************************************************************/
// Floating wrapper props removed along with FloatingWrapper implementation

// FloatingWrapper removed (no rewrite popover now)

/************************************************************
 * BlockControls – rewrite pop‑over now a FloatingWrapper
 ************************************************************/
interface BlockControlsProps {
  element: HTMLElement;
  onDelete: () => void;
  onAIGenerate: (templateId: string) => void;
  onConvertMarkdown: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isDeletionDisabled: boolean;
  isAIGenerating: boolean;
  promptTemplates: PromptTemplate[];
}

function BlockControls({
  element,
  onDelete,
  onAIGenerate,
  onConvertMarkdown,
  onMouseEnter,
  onMouseLeave,
  isDeletionDisabled,
  isAIGenerating,
  promptTemplates,
}: BlockControlsProps) {
  const editorsNote = useStore((state) => state.editorsNote);
  const setEditorsNote = useStore((state) => state.setEditorsNote);
  const [noteOpen, setNoteOpen] = useState(false);
  // Removed rewrite input; templates handle strategies

  const {
    x: menuX,
    y: menuY,
    strategy: menuStrategy,
    refs: menuRefs,
  } = useFloating({
    placement: "right-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // Floating UI for the Editor's Note flyout, anchored to the block controls
  const {
    x: noteX,
    y: noteY,
    strategy: noteStrategy,
    refs: noteRefs,
  } = useFloating({
    placement: "left-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (element) menuRefs.setReference(element);
  }, [element, menuRefs]);
  useLayoutEffect(() => {
    if (menuRefs.floating?.current) {
      noteRefs.setReference(menuRefs.floating.current);
    }
  }, [menuRefs.floating, noteRefs]);

  // No rewrite submit handler

  if (menuX == null || menuY == null) return null;

  return (
    <>
      {/* Main controls */}
      <div
        ref={menuRefs.setFloating}
        className="block-controls"
        style={{
          position: menuStrategy,
          top: menuY,
          left: menuX,
          zIndex: 1000,
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="block-controls-buttons">
          <div className="block-controls-header">
            <button
              className={`block-control-btn note-toggle-btn ${
                noteOpen ? "open" : ""
              }`}
              onClick={() => setNoteOpen((v) => !v)}
              title="Editor’s Note"
              aria-label="Toggle Editor’s Note"
              aria-expanded={noteOpen}
              aria-controls="editors-note-flyout"
            >
              <svg
                className="arrow-icon"
                viewBox="0 0 20 20"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M7 5l6 5-6 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {/* Dynamic prompt template actions */}
          <div className="block-control-group">
            {promptTemplates.map((t) => (
              <button
                key={t.id}
                className="block-control-btn ai-btn"
                onClick={() => onAIGenerate(t.id)}
                disabled={isAIGenerating}
                title={`${t.emoji ? t.emoji + " " : ""}${t.name}`}
                aria-label={t.name}
              >
                {t.emoji || "✨"}
              </button>
            ))}
          </div>
          {/* Removed standalone rewrite button */}
          <button
            className="block-control-btn convert-markdown-btn"
            onClick={onConvertMarkdown}
            disabled={isAIGenerating}
            title={
              isAIGenerating
                ? "AI is generating..."
                : "Convert markdown to structured blocks"
            }
          >
            📄
          </button>
          <button
            className="block-control-btn delete-btn"
            onClick={onDelete}
            disabled={isDeletionDisabled}
            title={
              isDeletionDisabled
                ? "Cannot delete the last block"
                : "Delete block"
            }
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Editor's Note flyout */}
      {noteOpen && noteX != null && noteY != null && (
        <div
          ref={noteRefs.setFloating}
          className="editors-note-flyout"
          id="editors-note-flyout"
          style={{
            position: noteStrategy,
            top: noteY,
            left: noteX,
            zIndex: 1001,
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className="editors-note-row">
            <span className="editors-note-label">Editor’s Note</span>
            <button
              className="editors-note-close"
              onClick={() => setNoteOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <textarea
            value={editorsNote}
            placeholder="Add context or instruction..."
            onChange={(e) => setEditorsNote(e.target.value)}
            className="editors-note-input"
            rows={6}
          />
        </div>
      )}
    </>
  );
}

/************************************************************
 * BlockHoverPlugin (unchanged logic, floating‑UI integration)
 ************************************************************/
export function BlockHoverPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(
    null
  );
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(
    null
  );
  const [isControlsHovered, setIsControlsHovered] = useState(false);
  const [isDeletionDisabled, setIsDeletionDisabled] = useState(false);

  const { generate, isGenerating, canGenerate } = useAIGeneration();
  const promptTemplates = useStore((state) => state.promptTemplates);
  // activePromptTemplateId not needed here; templates are passed into controls

  /*******************************************************/
  /*  Update selection / hover logic (same as before)    */
  /*******************************************************/
  const updateBlockType = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        setSelectedElementKey(elementKey);
      }
    }

    // Check if deletion should be disabled (only one top-level node)
    const root = $getRoot();
    const topLevelNodeCount = root.getChildrenSize();
    setIsDeletionDisabled(topLevelNodeCount <= 1);
  }, [editor]);

  /*******************************************************/
  /*  Hover detection (same as before)                  */
  /*******************************************************/
  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    let hideTimeout: NodeJS.Timeout | null = null;

    const clearHideTimeout = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    const scheduleHide = () => {
      clearHideTimeout();
      hideTimeout = setTimeout(() => {
        if (!isControlsHovered) {
          setHoveredElement(null);
        }
      }, 100);
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      clearHideTimeout();

      // Ignore if we hover over existing controls or the editor's note flyout
      if (
        target.closest(".block-controls") ||
        target.closest(".editors-note-flyout")
      )
        return;

      const blockElement = target.closest(
        ".editor-paragraph, .editor-heading-h1, .editor-heading-h2, .editor-heading-h3, .editor-heading-h4, .editor-heading-h5, .editor-heading-h6, .editor-blockquote, .editor-list-ol, .editor-list-ul, .codeHighlight"
      ) as HTMLElement | null;

      if (blockElement && blockElement !== hoveredElement) {
        setHoveredElement(blockElement);

        // Update lexical‑specific info inside the editor read phase
        editor.getEditorState().read(() => {
          const root = editor.getEditorState()._nodeMap;
          let newSelectedElementKey = null as string | null;

          for (const [key] of root) {
            const dom = editor.getElementByKey(key);
            if (dom === blockElement) {
              newSelectedElementKey = key;
              break;
            }
          }

          setSelectedElementKey(newSelectedElementKey);
        });
      }
    };

    const handleMouseLeave = () => {
      scheduleHide();
    };

    editorElement.addEventListener("mouseover", handleMouseOver);
    editorElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      editorElement.removeEventListener("mouseover", handleMouseOver);
      editorElement.removeEventListener("mouseleave", handleMouseLeave);
      clearHideTimeout();
    };
  }, [editor, hoveredElement, isControlsHovered]);

  /*******************************************************/
  /*  Sync to editor updates                             */
  /*******************************************************/
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateBlockType();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateBlockType();
          return false;
        },
        1
      )
    );
  }, [editor, updateBlockType]);

  /*******************************************************/
  /*  Action handlers (unchanged)                        */
  /*******************************************************/
  const deleteBlock = () => {
    editor.update(() => {
      if (selectedElementKey !== null) {
        const node = $getNodeByKey(selectedElementKey);
        if (node) node.remove();
      }
    });
    setHoveredElement(null);
  };

  const handleAIGenerate = (templateId: string) => {
    if (!canGenerate || !selectedElementKey) return;

    editor.getEditorState().read(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        generate(templateId, {
          targetNodeKey: selectedElementKey,
        });
      }
    });
    setHoveredElement(null);
  };

  // Rewrite flow removed; use templates with appropriate insertion strategy

  const handleConvertMarkdown = () => {
    if (!selectedElementKey) return;

    editor.update(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        const markdownText = node.getTextContent();

        try {
          if ($isElementNode(node)) {
            // Use a temporary container to parse markdown without nesting result
            const tempContainer = $createParagraphNode();

            // Insert the temporary container right after the original node so the
            // conversion has a valid attachment point
            node.insertAfter(tempContainer);

            // Convert markdown into the temporary container
            $convertFromMarkdownString(
              markdownText,
              TRANSFORMERS,
              tempContainer,
              false,
              false
            );

            // Hoist all converted children to be siblings after the original node
            const convertedChildren = tempContainer.getChildren();
            if (convertedChildren.length > 0) {
              let insertAfterNode: LexicalNode = node;
              for (const child of convertedChildren) {
                child.remove(); // detach from temp container
                insertAfterNode.insertAfter(child);
                insertAfterNode = child;
              }
              // Remove the original markdown source node only if conversion produced content
              node.remove();
            }

            // Remove the temporary container (now empty or no longer needed)
            tempContainer.remove();
          }
        } catch (error) {
          console.error("Error converting markdown:", error);
        }
      }
    });
    setHoveredElement(null);
  };

  /*******************************************************/
  /*  Hover state management for floating controls       */
  /*******************************************************/
  const handleControlsMouseEnter = () => setIsControlsHovered(true);
  const handleControlsMouseLeave = () => setIsControlsHovered(false);

  /*******************************************************/
  /*  Render                                             */
  /*******************************************************/
  if (!hoveredElement) return null;

  return (
    <BlockControls
      element={hoveredElement}
      onDelete={deleteBlock}
      onAIGenerate={handleAIGenerate}
      onConvertMarkdown={handleConvertMarkdown}
      onMouseEnter={handleControlsMouseEnter}
      onMouseLeave={handleControlsMouseLeave}
      isDeletionDisabled={isDeletionDisabled}
      isAIGenerating={isGenerating}
      promptTemplates={promptTemplates}
    />
  );
}
