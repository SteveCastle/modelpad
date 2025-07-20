import { useState, useEffect } from "react";
import { useQuery } from "react-query";
import { useStore, PromptTypeKeys } from "../store";
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
type PromptEditTab = PromptTypeKeys | null;

interface AIPanelProps {
  defaultTab?: TabType;
  onTabClick?: () => void;
}

export default function AIPanel({
  defaultTab = "model-settings",
  onTabClick,
}: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [activePromptTab, setActivePromptTab] =
    useState<PromptEditTab>("newScene");

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Model Settings state and logic
  const {
    model,
    activeStoryId,
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

  // Context Control state and logic
  const {
    stories,
    setIncludeInContext,
    useRag,
    setUseRag,
    promptTemplates,
    systemPromptTemplates,
    ragPromptTemplates,
    changePromptTemplate,
    changeSystemPromptTemplate,
    changeRagPromptTemplate,
  } = useStore((state) => state);

  const sortedStories = [...stories].filter(
    (story) => story.id !== activeStoryId
  );

  const renderModelSettings = () => (
    <div className="model-settings-content">
      <div className="available-models">
        {availableModels.length > 1 &&
          availableModels.map((m) => (
            <button
              className={m === model ? "active" : ""}
              key={m}
              onClick={() => {
                changeModel(m);
              }}
            >
              {modelPrettyNameMap[m] || m}
            </button>
          ))}
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
        <label>Stop Word</label>
        <input
          type="text"
          value={modelSettings.stop}
          onChange={(e) => {
            const value = e.target.value;
            updateModelSettings({ stop: [value] });
          }}
        />
      </div>
    </div>
  );

  const renderContextControl = () => (
    <div className="context-control-content">
      <h2>Tabs</h2>
      <div className="context-list">
        {sortedStories.map((story) => (
          <button
            className="context-item"
            key={story.id}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIncludeInContext(story.id, !story.includeInContext);
            }}
          >
            <div>
              <span className="context-name">{story.title}</span>
            </div>
            <span className="context-edit">
              {story.includeInContext ? (
                <CheckCircleIcon aria-hidden="true" className="check-icon" />
              ) : (
                <XCircleIcon className="x-icon" />
              )}
            </span>
          </button>
        ))}

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

      <h2>Prompt Templates</h2>
      <div className="prompt-template-section">
        <div className="prompt-tab-buttons">
          <button
            className={`prompt-tab-button ${
              activePromptTab === "newScene" ? "active" : ""
            }`}
            onClick={() => setActivePromptTab("newScene")}
          >
            New Scene
          </button>
          <button
            className={`prompt-tab-button ${
              activePromptTab === "rewrite" ? "active" : ""
            }`}
            onClick={() => setActivePromptTab("rewrite")}
          >
            Rewrite
          </button>
          <button
            className={`prompt-tab-button ${
              activePromptTab === "summarize" ? "active" : ""
            }`}
            onClick={() => setActivePromptTab("summarize")}
          >
            Summarize
          </button>
        </div>

        {activePromptTab && (
          <div className="prompt-editing-area">
            <div className="prompt-field">
              <label className="prompt-label">System Prompt</label>
              <textarea
                className="prompt-textarea custom-scrollbar"
                value={systemPromptTemplates[activePromptTab]}
                onChange={(e) => {
                  changeSystemPromptTemplate(activePromptTab, e.target.value);
                }}
                rows={4}
              />
            </div>
            <div className="prompt-field">
              <label className="prompt-label">RAG Prefix</label>
              <textarea
                className="prompt-textarea custom-scrollbar"
                value={ragPromptTemplates[activePromptTab]}
                onChange={(e) => {
                  changeRagPromptTemplate(activePromptTab, e.target.value);
                }}
                rows={3}
              />
            </div>
            <div className="prompt-field">
              <label className="prompt-label">Main Prompt Template</label>
              <textarea
                className="prompt-textarea custom-scrollbar"
                value={promptTemplates[activePromptTab]}
                onChange={(e) => {
                  changePromptTemplate(activePromptTab, e.target.value);
                }}
                rows={4}
              />
            </div>
            <div className="prompt-info">
              <strong>Selected Text:</strong> &lt;text&gt;
              <br />
              <strong>RAG Docs:</strong> &lt;docs&gt;
            </div>
          </div>
        )}
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
