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

export type SerializedAIGenerationNode = Spread<
  {
    type: "ai-generation";
    completed: boolean;
  },
  SerializedTextNode
>;

export class AIGenerationNode extends TextNode {
  __completed: boolean;

  static getType(): string {
    return "ai-generation";
  }

  static clone(node: AIGenerationNode): AIGenerationNode {
    return new AIGenerationNode(node.__text, node.__completed, node.__key);
  }

  constructor(text: string, completed: boolean = false, key?: NodeKey) {
    super(text, key);
    this.__completed = completed;
  }

  getCompleted(): boolean {
    return this.__completed;
  }

  setCompleted(completed: boolean): void {
    const writableNode = this.getWritable();
    writableNode.__completed = completed;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.className = this.__completed
      ? "ai-generation-text ai-generation-completed"
      : "ai-generation-text";
    return element;
  }

  updateDOM(
    prevNode: LexicalNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode as this, dom, config);
    const newClassName = this.__completed
      ? "ai-generation-text ai-generation-completed"
      : "ai-generation-text";
    if (dom.className !== newClassName) {
      dom.className = newClassName;
    }
    return isUpdated;
  }

  static importJSON(
    serializedNode: SerializedAIGenerationNode
  ): AIGenerationNode {
    const node = $createAIGenerationNode(
      serializedNode.text,
      serializedNode.completed
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedAIGenerationNode {
    return {
      ...super.exportJSON(),
      type: "ai-generation",
      completed: this.__completed,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: () => ({
        conversion: $convertAIGenerationElement,
        priority: 1,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.className = "ai-generation-text";
    element.textContent = this.getTextContent();
    return { element };
  }

  // Convert AI generation node to regular text node
  convertToTextNode(): TextNode {
    const textNode = $createTextNode(this.getTextContent());
    textNode.setFormat(this.getFormat());
    textNode.setDetail(this.getDetail());
    textNode.setMode(this.getMode());
    textNode.setStyle(this.getStyle());
    return textNode;
  }
}

function $convertAIGenerationElement(
  element: HTMLElement
): DOMConversionOutput {
  const node = $createAIGenerationNode(element.textContent || "");
  return { node };
}

export function $createAIGenerationNode(
  text: string = "",
  completed: boolean = false
): AIGenerationNode {
  return $applyNodeReplacement(new AIGenerationNode(text, completed));
}

export function $isAIGenerationNode(
  node: LexicalNode | null | undefined
): node is AIGenerationNode {
  return node instanceof AIGenerationNode;
}
