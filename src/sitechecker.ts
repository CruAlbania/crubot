// Description:
//   runs status checks on a website, including checking for broken links
//
// Dependencies:
//   "broken-link-checker": "^0.7.4"
//
// Configuration:
//   HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS: a space-separated set of globs to ignore.  Default: "tracking" (see https://github.com/stevenvachon/broken-link-checker#optionsexcludedkeywords)
//   HUBOT_LINK_CHECKER_TIMEOUT_SECONDS: The number of seconds before a site scan ends in timeout.  Default: 30 minutes.
//   HUBOT_LINK_CHECKER_COOLDOWN_SECONDS: The number of seconds before a site scan can be tried again.  Default: 1 hour.
//   HUBOT_LINK_CHECKER_MIN_SCHEDULE_SECONDS: The minimum period for checking links of any particular site.  Default: 1 day.
//   HUBOT_SITE_CHECK_MIN_SCHEDULE_SECONDS: The minimum period for status checking any particular site.  Default: 5 minutes.
//
// Commands:
//   hubot check links <url> - Crawl the given website recursively for broken links
//   hubot check links <url> on schedule <cron schedule> - Crawl the given site automatically on the schedule, reporting newly broken links
//   hubot stop checking links <url> - Stop checking links automatically on the given site
//   hubot check <url> on schedule <cron schedule> - Automatically run a status check against the given URL on the schedule specified by the cron expression.
//   hubot stop checking <url> - Stop running a status check automatically against the given URL
//   hubot list scheduled checks - List all the site checks that are scheduled to be run.
//
// Notes:
//
//
// Author:
//   gburgett

import * as blc from 'broken-link-checker'
import { CronTime } from 'cron'
import * as moment from 'moment'
import * as Path from 'path'
import * as url from 'url'

import { Response, Robot } from './hubot'
import { CheckLinks, IBrokenLink, ILinkCheckSummary, StatusCode } from './sitechecker/checklinks'
import {StatusChecker} from './sitechecker/checkstatus'
import { History } from './sitechecker/history'
import { Scheduler } from './sitechecker/scheduler'
import {isSameSite} from './util'

