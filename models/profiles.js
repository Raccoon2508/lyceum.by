function define(mongoose, fn) {
    var Schema = mongoose.Schema,

    ProfilesSchema = new Schema({
    	'name': String,
        'code': String,
        'subcode': String,
       // 'firstExam': mongoose.Schema.Types.ObjectId,
    	'firstExamName': String,
    	'firstExamDate': Date,
        'firstExamAppelationDate': Date,
    	'firstExamPlace': String,
        'firstExamUploaded': Boolean,
        'firstExamNoStats': Boolean,
       // 'secondExam': mongoose.Schema.Types.ObjectId,
    	'secondExamName': String,
    	'secondExamDate': Date,
        'secondExamAppelationDate': Date,
    	'secondExamPlace': String,
        'secondExamUploaded': Boolean,
        'totalExamUploaded': Boolean,
        'firstIsFirst': {
    	    type: Boolean,
            default: true
        },
        'olympExams': [String],
        'minF': Number,
        'maxF': Number,
    	'passF': Number,
        'minS': Number,
        'maxS': Number,
        'passS': Number,
        'minT': Number,
        'maxT': Number,
        'passT': Number,
    	'halfpass': Number,
        'halfDelta': Number,
        'halfPupils': Number,
        'ammount': Number,
        'count': Number,
        'countArray': Array,
        'olymp': Number
    });

    ProfilesSchema.virtual('id').get(function() {
        return this._id.toHexString();
    });

    ProfilesSchema.statics.findByReq = function(req, res, next) {
        this.findOne({ _id: req.params.id}, function(err, doc) {
            if (!doc) {
                req.session.error = new Error('такой страницы не существует');
                res.redirect('404.html');
            } else {
                next(doc);
            }
        });
    };
    mongoose.model('Profiles', ProfilesSchema);
    fn();
}

exports.define = define;