/**
 * web/quiz-core.js
 * Core engine for AI-200 question evaluation, filtering, and scoring.
 * Pure ES module: ZERO DOM and ZERO Node.js dependencies.
 */

// ==========================================
// 1. QUESTION EVALUATION LOGIC
// ==========================================

/**
 * Evaluates a single-choice question.
 * @param {object} question
 * @param {number|string|object} userAnswer Selected option index or object
 * @returns {object} Evaluation result
 */
export function evaluateSingleChoice(question, userAnswer) {
  const options = question?.options || [];
  const correctIndex = options.findIndex(o => o.correct === true);

  let selectedIndex = null;
  if (typeof userAnswer === 'number' && Number.isInteger(userAnswer)) {
    selectedIndex = userAnswer;
  } else if (typeof userAnswer === 'string' && userAnswer.trim() !== '') {
    const parsed = Number.parseInt(userAnswer.trim(), 10);
    if (!Number.isNaN(parsed)) {
      selectedIndex = parsed;
    }
  } else if (userAnswer && typeof userAnswer === 'object' && 'selectedIndex' in userAnswer) {
    selectedIndex = userAnswer.selectedIndex;
  }

  const isAnswered = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < options.length;
  const isCorrect = isAnswered && selectedIndex === correctIndex;
  const score = isCorrect ? 1 : 0;

  const selectedOption = isAnswered ? options[selectedIndex] : null;
  const correctOption = correctIndex >= 0 ? options[correctIndex] : null;

  const rationale = selectedOption?.rationale || correctOption?.rationale || '';

  return {
    questionId: question?.id || 'unknown',
    type: 'single-choice',
    isCorrect,
    score,
    rationale,
    details: {
      isAnswered,
      selectedIndex,
      correctIndex,
      selectedOptionText: selectedOption?.text || null,
      correctOptionText: correctOption?.text || null,
      optionsFeedback: options.map((opt, idx) => ({
        index: idx,
        text: opt.text,
        isSelected: idx === selectedIndex,
        isCorrect: opt.correct === true,
        rationale: opt.rationale || ''
      }))
    }
  };
}

/**
 * Evaluates a multiple-choice question.
 * @param {object} question
 * @param {Array<number|string>} userAnswer Array of selected option indices
 * @returns {object} Evaluation result
 */
export function evaluateMultipleChoice(question, userAnswer) {
  const options = question?.options || [];
  const selectCount = question?.select_count ?? question?.selectCount ?? 2;

  const correctIndices = options
    .map((opt, idx) => (opt.correct === true ? idx : -1))
    .filter(idx => idx >= 0);

  const rawSelection = Array.isArray(userAnswer)
    ? userAnswer
    : (userAnswer instanceof Set ? Array.from(userAnswer) : []);

  const selectedIndices = Array.from(
    new Set(
      rawSelection
        .map(v => (typeof v === 'string' ? Number.parseInt(v.trim(), 10) : Number(v)))
        .filter(v => Number.isInteger(v) && v >= 0 && v < options.length)
    )
  ).sort((a, b) => a - b);

  const isAnswered = selectedIndices.length > 0;
  const matchedIndices = selectedIndices.filter(idx => options[idx]?.correct === true);
  const falsePositiveIndices = selectedIndices.filter(idx => !options[idx]?.correct);

  const isCorrect = selectedIndices.length === correctIndices.length &&
                    matchedIndices.length === correctIndices.length;

  const score = isCorrect ? 1 : 0;
  const partialScore = correctIndices.length > 0
    ? Math.max(0, (matchedIndices.length - falsePositiveIndices.length) / correctIndices.length)
    : 0;

  const rationaleParts = [];
  selectedIndices.forEach(idx => {
    const opt = options[idx];
    if (opt?.rationale) {
      rationaleParts.push(`Opção ${idx + 1} (${opt.correct ? 'Correta' : 'Incorreta'}): ${opt.rationale}`);
    }
  });

  return {
    questionId: question?.id || 'unknown',
    type: 'multiple-choice',
    isCorrect,
    score,
    rationale: rationaleParts.join(' | ') || (isCorrect ? 'Todas as opções corretas foram selecionadas.' : 'Seleção incorreta ou incompleta.'),
    details: {
      isAnswered,
      selectCount,
      selectedIndices,
      correctIndices,
      matchedIndices,
      falsePositiveIndices,
      partialScore: Math.round(partialScore * 100) / 100,
      optionsFeedback: options.map((opt, idx) => ({
        index: idx,
        text: opt.text,
        isSelected: selectedIndices.includes(idx),
        isCorrect: opt.correct === true,
        rationale: opt.rationale || ''
      }))
    }
  };
}

