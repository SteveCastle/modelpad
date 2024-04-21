import { useState } from "react";
import { offset } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";

import "./ServerSelect.css";

export default function ServerSelect() {
  const { availableServers, setServerKey } = useStore((state) => state);

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
                disabled={server.host === host}
                onClick={() => setServerKey(key)}
              >
                {server.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
