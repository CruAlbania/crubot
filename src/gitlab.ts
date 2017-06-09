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
//   HUBOT_GITLAB_WEBHOOK_TOKEN=******    - Used to verify that a posted webhook is actually coming from Gitlab.  You should put the same value in the "secret token" field in Gitlab integrations.
//   HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE=true - If set, Hubot will generate a random secret token for each room and post it to the room when responding to "hubot gitlab make webhook".  This secret token can only be used to post webhooks for this room.
//
// Commands:
//   hubot gitlab sign in - Sends the a private link which grants the bot API access to your gitlab account.
//   hubot gitlab sign out - Forgets the gitlab access token. You should then go revoke it in the gitlab web console.
//   hubot gitlab make webhook - Generates a webhook URL for this room, and instructions for setting up the webhook on gitlab.
//
// Notes:
//
//
// Author:
//   gburgett

import {OAuthListener} from './gitlab/oauth'
import { WebhooksListener } from './gitlab/webhooks'
import { Robot } from './hubot'

module.exports = (robot: Robot) => {

  let HUBOT_URL: string              = process.env.HUBOT_URL
  const GITLAB_APP_ID: string        = process.env.HUBOT_GITLAB_APP_ID
  const GITLAB_APP_SECRET: string    = process.env.HUBOT_GITLAB_APP_SECRET
  let GITLAB_URL: string             = process.env.HUBOT_GITLAB_URL
  const GITLAB_WEBHOOK_TOKEN: string = process.env.HUBOT_GITLAB_WEBHOOK_TOKEN
  const GITLAB_WEBHOOK_TOKEN_GENERATE: string = process.env.HUBOT_GITLAB_WEBHOOK_TOKEN_GENERATE

  if (HUBOT_URL) { HUBOT_URL = HUBOT_URL.replace(/\/+$/g, '') }
  if (GITLAB_URL) { GITLAB_URL = GITLAB_URL.replace(/\/+$/g, '') }

  const options = {
    gitlabUrl: GITLAB_URL || 'https://gitlab.com',
    callbackUrl: HUBOT_URL + '/gitlab/oauth',
    appId: GITLAB_APP_ID,
    appSecret: GITLAB_APP_SECRET,
  }
  const oauth = new OAuthListener(options, robot)
  robot.router.use('/gitlab/oauth', oauth.router())

  robot.logger.debug('[gitlab] enabled with options ' + JSON.stringify(options))

  robot.respond(/gitlab\s+sign\s+in/i, { id: 'gitlab.sign_in' }, oauth.signin)
  robot.respond(/gitlab\s+sign\s+out/i, { id: 'gitlab.sign_out' }, oauth.signout)

  const webhooks = new WebhooksListener({
    webhookBase: HUBOT_URL + '/gitlab/webhook',
    gitlabUrl: GITLAB_URL || 'https://gitlab.com',
    gitlabToken: GITLAB_WEBHOOK_TOKEN,
    gitlabTokenGenerate: GITLAB_WEBHOOK_TOKEN_GENERATE ? true : false,
  }, robot)
  robot.router.use('/gitlab/webhook', webhooks.router())

  robot.respond(/gitlab\s+(?:make|generate)(?:\s+(pipeline))?\s+webhook\s*(?:for(?:\s+project)?\s+([\w\.\/\-]+))?$/i, { id: 'gitlab.webhook.make'}, webhooks.webhook_make)
}
