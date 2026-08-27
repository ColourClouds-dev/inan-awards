import * as XLSX from 'xlsx';
import type { Poll, PollVote } from '../types';

export function exportPollResultsToExcel(poll: Poll, votes: PollVote[]): void {
  const rows = votes.map(vote => {
    const submittedAt =
      vote.submittedAt instanceof Date
        ? vote.submittedAt.toISOString()
        : typeof (vote.submittedAt as any)?.toDate === 'function'
          ? (vote.submittedAt as any).toDate().toISOString()
          : String(vote.submittedAt);

    return {
      'Poll Title': poll.title,
      'Poll Type': poll.type === 'staff_nomination' ? 'Staff Nomination' : 'Opinion Poll',
      'Question ID': vote.questionId,
      'Selected Option / Nominee ID': vote.optionId,
      'Voter UID': vote.voterUid,
      'Voter Employee ID': vote.employeeId || '—',
      'Submitted At': submittedAt,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Votes');

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `poll-results-${poll.id}-${yyyy}-${mm}-${dd}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
