# Application Command Manager
`aoi-command-manager` is an application command loader to sync your
Slash Commands to the Discord API with ease.

## Setup
```js
const { ApplicationCommandManager } = require('aoi-command-manager')
const { AoiClient } = require('aoi.js')
const { config } = require('dotenv')
const { join } = require('path')

const client = new AoiClient({
    intents: [
        'Guilds',
        'GuildMessages',
        'MessageContent'
    ],
    token: config().parsed.TOKEN
})

client.readyCommand({
    code: `
        $log[Client user started!]
    `
})

const apps = new ApplicationCommandManager(client)
apps.load(join(__dirname, 'data'), true).then(() => {
    setTimeout(function () {
        if (client.isReady()) {
            apps.sync()
            console.log('Commands synced')
        }
    }, 5000)
})
```

## Slash command file structure
```js
const { SlashCommandBuilder } = require('discord.js')

module.exports = {
    data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Returns the client websocket latency.')
}
```

## File structure for the previous example
![Structure](https://cdn.discordapp.com/attachments/996126408151683107/1183094673397522562/image.png?ex=658715c6&is=6574a0c6&hm=1bfcadad55f5d97f600078f4912ef50b89ad8dcb8f50d4403f6268c727dcad9e&)

## Custom functions
### $applicationCommandReload
Reload application command specifications from a directory.
> Usage: `$applicationCommandReload`

### $applicationCommandSync
Synces all loaded specifications into multiple guilds or bots if no args.
> Usage: `$applicationCommandSync[...guildIDs?]`

## Documentation
> [Link](https://cyberghxst.github.io/aoi-command-manager)