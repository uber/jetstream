var exec = require('child_process').exec;

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        run: {
            test: {
                exec: './node_modules/.bin/cached-tape test/index.js | ./node_modules/.bin/tap-spec'
            },

            'test-cover': {
                exec: './node_modules/.bin/istanbul cover ./node_modules/.bin/cached-tape test/index.js'
            },

            'report-cover': {
                exec: './node_modules/.bin/istanbul report html'
            },

            'open-cover': {
                exec: './node_modules/.bin/opn ./coverage/index.html'
            },

            'demo-shapes': {
                exec: './node_modules/.bin/nodemon demos/shapes/app.js'
            }
        },

        watch: {
            test: {
                files: ['lib/**/*.js', 'test/**/*.js'],
                tasks: ['run:test']
            },

            'test-cover': {
                files: ['lib/**/*.js', 'test/**/*.js'],
                tasks: ['run:test', 'run:test-cover', 'run:report-cover']
            }
        }
    });

    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('test', ['run:test']);
    grunt.registerTask('test:file', function(file) {
        var done = this.async();
        var cmd = './node_modules/.bin/cached-tape ' + file + ' | ./node_modules/.bin/tap-spec';
        exec(cmd, function(err, stdout, stderr) {
            if (stdout) {
                process.stdout.write(stdout);
            }
            if (stderr) {
                process.stderr.write(stderr);
            }
            if (err) {
                done(false);
            } else {
                done();
            }
        });
    });

    grunt.registerTask('devtest', [
        'run:test',
        'run:test-cover', 
        'run:report-cover', 
        'watch:test-cover'
    ]);
};
