import * as crypto from 'crypto'
import { Router } from 'express'
import * as request from 'request'

import { Brain, Response, Robot } from '../hubot'

export class UserToken {
  /** User ID in hubot brain */
  public id: string

  /** User ID in gitlab */
  public gitlabId: string

  // tslint:disable:variable-name   // disabled because these names are direct from the json response
  /** The access token used in Authorization: Bearer ${access_token} */
  public access_token: string
  /** The type of the token - usually 'bearer' */
  public token_type: string
  /** The timestamp when the token was created */
  public created_at: number
  /**
   * The token used to refresh this token by posting it to "https://gitlab.com/oauth/token"
   * with POST params { grant_type: "refresh_token", refresh_token: token }
   */
  public refresh_token: string
  // tslint:enable:variable-name

  constructor(token?: {
    id: string,
    gitlabId?: string,
    access_token?: string,
    token_type?: string,
    created_at?: number,
    refresh_token?: string,
    scope?: string,
  }) {
    Object.assign(this, token)
  }

  public isExpired(): boolean {
    // TODO: figure out the expiry of gitlab tokens
    return false
  }
}

export class OAuthListenerOptions {
  public gitlabUrl: string
  public callbackUrl: string
  public appId: string
  public appSecret: string
}

async function makeRandomHash(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        reject(err)
        return
      }

      resolve(buf.toString('hex'))
    })
  })
}

// https://docs.gitlab.com/ce/api/oauth2.html#use-the-access-token-to-access-the-api
export class OAuthListener {

  private options: OAuthListenerOptions
  private robot: Robot

  private hashes = new Map<string, { hash: string, expires: number }>()

  constructor(options: OAuthListenerOptions, robot: Robot, store?: Brain) {
    this.options = options
    this.robot = robot

    this.signin = this.signin.bind(this)
    this.signout = this.signout.bind(this)
    this.router = this.router.bind(this)
  }

  /**
   * Should be exposed at the 'callbackUrl' to receive OAuth callbacks
   */
  public router(): Router {
    const self = this
    const store = this.robot.brain

    const r = Router()

    r.get('/', (req, res) => {
      const {code, state} = req.query

      if (!code || !state) {
        res.send('<html><h2>Bad Request!</h2>should have "code" and "state" in the query string</html>')
        return
      }

      const stateParts = (state as string).split(':')
      if (stateParts.length < 2) {
        res.send('<html><h2>Bad request!</h2>"state" should contain a colon, but was ' + state + '</html>')
        return
      }
      const userId = stateParts[0]; const hash = stateParts[1]

      const expectedHash = self.hashes.get(userId)
      if (!expectedHash || expectedHash.hash !== hash) {
        let body = `your state code doesnt exist.  Ask ${self.robot.name} to sign in again`
        if (expectedHash) {
           body = 'expected: ' + expectedHash + ' but was ' + hash
        }

        res.send('<html><h2>Invalid code!</h2>' + body + '</html>')
        return
      }
      if (expectedHash.expires < Date.now()) {
        res.send('<html><h2>State hash expired!  Please try again</h2>')
        return
      }
      self.robot.logger.log(`[gitlab] <sign in> getting token for bot user ${userId} with code ${code}`)

      self.hashes.delete(userId)
      // OK, they gave us a code.  We can get the token now.
      // parameters = `client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${RETURNED_CODE}&
      //    grant_type=authorization_code&redirect_uri=${REDIRECT_URI}`
      // RestClient.post 'http://gitlab.example.com/oauth/token', parameters
      request.post({ url: this.options.gitlabUrl + '/oauth/token', form: {
          client_id: this.options.appId,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.options.callbackUrl,
          client_secret: this.options.appSecret,
        } }, (error, resp, body) => {
          if (typeof (body) === 'string') {
            body = JSON.parse(body)
          }

          if (error || body.error || !body.access_token) {
            res.send('<html><h2>Error getting authorization code!</h2>' +
                (error || body.error_description || 'no access token received') +
              '</html>')
            return
          }

          /* # The response will be
            { access_token: '69273e67b82....',
              token_type: 'bearer',
              refresh_token: '29da889082....',
              scope: 'api',
              created_at: 1494512976
            }
           */
          const token = new UserToken({
            id: userId,
            access_token: body.access_token,
            created_at: body.created_at,
            refresh_token: body.refresh_token,
            token_type: body.token_type,
            scope: body.scope,
          })

          store.set('gitlab.' + token.id, token)
          res.send(
`<html>
  <h2>Great!  Got your token.</h2>
  You can revoke ${self.robot.name}'s access at any time at this link:
  <a href="${self.options.gitlabUrl}/profile/applications">${self.options.gitlabUrl}/profile/applications</a>
</html>`)
        })
    })

    return r
  }

