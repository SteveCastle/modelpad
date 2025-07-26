import {
  $applyNodeReplacement,
  $createTextNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedTextNode,
  Spread,
  TextNode,
  RangeSelection,
} from "lexical";

export type SerializedTagNode = Spread<
  {
    type: "tag";
    tagId: string;
    tagName: string;
    tagPath: string[];
    tagColor?: string;
  },
  SerializedTextNode
>;

export class TagNode extends TextNode {
  __tagId: string;
  __tagName: string;
  __tagPath: string[];
  __tagColor?: string;

  static getType(): string {
    return "tag";
  }

  static clone(node: TagNode): TagNode {
    return new TagNode(
      node.__text,
      node.__tagId,
      node.__tagName,
      node.__tagPath,
      node.__tagColor,
      node.__key
    );
  }

  constructor(
    text: string,
    tagId: string,
    tagName: string,
    tagPath: string[],
    tagColor?: string,
    key?: NodeKey
  ) {
    super(text, key);
    this.__tagId = tagId;
    this.__tagName = tagName;
    this.__tagPath = tagPath;
    this.__tagColor = tagColor;
  }

  getTagId(): string {
    return this.__tagId;
  }

  getTagName(): string {
    return this.__tagName;
  }

  getTagPath(): string[] {
    return this.__tagPath;
  }

  getTagColor(): string | undefined {
    return this.__tagColor;
  }

