// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as express from 'express'
import * as fs from 'fs'
import { Server } from 'http'
import * as sinon from 'sinon'
import { Robot } from './hubot'
const expect = chai.expect

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
const Helper = require('hubot-test-helper')
const helper = new Helper(['./sitechecker.ts'])

describe('hubot sitechecker', () => {

  let longRunning: any = it.skip
  if (process.env.LONG_RUNNING) {
    longRunning = it
  }

  let room: any
  let app: express.Express
  let server: Server

  beforeEach(() => {
    room = helper.createRoom()

    app = express()
    server = app.listen(8081)
  })

  afterEach((done) => {
    room.destroy()
    server.close(done)
    if (this.clock) {
      this.clock.restore()
      delete(this.clock)
    }
  })

  describe('check links', () => {
    it('should error on bad urls', async () => {
      // act
      await room.user.say('alice', 'hubot check links .')
      await room.user.say('alice', 'hubot check links /')
      await room.user.say('alice', 'hubot check links |')
      await room.user.say('alice', 'hubot check links :')
      await room.user.say('alice', 'hubot check links your mom')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        [ 'alice', 'hubot check links .' ],
        [ 'hubot', "Sorry, I can't figure out how to check `.`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check links /' ],
        [ 'hubot', "Sorry, I can't figure out how to check `/`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check links |' ],
        [ 'hubot', "Sorry, I can't figure out how to check `|`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check links :' ],
        [ 'hubot', "Sorry, I can't figure out how to check `:`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check links your mom' ],
        [ 'hubot', "Sorry, I can't figure out how to check `your mom`.  Are you sure it's a URL?" ],
      ])
    })

    it('should not run the link check two times simultaneously', async () => {
      app.get('/', (req, res) => {
        setTimeout(() =>
          res.send('<html><body><h1>Hello World!</h1></body></html>')
        , 10)
      })

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081')
      await wait(10)
      await room.user.say('alice', 'hubot check links http://localhost:8081')
      await wait(50)

      // assert
      expect(room.messages).to.deep.equal([
        [ 'alice', 'hubot check links http://localhost:8081' ],
        [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
        [ 'alice', 'hubot check links http://localhost:8081' ],
        [ 'hubot', "I'm already checking that URL.  I'll let you know when I'm finished." ],
        [ 'hubot', 'Finished checking 0 total links at http://localhost:8081/:  \n0 broken links' ],
      ])
    })
  })

  describe('check <site> on schedule <schedule>', () => {
    it('should error on bad urls', async () => {
      // act
      await room.user.say('alice', 'hubot check . on schedule * */5 * * *')
      await room.user.say('alice', 'hubot check / on schedule * */5 * * *')
      await room.user.say('alice', 'hubot check | on schedule * */5 * * *')
      await room.user.say('alice', 'hubot check : on schedule * */5 * * *')
      await room.user.say('alice', 'hubot check your mom on schedule * */5 * * *')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        [ 'alice', 'hubot check . on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `.`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check / on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `/`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check | on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `|`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check : on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `:`.  Are you sure it's a URL?" ],
        [ 'alice', 'hubot check your mom on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `your mom`.  Are you sure it's a URL?" ],
      ])
    })

    it('should error on invalid cron syntax', async () => {

      // act
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule asldkjfqlwkejr')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule asldkjfqlwkejr'],
        ['hubot', 'Sorry, `asldkjfqlwkejr` is not a valid cron syntax schedule.  Take a look at https://en.wikipedia.org/wiki/Cron'],
      ])
    })

    it('should error when scheduled too often', async () => {

      // act
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */4 * * * * ')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */4 * * * * '],
        ['hubot', `Sorry, I can't check a site's status more often than once in 5 minutes.`],
      ])
    })

    it('should check the site on the schedule', async () => {
      const brain = new Map<string, any>()
      room.robot.brain = brain

      this.clock = sinon.useFakeTimers()
      let ok = true
      app.get('/health', (req, res) => {
        if (ok) {
          res.send('OK')
        } else {
          res.sendStatus(500)
        }
      })

      // act
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * ')

        // let it do one check
      this.clock.tick(5.5 * 60 * 1000) // 5.5 min
      await wait(10)

        // now check again and get two 500s in a row
      ok = false
      this.clock.tick(5 * 60 * 1000)  // 10.5 min
      await wait(50)
      this.clock.tick(5 * 60 * 1000)  // 15.5 min
      await wait(50)

        // now check again and get OK
      ok = true
      this.clock.tick(5 * 60 * 1000)  // 20.5 min

      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health on the schedule `*/5 * * * *`'],
        ['hubot', ':fire: http://localhost:8081/health is down!  \n  500 (Internal Server Error)'],
        ['hubot', ':white_check_mark: http://localhost:8081/health is OK!  \n  It was down for 11 minutes.'],
      ])
    })
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
