import { Report } from '../types';
import { User } from '../store/authStore';

/**
 * Normalizes a string by removing accents, special characters, and whitespace for comparison.
 */
function cleanString(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if the specified user is the owner/creator of the report.
 */
export function isReportOwner(report: Report, user: User | null): boolean {
  if (!user || !report) return false;

  // 1. Direct ID match
  if (report.userId && (report.userId === user.id || report.userId === user.email)) {
    return true;
  }

  // 2. CreatedBy field match
  if (report.createdBy) {
    const cleanCreated = cleanString(report.createdBy);
    const cleanId = cleanString(user.id);
    const cleanEmail = cleanString(user.email);
    const cleanName = cleanString(user.name);

    if (cleanCreated && (cleanCreated === cleanId || cleanCreated === cleanEmail || cleanCreated === cleanName)) {
      return true;
    }
  }

  // 3. Fallback for reports created prior to userId field:
  // Match leaderName with user's name or username/email (e.g. "Líder Matriz 1" vs "lidermatriz1")
  if (report.leaderName) {
    const cleanLeader = cleanString(report.leaderName);
    const cleanName = cleanString(user.name);
    const cleanEmail = cleanString(user.email);
    const cleanId = cleanString(user.id);

    if (cleanLeader && (cleanLeader === cleanName || cleanLeader === cleanEmail || cleanLeader === cleanId)) {
      return true;
    }

    if (cleanLeader && cleanEmail && (cleanLeader.includes(cleanEmail) || cleanEmail.includes(cleanLeader))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a user has permission to view or access a given report:
 * - Admin ONLY has access to finalized reports (status === 'FINALIZADO').
 * - Regular users ONLY have access to their own reports.
 */
export function canUserAccessReport(report: Report, user: User | null): boolean {
  if (!user || !report) return false;

  // Admin ONLY has access to finalized reports
  if (user.role === 'ADMIN') {
    return report.status === 'FINALIZADO';
  }

  // Regular users (e.g., LIDER) ONLY have access to their own reports
  return isReportOwner(report, user);
}

/**
 * Filters a list of reports to only those accessible by the given user.
 */
export function getUserAccessibleReports(reports: Report[], user: User | null): Report[] {
  if (!user || !Array.isArray(reports)) return [];
  return reports.filter(r => canUserAccessReport(r, user));
}
