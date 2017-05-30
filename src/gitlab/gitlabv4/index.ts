import * as request from 'request-promise-native'

import { Commit, Contributor, Group, Issue, Project } from './responses'

const API_V4 = 'https://gitlab.com/api/v4/'

export class GitlabApiV4 {
  private API_TOKEN: string
  private apiUrl: string

  constructor(apiToken: string, apiUrl?: string) {
    this.API_TOKEN = apiToken  // the gitlab API token
    this.apiUrl = apiUrl || API_V4
  }

  public async getProject(id: number): Promise<Project> {
    const body = await request(this.apiUrl + `projects/${id}`, {
            headers: { 'PRIVATE-TOKEN': this.API_TOKEN },
            json: true,
        })
    return new Project(body)
  }

  public async getGroup(name: string): Promise<Group> {
    const body = await request(this.apiUrl + `groups/${name}/`, {
        headers: { 'PRIVATE-TOKEN': this.API_TOKEN },
        json: true,
    })
    return new Group(body)
  }

  public async getCommits(projectId: number): Promise<Commit[]> {
    const body = await request(this.apiUrl + `projects/${projectId}/repository/commits`, {
        headers: { 'PRIVATE-TOKEN': this.API_TOKEN },
        json: true,
    })

    return body.map((obj) => new Commit(obj))
  }

  public async getContributors(projectId: number): Promise<Contributor[]> {
    const body = await request(this.apiUrl + `projects/${projectId}/repository/contributors`, {
            headers: { 'PRIVATE-TOKEN': this.API_TOKEN },
            json: true,
        })

    return body.map((obj) => new Contributor(obj))
    }

  public async getOpenIssues(projectId: number): Promise<Issue[]> {
    const body = await request(this.apiUrl + `projects/${projectId}/issues?state=opened`, {
        headers: { 'PRIVATE-TOKEN': this.API_TOKEN },
        json: true,
    })

    return body.map((obj) => new Issue(obj))
  }
}
