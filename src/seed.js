require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Assignment = require('./models/Assignment');
const Submission = require('./models/Submission');
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/assignment-portal';
const users = [
  { name: 'Prof. Smith', email: 'teacher1@portal.com', password: 'teacher123', role: 'teacher' },
  { name: 'Dr. Johnson', email: 'teacher2@portal.com', password: 'teacher123', role: 'teacher' },
  { name: 'Alice Student', email: 'student1@portal.com', password: 'student123', role: 'student' },
  { name: 'Bob Student', email: 'student2@portal.com', password: 'student123', role: 'student' },
  { name: 'Charlie Student', email: 'student3@portal.com', password: 'student123', role: 'student' },
];
async function seedAll() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      tlsAllowInvalidCertificates: true
    });
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Assignment.deleteMany({});
    await Submission.deleteMany({});
    console.log('🌱 Seeding users...');
    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, 10);
      const user = new User({
        name: u.name,
        email: u.email,
        password_hash: hash,
        role: u.role,
      });
      await user.save();
      console.log(`  ✔ ${u.role}: ${u.email} / ${u.password}`);
    }

    console.log('\n✅ Seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
seedAll();
