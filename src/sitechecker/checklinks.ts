
import * as blc from 'broken-link-checker'
import * as url from 'url'

import { Response, Robot } from '../hubot'

/**
 * The results of running link checker against a website
 */
export interface ILinkCheckSummary {
  /** The timestamp when the link check finished */
  timestamp: number
  /** The URL that started the check */
  url: url.Url
  /** The links that have been checked */
  linksChecked: Map<string, boolean>

  /** The broken links */
  brokenLinks: IBrokenLink[]
}

/**
 * A broken link and the reason why it's broken
 */
export interface IBrokenLink {
  /** The URL that was broken */
  url: string,
  /** The blc reason code - pretty print with `blc[link.reason]` */
  reason: string,
  /** The http status code (if http response returned) */
  statusCode: number,
  /** The http status message (if http response returned) */
  statusMessage: string
}

/**
 * Indicates the result of a link check against a site
 */
export enum StatusCode {
  /** The link check resulted in an error */
  error = 1,
  /** The link check timed out */
  timeout = 2,
  /** The link check ended with success */
  success = 3,
}

type CheckLinksCallback = (error: Error, status: StatusCode, summary: ILinkCheckSummary) => void

/**
 * Recursively crawls a website for broken links using 'broken-link-checker'
 *
 * @param robot the hubot robot
 * @param arg the URL to begin recursively crawling
 * @param cb A callback fired when the crawl finishes or times out
 */
export function CheckLinks(robot: Robot, arg: url.Url, cb: CheckLinksCallback) {
  const summary: ILinkCheckSummary = {
    timestamp: Date.now(),
    url: arg,
    linksChecked: new Map<string, boolean>(),
    brokenLinks: [] as IBrokenLink[],
  }

  const options = {
    excludedKeywords: ['tracking'],
    maxSocketsPerHost: 4,
  }
  if (process.env.HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS) {
    options.excludedKeywords = process.env.HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS.split(' ')
  }

  const sitechecker = new blc.SiteChecker(options, {
      // Called whenever a new link is discovered
    link: (result, customData) => {
      robot.logger.debug('link: ', result.url.resolved)
      if (result.broken) {
        if (!summary.linksChecked.get(result.url.resolved)) {
          summary.brokenLinks.push({
            url: result.url.resolved,
            reason: result.brokenReason,
            statusCode: result.http.response ? result.http.response.statusCode : '',
            statusMessage: result.http.response ? result.http.response.statusMessage : '',
          })
        }
      }
      summary.linksChecked.set(result.url.resolved, true)
    },
      // When the site is finished being checked, this gets called.
    site: (error, siteUrl, customData) => {
      if (error) {
        robot.emit('link-check.error', error, summary)
        summary.timestamp = Date.now()
        cb(error, StatusCode.error, summary)
        return
      }

      summary.timestamp = Date.now()
      cb(undefined, StatusCode.success, summary)
    },
  })

  // set up a listener for unhandled promise rejections - the library doesn't handle error conditions well
  const listener = unhandledRejectionListener(robot, summary, cb)
  process.once('unhandledRejection', listener)

  // enqueue the link check
  robot.emit('link-check.begin', arg)
  try {
    const idOrError = sitechecker.enqueue(url.format(arg))
    if (idOrError instanceof Error) {
      robot.emit('link-check.error', idOrError, summary)
      robot.emit('link-check.end', summary)
    }
  } catch (e) {
    robot.emit('link-check.error', e, summary)
    robot.emit('link-check.end', summary)
  }

  // set a timeout of default 30 minutes
  let timeoutSeconds = 30 * 60
  if (process.env.HUBOT_LINK_CHECKER_TIMEOUT_SECONDS) {
    timeoutSeconds = parseInt(process.env.HUBOT_LINK_CHECKER_TIMEOUT_SECONDS, 10)
  }
  const timeout = setTimeout(
    () => {
      sitechecker.pause()
      summary.timestamp = Date.now()
      robot.emit('link-check.timeout', summary)
      robot.emit('link-check.end', summary)
      cb(new Error('timeout'), StatusCode.timeout, summary)
    },
    timeoutSeconds * 1000,
  )

  // listen for the end event
  sitechecker.handlers.end = () => {
    process.removeListener('unhandledRejection', listener)
    clearTimeout(timeout)
    summary.timestamp = Date.now()
    robot.emit('link-check.end', summary)
  }
}

function unhandledRejectionListener(robot: Robot, summary: ILinkCheckSummary, cb: CheckLinksCallback): (e: any) => void {
  return (error) => {
    robot.logger.error('unhandledRejection', error)
    robot.emit('link-check.error', error, summary)
    robot.emit('link-check.end', summary)
    cb(error, StatusCode.error, summary)
  }
}
