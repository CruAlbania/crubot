var gulp = require('gulp')
var ts = require('gulp-typescript')
var rename = require('gulp-rename')
var del = require('del')
var vinylPaths = require('vinyl-paths')

const tsproj = ts.createProject('tsconfig.json')

gulp.task('build', () => {
  return gulp.src(['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'])
      .pipe(tsproj())
      .pipe(rename({
        extname: ".js"
      }))
      .pipe(gulp.dest('scripts'))
})

gulp.task('watch', ['build'], () => 
  gulp.watch(['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'], ['build'])
)

gulp.task('clean', function () {
  return gulp.src(['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'], { read: false })
    .pipe(rename({
      extname: ".js"
    }))
    .pipe(gulp.dest('scripts'))
    .pipe(vinylPaths(del))
})