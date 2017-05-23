
import * as url from 'url'

const defaultPorts = {
  'echo:': 7,
  'ftp-data:': 20,
  'ftp:': 21,
  'telnet:': 23,
  'smtp:': 25,
  'time:': 37,
  'nameserver:': 42,
  'domain:': 53,
  'tftp:': 69,
  'http:': 80,
  'pop2:': 109,
  'pop3:': 110,
  'auth:': 113,
  'irc:': 194,
  'ipx:': 213,
  'ldap:': 389,
  'https:': 443,
  'ldaps:': 636,
}

/**
 * Compares two URLs to see if they resolve to the same port on the same host
 */
export function isSameSite(url1: url.Url | string, url2: url.Url | string): boolean {
  if (typeof(url1) === 'string') {
    url1 = url.parse(url1)
  }
  if (typeof(url2) === 'string') {
    url2 = url.parse(url2)
  }
  // same host:port
  if (url1.hostname !== url2.hostname) {
    return false
  }

  const port1 = url1.port || defaultPorts[url1.protocol]
  const port2 = url2.port || defaultPorts[url2.protocol]

  // tslint:disable-next-line:triple-equals
  if (port1 != port2) {
    return false
  }

  return true
}
