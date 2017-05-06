var gulp = require('gulp')
var ts = require('gulp-typescript')
var rename = require('gulp-rename')

gulp.task('build', () => {
  return gulp.src(['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'])
      .pipe(ts({
      }))
      .pipe(rename({
        extname: ".js"
      }))
      .pipe(gulp.dest('scripts'))
})
