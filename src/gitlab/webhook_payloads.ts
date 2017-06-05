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

export interface Pipeline {
  object_kind: Object_Kind
  object_attributes: {
      id: number
      ref: string
      tag: boolean | string
      sha: string
      before_sha: string
      status: Status,
    }
  user: User
  project: Project
  commit: Commit
  builds: Build[]
}

export type Object_Kind = 'pipeline' | 'push'

export type Status = 'running' | 'failed' | 'success'

export interface User {
  name: string,
  username: string,
  avatar_url: string
}

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

export interface Commit {
  id: string
  message: string
  timestamp: string
  url: string
  author: {
      name: string
      email: string,
    }
}

export interface Build {
  id: number
  stage: string
  name: string
  status: Status
  created_at: string
  started_at: string
  finished_at: string
  when: string
  manual: boolean
  user: User
  runner: {
      id: number
      description: string
      active: boolean
      is_shared: boolean,
    }
  artifacts_file: {
      filename: string
      size: number,
    }
}
