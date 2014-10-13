var gulp = require('gulp'),
  plugin = require('gulp-load-plugins')({
    camelize: true
  }),
  wiredep = require('wiredep').stream;

var paths = {
  clientJS: 'public/js/*.coffee',
  serverJS: 'server/*.coffee',
  scss: 'public/css/*.scss',
  jade: 'views/*.jade',
  index: 'public/index.jade'
};

gulp.task('scripts', function () {
  gulp.src(paths.clientJS)
    .pipe(plugin.coffee())
    .pipe(gulp.dest('public/js'));
  gulp.src(paths.serverJS)
    .pipe(plugin.coffee())
    .pipe(gulp.dest('server'));
});

gulp.task('css', ['iconfont'], function () {
  gulp.src(paths.scss)
    .pipe(plugin.sass())
    .pipe(plugin.autoprefixer("last 2 versions"))
    .pipe(plugin.minifyCss())
    .pipe(gulp.dest('public/css'))
});

gulp.task('iconfont', function(){
  gulp.src(['public/fonts/svg/*.svg'])
    .pipe(plugin.iconfontCss({
      fontName: 'icon-font',
      path: 'public/fonts/_icon-font.scss',
      targetPath: '../../public/css/_icon-font.scss',
      fontPath: '../../../fonts/'
    }))
    .pipe(plugin.iconfont({
      fontName: 'icon-font',
      normalize: true
    }))
    .pipe(gulp.dest('public/fonts/'))
});

gulp.task('jade', function () {
  gulp.src(paths.jade)
    .pipe(plugin.jade({
      pretty: true
    }))
    .pipe(gulp.dest('public/'));
});

gulp.task('wiredep', function () {
  gulp.src(paths.index)
    .pipe(plugin.jade({
      pretty: true
    }))
    .pipe(wiredep({
      fileTypes: {
        html: {
          replace: {
            js: '<script src="/{{filePath}}"></script>'
          }
        }
      }
    }))
    .pipe(gulp.dest('./public'));
});

gulp.task('nodemon', function () {
  plugin.nodemon({
    script: 'server/app.js',
    ext: 'coffee',
    ignore: ['public/**', 'node_modules/**']
  });
});

gulp.task('watch', function () {
  gulp.watch(paths.js, ['scripts']);
  gulp.watch(paths.scss, ['css']);
  gulp.watch(paths.jade, ['jade']);
  gulp.watch(paths.index, ['wiredep']);
});

gulp.task('views', ['jade', 'wiredep']);
gulp.task('default', ['scripts', 'views', 'css', 'watch', 'nodemon']);
gulp.task('heroku:development', ['scripts', 'views', 'css']);
