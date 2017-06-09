
import {createHash, randomBytes} from 'crypto'
import { Router } from 'express'
import * as jsonQuery from 'json-query'

import { Response, Robot } from '../hubot'
import { Object_Kind, Pipeline, Status } from './webhook_payloads'

export interface IWebhooksListenerOptions {
  gitlabToken?: string
  gitlabTokenGenerate: boolean
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

    this.options.gitlabUrl = this.options.gitlabUrl.replace(/\/+$/g, '')
    this.options.webhookBase = this.options.webhookBase.replace(/\/+$/g, '')

    this.router = this.router.bind(this)
    this.handle = this.handle.bind(this)
    this.webhook_make = this.webhook_make.bind(this)
  }

  public webhook_make(res: Response) {

    let type = res.match[1]
    if (type) {
      type = '/' + type
    } else {
      type = ''
    }

    let proj = res.match[2]
    if (!proj) {
      proj = '{namespace}/{project}'
    }

    // example: https://gitlab.com/CruAlbaniaDigital/hapitjeter/settings/integrations
    const ret = [`Please put the following webhook in the project settings at ${this.options.gitlabUrl}/${proj}/settings/integrations`,
      'and check the box for events you\'re interested in:',
      `\`${this.options.webhookBase}/${res.envelope.room}${type}\``,
    ]

    if (this.options.gitlabTokenGenerate) {
      // the prefix can be the environment variable, or a random prefix that we generate
      let prefix: string = this.options.gitlabToken
      if (!prefix) {
        prefix = this.robot.brain.get<string>('gitlab.webhooks.token')
        if (!prefix) {
          // first time - generate and set the token
          prefix = randomBytes(64).toString('hex')
          this.robot.brain.set<string>('gitlab.webhooks.token', prefix)
        }
      }

      const token = createHash('sha256').update(prefix + ':' + res.envelope.room).digest('base64')
      ret.push(`You also need to set the "Secret Token" to \`${token}\``)
    } else if (this.options.gitlabToken) {
      ret.push('You also need to set the "Secret Token" to equal the HUBOT_GITLAB_WEBHOOK_TOKEN.')
    }

    res.reply(...ret)
  }

  public router(): Router {
    const self = this
    const store = this.robot.brain

    const r = Router()

    r.post('/:room/', this.handle)
    r.post('/:room/:type', this.handle)

    return r
  }

  public handle(req, resp) {
    if (typeof(req.body) === 'string') {
      try {
        req.body = JSON.parse(req.body)
      } catch (err) {
        resp.status(400)
        resp.send(err.toString())
        return
      }
    }

    const room = req.params.room
    if (! /\w+/i.test(room)) {
      resp.status(400)
      resp.send('bad "room" parameter - should match regex /\w+/i')
      return
    }

    let token: string
    if (this.options.gitlabTokenGenerate) {
      const t = req.headers['x-gitlab-token']
      if (!t) {
        resp.status(403)
        resp.send('bad x-gitlab-token')
        return
      }

      let prefix = this.options.gitlabToken
      if (!prefix) {
        prefix = this.robot.brain.get<string>('gitlab.webhooks.token')
        if (!prefix) {
            // can't possibly match since its never been generated
          resp.status(403)
          resp.send('bad x-gitlab-token')
          return
        }
      }

      token = createHash('sha256').update(prefix + ':' + room).digest('base64')
    }

    if (token || this.options.gitlabToken) {
      const t = req.headers['x-gitlab-token']
      if (!t || (t.trim() !== token && t.trim() !== this.options.gitlabToken)) {
        resp.status(403)
        resp.send('bad x-gitlab-token')
        return
      }
    }

    if (req.params.type && req.params.type !== req.body.object_kind) {
      resp.status(403)
      resp.send('unexpected object_kind: ' + req.body.object_kind)
      return
    }

    if (!select(req.query, req.body)) {
        // valid request, but does not produce a message.  204 no content.
      resp.status(204)
      resp.send('')
      return
    }

    let message: string[]
    switch (req.body.object_kind as Object_Kind) {
      case 'pipeline':
        const err = validatePipeline(req.body)
        if (err) {
          resp.status(400)
          resp.send(err.toString())
          return
        }
        message = this.handler_pipeline(req.body, room)
        break

      default:
        resp.status(404)
        resp.send('unknown object_kind ' + req.body.object_kind)
        return
    }

    if (message && message.length > 0) {
      const formattedMsg = message.join('  \n')
      this.robot.messageRoom(room, formattedMsg)
      resp.send(formattedMsg)
    } else {
      resp.status(204)
      resp.send('')
    }
  }

  private handler_pipeline(pipeline: Pipeline, room: string): string[] {
    const current: IPipelineHistory = {
      id: pipeline.object_attributes.id,
      ref: pipeline.object_attributes.ref,
      sha: pipeline.object_attributes.sha,
      status: pipeline.object_attributes.status,
      finished_at: Date.parse(pipeline.object_attributes.finished_at),
    }

    const msg = []
    switch (pipeline.object_attributes.status) {
      case 'success':
        const last = this.robot.brain.get<IPipelineHistory>(makeHistoryKey(pipeline, room))
          // if last exists, and represents a previous build (not the same ID & finished before this one)
        if (last && last.id !== current.id && last.finished_at < current.finished_at) {
          if (last.status === 'success') {
            // no reason to say anything for repeated successes
          } else if (last.status === 'failed') {
            // it's a "fixed" build
            msg.push(`:ok_hand: Pipeline for [${pipeline.project.name}](${pipeline.project.web_url}) fixed!`)
          }
        } else {
          msg.push(`:ok_hand: Pipeline for [${pipeline.project.name}](${pipeline.project.web_url}) succeeded!`)
        }

        this.robot.brain.set<IPipelineHistory>(makeHistoryKey(pipeline, room), current)
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

        this.robot.brain.set<IPipelineHistory>(makeHistoryKey(pipeline, room), current)
        break

      default:

        break
    }
    return msg
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
                if (!b.status || typeof(b.status) !== 'string') {
                  return Error(`bad builds[${idx}].status`)
                }
              }).find((e) => e !== undefined)
  if (err) {
    return err
  }
  return
}

