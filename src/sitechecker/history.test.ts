// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as express from 'express'
import * as fs from 'fs'
import * as sinon from 'sinon'
import * as url from 'url'
const expect = chai.expect

import {StatusCode} from './checklinks'
import { History } from './history'

describe('sitechecker history', () => {
  it('should store a new summary in the brain', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)

      // expectations
    Mbrain.expects('get').returns(undefined)
    Mbrain.expects('set').calledWith('sitechecker.history.http://a.com/', {
      summary: {
        timestamp: 1,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    })

    const uut = new History(brain as any)

    // act
    const diff = uut.store({
      timestamp: 2,
      start: 1,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [
        { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
      ],
      linksChecked: new Map<string, boolean>([
        ['http://a.com/', true],
        ['http://b.com/', true],
      ]),
    })

    // assert expectations
    Mbrain.verify()
    expect(diff).to.be.undefined
  })

  it('should store a summary with diff in the brain', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    Mbrain.expects('get').returns({
      summary: {
        timestamp: 1,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    })

      // expectations
    Mbrain.expects('set').calledWith('sitechecker.history.http://a.com/', {
      summary: {
        timestamp: 2,
        start: 1,
        status: StatusCode.success,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
          { url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
      },
      diff: {
        now: 2,
        lastCheck: 1,
        newLinks: [],
        newlyBrokenLinks: [
          { url: 'http://a.com/broken', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        newlyFixedLinks: [],
      },
    })

    const uut = new History(brain as any)

    // act
    const diff = uut.store({
      timestamp: 2,
      start: 1,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [
        { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
        { url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
      ],
      linksChecked: new Map<string, boolean>([
        ['http://a.com/', true],
        ['http://a.com/broken', true],
        ['http://b.com/', true],
      ]),
    })

    // assert expectations
    Mbrain.verify()
    expect(diff).to.deep.equal({
        now: 2,
        lastCheck: 1,
        newLinks: [],
        newlyBrokenLinks: [
          { url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        newlyFixedLinks: [],
      })
  })

  it('should return stored brain data on get', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    const data = {
      summary: {
        timestamp: 1,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
          { url: 'http://a.com/broken', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
      },
      diff: {
        now: 2,
        lastCheck: 1,
        newLinks: [],
        newlyBrokenLinks: [
          { url: 'http://a.com/broken', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        newlyFixedLinks: [],
      },
    }
    Mbrain.expects('get').returns(data)

    const uut = new History(brain as any)

    // act
    const summary = uut.lastSummary(url.parse('http://a.com'))

    // assert
    expect(summary).to.deep.equal(data)
  })

  it('should show new links in diff', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    const data = {
      summary: {
        timestamp: 1,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    }
    Mbrain.expects('get').returns(data)

    const uut = new History(brain as any)

    // act
    const diff = uut.diff({
      timestamp: 2,
      start: 1,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [
        { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
      ],
      linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://b.com/', true],
          ['http://b.com/new', true],
        ]),
    })

    // assert
    expect(diff).to.deep.equal({
        now: 2,
        lastCheck: 1,
        newLinks: ['http://b.com/new'],
        newlyBrokenLinks: [],
        newlyFixedLinks: [],
      })
  })

  it('should show newly broken links in diff', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    const data = {
      summary: {
        timestamp: 1,
        start: 0,
        status: StatusCode.success,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    }
    Mbrain.expects('get').returns(data)

    const uut = new History(brain as any)

    // act
    const diff = uut.diff({
      timestamp: 2,
      start: 1,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [
        { url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },   // newly broken http://a.com/broken
        { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
      ],
      linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
    })

    // assert
    expect(diff).to.deep.equal({
        now: 2,
        lastCheck: 1,
        newLinks: [],
        newlyBrokenLinks: [{ url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 }],
        newlyFixedLinks: [],
      })
  })

  it('should show new links that are also newly broken in diff', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    const data = {
      summary: {
        timestamp: 1,
        start: 0,
        status: StatusCode.success,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 0 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          // doesn't have http://a.com/broken
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    }
    Mbrain.expects('get').returns(data)

    const uut = new History(brain as any)

    // act
    const diff = uut.diff({
      timestamp: 2,
      start: 1,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [
        { url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },   // newly broken http://a.com/broken
        { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found' },
      ],
      linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],    // it's also a new link
          ['http://b.com/', true],
        ]),
    })

    // assert
    expect(diff).to.deep.equal({
        now: 2,
        lastCheck: 1,
        newLinks: ['http://a.com/broken'],
        newlyBrokenLinks: [{ url: 'http://a.com/broken', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 }],
        newlyFixedLinks: [],
      })
  })

  it('should show newly fixed links in diff', () => {
    const brain = { set: () => undefined, get: () => undefined }
    const Mbrain = sinon.mock(brain)
    const data = {
      summary: {
        timestamp: 2,
        start: 1,
        status: StatusCode.success,
        url: url.parse('http://a.com'),
        brokenLinks: [
          { url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 },
        ],
        linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
      },
      diff: undefined,
    }
    Mbrain.expects('get').returns(data)

    const uut = new History(brain as any)

    // act
    const diff = uut.diff({
      timestamp: 3,
      start: 2,
      status: StatusCode.success,
      url: url.parse('http://a.com'),
      brokenLinks: [],                              // fixed http://b.com/
      linksChecked: new Map<string, boolean>([
          ['http://a.com/', true],
          ['http://a.com/broken', true],
          ['http://b.com/', true],
        ]),
    })

    // assert
    expect(diff).to.deep.equal({
        now: 3,
        lastCheck: 2,
        newLinks: [],
        newlyBrokenLinks: [],
        newlyFixedLinks: [{ url: 'http://b.com/', from: 'http://a.com', reason: '404', statusCode: 404, statusMessage: 'not found', lastSuccess: 1 }],
      })
  })
})
