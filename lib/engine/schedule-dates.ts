/**
 * Turns a show start date plus the day-count schedule into an ordered list of
 * calendar dates for the whole engagement, assuming contiguous days in the
 * order setup -> rehearsal -> show -> strike (the standard production
 * sequence). Used to auto-detect which days fall on a weekend for the
 * Stagehand weekend surcharge — nothing else in the schedule is date-aware.
 */
export function buildEngagementDates(
  showStartDate: Date,
  schedule: { setupDays: number; rehearsalDays: number; showDays: number; strikeDays: number },
): Date[] {
  const preShowDays = schedule.setupDays + schedule.rehearsalDays;
  const start = new Date(showStartDate);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - preShowDays);

  const totalDays = preShowDays + schedule.showDays + schedule.strikeDays;
  const dates: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function countWeekendDays(dates: Date[]): number {
  return dates.filter(isWeekend).length;
}
