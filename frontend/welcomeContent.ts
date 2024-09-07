type TextNode = {
  detail: number;
  format: number;
  mode: "normal";
  style: string;
  text: string;
  type: "text";
  version: number;
};

type LinkNode = {
  children: TextNode[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "link";
  version: number;
  rel: string | null;
  target: string | null;
  title: string | null;
  url: string;
};

type ListItemNode = {
  children: TextNode[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "listitem";
  version: number;
  value: number;
};

type ListNode = {
  children: (ListItemNode | TextNode)[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "list";
  version: number;
  listType: "bullet";
  start: number;
  tag: "ul";
};

type HeadingNode = {
  children: TextNode[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "heading";
  version: number;
  tag: "h1" | "h2" | "h3";
};

type ParagraphNode = {
  children: (TextNode | LinkNode)[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "paragraph";
  version: number;
};

type RootNode = {
  children: (HeadingNode | ParagraphNode | ListNode)[];
  direction: "ltr";
  format: string;
  indent: number;
  type: "root";
  version: number;
};

export type Content = {
  root: RootNode;
};

export const welcomeContent: Content = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "ModelPad: An AI document editor.",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "heading",
        version: 1,
        tag: "h1",
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "ModelPad is an ",
            type: "text",
            version: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "open source",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "link",
            version: 1,
            rel: "noreferrer",
            target: null,
            title: null,
            url: "https://github.com/SteveCastle/modelpad",
          },
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: " notepad like text editor with AI integration.  It supports Markdown features like headers, code blocks, links, and more. ModelPad stores documents offline and without logging in. Optionally, you can create an account to get file sync, vector document search, and RAG. ",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Things you can do:",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Generate new text from existing text in the document.",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Select and rewrite portions of text.",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 2,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Select and summarize portions of text.",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 3,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Create your own customized prompt templates to perform repeatable actions to selected text.",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 4,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Control which documents are in context when generating text.",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 5,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "list",
        version: 1,
        listType: "bullet",
        start: 1,
        tag: "ul",
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Project Roadmap",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "heading",
        version: 1,
        tag: "h2",
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Next Up",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "heading",
        version: 1,
        tag: "h3",
      },
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Image Support",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Hosted Open Source Models",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 2,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Continuous UI Improvements and New Options",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 3,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "list",
        version: 1,
        listType: "bullet",
        start: 1,
        tag: "ul",
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Future",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "heading",
        version: 1,
        tag: "h3",
      },
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Sandboxed Code Execution",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 1,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Document Visualizations(Timelines, Recipes, Knowledge Graphs)",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 2,
          },
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Document Sharing",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "listitem",
            version: 1,
            value: 3,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "list",
        version: 1,
        listType: "bullet",
        start: 1,
        tag: "ul",
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};
