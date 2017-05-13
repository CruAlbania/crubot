/// <reference types="node"/>

import { EventEmitter } from 'events'
import * as express from 'express'
import * as Log from 'log'

export class Robot {
  public name: string

  public events: EventEmitter

  public brain: Brain

  public alias?: string

  public adapter: any

  public Response: Response

  public commands: string[]

  public listeners: any[]

  public middleware: {
    listener: Middleware<ListenerMiddlewareContext>
    response: Middleware<ResponseMiddlewareContext>
    receive:  Middleware<ReceiveMiddlewareContext>
  }

  public logger: any
  public pingIntervalId: any
  public globalHttpOptions: any
  public adapterName: string
  public errorHandlers: any[]

  /**
   * Listens using a custom matching function instead of regex
   *
   */
  public listen(matcher: (message: Message) => boolean, options?: any, cb?: responder)

  /**
   * Listens to all messages in a room, and responds whenever
   *  the given regex matches text.
   *
   * @param regex the text to listen for
   * @param resp  called when any text matches the regex
   */
  public hear(regex: RegExp, options?: Metadata | responder, cb?: responder)

  /**
   * Add a listener triggered whenever anyone enters the room
   */
  public enter(options?: Metadata | responder, cb?: responder)

  /**
   * Adds a listener triggered whenever anyone leaves the room
   */
  public leave(options?: Metadata | responder, cb?: responder)

  /**
   * Adds a Listener that triggers when anyone changes the topic.
   */
  public topic(options?: Metadata | responder, cb?: responder)

  /**
   * Adds an error handler when an uncaught exception or user emitted
   * error event occurs.
   */
  public error(callback: (err: Error, res: Response) => void)

  /**
   * Adds a Listener that triggers when no other text matchers match.
   */
  public catchAll(options?: any, callback?: responder)

  /**
   * Listens to messages directly targeted at hubot, responding
   *  only when the message is preceded by the robot's name or alias.
   *
   * example:
   *  hal open the pod bay doors
   *  HAL: open the pod bay doors
   *  @HAL open the pod bay doors
   */
  public respond(regex: RegExp, options?: Metadata | responder, cb?: responder)

  /**
   * Sends a message to an explicitly named room or user.
   */
  public messageRoom(room: string, message: string)

  /**
   * Makes HTTP calls using node-scoped-http-client
   *
   * https://hubot.github.com/docs/scripting/#making-http-calls
   */
  public http(url: string): any

  /**
   * Registers new middleware for execution after matching but before
   * Listener callbacks
   */
  public listenerMiddleware(middleware: Middleware<ListenerMiddlewareContext>): void

  /**
   * Registers new middleware for execution as a response to any
   *  message is being sent.
   */
  public responseMiddleware(middleware: Middleware<ResponseMiddlewareContext>): void

  /**
   * Registers new middleware for execution before matching
   */
  public receiveMiddleware(middleware: Middleware<ReceiveMiddlewareContext>): void

  /**
   * Passes the given message to any interested Listeners after running
   *  receive middleware.
   */
  public receive(message: Message, cb?: any)

  /**
   * Returns an Array of help commands for running scripts.
   */
  public helpCommands(): string[]

  /**
   * A wrapper around the EventEmitter API
   */
  public on(event: string, ...args: any[])

  /**
   * A wrapper around the EventEmitter API
   */
  public emit(event: string, ...args: any[])

  /**
   * Provides HTTP endpoints for services with webhooks to push to.
   */
  public router: express.Application
}

type responder = (res: Response) => void

/**
 * A function that examines an outgoing message and can modify
 *  it or prevent its sending.
 *  If execution should continue, the middleware should call next(done)
 *  If execution should stop, the middleware should call done().
 *  To modify the outgoing message, set context.string to a new message
 */
type Middleware<T> = (context: T, next: (doneFunc?: () => void) => void, done: () => void) => void

type ReceiveMiddlewareContext = {
  response: Response
}

type ListenerMiddlewareContext = {
  response: Response
  listener: {
    /** The metadata defined on a robot listener */
    options?: Metadata
  }
}

type ResponseMiddlewareContext = {
  response: Response
  strings: string[]
  method: string
  plaintext?: boolean
}

type Metadata = {
  id: string

  [key: string]: any
}

export class Response {

  /**
   * The match array from the regex given to 'hear' or 'respond'
   */
  public match: RegExpMatchArray

  public envelope: {
    user: User
    room: Room
    message: Message,
  }

  /**
   * Sends the respose string back to the room that the message came from.
   *  The given text is sent as-is.
   */
  public send(...strings: string[])

  /**
   * Posts an emote back to the chat source
   */
  public emote(...strings: string[])

  /**
   * Sends the response string as a reply to the user who sent the initial message.
   *
   * example:
   *   robot.respond(/open the pod bay doors/i, (res) => {
   *     res.reply("I'm afraid I can't let you do that")
   *   })
   *
   *   Dave - "HAL, open the pod bay doors"
   *   HAL  - "Dave: I'm afraid I can't let you do that"
   */
  public reply(...strings: string[])

  /**
   * Posts a topic changing message
   */
  public topic(...strings: string[])

  /**
   * Picks a random item from the given items.
   */
  public random<T>(items: T[]): T

  /**
   * Tell the message to stop dispatching to listeners
   */
  public finish(): void

  /**
   * Create a scoped http client
   */
  public http(url: string, options?: any): any
}

export class Message {
  constructor(user: User, done?: boolean)

  public user: User
  public room?: Room

  /** Indicates that no other Listener should be called on this object */
  public finish(): void
}

export class TextMessage extends Message {
  public match(regex: RegExp): RegExpMatchArray

  public toString(): string
}

export class EnterMessage extends Message {}

export class LeaveMessage extends Message {}

export class TopicMessage extends TextMessage {}

export class CatchAllMessage extends Message {}

type User = {
  id: string
  name: string

  room?: Room

  [option: string]: any
}

type Room = string

export class Brain extends EventEmitter {
  public data: {
    users: any,
  }

  public set(key: string, value: any)

  public get(key: string): any

  public remove(key: string)

  public save(): void

  public close(): void

  public setAutoSave(enabled: boolean): void

  public resetSaveInterval(seconds: number): void

  public mergeData(data: any): void

  public users(): any

  public userForId(id: string, options?: any): User

  public userForName(name: string): User

  public usersForRawFuzzyName(fuzzyName: string): User[]

  public usersForFuzzyName(fuzzyName: string): User[]

}
