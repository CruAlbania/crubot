import * as userAgent from 'default-user-agent'
import * as request from 'request'
import * as url from 'url'
import { Brain } from '../hubot'

interface ICheckStatusResult {
  timestamp: number
  url: url.Url,
  error?: string,

  /** If not broken, this is zero. */
  brokenSince: number
}

// tslint:disable-next-line:no-var-requires
const pkg = require('../../package.json')
const agent = userAgent(pkg.name, pkg.version)

export class StatusChecker {
  private brain: Brain

  constructor(brain: Brain) {
    this.brain = brain
  }

  public async CheckStatus(arg: url.Url): Promise<ICheckStatusResult> {

    return new Promise<ICheckStatusResult>((resolve, reject) => {
      request(
        url.format(arg),
        {
          method: 'GET',
          headers: {
            'user-agent': agent,
          },
        },
        (error, resp) => {
          if (error) {
            resolve(this.resolveError(arg, error))
          } else {
            resolve(this.resolveResult(arg, resp))
          }
        },
      )
    })
  }

  private resolveResult(arg: url.Url, resp: request.RequestResponse): ICheckStatusResult {
    const argPretty = url.format(arg)
    const last = this.brain.get<ICheckStatusResult>('sitechecker.status.' + argPretty)

    if (!last) {
      // brand new
      const ret: ICheckStatusResult = {
        timestamp: Date.now(),
        url: arg,

        brokenSince: 0,
      }
      if (isBroken(resp.statusCode)) {
        ret.error = `${resp.statusCode} (${resp.statusMessage})`
        ret.brokenSince = Date.now()
      }

      this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
      return ret
    }

    const ret: ICheckStatusResult = {
      timestamp: Date.now(),
      url: arg,

      brokenSince: 0,
    }
    if (isBroken(resp.statusCode)) {
      ret.error = `${resp.statusCode} (${resp.statusMessage})`
      if (last.brokenSince > 0) {
        // still broken
        ret.brokenSince = last.brokenSince
      } else {
        // newly broken
        ret.brokenSince = Date.now()
      }
    }

    this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
    return ret
  }

  private resolveError(arg: url.Url, error: any): ICheckStatusResult {
    const argPretty = url.format(arg)
    const last = this.brain.get<ICheckStatusResult>('sitechecker.status.' + argPretty)

    if (!last) {
      // brand new
      const ret: ICheckStatusResult = {
        error: error.message || error,
        timestamp: Date.now(),
        url: arg,

        brokenSince: Date.now(),
      }

      this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
      return ret
    }

    const ret: ICheckStatusResult = {
      error:  error.message || error,
      timestamp: Date.now(),
      url: arg,

      brokenSince: 0,
    }
    if (last.brokenSince > 0) {
      // still broken
      ret.brokenSince = last.brokenSince
    } else {
      // newly broken
      ret.brokenSince = Date.now()
    }

    this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
    return ret
  }
}

function isBroken(statusCode: number): boolean {
  return statusCode > 400
}
