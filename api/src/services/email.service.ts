import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { User } from '../models/index.js';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure dotenv is loaded
dotenv.config();

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
    const companyName = process.env.COMPANY_NAME || 'FosssilProcure';
    emailHtml = emailHtml.replace(/{companyName}/g, companyName);

    const fromEmail = process.env.EMAIL_FROM || 'notifications@fosssilprocure.com';

    const email = await resendClient.emails.send({
      from: fromEmail,
      to: emailTo,
      subject: subject || '',
      html: emailHtml,
    });

    console.log('Email sent successfully:', (email as any)?.id || (email as any)?.data?.id || 'Email queued');
    return email;
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
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const appUrl = `${baseUrl}/app`;

  const contentMap: Record<string, any> = {
    // Login
    login_successful: {
      subject: 'Successful Login - FosssilProcure',
      headingText: 'Successful Login',
      subText: 'You have successfully logged into your FosssilProcure account.',
      subSubText: notification.metadata?.ipAddress ? `IP Address: ${notification.metadata.ipAddress}` : null,
      actionButtonText: 'View Dashboard',
      actionButtonLink: `${appUrl}`
    },

    // Supplier
    supplier_added: {
      subject: 'Welcome to FosssilProcure - Supplier Account Created',
      headingText: `Welcome to FosssilProcure!`,
      subText: `You have been added as a supplier to the FosssilProcure procurement system. ${notification.metadata?.companyName ? `Your company ${notification.metadata.companyName} has been registered.` : 'Your supplier account has been created.'}\n\nPlease sign in to complete your company profile setup. You will need to submit your company details, compliance documents, and banking information before you can receive RFQ invitations.`,
      subSubText: notification.metadata?.password ? `Your login credentials:\nEmail: ${notification.metadata.email}\nTemporary Password: ${notification.metadata.password}\n\nImportant: After signing in, please complete your company profile and submit all required documentation.` : null,
      actionButtonText: 'Sign In & Complete Profile',
      actionButtonLink: `${baseUrl}/login`
    },
    supplier_approved: {
      subject: 'Supplier Account Approved - FosssilProcure',
      headingText: 'Your Supplier Account Has Been Approved!',
      subText: notification.message,
      actionButtonText: 'Access Supplier Dashboard',
      actionButtonLink: `${baseUrl}/app`
    },

    // Requisitions
    requisition_submitted: {
      subject: 'Requisition Submitted - Requires Review',
      headingText: 'Requisition Submitted',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/procurement/requisitions/${notification.entityId}`
    },
    requisition_approved: {
      subject: 'Requisition Approved',
      headingText: 'Requisition Approved',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/requisitions/${notification.entityId}`
    },
    requisition_rejected: {
      subject: 'Requisition Rejected',
      headingText: 'Requisition Rejected',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/requisitions/${notification.entityId}`
    },
    requisition_accepted: {
      subject: 'Requisition Accepted',
      headingText: 'Requisition Accepted',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/requisitions/${notification.entityId}`
    },
    requisition_rejected_procurement: {
      subject: 'Requisition Rejected by Procurement',
      headingText: 'Requisition Rejected',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/requisitions/${notification.entityId}`
    },

    // RFQ
    rfq_published: {
      subject: `New RFQ Invitation - ${notification.metadata?.rfqNumber || 'RFQ'}`,
      headingText: 'New RFQ Published',
      subText: notification.message,
      subSubText: notification.metadata?.deadline ? `Submission Deadline: ${new Date(notification.metadata.deadline).toLocaleDateString()}` : null,
      actionButtonText: 'View RFQ & Submit Quotation',
      actionButtonLink: `${baseUrl}/app/supplier/rfqs/${notification.entityId}`
    },

    // Quotations
    quotation_submitted: {
      subject: 'New Quotation Received',
      headingText: 'New Quotation Received',
      subText: notification.message,
      actionButtonText: 'Review Quotation',
      actionButtonLink: `${appUrl}/procurement/quotations/${notification.entityId}`
    },
    quotation_accepted: {
      subject: 'Quotation Accepted',
      headingText: 'Quotation Accepted',
      subText: notification.message,
      actionButtonText: 'View Quotation',
      actionButtonLink: `${baseUrl}/app/supplier/quotations/${notification.entityId}`
    },
    quotation_rejected: {
      subject: 'Quotation Rejected',
      headingText: 'Quotation Rejected',
      subText: notification.message,
      actionButtonText: 'View Quotation',
      actionButtonLink: `${baseUrl}/app/supplier/quotations/${notification.entityId}`
    },

    // Purchase Orders
    po_created: {
      subject: 'New Purchase Order Created',
      headingText: 'New Purchase Order',
      subText: notification.message,
      actionButtonText: notification.metadata?.isSupplier ? 'View Purchase Order' : 'Review Purchase Order',
      actionButtonLink: notification.metadata?.isSupplier
        ? `${baseUrl}/app/supplier/purchase-orders/${notification.entityId}`
        : `${appUrl}/procurement/purchase-orders/${notification.entityId}`
    },
    po_finance_approved: {
      subject: 'Purchase Order Approved by Finance',
      headingText: 'PO Approved by Finance',
      subText: notification.message,
      actionButtonText: 'View Purchase Order',
      actionButtonLink: `${appUrl}/procurement/purchase-orders/${notification.entityId}`
    },
    po_finance_rejected: {
      subject: 'Purchase Order Rejected by Finance',
      headingText: 'PO Rejected by Finance',
      subText: notification.message,
      actionButtonText: 'View Purchase Order',
      actionButtonLink: `${appUrl}/procurement/purchase-orders/${notification.entityId}`
    },
    po_coo_approved: {
      subject: 'Purchase Order Fully Approved',
      headingText: 'PO Fully Approved',
      subText: notification.message,
      actionButtonText: notification.metadata?.isSupplier ? 'View Purchase Order' : 'View Purchase Order',
      actionButtonLink: notification.metadata?.isSupplier
        ? `${baseUrl}/app/supplier/purchase-orders/${notification.entityId}`
        : `${appUrl}/procurement/purchase-orders/${notification.entityId}`
    },
    po_coo_rejected: {
      subject: 'Purchase Order Rejected by COO',
      headingText: 'PO Rejected by COO',
      subText: notification.message,
      actionButtonText: 'View Purchase Order',
      actionButtonLink: `${appUrl}/procurement/purchase-orders/${notification.entityId}`
    },

    // Goods & Deliveries
    goods_received: {
      subject: 'Goods Received - Ready for Collection',
      headingText: 'Goods Received',
      subText: notification.message,
      subSubText: notification.metadata?.grvNumber ? `GRV Number: ${notification.metadata.grvNumber}` : null,
      actionButtonText: 'Request from Stores',
      actionButtonLink: `${appUrl}/department/requisitions/${notification.entityId}`
    },
    delivery_accepted: {
      subject: 'Delivery Accepted',
      headingText: 'Delivery Accepted',
      subText: notification.message,
      actionButtonText: 'View Delivery',
      actionButtonLink: `${baseUrl}/app/supplier/deliveries/${notification.entityId}`
    },
    delivery_rejected: {
      subject: 'Delivery Rejected',
      headingText: 'Delivery Rejected',
      subText: notification.message,
      actionButtonText: 'View Delivery',
      actionButtonLink: `${baseUrl}/app/supplier/deliveries/${notification.entityId}`
    },

    // Store Requisitions
    store_requisition_created: {
      subject: 'New Store Requisition',
      headingText: 'New Store Requisition',
      subText: notification.message,
      actionButtonText: 'Review Requisition',
      actionButtonLink: `${appUrl}/stores/requisitions/${notification.entityId}`
    },
    store_requisition_approved: {
      subject: 'Store Requisition Approved',
      headingText: 'Store Requisition Approved',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/store-requisitions/${notification.entityId}`
    },
    store_requisition_rejected: {
      subject: 'Store Requisition Rejected',
      headingText: 'Store Requisition Rejected',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/store-requisitions/${notification.entityId}`
    },
    stock_issued: {
      subject: 'Stock Issued',
      headingText: 'Stock Issued',
      subText: notification.message,
      actionButtonText: 'View Requisition',
      actionButtonLink: `${appUrl}/department/store-requisitions/${notification.entityId}`
    },

    // Alerts
    low_stock: {
      subject: 'Low Stock Alert',
      headingText: 'Low Stock Alert',
      subText: notification.message,
      actionButtonText: 'View Inventory',
      actionButtonLink: `${appUrl}/stores/inventory`
    },
    rfq_deadline_approaching: {
      subject: 'RFQ Deadline Approaching',
      headingText: 'RFQ Deadline Approaching',
      subText: notification.message,
      actionButtonText: 'Submit Quotation',
      actionButtonLink: `${baseUrl}/app/supplier/rfqs/${notification.entityId}`
    }
  };

  return contentMap[notification.type] || null;
};

export {
  sendEmailNotification,
  sendNotificationEmail,
  getUserEmail
};
