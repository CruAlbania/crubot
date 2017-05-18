// Description:
//   A more helpful help command.
//
// Dependencies:
//   "<module name>": "<module version>"
//
// Configuration:
//
// Commands:
//   hubot help - The friendly help prompt
//
// Notes:
//
//
// Author:
//   gburgett

import * as Fs from 'fs'
import * as Path from 'path'

import { CatchAllMessage, Robot, TextMessage } from './hubot'

function script(robot: Robot) {
  const cwd = '.'

  // --------------- Greetings ------------------------------------ //
  robot.hear(new RegExp(`ask ${robot.name}`, 'i'),  (res) => {
    let msg = `Hi, I'm ${robot.name}.  Nice to meet you!
You can ask me a question by typing my name, or even direct messaging me!
Try it now by typing this:
\`${robot.name} help\``

    if (robot.alias) {
      msg += `

I also respond to "${robot.alias}".`
    }

    res.send(msg)
  })

  const greetings = ['Hi there!', 'Howdy!', 'Hi!  How are you?',
   'Hello!', "What's up?", 'Nice to see you!', 'Yo!', 'Whazzup!!!', 'Hiya!']
  robot.respond(/(hi|howdy|hello)$/i, (res) => {
    res.send(res.random(greetings) + `  Want to ask me a question?  Just type \`${robot.name} help\``)
  })

  robot.hear(new RegExp(`^(hi|howdy|hello) ${robot.name}`, 'i'), (res) => {
    res.send(res.random(greetings) + `  Want to ask me a question?  Just type \`${robot.name} help\``)
  })

  const thanks = ["you're welcome!", 'anytime!', 'happy to help!', 'of course!',
   'no problem!', 'no sweat!', "Don't mention it!", 'My pleasure!', 'Least I could do!']
  robot.hear(new RegExp(`^(thanks|thank you) ${robot.name}`, 'i'), (res) => {
    res.send(res.random(thanks))
  })

  robot.respond(/(thanks|thank you)/i, (res) => {
    res.send(res.random(thanks))
  })

  // -------------- LOAD HELP FROM HUBOT SCRIPTS ----------------------- //
  // This object holds all the loaded scripts with their parsed help information
  const scripts = {}

  loadScriptsFromPath(Path.resolve(cwd, 'scripts'), (err, help) => {
    if (err != null) {
      robot.logger.error(err)
    } else {
      Object.assign(scripts, help)
    }
  })

  loadScriptsFromPath(Path.resolve(cwd, 'src', 'scripts'), (err, help) => {
    if (err != null) {
      robot.logger.error(err)
    } else {
      Object.assign(scripts, help)
    }
  })

  const externalScripts = Path.resolve(cwd, 'external-scripts.json')
  if (Fs.existsSync(externalScripts)) {
    Fs.readFile(externalScripts, (err, data) => {
      if (data.length > 0) {
        try {
          const packages = JSON.parse(data.toString())
          if (packages instanceof Array) {
            for (const pkg of (packages as string[])) {
              try {
                parseHelpFromModule(pkg, undefined, (help) => {
                  scripts[pkg.replace('hubot-', '')] = help
                })
              } catch (err) {
                robot.logger.info('could not load help from module ' + pkg, err)
              }
            }
          } else {
            for (const pkg in packages) {
              if (!packages.hasOwnProperty(pkg)) {
                continue
              }
              try {
                parseHelpFromModule(pkg, packages[pkg], (help) => {
                  scripts[pkg.replace('hubot-', '')] = help
                })
              } catch (err) {
                robot.logger.info('could not load help from module ' + pkg, err)
              }
            }
          }
        } catch (err) {
          robot.logger.error('Error parsing JSON data from external-scripts.json: ', err)
        }
      }
    })
  }

  // -------------- RESPOND WITH HELP FROM HUBOT SCRIPTS ---------------------- //

  robot.respond(/help(?:\s+(.*))?/i, (res) => {
    const replyInPrivate = process.env.HUBOT_HELP_REPLY_IN_PRIVATE
    const sendReply = (replyStr) => {
      if (replyInPrivate && res.envelope && res.envelope.user && res.envelope.user.id) {
        res.reply('Replied to you in private!')
        robot.messageRoom(res.envelope.user.name, replyStr)
        return
      }
      res.reply(replyStr)
    }

    // hubot help
    if (!res.match[1] || res.match[1] === 'me' || res.match[1].startsWith('me ')) {
      const reply = ['I can do a lot of things!  Which would you like to know more about? You can say:  ', '']
      for (const k in scripts) {
        if (!scripts.hasOwnProperty(k)) {
          continue
        }
        if (k === 'help') {
          // skip the help command itself
          continue
        }
        const h = scripts[k] as Help
        if (!h.commands || h.commands.length === 0) {
          // no commands in this script - might be a brain or other helper script
          continue
        }

        let desc = h.description.length > 0 ? h.description[0] : ''
        desc = desc.replace('hubot', robot.name)
        reply.push(`* ${robot.name} help ${k} - ${desc}  `)
      }
      reply.push('', '\nOr you can see all commands by typing `' + robot.name + ' help all`.')
      sendReply(reply.join('\n'))
      return
    }

    const query = res.match[1].toLowerCase().trim()
    const allCommands = getAllCommands(scripts)

    // hubot help all
    if (query === 'all') {
      const cmds = renameHelpCommands(allCommands, robot.name)
      const reply = "Here's a list of all the things I can do:  \n\n" +
                      cmds.map((c) => '* ' + c).join('  \n')
      sendReply(reply)
      return
    }

    // hubot help {{ script name }}
    const selectedHelp = scripts[query] as Help
    if (selectedHelp && selectedHelp.commands.length > 0) {
      const cmds = renameHelpCommands(selectedHelp.commands.sort(), robot.name)
      let desc = selectedHelp.description.length > 0 ? selectedHelp.description[0] : ''
      desc = desc.replace('hubot', robot.name)
      const reply = desc + '  \n\n' +
                      cmds.map((c) => '* ' + c).join('  \n')
      sendReply(reply)
      return
    }

    // hubot help {{ search query }}
    const matches = executeSearch(res.match[1], allCommands)
    if (matches.length > 0) {
      const cmds = renameHelpCommands(matches, robot.name)
      const reply = `Here's what I can do related to "${res.match[1]}":  \n\n` +
                      cmds.map((c) => '* ' + c).join('  \n')
      sendReply(reply)
      return
    }

    sendReply("Sorry!  I couldn't find anything related to " + res.match[1])
  })

  // ---------- Catch all which searches commands ------------- //
  const nameRegex = new RegExp('^' + robot.name + ' ', 'i')
  robot.catchAll((res) => {
    // strip the robot's name before doing the search
    const msg = (res.envelope.message as CatchAllMessage).message as TextMessage
    if (!nameRegex.test(msg.text)) {
      // they didn't say the robots name
      return
    }
    const txtMsg = msg.text.replace(nameRegex, '')

    // run a search on the unknown command
    let matches = executeSearch(txtMsg, getAllCommands(scripts))
    if (matches.length > 0) {
      matches = matches.slice(0, 5).map((m) => '* ' + m)
      matches.splice(0, 0, "Sorry, I didn't catch that.  Try one of these?")
      res.reply(matches.join('\n'))
    } else {
      res.reply(`Sorry, I didn't catch that.  Try \`${robot.name} help\``)
    }
  })

}

