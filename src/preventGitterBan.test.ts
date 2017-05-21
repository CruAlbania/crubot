// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as fs from 'fs'
const expect = chai.expect

import {Response, Robot} from './hubot'

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
const Helper = require('hubot-test-helper')
const helper = new Helper(['./preventGitterBan.ts'])

describe('preventGitterBan', () => {
  let room: any

  beforeEach(() => {
    room = helper.createRoom()
    room.robot.respond(/echo\s+(.+)/i, (res: Response) => {
      res.send(res.match[1])
    })
  })

  afterEach(() => {
    room.destroy()
  })

  it('should not modify output when saying different things', async () => {
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "goodbye"')
    await room.user.say('alice', 'hubot echo "goodbye"')

    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "goodbye"' ],
      [ 'hubot', '"goodbye"' ],
      [ 'alice', 'hubot echo "goodbye"' ],
      [ 'hubot', '"goodbye"' ],
    ])
  })

  it('should insert an extra message when approaching the ban threshold', async () => {
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')
    await room.user.say('alice', 'hubot echo "hello"')

    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', "I hope you're not trying to get me banned :)"],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', '"hello"' ],
      [ 'alice', 'hubot echo "hello"' ],
      [ 'hubot', "I hope you're not trying to get me banned :)"],
      [ 'hubot', '"hello"' ],
    ])
  })

  it('should handle sending multiple strings at once', async () => {

    room.robot.respond(/prep/, (res: Response) => {
      res.send('hello', 'hello')
    })

    room.robot.respond(/start/, (res: Response) => {
      res.send('hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello', 'hello')
    })

    await room.user.say('alice', 'hubot prep')
    await room.user.say('alice', 'hubot start')
    await wait(100)

    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot prep' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'alice', 'hubot start' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'I hope you\'re not trying to get me banned :)' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'I hope you\'re not trying to get me banned :)' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'I hope you\'re not trying to get me banned :)' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'I hope you\'re not trying to get me banned :)' ],
      [ 'hubot', 'hello' ],
      [ 'hubot', 'hello' ],
    ])
  })
})

function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
