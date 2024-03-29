import { useState } from "react";
import { offset } from "@floating-ui/dom";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";
import { useOnClickOutside } from "../hooks/useOnClickOutside";

import "./ServerSelect.css";

export default function ServerSelect() {
  const { host, availableServers, setHost } = useStore((state) => state);

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
        {host}
      </button>
      {isOpen && (
        <div
          className="ServerSelect"
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <h2>Server Select</h2>
          <h3>Free Servers</h3>
          <div className="server-list free-servers">
            {availableServers.free.map((server) => (
              <button
                className={`server ${server.host === host ? "active" : ""}`}
                key={server.host}
                disabled={server.host === host}
                onClick={() => setHost(server.host, server.providerKey)}
              >
                {server.name}
              </button>
            ))}
          </div>
          <h3>My Servers</h3>
          <div className="server-list my-servers">
            {availableServers.my.map((server) => (
              <button
                key={server.host}
                className={`server ${server.host === host ? "active" : ""}`}
                disabled={server.host === host}
                onClick={() => setHost(server.host, server.providerKey)}
              >
                {server.name}
              </button>
            ))}
          </div>
          <h3>Hosted Servers</h3>
          <div className=" server-list hosted-servers">
            {availableServers.hosted.map((server) => (
              <div className="server" key={server.host}>
                {server.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
