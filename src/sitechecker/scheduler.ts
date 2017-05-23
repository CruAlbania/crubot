import * as Log from 'log'
import * as uuid from 'uuid'

import { CronJob } from 'cron'

interface IKVStore {
  get<T>(key: string): T
  set<T>(key: string, value: T)
}

export class Scheduler {
  public logger: Log = console

  private brain: IKVStore
  private services: Map<string, (context: any) => void>

  private cronjobs: Map<string, CronJob>

  /**
   * Creates a scheduler for the given services
   * @param brain The key value store - implemented by hubot brain
   * @param services The set of services which can be executed on a schedule
   */
  constructor(brain: IKVStore, services: Map<string, (context: any) => void>) {
    this.brain = brain
    this.services = services
    this.cronjobs = new Map<string, CronJob>()

    this.loadCronJobs()
  }

  /**
   * Starts a new cron job, storing it in the brain
   * @param cronTime The schedule in cron syntax for the job
   * @param serviceName The name of the service to be executed
   * @param context The context to be passed to the executed service
   * @param runImmediately (optional) Whether to have the cron job fire immediately or wait for the next scheduled time
   */
  public StartJob(cronTime: string, serviceName: string, context: any, runImmediately: boolean = false): string {

    if (!this.services.has(serviceName)) {
      throw new Error('Unable to find service named ' + serviceName)
    }

    const definition = {
      id: uuid.v1(),
      cronTime,
      serviceName,
      context,
    }

    let store = this.brain.get<ICronJobStore>('scheduler.jobs')
    if (!store) {
      store = { jobs: {} }
    }
    store.jobs[definition.id] = definition
    this.brain.set<ICronJobStore>('scheduler.jobs', store)

    const job = this.startJobFromDefinition(definition, runImmediately)

    return definition.id
  }

  public StopJob(id: string): { definition: IJobDefinition, job: CronJob } {
    const job = this.cronjobs.get(id)
    if (!job) {
      return undefined
    }
    const store = this.brain.get<ICronJobStore>('scheduler.jobs')
    const def = store.jobs[id]

    // stop the job
    job.stop()
    this.cronjobs.delete(id)
    delete(store.jobs[id])
    this.brain.set<ICronJobStore>('scheduler.jobs', store)

    return {
      definition: def,
      job,
    }
  }

  public GetRunningJobs(): Array<{definition: IJobDefinition, job: CronJob}> {
    const ret = []
    const store = this.brain.get<ICronJobStore>('scheduler.jobs')
    for (const id of this.cronjobs.keys()) {
      const job = this.cronjobs.get(id)
      const definition = store.jobs[id]
      ret.push({ job, definition })
    }

    return ret
  }

  private loadCronJobs(): Map<string, CronJob> {
    const store = this.brain.get<ICronJobStore>('scheduler.jobs')
    if (!store) {
      return
    }

    for (const id in store.jobs) {
      if (!store.jobs.hasOwnProperty(id)) {
        continue
      }
      const definition = store.jobs[id]
      this.startJobFromDefinition(definition, false)
    }
  }

  private startJobFromDefinition(definition: IJobDefinition, runOnInit: boolean): CronJob {
    const service = this.services.get(definition.serviceName)
    if (!service) {
      if (this.logger) {
        this.logger.error('unable to start job ', definition.id, ': service', definition.serviceName, 'not found')
      }
    }

    const logger = this.logger
    const job = new CronJob(
      definition.cronTime,
      function() {
        try {
          service(this) // `this` === context
        } catch (error) {
          if (logger) {
            logger.error('Error running service', definition.serviceName, error)
          }
        }
      },
      () => {
        this.cronjobs.delete(definition.id)
      },
      true,
      null,
      definition.context,
      runOnInit,
      )
    this.cronjobs.set(definition.id, job)

    return job
  }
}

export interface ICronJobStore {
  jobs: {
    [id: string]: IJobDefinition,
  }
}

interface IJobDefinition {
  id: string
  cronTime: string,
  serviceName: string,
  context: any
}
