import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { User } from '../models/index.js';
import {
  getBrandLabel,
  getProductName,
  brandSubject,
  getEmailFromAddress
} from '../lib/branding.js';
import { emailPaths } from '../lib/emailLinks.js';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Initialize Resend client lazily
let resend: Resend | null = null;

const getResendClient = (): Resend | null => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

/**
 * Get user's email address from user ID or user object
 */
const getUserEmail = async (userId: any): Promise<string | null> => {
  try {
    if (!userId) return null;

    // If it's already an email string
    if (typeof userId === 'string' && userId.includes('@')) {
      return userId;
    }

    // If it's a user object with email
    if (typeof userId === 'object' && userId.email) {
      return userId.email;
    }

    // If it's an ObjectId, fetch from database
    const user = await User.findById(userId).select('email firstName lastName');
    return user?.email || null;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
};

/**
 * Send email notification
 */
const sendEmailNotification = async ({
  emailTo,
  subject,
  headingText,
  subText,
  subSubText,
  actionButtonText,
  actionButtonLink
}: {
  emailTo?: string | null;
  subject?: string;
  headingText?: string;
  subText?: string;
  subSubText?: string | null;
  actionButtonText?: string;
  actionButtonLink?: string;
}): Promise<any> => {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('Resend API key not configured. Email notification skipped.');
    return null;
  }

  if (!emailTo) {
    console.warn('No email address provided. Email notification skipped.');
    return null;
  }

  try {
    // Use generic notification template
    const templatePath = path.join(__dirname, '../templates', 'notificationEmailTemplate.html');

    let emailHtml: string;
    try {
      emailHtml = fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.error('Error loading email template:', error);
      // Fallback to simple HTML if template not found
      emailHtml = getSimpleEmailTemplate(headingText, subText, subSubText, actionButtonText, actionButtonLink);
    }

    // Replace placeholders
    if (headingText) {
      emailHtml = emailHtml.replace(/{heading}/g, headingText);
    }

    if (subText) {
      emailHtml = emailHtml.replace(/{message}/g, subText);
    }

    if (subSubText) {
      // Insert sub message if it exists
      const subMessageHtml = `<p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">${subSubText}</p>`;
      emailHtml = emailHtml.replace('{subMessage}', subMessageHtml);
    } else {
      // Remove sub message placeholder if not provided
      emailHtml = emailHtml.replace('{subMessage}', '');
    }

    // Handle action button
    if (actionButtonText && actionButtonLink) {
      emailHtml = emailHtml.replace(/{buttonText}/g, actionButtonText);
      emailHtml = emailHtml.replace(/{buttonLink}/g, actionButtonLink);
      // Show button section - remove the style attribute that hides it
      emailHtml = emailHtml.replace('style="{buttonSection}"', '');
      emailHtml = emailHtml.replace('{buttonSection}', '');
    } else {
      // Hide button section
      emailHtml = emailHtml.replace(/<!-- Button Start -->[\s\S]*?<!-- Button End -->/g, '');
      emailHtml = emailHtml.replace('{buttonSection}', 'display: none;');
    }

    // Replace company name if exists
    const companyName = getBrandLabel();
    emailHtml = emailHtml.replace(/{companyName}/g, companyName);

    const fromEmail = getEmailFromAddress();

    const { data, error } = await resendClient.emails.send({
      from: fromEmail,
      to: emailTo,
      subject: subject || '',
      html: emailHtml,
    });

    if (error) {
      console.error(`Resend rejected email to ${emailTo}:`, error);
      return null;
    }

    console.log(`Email sent to ${emailTo}:`, data?.id ?? 'queued');
    return data;
  } catch (error) {
    console.error('Error sending email notification:', error);
    // Don't throw error - email failures shouldn't break the notification flow
    return null;
  }
};

/**
 * Simple email template fallback
 */
