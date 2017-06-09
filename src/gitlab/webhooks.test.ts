// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import * as request from 'request'
import * as url from 'url'
import { Brain } from '../hubot'
const expect = chai.expect

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
// tslint:disable-next-line:no-var-requires
const Helper = require('hubot-test-helper')
const helper = new Helper([])

describe('gitlab webhooks', () => {
  let room: any

  beforeEach(() => {
    process.env.HUBOT_URL = 'https://test.url/'
    room = helper.createRoom()
  })

  afterEach(() => {
    room.destroy()
    delete(process.env.HUBOT_URL)
    delete(process.env.HUBOT_GITLAB_WEBHOOK_TOKEN)
    delete(process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE)
  })

  describe('pipeline', () => {
    it('should message specified room on pipeline success webhook', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')
      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })

    it('should message specified room on pipeline failure webhook', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()
      hookData.object_attributes.status = 'failed'
      hookData.builds.push({
        id: 17523910,
        stage: 'deploy',
        name: 'deploy_staging',
        status: 'failed',
        created_at: '2017-05-30 20:56:51 UTC',
        started_at: '2017-05-30 20:59:30 UTC',
        finished_at: '2017-05-30 21:00:24 UTC',
        when: 'on_success',
        manual: false,
        user: {
          name: 'Gordon Burgett',
          username: 'gordon.burgett',
          avatar_url: 'https://gitlab.com/uploads/user/avatar/428102/avatar.png',
        },
        runner: {
          id: 40786,
          description: 'shared-runners-manager-1.gitlab.com',
          active: true,
          is_shared: true,
        },
        artifacts_file: {
          filename: null,
          size: null,
        },
      })

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':warning: Job `deploy_staging` failed in project [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter)!  \n' +
                      '  commit: [b679c0a](https://gitlab.com/cru-albania-ds/hapitjeter/commit/b679c0a4b2d7ea2d185e9ad8c953bb57654b6565) remove deploy task to push with FTP which doesnt work - Gordon Burgett (gordon@gordonburgett.net)  \n' +
                      '  [view logs](https://gitlab.com/cru-albania-ds/hapitjeter/builds/17523910)'],
          ])
          done()
        },
      )
    })

    it('should not message room on subsequent successes', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')
      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          // do a second post with a new finished pipeline
          hookData.commit = {
            author: { name: 'Gordon Burgett', email: 'gordon@gordonburgett.net'},
            id: '1234567890abcd',
            message: 'a fake commit',
            timestamp: '2017-04-24T23:30:40+02:00',
            url: 'http://www.gitlab.com/asdf/1234567890abcd',
          }
          hookData.object_attributes.id = hookData.object_attributes.id + 1
          hookData.object_attributes.sha = hookData.object_attributes.before_sha = '1234567890abcd'
          hookData.object_attributes.finished_at = '2017-04-23 21:36:17 UTC' // +1 hour

          request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
            {
              body: JSON.stringify(hookData),
              headers: {
                'content-type': 'application/json',
                'accept': 'application/json',
              },
            }, (err2, resp2) => {
              if (err2) { done(err2); return }

              expect(resp2).to.have.property('statusCode', 204)
              expect(room.messages).to.have.length(1)

              done()
              },
          )
        },
      )
    })

    it('should message only once for pending -> running -> success', (done) => {
      (room.robot.brain as Brain).set('gitlab.webhooks.pipeline.cru-albania-ds/hapitjeter.master.room1', {
        id: 7814600,
        ref: 'master',
        sha: 'test1234',
        status: 'failed',             // last one failed - should send a "fixed" message
        finished_at: 1492979000000,   // test data minus some time
      })

      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')
      let hookData = testBody()

      // act
        // send a "pending" event
      hookData.object_attributes.status = 'pending'
      hookData.object_attributes.finished_at = null
      hookData.object_attributes.duration = null
      hookData.builds[0].status = 'running'
      hookData.builds[0].finished_at = null
      hookData.builds[1].status = 'created'
      hookData.builds[1].runner = null; hookData.builds[1].finished_at = null; hookData.builds[1].started_at = null
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        { body: JSON.stringify(hookData), headers: { 'content-type': 'application/json', 'accept': 'application/json' } },
        (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 204)

            // send a "running" event
          hookData.object_attributes.status = 'running'

          request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
            { body: JSON.stringify(hookData), headers: { 'content-type': 'application/json', 'accept': 'application/json' } },
            (err2, resp2) => {
              if (err2) { done(err2); return }

              expect(resp2).to.have.property('statusCode', 204)

              // send a "success" event
              hookData = testBody()
              request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
                { body: JSON.stringify(hookData), headers: { 'content-type': 'application/json', 'accept': 'application/json' } },
                (err3, resp3) => {
                  if (err3) { done(err3); return }

                  expect(resp3).to.have.property('statusCode', 200)
                  expect(room.messages).to.deep.equal([
                    ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) fixed!'],
                  ])

                  done()
                },
              )
            },
          )
        },
      )
    })

    it('should reject webhook with bad x-gitlab-token', (done) => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN = 'test_1234'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-gitlab-token': 'bad',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 403)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should reject webhook with no x-gitlab-token', (done) => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN = 'test_1234'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            // missing x-gitlab-token
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 403)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should allow webhook with generated x-gitlab-token based on given secret', (done) => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN = 'test_1234'
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE = 'test'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-gitlab-token': 'A9d20hxJaXPZej76ybM6J6NNORcZzs7NL8ZLS/TZ200=',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.have.length(1)
          done()
        },
      )
    })

    it('should allow webhook with randomized generated x-gitlab-token', (done) => {
      room.robot.brain.set('gitlab.webhooks.token', 'test_5678')
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE = 'test'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-gitlab-token': 'E+Qt9hmjj5K4HS9k1zufOAk+jcU0DxbAzokPwBovSOQ=',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)
          expect(room.messages).to.have.length(1)
          done()
        },
      )
    })

    it('should reject malformed webhook', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = ' { "malformed": json/ '

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 400)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should by default only match master', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()
      hookData.object_attributes.ref = 'feature1'

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 204)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should ignore webhook for non-selected event', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?object_attributes.status=failure',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 204)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should message room for selected event', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?status=success',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })

    it('should match multiple query selections', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?status=success&object_kind=pipeline&object_attributes.ref=deploy',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 204)

          expect(room.messages).to.deep.equal([
            // nothing
          ])
          done()
        },
      )
    })

    it('should handle "|" as an "or" expectation', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()
      hookData.object_attributes.ref = 'release'

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?ref=master|release',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })

    it('should handle "*" in expectation', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()
      hookData.object_attributes.ref = 'asdfq'

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?ref=*',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })

    it('should escape regex special chars', (done) => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      const hookData = testBody()

      // act
      request.post('http://localhost:8080/gitlab/webhook/room1/pipeline?commit.author.email=gordon@gordonburgett.net&project.description=*(http://hapitjeter.net)*',
        {
          body: JSON.stringify(hookData),
          headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
          },
        }, (err, resp) => {
          if (err) { done(err); return }

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })
  })

  describe('make', () => {

    it('should generate a base webhook as default', async () => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make webhook')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make webhook'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/{namespace}/{project}/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1`'],
      ])
    })

    it('should accept the pipeline option', async () => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make pipeline webhook')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make pipeline webhook'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/{namespace}/{project}/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1/pipeline`'],
      ])
    })

    it('should accept the project option', async () => {
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make webhook for project CruAlbaniaDigital/hapitjeter')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make webhook for project CruAlbaniaDigital/hapitjeter'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/CruAlbaniaDigital/hapitjeter/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1`'],
      ])
    })

    it('should include instructions for setting x-gitlab-token if required', async () => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN = 'test_1234'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make webhook')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make webhook'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/{namespace}/{project}/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1`'],
        ['hubot', '@alice You also need to set the "Secret Token" to equal the HUBOT_GITLAB_WEBHOOK_TOKEN.'],
      ])
    })

    it('should generate room-specific x-gitlab-token if GITLAB_WEBHOOK_TOKEN_GENERATE set', async () => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE = 'test'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make webhook')
      await wait(10)

      const prefix: string = room.robot.brain.get('gitlab.webhooks.token')
      const expectedToken = require('crypto').createHash('sha256').update(prefix + ':room1').digest('base64')

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make webhook'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/{namespace}/{project}/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1`'],
        ['hubot', `@alice You also need to set the "Secret Token" to \`${expectedToken}\``],
      ])
    })

    it('should base room-specific x-gitlab-token on HUBOT_GITLAB_WEBHOOK_TOKEN set', async () => {
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN = 'test_1234'
      process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE = 'test'
      room.robot.loadFile(path.resolve(path.join(__dirname, '../')), 'gitlab.ts')

      await room.user.say('alice', 'hubot gitlab make webhook')
      await wait(10)

      expect(room.messages).to.deep.equal([
        ['alice', 'hubot gitlab make webhook'],
        ['hubot', '@alice Please put the following webhook in the project settings at https://gitlab.com/{namespace}/{project}/settings/integrations'],
        ['hubot', '@alice and check the box for events you\'re interested in:'],
        ['hubot', '@alice `https://test.url/gitlab/webhook/room1`'],
        ['hubot', '@alice You also need to set the "Secret Token" to `A9d20hxJaXPZej76ybM6J6NNORcZzs7NL8ZLS/TZ200=`'],
      ])
    })
  })
})

