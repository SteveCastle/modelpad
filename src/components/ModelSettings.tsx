import { useState } from "react";
import { offset, shift } from "@floating-ui/dom";
import { useQuery } from "react-query";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";

import "./ModelSettings.css";
import { providers } from "../providers";

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
        {`${model ? model : "None"}`}
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
                  {m}
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
            <input
              type="number"
              step=".01"
              value={modelSettings.mirostat_eta}
              onChange={(e) =>
                updateModelSettings({
                  mirostat_eta: parseFloat(e.target.value),
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
            <input
              type="number"
              step="1"
              value={modelSettings.mirostat_tau}
              onChange={(e) =>
                updateModelSettings({
                  mirostat_tau: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className={`setting  number-setting`}>
            <label>Temperature</label>
            <input
              type="number"
              step=".01"
              value={modelSettings.temperature}
              onChange={(e) =>
                updateModelSettings({
                  temperature: parseFloat(e.target.value),
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
            <input
              type="number"
              step=".01"
              value={modelSettings.top_p}
              onChange={(e) =>
                updateModelSettings({
                  top_p: parseFloat(e.target.value),
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
            <input
              type="number"
              step=".01"
              value={modelSettings.top_k}
              onChange={(e) =>
                updateModelSettings({
                  top_k: parseFloat(e.target.value),
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
            <input
              type="number"
              step=".01"
              value={modelSettings.repeat_penalty}
              onChange={(e) =>
                updateModelSettings({
                  repeat_penalty: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className={`setting  number-setting`}>
            <label>Generation Length</label>
            <input
              type="tel"
              pattern="-?[0-9]+"
              step="1"
              value={modelSettings.num_predict}
              onChange={(e) => {
                let value = parseInt(e.target.value);
                // if value is NaN, do nothing
                if (isNaN(value)) {
                  value = -1;
                }
                updateModelSettings({
                  num_predict: value,
                });
              }}
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