/**
 * Evaluates a code-completion question.
 * @param {object} question
 * @param {Record<string, number|string>} userAnswer Map of slotId -> optionIndex or optionText
 * @returns {object} Evaluation result
 */
export function evaluateCodeCompletion(question, userAnswer) {
  const slots = question?.slots || [];
  const codeTemplate = question?.code_template || '';
  const userAnswersMap = userAnswer && typeof userAnswer === 'object' ? userAnswer : {};

  const totalSlots = slots.length;
  let correctSlotsCount = 0;
  let answeredSlotsCount = 0;

  const slotResults = slots.map(slot => {
    const slotId = slot.id;
    const options = slot.options || [];
    const correctOptIndex = options.findIndex(o => o.correct === true);
    const correctOpt = correctOptIndex >= 0 ? options[correctOptIndex] : null;

    const userVal = userAnswersMap[slotId];
    let selectedIndex = null;
    let selectedText = null;

    if (typeof userVal === 'number' && Number.isInteger(userVal) && userVal >= 0 && userVal < options.length) {
      selectedIndex = userVal;
      selectedText = options[selectedIndex]?.text || '';
    } else if (typeof userVal === 'string' && userVal.trim() !== '') {
      const parsed = Number.parseInt(userVal.trim(), 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < options.length) {
        selectedIndex = parsed;
        selectedText = options[selectedIndex]?.text || '';
      } else {
        const trimmed = userVal.trim();
        const foundIdx = options.findIndex(o => o.text.trim() === trimmed);
        if (foundIdx >= 0) {
          selectedIndex = foundIdx;
          selectedText = options[foundIdx].text;
        } else {
          selectedText = trimmed;
        }
      }
    }

    const isSlotAnswered = selectedIndex !== null || selectedText !== null;
    if (isSlotAnswered) answeredSlotsCount++;

    const isSlotCorrect = selectedIndex !== null
      ? selectedIndex === correctOptIndex
      : (selectedText !== null && correctOpt !== null && selectedText.trim() === correctOpt.text.trim());

    if (isSlotCorrect) correctSlotsCount++;

    return {
      slotId,
      isAnswered: isSlotAnswered,
      isCorrect: isSlotCorrect,
      selectedIndex,
      selectedText,
      correctIndex: correctOptIndex,
      correctText: correctOpt?.text || '',
      rationale: (selectedIndex !== null ? options[selectedIndex]?.rationale : null) || correctOpt?.rationale || ''
    };
  });

  const isAnswered = answeredSlotsCount > 0;
  const isCorrect = totalSlots > 0 && correctSlotsCount === totalSlots;
  const score = isCorrect ? 1 : 0;
  const partialScore = totalSlots > 0 ? (correctSlotsCount / totalSlots) : 0;

  let userRenderedCode = codeTemplate;
  let solutionRenderedCode = codeTemplate;

  slotResults.forEach(res => {
    const phRegex = new RegExp(`\\{\\{${res.slotId}\\}\\}`, 'g');
    userRenderedCode = userRenderedCode.replace(phRegex, res.selectedText || `/* ${res.slotId} */`);
    solutionRenderedCode = solutionRenderedCode.replace(phRegex, res.correctText);
  });

  const rationale = slotResults.map(r => `[${r.slotId}]: ${r.rationale}`).join(' | ');

  return {
    questionId: question?.id || 'unknown',
    type: 'code-completion',
    isCorrect,
    score,
    rationale,
    details: {
      isAnswered,
      totalSlots,
      correctSlotsCount,
      partialScore: Math.round(partialScore * 100) / 100,
      slotResults,
      userRenderedCode,
      solutionRenderedCode
    }
  };
}

