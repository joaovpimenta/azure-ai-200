/**
 * web/simulator.js
 * Multi-format Exam Simulator: study mode, timed exam mode, Caderno de Erros, and 5 question renderers.
 */
import {
  evaluateAnswer,
  calculateQuizScore,
  filterQuestions,
  shuffleArray
} from './quiz-core.js';
import { STORAGE_KEY } from './progress-core.js';

export function renderSimulatorView(container, { questions, blueprint }, urlParams = new URLSearchParams()) {
  const defaultMode = urlParams.get('mode') || 'study';
  const onlyMistakes = urlParams.get('errors') === 'true';
  const initialLang = urlParams.get('lang') || localStorage.getItem('azure_ai_200_sdk_lang') || 'all';

  // Read current progress
  const progressRaw = localStorage.getItem(STORAGE_KEY);
  let progressState = { schemaVersion: 1, conceptProgress: {}, quizHistory: [], errorNotebook: {} };
  try {
    if (progressRaw) progressState = JSON.parse(progressRaw);
  } catch {}

  const errorNotebook = progressState.errorNotebook || {};
  const mistakesList = Object.keys(errorNotebook);

  let activeFilters = {
    language: initialLang,
    domain: urlParams.get('domain') || 'all',
    onlyMistakes,
    mistakesList
  };

  let currentQuestions = filterQuestions(questions || [], activeFilters);
  if (defaultMode === 'exam') {
    currentQuestions = shuffleArray(currentQuestions).slice(0, 50);
  }

  let userAnswers = {};
  let currentIdx = 0;
  let remainingSeconds = 100 * 60; // 100 minutes exam timer
  let timerInterval = null;

  renderSetupOrActiveScreen();

  function renderSetupOrActiveScreen() {
    if (currentQuestions.length === 0) {
      container.innerHTML = `
        <div class="quiz-card" style="text-align: center; padding: 48px 24px;">
          <h2>Nenhuma questão encontrada</h2>
          <p style="color: var(--text-muted); margin: 12px 0;">
            ${onlyMistakes
              ? 'Seu Caderno de Erros está limpo! Não há questões erradas registradas.'
              : 'Nenhuma questão corresponde aos filtros selecionados.'}
          </p>
          <div style="display: flex; justify-content: center; gap: 10px; margin-top: 16px;">
            <a href="#simulator" class="recall-toggle-btn">Limpar Filtros</a>
            <a href="#/" class="recall-toggle-btn">Ir para Trilhas</a>
          </div>
        </div>
      `;
      return;
    }

    if (defaultMode === 'exam' && !timerInterval) {
      startExamTimer();
    }

    renderQuestionScreen();
  }

  function startExamTimer() {
    timerInterval = setInterval(() => {
      remainingSeconds--;
      const timerEl = document.getElementById('exam-timer');
      if (timerEl) {
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }
      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        renderExamSummary();
      }
    }, 1000);
  }

  function renderQuestionScreen() {
    const q = currentQuestions[currentIdx];
    const isLast = currentIdx === currentQuestions.length - 1;
    const isFlagged = Boolean(errorNotebook[q.id]?.flagged);

    container.innerHTML = `
      <div class="concept-header">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <span class="badge badge-domain">${q.exam_domain || 'Geral'}</span>
            <span class="badge badge-diff">${q.type}</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-left: 8px;">
              Questão ${currentIdx + 1} de ${currentQuestions.length}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <select id="simulator-lang-filter" class="slot-select" style="font-size: 12px; padding: 4px 8px;">
              <option value="all" ${activeFilters.language === 'all' ? 'selected' : ''}>Todas Linguagens</option>
              <option value="python" ${activeFilters.language === 'python' ? 'selected' : ''}>Python SDK</option>
              <option value="csharp" ${activeFilters.language === 'csharp' ? 'selected' : ''}>C# (.NET) SDK</option>
              <option value="agnostic" ${activeFilters.language === 'agnostic' ? 'selected' : ''}>Agnóstico</option>
            </select>
            ${defaultMode === 'exam' ? `<span id="exam-timer" style="font-family: var(--font-mono); font-weight: 700; color: var(--warning);">100:00</span>` : ''}
            <button id="flag-review-btn" class="recall-toggle-btn">${isFlagged ? '🚩 Marcada' : '🏳️ Marcar'}</button>
          </div>
        </div>
      </div>

      <div class="quiz-card">
        <h2 class="quiz-stem">${q.stem || q.prompt || q.title}</h2>
        <div id="question-renderer-mount">
          ${renderSpecificQuestionType(q, userAnswers[q.id])}
        </div>
        
        <div id="feedback-card-mount"></div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
          <button id="prev-q-btn" class="recall-toggle-btn" ${currentIdx === 0 ? 'disabled' : ''}>← Anterior</button>
          <div style="display: flex; gap: 8px;">
            ${defaultMode === 'study' ? `<button id="submit-answer-btn" class="recall-toggle-btn" style="background-color: var(--accent); color: #fff;">Verificar Resposta</button>` : ''}
            <button id="next-q-btn" class="recall-toggle-btn" style="background-color: var(--accent); color: #fff;">
              ${isLast ? 'Finalizar Simulado' : 'Próxima →'}
            </button>
          </div>
        </div>
      </div>
    `;

    attachQuestionInteractions(q);
  }

  function renderSpecificQuestionType(q, savedAnswer) {
    switch (q.type) {
      case 'single-choice':
        return `
          <div class="options-list" role="radiogroup" aria-label="Alternativas">
            ${(q.options || []).map((opt, i) => `
              <label class="option-item ${savedAnswer === i ? 'selected' : ''}" data-index="${i}">
                <input type="radio" name="opt-${q.id}" class="option-input" value="${i}" ${savedAnswer === i ? 'checked' : ''}>
                <span class="option-text">${opt.text}</span>
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
                <span class="option-text">${opt.text}</span>
              </label>
            `).join('')}
          </div>
        `;
      }

      case 'code-completion': {
        const slotsMap = savedAnswer || {};
        let renderedTemplate = q.code_template || '';
        for (const slot of q.slots || []) {
          const selectHtml = `
            <select class="slot-select" data-slot-id="${slot.id}">
              <option value="">-- Selecione --</option>
              ${slot.options.map((o, idx) => `
                <option value="${idx}" ${slotsMap[slot.id] === idx ? 'selected' : ''}>${o.text}</option>
              `).join('')}
            </select>
          `;
          renderedTemplate = renderedTemplate.replace(new RegExp(`\\{\\{${slot.id}\\}\\}`, 'g'), selectHtml);
        }

        return `
          <div class="code-template-box">
            <pre><code>${renderedTemplate}</code></pre>
          </div>
        `;
      }

      case 'ordering': {
        const rawItems = (q.items || []).map((item, idx) => ({
          ...item,
          id: item.id || `item_${idx + 1}`
        }));
        const items = Array.isArray(savedAnswer) && savedAnswer.length > 0
          ? savedAnswer.map(entry => {
              if (entry && typeof entry === 'object' && entry.text) return entry;
              const found = rawItems.find(it => it.id === entry || it.text === entry);
              return found || { id: String(entry), text: String(entry) };
            })
          : [...rawItems];
        return `
          <div class="ordering-list" id="ordering-items-container-${q.id}">
            ${items.map((item, idx) => `
              <div class="ordering-item" data-id="${item.id || `item_${idx + 1}`}" data-current-idx="${idx}">
                <div class="ordering-item-content">
                  <span class="order-pos-badge">${idx + 1}</span>
                  <span class="ordering-text">${item.text}</span>
                </div>
                <div class="order-btn-group">
                  <button class="order-btn move-up-btn" data-q-id="${q.id}" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>▲</button>
                  <button class="order-btn move-down-btn" data-q-id="${q.id}" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      case 'case-study': {
        const activeTabIdx = 0;
        const csAnswers = (savedAnswer && typeof savedAnswer === 'object') ? savedAnswer : {};
        return `
          <div class="case-study-container">
            <div class="case-study-tabs" role="tablist">
              ${(q.tabs || []).map((tab, idx) => `
                <button class="case-study-tab-btn ${idx === activeTabIdx ? 'active' : ''}" data-tab="${idx}" role="tab" aria-selected="${idx === activeTabIdx}">
                  ${tab.title}
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
            <h4 style="margin-bottom: 12px;">Questões do Estudo de Caso:</h4>
            ${(q.questions || []).map((childQ, qIdx) => `
              <div class="child-question-card" data-child-id="${childQ.id}" data-child-type="${childQ.type}" style="margin-bottom: 20px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md);">
                <p style="font-weight: 600; margin-bottom: 8px;">${qIdx + 1}. ${childQ.stem || childQ.prompt || childQ.title}</p>
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

  function attachQuestionInteractions(q) {
    // Language filter selector
    document.getElementById('simulator-lang-filter')?.addEventListener('change', (e) => {
      activeFilters.language = e.target.value;
      currentQuestions = filterQuestions(questions || [], activeFilters);
      currentIdx = 0;
      renderSetupOrActiveScreen();
    });

    // Single choice radio
    if (q.type === 'single-choice') {
      container.querySelectorAll('.option-item').forEach(label => {
        label.addEventListener('click', () => {
          const idx = parseInt(label.dataset.index, 10);
          userAnswers[q.id] = idx;
          container.querySelectorAll('.option-item').forEach(l => l.classList.remove('selected'));
          label.classList.add('selected');
        });
      });
    }

    // Multiple choice checkbox
    if (q.type === 'multiple-choice') {
      const selected = new Set(Array.isArray(userAnswers[q.id]) ? userAnswers[q.id] : []);
      container.querySelectorAll('.option-item').forEach(label => {
        label.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            const input = label.querySelector('input');
            input.checked = !input.checked;
          }
          const idx = parseInt(label.dataset.index, 10);
          if (label.querySelector('input').checked) {
            selected.add(idx);
            label.classList.add('selected');
          } else {
            selected.delete(idx);
            label.classList.remove('selected');
          }
          userAnswers[q.id] = Array.from(selected);
        });
      });
    }

    // Code completion slot change
    if (q.type === 'code-completion') {
      userAnswers[q.id] = userAnswers[q.id] || {};
      container.querySelectorAll('.slot-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const slotId = sel.dataset.slotId;
          const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
          userAnswers[q.id][slotId] = val;
        });
      });
    }

    // Ordering move up/down buttons
    if (q.type === 'ordering') {
      const baseItems = (q.items || []).map((it, i) => ({ ...it, id: it.id || `item_${i + 1}` }));
      let itemIdsList = Array.isArray(userAnswers[q.id]) && userAnswers[q.id].length > 0
        ? userAnswers[q.id].map(entry => (entry && typeof entry === 'object' ? entry.id : String(entry)))
        : baseItems.map(it => it.id);
      userAnswers[q.id] = itemIdsList;

      container.querySelectorAll('.move-up-btn').forEach((btn, idx) => {
        btn.onclick = () => {
          if (idx > 0) {
            const temp = itemIdsList[idx - 1];
            itemIdsList[idx - 1] = itemIdsList[idx];
            itemIdsList[idx] = temp;
            userAnswers[q.id] = [...itemIdsList];
            renderQuestionScreen();
          }
        };
      });
      container.querySelectorAll('.move-down-btn').forEach((btn, idx) => {
        btn.onclick = () => {
          if (idx < itemIdsList.length - 1) {
            const temp = itemIdsList[idx + 1];
            itemIdsList[idx + 1] = itemIdsList[idx];
            itemIdsList[idx] = temp;
            userAnswers[q.id] = [...itemIdsList];
            renderQuestionScreen();
          }
        };
      });
    }

    // Case study tab switching & dynamic child question interactions
    if (q.type === 'case-study') {
      const tabBtns = container.querySelectorAll('.case-study-tab-btn');
      const panes = container.querySelectorAll('.case-study-pane');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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

        if (childQ.type === 'single-choice') {
          card.querySelectorAll('.option-item').forEach(label => {
            label.addEventListener('click', () => {
              const idx = parseInt(label.dataset.index, 10);
              userAnswers[q.id][childQ.id] = idx;
              card.querySelectorAll('.option-item').forEach(l => l.classList.remove('selected'));
              label.classList.add('selected');
            });
          });
        } else if (childQ.type === 'multiple-choice') {
          const selected = new Set(Array.isArray(userAnswers[q.id][childQ.id]) ? userAnswers[q.id][childQ.id] : []);
          card.querySelectorAll('.option-item').forEach(label => {
            label.addEventListener('click', (e) => {
              if (e.target.tagName !== 'INPUT') {
                const input = label.querySelector('input');
                if (input) input.checked = !input.checked;
              }
              const idx = parseInt(label.dataset.index, 10);
              const input = label.querySelector('input');
              if (input?.checked) {
                selected.add(idx);
                label.classList.add('selected');
              } else {
                selected.delete(idx);
                label.classList.remove('selected');
              }
              userAnswers[q.id][childQ.id] = Array.from(selected);
            });
          });
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
          const baseItems = (childQ.items || []).map((it, i) => ({ ...it, id: it.id || `item_${i + 1}` }));
          let childItemIds = Array.isArray(userAnswers[q.id][childQ.id]) && userAnswers[q.id][childQ.id].length > 0
            ? userAnswers[q.id][childQ.id].map(entry => (entry && typeof entry === 'object' ? entry.id : String(entry)))
            : baseItems.map(it => it.id);
          userAnswers[q.id][childQ.id] = childItemIds;

          card.querySelectorAll('.move-up-btn').forEach((btn, idx) => {
            btn.onclick = () => {
              if (idx > 0) {
                const temp = childItemIds[idx - 1];
                childItemIds[idx - 1] = childItemIds[idx];
                childItemIds[idx] = temp;
                userAnswers[q.id][childQ.id] = [...childItemIds];
                renderQuestionScreen();
              }
            };
          });
          card.querySelectorAll('.move-down-btn').forEach((btn, idx) => {
            btn.onclick = () => {
              if (idx < childItemIds.length - 1) {
                const temp = childItemIds[idx + 1];
                childItemIds[idx + 1] = childItemIds[idx];
                childItemIds[idx] = temp;
                userAnswers[q.id][childQ.id] = [...childItemIds];
                renderQuestionScreen();
              }
            };
          });
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
      }
    });

    document.getElementById('next-q-btn')?.addEventListener('click', () => {
      if (currentIdx < currentQuestions.length - 1) {
        currentIdx++;
        renderQuestionScreen();
      } else {
        renderExamSummary();
      }
    });

    // Flag toggle
    document.getElementById('flag-review-btn')?.addEventListener('click', (e) => {
      const entry = errorNotebook[q.id] || { failCount: 0, flagged: false };
      entry.flagged = !entry.flagged;
      entry.lastModified = new Date().toISOString();
      errorNotebook[q.id] = entry;
      persistState();
      e.target.textContent = entry.flagged ? '🚩 Marcada' : '🏳️ Marcar';
    });
  }

  function evaluateCurrentAnswer(q) {
    const feedbackMount = document.getElementById('feedback-card-mount');
    if (!feedbackMount) return;

    const ans = userAnswers[q.id];
    const res = evaluateAnswer(q, ans);

    feedbackMount.innerHTML = `
      <div class="feedback-card ${res.isCorrect ? 'correct' : 'incorrect'}">
        <div class="feedback-title">
          <span>${res.isCorrect ? '✅ Resposta Correta!' : '❌ Resposta Incorreta'}</span>
        </div>
        <p class="feedback-rationale">${res.rationale}</p>
      </div>
    `;

    if (q.type === 'single-choice') {
      const correctIdx = q.options.findIndex(o => o.correct === true);
      container.querySelectorAll('.option-item').forEach(item => {
        const idx = parseInt(item.dataset.index, 10);
        if (idx === correctIdx) item.classList.add('correct');
        else if (idx === ans) item.classList.add('incorrect');
      });
    }

    if (!res.isCorrect) {
      const errEntry = errorNotebook[q.id] || { failCount: 0, flagged: false };
      errEntry.failCount = (errEntry.failCount || 0) + 1;
      errEntry.lastFailedAt = new Date().toISOString();
      errEntry.lastModified = new Date().toISOString();
      errorNotebook[q.id] = errEntry;
      persistState();
    }
  }

  function renderExamSummary() {
    if (timerInterval) clearInterval(timerInterval);

    const scoreReport = calculateQuizScore(currentQuestions, userAnswers, { passingScore: 70 });

    // Record quiz attempt into history
    const quizAttempt = {
      id: `attempt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: defaultMode,
      total: scoreReport.total,
      correct: scoreReport.correct,
      percentage: scoreReport.percentage,
      isPassing: scoreReport.isPassing,
      domainScores: scoreReport.domainScores
    };

    progressState.quizHistory = progressState.quizHistory || [];
    progressState.quizHistory.unshift(quizAttempt);

    // Record failed questions into errorNotebook
    scoreReport.questionResults.forEach(r => {
      if (!r.isCorrect && r.details?.isAnswered) {
        const errEntry = errorNotebook[r.questionId] || { failCount: 0, flagged: false };
        errEntry.failCount = (errEntry.failCount || 0) + 1;
        errEntry.lastFailedAt = new Date().toISOString();
        errEntry.lastModified = new Date().toISOString();
        errorNotebook[r.questionId] = errEntry;
      }
    });

    persistState();

    container.innerHTML = `
      <div class="quiz-card" style="text-align: center; padding: 40px 24px;">
        <span style="font-size: 48px;">${scoreReport.isPassing ? '🎉' : '📚'}</span>
        <h2 style="font-size: 26px; margin: 12px 0;">${scoreReport.isPassing ? 'Aprovado no Simulado!' : 'Reforce seus Estudos'}</h2>
        <div style="font-size: 36px; font-weight: 800; color: ${scoreReport.isPassing ? 'var(--success)' : 'var(--danger)'};">
          ${scoreReport.percentage}% (${scoreReport.correct}/${scoreReport.total})
        </div>
        <p style="color: var(--text-muted); margin-top: 8px;">Pontuação de corte: 70% (700/1000)</p>

        <div style="margin: 24px auto; max-width: 600px; text-align: left;">
          <h4 style="margin-bottom: 12px;">Desempenho por Domínio:</h4>
          ${Object.values(scoreReport.domainScores).map(d => `
            <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span><strong>${d.domainId}</strong> (${d.correct}/${d.total})</span>
                <span>${d.percentage}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: ${d.percentage}%;"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 28px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <a href="#simulator" class="recall-toggle-btn">Novo Simulado</a>
          <a href="#simulator?errors=true" class="recall-toggle-btn">Revisar Caderno de Erros</a>
          <a href="#mastery" class="recall-toggle-btn">Ver Prontidão Geral</a>
        </div>
      </div>
    `;
  }

  function persistState() {
    try {
      progressState.errorNotebook = errorNotebook;
      progressState.lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState));
    } catch (err) {
      console.warn('Could not persist simulator state:', err);
    }
  }
}
