import { useState } from "react";
import { offset, shift } from "@floating-ui/dom";
import { useQuery } from "react-query";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";

import "./ModelSettings.css";
import { providers } from "../providers";
import { modelPrettyNameMap } from "../modelPrettyNameMap";
import RangeSlider from "./RangeSlider";

export default function ModelSettings({ model }: { model: string }) {
  const {
    clearContext,
    generationState,
    activeStoryId,
    cycleModel,
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

  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), shift()],
  });

  const click = useClick(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click]);

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  return (
    <>
      <button
        className={`model ${generationState}`}
        onContextMenu={(e) => {
          e.preventDefault();
          clearContext(activeStoryId);
          cycleModel();
        }}
        disabled={generationState !== "ready"}
        {...getReferenceProps()}
        ref={refs.setReference}
      >
        {`${model ? modelPrettyNameMap[model] || model : "None"}`}
      </button>
      {isOpen && (
        <div
          className="ModelSettings"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
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
              onChange={(v) =>
                updateModelSettings({
                  mirostat_eta: v,
                })
              }
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
              onChange={(v) =>
                updateModelSettings({
                  mirostat_tau: v,
                })
              }
            />
          </div>
          <div className={`setting  number-setting`}>
            <label>Temperature</label>
            <RangeSlider
              showLabel
              max={2}
              min={0}
              step={0.01}
              value={modelSettings.temperature}
              onChange={(v) =>
                updateModelSettings({
                  temperature: v,
                })
              }
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
              onChange={(v) =>
                updateModelSettings({
                  top_p: v,
                })
              }
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
              onChange={(v) =>
                updateModelSettings({
                  top_k: v,
                })
              }
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
              onChange={(v) =>
                updateModelSettings({
                  repeat_penalty: v,
                })
              }
            />
          </div>
          <div className={`setting  number-setting`}>
            <label>Generation Length</label>
            <RangeSlider
              showLabel
              max={2048}
              min={-1}
              step={1}
              value={modelSettings.num_predict}
              onChange={(v) =>
                updateModelSettings({
                  num_predict: v,
                })
              }
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
                updateModelSettings({
                  stop: [value],
                });
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
