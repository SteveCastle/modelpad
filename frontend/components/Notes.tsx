import { useQuery, useMutation, useQueryClient } from "react-query";
import { Note, useStore } from "../store";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import {
  EllipsisVerticalIcon,
  XMarkIcon,
  ShareIcon,
  EyeSlashIcon,
  ClipboardIcon,
  CheckIcon,
  PlusCircleIcon,
  TrashIcon,
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

const Notes = () => {
  const [searchText, setSearchText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedCallback(() => {
    setSearchQuery(searchText);
  }, 300);
  const { data } = useQuery({
    queryKey: ["stories", { searchQuery }],
    queryFn: getStories,
    refetchOnWindowFocus: true,
  });

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
        <ul className="note-list">
          {data.notes?.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </ul>
      ) : (
        <div className="loading-container">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};

const NoteItem = ({ note }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

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
      className="note-item"
      onClick={() => {
        mergeNotes([note], true);
        //If window width is less than 768 pixels also collapse the menu
        if (window.innerWidth < 768) {
          setSideBarOpen(false);
        }
      }}
    >
      <div className="note-item-content">
        <div className="note-title">{note.title}</div>
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
