# Scalpel Support Bot

Discord bot for Scalpel community support. Users submit **bug**, **issue**, or **feedback** reports through a Discord modal form; completed reports are posted to a private mod-team channel with Claim / Resolve buttons.

## What users get

| Command | What it does |
|---------|----------------|
| `/support` | Short help on how to report |
| `/report type:bug` | Opens a form for something broken |
| `/report type:issue` | Opens a form for install / setup / filter problems |
| `/report type:feedback` | Opens a form for ideas / requests |

Form fields: title, what happened, steps to reproduce, expected vs actual, Scalpel version / PoE / OS.

## What mods get

Each submission posts an embed into `REPORT_CHANNEL_ID` (optionally pinging `MOD_ROLE_ID`) with:

- **Claim** — mark that a mod is handling it  
- **Mark resolved** — close the report  
- **Reopen** — bring a resolved report back to open  

Anyone with **Manage Messages**, the configured mod role, or an ID in `MOD_USER_IDS` can use those buttons.

---

## 1. Create the Discord application

1. Open [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it e.g. `Scalpel Support`.
2. Open **Bot** → **Add Bot** → **Reset Token** → copy the token (this is `DISCORD_TOKEN`).
3. Under **Bot** → Privileged Gateway Intents: leave them **off** (this bot only needs the Guilds intent).
4. Open **OAuth2** → copy **Client ID** (`DISCORD_CLIENT_ID`).
5. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Read Message History`
   - Open the generated URL, invite the bot into **your test Discord server**.

## 2. Collect IDs for your test server

In Discord: **User Settings → Advanced → Developer Mode** (on), then:

| Value | How to get it |
|-------|----------------|
| `DISCORD_GUILD_ID` | Right-click your **server name** → Copy Server ID |
| `REPORT_CHANNEL_ID` | Create `#scalpel-reports` (mods-only) → right-click → Copy Channel ID |
| `MOD_ROLE_ID` (optional) | Right-click your mod role → Copy Role ID |

Make sure the bot role can **View Channel** + **Send Messages** in the report channel.

## 3. Configure and run locally

```bash
cd discord-support-bot
cp .env.example .env
# edit .env with your token + IDs
npm install
npm run register    # registers /report and /support (guild = instant)
npm start           # keep this process running while you test
```

For auto-reload while editing:

```bash
npm run dev
```

## 4. Test checklist

1. In any channel the bot can see, type `/support` — you should get an ephemeral help message.
2. Run `/report type:bug`, fill the modal, submit.
3. Confirm an embed appears in your mod report channel.
4. Click **Claim**, then **Mark resolved**, then **Reopen**.
5. Confirm a non-mod user cannot use those buttons (ephemeral denial).

When you are ready for the public Scalpel Discord, invite the same bot (or a production app), set the real `REPORT_CHANNEL_ID` / `MOD_ROLE_ID`, clear or omit `DISCORD_GUILD_ID`, and run `npm run register` again for **global** commands (can take up to ~1 hour to appear).

## Security notes

- Never commit `.env` or paste the bot token into chat / GitHub.
- The form warns users not to paste passwords or `POESESSID`.
- Prefer a **private** report channel so only mods see submissions.

## Project layout

```
discord-support-bot/
  .env.example
  package.json
  src/
    index.ts              # bot entry
    register-commands.ts  # slash command registration
    config.ts
    commands.ts           # /report + /support + modal
    embeds.ts             # mod-inbox embed + buttons
    handlers.ts           # submit + claim/resolve
    report-types.ts
```
