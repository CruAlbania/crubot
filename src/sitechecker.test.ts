// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as express from 'express'
import { Server } from 'http'
import * as moment from 'moment'
import * as sinon from 'sinon'
import * as url from 'url'
const expect = chai.expect

import { Robot } from './hubot'
import { ICronJobStore } from './sitechecker/scheduler'

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

  describe('check links <site>', () => {
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

  describe('check links <site> on schedule <schedule>', () => {
    it('should error on bad urls', async () => {
      // act
      await room.user.say('alice', 'hubot check links . on schedule * */5 * * *')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        [ 'alice', 'hubot check links . on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `.`.  Are you sure it's a URL?" ],
      ])
    })

    it('should error on invalid cron syntax', async () => {

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081 on schedule asldkjfqlwkejr')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081 on schedule asldkjfqlwkejr'],
        ['hubot', 'Sorry, `asldkjfqlwkejr` is not a valid cron syntax schedule.  Take a look at https://en.wikipedia.org/wiki/Cron'],
      ])
    })

    it('should error when scheduled too often', async () => {

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081 on schedule */4 * * * * ')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081 on schedule */4 * * * * '],
        ['hubot', `Sorry, Link checking takes a long time.  For that reason I can't schedule link checks more than once in a day.`],
      ])
    })

    it('should link check on the schedule', async () => {
        // set the fake clock to 12:00:01 AM today
      const start = moment().startOf('day').add(1, 'second').toDate().getTime()
      this.clock = sinon.useFakeTimers(start)
      let ok = true
      app.get('/', (req, res) => {
        res.send('<html><body><h1>Hello World!</h1>' +
          '<a href="/goodLink"></a>' +
          '<a href="/badLink"></a>' +
          '</body></html>')
      })
      app.get('/goodLink', (req, res) => {
        if (ok) {
          res.send('<html><body><h1>Good Link!</h1></body></h1>')
        } else {
          res.sendStatus(404)
        }
      })

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * ')
        // should do a first check immediately...
      await wait(10)
      this.clock.tick(100)
      await wait(100)

        // now pretend the link breaks
      ok = false

        // now run the timer one day so it checks again...
      this.clock.tick(24 * 60 * 60 * 1000)    // puts us at 12:00:01 am tomorrow
      await wait(100)
        // and one more second so we process the send queue...
      this.clock.tick(2 * 1000)
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * '],
        ['hubot', "Ok, I'll start checking http://localhost:8081/ for broken links on the schedule `0 0 * * *`" ],
        ['hubot', 'Finished checking 2 total links at http://localhost:8081/:  \n1 broken links'],
        ['hubot', '  * :x: http://localhost:8081/badLink Not Found (404) on page http://localhost:8081/'],
        ['hubot', ':x: Found broken links on http://localhost:8081/'],
        ['hubot', '  * :x: http://localhost:8081/goodLink Not Found (404) on page http://localhost:8081/'],
      ])
    })

    it('should queue up responses when theres a lot of bad links', async () => {
        // set the fake clock to 12:00:01 AM today
      const start = moment().startOf('day').add(1, 'second').toDate().getTime()
      this.clock = sinon.useFakeTimers(start)
      app.get('/', (req, res) => {
        let str = '<html><body><h1>Hello World!</h1>'
        for (let i = 0; i < 50; i++) {
          str += `<a href="/badLink${i}">${i}</a>`
        }
        str += '</body></html>'
        res.send(str)
      })

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * ')
        // should do a first check immediately...
      await wait(10)
      this.clock.tick(100)
      await wait(200)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * '],
        ['hubot', "Ok, I'll start checking http://localhost:8081/ for broken links on the schedule `0 0 * * *`" ],
        ['hubot', 'Finished checking 50 total links at http://localhost:8081/:  \n50 broken links'],
      ])

      this.clock.tick(1000)
      await wait(50)
      expect(room.messages).to.have.length(4, 'should add one more message')
      expect(room.messages[3][1]).to.have.length.greaterThan(1900, 'messages[3][1]')
      expect(room.messages[3][1]).to.have.length.lessThan(2048, 'messages[3][1]')

      this.clock.tick(1000)
      await wait(50)
      expect(room.messages).to.have.length(5, 'should add one more message')
    })

    it('should not register a second job if already scheduled for that url', async () => {
      this.clock = sinon.useFakeTimers()
      app.get('/health', (req, res) => {
        res.send('<html></html>')
      })

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081/health on schedule   0 0 */3 * *')
      await wait(50)
      await room.user.say('alice', 'hubot check links http://localhost:8081/health on schedule 0 0 */5 * * ')
      await wait(50)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081/health on schedule   0 0 */3 * *'],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health for broken links on the schedule `0 0 */3 * *`'],
        ['hubot', 'Finished checking 0 total links at http://localhost:8081/health:  \n0 broken links' ],
        ['alice', 'hubot check links http://localhost:8081/health on schedule 0 0 */5 * * '],
        ['hubot', "I'm already checking this site on the schedule `0 0 */3 * *`.  \n" +
                    'Please stop the job using `hubot stop checking links http://localhost:8081/health` and then restart it with the new schedule.'],
      ])
    })

    it('should register a second job for a different url', async () => {
      this.clock = sinon.useFakeTimers()
      app.get('/health', (req, res) => {
        res.send('<html></html>')
      })
      app.get('/health2', (req, res) => {
        res.send('<html></html>')
      })

      // act
      await room.user.say('alice', 'hubot check links http://localhost:8081/health on schedule   0 0 */3 * *')
      await wait(50)
      await room.user.say('alice', 'hubot check links http://localhost:8081/health2 on schedule 0 0 */5 * * ')
      await wait(50)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081/health on schedule   0 0 */3 * *'],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health for broken links on the schedule `0 0 */3 * *`'],
        ['hubot', 'Finished checking 0 total links at http://localhost:8081/health:  \n0 broken links' ],
        ['alice', 'hubot check links http://localhost:8081/health2 on schedule 0 0 */5 * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health2 for broken links on the schedule `0 0 */5 * *`'],
        [ 'hubot', 'Finished checking 0 total links at http://localhost:8081/health2:  \n0 broken links' ],
      ])
    })
  })

  describe('stop checking links <site>', () => {
    it('should notify the user if it wasnt checking the site', async () => {

      await room.user.say('alice', 'hubot stop checking links http://localhost:8081/')

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot stop checking links http://localhost:8081/'],
        ['hubot', "I wasn't checking http://localhost:8081/ for broken links."],
      ])
    })

    it('should cancel the job if it was running', async () => {
        // set the fake clock to 12:00:01 AM today
      const start = moment().startOf('day').add(1, 'second').toDate().getTime()
      this.clock = sinon.useFakeTimers(start)
      app.get('/', (req, res) => {
        res.send('<html><body><h1>Hello World!</h1>' +
          '<a href="/goodLink"></a>' +
          '<a href="/badLink"></a>' +
          '</body></html>')
      })
      app.get('/goodLink', (req, res) => {
        res.send('<html><body><h1>Good Link!</h1></body></h1>')
      })
      await room.user.say('alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * ')
      // should do a first check immediately...
      await wait(10)
      this.clock.tick(100)
      await wait(50)
      this.clock.tick(1100) // let it process the send queue
      await wait(50)

      // act
      await room.user.say('alice', 'hubot stop checking links http://localhost:8081')

        // now run the timer one day to where it would have run the cron job
      this.clock.tick(24 * 60 * 60 * 1000)    // puts us at 12:00:01 am tomorrow
      await wait(50)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check links http://localhost:8081 on schedule 0 0 * * * '],
        ['hubot', "Ok, I'll start checking http://localhost:8081/ for broken links on the schedule `0 0 * * *`" ],
        ['hubot', 'Finished checking 2 total links at http://localhost:8081/:  \n1 broken links'],
        ['hubot', '  * :x: http://localhost:8081/badLink Not Found (404) on page http://localhost:8081/'],
        ['alice', 'hubot stop checking links http://localhost:8081'],
        ['hubot', "Ok, I'll stop checking http://localhost:8081/ for broken links."],

      ])
    })

    it('should remove the room if it was running in multiple rooms wtihout canceling the job')
  })

  describe('check <site> on schedule <schedule>', () => {
    it('should error on bad urls', async () => {
      // act
      await room.user.say('alice', 'hubot check . on schedule * */5 * * *')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        [ 'alice', 'hubot check . on schedule * */5 * * *' ],
        [ 'hubot', "Sorry, I can't figure out how to check `.`.  Are you sure it's a URL?" ],
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
      await wait(50)

        // now check again and get two 500s in a row
      ok = false
      this.clock.tick(5 * 60 * 1000)  // 10.5 min
      await wait(50)
      this.clock.tick(5 * 60 * 1000)  // 15.5 min
      await wait(50)

        // now check again and get OK
      ok = true
      this.clock.tick(5 * 60 * 1000)  // 20.5 min

      await wait(50)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health on the schedule `*/5 * * * *`'],
        ['hubot', ':fire: http://localhost:8081/health is down!  \n  500 (Internal Server Error)'],
        ['hubot', ':white_check_mark: http://localhost:8081/health is OK!  \n  It was down for 11 minutes.'],
      ])
    })

    it('should not register a second job if already scheduled for that url', async () => {
      this.clock = sinon.useFakeTimers()
      app.get('/health', (req, res) => {
        res.send('OK')
      })

      // act
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */10 * * * * ')
      await wait(10)
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * ')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */10 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health on the schedule `*/10 * * * *`'],
        ['alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * '],
        ['hubot', "I'm already checking this site on the schedule `*/10 * * * *`.  \n" +
                    'Please stop the job using `hubot stop checking http://localhost:8081/health` and then restart it with the new schedule.'],
      ])
    })

    it('should register a second job for a different url', async () => {
      this.clock = sinon.useFakeTimers()
      app.get('/health', (req, res) => {
        res.send('OK')
      })

      // act
      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */10 * * * * ')
      await wait(10)
      await room.user.say('alice', 'hubot check http://localhost:8081/health2 on schedule */5 * * * * ')
      await wait(10)

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */10 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health on the schedule `*/10 * * * *`'],
        ['alice', 'hubot check http://localhost:8081/health2 on schedule */5 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health2 on the schedule `*/5 * * * *`'],
      ])
    })
  })

  describe('stop checking <site>', () => {
    it('should notify the user if it wasnt checking the site', async () => {

      await room.user.say('alice', 'hubot stop checking http://localhost:8081/health')

      // assert
      expect(room.messages).to.deep.equal([
        ['alice', 'hubot stop checking http://localhost:8081/health'],
        ['hubot', "I wasn't checking http://localhost:8081/health"],
      ])
    })

    it('should cancel the job if it was running', async () => {
      this.clock = sinon.useFakeTimers()
      app.get('/health', (req, res) => {
        res.send('OK')
      })

      await room.user.say('alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * ')

        // let it do one check
      this.clock.tick(5.5 * 60 * 1000) // 5.5 min
      await wait(10)

      // act
      await room.user.say('alice', 'hubot stop checking http://localhost:8081/health')

        // now run it till it checks again
      this.clock.tick(5 * 60 * 1000)  // 10.5 min

      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot check http://localhost:8081/health on schedule */5 * * * * '],
        ['hubot', 'Ok, I\'ll start checking http://localhost:8081/health on the schedule `*/5 * * * *`'],
        ['alice', 'hubot stop checking http://localhost:8081/health'],
        ['hubot', 'Ok, I\'ll stop checking http://localhost:8081/health'],
      ])
    })

    it('should remove the room if it was running in multiple rooms wtihout canceling the job')
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
