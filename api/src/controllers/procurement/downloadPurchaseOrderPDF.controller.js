const { PurchaseOrder } = require('../../models');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Helper function to format currency
function formatCurrency(amount, currency = 'USD') {
  if (!amount) return '0.00';
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  if (currency === 'ZWG') {
    return `ZWG ${formatted}`;
  }
  if (currency === 'ZAR') {
    return `R ${formatted}`;
  }
  return `$${formatted}`;
}

const downloadPurchaseOrderPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await PurchaseOrder.findById(id)
      .populate('supplier', 'companyName contactEmail contactPhone address')
      .populate('createdBy', 'firstName lastName email')
      .populate('quotation', 'quotationNumber currency')
      .populate('rfq', 'rfqNumber title')
      .populate('purchaseRequisition', 'requisitionNumber title')
      .lean();

    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Create PDF with smaller margins for more content
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 40,
      info: {
        Title: `Purchase Order ${order.poNumber}`,
        Author: 'Fossil Contracting',
        Subject: 'Purchase Order'
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO-${order.poNumber}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Colors
    const primaryColor = '#193019';
    const lightGray = '#f5f5f5';
    const darkGray = '#666666';
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredHeight) => {
      if (yPos + requiredHeight > pageHeight - 60) {
        // Add footer before new page
        addFooter();
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper function to add footer
    const addFooter = () => {
      const footerY = pageHeight - 30;
      doc.fontSize(7)
        .fillColor(darkGray)
        .text('Fossil Contracting - Procurement Management System', margin, footerY, { 
          align: 'center', 
          width: contentWidth 
        });
    };

    // Header Section
    doc.rect(0, 0, pageWidth, 100)
      .fill(primaryColor);

    // Try to load logo
    const logoPath = path.join(__dirname, '../../../../client/public/fossilLogo.png');
    let logoLoaded = false;
    
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, margin, 15, { width: 50, height: 50 });
        logoLoaded = true;
      } catch (error) {
        console.log('Could not load logo:', error.message);
      }
    }

    // Company Info
    const textStartX = logoLoaded ? margin + 60 : margin;
    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('FOSSIL CONTRACTING', textStartX, 20);

    doc.fontSize(9)
      .font('Helvetica')
      .text('Procurement Management System', textStartX, 42);

    // PO Number - Right aligned
    doc.fontSize(22)
      .font('Helvetica-Bold')
      .text('PURCHASE ORDER', margin, 25, { align: 'right', width: contentWidth });

    doc.fontSize(16)
      .text(order.poNumber, margin, 50, { align: 'right', width: contentWidth });

    // Reset color
    doc.fillColor('#000000');
    yPos = 110;

    // Date and Status
    const currentDate = new Date().toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    doc.fontSize(9)
      .fillColor(darkGray)
      .text('Date:', margin, yPos)
      .fillColor('#000000')
      .text(currentDate, margin + 40, yPos);

    doc.fillColor(darkGray)
      .text('Status:', margin + 250, yPos)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text(order.status?.toUpperCase().replace('_', ' ') || 'DRAFT', margin + 300, yPos);

    yPos += 25;

    // Divider
    doc.moveTo(margin, yPos)
      .lineTo(pageWidth - margin, yPos)
      .strokeColor(primaryColor)
      .lineWidth(1)
      .stroke();

    yPos += 15;

    // Supplier and Delivery Address (Side by side)
    const col1Width = contentWidth / 2 - 10;
    const col2X = margin + col1Width + 20;

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('SUPPLIER', margin, yPos);
    
    doc.text('DELIVERY ADDRESS', col2X, yPos);
    
    yPos += 15;
    doc.fontSize(9)
      .font('Helvetica')
      .text(order.supplier?.companyName || 'N/A', margin, yPos, { width: col1Width });

    if (order.supplier?.address) {
      const address = typeof order.supplier.address === 'string' 
        ? order.supplier.address 
        : `${order.supplier.address.street || ''}\n${order.supplier.address.city || ''}, ${order.supplier.address.province || ''}\n${order.supplier.address.postalCode || ''}`;
      doc.text(address, margin, yPos + 12, { width: col1Width });
    }

    if (order.deliveryAddress) {
      const deliveryAddr = typeof order.deliveryAddress === 'string'
        ? order.deliveryAddress
        : `${order.deliveryAddress.street || ''}\n${order.deliveryAddress.city || ''}, ${order.deliveryAddress.province || ''}\n${order.deliveryAddress.postalCode || ''}`;
      doc.text(deliveryAddr, col2X, yPos, { width: col1Width });
    } else {
      doc.text('To be specified', col2X, yPos);
    }

    // Calculate supplier section height
    let supplierHeight = 15;
    if (order.supplier?.address) supplierHeight += 30;
    if (order.supplier?.contactEmail) supplierHeight += 12;
    if (order.supplier?.contactPhone) supplierHeight += 12;
    
    yPos += Math.max(supplierHeight, 40);
    yPos += 10;

    // Items Table Header
    checkPageBreak(40);
    
    doc.moveTo(margin, yPos)
      .lineTo(pageWidth - margin, yPos)
      .strokeColor(primaryColor)
      .lineWidth(1.5)
      .stroke();

    // Table header background
    doc.rect(margin, yPos + 2, contentWidth, 22)
      .fill(primaryColor);

    doc.fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#ffffff')
      .text('#', margin + 5, yPos + 8)
      .text('DESCRIPTION', margin + 25, yPos + 8)
      .text('QTY', margin + 320, yPos + 8)
      .text('UNIT PRICE', margin + 370, yPos + 8)
      .text('TOTAL', margin + 450, yPos + 8, { width: 105, align: 'right' });

    doc.fillColor('#000000');
    yPos += 28;

    // Items
    order.items?.forEach((item, index) => {
      const itemHeight = 25; // Base height per item
      checkPageBreak(itemHeight + 5);

      // Alternating row background
      if (index % 2 === 0) {
        doc.rect(margin, yPos - 2, contentWidth, itemHeight)
          .fillColor(lightGray)
          .fill()
          .fillColor('#000000');
      }

      // Item number
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .text(`${index + 1}.`, margin + 5, yPos + 5);

      // Description
      const description = item.description || 'N/A';
      const specs = item.specifications ? `\n${item.specifications}` : '';
      doc.fontSize(8)
        .font('Helvetica')
        .text(description + specs, margin + 25, yPos + 5, { 
          width: 290,
          lineGap: 2
        });

      // Quantity
      doc.text(`${item.quantity} ${item.unit || 'Each'}`, margin + 320, yPos + 5, { width: 45 });

      // Unit Price
      doc.text(formatCurrency(item.unitPrice, order.currency || order.quotation?.currency || 'USD'), 
        margin + 370, yPos + 5, { width: 75, align: 'right' });

      // Total
      doc.font('Helvetica-Bold')
        .text(formatCurrency(item.totalPrice || item.quantity * item.unitPrice, order.currency || order.quotation?.currency || 'USD'), 
          margin + 450, yPos + 5, { width: 105, align: 'right' });
      doc.font('Helvetica');

      yPos += itemHeight;
    });

    yPos += 10;

    // Summary Section
    checkPageBreak(80);

    // Divider
    doc.moveTo(margin, yPos)
      .lineTo(pageWidth - margin, yPos)
      .strokeColor(primaryColor)
      .lineWidth(1)
      .stroke();

    yPos += 10;

    // Summary box
    const summaryBoxWidth = 200;
    const summaryBoxX = pageWidth - margin - summaryBoxWidth;

    doc.rect(summaryBoxX, yPos, summaryBoxWidth, 60)
      .strokeColor(primaryColor)
      .lineWidth(1)
      .stroke();

    let summaryY = yPos + 8;

    if (order.subtotal) {
      doc.fontSize(9)
        .text('Subtotal:', summaryBoxX + 10, summaryY, { width: 90, align: 'right' })
        .text(formatCurrency(order.subtotal, order.currency || order.quotation?.currency || 'USD'), 
          summaryBoxX + 100, summaryY, { width: 90, align: 'right' });
      summaryY += 12;
    }

    if (order.vatAmount) {
      doc.text('VAT:', summaryBoxX + 10, summaryY, { width: 90, align: 'right' })
        .text(formatCurrency(order.vatAmount, order.currency || order.quotation?.currency || 'USD'), 
          summaryBoxX + 100, summaryY, { width: 90, align: 'right' });
      summaryY += 12;
    }

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('TOTAL:', summaryBoxX + 10, summaryY, { width: 90, align: 'right' })
      .text(formatCurrency(order.totalAmount, order.currency || order.quotation?.currency || 'USD'), 
        summaryBoxX + 100, summaryY, { width: 90, align: 'right' });

    yPos += 70;

    // Additional Information
    checkPageBreak(100);

    let infoY = yPos;
    const infoColWidth = (contentWidth - 20) / 2;

    // Left column
    if (order.paymentTerms) {
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Payment Terms:', margin, infoY)
        .font('Helvetica')
        .text(order.paymentTerms, margin, infoY + 12, { width: infoColWidth });
      infoY += 30;
    }

    if (order.expectedDeliveryDate) {
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Expected Delivery:', margin, infoY)
        .font('Helvetica')
        .text(new Date(order.expectedDeliveryDate).toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }), margin, infoY + 12);
      infoY += 30;
    }

    // Right column
    if (order.rfq?.rfqNumber) {
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Related RFQ:', margin + infoColWidth + 20, yPos)
        .font('Helvetica')
        .text(order.rfq.rfqNumber, margin + infoColWidth + 20, yPos + 12);
    }

    if (order.quotation?.quotationNumber) {
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Quotation #:', margin + infoColWidth + 20, yPos + 30)
        .font('Helvetica')
        .text(order.quotation.quotationNumber, margin + infoColWidth + 20, yPos + 42);
    }

    // Terms and Notes (if they fit)
    if (order.termsAndConditions || order.notes) {
      checkPageBreak(60);
      yPos = Math.max(infoY, yPos + 50);
      
      if (order.termsAndConditions) {
        doc.fontSize(9)
          .font('Helvetica-Bold')
          .text('Terms & Conditions:', margin, yPos)
          .font('Helvetica')
          .text(order.termsAndConditions, margin, yPos + 12, { width: contentWidth });
        yPos += 40;
      }

      if (order.notes) {
        doc.fontSize(9)
          .font('Helvetica-Bold')
          .text('Notes:', margin, yPos)
          .font('Helvetica')
          .text(order.notes, margin, yPos + 12, { width: contentWidth });
      }
    }

    // Add final footer
    addFooter();

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Generate PO PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF'
      });
    }
  }
};

module.exports = downloadPurchaseOrderPDF;