/**
 * Once all the help documentation is parsed into an associative array,
 * This function iterates that array to get all the commands
 */
function getAllCommands(scripts: any): string[] {
  const allCommands = []
  for (const k in scripts) {
    if (!scripts.hasOwnProperty(k)) {
      continue
    }
    const h = (scripts[k] as Help)
    if (h.commands) {
      allCommands.push(...h.commands)
    }
  }
  return allCommands
}

/**
 * Runs a search over the given array of commands, searching in order by:
 *   string.contains
 *   regex.match
 *   command contains any word in given search terms
 */
function executeSearch(query: string, commands: string[]): string[] {
  const cmdsLower = commands.map((c) => ({ cmd: c, lower: c.toLowerCase() }))
  const queryLower = query.toLowerCase()
    // see if any commands contain the given text
  let matching = cmdsLower.filter((cmd) => cmd.lower.includes(queryLower))
  if (matching.length > 0) {
    return matching.map((m) => m.cmd)
  }

    // see if a regex search matches
  const r = new RegExp(query, 'i')
  const matches = commands.filter((cmd) =>
    r.test(cmd),
  )
  if (matches.length > 0) {
    return matches
  }

    // see if any commands have any text related to any of the given words
  const terms = query.split(' ')
  matching = cmdsLower.filter((cmd) =>
    cmd.lower.split(' ').find((word) => terms.indexOf(word) >= 0) ? true : false,
  )
  if (matching.length > 0) {
    return matching.map((m) => m.cmd)
  }

  return []
}

// --------------------------------------------------------------------------------
// reimplement help parsing in robot.coffee because it doesn't expose what we need
// --------------------------------------------------------------------------------
const HUBOT_DOCUMENTATION_SECTIONS = [
  'description',
  'dependencies',
  'configuration',
  'commands',
  'notes',
  'author',
  'authors',
  'examples',
  'tags',
  'urls',
]

/**
 * The result of parsing a help file - contains all hubot documentation sections
 */
