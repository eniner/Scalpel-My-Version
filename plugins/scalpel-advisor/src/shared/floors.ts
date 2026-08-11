/** Multi-currency floor listings used by bundled EV snapshots. */

export type Floor = {
  chaos?: number | null
  divine?: number | null
  mirror?: number | null
  exalted?: number | null
  gcp?: number | null
}

/** Pick the cheapest chaos-equivalent among listed floor units. */
export function floorToChaos(floor: Floor | null | undefined, cpd: number, mirrorDiv = 380): number | null {
  if (!floor) return null
  const candidates: number[] = []
  if (floor.chaos != null) candidates.push(floor.chaos)
  if (floor.divine != null) candidates.push(floor.divine * cpd)
  if (floor.mirror != null) candidates.push(floor.mirror * cpd * mirrorDiv)
  if (floor.gcp != null) candidates.push(floor.gcp)
  if (!candidates.length) return null
  return Math.min(...candidates)
}
