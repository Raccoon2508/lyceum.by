var BaseController = require('./baseController').BaseController,
    translit = require('../modules/translit').translit;

SotkaController = function(mongoose, application) {
 
  var base  = new BaseController('Sotka', 'sotka', mongoose, application);

  setTimeout(calculate, 10 * 60 * 1000);

  function calculate() {
      application.profileController.Collection.find().exec(function (err, profiles) {
          profiles.forEach(function(profile) {
              application.pupilsController.Collection.find({profile: profile._id, status: 'approved'}).exec(function (err, pupils) {
                application.pupilsController.Collection.find({profile: profile._id, status: 'approved', passOlymp: true}).exec(function (err, pupilsOlymp) {
                    profile.olymp = pupilsOlymp.length;
                    profile.countArray.push({
                        count: pupils.length,
                        date: new Date()
                    });
                    profile.save(function (err, doc) {});
                });
              });
          });
      });
      setTimeout(calculate, 10 * 60 * 60 * 1000);
  }

  base.calculateStats = function (req, res, isAjax) {
      application.profileController.Collection.find().exec(function (err, profiles) {
          profiles
              .forEach(function(profile) {
                  application
                      .pupilsController
                      .Collection
                      .find({profile: profile._id, status: 'approved'})
                      .exec(function (err, pupils) {
                          application
                              .pupilsController
                              .Collection
                              .find({profile: profile._id, status: 'approved', passOlymp: true})
                              .exec(function (err, pupilsOlymp) {
                                  var resultsF = [];
                                  var resultsS = [];
                                  var resultsT = [];
                                  var i = 0,
                                      pupilsLength = pupils.length,
                                      pupil,
                                      availablePlaces,
                                      passed,
                                      indexOfPass,
                                      lastIndexOf;

                                    profile.countArray = profile.countArray.concat({
                                      count: pupils.length,
                                      date: new Date()
                                  });
                                  for (i ; i < pupilsLength; i++) {
                                      pupil = pupils[i];
                                      if (pupil.exam1 > -1) {
                                          resultsF.push(+pupil.exam1);
                                      }
                                      if (pupil.exam2 > -1) {
                                          resultsS.push(+pupil.exam2);
                                      }
                                      if (pupil.exam1 > -1 && pupil.exam2 > -1 && pupil.sum > -1) {
                                          resultsT.push(+pupil.sum);
                                      }
                                  }

                                  resultsF.sort(function(a, b) {
                                      return a - b;
                                  });
                                  resultsS.sort(function(a, b) {
                                      return a - b;
                                  });
                                  resultsT.sort(function(a, b) {
                                      return a - b;
                                  });

                                  profile.olymp = pupilsOlymp.length;

                                  availablePlaces = profile.ammount - profile.olymp;

                                  if (availablePlaces < 0) {
                                      availablePlaces = 0;
                                  }

                                  passed = availablePlaces;

                                  profile.minF = resultsF[0];
                                  profile.maxF = resultsF[resultsF.length - 1];
                                  profile.passF = resultsF[resultsF.length - availablePlaces];

                                  profile.minS = resultsS[0];
                                  profile.maxS = resultsS[resultsS.length - 1];
                                  profile.passS = resultsS[resultsS.length - availablePlaces];

                                  profile.minT = resultsT[0];
                                  profile.maxT = resultsT[resultsT.length - 1];
                                  profile.passT = resultsT[resultsT.length - availablePlaces];

                                  indexOfPass = resultsT.indexOf(profile.passT);
                                  lastIndexOf = resultsT.lastIndexOf(profile.passT);

                                  profile.halfDelta = 0;
                                  profile.halfPupils = 0;
                                  profile.halfpass = 0;

                                  if (lastIndexOf - indexOfPass > 0) {
                                      profile.halfpass = profile.passT;
                                      profile.passT = resultsT[lastIndexOf + 1];
                                      passed = resultsT.length - lastIndexOf - 1;

                                      profile.halfDelta = profile.ammount - passed - profile.olymp;
                                      profile.halfPupils = lastIndexOf - indexOfPass + 1;

                                      if (profile.halfDelta == profile.halfPupils) {
                                          profile.passT = profile.halfpass;
                                          profile.halfpass = null;
                                          profile.halfDelta = 0;
                                          profile.halfPupils = 0;
                                      }

                                  }
                                  profile.save(function (err, doc) {
                                      console.log('profile save', err, profile.name)
                                  });
                          });
                      });
          });
      });
      if (!isAjax) {
        res.redirect('/admin/settings');
      } else {
          res.json({})
      }
      
  };

  base.restList = function (req, res) {
      var self = this;

      application.profileController.Collection.find().sort('order').exec(function(err, docs) {
            if (err) {
                res.send(err);
            }
            res.json(docs);
        });
  };
  
  base.addProfile = function (req, res) {
      var self = this;
      var doc = new self.Collection(req.body);
      doc.save(function(err, result) {
            if (err) {
                res.send(err);
            }
            else {
                base.restList(req, res);
            }
        });
  };
  
  base.removeProfile = function (req, res) {
    var self = this;
       self.Collection.findOne({ '_id': req.params.id }, function(err, doc) {
            if (err) {
                res.send(err);
            }
            else {
                doc.remove(function() {
                    base.restList(req, res);
                });
            }
        });
  };
  
  base.updateProfile = function (req, res) {
     var self = this;
     self.Collection.findOne({ '_id': req.params.id }, function(err, doc) {
            if (err) {
                res.send(err);
            }
            else {
                doc.ammount = req.body.ammount;
                doc.order = req.body.order || 0;
                doc.olymp = req.body.olymp || 0;
                doc.save(function(err, result) {
                    if (err) {
                        res.send(err);
                    }
                    else {
                        base.restList(req, res);
                    }
                });
            }
        }); 
  };
  
  base.constructor = arguments.callee;

  return base;
};

exports.SotkaController = SotkaController;