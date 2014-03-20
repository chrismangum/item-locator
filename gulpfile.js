var gulp = require('gulp'),
  coffee = require('gulp-coffee'),
  uglify = require('gulp-uglify'),
  concat = require('gulp-concat'),
  compass = require('gulp-compass');

var paths = {
  js: 'public/js/*.coffee',
  scss: 'public/css/scss/*.scss'
};

gulp.task('scripts', function () {
  return gulp.src(paths.js)
    .pipe(coffee())
    .pipe(uglify())
    .pipe(concat('app.js'))
    .pipe(gulp.dest('public/js'));
});

gulp.task('compass', function () {
  return gulp.src(paths.scss)
    .pipe(compass({
      style: 'compressed',
      sass: 'public/css/scss',
      css: 'public/css'
    }));
});

gulp.task('watch', function () {
  gulp.watch(paths.js, ['scripts']);
  gulp.watch(paths.scss, ['compass']);
});

gulp.task('default', ['scripts', 'compass', 'watch']);