module.exports = (robot: Robot) => {

  const LINK_CHECKER_COOLDOWN_SECONDS = process.env.HUBOT_LINK_CHECKER_COOLDOWN_SECONDS || (60 * 60)   // 1 hour default
  const LINK_CHECKER_MIN_SCHEDULE_SECONDS = process.env.HUBOT_LINK_CHECKER_MIN_SCHEDULE_SECONDS || (24 * 60 * 60) // 1 day default
  const SITE_CHECK_MIN_SCHEDULE_SECONDS = process.env.HUBOT_SITE_CHECK_MIN_SCHEDULE_SECONDS || (5 * 60)   // 5 min default

    // status check
  const statusChecker = new StatusChecker(robot.brain)

    // link check
  const history = new History(robot.brain)
  const current = new Map<string, number>()

    // scheduler
  const scheduler = new Scheduler(robot.brain, new Map([
    ['status', statusCheckService],
    ['brokenlinks', brokenLinksCheckService],
  ]))

  /*robot.on('link-check.error', (arg: url.Url) => {
    robot.logger.error('Link Checker error for ', arg)
  })
  robot.on('link-check.begin', (arg: url.Url) => {
    robot.logger.info('Link Checker begin for ', arg)
  })
  robot.on('link-check.end', (arg: url.Url) => {
    robot.logger.info('Link Checker end for ', arg)
  })
  robot.on('link-check.timeout', (arg: url.Url) => {
    robot.logger.error('Link Checker timeout for ', arg)
  })*/

  robot.respond(/check\s+links\s+(.+)\s+every\s+(.+)$/i, (res) => {
    res.finish()
    res.send('Sorry, I cant do this yet')
  })

  robot.respond(/check\s+links\s+(.+)\s+on schedule\s+(.+)$/i, (res) => {
    res.finish()
    let arg: url.Url
    try {
      arg = validateUrl(res.match[1])
      if (!arg) {
        res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
        return
      }
    } catch (e) {
      robot.logger.info('RL parse error for', res.match[1], ':', e)
      res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
      return
    }

    const schedule = res.match[2].trim()
    const minDuration = moment.duration(LINK_CHECKER_MIN_SCHEDULE_SECONDS, 'seconds')
    try {
      const time = new CronTime(schedule) as any
      const next2: moment.Moment[] = time.sendAt(2)
      const diff = next2[1].diff(next2[0])    // difference in milliseconds
      if (diff < minDuration.asMilliseconds()) {
        res.send(`Sorry, Link checking takes a long time.  For that reason I can't schedule link checks more than once in ${minDuration.humanize()}.`)
        return
      }
    } catch (error) {
      res.send('Sorry, `' + schedule + '` is not a valid cron syntax schedule.  Take a look at https://en.wikipedia.org/wiki/Cron')
      return
    }

    const existing = scheduler.GetRunningJobs().find((job) =>
        job.definition.serviceName === 'brokenlinks' &&    // a 'brokenlinks' job
        isSameSite(job.definition.context.site, arg) &&   // for this site
        Path.normalize(arg.path) === Path.normalize(job.definition.context.site.path), // with the same path
      )

    let context: IBrokenLinksCheckContext
    if (existing) {
      context = existing.definition.context
      if (context.rooms.indexOf(res.envelope.room) !== -1) {
        res.send(`I'm already checking this site on the schedule \`${existing.definition.cronTime}\`.  \n` +
          `Please stop the job using \`${robot.name} stop checking links ${url.format(context.site)}\` and then restart it with the new schedule.`)
        return
      } else {
        // update the context to report also to this room
        context.rooms.push(res.envelope.room)
        // restart the job with the new context
        scheduler.StopJob(existing.definition.id)
        return
      }
    } else {
      context = {
        site: arg,
        rooms: [res.envelope.room],
      }
    }

    const jobId = scheduler.StartJob(schedule, 'brokenlinks', context, true)
    res.send(`Ok, I'll start checking ${url.format(context.site)} for broken links on the schedule \`${schedule}\``)
  })

  robot.respond(/stop\s+check(?:ing)?\s+links\s+(.+)$/i, (res) => {
    res.finish()
    let arg: url.Url
    try {
      arg = validateUrl(res.match[1])
      if (!arg) {
        res.send(`Sorry, I can't figure out \`${res.match[1]}\`.  Are you sure it's a URL?`)
        return
      }
    } catch (e) {
      robot.logger.info('RL parse error for', res.match[1], ':', e)
      res.send(`Sorry, I can't figure out \`${res.match[1]}\`.  Are you sure it's a URL?`)
      return
    }

    const existing = scheduler.GetRunningJobs().find((job) =>
        job.definition.serviceName === 'brokenlinks' &&    // a 'brokenlinks' job
        isSameSite(job.definition.context.site, arg) &&   // for this site
        Path.normalize(arg.path) === Path.normalize(job.definition.context.site.path), // with the same path
      )
    if (!existing) {
      res.send(`I wasn't checking ${url.format(arg)} for broken links.`)
      return
    }

    const job = scheduler.StopJob(existing.definition.id)
    res.send(`Ok, I'll stop checking ${url.format(arg)} for broken links.`)
  })

  robot.respond(/check links\s+(.+)$/i, (res) => {
    res.finish()
    let arg: url.Url
    try {
      arg = validateUrl(res.match[1])
      if (!arg) {
        res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
        return
      }
    } catch (e) {
      robot.logger.info('RL parse error for', res.match[1], ':', e)
      res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
      return
    }

    const last = history.lastSummary(arg)
    if (last && (Date.now() - last.summary.timestamp) < LINK_CHECKER_COOLDOWN_SECONDS * 1000) {
      res.send("I just checked that URL recently.  Unfortunately checking links takes a long time, so I can't do it very often.  " +
      `Try again after ${LINK_CHECKER_COOLDOWN_SECONDS} seconds.`)
      return
    }
    const argPretty = url.format(arg)

    if ((Date.now() - current.get(argPretty)) < LINK_CHECKER_COOLDOWN_SECONDS * 1000) {
      res.send("I'm already checking that URL.  I'll let you know when I'm finished.")
      return
    }

    res.send(`BRB, checking ${url.format(arg)} for broken links...`)
    current.set(argPretty, Date.now())

    // run the link check
    CheckLinks(robot, arg, (error, summary) => {
      current.delete(argPretty)   // finished
      switch (summary.status) {
        case StatusCode.error:
        {
          res.send(`Got an error when checking ${argPretty}:  \n\n` +
          '> ' + prettyPrint(error))
          break
        }

        case StatusCode.timeout:
        {
          history.store(summary)
          res.send(`Timed out checking ${summary.linksChecked.size} total links at ${url.format(summary.url)}:  \n` +
                      `${summary.brokenLinks.length} broken links`)

          if (summary.brokenLinks.length > 0) {
            res.send(formatBrokenLinkList(summary.brokenLinks).join('  \n'))
          }
          break
        }

        case StatusCode.success:
        {
          history.store(summary)
          res.send(`Finished checking ${summary.linksChecked.size} total links at ${url.format(summary.url)}:  \n` +
                      `${summary.brokenLinks.length} broken links`)

          if (summary.brokenLinks.length > 0) {
            res.send(formatBrokenLinkList(summary.brokenLinks).join('  \n'))
          }
          break
        }

        default:
          robot.logger.error('[sitechecker] Unknown status code:', status)
          break
      }
    })
  })

  robot.respond(/check\s+(.+)\s+every\s+(.+)$/i, (res) => {
    res.finish()
    res.send('Sorry, I cant do this yet')
  })

  robot.respond(/check\s+(.+)\s+on\s+schedule\s+(.+)$/i, (res) => {
    res.finish()
    let arg: url.Url
    try {
      arg = validateUrl(res.match[1])
      if (!arg) {
        res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
        return
      }
    } catch (e) {
      robot.logger.info('RL parse error for', res.match[1], ':', e)
      res.send(`Sorry, I can't figure out how to check \`${res.match[1]}\`.  Are you sure it's a URL?`)
      return
    }

    const schedule = res.match[2].trim()
    const minDuration = moment.duration(SITE_CHECK_MIN_SCHEDULE_SECONDS, 'seconds')
    try {
      const time = new CronTime(schedule) as any
      const next2: moment.Moment[] = time.sendAt(2)
      const diff = next2[1].diff(next2[0])    // difference in milliseconds
      if (diff < minDuration.asMilliseconds()) {
        res.send(`Sorry, I can't check a site's status more often than once in ${minDuration.humanize()}.`)
        return
      }
    } catch (error) {
      res.send('Sorry, `' + schedule + '` is not a valid cron syntax schedule.  Take a look at https://en.wikipedia.org/wiki/Cron')
      return
    }

    const existing = scheduler.GetRunningJobs().find((job) =>
        job.definition.serviceName === 'status' &&        // a 'status' job
        isSameSite(job.definition.context.site, arg) &&   // for this site
        Path.normalize(arg.path) === Path.normalize(job.definition.context.site.path), // with the same path
      )

    let context: IStatusCheckContext
    if (existing) {
      context = existing.definition.context
      if (context.rooms.indexOf(res.envelope.room) !== -1) {
        res.send(`I'm already checking this site on the schedule \`${existing.definition.cronTime}\`.  \n` +
          `Please stop the job using \`${robot.name} stop checking ${url.format(context.site)}\` and then restart it with the new schedule.`)
        return
      } else {
        // update the context to report also to this room
        context.rooms.push(res.envelope.room)
        // restart the job with the new context
        scheduler.StopJob(existing.definition.id)
        return
      }
    } else {
      context = {
        site: arg,
        rooms: [res.envelope.room],
      }
    }

    const jobId = scheduler.StartJob(schedule, 'status', context)
    res.send(`Ok, I'll start checking ${url.format(context.site)} on the schedule \`${schedule}\``)
  })

  robot.respond(/stop\s+check(?:ing)?\s+(.+)$/i, (res) => {
    res.finish()
    let arg: url.Url
    try {
      arg = validateUrl(res.match[1])
      if (!arg) {
        res.send(`Sorry, I can't figure out \`${res.match[1]}\`.  Are you sure it's a URL?`)
        return
      }
    } catch (e) {
      robot.logger.info('RL parse error for', res.match[1], ':', e)
      res.send(`Sorry, I can't figure out \`${res.match[1]}\`.  Are you sure it's a URL?`)
      return
    }

    const existing = scheduler.GetRunningJobs().find((job) =>
        job.definition.serviceName === 'status' &&    // a 'brokenlinks' job
        isSameSite(job.definition.context.site, arg) &&   // for this site
        Path.normalize(arg.path) === Path.normalize(job.definition.context.site.path), // with the same path
      )
    if (!existing) {
      res.send(`I wasn't checking ${url.format(arg)}`)
      return
    }

    const job = scheduler.StopJob(existing.definition.id)
    res.send(`Ok, I'll stop checking ${url.format(arg)}`)
  })

  const serviceNamesPretty = {
    status: 'Status Check',
    brokenlinks: 'Broken Link Check',
  }
  robot.respond(/list\s+scheduled(?:\s+site)?\s+checks/i, (res) => {
    res.finish()
    const jobs = scheduler.GetRunningJobs()
    if (jobs.length === 0) {
      res.send("I don't have any site checks scheduled.")
      return
    }
    let resp = "Here's all the checks I currently have scheduled:  \n"
    resp += jobs.map((job) => {
      const next = ((job.job as any).nextDate() as moment.Moment)
      return `  * ${serviceNamesPretty[job.definition.serviceName]} on ${url.format(job.definition.context.site)}  \n` +
             `      next check in ${next.fromNow(true)}`
    }).join('  \n')

    res.send(resp)
  })

  // ----------------------------- CRON SERVICES -------------------------- //

  interface IStatusCheckContext {
    site: url.Url
    rooms: string[]
  }

  function statusCheckService(context: IStatusCheckContext) {
    statusChecker.CheckStatus(context.site)
      .then((result) => {
        if (result.error) {
          robot.logger.debug('[sitechecker] Broken site', result)
          if (result.brokenSince === result.timestamp) {
            // it's newly broken - say something
            context.rooms.forEach((r) => {
              robot.messageRoom(r, `:fire: ${url.format(context.site)} is down!  \n  ${result.error}`)
            })
          }
          // we've already notified - wait till it gets fixed.
        } else {
          if (result.brokenSince !== 0) {
            // it's fixed, but it was broken before.
            const howLong = moment.duration(result.brokenSince, 'milliseconds').humanize()
            context.rooms.forEach((r) => {
              robot.messageRoom(r, `:white_check_mark: ${url.format(context.site)} is OK!  \n  It was down for ${howLong}.`)
            })
          }
        }
      })
  }

  interface IBrokenLinksCheckContext {
    site: url.Url
    rooms: string[]
  }

  function brokenLinksCheckService(context: IBrokenLinksCheckContext) {
    const argPretty = url.format(context.site)
    current.set(argPretty, Date.now())

    // run the link check
    CheckLinks(robot, context.site, (error, summary) => {
      current.delete(argPretty)   // finished

      switch (summary.status) {
        case StatusCode.error:
        {
          const last = history.lastSummary(context.site)
          if (!last || last.summary.status !== StatusCode.error ) {
            context.rooms.forEach((r) => {
              robot.messageRoom(r, `:fire: ${url.format(context.site)} is down!  \n  ${error}`)
            })
          }
          history.store(summary)
          break
        }

        case StatusCode.timeout:
        case StatusCode.success:
        {
          const diff = history.store(summary)
          let head: string
          if (!diff) {
            // new link check - send header
            const finished = summary.status === StatusCode.timeout ? 'Timed out' : 'Finished'
            head = `${finished} checking ${summary.linksChecked.size} total links at ${url.format(summary.url)}:  \n` +
                      `${summary.brokenLinks.length} broken links`
          } else if (diff.newlyBrokenLinks.length === 0 && diff.newlyFixedLinks.length === 0) {
             // nothing to say
             break
          } else {
            if (diff.newlyBrokenLinks.length > 0) {
              // add warning header
              head = `:x: Found broken links on ${argPretty}`
            } else if (diff.newlyFixedLinks.length > 0) {
              head = `:white_check_mark: Some links which were broken on ${argPretty} are now fixed.`
            }
          }
            // send header
          context.rooms.forEach((r) => {
            robot.messageRoom(r, head)
          })

          let body: string[] = []
          if (!diff) {
            if (summary.brokenLinks.length > 0) {
              body = formatBrokenLinkList(summary.brokenLinks)
            }
          } else {
            if (diff.newlyBrokenLinks.length > 0) {
              body.push(...formatBrokenLinkList(diff.newlyBrokenLinks))
            }
            if (diff.newlyFixedLinks.length > 0) {
              body.push(...formatBrokenLinkList(diff.newlyFixedLinks))
            }
          }

            // send body
          if (body.length > 0) {
            context.rooms.forEach((r) => {
              robot.messageRoom(r, body.join('  \n'))
            })
          }
        }
        break

        default:
          robot.logger.error('[sitechecker] Unknown status code:', status)
          break
      }
    })
  }

}// end module.exports = (robot: Robot) => {}

