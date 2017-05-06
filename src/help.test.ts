import * as chai from 'chai'
import * as Helper from 'hubot-test-helper'
import * as ts from "typescript"
import * as fs from 'fs'
const expect = chai.expect

//const transpiled = ts.transpileModule('./help.ts', {
//})
//fs.writeFileSync('/tmp/help.js', transpiled.outputText)

const helper = new Helper('./help.ts')

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
    expect(room.messages[1][1]).contains("Want to ask me a question?  Just type `hubot help`")
  })

  it('should respond to "hubot hi"', async () => {
    await room.user.say('alice', 'hubot hi')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains("Want to ask me a question?  Just type `hubot help`")
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
    expect(room.messages[1][1]).contains("I can do a lot of things!")
    expect(room.messages[1][1]).contains("hubot help all")
  })

  it('should respond to "hubot help all"', async () => {
    await room.user.say('alice', 'hubot help all')

    expect(room.messages.length).to.equal(2, '#messages')
    expect(room.messages[1][1]).contains("Here's a list of all the things I can do:")
  })
})
