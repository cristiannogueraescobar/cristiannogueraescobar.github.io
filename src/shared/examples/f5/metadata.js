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
  "bakery-mix": {
    schemaVersion: 1,
    primaryCategory: 'production-operations',
    difficulty: 'beginner',
    minutes: 4,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['production', 'bakery', 'capacity', 'mix'],
    capabilities: ['continuous-variables', 'maximise', 'verification'],
    related: ['factory-batches', 'production'],
    result: { policy: 'exact', decisions: {"B2":150,"B3":150,"B4":0} },
    content: {
      question: c(
        'How many loaves, rolls and pastries should the bakery make today to maximise contribution?',
        '¿Cuántas barras, panecillos y bollería debe hacer hoy la panadería para maximizar la contribución?',
        'Quantos pães, pãezinhos e doces a padaria deve fazer hoje para maximizar a contribuição?',
        'Wie viele Brote, Brötchen und Gebäckstücke sollte die Bäckerei heute herstellen, um den Deckungsbeitrag zu maximieren?',
        'Combien de pains, petits pains et viennoiseries la boulangerie doit-elle produire aujourd\'hui pour maximiser la contribution ?'),
      goal: c(
        'See how three products compete for shared flour, labour and oven capacity.',
        'Ver cómo tres productos compiten por la harina, la mano de obra y la capacidad de horno compartidas.',
        'Ver como três produtos competem pela farinha, mão de obra e capacidade de forno partilhadas.',
        'Sehen, wie drei Produkte um gemeinsames Mehl, Arbeit und Ofenkapazität konkurrieren.',
        'Voir comment trois produits se disputent la farine, la main-d\'oeuvre et la capacité de four partagées.'),
    },
  },
  "factory-batches": {
    schemaVersion: 1,
    primaryCategory: 'production-operations',
    difficulty: 'intermediate',
    minutes: 6,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['production', 'batches', 'integer', 'capacity'],
    capabilities: ['integer-variables', 'maximise', 'verification'],
    related: ['bakery-mix', 'workshop'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many whole batches of each product should the factory schedule to maximise margin?',
        '¿Cuántos lotes enteros de cada producto debe programar la fábrica para maximizar el margen?',
        'Quantos lotes inteiros de cada produto a fábrica deve programar para maximizar a margem?',
        'Wie viele ganze Chargen je Produkt sollte die Fabrik einplanen, um die Marge zu maximieren?',
        'Combien de lots entiers de chaque produit l\'usine doit-elle planifier pour maximiser la marge ?'),
      goal: c(
        'Learn why whole-batch (integer) decisions differ from a rounded continuous plan.',
        'Aprender por qué las decisiones de lotes enteros difieren de un plan continuo redondeado.',
        'Aprender por que as decisões de lotes inteiros diferem de um plano contínuo arredondado.',
        'Verstehen, warum Ganzchargen-Entscheidungen sich von einem gerundeten kontinuierlichen Plan unterscheiden.',
        'Comprendre pourquoi les décisions en lots entiers diffèrent d\'un plan continu arrondi.'),
    },
  },
  "clinic-staffing": {
    schemaVersion: 1,
    primaryCategory: 'workforce-scheduling',
    difficulty: 'intermediate',
    minutes: 6,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['staffing', 'shifts', 'coverage', 'healthcare'],
    capabilities: ['integer-variables', 'minimise', 'verification'],
    related: ['call-centre', 'workforce'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many staff should the clinic assign to overlapping shifts to cover every block at least cost?',
        '¿Cuánto personal debe asignar la clínica a turnos solapados para cubrir cada bloque al menor coste?',
        'Quantos funcionários a clínica deve atribuir a turnos sobrepostos para cobrir cada bloco ao menor custo?',
        'Wie viele Mitarbeitende sollte die Klinik überlappenden Schichten zuweisen, um jeden Block zu geringsten Kosten abzudecken?',
        'Combien d\'employés la clinique doit-elle affecter aux équipes qui se chevauchent pour couvrir chaque bloc au moindre coût ?'),
      goal: c(
        'See how overlapping shift coverage makes the cheapest staffing non-obvious.',
        'Ver cómo la cobertura de turnos solapados hace que la combinación de personal de menor coste no sea evidente.',
        'Ver como a cobertura de turnos sobrepostos torna a combinação de pessoal de menor custo não óbvia.',
        'Sehen, wie überlappende Schichtabdeckung die günstigste Besetzung nicht offensichtlich macht.',
        'Voir comment le chevauchement des équipes rend la combinaison de personnel la moins coûteuse non évidente.'),
    },
  },
  "call-centre": {
    schemaVersion: 1,
    primaryCategory: 'workforce-scheduling',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['staffing', 'shifts', 'scheduling', 'coverage'],
    capabilities: ['integer-variables', 'minimise', 'verification'],
    related: ['clinic-staffing', 'workforce'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many agents should start each staggered shift so every service period is covered at least cost?',
        '¿Cuántos agentes deben empezar cada turno escalonado para cubrir cada periodo de servicio al menor coste?',
        'Quantos agentes devem iniciar cada turno escalonado para cobrir cada período de serviço ao menor custo?',
        'Wie viele Agenten sollten jede gestaffelte Schicht beginnen, damit jeder Serviceabschnitt zu geringsten Kosten abgedeckt ist?',
        'Combien d\'agents doivent commencer chaque équipe échelonnée pour couvrir chaque période de service au moindre coût ?'),
      goal: c(
        'Learn how staggered start times and shift lengths shape coverage.',
        'Aprender cómo los inicios escalonados y la duración de los turnos determinan la cobertura.',
        'Aprender como os inícios escalonados e a duração dos turnos determinam a cobertura.',
        'Verstehen, wie gestaffelte Startzeiten und Schichtlängen die Abdeckung bestimmen.',
        'Comprendre comment les débuts échelonnés et la durée des équipes façonnent la couverture.'),
    },
  },
  "purchase-split": {
    schemaVersion: 1,
    primaryCategory: 'purchasing-suppliers',
    difficulty: 'beginner',
    minutes: 4,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['suppliers', 'procurement', 'sourcing', 'cost'],
    capabilities: ['continuous-variables', 'minimise', 'verification'],
    related: ['ingredient-sourcing', 'supplier'],
    result: { policy: 'exact', decisions: {"B2":250,"B3":200,"B4":50} },
    content: {
      question: c(
        'How should the order be split across three suppliers to meet demand at least cost within their capacities?',
        '¿Cómo repartir el pedido entre tres proveedores para cubrir la demanda al menor coste dentro de sus capacidades?',
        'Como dividir o pedido entre três fornecedores para atender à procura ao menor custo dentro das suas capacidades?',
        'Wie sollte die Bestellung auf drei Lieferanten aufgeteilt werden, um den Bedarf innerhalb ihrer Kapazitäten zu geringsten Kosten zu decken?',
        'Comment répartir la commande entre trois fournisseurs pour couvrir la demande au moindre coût dans la limite de leurs capacités ?'),
      goal: c(
        'See how supplier capacities drive a least-cost split.',
        'Ver cómo las capacidades de los proveedores determinan un reparto de mínimo coste.',
        'Ver como as capacidades dos fornecedores determinam uma divisão de custo mínimo.',
        'Sehen, wie Lieferantenkapazitäten eine kostenminimale Aufteilung bestimmen.',
        'Voir comment les capacités des fournisseurs déterminent une répartition au moindre coût.'),
    },
  },
  "ingredient-sourcing": {
    schemaVersion: 1,
    primaryCategory: 'purchasing-suppliers',
    difficulty: 'advanced',
    minutes: 11,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['suppliers', 'sourcing', 'activation', 'blend'],
    capabilities: ['continuous-variables', 'binary-variables', 'mixed-variables', 'bounds', 'minimise', 'sum', 'sumproduct', 'verification'],
    related: ['purchase-split', 'supplier'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'Which suppliers should be activated, and how much bought from each, to meet both composition needs at least total cost?',
        '¿Qué proveedores activar y cuánto comprar a cada uno para cubrir ambas necesidades de composición al menor coste total?',
        'Que fornecedores ativar e quanto comprar de cada um para atender a ambas as necessidades de composição ao menor custo total?',
        'Welche Lieferanten sollten aktiviert und wie viel bei jedem gekauft werden, um beide Zusammensetzungsanforderungen zu geringsten Gesamtkosten zu erfüllen?',
        'Quels fournisseurs activer et combien acheter à chacun pour couvrir les deux besoins de composition au moindre coût total ?'),
      goal: c(
        'Learn a mixed model: on/off supplier activation plus continuous quantities with fixed costs.',
        'Aprender un modelo mixto: activación de proveedores (sí/no) más cantidades continuas con costes fijos.',
        'Aprender um modelo misto: ativação de fornecedores (sim/não) mais quantidades contínuas com custos fixos.',
        'Ein gemischtes Modell lernen: An/Aus-Aktivierung von Lieferanten plus kontinuierliche Mengen mit Fixkosten.',
        'Apprendre un modèle mixte : activation on/off des fournisseurs et quantités continues avec coûts fixes.'),
    },
  },
  "fleet-assignment": {
    schemaVersion: 1,
    primaryCategory: 'logistics-transport',
    difficulty: 'advanced',
    minutes: 9,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['fleet', 'logistics', 'selection', 'capacity'],
    capabilities: ['binary-variables', 'bounds', 'minimise', 'sum', 'sumproduct', 'verification'],
    related: ['shipping', 'delivery'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'Which vehicles should be assigned to today\'s workload to meet the capacity requirement at least operating cost?',
        '¿Qué vehículos asignar a la carga de hoy para cubrir el requisito de capacidad al menor coste operativo?',
        'Que veículos atribuir à carga de hoje para cumprir o requisito de capacidade ao menor custo operacional?',
        'Welche Fahrzeuge sollten der heutigen Last zugewiesen werden, um die Kapazitätsanforderung zu geringsten Betriebskosten zu erfüllen?',
        'Quels véhicules affecter à la charge du jour pour atteindre la capacité requise au moindre coût d\'exploitation ?'),
      goal: c(
        'See a pure yes/no (binary) selection under a capacity requirement.',
        'Ver una selección pura de sí/no (binaria) bajo un requisito de capacidad.',
        'Ver uma seleção pura de sim/não (binária) sob um requisito de capacidade.',
        'Eine reine Ja/Nein-Auswahl (binär) unter einer Kapazitätsanforderung sehen.',
        'Voir une sélection pure oui/non (binaire) sous une exigence de capacité.'),
    },
  },
  "media-mix": {
    schemaVersion: 1,
    primaryCategory: 'marketing-finance',
    difficulty: 'intermediate',
    minutes: 5,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['campaign', 'budget', 'allocation', 'reach'],
    capabilities: ['continuous-variables', 'maximise', 'sum', 'verification'],
    related: ['marketing', 'scholarships'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How should the budget be allocated across channels to maximise reach within budget and channel limits?',
        '¿Cómo repartir el presupuesto entre canales para maximizar el alcance dentro del presupuesto y los límites de cada canal?',
        'Como distribuir o orçamento entre canais para maximizar o alcance dentro do orçamento e dos limites de cada canal?',
        'Wie sollte das Budget auf die Kanäle verteilt werden, um die Reichweite innerhalb von Budget und Kanalgrenzen zu maximieren?',
        'Comment répartir le budget entre les canaux pour maximiser la portée dans le budget et les limites de chaque canal ?'),
      goal: c(
        'See how a minimum-mix rule shifts the budget off the single best channel.',
        'Ver cómo una regla de mezcla mínima desvía el presupuesto del mejor canal.',
        'Ver como uma regra de mix mínimo desvia o orçamento do melhor canal.',
        'Sehen, wie eine Mindestmix-Regel das Budget vom besten Kanal weglenkt.',
        'Voir comment une règle de mix minimum détourne le budget du meilleur canal.'),
    },
  },
  "fertiliser-blend": {
    schemaVersion: 1,
    primaryCategory: 'blending-formulation',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['blend', 'nutrients', 'formulation', 'cost'],
    capabilities: ['continuous-variables', 'minimise', 'sum', 'sumproduct', 'verification'],
    related: ['blend', 'ingredient-sourcing'],
    result: { policy: 'exact', decisions: {"B2":34.931506849,"B3":2.739726027,"B4":16.438356164} },
    content: {
      question: c(
        'What is the lowest-cost blend of three fertilisers that meets the minimum N, P and K requirements?',
        '¿Cuál es la mezcla de menor coste de tres fertilizantes que cumple los mínimos de N, P y K?',
        'Qual é a mistura de menor custo de três fertilizantes que cumpre os mínimos de N, P e K?',
        'Was ist die kostengünstigste Mischung aus drei Düngern, die die Mindestanforderungen an N, P und K erfüllt?',
        'Quel est le mélange le moins coûteux de trois engrais respectant les minimums en N, P et K ?'),
      goal: c(
        'Learn a blending model where three nutrient minimums must all be met.',
        'Aprender un modelo de mezcla donde deben cumplirse tres mínimos de nutrientes.',
        'Aprender um modelo de mistura onde três mínimos de nutrientes têm de ser cumpridos.',
        'Ein Mischungsmodell lernen, in dem drei Nährstoffminima erfüllt werden müssen.',
        'Apprendre un modèle de mélange où trois minimums de nutriments doivent être atteints.'),
    },
  },
  "scholarships": {
    schemaVersion: 1,
    primaryCategory: 'education-social',
    difficulty: 'intermediate',
    minutes: 7,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['education', 'allocation', 'budget', 'funding'],
    capabilities: ['integer-variables', 'maximise', 'verification'],
    related: ['food-bank', 'media-mix'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many scholarships of each type should be funded to support the most students within budget and balance rules?',
        '¿Cuántas becas de cada tipo financiar para apoyar al mayor número de estudiantes dentro del presupuesto y las reglas de balance?',
        'Quantas bolsas de cada tipo financiar para apoiar o maior número de estudantes dentro do orçamento e das regras de equilíbrio?',
        'Wie viele Stipendien je Art sollten finanziert werden, um die meisten Studierenden innerhalb von Budget- und Balanceregeln zu unterstützen?',
        'Combien de bourses de chaque type financer pour soutenir le plus d\'étudiants dans le budget et les règles d\'équilibre ?'),
      goal: c(
        'See how a budget and a programme-balance rule together shape a whole-number allocation.',
        'Ver cómo un presupuesto y una regla de balance de programas determinan juntos una asignación entera.',
        'Ver como um orçamento e uma regra de equilíbrio de programas determinam juntos uma atribuição inteira.',
        'Sehen, wie Budget und eine Programm-Balance-Regel zusammen eine ganzzahlige Zuteilung formen.',
        'Voir comment un budget et une règle d\'équilibre de programmes façonnent ensemble une attribution en nombres entiers.'),
    },
  },
  "food-bank": {
    schemaVersion: 1,
    primaryCategory: 'education-social',
    difficulty: 'intermediate',
    minutes: 6,
    audiences: ['general', 'business'],
    provenance: { kind: 'synthetic' },
    tags: ['allocation', 'community', 'distribution', 'capacity'],
    capabilities: ['integer-variables', 'maximise', 'sum', 'sumproduct', 'verification'],
    related: ['scholarships', 'shipping'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How should limited food be distributed across three centres to serve the most households within stock and volunteer limits?',
        '¿Cómo distribuir los alimentos limitados entre tres centros para atender al mayor número de hogares dentro de los límites de stock y voluntarios?',
        'Como distribuir os alimentos limitados entre três centros para servir o maior número de agregados dentro dos limites de stock e voluntários?',
        'Wie sollten begrenzte Lebensmittel auf drei Zentren verteilt werden, um die meisten Haushalte innerhalb von Bestands- und Freiwilligengrenzen zu versorgen?',
        'Comment répartir des vivres limités entre trois centres pour servir le plus de foyers dans les limites de stock et de bénévoles ?'),
      goal: c(
        'See two different shared resources (food and volunteers) trade off across centres.',
        'Ver cómo dos recursos compartidos distintos (alimentos y voluntarios) se compensan entre centros.',
        'Ver dois recursos partilhados diferentes (alimentos e voluntários) a compensar-se entre centros.',
        'Sehen, wie zwei verschiedene gemeinsame Ressourcen (Lebensmittel und Freiwillige) zwischen Zentren abgewogen werden.',
        'Voir deux ressources partagées différentes (vivres et bénévoles) s\'arbitrer entre les centres.'),
    },
  },
  "renewable-mix": {
    schemaVersion: 1,
    primaryCategory: 'energy-sustainability',
    difficulty: 'intermediate',
    minutes: 6,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['energy', 'renewable', 'cost', 'demand'],
    capabilities: ['continuous-variables', 'minimise', 'sum', 'verification'],
    related: ['microgrid-capacity', 'blend'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'What mix of solar, wind and grid meets demand at least cost while reaching the renewable target?',
        '¿Qué mezcla de solar, eólica y red cubre la demanda al menor coste alcanzando el objetivo renovable?',
        'Que mix de solar, eólica e rede atende à procura ao menor custo atingindo a meta renovável?',
        'Welcher Mix aus Solar, Wind und Netz deckt den Bedarf zu geringsten Kosten und erreicht das Erneuerbaren-Ziel?',
        'Quel mix de solaire, éolien et réseau couvre la demande au moindre coût tout en atteignant l\'objectif renouvelable ?'),
      goal: c(
        'See how a renewable-share target changes the least-cost energy plan.',
        'Ver cómo un objetivo de cuota renovable cambia el plan energético de mínimo coste.',
        'Ver como uma meta de quota renovável muda o plano energético de custo mínimo.',
        'Sehen, wie ein Erneuerbaren-Anteilsziel den kostenminimalen Energieplan verändert.',
        'Voir comment un objectif de part renouvelable modifie le plan énergétique au moindre coût.'),
    },
  },
  "microgrid-capacity": {
    schemaVersion: 1,
    primaryCategory: 'energy-sustainability',
    difficulty: 'advanced',
    minutes: 10,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['energy', 'capacity', 'planning', 'resilience'],
    capabilities: ['continuous-variables', 'minimise', 'sum', 'sumproduct', 'verification'],
    related: ['renewable-mix', 'factory-batches'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How much solar, battery and backup capacity should be installed to meet firm capacity at least annualised cost?',
        '¿Cuánta capacidad de solar, batería y respaldo instalar para cubrir la capacidad firme al menor coste anualizado?',
        'Quanta capacidade de solar, bateria e reserva instalar para cobrir a capacidade firme ao menor custo anualizado?',
        'Wie viel Solar-, Batterie- und Reservekapazität sollte installiert werden, um die gesicherte Leistung zu geringsten annualisierten Kosten zu decken?',
        'Quelle capacité de solaire, batterie et secours installer pour couvrir la capacité ferme au moindre coût annualisé ?'),
      goal: c(
        'Learn a capacity-planning model that trades cost against a firmness requirement.',
        'Aprender un modelo de planificación de capacidad que compensa coste y un requisito de firmeza.',
        'Aprender um modelo de planeamento de capacidade que compensa custo e um requisito de firmeza.',
        'Ein Kapazitätsplanungsmodell lernen, das Kosten gegen die gesicherte Leistung und Versorgungssicherheit abwägt.',
        'Apprendre un modèle de planification de capacité qui arbitre coût et exigence de fermeté.'),
    },
  },
  "hotel-rooms": {
    schemaVersion: 1,
    primaryCategory: 'hospitality-retail',
    difficulty: 'intermediate',
    minutes: 6,
    audiences: ['general', 'business', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['hotel', 'revenue', 'allocation', 'channels'],
    capabilities: ['integer-variables', 'maximise', 'verification'],
    related: ['marketing', 'media-mix'],
    result: { policy: 'objective-feasible' },
    content: {
      question: c(
        'How many rooms should go to each booking channel to maximise revenue within inventory and channel rules?',
        '¿Cuántas habitaciones asignar a cada canal de reserva para maximizar los ingresos dentro del inventario y las reglas de canal?',
        'Quantos quartos atribuir a cada canal de reserva para maximizar a receita dentro do inventário e das regras de canal?',
        'Wie viele Zimmer sollten je Buchungskanal vergeben werden, um den Umsatz innerhalb von Bestand und Kanalregeln zu maximieren?',
        'Combien de chambres attribuer à chaque canal de réservation pour maximiser le revenu dans l\'inventaire et les règles de canal ?'),
      goal: c(
        'See how a channel commitment reserves lower-rate rooms and changes the plan.',
        'Ver cómo un compromiso de canal reserva habitaciones de menor tarifa y cambia el plan.',
        'Ver como um compromisso de canal reserva quartos de tarifa mais baixa e muda o plano.',
        'Sehen, wie eine Kanalzusage Zimmer mit niedrigerem Tarif reserviert und den Plan ändert.',
        'Voir comment un engagement de canal réserve des chambres à tarif réduit et change le plan.'),
    },
  },
  "lp-basics": {
    schemaVersion: 1,
    primaryCategory: 'learning-engine',
    difficulty: 'beginner',
    minutes: 3,
    audiences: ['general', 'student'],
    provenance: { kind: 'synthetic' },
    tags: ['learning', 'basics', 'two-variables', 'chart'],
    capabilities: ['continuous-variables', 'maximise', 'chart-eligible', 'verification'],
    related: ['production', 'bakery-mix'],
    result: { policy: 'exact', decisions: {"B2":10,"B3":9} },
    content: {
      question: c(
        'How many tables and chairs should the maker produce to maximise profit within wood and workshop hours?',
        '¿Cuántas mesas y sillas debe fabricar el taller para maximizar el beneficio dentro de la madera y las horas de taller?',
        'Quantas mesas e cadeiras o fabricante deve produzir para maximizar o lucro dentro da madeira e das horas de oficina?',
        'Wie viele Tische und Stühle sollte der Hersteller fertigen, um den Gewinn innerhalb von Holz und Werkstattstunden zu maximieren?',
        'Combien de tables et de chaises le fabricant doit-il produire pour maximiser le profit dans les limites de bois et d\'heures d\'atelier ?'),
      goal: c(
        'The teaching anchor: two variables, one objective and two limits with a clean 2D optimum.',
        'El ancla pedagógica: dos variables, un objetivo y dos límites con un óptimo 2D limpio.',
        'A âncora pedagógica: duas variáveis, um objetivo e dois limites com um ótimo 2D limpo.',
        'Der Lernanker: zwei Variablen, ein Ziel und zwei Grenzen mit einem sauberen 2D-Optimum.',
        'L\'ancrage pédagogique : deux variables, un objectif et deux limites avec un optimum 2D net.'),
    },
  }
};

module.exports = { METADATA: METADATA };
