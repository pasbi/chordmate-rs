import { type DeviceNumberSetting, useDeviceNumber } from "./useDeviceNumber";

const SHEET_FONT_SIZE: DeviceNumberSetting = {
  storageKey: "chordmate.sheetFontSize",
  defaultValue: 16,
  min: 10,
  max: 40,
};
export const MIN_SHEET_FONT_SIZE = SHEET_FONT_SIZE.min;
export const MAX_SHEET_FONT_SIZE = SHEET_FONT_SIZE.max;

/** Font size of the chord sheet in px, remembered per device. */
export function useSheetFontSize() {
  const { value: fontSize, setValue: setFontSize } = useDeviceNumber(SHEET_FONT_SIZE);
  return { fontSize, setFontSize };
}
