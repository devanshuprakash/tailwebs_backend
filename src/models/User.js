const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['teacher', 'student'],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password_hash; // Good practice to remove password from JSON explicitly
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