function select(query: { [key: string]: string}, body: any): boolean {
  if (isEmpty(query)) {
    query = { ref: 'master' } // by default ensure ref is master
  }

  // move the object_attributes to the root of the object so that 'ref=master' works in addition to 'object_attributes.ref=master'
  if (body.object_attributes) {
    body = Object.assign({}, body.object_attributes, body)
  }

  for (const q in query) {
    if (!query.hasOwnProperty(q)) { continue }

    let expectation: string = query[q]
    if (!expectation || expectation.trim().length === 0) {
      expectation = '*'
    }
      // escape all regex special characters except * and |
    expectation = expectation.replace(/[-[\]{}()+?.,\\^$#\s]/g, '\\$&')
      // * becomes .+
    expectation = expectation.replace(/\*/g, '.*')
      // | automatically becomes a group match - just have to wrap it with (?:<expectation>)
    const expectationRegex = new RegExp('^(?:' + expectation + ')$', 'i')
    const result = jsonQuery(q, { data: body })
    if (
      !result.value ||                         // the query didn't give us a value
      ! expectationRegex.test(result.value)    // the expectationRegex didn't match
    ) {
      return false
    }
  }

  return true
}

function isEmpty(obj) {
  if (!obj) { return true }
  for (const x in obj) { if (obj.hasOwnProperty(x)) { return false } }
  return true
}

interface IPipelineHistory {
  id: number
  ref: string
  sha: string
  status: Status
  finished_at: number
}

function makeHistoryKey(pipeline: Pipeline, room: string): string {
  return `gitlab.webhooks.pipeline.${pipeline.project.path_with_namespace}.${pipeline.object_attributes.ref}.${room}`
}
