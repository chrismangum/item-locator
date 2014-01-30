module.exports = function(grunt) {
  require('matchdep').filter('grunt-*').forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      js: {
        files: 'public/js/app.js',
        tasks: ['uglify']
      },
      css: {
        files: 'public/css/style.css',
        tasks: ['cssmin']
      }
    },
    cssmin: {
      compress: {
        files: {
          'public/css/style.min.css': ['public/css/style.css']
        }
      }
    },
    uglify: {
      minify: {
        files: {
          'public/js/app.min.js': 'public/js/app.js'
        }
      }
    },
    jshint: {
      files: ['public/js/app.js', 'public/js/main.js'],
      options: {
        force: true,
        unused: true
      }
    },
    nodemon: {
      dev: {
        options: {
          file: 'server/app.js',
          watchedExtensions: ['js'],
          watchedFolders: ['server'],
          delayTime: 0
        }
      }
    },
    concurrent: {
      default: {
        tasks: ['nodemon:dev', 'watch'],
        options: {
          logConcurrentOutput: true
        }
      }
    }
  });
  grunt.registerTask('default', ['compile', 'concurrent:default']);
  grunt.registerTask('compile', ['cssmin:compress', 'uglify:minify']);
  grunt.registerTask('lint', ['jshint']);
};
