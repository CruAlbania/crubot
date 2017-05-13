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
}
