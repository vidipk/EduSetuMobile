import { homeworkApi } from '@/api/academics/teacher-ops';
import { AppApiError } from '@/api/client/error';
import { downloadProtectedFile, shareLocalFile } from '@/files/download';

/**
 * Opens a student's uploaded PDF for an authorized teacher.
 * 1. The detail call re-checks access on the server (and refreshes an expired access token).
 * 2. The PDF is downloaded with the bearer token in a request header into app cache.
 * 3. The system sheet lets the teacher open it in a PDF viewer.
 */
export async function openSubmissionPdf(submissionId: string) {
  const detail = await homeworkApi.submissionDetail(submissionId);
  if (!detail.fileAvailable) throw new AppApiError('This submission has no uploaded file.', 410);
  let file;
  try {
    file = await downloadProtectedFile({ url: homeworkApi.submissionFileUrl(submissionId), filename: `homework-${submissionId}.pdf` });
  } catch {
    throw new AppApiError('The PDF could not be downloaded. It may no longer be available, or the connection failed.', 410);
  }
  await shareLocalFile(file, { mimeType: 'application/pdf', dialogTitle: 'Open student PDF' });
}
