import {Translate} from '../i18n';

export type ExamKind = 'dtm' | 'attestation' | 'ielts' | 'cefr' | 'custom';

/** The exam a student is counting down to. `date` is a local calendar date, yyyy-mm-dd. */
export interface Exam {
  kind: ExamKind;
  label: string;
  date: string;
}

export const EXAM_KINDS: Array<{kind: ExamKind; name: string}> = [
  {kind: 'dtm', name: 'DTM'},
  {kind: 'attestation', name: 'Final exams'},
  {kind: 'ielts', name: 'IELTS'},
  {kind: 'cefr', name: 'CEFR'},
  {kind: 'custom', name: 'Other'},
];

export function examName(exam: Exam, t: Translate): string {
  if (exam.kind === 'custom') {
    return exam.label.trim() || t('Exam');
  }
  const known = EXAM_KINDS.find(item => item.kind === exam.kind);
  return known ? t(known.name) : t('Exam');
}

/** Whole calendar days from today to the exam; 0 on the day, negative once it has passed. */
export function daysUntil(date: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const exam = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam - today) / 86_400_000);
}
