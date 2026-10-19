export type ImportedQuestionType = 'MULTIPLE_CHOICE' | 'CODE' | 'ESSAY' | 'VIDEO'

export interface ImportedQuestion {
  id: string
  question: string
  type: ImportedQuestionType
  options: string[]
  correctAnswer: string
  weight: number
}

export interface QuestionImportResult {
  questions: ImportedQuestion[]
  errors: string[]
}

export const MAX_QUESTIONS = 100

const TYPE_ALIASES: Record<string, ImportedQuestionType> = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  MULTIPLECHOICE: 'MULTIPLE_CHOICE',
  MCQ: 'MULTIPLE_CHOICE',
  CODE: 'CODE',
  CODING: 'CODE',
  ESSAY: 'ESSAY',
  VIDEO: 'VIDEO',
}

export const QUESTION_CSV_TEMPLATE = [
  'question,type,options,correct_answer,weight',
  '"Which hook runs after every render?",MULTIPLE_CHOICE,useState|useEffect|useMemo|useRef,useEffect,10',
  '"Write a function that reverses a string.",CODE,,,20',
  '"Describe a time you resolved a conflict in your team.",ESSAY,,,15',
  '"Record a 2 minute introduction and paste the link.",VIDEO,,,5',
].join('\r\n')

/** RFC 4180-style parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_')

/** Turns CSV text into validated questions. Rows with problems are skipped and reported by line number. */
export function importQuestionsFromCsv(text: string, maxQuestions = MAX_QUESTIONS): QuestionImportResult {
  const rows = parseCsv(text)
  const errors: string[] = []
  if (rows.length === 0) return { questions: [], errors: ['The file is empty.'] }

  const header = rows[0].map(normaliseHeader)
  const col = (name: string) => header.indexOf(name)
  const iQuestion = col('question')
  const iType = col('type')
  const iOptions = col('options')
  const iCorrect = col('correct_answer')
  const iWeight = col('weight')
  if (iQuestion === -1) {
    return { questions: [], errors: ['Missing a "question" column. Download the template to see the expected format.'] }
  }

  const questions: ImportedQuestion[] = []
  for (let r = 1; r < rows.length; r++) {
    const line = r + 1
    const cells = rows[r]
    const get = (i: number) => (i === -1 ? '' : (cells[i] ?? '').trim())

    const question = get(iQuestion)
    if (!question) {
      errors.push(`Row ${line}: question is empty.`)
      continue
    }
    if (question.length > 8000) {
      errors.push(`Row ${line}: question is longer than 8000 characters.`)
      continue
    }

    const rawType = get(iType).toUpperCase().replace(/[\s-]+/g, '_')
    const type = rawType ? TYPE_ALIASES[rawType] : 'MULTIPLE_CHOICE'
    if (!type) {
      errors.push(`Row ${line}: unknown type "${get(iType)}". Use MULTIPLE_CHOICE, CODE, ESSAY or VIDEO.`)
      continue
    }

    const rawWeight = get(iWeight)
    const weight = rawWeight === '' ? 10 : Number(rawWeight)
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
      errors.push(`Row ${line}: weight must be a whole number from 1 to 100.`)
      continue
    }

    let options: string[] = []
    let correctAnswer = ''
    if (type === 'MULTIPLE_CHOICE') {
      options = get(iOptions).split('|').map((o) => o.trim()).filter(Boolean)
      if (options.length < 2) {
        errors.push(`Row ${line}: a multiple choice question needs at least 2 options separated by "|".`)
        continue
      }
      if (options.some((o) => o.length > 1000)) {
        errors.push(`Row ${line}: an option is longer than 1000 characters.`)
        continue
      }
      const rawCorrect = get(iCorrect)
      const letterIndex = /^[A-Za-z]$/.test(rawCorrect) ? rawCorrect.toUpperCase().charCodeAt(0) - 65 : -1
      const match =
        options.find((o) => o.toLowerCase() === rawCorrect.toLowerCase()) ?? options[letterIndex]
      if (!rawCorrect || !match) {
        errors.push(`Row ${line}: correct_answer must match one of the options (or be its letter, A, B, ...).`)
        continue
      }
      correctAnswer = match
    }

    questions.push({ id: crypto.randomUUID(), question, type, options, correctAnswer, weight })
  }

  if (questions.length > maxQuestions) {
    errors.push(`Only the first ${maxQuestions} questions were imported; an assessment can have at most ${maxQuestions}.`)
    questions.length = maxQuestions
  }
  return { questions, errors }
}
