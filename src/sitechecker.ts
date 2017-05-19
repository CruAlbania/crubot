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
//
// Commands:
//   hubot check links <url> - Crawl the given URL recursively for broken links
//
// Notes:
//
//
// Author:
//   gburgett

import * as blc from 'broken-link-checker'
import * as Fs from 'fs'
import * as Path from 'path'
import * as url from 'url'

import { Response, Robot } from './hubot'
import { CheckLinks, StatusCode } from './sitechecker/checklinks'
import { History } from './sitechecker/history'

module.exports = (robot: Robot) => {

  const LINK_CHECKER_COOLDOWN_SECONDS = process.env.HUBOT_LINK_CHECKER_COOLDOWN_SECONDS || (60 * 60)   // 1 hour default

  const history = new History(robot.brain)
  const current = new Map<string, number>()

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

  robot.respond(/check links\s+(.+)\s+every\s+(.+)$/i, (res) => {
    res.send('Sorry, I cant do this yet')
  })

  robot.respond(/check links\s+(.+)$/i, (res) => {
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
    CheckLinks(robot, arg, (error, status, summary) => {
      current.delete(argPretty)   // finished
      switch (status) {
        case StatusCode.error:
        {
          res.send(`Got an error when checking ${argPretty}:  \n\n` +
          '> ' + prettyPrint(error))
          break
        }

        case StatusCode.timeout:
        {
          history.store(summary)
          let resp = `Timed out checking ${argPretty}: ${summary.brokenLinks.length} broken links (${summary.linksChecked.size} total links)`
          if (summary.brokenLinks.length > 0) {
            resp += '  \n' + summary.brokenLinks.map((l) => {
              let emoji = ':x:'
              if (l.statusCode >= 500) {
                emoji = ':exclamation:'
              }
              return `${emoji} ${l.url} ${blc[l.reason]}`
            })
            .join('  \n')
          }
          res.send(resp)
          break
        }

        case StatusCode.success:
        {
          history.store(summary)
          let resp = `Finished checking ${argPretty}: ${summary.brokenLinks.length} broken links (${summary.linksChecked.size} total links)`
          if (summary.brokenLinks.length > 0) {
            resp += '  \n' + summary.brokenLinks.map((l) => {
              let emoji = ':x:'
              if (l.statusCode >= 500) {
                emoji = ':exclamation:'
              }
              return `${emoji} ${l.url} ${blc[l.reason]}`
            })
            .join('  \n')
          }
          res.send(resp)
          break
        }

        default:
          robot.logger.error('[sitechecker] Unknown status code:', status)
          break
      }
    })
  })

  robot.respond(/check\s+(.+)\s+every\s+(.+)$/i, (res) => {
    res.send('Sorry, I cant do this yet')
  })

  robot.respond(/check\s+(.+)\s+on\s+schedule\s+(.+)$/i, (res) => {
    res.send('Sorry, I cant do this yet')
  })
}

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
