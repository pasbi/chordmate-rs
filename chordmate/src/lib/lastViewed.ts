/**
 * How long ago a song was last viewed. Calendar terms for the recent past, where they read
 * naturally (today, yesterday, this week, last week; weeks start on Monday), then elapsed time
 * (3 weeks ago, 2 months ago, 1 year ago), which stays true across month and year boundaries.
 * Local time throughout.
 */

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
/** Up to this many weeks, the age is given in weeks; beyond, in months. */
const MOST_WEEKS = 4;

/** Days since some fixed day, for counting calendar days regardless of daylight saving time. */
function dayNumber(date: Date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** 0 on Monday … 6 on Sunday. */
function daysSinceMonday(date: Date) {
  return (date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

/** Whole months from `earlier` to `later`: 15 March to 14 May is one, to 15 May two. */
function wholeMonthsBetween(earlier: Date, later: Date) {
  const months =
    (later.getFullYear() - earlier.getFullYear()) * MONTHS_PER_YEAR +
    later.getMonth() -
    earlier.getMonth();
  return later.getDate() < earlier.getDate() ? months - 1 : months;
}

function ago(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function lastViewedLabel(viewedMs: number, now: Date) {
  const viewed = new Date(viewedMs);
  // A view in the future (another device's clock ahead) counts as today.
  const daysAgo = Math.max(dayNumber(now) - dayNumber(viewed), 0);
  const weekStartDaysAgo = daysSinceMonday(now);
  if (daysAgo === 0) {
    return "today";
  }
  if (daysAgo === 1) {
    return "yesterday";
  }
  if (daysAgo <= weekStartDaysAgo) {
    return "this week";
  }
  if (daysAgo <= weekStartDaysAgo + DAYS_PER_WEEK) {
    return "last week";
  }
  // Older than last week: at least two weeks, whatever the weekday.
  const weeks = Math.max(Math.floor(daysAgo / DAYS_PER_WEEK), 2);
  if (weeks <= MOST_WEEKS) {
    return ago(weeks, "week");
  }
  const months = Math.max(wholeMonthsBetween(viewed, now), 1);
  if (months < MONTHS_PER_YEAR) {
    return ago(months, "month");
  }
  return ago(Math.floor(months / MONTHS_PER_YEAR), "year");
}
