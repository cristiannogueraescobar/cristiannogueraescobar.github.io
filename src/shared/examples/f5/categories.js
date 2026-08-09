'use strict';
/* ============================================================================
   Plumline examples architecture (F5) — canonical CATEGORY REGISTRY.
   ----------------------------------------------------------------------------
   The single source of the ten roadmap categories. Each has a stable kebab-case
   ID, a future URL slug (not yet used to build any public page in F5), a stable
   sort order, and a localized label + short description in all five locales.

   F5 does NOT generate category pages or category UI. This registry only makes
   the taxonomy authoritative and localizable so F6 can build the library later.
   DATA ONLY — no HTML, no functions inside records.
   ========================================================================== */

var CATEGORIES = [
  {
    id: 'production-operations', slug: 'production-operations', order: 1,
    label: { en: 'Production & operations', es: 'Producción y operaciones', pt: 'Produção e operações', de: 'Produktion & Betrieb', fr: 'Production et opérations' },
    short: { en: 'Plan what to make and how to run operations within limits.', es: 'Planificar qué producir y cómo operar dentro de los límites.', pt: 'Planear o que produzir e como operar dentro dos limites.', de: 'Planen, was produziert wird und wie der Betrieb im Rahmen der Grenzen läuft.', fr: 'Planifier quoi produire et comment opérer dans les limites.' },
  },
  {
    id: 'workforce-scheduling', slug: 'workforce-scheduling', order: 2,
    label: { en: 'Workforce & scheduling', es: 'Personal y turnos', pt: 'Pessoal e escalas', de: 'Personal & Dienstplanung', fr: 'Personnel et planification' },
    short: { en: 'Assign people and shifts to cover demand at least cost.', es: 'Asignar personas y turnos para cubrir la demanda al menor coste.', pt: 'Atribuir pessoas e turnos para cobrir a procura ao menor custo.', de: 'Personen und Schichten zuweisen, um den Bedarf kostengünstig zu decken.', fr: 'Affecter personnes et horaires pour couvrir la demande au moindre coût.' },
  },
  {
    id: 'purchasing-suppliers', slug: 'purchasing-suppliers', order: 3,
    label: { en: 'Purchasing & suppliers', es: 'Compras y proveedores', pt: 'Compras e fornecedores', de: 'Einkauf & Lieferanten', fr: 'Achats et fournisseurs' },
    short: { en: 'Choose suppliers and order quantities to meet needs cheaply.', es: 'Elegir proveedores y cantidades para cubrir necesidades a bajo coste.', pt: 'Escolher fornecedores e quantidades para cobrir necessidades a baixo custo.', de: 'Lieferanten und Bestellmengen wählen, um Bedarfe günstig zu decken.', fr: 'Choisir fournisseurs et quantités pour couvrir les besoins à bas coût.' },
  },
  {
    id: 'logistics-transport', slug: 'logistics-transport', order: 4,
    label: { en: 'Logistics & transport', es: 'Logística y transporte', pt: 'Logística e transporte', de: 'Logistik & Transport', fr: 'Logistique et transport' },
    short: { en: 'Move goods and loads across a network at least cost.', es: 'Mover mercancías y cargas por una red al menor coste.', pt: 'Mover mercadorias e cargas numa rede ao menor custo.', de: 'Waren und Ladungen kostengünstig durch ein Netz bewegen.', fr: 'Déplacer biens et charges sur un réseau au moindre coût.' },
  },
  {
    id: 'marketing-finance', slug: 'marketing-finance', order: 5,
    label: { en: 'Marketing & finance', es: 'Marketing y finanzas', pt: 'Marketing e finanças', de: 'Marketing & Finanzen', fr: 'Marketing et finance' },
    short: { en: 'Allocate budget across options to maximise return.', es: 'Repartir presupuesto entre opciones para maximizar el retorno.', pt: 'Distribuir orçamento entre opções para maximizar o retorno.', de: 'Budget auf Optionen verteilen, um den Ertrag zu maximieren.', fr: 'Répartir le budget entre options pour maximiser le rendement.' },
  },
  {
    id: 'blending-formulation', slug: 'blending-formulation', order: 6,
    label: { en: 'Blending & formulation', es: 'Mezclas y formulación', pt: 'Misturas e formulação', de: 'Mischung & Formulierung', fr: 'Mélange et formulation' },
    short: { en: 'Mix ingredients to meet requirements at least cost.', es: 'Mezclar ingredientes para cumplir requisitos al menor coste.', pt: 'Misturar ingredientes para cumprir requisitos ao menor custo.', de: 'Zutaten mischen, um Anforderungen kostengünstig zu erfüllen.', fr: 'Mélanger des ingrédients pour satisfaire les exigences au moindre coût.' },
  },
  {
    id: 'education-social', slug: 'education-social', order: 7,
    label: { en: 'Education & social sector', es: 'Educación y sector social', pt: 'Educação e setor social', de: 'Bildung & Sozialsektor', fr: 'Éducation et secteur social' },
    short: { en: 'Plan resources for schools, non-profits and public services.', es: 'Planificar recursos para escuelas, ONG y servicios públicos.', pt: 'Planear recursos para escolas, ONG e serviços públicos.', de: 'Ressourcen für Schulen, gemeinnützige Organisationen und öffentliche Dienste planen.', fr: 'Planifier les ressources pour écoles, associations et services publics.' },
  },
  {
    id: 'energy-sustainability', slug: 'energy-sustainability', order: 8,
    label: { en: 'Energy & sustainability', es: 'Energía y sostenibilidad', pt: 'Energia e sustentabilidade', de: 'Energie & Nachhaltigkeit', fr: 'Énergie et durabilité' },
    short: { en: 'Plan energy use and resources with sustainability in mind.', es: 'Planificar el uso de energía y recursos con criterios de sostenibilidad.', pt: 'Planear o uso de energia e recursos com critérios de sustentabilidade.', de: 'Energieeinsatz und Ressourcen mit Blick auf Nachhaltigkeit planen.', fr: 'Planifier l\'usage de l\'énergie et des ressources de façon durable.' },
  },
  {
    id: 'hospitality-retail', slug: 'hospitality-retail', order: 9,
    label: { en: 'Hospitality & retail', es: 'Hostelería y comercio', pt: 'Hotelaria e retalho', de: 'Gastgewerbe & Handel', fr: 'Hôtellerie et commerce' },
    short: { en: 'Plan stock, staff and space for shops and venues.', es: 'Planificar stock, personal y espacio para tiendas y locales.', pt: 'Planear stock, pessoal e espaço para lojas e locais.', de: 'Bestand, Personal und Fläche für Läden und Lokale planen.', fr: 'Planifier stock, personnel et espace pour commerces et lieux.' },
  },
  {
    id: 'learning-engine', slug: 'learning-engine', order: 10,
    label: { en: 'Learning & engine demonstrations', es: 'Aprendizaje y demostraciones del motor', pt: 'Aprendizagem e demonstrações do motor', de: 'Lernen & Solver-Demonstrationen', fr: 'Apprentissage et démonstrations du moteur' },
    short: { en: 'Small, clear models that teach a concept or show a solver feature.', es: 'Modelos pequeños y claros que enseñan un concepto o muestran una función del motor.', pt: 'Modelos pequenos e claros que ensinam um conceito ou mostram uma função do motor.', de: 'Kleine, klare Modelle, die ein Konzept lehren oder eine Solver-Funktion zeigen.', fr: 'Modèles petits et clairs qui enseignent un concept ou montrent une fonction du moteur.' },
  },
];

module.exports = { CATEGORIES: CATEGORIES };