// ----------------------------- UTILITIES ------------------------------ //

const codes = {
  ECONNREFUSED: (err) => `The connection to ${err.address}:${err.port} was refused`,
  ENOTFOUND: (err) => `The hostname ${err.host} could not be resolved`,
  404: (err) => `404: Not Found`,
  500: (err) => `500: Internal Server Error`,
}

function prettyPrint(error: any) {
  if (codes[error.code]) {
    return codes[error.code](error)
  }
  return error.toString()
}

function validateUrl(arg: string): url.Url {
  arg = arg.trim()
  if (arg === '') {
    return
  }

  let u = url.parse(arg)
  if (!u.hostname) {
    // maybe they didn't give a protocol?  Try with http:// prepended
    u = url.parse('http://' + arg)
    if (!u.hostname) {
      return
    }
  }

  if (u.hostname.toLowerCase() !== 'localhost') {
    // does it have an extension?
    const extMatcher = /\S+\.\S+/i
    if (!extMatcher.test(u.hostname)) {
      return
    }
  }

  return u
}

function validateCronSchedule(cronSchedule: string, minSeconds?: number): string {
  try {
    const time = new CronTime(cronSchedule) as any
    if (!minSeconds) {
      // valid cron time
      return undefined
    }

    const next2: moment.Moment[] = time.sendAt(2)
    const diff = next2[1].diff(next2[0])    // difference in milliseconds
    const minMs = (minSeconds * 1000)
    if (diff < minMs) {

      return `Sorry, this can't be scheduled more often than once in ${moment.duration(minMs).humanize()}.`
    }

    // valid schedule
    return undefined
  } catch (error) {
    return cronSchedule + ' is not a valid cron syntax string.  Take a look at https://en.wikipedia.org/wiki/Cron'
  }
}

