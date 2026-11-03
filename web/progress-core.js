/**
 * web/progress-core.js
 * Core engine for AI-200 study progress, weighted domain readiness,
 * localStorage schema versioning, and bidirectional conflict merge.
 * Pure ES module: ZERO DOM and ZERO Node.js dependencies.
 */

export const STORAGE_KEY = 'azure_ai_200_progress_v1';
export const SCHEMA_VERSION = 1;

/**
 * Official Microsoft AI-200 Exam Domain Weights (Study Guide updated 2026-10-30).
 * containerized-solutions: 20-25% -> midpoint 22.5%
 * data-management: 25-30% -> midpoint 27.5%
 * connect-and-consume: 20-25% -> midpoint 22.5%
 * secure-monitor-troubleshoot: 20-25% -> midpoint 22.5%
 * Sum of midpoints = 95.0% (0.95)
 */
export const OFFICIAL_DOMAIN_WEIGHTS = Object.freeze({
  'containerized-solutions': 0.225,
  'data-management': 0.275,
  'connect-and-consume': 0.225,
  'secure-monitor-troubleshoot': 0.225
});

/**
 * Progression state hierarchy:
 * mastered (3) > review (2) > studying (1) > not_started (0)
 */
export const PROGRESSION_RANKS = Object.freeze({
  'not_started': 0,
  'studying': 1,
  'review': 2,
  'mastered': 3
});

export const PROGRESSION_WEIGHTS = Object.freeze({
  'not_started': 0.0,
  'studying': 0.33,
  'review': 0.67,
  'mastered': 1.0
});

/**
 * Creates a clean default progress state adhering to schema version 1.
 * @returns {object}
 */
export function createDefaultProgress() {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    lastModified: now,
    conceptProgress: {},
    quizHistory: [],
    errorNotebook: {},
    settings: {
      preferredLanguage: 'python',
      activeRecallMode: true,
      theme: 'auto',
      speechRate: 1.0,
      lastModified: now
    }
  };
}

/**
 * Validates progress state schema structure and version.
 * @param {any} state
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProgressSchema(state) {
  const errors = [];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { valid: false, errors: ['State must be a non-null object'] };
  }

  if (state.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected ${SCHEMA_VERSION}, received ${state.schemaVersion}`);
  }

  if (typeof state.conceptProgress !== 'object' || state.conceptProgress === null || Array.isArray(state.conceptProgress)) {
    errors.push("'conceptProgress' must be an object map");
  }

  if (!Array.isArray(state.quizHistory)) {
    errors.push("'quizHistory' must be an array");
  }

  if (typeof state.errorNotebook !== 'object' || state.errorNotebook === null || Array.isArray(state.errorNotebook)) {
    errors.push("'errorNotebook' must be an object map");
  }

  if (typeof state.settings !== 'object' || state.settings === null || Array.isArray(state.settings)) {
    errors.push("'settings' must be an object map");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates domain readiness and overall readiness score weighted by official AI-200 domain weights.
 * @param {object} progressState
 * @param {object} blueprint Ementa from ai-200-blueprint.json
 * @param {Record<string, number>} [weights=OFFICIAL_DOMAIN_WEIGHTS]
 * @returns {object}
 */
