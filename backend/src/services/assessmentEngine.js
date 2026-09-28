/**
 * Adaptive assessment engine.
 *
 * Responsibilities:
 *  - Build a fresh, randomized adaptive sequence per attempt.
 *    Certification sessions require a minimum number of questions and may
 *    finish early once competency evidence is strong enough, or continue
 *    until the maximum question limit when more evidence is needed.
 *  - Adapt difficulty question-to-question: after a correct answer, try to
 *    pull from a harder still-unfulfilled tier; after an incorrect answer,
 *    prefer a reinforcement question on the SAME topic/tier before moving on.
 *  - Balance topics so questions are not clustered on one sub-topic.
 *  - Randomize option order per serving (with a stored permutation) so the
 *    correct answer's on-screen position also varies between workers.
 *  - Grade every submission server-side against the question bank —
 *    the browser is never trusted with the correct answer or the score.
 *
 * All state needed to resume/adapt a session is kept in a small JSON object
 * (the session's `engine_state` column) — this module is pure/stateless.
 */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TIERS = ['easy', 'medium', 'hard'];

/**
 * Fresh engine state for a new session.
 */
export function initEngineState(blueprint) {
  return {
    blueprint,
    remaining: { easy: blueprint.easy || 0, medium: blueprint.medium || 0, hard: blueprint.hard || 0 },
    servedCount: 0,
    difficultyCounts: { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } },
    servedIds: [],
    servedTopics: {}, // topic -> count served this attempt
    lastCorrect: null,
    lastDifficulty: null,
    lastTopic: null,
    pending: null, // { questionId, perm, servedAt }
    correctCount: 0,
    incorrectCount: 0,
  };
}

export function targetQuestionCount(state) {
  return TIERS.reduce((sum, tier) => sum + (state.blueprint[tier] || 0), 0);
}

export function totalRemaining(state) {
  return TIERS.reduce((s, t) => s + (state.remaining[t] || 0), 0);
}

export function shouldComplete(state) {
  const min = Number(state.blueprint.minQuestions || targetQuestionCount(state));
  const max = Number(state.blueprint.maxQuestions || targetQuestionCount(state));
  const answered = state.servedCount || state.servedIds.length || 0;
  if (answered >= max) return true;
  if (answered < min) return false;

  const score = answered ? (state.correctCount / answered) * 100 : 0;
  const hard = state.difficultyCounts?.hard || { correct: 0, total: 0 };

  // Early completion requires stronger evidence than the normal pass threshold:
  // enough questions, >=75%, and at least one correctly answered hard question.
  // Otherwise the engine keeps sampling until maxQuestions.
  if (score >= 75 && hard.total >= 1 && hard.correct >= 1) return true;
  return false;
}

/**
 * Decide which difficulty tier to draw the next question from.
 *  - First question: easy if the blueprint has any, else medium, else hard.
 *  - After a correct answer: prefer moving UP in difficulty (hard, then
 *    medium, then easy) among tiers that still have quota remaining.
 *  - After an incorrect answer: prefer staying at the SAME tier first
 *    (reinforcement), then medium, then easy, then hard.
 */
function pickNextTier(state) {
  const has = (t) => (state.remaining[t] || 0) > 0;
  let order;
  if (state.lastCorrect === null) {
    order = ['easy', 'medium', 'hard'];
  } else if (state.lastCorrect === true) {
    order = ['hard', 'medium', 'easy'];
  } else {
    order = [state.lastDifficulty, 'medium', 'easy', 'hard'].filter(Boolean);
  }
  for (const t of order) {
    if (has(t)) return t;
  }
  return TIERS.find(has) || null;
}

/**
 * Choose a specific question for the given tier from the domain's pool,
 * excluding anything already served this attempt, preferring:
 *   1. Reinforcement: same topic as the just-missed question, if the
 *      worker just answered incorrectly and such a question exists.
 *   2. Topic balance: topics served the fewest times so far.
 */
function chooseQuestion(pool, tier, state) {
  let candidates = pool.filter((q) => q.difficulty === tier && !state.servedIds.includes(q.id));
  if (candidates.length === 0) return null;

  if (state.lastCorrect === false && state.lastTopic) {
    const reinforcement = candidates.filter((q) => q.topic === state.lastTopic);
    if (reinforcement.length > 0) candidates = reinforcement;
  } else {
    const counts = candidates.map((q) => state.servedTopics[q.topic] || 0);
    const min = Math.min(...counts);
    candidates = candidates.filter((q) => (state.servedTopics[q.topic] || 0) === min);
  }

  return shuffle(candidates)[0];
}

/**
 * Produce a randomized-option version of a question safe to send to the
 * client (no correctAnswer). Returns { displayed, perm } — perm[i] is the
 * ORIGINAL option index now shown at displayed position i.
 */
function randomizeOptions(q) {
  const n = q.options.length;
  const perm = shuffle([...Array(n).keys()]);
  const displayedOptions = perm.map((origIdx) => q.options[origIdx]);
  const displayed = {
    id: q.id,
    domain: q.domain,
    topic: q.topic,
    difficulty: q.difficulty,
    questionType: q.questionType,
    question: q.question,
    options: displayedOptions,
  };
  return { displayed, perm };
}

/**
 * Advance the engine and produce the next question to serve, or null if
 * the blueprint has been fully satisfied (assessment complete).
 * Mutates and returns a NEW state object (does not mutate the input).
 */
