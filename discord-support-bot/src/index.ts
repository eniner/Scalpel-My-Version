import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
} from 'discord.js'
import { config } from './config.js'
import { handleReportCommand, handleSupportCommand } from './commands.js'
import { handleModButton, handleReportModal } from './handlers.js'
import { CUSTOM_IDS } from './report-types.js'

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
})

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Scalpel Support Bot online as ${readyClient.user.tag}`)
  console.log(`Report channel: ${config.reportChannelId}`)
  if (config.guildId) console.log(`Test guild: ${config.guildId}`)
})

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'report') {
        await handleReportCommand(interaction)
        return
      }
      if (interaction.commandName === 'support') {
        await handleSupportCommand(interaction)
        return
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('scalpel_report_modal:')) {
      await handleReportModal(interaction, client)
      return
    }

    if (
      interaction.isButton() &&
      (interaction.customId === CUSTOM_IDS.claim ||
        interaction.customId === CUSTOM_IDS.resolve ||
        interaction.customId === CUSTOM_IDS.reopen)
    ) {
      await handleModButton(interaction)
    }
  } catch (err) {
    console.error('Interaction failed:', err)
    const message = 'Something went wrong handling that. Please try again or ping a mod.'
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {})
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {})
      }
    }
  }
})

client.login(config.token).catch((err) => {
  console.error('Failed to log in. Check DISCORD_TOKEN in .env', err)
  process.exit(1)
})
