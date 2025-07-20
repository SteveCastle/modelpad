interface Node {
  type: string;
  tag?: string;
  children?: Node[];
  text?: string;
  listType?: string;
  value?: number;
  language?: string;
}

interface Root {
  root: Node;
}

export function convertJSONToMarkdown(jsonInput: string): string {
  let root: Root;
  try {
    root = JSON.parse(jsonInput);
    root.root;
  } catch (error) {
    return "";
  }

  let markdown = "";
  processNode(root.root, 0, (text) => {
    markdown += text;
  });
  return markdown;
}

function processNode(
  node: Node,
  depth: number,
  write: (text: string) => void
): void {
  if (!node) return;
  switch (node.type) {
    case "root":
      processChildren(node.children, depth, write);
      break;
    case "heading":
      write("#".repeat(getHeadingLevel(node.tag)) + " ");
      processChildren(node.children, depth, write);
      write("\n\n");
      break;
    case "paragraph":
      processChildren(node.children, depth, write);
      write("\n\n");
      break;
    case "text":
      write(node.text);
      break;
    case "linebreak":
      write("\n");
      break;
    case "list":
      processListItems(node, depth, write);
      write("\n");
      break;
    case "code":
      write("```");
      if (node.language) {
        write(node.language);
      }
      write("\n");
      processChildren(node.children, depth, write);
      write("\n```\n\n");
      break;
    case "quote":
      write("> ");
      processChildren(node.children, depth, write);
      write("\n\n");
      break;
    case "tab":
      write("\t");
      break;
    case "code-highlight":
      write(node.text);
      break;
    default:
      // Handle unknown node types or log a warning
      console.warn(`Unknown node type: ${node.type}`);
  }
}

function processChildren(
  children: Node[] | undefined,
  depth: number,
  write: (text: string) => void
): void {
  if (children) {
    for (const child of children) {
      processNode(child, depth + 1, write);
    }
  }
}

function processListItems(
  node: Node,
  depth: number,
  write: (text: string) => void
): void {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      if (node.listType === "bullet") {
        write("- ");
      } else if (node.listType === "number") {
        write(`${i + 1}. `);
      }
      processChildren(node.children[i].children, depth + 1, write);
      write("\n");
    }
  }
}

function getHeadingLevel(tag: string | undefined): number {
  switch (tag) {
    case "h1":
      return 1;
    case "h2":
      return 2;
    case "h3":
      return 3;
    case "h4":
      return 4;
    case "h5":
      return 5;
    case "h6":
      return 6;
    default:
      return 1;
  }
}
