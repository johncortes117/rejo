import { formatInTimeZone } from "date-fns-tz";

export const FARM_TIMEZONE = "America/Guayaquil";

export const toBusinessDate = (
  instant: Date | number,
  timezone = FARM_TIMEZONE
): string => formatInTimeZone(instant, timezone, "yyyy-MM-dd");

export const toBusinessTime = (
  instant: Date | number,
  timezone = FARM_TIMEZONE
): string => formatInTimeZone(instant, timezone, "HH:mm");

export const nowInFarmTimezone = (instant = new Date()) => ({
  date: toBusinessDate(instant),
  time: toBusinessTime(instant)
});
