'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — AUTHORED editorial metadata.
   ----------------------------------------------------------------------------
   This is the ONLY new authored data F5 introduces. It is keyed by the F1
   catalogue `key`, so the F1 catalogue stays the identity/model/expected
   authority and this layer never re-stores a slug, a model, a title that the F1
   translations already own, or any fact the model can derive.

   Each entry carries ONLY things that cannot be derived mathematically:
     - schemaVersion         : explicit version of THIS metadata record.
     - primaryCategory       : one of the ten roadmap categories (required).
     - difficulty            : beginner | intermediate | advanced (editorial).
     - minutes               : authored exploration time (integer).
     - audiences             : one or more of general/business/student.
     - provenance            : { kind: 'synthetic' } — honest; no fake company.
     - tags                  : free discovery tags (controlled lightly).
     - capabilities          : engine features this example DEMONSTRATES. Every
                               entry must be an engine-supported capability AND be
                               consistent with the derived facts (validator checks).
     - related               : stable F1 keys of related examples (optional).
     - content               : localized editorial content (5 locales) that the
                               short F1 title/desc do not cover — business question
                               and learning goal. Plain text only.
     - result                : expected-result POLICY ('exact' | 'objective-
                               feasible'). The objective/status themselves stay in
                               the F1 `expected` contract and the independent result
                               manifest; this only records which policy verifies it.
     - seo (optional)        : localized SEO title/description overrides. No JSON-LD
                               is emitted by F5; F11 owns SEO output.

   DATA ONLY. No HTML, no functions, no generated URLs. Synthetic teaching data;
   no real company is named or implied.
   ========================================================================== */

function c(en, es, pt, de, fr) { return { en: en, es: es, pt: pt, de: de, fr: fr }; }

var METADATA = {
  production: {
    schemaVersion: 1,
    primaryCategory: 'production-operations',
    difficulty: 'beginner',
    minutes: 5,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['production', 'capacity', 'profit'],
    capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'verification'],
    related: ['workshop', 'marketing'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many units of each product should we make to maximise profit within our hours?',
        '¿Cuántas unidades de cada producto conviene fabricar para maximizar el beneficio dentro de las horas disponibles?',
        'Quantas unidades de cada produto devemos fazer para maximizar o lucro dentro das horas disponíveis?',
        'Wie viele Einheiten je Produkt sollten wir fertigen, um den Gewinn im Rahmen der Stunden zu maximieren?',
        'Combien d\'unités de chaque produit fabriquer pour maximiser le profit dans la limite d\'heures ?'),
      goal: c(
        'Learn the basic shape of a linear plan: variables, an objective and a capacity limit.',
        'Aprender la forma básica de un plan lineal: variables, un objetivo y un límite de capacidad.',
        'Aprender a forma básica de um plano linear: variáveis, um objetivo e um limite de capacidade.',
        'Die Grundform eines linearen Plans lernen: Variablen, ein Ziel und eine Kapazitätsgrenze.',
        'Comprendre la forme de base d\'un plan linéaire : variables, objectif et limite de capacité.'),
    },
  },
  workshop: {
    schemaVersion: 1,
    primaryCategory: 'production-operations',
    difficulty: 'beginner',
    minutes: 6,
    audiences: ['general', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['production', 'chart', 'two-variables'],
    capabilities: ['continuous-variables', 'maximise', 'sum', 'sumproduct', 'chart-eligible', 'verification'],
    related: ['production'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'With two products and two resources, what mix maximises profit — and what does the feasible region look like?',
        'Con dos productos y dos recursos, ¿qué combinación maximiza el beneficio y cómo es la región factible?',
        'Com dois produtos e dois recursos, que combinação maximiza o lucro e como é a região factível?',
        'Bei zwei Produkten und zwei Ressourcen: welche Mischung maximiert den Gewinn und wie sieht der zulässige Bereich aus?',
        'Avec deux produits et deux ressources, quel mélange maximise le profit et à quoi ressemble la région réalisable ?'),
      goal: c(
        'See a two-variable model drawn as a feasible region with the optimum at a corner.',
        'Ver un modelo de dos variables dibujado como región factible con el óptimo en un vértice.',
        'Ver um modelo de duas variáveis desenhado como região factível com o ótimo num vértice.',
        'Ein Zwei-Variablen-Modell als zulässigen Bereich sehen, mit dem Optimum an einer Ecke.',
        'Voir un modèle à deux variables tracé comme région réalisable, l\'optimum sur un sommet.'),
    },
  },
  blend: {
    schemaVersion: 1,
    primaryCategory: 'blending-formulation',
    difficulty: 'intermediate',
    minutes: 8,
    audiences: ['business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['blending', 'nutrition', 'cost'],
    capabilities: ['continuous-variables', 'minimise', 'sum', 'sumproduct', 'verification', 'us-number-format'],
    related: ['marketing'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'What is the cheapest blend of feeds that still meets every nutritional requirement?',
        '¿Cuál es la mezcla de piensos más barata que aun así cumple todos los requisitos nutricionales?',
        'Qual é a mistura de rações mais barata que ainda cumpre todos os requisitos nutricionais?',
        'Was ist die günstigste Futtermischung, die trotzdem alle Nährstoffanforderungen erfüllt?',
        'Quel est le mélange d\'aliments le moins cher qui respecte encore toutes les exigences nutritionnelles ?'),
      goal: c(
        'Model a minimisation with several "at least" requirements — the classic blending problem.',
        'Modelar una minimización con varios requisitos de "al menos": el problema clásico de mezcla.',
        'Modelar uma minimização com vários requisitos de "pelo menos": o problema clássico de mistura.',
        'Eine Minimierung mit mehreren "mindestens"-Anforderungen modellieren — das klassische Mischproblem.',
        'Modéliser une minimisation avec plusieurs exigences "au moins" : le problème de mélange classique.'),
    },
  },
  marketing: {
    schemaVersion: 1,
    primaryCategory: 'marketing-finance',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['business'],
    provenance: { kind: 'synthetic' },
    tags: ['budget', 'allocation', 'return'],
    capabilities: ['continuous-variables', 'maximise', 'bounds', 'sum', 'verification', 'us-number-format'],
    related: ['production', 'blend'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How should a fixed budget be split across channels to maximise total return within per-channel limits?',
        '¿Cómo repartir un presupuesto fijo entre canales para maximizar el retorno total dentro de los límites de cada canal?',
        'Como dividir um orçamento fixo entre canais para maximizar o retorno total dentro dos limites de cada canal?',
        'Wie sollte ein festes Budget auf Kanäle verteilt werden, um den Gesamtertrag im Rahmen der Kanalgrenzen zu maximieren?',
        'Comment répartir un budget fixe entre canaux pour maximiser le rendement total dans les limites de chaque canal ?'),
      goal: c(
        'Use per-variable bounds to keep an allocation realistic while maximising return.',
        'Usar límites por variable para mantener una asignación realista mientras se maximiza el retorno.',
        'Usar limites por variável para manter uma alocação realista enquanto se maximiza o retorno.',
        'Variablengrenzen nutzen, um eine Allokation realistisch zu halten und den Ertrag zu maximieren.',
        'Utiliser des bornes par variable pour garder une allocation réaliste tout en maximisant le rendement.'),
    },
  },
  workforce: {
    schemaVersion: 1,
    primaryCategory: 'workforce-scheduling',
    difficulty: 'advanced',
    minutes: 10,
    audiences: ['business'],
    provenance: { kind: 'synthetic' },
    tags: ['staffing', 'coverage', 'weekly'],
    capabilities: ['integer-variables', 'minimise', 'sum', 'verification'],
    related: ['shipping'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How few staff can we schedule and still cover every day\'s demand?',
        '¿Con cuántas personas mínimas podemos cubrir la demanda de cada día?',
        'Com quantas pessoas no mínimo conseguimos cobrir a procura de cada dia?',
        'Mit wie wenig Personal können wir planen und trotzdem den Bedarf jedes Tages decken?',
        'Avec combien d\'employés au minimum peut-on couvrir la demande de chaque jour ?'),
      goal: c(
        'Model an integer scheduling problem where each shift covers several days.',
        'Modelar un problema de turnos entero donde cada turno cubre varios días.',
        'Modelar um problema de escalas inteiro onde cada turno cobre vários dias.',
        'Ein ganzzahliges Dienstplanproblem modellieren, bei dem jede Schicht mehrere Tage abdeckt.',
        'Modéliser un problème d\'horaires entier où chaque poste couvre plusieurs jours.'),
    },
  },
  shipping: {
    schemaVersion: 1,
    primaryCategory: 'logistics-transport',
    difficulty: 'advanced',
    minutes: 10,
    audiences: ['business'],
    provenance: { kind: 'synthetic' },
    tags: ['transport', 'network', 'cost'],
    capabilities: ['integer-variables', 'minimise', 'sum', 'verification'],
    related: ['workforce'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How should whole units be shipped across routes to meet demand at least total cost?',
        '¿Cómo enviar unidades enteras por las rutas para cubrir la demanda al menor coste total?',
        'Como enviar unidades inteiras pelas rotas para cobrir a procura ao menor custo total?',
        'Wie sollten ganze Einheiten über Routen versandt werden, um den Bedarf zu minimalen Gesamtkosten zu decken?',
        'Comment expédier des unités entières sur les routes pour couvrir la demande au moindre coût total ?'),
      goal: c(
        'Model a small transport plan with integer shipments and supply/demand balance.',
        'Modelar un plan de transporte pequeño con envíos enteros y equilibrio de oferta/demanda.',
        'Modelar um plano de transporte pequeno com envios inteiros e equilíbrio de oferta/procura.',
        'Einen kleinen Transportplan mit ganzzahligen Sendungen und Angebot/Nachfrage-Ausgleich modellieren.',
        'Modéliser un petit plan de transport avec expéditions entières et équilibre offre/demande.'),
    },
  },
  project: {
    schemaVersion: 1,
    primaryCategory: 'marketing-finance',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['selection', 'budget', 'yes-no'],
    capabilities: ['binary-variables', 'maximise', 'bounds', 'sum', 'sumproduct', 'verification'],
    related: ['delivery'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'Which projects should we pick to maximise value without exceeding the budget?',
        '¿Qué proyectos elegir para maximizar el valor sin superar el presupuesto?',
        'Que projetos escolher para maximizar o valor sem exceder o orçamento?',
        'Welche Projekte sollten wir wählen, um den Wert zu maximieren, ohne das Budget zu überschreiten?',
        'Quels projets choisir pour maximiser la valeur sans dépasser le budget ?'),
      goal: c(
        'Model a yes/no selection with binary variables and a budget limit (knapsack).',
        'Modelar una selección sí/no con variables binarias y un límite de presupuesto (mochila).',
        'Modelar uma seleção sim/não com variáveis binárias e um limite de orçamento (mochila).',
        'Eine Ja/Nein-Auswahl mit Binärvariablen und Budgetgrenze modellieren (Rucksackproblem).',
        'Modéliser une sélection oui/non avec variables binaires et une limite de budget (sac à dos).'),
    },
  },
  delivery: {
    schemaVersion: 1,
    primaryCategory: 'logistics-transport',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['loading', 'capacity', 'yes-no'],
    capabilities: ['binary-variables', 'maximise', 'bounds', 'sum', 'sumproduct', 'verification'],
    related: ['project'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'Which items should go on the vehicle to maximise value without exceeding its capacity?',
        '¿Qué artículos cargar en el vehículo para maximizar el valor sin superar su capacidad?',
        'Que itens carregar no veículo para maximizar o valor sem exceder a sua capacidade?',
        'Welche Artikel sollten auf das Fahrzeug, um den Wert zu maximieren, ohne die Kapazität zu überschreiten?',
        'Quels articles charger dans le véhicule pour maximiser la valeur sans dépasser sa capacité ?'),
      goal: c(
        'Practise the binary knapsack shape in a loading context.',
        'Practicar la forma de mochila binaria en un contexto de carga.',
        'Praticar a forma de mochila binária num contexto de carregamento.',
        'Die binäre Rucksackform in einem Beladungskontext üben.',
        'S\'exercer à la forme du sac à dos binaire dans un contexte de chargement.'),
    },
  },
  supplier: {
    schemaVersion: 1,
    primaryCategory: 'purchasing-suppliers',
    difficulty: 'advanced',
    minutes: 12,
    audiences: ['business'],
    provenance: { kind: 'synthetic' },
    tags: ['sourcing', 'fixed-cost', 'activation'],
    capabilities: ['mixed-variables', 'binary-variables', 'integer-variables', 'minimise', 'bounds', 'sum', 'verification'],
    related: ['blend', 'shipping'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'Which suppliers should we activate, and how much to buy from each, to meet demand at least cost?',
        '¿Qué proveedores activar, y cuánto comprar a cada uno, para cubrir la demanda al menor coste?',
        'Que fornecedores ativar, e quanto comprar a cada um, para cobrir a procura ao menor custo?',
        'Welche Lieferanten sollten wir aktivieren und wie viel bei jedem kaufen, um den Bedarf zu minimalen Kosten zu decken?',
        'Quels fournisseurs activer, et combien acheter à chacun, pour couvrir la demande au moindre coût ?'),
      goal: c(
        'Model a mixed problem: binary activation decisions linked to continuous quantities.',
        'Modelar un problema mixto: decisiones binarias de activación ligadas a cantidades continuas.',
        'Modelar um problema misto: decisões binárias de ativação ligadas a quantidades contínuas.',
        'Ein gemischtes Problem modellieren: binäre Aktivierungsentscheidungen verknüpft mit kontinuierlichen Mengen.',
        'Modéliser un problème mixte : décisions binaires d\'activation liées à des quantités continues.'),
    },
  },
};

module.exports = { METADATA: METADATA };
