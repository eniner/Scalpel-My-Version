import {
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type ModalSubmitInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js'
import { config } from './config.js'
import { buildModActionRow, buildReportEmbed, readReportFields } from './embeds.js'
import { CUSTOM_IDS, isReportType, type ReportType } from './report-types.js'

function parseModalType(customId: string): ReportType | null {
  const prefix = 'scalpel_report_modal:'
  if (!customId.startsWith(prefix)) return null
  const type = customId.slice(prefix.length)
  return isReportType(type) ? type : null
}

function errorCode(err: unknown): number | null {
  return typeof err === 'object' && err && 'code' in err ? Number(err.code) : null
}

export function memberCanModerate(member: GuildMember | null, userId: string): boolean {
  if (!member) {
    return config.modUserIds.includes(userId)
  }

  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return true
  }

  if (config.modRoleId && member.roles.cache.has(config.modRoleId)) {
    return true
  }

  return config.modUserIds.includes(userId)
}

export async function handleReportModal(
  interaction: ModalSubmitInteraction,
  client: Client,
): Promise<void> {
  // Acknowledge within 3s so channel lookups / posts can't expire the interaction.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const type = parseModalType(interaction.customId)
  if (!type) {
    await interaction.editReply({ content: 'Could not read report type from this form.' })
    return
  }

  const fields = readReportFields(interaction)

  let channel
  try {
    channel = await client.channels.fetch(config.reportChannelId)
  } catch (err) {
    console.error('Report channel fetch failed:', err)
    const code = errorCode(err)
    const hint =
      code === 50001
        ? [
            `I can't access the report channel (\`${config.reportChannelId}\`).`,
            '',
            'In Discord: right-click that channel → **Edit Channel** → **Permissions**',
            '→ **Add members or roles** → **Scalpel Support** → enable:',
            '• View Channel',
            '• Send Messages',
            '• Embed Links',
            '• Read Message History',
            '',
            'Then save and run `/report` again.',
          ].join('\n')
        : 'Report channel is misconfigured. Ask a server admin to check `REPORT_CHANNEL_ID`.'
    await interaction.editReply({ content: hint })
    return
  }

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.editReply({
      content:
        'Report channel is misconfigured. Set `REPORT_CHANNEL_ID` to a text channel the bot can post in.',
    })
    return
  }

  const embed = buildReportEmbed(type, fields, interaction.user, 'open')
  const components = [buildModActionRow('open')]
  const mention = config.modRoleId ? `<@&${config.modRoleId}>` : undefined

  try {
    const posted = await channel.send({
      content: mention,
      embeds: [embed],
      components,
      allowedMentions: config.modRoleId ? { roles: [config.modRoleId] } : { parse: [] },
    })

    await interaction.editReply({
      content: [
        `Thanks — your **${type}** report was sent to the Scalpel mod team.`,
        `Mod inbox message: ${posted.url}`,
        '',
        'You do not need to do anything else unless a mod replies.',
      ].join('\n'),
    })
  } catch (err) {
    console.error('Failed to post report:', err)
    const code = errorCode(err)
    const hint =
      code === 50001 || code === 50013
        ? 'I can see the report channel but lack **Send Messages** / **Embed Links**. Add those for the **Scalpel Support** role on that channel, then try again.'
        : 'Failed to post the report. Please try again or ping a mod.'
    await interaction.editReply({ content: hint })
  }
}

function parseFooter(embedFooter: string | null | undefined): {
  type: ReportType
  reporterId: string | null
} {
  // Footer format: "Scalpel Support · bug · 123456789012345678"
  const parts = embedFooter?.split('·').map((p) => p.trim()) ?? []
  const typePart = parts[1]
  const reporterId = parts[2] && /^\d+$/.test(parts[2]) ? parts[2] : null
  const type = typePart && isReportType(typePart) ? typePart : 'issue'
  return { type, reporterId }
}

function extractFieldsFromEmbed(interaction: ButtonInteraction) {
  const embed = interaction.message.embeds[0]
  if (!embed) {
    throw new Error('Missing report embed')
  }

  const field = (name: string) => {
    const raw = embed.fields.find((f) => f.name === name)?.value ?? ''
    return raw === '_Not provided_' ? '' : raw
  }

  const colon = embed.title?.indexOf(': ') ?? -1
  const title = colon >= 0 && embed.title ? embed.title.slice(colon + 2) : (embed.title ?? 'Untitled')
  const { type, reporterId } = parseFooter(embed.footer?.text)

  return {
    type,
    reporterId,
    fields: {
      title,
      description: embed.description ?? '',
      steps: field('Steps to reproduce'),
      expected: field('Expected vs actual'),
      environment: field('Environment'),
    },
  }
}

async function requireMod(interaction: ButtonInteraction): Promise<boolean> {
  const member =
    interaction.member && 'roles' in interaction.member
      ? (interaction.member as GuildMember)
      : null

  if (memberCanModerate(member, interaction.user.id)) {
    return true
  }

  await interaction.reply({
    content: 'Only Scalpel mods (or members with Manage Messages) can update report status.',
    flags: MessageFlags.Ephemeral,
  })
  return false
}

export async function handleModButton(interaction: ButtonInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return

  const parsed = extractFieldsFromEmbed(interaction)

  let reporter = interaction.user
  if (parsed.reporterId) {
    try {
      reporter = await interaction.client.users.fetch(parsed.reporterId)
    } catch {
      // Fall back to the interacting user if the reporter left Discord
    }
  }

  let status: 'open' | 'claimed' | 'resolved' = 'open'
  let claimedBy = null as typeof interaction.user | null

  if (interaction.customId === CUSTOM_IDS.claim) {
    status = 'claimed'
    claimedBy = interaction.user
  } else if (interaction.customId === CUSTOM_IDS.resolve) {
    status = 'resolved'
    claimedBy = interaction.user
  } else if (interaction.customId === CUSTOM_IDS.reopen) {
    status = 'open'
    claimedBy = null
  } else {
    await interaction.reply({
      content: 'Unknown action.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const embed = buildReportEmbed(parsed.type, parsed.fields, reporter, status, claimedBy)
  await interaction.update({
    embeds: [embed],
    components: [buildModActionRow(status)],
  })
}