  /**
   * Handles sign-in requests by sending with private message a link to register an oauth token
   */
  public async signin(res: Response) {
    const self = this
    const store = this.robot.brain

    const { user } = res.envelope
    if (!user) {
      self.robot.logger.error('[gitlab] <sign in> no user!')
      return
    }

    let token = store.get('gitlab.' + user.id)

    if (token) {
      token = new UserToken(token)
      if (!token.access_token) {
        store.remove('gitlab.' + user.id)
        // fall through to sign-in code
      } else if (token.isExpired()) {
        // TODO - this is untested
        try {
          const newToken = await self.refresh(token)
          store.set('gitlab.' + user.id, newToken)
          res.reply('You are already signed in!')
          return
        } catch (err) {
          self.robot.logger.error('[gitlab] <sign in>' + err)
          store.remove('gitlab.' + user.id)
          // fall through to sign-in code
        }
      } else {
        res.reply('You are already signed in!')
        return
      }
    }

      // make a random token to pass to the user which expires in 10 minutes.
      //  They have 10 min to complete the OAuth setup.
    const stateHash = await makeRandomHash()
    self.hashes.set(user.id, { hash: stateHash, expires: Date.now() + (10 * 60 * 1000) })

    // https://gitlab.example.com/oauth/authorize?client_id=APP_ID&redirect_uri=REDIRECT_URI
          // &response_type=code&state=your_unique_state_hash
    res.reply(`click here to authorize me to access your gitlab account:  \n` +
      `${this.options.gitlabUrl}/oauth/authorize?` +
      `client_id=${this.options.appId}&redirect_uri=${encodeURIComponent(this.options.callbackUrl)}&` +
      `response_type=code&state=${encodeURIComponent(user.id + ':' + stateHash)}`)
  }

  public signout(res: Response) {
    const store = this.robot.brain
    const { user } = res.envelope
    if (!user) {
      this.robot.logger.error('[gitlab] <sign out> no user!')
      return
    }

    const token = store.get('gitlab.' + user.id)
    if (!token) {
      res.reply("you're already signed out!")
      return
    }

    store.remove('gitlab.' + user.id)
    res.reply(`I just forgot your access key :)  \nYou may want to also revoke my access at ${this.options.gitlabUrl}/profile/applications`)

  }

  private async refresh(token: UserToken): Promise<UserToken> {
    return new Promise<UserToken>((resolve, reject) => {
      request.post(
        this.options.gitlabUrl + '/oauth/token',
        {
          body: {
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token,
          },
        },
        (err, resp, body) => {
          if (err) {
            reject(err)
            return
          }

          // tslint:disable-next-line:no-console
          console.log('[gitlab] <sign in> refresh token response: ', body)

          token = new UserToken({
            id: token.id,
            access_token: body.access_token,
            created_at: body.created_at,
            refresh_token: body.refresh_token,
            token_type: body.token_type,
            scope: body.scope,
          })

          resolve(token)
        },
      )
    })
  }
}
