export type Status = 'unanswered' | 'correct' | 'review' | 'mastered';
export type AnswerEvent = { id: string; questionId: string; correct: boolean; answeredAt: string; serverOrder?: number };
export type Progress = { status: Status; streak: number; answers: number; wrong: number; lastAnsweredAt: string | null };
export const emptyProgress = (): Progress => ({ status: 'unanswered', streak: 0, answers: 0, wrong: 0, lastAnsweredAt: null });
export function advance(previous: Progress, event: AnswerEvent): Progress {
  const streak = event.correct ? previous.streak + 1 : 0;
  const status: Status = !event.correct ? 'review' : previous.status === 'review' ? (streak >= 2 ? 'mastered' : 'review') : previous.status === 'mastered' ? 'mastered' : 'correct';
  return { status, streak, answers: previous.answers + 1, wrong: previous.wrong + Number(!event.correct), lastAnsweredAt: event.answeredAt };
}
export function summarize(events: AnswerEvent[]): Record<string, Progress> {
  const result: Record<string, Progress> = {};
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    result[event.questionId] = advance(result[event.questionId] ?? emptyProgress(), event);
  }
  return result;
}
