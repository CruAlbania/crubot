
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
    this.webhook_pipeline = this.webhook_pipeline.bind(this)
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

      const pipeline = req.body as Pipeline

      for (const query in req.query) {
        if (!req.query.hasOwnProperty(query)) { continue }

        const expectation = req.query[query]
        if (!expectation || expectation.trim().length === 0) {
          resp.status(400)
          resp.send('bad query value for ' + query)
          return
        }

        const q = jsonQuery(query, { data: pipeline })
        if (
          !q.value ||
          // use a loose-comparison here because we're receiving the expectation from a query string.  We should allow eg. 3 == '3'
          // tslint:disable-next-line:triple-equals
          (expectation !== '*' && q.value != expectation)
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

  public webhook_pipeline(res: Response) {
    // https://gitlab.com/CruAlbaniaDigital/hapitjeter/settings/integrations
    res.reply(`Please put the following webhook in the pipeline settings at ${this.options.gitlabUrl}/{namespace}/{project}/settings/integrations`,
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
