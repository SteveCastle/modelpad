import {
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $getRoot,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { mergeRegister } from "@lexical/utils";
import { useAIGeneration, AIActionType } from "../hooks/useAIGeneration";
import { $isPromptNode } from "./PromptNode";
import { $isAIGenerationNode } from "./AIGenerationNode";
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
import "./PromptNode.css";

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
 * PromptControls (unchanged)
 ************************************************************/
interface PromptControlsProps {
  element: HTMLElement;
  status: "pending" | "generating" | "completed" | "cancelled";
  onCancel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDeletionDisabled: boolean;
}

function PromptControls({
  element,
  status,
  onCancel,
  onUndo,
  onRedo,
  onDelete,
  onMouseEnter,
  onMouseLeave,
  canUndo,
  canRedo,
  isDeletionDisabled,
}: PromptControlsProps) {
  return (
    <FloatingWrapper
      referenceEl={element}
      className="block-controls"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="block-controls-buttons">
        {status === "generating" && (
          <button
            className="block-control-btn prompt-control-cancel"
            onClick={onCancel}
            title="Cancel generation"
          >
            ❌
          </button>
        )}
        {(status === "completed" || status === "cancelled") && (
          <>
            <button
              className="block-control-btn prompt-control-undo"
              onClick={onUndo}
              disabled={!canUndo}
              title={
                status === "cancelled"
                  ? "Restore original content"
                  : "Undo generation"
              }
            >
              ↶
            </button>
            <button
              className="block-control-btn prompt-control-redo"
              onClick={onRedo}
              disabled={!canRedo}
              title={
                status === "cancelled" ? "Retry generation" : "Redo generation"
              }
            >
              {status === "cancelled" ? "🔄" : "↷"}
            </button>
          </>
        )}
        <button
          className="block-control-btn prompt-control-delete"
          onClick={onDelete}
          disabled={isDeletionDisabled}
          title={
            isDeletionDisabled ? "Cannot delete the last block" : "Delete block"
          }
        >
          🗑️
        </button>
      </div>
    </FloatingWrapper>
  );
}

/************************************************************
 * AIGenerationControls (unchanged)
 ************************************************************/
interface AIGenerationControlsProps {
  element: HTMLElement;
  onConvert: () => void;
  onDelete: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isDeletionDisabled: boolean;
}

function AIGenerationControls({
  element,
  onConvert,
  onDelete,
  onMouseEnter,
  onMouseLeave,
  isDeletionDisabled,
}: AIGenerationControlsProps) {
  return (
    <FloatingWrapper
      referenceEl={element}
      className="block-controls"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="block-controls-buttons">
        <button
          className="block-control-btn ai-generation-accept"
          onClick={onConvert}
          title="Accept"
        >
          ✅
        </button>
        <button
          className="block-control-btn ai-generation-reject"
          onClick={onDelete}
          disabled={isDeletionDisabled}
          title="Reject"
        >
          ❌
        </button>
      </div>
    </FloatingWrapper>
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
  const [promptNodeInfo, setPromptNodeInfo] = useState<{
    promptId: string;
    status: "pending" | "generating" | "completed" | "cancelled";
    canUndo: boolean;
    canRedo: boolean;
  } | null>(null);
  const [aiGenerationNodeInfo, setAIGenerationNodeInfo] = useState<{
    nodeKey: string;
  } | null>(null);

  const {
    generate,
    cancelGeneration,
    undoGeneration,
    redoGeneration,
    isGenerating,
    canGenerate,
  } = useAIGeneration();
  const { getPromptGeneration } = useStore((state) => state);

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

        // Reset states
        setPromptNodeInfo(null);
        setAIGenerationNodeInfo(null);

        // Check if this element contains a PromptNode or AIGenerationNode
        let foundPromptNode: any = null;
        let foundAIGenerationNode: any = null;

        if ($isElementNode(element)) {
          const children = element.getChildren();
          for (const child of children) {
            if ($isPromptNode(child)) {
              foundPromptNode = child;
              break;
            } else if ($isAIGenerationNode(child)) {
              foundAIGenerationNode = child;
              break;
            }
          }
        }

        if (foundPromptNode) {
          const generation = getPromptGeneration(foundPromptNode.getPromptId());
          if (generation) {
            setPromptNodeInfo({
              promptId: foundPromptNode.getPromptId(),
              status: generation.status,
              canUndo: generation.canUndo,
              canRedo: generation.canRedo,
            });
          } else {
            setPromptNodeInfo({
              promptId: foundPromptNode.getPromptId(),
              status: foundPromptNode.getStatus(),
              canUndo: false,
              canRedo: false,
            });
          }
        } else if (foundAIGenerationNode) {
          setAIGenerationNodeInfo({
            nodeKey: foundAIGenerationNode.getKey(),
          });
        }
      }
    }

    // Check if deletion should be disabled (only one top-level node)
    const root = $getRoot();
    const topLevelNodeCount = root.getChildrenSize();
    setIsDeletionDisabled(topLevelNodeCount <= 1);
  }, [editor, getPromptGeneration]);

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
          setPromptNodeInfo(null);
          setAIGenerationNodeInfo(null);
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
          let newPromptNodeInfo = null;
          let newAIGenerationNodeInfo = null;
          let newSelectedElementKey = null as string | null;

          for (const [key] of root) {
            const dom = editor.getElementByKey(key);
            if (dom === blockElement) {
              newSelectedElementKey = key;

              const node = editor.getEditorState()._nodeMap.get(key);
              let foundPromptNode: any = null;
              let foundAIGenerationNode: any = null;

              if (node && $isElementNode(node)) {
                const children = node.getChildren();
                for (const child of children) {
                  if ($isPromptNode(child)) {
                    foundPromptNode = child;
                    break;
                  } else if ($isAIGenerationNode(child)) {
                    foundAIGenerationNode = child;
                    break;
                  }
                }
              }

              if (foundPromptNode) {
                const generation = getPromptGeneration(
                  foundPromptNode.getPromptId()
                );
                if (generation) {
                  newPromptNodeInfo = {
                    promptId: foundPromptNode.getPromptId(),
                    status: generation.status,
                    canUndo: generation.canUndo,
                    canRedo: generation.canRedo,
                  };
                } else {
                  newPromptNodeInfo = {
                    promptId: foundPromptNode.getPromptId(),
                    status: foundPromptNode.getStatus(),
                    canUndo: false,
                    canRedo: false,
                  };
                }
                newAIGenerationNodeInfo = null;
              } else if (foundAIGenerationNode) {
                newAIGenerationNodeInfo = {
                  nodeKey: foundAIGenerationNode.getKey(),
                };
                newPromptNodeInfo = null;
              }
              break;
            }
          }

          setSelectedElementKey(newSelectedElementKey);
          setPromptNodeInfo(newPromptNodeInfo);
          setAIGenerationNodeInfo(newAIGenerationNodeInfo);
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
  }, [editor, hoveredElement, isControlsHovered, getPromptGeneration]);

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
    setPromptNodeInfo(null);
  };

  const handleAIGenerate = () => {
    if (!canGenerate || !selectedElementKey) return;

    editor.getEditorState().read(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (node) {
        const nodeText = node.getTextContent();
        generate("newScene", "", {
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
        generate("rewrite", instructions, {
          customText: nodeText,
          action: "rewrite" as AIActionType,
          targetNodeKey: selectedElementKey,
        });
      }
    });
    setHoveredElement(null);
  };

  /*******************************************************/
  /*  Prompt Node actions                                 */
  /*******************************************************/
  const handlePromptCancel = () => {
    if (promptNodeInfo) cancelGeneration(promptNodeInfo.promptId);
  };
  const handlePromptUndo = () => {
    if (promptNodeInfo) undoGeneration(promptNodeInfo.promptId);
  };
  const handlePromptRedo = () => {
    if (promptNodeInfo) redoGeneration(promptNodeInfo.promptId);
  };

  /*******************************************************/
  /*  AI Generation Node actions                         */
  /*******************************************************/
  const handleAIGenerationConvert = () => {
    if (!aiGenerationNodeInfo) return;

    editor.update(() => {
      const aiNode = $getNodeByKey(aiGenerationNodeInfo.nodeKey);
      if ($isAIGenerationNode(aiNode)) {
        const markdownText = aiNode.getTextContent();

        try {
          const parentElement = aiNode.getParent();
          if ($isElementNode(parentElement)) {
            // Log the index of the parent element in the root
            const root = $getRoot();
            const parentIndex = root.getChildren().indexOf(parentElement);
            console.log("parentIndex", parentIndex);
            // Nodes before the index
            const beforeNodes = root.getChildren().slice(0, parentIndex);
            // Nodes after the index
            const afterNodes = root.getChildren().slice(parentIndex + 1);

            aiNode.remove();

            $convertFromMarkdownString(
              markdownText,
              TRANSFORMERS,
              root,
              false,
              false
            );
            root.getChildren().forEach((node) => {
              if (node.getTextContent() === "") node.remove();
            });

            const firstNode = root.getFirstChild();
            const lastNode = root.getLastChild();

            beforeNodes.forEach((node) => firstNode.insertBefore(node));
            afterNodes.reverse().forEach((node) => lastNode.insertAfter(node));
          }
        } catch (error) {
          console.error("Error converting markdown:", error);
        }
      }
    });

    setHoveredElement(null);
    setAIGenerationNodeInfo(null);
  };

  const handleAIGenerationDelete = () => deleteBlock();

  /*******************************************************/
  /*  Hover state management for floating controls       */
  /*******************************************************/
  const handleControlsMouseEnter = () => setIsControlsHovered(true);
  const handleControlsMouseLeave = () => setIsControlsHovered(false);

  /*******************************************************/
  /*  Render                                             */
  /*******************************************************/
  if (!hoveredElement) return null;

  if (promptNodeInfo) {
    return (
      <PromptControls
        element={hoveredElement}
        status={promptNodeInfo.status}
        onCancel={handlePromptCancel}
        onUndo={handlePromptUndo}
        onRedo={handlePromptRedo}
        onDelete={deleteBlock}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={handleControlsMouseLeave}
        canUndo={promptNodeInfo.canUndo}
        canRedo={promptNodeInfo.canRedo}
        isDeletionDisabled={isDeletionDisabled}
      />
    );
  }

  if (aiGenerationNodeInfo) {
    return (
      <AIGenerationControls
        element={hoveredElement}
        onConvert={handleAIGenerationConvert}
        onDelete={handleAIGenerationDelete}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={handleControlsMouseLeave}
        isDeletionDisabled={isDeletionDisabled}
      />
    );
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
