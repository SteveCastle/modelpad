import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState, useCallback } from "react";
import {
  $getSelection,
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $getRoot,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { useAIGeneration, AIActionType } from "../hooks/useAIGeneration";
import "./BlockHoverPlugin.css";

interface BlockControlsProps {
  element: HTMLElement;
  onDelete: () => void;
  onAIGenerate: () => void;
  onRewrite: (instructions: string) => void;
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
  onMouseEnter,
  onMouseLeave,
  isDeletionDisabled,
  isAIGenerating,
}: BlockControlsProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showRewriteInput, setShowRewriteInput] = useState(false);
  const [rewriteInstructions, setRewriteInstructions] = useState("");

  useEffect(() => {
    const updatePosition = () => {
      const rect = element.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.right + 10,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [element]);

  const handleRewriteSubmit = () => {
    onRewrite(rewriteInstructions);
    setRewriteInstructions("");
    setShowRewriteInput(false);
  };

  return (
    <div
      className="block-controls"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
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
          className="block-control-btn delete-btn"
          onClick={onDelete}
          disabled={isDeletionDisabled}
          title={
            isDeletionDisabled ? "Cannot delete the last block" : "Delete block"
          }
        >
          🗑️
        </button>
      </div>

      {showRewriteInput && (
        <div className="rewrite-input-area">
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
        </div>
      )}
    </div>
  );
}

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
      }, 100); // Small delay to allow mouse movement to controls
    };

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Clear any pending hide timeout
      clearHideTimeout();

      // Find the closest block element
      const blockElement = target.closest(
        ".editor-paragraph, .editor-heading-h1, .editor-heading-h2, .editor-heading-h3, .editor-heading-h4, .editor-heading-h5, .editor-heading-h6, .editor-blockquote, .editor-list-ol, .editor-list-ul, .codeHighlight"
      ) as HTMLElement;

      if (blockElement && blockElement !== hoveredElement) {
        setHoveredElement(blockElement);

        // Find the corresponding lexical node key and set it
        editor.getEditorState().read(() => {
          const root = editor.getEditorState()._nodeMap;
          for (const [key] of root) {
            const dom = editor.getElementByKey(key);
            if (dom === blockElement) {
              setSelectedElementKey(key);
              break;
            }
          }
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
  }, [editor, hoveredElement, isControlsHovered, updateBlockType]);

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

  const deleteBlock = () => {
    editor.update(() => {
      if (selectedElementKey !== null) {
        const node = $getNodeByKey(selectedElementKey);
        if (node) {
          node.remove();
        }
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
        // Use the node's content as the prompt for AI generation
        generate("newScene", "", {
          customText: nodeText,
          action: "generate" as AIActionType,
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
        // Use the rewrite action to replace the current node
        generate("rewrite", instructions, {
          customText: nodeText,
          action: "rewrite" as AIActionType,
          targetNodeKey: selectedElementKey,
        });
      }
    });
    setHoveredElement(null);
  };

  const handleControlsMouseEnter = () => {
    setIsControlsHovered(true);
  };

  const handleControlsMouseLeave = () => {
    setIsControlsHovered(false);
  };

  if (!hoveredElement) {
    return null;
  }

  return (
    <BlockControls
      element={hoveredElement}
      onDelete={deleteBlock}
      onAIGenerate={handleAIGenerate}
      onRewrite={handleRewrite}
      onMouseEnter={handleControlsMouseEnter}
      onMouseLeave={handleControlsMouseLeave}
      isDeletionDisabled={isDeletionDisabled}
      isAIGenerating={isGenerating}
    />
  );
}
