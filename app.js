/*jslint node: true */
(function () {
    'use strict';
    var path = require('path');
    var app = {},
        url = require('url'),
        fs = require('fs'),
        localization = require('./modules/localization').localization;
    
    global.rootDir = path.resolve(__dirname);
    
    app = require('./application/config.js').configure(app);

    app = require('./application/routsConfig.js').configure(app);

    app = require('./application/sendingPage.js').configure(app);

    setTimeout(function () {
        app.use(function (err, req, res, next) {
            console.log('err', err);
            res.redirect('404.html');
        });
        if (!module.parent) {
            var date = new Date();
            app.listen(app.portNum);
            fs.appendFile('start-times.log', date.toISOString() + '\n', function (err) {
                if (err) {
                    throw 'error writing file: ' + err;
                }
                console.log('file written', app.portNum);
            });

        }
        console.log('started');
    }, 6000);
}());


