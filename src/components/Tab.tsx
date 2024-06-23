import { useState } from "react";
import { Story } from "../store";
import { XMarkIcon } from "@heroicons/react/24/solid";
import "./Tab.css";
import { useStore } from "../store";

type Props = {
  story: Story;
  activeStoryId: string;
  setActive: (id: string) => void;
  closeStory: (id: string) => void;
};

export function Tab({ story, activeStoryId, setActive, closeStory }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const { updateTitle } = useStore((state) => state);

  return (
    <a
      className={["tab", story.id === activeStoryId ? "active" : ""].join(" ")}
      key={story.id}
      onClick={() => setActive(story.id)}
      onAuxClick={(e) => {
        if (e.button == 1) {
          e.preventDefault();
          closeStory(story.id);
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
          if (e.currentTarget.textContent.length > 0) {
            updateTitle(
              story.id,
              removeNewLineChars(e.currentTarget.textContent) || ""
            );
          } else {
            e.currentTarget.textContent = story.title;
          }
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