class Help {
  /**
   * Reduces the help comments of two files into one.
   *   Used when a module has multiple files with help comments
   */
  public static reduce(first: Help, second: Help): Help {
    if (!first) { return second }
    if (!second) { return first }

    first.description   = mergeArrays(first.description, second.description)
    first.dependencies  = mergeArrays(first.dependencies, second.dependencies)
    first.configuration = mergeArrays(first.configuration, second.configuration)
    first.commands      = mergeArrays(first.commands, second.commands)
    first.notes         = mergeArrays(first.notes, second.notes)
    first.author        = mergeArrays(first.author, second.author)
    first.examples      = mergeArrays(first.examples, second.examples)
    first.tags          = mergeArrays(first.tags, second.tags)
    first.urls          = mergeArrays(first.urls, second.urls)
    return first
  }

  public description?: string[]
  public dependencies?: string[]
  public configuration?: string[]
  public commands?: string[]
  public notes?: string[]
  public author?: string[]
  public examples?: string[]
  public tags?: string[]
  public urls?: string[]
}

/** Util to merge two arrays into one without duplicates */
function mergeArrays<T>(arr1: T[], arr2: T[]): T[] {
  if (!arr1) {
    return arr2
  }
  if (!arr2) {
    return arr1
  }
  // add only the elements which are not duplicated
  arr1.push(...arr2.filter((i) => arr1.indexOf(i) !== -1))
  return arr1
}

/**
 * Loads all scripts in the path, and parses their help.
 */
function loadScriptsFromPath(path: string, cb: (err: Error, help: any) => void) {
  const help = {}

  Fs.readdir(path, (err, files) => {
    if (err) {
      if (err.code !== 'ENOENT') {
        cb(new Error('Error parsing help from directory ' + path + ', ' + err), undefined)
      }
      return
    }
    for (const file of files) {
      const ext  = Path.extname(file)
      const full = Path.join(path, Path.basename(file, ext))
      if (require.extensions[ext]) {
        try {
          const script = require(full)
          if (typeof (script) === 'function') {
            help[Path.basename(file, ext)] = parseHelp(Path.join(path, file))
          }
        } catch (err) {
          cb(new Error(`Error parsing help from file ${path}/${file}, ${err}`), undefined)
        }
      }
    }
    cb(undefined, help)
  })
}

/**
 * Parses the help header from a .js or .coffee file
 */
function parseHelp(scriptFile: string): Help {
  const scriptName = Path.basename(scriptFile).replace(/\.(coffee|js)$/, '')
  const scriptDocumentation: Help = {}

  const body = Fs.readFileSync(scriptFile, 'utf-8')

  let currentSection = null
  for (const line of body.split('\n')) {
    if (!(line[0] === '#' || line.substr(0, 2) === '//')) {
      break
    }
    const cleanedLine = line.replace(/^(#|\/\/)\s?/, '').trim()
    if (cleanedLine.length === 0 || cleanedLine.toLowerCase() === 'none') {
      continue
    }

    const nextSection = cleanedLine.toLowerCase().replace(':', '')
    if (HUBOT_DOCUMENTATION_SECTIONS.indexOf(nextSection) >= 0) {
      currentSection = nextSection
      scriptDocumentation[currentSection] = []
    } else {
      if (currentSection) {
        scriptDocumentation[currentSection].push(cleanedLine.trim())
      }
    }
  }

  if (currentSection === null) {
    scriptDocumentation.commands = []
    for (const line of body.split('\n')) {
      if (!(line[0] === '#' || line.substr(0, 2) === '//')) {
        break
      }
      if (!line.match('-')) {
        continue
      }
      const cleanedLine = line.substring(2).trim()
      scriptDocumentation.commands.push(cleanedLine)
    }
  }

  return scriptDocumentation
}

/**
 * Requires a hubot script module and executes it, intercepting "loadFile" to process help for each file.
 * The callback will be called for each processed file, with the current reduced contents.
 *
 * Assumes that all hubot script modules are implemented with the "index.coffee" template
 * which calls `robot.loadFile` on every script in the module.
 */
function parseHelpFromModule(moduleName: string, scripts?: string[], cb?: (help: Help) => void) {
  let ret: Help

  const mockRobot = {
    loadFile: (path, file) => {
      const ext  = Path.extname(file)
      const full = Path.join(path, Path.basename(file, ext))
      if (require.extensions[ext]) {
        const script = require(full)

        if (typeof (script) === 'function') {
          const help = parseHelp(Path.join(path, file))
          ret = Help.reduce(ret, help)
          cb(ret)
        }
      }
    },
  }

  try {
    require(moduleName)(mockRobot, scripts)
  }catch (err) {
    // tslint:disable-next-line:no-console
    console.error('Cant parse help from ', moduleName, ' because it doesnt use the normal index.coffee template.\n', err)
  }
}

/**
 * Renames the given help commands with the robot name
 */
function renameHelpCommands(commands: string[], robotName: string) {
  return commands.map((command) =>
      command.replace(/^hubot/i, robotName))
}

module.exports = script
