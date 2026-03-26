import { useState } from 'react';
import { Calendar, Clock, Film } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { usePlacements, usePlacementOverrides } from '@/hooks/use-placements';

export function SchedulingPage() {
  const { data: placementsData } = usePlacements();
  const placements = placementsData?.data || [];
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | undefined>();
  const { data: overridesData } = usePlacementOverrides(selectedPlacementId);
  const overrides = overridesData?.data || [];

  // Build a simple 7-day timeline
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      <PageHeader
        title="Scheduling"
        description="View and manage scheduled content across placements"
      />

      {/* Placement filter */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={selectedPlacementId || ''}
          onChange={(e) => setSelectedPlacementId(e.target.value || undefined)}
          className="bg-velox-surface border border-velox-border rounded-lg px-3 py-2 text-sm text-velox-text-primary focus:outline-none focus:border-velox-accent"
        >
          <option value="">All Placements</option>
          {placements.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div className="bg-velox-surface rounded-xl border border-velox-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-velox-border">
          {days.map((day, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 text-center border-r border-velox-border last:border-r-0 ${
                i === 0 ? 'bg-velox-accent-muted' : ''
              }`}
            >
              <p className="text-[10px] font-mono text-velox-text-muted uppercase">
                {day.toLocaleDateString('en-AU', { weekday: 'short' })}
              </p>
              <p className={`text-sm font-medium ${i === 0 ? 'text-velox-accent' : ''}`}>
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div className="min-h-[300px] grid grid-cols-7">
          {days.map((day, i) => {
            const dayStr = day.toISOString().split('T')[0];
            const dayOverrides = overrides.filter((o) => {
              const start = o.startAt.split('T')[0];
              const end = o.endAt.split('T')[0];
              return dayStr >= start && dayStr <= end;
            });

            return (
              <div key={i} className="border-r border-velox-border last:border-r-0 p-2 space-y-1.5">
                {dayOverrides.map((o) => (
                  <div
                    key={o.id}
                    className="bg-velox-accent-muted border border-velox-accent/20 rounded-md p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Film className="w-3 h-3 text-velox-accent" />
                      <span className="text-[10px] font-mono text-velox-accent truncate">
                        {o.videoId.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-velox-text-muted">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(o.startAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {overrides.length === 0 && (
        <div className="mt-6 text-center">
          <Calendar className="w-8 h-8 text-velox-text-muted mx-auto mb-2" />
          <p className="text-sm text-velox-text-secondary">
            No scheduled overrides. Create them from the Placements page.
          </p>
        </div>
      )}
    </div>
  );
}
