const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/assignment-portal';
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      tlsAllowInvalidCertificates: true, // Bypass TLS issue temporarily
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
