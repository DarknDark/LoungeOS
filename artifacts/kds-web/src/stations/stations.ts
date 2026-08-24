// Client-side station list for the KDS station picker. There is no
// GET /v1/staff/preparation-stations endpoint (deliberately not built —
// see Phase 4 Checkpoint 2's plan) and no PreparationStation Firestore
// documents currently exist; the system already works purely off plain
// station-ID strings (MenuItem.preparationStationId,
// KitchenTicket.stationId), so this config list is sufficient without any
// backend dependency.
export type StationConfig = {
  id: string;
  name: string;
};

export const STATIONS: StationConfig[] = [
  { id: "kitchen", name: "Kitchen" },
  { id: "bar", name: "Bar" },
];

export function findStation(stationId: string): StationConfig | undefined {
  return STATIONS.find((station) => station.id === stationId);
}
