# Guia de Autoria e Diretrizes de Conteúdo — Azure AI-200 (AI-200T00)

Este documento estabelece as diretrizes canônicas e obrigatórias de engenharia de conteúdo, neurociência da aprendizagem e padrões técnicos para a elaboração de materiais didáticos, matrizes comparativas e banco de questões preparatórios para a certificação **Microsoft Certified: Azure AI Cloud Developer Associate (AI-200)**.

---

## 1. Fundamentos Pedagógicos e Neurociência da Retenção

A plataforma de estudos Azure AI-200 foi projetada sobre três pilares de ciências cognitivas comprovados empiricamente para maximizar a memorização e recuperação de informações complexas sob pressão de exame:

1. **Efeito de Testagem (Retrieval Practice / Active Recall)**:
   - Estudos seminais (Roediger & Karpicke, 2006) comprovam que o esforço deliberado de recuperar uma informação da memória consolida sinapses de forma significativamente superior à releitura passiva.
   - Todo conceito deve transformar o leitor de consumidor passivo em participante ativo através de **lacunas ocultáveis** (`==cloze==`), **checagens rápidas** (`<details>`) e **questões formativas** integradas.
2. **Efeito de Espaçamento e Interleaving**:
   - Conceitos fundamentais de governança, escalabilidade, segurança e mensageria são revisitados de forma transversal ao longo dos capítulos, evitando o aprendizado em silos isolados.
3. **Gerenciamento de Carga Cognitiva (Sweller)**:
   - Eliminação de prolixidade e ruído textual. Toda oração deve contribuir diretamente para a compreensão de um conceito mensurável pelo exame AI-200.

---

## 2. Regras Estritas para Uso de Lacunas (Cloze Deletions `==termo==`)

O mecanismo de Active Recall do Hub compila a sintaxe Markdown `==termo técnico==` em elementos acessíveis interativos `<span class="cloze" tabindex="0">termo técnico</span>`, mascarados visualmente e reveláveis por clique, toque ou barra de espaço.

### O que DEVE ser transformado em Cloze:
- **Termos técnicos inequívocos e proprietários**:
  - Ex: `==Direct Mode==`, `==Gateway Mode==`, `==DiskANN==`, `==pgvector==`, `==PeekLock==`, `==KEDA==`.
- **Limites numéricos e parâmetros críticos de prova**:
  - Ex: `==20 GB==` (limite da partição lógica do Cosmos DB), portas TCP `==10000 a 20000==`, porta HTTPS `==443==`, limite de `==1.536 dimensões==`.
- **Nomes de papéis RBAC e métodos centrais de SDK**:
  - Ex: papel `==Key Vault Secrets User==`, método `==GetChangeFeedProcessorBuilder==`, classe `==DefaultAzureCredential==`.

### O que NUNCA deve ser transformado em Cloze:
- **Palavras genéricas da língua portuguesa**:
  - ❌ *Incorreto*: "O Cosmos DB é um ==banco== muito ==rápido== para ==guardar== dados."
  - ✅ *Correto*: "O Azure Cosmos DB utiliza particionamento horizontal baseado em uma ==partition key== lógica."
- **Orações inteiras ou frases longas**:
  - O cloze deve ocultar o termo-chave específico, não a frase inteira. Esconder frases longas gera frustração cognitiva e destrói o propósito da recuperação ativa.
- **Densidade recomendada**:
  - No máximo **2 a 4 lacunas por seção**. Evite colocar duas lacunas consecutivas na mesma sentença.

---

## 3. Caixas de Autoavaliação `<details>` (Interactive Self-Checks)

Antes de explicações detalhadas ou diagramas complexos, insira caixas interativas de self-check:

```markdown
<details>
<summary>Checagem Rápida: [Pergunta provocativa que desafia uma intuição comum]</summary>

[Resposta técnica sucinta contendo a explicação definitiva em 1 a 3 frases]
</details>
```

### Regras de Ouro:
1. **Linha em branco obrigatória**: É mandatório deixar uma linha vazia após a tag `<summary>` e antes do fechamento `</details>` para evitar quebras no parser CommonMark.
2. **Pergunta com foco em decisão**: Formule perguntas no estilo "Qual a diferença entre X e Y?", "O que acontece se a porta Z for bloqueada?", ou "Qual o comportamento padrão quando W expira?".

---

## 4. Engenharia das "Pegadinhas de Prova" (Exam Traps Extraction)

Todo arquivo conceitual (`.md`) deve conter obrigatoriamente a seção `## Pegadinhas de Prova` no final. Os avaliadores do exame AI-200 formulam questões baseadas em desvios sutis de boas práticas, padrões default contra-intuitivos e limitações de serviço.

### Padrões Canônicos de Pegadinhas no Exame AI-200:
1. **Defaults Perigosos**:
   - Exemplo: No SDK .NET do Cosmos DB, o modo default é `ConnectionMode.Direct`, que requer tráfego TCP nas portas 10000-20000. Se a VNet bloquear essa faixa, a conexão falhará, sendo necessário alternar para `ConnectionMode.Gateway` (HTTPS 443).
   - Exemplo: O nível de consistência padrão da conta Cosmos DB é `Session`, mas clientes externos fora da sessão só leem dados sob consistência eventual a menos que passem o Session Token explicitamente.
2. **Falsos Amigos de RBAC (Control Plane vs Data Plane)**:
   - Exemplo: Conceder a função `Key Vault Contributor` ou `Contributor` permite gerenciar o cofre, mas **NÃO** concede acesso para ler o valor dos segredos! Para leitura de segredos em tempo de execução, a identidade precisa da função `Key Vault Secrets User`.
