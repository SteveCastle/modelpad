import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { TableOfContentsPlugin } from "@lexical/react/LexicalTableOfContentsPlugin";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { AIGenerationNode } from "./AIGenerationNode";
import { PromptNode } from "./PromptNode";
import "./AIGenerationNode.css";
import "./PromptNode.css";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "./LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { useDebouncedCallback } from "use-debounce";
import CodeHighlightPlugin from "./CodeHighlightPlugin";
import { BlockHoverPlugin } from "./BlockHoverPlugin";
import { KeyboardShortcutsPlugin } from "./KeyboardShortcutsPlugin";
import { Toolbar } from "./Toolbar";
import { useStore, Story } from "../store";
import "./TableOfContents.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

const theme = {
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  input: "editor-input",
  paragraph: "editor-paragraph",
  blockquote: "editor-blockquote",
  quote: "editor-quote",
  link: "editor-link",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
    h4: "editor-heading-h4",
    h5: "editor-heading-h5",
  },
  list: {
    nested: {
      listitem: "editor-nested-listitem",
    },
    ol: "editor-list-ol",
    ul: "editor-list-ul",
    listitem: "editor-listitem",
  },
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    overflowed: "editor-text-overflowed",
    hashtag: "editor-text-hashtag",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    underlineStrikethrough: "editor-text-underlineStrikethrough",
    code: "editor-text-code",
  },
  code: "codeHighlight",
  codeHighlight: {
    atrule: "editor-tokenAttr",
    attr: "editor-tokenAttr",
    boolean: "editor-tokenProperty",
    builtin: "editor-tokenSelector",
    cdata: "editor-tokenComment",
    char: "editor-tokenSelector",
    class: "editor-tokenFunction",
    "class-name": "editor-tokenFunction",
    comment: "editor-tokenComment",
    constant: "editor-tokenProperty",
    deleted: "editor-tokenProperty",
    doctype: "editor-tokenComment",
    entity: "editor-tokenOperator",
    function: "editor-tokenFunction",
    important: "editor-tokenVariable",
    inserted: "editor-tokenSelector",
    keyword: "editor-tokenAttr",
    namespace: "editor-tokenVariable",
    number: "editor-tokenProperty",
    operator: "editor-tokenOperator",
    prolog: "editor-tokenComment",
    property: "editor-tokenProperty",
    punctuation: "editor-tokenPunctuation",
    regex: "editor-tokenVariable",
    selector: "editor-tokenSelector",
    string: "editor-tokenSelector",
    symbol: "editor-tokenProperty",
    tag: "editor-tokenProperty",
    url: "editor-tokenOperator",
    variable: "editor-tokenVariable",
  },
};

