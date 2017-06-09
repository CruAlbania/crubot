/// <reference types="node"/>
// tslint:disable:interface-name

/*
  {
    "object_kind": "pipeline",
    "object_attributes": {
      "id": 8649766,
      "ref": "master",
      "tag": false,
      "sha": "c8fd8cbab1277c9b5aa484685215c7e4b5ec27da",
      "before_sha": "c8fd8cbab1277c9b5aa484685215c7e4b5ec27da",
      "status": "failed",
      "stages": [
        "build",
        "test",
        "deploy"
      ],
      "created_at": "2017-05-30 20:56:49 UTC",
      "finished_at": "2017-06-05 14:34:00 UTC",
      "duration": 209
    },
    "user": {
      "name": "Gordon Burgett",
      "username": "gordon.burgett",
      "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
    },
    "project": {
      "name": "hapitjeter",
      "description": "Source code for [hapitjeter.net](http://hapitjeter.net)",
      "web_url": "https://gitlab.com/CruAlbaniaDigital/hapitjeter",
      "avatar_url": null,
      "git_ssh_url": "git@gitlab.com:CruAlbaniaDigital/hapitjeter.git",
      "git_http_url": "https://gitlab.com/CruAlbaniaDigital/hapitjeter.git",
      "namespace": "CruAlbania",
      "visibility_level": 20,
      "path_with_namespace": "CruAlbaniaDigital/hapitjeter",
      "default_branch": "master"
    },
    "commit": {
      "id": "c8fd8cbab1277c9b5aa484685215c7e4b5ec27da",
      "message": "fix issue with ssh key permissions\n",
      "timestamp": "2017-05-30T22:56:37+02:00",
      "url": "https://gitlab.com/CruAlbaniaDigital/hapitjeter/commit/c8fd8cbab1277c9b5aa484685215c7e4b5ec27da",
      "author": {
        "name": "Gordon Burgett",
        "email": "gordon@gordonburgett.net"
      }
    },
    "builds": [
      {
        "id": 17911523,
        "stage": "deploy",
        "name": "deploy_staging",
        "status": "failed",
        "created_at": "2017-06-05 14:33:01 UTC",
        "started_at": "2017-06-05 14:33:03 UTC",
        "finished_at": "2017-06-05 14:34:00 UTC",
        "when": "on_success",
        "manual": false,
        "user": {
          "name": "Gordon Burgett",
          "username": "gordon.burgett",
          "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
        },
        "runner": {
          "id": 40786,
          "description": "shared-runners-manager-1.gitlab.com",
          "active": true,
          "is_shared": true
        },
        "artifacts_file": {
          "filename": null,
          "size": null
        }
      },
      {
        "id": 17524260,
        "stage": "deploy",
        "name": "deploy_staging",
        "status": "failed",
        "created_at": "2017-05-30 21:02:52 UTC",
        "started_at": "2017-05-30 21:02:54 UTC",
        "finished_at": "2017-05-30 21:03:41 UTC",
        "when": "on_success",
        "manual": false,
        "user": {
          "name": "Gordon Burgett",
          "username": "gordon.burgett",
          "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
        },
        "runner": {
          "id": 40788,
          "description": "shared-runners-manager-2.gitlab.com",
          "active": true,
          "is_shared": true
        },
        "artifacts_file": {
          "filename": null,
          "size": null
        }
      },
      {
        "id": 17523910,
        "stage": "deploy",
        "name": "deploy_staging",
        "status": "failed",
        "created_at": "2017-05-30 20:56:51 UTC",
        "started_at": "2017-05-30 20:59:30 UTC",
        "finished_at": "2017-05-30 21:00:24 UTC",
        "when": "on_success",
        "manual": false,
        "user": {
          "name": "Gordon Burgett",
          "username": "gordon.burgett",
          "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
        },
        "runner": {
          "id": 40786,
          "description": "shared-runners-manager-1.gitlab.com",
          "active": true,
          "is_shared": true
        },
        "artifacts_file": {
          "filename": null,
          "size": null
        }
      },
      {
        "id": 17523909,
        "stage": "test",
        "name": "test_integration",
        "status": "success",
        "created_at": "2017-05-30 20:56:50 UTC",
        "started_at": "2017-05-30 20:57:33 UTC",
        "finished_at": "2017-05-30 20:59:29 UTC",
        "when": "on_success",
        "manual": false,
        "user": {
          "name": "Gordon Burgett",
          "username": "gordon.burgett",
          "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
        },
        "runner": {
          "id": 40786,
          "description": "shared-runners-manager-1.gitlab.com",
          "active": true,
          "is_shared": true
        },
        "artifacts_file": {
          "filename": null,
          "size": null
        }
      },
      {
        "id": 17523905,
        "stage": "build",
        "name": "lint",
        "status": "success",
        "created_at": "2017-05-30 20:56:49 UTC",
        "started_at": "2017-05-30 20:56:53 UTC",
        "finished_at": "2017-05-30 20:57:30 UTC",
        "when": "on_success",
        "manual": false,
        "user": {
          "name": "Gordon Burgett",
          "username": "gordon.burgett",
          "avatar_url": "https://gitlab.com/uploads/user/avatar/428102/avatar.png"
        },
        "runner": {
          "id": 40788,
          "description": "shared-runners-manager-2.gitlab.com",
          "active": true,
          "is_shared": true
        },
        "artifacts_file": {
          "filename": null,
          "size": null
        }
      }
    ]
  }
*/

