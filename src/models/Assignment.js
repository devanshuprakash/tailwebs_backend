const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    due_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'published', 'completed'],
      default: 'draft',
    },
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

assignmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (ret.teacher_id && typeof ret.teacher_id === 'object' && ret.teacher_id._id) {
       ret.teacher_id.id = ret.teacher_id._id.toString();
    }
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = Assignment;
