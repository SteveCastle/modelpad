package markdown

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Node struct {
	Type     string `json:"type"`
	Tag      string `json:"tag,omitempty"`
	Children []Node `json:"children,omitempty"`
	Text     string `json:"text,omitempty"`
	ListType string `json:"listType,omitempty"`
	Value    int    `json:"value,omitempty"`
	Language string `json:"language,omitempty"`
}

type Root struct {
	Root Node `json:"root"`
}

func ConvertJSONToMarkdown(jsonInput string) (string, error) {
	var root Root
	err := json.Unmarshal([]byte(jsonInput), &root)
	if err != nil {
		fmt.Println("Error unmarshalling JSON")
		return "", err
	}

	var markdown strings.Builder
	processNode(&markdown, root.Root, 0)
	result := markdown.String()
	return result, nil
}

func processNode(sb *strings.Builder, node Node, depth int) {
	switch node.Type {
	case "root":
		processChildren(sb, node.Children, depth)
	case "heading":
		sb.WriteString(strings.Repeat("#", getHeadingLevel(node.Tag)) + " ")
		processChildren(sb, node.Children, depth)
		sb.WriteString("\n\n")
	case "paragraph":
		processChildren(sb, node.Children, depth)
		sb.WriteString("\n\n")
	case "text":
		sb.WriteString(node.Text)
	case "linebreak":
		sb.WriteString("\n")
	case "list":
		processListItems(sb, node, depth)
		sb.WriteString("\n")
	case "code":
		sb.WriteString("```")
		if node.Language != "" {
			sb.WriteString(node.Language)
		}
		sb.WriteString("\n")
		processChildren(sb, node.Children, depth)
		sb.WriteString("\n```\n\n")
	case "quote":
		sb.WriteString("> ")
		processChildren(sb, node.Children, depth)
		sb.WriteString("\n\n")
	case "tab":
		sb.WriteString("\t")
	case "code-highlight":
		sb.WriteString(node.Text)
	default:
		// Handle unknown node types or log a warning
		fmt.Printf("Unknown node type: %s\n", node.Type)
	}
}

func processChildren(sb *strings.Builder, children []Node, depth int) {
	for _, child := range children {
		processNode(sb, child, depth+1)
	}
}

func processListItems(sb *strings.Builder, node Node, depth int) {
	for i, child := range node.Children {
		if node.ListType == "bullet" {
			sb.WriteString("- ")
		} else if node.ListType == "number" {
			sb.WriteString(fmt.Sprintf("%d. ", i+1))
		}
		processChildren(sb, child.Children, depth+1)
		sb.WriteString("\n")
	}
}

func getHeadingLevel(tag string) int {
	switch tag {
	case "h1":
		return 1
	case "h2":
		return 2
	case "h3":
		return 3
	case "h4":
		return 4
	case "h5":
		return 5
	case "h6":
		return 6
	default:
		return 1
	}
}