/**
 * Webhook payload for a Pipeline event
 */
export interface Pipeline {
  /** always 'pipeline' */
  object_kind: Object_Kind
  /** Info about the trigger for this pipeline */
  object_attributes: {
      /** Gitlab internal ID of pipeline */
      id: number
      ref: string
      /** 'False' if no tag */
      tag: boolean | string
      sha: string
      before_sha: string
      status: Status
      /** "2017-05-30 20:56:49 UTC" */
      created_at: string
      /** "2017-05-30 20:56:49 UTC" */
      finished_at: string,
    }
  /** User who triggered the pipeline */
  user: User
  /** Project associated with the pipeline */
  project: Project
  /** Commit which this pipeline is building */
  commit: Commit
  /** The builds composing this pipeline */
  builds: Build[]
}

/**
 * Discriminator for event types
 */
export type Object_Kind = 'pipeline' | 'push'   // TODO: add more

/**
 * Status of a pipeline or build
 */
export type Status =  'created' | 'pending' | 'running' | 'failed' | 'success'

/**
 * Gitlab user
 */
export interface User {
  name: string,
  username: string,
  avatar_url: string
}

/**
 * Gitlab project
 */
export interface Project {
  name: string
  description: string
  web_url: string
  avatar_url: string
  git_ssh_url: string
  git_http_url: string
  namespace: string
  visibility_level: number
  path_with_namespace: string
  default_branch: string
}

/**
 * Commit
 */
export interface Commit {
  /** SHA hash of commit id */
  id: string
  /** Commit message - can contain newlines */
  message: string
  /** Commit timestamp in format "2017-04-23T23:30:40+02:00" */
  timestamp: string
  /** URL to view the commit on gitlab */
  url: string
  /** Author of the commit according to Git (nothing to do with Gitlab user) */
  author: {
      name: string
      email: string,
    }
}

/**
 * A build on Gitlab CI
 *   Multiple builds compose a stage, multiple stages compose a pipeline
 */
export interface Build {
  /** Internal Gitlab ID of the build */
  id: number
  /** Stage of the build, i.e. 'build' 'test' 'deploy' etc */
  stage: string
  /** Name as defined in gitlab-ci.yml */
  name: string
  status: Status
  /** When the job was created in the Gitlab database, usually in response to an event.  Format: 2017-05-30 20:56:49 UTC */
  created_at: string
  /** When the job started running. Format: 2017-05-30 20:56:49 UTC */
  started_at: string
  /** When the job finished running. Format: 2017-05-30 20:56:49 UTC */
  finished_at: string
  /** What triggers this build */
  when: string
  /** Whether the build was manually triggered from the API or web interface */
  manual: boolean
  /** Gitlab user who initiated the build */
  user: User
  /** Info about the build runner */
  runner: {
      id: number
      description: string
      active: boolean
      is_shared: boolean,
    }
  /** Info about any saved artifacts */
  artifacts_file: {
      filename: string
      size: number,
    }
}
