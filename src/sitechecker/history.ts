import * as url from 'url'
import { Brain } from '../hubot'
import { IBrokenLink, ILinkCheckSummary } from './checklinks'

export interface IDiff {
  now: number
  lastCheck: number

  /** New links which didnt exist in the previous summary */
  newLinks: string[]
  /** Links which were not broken in the previous summary but are broken now */
  newlyBrokenLinks: IBrokenLinkWithHistory[]
  /** Links which were broken in the previous summary but are fixed now */
  newlyFixedLinks: IBrokenLinkWithHistory[]
}

export interface IBrokenLinkWithHistory extends IBrokenLink {
  /** The timestamp when this link was last working.  If we haven't seen it work, this is zero. */
  lastSuccess: number
}

/**
 * Stores a history of broken link checking operations against a website.
 */
export class History {

  private brain: Brain

  constructor(brain: Brain) {
    this.brain = brain
  }

  /**
   * Stores a summary result in the brain.
   */
  public store(summary: ILinkCheckSummary): IDiff {
    const key = makeKey(summary.url)
    const prev = this.brain.get<IHistoryTuple>(key)
    if (!prev) {
      // no diff to do.  Just set the history.
      const withHistory: ILinkCheckSummaryWithHistory = {
        timestamp: summary.timestamp,
        url: summary.url,
        linksChecked: new Map(summary.linksChecked),
        brokenLinks: summary.brokenLinks.map<IBrokenLinkWithHistory>((l) => Object.assign({ lastSuccess: 0}, l)),
      }

      this.brain.set<IHistoryTuple>(key, {
        summary: withHistory,
        diff: undefined,
      })
      return
    }

    // create diff with previous
    const processed = internalDiff(summary, prev)

    this.brain.set<IHistoryTuple>(
      key,
      processed,
    )
    return processed.diff
  }

  /**
   * Gets the last stored summary and the diff with the previous summary
   */
  public lastSummary(site: url.Url): { summary: ILinkCheckSummary, diff: IDiff } {
    const key = makeKey(site)

    const history = this.brain.get<IHistoryTuple>(key)
    if (!history) {
      return undefined
    }

    return {
      summary: history.summary,
      diff: history.diff,
    }
  }

  /**
   * Diffs the given summary with the previous summary for the same url.
   */
  public diff(summary: ILinkCheckSummary): IDiff {
    const key = makeKey(summary.url)
    const prev = this.brain.get<IHistoryTuple>(key)
    if (!prev) {
      // no diff to do
      return undefined
    }

    return internalDiff(summary, prev).diff
  }

}

/**
 * The tuple of historical data stored in the brain
 */
interface IHistoryTuple { summary: ILinkCheckSummaryWithHistory, diff: IDiff }

/**
 * Extends the link check summary to add history parameters to every broken link
 */
interface ILinkCheckSummaryWithHistory extends ILinkCheckSummary {
  brokenLinks: IBrokenLinkWithHistory[]
}

/**
 * Does a diff of the given summary with the previously stored history.
 */
function internalDiff(summary: ILinkCheckSummary, prev: IHistoryTuple): IHistoryTuple {

  const diff: IDiff = {
    now: summary.timestamp,
    lastCheck: prev.summary.timestamp,
    newLinks: [],
    newlyBrokenLinks: [],
    newlyFixedLinks: [],
  }
  const summaryWithHistory: ILinkCheckSummaryWithHistory = {
    timestamp: summary.timestamp,
    url: summary.url,
    linksChecked: new Map(summary.linksChecked),
    brokenLinks: [],
  }

  // find new links in this check that weren't present last time
  for (const link of summary.linksChecked.keys()) {
    if (!prev.summary.linksChecked.get(link)) {
      // it's new
      diff.newLinks.push(link)
    }
  }

  // find links that weren't broken before but are now broken
  for (const link of summary.brokenLinks) {
    const wasBroken = prev.summary.brokenLinks.find((bl) => bl.url === link.url)
    if (wasBroken) {
      // it was broken in the last summary.
      summaryWithHistory.brokenLinks.push(wasBroken)
    } else {
      // it is newly broken
      const withHistory = Object.assign({ lastSuccess: prev.summary.timestamp }, link)
      summaryWithHistory.brokenLinks.push(withHistory)
      diff.newlyBrokenLinks.push(withHistory)
    }
  }

  // find links that used to be broken but now are fixed
  for (const link of prev.summary.brokenLinks) {
    const isStillBroken = summary.brokenLinks.find((bl) => bl.url === link.url)
    if (!isStillBroken) {
      diff.newlyFixedLinks.push(link)
    }
  }

  return {
    summary: summaryWithHistory,
    diff,
  }
}

function makeKey(id: url.Url): string {
  return 'sitechecker.history.' + url.format(id)
}
