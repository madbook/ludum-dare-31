module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-react');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  
  var lessFiles = {
    "build/app.css": "app.less",
  };

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    react: {
      combined_file_output: {
        files: {
          'build/app.js': [
            'sound-effect-manager-shim.js',
            'node_modules/sound-effect-manager/sound-effect-manager.js',
            'app.jsx',
          ],
        },
      },
    },
    less: {
      development: {
        files: lessFiles,
      },
      production: {
        files: lessFiles,
        option: {
          cleancss: true,
        },
      },
    },
    watch: {
      main: {
        files: ['*.jsx', '*.less'],
        tasks: ['default'],
      },
    },
  });

  grunt.registerTask('default', ['react', 'less']);
};
