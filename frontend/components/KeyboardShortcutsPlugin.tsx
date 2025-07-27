import { useAIGeneration } from "../hooks/useAIGeneration";
import useCtrlHotkey from "../hooks/useCtrlHotkey";

interface KeyboardShortcutsPluginProps {
  isActive: boolean;
}

export function KeyboardShortcutsPlugin({
  isActive,
}: KeyboardShortcutsPluginProps): null {
  const { generate, canGenerate } = useAIGeneration();

  // Ctrl+Space to generate new scene - only when this story is active
  useCtrlHotkey(() => {
    if (canGenerate && isActive) {
      generate("newScene", "", { action: "generate" });
    }
  }, " ");

  return null;
}
