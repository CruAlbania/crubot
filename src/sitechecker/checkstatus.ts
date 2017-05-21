import * as userAgent from 'default-user-agent'
import * as request from 'request'
import * as url from 'url'
import { Brain } from '../hubot'

interface ICheckStatusResult {
  timestamp: number
  url: url.Url,
  error?: string,

  /**
   * If it was broken last time, this is the timestamp when it started being broken.
   */
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

    const ret: ICheckStatusResult = {
      timestamp: Date.now(),
      url: arg,

      brokenSince: 0,
    }

    if (isBroken(resp.statusCode)) {
      ret.error = `${resp.statusCode} (${resp.statusMessage})`

      if (!last || !last.error) {
        // it's newly broken
        ret.brokenSince = Date.now()
      } else {
        // it was broken last time too.
        ret.brokenSince = last.brokenSince
      }
    } else {
      // it's fixed - but if it was broken last time we need to maintain the brokenSince.
      if (last && last.error) {
        ret.brokenSince = last.brokenSince
      }
    }

    this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
    return ret
  }

  private resolveError(arg: url.Url, error: any): ICheckStatusResult {
    const argPretty = url.format(arg)
    const last = this.brain.get<ICheckStatusResult>('sitechecker.status.' + argPretty)

    const ret: ICheckStatusResult = {
      error: error.message || error,
      timestamp: Date.now(),
      url: arg,

      brokenSince: Date.now(),
    }

    if (!last || !last.error) {
      // it's newly broken
      ret.brokenSince = Date.now()
    } else {
      // it was broken last time too.
      ret.brokenSince = last.brokenSince
    }

    this.brain.set<ICheckStatusResult>('sitechecker.status.' + argPretty, ret)
    return ret
  }
}

function isBroken(statusCode: number): boolean {
  return statusCode > 400
}
