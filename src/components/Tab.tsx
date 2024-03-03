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
    >
      <span
        contentEditable={editingTitle}
        className="editable-title"
        onDoubleClick={() => setEditingTitle(true)}
        onBlur={(e) => {
          updateTitle(story.id, e.currentTarget.textContent || "");
          setEditingTitle(false);
        }}
      >
        {story.title}
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
