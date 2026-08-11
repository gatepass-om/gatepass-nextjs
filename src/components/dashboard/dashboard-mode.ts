type AttendanceCapabilitySite = {
  id: string;
  operatorId: string;
  usesSecurityCheckpoints?: boolean;
  usesSmartAccess?: boolean;
};

export function shouldShowAttendanceAnalytics(
  sites: AttendanceCapabilitySite[],
  operatorId?: string,
  siteId?: string,
) {
  const scopedSites = siteId
    ? sites.filter((site) => site.id === siteId)
    : operatorId
      ? sites.filter((site) => site.operatorId === operatorId)
      : sites;

  return scopedSites.some((site) => site.usesSecurityCheckpoints || site.usesSmartAccess);
}