function formatBrokenLinkList(brokenLinks: IBrokenLink[]): string[] {
  const byBaseUrl = new Map<string, IBrokenLink[]>()
  for (const link of brokenLinks) {
    const base = byBaseUrl.get(link.from) || []
    base.push(link)
    byBaseUrl.set(link.from, base)
  }

  let resp: string[]
  if (brokenLinks.length > (2 * byBaseUrl.size)) {
    resp = []
    // to summarize by base URL would result in a smaller output
    for (const base of byBaseUrl.keys()) {
      resp.push('on page ' + base + ':')
      for (const l of byBaseUrl.get(base)) {
        let emoji = ':x:'
        if (l.statusCode >= 500) {
          emoji = ':exclamation:'
        }
        resp.push(`  * ${emoji} ${l.url} ${blc[l.reason]}`)
      }
    }
  } else {
    resp = brokenLinks.map((l) => {
      let emoji: string
      if (!l.statusCode) {
        emoji = ':fire:'
      } else if (l.statusCode >= 500) {
        emoji = ':exclamation:'
      } else if (l.statusCode >= 400) {
        emoji = ':x:'
      } else if (l.statusCode >= 200) {
        emoji = ':white_check_mark:'
      }
      return `  * ${emoji} ${l.url} ${blc[l.reason]} on page ${l.from}`
    })
  }
  return resp
}
