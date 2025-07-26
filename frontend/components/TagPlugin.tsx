import { useEffect, useCallback, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  TextNode,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { $createTagNode, $isTagNode, TagNode } from "./TagNode";
import { useStore, Tag } from "../store";
import "./TagNode.css";

interface TagTypeaheadProps {
  query: string;
  position: { x: number; y: number } | null;
  onSelect: (tag: Tag | null) => void;
  onClose: () => void;
}

interface TagEditDropdownProps {
  tagNode: TagNode;
  position: { x: number; y: number } | null;
  onReplace: (newTag: Tag) => void;
  onDelete: () => void;
  onClose: () => void;
}

function TagTypeahead({
  query,
  position,
  onSelect,
  onClose,
}: TagTypeaheadProps) {
  const { searchTagsByPath, addHierarchicalTag } = useStore((state) => state);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filtered = searchTagsByPath(query);
    setFilteredTags(filtered);

    // Show "create new" option if query doesn't exactly match any existing tag
    const exactMatch = filtered.some(
      (tag) => tag.name.toLowerCase() === query.toLowerCase()
    );
    setShowCreateNew(query.trim().length > 0 && !exactMatch);
    setSelectedIndex(0);
  }, [query, searchTagsByPath]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!position) return;

      const totalOptions = filteredTags.length + (showCreateNew ? 1 : 0);

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalOptions);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
          break;
        case "Enter":
        case "Tab":
          event.preventDefault();
          handleSelect();
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredTags, showCreateNew, selectedIndex, position, query]);

  const handleSelect = () => {
    if (selectedIndex < filteredTags.length) {
      // Select existing tag
      onSelect(filteredTags[selectedIndex]);
    } else if (showCreateNew) {
      // Create new hierarchical tag
      const newTag = addHierarchicalTag(query.trim());
      onSelect(newTag);
    } else {
      onClose();
    }
  };

  const handleMouseSelect = (tag: Tag | null) => {
    onSelect(tag);
  };

  if (!position || (!filteredTags.length && !showCreateNew)) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="tag-typeahead-dropdown"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {filteredTags.map((tag, index) => (
        <div
          key={tag.id}
          className={`tag-typeahead-item ${
            index === selectedIndex ? "selected" : ""
          }`}
          onClick={() => handleMouseSelect(tag)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span
            className={`tag-preview category-${
              tag.path && tag.path.length > 0 ? tag.path[0] : "other"
            }`}
          >
            <span className="tag-path">
              {tag.path && tag.path.length > 1 ? (
                <>
                  <span className="tag-path-parents">
                    {tag.path.slice(0, -1).join("/")}/
                  </span>
                  <span className="tag-path-final">
                    {tag.path[tag.path.length - 1]}
                  </span>
                </>
              ) : (
                <span className="tag-path-final">
                  {tag.path && tag.path.length > 0 ? tag.path[0] : tag.name}
                </span>
              )}
            </span>
          </span>
          {tag.usageCount > 0 && (
            <span className="tag-usage-count">
              {tag.usageCount} use{tag.usageCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      ))}
      {showCreateNew && (
        <div
          className={`tag-typeahead-item create-new ${
            selectedIndex === filteredTags.length ? "selected" : ""
          }`}
          onClick={() => handleMouseSelect(null)}
          onMouseEnter={() => setSelectedIndex(filteredTags.length)}
        >
          <span className="tag-preview">Create "{query.trim()}"</span>
        </div>
      )}
    </div>
  );
}

function TagEditDropdown({
  tagNode,
  position,
  onReplace,
  onDelete,
  onClose,
}: TagEditDropdownProps) {
  const { searchTagsByPath, addHierarchicalTag } = useStore((state) => state);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when dropdown opens
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const allTags = useStore.getState().tags;
    const currentTagId = tagNode.getTagId();

    // Filter out the current tag and search by query
    const filtered = searchQuery
      ? searchTagsByPath(searchQuery).filter((tag) => tag.id !== currentTagId)
      : allTags.filter((tag) => tag.id !== currentTagId);

    setFilteredTags(filtered);

    // Show "create new" option if query doesn't exactly match any existing tag
    const exactMatch = filtered.some(
      (tag) => tag.name.toLowerCase() === searchQuery.toLowerCase()
    );
    setShowCreateNew(searchQuery.trim().length > 0 && !exactMatch);
    setSelectedIndex(0);
  }, [searchQuery, searchTagsByPath, tagNode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!position) return;

      const totalOptions = filteredTags.length + (showCreateNew ? 1 : 0);

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalOptions);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
          break;
        case "Enter":
          event.preventDefault();
          handleSelect();
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "Backspace":
          if (searchQuery === "") {
            event.preventDefault();
            onDelete();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredTags,
    showCreateNew,
    selectedIndex,
    position,
    searchQuery,
    onDelete,
    onClose,
  ]);

  const handleSelect = () => {
    if (selectedIndex < filteredTags.length) {
      // Replace with existing tag
      onReplace(filteredTags[selectedIndex]);
    } else if (showCreateNew) {
      // Create new tag and replace
      const newTag = addHierarchicalTag(searchQuery.trim());
      onReplace(newTag);
    }
  };

  const handleMouseSelect = (tag: Tag) => {
    onReplace(tag);
  };

  if (!position) {
    return null;
  }

  const currentTagName = tagNode.getTagName();
  const currentTagPath = tagNode.getTagPath();
  const currentCategory = tagNode.getCategory();

  return (
    <div
      ref={dropdownRef}
      className="tag-edit-dropdown"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="tag-edit-content">
        <div className="tag-edit-header">
          <span
            className={`tag-info-preview category-${
              currentCategory || "other"
            }`}
          >
            {currentTagPath.length > 1 ? (
              <>
                <span className="tag-path-parents">
                  {currentTagPath.slice(0, -1).join("/")}/
                </span>
                <span className="tag-path-final">
                  {currentTagPath[currentTagPath.length - 1]}
                </span>
              </>
            ) : (
              <span className="tag-path-final">
                {currentTagPath[0] || currentTagName}
              </span>
            )}
          </span>
          <span className="tag-edit-title">Change Tag</span>
        </div>

        <div className="tag-edit-search">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or create new tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tag-edit-input"
          />
        </div>

        <div className="tag-edit-list">
          {filteredTags.map((tag, index) => (
            <div
              key={tag.id}
              className={`tag-edit-item ${
                index === selectedIndex ? "selected" : ""
              }`}
              onClick={() => handleMouseSelect(tag)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span
                className={`tag-preview category-${
                  tag.path && tag.path.length > 0 ? tag.path[0] : "other"
                }`}
              >
                <span className="tag-path">
                  {tag.path && tag.path.length > 1 ? (
                    <>
                      <span className="tag-path-parents">
                        {tag.path.slice(0, -1).join("/")}/
                      </span>
                      <span className="tag-path-final">
                        {tag.path[tag.path.length - 1]}
                      </span>
                    </>
                  ) : (
                    <span className="tag-path-final">
                      {tag.path && tag.path.length > 0 ? tag.path[0] : tag.name}
                    </span>
                  )}
                </span>
              </span>
              {tag.usageCount > 0 && (
                <span className="tag-usage-count">
                  {tag.usageCount} use{tag.usageCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          ))}
          {showCreateNew && (
            <div
              className={`tag-edit-item create-new ${
                selectedIndex === filteredTags.length ? "selected" : ""
              }`}
              onClick={() => {
                const newTag = addHierarchicalTag(searchQuery.trim());
                onReplace(newTag);
              }}
              onMouseEnter={() => setSelectedIndex(filteredTags.length)}
            >
              <span className="tag-preview">Create "{searchQuery.trim()}"</span>
            </div>
          )}
        </div>

        <div className="tag-edit-actions">
          <button
            className="tag-edit-action tag-edit-delete"
            onClick={onDelete}
          >
            Delete Tag
          </button>
          <button className="tag-edit-action tag-edit-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="tag-edit-hint">
          ↑↓ navigate • ⏎ select • ⌫ delete • ⎋ cancel
        </div>
      </div>
    </div>
  );
}

export function TagPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { incrementTagUsage, addHierarchicalTag } = useStore((state) => state);
  const [isTagging, setIsTagging] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [typeaheadPosition, setTypeaheadPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [tagStartOffset, setTagStartOffset] = useState(0);
  const [tagTextNode, setTagTextNode] = useState<TextNode | null>(null);

  // New state for tag editing
  const [showTagEdit, setShowTagEdit] = useState(false);
  const [tagEditPosition, setTagEditPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedTagForEdit, setSelectedTagForEdit] = useState<TagNode | null>(
    null
  );

  const calculateTypeaheadPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
      x: rect.left,
      y: rect.bottom + window.scrollY + 4,
    };
  }, []);

  const clearTagging = useCallback(() => {
    setIsTagging(false);
    setTagQuery("");
    setTypeaheadPosition(null);
    setTagStartOffset(0);
    setTagTextNode(null);
  }, []);

  const clearTagEdit = useCallback(() => {
    setShowTagEdit(false);
    setTagEditPosition(null);
    setSelectedTagForEdit(null);
  }, []);

  const handleTagReplace = useCallback(
    (newTag: Tag) => {
      if (selectedTagForEdit) {
        editor.update(() => {
          // Create new tag node with same text but different tag properties
          const newTagNode = $createTagNode(
            `@${newTag.name}`,
            newTag.id,
            newTag.name,
            newTag.path,
            newTag.color
          );

          // Replace the old tag node
          selectedTagForEdit.insertAfter(newTagNode);
          selectedTagForEdit.remove();

          // Increment usage count for the new tag
          incrementTagUsage(newTag.id);

          // Position cursor after the new tag
          const nextSibling = newTagNode.getNextSibling();
          if (nextSibling && nextSibling instanceof TextNode) {
            nextSibling.select(0, 0);
          } else {
            const spaceNode = $createTextNode(" ");
            newTagNode.insertAfter(spaceNode);
            spaceNode.select(1, 1);
          }
        });
      }
      clearTagEdit();
    },
    [editor, selectedTagForEdit, incrementTagUsage, clearTagEdit]
  );

  const handleTagEditDelete = useCallback(() => {
    if (selectedTagForEdit) {
      editor.update(() => {
        // Position cursor properly before removing the tag
        const nextSibling = selectedTagForEdit.getNextSibling();
        const prevSibling = selectedTagForEdit.getPreviousSibling();

        // Remove the tag
        selectedTagForEdit.remove();

        // Position cursor after removal
        if (nextSibling && nextSibling instanceof TextNode) {
          nextSibling.select(0, 0);
        } else if (prevSibling && prevSibling instanceof TextNode) {
          prevSibling.selectEnd();
        }
      });
    }
    clearTagEdit();
  }, [editor, selectedTagForEdit, clearTagEdit]);

  const handleTagDelete = useCallback(() => {
    if (selectedTagForEdit) {
      editor.update(() => {
        // Position cursor properly before removing the tag
        const nextSibling = selectedTagForEdit.getNextSibling();
        const prevSibling = selectedTagForEdit.getPreviousSibling();

        // Remove the tag
        selectedTagForEdit.remove();

        // Position cursor after removal
        if (nextSibling && nextSibling instanceof TextNode) {
          nextSibling.select(0, 0);
        } else if (prevSibling && prevSibling instanceof TextNode) {
          prevSibling.selectEnd();
        }
      });
    }
  }, [editor, selectedTagForEdit]);

  const handleTagSelect = useCallback(
    (selectedTag: Tag | null) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !tagTextNode) return;

        // Create the tag text (with @ prefix)
        const tagText = selectedTag
          ? `@${selectedTag.name}`
          : `@${tagQuery.trim()}`;

        // If no tag was selected, create a new hierarchical tag
        const finalTag = selectedTag || addHierarchicalTag(tagQuery.trim());

        // Create the tag node
        const tagNode = $createTagNode(
          tagText,
          finalTag.id,
          finalTag.name,
          finalTag.path,
          finalTag.color
        );

        // Replace the @tag portion with the tag node
        const textContent = tagTextNode.getTextContent();
        const beforeTag = textContent.substring(0, tagStartOffset);
        const afterTag = textContent.substring(
          tagStartOffset + tagQuery.length + 1
        ); // +1 for @

        // Create new text content without the @tag portion
        const newTextContent = beforeTag + afterTag;

        if (newTextContent) {
          // Update existing text node and insert tag after it
          tagTextNode.setTextContent(newTextContent);
          tagTextNode.insertAfter(tagNode);
        } else {
          // Replace entire text node with tag
          tagTextNode.insertBefore(tagNode);
          tagTextNode.remove();
        }

        // Always ensure there's a text node after the tag for cursor positioning
        const nextNode = tagNode.getNextSibling();
        if (!nextNode || !(nextNode instanceof TextNode)) {
          const emptyAfterNode = $createTextNode("");
          tagNode.insertAfter(emptyAfterNode);
        }

        // Increment usage count for existing tags
        if (selectedTag) {
          incrementTagUsage(selectedTag.id);
        }

        // Move cursor to the text node after the tag
        const afterTagNode = tagNode.getNextSibling();
        if (afterTagNode && afterTagNode instanceof TextNode) {
          if (afterTag) {
            // If there was existing text, place cursor at the beginning
            afterTagNode.select(0, 0);
          } else {
            // If it's an empty node, place cursor there and add a space for better UX
            afterTagNode.setTextContent(" ");
            afterTagNode.select(1, 1);
          }
        }
      });

      clearTagging();
    },
    [
      editor,
      tagTextNode,
      tagStartOffset,
      tagQuery,
      addHierarchicalTag,
      incrementTagUsage,
      clearTagging,
    ]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isTagging) {
        // Let the typeahead handle navigation keys
        if (
          ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)
        ) {
          return false; // Don't handle in this plugin
        }
      }

      // Handle backspace for immediate tag deletion
      if (event.key === "Backspace") {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const anchorNode = selection.anchor.getNode();
          const anchorOffset = selection.anchor.offset;

          // Check if we're at the beginning of a text node and there's a tag node before it
          if (anchorNode instanceof TextNode && anchorOffset === 0) {
            const previousSibling = anchorNode.getPreviousSibling();
            if ($isTagNode(previousSibling)) {
              event.preventDefault();
              editor.update(() => {
                previousSibling.remove();
              });
              return;
            }
          }

          // Check if we're in a tag node
          if ($isTagNode(anchorNode)) {
            event.preventDefault();
            editor.update(() => {
              anchorNode.remove();
            });
            return;
          }
        });
      }

      return false;
    },
    [
      isTagging,
      selectedTagForEdit,
      editor,
      handleTagDelete,
      calculateTypeaheadPosition,
    ]
  );

  const handleSelectionChange = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        clearTagging();
        return;
      }

      const anchorNode = selection.anchor.getNode();
      if (!(anchorNode instanceof TextNode)) {
        clearTagging();
        return;
      }

      const textContent = anchorNode.getTextContent();
      const anchorOffset = selection.anchor.offset;

      // Look for @ symbol before cursor
      let atIndex = -1;
      for (let i = anchorOffset - 1; i >= 0; i--) {
        if (textContent[i] === "@") {
          atIndex = i;
          break;
        }
        // If we hit whitespace or start of line, stop looking
        if (textContent[i] === " " || textContent[i] === "\n") {
          break;
        }
      }

      if (atIndex !== -1) {
        // Check if we're in a tagging context
        const query = textContent.substring(atIndex + 1, anchorOffset);

        // Only start tagging if query doesn't contain spaces (simple tag names only)
        if (!query.includes(" ") && !query.includes("\n")) {
          setIsTagging(true);
          setTagQuery(query);
          setTagStartOffset(atIndex);
          setTagTextNode(anchorNode);

          // Calculate position for typeahead
          const position = calculateTypeaheadPosition();
          setTypeaheadPosition(position);
        } else {
          clearTagging();
        }
      } else {
        clearTagging();
      }
    });
  }, [editor, calculateTypeaheadPosition, clearTagging]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      handleKeyDown,
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleKeyDown]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        handleSelectionChange();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleSelectionChange]);

  // Handle clicks outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (isTagging && typeaheadPosition) {
        if (!target.closest(".tag-typeahead-dropdown")) {
          clearTagging();
        }
      }

      if (showTagEdit && tagEditPosition) {
        if (!target.closest(".tag-edit-dropdown")) {
          clearTagEdit();
        }
      }
    };

    // Handle tag delete events from delete buttons
    const handleTagDeleteEvent = (event: CustomEvent) => {
      const tagNode = event.detail?.tagNode;
      if (tagNode) {
        editor.update(() => {
          // Position cursor properly before removing the tag
          const nextSibling = tagNode.getNextSibling();
          const prevSibling = tagNode.getPreviousSibling();

          // Remove the tag
          tagNode.remove();

          // Position cursor after removal
          if (nextSibling && nextSibling instanceof TextNode) {
            nextSibling.select(0, 0);
          } else if (prevSibling && prevSibling instanceof TextNode) {
            prevSibling.selectEnd();
          }
        });
      }
    };

    // Handle tag edit events from clicking on tags
    const handleTagEdit = (event: CustomEvent) => {
      const tagNode = event.detail?.tagNode;
      if (tagNode) {
        // Clear other states
        clearTagging();

        // Set up tag editing
        setSelectedTagForEdit(tagNode);
        setShowTagEdit(true);
        const position = calculateTypeaheadPosition();
        setTagEditPosition(position);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener(
      "tag-delete",
      handleTagDeleteEvent as EventListener
    );
    document.addEventListener("tag-edit", handleTagEdit as EventListener);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener(
        "tag-delete",
        handleTagDeleteEvent as EventListener
      );
      document.removeEventListener("tag-edit", handleTagEdit as EventListener);
    };
  }, [
    isTagging,
    typeaheadPosition,
    clearTagging,
    editor,
    calculateTypeaheadPosition,
    clearTagEdit,
    showTagEdit,
    tagEditPosition,
  ]);

  return (
    <>
      {isTagging && (
        <TagTypeahead
          query={tagQuery}
          position={typeaheadPosition}
          onSelect={handleTagSelect}
          onClose={clearTagging}
        />
      )}
      {showTagEdit && selectedTagForEdit && (
        <TagEditDropdown
          tagNode={selectedTagForEdit}
          position={tagEditPosition}
          onReplace={handleTagReplace}
          onDelete={handleTagEditDelete}
          onClose={clearTagEdit}
        />
      )}
    </>
  );
}
