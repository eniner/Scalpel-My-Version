import { REST, Routes } from 'discord.js'
import { config } from './config.js'
import { helpCommand, reportCommand } from './commands.js'

const commands = [reportCommand.toJSON(), helpCommand.toJSON()]

async function main() {
  const rest = new REST({ version: '10' }).setToken(config.token)

  if (config.guildId) {
    const data = (await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    })) as unknown[]
    console.log(
      `Registered ${data.length} guild command(s) on guild ${config.guildId} (instant for testing).`,
    )
  } else {
    const data = (await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    })) as unknown[]
    console.log(
      `Registered ${data.length} global command(s). Discord may take up to ~1 hour to show them everywhere.`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
