/* tslint:disable:no-unused-expression max-line-length */

import { expect } from 'chai'
import * as express from 'express'
import * as http from 'http'
import * as sinon from 'sinon'

import {GitlabApiV4} from './index'
import {Commit, Contributor, Group, Issue, Project} from './responses'

const API_TOKEN = 'test_xxxxxx'

describe('GitlabApiV4', () => {

  let app: express.Express
  let server: http.Server

  beforeEach(() => {
    app = express()
    server = app.listen(8081)
  })

  afterEach(() => {
    server.close()
  })

  describe('getProject', () => {
    it('should get a real project', async () => {
      const projectJson = JSON.parse(`
{
  "id": 2660469,
  "description": "4 ligjet shpirtërorë si një faqe web.\\r\\nHapet nga index.html\\r\\n\\r\\nKrijoi një student ECE",
  "default_branch": "master",
  "tag_list": [],
  "archived": false,
  "visibility": "public",
  "ssh_url_to_repo": "git@gitlab.com:cru-albania-ds/broshura-4-ligjet.git",
  "http_url_to_repo": "https://gitlab.com/cru-albania-ds/broshura-4-ligjet.git",
  "web_url": "https://gitlab.com/cru-albania-ds/broshura-4-ligjet",
  "name": "broshura-4-ligjet",
  "name_with_namespace": "cru-albania-ds / broshura-4-ligjet",
  "path": "broshura-4-ligjet",
  "path_with_namespace": "cru-albania-ds/broshura-4-ligjet",
  "container_registry_enabled": true,
  "issues_enabled": true,
  "merge_requests_enabled": true,
  "wiki_enabled": true,
  "jobs_enabled": true,
  "snippets_enabled": false,
  "created_at": "2017-02-08T12:11:19.039Z",
  "last_activity_at": "2017-02-10T14:33:10.487Z",
  "shared_runners_enabled": true,
  "lfs_enabled": true,
  "creator_id": 428102,
  "namespace": {
    "id": 1303689,
    "name": "cru-albania-ds",
    "path": "cru-albania-ds",
    "kind": "group",
    "full_path": "cru-albania-ds"
  },
  "avatar_url": null,
  "star_count": 1,
  "forks_count": 0,
  "open_issues_count": 1,
  "public_jobs": true,
  "shared_with_groups": [],
  "only_allow_merge_if_pipeline_succeeds": false,
  "request_access_enabled": false,
  "only_allow_merge_if_all_discussions_are_resolved": false,
  "approvals_before_merge": 0,
  "permissions": {
    "project_access": null,
    "group_access": null
  }
}`)
      app.get('/testapi/projects/2660469', (req, res) => {
              res.setHeader('Content-Type', 'application/json')
              res.send(JSON.stringify(projectJson))
            })

      const instance = new GitlabApiV4(API_TOKEN, 'http://localhost:8081/testapi/')

          // act
      const proj = await instance.getProject(2660469)    // source code for cru-albania-ds.gitlab.io

          // assert
      expect(proj).to.not.be.null

      expect(proj.id).to.equal(2660469, 'id')
      expect(proj.path).to.equal('broshura-4-ligjet', 'path')
      expect(proj.ssh_url_to_repo).to.equal(
              'git@gitlab.com:cru-albania-ds/broshura-4-ligjet.git',
              'ssh_url_to_repo')
      expect(proj.namespace).to.not.be.null
      expect(proj.namespace.id).to.equal(1303689, 'namespace.id')
      expect(proj.namespace.name).to.equal('cru-albania-ds', 'namespace.name')
      expect(proj.namespace.kind).to.equal('group', 'namespace.kind')
      expect(proj.created_at.toUTCString()).to.equal(
              new Date('2017-02-08T12:11:19.039Z').toUTCString(), 'created_at')
      })
  })

  describe('getGroup', () => {
    it('should get a real group', async () => {
      const groupJson = JSON.parse(`
{
  "id": 1303689,
  "name": "cru-albania-ds",
  "path": "cru-albania-ds",
  "description": "Software repositories for Cru Albania's Digital Strategies team",
  "visibility": "public",
  "ldap_cn": null,
  "ldap_access": null,
  "lfs_enabled": true,
  "avatar_url": null,
  "web_url": "https://gitlab.com/groups/cru-albania-ds",
  "request_access_enabled": false,
  "full_name": "cru-albania-ds",
  "full_path": "cru-albania-ds",
  "parent_id": null,
  "projects": [
    {
      "id": 2734361,
      "description": "Source code for Cru Albania DS gitlab pages - https://cru-albania-ds.gitlab.io\\r\\nGenerated with Hugo",
      "default_branch": "master",
      "tag_list": [],
      "archived": false,
      "visibility": "public",
      "ssh_url_to_repo": "git@gitlab.com:cru-albania-ds/cru-albania-ds.gitlab.io.git",
      "http_url_to_repo": "https://gitlab.com/cru-albania-ds/cru-albania-ds.gitlab.io.git",
      "web_url": "https://gitlab.com/cru-albania-ds/cru-albania-ds.gitlab.io",
      "name": "cru-albania-ds.gitlab.io",
      "name_with_namespace": "cru-albania-ds / cru-albania-ds.gitlab.io",
      "path": "cru-albania-ds.gitlab.io",
      "path_with_namespace": "cru-albania-ds/cru-albania-ds.gitlab.io",
      "container_registry_enabled": true,
      "issues_enabled": true,
      "merge_requests_enabled": true,
      "wiki_enabled": true,
      "jobs_enabled": true,
      "snippets_enabled": false,
      "created_at": "2017-02-19T16:46:36.924Z",
      "last_activity_at": "2017-04-12T14:04:15.685Z",
      "shared_runners_enabled": true,
      "lfs_enabled": true,
      "creator_id": 428102,
      "namespace": {
        "id": 1303689,
        "name": "cru-albania-ds",
        "path": "cru-albania-ds",
        "kind": "group",
        "full_path": "cru-albania-ds"
      },
      "avatar_url": null,
      "star_count": 0,
      "forks_count": 0,
      "open_issues_count": 0,
      "public_jobs": true,
      "shared_with_groups": [],
      "only_allow_merge_if_pipeline_succeeds": false,
      "request_access_enabled": false,
      "only_allow_merge_if_all_discussions_are_resolved": false,
      "approvals_before_merge": 0
    },
    {
      "id": 2711660,
      "description": "Source code for [hapitjeter.net](http://hapitjeter.net)",
      "default_branch": "master",
      "tag_list": [],
      "archived": false,
      "visibility": "public",
      "ssh_url_to_repo": "git@gitlab.com:cru-albania-ds/hapitjeter.git",
      "http_url_to_repo": "https://gitlab.com/cru-albania-ds/hapitjeter.git",
      "web_url": "https://gitlab.com/cru-albania-ds/hapitjeter",
      "name": "hapitjeter",
      "name_with_namespace": "cru-albania-ds / hapitjeter",
      "path": "hapitjeter",
      "path_with_namespace": "cru-albania-ds/hapitjeter",
      "container_registry_enabled": true,
      "issues_enabled": true,
      "merge_requests_enabled": true,
      "wiki_enabled": true,
      "jobs_enabled": true,
      "snippets_enabled": false,
      "created_at": "2017-02-15T18:30:35.271Z",
      "last_activity_at": "2017-03-30T20:00:20.495Z",
      "shared_runners_enabled": true,
      "lfs_enabled": true,
      "creator_id": 428102,
      "namespace": {
        "id": 1303689,
        "name": "cru-albania-ds",
        "path": "cru-albania-ds",
        "kind": "group",
        "full_path": "cru-albania-ds"
      },
      "avatar_url": null,
      "star_count": 0,
      "forks_count": 0,
      "open_issues_count": 5,
      "public_jobs": true,
      "shared_with_groups": [],
      "only_allow_merge_if_pipeline_succeeds": false,
      "request_access_enabled": false,
      "only_allow_merge_if_all_discussions_are_resolved": false,
      "approvals_before_merge": 0
    },
    {
      "id": 2702535,
      "description": "A plugin for [Mautic](https://www.mautic.org/) that provides integration with CRU's [MissionHub](https://www.missionhub.com/).\\r\\n",
      "default_branch": "master",
      "tag_list": [],
      "archived": false,
      "visibility": "public",
      "ssh_url_to_repo": "git@gitlab.com:cru-albania-ds/missionhub_mautic_plugin.git",
      "http_url_to_repo": "https://gitlab.com/cru-albania-ds/missionhub_mautic_plugin.git",
      "web_url": "https://gitlab.com/cru-albania-ds/missionhub_mautic_plugin",
      "name": "missionhub_mautic_plugin",
      "name_with_namespace": "cru-albania-ds / missionhub_mautic_plugin",
      "path": "missionhub_mautic_plugin",
      "path_with_namespace": "cru-albania-ds/missionhub_mautic_plugin",
      "container_registry_enabled": true,
      "issues_enabled": true,
      "merge_requests_enabled": true,
      "wiki_enabled": true,
      "jobs_enabled": true,
      "snippets_enabled": false,
      "created_at": "2017-02-14T15:11:13.361Z",
      "last_activity_at": "2017-02-14T15:11:13.361Z",
      "shared_runners_enabled": true,
      "lfs_enabled": true,
      "creator_id": 428102,
      "namespace": {
        "id": 1303689,
        "name": "cru-albania-ds",
        "path": "cru-albania-ds",
        "kind": "group",
        "full_path": "cru-albania-ds"
      },
      "avatar_url": null,
      "star_count": 0,
      "forks_count": 0,
      "open_issues_count": 0,
      "public_jobs": true,
      "shared_with_groups": [],
      "only_allow_merge_if_pipeline_succeeds": false,
      "request_access_enabled": false,
      "only_allow_merge_if_all_discussions_are_resolved": false,
      "approvals_before_merge": 0
    },
    {
      "id": 2660469,
      "description": "4 ligjet shpirtërorë si një faqe web.\\r\\nHapet nga index.html\\r\\n\\r\\nKrijoi një student ECE",
      "default_branch": "master",
      "tag_list": [],
      "archived": false,
      "visibility": "public",
      "ssh_url_to_repo": "git@gitlab.com:cru-albania-ds/broshura-4-ligjet.git",
      "http_url_to_repo": "https://gitlab.com/cru-albania-ds/broshura-4-ligjet.git",
      "web_url": "https://gitlab.com/cru-albania-ds/broshura-4-ligjet",
      "name": "broshura-4-ligjet",
      "name_with_namespace": "cru-albania-ds / broshura-4-ligjet",
      "path": "broshura-4-ligjet",
      "path_with_namespace": "cru-albania-ds/broshura-4-ligjet",
      "container_registry_enabled": true,
      "issues_enabled": true,
      "merge_requests_enabled": true,
      "wiki_enabled": true,
      "jobs_enabled": true,
      "snippets_enabled": false,
      "created_at": "2017-02-08T12:11:19.039Z",
      "last_activity_at": "2017-02-10T14:33:10.487Z",
      "shared_runners_enabled": true,
      "lfs_enabled": true,
      "creator_id": 428102,
      "namespace": {
        "id": 1303689,
        "name": "cru-albania-ds",
        "path": "cru-albania-ds",
        "kind": "group",
        "full_path": "cru-albania-ds"
      },
      "avatar_url": null,
      "star_count": 1,
      "forks_count": 0,
      "open_issues_count": 1,
      "public_jobs": true,
      "shared_with_groups": [],
      "only_allow_merge_if_pipeline_succeeds": false,
      "request_access_enabled": false,
      "only_allow_merge_if_all_discussions_are_resolved": false,
      "approvals_before_merge": 0
    }
  ],
  "shared_projects": []
}`)
      app.get('/testapi/groups/cru-albania-ds/', (req, res) => {
              res.setHeader('Content-Type', 'application/json')
              res.send(JSON.stringify(groupJson))
            })

      const instance = new GitlabApiV4(API_TOKEN, 'http://localhost:8081/testapi/')

            // act
      const group = await instance.getGroup('cru-albania-ds')    // our group

            // assert
      expect(group).to.not.be.null

      expect(group.id).to.equal(1303689, 'id')
      expect(group.name).to.equal('cru-albania-ds', 'name')
      expect(group.path).to.equal('cru-albania-ds', 'path')

      const proj = group.projects.find((p) => p.id === 2734361)
      expect(proj).to.not.be.null
      expect(proj.name).to.equal('cru-albania-ds.gitlab.io', 'proj.name')
    })
  })

  describe('getCommits', () => {
    it('should get a real commit list', async () => {
      const commitsJson = JSON.parse(`
[
  {
    "id": "bb9eed46ba9de7421d3696a8a5c581328d0b3991",
    "short_id": "bb9eed46",
    "title": "add notice to lint command which shows on pre-commit hook",
    "created_at": "2017-04-17T15:01:16.000+02:00",
    "parent_ids": [
      "220065dbaf7b29aef3d6c1095317c1552166656d"
    ],
    "message": "add notice to lint command which shows on pre-commit hook\\n",
    "author_name": "Gordon Burgett",
    "author_email": "gordon@gordonburgett.net",
    "authored_date": "2017-04-17T15:01:16.000+02:00",
    "committer_name": "Gordon Burgett",
    "committer_email": "gordon@gordonburgett.net",
    "committed_date": "2017-04-17T15:01:16.000+02:00"
  },
  {
    "id": "220065dbaf7b29aef3d6c1095317c1552166656d",
    "short_id": "220065db",
    "title": "remove unnecessary font-awesome import in main.scss to fix build",
    "created_at": "2017-04-17T14:53:14.000+02:00",
    "parent_ids": [
      "a6c44315821f0ed7c4ac14f5947fe6828ac9b29a"
    ],
    "message": "remove unnecessary font-awesome import in main.scss to fix build\\n",
    "author_name": "Gordon Burgett",
    "author_email": "gordon@gordonburgett.net",
    "authored_date": "2017-04-17T14:53:14.000+02:00",
    "committer_name": "Gordon Burgett",
    "committer_email": "gordon@gordonburgett.net",
    "committed_date": "2017-04-17T14:53:14.000+02:00"
  },
  {
    "id": "a6c44315821f0ed7c4ac14f5947fe6828ac9b29a",
    "short_id": "a6c44315",
    "title": "add default task to gulpfile",
    "created_at": "2017-04-15T22:02:53.000+02:00",
    "parent_ids": [
      "4bfd9c30bb3340290f543cc497bc60d9c6988190"
    ],
    "message": "add default task to gulpfile\\n",
    "author_name": "Gordon Burgett",
    "author_email": "gordon@gordonburgett.net",
    "authored_date": "2017-04-15T22:02:53.000+02:00",
    "committer_name": "Gordon Burgett",
    "committer_email": "gordon@gordonburgett.net",
    "committed_date": "2017-04-15T22:02:53.000+02:00"
  }
]`)
      app.get('/testapi/projects/2734361/repository/commits', (req, res) => {
              res.setHeader('Content-Type', 'application/json')
              res.send(JSON.stringify(commitsJson))
            })

      const instance = new GitlabApiV4(API_TOKEN, 'http://localhost:8081/testapi/')

            // act
      const commits = await instance.getCommits(2734361)    // our group

            // assert
      expect(commits).to.not.be.null
      expect(commits).to.not.be.empty
      expect(commits.length).to.equal(3, 'commits.length')

      const c0 = commits[0]
      expect(c0.id).to.not.be.empty
      expect(c0.short_id).to.not.be.empty
      expect(c0.title).to.not.be.empty
      expect(c0.created_at.valueOf()).to.be.greaterThan(0, 'c0.created_at')
      expect(c0.parent_ids).to.not.be.empty
      expect(c0.parent_ids[0]).to.not.be.empty
      expect(c0.message).to.not.be.empty
      expect(c0.author_name).to.not.be.empty
      expect(c0.author_email).to.not.be.empty
      expect(c0.authored_date.valueOf()).to.be.greaterThan(0, 'c0.authored_date')
      expect(c0.committer_name).to.not.be.empty
      expect(c0.committer_email).to.not.be.empty
      expect(c0.committed_date.valueOf()).to.be.greaterThan(0, 'c0.committed_date')

      const cLast = commits[commits.length - 1]
      expect(cLast.id).to.not.be.empty
      expect(cLast.short_id).to.not.be.empty
      expect(cLast.title).to.not.be.empty
        })
    })

  describe('getContributors', () => {
    it('should get a real contributor list', async () => {
      const contributorsJson = JSON.parse(`
[
  {
    "name": "Gordon Burgett",
    "email": "gordon@gordonburgett.net",
    "commits": 94,
    "additions": 0,
    "deletions": 0
  },
  {
    "name": "Afrim Karoshi",
    "email": "afrim.karoshi@cru.org",
    "commits": 3,
    "additions": 0,
    "deletions": 0
  },
  {
    "name": "kendo5731",
    "email": "aur.baumann@gmail.com",
    "commits": 37,
    "additions": 0,
    "deletions": 0
  }
]`)
      app.get('/testapi/projects/2734361/repository/contributors', (req, res) => {
          res.setHeader('Content-Type', 'application/json')
          res.send(JSON.stringify(contributorsJson))
        })

      const instance = new GitlabApiV4(API_TOKEN, 'http://localhost:8081/testapi/')

      // act
      const contributors = await instance.getContributors(2734361)    // our group

      // assert
      expect(contributors).to.not.be.null
      expect(contributors).to.not.be.empty
      expect(contributors.length).to.equal(3, 'commits.length')

      const c0 = contributors.find((c) => c.name === 'Gordon Burgett')
      expect(c0.name).to.equal('Gordon Burgett')
      expect(c0.email).to.equal('gordon@gordonburgett.net')
      expect(c0.commits).to.equal(94)
    })
  })

  describe('getOpenIssues', () => {
    it('should get a real issue list', async () => {
      const issuesJson = JSON.parse(`
[
  {
    "id": 5032085,
    "iid": 1,
    "project_id": 2734361,
    "title": "Test issue - DO NOT CLOSE",
    "description": "This issue is just to test that we can download issues via the Gitlab API",
    "state": "opened",
    "created_at": "2017-04-12T21:39:48.299Z",
    "updated_at": "2017-04-12T21:39:48.469Z",
    "labels": [],
    "milestone": {
      "id": 298439,
      "iid": 1,
      "project_id": 2734361,
      "title": "1.0",
      "description": "test milestone",
      "state": "active",
      "created_at": "2017-04-12T21:39:15.104Z",
      "updated_at": "2017-04-12T21:39:15.104Z",
      "due_date": null,
      "start_date": null
    },
    "assignee": {
      "name": "Gordon Burgett",
      "username": "gordon.burgett",
      "id": 428102,
      "state": "active",
      "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png",
      "web_url": "https://gitlab.com/gordon.burgett"
    },
    "author": {
      "name": "Gordon Burgett",
      "username": "gordon.burgett",
      "id": 428102,
      "state": "active",
      "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png",
      "web_url": "https://gitlab.com/gordon.burgett"
    },
    "user_notes_count": 0,
    "upvotes": 0,
    "downvotes": 0,
    "due_date": null,
    "confidential": false,
    "weight": 2,
    "web_url": "https://gitlab.com/cru-albania-ds/cru-albania-ds.gitlab.io/issues/1"
  }
]`)
      app.get('/testapi/projects/2734361/issues', (req, res) => {
              res.setHeader('Content-Type', 'application/json')
              res.send(JSON.stringify(issuesJson))
            })

      const instance = new GitlabApiV4(API_TOKEN, 'http://localhost:8081/testapi/')

            // act
      const issues = await instance.getOpenIssues(2734361)    // our group

            // assert
      expect(issues).to.not.be.null
      expect(issues).to.not.be.empty
      expect(issues.length).to.be.at.least(1, 'commits.length')

      const i0 = issues.find((c) => c.iid === 1)
      expect(i0.id).to.equal(5032085, 'id')
      expect(i0.title).to.equal('Test issue - DO NOT CLOSE')
      expect(i0.description).to.equal('This issue is just to test that we can download issues via the Gitlab API')
      expect(i0.state).to.equal('opened', 'state')
      expect(i0.created_at.toISOString()).to.equal('2017-04-12T21:39:48.299Z', 'created_at')
      expect(i0.updated_at.valueOf()).to.be.greaterThan(
                new Date('2017-04-12T21:39:48.299Z').valueOf(), 'c0.updated_at')
      expect(i0.labels).to.be.empty
      expect(i0.user_notes_count).to.equal(0, 'user_notes_count')
      expect(i0.upvotes).to.equal(0, 'upvotes')
      expect(i0.downvotes).to.equal(0, 'downvotes')
      expect(i0.due_date).to.be.undefined
      expect(i0.confidential).to.be.false
      expect(i0.weight).to.equal(2, 'weight')
      expect(i0.web_url).to.equal('https://gitlab.com/cru-albania-ds/cru-albania-ds.gitlab.io/issues/1')

      const milestone = i0.milestone
      expect(milestone.id).to.equal(298439, 'milestone.id')
      expect(milestone.iid).to.equal(1, 'milestone.iid')
      expect(milestone.project_id).to.equal(2734361, 'milestone.project_id')
      expect(milestone.title).to.equal('1.0', 'milestone.title')
      expect(milestone.description).to.equal('test milestone', 'milestone.description')
      expect(milestone.state).to.equal('active', 'milestone.state')
      expect(milestone.due_date).to.be.undefined
      expect(milestone.start_date).to.be.undefined
      expect(milestone.created_at.toISOString()).to.equal('2017-04-12T21:39:15.104Z', 'milestone.created_at')
      expect(i0.updated_at.valueOf()).to.be.greaterThan(
                new Date('2017-04-12T21:39:15.104Z').valueOf(), 'milestone.updated_at')

      const author = i0.author
      expect(author.name).to.equal('Gordon Burgett', 'author.name')
      expect(author.username).to.equal('gordon.burgett', 'author.username')
      expect(author.id).to.equal(428102, 'author.id')
      expect(author.state).to.equal('active', 'author.state')
      expect(author.avatar_url).to.not.be.empty
      expect(author.web_url).to.equal('https://gitlab.com/gordon.burgett', 'author.web_url')

      expect(i0.assignee).to.deep.equal(author, 'assignee should be the same as author')
    })
  })
})
