import { useCallback, useState } from "react";

export type DeviceNumberSetting = {
  storageKey: string;
  defaultValue: number;
  min: number;
  max: number;
};

function clamp(value: number, { min, max }: DeviceNumberSetting) {
  return Math.min(Math.max(Math.round(value), min), max);
}

function readStored(setting: DeviceNumberSetting) {
  try {
    const stored = localStorage.getItem(setting.storageKey);
    const value = Number(stored);
    return stored !== null && Number.isFinite(value) ? clamp(value, setting) : setting.defaultValue;
  } catch {
    return setting.defaultValue;
  }
}

/**
 * An integer setting remembered in this browser (localStorage), so that each device keeps its own
 * value. Falls back to the default where storage is unavailable, e.g. in a private window.
 */
export function useDeviceNumber(setting: DeviceNumberSetting) {
  const [value, setValueState] = useState(() => readStored(setting));
  const setValue = useCallback(
    (newValue: number) => {
      const clamped = clamp(newValue, setting);
      setValueState(clamped);
      try {
        localStorage.setItem(setting.storageKey, String(clamped));
      } catch {
        // Not remembered, but still applied for this page.
      }
    },
    [setting]
  );
  return { value, setValue };
}
