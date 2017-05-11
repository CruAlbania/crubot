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

import { Robot } from './hubot'

module.exports = (robot: Robot) => {

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

  /*

hubot hangout me <title> - Creates a Hangout with the given title and returns the URL.
hubot map me <query> - Returns a map view of the area returned by `query`.
hubot pug bomb N - get N pugs
hubot pug me - Receive a pug
hubot rss add https://github.com/shokai.atom
hubot rss delete #room_name
hubot rss delete http://shokai.org/blog/feed
hubot rss dump
hubot rss list
   *
   */
  const commands = {
    gitlab: 'This lets users connect to Gitlab and manage their repositories.',
    hangout: 'This generates a Google hangout link for us to use',
    map: 'This uses Google maps to show a map of a given location',
    memes: 'I know a lot of memes!  Try generating a meme!',
    pug: 'This is the best command!  Try the pug bomb!',
    rss: 'Use these commands to control rss feeds that I subscribe to',
    youtube: 'I can search youtube for you and find a relevant video',
  }
  robot.respond(/help(?:\s+(.*))?/i, (res) => {
    const replyInPrivate = process.env.HUBOT_HELP_REPLY_IN_PRIVATE
    const sendReply = (replyStr) => {
      if (replyInPrivate && res.envelope && res.envelope.user && res.envelope.user.id) {
        res.reply('Replied to you in private!')
        robot.messageRoom(res.envelope.user.id, replyStr)
        return
      }
      res.reply(replyStr)
    }

    if (!res.match[1]) {
      let reply = 'I can do a lot of things!  Which would you like to know more about? You can say:  \n\n'
      for (const k in commands) {
        if (commands.hasOwnProperty(k)) {
          reply += `* ${robot.name} help ${k} - ${commands[k]}  \n`
        }
      }
      reply += '\nOr you can see all commands by typing `' + robot.name + ' help all`.'
      sendReply(reply)
      return
    }

    switch (res.match[1].toLowerCase()) {
      case 'all':
      {
        const cmds = renamedHelpCommands(robot)
        const reply = "Here's a list of all the things I can do:  \n\n" +
                        cmds.map((c) => '* ' + c).join('  \n')
        sendReply(reply)
        break
      }

      case 'memes':
      {
        const memes = [
          '<text> (SUCCESS|NAILED IT) - Meme: Success kid w/ top caption',
          '<text> ALL the <things> - Meme: ALL THE THINGS',
          '<text> TOO DAMN <high> - Meme: THE RENT IS TOO DAMN HIGH guy',
          '<text>, <text> EVERYWHERE - Meme: Generates Buzz Lightyear',
          "<text>, AND IT'S GONE - Meme: Bank Teller",
          '<text>, BITCH PLEASE <text> - Meme: Yao Ming',
          '<text>, COURAGE <text> - Meme: Courage Wolf',
          'Aliens guy <text> - Meme: Aliens guy',
          'All your <text> are belong to <text> - Meme: All your <text> are belong to <text>',
          'Brace yourself <text> - Meme: Ned Stark braces for <text>',
          "I don't always <something> but when i do <text> - Meme: The Most Interesting man in the World",
          "IF <text> THAT'D BE GREAT - Meme: Generates Lumberg",
          'IF YOU <text> GONNA HAVE A BAD TIME - Meme: Ski Instructor"',
          'IF YOU <text> TROLLFACE <text> - Meme: Troll Face',
          'If <text>, <question> <text>? - Meme: Philosoraptor',
          'Iron Price <text> - Meme: To get <text>? Pay the iron price!',
          'MUCH <text> (SO|VERY) <text> - Meme: Generates Doge',
          'Not sure if <something> or <something else> - Meme: Futurama Fry',
          'ONE DOES NOT SIMPLY <text> - Meme: Boromir',
          'WHAT IF I TOLD YOU <text> - Meme: Morpheus "What if I told you"',
          'WTF <text> - Meme: Picard WTF',
          'Y U NO <text> - Meme: Y U NO GUY w/ bottom caption',
          'Yo dawg <text> so <text> - Meme: Yo Dawg',
          'pun | bad joke eel <text> / <text> - Meme: Bad joke eel',
          'pun | bad joke eel <text>? <text> - Meme: Bad joke eel`',
        ]
        sendReply('Try one of these memes:  \n\n' + memes.map((c) => ` * ${robot.name} ${c}  `).join('\n'))

        break
      }

      default:
      {
        const match = new RegExp(res.match[1], 'i')
        const cmds = renamedHelpCommands(robot).filter((c) => match.test(c))
        const reply = `Here's a list of all the things I can do related to ${res.match[1]}:  \n\n` +
                        cmds.map((c) => '* ' + c).join('  \n')
        sendReply(reply)
      }
      break
    }
  })

  // tslint:disable-next-line:no-shadowed-variable
  function renamedHelpCommands(robot: Robot) {
    const helpCommands = robot.helpCommands().map((command) =>
        command.replace(/^hubot/i, robot.name))
    return helpCommands.sort()
  }
}
