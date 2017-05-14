// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as fs from 'fs'
import { Robot } from './hubot'
const expect = chai.expect

// process.env.HUBOT_SCRIPT_ROOT = '.'

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
const Helper = require('hubot-test-helper')
const helper = new Helper(['./help.ts'])

describe('hubot help', () => {

  let room: any

  beforeEach(() => {
    room = helper.createRoom()
  })

  afterEach(() => {
    room.destroy()
  })

  it('should respond to ask hubot', async () => {
    await room.user.say('alice', 'you should ask hubot for an answer')

    expect(room.messages[1][1]).contains("Hi, I'm hubot")
  })

  it('should respond to "hi hubot"', async () => {
    await room.user.say('alice', 'hi hubot')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('Want to ask me a question?  Just type `hubot help`')
  })

  it('should respond to "hubot hi"', async () => {
    await room.user.say('alice', 'hubot hi')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('Want to ask me a question?  Just type `hubot help`')
  })

  it('should respond to "thanks hubot"', async () => {
    await room.user.say('alice', 'thanks hubot!')

    expect(room.messages.length).to.equal(2, '#messages')
  })

  it('should respond to "hubot thanks"', async () => {
    await room.user.say('alice', 'hubot, thanks')

    expect(room.messages.length).to.equal(2, '#messages')
  })

  it('should respond to "hubot help"', async () => {
    await room.user.say('alice', 'hubot help')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('I can do a lot of things!')
    expect(room.messages[1][1]).contains('hubot help all')
  })

  it('should respond to "hubot help me"', async () => {
    await room.user.say('alice', 'hubot help')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('I can do a lot of things!')
    expect(room.messages[1][1]).contains('hubot help all')
  })

  it('should respond to "hubot help all"', async () => {
    await room.user.say('alice', 'hubot help all')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains("Here's a list of all the things I can do:")
  })

  it('should parse Description from external scripts', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('hubot help meme - Get a meme from')
  })

  it('should parse Description from script files in scripts/ directory', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('hubot help hangouts - Create hangouts with Hubot.')
  })

  it('should not include the help script itself', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.not.contain('A more helpful help command')
  })

  it('should show commands imported from external script', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help meme')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('hubot ONE DOES NOT SIMPLY <text> - Meme: Boromir')
    expect(room.messages[1][1]).to.not.contain('hubot hangouts me')
  })

  it('should show commands imported from script file in scripts/ directory', async ()  => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help hangouts')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains('hubot hangout me <title> - Creates a Hangout with the given title and returns the URL.')
    expect(room.messages[1][1]).to.not.contain('hubot ONE DOES NOT SIMPLY')
  })

  it('should search all commands when not finding an exact match', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help ned stark')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain('hubot Brace yourself <text> - Meme: Ned Stark braces for <text>')
  })

  it('should search with regex', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help for\\s\\<(\\w+)\\>')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain('hubot Brace yourself <text> - Meme: Ned Stark braces for <text>')
  })

  it('should search for all terms individually failing exact and regex match', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help stark asdfqwera')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain('hubot Brace yourself <text> - Meme: Ned Stark braces for <text>')
  })

  it('should return nice message on failed search', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot help asdfqwera')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain("I couldn't find anything related to asdfqwera")
  })


  it('should return help message on catch all', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot asdfqwera')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain("Sorry, I didn't catch that.  Try `hubot help`")
  })

  it('should return related help on catch all', async () => {

    await wait(10) // short wait so hubot can process all the help files
    await room.user.say('alice', 'hubot boromir')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).to.contain("Sorry, I didn't catch that.  Try one of these?")
    expect(room.messages[1][1]).to.contain('hubot ONE DOES NOT SIMPLY <text> - Meme: Boromir')
  })
})


function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
