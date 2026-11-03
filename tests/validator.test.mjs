import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateFrontmatter, validateQuestion, validateQuestions, validateTags } from '../scripts/lib/schema-validator.mjs';
import { validateLink, validateLinks } from '../scripts/lib/links.mjs';

describe('Validator Rules & Schemas (scripts/lib/schema-validator.mjs)', () => {
  describe('validateFrontmatter', () => {
    test('passes valid frontmatter', () => {
      const fm = {
        title: 'Cosmos DB Particionamento',
        slug: 'cosmos-db-particionamento',
        chapter: '04-cosmos-db-nosql',
        exam_domain: 'data-management',
        tags: ['cosmos-db', 'partitioning'],
        difficulty: 'intermediate',
        tldr: 'Resumo sobre particionamento.',
        related_links: [{ label: 'Docs', url: 'https://learn.microsoft.com', type: 'learn' }]
      };
      const errors = validateFrontmatter(fm, { canonicalTags: new Set(['cosmos-db', 'partitioning']) });
      assert.equal(errors.valid, true);
      assert.equal(errors.length, 0);
    });

    test('fails on accented or non-kebab slug', () => {
      const fm = {
        title: 'Teste',
        slug: 'slug-com-acento-ê',
        chapter: '01-container-hosting',
        exam_domain: 'containerized-solutions',
        tags: ['acr'],
        tldr: 'Resumo'
      };
      const errors = validateFrontmatter(fm);
      assert.equal(errors.valid, false);
      assert.ok(errors.some(e => e.includes('kebab-case ASCII')));
    });

    test('fails on unregistered tag when canonicalTags provided', () => {
      const fm = {
        title: 'Teste',
        slug: 'teste-slug',
        chapter: '01-container-hosting',
        exam_domain: 'containerized-solutions',
        tags: ['tag-fantasma-inexistente'],
        tldr: 'Resumo'
      };
      const errors = validateFrontmatter(fm, { canonicalTags: new Set(['acr', 'docker']) });
      assert.equal(errors.valid, false);
      assert.ok(errors.some(e => e.includes('Unregistered tag')));
    });
  });

  describe('validateQuestion (5 formats)', () => {
    test('validates single-choice question', () => {
      const q = {
        id: 'q-single-1',
        type: 'single-choice',
        title: 'Pergunta 1',
        stem: 'Qual o limite de tamanho da partição lógica?',
        exam_domain: 'data-management',
        options: [
          { text: '20 GB', correct: true, rationale: 'Correto, 20 GB por partição lógica.' },
          { text: '50 GB', correct: false, rationale: 'Incorreto.' }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, true);
    });

    test('fails single-choice with two correct options', () => {
      const q = {
        id: 'q-single-2',
        type: 'single-choice',
        title: 'Pergunta 2',
        stem: 'Selecione',
        exam_domain: 'data-management',
        options: [
          { text: 'Opção 1', correct: true, rationale: 'R1' },
          { text: 'Opção 2', correct: true, rationale: 'R2' }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, false);
      assert.ok(errors.some(e => e.includes('must have exactly 1 correct option')));
    });

    test('validates multiple-choice question', () => {
      const q = {
        id: 'q-multi-1',
        type: 'multiple-choice',
        title: 'Pergunta Multi',
        stem: 'Quais os dois componentes?',
        exam_domain: 'containerized-solutions',
        select_count: 2,
        options: [
          { text: 'Comp 1', correct: true, rationale: 'R1' },
          { text: 'Comp 2', correct: true, rationale: 'R2' },
          { text: 'Comp 3', correct: false, rationale: 'R3' }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, true);
    });

    test('validates code-completion question', () => {
      const q = {
        id: 'q-code-1',
        type: 'code-completion',
        title: 'Completar SDK',
        stem: 'Complete o código',
        exam_domain: 'data-management',
        code_template: 'client.{{method}}(id="{{db_name}}")',
        slots: [
          {
            id: 'method',
            options: [
              { text: 'create_database_if_not_exists', correct: true, rationale: 'Método correto' },
              { text: 'delete_database', correct: false, rationale: 'Método incorreto' }
            ]
          },
          {
            id: 'db_name',
            options: [
              { text: 'my-db', correct: true, rationale: 'Nome' },
              { text: 'null', correct: false, rationale: 'Inválido' }
            ]
          }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, true);
    });

    test('validates ordering question', () => {
      const q = {
        id: 'q-order-1',
        type: 'ordering',
        title: 'Ordem de Execução',
        stem: 'Ordene as etapas',
        exam_domain: 'containerized-solutions',
        items: [
          { text: 'Build imagem no ACR', order: 1 },
          { text: 'Criar Container App', order: 2 },
          { text: 'Configurar ingress', order: 3 }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, true);
    });

    test('validates case-study question with 4 tabs and children', () => {
      const q = {
        id: 'cs-1',
        type: 'case-study',
        title: 'Estudo de Caso Contoso',
        stem: 'Leia as abas e responda às perguntas.',
        exam_domain: 'data-management',
        tabs: [
          { title: 'Visão Geral', content: 'Cenário da empresa Contoso.' },
          { title: 'Arquitetura Atual', content: 'Aplicações legadas.' },
          { title: 'Requisitos Técnicos', content: 'Latência p99 < 10ms.' },
          { title: 'Requisitos de Segurança', content: 'Entra ID e Managed Identity.' }
        ],
        questions: [
          {
            id: 'cs-1-q1',
            type: 'single-choice',
            title: 'Sub-pergunta 1',
            stem: 'Qual serviço atende aos requisitos?',
            exam_domain: 'data-management',
            options: [
              { text: 'Cosmos DB', correct: true, rationale: 'Atende p99 sub-10ms' },
              { text: 'Table Storage', correct: false, rationale: 'Não atende' }
            ]
          }
        ]
      };
      const errors = validateQuestion(q);
      assert.equal(errors.valid, true);
    });
  });

  describe('validateLink & validateLinks', () => {
    const routes = new Set(['index.html', 'chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial/']);

    test('accepts valid internal route', () => {
      const res = validateLink('chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial/', routes);
      assert.equal(res.valid, true);
    });

    test('rejects broken internal route', () => {
      const res = validateLink('chapters/99-inexistente/slug/', routes);
      assert.equal(res.valid, false);
      assert.ok(res.reason.includes('not found'));
    });

    test('flags javascript: as security violation', () => {
      const res = validateLink('javascript:alert(1)', routes);
      assert.equal(res.valid, false);
      assert.ok(res.reason.includes('Security violation'));
    });
  });
});
