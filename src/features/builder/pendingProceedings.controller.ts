// controllers/pendingProceedings.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/Apperror';
import PDFDocument from 'pdfkit';
import {
  createSubmission,
  updateSubmission,
  getSubmissionById,
  getSubmissions,
  deleteSubmission,
  getStationReport,
  getSubmissionStats,
  getAdminDashboardStats,
  generateReportData,
  validateProceedingItems,
} from './pendingProceedings.service';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  getSubmissionSchema,
  deleteSubmissionSchema,
  getSubmissionsSchema,
  getStationReportSchema,
  downloadReportSchema,
  getAdminDashboardSchema,
} from './pendingProceedings.validation';
import { PENDING_PROCEEDINGS_CATEGORIES } from './pendingProceedings.types';
import { catchAsync } from '../../utils/catchasync';
import { query } from '../../config/db';

// ============================================================
// Helper to get user from database
// ============================================================

const getUserFromDb = async (userId: string): Promise<{ fullName: string; email: string } | null> => {
  try {
    const result = await query(
      `SELECT full_name, email FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length > 0) {
      return {
        fullName: result.rows[0].full_name || 'Unknown User',
        email: result.rows[0].email || 'unknown@email.com',
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching user from DB:', error);
    return null;
  }
};

// ============================================================
// CREATE SUBMISSION
// ============================================================

export const createSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = createSubmissionSchema.parse(req);

    const courtOfAppealValidation = validateProceedingItems(
      validated.body.courtOfAppeal,
      'Pending Proceedings to Court of Appeal'
    );
    if (!courtOfAppealValidation.valid) {
      throw new AppError(courtOfAppealValidation.errors.join('; '), 400);
    }

    const subordinateCourtsValidation = validateProceedingItems(
      validated.body.subordinateCourts,
      'Pending Proceedings from Subordinate Courts'
    );
    if (!subordinateCourtsValidation.valid) {
      throw new AppError(subordinateCourtsValidation.errors.join('; '), 400);
    }

    const authUser = req.user as { id: string; email?: string; role?: string } | undefined;

    let userId = authUser?.id;
    let fullName = 'Unknown User';
    let email = authUser?.email || 'unknown@email.com';

    if (userId) {
      const userFromDb = await getUserFromDb(userId);
      if (userFromDb) {
        fullName = userFromDb.fullName;
        email = userFromDb.email || email;
        console.log('✅ Fetched user from DB:', { userId, fullName, email });
      } else {
        console.warn('⚠️ User not found in DB:', userId);
      }
    }

    console.log('📤 Creating submission with:', { userId, fullName, email });

    const submission = await createSubmission(
      validated.body,
      userId,
      { fullName, email }
    );

    res.status(201).json({
      success: true,
      data: {
        submission: submission
      },
      message: 'Submission created successfully',
    });
  }
);

// ============================================================
// UPDATE SUBMISSION
// ============================================================

export const updateSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = updateSubmissionSchema.parse(req);

    if (validated.body.courtOfAppeal) {
      const validation = validateProceedingItems(
        validated.body.courtOfAppeal,
        'Pending Proceedings to Court of Appeal'
      );
      if (!validation.valid) {
        throw new AppError(validation.errors.join('; '), 400);
      }
    }

    if (validated.body.subordinateCourts) {
      const validation = validateProceedingItems(
        validated.body.subordinateCourts,
        'Pending Proceedings from Subordinate Courts'
      );
      if (!validation.valid) {
        throw new AppError(validation.errors.join('; '), 400);
      }
    }

    const submission = await updateSubmission(
      validated.params.id,
      validated.body
    );

    res.status(200).json({
      success: true,
      data: {
        submission: submission
      },
      message: 'Submission updated successfully',
    });
  }
);

// ============================================================
// GET SUBMISSION BY ID
// ============================================================

export const getSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getSubmissionSchema.parse(req);

    const submission = await getSubmissionById(validated.params.id);

    res.status(200).json({
      success: true,
      data: {
        submission: submission
      },
    });
  }
);

// ============================================================
// GET SUBMISSIONS (List)
// ============================================================

export const getSubmissionsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getSubmissionsSchema.parse(req);

    const result = await getSubmissions(validated.query);

    res.status(200).json({
      success: true,
      data: {
        submissions: result.submissions,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
    });
  }
);

// ============================================================
// DELETE SUBMISSION
// ============================================================

export const deleteSubmissionController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = deleteSubmissionSchema.parse(req);

    await deleteSubmission(validated.params.id);

    res.status(200).json({
      success: true,
      message: 'Submission deleted successfully',
    });
  }
);

// ============================================================
// GET STATION REPORT
// ============================================================

export const getStationReportController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getStationReportSchema.parse(req);

    const result = await getStationReport(validated.query);

    res.status(200).json({
      success: true,
      data: {
        report: result.report,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasMore: result.hasMore,
        },
      },
    });
  }
);

// ============================================================
// GET SUBMISSION STATS
// ============================================================

export const getSubmissionStatsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const stats = await getSubmissionStats();

    res.status(200).json({
      success: true,
      data: {
        stats: stats,
      },
    });
  }
);

// ============================================================
// GET ADMIN DASHBOARD
// ============================================================

export const getAdminDashboardController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = getAdminDashboardSchema.parse(req);

    const stats = await getAdminDashboardStats();

    res.status(200).json({
      success: true,
      data: {
        data: stats,
      },
    });
  }
);

// ============================================================
// DOWNLOAD REPORT
// ============================================================

export const downloadReportController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const validated = downloadReportSchema.parse(req);

    const { format = 'pdf', fromDate, toDate } = validated.query;

    const reportData = await generateReportData(fromDate, toDate);

    // For JSON format, return JSON
    if (format === 'json') {
      return res.status(200).json({
        success: true,
        data: reportData,
        format: 'json',
      });
    }

    // For DOCX, return HTML (Word compatible)
    if (format === 'docx') {
      const { rows, summary } = reportData;
      
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="UTF-8">
          <title>Pending Proceedings Report</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .title-main { font-size: 18pt; font-weight: bold; color: #1e3a5f; text-transform: uppercase; }
            .title-sub { font-size: 12pt; font-weight: 600; color: #475569; }
            .divider { border-bottom: 2px solid #1e3a5f; margin: 15px 0; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f8fafc; }
            .summary-table td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
            .summary-label { font-size: 8pt; font-weight: bold; color: #475569; text-transform: uppercase; }
            .summary-value { font-size: 14pt; font-weight: bold; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .data-table th { background-color: #1e3a5f; color: #ffffff; font-size: 8pt; font-weight: bold; padding: 8px; border: 1px solid #1e3a5f; }
            .data-table td { font-size: 8pt; padding: 8px; border: 1px solid #e2e8f0; }
            .data-table tr:nth-child(even) { background-color: #f8fafc; }
            .badge-submitted { color: #065f46; font-weight: bold; }
            .badge-pending { color: #4b5563; font-weight: bold; }
            .badge-nil { color: #8b5cf6; font-weight: bold; }
            .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 30px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-main">Pending Proceedings Report</div>
            <div class="title-sub">Generated: ${new Date().toLocaleString()}</div>
          </div>
          <div class="divider"></div>
          
          <h3>Summary</h3>
          <table class="summary-table">
            <tr>
              <td><div class="summary-label">Total Stations</div><div class="summary-value">${summary.totalStations}</div></td>
              <td><div class="summary-label">Submitted</div><div class="summary-value" style="color: #10b981;">${summary.submitted}</div></td>
              <td><div class="summary-label">Not Submitted</div><div class="summary-value" style="color: #ef4444;">${summary.notSubmitted}</div></td>
              <td><div class="summary-label">Court of Appeal</div><div class="summary-value">${summary.totalCourtOfAppeal}</div></td>
              <td><div class="summary-label">Subordinate Courts</div><div class="summary-value">${summary.totalSubordinateCourts}</div></td>
              <td><div class="summary-label">Completion Rate</div><div class="summary-value">${summary.completionRate}%</div></td>
            </tr>
            <tr>
              <td colspan="6" style="background-color: #f3f0ff;">
                <div class="summary-label">Nil Returns</div>
                <div class="summary-value" style="color: #8b5cf6;">${summary.nilReturnCount || 0}</div>
              </td>
            </tr>
          </table>
          
          <h3>Station Details</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align: left;">Station</th>
                <th style="text-align: left;">DR</th>
                <th style="text-align: center;">Court of Appeal</th>
                <th style="text-align: center;">Subordinate Courts</th>
                <th style="text-align: center;">Total</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: center;">Nil Return</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => {
                const status = row['Submission Status'] || 'Not Submitted';
                const isSubmitted = status === 'Submitted';
                const isNil = row['Nil Return'] || false;
                return `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td><strong>${row['Station'] || '-'}</strong></td>
                    <td>${row['Assigned DR'] || '-'}</td>
                    <td style="text-align: center;">${row['Court of Appeal Items'] || 0}</td>
                    <td style="text-align: center;">${row['Subordinate Courts Items'] || 0}</td>
                    <td style="text-align: center;"><strong>${row['Total Items'] || 0}</strong></td>
                    <td style="text-align: center;" class="${isSubmitted ? 'badge-submitted' : 'badge-pending'}">
                      ${isSubmitted ? '✓ Submitted' : '○ Not Submitted'}
                    </td>
                    <td style="text-align: center;" class="${isNil ? 'badge-nil' : ''}">
                      ${isNil ? '⚠️ Nil Return' : '—'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">Social Transformation through Access to Justice — Justice Be Our Shield and Defender</div>
        </body>
        </html>
      `;

      const filename = `pending-proceedings-report-${new Date().toISOString().split('T')[0]}.doc`;
      res.setHeader('Content-Type', 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(htmlContent);
      return;
    }

    // For PDF format, generate actual PDF using pdfkit
    if (format === 'pdf') {
      const { rows, summary } = reportData;
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: 'Pending Proceedings Report',
          Author: 'Court System',
          Subject: 'Pending Proceedings Summary',
          CreationDate: new Date(),
        },
      });

      const filename = `pending-proceedings-report-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      doc.pipe(res);

      // Logo URL
      const logoUrl = 'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg';
      let logoBuffer: Buffer | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(logoUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          logoBuffer = Buffer.from(arrayBuf);
        }
      } catch {
        console.warn('⚠️ Could not load logo image');
      }

      // --- Header ---
      let currentY = 30;
      if (logoBuffer) {
        doc.image(logoBuffer, 257, currentY, { width: 80 });
        currentY += 85;
      } else {
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a5f').text('JUDICIARY', 0, currentY, { align: 'center' });
        doc.fontSize(9).font('Helvetica').fillColor('#4B5563').text('REPUBLIC OF KENYA', 0, currentY + 18, { align: 'center' });
        currentY += 40;
      }

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e3a5f').text('OFFICE OF THE REGISTRAR', 0, currentY, { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#374151').text('HIGH COURT OF KENYA', 0, currentY + 16, { align: 'center' });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('PENDING PROCEEDINGS REPORT', 0, currentY + 32, { align: 'center' });

      currentY += 50;

      // Accent Lines
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
      doc.moveTo(40, currentY + 3).lineTo(555, currentY + 3).strokeColor('#c59b27').lineWidth(1).stroke();

      // Contact Info
      currentY += 10;
      doc.fontSize(7.5).font('Helvetica').fillColor('#4B5563')
        .text('Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi', 0, currentY, { align: 'center' })
        .text('Tel: +254 0730 181478 | Email: registrar@highcourt.go.ke | www.judiciary.go.ke', 0, currentY + 11, { align: 'center' });

      currentY += 26;
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

      // Metadata
      currentY += 8;
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6B7280')
        .text(`Generated: ${new Date().toLocaleString()}`, 0, currentY, { align: 'center' });

      // --- Summary ---
      currentY += 22;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('EXECUTIVE SUMMARY', 40, currentY);

      currentY += 14;
      const summaryX = 40;
      const summaryWidth = 515;
      const colWidth = summaryWidth / 6;

      doc.roundedRect(summaryX, currentY, summaryWidth, 42, 4).fillAndStroke('#F8FAFC', '#E2E8F0');

      const summaryLabels = ['Total Stations', 'Submitted', 'Not Submitted', 'Court of Appeal', 'Subordinate Courts', 'Completion'];
      const summaryValues = [
        String(summary.totalStations),
        String(summary.submitted),
        String(summary.notSubmitted),
        summary.totalCourtOfAppeal.toLocaleString(),
        summary.totalSubordinateCourts.toLocaleString(),
        `${summary.completionRate}%`
      ];

      summaryLabels.forEach((label, i) => {
        const cellX = summaryX + (i * colWidth);
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text(label.toUpperCase(), cellX, currentY + 8, { width: colWidth, align: 'center' });
        
        let valColor = '#0F172A';
        if (i === 1) valColor = '#10B981';
        if (i === 2) valColor = '#EF4444';
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor(valColor).text(summaryValues[i], cellX, currentY + 22, { width: colWidth, align: 'center' });
      });

      // Add Nil Return row to summary
      currentY += 46;
      doc.fontSize(8).font('Helvetica').fillColor('#64748B')
        .text(`Nil Returns: ${summary.nilReturnCount || 0}`, 40, currentY, { align: 'left' });

      // --- Table ---
      currentY += 20;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a5f').text('STATION DETAILS', 40, currentY);
      currentY += 15;

      const tableX = 40;
      const columns = [
        { label: '#', width: 25, align: 'center' },
        { label: 'Station', width: 115, align: 'left' },
        { label: 'Assigned DR', width: 105, align: 'left' },
        { label: 'Court of Appeal', width: 55, align: 'center' },
        { label: 'Subordinate Courts', width: 55, align: 'center' },
        { label: 'Total', width: 45, align: 'center' },
        { label: 'Status', width: 60, align: 'center' },
        { label: 'Nil Return', width: 55, align: 'center' },
      ];

      const drawTableHeader = (yPos: number) => {
        let x = tableX;
        doc.rect(tableX, yPos, 515, 20).fill('#1e3a5f');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
        
        columns.forEach(col => {
          doc.text(col.label, x + 4, yPos + 6, { width: col.width - 8, align: col.align as any });
          x += col.width;
        });
        return yPos + 20;
      };

      currentY = drawTableHeader(currentY);

      // Table rows
      rows.forEach((row, index) => {
        if (currentY > 730) {
          doc.addPage();
          currentY = 40;
          currentY = drawTableHeader(currentY);
        }

        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(tableX, currentY, 515, 18).fill('#F8FAFC');
        }

        const status = row['Submission Status'] || 'Not Submitted';
        const isSubmitted = status === 'Submitted';
        const isNil = row['Nil Return'] || false;

        let x = tableX;
        doc.fontSize(7.5).font('Helvetica').fillColor('#1E293B');

        // Index
        doc.text(String(index + 1), x + 4, currentY + 5, { width: columns[0].width - 8, align: 'center' });
        x += columns[0].width;

        // Station
        doc.text(row['Station'] || '-', x + 4, currentY + 5, { width: columns[1].width - 8, align: 'left' });
        x += columns[1].width;

        // DR
        doc.text(row['Assigned DR'] || '-', x + 4, currentY + 5, { width: columns[2].width - 8, align: 'left' });
        x += columns[2].width;

        // Court of Appeal
        doc.text(String(row['Court of Appeal Items'] || 0), x + 4, currentY + 5, { width: columns[3].width - 8, align: 'center' });
        x += columns[3].width;

        // Subordinate Courts
        doc.text(String(row['Subordinate Courts Items'] || 0), x + 4, currentY + 5, { width: columns[4].width - 8, align: 'center' });
        x += columns[4].width;

        // Total
        doc.font('Helvetica-Bold').text(String(row['Total Items'] || 0), x + 4, currentY + 5, { width: columns[5].width - 8, align: 'center' });
        x += columns[5].width;

        // Status
        const statusColor = isSubmitted ? '#10B981' : '#9CA3AF';
        const statusTextColor = isSubmitted ? '#065F46' : '#4B5563';
        doc.circle(x + 12, currentY + 8.5, 3).fill(statusColor);
        doc.fillColor(statusTextColor).text(status, x + 18, currentY + 5, { width: columns[6].width - 20, align: 'left' });
        x += columns[6].width;

        // Nil Return
        if (isNil) {
          doc.fillColor('#8B5CF6').text('⚠️ Yes', x + 4, currentY + 5, { width: columns[7].width - 8, align: 'center' });
        } else {
          doc.fillColor('#9CA3AF').text('—', x + 4, currentY + 5, { width: columns[7].width - 8, align: 'center' });
        }

        currentY += 18;
      });

      doc.moveTo(tableX, currentY).lineTo(tableX + 515, currentY).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // --- Footer ---
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        const pageHeight = doc.page.height;
        const footerY = pageHeight - 30;

        doc.moveTo(40, footerY - 18).lineTo(555, footerY - 18).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        doc
          .fontSize(7.5)
          .font('Helvetica-Oblique')
          .fillColor('#9CA3AF')
          .text('Social Transformation through Access to Justice — Justice Be Our Shield and Defender', 40, footerY - 10, {
            width: 515,
            align: 'center',
          });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#6B7280')
          .text(`Page ${i + 1} of ${totalPages}`, 40, footerY, {
            width: 515,
            align: 'right',
          });
      }

      doc.end();
      return;
    }

    // Fallback: return JSON
    res.status(200).json({
      success: true,
      data: reportData,
      format: 'json',
    });
  }
);

