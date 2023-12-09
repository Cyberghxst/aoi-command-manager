import { Collection, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js'
import { lstat, readdir } from 'fs/promises'
import type { AoiClient } from 'aoi.js'
import { join } from 'path'

export class ApplicationCommandManager {
    #bot: AoiClient
    #commands: Collection<string, RESTPostAPIApplicationCommandsJSONBody>
    constructor(bot: AoiClient) {
        this.#bot = bot
        this.#commands = new Collection
    }

    /**
     * Clear all cached commands.
     * @returns {ApplicationCommandManager}
     */
    clearCommands() {
        this.#commands.clear()
        return this
    }

    /**
     * Load all application commands inside a directory.
     * @param dir - Application commands directory.
     * @param providing_cwd - Set to "true" if your path provides a custom cwd.
     */
    async load(dir: string, providing_cwd = false) {
        const root = providing_cwd ? '' : process.cwd()
        const files = await readdir(join(root, dir))

        for (const file of files) {
            const stat = await lstat(join(root, dir, file))
            if (stat.isDirectory()) {
                await this.load(join(dir, file), providing_cwd)
                continue
            } else if (!file.endsWith('.js')) continue
            
            const data = require(join(root, dir, file)).data as SlashCommandBuilder
            if (!(data instanceof SlashCommandBuilder))
                throw new Error('Invalid slash command specification in: ' + join(root, dir, file))
            this.#commands.set(data.name, data.toJSON())
        }

    }

    /**
     * Sync all application commands with the Discord API.
     */
    async sync(guildIDs: string[] | undefined) {
        const commands = Array.from(this.#commands.values())
        if (Array.isArray(guildIDs?.length)) {
            guildIDs.forEach(async guildId => {
                const guild = this.#bot.guilds.cache.get(guildId) ?? await this.#bot.guilds.fetch(guildId)
                if (!guild) throw new Error('Invalid Guild ID provided in: ApplicationCommandManager#sync')
                return await guild.commands.set(commands)
            })
        } else return await this.#bot.application?.commands.set(commands)
    }
}