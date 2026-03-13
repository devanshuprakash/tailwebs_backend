const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { authenticate, requireTeacher, requireStudent } = require('../middleware/auth');
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const User = require('../models/User');
const upload = require('../middleware/upload');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

router.use(authenticate);

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

router.get(
  '/',
  requireTeacher,
  [query('status').optional().isIn(['draft', 'published', 'completed'])],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const { status, page = 1, limit = 10, search } = req.query;
      let query = { teacher_id: req.user.id };
      
      if (status) query.status = status;
      if (search) query.title = { $regex: search, $options: 'i' };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Assignment.countDocuments(query);
      const assignments = await Assignment.find(query)
        .populate('teacher_id', 'name')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const result = await Promise.all(
        assignments.map(async (a) => {
          const submissionCount = await Submission.countDocuments({ assignment_id: a._id });
          const assignmentJson = a.toJSON();
          assignmentJson.submission_count = submissionCount;
          return assignmentJson;
        })
      );

      res.json({
        assignments: result,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: `Server error fetching assignments: ${err.message}`, stack: err.stack });
    }
  }
);

router.post(
  '/',
  requireTeacher,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('due_date').isISO8601().withMessage('Valid due date is required'),
    body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const { title, description, due_date, status } = req.body;

      const assignment = new Assignment({
        title,
        description,
        due_date,
        status: status || 'draft',
        teacher_id: req.user.id,
      });

      await assignment.save();
      await assignment.populate('teacher_id', 'name');
      res.status(201).json(assignment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create assignment: ' + err.message, stack: err.stack });
    }
  }
);

router.put(
  '/:id',
  requireTeacher,
  [
    param('id').isMongoId().withMessage('Invalid assignment ID'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
    body('due_date').optional().isISO8601().withMessage('Valid due date is required'),
    body('status').optional().isIn(['draft', 'published']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, teacher_id: req.user.id });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      if (assignment.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft assignments can be edited' });
      }
      const { title, description, due_date, status } = req.body;

      if (title) assignment.title = title;
      if (description) assignment.description = description;
      if (due_date) assignment.due_date = due_date;
      if (status) assignment.status = status;

      await assignment.save();
      res.json(assignment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  }
);

router.delete(
  '/:id',
  requireTeacher,
  [param('id').isMongoId().withMessage('Invalid assignment ID')],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, teacher_id: req.user.id });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      if (assignment.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft assignments can be deleted' });
      }

      await Assignment.deleteOne({ _id: req.params.id });
      res.json({ message: 'Assignment deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  }
);

router.patch(
  '/:id/status',
  requireTeacher,
  [
    param('id').isMongoId().withMessage('Invalid assignment ID'),
    body('status')
      .isIn(['published', 'completed'])
      .withMessage('Status must be "published" or "completed"'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, teacher_id: req.user.id });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const { status } = req.body;
      const validTransitions = {
        draft: 'published',
        published: 'completed',
      };

      if (validTransitions[assignment.status] !== status) {
        return res.status(400).json({
          error: `Cannot transition from "${assignment.status}" to "${status}"`,
        });
      }

      assignment.status = status;
      await assignment.save();

      if (status === 'published') {
        const students = await User.find({ role: 'student' });
        const emails = students.map(s => s.email).join(', ');

        sendEmail({
          to: emails,
          subject: `New Assignment Published: ${assignment.title}`,
          text: `A new assignment "${assignment.title}" has been published. Due date: ${new Date(assignment.due_date).toLocaleString()}. Log in to the portal to view details.`,
          html: `<p>A new assignment <strong>${assignment.title}</strong> has been published.</p><p><strong>Due date:</strong> ${new Date(assignment.due_date).toLocaleString()}</p><p>Log in to the portal to view details.</p>`
        });
      }
      
      await assignment.populate('teacher_id', 'name');
      res.json(assignment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

router.get(
  '/:id/submissions',
  requireTeacher,
  [param('id').isMongoId().withMessage('Invalid assignment ID')],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, teacher_id: req.user.id })
        .populate('teacher_id', 'name');

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      const submissionsDocs = await Submission.find({ assignment_id: req.params.id })
        .populate('student_id', 'name email')
        .sort({ submitted_at: -1 });

      const submissions = submissionsDocs.map(s => {
        const doc = s.toJSON();
        return {
          id: doc.id,
          answer: doc.answer,
          submitted_at: doc.submitted_at,
          reviewed: doc.reviewed,
          student_name: doc.student_id ? doc.student_id.name : 'Unknown',
          student_email: doc.student_id ? doc.student_id.email : 'Unknown'
        };
      });

      res.json({ assignment, submissions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch submissions: ' + err.message, stack: err.stack });
    }
  }
);

router.patch(
  '/submissions/:id/review',
  requireTeacher,
  [param('id').isMongoId().withMessage('Invalid submission ID')],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const submission = await Submission.findById(req.params.id)
        .populate('assignment_id')
        .populate('student_id');

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      if (submission.assignment_id.teacher_id.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { feedback, grade } = req.body;

      submission.reviewed = true;
      submission.feedback = feedback || null;
      submission.grade = grade !== undefined ? Number(grade) : null;
      submission.reviewedAt = new Date();
      
      await submission.save();

      sendEmail({
        to: submission.student_id.email,
        subject: `Assignment Reviewed: ${submission.assignment_id.title}`,
        text: `Your submission for "${submission.assignment_id.title}" has been reviewed by your teacher. Grade: ${submission.grade || 'N/A'}. Log in to view feedback.`,
        html: `<p>Your submission for <strong>${submission.assignment_id.title}</strong> has been reviewed by your teacher.</p><p><strong>Grade:</strong> ${submission.grade || 'N/A'}</p><p>Log in to view feedback.</p>`
      });
      
      res.json({ message: 'Submission marked as reviewed', submission });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to review submission' });
    }
  }
);

