import nodemailer from 'nodemailer';
import { EMAIL_CONFIG } from '../config/config.js';

// Create a transporter with improved configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',  
    auth: {
      user: EMAIL_CONFIG.USER,
      pass: EMAIL_CONFIG.PASSWORD,
    },
    // Add these important DKIM and SPF headers
    // dkim: {
    //   domainName: 'yourdomain.com', // Replace with your actual domain
    //   keySelector: 'default',
    //   privateKey: process.env.DKIM_PRIVATE_KEY || '', // Add this to env vars if possible
    // },
    // Add custom headers to reduce spam likelihood
    headers: {
      'X-Priority': '1 (Highest)',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Mailer': 'OSM Evaluation System'
    }
  });
};

/**
 * Send an email with the specified content
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 * @returns {Promise<Object>} - Result of the send operation
 */
export const sendEmail = async (to, uid, password, subject, html) => {
  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: {
        name: 'Exam Evaluation System',
        address: EMAIL_CONFIG.USER
      },
      to,
      subject,
      html,
      // Add text version for better deliverability
      text: `Welcome to the Exam Evaluation System. Your User ID: ${uid}, Temporary Password: ${password}. Please change your password at first login.`,
      priority: 'high'
    });

    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send evaluator credentials via email
 * @param {string} name - Evaluator's name
 * @param {string} email - Evaluator's email address
 * @param {string} uid - Evaluator's UID
 * @param {string} password - Evaluator's temporary password
 * @returns {Promise<Object>} - Result of the send operation
 */


export const sendEvaluatorCredentials = async (name, email, uid, password) => {
  const subject = 'Your Exam Evaluation System Access Credentials';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #3050a0; padding-bottom: 10px;">Welcome to the Exam Evaluation System</h2>
      
      <p>Hello ${name},</p>
      
      <p>Your evaluator account has been created. Here are your login credentials:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>User ID:</strong> ${uid}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
      </div>
      
      <p><strong>Note:</strong> You will need to change your password when you first log in.</p>
      
      <p>Please visit <a href="https://your-domain.com/login" style="color: #3050a0;">our login page</a> to access the system.</p>
      
      <p>If you have any questions, please contact the administrator.</p>
      
      <p style="margin-top: 20px; font-size: 12px; color: #777;">
        This is a legitimate message from your examination authority. Please save this information.
      </p>
    </div>
  `;

  return sendEmail(email,uid, password, subject, html);
};