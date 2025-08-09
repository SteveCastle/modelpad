import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $getRoot,
  $createParagraphNode,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { mergeRegister } from "@lexical/utils";
import { useAIGeneration, AIActionType } from "../hooks/useAIGeneration";
import { useStore } from "../store";
import { useState, useCallback, useEffect, useLayoutEffect, JSX } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  Placement,
} from "@floating-ui/react";

import "./BlockHoverPlugin.css";

/************************************************************
 * Generic floating‑UI wrapper
 ************************************************************/
interface FloatingWrapperProps {
  referenceEl: HTMLElement | null;
  placement?: Placement;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}

function FloatingWrapper({
  referenceEl,
  placement = "right-start",
  className,
  onMouseEnter,
  onMouseLeave,
  children,
}: FloatingWrapperProps) {
  const { x, y, strategy, refs } = useFloating({
    placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (referenceEl) refs.setReference(referenceEl);
  }, [referenceEl, refs]);

  if (x == null || y == null) return null;

  return (
    <div
      ref={refs.setFloating}
      className={className}
      style={{ position: strategy, top: y, left: x, zIndex: 1000 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

/************************************************************
 * BlockControls – rewrite pop‑over now a FloatingWrapper
 ************************************************************/
interface BlockControlsProps {
  element: HTMLElement;
  onDelete: () => void;
  onAIGenerate: () => void;
  onRewrite: (instructions: string) => void;
  onConvertMarkdown: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isDeletionDisabled: boolean;
  isAIGenerating: boolean;
}

function BlockControls({
  element,
  onDelete,
  onAIGenerate,
  onRewrite,
  onConvertMarkdown,
  onMouseEnter,
  onMouseLeave,
  isDeletionDisabled,
  isAIGenerating,
}: BlockControlsProps) {
  const [showRewriteInput, setShowRewriteInput] = useState(false);
  const [rewriteInstructions, setRewriteInstructions] = useState("");

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

  useLayoutEffect(() => {
    if (element) menuRefs.setReference(element);
  }, [element, menuRefs]);

  const handleRewriteSubmit = () => {
    onRewrite(rewriteInstructions);
    setRewriteInstructions("");
    setShowRewriteInput(false);
  };

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
          <button
            className="block-control-btn ai-btn"
            onClick={onAIGenerate}
            disabled={isAIGenerating}
            title={
              isAIGenerating
                ? "AI is generating..."
                : "Generate AI content from this block"
            }
          >
            {isAIGenerating ? "⏳" : "⚡"}
          </button>
          <button
            className="block-control-btn rewrite-btn"
            onClick={() => setShowRewriteInput(!showRewriteInput)}
            disabled={isAIGenerating}
            title={
              isAIGenerating
                ? "AI is generating..."
                : "Rewrite this block with AI"
            }
          >
            ✏️
          </button>
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

      {/* Rewrite pop‑over anchored to the menu */}
      {showRewriteInput && (
        <FloatingWrapper
          referenceEl={menuRefs.floating?.current ?? element}
          placement="left-start"
          className="rewrite-input-area"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <input
            type="text"
            className="rewrite-input"
            placeholder="How should I rewrite this? (optional)"
            value={rewriteInstructions}
            onChange={(e) => setRewriteInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRewriteSubmit();
              } else if (e.key === "Escape") {
                setShowRewriteInput(false);
                setRewriteInstructions("");
              }
            }}
            autoFocus
          />
          <button
            className="rewrite-submit-btn"
            onClick={handleRewriteSubmit}
            disabled={isAIGenerating}
          >
            Rewrite
          </button>
        </FloatingWrapper>
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
  const activePromptTemplateId = useStore(
    (state) => state.activePromptTemplateId
  );

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

      // Ignore if we hover over existing controls
      if (target.closest(".block-controls")) return;

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

  const handleAIGenerate = () => {
    if (!canGenerate || !selectedElementKey) return;

    editor.getEditorState().read(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        const nodeText = node.getTextContent();
        generate(activePromptTemplateId, "", {
          customText: nodeText,
          action: "generate" as AIActionType,
          targetNodeKey: selectedElementKey,
        });
      }
    });
    setHoveredElement(null);
  };

  const handleRewrite = (instructions: string) => {
    if (!canGenerate || !selectedElementKey) return;

    editor.getEditorState().read(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        const nodeText = node.getTextContent();
        generate(activePromptTemplateId, instructions, {
          customText: nodeText,
          action: "rewrite" as AIActionType,
          targetNodeKey: selectedElementKey,
        });
      }
    });
    setHoveredElement(null);
  };

  const handleConvertMarkdown = () => {
    if (!selectedElementKey) return;

    editor.update(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        const markdownText = node.getTextContent();

        try {
          if ($isElementNode(node)) {
            // Create a new container paragraph node to hold the converted markdown
            const containerNode = $createParagraphNode();

            // Insert the container node right after the target node
            node.insertAfter(containerNode);

            // Convert markdown to structured blocks using the new container
            $convertFromMarkdownString(
              markdownText,
              TRANSFORMERS,
              containerNode,
              false,
              false
            );

            // Remove the original node (source of markdown)
            node.remove();

            // Remove the empty container node if it exists
            if (containerNode.getChildrenSize() === 0) {
              containerNode.remove();
            }

            // Clean up any empty nodes that might be created during conversion
            const root = $getRoot();
            root.getChildren().forEach((child) => {
              if (
                $isElementNode(child) &&
                child.getTextContent().trim() === ""
              ) {
                child.remove();
              }
            });
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
      onRewrite={handleRewrite}
      onConvertMarkdown={handleConvertMarkdown}
      onMouseEnter={handleControlsMouseEnter}
      onMouseLeave={handleControlsMouseLeave}
      isDeletionDisabled={isDeletionDisabled}
      isAIGenerating={isGenerating}
    />
  );
}
