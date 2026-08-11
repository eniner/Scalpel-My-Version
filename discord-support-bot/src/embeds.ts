import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
  type User,
} from 'discord.js'
import { REPORT_TYPES, type ReportType, CUSTOM_IDS } from './report-types.js'

export type ReportFields = {
  title: string
  description: string
  steps: string
  expected: string
  environment: string
}

export function readReportFields(interaction: ModalSubmitInteraction): ReportFields {
  return {
    title: interaction.fields.getTextInputValue('title').trim(),
    description: interaction.fields.getTextInputValue('description').trim(),
    steps: interaction.fields.getTextInputValue('steps').trim(),
    expected: interaction.fields.getTextInputValue('expected').trim(),
    environment: interaction.fields.getTextInputValue('environment').trim(),
  }
}

export function buildReportEmbed(
  type: ReportType,
  fields: ReportFields,
  reporter: User,
  status: 'open' | 'claimed' | 'resolved' = 'open',
  claimedBy?: User | null,
): EmbedBuilder {
  const meta = REPORT_TYPES[type]
  const statusLabel =
    status === 'resolved' ? '✅ Resolved' : status === 'claimed' ? '👀 Claimed' : '🆕 Open'

  const embed = new EmbedBuilder()
    .setColor(status === 'resolved' ? 0x2ecc71 : meta.color)
    .setTitle(`${meta.emoji} ${meta.label}: ${fields.title}`)
    .setDescription(fields.description)
    .addFields(
      {
        name: 'Steps to reproduce',
        value: fields.steps || '_Not provided_',
      },
      {
        name: 'Expected vs actual',
        value: fields.expected || '_Not provided_',
      },
      {
        name: 'Environment',
        value: fields.environment || '_Not provided_',
      },
      {
        name: 'Status',
        value: statusLabel,
        inline: true,
      },
      {
        name: 'Reporter',
        value: `${reporter} (\`${reporter.username}\` · \`${reporter.id}\`)`,
        inline: true,
      },
    )
    .setFooter({ text: `Scalpel Support · ${type} · ${reporter.id}` })
    .setTimestamp(new Date())

  if (claimedBy) {
    embed.addFields({
      name: 'Claimed by',
      value: `${claimedBy}`,
      inline: true,
    })
  }

  return embed
}

export function buildModActionRow(status: 'open' | 'claimed' | 'resolved'): ActionRowBuilder<ButtonBuilder> {
  if (status === 'resolved') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.reopen)
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁'),
    )
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.claim)
      .setLabel(status === 'claimed' ? 'Re-claim' : 'Claim')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👀'),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.resolve)
      .setLabel('Mark resolved')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
  )
}
