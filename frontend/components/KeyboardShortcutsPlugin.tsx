import { useAIGeneration } from "../hooks/useAIGeneration";
import useCtrlHotkey from "../hooks/useCtrlHotkey";

export function KeyboardShortcutsPlugin(): null {
  const { generate, canGenerate } = useAIGeneration();

  // Ctrl+Space to generate new scene
  useCtrlHotkey(() => {
    if (canGenerate) {
      generate("newScene", "", { action: "generate" });
    }
  }, " ");

  return null;
}
