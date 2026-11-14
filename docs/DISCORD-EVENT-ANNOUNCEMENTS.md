# Self-hosted Discord event announcements

This is the Eclipse Order replacement for paid event announcement bots. It watches **Discord Scheduled Events** and sends an embed into one announcement channel with Accepted / Declined / Tentative response buttons. An existing announcement is edited when its Discord event changes; cancelled/completed/deleted events are removed. Startup and a five-minute reconciliation repair missed changes.

## Configure
1. In Discord Developer Mode, right-click the **destination text channel** and copy its channel ID.
2. Add `DISCORD_EVENT_ANNOUNCEMENT_CHANNEL_ID=...` to the private `server/.env`. Existing `DISCORD_GUILD_ID` and `DISCORD_BOT_TOKEN` are reused. **Never commit tokens**.
3. In the channel, allow the existing Eclipse Order bot: View Channel, Send Messages, Embed Links, and Read Message History. Bot must have access to server scheduled events. It only uses the ordinary Guilds Gateway intent (no Message Content or Server Members privileged intents).
4. Once after pulling the update, run `cd server` then `npm install` to install discord.js. The Windows Control Center will not install dependencies automatically.
5. Exit and reopen the Windows API Control Center, then use **START BOT**. It also starts automatically on subsequent logins if configured and not manually stopped. **STOP BOT** stops only the announcement bot, not the API.

## How RSVPs work
These three buttons store **announcement-local** responses and update the embed totals. Discord's built-in Interested RSVP is a **different** system. Discord Scheduled Events do not provide native Accepted/Declined/Tentative statuses; therefore this bot cannot synchronise those three options back into native Interested. Members can click their last selected response again to clear it.

## Storage, privacy and troubleshooting
Bot data is stored privately at `%LOCALAPPDATA%\\EclipseOrder\\EventBot\\announcements.json`, outside the repository. It contains event-message IDs and Discord user IDs for responses. Back it up if you need to preserve RSVP counts. The control center writes each process's stdout and stderr to its existing local logs folder. The bot runs under the signed-in Windows user; the host needs to stay awake and have outbound Discord connectivity. Changing the destination channel after posting requires clearing the prior message mapping carefully, or existing updates cannot find the old posts.

If the bot fails to start, check for missing `server/.env` IDs, an invalid bot token, missing `discord.js`, or channel permissions. The bot is independent of the HTTP API and does **not** need a new MySQL migration or Cloudflare route. Existing scheduled events are imported on startup.
