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
} from "lexical";

export type SerializedPromptNode = Spread<
  {
    type: "prompt";
    promptId: string;
    status: "pending" | "generating" | "completed" | "cancelled";
    originalText: string;
  },
  SerializedTextNode
>;

export class PromptNode extends TextNode {
  __promptId: string;
  __status: "pending" | "generating" | "completed" | "cancelled";
  __originalText: string;

  static getType(): string {
    return "prompt";
  }

  static clone(node: PromptNode): PromptNode {
    return new PromptNode(
      node.__text,
      node.__promptId,
      node.__status,
      node.__originalText,
      node.__key
    );
  }

  constructor(
    text: string,
    promptId: string,
    status: "pending" | "generating" | "completed" | "cancelled" = "pending",
    originalText: string = text,
    key?: NodeKey
  ) {
    super(text, key);
    this.__promptId = promptId;
    this.__status = status;
    this.__originalText = originalText;
  }

  getPromptId(): string {
    return this.__promptId;
  }

  getStatus(): "pending" | "generating" | "completed" | "cancelled" {
    return this.__status;
  }

  getOriginalText(): string {
    return this.__originalText;
  }

  setStatus(
    status: "pending" | "generating" | "completed" | "cancelled"
  ): void {
    const writableNode = this.getWritable();
    writableNode.__status = status;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.className = `prompt-text prompt-${this.__status}`;
    element.setAttribute("data-prompt-id", this.__promptId);
    element.setAttribute("data-status", this.__status);
    return element;
  }

  updateDOM(
    prevNode: LexicalNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode as this, dom, config);
    const newClassName = `prompt-text prompt-${this.__status}`;
    if (dom.className !== newClassName) {
      dom.className = newClassName;
    }
    dom.setAttribute("data-prompt-id", this.__promptId);
    dom.setAttribute("data-status", this.__status);
    return isUpdated;
  }

  static importJSON(serializedNode: SerializedPromptNode): PromptNode {
    const node = $createPromptNode(
      serializedNode.text,
      serializedNode.promptId,
      serializedNode.status,
      serializedNode.originalText
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedPromptNode {
    return {
      ...super.exportJSON(),
      type: "prompt",
      promptId: this.__promptId,
      status: this.__status,
      originalText: this.__originalText,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: Node) => {
        const element = node as HTMLElement;
        if (element.classList.contains("prompt-text")) {
          return {
            conversion: $convertPromptElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.className = `prompt-text prompt-${this.__status}`;
    element.setAttribute("data-prompt-id", this.__promptId);
    element.setAttribute("data-status", this.__status);
    element.textContent = this.getTextContent();
    return { element };
  }

  // Convert prompt node to regular text node
  convertToTextNode(): TextNode {
    const textNode = $createTextNode(this.__originalText);
    textNode.setFormat(this.getFormat());
    textNode.setDetail(this.getDetail());
    textNode.setMode(this.getMode());
    textNode.setStyle(this.getStyle());
    return textNode;
  }
}

function $convertPromptElement(element: HTMLElement): DOMConversionOutput {
  const promptId = element.getAttribute("data-prompt-id") || "";
  const statusAttr = element.getAttribute("data-status");
  const status: "pending" | "generating" | "completed" | "cancelled" =
    statusAttr === "pending" ||
    statusAttr === "generating" ||
    statusAttr === "completed" ||
    statusAttr === "cancelled"
      ? statusAttr
      : "pending";
  const node = $createPromptNode(
    element.textContent || "",
    promptId,
    status,
    element.textContent || ""
  );
  return { node };
}

export function $createPromptNode(
  text: string = "",
  promptId: string = crypto.randomUUID(),
  status: "pending" | "generating" | "completed" | "cancelled" = "pending",
  originalText: string = text
): PromptNode {
  return $applyNodeReplacement(
    new PromptNode(text, promptId, status, originalText)
  );
}

export function $isPromptNode(
  node: LexicalNode | null | undefined
): node is PromptNode {
  return node instanceof PromptNode;
}
