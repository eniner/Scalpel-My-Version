/** Levenshtein distance with early exit once distance exceeds `max`. */
export function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    let rowMin = dp[0]
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1
      prev = tmp
      if (dp[j] < rowMin) rowMin = dp[j]
    }
    if (rowMin > max) return max + 1
  }
  return dp[b.length]
}
