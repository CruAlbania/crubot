
import { Router } from 'express'
import * as jsonQuery from 'json-query'

import { Response, Robot } from '../hubot'
import { Pipeline, Status } from './webhook_payloads'

export interface IWebhooksListenerOptions {
  gitlabToken?: string
  gitlabUrl: string
  webhookBase: string
}

export class WebhooksListener {
  private options: IWebhooksListenerOptions
  private robot: Robot

  private hashes = new Map<string, { hash: string, expires: number }>()

  constructor(options: IWebhooksListenerOptions, robot: Robot) {
    this.options = options
    this.robot = robot

    this.router = this.router.bind(this)
    this.webhook_make = this.webhook_make.bind(this)
  }

  public router(): Router {
    const self = this
    const store = this.robot.brain

    const r = Router()

    r.post('/:room/pipeline', (req, resp) => {
      if (typeof(req.body) === 'string') {
        try {
          req.body = JSON.parse(req.body)
        } catch (err) {
          resp.status(400)
          resp.send(err.toString())
          return
        }
      }
      const err = validatePipeline(req.body)
      if (err) {
        resp.status(400)
        resp.send(err.toString())
        return
      }

      const room = req.params.room
      if (! /\w+/i.test(room)) {
        resp.status(400)
        resp.send('bad "room" parameter - should match regex /\w+/i')
        return
      }

      const X_GITLAB_TOKEN: string = (this.options.gitlabToken || '').trim()
      if (X_GITLAB_TOKEN.length > 0) {
        const t = req.headers['x-gitlab-token']
        if (!t || t.trim() !== X_GITLAB_TOKEN) {
          resp.status(403)
          resp.send('bad x-gitlab-token')
          return
        }
      }

      if (isEmpty(req.query)) {
        req.query = { ref: 'master' } // by default ensure ref is master
      }

      const pipeline = req.body as Pipeline

      // move the pipeline.object_attributes to the root of the object so that 'ref=master' works in addition to 'object_attributes.ref=master'
      const formattedForQuery = Object.assign({}, pipeline.object_attributes, pipeline)

      for (const query in req.query) {
        if (!req.query.hasOwnProperty(query)) { continue }

        let expectation: string = req.query[query]
        if (!expectation || expectation.trim().length === 0) {
          expectation = '*'
        }
          // escape all regex special characters except * and |
        expectation = expectation.replace(/[-[\]{}()+?.,\\^$#\s]/g, '\\$&')
          // * becomes .+
        expectation = expectation.replace(/\*/g, '.*')
          // | automatically becomes a group match - just have to wrap it with (?:<expectation>)
        const expectationRegex = new RegExp('^(?:' + expectation + ')$', 'i')
        const q = jsonQuery(query, { data: formattedForQuery })
        console.log('testing', expectationRegex, 'against', q.value)
        if (
          !q.value ||                         // the query didn't give us a value
          ! expectationRegex.test(q.value)    // the expectationRegex didn't match
        ) {
          resp.status(204)
          resp.send('')
          return
        }
      }

      const msg = []
      switch (pipeline.object_attributes.status) {
        case 'success':
          msg.push(`:ok_hand: Pipeline for [${pipeline.project.name}](${pipeline.project.web_url}) succeeded!`)
          break

        case 'failed':
          const firstFailedJob = pipeline.builds
                                    .sort((b1, b2) => Date.parse(b1.finished_at).valueOf() - Date.parse(b2.finished_at).valueOf())
                                    .find((b) => b.status === 'failed')
          if (!firstFailedJob) {
            msg.push(`:warning: Pipeline failed for project [${pipeline.project.name}](${pipeline.project.web_url})!`)
          } else {
            msg.push(`:warning: Job \`${firstFailedJob.name}\` failed in project [${pipeline.project.name}](${pipeline.project.web_url})!`)
          }
          let commitMsg = pipeline.commit.message
          if (commitMsg.indexOf('\n') > -1) { commitMsg = commitMsg.substring(0, commitMsg.indexOf('\n')) }
          msg.push(`  commit: [${pipeline.commit.id.substring(0, 7)}](${pipeline.commit.url}) ${commitMsg} - ${pipeline.commit.author.name} (${pipeline.commit.author.email})`)
          if (firstFailedJob) {
            msg.push(`  [view logs](${pipeline.project.web_url}/builds/${firstFailedJob.id})`)
          }
          break

        default:

          break
      }

      self.robot.messageRoom(room, msg.join('  \n'))

      resp.send(msg.join('  \n'))
    })

    return r
  }

  public webhook_make(res: Response) {

    // example: https://gitlab.com/CruAlbaniaDigital/hapitjeter/settings/integrations
    res.reply(`Please put the following webhook in the project settings at ${this.options.gitlabUrl}/{namespace}/{project}/settings/integrations`,
      'and check the box marked "Pipeline events":',
      `\`${this.options.webhookBase}/${res.envelope.room}/pipeline\``,
    )
  }
}

function validatePipeline(body: Pipeline): Error {

  if (!body.object_attributes) {
    return Error('no object_attributes')
  }
  if (!body.object_attributes.status) {
    return Error('no object_attributes.status')
  }
  if (typeof(body.object_attributes.status) !== 'string') {
    return Error('object_attributes.status must be a string')
  }
  if (!body.project) {
    return Error('no project')
  }
  if (!body.project.name || typeof(body.project.name) !== 'string') {
    return Error('bad project.name')
  }
  if (!body.project.web_url || typeof(body.project.web_url) !== 'string') {
    return Error('bad project.web_url')
  }
  if (!body.commit) {
    return Error('bad commit')
  }
  if (!body.commit.id || typeof(body.commit.id) !== 'string') {
    return Error('bad commit.id')
  }
  if (!body.commit.message || typeof(body.commit.message) !== 'string') {
    return Error('bad commit.message')
  }
  if (!body.commit.author || typeof(body.commit.author) !== 'object') {
    return Error('bad commit.author')
  }

  if (!body.builds || !(body.builds instanceof Array)) {
    return Error('bad builds')
  }
  const err = body.builds.map((b, idx) => {
                if (!b.finished_at || typeof(b.finished_at) !== 'string') {
                  return Error(`bad builds[${idx}].finished_at`)
                }
                if (!b.status || typeof(b.finished_at) !== 'string') {
                  return Error(`bad builds[${idx}].status`)
                }
              }).find((e) => e !== undefined)
  if (err) {
    return err
  }
  return
}

function isEmpty(obj) {
   for (const x in obj) { if (obj.hasOwnProperty(x)) { return false } }
   return true
}
