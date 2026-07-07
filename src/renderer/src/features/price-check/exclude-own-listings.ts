/** Drop trade listings owned by the logged-in account when the user opts in. */
export function filterOwnListings<T extends { account: string }>(
  listings: readonly T[],
  accountName: string | undefined,
  exclude: boolean,
): T[] {
  if (!exclude || !accountName) return [...listings]
  const mine = accountName.toLowerCase()
  return listings.filter((l) => l.account.toLowerCase() !== mine)
}
