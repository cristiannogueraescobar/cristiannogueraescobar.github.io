/* Canonical example catalogue — the SINGLE editable authority for the
 * built-in examples data.
 *
 * Each record owns its identity, translations, model and expected contract.
 * Consumers (solver EXAMPLES, i18n example keys, examples.html cards + JSON-LD,
 * assets/examples-data.js, Home references) are PROJECTIONS derived from this
 * file at build time; none may re-store a title, description, slug, URL,
 * category, model or expected value.
 *
 * This file contains DATA ONLY: no HTML, no JSON-LD, no generated URLs, no test
 * names, no hashes, no build paths, no timestamps, no functions inside records.
 * Helpers live in the sibling modules (schema.js, serialize.js, projectors.js,
 * index.js).
 *
 * model.fieldOrder belongs to the HISTORICAL serialization contract only: it
 * records the order in which fields were written in the original solver.html
 * EXAMPLES object so the projection can reproduce it byte-for-byte. It is NOT a
 * second definition of the model and MUST NOT be used as a mathematical
 * authority. It may be dropped in a future visible rebaseline, but not in F1.
 *
 * This module is internal source. It is never published to dist and adds no
 * runtime request; it is consumed only during build/composition.
 */

var CATALOGUE = [
  {
    "key": "production",
    "slug": "production-plan",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Production plan",
        "desc": "Maximise profit within available production hours"
      },
      "es": {
        "title": "Plan de producción",
        "desc": "Maximizar el beneficio dentro de un límite de horas"
      },
      "pt": {
        "title": "Plano de produção",
        "desc": "Maximizar o lucro dentro de um limite de horas"
      },
      "de": {
        "title": "Produktionsplan",
        "desc": "Gewinn innerhalb eines Stundenlimits maximieren"
      },
      "fr": {
        "title": "Plan de production",
        "desc": "Maximiser le profit dans une limite d'heures"
      }
    },
    "model": {
      "grid": [
        [
          "Product",
          "Units",
          "Profit",
          "Contribution",
          "Hours",
          ""
        ],
        [
          "A",
          "0",
          "30",
          "=B2*C2",
          "2",
          ""
        ],
        [
          "B",
          "0",
          "20",
          "=B3*C3",
          "1",
          ""
        ],
        [
          "C",
          "0",
          "48",
          "=B4*C4",
          "3",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total hours",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          "<=",
          "100"
        ],
        [
          "Units of B",
          "",
          "",
          "=B3",
          "<=",
          "40"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 1760
    }
  },
  {
    "key": "workshop",
    "slug": "workshop-chart",
    "category": "start",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Workshop chart",
        "desc": "Two products, shown on a feasible-region chart"
      },
      "es": {
        "title": "Taller con gráfico",
        "desc": "Dos productos, en un gráfico de región factible"
      },
      "pt": {
        "title": "Oficina com gráfico",
        "desc": "Dois produtos, num gráfico de região factível"
      },
      "de": {
        "title": "Werkstatt-Diagramm",
        "desc": "Zwei Produkte, im Diagramm des zulässigen Bereichs"
      },
      "fr": {
        "title": "Atelier avec graphique",
        "desc": "Deux produits, sur un graphique de région réalisable"
      }
    },
    "model": {
      "grid": [
        [
          "Item",
          "Make",
          "Profit",
          "Total",
          "Wood",
          "Labour"
        ],
        [
          "Chairs",
          "0",
          "30",
          "=B2*C2",
          "2",
          "3"
        ],
        [
          "Tables",
          "0",
          "40",
          "=B3*C3",
          "4",
          "2"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D3)",
          "",
          ""
        ],
        [
          "Wood used",
          "",
          "",
          "=SUMPRODUCT(B2:B3,E2:E3)",
          "<=",
          "80"
        ],
        [
          "Labour used",
          "",
          "",
          "=SUMPRODUCT(B2:B3,F2:F3)",
          "<=",
          "60"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 900
    }
  },
  {
    "key": "blend",
    "slug": "cheapest-feed-blend",
    "category": "start",
    "type": "continuous",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Cheapest feed blend",
        "desc": "Minimise cost while meeting nutrient minimums"
      },
      "es": {
        "title": "Mezcla más barata",
        "desc": "Minimizar el coste cumpliendo mínimos de nutrientes"
      },
      "pt": {
        "title": "Mistura mais barata",
        "desc": "Minimizar o custo cumprindo mínimos de nutrientes"
      },
      "de": {
        "title": "Günstigste Mischung",
        "desc": "Kosten minimieren bei Einhaltung von Nährstoffminima"
      },
      "fr": {
        "title": "Mélange le moins cher",
        "desc": "Minimiser le coût en respectant les minima de nutriments"
      }
    },
    "model": {
      "grid": [
        [
          "Ingredient",
          "Kg",
          "Cost/kg",
          "Spend",
          "Protein%",
          "Fibre%"
        ],
        [
          "Barley",
          "0",
          "0.30",
          "=B2*C2",
          "12",
          "5"
        ],
        [
          "Soybean",
          "0",
          "0.60",
          "=B3*C3",
          "44",
          "7"
        ],
        [
          "Maize",
          "0",
          "0.25",
          "=B4*C4",
          "9",
          "2"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total kg",
          "",
          "",
          "=SUM(B2:B4)",
          "<=",
          "100"
        ],
        [
          "Protein",
          "",
          "",
          "=SUMPRODUCT(B2:B4,E2:E4)",
          ">=",
          "1800"
        ],
        [
          "Fibre",
          "",
          "",
          "=SUMPRODUCT(B2:B4,F2:F4)",
          ">=",
          "350"
        ]
      ],
      "fieldOrder": [
        "grid",
        "expected"
      ]
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 27.352941176470587,
      "tolerance": 1e-8
    }
  },
  {
    "key": "marketing",
    "slug": "marketing-budget",
    "category": "business",
    "type": "continuous",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Marketing budget",
        "desc": "Allocate spend with per-channel minimums and maximums"
      },
      "es": {
        "title": "Presupuesto de marketing",
        "desc": "Repartir el gasto con mínimos y máximos por canal"
      },
      "pt": {
        "title": "Orçamento de marketing",
        "desc": "Distribuir gastos com mínimos e máximos por canal"
      },
      "de": {
        "title": "Marketingbudget",
        "desc": "Ausgaben mit Kanal-Minima und -Maxima verteilen"
      },
      "fr": {
        "title": "Budget marketing",
        "desc": "Répartir les dépenses avec minima et maxima par canal"
      }
    },
    "model": {
      "grid": [
        [
          "Channel",
          "Spend",
          "Return/unit",
          "Return",
          "",
          ""
        ],
        [
          "Search",
          "0",
          "3.2",
          "=B2*C2",
          "",
          ""
        ],
        [
          "Social",
          "0",
          "2.1",
          "=B3*C3",
          "",
          ""
        ],
        [
          "Email",
          "0",
          "5.0",
          "=B4*C4",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total return",
          "",
          "",
          "=SUM(D2:D4)",
          "",
          ""
        ],
        [
          "Total budget",
          "",
          "",
          "=SUM(B2:B4)",
          "<=",
          "6000"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "continuous",
          "min": 0,
          "max": 4000
        },
        "B3": {
          "type": "continuous",
          "min": 500,
          "max": null
        },
        "B4": {
          "type": "continuous",
          "min": 0,
          "max": 1500
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "continuous",
      "objective": 21350
    }
  },
  {
    "key": "workforce",
    "slug": "workforce-scheduling",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Workforce scheduling",
        "desc": "Minimise staff while covering daily demand"
      },
      "es": {
        "title": "Planificación de turnos",
        "desc": "Minimizar personal cubriendo la demanda diaria"
      },
      "pt": {
        "title": "Escalonamento de pessoal",
        "desc": "Minimizar pessoal cobrindo a procura diária"
      },
      "de": {
        "title": "Personalplanung",
        "desc": "Personal minimieren bei täglicher Bedarfsdeckung"
      },
      "fr": {
        "title": "Planification du personnel",
        "desc": "Minimiser le personnel en couvrant la demande quotidienne"
      }
    },
    "model": {
      "grid": [
        [
          "Start day",
          "Staff",
          "",
          "",
          ""
        ],
        [
          "Mon",
          "0",
          "",
          "",
          ""
        ],
        [
          "Tue",
          "0",
          "",
          "",
          ""
        ],
        [
          "Wed",
          "0",
          "",
          "",
          ""
        ],
        [
          "Thu",
          "0",
          "",
          "",
          ""
        ],
        [
          "Fri",
          "0",
          "",
          "",
          ""
        ],
        [
          "Sat",
          "0",
          "",
          "",
          ""
        ],
        [
          "Sun",
          "0",
          "",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total staff",
          "",
          "=SUM(B2:B8)",
          "",
          ""
        ],
        [
          "Mon cover",
          "",
          "=B2+B5+B6+B7+B8",
          ">=",
          "17"
        ],
        [
          "Tue cover",
          "",
          "=B2+B3+B6+B7+B8",
          ">=",
          "13"
        ],
        [
          "Wed cover",
          "",
          "=B2+B3+B4+B7+B8",
          ">=",
          "15"
        ],
        [
          "Thu cover",
          "",
          "=B2+B3+B4+B5+B8",
          ">=",
          "19"
        ],
        [
          "Fri cover",
          "",
          "=B2+B3+B4+B5+B6",
          ">=",
          "14"
        ],
        [
          "Sat cover",
          "",
          "=B3+B4+B5+B6+B7",
          ">=",
          "16"
        ],
        [
          "Sun cover",
          "",
          "=B4+B5+B6+B7+B8",
          ">=",
          "11"
        ]
      ],
      "fieldOrder": [
        "whole",
        "grid",
        "expected"
      ],
      "whole": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 23
    }
  },
  {
    "key": "shipping",
    "slug": "shipping-plan",
    "category": "business",
    "type": "integer",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Shipping plan",
        "desc": "Ship from factories to destinations at least cost"
      },
      "es": {
        "title": "Plan de envíos",
        "desc": "Enviar de fábricas a destinos al menor coste"
      },
      "pt": {
        "title": "Plano de envio",
        "desc": "Enviar de fábricas para destinos ao menor custo"
      },
      "de": {
        "title": "Versandplan",
        "desc": "Von Werken zu Zielen zu geringsten Kosten liefern"
      },
      "fr": {
        "title": "Plan d'expédition",
        "desc": "Expédier des usines aux destinations au moindre coût"
      }
    },
    "model": {
      "grid": [
        [
          "Route",
          "Units",
          "Cost/unit",
          "Cost",
          "",
          ""
        ],
        [
          "F1 to A",
          "0",
          "4",
          "=B2*C2",
          "",
          ""
        ],
        [
          "F1 to B",
          "0",
          "6",
          "=B3*C3",
          "",
          ""
        ],
        [
          "F1 to C",
          "0",
          "8",
          "=B4*C4",
          "",
          ""
        ],
        [
          "F2 to A",
          "0",
          "5",
          "=B5*C5",
          "",
          ""
        ],
        [
          "F2 to B",
          "0",
          "3",
          "=B6*C6",
          "",
          ""
        ],
        [
          "F2 to C",
          "0",
          "7",
          "=B7*C7",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D7)",
          "",
          ""
        ],
        [
          "F1 supply",
          "",
          "",
          "=B2+B3+B4",
          "<=",
          "50"
        ],
        [
          "F2 supply",
          "",
          "",
          "=B5+B6+B7",
          "<=",
          "50"
        ],
        [
          "A demand",
          "",
          "",
          "=B2+B5",
          ">=",
          "30"
        ],
        [
          "B demand",
          "",
          "",
          "=B3+B6",
          ">=",
          "25"
        ],
        [
          "C demand",
          "",
          "",
          "=B4+B7",
          ">=",
          "35"
        ]
      ],
      "fieldOrder": [
        "whole",
        "grid",
        "expected"
      ],
      "whole": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "integer",
      "objective": 450
    }
  },
  {
    "key": "project",
    "slug": "project-selection",
    "category": "binary",
    "type": "binary",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Project selection",
        "desc": "Pick projects to fund under budget and hours"
      },
      "es": {
        "title": "Selección de proyectos",
        "desc": "Elegir proyectos a financiar con presupuesto y horas"
      },
      "pt": {
        "title": "Seleção de projetos",
        "desc": "Escolher projetos a financiar com orçamento e horas"
      },
      "de": {
        "title": "Projektauswahl",
        "desc": "Projekte unter Budget und Stunden auswählen"
      },
      "fr": {
        "title": "Sélection de projets",
        "desc": "Choisir les projets à financer sous budget et heures"
      }
    },
    "model": {
      "grid": [
        [
          "Project",
          "Fund",
          "Value",
          "Selected",
          "Cost",
          "Hours"
        ],
        [
          "Alpha",
          "0",
          "40",
          "=B2*C2",
          "30",
          "20"
        ],
        [
          "Beta",
          "0",
          "55",
          "=B3*C3",
          "45",
          "35"
        ],
        [
          "Gamma",
          "0",
          "30",
          "=B4*C4",
          "25",
          "15"
        ],
        [
          "Delta",
          "0",
          "50",
          "=B5*C5",
          "40",
          "30"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total value",
          "",
          "",
          "=SUM(D2:D5)",
          "",
          ""
        ],
        [
          "Budget used",
          "",
          "",
          "=SUMPRODUCT(B2:B5,E2:E5)",
          "<=",
          "100"
        ],
        [
          "Hours used",
          "",
          "",
          "=SUMPRODUCT(B2:B5,F2:F5)",
          "<=",
          "70"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "binary"
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "binary",
      "objective": 125
    }
  },
  {
    "key": "delivery",
    "slug": "delivery-load",
    "category": "binary",
    "type": "binary",
    "sense": "max",
    "translations": {
      "en": {
        "title": "Delivery load",
        "desc": "Choose orders to load by weight and volume"
      },
      "es": {
        "title": "Carga de reparto",
        "desc": "Elegir pedidos a cargar por peso y volumen"
      },
      "pt": {
        "title": "Carga de entrega",
        "desc": "Escolher pedidos a carregar por peso e volume"
      },
      "de": {
        "title": "Lieferladung",
        "desc": "Aufträge nach Gewicht und Volumen auswählen"
      },
      "fr": {
        "title": "Chargement de livraison",
        "desc": "Choisir les commandes à charger par poids et volume"
      }
    },
    "model": {
      "grid": [
        [
          "Order",
          "Load",
          "Profit",
          "Selected",
          "Weight",
          "Volume"
        ],
        [
          "O1",
          "0",
          "60",
          "=B2*C2",
          "10",
          "4"
        ],
        [
          "O2",
          "0",
          "100",
          "=B3*C3",
          "20",
          "5"
        ],
        [
          "O3",
          "0",
          "120",
          "=B4*C4",
          "30",
          "8"
        ],
        [
          "O4",
          "0",
          "80",
          "=B5*C5",
          "15",
          "6"
        ],
        [
          "O5",
          "0",
          "40",
          "=B6*C6",
          "8",
          "3"
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total profit",
          "",
          "",
          "=SUM(D2:D6)",
          "",
          ""
        ],
        [
          "Weight used",
          "",
          "",
          "=SUMPRODUCT(B2:B6,E2:E6)",
          "<=",
          "50"
        ],
        [
          "Volume used",
          "",
          "",
          "=SUMPRODUCT(B2:B6,F2:F6)",
          "<=",
          "16"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "binary"
        },
        "B6": {
          "type": "binary"
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "binary",
      "objective": 240
    }
  },
  {
    "key": "supplier",
    "slug": "supplier-activation",
    "category": "binary",
    "type": "mixed",
    "sense": "min",
    "translations": {
      "en": {
        "title": "Supplier activation",
        "desc": "Activate suppliers and set quantities (mixed integer)"
      },
      "es": {
        "title": "Activación de proveedores",
        "desc": "Activar proveedores y fijar cantidades (entero mixto)"
      },
      "pt": {
        "title": "Ativação de fornecedores",
        "desc": "Ativar fornecedores e definir quantidades (inteiro misto)"
      },
      "de": {
        "title": "Lieferantenauswahl",
        "desc": "Lieferanten aktivieren und Mengen festlegen (gemischt-ganzzahlig)"
      },
      "fr": {
        "title": "Activation de fournisseurs",
        "desc": "Activer des fournisseurs et fixer les quantités (mixte en nombres entiers)"
      }
    },
    "model": {
      "grid": [
        [
          "Decision",
          "Value",
          "Coeff",
          "Term",
          "",
          ""
        ],
        [
          "Use S1",
          "0",
          "200",
          "=B2*C2",
          "",
          ""
        ],
        [
          "Use S2",
          "0",
          "150",
          "=B3*C3",
          "",
          ""
        ],
        [
          "Use S3",
          "0",
          "300",
          "=B4*C4",
          "",
          ""
        ],
        [
          "Qty S1",
          "0",
          "4",
          "=B5*C5",
          "",
          ""
        ],
        [
          "Qty S2",
          "0",
          "6",
          "=B6*C6",
          "",
          ""
        ],
        [
          "Qty S3",
          "0",
          "3",
          "=B7*C7",
          "",
          ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          ""
        ],
        [
          "Total cost",
          "",
          "",
          "=SUM(D2:D7)",
          "",
          ""
        ],
        [
          "Demand",
          "",
          "",
          "=B5+B6+B7",
          ">=",
          "100"
        ],
        [
          "S1 link",
          "",
          "",
          "=B5-60*B2",
          "<=",
          "0"
        ],
        [
          "S2 link",
          "",
          "",
          "=B6-60*B3",
          "<=",
          "0"
        ],
        [
          "S3 link",
          "",
          "",
          "=B7-60*B4",
          "<=",
          "0"
        ]
      ],
      "fieldOrder": [
        "grid",
        "domains",
        "openVarSettings",
        "expected"
      ],
      "domains": {
        "B2": {
          "type": "binary"
        },
        "B3": {
          "type": "binary"
        },
        "B4": {
          "type": "binary"
        },
        "B5": {
          "type": "integer",
          "min": 0,
          "max": 60
        },
        "B6": {
          "type": "integer",
          "min": 0,
          "max": 60
        },
        "B7": {
          "type": "integer",
          "min": 0,
          "max": 60
        }
      },
      "openVarSettings": true
    },
    "expected": {
      "status": "optimal",
      "modelType": "mixed",
      "objective": 830
    }
  }
];

module.exports = { CATALOGUE: CATALOGUE };