/**
 * Evaluates an ordering question.
 * @param {object} question
 * @param {Array<string|number>} userAnswer Array of ordered item IDs or indices
 * @returns {object} Evaluation result
 */
export function evaluateOrdering(question, userAnswer) {
  const rawItems = question?.items || [];

  const itemsWithId = rawItems.map((item, idx) => ({
    id: item.id || `item_${idx + 1}`,
    text: item.text,
    order: item.order,
    originalIndex: idx
  }));

  const solutionSorted = [...itemsWithId].sort((a, b) => a.order - b.order);
  const solutionIds = solutionSorted.map(it => it.id);

  const rawUserOrder = Array.isArray(userAnswer) ? userAnswer : [];

  const userItemIds = rawUserOrder.map(val => {
    if (val && typeof val === 'object') {
      if (typeof val.id === 'string' && val.id) {
        const matchById = itemsWithId.find(it => it.id === val.id);
        return matchById ? matchById.id : val.id;
      }
      if (typeof val.text === 'string') {
        const matchByText = itemsWithId.find(it => it.text === val.text);
        if (matchByText) return matchByText.id;
      }
    }
    if (typeof val === 'string') {
      const match = itemsWithId.find(it => it.id === val || it.text === val);
      return match ? match.id : val;
    }
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < itemsWithId.length) {
      return itemsWithId[val].id;
    }
    return String(val);
  });

  const isAnswered = userItemIds.length > 0;
  const totalItems = solutionIds.length;

  let correctPositionsCount = 0;
  const positionFeedback = solutionIds.map((expectedId, idx) => {
    const userPlacedId = userItemIds[idx] || null;
    const isMatch = userPlacedId === expectedId;
    if (isMatch) correctPositionsCount++;

    const expectedItem = itemsWithId.find(it => it.id === expectedId);
    const userItem = itemsWithId.find(it => it.id === userPlacedId);

    return {
      position: idx + 1,
      expectedId,
      expectedText: expectedItem?.text || '',
      placedId: userPlacedId,
      placedText: userItem?.text || '',
      isCorrect: isMatch
    };
  });

  const isCorrect = isAnswered && userItemIds.length === totalItems && correctPositionsCount === totalItems;
  const score = isCorrect ? 1 : 0;
  const partialScore = totalItems > 0 ? (correctPositionsCount / totalItems) : 0;

  const rationale = isCorrect
    ? 'Sequência perfeitamente ordenada.'
    : `${correctPositionsCount} de ${totalItems} etapas posicionadas corretamente na sequência de dependência.`;

  return {
    questionId: question?.id || 'unknown',
    type: 'ordering',
    isCorrect,
    score,
    rationale,
    details: {
      isAnswered,
      totalItems,
      correctPositionsCount,
      partialScore: Math.round(partialScore * 100) / 100,
      userOrder: userItemIds,
      solutionOrder: solutionIds,
      positionFeedback
    }
  };
}

/**
 * Evaluates a case-study question with child questions.
 * @param {object} question
 * @param {Record<string, any>|Array<any>} userAnswer Map of childId -> answer or Array
 * @returns {object} Evaluation result
 */
export function evaluateCaseStudy(question, userAnswer) {
  const childQuestions = question?.questions || [];
  const tabs = question?.tabs || [];
  const totalChildren = childQuestions.length;

  const childResults = childQuestions.map((childQ, idx) => {
    let childAns;
    if (userAnswer && typeof userAnswer === 'object') {
      if (childQ.id in userAnswer) {
        childAns = userAnswer[childQ.id];
      } else if (Array.isArray(userAnswer)) {
        childAns = userAnswer[idx];
      }
    }
    return evaluateAnswer(childQ, childAns);
  });

  const correctChildrenCount = childResults.filter(r => r.isCorrect).length;
  const totalChildPoints = childResults.reduce((acc, r) => acc + (r.score || 0), 0);

  const isAnswered = childResults.some(r => r.details?.isAnswered === true);
  const isCorrect = totalChildren > 0 && correctChildrenCount === totalChildren;
  const score = totalChildren > 0 ? (correctChildrenCount / totalChildren) : 0;

  return {
    questionId: question?.id || 'unknown',
    type: 'case-study',
    isCorrect,
    score: isCorrect ? 1 : Math.round(score * 100) / 100,
    rationale: `Estudo de Caso: ${correctChildrenCount}/${totalChildren} questões filhas respondidas com sucesso.`,
    details: {
      isAnswered,
      totalChildren,
      correctChildrenCount,
      totalChildPoints,
      tabs: tabs.map(t => ({ title: t.title })),
      childResults
    }
  };
}

