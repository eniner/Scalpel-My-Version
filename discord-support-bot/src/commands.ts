import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js'
import { REPORT_TYPES, type ReportType, CUSTOM_IDS, isReportType } from './report-types.js'

export const reportCommand = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Submit a Scalpel bug, issue, or feedback report to the mod team')
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('What kind of report is this?')
      .setRequired(true)
      .addChoices(
        { name: '🐛 Bug — something broken', value: 'bug' },
        { name: '⚠️ Issue — install / setup / filters', value: 'issue' },
        { name: '💡 Feedback — idea or request', value: 'feedback' },
      ),
  )

export const helpCommand = new SlashCommandBuilder()
  .setName('support')
  .setDescription('How to get help from the Scalpel support bot')

export function buildReportModal(type: ReportType): ModalBuilder {
  const meta = REPORT_TYPES[type]
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_IDS.reportModal(type))
    .setTitle(`${meta.emoji} Scalpel ${meta.label} Report`)

  const title = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Short title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Overlay crashes when opening Economy')
    .setRequired(true)
    .setMaxLength(100)

  const description = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('What happened?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe the problem or request clearly.')
    .setRequired(true)
    .setMaxLength(1000)

  const steps = new TextInputBuilder()
    .setCustomId('steps')
    .setLabel('Steps to reproduce (if any)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1. Open Scalpel\n2. …\n3. …')
    .setRequired(false)
    .setMaxLength(1000)

  const expected = new TextInputBuilder()
    .setCustomId('expected')
    .setLabel('Expected vs actual')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Expected: …\nActual: …')
    .setRequired(false)
    .setMaxLength(800)

  const environment = new TextInputBuilder()
    .setCustomId('environment')
    .setLabel('Scalpel version / PoE / OS')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Scalpel 1.x · PoE 1/2 · Windows 11')
    .setRequired(false)
    .setMaxLength(150)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(title),
    new ActionRowBuilder<TextInputBuilder>().addComponents(description),
    new ActionRowBuilder<TextInputBuilder>().addComponents(steps),
    new ActionRowBuilder<TextInputBuilder>().addComponents(expected),
    new ActionRowBuilder<TextInputBuilder>().addComponents(environment),
  )

  return modal
}

export async function handleReportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const typeValue = interaction.options.getString('type', true)
  if (!isReportType(typeValue)) {
    await interaction.reply({
      content: 'Unknown report type.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.showModal(buildReportModal(typeValue))
}

export async function handleSupportCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const lines = Object.entries(REPORT_TYPES).map(
    ([key, meta]) => `• \`/report type:${key}\` — ${meta.emoji} **${meta.label}**: ${meta.description}`,
  )

  await interaction.reply({
    content: [
      '**Scalpel Support Bot**',
      '',
      'Use `/report` to open a short form. Your answers are posted privately to the Scalpel mod team channel.',
      '',
      ...lines,
      '',
      'Tips:',
      '• Include Scalpel version (Settings → About) and whether you are on PoE 1 or PoE 2.',
      '• For crashes, mention if you already generated a local diagnostics report from Scalpel.',
      '• Do **not** paste account passwords, session cookies, or POESESSID.',
    ].join('\n'),
    flags: MessageFlags.Ephemeral,
  })
}
