import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState, useCallback } from "react";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
  $isElementNode,
  ElementNode,
  $getRoot,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
} from "@lexical/rich-text";
import { $createCodeNode } from "@lexical/code";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import "./BlockHoverPlugin.css";

const BLOCK_TYPES = [
  { key: "paragraph", label: "Paragraph" },
  { key: "h1", label: "Heading 1" },
  { key: "h2", label: "Heading 2" },
  { key: "h3", label: "Heading 3" },
  { key: "h4", label: "Heading 4" },
  { key: "h5", label: "Heading 5" },
  { key: "h6", label: "Heading 6" },
  { key: "quote", label: "Quote" },
  { key: "code", label: "Code Block" },
  { key: "ul", label: "Bullet List" },
  { key: "ol", label: "Numbered List" },
];

const BLOCK_TYPE_TO_NAME = {
  paragraph: "Paragraph",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  quote: "Quote",
  code: "Code Block",
  ul: "Bullet List",
  ol: "Numbered List",
};

interface BlockControlsProps {
  element: HTMLElement;
  onDelete: () => void;
  onChangeType: (newType: string) => void;
  currentType: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isDeletionDisabled: boolean;
}

function BlockControls({
  element,
  onDelete,
  onChangeType,
  currentType,
  onMouseEnter,
  onMouseLeave,
  isDeletionDisabled,
}: BlockControlsProps) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
          className="block-control-btn"
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          title={`Change block type (currently: ${
            BLOCK_TYPE_TO_NAME[currentType] || currentType
          })`}
        >
          ⚡
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

      {showTypeMenu && (
        <div className="block-type-menu">
          <div className="current-type">
            Current: {BLOCK_TYPE_TO_NAME[currentType] || currentType}
          </div>
          {BLOCK_TYPES.filter((type) => type.key !== currentType).map(
            (type) => (
              <button
                key={type.key}
                className="block-type-option"
                onClick={() => {
                  onChangeType(type.key);
                  setShowTypeMenu(false);
                }}
              >
                {type.label}
              </button>
            )
          )}
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
  const [currentBlockType, setCurrentBlockType] = useState<string>("");
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(
    null
  );
  const [isControlsHovered, setIsControlsHovered] = useState(false);
  const [isDeletionDisabled, setIsDeletionDisabled] = useState(false);

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
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          const type = parentList ? parentList.getTag() : element.getTag();
          setCurrentBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          setCurrentBlockType(type);
        }
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
          for (const [key, node] of root) {
            const dom = editor.getElementByKey(key);
            if (dom === blockElement) {
              setSelectedElementKey(key);

              // Set block type based on node
              if ($isListNode(node)) {
                const type = node.getTag();
                setCurrentBlockType(type);
              } else {
                const type = $isHeadingNode(node)
                  ? node.getTag()
                  : node.getType();
                setCurrentBlockType(type);
              }
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

  const changeBlockType = (newType: string) => {
    if (newType === currentBlockType || !selectedElementKey) return;

    editor.update(() => {
      const node = $getNodeByKey(selectedElementKey);
      if (!node) return;

      let newNode;
      switch (newType) {
        case "paragraph": {
          newNode = $createParagraphNode();
          break;
        }
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          newNode = $createHeadingNode(newType);
          break;
        }
        case "quote": {
          newNode = $createQuoteNode();
          break;
        }
        case "code": {
          newNode = $createCodeNode();
          break;
        }
        case "ul": {
          // For lists, we use commands instead of direct node replacement
          if (currentBlockType !== "ul") {
            // Select the node and apply list command
            node.selectEnd();
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          }
          setHoveredElement(null);
          return;
        }
        case "ol": {
          // For lists, we use commands instead of direct node replacement
          if (currentBlockType !== "ol") {
            // Select the node and apply list command
            node.selectEnd();
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          }
          setHoveredElement(null);
          return;
        }
      }

      if (newNode && node.isAttached()) {
        // Copy children from old node to new node if it's an element node
        if ($isElementNode(node)) {
          const elementNode = node as ElementNode;
          const children = elementNode.getChildren();
          children.forEach((child) => {
            newNode.append(child);
          });
        }

        // Replace the node
        node.replace(newNode);
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
      onChangeType={changeBlockType}
      currentType={currentBlockType}
      onMouseEnter={handleControlsMouseEnter}
      onMouseLeave={handleControlsMouseLeave}
      isDeletionDisabled={isDeletionDisabled}
    />
  );
}