const getSimpleEmailTemplate = (
  heading?: string,
  message?: string,
  subMessage?: string | null,
  buttonText?: string,
  buttonLink?: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${heading}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">${heading}</h1>
        <p>${message}</p>
        ${subMessage ? `<p style="color: #666;">${subMessage}</p>` : ''}
        ${buttonText && buttonLink ? `
          <a href="${buttonLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px;">
            ${buttonText}
          </a>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

/**
 * Send email notification for a notification object
 */
const sendNotificationEmail = async (notification: any, userEmail: string | null = null): Promise<any> => {
  try {
    const email = userEmail || await getUserEmail(notification.recipient);

    if (!email) {
      console.warn(`No email found for notification ${notification._id}`);
      return null;
    }

    // Map notification types to email content
    const emailContent = getEmailContentForNotification(notification);

    if (!emailContent) {
      return null; // Don't send email for this notification type
    }

    return await sendEmailNotification({
      emailTo: email,
      ...emailContent
    });
  } catch (error) {
    console.error('Error in sendNotificationEmail:', error);
    return null;
  }
};

/**
 * Get email content based on notification type
 */
const getEmailContentForNotification = (notification: any): any => {
  const id = String(notification.entityId || '');
  const product = getProductName();

  const contentMap: Record<string, any> = {
    login_successful: {
      subject: brandSubject('Successful login'),
      headingText: 'Successful login',
      subText: `You have successfully signed in to ${product}.`,
      subSubText: notification.metadata?.ipAddress ? `IP address: ${notification.metadata.ipAddress}` : null,
      actionButtonText: 'Open dashboard',
      actionButtonLink: emailPaths.dashboard()
    },

    supplier_added: {
      subject: brandSubject('Welcome — supplier account created'),
      headingText: `Welcome to ${product}`,
      subText: `You have been registered as a supplier on ${product}. ${notification.metadata?.companyName ? `Company: ${notification.metadata.companyName}.` : ''}\n\nSign in to complete your profile and upload KYS compliance documents before you can receive RFQ invitations.`,
      subSubText: notification.metadata?.password
        ? `Your login credentials:\nEmail: ${notification.metadata.email}\nTemporary password: ${notification.metadata.password}\n\nPlease change your password after first sign-in.`
        : null,
      actionButtonText: 'Sign in',
      actionButtonLink: emailPaths.supplierLogin()
    },
    supplier_approved: {
      subject: brandSubject('Supplier account approved'),
      headingText: 'Your supplier account is approved',
      subText: notification.message,
      subSubText: notification.metadata?.notes ? `Notes: ${notification.metadata.notes}` : null,
      actionButtonText: 'Open supplier portal',
      actionButtonLink: emailPaths.supplierDashboard()
    },

    requisition_submitted: {
      subject: brandSubject('Requisition submitted'),
      headingText: 'Requisition submitted',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    requisition_approved: {
      subject: brandSubject('Requisition approved'),
      headingText: 'Requisition approved',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    requisition_rejected: {
      subject: brandSubject('Requisition rejected'),
      headingText: 'Requisition rejected',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    requisition_accepted: {
      subject: brandSubject('Requisition accepted'),
      headingText: 'Requisition accepted',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    requisition_rejected_procurement: {
      subject: brandSubject('Requisition rejected by procurement'),
      headingText: 'Requisition rejected',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    requisition_updated: {
      subject: brandSubject('Requisition updated'),
      headingText: 'Requisition updated',
      subText: notification.message,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },

    rfq_published: {
      subject: brandSubject(`New RFQ — ${notification.metadata?.rfqNumber || 'invitation'}`),
      headingText: 'New RFQ published',
      subText: notification.message,
      subSubText: notification.metadata?.deadline
        ? `Submission deadline: ${new Date(notification.metadata.deadline).toLocaleDateString()}`
        : null,
      actionButtonText: 'View RFQ & submit quote',
      actionButtonLink: emailPaths.supplierRfqs(id)
    },

    quotation_submitted: {
      subject: brandSubject('New quotation received'),
      headingText: 'New quotation received',
      subText: notification.message,
      actionButtonText: 'Review quotation',
      actionButtonLink: emailPaths.quotation(id)
    },
    quotation_accepted: {
      subject: brandSubject('Quotation accepted'),
      headingText: 'Your quotation was accepted',
      subText: notification.message,
      actionButtonText: 'View quotations',
      actionButtonLink: emailPaths.supplierQuotations()
    },
    quotation_rejected: {
      subject: brandSubject('Quotation not selected'),
      headingText: 'Quotation update',
      subText: notification.message,
      actionButtonText: 'View quotations',
      actionButtonLink: emailPaths.supplierQuotations()
    },

    po_created: {
      subject: brandSubject('New purchase order'),
      headingText: 'New purchase order',
      subText: notification.message,
      actionButtonText: notification.metadata?.isSupplier ? 'View purchase order' : 'Review purchase order',
      actionButtonLink: notification.metadata?.isSupplier
        ? emailPaths.supplierPurchaseOrders()
        : emailPaths.purchaseOrder(id)
    },
    po_submitted: {
      subject: brandSubject('Purchase order submitted for approval'),
      headingText: 'PO awaiting approval',
      subText: notification.message,
      actionButtonText: 'Review purchase order',
      actionButtonLink: emailPaths.purchaseOrder(id)
    },
    po_finance_approved: {
      subject: brandSubject('PO approved by finance'),
      headingText: 'PO approved by finance',
      subText: notification.message,
      actionButtonText: 'View purchase order',
      actionButtonLink: emailPaths.purchaseOrder(id)
    },
    po_finance_rejected: {
      subject: brandSubject('PO rejected by finance'),
      headingText: 'PO rejected',
      subText: notification.message,
      actionButtonText: 'View purchase order',
      actionButtonLink: emailPaths.purchaseOrder(id)
    },
    po_coo_approved: {
      subject: brandSubject('Purchase order fully approved'),
      headingText: 'PO fully approved',
      subText: notification.message,
      actionButtonText: 'View purchase order',
      actionButtonLink: notification.metadata?.isSupplier
        ? emailPaths.supplierPurchaseOrders()
        : emailPaths.purchaseOrder(id)
    },
    po_coo_rejected: {
      subject: brandSubject('PO rejected by COO'),
      headingText: 'PO rejected',
      subText: notification.message,
      actionButtonText: 'View purchase order',
      actionButtonLink: emailPaths.purchaseOrder(id)
    },

    invoice_submitted: {
      subject: brandSubject('Invoice submitted for review'),
      headingText: 'New invoice',
      subText: notification.message,
      actionButtonText: 'Review invoice',
      actionButtonLink: emailPaths.invoice(id)
    },
    invoice_approved: {
      subject: brandSubject('Invoice approved'),
      headingText: 'Invoice approved',
      subText: notification.message,
      actionButtonText: 'View invoices',
      actionButtonLink: notification.metadata?.isSupplier
        ? emailPaths.supplierInvoices()
        : emailPaths.invoice(id)
    },
    invoice_rejected: {
      subject: brandSubject('Invoice rejected'),
      headingText: 'Invoice rejected',
      subText: notification.message,
      actionButtonText: 'View invoices',
      actionButtonLink: notification.metadata?.isSupplier
        ? emailPaths.supplierInvoices()
        : emailPaths.invoice(id)
    },
    invoice_paid: {
      subject: brandSubject('Payment recorded'),
      headingText: 'Payment recorded',
      subText: notification.message,
      actionButtonText: 'View invoices',
      actionButtonLink: notification.metadata?.isSupplier
        ? emailPaths.supplierInvoices()
        : emailPaths.invoice(id)
    },

    supplier_status_change: {
      subject: brandSubject('Supplier status updated'),
      headingText: 'Account status changed',
      subText: notification.message,
      actionButtonText: 'View profile',
      actionButtonLink: emailPaths.supplierProfile()
    },

    goods_received: {
      subject: brandSubject('Goods received'),
      headingText: 'Goods received',
      subText: notification.message,
      subSubText: notification.metadata?.grvNumber ? `GRV number: ${notification.metadata.grvNumber}` : null,
      actionButtonText: 'View requisition',
      actionButtonLink: emailPaths.requisition(id)
    },
    delivery_accepted: {
      subject: brandSubject('Delivery accepted'),
      headingText: 'Delivery accepted',
      subText: notification.message,
      actionButtonText: 'View deliveries',
      actionButtonLink: emailPaths.supplierDeliveries()
    },
    delivery_rejected: {
      subject: brandSubject('Delivery rejected'),
      headingText: 'Delivery rejected',
      subText: notification.message,
      actionButtonText: 'View deliveries',
      actionButtonLink: emailPaths.supplierDeliveries()
    },

    store_requisition_created: {
      subject: brandSubject('New store requisition'),
      headingText: 'New store requisition',
      subText: notification.message,
      actionButtonText: 'Review request',
      actionButtonLink: emailPaths.storeRequisitions()
    },
    store_requisition_approved: {
      subject: brandSubject('Store requisition approved'),
      headingText: 'Store requisition approved',
      subText: notification.message,
      actionButtonText: 'View store requisitions',
      actionButtonLink: emailPaths.storeRequisitions()
    },
    store_requisition_rejected: {
      subject: brandSubject('Store requisition rejected'),
      headingText: 'Store requisition rejected',
      subText: notification.message,
      actionButtonText: 'View store requisitions',
      actionButtonLink: emailPaths.storeRequisitions()
    },
    stock_issued: {
      subject: brandSubject('Stock issued'),
      headingText: 'Stock issued',
      subText: notification.message,
      actionButtonText: 'View store requisitions',
      actionButtonLink: emailPaths.storeRequisitions()
    },

    low_stock: {
      subject: brandSubject('Low stock alert'),
      headingText: 'Low stock alert',
      subText: notification.message,
      actionButtonText: 'View inventory',
      actionButtonLink: emailPaths.inventory()
    },
    rfq_deadline_approaching: {
      subject: brandSubject('RFQ deadline approaching'),
      headingText: 'RFQ deadline approaching',
      subText: notification.message,
      actionButtonText: 'Submit quotation',
      actionButtonLink: emailPaths.supplierRfqs(id)
    }
  };

  return contentMap[notification.type] || null;
};

/**
 * Send a one-time login verification code.
 * Returns true when Resend accepts the message.
 */
const sendOtpEmail = async (emailTo: string, code: string): Promise<boolean> => {
  const product = getProductName();

  const result = await sendEmailNotification({
      emailTo,
      subject: `${code} is your ${product} login code`,
      headingText: 'Your login verification code',
      subText: 'Use the code below to complete your sign-in. It expires in 10 minutes.',
      subSubText: `<strong style="font-size: 28px; letter-spacing: 6px; color: #111827;">${code}</strong>`
    });
  return result != null;
};

const sendPasswordResetEmail = async (
  emailTo: string,
  resetLink: string,
  firstName?: string
): Promise<boolean> => {
  const product = getProductName();
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';

  const result = await sendEmailNotification({
    emailTo,
    subject: brandSubject('Password reset'),
    headingText: 'Password reset request',
    subText: `${greeting} we received a request to reset your password. Click the button below to choose a new password. This link expires in 1 hour.`,
    subSubText: 'If you did not request this, you can safely ignore this email.',
    actionButtonText: 'Reset password',
    actionButtonLink: resetLink
  });
  return result != null;
};

export {
  sendEmailNotification,
  sendNotificationEmail,
  sendOtpEmail,
  sendPasswordResetEmail,
  getUserEmail
};