3. **Imutabilidade e Restrições de Recursos**:
   - Exemplo: A chave de partição (`partitionKey`) do Cosmos DB **não** pode ser alterada após a criação do container.
   - Exemplo: O container de leases do Change Feed Processor **exige** que a partition key seja `/id`.
4. **Incompatibilidades de Execução em Nuvem**:
   - Exemplo: Stored Procedures e Triggers no Cosmos DB são atômicos e executados internamente em JavaScript; eles **não podem** fazer chamadas HTTP de saída para modelos de IA como o Azure OpenAI!

### Formato de Apresentação:
Apresente cada pegadinha com a estrutura:
- **Pegadinha X: [Nome do Conceito/Armadilha]**: *[O que o enunciado costuma induzir]* vs *[A realidade técnica comprovada e a solução oficial recomendada]*.

---

## 5. Paridade Dual SDK (Python e C#)

O exame AI-200 exige proficiência no desenvolvimento de soluções de nuvem para IA utilizando tanto o ecossistema Python quanto o ecossistema .NET (C#).

### Regras de Código:
1. **Adjacência de Blocos**: Todo bloco de implementação prática em Python (` ```python `) deve ser imediatamente sucedido pelo bloco correspondente em C# (` ```csharp `). O compilador static do hub detecta essa adjacência e cria abas sincronizadas (`.code-tabs`).
2. **Versões e Bibliotecas Canônicas**:
   - **Python**: Versão 3.12+, uso de tipagem estrita com type hints (`from typing import Optional, List`), bibliotecas oficiais da Microsoft (`azure-cosmos >= 4.7.0`, `azure-identity >= 1.16.0`, `azure-storage-blob`).
   - **C#**: Versão .NET 8 / C# 12, padrões assíncronos (`async Task`, `await`, `CancellationToken`), bibliotecas oficiais NuGet (`Microsoft.Azure.Cosmos >= 3.39.0`, `Azure.Identity >= 1.11.0`).
3. **Segurança de Código**:
   - **Proibido** o uso de chaves mestras hardcoded (ex: `"AccountKey=dGhpcyBpcyBhIGZha2Uga2V5Cg=="`). Utilize sempre instâncias de `DefaultAzureCredential` ou injeção de segredos via variáveis de ambiente/Key Vault references.

---

## 6. Diretrizes para Construção do Banco de Questões

As questões de simulado devem cobrir os 5 formatos suportados pelo motor `web/quiz-core.js` e respeitar estritamente o validador de esquemas (`scripts/lib/schema-validator.mjs`):

### 1. `single-choice` (Escolha Única):
- Mínimo de 4 alternativas.
- Exatamente 1 alternativa com `"correct": true`.
- Todas as alternativas (corretas e distratores) devem possuir justificativa (`rationale`) completa e link oficial do Microsoft Learn (`learn_url`).

### 2. `multiple-choice` (Multi-Seleção):
- Deve conter a propriedade `"select_count": 2` (ou superior).
- O número de opções no array deve ser superior a `select_count` (recomendado: 5 opções).
- Exatamente `select_count` alternativas com `"correct": true`.
- Cada alternativa deve explicar claramente por que é uma das peças necessárias da solução ou por que é um distrator inválido.

### 3. `code-completion` (Completar Código):
- Snippet de código em `"code_template"` contendo placeholders no formato `{{slot_1}}`, `{{slot_2}}`.
- Array `"slots"` onde cada slot possui `id` correspondente ao placeholder e array `"options"` com pelo menos 2 alternativas (1 correta e justificativas em todas).
- O código deve ser sintaticamente válido após a inserção das opções corretas.

### 4. `ordering` (Sequência Lógica):
- Array `"items"` contendo de 3 a 6 passos numerados consecutivamente de 1 a N na propriedade `"order"`.
- O cenário deve refletir um fluxo cronológico de engenharia real (ex: deploy de pipeline, configuração de leases, autenticação Zero Trust).

### 5. `case-study` (Estudo de Caso Corporativo):
- Deve conter exatamente as 4 abas obrigatórias:
  1. `Visão Geral` (perfil da empresa, metas de negócio).
  2. `Arquitetura Atual` (estado legado, limites e vulnerabilidades).
  3. `Requisitos Técnicos` (SLAs, vetores, escalabilidade, latência).
  4. `Requisitos de Segurança` (Zero Trust, RBAC, criptografia, redes).
- Conteúdo das abas formatado em HTML semântico limpo (`<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<code>`).
- Array `"questions"` contendo questões filhas que avaliam decisões arquiteturais transversais cruzando dados de múltiplas abas.

---

## 7. Checklist de Qualidade e Segurança (Validation Gate)

Antes de submeter qualquer conteúdo para homologação, verifique:
- [ ] **Validação de Tags**: Todas as tags utilizadas no frontmatter ou questões constam no catálogo canônico `generation/taxonomy/tags.json`.
- [ ] **Zero Inline Scripts**: O conteúdo não possui tags `<script>`, atributos de evento `onload=`, `onclick=`, `onerror=` ou links `javascript:`.
- [ ] **Seção ## Pegadinhas de Prova**: Presente em todos os conceitos `.md`.
- [ ] **Paridade Dual SDK**: Blocos Python e C# emparelhados sem lacunas unilaterais.
- [ ] **Links Válidos**: URLs internas utilizam rotas relativas válidas e links externos apontam para `learn.microsoft.com`.