  setTagColor(color: string | undefined): void {
    const writableNode = this.getWritable();
    writableNode.__tagColor = color;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.className = "editor-tag";
    element.setAttribute("data-tag-id", this.__tagId);
    element.setAttribute("data-tag-name", this.__tagName);

    // Set category for CSS styling
    if (this.__tagColor) {
      element.style.backgroundColor = this.__tagColor;
      element.style.color = this.getContrastColor(this.__tagColor);
    }

    // Add category and path attributes for CSS styling
    const category = this.getCategory();
    if (category) {
      element.setAttribute("data-category", category);
    }
    element.setAttribute("data-tag-path", this.__tagPath.join("/"));
    element.setAttribute("data-path-depth", this.__tagPath.length.toString());

    element.setAttribute("contenteditable", "false");
    element.setAttribute("spellcheck", "false");
    element.setAttribute("data-click-handler", "true");
    element.title = `Tag: ${this.__tagName}\nPath: ${this.__tagPath.join(
      " → "
    )}`;

    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.className = "tag-delete-button";
    deleteButton.innerHTML = "×";
    deleteButton.title = "Delete tag";
    deleteButton.setAttribute("contenteditable", "false");
    deleteButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Dispatch custom event to be handled by TagPlugin
      const deleteEvent = new CustomEvent("tag-delete", {
        detail: { tagNode: this },
        bubbles: true,
      });
      element.dispatchEvent(deleteEvent);
    });

    // Add click handler to show tag edit menu
    element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Dispatch custom event to show tag edit menu
      const editEvent = new CustomEvent("tag-edit", {
        detail: {
          tagNode: this,
          targetElement: element, // Include the tag element for positioning
        },
        bubbles: true,
      });
      element.dispatchEvent(editEvent);
    });

    element.appendChild(deleteButton);
    return element;
  }

  getCategory(): string {
    // Use the first part of the path as the category
    if (this.__tagPath.length > 0) {
      const category = this.__tagPath[0].toLowerCase();
      // Valid storytelling categories
      const validCategories = [
        "characters",
        "settings",
        "genres",
        "style",
        "plot",
        "emotion",
      ];
      return validCategories.includes(category) ? category : "other";
    }
    return "other";
  }

  getDisplayText(): string {
    // Show the full hierarchical path with styling
    if (this.__tagPath.length > 1) {
      const parentPath = this.__tagPath.slice(0, -1).join("/");
      const lastSegment = this.__tagPath[this.__tagPath.length - 1];
      return `${parentPath}/${lastSegment}`;
    }
    return this.__tagPath[0] || this.__tagName;
  }

  updateDOM(
    prevNode: TagNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode, dom, config);

    if (dom.className !== "editor-tag") {
      dom.className = "editor-tag";
    }

    dom.setAttribute("data-tag-id", this.__tagId);
    dom.setAttribute("data-tag-name", this.__tagName);

    if (this.__tagColor) {
      dom.style.backgroundColor = this.__tagColor;
      dom.style.color = this.getContrastColor(this.__tagColor);
    } else {
      dom.style.backgroundColor = "";
      dom.style.color = "";
    }

    // Update category and path attributes
    const category = this.getCategory();
    if (category) {
      dom.setAttribute("data-category", category);
    }
    dom.setAttribute("data-tag-path", this.__tagPath.join("/"));
    dom.setAttribute("data-path-depth", this.__tagPath.length.toString());

    dom.setAttribute("contenteditable", "false");
    dom.setAttribute("spellcheck", "false");
    dom.title = `Tag: ${this.__tagName}\nPath: ${this.__tagPath.join(" → ")}`;

    // Ensure delete button exists
    let deleteButton = dom.querySelector(".tag-delete-button") as HTMLElement;
    if (!deleteButton) {
      deleteButton = document.createElement("button");
      deleteButton.className = "tag-delete-button";
      deleteButton.innerHTML = "×";
      deleteButton.title = "Delete tag";
      deleteButton.setAttribute("contenteditable", "false");
      deleteButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Dispatch custom event to be handled by TagPlugin
        const deleteEvent = new CustomEvent("tag-delete", {
          detail: { tagNode: this },
          bubbles: true,
        });
        dom.dispatchEvent(deleteEvent);
      });
      dom.appendChild(deleteButton);
    }

    // Ensure click handler exists for tag edit menu
    const existingClickHandler = dom.getAttribute("data-click-handler");
    if (!existingClickHandler) {
      dom.setAttribute("data-click-handler", "true");
      dom.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Dispatch custom event to show tag edit menu
        const editEvent = new CustomEvent("tag-edit", {
          detail: {
            tagNode: this,
            targetElement: dom, // Include the tag element for positioning
          },
          bubbles: true,
        });
        dom.dispatchEvent(editEvent);
      });
    }

    return isUpdated;
  }

  // Helper method to calculate contrast color for text
  private getContrastColor(backgroundColor: string): string {
    // Convert hex to RGB
    const hex = backgroundColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  static importJSON(serializedNode: SerializedTagNode): TagNode {
    const node = $createTagNode(
      serializedNode.text,
      serializedNode.tagId,
      serializedNode.tagName,
      serializedNode.tagPath,
      serializedNode.tagColor
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedTagNode {
    return {
      ...super.exportJSON(),
      type: "tag",
      tagId: this.__tagId,
      tagName: this.__tagName,
      tagPath: this.__tagPath,
      tagColor: this.__tagColor,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: Node) => {
        const element = node as HTMLElement;
        if (element.classList.contains("editor-tag")) {
          return {
            conversion: $convertTagElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.className = "editor-tag";
    element.setAttribute("data-tag-id", this.__tagId);
    element.setAttribute("data-tag-name", this.__tagName);

    if (this.__tagColor) {
      element.style.backgroundColor = this.__tagColor;
      element.style.color = this.getContrastColor(this.__tagColor);
    }

    const category = this.getCategory();
    if (category) {
      element.setAttribute("data-category", category);
    }
    element.setAttribute("data-tag-path", this.__tagPath.join("/"));
    element.setAttribute("data-path-depth", this.__tagPath.length.toString());

    element.textContent = this.getTextContent();
    return { element };
  }

  // Convert tag node to regular text node
  convertToTextNode(): TextNode {
    const textNode = $createTextNode(this.getTextContent());
    textNode.setFormat(this.getFormat());
    textNode.setDetail(this.getDetail());
    textNode.setMode(this.getMode());
    textNode.setStyle(this.getStyle());
    return textNode;
  }

  // Prevent normal text editing within the tag
  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return true;
  }

  // Override cursor selection to prevent getting stuck in tag
  select(): RangeSelection | null {
    // Instead of selecting inside the tag, select after it
    const nextSibling = this.getNextSibling();
    if (nextSibling && nextSibling instanceof TextNode) {
      return nextSibling.select(0, 0);
    }

    // If no next sibling text node, create one
    const spaceNode = $createTextNode(" ");
    this.insertAfter(spaceNode);
    return spaceNode.select(0, 0);
  }

  // Ensure we can't place cursor at start/end of tag
  isSelected(): boolean {
    return false;
  }

  // Override to prevent direct text insertion
  insertText(text: string): this {
    // Instead of inserting into tag, insert after it
    const nextSibling = this.getNextSibling();
    if (nextSibling && nextSibling instanceof TextNode) {
      const currentText = nextSibling.getTextContent();
      nextSibling.setTextContent(text + currentText);
    } else {
      const textNode = $createTextNode(text);
      this.insertAfter(textNode);
    }
    return this;
  }
}

function $convertTagElement(element: HTMLElement): DOMConversionOutput {
  const tagId = element.getAttribute("data-tag-id") || "";
  const tagName = element.getAttribute("data-tag-name") || "";
  const tagColor = element.style.backgroundColor || undefined;

  // Extract path from tag name (for backward compatibility)
  const tagPath = tagName.split("/").filter((p) => p.trim());

  const node = $createTagNode(
    element.textContent || "",
    tagId,
    tagName,
    tagPath,
    tagColor
  );
  return { node };
}

export function $createTagNode(
  text: string = "",
  tagId: string = crypto.randomUUID(),
  tagName: string = text,
  tagPath: string[] = [text],
  tagColor?: string
): TagNode {
  return $applyNodeReplacement(
    new TagNode(text, tagId, tagName, tagPath, tagColor)
  );
}

export function $isTagNode(
  node: LexicalNode | null | undefined
): node is TagNode {
  return node instanceof TagNode;
}
