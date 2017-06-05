// tslint:disable:no-unused-expression
import * as chai from 'chai'
import * as express from 'express'
import * as fs from 'fs'
import * as request from 'request'
import * as url from 'url'
const expect = chai.expect

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
// tslint:disable-next-line:no-var-requires
const Helper = require('hubot-test-helper')
const helper = new Helper('../gitlab.ts')

describe('gitlab webhooks', () => {
  let room: any

  beforeEach(() => {
    room = helper.createRoom()
  })

  afterEach(() => {
    room.destroy()
  })

  describe('pipeline', () => {
    it('should message specified room on pipeline success webhook', (done) => {
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

          expect(resp).to.have.property('statusCode', 200)

          expect(room.messages).to.deep.equal([
            ['hubot', ':ok_hand: Pipeline for [hapitjeter](https://gitlab.com/cru-albania-ds/hapitjeter) succeeded!'],
          ])
          done()
        },
      )
    })

    it('should message specified room on pipeline failure webhook', (done) => {
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

    it('should not message room on subsequent successes')

    it('should reject webhook with bad x-gitlab-token')

    it('should reject malformed webhook')

    it('should ignore webhook for non-selected event')
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