// ============================================================
// GET AVAILABLE CATEGORIES
// ============================================================

export const getCategoriesController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const categories = Object.keys(PENDING_PROCEEDINGS_CATEGORIES).map((key) => ({
      category: key,
      items: PENDING_PROCEEDINGS_CATEGORIES[key as keyof typeof PENDING_PROCEEDINGS_CATEGORIES],
    }));

    res.status(200).json({
      success: true,
      data: {
        data: categories,
      },
    });
  }
);

// ============================================================
// GET ITEMS BY CATEGORY
// ============================================================

export const getItemsByCategoryController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const category = Array.isArray(req.params.category) 
      ? req.params.category[0] 
      : req.params.category;

    if (!category) {
      throw new AppError('Category parameter is required', 400);
    }

    const categories = Object.keys(PENDING_PROCEEDINGS_CATEGORIES);
    if (!categories.includes(category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${categories.join(', ')}`,
        400
      );
    }

    const items = PENDING_PROCEEDINGS_CATEGORIES[category as keyof typeof PENDING_PROCEEDINGS_CATEGORIES];

    res.status(200).json({
      success: true,
      data: {
        data: {
          category,
          items,
        },
      },
    });
  }
);

// ============================================================
// BULK CREATE/UPDATE SUBMISSIONS
// ============================================================

export const bulkUpsertSubmissionsController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { submissions } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      throw new AppError('Submissions array is required and must not be empty', 400);
    }

    const authUser = req.user as { id: string; email?: string; role?: string } | undefined;
    const userId = authUser?.id;
    let fullName = 'Unknown User';
    let email = authUser?.email || 'unknown@email.com';

    if (userId) {
      const userFromDb = await getUserFromDb(userId);
      if (userFromDb) {
        fullName = userFromDb.fullName;
        email = userFromDb.email || email;
        console.log('✅ Fetched user from DB for bulk:', { userId, fullName, email });
      } else {
        console.warn('⚠️ User not found in DB for bulk:', userId);
      }
    }

    const results = [];
    const errors = [];

    for (const submission of submissions) {
      try {
        const courtOfAppealValidation = validateProceedingItems(
          submission.courtOfAppeal || [],
          'Pending Proceedings to Court of Appeal'
        );
        if (!courtOfAppealValidation.valid) {
          errors.push({
            station: submission.station,
            error: courtOfAppealValidation.errors.join('; '),
          });
          continue;
        }

        const subordinateCourtsValidation = validateProceedingItems(
          submission.subordinateCourts || [],
          'Pending Proceedings from Subordinate Courts'
        );
        if (!subordinateCourtsValidation.valid) {
          errors.push({
            station: submission.station,
            error: subordinateCourtsValidation.errors.join('; '),
          });
          continue;
        }

        const existing = await getSubmissionById(submission.id).catch(() => null);

        let result;
        if (existing) {
          result = await updateSubmission(submission.id, {
            station: submission.station,
            courtOfAppeal: submission.courtOfAppeal,
            subordinateCourts: submission.subordinateCourts,
          });
        } else {
          result = await createSubmission(
            {
              station: submission.station,
              courtOfAppeal: submission.courtOfAppeal || [],
              subordinateCourts: submission.subordinateCourts || [],
            },
            userId,
            { fullName, email }
          );
        }

        results.push(result);
      } catch (error) {
        errors.push({
          station: submission.station,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        data: {
          results,
          errors,
          summary: {
            total: submissions.length,
            successful: results.length,
            failed: errors.length,
          },
        },
      },
    });
  }
);

// ============================================================
// EXPORT
// ============================================================

export default {
  createSubmissionController,
  updateSubmissionController,
  getSubmissionController,
  getSubmissionsController,
  deleteSubmissionController,
  getStationReportController,
  getSubmissionStatsController,
  getAdminDashboardController,
  downloadReportController,
  getCategoriesController,
  getItemsByCategoryController,
  bulkUpsertSubmissionsController,
};