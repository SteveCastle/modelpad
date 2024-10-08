import { useQuery, useMutation, useQueryClient } from "react-query";
import { Note, useStore } from "../store";
import { offset, shift } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/react/24/solid";
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
  const queryClient = useQueryClient();

  const { mutate } = useMutation(deleteStory, {
    onSuccess: () => {
      queryClient.invalidateQueries("stories");
    },
  });
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
              Add To Context
            </button>
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