/**
 * Universal evaluator for any of the 5 question types.
 * @param {object} question
 * @param {any} userAnswer
 * @returns {object} Evaluation result
 */
export function evaluateAnswer(question, userAnswer) {
  if (!question || typeof question !== 'object') {
    return {
      questionId: 'unknown',
      type: 'unknown',
      isCorrect: false,
      score: 0,
      rationale: 'Questão inválida ou não especificada.',
      details: { isAnswered: false, error: 'Question is null or undefined' }
    };
  }

  switch (question.type) {
    case 'single-choice':
      return evaluateSingleChoice(question, userAnswer);
    case 'multiple-choice':
      return evaluateMultipleChoice(question, userAnswer);
    case 'code-completion':
      return evaluateCodeCompletion(question, userAnswer);
    case 'ordering':
      return evaluateOrdering(question, userAnswer);
    case 'case-study':
      return evaluateCaseStudy(question, userAnswer);
    default:
      return {
        questionId: question.id || 'unknown',
        type: question.type || 'unknown',
        isCorrect: false,
        score: 0,
        rationale: `Tipo de questão desconhecido: '${question.type}'`,
        details: { isAnswered: false, error: 'Unsupported question type' }
      };
  }
}

// ==========================================
// 2. QUESTION FILTERING
// ==========================================

/**
 * Filters questions by language, domain, chapter, tags, and error notebook.
 * @param {Array<object>} questions
 * @param {object} [filters={}]
 * @returns {Array<object>} Filtered questions
 */
export function filterQuestions(questions, filters = {}) {
  if (!Array.isArray(questions)) return [];

  const {
    language = 'all',
    domain = 'all',
    chapter = 'all',
    tags = null,
    onlyMistakes = false,
    mistakesList = null,
    onlyFlagged = false,
    flaggedList = null,
    difficulty = 'all',
    search = ''
  } = filters;

  const mistakesSet = mistakesList instanceof Set
    ? mistakesList
    : new Set(Array.isArray(mistakesList) ? mistakesList : []);

  const flaggedSet = flaggedList instanceof Set
    ? flaggedList
    : new Set(Array.isArray(flaggedList) ? flaggedList : []);

  const tagList = Array.isArray(tags) ? tags : (typeof tags === 'string' && tags ? [tags] : []);
  const searchLower = typeof search === 'string' ? search.trim().toLowerCase() : '';

  return questions.filter(q => {
    if (!q || typeof q !== 'object') return false;

    // Language filter cascading
    const targetLang = (language || 'all').toLowerCase();
    if (targetLang !== 'all') {
      const qLang = (q.language || 'all').toLowerCase();
      if (targetLang === 'python') {
        if (qLang !== 'python' && qLang !== 'agnostic' && qLang !== 'all') return false;
      } else if (targetLang === 'csharp') {
        if (qLang !== 'csharp' && qLang !== 'agnostic' && qLang !== 'all') return false;
      } else if (targetLang === 'agnostic') {
        if (qLang !== 'agnostic' && qLang !== 'all') return false;
      } else {
        if (qLang !== targetLang && qLang !== 'all') return false;
      }
    }

    // Domain filter
    if (domain && domain !== 'all') {
      const domains = Array.isArray(domain) ? domain : [domain];
      if (!domains.includes(q.exam_domain)) return false;
    }

    // Chapter filter
    if (chapter && chapter !== 'all') {
      const chapters = Array.isArray(chapter) ? chapter : [chapter];
      if (!chapters.includes(q.chapter)) return false;
    }

    // Tags filter
    if (tagList.length > 0) {
      const qTags = Array.isArray(q.tags) ? q.tags : [];
      const hasAllTags = tagList.every(t => qTags.includes(t));
      if (!hasAllTags) return false;
    }

    // Difficulty filter
    if (difficulty && difficulty !== 'all') {
      if (q.difficulty !== difficulty) return false;
    }

    // Caderno de Erros (only mistakes)
    if (onlyMistakes) {
      if (!mistakesSet.has(q.id)) return false;
    }

    // Flagged questions
    if (onlyFlagged) {
      if (!flaggedSet.has(q.id)) return false;
    }

    // Free text search
    if (searchLower) {
      const textCorpus = [
        q.title || '',
        q.stem || q.prompt || '',
        ...(Array.isArray(q.tags) ? q.tags : [])
      ].join(' ').toLowerCase();
      if (!textCorpus.includes(searchLower)) return false;
    }

    return true;
  });
}

