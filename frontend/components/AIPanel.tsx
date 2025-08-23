import { useState, useEffect } from "react";
import CreatableSelect from "react-select/creatable";
import { useQuery } from "react-query";
import { useStore } from "../store";
import { providers } from "../providers";
import { modelPrettyNameMap } from "../modelPrettyNameMap";
import RangeSlider from "./RangeSlider";
import {
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/solid";
import "./AIPanel.css";

type TabType = "model-settings" | "context-control" | "agent";

interface AIPanelProps {
  defaultTab?: TabType;
  onTabClick?: () => void;
}

export default function AIPanel({
  defaultTab = "model-settings",
  onTabClick,
}: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const emojiOptions = [
    "✨",
    "⚡",
    "✏️",
    "📝",
    "🔍",
    "🧠",
    "🗂️",
    "🧹",
    "🧪",
    "🧩",
    "📚",
    "💡",
    "🛠️",
    "🎯",
    "🪄",
    "🧾",
    "📈",
    "♻️",
    "🗣️",
    "🔁",
    "🪶",
  ];
  const activePromptTemplateId = useStore(
    (state) => state.activePromptTemplateId
  );
  const setActivePromptTemplate = useStore(
    (state) => state.setActivePromptTemplate
  );

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Model Settings state and logic
  const {
    model,
    changeModel,
    modelSettings,
    availableModels,
    updateModelSettings,
  } = useStore((state) => state);

  const { providerKey, host } = useStore(
    (state) => state.availableServers[state.serverKey]
  );

  const provider = providers[providerKey];
  useQuery({
    queryKey: ["model", host, model],
    queryFn: provider.getModelSettings(host, model),
    onSuccess: () => {},
  });

  const [modelsExpanded, setModelsExpanded] = useState(false);

  // Context Control state and logic
  const {
    useRag,
    setUseRag,
    promptTemplates,
    updatePromptTemplate,
    addPromptTemplate,
    deletePromptTemplate,
  } = useStore((state) => state);

  // Initialize global active prompt template if missing
  useEffect(() => {
    if (
      (!activePromptTemplateId ||
        !promptTemplates.find((t) => t.id === activePromptTemplateId)) &&
      promptTemplates.length > 0
    ) {
      setActivePromptTemplate(promptTemplates[0].id);
    }
  }, [activePromptTemplateId, promptTemplates, setActivePromptTemplate]);

  // Safety check: if promptTemplates is not an array, return early with error message
  if (!Array.isArray(promptTemplates)) {
    return (
      <div className="ai-tab-component">
        <div className="error-message">
          Error: Please refresh the page to migrate your prompt templates.
        </div>
      </div>
    );
  }

  const renderModelSettings = () => (
    <div className="model-settings-content">
      <div className="available-models">
        {availableModels.length > 1 && (
          <>
            <button
              className="toggle"
              aria-expanded={modelsExpanded}
              onClick={() => setModelsExpanded((v) => !v)}
              title={(modelPrettyNameMap[model] || model) as string}
            >
              <span className="selected-model-label">
                {modelPrettyNameMap[model] || model}
              </span>
              <span
                className={`chevron ${modelsExpanded ? "open" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {modelsExpanded &&
              availableModels.map((m) => (
                <button
                  className={m === model ? "active" : ""}
                  key={m}
                  title={modelPrettyNameMap[m] || m}
                  onClick={() => {
                    changeModel(m);
                    setModelsExpanded(false);
                  }}
                >
                  {modelPrettyNameMap[m] || m}
                </button>
              ))}
          </>
        )}
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } select-setting`}
      >
        <label>Mirostat Version</label>
        <div className="control-group">
          <button
            className="control"
            disabled={modelSettings.mirostat === 0}
            onClick={() => updateModelSettings({ mirostat: 0 })}
          >
            Off
          </button>
          <button
            className="control"
            disabled={modelSettings.mirostat === 1}
            onClick={() => updateModelSettings({ mirostat: 1 })}
          >
            1
          </button>
          <button
            className="control"
            disabled={modelSettings.mirostat === 2}
            onClick={() => updateModelSettings({ mirostat: 2 })}
          >
            2
          </button>
        </div>
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Mirostat ETA</label>
        <RangeSlider
          showLabel
          max={1}
          min={0}
          step={0.01}
          value={modelSettings.mirostat_eta}
          onChange={(v) => updateModelSettings({ mirostat_eta: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Mirostat TAU</label>
        <RangeSlider
          showLabel
          max={10}
          min={0}
          step={0.1}
          value={modelSettings.mirostat_tau}
          onChange={(v) => updateModelSettings({ mirostat_tau: v })}
        />
      </div>

      <div className="setting number-setting">
        <label>Temperature</label>
        <RangeSlider
          showLabel
          max={providerKey === "claude" ? 1 : 2}
          min={0}
          step={0.01}
          value={modelSettings.temperature}
          onChange={(v) => updateModelSettings({ temperature: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Top P</label>
        <RangeSlider
          showLabel
          max={1}
          min={0}
          step={0.01}
          value={modelSettings.top_p}
          onChange={(v) => updateModelSettings({ top_p: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Top K</label>
        <RangeSlider
          showLabel
          max={100}
          min={0}
          step={1}
          value={modelSettings.top_k}
          onChange={(v) => updateModelSettings({ top_k: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Frequency Penalty</label>
        <RangeSlider
          showLabel
          max={2}
          min={0}
          step={0.01}
          value={modelSettings.repeat_penalty}
          onChange={(v) => updateModelSettings({ repeat_penalty: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Context Length</label>
        <RangeSlider
          showLabel
          max={131072}
          min={providerKey === "claude" ? 16 : 2048}
          step={1}
          value={modelSettings.num_ctx}
          onChange={(v) => updateModelSettings({ num_ctx: v })}
        />
      </div>

      <div className="setting number-setting">
        <label>Generation Length</label>
        <RangeSlider
          showLabel
          max={4096}
          min={providerKey === "claude" ? 16 : -1}
          step={1}
          value={modelSettings.num_predict}
          onChange={(v) => updateModelSettings({ num_predict: v })}
        />
      </div>

      <div
        className={`setting ${
          providerKey === "claude" ? "hidden" : ""
        } number-setting`}
      >
        <label>Stop Words</label>
        <CreatableSelect
          isMulti
          placeholder="Add stop words..."
          value={(modelSettings.stop || []).map((s) => ({
            label: s,
            value: s,
          }))}
          onChange={(options) => {
            const next = Array.isArray(options)
              ? options.map((o) =>
                  "value" in o ? (o as { value: string }).value : ""
                )
              : [];
            updateModelSettings({ stop: next });
          }}
          onCreateOption={(inputValue) => {
            const existing = modelSettings.stop || [];
            if (!existing.includes(inputValue)) {
              updateModelSettings({ stop: [...existing, inputValue] });
            }
          }}
        />
      </div>
    </div>
  );

  const renderContextControl = () => (
    <div className="context-control-content">
      <h2>Prompt Templates</h2>
      <div className="prompt-template-section">
        <div className="prompt-tab-buttons">
          {Array.isArray(promptTemplates) &&
            promptTemplates.map((template) => (
              <button
                key={template.id}
                className={`prompt-tab-button ${
                  activePromptTemplateId === template.id ? "active" : ""
                }`}
                onClick={() => setActivePromptTemplate(template.id)}
              >
                {template.emoji && (
                  <span className="prompt-tab-emoji">{template.emoji}</span>
                )}
                <span className="prompt-tab-title">{template.name}</span>
                {promptTemplates.length > 1 && (
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePromptTemplate(template.id);
                    }}
                    title="Delete template"
                  >
                    ×
                  </button>
                )}
              </button>
            ))}
          <button
            className="prompt-tab-button add-button"
            onClick={() => {
              const newTemplate = addPromptTemplate({
                name: `Template ${promptTemplates.length + 1}`,
                systemPrompt: "You are a helpful AI assistant.",
                mainPrompt: "<text>",
              });
              setActivePromptTemplate(newTemplate.id);
            }}
            title="Add new template"
          >
            +
          </button>
        </div>

        {activePromptTemplateId &&
          Array.isArray(promptTemplates) &&
          (() => {
            const currentTemplate = promptTemplates.find(
              (t) => t.id === activePromptTemplateId
            );
            if (!currentTemplate) return null;

            return (
              <div className="prompt-editing-area">
                <div className="prompt-field">
                  <label className="prompt-label">Template Name</label>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <select
                      className="prompt-select emoji-select"
                      value={currentTemplate.emoji || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updatePromptTemplate(activePromptTemplateId, {
                          emoji: val || undefined,
                        });
                      }}
                    >
                      <option value="">None</option>
                      {emojiOptions.map((emj) => (
                        <option key={emj} value={emj}>
                          {emj}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="prompt-input"
                      style={{ flex: 1 }}
                      value={currentTemplate.name}
                      onChange={(e) => {
                        updatePromptTemplate(activePromptTemplateId, {
                          name: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="prompt-field">
                  <label className="prompt-label">System Prompt</label>
                  <textarea
                    className="prompt-textarea custom-scrollbar"
                    value={currentTemplate.systemPrompt}
                    onChange={(e) => {
                      updatePromptTemplate(activePromptTemplateId, {
                        systemPrompt: e.target.value,
                      });
                    }}
                    rows={4}
                  />
                </div>
                <div className="prompt-field">
                  <label className="prompt-label">Main Prompt Template</label>
                  <textarea
                    className="prompt-textarea custom-scrollbar"
                    value={currentTemplate.mainPrompt}
                    onChange={(e) => {
                      updatePromptTemplate(activePromptTemplateId, {
                        mainPrompt: e.target.value,
                      });
                    }}
                    rows={4}
                  />
                </div>
                <div className="prompt-field">
                  <label className="prompt-label">Insertion Strategy</label>
                  <div className="prompt-row">
                    <select
                      className="prompt-select"
                      value={
                        currentTemplate.insertionStrategy?.kind ||
                        "insert-after-node"
                      }
                      onChange={(e) => {
                        const kind = e.target.value as
                          | "replace-node"
                          | "insert-after-node"
                          | "insert-before-node"
                          | "append-inside-node"
                          | "insert-at-cursor"
                          | "replace-selection"
                          | "insert-after-selection"
                          | "insert-before-selection"
                          | "append-to-document-end";
                        const newParagraph =
                          currentTemplate.insertionStrategy?.newParagraph;
                        updatePromptTemplate(activePromptTemplateId, {
                          insertionStrategy: {
                            kind,
                            ...(kind === "insert-after-node" ||
                            kind === "insert-before-node" ||
                            kind === "insert-after-selection" ||
                            kind === "insert-before-selection"
                              ? { newParagraph: newParagraph ?? true }
                              : {}),
                          },
                        });
                      }}
                    >
                      <option value="insert-after-node">
                        Insert after node
                      </option>
                      <option value="insert-before-node">
                        Insert before node
                      </option>
                      <option value="replace-node">Replace node</option>
                      <option value="append-inside-node">
                        Append inside node
                      </option>
                      <option value="insert-at-cursor">Insert at cursor</option>
                      <option value="replace-selection">
                        Replace selection
                      </option>
                      <option value="insert-after-selection">
                        Insert after selection
                      </option>
                      <option value="insert-before-selection">
                        Insert before selection
                      </option>
                      <option value="append-to-document-end">
                        Append to document end
                      </option>
                    </select>
                    {(currentTemplate.insertionStrategy?.kind ===
                      "insert-after-node" ||
                      currentTemplate.insertionStrategy?.kind ===
                        "insert-before-node" ||
                      currentTemplate.insertionStrategy?.kind ===
                        "insert-after-selection" ||
                      currentTemplate.insertionStrategy?.kind ===
                        "insert-before-selection") && (
                      <label
                        className="prompt-inline"
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          marginLeft: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            currentTemplate.insertionStrategy?.newParagraph ??
                            true
                          }
                          onChange={(e) => {
                            const newParagraph = e.target.checked;
                            const kind =
                              currentTemplate.insertionStrategy?.kind ||
                              "insert-after-node";
                            updatePromptTemplate(activePromptTemplateId, {
                              insertionStrategy: { kind, newParagraph },
                            });
                          }}
                        />
                        New paragraph
                      </label>
                    )}
                  </div>
                  <div className="prompt-help">
                    Some strategies require a target node/selection. If missing,
                    generation may fall back to appending at the end.
                  </div>
                </div>
                <div className="prompt-info">
                  <strong>Template Variables:</strong>
                  <br />• <code>&lt;text&gt;</code> - Current/active node text
                  <br />• <code>&lt;selection&gt;</code> - Selected text (if
                  any)
                  <br />• <code>&lt;contextDocuments&gt;</code> - Context from
                  other tabs
                  <br />• <code>&lt;currentDocument&gt;</code> - Full current
                  document
                  <br />• <code>&lt;textBefore&gt;</code> - Text before current
                  section
                  <br />• <code>&lt;textAfter&gt;</code> - Text after current
                  section
                  <br />• <code>&lt;documentContext&gt;</code> - Combined
                  before/after context
                  <br />• <code>&lt;editorsNote&gt;</code> - Editor's note or
                  guidance
                  <br />
                  <br />
                </div>
              </div>
            );
          })()}
      </div>
      <div className="context-list">
        <h2 className="rag-header">Resources</h2>
        <div className="rag-section">
          <button
            className="context-item"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setUseRag(!useRag);
            }}
          >
            <div>
              <span className="context-name">Library</span>
            </div>
            <span className="context-edit">
              {useRag ? (
                <CheckCircleIcon aria-hidden="true" className="check-icon" />
              ) : (
                <XCircleIcon className="x-icon" />
              )}
            </span>
          </button>

          <button
            className="context-item"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // TODO: Implement internet toggle functionality
            }}
          >
            <div>
              <span className="context-name">Internet</span>
            </div>
            <span className="context-edit">
              <XCircleIcon className="x-icon" />
            </span>
          </button>

          <button
            className="context-item"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // TODO: Implement add MCP server functionality
            }}
          >
            <div>
              <span className="context-name">Add MCP Server</span>
            </div>
            <span className="context-edit">
              <span style={{ fontSize: "14px", opacity: 0.7 }}>+</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAgent = () => (
    <div className="agent-content">
      <div className="chat-header">
        <span className="coming-soon-badge">Coming Soon</span>
      </div>

      <div className="coming-soon-content">
        <div className="coming-soon-icon">🤖</div>
        <h4>AI Agent Feature Coming Soon!</h4>
        <p>
          The AI Agent will be your intelligent writing companion, capable of:
        </p>
        <ul className="feature-list">
          <li>Conversational assistance with your writing projects</li>
          <li>Real-time suggestions and feedback</li>
          <li>Context-aware responses based on your current work</li>
          <li>Advanced writing techniques and style guidance</li>
        </ul>
        <div className="preview-note">
          This is a preview of the upcoming agent interface. Stay tuned for the
          full release!
        </div>
      </div>

      <div className="chat-input-container disabled">
        <div className="chat-input-wrapper">
          <textarea
            value=""
            placeholder="AI Agent chat will be available soon..."
            className="chat-input"
            rows={2}
            disabled
            readOnly
          />
          <button disabled className="send-button disabled">
            <PaperAirplaneIcon className="send-icon" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ai-tab-component">
      <div className="tab-navigation">
        <button
          className={`tab-button ${
            activeTab === "model-settings" ? "active" : ""
          }`}
          onClick={() => {
            if (activeTab === "model-settings" && onTabClick) {
              onTabClick();
            } else {
              setActiveTab("model-settings");
            }
          }}
        >
          Model
        </button>
        <button
          className={`tab-button ${
            activeTab === "context-control" ? "active" : ""
          }`}
          onClick={() => {
            if (activeTab === "context-control" && onTabClick) {
              onTabClick();
            } else {
              setActiveTab("context-control");
            }
          }}
        >
          Context
        </button>
        <button
          className={`tab-button ${activeTab === "agent" ? "active" : ""}`}
          onClick={() => {
            if (activeTab === "agent" && onTabClick) {
              onTabClick();
            } else {
              setActiveTab("agent");
            }
          }}
        >
          Agent
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "model-settings" && renderModelSettings()}
        {activeTab === "context-control" && renderContextControl()}
        {activeTab === "agent" && renderAgent()}
      </div>
    </div>
  );
}
