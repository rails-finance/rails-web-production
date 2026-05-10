// Barrel re-export of the canonical event-shape types.
//
// rails-explorer-derived components (LiquityEventCard, EventCard, SpineColumn,
// etc.) were copied verbatim into rails-web-mig and import from this path.
// To avoid touching every import, this file re-exports the same names from
// our canonical wire-format file `event-shape.ts`.
//
// If new protocols or arms get added to event-shape.ts, mirror the export
// here so consumers picked up by the rails-explorer-style imports keep working.

export type {
  AssetFlow,
  GasCost,
  BlockGrouping,
  ProtocolId,
  ProtocolContext,
  BaseActivityEvent,
  ActivityTimeline,
  OtherContext,
} from "./event-shape";

export { isLiquityEvent, isAaveV4Event } from "./event-shape";
