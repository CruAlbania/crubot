
import { ServerResponse } from "http";

declare class ScopedClient {
  constructor(url: string, options?: RequestOptions)

  request(method: string, reqBody?: any, callback?: (err: Error, resp: ServerResponse, body?: string) => void)

  fullPath(p: string): string

  join(suffix: string): string

  path(p: string): ScopedClient

  query(key: string | Map<string, string>, value?: string): ScopedClient

  host(h: string): ScopedClient

  port(p: number): ScopedClient

  protocol(p: string): ScopedClient

  encoding(e: string): ScopedClient

  timeout(time: number): ScopedClient

  auth(user: string, pass?: string): ScopedClient

  header(name: string, value: string): ScopedClient

  headers(h: Map<string, string>): ScopedClient


  static methods: string[]

  static defaultPort: {
    http: number
    https: number
  }
}

declare class RequestOptions {
  pathname?: string
  protocol?: string
  port?: number
  timeout?: number
  query?: Map<string, string>
  headers?: Map<string, string>
}

declare function create(url: string, options?: RequestOptions): ScopedClient