// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as express from 'express'
import * as fs from 'fs'
import { Server } from 'http'
import { Robot } from '../hubot'
const expect = chai.expect

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
const Helper = require('hubot-test-helper')
const helper = new Helper(['../sitechecker.ts'])

describe('hubot check links', () => {

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
  })

  it('should show error result for unreachable host', async () => {

    // act
    const p = new Promise((resolve, reject) => {
      room.robot.on('link-check.error', (err) => resolve())
    })
    await room.user.say('alice', 'hubot check links http://localhost:9999')
    await p
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:9999' ],
      [ 'hubot', 'BRB, checking http://localhost:9999/ for broken links...' ],
      [ 'hubot', 'Got an error when checking http://localhost:9999/:  \n\n> The connection to 127.0.0.1:9999 was refused' ],

    ])
  })

  it('should show error result for bad domain', async () => {

    // act
    await room.user.say('alice', 'hubot check links http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz' ],
      [ 'hubot', 'BRB, checking http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz/ for broken links...' ],
      [ 'hubot', 'Got an error when checking http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz/:  \n\n> The hostname afsdlkqjewlkrjqkvnq23rjakjsdf.zzz could not be resolved' ],
    ])
  })

  it('should handle 404', async () => {

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081/asdfqkjwelrkjr')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081/asdfqkjwelrkjr' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/asdfqkjwelrkjr for broken links...' ],
      [ 'hubot', 'Got an error when checking http://localhost:8081/asdfqkjwelrkjr:  \n\n> 404: Not Found' ],
    ])
  })

  it('should handle single page site', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1></body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 0 broken links (0 total links)' ],
    ])

  })

  it('should handle site with one working link', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/goodlink"></a>' +
        '</body></html>')
    })
    app.get('/goodlink', (req, res) => {
      res.send('<html><body><h1>This is a good link!</h1></body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 0 broken links (1 total links)' ],
    ])
  })

  it('should handle broken link', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/badlink"></a>' +
        '</body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 1 broken links (1 total links)  \n:x: http://localhost:8081/badlink Not Found (404)' ],
    ])
  })

  it('should handle link to unresolvable domain', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz"></a>' +
        '</body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 1 broken links (1 total links)  \n:x: http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz/ no matching dns record (ENOTFOUND)' ],
    ])
  })

  it('should handle link to unreachable host', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="http://localhost:9999"></a>' +
        '</body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 1 broken links (1 total links)  \n:x: http://localhost:9999/ connection refused (ECONNREFUSED)' ],
    ])
  })

  it('should handle 500 server error', async () => {
    app.get('/', (req, res) => {
      res.status(500)
      res.send('<html><body><h1>This page broke!</h1></body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Got an error when checking http://localhost:8081/:  \n\n> 500: Internal Server Error' ],
    ])
  })

  it('should handle link with 500 server error', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/link500"></a>' +
        '</body></html>')
    })
    app.get('/link500', (req, res) => {
      res.status(500)
      res.send('<html><body><h1>This page broke!</h1></body></html>')
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 1 broken links (1 total links)  \n:exclamation: http://localhost:8081/link500 Internal Server Error (500)' ],
    ])
  })

    // takes ~130 seconds
  longRunning('should handle connection timeout', async () => {
    app.get('/', (req, res) => {
      res.status(200)
      res.write('')
      // never close the connection
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Got an error when checking http://localhost:8081/:  \n\n> Error: socket hang up' ],
    ])
  })

    // takes ~130 seconds
  longRunning('should handle link timeout', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/linktimeout"></a>' +
        '</body></html>')
    })
    app.get('/linktimeout', (req, res) => {
      res.status(200)
      res.write('')
      // never close the connection
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Finished checking http://localhost:8081/: 1 broken links (1 total links)  \n:x: http://localhost:8081/linktimeout connection reset by peer (ECONNRESET)' ],
    ])
  })

  // long running
  it('should properly time out after HUBOT_LINK_CHECKER_TIMEOUT_SECONDS', async () => {
      // set timeout to 1 second
    process.env.HUBOT_LINK_CHECKER_TIMEOUT_SECONDS = '1'

    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/goodlink"></a>' +
        '<a href="/badlink"></a>' +
        '<a href="/linktimeout"></a>' +
        '</body></html>')
    })
    app.get('/goodlink', (req, res) => {
      res.send('<html><body><h1>This is a good link!</h1></body></html>')
    })
    app.get('/linktimeout', (req, res) => {
      // send response after 2 seconds
      setTimeout(() => {
        res.send('<html><body><h1>This page takes a while to connect!</h1></body></html>')
      }, 2000)
    })

    // act
    await room.user.say('alice', 'hubot check links http://localhost:8081')
    await new Promise((resolve, reject) => {
      room.robot.on('link-check.end', (urls) => resolve())
    })
    await wait(20)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot check links http://localhost:8081' ],
      [ 'hubot', 'BRB, checking http://localhost:8081/ for broken links...' ],
      [ 'hubot', 'Timed out checking http://localhost:8081/: 1 broken links (2 total links)  \n:x: http://localhost:8081/badlink Not Found (404)' ],
    ])
  }).timeout(2100)
})

function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
