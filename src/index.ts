import { Collection, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js'
import { lstat, readdir } from 'fs/promises'
import type { AoiClient, AwaitCommand } from 'aoi.js'
import { join } from 'path'

interface ICommand extends AwaitCommand {
    data: SlashCommandBuilder | Record<string, any>
}

export class ApplicationCommandManager {
    #bot: AoiClient & { slashCommandManager: ApplicationCommandManager }
    #commands: Collection<string, RESTPostAPIApplicationCommandsJSONBody>
    #directory: string | null = null
    #providing_cwd = false
    constructor(bot: AoiClient) {
        this.#bot = bot as any
        this.#commands = new Collection

        this.#bot.slashCommandManager = this
        this.#addPlugins()
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
     * Returns the number of cached commands.
     * @returns {number}
     */
    commandSize() {
        return this.#commands.size
    }

    getCommands() {
        return Array.from(this.#commands.values())
    }

    /**
     * Load all application commands inside a directory.
     * @param dir - Application commands directory.
     * @param providing_cwd - Set to "true" if your path provides a custom cwd.
     */
    async load(dir: string, providing_cwd = false) {
        const root = providing_cwd ? '' : process.cwd()
        const files = await readdir(join(root, dir))

        this.#directory = dir
        this.#providing_cwd = providing_cwd

        for (const file of files) {
            const stat = await lstat(join(root, dir, file))
            if (stat.isDirectory()) {
                await this.load(join(dir, file), providing_cwd)
                continue
            } else if (!file.endsWith('.js')) continue
            
            const data: ICommand | ICommand[] = require(join(root, dir, file))
            if (Array.isArray(data)) {
                for (const d of data) {
                    if (d.data instanceof SlashCommandBuilder) {
                        this.#commands.set(d.data.name, d.data.toJSON())
                    } else this.#commands.set(d.data.name, d.data as any)
                }
            } else {
                if (data.data instanceof SlashCommandBuilder) {
                    this.#commands.set(data.data.name, data.data.toJSON())
                } else this.#commands.set(data.data.name, data.data as any)
            }
        }

    }

    /**
     * Sync all application commands with the Discord API.
     */
    async sync(guildIDs: string[] | undefined) {
        const commands = Array.from(this.#commands.values())
        if (Array.isArray(guildIDs)) {
            guildIDs.forEach(async guildId => {
                const guild = this.#bot.guilds.cache.get(guildId) ?? await this.#bot.guilds.fetch(guildId)
                if (!guild) throw new Error('Invalid Guild ID provided in: ApplicationCommandManager#sync')
                return await guild.commands.set(commands)
            })
        } else return await this.#bot.application?.commands.set(commands)
    }

    /**
     * Add ApplicationCommandManager plugins into AoiClient.
     */
    #addPlugins() {
        // Sync commands function
        this.#bot.functionManager.createFunction({
            name: '$applicationCommandSync',
            type: 'djs',
            code: async function(d: any) {
                const data = d.util.aoiFunc(d)
                const guildIDs = data.inside.splits

                if (!(d.bot.slashCommandManager instanceof ApplicationCommandManager))
                    return d.aoiError.fnError(d, 'custom', {
                        inside: data.inside
                    }, 'Cannot find an instance of ApplicationCommandManager!')
                if (d.bot.slashCommandManager.commandSize() === 0)
                    return d.aoiError.fnError(d, 'custom', {
                        inside: data.inside
                    }, 'Cannot sync empty commands!')

                await (
                    d.bot.slashCommandManager as ApplicationCommandManager
                ).sync(guildIDs.length > 0 ? guildIDs : undefined)

                return {
                    code: d.util.setCode(data)
                }
            }
        } as any)

        // Reload commands function.
        this.#bot.functionManager.createFunction({
            name: '$applicationCommandReload',
            type: 'djs',
            code: async (d: any) => {
                const data = d.util.aoiFunc(d)
                if (!(d.bot.slashCommandManager instanceof ApplicationCommandManager))
                    return d.aoiError.fnError(d, 'custom', {
                        inside: data.inside
                    }, 'Cannot find an instance of ApplicationCommandManager!')

                if (!d.bot.slashCommandManager.directory) return d.aoiError.fnError(
                    d,
                    'custom',
                    {},
                    'Cannot find an specification directory!'
                )
                
                await (
                    d.bot.slashCommandManager as ApplicationCommandManager
                ).load(
                    d.bot.slashCommandManager.directory,
                    d.bot.slashCommandManager.cwd
                ).then(() => {
                    data.result = true
                }).catch(() => {
                    data.result = false
                })

                return {
                    code: d.util.setCode(data)
                }
            }
        } as any)
    }

    /**
     * Command specifications directory.
     */
    get directory() {
        return this.#directory
    }

    /**
     * Returns "true" if the directory contains a custom cwd.
     */
    get cwd() {
        return this.#providing_cwd
    }
}