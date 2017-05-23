import * as chai from 'chai'
const expect = chai.expect

import {isSameSite} from './index'

describe('util', () => {
  describe('isSameSite', () => {
    it('should return true for equivalent urls', () => {

      const results = [
        isSameSite('http://google.com', 'http://google.com/'),
        isSameSite('https://google.com', 'https://google.com/'),
        isSameSite('http://google.com:443', 'http://google.com:443'),
        isSameSite('http://google.com/asdf', 'http://google.com/qwert?abc=def'),
        isSameSite('http://google.com:80', 'http://google.com/'),
        isSameSite('https://google.com', 'http://google.com:443/'),
      ]

      expect(results).to.have.length(6)

      results.forEach((r, idx) => {
        expect(r).to.equal(true, '' + idx)
      })
    })

    it('should return false for differing urls', () => {

      const results = [
        isSameSite('http://google.com', 'http://yahoo.com/'),
        isSameSite('https://www.google.com', 'https://google.com/'),
        isSameSite('http://google.com:443', 'http://google.com:80'),
        isSameSite('https://google.com', 'google.com'),
        isSameSite('http://google.com:443', 'http://google.com/'),
        isSameSite('https://google.com', 'http://google.com/'),
      ]

      expect(results).to.have.length(6)

      results.forEach((r, idx) => {
        expect(r).to.equal(false, '' + idx)
      })
    })
  })
})
