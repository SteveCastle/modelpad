import { useQuery, useMutation, useQueryClient } from "react-query";
import { Note, useStore } from "../store";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  EllipsisVerticalIcon,
  XMarkIcon,
  ShareIcon,
  EyeSlashIcon,
  ClipboardIcon,
  CheckIcon,
  PlusCircleIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Bars3Icon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useDebouncedCallback } from "use-debounce";

import "./Notes.css";
import { useState } from "react";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { LoadingSpinner } from "./LoadingSpinner";

type NoteReponse = {
  notes: Note[];
};

type TreeNote = Note & {
  children: TreeNote[];
  level: number;
  isExpanded?: boolean;
};

// Utility functions for tree structure
function buildNoteTree(notes: Note[]): TreeNote[] {
  const noteMap = new Map<string, TreeNote>();
  const rootNotes: TreeNote[] = [];

  // First pass: create TreeNote objects
  notes.forEach((note) => {
    noteMap.set(note.id, {
      ...note,
      children: [],
      level: 0,
      isExpanded: true,
    });
  });

  // Second pass: build parent-child relationships
  notes.forEach((note) => {
    const treeNote = noteMap.get(note.id)!;

    if (note.parent && noteMap.has(note.parent)) {
      const parent = noteMap.get(note.parent)!;
      parent.children.push(treeNote);
      treeNote.level = parent.level + 1;
    } else {
      rootNotes.push(treeNote);
    }
  });

  return rootNotes;
}

function flattenTree(treeNotes: TreeNote[]): TreeNote[] {
  const result: TreeNote[] = [];

  function traverse(nodes: TreeNote[]) {
    nodes.forEach((node) => {
      result.push(node);
      if (node.isExpanded && node.children.length > 0) {
        traverse(node.children);
      }
    });
  }

  traverse(treeNotes);
  return result;
}

function canDropNote(draggedNote: TreeNote, targetNote: TreeNote): boolean {
  // Prevent dropping a note onto itself or its descendants
  function isDescendant(node: TreeNote, ancestorId: string): boolean {
    if (node.id === ancestorId) return true;
    return node.children.some((child) => isDescendant(child, ancestorId));
  }

  return !isDescendant(targetNote, draggedNote.id);
}

async function getStories({ queryKey }): Promise<NoteReponse> {
  const searchQuery = queryKey[1].searchQuery;
  const response = await fetch(
    `${
      import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
    }/api/notes?search=${searchQuery}`
  );
  return response.json();
}

async function deleteStory(id: string) {
  await fetch(
    `${
      import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
    }/api/notes/${id}`,
    {
      method: "DELETE",
    }
  );
}

async function shareNote(id: string, isShared: boolean) {
  const response = await fetch(
    `${
      import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
    }/api/notes/${id}/share`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_shared: isShared }),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update share status");
  }
  return response.json();
}

async function updateNoteParent(id: string, parentId: string | null) {
  const response = await fetch(
    `${
      import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
    }/api/notes/${id}/parent`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent: parentId }),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update note parent");
  }
  return response.json();
}