// TableOfContents component that renders the TOC data
function TableOfContents({
  tableOfContents,
}: {
  tableOfContents: Array<[string, string, string]>;
}) {
  const [editor] = useLexicalComposerContext();

  // Debug logging
  console.log("TableOfContents received data:", tableOfContents);

  if (!tableOfContents || tableOfContents.length === 0) {
    return null;
  }

  const scrollToHeading = (headingKey: string, headingText: string) => {
    console.log(
      "Attempting to scroll to heading with key:",
      headingKey,
      "text:",
      headingText
    );

    // Use Lexical's getElementByKey to find the heading element
    let headingElement: HTMLElement | Element | null =
      editor.getElementByKey(headingKey);
    console.log("Found heading element via Lexical:", headingElement);

    // If not found by Lexical key, try finding by text content within the editor
    if (!headingElement) {
      console.warn("Heading element not found for key:", headingKey);

      const editorElement = editor.getRootElement();
      if (editorElement) {
        const allHeadings = editorElement.querySelectorAll(
          "h1, h2, h3, h4, h5, h6"
        );
        console.log("All headings in editor:", allHeadings);

        // Try to find heading by matching text content
        allHeadings.forEach((heading) => {
          if (
            heading.textContent &&
            heading.textContent.trim() === headingText.trim()
          ) {
            headingElement = heading;
          }
        });

        if (headingElement) {
          console.log("Found heading by text content:", headingElement);
        }
      }
    }

    if (!headingElement) {
      console.error("Could not find heading by any method");
      return;
    }

    console.log("Final heading element to scroll to:", headingElement);

    // Find the actual scrollable container by checking scrollHeight vs clientHeight
    let scrollContainer: Element | null = null;

    // Method 1: Find the container that actually has scrollable content
    let parent = headingElement.parentElement;
    while (parent && parent !== document.body) {
      const hasScroll = parent.scrollHeight > parent.clientHeight;
      const isScrollable =
        getComputedStyle(parent).overflow === "auto" ||
        getComputedStyle(parent).overflowY === "auto";

      console.log("Checking parent:", parent, {
        scrollHeight: parent.scrollHeight,
        clientHeight: parent.clientHeight,
        hasScroll,
        isScrollable,
        overflow: getComputedStyle(parent).overflow,
      });

      if (hasScroll && isScrollable) {
        scrollContainer = parent;
        console.log("Found scrollable container:", scrollContainer);
        break;
      }
      parent = parent.parentElement;
    }

    // Method 2: If no scrollable parent found, try specific selectors
    if (!scrollContainer) {
      const candidates = [
        document.querySelector('[style*="overflow: auto"]'),
        document.querySelector('[style*="overflow-y: auto"]'),
        document.querySelector('.story-editor-container [style*="flex: 1"]'),
        document.querySelector(".editor-input")?.parentElement,
        document.querySelector('[contenteditable="true"]')?.parentElement,
      ];

      for (const candidate of candidates) {
        if (candidate && candidate.scrollHeight > candidate.clientHeight) {
          scrollContainer = candidate;
          console.log("Found container via selector:", candidate);
          break;
        }
      }
    }

    console.log("Final scroll container:", scrollContainer);

    if (
      scrollContainer &&
      scrollContainer.scrollHeight > scrollContainer.clientHeight
    ) {
      console.log("Using container scroll approach");
      console.log("Container scrollTop before:", scrollContainer.scrollTop);
      console.log("Container clientHeight:", scrollContainer.clientHeight);
      console.log("Container scrollHeight:", scrollContainer.scrollHeight);

      // Get positions
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = headingElement.getBoundingClientRect();

      console.log("Container rect:", containerRect);
      console.log("Element rect:", elementRect);

      // Calculate scroll position
      const relativeTop = elementRect.top - containerRect.top;
      const targetScrollTop = scrollContainer.scrollTop + relativeTop - 20;

      console.log("Relative top:", relativeTop);
      console.log("Target scroll position:", targetScrollTop);

      // Try scrollTo
      scrollContainer.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });

      // Check if scroll happened after a brief delay
      setTimeout(() => {
        console.log(
          "Container scrollTop after scrollTo:",
          scrollContainer.scrollTop
        );

        // If scroll didn't happen, try alternative approach
        if (scrollContainer.scrollTop === 0 && targetScrollTop > 0) {
          console.log("ScrollTo failed, trying scrollIntoView fallback");
          headingElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });
        }
      }, 100);
    } else {
      console.log(
        "No valid scroll container found, using scrollIntoView directly"
      );
      headingElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    }
  };

  return (
    <div className="table-of-contents">
      <h3 className="toc-title">Contents</h3>
      <ul className="toc-list">
        {tableOfContents.map(([headingKey, headingTextContent, headingTag]) => (
          <li key={headingKey} className={`toc-item toc-${headingTag}`}>
            <a
              href={`#${headingKey}`}
              className="toc-link"
              onClick={(e) => {
                e.preventDefault();
                scrollToHeading(headingKey, headingTextContent);
              }}
            >
              {headingTextContent}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StoryEditorProps {
  story: Story;
  isActive: boolean;
  viewSettings: {
    readingMode: boolean;
    zoom: number;
  };
}

export function StoryEditor({
  story,
  isActive,
  viewSettings,
}: StoryEditorProps) {
  const { updateStory, updateSyncState } = useStore((state) => state);

  // Ensure we always have valid content - if story.content is undefined/null,
  // the store should have already provided a default, but double-check here
  const safeContent = story.content || {
    root: {
      children: [
        {
          children: [],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };

  const initialContent = JSON.stringify(safeContent);

  const editorConfig = useMemo(
    () => ({
      theme,
      namespace: `editor-${story.id}`,
      onError(error: Error) {
        throw error;
      },
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        TableNode,
        TableCellNode,
        TableRowNode,
        AutoLinkNode,
        LinkNode,
        AIGenerationNode,
        PromptNode,
      ],
      editorState: initialContent,
    }),
    [story.id, initialContent]
  );

  const debouncedOnChange = useDebouncedCallback(
    (editorState) => {
      const content = JSON.stringify(editorState);
      if (content !== initialContent) {
        // The store's updateStory function will ensure content is not empty
        updateStory(story.id, editorState);
        updateSyncState(story.id, false);
      }
    },
    1000,
    {
      maxWait: 1000,
    }
  );

  return (
    <LexicalComposer initialConfig={editorConfig}>
      {isActive && <Toolbar />}
      <div
        className="story-editor-container"
        style={{
          display: isActive ? "flex" : "none",
          width: "100%",
          height: "100%", // Use full height within the panel
          boxSizing: "border-box",
          maxWidth: viewSettings.readingMode ? "960px" : "",
          margin: viewSettings.readingMode ? "0 auto" : "0", // Center in reading mode
          overflow: "hidden", // Prevent the main container from scrolling
          fontSize: `${viewSettings.zoom}em`,
        }}
      >
        {/* Table of Contents Panel - Hidden in reading mode */}
        {!viewSettings.readingMode && (
          <div
            className="toc-panel"
            style={{
              width: "250px",
              minWidth: "250px",
              height: "100%",
              overflowY: "auto",
              padding: "20px 16px",
            }}
          >
            <TableOfContentsPlugin>
              {(tableOfContents) => (
                <TableOfContents tableOfContents={tableOfContents} />
              )}
            </TableOfContentsPlugin>
          </div>
        )}

        {/* Editor Content */}
        <div
          style={{
            flex: 1,
            height: "100%",
            position: "relative",
            overflow: "auto", // Only the editor content should scroll
            padding: viewSettings.readingMode ? "20px" : "0 20px", // Use padding for horizontal spacing in non-reading mode
          }}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input"
                style={{
                  minHeight: "100%",
                  outline: "none",
                  padding: "0",
                  margin: "0",
                }}
              />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <BlockHoverPlugin />
        <KeyboardShortcutsPlugin />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={debouncedOnChange}
          ignoreSelectionChange
          ignoreHistoryMergeTagChange
        />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <ListPlugin />
        <LinkPlugin />
        <CodeHighlightPlugin />
      </div>
    </LexicalComposer>
  );
}
