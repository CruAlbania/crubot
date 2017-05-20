
export class CronTime {
  public source: string | Date
  public zone: string
  public realDate: boolean
  
  constructor(source: string | Date, zone: string)

  public toString(): string

  public toJSON(): any


}

export class CronJob {
  constructor(
    cronTime: string,
    onTick: () => void,
    onComplete: () => void,
    startNow: boolean, 
    timeZone: string, 
    context?: any,
    runOnInit?: boolean,
  )

  public addCallback(callback): void

  public lastDate(): number

  public start(): void

  public stop(): void
}

export function job(cronTime, onTick, onComplete): CronJob

export function time(cronTime, timeZone): CronTime