/**
 * web/simulator.js
 * Multi-format Exam Simulator: study mode, timed exam mode, Caderno de Erros, and 5 question renderers.
 */
import {
  evaluateAnswer,
  calculateQuizScore,
  createOrderingStart,
  examSecondsLeft,
  filterQuestions,
  shuffleExamQuestions
} from './quiz-core.js';
import { completeConceptPractice, createDefaultProgress, STORAGE_KEY } from './progress-core.js';
import { renderNextStudyLink } from './study-guide.js';

const domainLabels = {
  'containerized-solutions': 'Contêineres',
  'data-management': 'Dados e IA',
  'connect-and-consume': 'Conexão e eventos',
  'secure-monitor-troubleshoot': 'Segurança e monitoramento',
};
const domainGuideSections = {
  'containerized-solutions': 'conteineres-no-azure',
  'data-management': 'dados-para-ia',
  'connect-and-consume': 'integracao-com-servicos',
  'secure-monitor-troubleshoot': 'seguranca-monitoramento-e-diagnostico',
};
const questionTypeLabels = {
  'single-choice': 'Escolha uma alternativa',
  'multiple-choice': 'Escolha várias alternativas',
  'code-completion': 'Complete o código',
  'ordering': 'Ordene as etapas',
  'case-study': 'Estudo de caso',
};
const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => htmlEntities[character]);

function readSavedProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch {}
  return {};
}

