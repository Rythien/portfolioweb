/**
 * Obstacle and pickup definitions plus the spawn tables. Pure data and
 * pure functions; the engine owns when rows spawn.
 */

export type RowKind = "ice" | "shards";

export interface Row {
  id: number;
  kind: RowKind;
  /** World y of the row's centre line. */
  y: number;
}
