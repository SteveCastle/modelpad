"use client";
import {
  SparklesIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ArrowsPointingInIcon,
  Bars3BottomLeftIcon,
  BarsArrowDownIcon,
} from "@heroicons/react/24/outline";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
} from "lexical";
import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useState } from "react";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

export default function ContextMenu({ hide }: Props) {
  const [context, setContext] = useState<number[] | undefined>(undefined);
  const [editor] = useLexicalComposerContext();
  function generate() {
    const editorState = editor.getEditorState();
    editorState.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const text = selection.getTextContent();
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      console.log(parent);
      console.log("fetching with context", context, text);
      fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "rose",
          prompt: text,
          context,
        }),
      })
        .then((response) => {
          if (!response || !response.body) {
            throw new Error("Invalid response");
          }
          const reader = response.body.getReader();
          return new ReadableStream({
            start(controller) {
              function push() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    controller.close();
                    return;
                  }
                  // Convert the Uint8Array to string and process the chunk
                  const chunk = new TextDecoder("utf-8").decode(value);
                  try {
                    const json = JSON.parse(chunk);
                    const response = json.response;
                    if (parent && response) {
                      editor.update(() => {
                        const textNode = $createTextNode(response);
                        parent.append(textNode);
                      });
                    }
                    if (json.context) {
                      setContext(json.context);
                      console.log("set context", json.context);
                    }
                  } catch (e) {
                    console.log(e);
                  }
                  // Push the chunk to the stream
                  controller.enqueue(value);
                  push();
                });
              }
              push();
            },
          });
        })
        .then((stream) => new Response(stream))
        .then((response) => response.text())
        .then(() => {
          console.log("Complete");
        })
        .catch((err) => console.error(err));
    });
  }

  return (
    <span className={"context-menu"}>
      <button
        type="button"
        onClick={() => {
          hide();
          generate();
        }}
      >
        <SparklesIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          hide();
        }}
      >
        <BarsArrowDownIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          hide();
        }}
      >
        <ArrowPathIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          hide();
        }}
      >
        <ArrowsPointingInIcon aria-hidden="true" />
      </button>
      <button type="button" onClick={() => {}}>
        <Bars3BottomLeftIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          hide();
        }}
      >
        <ChatBubbleLeftRightIcon aria-hidden="true" />
      </button>
    </span>
  );
}
