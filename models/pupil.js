var crypto = require('crypto');
var mongoose = require('mongoose');
var async = require('async');
var TOKEN_EXPIRE_VAR = 2 * 60 * 1000; 

var PUPIL_FIELDS_TO_BE_VISIBLE = [
    '_id', 
    'email', 
    'firstName',
    'lastName',
    'parentName', 
    'status', 
    'dessaproveDate', 
    'profile', 
    'place1', 
    'place2', 
    'result1', 
    'result2'
].join(' ');

function define(mongoose, fn) {
    var PupilSchema = new mongoose.Schema({
        email: {
            type: String,
            required: true
        },
        hashedPassword: {
            type: String,
            required: true
        },
        salt: {
            type: String,
            required: true
        },
        created: {
            type: Date,
            default: Date.now
        },
        dessaproveDate: {
            type: Date,
        },
        status: String,
        resetPasswordToken: String,
        resetPasswordExpires: Date,
        confirmMailToken: String,
        examStatus: String,

        profile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Profiles'
        },
        place1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Places'
        },
        place2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Places'
        },
        result1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExamResults'
        },
        result2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ExamResults'
        },
        audience1: String,
        audience2: String,
        needBel: Boolean,
        firstName: String,
        lastName: String,
        parentName: String,
        requestImg: String,
        diplomImg: String,
        phone: String,
        phoneCode: String,
        codeValid: Boolean,

        night: Boolean,
        distant: Boolean,
        requestImgNotApproved: Boolean,
        requestImgNoPhoto: Boolean,
        requestImgLowQuality: Boolean,
        requestImgStampError: Boolean,
        diplomImgNotApproved: Boolean,
        diplomExamName: String,

        passOlymp: Boolean,
        exam1: Number,
        exam2: Number,
        sum: Number,
        region: String,
        message: String,
        agreement: {
            type: Boolean,
            default: false
        },
        recommended: {
            type: Boolean,
            default: false
        },
    });

    PupilSchema.methods.encryptPassword = function (password) {
        return crypto
            .createHmac('sha1', this.salt)
            .update(password)
            .digest('hex');
    };

    PupilSchema.virtual('userId')
        .get(function () {
            return this.id;
        });

    PupilSchema.virtual('FIO')
        .get(function () {
            return [this.firstName, this.lastName, this.parentName].join(' ');
        });

    PupilSchema.virtual('password')
        .set(function (password) {
            this._plainPassword = password;
            this.salt = crypto.randomBytes(32).toString('base64');
            this.hashedPassword = this.encryptPassword(password);
            this.save();
        })
        .get(function () {
            return this._plainPassword;
        });


    PupilSchema.methods.checkPassword = function (password) {
        return this.encryptPassword(password) === this.hashedPassword;
    };
    
    PupilSchema.statics.findOneForAjax = function(req, res, next) {
        this.findOne({_id: req.user.userId}, PUPIL_FIELDS_TO_BE_VISIBLE)
            .populate('profile')
            .populate('place1')
            .populate('place2')
            .populate('result1')
            .populate('result2')
            .exec(function(err, pupil) {
                next(err, pupil)
            })
    };
    
    PupilSchema.statics.findByReq = function(req, res, next) {
        this.findOne({ _id: req.params.id}, function(err, doc) {
            if (!doc) {
                req.session.error = new Error('такой страницы не существует');
                res.redirect('404.html');
            } else {
                next(doc);
            }
        });
    };

    PupilSchema.statics.findByResultAsigned = function(resultId, examNumber, next) {
        var queryObj = {};
        queryObj['result' + examNumber] = resultId

        this.findOne(queryObj, next)
    } 

    PupilSchema.statics.simpleSearch = function(req, res, next) {
        var query = this.find();
        generateQueryParams(req);

        this.apiSearch(req, res, query, next);
    }
    
    PupilSchema.statics.duplicatesSearch = function(req, res, next) {
        var self = this;
        var group = {
            $group:
                {
                    _id: {firstName: "$firstName"},
                    uniqueIds: {$addToSet: "$_id"},
                    count: {$sum: 1}
                }
        };
        var match = {
            $match: {
                count: {"$gt": 1}
            }
        };
        var sort = {
            $sort: {
                count: -1
            }
        };
        
        generateQueryParams(req);

        this.aggregate([group, match, sort], onDuplicatesFound);

        function onDuplicatesFound(err, results) {
            var query;
            var uniqueIds = [];
    
            results.forEach(function (result) {
                result.uniqueIds.forEach(function (id) {
                    uniqueIds.push(id);
                })
            });
    
            query = self.find({_id: {$in: uniqueIds}});
    
            self.apiSearch(req, res, query, next);
        }

    }

    PupilSchema.statics.apiSearch = function (req, res, query, next) {
        var countQuery;
        if (req.queryParams.firstName) {
            query.find({"firstName": new RegExp(req.queryParams.firstName, 'i')});
        }
        if (req.queryParams.email) {
            query.find({"email": new RegExp(req.queryParams.email, 'i')});
        }
        if (req.queryParams.status) {
            query.find({"status": req.queryParams.status});
        }
        if (req.queryParams.profile) {
            query.find({"profile": req.queryParams.profile});
        }
        if (req.queryParams.examStatus) {
            if (req.queryParams.examStatus === '0') {
                query.find( {
                    $or: [
                        {"examStatus": null},
                        {"examStatus": req.queryParams.examStatus}
                    ]
                })
            } else {
                query.find({"examStatus": req.queryParams.examStatus});
            }
            
        }
        if (req.queryParams.recommended) {
            query.find({"recommended": req.queryParams.recommended});
        }
        if (req.queryParams.agreement) {
            query.find({"agreement": req.queryParams.agreement});
        }
        countQuery = query;

        query
            .sort(req.queryParams.sortDirection + req.queryParams.sortField)
            .skip(req.queryParams.itemsPerPage * (req.queryParams.page - 1))
            .limit(req.queryParams.itemsPerPage)
            .populate('profile')
            .populate('result1')
            .populate('result2')

        var firstQ = function (callback) {
            query
                .exec(function (err, data) {
                    queryExecFn(err, data, callback)
                });
        };

        var secondQ = function (callback) {
            countQuery
                .count()
                .exec(function (err, data) {
                    queryExecFn(err, data, callback)
                });
        };

        async.parallel([firstQ, secondQ], next);
    }

    mongoose.model('Pupil', PupilSchema);
    fn();

    
}

