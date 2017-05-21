// tslint:disable:no-var-requires
import * as chai from 'chai'
import * as express from 'express'
import { Server } from 'http'
import * as path from 'path'
import * as sinon from 'sinon'
const expect = chai.expect

import { Robot } from './hubot'

  // hubot-test-helper uses a reference to module.parent.filename to find hubot script files.
  // this screws with tests that are in different different directories - whichever is required first sets the module.
  // So we delete and re-require it every time.
delete require.cache[require.resolve('hubot-test-helper')]
const Helper = require('hubot-test-helper')
const helper = new Helper([])

describe('rss-reader', () => {
  let room: any
  let app: express.Express
  let server: Server

  beforeEach(() => {
    room = helper.createRoom()

    app = express()
    server = app.listen(8081)
    app.get('/rss.xml', (req, res) => {
      res.sendFile(path.join(__dirname, 'examplerss.xml'))
    })
  })

  afterEach((done) => {
    room.destroy()
    server.close(done)
    if (this.clock) {
      this.clock.restore()
      delete(this.clock)
    }
  })

  it('should add an rss feed on command', async () => {
    room.robot.loadFile(path.resolve(path.join(__dirname, '../node_modules/hubot-rss-reader/scripts')), 'hubot-rss-reader.coffee')

    await room.user.say('alice', 'hubot rss add http://localhost:8081/rss.xml')
    await wait(10)

    // assert
    expect(room.messages).to.deep.equal([
      [ 'alice', 'hubot rss add http://localhost:8081/rss.xml' ],
      [ 'hubot', 'registered http://localhost:8081/rss.xml' ],
    ])
  })

  it('should load rss feeds from the brain', async () => {
    app.get('/rss2.xml', (req, res) => {
      res.send(`<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Root on Digital Strategies - Albania</title>
    <link>https://crualbaniadigital.gitlab.io/index.xml</link>
    <description>Recent content in Root on Digital Strategies - Albania</description>
    <generator>Hugo -- gohugo.io</generator>
    <language>en-us</language>
    <copyright>This web page is Copyright CRU, 2017</copyright>
    <lastBuildDate>Mon, 03 Apr 2017 18:49:06 +0200</lastBuildDate>
    <atom:link href="/rss2.xml" rel="self" type="application/rss+xml" />

    <item>
      <title>Why use Git?</title>
      <link>https://crualbaniadigital.gitlab.io/post/2017-04-22_why_use_git/</link>
      <pubDate>Sat, 22 Apr 2017 18:53:41 +0200</pubDate>

      <guid>https://crualbaniadigital.gitlab.io/post/2017-04-22_why_use_git/</guid>
      <description>

 &lt;h1 id=&#34;what-s-the-deal-with-git&#34;&gt;What&amp;rsquo;s the deal with Git?&lt;/h1&gt;

 &lt;p&gt;Have you ever had to collaborate with multiple people on a word document?  You know how ridiculous it can look when you turn on track changes:&lt;/p&gt;

 &lt;p&gt;&lt;img src=&#34;https://crualbaniadigital.gitlab.io/images/post/2017-04-22_why_use_git/word_track_changes.jpg&#34; alt=&#34;Sample word doc with track changes&#34; /&gt;&lt;/p&gt;

 &lt;p&gt;It gets even worse when multiple people have sent you their revisions over email attachments, and you have to somehow merge the document together.  We...</description>
    </item>

    <item>
      <title>Hosting a PHP application</title>
      <link>https://localhost:8081/post/2017-04-18_hosting_php_server_tutorial/</link>
      <pubDate>Tue, 18 Apr 2017 14:00:00 +0200</pubDate>

      <guid>https://localhost:8081/post/2017-04-18_hosting_php_server_tutorial/</guid>
      <description>

 &lt;h2 id=&#34;how-to-host-a-php-application-like-hapitjeter&#34;&gt;How to host a PHP application like Hapitjeter&lt;/h2&gt;

 &lt;p&gt;&lt;a href=&#34;https://localhost:8081/projects/hapitjeter/&#34;&gt;HapiTjeter&lt;/a&gt; is a standard PHP application that runs on the internet.  In this tutorial I&amp;rsquo;ll show you how to use a public hosting service to install your own version of HapiTjeter, or any other PHP application.  We&amp;rsquo;ll go through the steps all the way from downloading the code, through configuring your MySQL database, and finally setting up ...</description>
    </item>
  </channel>
</rss>`)
    })
    room.robot.brain.set('feeds', { room1: [ 'http://localhost:8081/rss2.xml' ] })
    room.robot.brain.set('hubot-rss-reader:entry:https://localhost:8081/post/2017-04-18_hosting_php_server_tutorial/', true)

    // now load the script
    this.clock = sinon.useFakeTimers()
    room.robot.loadFile(path.resolve(path.join(__dirname, '../node_modules/hubot-rss-reader/scripts')), 'hubot-rss-reader.coffee')
    room.robot.brain.emit('loaded') // load the stored rss entries from the brain
    await wait(10)                  // yield control so various events can be processed

    // act
    this.clock.tick(1 * 1000)       // tick so the reader checks the feed again
    await wait(100)                 // yield control for various events

    this.clock.tick(2 * 1000)       // tick at least 1 more second so the send_queue can be processed
    await wait(10)

    // assert
    expect(room.messages[0][1]).to.contain(':sushi: Why use Git?')
  })
})

// since we might override setTimeout with sinon timers, capture it here and use it instead
const origSetTimeout = setTimeout
function wait(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    origSetTimeout(() => {
      resolve()
    }, milliseconds)
  })
}