export function renderSimulatorView(container, { questions = [], catalog = [], blueprint, mockExam }, urlParams = new URLSearchParams(), base = './') {
  const conceptSlug = urlParams.get('concept');
  const isPractice = urlParams.has('concept');
  const concept = isPractice ? catalog.find(item => item.type === 'concept' && item.slug === conceptSlug) : null;
  const practiceIds = new Set(concept?.questionIds);
  const articleLink = concept ? `<a class="article-back" href="${base}${concept.url}">← Voltar ao artigo</a>` : '';
  const practiceResults = new Map();
  const orderingStarts = new Map();
  const caseTabs = new Map();
  const failedQuestions = new Set();
  const isExam = !isPractice && urlParams.get('mode') === 'exam';
  const defaultMode = isExam ? 'exam' : 'study';
  const onlyMistakes = !isPractice && !isExam && urlParams.get('errors') === 'true';
  const mockQuestions = mockExam?.questions || [];
  const studyBank = onlyMistakes ? [...questions, ...shuffleExamQuestions(mockQuestions)] : questions;
  const durationMinutes = blueprint?.exam?.durationMinutes ?? 120;
  const examMarks = new Set();
  let initialLang = 'all';

  // Read current progress
  let progressState = { ...createDefaultProgress(), ...readSavedProgress() };
  try {
    if (!isPractice) initialLang = urlParams.get('lang') || (!onlyMistakes && localStorage.getItem('azure_ai_200_sdk_lang')) || 'all';
  } catch {}

  const errorNotebook = progressState.errorNotebook || {};
  const mistakesList = Object.keys(errorNotebook);

  let activeFilters = {
    language: initialLang,
    domain: urlParams.get('domain') || 'all',
    onlyMistakes,
    mistakesList
  };

  let currentQuestions = isPractice
    ? questions.filter(question => practiceIds.has(question.id))
    : isExam ? shuffleExamQuestions(mockQuestions) : filterQuestions(studyBank, activeFilters);

  let userAnswers = {};
  let currentIdx = 0;
  let examDeadline = null;
  let timerInterval = null;
  let examFinished = false;

  if (isExam && currentQuestions.length) renderExamIntro();
  else renderSetupOrActiveScreen();
  return () => clearInterval(timerInterval);

  function renderExamIntro() {
    container.innerHTML = `
      <header class="concept-header">
        <h1>Simulado cronometrado AI-200</h1>
        <p>${currentQuestions.length} questões originais · ${durationMinutes} minutos · quatro áreas do exame</p>
      </header>
      <div class="quiz-card">
        <p>Faça a tentativa em uma sessão. Você pode marcar questões e voltar a elas antes de entregar. A correção e os links de revisão aparecem depois da entrega.</p>
        <div class="exam-prep-actions">
          <button type="button" id="start-exam" class="study-start">Iniciar simulado</button>
          <a class="recall-toggle-btn" href="${base}preparacao/index.html">Voltar à preparação</a>
        </div>
      </div>`;
    container.querySelector('#start-exam').addEventListener('click', () => {
      examDeadline = Date.now() + durationMinutes * 60_000;
      timerInterval = setInterval(updateExamTimer, 1000);
      renderQuestionScreen();
      container.querySelector('.quiz-stem')?.focus();
    });
  }

  function renderSetupOrActiveScreen() {
    if (currentQuestions.length === 0) {
      container.innerHTML = `
        <div class="quiz-card" style="text-align: center; padding: 48px 24px;">
          <h2>Nenhuma questão encontrada</h2>
          <p style="color: var(--text-muted); margin: 12px 0;">
            ${isExam ? 'O banco do simulado está indisponível no momento.' : isPractice ? 'As questões deste artigo estão indisponíveis no momento.' : onlyMistakes
              ? 'Não há erros registrados neste navegador. Faça um simulado para começar.'
              : 'Nenhuma questão corresponde aos filtros selecionados.'}
          </p>
          <div style="display: flex; justify-content: center; gap: 10px; margin-top: 16px;">
            ${isExam ? `<a href="${base}preparacao/index.html" class="recall-toggle-btn">Voltar à preparação</a>` : isPractice ? `${articleLink}<a href="${base}simulator/index.html" class="recall-toggle-btn">Abrir o modo estudo</a>` : `
              <a href="#simulator" class="recall-toggle-btn">Limpar Filtros</a>
              <a href="#/" class="recall-toggle-btn">Ir para Trilhas</a>`}
          </div>
        </div>
      `;
      return;
    }

    renderQuestionScreen();
  }

  function formatTime(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function renderExamTimer() {
    return `<span role="timer" id="exam-timer" class="exam-timer" aria-label="Tempo restante">${formatTime(examSecondsLeft(examDeadline))}</span>`;
  }

  function updateExamTimer() {
    const remaining = examSecondsLeft(examDeadline);
    const timer = container.querySelector('#exam-timer');
    if (timer) timer.textContent = formatTime(remaining);
    if (!remaining) renderExamSummary(true);
  }

  function renderQuestionScreen() {
    if (isExam && !examSecondsLeft(examDeadline)) return renderExamSummary(true);
    const q = currentQuestions[currentIdx];
    const isLast = currentIdx === currentQuestions.length - 1;
    const isFlagged = isExam ? examMarks.has(q.id) : Boolean(errorNotebook[q.id]?.flagged);

    container.innerHTML = `
      <div class="concept-header">
        ${isPractice ? `${articleLink}<h1>Prática do artigo</h1>` : ''}
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge badge-domain">${domainLabels[q.exam_domain] || 'Geral'}</span>
            <span class="badge badge-diff">${questionTypeLabels[q.type] || q.type}</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-left: 8px;">
              Questão ${currentIdx + 1} de ${currentQuestions.length}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${isPractice || isExam ? '' : `<select id="simulator-lang-filter" class="slot-select" style="font-size: 12px; padding: 4px 8px;" aria-label="Linguagem das questões">
              <option value="all" ${activeFilters.language === 'all' ? 'selected' : ''}>Todas as linguagens</option>
              <option value="python" ${activeFilters.language === 'python' ? 'selected' : ''}>Python SDK</option>
              <option value="csharp" ${activeFilters.language === 'csharp' ? 'selected' : ''}>C# (.NET) SDK</option>
              <option value="agnostic" ${activeFilters.language === 'agnostic' ? 'selected' : ''}>Sem linguagem específica</option>
            </select>`}
            ${isExam ? renderExamTimer() : ''}
            <button id="flag-review-btn" class="recall-toggle-btn" aria-pressed="${isFlagged}">${isFlagged ? '🚩 Marcada' : '🏳️ Marcar'}</button>
          </div>
        </div>
      </div>

      <div class="quiz-card">
        <h2 class="quiz-stem" tabindex="-1">${escapeHtml(q.stem || q.prompt || q.title)}</h2>
        <fieldset id="question-renderer-mount" class="practice-answers" aria-label="Resposta à questão">
          ${renderSpecificQuestionType(q, userAnswers[q.id])}
        </fieldset>
        
        <div id="feedback-card-mount" aria-live="polite"></div>

        <div class="exam-question-actions">
          <button id="prev-q-btn" class="recall-toggle-btn" ${currentIdx === 0 ? 'disabled' : ''}>← Anterior</button>
          <div style="display: flex; gap: 8px;">
            ${defaultMode === 'study' ? `<button id="submit-answer-btn" class="recall-toggle-btn" style="background-color: var(--accent); color: #fff;">Conferir resposta</button>` : ''}
            <button id="next-q-btn" class="recall-toggle-btn" style="background-color: var(--accent); color: #fff;" ${isPractice && !practiceResults.has(q.id) ? 'disabled' : ''}>
              ${isLast ? (isPractice ? 'Ver resultado' : isExam ? 'Revisar questões' : 'Ver resultado do estudo') : 'Próxima →'}
            </button>
          </div>
        </div>
        ${isExam && !isLast ? '<button type="button" id="open-exam-review" class="recall-toggle-btn">Ir à revisão</button>' : ''}
      </div>
    `;

    attachQuestionInteractions(q);
    if (practiceResults.has(q.id)) showFeedback(practiceResults.get(q.id));
  }

  function renderSpecificQuestionType(q, savedAnswer) {
    switch (q.type) {
      case 'single-choice':
        return `
          <div class="options-list" role="radiogroup" aria-label="Alternativas">
            ${(q.options || []).map((opt, i) => `
              <label class="option-item ${savedAnswer === i ? 'selected' : ''}" data-index="${i}">
                <input type="radio" name="opt-${q.id}" class="option-input" value="${i}" ${savedAnswer === i ? 'checked' : ''}>
                <span class="option-text">${escapeHtml(opt.text)}</span>
              </label>
            `).join('')}
          </div>
        `;

      case 'multiple-choice': {
        const selected = Array.isArray(savedAnswer) ? savedAnswer : [];
        const count = q.select_count || 2;
        return `
          <div style="margin-bottom: 12px; font-size: 13px; color: var(--accent); font-weight: 600;">
            Selecione exatamente ${count} alternativas:
          </div>
          <div class="options-list" aria-label="Alternativas múltiplas">
            ${(q.options || []).map((opt, i) => `
              <label class="option-item ${selected.includes(i) ? 'selected' : ''}" data-index="${i}">
                <input type="checkbox" name="opt-${q.id}" class="option-input" value="${i}" ${selected.includes(i) ? 'checked' : ''}>
                <span class="option-text">${escapeHtml(opt.text)}</span>
              </label>
            `).join('')}
          </div>
        `;
      }

      case 'code-completion': {
        const slotsMap = savedAnswer || {};
        let renderedTemplate = escapeHtml(q.code_template);
        for (const [index, slot] of (q.slots || []).entries()) {
          const selectHtml = `
            <select class="slot-select" data-slot-id="${slot.id}" aria-label="Lacuna ${index + 1}">
              <option value="">-- Selecione --</option>
              ${slot.options.map((o, idx) => `
                <option value="${idx}" ${slotsMap[slot.id] === idx ? 'selected' : ''}>${escapeHtml(o.text)}</option>
              `).join('')}
            </select>
          `;
          renderedTemplate = renderedTemplate.replaceAll(`{{${slot.id}}}`, () => selectHtml);
        }

        return `
          <p>Escolha uma opção em cada lacuna para completar o código.</p>
          <div class="code-template-box">
            <pre><code>${renderedTemplate}</code></pre>
          </div>
        `;
      }

      case 'ordering': {
        const textById = new Map((q.items || []).map((item, index) => [item.id || `item_${index + 1}`, item.text]));
        const order = savedAnswer || getOrderingStart(q);
        return `
          <p>Use as setas para colocar as etapas na ordem pedida.</p>
          <div class="ordering-list" id="ordering-items-container-${q.id}">
            ${order.map((id, idx) => `
              <div class="ordering-item">
                <div class="ordering-item-content">
                  <span class="order-pos-badge">${idx + 1}</span>
                  <span class="ordering-text">${escapeHtml(textById.get(id))}</span>
                </div>
                <div class="order-btn-group">
                  <button type="button" class="order-btn" data-offset="-1" aria-label="Subir etapa ${idx + 1}" ${idx === 0 ? 'disabled' : ''}>▲</button>
                  <button type="button" class="order-btn" data-offset="1" aria-label="Descer etapa ${idx + 1}" ${idx === order.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      case 'case-study': {
        const activeTabIdx = caseTabs.get(q.id) ?? 0;
        const csAnswers = (savedAnswer && typeof savedAnswer === 'object') ? savedAnswer : {};
        return `
          <div class="case-study-container">
            <div class="case-study-tabs" role="tablist">
              ${(q.tabs || []).map((tab, idx) => `
                <button class="case-study-tab-btn ${idx === activeTabIdx ? 'active' : ''}" data-tab="${idx}" role="tab" aria-selected="${idx === activeTabIdx}">
                  ${escapeHtml(tab.title)}
                </button>
              `).join('')}
            </div>
            ${(q.tabs || []).map((tab, idx) => `
              <div class="case-study-pane ${idx === activeTabIdx ? '' : 'hidden'}" id="cs-pane-${idx}" role="tabpanel" ${idx !== activeTabIdx ? 'hidden' : ''}>
                ${tab.content}
              </div>
            `).join('')}
          </div>
          <div class="child-questions-section" style="margin-top: 20px;">
            <h4 style="margin-bottom: 12px;">Responda com base nas quatro abas:</h4>
            ${(q.questions || []).map((childQ, qIdx) => `
              <div class="child-question-card" data-child-id="${childQ.id}" data-child-type="${childQ.type}" style="margin-bottom: 20px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md);">
                <p style="font-weight: 600; margin-bottom: 8px;">${qIdx + 1}. ${escapeHtml(childQ.stem || childQ.prompt || childQ.title)}</p>
                <div class="child-question-mount">
                  ${renderSpecificQuestionType(childQ, csAnswers[childQ.id])}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      default:
        return `<div>Tipo de questão '${q.type}' não suportado.</div>`;
    }
  }

  function getOrderingStart(q) {
    if (!orderingStarts.has(q.id)) orderingStarts.set(q.id, createOrderingStart(q.items || []));
    return orderingStarts.get(q.id);
  }

  function attachOrdering(q, answers) {
    const listId = `ordering-items-container-${q.id}`;
    const rows = document.getElementById(listId).querySelectorAll('.ordering-item');
    rows.forEach((row, index) => row.querySelectorAll('button[data-offset]').forEach(button => {
      button.addEventListener('click', () => {
        const offset = Number(button.dataset.offset);
        const target = index + offset;
        const order = [...(answers[q.id] || getOrderingStart(q))];
        [order[index], order[target]] = [order[target], order[index]];
        answers[q.id] = order;
        renderQuestionScreen();
        const moved = document.getElementById(listId).children[target];
        (moved.querySelector(`button[data-offset="${offset}"]:enabled`) || moved.querySelector('button:enabled'))?.focus();
      });
    }));
  }

  function attachChoices(mount, q, answers) {
    const inputs = Array.from(mount.querySelectorAll('.option-input'));
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const selected = inputs.filter(option => {
          option.closest('.option-item').classList.toggle('selected', option.checked);
          return option.checked;
        }).map(option => Number(option.value));
        answers[q.id] = q.type === 'single-choice' ? selected[0] : selected;
      });
    });
  }

  function attachQuestionInteractions(q) {
    // Language filter selector
    document.getElementById('simulator-lang-filter')?.addEventListener('change', (e) => {
      activeFilters.language = e.target.value;
      currentQuestions = filterQuestions(studyBank, activeFilters);
      currentIdx = 0;
      renderSetupOrActiveScreen();
    });

    if (q.type === 'single-choice' || q.type === 'multiple-choice') {
      attachChoices(container, q, userAnswers);
    }

    // Code completion slot change
    if (q.type === 'code-completion') {
      userAnswers[q.id] = userAnswers[q.id] || {};
      container.querySelectorAll('select[data-slot-id]').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const slotId = sel.dataset.slotId;
          const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
          userAnswers[q.id][slotId] = val;
        });
      });
    }

    // Ordering move up/down buttons
    if (q.type === 'ordering') {
      attachOrdering(q, userAnswers);
    }

    // Case study tab switching & dynamic child question interactions
    if (q.type === 'case-study') {
      const tabBtns = container.querySelectorAll('.case-study-tab-btn');
      const panes = container.querySelectorAll('.case-study-pane');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          caseTabs.set(q.id, Number(btn.dataset.tab));
          tabBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          panes.forEach(p => {
            p.classList.add('hidden');
            p.setAttribute('hidden', '');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          const pane = container.querySelector(`#cs-pane-${btn.dataset.tab}`);
          if (pane) {
            pane.classList.remove('hidden');
            pane.removeAttribute('hidden');
          }
        });
      });

      userAnswers[q.id] = userAnswers[q.id] || {};
      (q.questions || []).forEach(childQ => {
        const card = container.querySelector(`.child-question-card[data-child-id="${childQ.id}"]`);
        if (!card) return;

        if (childQ.type === 'single-choice' || childQ.type === 'multiple-choice') {
          attachChoices(card, childQ, userAnswers[q.id]);
        } else if (childQ.type === 'code-completion') {
          userAnswers[q.id][childQ.id] = userAnswers[q.id][childQ.id] || {};
          card.querySelectorAll('.slot-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
              const slotId = sel.dataset.slotId;
              const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
              userAnswers[q.id][childQ.id][slotId] = val;
            });
          });
        } else if (childQ.type === 'ordering') {
          attachOrdering(childQ, userAnswers[q.id]);
        }
      });
    }

    // Verify / Submit Feedback in Study Mode
    document.getElementById('submit-answer-btn')?.addEventListener('click', () => {
      evaluateCurrentAnswer(q);
    });

    // Navigation buttons
    document.getElementById('prev-q-btn')?.addEventListener('click', () => {
      if (currentIdx > 0) {
        currentIdx--;
        renderQuestionScreen();
        if (isPractice) container.querySelector('.quiz-stem')?.focus();
      }
    });

    document.getElementById('next-q-btn')?.addEventListener('click', () => {
      if (currentIdx < currentQuestions.length - 1) {
        currentIdx++;
        renderQuestionScreen();
        if (isPractice) container.querySelector('.quiz-stem')?.focus();
      } else if (isPractice) {
        renderPracticeSummary();
      } else if (isExam) {
        renderExamReview();
      } else {
        renderExamSummary();
      }
    });
    container.querySelector('#open-exam-review')?.addEventListener('click', renderExamReview);

    // Flag toggle
    document.getElementById('flag-review-btn')?.addEventListener('click', (e) => {
      if (isExam) {
        const marked = !examMarks.delete(q.id);
        if (marked) examMarks.add(q.id);
        e.currentTarget.setAttribute('aria-pressed', String(marked));
        e.currentTarget.textContent = marked ? '🚩 Marcada' : '🏳️ Marcar';
        return;
      }
      const entry = errorNotebook[q.id] || { failCount: 0, flagged: false };
      entry.flagged = !entry.flagged;
      entry.lastModified = new Date().toISOString();
      errorNotebook[q.id] = entry;
      persistState();
      e.target.setAttribute('aria-pressed', String(entry.flagged));
      e.target.textContent = entry.flagged ? '🚩 Marcada' : '🏳️ Marcar';
    });
  }

  function renderExamReview() {
    if (!examSecondsLeft(examDeadline)) return renderExamSummary(true);
    const unanswered = currentQuestions.map(question => !evaluateAnswer(question, userAnswers[question.id]).details.isAnswered);
    const blanks = unanswered.filter(Boolean).length;
    container.innerHTML = `
      <header class="concept-header">
        <h1 tabindex="-1">Revisar antes de entregar</h1>
        ${renderExamTimer()}
      </header>
      <section class="quiz-card">
        <p>${blanks} em branco · ${examMarks.size} ${examMarks.size === 1 ? 'marcada' : 'marcadas'}. Selecione uma questão para voltar a ela.</p>
        <ol class="exam-review-list">
          ${currentQuestions.map((question, index) => `<li>
            <button type="button" class="recall-toggle-btn" data-question-index="${index}">
              ${index + 1} · ${unanswered[index] ? 'Em branco' : 'Com resposta'}${examMarks.has(question.id) ? ' · Marcada' : ''}
            </button></li>`).join('')}
        </ol>
        <button type="button" id="finish-exam" class="study-start">Entregar simulado</button>
      </section>`;
    container.querySelector('h1').focus();
    container.querySelector('#finish-exam').addEventListener('click', () => renderExamSummary());
    container.querySelectorAll('[data-question-index]').forEach(button => button.addEventListener('click', () => {
      currentIdx = Number(button.dataset.questionIndex);
      renderQuestionScreen();
      container.querySelector('.quiz-stem')?.focus();
    }));
  }

  function evaluateCurrentAnswer(q) {
    const res = evaluateAnswer(q, userAnswers[q.id]);
    let instruction = '';
    if (isPractice && q.type === 'multiple-choice' && res.details.selectedIndices.length !== res.details.selectCount) {
      instruction = `Selecione ${res.details.selectCount} alternativas antes de conferir.`;
    } else if (isPractice && q.type === 'code-completion' && res.details.slotResults.some(slot => slot.selectedIndex === null)) {
      instruction = 'Preencha todas as lacunas antes de conferir.';
    } else if (!res.details.isAnswered) {
      instruction = q.type === 'ordering' ? 'Organize as etapas antes de conferir.' : 'Responda antes de conferir.';
    }
    if (instruction) {
      container.querySelector('#feedback-card-mount').textContent = instruction;
      return;
    }
    if (isPractice) practiceResults.set(q.id, res);
    showFeedback(res);
    if (isPractice) container.querySelector('.feedback-card')?.focus();

    if (!res.isCorrect && !failedQuestions.has(q.id)) {
      recordFailure(q.id);
      persistState();
    }
  }

  function recordFailure(id) {
    failedQuestions.add(id);
    const entry = errorNotebook[id] || { failCount: 0, flagged: false };
    const now = new Date().toISOString();
    errorNotebook[id] = { ...entry, failCount: (entry.failCount || 0) + 1, lastFailedAt: now, lastModified: now };
  }

  function showFeedback(res) {
    const feedbackMount = container.querySelector('#feedback-card-mount');
    feedbackMount.innerHTML = `
      <div class="feedback-card ${res.isCorrect ? 'correct' : 'incorrect'}" tabindex="-1">
        <div class="feedback-title">
          <span>${res.isCorrect ? '✅ Resposta Correta!' : '❌ Resposta Incorreta'}</span>
        </div>
        <p class="feedback-rationale"></p>
      </div>
    `;

    const options = res.details.optionsFeedback;
    if (options) {
      container.querySelectorAll('.option-item').forEach((item, index) => {
        item.classList.toggle('correct', options[index].isCorrect);
        item.classList.toggle('incorrect', options[index].isSelected && !options[index].isCorrect);
      });
    }
    appendFeedbackDetails(feedbackMount.querySelector('.feedback-rationale'), res);

    if (isPractice) {
      container.querySelector('#question-renderer-mount').disabled = true;
      container.querySelector('#submit-answer-btn').disabled = true;
      container.querySelector('#next-q-btn').disabled = false;
    }
  }

  function appendFeedbackDetails(rationale, res, question) {
    const options = res.details.optionsFeedback;
    if (options?.some(option => option.rationale)) {
      const list = document.createElement('ul');
      list.className = 'practice-feedback-list';
      options.forEach(option => {
        const item = document.createElement('li');
        item.textContent = `${option.isCorrect ? 'Correta' : 'Incorreta'} — ${option.text}${option.rationale ? ` ${option.rationale}` : ''}`;
        list.appendChild(item);
      });
      rationale.replaceWith(list);
    } else {
      rationale.textContent = question?.rationale || res.rationale;
    }

    if (res.type === 'code-completion') {
      const codeBox = document.createElement('div');
      codeBox.className = 'code-template-box';
      const solution = document.createElement('pre');
      solution.setAttribute('aria-label', 'Código de referência');
      solution.textContent = res.details.solutionRenderedCode;
      codeBox.appendChild(solution);
      rationale.after(codeBox);
    } else if (res.type === 'ordering') {
      const solution = document.createElement('ol');
      solution.className = 'practice-feedback-list';
      solution.setAttribute('aria-label', 'Ordem correta');
      res.details.positionFeedback.forEach(position => {
        const item = document.createElement('li');
        item.textContent = position.expectedText;
        solution.appendChild(item);
      });
      rationale.after(solution);
    } else if (res.type === 'case-study') {
      res.details.childResults.forEach((result, index) => {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        const status = result.isCorrect ? 'Correta' : result.details.isAnswered ? 'Incorreta' : 'Sem resposta';
        heading.textContent = `Questão ${index + 1} · ${status}`;
        const explanation = document.createElement('p');
        explanation.className = 'feedback-rationale';
        section.append(heading, explanation);
        rationale.parentElement.appendChild(section);
        const child = question?.questions[index];
        appendFeedbackDetails(explanation, result, child);
        if (child?.concept_slug) appendReviewLinks(section, child);
      });
    }
  }

  function renderPracticeSummary() {
    try {
      progressState = completeConceptPractice({ ...progressState, ...readSavedProgress() }, conceptSlug);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState));
    } catch (err) {
      console.warn('Could not save concept practice:', err);
    }
    const correct = Array.from(practiceResults.values()).filter(result => result.isCorrect).length;
    const nextLink = renderNextStudyLink(base, conceptSlug);
    container.innerHTML = `
      <section class="quiz-card">
        <h1 tabindex="-1">Prática concluída</h1>
        <p>Você acertou ${correct} de ${currentQuestions.length}.</p>
        ${nextLink ? `<p>${nextLink}</p>` : ''}
        <p>${articleLink}</p>
        <button type="button" id="retry-practice" class="recall-toggle-btn">Praticar novamente</button>
      </section>
    `;
    container.querySelector('h1').focus();
    container.querySelector('#retry-practice').addEventListener('click', () => {
      practiceResults.clear();
      orderingStarts.clear();
      failedQuestions.clear();
      userAnswers = {};
      currentIdx = 0;
      renderQuestionScreen();
      container.querySelector('.quiz-stem').focus();
    });
  }

  function appendReviewLinks(mount, question) {
    const article = catalog.find(item => item.slug === question.concept_slug);
    const links = document.createElement('div');
    links.className = 'exam-prep-actions';
    function add(href, label) {
      const link = document.createElement('a');
      link.className = 'article-back';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      links.appendChild(link);
    }
    if (article) add(`${base}${article.url}`, `Revisar · ${article.title}`);
    if (/^https:\/\/learn\.microsoft\.com\//.test(question.learn_url)) add(question.learn_url, 'Microsoft Learn ↗');
    if (links.childElementCount) mount.appendChild(links);
  }

  function renderExamSummary(timedOut = false) {
    if (examFinished) return;
    examFinished = true;
    clearInterval(timerInterval);
    timedOut ||= isExam && !examSecondsLeft(examDeadline);

    const scoreReport = calculateQuizScore(currentQuestions, userAnswers, { passingScore: 70 });

    // Record quiz attempt into history
    const quizAttempt = {
      id: `attempt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: defaultMode,
      ...(isExam && { examId: mockExam.id, unanswered: scoreReport.unanswered, timedOut }),
      total: scoreReport.total,
      correct: scoreReport.correct,
      percentage: scoreReport.percentage,
      isPassing: scoreReport.isPassing,
      domainScores: scoreReport.domainScores
    };

    const savedHistory = readSavedProgress().quizHistory ?? progressState.quizHistory;
    progressState.quizHistory = [quizAttempt, ...(Array.isArray(savedHistory) ? savedHistory : [])];

    // Record failed questions into errorNotebook
    scoreReport.questionResults.forEach(r => {
      if (!r.isCorrect && (isExam || r.details?.isAnswered) && !failedQuestions.has(r.questionId)) recordFailure(r.questionId);
    });

    persistState();

    container.innerHTML = `
      <div class="quiz-card" style="text-align: center; padding: 40px 24px;">
        <h1 tabindex="-1">${isExam ? 'Resultado do simulado' : 'Resultado do estudo'}</h1>
        <div style="font-size: 36px; font-weight: 800; color: var(--accent);">
          ${scoreReport.percentage}%
        </div>
        <p>${scoreReport.correct} de ${scoreReport.total} questões totalmente corretas · ${scoreReport.unanswered} em branco${timedOut ? ' · Tempo esgotado' : ''}</p>
        <p style="color: var(--text-muted); margin-top: 8px;">Pontuação local. Use o desempenho por área para escolher o que revisar.</p>

        <div style="margin: 24px auto; max-width: 600px; text-align: left;">
          <h2 style="margin-bottom: 12px;">Desempenho por área</h2>
          ${Object.values(scoreReport.domainScores).map(d => `
            <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span><strong>${domainLabels[d.domainId] || d.domainId}</strong> (${d.correct}/${d.total} corretas)</span>
                <span>${d.percentage}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: ${d.percentage}%;"></div>
              </div>
              ${isExam && domainGuideSections[d.domainId] ? `<a class="article-back" href="${base}preparacao/index.html#${domainGuideSections[d.domainId]}">Laboratórios e referências</a>` : ''}
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 28px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <a href="${isExam ? `${base}preparacao/index.html` : '#simulator'}" class="recall-toggle-btn">${isExam ? 'Ver recursos de preparação' : 'Voltar ao modo estudo'}</a>
          <a href="#simulator?errors=true" class="recall-toggle-btn">Revisar Caderno de Erros</a>
          <a href="${base}mastery/index.html" class="recall-toggle-btn">Ver meu progresso</a>
        </div>
      </div>
      ${isExam ? '<section class="quiz-card exam-corrections"><h2>Correção e próximos passos</h2><div id="exam-corrections"></div></section>' : ''}
    `;
    container.querySelector('h1').focus();
    if (!isExam) return;
    const corrections = container.querySelector('#exam-corrections');
    scoreReport.questionResults.forEach((result, index) => {
      const question = currentQuestions[index];
      const card = document.createElement('details');
      const label = document.createElement('summary');
      const status = result.isCorrect ? 'Correta' : result.details.isAnswered ? 'Revisar' : 'Em branco';
      label.textContent = `${index + 1} · ${question.title} · ${status}`;
      const stem = document.createElement('p');
      stem.textContent = question.stem || question.prompt;
      const explanation = document.createElement('p');
      card.append(label, stem, explanation);
      appendFeedbackDetails(explanation, result, question);
      appendReviewLinks(card, question);
      corrections.appendChild(card);
    });
  }

  function persistState() {
    try {
      progressState.conceptProgress = readSavedProgress().conceptProgress ?? progressState.conceptProgress;
      progressState.errorNotebook = errorNotebook;
      progressState.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState));
    } catch (err) {
      console.warn('Could not persist simulator state:', err);
    }
  }
}
