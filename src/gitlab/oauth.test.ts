// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as fs from 'fs'
import * as url from 'url'
const expect = chai.expect

import {UserToken} from './oauth'

process.env.HUBOT_GITLAB_URL = 'https://gitlab.myurl.test'
process.env.HUBOT_GITLAB_APP_ID = 'test_app_id'
process.env.HUBOT_GITLAB_APP_SECRET = 'test_app_secret'
process.env.HUBOT_URL = 'https://hubot.myurl.test'

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
// tslint:disable-next-line:no-var-requires
const Helper = require('hubot-test-helper')
const helper = new Helper('../gitlab.ts')

describe('OAuthListener', () => {
  let room: any

  beforeEach(() => {
    room = helper.createRoom()
  })

  afterEach(() => {
    room.destroy()
  })

  describe('sign in', ()  => {

    it('should make a signin link and send it in private', async () => {

      // act
      await room.user.say('alice', 'hubot gitlab sign in')
      await wait(10)  // need a quick yield so hubot can finish

      // assert
      expect(room.messages).to.have.length(3)
      expect(room.messages[2][1]).contains('Sent you a link in private')

      const link = url.parse(room.messages[1][1], true)
      expect(link.host).to.equal('gitlab.myurl.test')
      expect(link.protocol).to.equal('https:')
      expect(link.pathname).to.equal('/oauth/authorize')
      expect(link.query.client_id).to.equal('test_app_id')
      expect(decodeURIComponent(link.query.redirect_uri)).to.equal('https://hubot.myurl.test/gitlab/oauth')
      expect(link.query.response_type).to.equal('code')
      expect(link.query.state).to.contain('alice:')
    })

    it('should reply "you are already signed in" with valid token in brain', async () => {
      const token = new UserToken({
        id: 'alice',
        access_token: 'abcd1234',
        created_at: Date.now() - 10000,
        scope: 'api',
        refresh_token: 'test_refresh_token',
        token_type: 'test',
      })
      room.robot.brain = new Map<string, any>([
        ['gitlab.alice', token],
      ])

      // act
      await room.user.say('alice', 'hubot gitlab sign in')
      await wait(10)  // need a quick yield so hubot can finish

      // assert
      expect(room.messages).to.have.length(3)
      expect(room.messages[2][1].toLowerCase()).contains('you are already signed in')
      expect(room.messages[1][1].toLowerCase()).contains('here is your access key: abcd1234')
    })

    it('should remove bad token with unset access_token from brain', async () => {
        const token = new UserToken({
          id: 'alice',
          access_token: undefined,  // bad token
        })
        const store = new Map<string, any>([
          ['gitlab.alice', token],
        ])
        room.robot.brain = {
          set: (key, val) => store.set(key, val),
          get: (key) => store.get(key),
          remove: (key) => store.delete(key),
        }

        // act
        await room.user.say('alice', 'hubot gitlab sign in')
        await wait(10)  // need a quick yield so hubot can finish

        // assert
        expect(room.messages).to.have.length(3)
        expect(room.messages[2][1]).contains('Sent you a link in private')

        const link = url.parse(room.messages[1][1], true)
        expect(link.host).to.equal('gitlab.myurl.test')
    })
  })

  describe('sign out', () => {
    it('should forget the access key', async () => {
      const token = new UserToken({
        id: 'alice',
        access_token: 'abcd1234',
        created_at: Date.now() - 10000,
        scope: 'api',
        refresh_token: 'test_refresh_token',
        token_type: 'test',
      })
      const store = new Map<string, any>([
        ['gitlab.alice', token],
      ])
      room.robot.brain = {
        set: (key, val) => store.set(key, val),
        get: (key) => store.get(key),
        remove: (key) => store.delete(key),
      }

      // act
      await room.user.say('alice', 'hubot gitlab sign out')

      // assert
      expect(room.messages).to.have.length(2)
      expect(room.messages[1][1].toLowerCase()).contains('forgot your access key')
      expect(room.messages[1][1].toLowerCase()).contains('https://gitlab.myurl.test/profile/applications')
      expect(room.robot.brain.get('gitlab.alice')).to.be.undefined
    })

    it('should remind user if theyre not signed in', async () => {
      const token = new UserToken({
        id: 'alice',
        access_token: 'abcd1234',
        created_at: Date.now() - 10000,
        scope: 'api',
        refresh_token: 'test_refresh_token',
        token_type: 'test',
      })
      room.robot.brain = new Map<string, any>([
        ['gitlab.alice', token],
      ])

      // act
      await room.user.say('bob', 'hubot gitlab sign out')

      // assert
      expect(room.messages).to.have.length(2)
      expect(room.messages[1][1].toLowerCase()).contains("you're already signed out")
      expect(room.robot.brain.get('gitlab.alice')).to.equal(token, "alice's token")
    })
  })
})

function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
