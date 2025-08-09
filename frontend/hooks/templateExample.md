# Enhanced Template System Examples

The new `applyTemplate` function supports templating all prompt context variables using both `<variable>` and `{{variable}}` syntax.

## Available Template Variables:

### Primary Content
- `<text>` or `{{text}}` - Legacy support, maps to activeNodeText
- `<activeNodeText>` or `{{activeNodeText}}` - Text of the current/active node

### Selection
- `<selection>` or `{{selection}}` - Text of any selection (if exists)
- `<selectionText>` or `{{selectionText}}` - Alias for selection

### Document Context
- `<currentDocument>` or `{{currentDocument}}` - Text of entire current document
- `<currentDocumentText>` or `{{currentDocumentText}}` - Alias for currentDocument

### Contextual Information
- `<textBefore>` or `{{textBefore}}` - Text before the active node
- `<textBeforeActiveNode>` or `{{textBeforeActiveNode}}` - Alias for textBefore
- `<textAfter>` or `{{textAfter}}` - Text after the active node  
- `<textAfterActiveNode>` or `{{textAfterActiveNode}}` - Alias for textAfter
- `<documentContext>` or `{{documentContext}}` - Combined before/after context with [BEFORE]/[AFTER] labels

### RAG Context
- `<contextDocuments>` or `{{contextDocuments}}` - All context documents joined with newlines

## Example Template Usage:

### Basic Template:
```
Please analyze this text: <text>
```

### Context-Aware Template:
```
Given the following document context:

{{documentContext}}

And considering these reference documents:
{{contextDocuments}}

Please improve this specific section: {{activeNodeText}}

The user wants me to focus on {{selection}} if they have selected specific text.
```

### Advanced Template:
```
You are editing a document. Here's the context:

DOCUMENT STRUCTURE:
- Text before current section: {{textBefore}}  
- Current section (focus): {{activeNodeText}}
- Text after current section: {{textAfter}}

{{#if selection}}
USER SELECTION: The user has specifically selected: {{selection}}
{{/if}}

REFERENCE MATERIALS:
{{contextDocuments}}

Please generate content that flows naturally with the existing document structure.
```

This templating system allows prompt templates to be much more sophisticated and context-aware!