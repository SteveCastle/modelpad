import { useState } from "react";
import { useQuery } from "react-query";
import { useStore } from "../store";
import { providers } from "../providers";
import { modelPrettyNameMap } from "../modelPrettyNameMap";
import RangeSlider from "./RangeSlider";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import "./RightPanel.css";

type TabType = "model-settings" | "context-control" | "agent";

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("model-settings");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm your AI assistant. I can help you with writing, editing, and creative tasks. How can I assist you today?",
      sender: "assistant",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: "2",
      content:
        "Can you help me write a short story about a robot discovering emotions?",
      sender: "user",
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
    },
    {
      id: "3",
      content:
        "I'd be happy to help you write that story! Here's a beginning:\n\nZyx-47 processed the morning protocols with mechanical precision, as it had done for 3,247 consecutive days. But today, something was different. A subtle variance in its neural pathways triggered an unfamiliar subroutine—one that hadn't been programmed by its creators.\n\nWould you like me to continue, or would you prefer to take the story in a different direction?",
      sender: "assistant",
      timestamp: new Date(Date.now() - 1 * 60 * 1000),
    },
  ]);

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
  const { stories, setIncludeInContext, useRag, setUseRag } = useStore(
    (state) => state
  );

  const sortedStories = [...stories].sort((a, b) => {
    if (a.id === activeStoryId) return -1;
    if (b.id === activeStoryId) return 1;
    return 0;
  });

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: chatInput,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setChatInput("");

    // Mock AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I understand your request. Let me help you with that...",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return timestamp.toLocaleDateString();
  };

  const renderModelSettings = () => (
    <div className="model-settings-content">
      <h3>Model Settings</h3>
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
              <span className="context-name">
                {story.id === activeStoryId
                  ? `${story.title} (Active Tab)`
                  : story.title}
              </span>
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

        <h2 className="rag-header">Library</h2>
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
              <span className="context-name">
                Automatically Use Related Docs
              </span>
            </div>
            <span className="context-edit">
              {useRag ? (
                <CheckCircleIcon aria-hidden="true" className="check-icon" />
              ) : (
                <XCircleIcon className="x-icon" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAgent = () => (
    <div className="agent-content">
      <div className="chat-header">
        <h3>AI Agent</h3>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.sender === "user" ? "user-message" : "assistant-message"
            }`}
          >
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-timestamp">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask the AI agent for help..."
            className="chat-input"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!chatInput.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="right-panel-component">
      <div className="tab-navigation">
        <button
          className={`tab-button ${
            activeTab === "model-settings" ? "active" : ""
          }`}
          onClick={() => setActiveTab("model-settings")}
        >
          Model Settings
        </button>
        <button
          className={`tab-button ${
            activeTab === "context-control" ? "active" : ""
          }`}
          onClick={() => setActiveTab("context-control")}
        >
          Context Control
        </button>
        <button
          className={`tab-button ${activeTab === "agent" ? "active" : ""}`}
          onClick={() => setActiveTab("agent")}
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
