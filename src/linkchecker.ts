// Description:
//   Checks a website for broken links
//
// Dependencies:
//   "broken-link-checker": "^0.7.4"
//
// Configuration:
//   HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS: a space-separated set of globs to ignore.  Default: "tracking" (see https://github.com/stevenvachon/broken-link-checker#optionsexcludedkeywords)
//   HUBOT_LINK_CHECKER_TIMEOUT_SECONDS: The number of seconds before a site scan ends in timeout.  Default: 600.
//
// Commands:
//   hubot link check <url> - Crawl the given URL recursively for broken links
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

module.exports = (robot: Robot) => {

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

  robot.respond(/link check\s+(.+)$/i, (res) => {
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

    const argPretty = url.format(arg)
    res.send(`BRB, checking ${argPretty} for broken links...`)

    const summary = {
        linksChecked: new Map<string, boolean>(),
        brokenLinks: [] as Array<{ url: string, reason: string, statusCode: number, statusMessage: string }>,
      }

    const options = {
      excludedKeywords: ['tracking'],
    }
    if (process.env.HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS) {
      options.excludedKeywords = process.env.HUBOT_LINK_CHECKER_EXCLUDED_KEYWORDS.split(' ')
    }

    const sitechecker = new blc.SiteChecker(options, {
        // Called whenever a new link is discovered
      link: (result, customData) => {
        robot.logger.debug('link: ', result.url.resolved)
        if (result.broken) {
          // console.log(result)
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
          robot.emit('link-check.error', arg)
          res.send(`Got an error when checking ${argPretty}:  \n\n` +
            '> ' + prettyPrint(error))
          return
        }

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
      },
    })

    // set up a listener for unhandled promise rejections - the library doesn't handle error conditions well
    const listener = unhandledRejectionListener(robot, res, arg)
    process.once('unhandledRejection', listener)

    // enqueue the link check
    robot.emit('link-check.begin', arg)
    try {
      const idOrError = sitechecker.enqueue(argPretty)
      if (idOrError instanceof Error) {
        robot.emit('link-check.error', idOrError, arg)
        robot.emit('link-check.end', arg)
      }
    } catch (e) {
      robot.emit('link-check.error', e, arg)
      robot.emit('link-check.end', arg)
    }

    // set a timeout of default 10 minutes
    let timeoutSeconds = 600
    if (process.env.HUBOT_LINK_CHECKER_TIMEOUT_SECONDS) {
      timeoutSeconds = parseInt(process.env.HUBOT_LINK_CHECKER_TIMEOUT_SECONDS, 10)
    }
    const timeout = setTimeout(
      () => {
        sitechecker.pause()
        robot.emit('link-check.timeout', arg, sitechecker)

        let resp = `Timed out checking ${argPretty} after ${timeoutSeconds} seconds: ${summary.brokenLinks.length} broken links (${summary.linksChecked.size} total links)`
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
        robot.emit('link-check.end', arg, summary)
      },
      timeoutSeconds * 1000,
    )

    // listen for the end event
    sitechecker.handlers.end = () => {
      process.removeListener('unhandledRejection', listener)
      clearTimeout(timeout)
      robot.emit('link-check.end', arg, summary)
    }

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

function unhandledRejectionListener(robot: Robot, res: Response, arg: url.Url): (e: any) => void {
  return (error) => {
    res.send(`Got an error when checking ${url.format(arg)}:  \n\n` +
          '> ' + prettyPrint(error))

    robot.logger.error('unhandledRejection', error)
    robot.emit('link-check.error', error, arg)
    robot.emit('link-check.end', arg)
  }
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
