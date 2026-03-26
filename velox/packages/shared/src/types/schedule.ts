export interface ScheduleOverride {
  id: string;
  placementId: string;
  videoId: string;
  startAt: string;
  endAt: string;
  priority: number;
  createdAt: string;
  createdBy: string;
}

export interface CreateScheduleOverrideInput {
  placementId: string;
  videoId: string;
  startAt: string;
  endAt: string;
  priority?: number;
}
