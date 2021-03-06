var fs = require('fs');
var async = require('async');
var csvParse = require('csv-parse');
var moment = require('moment');
moment.locale('ru');

var BaseController = require('./baseController').BaseController;

var ProfileController = function (mongoose, app) {

    var base = new BaseController('Profiles', '', mongoose, app, true);
    var resultsModel = require('../models/examResults');
    
    resultsModel.define(mongoose, function(){
        base.ResultsCollection = mongoose.model('ExamResults');
        base.ExamFilesCollection = mongoose.model('ExamFiles');
    });

    base.list = list;
    base.examresultsList = examresultsList;
    base.create = create;
    base.edit = edit;
    base.save = save;
    base.update = update;
    base.remove = remove;
    
    base.results = {
        resultsList: resultsList,
        upload: resultsUpload,
        uploadScans: scansUpload,
        deleteScan: deleteScan,
        assign: resultsAssign,
        getResults: getResults,
        addPoints: addPoints
    };
    
    base.constructor = arguments.callee;

    return base;

    function resultsAssign(req, res) {
        base.Collection.findByReq(req, res, function (profile) {
            res.render(base.viewPath + 'resultsAssign.jade',{
                id: req.params.id,
                examNumber: req.params.examNumber,
                profile: profile,
                viewName: 'resultsAssign'
            });
        });
    }

    function getResults(req, res) {
        base.ResultsCollection
            .find({profile: req.params.id, examNumber: req.params.examNumber})
            .sort('ID')
            .exec(function(err, docs){
                res.json(docs);
            });
    }

    function resultsList(req, res){
        base.Collection.findByReq(req, res, function (profile) {
            base.ResultsCollection
                .find({profile: req.params.id, examNumber: req.params.examNumber})
                .sort('ID')
                .exec(function(err, docs){
                    async.eachSeries(docs, function (doc, asyncdone) { 
                        app.resultScansController.Collection
                            .find({profile: req.params.id, examNum: req.params.examNumber, code: doc.ID})
                            .exec(function (err, scans) {
                                doc.scans = scans;
                                asyncdone();
                            })          
                    }, function (err) {
                        res.render(base.viewPath + 'resultsList.jade',{
                            id: req.params.id,
                            examNumber: req.params.examNumber,
                            docs: docs,
                            profile: profile
                        });
                    })  
                });
        }); 
    }

    function deleteScan(req, res) {
        var resultId = req.params.resultId;
        var examNumber = req.params.examNumber;

        base.ResultsCollection
            .findOne({_id: resultId})
            .populate('image')
            .exec(function(err, result) {
                if (err) {
                    req.session.error = 'Что-то пошло не так при поиске результата!';
                    res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + examNumber);
                } else {
                    if (result.image && fs.existsSync("./public/files/" + result.image.name)) {
                        fs.unlinkSync("./public/files/" + result.image.name);
                    } 
                    
                    result.image = undefined;
                    result.save(function(err, savedResult) {
                        if (err) {
                            req.session.error = 'Что-то пошло не так при пересохранении результата!';
                        } else {
                            req.session.success = 'Всё хорошо. Скан удален';
                        }
                        res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + examNumber);
                    })
                    
                }
            });
    }
    
    function scansUpload(req, res) {
        if (validateResultsScanUploadForm(req, res)) {
            res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + req.params.examNumber);
            return;
        }
        var scanFiles = {},
            filesArray = req.files.resultScans,
            newFile,
            examNumber = req.params.examNumber,
            resultIDs =[],
            resultID = req.body.resultScansStartNumber,
            imageIds = [];

        if (filesArray.size && filesArray.name) {
            filesArray = [filesArray];
        }
        for(var i = 0; i < filesArray.length; i++){         
            newFile = {
                originalFilename: filesArray[i].originalFilename,
                path: filesArray[i].path,
                name: 'scan_' + moment().format('YYYY_MM_DD_HH_mm_ss')+ filesArray[i].originalFilename, 
                examNumber: examNumber, 
                profileId: req.params.id
            };
            scanFiles[resultID] = newFile;
            resultIDs.push(resultID);
            resultID++;
        }

       /* async.each(scanFiles, function (scanFile, asyncdone) { 
            console.log(scanFile);
            processScanFile(scanFile)
                .then(function(recognitionResult) {
                    console.log('recognitionResult', recognitionResult)
                    scanFile.ID = recognitionResult;
                    scanFile.isTemp = true;

                    const image = new base.ExamFilesCollection(scanFile);
                    image.save(function(err, image) {
                        imageIds.push(image._id)
                        asyncdone()
                    });
                });
        }, function() {
            req.session.success = 'Всё хорошо. Сканы загрузились и сохранились';
            res.redirect('/admin/pupils/profiles/results/tempImages/' + req.params.id + '/' + examNumber + "?images=" + JSON.stringify(imageIds));
            console.log('DONE')
        });

*/
        base.ResultsCollection
            .find({ID: {$in: resultIDs}}) //TODO check examnumber adn profile
            .populate('image')
            .exec(function(err, results) {
                if (results.length === 0) {
                    req.session.error = 'Не нашлось ни одного результата с подходящим номером!';
                    res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + examNumber);
                    return;
                }
                if (results.length > 0) {
                    async.each(results, function (result, asyncdone) { 
                        var requestImg = scanFiles[result.ID];
                        var image = new base.ExamFilesCollection(requestImg)

                        if (result.image && fs.existsSync("./public/files/" + result.image.name)) {

                            fs.unlinkSync("./public/files/" + result.image.name);
                        } 
                        
                        saveScanFileSync(requestImg, function(){
                            image.save(function (err, savedImage) { 
                                result.image = savedImage._id;
                                result.save(asyncdone)
                            });
                        });

                        
                    }, function(err, result){
                        req.session.success = 'Всё хорошо. Сканы загрузились и сохранились';
                        res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + examNumber);
                        console.log('DONE')
                    })
                }
            })
    }

    function saveScanFileSync(requestImg, next) {
        var data = fs.readFileSync(requestImg.path)
        
        fs.writeFileSync('./public/files/' + requestImg.name, data)
        fs.unlinkSync(requestImg.path)
        next();
    }

    function validateResultsScanUploadForm(req, res) {
        var hasErrors = false;
        if (req.files.resultScans.size === 0) {
            req.session.error = 'Не выбран ни один файл со сканом!';
            hasErrors = true;            
        }
        if (!req.body.resultScansStartNumber) {
            req.session.error = 'Нужно указать номер!';
            hasErrors = true;            
        }
        return hasErrors;
    }

    function resultsUpload(req, res){
        var fileData = '';
            
        fs.createReadStream(req.files.csvfile.path)
            .on('data', function(data){ 
                fileData += data;
            })
            .on('end', function(){
                fs.unlinkSync(req.files.csvfile.path);

                csvParse(fileData, {columns: true}, function(err, records) {
                    saveResults(req, res, records)
                })
            });
    }

    function saveResults(req, res, records, next) {
        var examNumber = req.params.examNumber;
        var profileId = req.params.id;
        async.eachSeries(records, function (record, asyncdone) {
            base.ResultsCollection.findByGreatCamID(record.ID, examNumber, profileId, function(err, result) {
                if (result) {
                    record.AdditionalPoints = result.AdditionalPoints;
                    updateExistingResult(result, record, req.params.id, examNumber, asyncdone)
                } else {
                    base.ResultsCollection.saveNewResult(record, req.params.id, examNumber, asyncdone)  
                }
            })
        }, function(err) {
            onAsignResultsComplete(req, res, err)
        });
    }

    function updateExistingResult(result, record, profile, examNumber, next){
        app.pupilsController.Collection.findByResultAsigned(result._id, examNumber, function(err, pupil){
            if (err) {
                next(err, pupil);
                return;
            }
            if (pupil) {
                app.pupilsController.updatePupilResults(pupil, record, examNumber, function(err, doc){
                    if (err) {
                        next(err, doc)
                    } else {
                        base.ResultsCollection.updateResult(result, record, examNumber, profile, next)
                    }
                })
            } else {
                base.ResultsCollection.updateResult(result, record, examNumber, profile, next)
            }
       })
    }

    function onAsignResultsComplete(req, res, err) {
        if (err) {
            req.session.error = 'Не получилось сохраниться(( Возникли следующие ошибки: <p>' + err + '</p>';
        } else {
            req.session.success = 'Всё хорошо. Данные загрузились и сохранились';
        }
        res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + req.params.examNumber);
    }

    function createListForSelect(array, fieldName) {
        return array.map(function (item) {
            var code = item.code ? item.code + ' - ' : '';
            return {
                name: code + item.name,
                value: item[fieldName]
            }
        });
    }
    function addPoints(req, res) {
        var addPoinsArray = req.body.addpoints; 
        var examNumber = req.params.examNumber;

        async.forEachOf(addPoinsArray, function(additionalPoints, id, asymcdone) {
           
            base.ResultsCollection
                .findOne({_id: id})
                .exec(function(err, result) {
                    var adPointsNum;
                    if (!isNaN(parseInt(additionalPoints))) {
                        adPointsNum = parseInt(additionalPoints);
                    } else {
                        adPointsNum = undefined;
                    }
                    result.AdditionalPoints = adPointsNum;
                    app.pupilsController.Collection.findByResultAsigned(result._id, examNumber, function(err, pupil){
                        if (err) {
                            next(err, pupil);
                            return;
                        }
                        if (pupil) {
                            app.pupilsController.updatePupilResults(pupil, result, examNumber, function(err, doc){
                                if (err) {
                                    next(err, doc)
                                } else {
                                    result.save(asymcdone)
                                }
                            })
                        } else {
                            result.save(asymcdone)
                        }
                    });
                    
                })
         }, function(err) {
            onAddPointsComplete(req, res, err)
         })
    }

    function onAddPointsComplete(req, res, err) {
        if (err) {
            req.session.error = 'Не получилось сохраниться(( Возникли следующие ошибки: <p>' + err + '</p>';
        } else {
            req.session.success = 'Всё хорошо. Дополнительные баллы сохранились';
        }
        res.redirect('/admin/pupils/profiles/results/' + req.params.id + '/' + req.params.examNumber);
    }
    
    function examresultsList (req, res) {
        var self = this;
        this.Collection
            .find()
            .sort('order')
            .populate('examPlace')
            .exec(function (err, docs) {
                res.render(self.viewPath + 'examresultsList.jade', {
                    docs: docs,
                    viewName: self.name.toLowerCase()
                });
            });
    };

    function list (req, res) {
        var self = this;
        this.Collection
            .find()
            .sort('order')
            .populate('examPlace')
            .exec(function (err, docs) {
                res.render(self.viewPath + 'list.jade', {
                    docs: docs,
                    viewName: self.name.toLowerCase()
                });
            });
    };

    function create(req, res) {
        var self = this,
            doc;
        if (req.session && req.session.locals && req.session.locals.doc) {
            doc = req.session.locals.doc;
            req.session.locals = {};
        } else {
            doc = new self.Collection();
        }
        app.subjectController.Collection.find(function (err, subjects) {

            subjects = createListForSelect(subjects, 'name');

            app.placesController.Collection.find(function (err, places) {

                places = createListForSelect(places, 'id');

                res.render(self.viewPath + 'new.jade', {
                    doc: doc,
                    subjects: subjects,
                    places: places,
                    method: 'post',
                    viewName: 'profile'
                });
            });
        });
    };

    function edit(req, res) {
        var self = this;
        this.Collection.findByReq(req, res, function (doc) {
            app.subjectController.Collection.find(function (err, subjects) {

                subjects = createListForSelect(subjects, 'name');

                app.placesController.Collection.find(function (err, places) {

                    places = createListForSelect(places, 'id');

                    res.render(self.viewPath + 'new.jade', {
                        doc: doc,
                        subjects: subjects,
                        places: places,
                        method: 'put',
                        viewName: 'profile'
                    });
                });
            });
        });
    };

    function save(req, res) {
        var self = this;
        var doc = new this.Collection(req.body);
        doc.olympExams = [];
        for (subject in req.body.olympExams) {
            doc.olympExams.push(subject);
        }
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

    function update(req, res) {
        var self = this;

        this.Collection.findByReq(req, res, function (doc) {
            doc.name = req.body.name;
            doc.code = req.body.code;
            doc.subcode = req.body.subcode;
            doc.ammount = req.body.ammount;
            
            doc.examPlace = req.body.examPlace;

            doc.firstExamName = req.body.firstExamName;
            doc.firstExamDate = req.body.firstExamDate;
            doc.firstExamStartTime = req.body.firstExamStartTime;
            doc.firstExamAppelationDate = req.body.firstExamAppelationDate;
            doc.firstIsFirst = req.body.firstIsFirst === 'on';
            doc.secondExamName = req.body.secondExamName;
            doc.secondExamDate = req.body.secondExamDate;
            doc.secondExamStartTime = req.body.secondExamStartTime;
            doc.secondExamAppelationDate = req.body.secondExamAppelationDate;

            doc.secondExamPlace = req.body.secondExamPlace;
            doc.firstExamPlace = req.body.firstExamPlace;

            doc.examKey1 = req.body.examKey1;
            doc.examKey2 = req.body.examKey2;

            doc.firstUploaded = req.body.firstUploaded === 'on';
            doc.firstExamNoStats = req.body.firstExamNoStats === 'on';
            doc.secondUploaded = req.body.secondUploaded === 'on';
            doc.totalUploaded = req.body.totalUploaded === 'on';
            doc.olympExams = [];

            doc.guidePage = req.body.guidePage;
            doc.order = req.body.order;
            doc.belLang = req.body.belLang === 'on';
            for (subject in req.body.olympExams) {
                doc.olympExams.push(subject);
            }
            doc.save(function (err) {
                if (err) {
                    req.session.error = 'Не получилось обновить профиль(( Возникли следующие ошибки: <p>' + err + '</p>';
                    req.session.locals = {doc: doc};
                    res.redirect('/admin/pupils/profiles/edit/' + doc.id);
                }
                else {
                    req.session.success = 'Профиль <strong>' + doc.name + '</strong> обновлен';
                    res.redirect('/admin/pupils/profiles/');
                }
            });
        });
    };

    function remove(req, res) {
        var self = this;
        this.Collection.findByReq(req, res, function (doc) {
            var name = doc.name;
            doc.remove(function () {
                req.session.success = 'Профиль <strong>' + name + '</strong> успешно удалён';
                res.redirect(self.path);
            });
        });
    };
};


exports.ProfileController = ProfileController;