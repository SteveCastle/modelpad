import { useState } from "react";
import { Story } from "../store";
import { XMarkIcon } from "@heroicons/react/24/solid";
import "./Tab.css";
import { useStore } from "../store";
import { useSessionContext } from "supertokens-auth-react/recipe/session";

type Props = {
  story: Story;
  activeStoryId: string;
  setActive: (id: string) => void;
  closeStory: (id: string) => void;
};

export function Tab({ story, activeStoryId, setActive, closeStory }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const { updateTitle, updateSyncState } = useStore((state) => state);
  const session = useSessionContext();
  const saveHandler = (story: Story, newTitle: string) => {
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
            body: JSON.stringify(story.content),
            title: newTitle,
          }),
        }
      );
      updateSyncState(story.id, true);
    }
    if (session.loading === false && session.userId) {
      save();
    }
  };

  return (
    <a
      className={["tab", story.id === activeStoryId ? "active" : ""].join(" ")}
      key={story.id}
      onClick={() => setActive(story.id)}
      onAuxClick={(e) => {
        if (e.button == 1) {
          e.preventDefault();
          closeStory(story.id);
          // Delete the note by calling api
          fetch(
            `${
              import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
            }/api/notes/${story.id}`,
            {
              method: "DELETE",
            }
          );
        }
      }}
    >
      <span
        contentEditable={editingTitle}
        className={[
          "editable-title",
          editingTitle ? "editing" : "",
          story.synced ? "synced" : "",
        ].join(" ")}
        onDoubleClick={() => setEditingTitle(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          updateTitle(
            story.id,
            removeNewLineChars(e.currentTarget.textContent) || ""
          );
          saveHandler(
            story,
            removeNewLineChars(e.currentTarget.textContent) || ""
          );
          setEditingTitle(false);
        }}
      >
        {removeNewLineChars(story.title)}
      </span>
      <button
        className="close"
        onClick={(e) => {
          e.stopPropagation();
          closeStory(story.id);
          // Delete the note by calling api
          fetch(
            `${
              import.meta.env.VITE_AUTH_API_DOMAIN || "https://modelpad.app"
            }/api/notes/${story.id}`,
            {
              method: "DELETE",
            }
          );
        }}
      >
        <XMarkIcon />
      </button>
    </a>
  );
}

function removeNewLineChars(text: string) {
  return text.replace(/(\r\n|\n|\r)/gm, "");
}
