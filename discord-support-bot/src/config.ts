import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`)
  }
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: optional('DISCORD_GUILD_ID'),
  reportChannelId: required('REPORT_CHANNEL_ID'),
  modRoleId: optional('MOD_ROLE_ID'),
  modUserIds: (optional('MOD_USER_IDS') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
}
