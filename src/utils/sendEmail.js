const nodemailer = require('nodemailer');

let transporter;

const setupTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {

    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });
    console.log('📧 Ethereal email test account generated:', testAccount.user);
  }

  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const tp = await setupTransporter();
    
    const info = await tp.sendMail({
      from: '"Assignment Portal" <noreply@assignmentportal.com>', // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log(`✉️ Email sent to ${to}: ${info.messageId}`);

    if (!process.env.SMTP_HOST) {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (err) {
    console.error('Failed to send email:', err);
  }
};

module.exports = sendEmail;