// ==========================================
// 3. SCORE CALCULATIONS
// ==========================================

/**
 * Calculates quiz score totals, percentage, passing state, and per-domain breakdown.
 * @param {Array<object>} questions
 * @param {Record<string, any>|Array<any>} userAnswers
 * @param {object} [options={}]
 * @returns {object} Score report
 */
export function calculateQuizScore(questions, userAnswers, options = {}) {
  const { passingScore = 70 } = options;
  const list = Array.isArray(questions) ? questions : [];
  const answersMap = userAnswers && typeof userAnswers === 'object' ? userAnswers : {};

  const total = list.length;
  let answered = 0;
  let correct = 0;
  let totalPoints = 0;
  const maxPoints = total;

  const domainMap = {};
  const questionResults = [];

  list.forEach((q, idx) => {
    const qId = q.id || `q_${idx}`;
    const domain = q.exam_domain || 'general';

    if (!domainMap[domain]) {
      domainMap[domain] = {
        domainId: domain,
        total: 0,
        answered: 0,
        correct: 0,
        points: 0,
        maxPoints: 0,
        percentage: 0
      };
    }

    const domainStat = domainMap[domain];
    domainStat.total += 1;
    domainStat.maxPoints += 1;

    let ans;
    if (Array.isArray(answersMap)) {
      ans = answersMap[idx];
    } else {
      ans = answersMap[qId];
    }

    const res = evaluateAnswer(q, ans);
    questionResults.push(res);

    if (res.details?.isAnswered) {
      answered += 1;
      domainStat.answered += 1;
    }

    if (res.isCorrect) {
      correct += 1;
      domainStat.correct += 1;
    }

    totalPoints += (res.score || 0);
    domainStat.points += (res.score || 0);
  });

  Object.values(domainMap).forEach(d => {
    d.percentage = d.maxPoints > 0 ? Math.round((d.points / d.maxPoints) * 1000) / 10 : 0;
  });

  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 1000) / 10 : 0;
  const isPassing = percentage >= passingScore;

  return {
    total,
    answered,
    unanswered: total - answered,
    correct,
    incorrect: answered - correct,
    totalPoints: Math.round(totalPoints * 100) / 100,
    maxPoints,
    percentage,
    passingScore,
    isPassing,
    domainScores: domainMap,
    questionResults
  };
}

/**
 * Extracts failed question IDs and metadata from evaluation results for Caderno de Erros.
 * @param {object} scoreResult Output of calculateQuizScore
 * @returns {Array<object>} Mistakes list
 */
export function extractMistakes(scoreResult) {
  if (!scoreResult || !Array.isArray(scoreResult.questionResults)) return [];
  return scoreResult.questionResults
    .filter(r => !r.isCorrect && r.details?.isAnswered)
    .map(r => ({
      questionId: r.questionId,
      type: r.type,
      score: r.score,
      rationale: r.rationale
    }));
}

/**
 * Creates an immutable Fisher-Yates shuffled copy of an array.
 * @param {Array<T>} array
 * @returns {Array<T>}
 */
export function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
