import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The static, hand-authored question bank: 125 validated questions
 * (25 per safety domain × 5 domains). Loaded once at process start.
 * Each question: { id, domain, topic, difficulty, questionType, question,
 * options, correctAnswer, explanation, safetyPrinciple }.
 *
 * correctAnswer is a number (index into options) for single-answer types
 * (MCQ, true-false, scenario, hazard-identification, PPE-selection), or an
 * array of indices for multi-select and sequence-order.
 */
export const QUESTION_BANK = JSON.parse(
  readFileSync(path.join(__dirname, 'questionBank.json'), 'utf-8')
);

// The 5 official certification domains, in display order. Must match
// CERTIFICATION_DOMAINS in the frontend's src/lib/scenarios.js exactly.
export const DOMAINS = [
  'Fire & Explosion Response',
  'Gas Leak & Confined Space Protocol',
  'Machinery Safety & Lockout-Tagout',
  'Electrical Hazard Response',
  'Dust & Respiratory Hazard Protection',
];

// Adaptive certification blueprint. The target mix is 2 easy + 5 medium + 3 hard,
// but the engine can finish between 8 and 15 questions depending on competency
// evidence. A worker cannot finish early without demonstrating hard-question mastery.
export const DEFAULT_BLUEPRINT = { easy: 2, medium: 5, hard: 3, minQuestions: 8, maxQuestions: 15, adaptive: true };

// A shorter, weak-topic-focused blueprint used for "Practice Weak Areas".
// Practice sessions do not count toward certification pass/fail.
export const PRACTICE_BLUEPRINT = { easy: 1, medium: 3, hard: 2, minQuestions: 6, maxQuestions: 10, adaptive: true };

export const PASS_THRESHOLD = 70; // percent

export function questionsForDomain(domain) {
  return QUESTION_BANK.filter((q) => q.domain === domain);
}

export function questionById(id) {
  return QUESTION_BANK.find((q) => q.id === id) || null;
}

export function topicsForDomain(domain) {
  return [...new Set(questionsForDomain(domain).map((q) => q.topic))];
}
