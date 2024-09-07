import { useEffect, useCallback } from "react";

const useCtrlHotkey = (callback, key: string) => {
  const handleKeyDown = useCallback(
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === key) {
        event.preventDefault();
        callback();
      }
    },
    [callback, key]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useCtrlHotkey;
