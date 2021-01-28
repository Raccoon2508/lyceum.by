const m = require('gm');

module.exports = function (app) {
    'use strict';
    var BasicStrategy = require('passport-http').BasicStrategy;
    var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;
    var BearerStrategy = require('passport-http-bearer').Strategy;

    return passportStrategies_v2;

    function passportStrategies(passport) {
        console.log('Pasport is working')
        passport.use(new BasicStrategy(
            function (username, password, done)  {
                app.pupilsController.strategies.BasicStrategy(username, password, done)
            }));

        passport.use(new ClientPasswordStrategy(
            function (clientId, clientSecret, done) {
                app.pupilsController.strategies.ClientPasswordStrategy(clientId, clientSecret, done)
            }));

        passport.use(new BearerStrategy(
            function (accessToken, done) {
                app.pupilsController.strategies.BearerStrategy(accessToken, done);
            }
        ));
    }

    function passportStrategies_v2(passport) {
        console.log('Pasport v2 is working');
        passport.use(new BasicStrategy(
            function (username, password, done)  {
                app.pupilsController.strategies_v2.BasicStrategy(username, password, done)
            }));

        passport.use(new ClientPasswordStrategy(
            function (clientId, clientSecret, done) {
                app.pupilsController.strategies_v2.ClientPasswordStrategy(clientId, clientSecret, done)
            }));


        passport.use(new BearerStrategy(
            function (accessToken, done) {
                app.pupilsController.strategies_v2.BearerStrategy(accessToken, done);
            }
        ));
       
    }
};