router.get(
  '/published',
  requireStudent,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      let query = { status: 'published' };
      
      if (search) query.title = { $regex: search, $options: 'i' };

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const total = await Assignment.countDocuments(query);

      const assignmentsDocs = await Assignment.find(query)
        .populate('teacher_id', 'name')
        .sort({ due_date: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const result = await Promise.all(
        assignmentsDocs.map(async (a) => {
          const submission = await Submission.findOne({ 
            assignment_id: a._id, 
            student_id: req.user.id 
          });
          
          const aJson = a.toJSON();
          aJson.teacher_name = aJson.teacher_id ? aJson.teacher_id.name : 'Unknown';
          aJson.my_submission = submission ? submission.toJSON() : null;
          
          return aJson;
        })
      );

      res.json({
        assignments: result,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch published assignments' });
    }
  }
);

router.post(
  '/:id/submit',
  requireStudent,
  upload.single('file'), // Handle 'file' field upload
  [
    param('id').isMongoId().withMessage('Invalid assignment ID'),

    body('answer').optional().trim(),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, status: 'published' });

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found or not published' });
      }

      const existing = await Submission.findOne({ assignment_id: req.params.id, student_id: req.user.id });

      if (existing) {
        return res.status(400).json({ error: 'You have already submitted for this assignment' });
      }

      const answerText = req.body.answer || '';
      
      const submissionData = {
        assignment_id: req.params.id,
        student_id: req.user.id,
        answer: answerText,
      };

      if (req.file) {
        submissionData.fileUrl = `/uploads/${req.file.filename}`;
        submissionData.fileName = req.file.originalname;
        submissionData.fileSize = req.file.size;
      } else if (!answerText) {
         return res.status(400).json({ error: 'Please submit either an answer text or a file' });
      }

      const submission = new Submission(submissionData);

      await submission.save();
      
      res.status(201).json(submission);
    } catch (err) {
      console.error(err);

      if (err.code === 11000) {
        return res.status(400).json({ error: 'You have already submitted for this assignment' });
      }
      res.status(500).json({ error: 'Failed to submit assignment' });
    }
  }
);

router.get(
  '/:id/my-submission',
  requireStudent,
  [param('id').isMongoId().withMessage('Invalid assignment ID')],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    try {
      const submission = await Submission.findOne({ assignment_id: req.params.id, student_id: req.user.id });

      if (!submission) {
        return res.status(404).json({ error: 'No submission found' });
      }

      res.json(submission);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch submission' });
    }
  }
);