export function serveNext(pool, state) {
  if (shouldComplete(state)) return { state, next: null };
  const max = Number(state.blueprint.maxQuestions || targetQuestionCount(state));
  if ((state.servedCount || state.servedIds.length || 0) >= max) return { state, next: null };
  let tier = pickNextTier(state);
  if (!tier) {
    // The target quota is satisfied but the worker has not demonstrated competency.
    // Continue with an adaptive draw from any tier until min/max criteria are met.
    const availableTiers = TIERS.filter((t) => pool.some((q) => q.difficulty === t && !state.servedIds.includes(q.id)));
    if (!availableTiers.length) return { state, next: null };
    tier = state.lastCorrect === false && state.lastDifficulty && availableTiers.includes(state.lastDifficulty)
      ? state.lastDifficulty
      : (state.lastCorrect === true && availableTiers.includes('hard') ? 'hard' : availableTiers[0]);
  }
  let q = chooseQuestion(pool, tier, state);
  if (!q) {
    const fallbackTiers = TIERS.filter((t) => pool.some((candidate) => candidate.difficulty === t && !state.servedIds.includes(candidate.id)));
    for (const fallbackTier of fallbackTiers) {
      q = chooseQuestion(pool, fallbackTier, state);
      if (q) break;
    }
  }
  if (!q) return { state, next: null };

  const { displayed, perm } = randomizeOptions(q);
  const newState = {
    ...state,
    pending: { questionId: q.id, perm, servedAt: Date.now() },
  };
  return { state: newState, next: displayed };
}

/**
 * Map a client-submitted answer (indices into the DISPLAYED/shuffled
 * options) back to original option indices using the stored permutation.
 */
function toOriginalIndices(perm, submitted) {
  if (Array.isArray(submitted)) {
    return submitted.map((i) => perm[i]).filter((i) => i !== undefined);
  }
  return perm[submitted];
}

function arraysEqualUnordered(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

function arraysEqualOrdered(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Authoritative grading. `question` MUST come from the server-side
 * question bank (never trust a client-supplied correctAnswer).
 */
export function gradeAnswer(question, perm, submittedAnswer) {
  const mapped = toOriginalIndices(perm, submittedAnswer);
  if (question.questionType === 'multi-select') {
    return arraysEqualUnordered(mapped, question.correctAnswer);
  }
  if (question.questionType === 'sequence-order') {
    return arraysEqualOrdered(mapped, question.correctAnswer);
  }
  return mapped === question.correctAnswer;
}

/**
 * After grading, update engine state bookkeeping (remaining quota,
 * served history, topic-balance counters, adaptivity signals).
 */
export function recordAnswer(state, question, correct) {
  const tier = question.difficulty;
  const remaining = { ...state.remaining, [tier]: Math.max(0, (state.remaining[tier] || 0) - 1) };
  const servedTopics = { ...state.servedTopics, [question.topic]: (state.servedTopics[question.topic] || 0) + 1 };
  const difficultyCounts = {
    ...state.difficultyCounts,
    [tier]: {
      ...(state.difficultyCounts?.[tier] || { correct: 0, total: 0 }),
      total: (state.difficultyCounts?.[tier]?.total || 0) + 1,
      correct: (state.difficultyCounts?.[tier]?.correct || 0) + (correct ? 1 : 0),
    },
  };
  return {
    ...state,
    remaining,
    servedTopics,
    servedIds: [...state.servedIds, question.id],
    servedCount: (state.servedCount || state.servedIds.length || 0) + 1,
    difficultyCounts,
    lastCorrect: correct,
    lastDifficulty: tier,
    lastTopic: question.topic,
    pending: null,
    correctCount: state.correctCount + (correct ? 1 : 0),
    incorrectCount: state.incorrectCount + (correct ? 0 : 1),
  };
}

/**
 * Build the final result summary from the list of recorded answers
 * (each: { questionId, domain, topic, difficulty, correct, timeTakenMs }).
 */
export function buildResult(answers, passThreshold) {
  const total = answers.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const incorrectCount = total - correctCount;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const difficultyBreakdown = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
  const topicStats = {};
  let timeTakenMs = 0;

  for (const a of answers) {
    const bucket = difficultyBreakdown[a.difficulty] || (difficultyBreakdown[a.difficulty] = { correct: 0, total: 0 });
    bucket.total += 1;
    if (a.correct) bucket.correct += 1;

    if (!topicStats[a.topic]) topicStats[a.topic] = { correct: 0, total: 0 };
    topicStats[a.topic].total += 1;
    if (a.correct) topicStats[a.topic].correct += 1;

    timeTakenMs += a.timeTakenMs || 0;
  }

  const weakTopics = Object.entries(topicStats)
    .filter(([, s]) => s.correct < s.total)
    .sort((x, y) => (y[1].total - y[1].correct) - (x[1].total - x[1].correct))
    .slice(0, 5)
    .map(([topic, s]) => ({ topic, correct: s.correct, total: s.total }));

  const passed = score >= passThreshold;

  const recommendations = [];
  if (!passed) {
    recommendations.push('Review the explanations for missed questions before retrying.');
  }
  if (weakTopics.length > 0) {
    recommendations.push(`Focus practice on: ${weakTopics.map((w) => w.topic).join(', ')}.`);
  }
  if (difficultyBreakdown.hard.total > 0 && difficultyBreakdown.hard.correct < difficultyBreakdown.hard.total) {
    recommendations.push('Revisit hard-difficulty scenarios — these carry the most real-world risk.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Strong performance across all topics and difficulty levels.');
  }

  return {
    score,
    passed,
    correctCount,
    incorrectCount,
    totalQuestions: total,
    difficultyBreakdown,
    weakTopics,
    recommendations,
    timeTakenSeconds: Math.round(timeTakenMs / 1000),
  };
}