var HistoryModelSchema = new mongoose.Schema({
    created: {
        type: Date,
        default: Date.now
    },
    pupil: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pupil'
    },
    message: String
});

var HistoryModel = mongoose.model('HistoryModelSchema', HistoryModelSchema);

var ClientApp = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        required: true
    },
    clientId: {
        type: String,
        unique: true,
        required: true
    },
    clientSecret: {
        type: String,
        required: true
    }
});

var ClientAppModel = mongoose.model('ClientApp', ClientApp);

var AccessToken = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    clientId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        unique: true,
        required: true
    },
    created: {
        type: Date,
        default: Date.now,
        
    },
    expires_at: {
        type: Date,
        default: function() {
            return new Date(+Date.now() + TOKEN_EXPIRE_VAR);
        }
    }
});

var AccessTokenModel = mongoose.model('AccessToken', AccessToken);

var RefreshToken = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    clientId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        unique: true,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

var RefreshTokenModel = mongoose.model('RefreshToken', RefreshToken);


function generateQueryParams(req) {
    var sortObj = req.query.sort ? req.query.sort.split('-') : ['created', 'asc'];

    req.queryParams = {
        sortObj: sortObj,
        sortField: sortObj[0],
        sortDirection: sortObj[1] === 'asc' ? '' : '-',
        profile: req.query.profile,
        status: req.query.status,
        examStatus: req.query.examStatus,
        firstName: req.query.firstName,
        email: req.query.email,
        recommended: req.query.recommended,
        agreement: req.query.agreement,
        itemsPerPage: req.query.itemsPerPage || 100,
        page: req.query.page || 1
    };
}

function queryExecFn(err, data, callback) {
    if (err) {
        callback(err, null);
    }
    else {
        callback(null, data);
    }
}

exports.define = define;

exports.ClientAppModel = ClientAppModel;
exports.AccessTokenModel = AccessTokenModel;
exports.RefreshTokenModel = RefreshTokenModel;
exports.HistoryModel = HistoryModel;