const Notes = () => {
  const [searchText, setSearchText] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [initializedExpansion, setInitializedExpansion] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedCallback(() => {
    setSearchQuery(searchText);
  }, 300);
  const { data } = useQuery({
    queryKey: ["stories", { searchQuery }],
    queryFn: getStories,
    refetchOnWindowFocus: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { mutate: updateParentMutation } = useMutation(
    ({ id, parentId }: { id: string; parentId: string | null }) =>
      updateNoteParent(id, parentId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("stories");
      },
    }
  );

  const toggleExpanded = (noteId: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeNote = displayNotes.find((note) => note.id === active.id);
    const overNote = displayNotes.find((note) => note.id === over.id);

    if (!activeNote || !overNote) {
      return;
    }

    // Check if the drop is valid
    if (!canDropNote(activeNote, overNote)) {
      return;
    }

    // Update parent relationship
    updateParentMutation({
      id: activeNote.id,
      parentId: overNote.id,
    });
  }

  // Build tree structure and flatten for display
  const displayNotes = data?.notes
    ? (() => {
        const treeNotes = buildNoteTree(data.notes);

        // Initialize expanded state for all parent notes on first load
        if (!initializedExpansion && treeNotes.length > 0) {
          const allParentIds = new Set<string>();
          const collectParentIds = (nodes: TreeNote[]) => {
            nodes.forEach((node) => {
              if (node.children.length > 0) {
                allParentIds.add(node.id);
                collectParentIds(node.children);
              }
            });
          };
          collectParentIds(treeNotes);
          setExpandedNotes(allParentIds);
          setInitializedExpansion(true);
        }

        // Update expanded state for tree notes
        const updateExpandedState = (notes: TreeNote[]): TreeNote[] => {
          return notes.map((note) => ({
            ...note,
            isExpanded: expandedNotes.has(note.id),
            children: updateExpandedState(note.children),
          }));
        };

        const expandedTreeNotes = updateExpandedState(treeNotes);
        return flattenTree(expandedTreeNotes);
      })()
    : [];

  const EmptyState = () => {
    const hasSearchQuery = searchQuery.trim().length > 0;

    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <DocumentTextIcon className="empty-state-icon" />
          <h3 className="empty-state-title">
            {hasSearchQuery ? "No notes found" : "No notes yet"}
          </h3>
          <p className="empty-state-description">
            {hasSearchQuery
              ? `No notes match "${searchQuery}". Try adjusting your search terms.`
              : "Create your first note to get started with organizing your thoughts and ideas."}
          </p>
          {hasSearchQuery && (
            <button
              className="empty-state-button"
              onClick={() => {
                setSearchText("");
                setSearchQuery("");
              }}
            >
              Clear search
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="Notes">
      <div className="notes-header">
        <div className="search-input">
          <input
            type="text"
            placeholder="Search notes"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              debouncedSearch();
            }}
          />
          <button
            className="clear-btn"
            onClick={() => {
              setSearchText("");
              setSearchQuery("");
            }}
          >
            <XMarkIcon />
          </button>
        </div>
      </div>
      {data ? (
        displayNotes.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayNotes.map((note) => note.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="note-list">
                {displayNotes.map((note) => (
                  <TreeNoteItem
                    key={note.id}
                    note={note}
                    onToggleExpanded={toggleExpanded}
                    isDragging={activeId === note.id}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="loading-container">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};

const TreeNoteItem = ({
  note,
  onToggleExpanded,
  isDragging,
}: {
  note: TreeNote;
  onToggleExpanded: (id: string) => void;
  isDragging: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { mutate } = useMutation(deleteStory, {
    onSuccess: () => {
      queryClient.invalidateQueries("stories");
    },
  });

  const { mutate: shareNoteMutation } = useMutation(
    ({ id, isShared }: { id: string; isShared: boolean }) =>
      shareNote(id, isShared),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("stories");
      },
    }
  );

  const shareUrl = `${window.location.origin}/doc/${note.id}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  };

  const handleShareToggle = () => {
    shareNoteMutation({ id: note.id, isShared: !note.is_shared });
  };

  const openSharedUrl = () => {
    window.open(shareUrl, "_blank");
  };
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "right",
    middleware: [offset(10), shift()],
  });
  const click = useClick(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click]);

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  const { mergeNotes, updateSyncState, setSideBarOpen } = useStore(
    (state) => state
  );
  return (
    <li
      ref={setNodeRef}
      className={`note-item ${isDragging ? "dragging" : ""}`}
      style={{
        paddingLeft: `${note.level * 20 + 10}px`,
        ...style,
      }}
    >
      <div className="note-item-wrapper">
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorganize"
        >
          <Bars3Icon className="drag-icon" />
        </button>
        <div
          className="note-item-content"
          onClick={() => {
            mergeNotes([note], true);
            //If window width is less than 768 pixels also collapse the menu
            if (window.innerWidth < 768) {
              setSideBarOpen(false);
            }
          }}
        >
          <div className="note-title-container">
            {note.children.length > 0 && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpanded(note.id);
                }}
              >
                {note.isExpanded ? (
                  <ChevronDownIcon className="expand-icon" />
                ) : (
                  <ChevronRightIcon className="expand-icon" />
                )}
              </button>
            )}
            <div className="note-title">{note.title}</div>
          </div>
          <div className="note-date">{prettyDate(note.updated_at)}</div>
        </div>
        <div className="note-actions-container">
          <button
            className="note-action-btn"
            {...getReferenceProps({
              onClick: (e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              },
            })}
            ref={refs.setReference}
          >
            <EllipsisVerticalIcon />
          </button>
          {isOpen && (
            <div
              className="note-actions"
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <button
                className="note-action"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  mergeNotes([{ ...note, includeInContext: true }], false);
                  setIsOpen(false);
                }}
              >
                <PlusCircleIcon className="action-icon" />
                Add To Context
              </button>
              <button
                className="note-action"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShareToggle();
                  // Don't close the popover after sharing so user can copy/navigate
                }}
              >
                {note.is_shared ? (
                  <>
                    <EyeSlashIcon className="action-icon" />
                    Unshare
                  </>
                ) : (
                  <>
                    <ShareIcon className="action-icon" />
                    Share
                  </>
                )}
              </button>
              {note.is_shared && (
                <>
                  <button
                    className="note-action share-control"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyUrl();
                    }}
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="action-icon" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="action-icon" />
                        Copy Link
                      </>
                    )}
                  </button>
                  <button
                    className="note-action share-control"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openSharedUrl();
                      setIsOpen(false);
                    }}
                  >
                    <ArrowTopRightOnSquareIcon className="action-icon" />
                    Open Link
                  </button>
                </>
              )}
              <button
                className="note-action delete"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateSyncState(note.id, false);
                  mutate(note.id);
                  setIsOpen(false);
                }}
              >
                <TrashIcon className="action-icon" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

// Pretty date formatter returns the number of minutes, hours, days, weeks, months, or years ago provided a date

function prettyDate(date: string): string {
  const diff = new Date().getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(weeks / 4);
  const years = Math.floor(months / 12);

  if (years > 0) {
    return `${years} years ago`;
  } else if (months > 0) {
    return `${months} months ago`;
  } else if (weeks > 0) {
    return `${weeks} weeks ago`;
  } else if (days > 0) {
    return `${days} days ago`;
  } else if (hours > 0) {
    return `${hours} hours ago`;
  } else if (minutes > 0) {
    return `${minutes} minutes ago`;
  } else {
    return `Less than a minute ago`;
  }
}

export default Notes;
