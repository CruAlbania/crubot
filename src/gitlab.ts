// Description:
//   Have hubot do things on your gitlab server.
//
// Dependencies:
//   "<module name>": "<module version>"
//
// Configuration:
//   HUBOT_URL=https://hubot.mydomain.com - The URL on which the bot's http interface is exposed
//   HUBOT_GITLAB_URL=https://gitlab.com  - The URL of the gitlab instance to connect to.  Defaults to https://gitlab.com
//   HUBOT_GITLAB_APP_ID=************     - The Application ID generated at ${HUBOT_GITLAB_URL}/profile/applications
//   HUBOT_GITLAB_APP_SECRET=********     - The Application secret generated at ${HUBOT_GITLAB_URL}/profile/applications
//
// Commands:
//   hubot gitlab sign in - Sends the a private link which grants the bot API access to your gitlab account.
//   hubot gitlab sign out - Forgets the gitlab access token. You should then go revoke it in the gitlab web console.
//
// Notes:
//
//
// Author:
//   gburgett

import {OAuthListener} from './gitlab/oauth'
import { WebhooksListener } from './gitlab/webhooks'
import { Robot } from './hubot'

const HUBOT_URL = process.env.HUBOT_URL
const GITLAB_APP_ID = process.env.HUBOT_GITLAB_APP_ID
const GITLAB_APP_SECRET = process.env.HUBOT_GITLAB_APP_SECRET
const GITLAB_URL = process.env.HUBOT_GITLAB_URL

module.exports = (robot: Robot) => {

  const options = {
    gitlabUrl: GITLAB_URL || 'https://gitlab.com',
    callbackUrl: HUBOT_URL + '/gitlab/oauth',
    appId: GITLAB_APP_ID,
    appSecret: GITLAB_APP_SECRET,
  }
  const oauth = new OAuthListener(options, robot)
  robot.router.use('/gitlab/oauth', oauth.router())

  robot.logger.info('[gitlab] enabled with options ' + JSON.stringify(options))

  robot.respond(/gitlab sign in/i, { id: 'gitlab.sign_in' }, oauth.signin)
  robot.respond(/gitlab sign out/i, { id: 'gitlab.sign_out' }, oauth.signout)

  const webhooks = new WebhooksListener({}, robot)
  robot.router.use('/gitlab/webhook', webhooks.router())
}
