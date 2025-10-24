import { useEffect, useState } from "react";

export function useIsDesktop(breakpointPx: number = 768): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return true;
    }
    return window.matchMedia(`(min-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mediaQuery = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const listener = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };
    // In case of Safari <14 support, use addListener/removeListener fallback
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
    } else if (typeof (mediaQuery as any).addListener === "function") {
      (mediaQuery as any).addListener(listener);
    }
    // Set initial state in effect to cover hydration cases
    setIsDesktop(mediaQuery.matches);
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", listener);
      } else if (typeof (mediaQuery as any).removeListener === "function") {
        (mediaQuery as any).removeListener(listener);
      }
    };
  }, [breakpointPx]);

  return isDesktop;
}
