"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const express_1 = require("express");
const request = require("request");
class UserToken {
    // tslint:enable:variable-name
    constructor(token) {
        Object.assign(this, token);
    }
    isExpired() {
        // TODO: figure out the expiry of gitlab tokens
        return false;
    }
}
exports.UserToken = UserToken;
class OAuthListenerOptions {
}
exports.OAuthListenerOptions = OAuthListenerOptions;
function makeRandomHash() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(buf.toString('hex'));
            });
        });
    });
}
// https://docs.gitlab.com/ce/api/oauth2.html#use-the-access-token-to-access-the-api
class OAuthListener {
    constructor(options, robot, store) {
        this.hashes = new Map();
        this.options = options;
        this.robot = robot;
        this.signin = this.signin.bind(this);
        this.signout = this.signout.bind(this);
        this.router = this.router.bind(this);
    }
    /**
     * Should be exposed at the 'callbackUrl' to receive OAuth callbacks
     */
    router() {
        const self = this;
        const store = this.robot.brain;
        const r = express_1.Router();
        r.get('/', (req, res) => {
            const { code, state } = req.query;
            if (!code || !state) {
                res.send('<html><h2>Missing code or state in query string!</h2></html>');
                return;
            }
            const stateParts = state.split(':');
            if (stateParts.length < 2) {
                res.send('<html><h2>Expected state to contain a colon!</h2>the state was ' + state + '</html>');
                return;
            }
            const userId = stateParts[0];
            const hash = stateParts[1];
            const expectedHash = this.hashes.get(userId);
            if (expectedHash.hash !== hash) {
                res.send('<html><h2>Expected state hash to match what we have stored!</h2>' +
                    'expected: ' + expectedHash + ' but was ' + hash + '</html>');
                return;
            }
            if (expectedHash.expires < Date.now()) {
                res.send('<html><h2>State hash expired!  Please try again</h2>');
                return;
            }
            self.robot.logger.log(`[gitlab] <sign in> getting token for bot user ${userId} with code ${code}`);
            // OK, they gave us a code.  We can get the token now.
            // parameters = 'client_id=APP_ID&client_secret=APP_SECRET&code=RETURNED_CODE&
            //    grant_type=authorization_code&redirect_uri=REDIRECT_URI'
            // RestClient.post 'http://gitlab.example.com/oauth/token', parameters
            request.post({ url: this.options.gitlabUrl + '/oauth/token', form: {
                    client_id: this.options.appId,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: this.options.callbackUrl,
                    client_secret: this.options.appSecret,
                } }, (error, resp, body) => {
                if (typeof (body) === 'string') {
                    body = JSON.parse(body);
                }
                if (error || body.error || !body.access_token) {
                    res.send('<html><h2>Error getting authorization code!</h2>' +
                        (error || body.error_description || 'no access token received') +
                        '</html>');
                    return;
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
                });
                store.set('gitlab.' + token.id, token);
                res.send(`<html>
  <h2>Great!  Got your token.</h2>
  You can revoke ${self.robot.name}'s access at any time at this link:
  <a href="${self.options.gitlabUrl}/profile/applications">${self.options.gitlabUrl}/profile/applications</a>
</html>`);
            });
        });
        return r;
    }
    /**
     * Handles sign-in requests by sending with private message a link to register an oauth token
     */
    signin(res) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const store = this.robot.brain;
            const { user } = res.envelope;
            if (!user) {
                self.robot.logger.error('[gitlab] <sign in> no user!');
                return;
            }
            let token = store.get('gitlab.' + user.id);
            if (token) {
                token = new UserToken(token);
                if (!token.access_token) {
                    store.remove('gitlab.' + user.id);
                    // fall through to sign-in code
                }
                else if (token.isExpired()) {
                    // TODO - this is untested
                    try {
                        const newToken = yield self.refresh(token);
                        store.set('gitlab.' + user.id, newToken);
                        res.reply('You are already signed in!');
                        self.robot.messageRoom(res.envelope.user.id, 'Here is your access key: ' + newToken.access_token);
                        return;
                    }
                    catch (err) {
                        self.robot.logger.error('[gitlab] <sign in>' + err);
                        store.remove('gitlab.' + user.id);
                        // fall through to sign-in code
                    }
                }
                else {
                    res.reply('You are already signed in!');
                    self.robot.messageRoom(res.envelope.user.id, 'Here is your access key: ' + token.access_token);
                    return;
                }
            }
            // make a random token to pass to the user which expires in 10 minutes.
            //  They have 10 min to complete the OAuth setup.
            const stateHash = yield makeRandomHash();
            self.hashes.set(user.id, { hash: stateHash, expires: Date.now() + (10 * 60 * 1000) });
            // https://gitlab.example.com/oauth/authorize?client_id=APP_ID&redirect_uri=REDIRECT_URI
            // &response_type=code&state=your_unique_state_hash
            self.robot.messageRoom(res.envelope.user.id, `${this.options.gitlabUrl}/oauth/authorize?` +
                `client_id=${this.options.appId}&redirect_uri=${encodeURIComponent(this.options.callbackUrl)}&` +
                `response_type=code&state=${encodeURIComponent(user.id + ':' + stateHash)}`);
            res.reply('Sent you a link in private to sign-in!');
        });
    }
    signout(res) {
        const store = this.robot.brain;
        const { user } = res.envelope;
        if (!user) {
            this.robot.logger.error('[gitlab] <sign out> no user!');
            return;
        }
        const token = store.get('gitlab.' + user.id);
        if (!token) {
            res.reply("you're already signed out!");
            return;
        }
        store.remove('gitlab.' + user.id);
        res.reply(`I just forgot your access key :)  \nYou may want to also revoke my access at ${this.options.gitlabUrl}/profile/applications`);
    }
    refresh(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                request.post(this.options.gitlabUrl + '/oauth/token', {
                    body: {
                        grant_type: 'refresh_token',
                        refresh_token: token.refresh_token,
                    },
                }, (err, resp, body) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('[gitlab] <sign in> refresh token response: ', body);
                    token = new UserToken({
                        id: token.id,
                        access_token: body.access_token,
                        created_at: body.created_at,
                        refresh_token: body.refresh_token,
                        token_type: body.token_type,
                        scope: body.scope,
                    });
                    resolve(token);
                });
            });
        });
    }
}
exports.OAuthListener = OAuthListener;
