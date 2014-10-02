module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        run: {
            test: {
                exec: './node_modules/.bin/mocha --recursive tests/'
            },

            'test-cover': {
                exec: './node_modules/.bin/istanbul cover node_modules/mocha/bin/_mocha -- --reporter min --recursive tests/'
            },

            'report-cover': {
                exec: './node_modules/.bin/istanbul report html'
            },

            'demo-shapes': {
                exec: './node_modules/.bin/nodemon demos/shapes/app.js'
            }
        },

        watch: {
            test: {
                files: ['lib/**/*.js', 'tests/**/*.js'],
                tasks: ['run:test']
            },

            'test-cover': {
                files: ['lib/**/*.js', 'tests/**/*.js'],
                tasks: ['run:test', 'run:test-cover', 'run:report-cover']
            }
        }
    });

    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('devtest', [
        'run:test',
        'run:test-cover', 
        'run:report-cover', 
        'watch:test-cover'
    ]);
};
