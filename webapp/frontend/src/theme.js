import { useEffect, useState } from "react";

// Tracks the OS light/dark preference so charts can be handed concrete hex
// values (SVG presentation attributes don't resolve CSS var()).
export function useDarkMode() {
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return dark;
}

// Validated palette (dataviz reference instance), stepped per mode.
export function chartColors(dark) {
  return dark
    ? {
        temp: "#d95926", // orange, dark step
        humidity: "#3987e5", // blue, dark step
        grid: "#2c2c2a",
        axis: "#383835",
        muted: "#898781",
        surface: "#1a1a19",
        text: "#c3c2b7",
      }
    : {
        temp: "#eb6834", // orange, light step
        humidity: "#2a78d6", // blue, light step
        grid: "#e1e0d9",
        axis: "#c3c2b7",
        muted: "#898781",
        surface: "#fcfcfb",
        text: "#52514e",
      };
}
