// Description:
//   Prevents hubot from sending the same message more than 3 times in a row.
//
// Dependencies:
//
// Configuration:
//
// Commands:
//
// Notes:
//
// Author:
//   gburgett

import { Robot } from './hubot'

module.exports = (robot: Robot) => {

  const previousMsgs: string[] = []
  const allowedRepeatCount = 3 // any more than this and we'll insert a message

  robot.responseMiddleware(
    (context, next, done) => {
      // console.log(context.response.message)
      let lastMsg = ''
      let msgRepeatCount = 0
      for (const msg of previousMsgs) {
        if (msg !== lastMsg) {
          lastMsg = msg
          msgRepeatCount = 1
        } else {
          msgRepeatCount++
        }
      }

      const insertIndices = [] as number[]

      for (let i = 0; i < context.strings.length; i++) {
        if (context.strings[i] !== lastMsg) {
          lastMsg = context.strings[i]
          msgRepeatCount = 1
        } else {
          msgRepeatCount++
          if (msgRepeatCount > allowedRepeatCount) {
            // We said the same thing 3 times in a row, and we're about to say it a 4th time.
            // insert a new message here, so we break it up.
            insertIndices.push(i)
            msgRepeatCount = 1
          }
        }
      }

      if (insertIndices.length > 0) {
        // actually insert the new messages at the locations we expected
        const newStrings = [] as string[]
        let lastSlice = 0
        for (const idx of insertIndices) {
          newStrings.push(...context.strings.slice(lastSlice, idx))
          newStrings.push("I hope you're not trying to get me banned :)")
          lastSlice = idx
        }
        newStrings.push(...context.strings.slice(lastSlice))
        context.strings = newStrings
      }

      previousMsgs.push(...context.strings)
      if (previousMsgs.length > allowedRepeatCount) {
        previousMsgs.slice(previousMsgs.length - allowedRepeatCount)
      }

      next(done)
    },
  )

    // break up large strings
  const STRING_LENGTH_LIMIT = (1024 * 4) - 100  // 4kb minus some

  robot.responseMiddleware(
    (context, next, done) => {
      const length = context.strings.reduce((size, s) => size += s.length, 0)
      if (length < STRING_LENGTH_LIMIT) {
        // if we're processing a queue, drop this at the end
        if (queue.length > 0) {
          queue.push({ room: context.response.envelope.room, message: context.strings.join()})
          context.strings = []
        }

        next(done)
        return
      }

      // over 1000 chars - break it up
      let currentBlock = []
      for (const str of context.strings) {
        for (let i = 0; i < str.length; ) {
          const nextNewline = str.indexOf('\n', i)
          let thisLine: string
          if (nextNewline === -1) {
            thisLine = str.substring(i)
          } else {
            thisLine = str.substring(i, nextNewline)
          }
          i = nextNewline + 1

          const blockLength = currentBlock.reduce((size, s) => size += s.length, 0)
          if (blockLength + thisLine.length > STRING_LENGTH_LIMIT) {
              // we would go over the limit.  Push it to the queue.
            queue.push({ room: context.response.envelope.room, message: currentBlock.join('\n') })
            currentBlock = []
          }
          currentBlock.push(thisLine)

          if (nextNewline === -1) {
            break
          }
        }
      }
      // push the remainder to the queue
      if (currentBlock.length > 0) {
        queue.push({ room: context.response.envelope.room, message: currentBlock.join('\n') })
      }

      if (!currentTimeout) {
        // The queue length was zero before we started.  We can process the first block immediately
        context.strings = [queue[0].message]
        queue = queue.slice(1)
        // start processing
        currentTimeout = setTimeout(processQueue, 2000)
      }
      next(done)
    },
  )

  let queue = new Array<{ room: string, message: string }>()
  let currentTimeout: NodeJS.Timer

  function processQueue() {
    if (queue.length === 0) {
      // we're done
      return
    }

    const toSend = queue[0]
    queue = queue.slice(1)
    robot.messageRoom(toSend.room, toSend.message)

    setTimeout(processQueue, 2000)
  }
}
