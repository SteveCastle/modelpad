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
  },
  SerializedTextNode
>;

export class AIGenerationNode extends TextNode {
  static getType(): string {
    return "ai-generation";
  }

  static clone(node: AIGenerationNode): AIGenerationNode {
    return new AIGenerationNode(node.__text, node.__key);
  }

  constructor(text: string, key?: NodeKey) {
    super(text, key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    element.className = "ai-generation-text";
    return element;
  }

  updateDOM(
    prevNode: AIGenerationNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const isUpdated = super.updateDOM(prevNode, dom, config);
    if (dom.className !== "ai-generation-text") {
      dom.className = "ai-generation-text";
    }
    return isUpdated;
  }

  static importJSON(
    serializedNode: SerializedAIGenerationNode
  ): AIGenerationNode {
    const node = $createAIGenerationNode(serializedNode.text);
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

export function $createAIGenerationNode(text: string = ""): AIGenerationNode {
  return $applyNodeReplacement(new AIGenerationNode(text));
}

export function $isAIGenerationNode(
  node: LexicalNode | null | undefined
): node is AIGenerationNode {
  return node instanceof AIGenerationNode;
}
