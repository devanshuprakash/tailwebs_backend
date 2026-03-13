const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true,
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  answer: {
    type: String,
    default: '',
  },
  submitted_at: {
    type: Date,
    default: Date.now,
  },
  reviewed: {
    type: Boolean,
    default: false,
  },
  fileUrl: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  fileSize: {
    type: Number,
    default: null,
  },
  feedback: {
    type: String,
    default: null,
  },
  grade: {
    type: Number,
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
});

submissionSchema.index({ assignment_id: 1, student_id: 1 }, { unique: true });

submissionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();

    ret.reviewed = ret.reviewed ? 1 : 0; 
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
