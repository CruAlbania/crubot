/// <reference types="node"/>

import { EventEmitter } from "events";
import * as express from "express";
import * as Log from 'log'

export class Robot {
  name: string

  events: EventEmitter
  
  brain: Brain

  alias?: string

  adapter: any

  Response: Response

  commands: string[]

  listeners: any[]

  middleware: {
    listener: Middleware
    response: Middleware
    receive:  Middleware
  }

  logger: any
  pingIntervalId: any
  globalHttpOptions: any
  adapterName: string
  errorHandlers: any[]

  /**
   * Listens using a custom matching function instead of regex
   * 
   */
  listen(matcher: (message: Message) => boolean, options?: any, cb?: responder)
  
  /** 
   * Listens to all messages in a room, and responds whenever
   *  the given regex matches text.
   * 
   * @param regex the text to listen for
   * @param resp  called when any text matches the regex
   */
  hear(regex: RegExp, options?: Metadata | responder, cb?: responder)

  /**
   * Add a listener triggered whenever anyone enters the room
   */
  enter(options?: Metadata | responder, cb?: responder)

  /**
   * Adds a listener triggered whenever anyone leaves the room
   */
  leave(options?: Metadata | responder, cb?: responder)

  /**
   * Adds a Listener that triggers when anyone changes the topic.
   */
  topic(options?: Metadata | responder, cb?: responder)

  /**
   * Adds an error handler when an uncaught exception or user emitted
   * error event occurs.
   */
  error(callback: (err: Error, res: Response) => void)

  /**
   * Adds a Listener that triggers when no other text matchers match.
   */
  catchAll(options?: any, callback?: responder)

  /**
   * Listens to messages directly targeted at hubot, responding
   *  only when the message is preceded by the robot's name or alias.
   * 
   * example:
   *  hal open the pod bay doors
   *  HAL: open the pod bay doors
   *  @HAL open the pod bay doors
   */
  respond(regex: RegExp, options?: Metadata | responder, cb?: responder)

  /**
   * Sends a message to an explicitly named room or user.
   */
  messageRoom(room: string, message: string)

  /**
   * Makes HTTP calls using node-scoped-http-client
   * 
   * https://hubot.github.com/docs/scripting/#making-http-calls
   */
  http(url: string): any

  /**
   * Registers new middleware for execution after matching but before
   * Listener callbacks
   */
  listenerMiddleware(middleware: Middleware): void

  /**
   * Registers new middleware for execution as a response to any
   *  message is being sent.
   */
  responseMiddleware(middleware: Middleware): void

  /**
   * Registers new middleware for execution before matching
   */
  receiveMiddleware(middleware: Middleware): void

  /**
   * Passes the given message to any interested Listeners after running
   *  receive middleware.
   */
  receive(message: Message, cb?: any)

  /**
   * Returns an Array of help commands for running scripts.
   */
  helpCommands(): string[]

  /**
   * A wrapper around the EventEmitter API
   */
  on(event: string, ...args: any[])

  /**
   * A wrapper around the EventEmitter API
   */
  emit(event: string, ...args: any[])

  /**
   * Provides HTTP endpoints for services with webhooks to push to.
   */
  router: express.Application
}

type responder = (res: Response) => void

/**
 * A function that examines an outgoing message and can modify
 *  it or prevent its sending.
 *  If execution should continue, the middleware should call next(done)
 *  If execution should stop, the middleware should call done().
 *  To modify the outgoing message, set context.string to a new message
 */
type Middleware = (context: any, next: (doneFunc: () => void) => void, done: () => void) => void

export class Metadata{
  id: string

  [key: string]: any
}

export class Response {

  /**
   * The match array from the regex given to 'hear' or 'respond'
   */
  match: RegExpMatchArray

  envelope: {
    user: User
    room: Room
    message: Message
  }
  
  /**
   * Sends the respose string back to the room that the message came from.
   *  The given text is sent as-is.
   */
  send(...strings: string[])

  /**
   * Posts an emote back to the chat source
   */
  emote(...strings: string[])

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
  reply(...strings: string[])

  /**
   * Posts a topic changing message
   */
  topic(...strings: string[])

  /**
   * Picks a random item from the given items.
   */
  random<T>(items: T[]): T

  /**
   * Tell the message to stop dispatching to listeners
   */
  finish(): void

  /**
   * Create a scoped http client
   */
  http(url: string, options?: any): any
}

export class Message{
  constructor(user: User, done?: boolean)

  user: User
  room?: Room

  /** Indicates that no other Listener should be called on this object */
  finish(): void
}

export class TextMessage extends Message {
  match(regex: RegExp): RegExpMatchArray

  toString(): string
}

export class EnterMessage extends Message{}

export class LeaveMessage extends Message{}

export class TopicMessage extends TextMessage{}

export class CatchAllMessage extends Message{}

export class User {
  id: string
  name: string

  room?: Room

  [option: string]: any
}

type Room = string

export class Brain extends EventEmitter {
  data: {
    users: any
  }

  set(key: string, value: any)

  get(key: string): any

  remove(key: string)

  save(): void

  close(): void

  setAutoSave(enabled: boolean): void

  resetSaveInterval(seconds: number): void

  mergeData(data: any): void

  users(): any

  userForId(id: string, options?: any): User

  userForName(name: string): User

  usersForRawFuzzyName(fuzzyName: string): User[]

  usersForFuzzyName(fuzzyName: string): User[]


}