function testBody() {

  return {
    object_kind: 'pipeline',
    object_attributes: {
      id: 7814643,
      ref: 'master',
      tag: false,
      sha: 'b679c0a4b2d7ea2d185e9ad8c953bb57654b6565',
      before_sha: 'b679c0a4b2d7ea2d185e9ad8c953bb57654b6565',
      status: 'success',
      stages: [
        'build',
        'test',
      ],
      created_at: '2017-04-23 20:32:11 UTC',
      finished_at: '2017-04-23 20:36:17 UTC',
      duration: 242,
    },
    user: {
      name: 'Gordon Burgett',
      username: 'gordon.burgett',
      avatar_url: 'https://gitlab.com/uploads/user/avatar/428102/avatar.png',
    },
    project: {
      name: 'hapitjeter',
      description: 'Source code for [hapitjeter.net](http://hapitjeter.net)',
      web_url: 'https://gitlab.com/cru-albania-ds/hapitjeter',
      avatar_url: null,
      git_ssh_url: 'git@gitlab.com:cru-albania-ds/hapitjeter.git',
      git_http_url: 'https://gitlab.com/cru-albania-ds/hapitjeter.git',
      namespace: 'cru-albania-ds',
      visibility_level: 20,
      path_with_namespace: 'cru-albania-ds/hapitjeter',
      default_branch: 'master',
    },
    commit: {
      id: 'b679c0a4b2d7ea2d185e9ad8c953bb57654b6565',
      message: 'remove deploy task to push with FTP which doesnt work\n',
      timestamp: '2017-04-23T23:30:40+02:00',
      url: 'https://gitlab.com/cru-albania-ds/hapitjeter/commit/b679c0a4b2d7ea2d185e9ad8c953bb57654b6565',
      author: {
        name: 'Gordon Burgett',
        email: 'gordon@gordonburgett.net',
      },
    },
    builds: [
      {
        id: 14863108,
        stage: 'test',
        name: 'test_integration',
        status: 'success',
        created_at: '2017-04-23 20:32:11 UTC',
        started_at: '2017-04-23 20:33:00 UTC',
        finished_at: '2017-04-23 20:36:17 UTC',
        when: 'on_success',
        manual: false,
        user: {
          name: 'Gordon Burgett',
          username: 'gordon.burgett',
          avatar_url: 'https://gitlab.com/uploads/user/avatar/428102/avatar.png',
        },
        runner: {
          id: 40786,
          description: 'shared-runners-manager-1.gitlab.com',
          active: true,
          is_shared: true,
        },
        artifacts_file: {
          filename: null,
          size: null,
        },
      },
      {
        id: 14863107,
        stage: 'build',
        name: 'lint',
        status: 'success',
        created_at: '2017-04-23 20:32:11 UTC',
        started_at: '2017-04-23 20:32:12 UTC',
        finished_at: '2017-04-23 20:32:58 UTC',
        when: 'on_success',
        manual: false,
        user: {
          name: 'Gordon Burgett',
          username: 'gordon.burgett',
          avatar_url: 'https://gitlab.com/uploads/user/avatar/428102/avatar.png',
        },
        runner: {
          id: 40788,
          description: 'shared-runners-manager-2.gitlab.com',
          active: true,
          is_shared: true,
        },
        artifacts_file: {
          filename: null,
          size: null,
        },
      },
    ],
  }
}

// since we might override setTimeout with sinon timers, capture it here and use it instead
const origSetTimeout = setTimeout
function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    origSetTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
