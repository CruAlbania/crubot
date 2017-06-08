// tslint:disable:no-var-requires
// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as express from 'express'
import { Server } from 'http'
import * as url from 'url'
const expect = chai.expect

import { Robot } from '../hubot'
import { CheckLinks, ILinkCheckSummary, StatusCode } from './checklinks'

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

  it('should show error result for unreachable host', (done) => {

    // act
    CheckLinks(room.robot, url.parse('http://localhost:9999'), (error: any, summary) => {

      // assert
      expect(error).to.have.property('code', 'ECONNREFUSED')
      expect(error).to.have.property('address', '127.0.0.1')
      expect(error).to.have.property('port', 9999)
      expect(summary).to.have.property('status', StatusCode.error)

      done()
    })
  })

  it('should show error result for bad domain', (done) => {

    // act
    CheckLinks(room.robot, url.parse('http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz'), (error: any, summary) => {

      // assert
      expect(error.code).to.equal('ENOTFOUND')
      expect(summary).to.have.property('status', StatusCode.error)

      done()
    })
  })

  it('should handle 404', (done) => {

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081/asdfqkjwelrkjr'), (error, summary) => {

      // assert
      expect(error).to.have.property('code', 404)
      expect(summary).to.have.property('status', StatusCode.error)

      done()
    })
  })

  it('should handle single page site', (done) => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1></body></html>')
    })

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.be.undefined
      expect(summary).to.have.property('status', StatusCode.success)
      expect(summary.brokenLinks).to.deep.equal([], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(0, 'summary.linksChecked')

      done()
    })

  })

  it('should handle site with one working link', (done) => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/goodlink"></a>' +
        '</body></html>')
    })
    app.get('/goodlink', (req, res) => {
      res.send('<html><body><h1>This is a good link!</h1></body></html>')
    })

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.be.undefined
      expect(summary).to.have.property('status', StatusCode.success)
      expect(summary.brokenLinks).to.deep.equal([], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')

      done()
    })
  })

  it('should handle broken link', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/badlink"></a>' +
        '</body></html>')
    })

    // act
    const summary = await new Promise<ILinkCheckSummary>((resolve, reject) => {
        CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, s) => {
          if (error) { reject(error) } else { resolve(s) }
        })
      })

    // assert
    expect(summary).to.have.property('status', StatusCode.success)
    expect(summary.brokenLinks).to.deep.equal([
       { from: 'http://localhost:8081/', reason: 'HTTP_404', statusCode: 404, statusMessage: 'Not Found', url: 'http://localhost:8081/badlink' },
      ], 'summary.brokenLinks')
    expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')
  })

  it('should handle multiple broken links', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="/badlink"></a>' +
        '<a href="/badlink2"></a>' +
        '<a href="/badlink3"></a>' +
        '</body></html>')
    })

    // act
    const summary = await new Promise<ILinkCheckSummary>((resolve, reject) => {
        CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, s) => {
          if (error) { reject(error) } else { resolve(s) }
        })
      })

    // assert
    expect(summary).to.have.property('status', StatusCode.success)
    expect(summary.brokenLinks.find((l) => l.url === 'http://localhost:8081/badlink')).to.deep.equal(
      { from: 'http://localhost:8081/', reason: 'HTTP_404', statusCode: 404, statusMessage: 'Not Found', url: 'http://localhost:8081/badlink' },
      'summary.brokenLinks',
    )
    expect(summary.brokenLinks.find((l) => l.url === 'http://localhost:8081/badlink2')).to.deep.equal(
      { from: 'http://localhost:8081/', reason: 'HTTP_404', statusCode: 404, statusMessage: 'Not Found', url: 'http://localhost:8081/badlink2' },
      'summary.brokenLinks',
    )
    expect(summary.brokenLinks.find((l) => l.url === 'http://localhost:8081/badlink3')).to.deep.equal(
      { from: 'http://localhost:8081/', reason: 'HTTP_404', statusCode: 404, statusMessage: 'Not Found', url: 'http://localhost:8081/badlink3' },
      'summary.brokenLinks',
    )
    expect(Object.keys(summary.linksChecked)).to.have.length(3, 'summary.linksChecked')
  })

  it('should handle link to unresolvable domain', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz"></a>' +
        '</body></html>')
    })

    // act
    const summary = await new Promise<ILinkCheckSummary>((resolve, reject) => {
        CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, s) => {
          if (error) { reject(error) } else { resolve(s) }
        })
      })

    // assert
    expect(summary).to.have.property('status', StatusCode.success)
    expect(summary.brokenLinks).to.deep.equal([
      { from: 'http://localhost:8081/', reason: 'ERRNO_ENOTFOUND', statusCode: '', statusMessage: '', url: 'http://afsdlkqjewlkrjqkvnq23rjakjsdf.zzz/' },
      ], 'summary.brokenLinks')
    expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')
  })

  it('should handle link to unreachable host', async () => {
    app.get('/', (req, res) => {
      res.send('<html><body><h1>Hello World!</h1>' +
        '<a href="http://localhost:9999"></a>' +
        '</body></html>')
    })

    // act
    const summary = await new Promise<ILinkCheckSummary>((resolve, reject) => {
        CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, s) => {
          if (error) { reject(error) } else { resolve(s) }
        })
      })

    // assert
    expect(summary).to.have.property('status', StatusCode.success)
    expect(summary.brokenLinks).to.deep.equal([
      { from: 'http://localhost:8081/', reason: 'ERRNO_ECONNREFUSED', statusCode: '', statusMessage: '', url: 'http://localhost:9999/' },
      ], 'summary.brokenLinks')
    expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')
  })

  it('should handle 500 server error', (done) => {
    app.get('/', (req, res) => {
      res.status(500)
      res.send('<html><body><h1>This page broke!</h1></body></html>')
    })

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.have.property('code', 500)
      expect(summary).to.have.property('status', StatusCode.error)

      done()
    })
  })

  it('should handle link with 500 server error', (done) => {
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
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.be.undefined
      expect(summary).to.have.property('status', StatusCode.success)
      expect(summary.brokenLinks).to.deep.equal([
        { from: 'http://localhost:8081/', reason: 'HTTP_500', statusCode: 500, statusMessage: 'Internal Server Error', url: 'http://localhost:8081/link500' },
        ], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')

      done()
    })
  })

    // takes ~130 seconds
  longRunning('should handle connection timeout', (done) => {
    app.get('/', (req, res) => {
      res.status(200)
      res.write('')
      // never close the connection
    })

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error.message).to.equal('Error: socket hang up')
      done()
    })
  })

    // takes ~130 seconds
  longRunning('should handle link timeout', (done) => {
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
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.be.undefined

      expect(summary).to.have.property('status', StatusCode.success)
      expect(summary.brokenLinks).to.deep.equal([
        { from: 'http://localhost:8081/', reason: 'ERRNO_ECONNRESET', statusCode: '', statusMessage: '', url: 'http://localhost:8081/linktimeout' },
        ], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(1, 'summary.linksChecked')

      done()
    })
  })

  // long running
  it('should properly time out after HUBOT_LINK_CHECKER_TIMEOUT_SECONDS', (done) => {
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
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error.message).to.equal('timeout')

      expect(summary).to.have.property('status', StatusCode.timeout)
      expect(summary.brokenLinks).to.deep.equal([
        { from: 'http://localhost:8081/', reason: 'HTTP_404', statusCode: 404, statusMessage: 'Not Found', url: 'http://localhost:8081/badlink' },
        ], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(2, 'summary.linksChecked')

      done()
    })

  }).timeout(2100)

  // Tests a bug in parse5 which causes BrokenLinkChecker to fail.
  // https://github.com/inikulin/parse5/issues/197
  // https://github.com/stevenvachon/broken-link-checker/issues/71
  // fixed in broken-link-checker 0.7.6
  it('should handle interesting html', (done) => {
    app.get('/', (req, res) => {
      res.send('<html><body><a href="#"><p></a></body></html>')
    })

    // act
    CheckLinks(room.robot, url.parse('http://localhost:8081'), (error, summary) => {

      // assert
      expect(error).to.be.undefined

      expect(summary).to.have.property('status', StatusCode.success)
      expect(summary.brokenLinks).to.deep.equal([
        ], 'summary.brokenLinks')
      expect(Object.keys(summary.linksChecked)).to.have.length(0, 'summary.linksChecked')

      done()
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
