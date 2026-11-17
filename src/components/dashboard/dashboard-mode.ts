type AttendanceOperatingModes = {
  checkpointSites: number;
  smartAccessSites: number;
};

export function shouldShowAttendanceAnalytics(modes?: AttendanceOperatingModes | null) {
  return !!modes && (modes.checkpointSites > 0 || modes.smartAccessSites > 0);
}