export function calculateReadiness(progressState, blueprint, weights = OFFICIAL_DOMAIN_WEIGHTS) {
  const state = progressState || createDefaultProgress();
  const conceptMap = state.conceptProgress || {};
  const quizHistory = Array.isArray(state.quizHistory) ? state.quizHistory : [];

  const domains = blueprint?.domains || [
    { id: 'containerized-solutions', title: 'Containerized Solutions' },
    { id: 'data-management', title: 'Data Management' },
    { id: 'connect-and-consume', title: 'Connect and Consume' },
    { id: 'secure-monitor-troubleshoot', title: 'Secure, Monitor, Troubleshoot' }
  ];

  const domainConcepts = {};
  domains.forEach(d => {
    domainConcepts[d.id] = [];
  });

  const chapters = blueprint?.chapters || [];
  chapters.forEach(ch => {
    let domainId = ch.exam_domain;
    if (!domainId) {
      if (['01-container-hosting', '02-container-apps', '03-aks'].includes(ch.id)) {
        domainId = 'containerized-solutions';
      } else if (['04-cosmos-db-nosql', '05-postgresql-pgvector', '06-managed-redis'].includes(ch.id)) {
        domainId = 'data-management';
      } else if (['07-backend-integration'].includes(ch.id)) {
        domainId = 'connect-and-consume';
      } else if (['08-secrets-and-config', '09-observe-and-troubleshoot'].includes(ch.id)) {
        domainId = 'secure-monitor-troubleshoot';
      } else {
        domainId = 'containerized-solutions';
      }
    }

    if (!domainConcepts[domainId]) domainConcepts[domainId] = [];

    (ch.concepts || []).forEach(c => {
      domainConcepts[domainId].push({
        slug: c.slug,
        title: c.title,
        chapter: ch.id,
        domainId
      });
    });
  });

  const domainQuizStats = {};
  domains.forEach(d => {
    domainQuizStats[d.id] = { asked: 0, correct: 0 };
  });

  quizHistory.forEach(att => {
    if (att.domainScores && typeof att.domainScores === 'object') {
      Object.entries(att.domainScores).forEach(([domId, stat]) => {
        if (domainQuizStats[domId]) {
          domainQuizStats[domId].asked += (stat.total || 0);
          domainQuizStats[domId].correct += (stat.correct || 0);
        }
      });
    }
  });

  const domainReadiness = {};
  let totalWeightedScore = 0;
  let totalWeightSum = 0;

  let totalConceptsCount = 0;
  let masteredConceptsCount = 0;
  let reviewConceptsCount = 0;
  let studyingConceptsCount = 0;
  let notStartedConceptsCount = 0;

  domains.forEach(d => {
    const dId = d.id;
    const dWeight = weights[dId] ?? 0.25;
    totalWeightSum += dWeight;

    const concepts = domainConcepts[dId] || [];
    const conceptCount = concepts.length;
    totalConceptsCount += conceptCount;

    let dMastered = 0;
    let dReview = 0;
    let dStudying = 0;
    let dNotStarted = 0;
    let dScoreSum = 0;

    concepts.forEach(c => {
      const entry = conceptMap[c.slug];
      const progState = entry?.state || 'not_started';
      const weightVal = PROGRESSION_WEIGHTS[progState] ?? 0.0;
      dScoreSum += weightVal;

      if (progState === 'mastered') {
        dMastered++;
        masteredConceptsCount++;
      } else if (progState === 'review') {
        dReview++;
        reviewConceptsCount++;
      } else if (progState === 'studying') {
        dStudying++;
        studyingConceptsCount++;
      } else {
        dNotStarted++;
        notStartedConceptsCount++;
      }
    });

    const conceptMasteryRatio = conceptCount > 0 ? (dScoreSum / conceptCount) : 0;

    const qStats = domainQuizStats[dId];
    let domainScore = conceptMasteryRatio;
    let quizAccuracy = 0;

    if (qStats && qStats.asked > 0) {
      quizAccuracy = qStats.correct / qStats.asked;
      domainScore = (conceptMasteryRatio * 0.6) + (quizAccuracy * 0.4);
    }

    const domainScoreClamped = Math.max(0, Math.min(1, domainScore));
    totalWeightedScore += (domainScoreClamped * dWeight);

    domainReadiness[dId] = {
      domainId: dId,
      title: d.title,
      weight: dWeight,
      readinessScore: Math.round(domainScoreClamped * 1000) / 1000,
      percentage: Math.round(domainScoreClamped * 1000) / 10,
      conceptCount,
      masteredCount: dMastered,
      reviewCount: dReview,
      studyingCount: dStudying,
      notStartedCount: dNotStarted,
      conceptMasteryRatio: Math.round(conceptMasteryRatio * 1000) / 1000,
      quizQuestionsAnswered: qStats ? qStats.asked : 0,
      quizAccuracy: Math.round(quizAccuracy * 1000) / 1000
    };
  });

  const normalizedOverall = totalWeightSum > 0 ? (totalWeightedScore / totalWeightSum) : 0;
  const clampedOverall = Math.max(0, Math.min(1, normalizedOverall));

  const overallPercentage = Math.round(clampedOverall * 1000) / 10;
  const examScaledScore = Math.round(clampedOverall * 1000);
  const passingScore = blueprint?.exam?.passingScore || 700;
  const isPassing = examScaledScore >= passingScore;

  return {
    overallScore: Math.round(clampedOverall * 1000) / 1000,
    overallPercentage,
    examScaledScore,
    passingScore,
    isPassing,
    domainReadiness,
    summary: {
      totalConcepts: totalConceptsCount,
      masteredConcepts: masteredConceptsCount,
      reviewConcepts: reviewConceptsCount,
      studyingConcepts: studyingConceptsCount,
      notStartedConcepts: notStartedConceptsCount,
      totalQuizzesTaken: quizHistory.length,
      totalErrorsLogged: Object.keys(state.errorNotebook || {}).length
    }
  };
}

