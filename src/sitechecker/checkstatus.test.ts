// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as express from 'express'
import { Server } from 'http'
import * as sinon from 'sinon'
import * as url from 'url'

import { Robot } from '../hubot'
import { StatusChecker } from './checkstatus'
const expect = chai.expect

describe('hubot sitechecker check status', () => {

  let longRunning: any = it.skip
  if (process.env.LONG_RUNNING) {
    longRunning = it
  }

  let app: express.Express
  let server: Server

  beforeEach(() => {

    app = express()
    server = app.listen(8081)
    app.get('/', (req, resp) => {
      resp.send('{ "its": 1 }')
    })
  })

  afterEach((done) => {
    server.close(done)
  })

  it('should show error result for unreachable host', async () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').returns(undefined)

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://localhost:9999'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.be.approximately(Date.now(), 100, 'brokenSince')
    expect(result.error).to.equal('connect ECONNREFUSED 127.0.0.1:9999', 'error')
    expect(result.url).to.deep.equal(url.parse('http://localhost:9999'))
  })

  it('should show error result for bad domain', async () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').returns(undefined)

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://asdfkjalskjdfqwekjr.com'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.be.approximately(Date.now(), 100, 'brokenSince')
    expect(result.error).to.equal('getaddrinfo ENOTFOUND asdfkjalskjdfqwekjr.com asdfkjalskjdfqwekjr.com:80', 'error')
    expect(result.url).to.deep.equal(url.parse('http://asdfkjalskjdfqwekjr.com'))
  })

  it('should handle 404', async () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').returns(undefined)

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://localhost:8081/asdfkjqewlkrj'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.be.approximately(Date.now(), 100, 'brokenSince')
    expect(result.error).to.equal('404 (Not Found)', 'error')
    expect(result.url).to.deep.equal(url.parse('http://localhost:8081/asdfkjqewlkrj'))
  })

  it('should resolve good url', async () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').returns(undefined)

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://localhost:8081'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.equal(0, 'brokenSince')
    expect(result.error).to.be.undefined
    expect(result.url).to.deep.equal(url.parse('http://localhost:8081'))
  })

  it('should keep brokenSince from previous check when still broken', async () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').withArgs('sitechecker.status.http://localhost:8081/asdlkfjq').returns({
      timestamp: 17,
      brokenSince: 17,
      error: '404 (Not Found)',
      url: url.parse('http://localhost:8081/asdlkfjq'),
    })

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://localhost:8081/asdlkfjq'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.equal(17, 'brokenSince')
  })

  it('should keep old brokenSince when it is fixed', async () => {
    app.get('/asdlkfjq', (req, resp) => resp.send('fixed'))

    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').withArgs('sitechecker.status.http://localhost:8081/asdlkfjq').returns({
      timestamp: 55,
      brokenSince: 17,
      error: '404 (Not Found)',
      url: url.parse('http://localhost:8081/asdlkfjq'),
    })

    const checker = new StatusChecker(brain as any)

    // act
    const result = await checker.CheckStatus(url.parse('http://localhost:8081/asdlkfjq'))

    // assert
    expect(result.timestamp).to.be.approximately(Date.now(), 100, 'timestamp')
    expect(result.brokenSince).to.equal(17, 'brokenSince')
    expect(result.error).to.be.undefined
  })
})
