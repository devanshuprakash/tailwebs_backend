require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');
const Assignment = require('./src/models/Assignment');
const Submission = require('./src/models/Submission');

async function seedDummyData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      tlsAllowInvalidCertificates: true
    });
    console.log('Connected to MongoDB!');

    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Assignment.deleteMany({});
    await Submission.deleteMany({});

    console.log('Creating users...');
    const teacherPassword = await bcrypt.hash('teacher123', 10);
    const studentPassword = await bcrypt.hash('student123', 10);

    const teacher = await User.create({
      name: 'Prof. Smith',
      email: 'teacher1@portal.com',
      password_hash: teacherPassword,
      role: 'teacher'
    });

    const student = await User.create({
      name: 'Alice Student',
      email: 'student1@portal.com',
      password_hash: studentPassword,
      role: 'student'
    });

    console.log('Creating dummy assignment...');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

    await Assignment.create({
      title: 'Introduction to Cloud Computing',
      description: 'Write a 2-page essay on the differences between IaaS, PaaS, and SaaS, and provide real-world examples of each.',
      due_date: dueDate,
      status: 'published',
      teacher_id: teacher._id
    });

    console.log('✅ Dummy data seeded successfully! You can log in with:');
    console.log('Teacher: teacher1@portal.com / teacher123');
    console.log('Student: student1@portal.com / student123');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
}

seedDummyData();
