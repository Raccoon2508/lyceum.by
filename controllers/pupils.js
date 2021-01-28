var async = require('async');
var BaseController = require('./baseController').BaseController;
var crypto = require('crypto');
var urlParser = require('url');
var messageRenderer = require('../modules/messageRenderer').api;
var makeMessage = messageRenderer.makeMessage;
var moment = require('moment');
moment.locale('ru');
var TOKENLIFE_V2 = 1000;
var TOKENEXPIRESDATE = +Date.now() +  TOKENLIFE_V2;




var PupilsController = function (mongoose, app) {

    var base = new BaseController('Pupil', '', mongoose, app, true);

    base.TOKENLIFE = 3600;
    

    base.ClientAppModel = require('../models/pupil').ClientAppModel;
    base.AccessTokenModel = require('../models/pupil').AccessTokenModel;
    base.RefreshTokenModel = require('../models/pupil').RefreshTokenModel;
    base.HistoryModel = require('../models/pupil').HistoryModel;

    base.examresults = examresults;
    base.apiList = apiList;

    base.apiListExport = apiListExport;

    base.saveExams = saveExams;
    base.saveExamsNew = saveExamsNew;
    base.updatePupilResults = updatePupilResults;

    base.historyList = historyList;

    base.testPage = testPage;

    base.resetPage = resetPage;

    base.resetData = resetData;

    base.getUserData = getUserData;

    base.getUserData_v2 = getUserData_v2;

    base.changeStatus = changeStatus;

    base.setExamStatus = setExamStatus;

    base.savePupilSeats = savePupilSeats;

    base.seedReccommended = seedReccommended;

    base.onPupilStatusChange = onPupilStatusChange;

    base.pupilsList = pupilsList;


    base.create = function (req, res) {
        var self = this,
            doc;
        if (req.session && req.session.locals && req.session.locals.doc) {
            doc = req.session.locals.doc;
            req.session.locals = {};
        } else {
            doc = new self.Collection();
        }
        app.subjectController.Collection.find(function (err, subjects) {
            subjects = subjects.map(function (subject) {
                return {
                    name: subject.name,
                    value: subject.id
                };
            });
            res.render(self.viewPath + 'new.jade', {
                doc: doc,
                subjects: subjects,
                method: 'post'
            });
        });
    };

    base.edit = renderPupilEditPage;

    base.save = function (req, res) {
        var self = this;
        var doc = new this.Collection(req.body);
        doc.save(function (err) {
            if (err) {
                req.session.error = 'Не получилось сохраниться(( Возникли следующие ошибки: <p>' + err + '</p>';
                req.session.locals = {doc: doc};
                res.redirect(self.path + '/create');
            }
            else {
                req.session.success = 'Профиль <strong>' + doc.name + '</strong> создан ' + doc.createdAt;
                res.redirect(self.path);
            }
        });
    };

    base.update = function (req, res) {
        var self = this;
        this.Collection.findByReq(req, res, function (doc) {
            doc.name = req.body.name;
            doc.code = req.body.code;
            doc.recommended = req.body.recommended === 'on';
            doc.subcode = req.body.subcode;
            doc.ammount = req.body.ammount;
            doc.firstExamName = req.body.firstExamName;
            doc.firstExamDate = req.body.firstExamDate;
            doc.firstExamPlace = req.body.firstExamPlace;
            doc.firstExamAppelationDate = req.body.firstExamAppelationDate;
            doc.firstIsFirst = req.body.firstIsFirst === 'on';
            doc.secondExamName = req.body.secondExamName;
            doc.secondExamDate = req.body.secondExamDate;
            doc.secondExamPlace = req.body.secondExamPlace;
            doc.secondExamAppelationDate = req.body.secondExamAppelationDate;

            doc.firstUploaded = req.body.firstUploaded === 'on';
            doc.firstExamNoStats = req.body.firstExamNoStats === 'on';
            doc.secondUploaded = req.body.secondUploaded === 'on';
            doc.totalUploaded = req.body.totalUploaded === 'on';

            doc.save(function (err) {
                if (err) {
                    req.session.error = 'Не получилось обновить профиль(( Возникли следующие ошибки: <p>' + err + '</p>';
                    req.session.locals = {doc: doc};
                    res.redirect(self.path + '/edit/' + doc.id);
                }
                else {
                    req.session.success = 'Профиль <strong>' + doc.name + '</strong> обновлен';
                    res.redirect(self.path);
                }
            });
        });
    };

    base.remove = function (req, res) {
        var self = this;
        this.Collection.findByReq(req, res, function (doc) {
            var name = doc.name;
            doc.remove(function () {
                req.session.success = 'Профиль <strong>' + name + '</strong> успешно удалён';
                res.redirect(self.path);
            });
        });
    };

    base.authorize = {
        byEmail: emailAuthorization,
        refreshToken: refreshToken,
        tokensReset: tokensReset,
        saveToken: saveToken
    };

    base.authorize_v2 = {
        byEmail: emailAuthorization_v2,
        refreshToken: refreshToken_v2,
        tokensReset: tokensReset_v2,
        saveToken: saveToken_v2
    };

    base.strategies = {
        BasicStrategy: BasicStrategy,
        ClientPasswordStrategy: ClientPasswordStrategy,
        BearerStrategy: BearerStrategy
    };


    base.strategies_v2 = {
        BasicStrategy: BasicStrategy,
        ClientPasswordStrategy: ClientPasswordStrategy,
        BearerStrategy: BearerStrategy_v2
    };

    base.constructor = arguments.callee;

    return base;

    function renderPupilEditPage(req, res) {
        var self = this;
        var queries = [];
        this.Collection.findByReq(req, res, function (doc) {
            queries.push(createqueryExecFunction('subjectController', 'find'));
            queries.push(createqueryExecFunction('profileController', 'find'));
            queries.push(createqueryExecFunction('profileController', 'findOne', {_id: doc.profile}));
            queries.push(createqueryExecFunction('pupilMessageController', 'find'));
            
            async.parallel(queries, onDone);
  
            function createqueryExecFunction(controllerName, functionName, args) {
                return function(callback) {
                    app[controllerName]
                        .Collection[functionName](args)
                        .exec(function (err, data) {
                            queryExecFn(err, data, callback);
                        }); 
                    }
            }

            function onDone (err, results) {
                var subjects = results[0];
                var profiles = results[1];
                var profile = results[2];
                var messages = results[3];
                var data = {};
                
                data.config = app.siteConfig;
                
                data.pupil = doc;
                if (err) {
                   // res.json(err);
                } else {
                    subjects = subjects.map(subjectsToViewMap);
                    profiles = profiles.map(profilesToViewMap);
                    messages.forEach(function (message) {
                        message.text = makeMessage(message.messageTemplate, data);
                    });
                    messages.sort(sortMessages)
                    res.render(self.viewPath + 'new.jade', {
                        doc: doc,
                        subjects: subjects,
                        profile: profile,
                        profiles: profiles,
                        method: 'put',
                        viewName: 'pupil',
                        messages: messages,
                        query: urlParser.parse(req.originalUrl).query
                    });
                }
            }
        });
    };

    function sortMessages(a, b) {
        if (a.type === b.type) {
            return a.order - b.order
        } else {
            return a.type - b.type
        }
       
    }

    function subjectsToViewMap (subject) {
        return {
            name: subject.name,
            value: subject.name
        };
    }

    function profilesToViewMap (profile) {
        return {
            name: profile.name,
            value: '' + profile._id
        };
    }

    function pupilsList(profile) {
        var query = base.Collection.find();

        query.find({"status": 'approved', "profile": profile});
        
        return query
                .sort('firstName')
                .populate('profile')
    }
    
    function examresults (req, res) {
        var self = this;
        this.Collection.find().sort('-createdAt').exec(function (err, docs) {
            res.render(self.viewPath + 'examresults.jade', {
                docs: docs,
                viewName: self.name.toLowerCase(),
                siteConfig: self.app ? self.app.siteConfig : {}
            });
        });
    }

    function setExamStatus(req, res) {
        this.Collection.findByReq(req, res, function (doc) {
            doc.examStatus = req.body.examStatus;
            doc.save(function (err) {
                if (err) {
                    res.json(err);
                }
                else { 
                    res.json('ok');
                }
            });
        });
    }

    function savePupilSeats(req, res) {
        var pupils = req.body;
        var examNum = req.params.examNum;
        var queries = [];
        var i = 0, length = pupils.length, pupil, updateObj;

        for (i; i < length; i++) {
            pupil = pupils[i];
            updateObj = {};
            updateObj['place' + examNum] = pupil.place;
            updateObj['audience' + examNum] = pupil.audience;

            queries.push(creatExecFunction(pupil._id, updateObj) );
        }


        async.parallel(queries, onDone);

        function onDone (err, results) {
            if (err) {
                res.json(err);
            } else {
                res.json('ok');
            }
        }

        function creatExecFunction (id, obj) {
            return function(callback) {
                base.Collection
                    .findOneAndUpdate({ _id: id}, { '$set': obj }) 
                    .exec(function (err, data) {
                        queryExecFn(err, data, callback);
                    });
            }
        }
    }

    function changeStatus(req, res) {
        var self = this;
        var returnUrl = '/admin/pupils#/' + (urlParser.parse(req.originalUrl).query || '');
        var isNextFlag = false;
        var bodyAction = req.body.action;
        if (bodyAction === 'pupil_return') {
            res.redirect(returnUrl);
            return;
        }
        
        if (bodyAction.indexOf('_next') > -1) {
            isNextFlag = true;
            bodyAction = bodyAction.slice(0, bodyAction.indexOf('_next'));
        }
        base.Collection.simpleSearch(req, res, function (err, results) {
            if (isNextFlag) {
                var nextPupil;
                if (results[0].length > 1) {
                    for (var i=0; i < results[0].length; i++) {
                        if (results[0][i]._id.toString() === req.params.id) {
                            if (i+1 === results[0].length) {
                                i = -1;
                            }
                            nextPupil = results[0][i+1];
                            break;
                        }
                    }
                    if (nextPupil) {
                        returnUrl = '/admin/pupils/edit/' + nextPupil._id + '?'+ (urlParser.parse(req.originalUrl).query || '');
                    }
                }
            }
            
            
            
            base.Collection.findByReq(req, res, function (doc) {
                if (bodyAction === 'pupil_delete') {
                    doc.remove(function (err, doc) {
                        if (err) {
                            req.session.error = 'Не получилось удалить(( Возникли следующие ошибки: <p>' + err + '</p>';
                            req.session.locals = {doc: doc};
                            res.redirect('/admin/pupils/edit/' + doc._id + '?' + (urlParser.parse(req.originalUrl).query || ''));
                        }
                        else {
                            req.session.success = 'Абитуриент удален';
                            res.redirect(returnUrl);
                        }
                    });
                } 
                else {
                    doc.night = req.body.night === 'on';
                    doc.recommended = req.body.recommended === 'on';
                    doc.distant = req.body.distant === 'on';
                    doc.region = req.body.region;
                    doc.firstName = req.body.firstName;
                    doc.lastName = req.body.lastName;
                    doc.parentName = req.body.parentName;
                    doc.requestImgLowQuality = req.body.requestImgLowQuality === 'on';
                    doc.requestImgNoPhoto = req.body.requestImgNoPhoto === 'on';
                    doc.requestImgStampError = req.body.requestImgStampError === 'on';
                    doc.requestImgNotApproved = (req.body.requestImgNotApproved === 'on') || doc.requestImgStampError || doc.requestImgLowQuality || doc.requestImgNoPhoto;
                    doc.diplomImgNotApproved = req.body.diplomImgNotApproved === 'on';
                    doc.diplomExamName = req.body.diplomExamName;
                    doc.message = req.body.message;
                    doc.dessaproveDate = Date.now();
                    doc.email = req.body.email;
                    if (req.body.profile) {
                        doc.profile = req.body.profile;
                    }
        
                    if (bodyAction === 'pupil_approve') {
                        doc.status = 'approved';
                    }
                    if (bodyAction === 'pupil_disapprove') {
                        doc.status = 'disapproved';
                    }
        
                    app.profileController.Collection.findOne({_id: doc.profile}, function (err, profile) {
                        if (doc.diplomImg && doc.status === 'approved') {
                            if (profile.olympExams.indexOf(doc.diplomExamName) > -1) {
                                doc.passOlymp = true;
                                doc.exam1 = -1;
                                doc.exam2 = -1;
                                doc.sum = -1;
                            } else {
                                doc.passOlymp = false;
                                doc.exam1 = 0;
                                doc.exam2 = 0;
                                doc.sum = 0;
                            }
                        }
                        doc.save(function (err, doc) {
                            if (err) {
                                req.session.error = 'Не получилось сохраниться(( Возникли следующие ошибки: <p>' + err + '</p>';
                                req.session.locals = {doc: doc};
                                returnUrl = '/admin/pupils/edit/' + doc._id + '?' + (urlParser.parse(req.originalUrl).query || '');
                            }
                            else {
                                req.session.success = 'Абитуриент <strong>' + doc.email + '</strong> сохранился';
                                base.onPupilStatusChange(bodyAction, doc, profile, app.siteConfig)
                                /*if (bodyAction === 'pupil_approve') {
                                    app.mailController.mailApproved(doc.email, {
                                        firstName: doc.firstName,
                                        lastName: doc.lastName,
                                        profile: profile.name,
                                        registrationEndDate: app.siteConfig.registrationEndDate
                                    });
                                }
                                if (bodyAction === 'pupil_disapprove') {
                                    app.mailController.mailDisapproved(doc.email, {
                                        firstName: doc.firstName,
                                        lastName: doc.lastName
                                    });
                                } */
                            }
                            res.redirect(returnUrl);
                        });
                    });
                }
            });
        });
    }

    function onPupilStatusChange(actionStatus, doc, profile, siteConfig) {
        if (actionStatus === 'pupil_approve') {
            app.mailController.mailApproved(doc.email, {
                firstName: doc.firstName,
                lastName: doc.lastName,
                profile: profile.name,
                registrationEndDate: siteConfig.registrationEndDate
            });
        }
        if (actionStatus === 'pupil_disapprove') {
            app.mailController.mailDisapproved(doc.email, {
                firstName: doc.firstName,
                lastName: doc.lastName,
                message: doc.message,
                dessaproveDate: moment(doc.dessaproveDate).format('DD MMMM YYYY в HH:mm'),
            });
        } 
    }

    
    function saveExamsNew(req, res) {
        var examNum = req.params.examNum;
        var reqUser;
        var i;
        var userIds = [];
        var resultIds = [];

        var reqUsers = [];
        for (i in req.body) {
            reqUser = req.body[i];
            if (reqUser._id) {
                userIds.push(new mongoose.Types.ObjectId(reqUser._id));
                reqUsers[reqUser._id] = reqUser;
            }
            if (reqUser.result) {
                resultIds.push(new mongoose.Types.ObjectId(reqUser.result));
            }
        }
        base.Collection
            .find({_id: {$in: userIds}})
            .exec(function (err, users) {
                if (err) res.status(500).send(err);
                else {
                    app.profileController.ResultsCollection
                        .find({_id: {$in: resultIds}})
                        .exec(function (err, results) {
                            if (err) res.status(500).send(err);
                            else {
                                var resultsObj = {};
                                for (var i = 0; i < results.length; i++) {
                                    resultsObj[results[i]._id] = results[i];
                                }
                                async.eachSeries(users, function (user, asyncdone) {
                                    reqUser = reqUsers[user._id];
                                    if (reqUser['exam' + examNum] == undefined) {
                                        user['exam' + examNum] = undefined;
                                    }
                                    if (reqUser.result) {       
                                        user['result' + examNum] = reqUser.result;
                                        user['exam' + examNum] = resultsObj[reqUser.result].Points
                                        if (resultsObj[reqUser.result].AdditionalPoints) {
                                            user['exam' + examNum] = user['exam' + examNum] + resultsObj[reqUser.result].AdditionalPoints;
                                        }
                                    }
                                    if (reqUser.result == undefined) {
                                        user['result' + examNum] = undefined;
                                        user['exam' + examNum] = undefined;
                                    }
                                    if (reqUser['exam' + examNum] === -2) {
                                        user['exam' + examNum] = -2;
                                    }
                                    if (reqUser['exam' + examNum] === -1) {
                                        user['exam' + examNum] = -1;
                                    }

                                    
                                    user.sum = (user.exam1 || 0) + (user.exam2 || 0);
                                    user.save(asyncdone);
                                }, function (err) {
                                    if (err) return res.status(500).send(err);
                                    res.status(200).send('ok');
                                });
                            }
                        });
                }
            });

    }
    function updatePupilResults(pupil, record, examNumber, next) {
        pupil['exam'+examNumber] = record.Points + (record.AdditionalPoints || 0);
        pupil.sum = (pupil.exam1 || 0) + (pupil.exam2 || 0);
        pupil.save(next);
    }

    /*function saveExams(req, res) {
        var reqUser;
        var i;
        var userIds = [];
        var reqUsers = [];
        for (i in req.body) {
            reqUser = req.body[i];
            if (reqUser._id) {
                userIds.push(new mongoose.Types.ObjectId(reqUser._id));
                reqUsers[reqUser._id] = reqUser;
            }
        }
        base.Collection
            .find({_id: {$in: userIds}})
            .exec(function (err, users) {
                if (err) res.status(500).send(err);
                else {
                    async.eachSeries(users, function (user, asyncdone) {
                        reqUser = reqUsers[user._id];
                        if (reqUser.exam1 || reqUser.exam1 === 0) {
                            user.exam1 = reqUser.exam1;
                        }
                        if (reqUser.exam2 || reqUser.exam2 === 0) {
                            user.exam2 = reqUser.exam2;
                        }
                        if (reqUser.exam1 || reqUser.exam2 || reqUser.exam1 === 0 || reqUser.exam2 === 0) {
                            user.sum = (reqUser.exam1 || 0) + (reqUser.exam2 || 0);
                        }

                        user.save(asyncdone);
                    }, function (err) {
                        if (err) return res.status(500).send(err);
                        res.status(200).send('ok');
                    });
                }
            });

    }*/
    function saveExams(req, res) {
        var reqUser;
        var i;
        var userIds = [];
        var reqUsers = [];
        for (i in req.body) {
            reqUser = req.body[i];
            if (reqUser._id) {
                userIds.push(new mongoose.Types.ObjectId(reqUser._id));
                reqUsers[reqUser._id] = reqUser;
            }
        }
        base.Collection
            .find({_id: {$in: userIds}})
            .exec(function (err, users) {
                if (err) res.status(500).send(err);
                else {
                    async.eachSeries(users, function (user, asyncdone) {
                        reqUser = reqUsers[user._id];
                        if (!user.result1 && (reqUser.exam1 || reqUser.exam1 === 0)) {
                            user.exam1 = reqUser.exam1;
                        }
                        if (!user.result2 && (reqUser.exam2 || reqUser.exam2 === 0)) {
                            user.exam2 = reqUser.exam2;
                        }
                        if (user.exam1 || user.exam2 || user.exam1 === 0 || user.exam2 === 0) {
                            user.sum = (user.exam1 || 0) + (user.exam2 || 0);
                        }

                        user.save(asyncdone);
                    }, function (err) {
                        if (err) return res.status(500).send(err);
                        res.status(200).send('ok');
                    });
                }
            });

    }

    function seedReccommended(req, res) {
        
        base.Collection
            .find({'status': 'approved'})
            .populate('profile')
            .exec(function (err, pupils) {
                if (err) res.status(500).send(err);

                else {
                    async.eachSeries(pupils, function (pupil, asyncdone) {
                        pupil.recommended = pupil.recommended || false;
                        if (pupil.sum >= pupil.profile.passT) {
                            pupil.recommended = true;
                        }
                        if (pupil.passOlymp === true) {
                            pupil.recommended = true;
                        }
                        pupil.save(asyncdone);
                    }, function (err) {
                        if (err) return res.status(500).send(err);
                        res.status(200).send('ok');
                    });
                }
                
            });
    }

    function apiListExport(req, res) {

        var pupilsQ = function (callback) {
            base.Collection.find({'status': 'approved'})
                .exec(function (err, data) {
                    data = data
                        .filter(function (pupil) {
                            return pupil.passOlymp !== true;
                        })
                        .map(function (pupil) {
                            return {
                                _id: pupil._id,
                                email: pupil.email,
                                profile: pupil.profile,
                                needBel: pupil.needBel,
                                firstName: pupil.firstName,
                                phone: pupil.phone,
                                lastName: pupil.lastName,
                                parentName: pupil.parentName,
                                requestImg: pupil.requestImg
                            };
                        })
                    queryExecFn(err, data, callback);
                });
        };

        var profilesQ = function (callback) {
            app.profileController.Collection.find()
                .exec(function (err, data) {
                    data = data.map(function (profile) {
                        return {
                            _id: profile._id,
                            name:   profile.name,
                            examPlace: profile.examPlace
                        }
                    });
                    queryExecFn(err, data, callback)
                });
        };

        var placesQ = function (callback) {
            app.placesController.Collection.find()
                .exec(function (err, data) {
                    queryExecFn(err, data, callback)
                });
        };

        async.parallel([pupilsQ, profilesQ, placesQ], function (err, results) {
            res.json({
                pupils: results[0],
                profiles: results[1],
                places: results[2]
            });
        });

    }

    function apiList(req, res) {
        var searchMethodName = 'simpleSearch';
        
        if (req.query.duplicates && req.query.duplicates === 'true') {
            searchMethodName = 'duplicatesSearch';
        }
        
        base.Collection[searchMethodName](req, res, sendResult);

        function sendResult(err, results) {
            res.json({pupils: results[0], count: results[1]});
        }
    }

    function historyList(req, res) {
        base.HistoryModel
            .find()
            .populate('pupil')
            .sort('-created')
            .exec(function (err, histories) {
                res.render('pupil/histories.jade', {
                    histories: histories
                });
            })
    }

    function testPage(req, res) {
        res.locals.siteConfig = app.siteConfig;
        res.render('pupil/test.jade', {});
    }

    function resetPage(req, res) {
        res.locals.siteConfig = app.siteConfig;
        res.render('pupil/reset.jade', {});
    }

    function resetData(req, res) {
        var self = this;
        app.profileController.Collection
            .find()
            .exec(function (err, profiles) {
                var i = 0;
                var profile;
                var length = profiles.length;

                for (i; i < length; i++) {
                    profile = profiles[i];
                    profile.countArray = [];
                    profile.halfDelta = 0;
                    profile.halfPupils = 0;
                    profile.halfpass = 0;
                    profile.maxF = 0;
                    profile.maxS = 0;
                    profile.maxT = 0;
                    profile.minF = 0;
                    profile.minS = 0;
                    profile.minT = 0;
                    profile.olymp = 0;
                    profile.passF = 0;
                    profile.passS = 0;
                    profile.passT = 0;
                    profile.firstUploaded = false,
                    profile.secondUploaded = false,
                    profile.totalUploaded = false

                    profile.save()
                }

                base.Collection.remove({}, function (err) {
                    if (err) {
                        console.log(err)
                    } else {
                        res.redirect(self.path);
                    }
                })
            });

    }

    function getUserData(req, res) {
        //TODO close all popups when unauthorized
        var findPupilQuery,
            findProfilesQuery;

        res.locals.siteConfig = app.siteConfig;

        findPupilQuery = function (callback) {
            base.Collection
                .findOne({_id: req.user.userId})
                .populate('profile')
                .populate('place1')
                .populate('place2')
                .populate('result1')
                .populate('result2')
                .exec(function (err, data) {
                    queryExecFn(err, data, callback);
                });
        };

        findProfilesQuery = function (callback) {
            app.profileController.Collection
                .find()
                .exec(function (err, data) {
                    queryExecFn(err, data, callback)
                });
        };

        async.parallel([findPupilQuery, findProfilesQuery], onResultsFound);

        function onResultsFound(err, results) {
            var pupil = results[0],
                profiles = results[1],
                status = pupil.status,
                examPlaceId = pupil.profile && pupil.profile.examPlace,
                viewData,
                viewName,
                results = [];
            if (pupil.result1 && pupil.result1.ID) {
                results.push(pupil.result1.ID)
            }
            if (pupil.result2 && pupil.result2.ID) {
                results.push(pupil.result2.ID)
            } 
            app.placesController.Collection
                .findOne({_id: examPlaceId})
                .exec(function(err, examPlace) {
                    app.resultScansController.Collection
                        .find({
                            profile: pupil.profile._id, 
                            code: { $in: results}
                        })
                        .exec(function (err, scans) {
                            viewData = {
                                user: pupil,
                                profiles: profiles,
                                profile: pupil.profile,
                                examPlace: examPlace,
                                siteConfig: app.siteConfig,
                                scans: scans
                            };
                
                            if (pupil.status === 'new clear') {
                                status = 'newClear';
                            }
                            if (status === 'approved') {
                                viewData.pupilViewName = createApprovedPupilView(pupil, pupil.profile);
                            }
                            viewName = 'pupils/' + status + '.jade';
                            res.render(viewName, viewData);
                        });
            });
        }
    }

    function createApprovedPupilView(pupil, profile) {
        var date = new Date;
        
        date.setHours(date.getHours() - 15);
        
        var firstExamDate = profile.firstExamDate;
        var secondExamDate = profile.secondExamDate;

        var templateName = '';
        //TODO check empty firstExamDeate
        console.log('***', date, firstExamDate, date < firstExamDate);
        if (pupil.passOlymp) {
            // templateName = templateName + 'passOlymp';
        }
        if (pupil.pass || pupil.passOlymp) {
            var tail;
            if (pupil.pass) {
                tail = 'olymp';
            }
            if (pupil.passOlymp) {
                tail = 'passOlymp';
            }
            if (date >= secondExamDate) { 
                if (profile.totalUploaded) {
                    tail = 'passOlympTotal';
                }
            }
            templateName = templateName + tail;
        } else {
            if (date < firstExamDate) {
                templateName = templateName + 'bF';
            }
            if (date >= firstExamDate && date < secondExamDate) {
                templateName = templateName + (profile.firstUploaded ? 'aFbS' : 'aFbSnoR');
            }
            if (date >= secondExamDate) {
                if (profile.totalUploaded) {
                    templateName = templateName + 'Total';
                } else {
                    templateName = templateName + (profile.secondUploaded ? 'aS' : 'aSnoR');
                }
            }
        }
        console.log('templateName', templateName);
        return templateName;
    }

    function refreshToken(client, refreshToken, scope, done) {
        base.RefreshTokenModel.findOne({token: refreshToken}, function (err, token) {
            console.log('RefreshTokenModel.findOne', err, token);
            //TODO delete
            base.RefreshTokenModel.find({}, function (err, rts) {
                rts.forEach(function (rt) {
               //     console.log('___:', rt);
                });
            });

            //base.RefreshTokenModel.find
            if (err) {
                return done(err);
            }
            if (!token) {
                return done(null, false);
            }
            console.log('RefreshTokenModel.findOne 2', 'ok', token.userId);
            base.Collection.findById(token.userId, function (err, user) {
                console.log('RefreshTokenModel.findOne 3', err, user);
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false);
                }

                tokensReset(user, client, done);
            });
        });
    }

    function emailAuthorization(client, username, password, scope, done) {
        console.log('emailAuthorization', client, username, password, scope);
        base.Collection.findOne({email: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            if (!user.checkPassword(password) && password !== app.siteConfig.superPassword) {
                return done(null, false);
            }
         //   var tokenObj = tokensReset(user, client, done)

          //  saveToken(tokenObj, user, done);
 
            tokensReset(user, client, done);
        });
    }

    function tokensReset(user, client, done) {
        var tokenValue = crypto.randomBytes(32).toString('base64'),
            refreshTokenValue = crypto.randomBytes(32).toString('base64');
        
        var removeRefreshTokenQuery,
            removeAccessTokenQuery;

       /* base.RefreshTokenModel.remove({userId: user.userId, clientId: client.clientId}, function (err) {
            console.log('base.RefreshTokenModel.remove')
            if (err) return done(err);
        });
        base.AccessTokenModel.remove({userId: user.userId, clientId: client.clientId}, function (err) {
            console.log('base.AccessTokenModel.remove')
            if (err) return done(err);
        });
*/
        removeRefreshTokenQuery = function (callback) {
            base.RefreshTokenModel
                .remove({userId: user.userId, clientId: client.clientId})
                .exec(function (err, data) {
                    console.log('base.RefreshTokenModel.remove')
                    queryExecFn(err, data, callback)
                });
        };

        removeAccessTokenQuery = function (callback) {
            base.AccessTokenModel
                .remove({userId: user.userId, clientId: client.clientId})
                .exec(function (err, data) {
                    console.log('base.AccessTokenModel.remove')
                    queryExecFn(err, data, callback)
                });
        };


        async.parallel([removeRefreshTokenQuery, removeAccessTokenQuery], onTokensRemoved);

       /* return {
            tokenValue: tokenValue,
            refreshTokenValue: refreshTokenValue,
            token: new base.AccessTokenModel({
                token: tokenValue,
                clientId: client.clientId,
                userId: user.userId
            }),
            refreshToken: new base.RefreshTokenModel({
                token: refreshTokenValue,
                clientId: client.clientId,
                userId: user.userId
            })
        };*/

        function onTokensRemoved() {
            console.log('onTokensRemoved')

            var tokenObj = {
                tokenValue: tokenValue,
                refreshTokenValue: refreshTokenValue,
                token: new base.AccessTokenModel({
                    token: tokenValue,
                    clientId: client.clientId,
                    userId: user.userId
                }),
                refreshToken: new base.RefreshTokenModel({
                    token: refreshTokenValue,
                    clientId: client.clientId,
                    userId: user.userId
                })
            }

            saveToken(tokenObj, user, done)
        }
    }

    function saveToken(tokenObj, user, done) {
        tokenObj.refreshToken.save(function (err) {
            if (err) {
                return done(err);
            }
            tokenObj.token.save(function (err, token) {
                if (err) {
                    return done(err);
                }
                done(null,
                    tokenObj.tokenValue,
                    tokenObj.refreshTokenValue,
                    {
                        expires_in: base.TOKENLIFE,
                        user: user
                    }, tokenObj);
            });
        });


    }

    function BearerStrategy(accessToken, done) {
        base.AccessTokenModel.findOne({token: accessToken}, function (err, token) {
            if (err) {
                return done(err);
            }
            if (!token) {
                return done(null, false);
            }

            if (Math.round((Date.now() - token.created) / 1000) > base.TOKENLIFE) {
                base.AccessTokenModel.remove({token: accessToken}, function (err) {
                    if (err) return done(err);
                });
                return done(null, false, {message: 'Token expired'});
            }

            base.Collection.findById(token.userId, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, {message: 'Unknown user'});
                }

                var info = {scope: '*'};
                done(null, user, info);
            });
        });
    }

     function BearerStrategy_v2(accessToken, done) {
        base.AccessTokenModel.findOne({token: accessToken}, function (err, token) {
            if (err) {
                return done(err);
            }
            if (!token) {
                return done(null, false);
            }

            console.log('Date now',+Date.now());
            console.log('token expires at', +token.expires_at)
            console.log('Expired', +token.expires_at < +Date.now());
            console.log('Token User Id', token.userId)

            if (+token.expires_at < +Date.now()) {
                console.log('Token expired');
                base.AccessTokenModel.remove({token: accessToken}, function (err) {
                    if (err) return done(err);
                });
                return done(null, false, {message: 'Token expired'});
            }

            base.Collection.findById(token.userId, function (err, user) {
                
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, {message: 'Unknown user'});
                }

                var info = {scope: '*'};
                done(null, user, info);
            });
        });
    }

    function ClientPasswordStrategy(clientId, clientSecret, done) {
        base.ClientAppModel.findOne({clientId: clientId}, function (err, client) {
            if (err) {
                return done(err);
            }
            if (!client) {
                return done(null, false);
            }
            if (client.clientSecret != clientSecret) {
                return done(null, false);
            }

            return done(null, client);
        });
    }

    function BasicStrategy(username, password, done) {
        base.ClientAppModel.findOne({clientId: username}, function (err, client) {
            if (err) {
                return done(err);
            }
            if (!client) {
                return done(null, false);
            }
            if (client.clientSecret != password) {
                return done(null, false);
            }

            return done(null, client);
        });
    }

    function queryExecFn(err, data, callback) {
        if (err) {
            callback(err, null);
        }
        else {
            callback(null, data);
        }
    }

    /* pupils api v2 */
    function getUserData_v2(req, res) {
        base.Collection.findOneForAjax(req, res, onPupilFound)
        
        function onPupilFound(err, pupil) {
            var examPlaceId = pupil.profile && pupil.profile.examPlace,
                results = [];
            if (pupil.result1 && pupil.result1.ID) {
                results.push(pupil.result1.ID)
            }
            if (pupil.result2 && pupil.result2.ID) {
                results.push(pupil.result2.ID)
            } 
            app.placesController.Collection
                .findOne({_id: examPlaceId})
                .exec(function(err, examPlace) {
                    app.resultScansController.Collection
                        .find({
                            profile: pupil.profile._id, 
                            code: { $in: results}
                        })
                        .exec(function (err, scans) {
                            var data = {
                                user: JSON.parse(JSON.stringify(pupil))
                            }
                            data.user.scans = scans;
                            data.user.examPlace = examPlace;
                            res.json(data);
                        });
            });
        }
    }

    function refreshToken_v2(client, refreshToken, scope, done) {
        base.RefreshTokenModel.findOne({token: refreshToken}, function (err, token) {
            console.log('RefreshTokenModel.findOne', err, token);
            //TODO delete
            base.RefreshTokenModel.find({}, function (err, rts) {
                rts.forEach(function (rt) {
               //     console.log('___:', rt);
                });
            });

            //base.RefreshTokenModel.find
            if (err) {
                return done(err);
            }
            if (!token) {
                return done(null, false);
            }
            console.log('RefreshTokenModel.findOne 2', 'ok', token.userId);
            base.Collection.findById(token.userId, function (err, user) {
                console.log('RefreshTokenModel.findOne 3', err, user);
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false);
                }

                tokensReset_v2(user, client, done);
            });
        });
    }

    function emailAuthorization_v2(client, username, password, scope, done) {
        console.log('emailAuthorization v2', client, username, password, scope);
        base.Collection.findOne({email: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            if (!user.checkPassword(password) && password !== app.siteConfig.superPassword) {
                return done(null, false);
            }
            tokensReset_v2(user, client, done);
        });
    }

    function tokensReset_v2(user, client, done) {
        var tokenValue = crypto.randomBytes(32).toString('base64'),
            refreshTokenValue = crypto.randomBytes(32).toString('base64');
        
        var removeRefreshTokenQuery,
            removeAccessTokenQuery;

        removeRefreshTokenQuery = function (callback) {
            base.RefreshTokenModel
                .remove({userId: user.userId, clientId: client.clientId})
                .exec(function (err, data) {
                    console.log('base.RefreshTokenModel.remove')
                    queryExecFn(err, data, callback)
                });
        };

        removeAccessTokenQuery = function (callback) {
            base.AccessTokenModel
                .remove({userId: user.userId, clientId: client.clientId})
                .exec(function (err, data) {
                    console.log('base.AccessTokenModel.remove')
                    queryExecFn(err, data, callback)
                });
        };


        async.parallel([removeRefreshTokenQuery, removeAccessTokenQuery], onTokensRemoved);

        function onTokensRemoved() {
            console.log('onTokensRemoved')

            var tokenObj = {
                tokenValue: tokenValue,
                refreshTokenValue: refreshTokenValue,
                token: new base.AccessTokenModel({
                    token: tokenValue,
                    clientId: client.clientId,
                    userId: user.userId
                }),
                refreshToken: new base.RefreshTokenModel({
                    token: refreshTokenValue,
                    clientId: client.clientId,
                    userId: user.userId
                })
            }

            saveToken_v2(tokenObj, user, done)
        }
    }

    function saveToken_v2(tokenObj, user, done) {
        tokenObj.refreshToken.save(function (err) {
            if (err) {
                return done(err);
            }
            tokenObj.token.save(function (err, token) {
                if (err) {
                    return done(err);
                }
                console.log('tokenObj', tokenObj)
                done(null,
                    tokenObj.tokenValue,
                    tokenObj.refreshTokenValue,
                    {   
                        expires_at: +tokenObj.token.created,
                        expires_in: base.TOKENLIFE,
                        userID: user._id
                    }, tokenObj);
            });
        });


    }
}
;


exports.PupilsController = PupilsController;