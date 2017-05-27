// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as fs from 'fs'
import * as sinon from 'sinon'
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
    if (this.clock) {
      this.clock.restore()
      delete(this.clock)
    }
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

  it('should break up large strings into multiple messages', async () => {
    room.robot.respond(/do it/i, (resp: Response) => {
      resp.reply('incoming long string!')
      let str = 'asdf\n'
      for (let i = 0; i < 20; i++) {
        str += i + ': asasldfkjqwlkejrqlknvlkqwjer lkqwjefl qwejkrlqwkje lkfjqw eflkjq flkej \n\nq flkqwjelkwjqflkqwef lkwje flkqwje flqwkejflkqwjefqwelfk weflkjqwlkefjwe\n'
      }
      str += 'ghij'
      resp.reply(str)
    })

    this.clock = sinon.useFakeTimers()

    await room.user.say('alice', 'hubot do it')
    await wait(50)

    // let it do the next chunk
    this.clock.tick(2050)   // 2.05 seconds
    await wait(50)

    await room.user.say('alice', 'hubot echo hi')

    this.clock.tick(4050)   // 4.05 seconds
    await wait(50)

    this.clock.tick(4050)   // 6.05 seconds
    await wait(50)

    this.clock.tick(4050)   // 6.05 seconds
    await wait(50)

    // assert
    expect(room.messages).to.have.length(8, 'messages.length')
    expect(room.messages[1][1]).to.equal('@alice incoming long string!')
    expect(room.messages[2][1]).to.have.length.greaterThan(900)
    expect(room.messages[2][1]).to.have.length.lessThan(1000)
    expect(room.messages[3][1]).to.have.length.greaterThan(900)
    expect(room.messages[3][1]).to.have.length.lessThan(1000)
    expect(room.messages[4]).to.deep.equal(['alice', 'hubot echo hi'])
    expect(room.messages[5][1]).to.have.length.greaterThan(900)
    expect(room.messages[5][1]).to.have.length.lessThan(1000)
    expect(room.messages[6]).to.deep.equal(['hubot', 'q flkqwjelkwjqflkqwef lkwje flkqwje flqwkejflkqwjefqwelfk weflkjqwlkefjwe\nghij'])
    expect(room.messages[7]).to.deep.equal(['hubot', 'hi'])
  })

  it('should break up large string groups into multiple messages', async () => {
    room.robot.respond(/do it/i, (resp: Response) => {
      resp.reply('incoming long string!')
      const strs = ['asdf']
      for (let i = 0; i < 20; i++) {
        strs.push(i + ': asasldfkjqwlkejrqlknvlkqwjer lkqwjefl qwejkrlqwkje lkfjqw eflkjq flkej \nq flkqwjelkwjqflkqwef lkwje flkqwje flqwkejflkqwjefqwelfk weflkjqwlkefjwe')
      }
      strs.push('ghij')
      resp.reply(...strs)
    })

    this.clock = sinon.useFakeTimers()

    await room.user.say('alice', 'hubot do it')
    await wait(50)

    // let it do the next chunk
    this.clock.tick(2050)   // 2.05 seconds
    await wait(50)

    await room.user.say('alice', 'hubot echo hi')

    this.clock.tick(4050)   // 4.05 seconds
    await wait(50)

    this.clock.tick(4050)   // 6.05 seconds
    await wait(50)

    this.clock.tick(4050)   // 6.05 seconds
    await wait(50)

    // assert
    expect(room.messages).to.have.length(8, 'messages.length')
    expect(room.messages[1][1]).to.equal('@alice incoming long string!')
    expect(room.messages[2][1]).to.have.length.greaterThan(900)
    expect(room.messages[2][1]).to.have.length.lessThan(1000)
    expect(room.messages[3][1]).to.have.length.greaterThan(900)
    expect(room.messages[3][1]).to.have.length.lessThan(1000)
    expect(room.messages[4]).to.deep.equal(['alice', 'hubot echo hi'])
    expect(room.messages[5][1]).to.have.length.greaterThan(900)
    expect(room.messages[5][1]).to.have.length.lessThan(1000)
    expect(room.messages[6]).to.deep.equal(['hubot', 'q flkqwjelkwjqflkqwef lkwje flkqwje flqwkejflkqwjefqwelfk weflkjqwlkefjwe\nghij'])
    expect(room.messages[7]).to.deep.equal(['hubot', 'hi'])
  })
})

// since we might override setTimeout with sinon timers, capture it here and use it instead
const origSetTimeout = setTimeout
function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    origSetTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