router.get(
  '/dashboard/stats',
  requireTeacher,
  async (req, res) => {
    try {
      const teacherId = new mongoose.Types.ObjectId(req.user.id);
      
      const statusCountsAggregation = await Assignment.aggregate([
        { $match: { teacher_id: teacherId } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]);
      
      const assignments = await Assignment.find({ teacher_id: req.user.id }).select('_id title created_at due_date status');
      const assignmentIds = assignments.map(a => a._id);
      
      const totalAssignments = assignments.length;
      const totalSubmissions = await Submission.countDocuments({ assignment_id: { $in: assignmentIds } });
      const reviewedSubmissions = await Submission.countDocuments({ assignment_id: { $in: assignmentIds }, reviewed: true });

      const allSubmissions = await Submission.find({ assignment_id: { $in: assignmentIds } }).lean();
      
      let lateSubmissions = 0;
      let totalCompletionTimeMs = 0;
      let completedSubmissionsCount = 0;
      
      const performanceData = {};

      allSubmissions.forEach(sub => {
        const assignment = assignments.find(a => a._id.toString() === sub.assignment_id.toString());
        if (!assignment) return;

        if (new Date(sub.submitted_at) > new Date(assignment.due_date)) {
          lateSubmissions++;
        }

        const completionTime = new Date(sub.submitted_at) - new Date(assignment.created_at);
        if (completionTime > 0) {
           totalCompletionTimeMs += completionTime;
           completedSubmissionsCount++;
        }

        if (!performanceData[assignment._id]) {
          performanceData[assignment._id] = {
            id: assignment._id.toString(),
            title: assignment.title.substring(0, 15) + (assignment.title.length > 15 ? '...' : ''),
            submissions: 0,
            avgGrade: 0,
            totalGrade: 0,
            gradedCount: 0
          };
        }
        
        performanceData[assignment._id].submissions++;
        
        if (sub.grade !== null) {
          performanceData[assignment._id].totalGrade += sub.grade;
          performanceData[assignment._id].gradedCount++;
        }
      });

      const performanceTrends = Object.values(performanceData).map(p => {
        p.avgGrade = p.gradedCount > 0 ? Number((p.totalGrade / p.gradedCount).toFixed(1)) : 0;
        return p;
      }).sort((a, b) => b.submissions - a.submissions).slice(0, 5); // top 5 by submissions

      const avgCompletionHours = completedSubmissionsCount > 0 
        ? Number((totalCompletionTimeMs / completedSubmissionsCount / (1000 * 60 * 60)).toFixed(1))
        : 0;

      const recentSubDocs = await Submission.find({ assignment_id: { $in: assignmentIds } })
        .populate('student_id', 'name')
        .sort({ submitted_at: -1 })
        .limit(5);

      const recentSubmissions = recentSubDocs.map(s => {
        const doc = s.toJSON();
        const assignment = assignments.find(a => a._id.toString() === doc.assignment_id.toString());
        return {
          id: doc.id,
          answer: doc.answer,
          submitted_at: doc.submitted_at,
          reviewed: doc.reviewed,
          student_name: doc.student_id ? doc.student_id.name : 'Unknown',
          assignment_title: assignment ? assignment.title : 'Unknown'
        };
      });

      const totalStudents = await User.countDocuments({ role: 'student' });
      const publishedCount = assignments.filter(a => a.status !== 'draft').length;
      const expectedSubmissions = totalStudents * publishedCount;
      const submissionRate = expectedSubmissions > 0 
        ? Number(((totalSubmissions / expectedSubmissions) * 100).toFixed(1))
        : 0;

      res.json({
        totalAssignments,
        totalSubmissions,
        reviewedSubmissions,
        pendingReview: totalSubmissions - reviewedSubmissions,
        statusCounts: {
          draft: statusCountsAggregation.find((s) => s._id === 'draft')?.count || 0,
          published: statusCountsAggregation.find((s) => s._id === 'published')?.count || 0,
          completed: statusCountsAggregation.find((s) => s._id === 'completed')?.count || 0,
        },
        recentSubmissions,
        analytics: {
          lateSubmissions,
          avgCompletionHours,
          submissionRate,
          performanceTrends
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
);

router.get(
  '/:id',
  requireTeacher,
  [param('id').isMongoId().withMessage('Invalid assignment ID')],
  async (req, res) => {
    if (validationErrors(req, res)) return;
    try {
      const assignment = await Assignment.findOne({ _id: req.params.id, teacher_id: req.user.id });
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.json(assignment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  }
);

module.exports = router;
