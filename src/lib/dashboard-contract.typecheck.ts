import type { DashboardSummary } from './api';

declare const summary: DashboardSummary;

// Compile-time contract checks for the operational dashboard. This file emits no
// runtime JavaScript; TypeScript fails if the API shape drifts from the UI needs.
summary.generatedAtUtc satisfies string;
summary.window.fromUtc satisfies string;
summary.window.toUtc satisfies string;
summary.movements.total satisfies number;
summary.workforce.readinessRate satisfies number;
summary.expiry.next7Days satisfies number;
summary.actionQueue[0]?.applicable satisfies boolean | undefined;
summary.operatingModes.complianceOnlySites satisfies number;
summary.audience.visiblePanels satisfies string[];
summary.audience.profileKey satisfies string;
summary.audience.metricKeys satisfies string[];
summary.audience.panelKeys satisfies string[];
summary.contractorScorecards[0]?.readinessRate satisfies number | undefined;
summary.projectScorecards[0]?.activeWorkPasses satisfies number | undefined;
summary.competencies.expired satisfies number;
summary.cards.missing satisfies number;
summary.adoption.privacySuppressed satisfies boolean;
summary.adoption.assistedWorkflowWorkers satisfies number | null;
summary.dataQuality.profileCompletenessRate satisfies number;
summary.trends[0]?.movements satisfies number | undefined;
summary.comparison.currentMovements satisfies number;
summary.turnaround.approvals.medianHours satisfies number | null;
summary.turnaround.onboarding.p90Hours satisfies number | null;
summary.peakOccupancy.total satisfies number;
summary.peakOccupancy.sites[0]?.peakAtUtc satisfies string | null | undefined;
summary.attendance.expectedWorkers satisfies number;
summary.attendance.rosters[0]?.absentWorkers satisfies number | undefined;
summary.capacity.occupancyRate satisfies number;
summary.bottlenecks[0]?.overdueCount satisfies number | undefined;
