import { useAIGeneration } from "../hooks/useAIGeneration";
import { useStore } from "../store";
import useCtrlHotkey from "../hooks/useCtrlHotkey";

interface KeyboardShortcutsPluginProps {
  isActive: boolean;
}

export function KeyboardShortcutsPlugin({
  isActive,
}: KeyboardShortcutsPluginProps): null {
  const { generate, canGenerate } = useAIGeneration();
  const activePromptTemplateId = useStore(
    (state) => state.activePromptTemplateId
  );

  // Ctrl+Space to generate new scene - only when this story is active
  useCtrlHotkey(() => {
    if (canGenerate && isActive) {
      generate(activePromptTemplateId, "");
    }
  }, " ");

  return null;
}
