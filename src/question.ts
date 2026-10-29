import sampleQuestions from './questions.json';
export type Question = typeof sampleQuestions[number] & {
  originalExplanation?: string;
  importance?: string;
};
