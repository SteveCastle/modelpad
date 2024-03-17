import { useState } from "react";
import { useQuery } from "react-query";
import { useFloating, useInteractions, useClick } from "@floating-ui/react";
import { useStore } from "../store";

const getModelSettings = (host: string, model: string) => async () => {
  console.log(host);
  const res = await fetch(`${host}/api/show`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: model }),
  });
  return res.json();
};

export default function ModelSettings({ model }: { model: string }) {
  const { clearContext, generationState, activeStoryId, host, cycleModel } =
    useStore((state) => state);
  useQuery({
    queryKey: ["model", host, model],
    queryFn: getModelSettings(host, model),
    onSuccess: (data) => {
      console.log(data);
    },
  });

  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
  });

  const click = useClick(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click]);

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
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <h3>Model Settings</h3>
        </div>
      )}
    </>
  );
}
