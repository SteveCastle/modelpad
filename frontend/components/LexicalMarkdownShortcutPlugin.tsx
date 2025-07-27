/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { ElementTransformer, Transformer } from "@lexical/markdown";
import type { LexicalNode } from "lexical";

import { TRANSFORMERS, registerMarkdownShortcuts } from "@lexical/markdown";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createParagraphNode, $createTextNode } from "lexical";
import { useEffect } from "react";

const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? "***" : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }

    line.selectNext();
  },
  type: "element",
};

// Task list transformer
const TASK_LIST: ElementTransformer = {
  dependencies: [HorizontalRuleNode], // Using HR as dependency since we don't have a specific task list node
  export: () => {
    // Task list export logic would go here
    return null;
  },
  regExp: /^- \[([ x])\] (.+)$/,
  replace: (parentNode, _1, _2, isImport) => {
    // Create a task list item
    const isChecked = String(_1) === "x";
    const taskText = String(_2);

    // For now, create a paragraph with checkbox-like formatting
    const paragraphNode = $createParagraphNode();
    const checkboxText = isChecked ? "[x] " : "[ ] ";
    const textNode = $createTextNode(checkboxText + taskText);
    paragraphNode.append(textNode);

    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(paragraphNode);
    } else {
      parentNode.insertBefore(paragraphNode);
    }

    paragraphNode.selectNext();
  },
  type: "element",
};

// Note: Footnotes are not directly supported by Lexical's built-in transformers
// They would require a custom node type and transformer implementation
// For now, footnotes can be handled as regular text with [^1] format

export const DEFAULT_TRANSFORMERS = [HR, TASK_LIST, ...TRANSFORMERS];

export function MarkdownShortcutPlugin({
  transformers = DEFAULT_TRANSFORMERS,
}: Readonly<{
  transformers?: Array<Transformer>;
}>): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerMarkdownShortcuts(editor, transformers);
  }, [editor, transformers]);

  return null;
}