/**
 * Bidirectional field-level timestamp conflict resolution merge.
 * Progression states: mastered (3) > review (2) > studying (1) > not_started (0).
 * Union of quiz histories and error notebook items.
 * Highest lastModified timestamp wins for scalar settings.
 * @param {object} localState
 * @param {object} remoteState
 * @returns {object} Merged state adhering to schema version 1
 */
export function mergeProgress(localState, remoteState) {
  if (!localState && !remoteState) {
    return createDefaultProgress();
  }
  if (!localState) {
    return structuredClone(remoteState);
  }
  if (!remoteState) {
    return structuredClone(localState);
  }

  // 1. Concept Progress Merge (Progression lattice: 3 > 2 > 1 > 0)
  const mergedConcepts = {};
  const allConceptKeys = new Set([
    ...Object.keys(localState.conceptProgress || {}),
    ...Object.keys(remoteState.conceptProgress || {})
  ]);

  allConceptKeys.forEach(slug => {
    const localEntry = localState.conceptProgress?.[slug];
    const remoteEntry = remoteState.conceptProgress?.[slug];

    if (localEntry && !remoteEntry) {
      mergedConcepts[slug] = structuredClone(localEntry);
    } else if (!localEntry && remoteEntry) {
      mergedConcepts[slug] = structuredClone(remoteEntry);
    } else {
      const localRank = PROGRESSION_RANKS[localEntry.state] ?? -1;
      const remoteRank = PROGRESSION_RANKS[remoteEntry.state] ?? -1;

      if (localRank > remoteRank) {
        mergedConcepts[slug] = structuredClone(localEntry);
      } else if (remoteRank > localRank) {
        mergedConcepts[slug] = structuredClone(remoteEntry);
      } else {
        const localTime = Date.parse(localEntry.lastModified || 0) || 0;
        const remoteTime = Date.parse(remoteEntry.lastModified || 0) || 0;
        if (remoteTime > localTime) {
          mergedConcepts[slug] = structuredClone(remoteEntry);
        } else {
          mergedConcepts[slug] = structuredClone(localEntry);
        }
      }
    }
  });

  // 2. Quiz History Merge (Union, de-duplicated by ID/timestamp, sorted newest first)
  const quizMap = new Map();
  const localHistory = Array.isArray(localState.quizHistory) ? localState.quizHistory : [];
  const remoteHistory = Array.isArray(remoteState.quizHistory) ? remoteState.quizHistory : [];

  [...localHistory, ...remoteHistory].forEach(item => {
    if (!item) return;
    const idKey = item.id || `${item.timestamp}_${item.percentage}`;
    if (!quizMap.has(idKey)) {
      quizMap.set(idKey, structuredClone(item));
    } else {
      const existing = quizMap.get(idKey);
      const existingTime = Date.parse(existing.lastModified || existing.timestamp || 0) || 0;
      const incomingTime = Date.parse(item.lastModified || item.timestamp || 0) || 0;
      if (incomingTime > existingTime) {
        quizMap.set(idKey, structuredClone(item));
      }
    }
  });

  const mergedQuizHistory = Array.from(quizMap.values()).sort((a, b) => {
    const timeA = Date.parse(a.timestamp || 0) || 0;
    const timeB = Date.parse(b.timestamp || 0) || 0;
    return timeB - timeA;
  });

  // 3. Error Notebook Merge (Union of items with field-level reconciliation)
  const mergedErrorNotebook = {};
  const allErrorKeys = new Set([
    ...Object.keys(localState.errorNotebook || {}),
    ...Object.keys(remoteState.errorNotebook || {})
  ]);

  allErrorKeys.forEach(qId => {
    const localErr = localState.errorNotebook?.[qId];
    const remoteErr = remoteState.errorNotebook?.[qId];

    if (localErr && !remoteErr) {
      mergedErrorNotebook[qId] = structuredClone(localErr);
    } else if (!localErr && remoteErr) {
      mergedErrorNotebook[qId] = structuredClone(remoteErr);
    } else {
      const localTime = Date.parse(localErr.lastModified || 0) || 0;
      const remoteTime = Date.parse(remoteErr.lastModified || 0) || 0;
      const maxFailCount = Math.max(localErr.failCount || 0, remoteErr.failCount || 0);
      const isFlagged = Boolean(localErr.flagged || remoteErr.flagged);

      const lastFailedAt = (Date.parse(remoteErr.lastFailedAt || 0) || 0) > (Date.parse(localErr.lastFailedAt || 0) || 0)
        ? remoteErr.lastFailedAt
        : localErr.lastFailedAt;

      const newerErr = remoteTime > localTime ? remoteErr : localErr;

      mergedErrorNotebook[qId] = {
        ...structuredClone(newerErr),
        failCount: maxFailCount,
        flagged: isFlagged,
        lastFailedAt,
        lastModified: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString()
      };
    }
  });

  // 4. Settings Merge (Highest lastModified timestamp wins for scalar settings)
  const localSettingsTime = Date.parse(localState.settings?.lastModified || 0) || 0;
  const remoteSettingsTime = Date.parse(remoteState.settings?.lastModified || 0) || 0;

  const baseSettings = remoteSettingsTime > localSettingsTime
    ? (remoteState.settings || {})
    : (localState.settings || {});

  const defaultSettings = createDefaultProgress().settings;
  const mergedSettings = {
    ...defaultSettings,
    ...baseSettings,
    lastModified: new Date(Math.max(localSettingsTime, remoteSettingsTime, Date.now())).toISOString()
  };

  // 5. Global State lastModified
  const globalLocalTime = Date.parse(localState.lastModified || 0) || 0;
  const globalRemoteTime = Date.parse(remoteState.lastModified || 0) || 0;
  const globalLastModified = new Date(Math.max(globalLocalTime, globalRemoteTime, Date.now())).toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    lastModified: globalLastModified,
    conceptProgress: mergedConcepts,
    quizHistory: mergedQuizHistory,
    errorNotebook: mergedErrorNotebook,
    settings: mergedSettings
  };
}

/**
 * Serializes progress state to formatted JSON.
 * @param {object} state
 * @returns {string}
 */
export function exportProgressJson(state) {
  const target = state || createDefaultProgress();
  return JSON.stringify(target, null, 2);
}

/**
 * Parses, validates, and optionally merges imported JSON progress data.
 * @param {string} jsonString
 * @param {object} [currentState=null]
 * @returns {object}
 */
export function importProgressJson(jsonString, currentState = null) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Failed to parse progress JSON: ${err.message}`);
  }

  const valRes = validateProgressSchema(parsed);
  if (!valRes.valid) {
    throw new Error(`Invalid progress schema: ${valRes.errors.join(', ')}`);
  }

  if (currentState) {
    return mergeProgress(currentState, parsed);
  }

  return parsed;
}
