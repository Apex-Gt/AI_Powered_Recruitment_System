export const assessmentTypes = [
  { value: 'CODING', label: 'Coding' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'BEHAVIORAL', label: 'Behavioral' },
  { value: 'CUSTOM', label: 'Custom' },
]

export const questionTypes = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'CODE', label: 'Code' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'VIDEO', label: 'Video' },
]

/** Pre-filled in the editor so a new assessment starts with sensible terms the recruiter can edit. */
export const DEFAULT_TERMS = [
  'By starting this assessment you agree to the following:',
  '',
  '1. The assessment is taken once. You cannot restart it after you begin.',
  '2. Each round has its own time limit. The timer starts when you start the round and cannot be paused.',
  '3. Answers are submitted automatically when time runs out, and a submitted round cannot be reopened.',
  '4. Complete the assessment on your own, without help from other people.',
  '5. Do not copy or share the questions with anyone.',
  '6. Your answers may be reviewed by the recruiting team and scored with the help of AI.',
].join('\n')
