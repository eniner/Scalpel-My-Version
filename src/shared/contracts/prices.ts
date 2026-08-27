export interface PriceInfo {
  chaosValue: number
  divineValue?: number
  dustValue?: number
  graph?: (number | null)[]
  ninjaCategory?: string
}

export interface PriceEntry {
  name: string
  category: string
  chaosValue: number
  divineValue?: number
  graph?: (number | null)[]
  /** Absolute CDN icon URL when known (poe.ninja image or bundled icon map). */
  icon?: string
  /** poe.ninja's raw overview type for this entry ('DivinationCard', 'Ritual').
   *  Distinct from `category`, which is the kebab URL segment. */
  ninjaType?: string
}
