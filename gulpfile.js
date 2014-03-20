var gulp = require('gulp');

var coffee = require('gulp-coffee');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');

var paths = {
  scripts: 'public/js/*.coffee'
};

gulp.task('scripts', function () {
  return gulp.src(paths.scripts)
    .pipe(coffee())
    .pipe(uglify())
    .pipe(concat('app.js'))
    .pipe(gulp.dest('public/js'));
});

gulp.task('watch', function () {
  gulp.watch(paths.scripts, ['scripts'])
});

gulp.task('default', ['scripts', 'watch']);
