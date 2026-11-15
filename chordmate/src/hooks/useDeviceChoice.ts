import { useCallback, useState } from "react";

export type DeviceChoiceSetting<T extends string> = {
  storageKey: string;
  choices: readonly T[];
  defaultValue: T;
};

function readStored<T extends string>(setting: DeviceChoiceSetting<T>) {
  try {
    const stored = localStorage.getItem(setting.storageKey);
    return setting.choices.find((choice) => choice === stored) ?? setting.defaultValue;
  } catch {
    return setting.defaultValue;
  }
}

/**
 * One of a fixed set of choices, remembered in this browser (localStorage), so that each device
 * keeps its own. Falls back to the default where storage is unavailable, e.g. in a private window.
 */
export function useDeviceChoice<T extends string>(setting: DeviceChoiceSetting<T>) {
  const [value, setValueState] = useState(() => readStored(setting));
  const setValue = useCallback(
    (newValue: T) => {
      setValueState(newValue);
      try {
        localStorage.setItem(setting.storageKey, newValue);
      } catch {
        // Not remembered, but still applied for this page.
      }
    },
    [setting]
  );
  return { value, setValue };
}
