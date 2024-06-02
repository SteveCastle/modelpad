import { useState } from "react";
import { offset } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { PencilIcon } from "@heroicons/react/24/solid";

import "./ServerSelect.css";

export default function ServerSelect() {
  const [editing, setEditing] = useState(false);
  const { availableServers, setServerKey, setServerName, setServerHost } =
    useStore((state) => state);

  const { host, name } = useStore(
    (state) => state.availableServers[state.serverKey]
  );

  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10)],
  });

  const click = useClick(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click]);

  useOnClickOutside(refs.floating, () => {
    setIsOpen(false);
  });

  return (
    <>
      <button
        className="server-button"
        {...getReferenceProps()}
        ref={refs.setReference}
      >
        {name}
      </button>
      {isOpen && (
        <div
          className="ServerSelect"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <h2>Server Select</h2>
          <div className="server-list free-servers">
            {Object.entries(availableServers).map(([key, server]) => (
              <button
                className={`server ${server.host === host ? "active" : ""}`}
                key={server.host}
                onClick={() => setServerKey(key)}
              >
                <div>
                  <span className="server-name">
                    {server.providerKey === "claude"
                      ? server.name
                      : `${server.name} (${server.host})`}
                  </span>
                  <span className="server-info">
                    {server.providerKey === "ollama" ? (
                      <a
                        href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama"
                        target="_blank"
                      >
                        Add https://modelpad.app to your OLLAMA_ORIGINS env
                        variable.
                      </a>
                    ) : (
                      "The Cloud Free tier includes free access to the Anthropic Claude 3 Haiku AI model."
                    )}
                  </span>
                </div>
                {server.providerKey === "ollama" && (
                  <span
                    className="server-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log("setting editing state");
                      setEditing(!editing);
                    }}
                  >
                    <PencilIcon aria-hidden="true" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {editing && (
            <div className="server-edit-form">
              <input
                type="text"
                value={availableServers.localOllama.name}
                onChange={(e) => setServerName(e.currentTarget.value)}
                placeholder="Local Ollama Server"
              />
              <input
                type="text"
                value={availableServers.localOllama.host}
                onChange={(e) => setServerHost(e.currentTarget.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
