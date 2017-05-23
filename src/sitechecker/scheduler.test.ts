// tslint:disable:no-unused-expression
import * as chai from 'chai'
import { EventEmitter } from 'events'
import * as sinon from 'sinon'
const expect = chai.expect

import { CronJob } from 'cron'
import { Scheduler } from './scheduler'

describe('scheduler', () => {

  beforeEach(() => {
    this.clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    this.clock.restore()
  })

  it('should start a new cron job on the given schedule', () => {

    const brain = { set: () => undefined, get: () => undefined }

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)

    // act
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })

    // assert
    expect(jobId).to.exist

    this.clock.tick(90 * 1000) // 1.5 minute
    expect(service.called).to.be.true
    expect(service.args[0][0]).to.deep.equal({ test: 1})
  })

  it('should start a new cron job immediately when runImmediately set', () => {

    const brain = { set: () => undefined, get: () => undefined }

    const calls = []
    const service = (ctx) => {
      calls.push(Date.now())
    }
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)

    // act
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 }, true)

    // assert
    expect(jobId).to.exist

    this.clock.tick(90 * 1000) // 1.5 minute - not enough for two jobs

    expect(calls).to.have.length(2)
    expect(calls[0]).to.equal(0)
    expect(calls[1]).to.equal(60 * 1000)
  })

  it('should store the cron job in the brain', () => {

    const brain = { set: () => undefined, get: () => undefined }
    const Sset = sinon.spy(brain, 'set')

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)

    // act
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })

    // assert
    expect(jobId).to.exist

    expect(Sset.called).to.be.true
    expect(Sset.args[0][0]).to.equal('scheduler.jobs')
    expect(Sset.args[0][1]).to.deep.equal({
      jobs: {
        [jobId]: {
          id: jobId,
          cronTime: '* * * * *',
          serviceName: 'mock',
          context: { test: 1 },
        },
      },
    })
  })

  it('should throw an error on unknown service and not store in the brain', () => {

    const brain = { set: () => undefined, get: () => undefined }
    const Sset = sinon.spy(brain, 'set')

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)

    // act
    try {
      scheduler.StartJob('* * * * *', 'asdfqerty', { test: 1 })
      expect.fail('Should have thrown an error but didnt')
    } catch (error) {
      expect(error.message).to.contain('asdfqerty')
    }

    // assert
    expect(Sset.called).to.be.false
  })

  it('should stop a started job and remove it from the brain', () => {
    const brain = new Map<string, any>()
    const Sset = sinon.spy(brain, 'set')

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })

    // act
    const { definition, job } = scheduler.StopJob(jobId)

    // assert
    expect(definition).to.deep.equal({
      id: jobId,
      cronTime: '* * * * *',
      serviceName: 'mock',
      context: { test: 1},
    })

    expect(job).to.be.instanceof(CronJob, 'job')
    expect(job).to.have.property('running', false)

    expect(Sset).to.have.property('calledTwice', true)
    expect(Sset.args[1][0]).to.equal('scheduler.jobs')
    expect(Sset.args[1][1]).to.deep.equal({
      jobs: { },
    })
    expect(brain.get('scheduler.jobs')).to.deep.equal({
      jobs: { },
    })
  })

  it('should silently return when unable to find the job to stop', () => {
    const brain = new Map<string, any>()
    const Sset = sinon.spy(brain, 'set')

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })

    // act
    const retval = scheduler.StopJob('asdlfkjqwlekjr')

    // assert
    expect(retval).to.be.undefined

    expect(Sset.calledTwice).to.be.false
    expect(brain.get('scheduler.jobs')).to.deep.equal({
      jobs: {
        [jobId]: {
          id: jobId,
          cronTime: '* * * * *',
          serviceName: 'mock',
          context: { test: 1 },
        },
      },
    })
  })

  it('should get all running jobs', () => {
    const brain = new Map<string, any>()
    const Sset = sinon.spy(brain, 'set')

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })
    this.clock.tick(1) // needed to generate a unique uuid
    const jobId2 = scheduler.StartJob('*/5 * * * *', 'mock', { test: 2 })

    // act
    const array = scheduler.GetRunningJobs()

    // assert
    expect(array.length).to.equal(2, 'array.length')
    expect(array[0].definition).to.deep.equal({
        id: jobId,
        cronTime: '* * * * *',
        serviceName: 'mock',
        context: { test: 1 },
      })
    expect(array[1].definition).to.deep.equal({
        id: jobId2,
        cronTime: '*/5 * * * *',
        serviceName: 'mock',
        context: { test: 2 },
      })
    expect(array[0].job).to.be.instanceof(CronJob)
    expect(array[1].job).to.be.instanceof(CronJob)
    expect(array[0].job).to.have.property('running', true)
    expect(array[1].job).to.have.property('running', true)
  })

  it('should load stored jobs from the database and start them', () => {
    const brain = new Map<string, any>([
      ['scheduler.jobs', {
        jobs: {
          12345: {
            id: '12345',
            cronTime: '*/5 * * * *',
            serviceName: 'mock',
            context: { test: 3 },
          },
          67890: {
            id: '67890',
            cronTime: '* * * * *',
            serviceName: 'mock',
            context: { test: 4 },
          },
        },
      }],
    ])

    const service = sinon.spy()
    const services = new Map([
     ['mock', service],
    ])

    // act
    const scheduler = new Scheduler(brain as any, services)

    // assert
    const jobs = scheduler.GetRunningJobs()

    expect(jobs).has.length(2)
    expect(jobs[0].job).has.property('running', true)
    expect(jobs[1].job).has.property('running', true)

    this.clock.tick(90 * 1000) // clock at 1.5 minutes
    expect(service).has.property('callCount', 1)
    expect(service.args[0][0]).deep.equals({ test: 4 })

    this.clock.tick(4 * 60 * 1000) // clock now at 5.5 minutes
    expect(service).has.property('callCount', 6) // 5 of { test: 4} and 1 of { test: 3 }
    expect(service.args[4][0]).deep.equals({ test: 3 })
  })

  it('should handle a service throwing an error', () => {
    const brain = { set: () => undefined, get: () => undefined }

    const service = sinon.mock()
    service.throws(new Error('this should be handled'))
    const services = new Map([
     ['mock', service],
    ])

    const scheduler = new Scheduler(brain as any, services)
    const errors = []
    scheduler.logger = {
      error: () => {
        errors.push(arguments.toString())
      },
    }

    // act
    const jobId = scheduler.StartJob('* * * * *', 'mock', { test: 1 })

    // assert
    this.clock.tick(90 * 1000)  // 1.5 min
    expect(errors).to.have.length(1, 'errors')
    this.clock.tick(31 * 1000)  // 2:01
    expect(errors).to.have.length(2, 'errors')

  })
})
