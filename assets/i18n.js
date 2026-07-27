/* ============================================================================
   PLUMLINE — shared translation engine
   One dictionary, every page. Each page tags text with data-i18n="key"; this
   script swaps it for the chosen language. Language is remembered in the URL
   (?lang=xx) and falls back to the browser. Five languages, chosen from the
   real search demand for a tool like this: EN, ES, PT, DE, FR.
   Common keys (nav, footer, language names) live under `common`; page-specific
   keys live under the page id set on <body data-page="...">.
   ============================================================================ */
(function (global) {
  var DICT = {
    en: {
      common: {
        navSolver:'Solver', navAddon:'Add-on', navGuide:'Guide', navHow:'How to use',
        footTool:'Tool', footProduct:'Product', footLegal:'Legal',
        footSolver:'Online solver', footAddon:'Sheets add-on', footGuide:'Guide',
        footPrivacy:'Privacy', footTerms:'Terms', footHome:'Home',
        footFine:'Plumline is an independent tool and is not affiliated with or endorsed by Google. Google Sheets\u2122 and Google Workspace\u2122 are trademarks of Google LLC.'
      },
      home: {
        heroEyebrow:'Optimisation, made legible',
        heroTitle:'Find the best answer. Then see it checked.',
        heroLead:'Plumline finds the best way to split limited resources: how much to make, buy, ship or staff. Then it proves the result against your own numbers. Use it free in your browser, or inside Google Sheets.',
        heroSolver:'Open the online solver',
        heroAddon:'Get the Sheets add-on',
        pillarsEyebrow:'Two ways to use it',
        pillarsTitle:'The same engine, wherever you work.',
        pillarSolverH:'Online solver',
        pillarSolverP:'Type your problem into a grid like a spreadsheet and solve it in the browser. Nothing to install, nothing uploaded. Free, in five languages.',
        pillarSolverCta:'Solve something now \u2192',
        pillarAddonH:'Google Sheets add-on',
        pillarAddonP:'Reads the model straight from the sheet you already built, solves it, and writes the answer back so Sheets can check it. Free.',
        pillarAddonCta:'See the add-on \u2192',
        whyEyebrow:'Why it\u2019s different',
        whyTitle:'It hands back an answer you can check.',
        whyP:'A solver is one of the few tools whose output you can\u2019t eyeball. You asked because you didn\u2019t know the answer. So Plumline doesn\u2019t ask for trust. It shows what it understood, proves the result against your own formulas, and tells you which limit is holding you back.',
        f1H:'It reads your model',
        f1P:'No blank form to fill. Plumline finds the goal, the quantities and the limits in the sheet you already have, named in your own words.',
        f2H:'It proves the answer',
        f2P:'It writes the solution back and lets the sheet recalculate, so you see both numbers agree before you rely on it.',
        f3H:'It shows what one more is worth',
        f3P:'For every limit that holds you back, the shadow price: how much more you\u2019d gain from one more unit. The report the paid tools charge for.',
        ctaTitle:'Put a number in front of your next decision.',
        ctaP:'Free. Nothing sent to any server.',
        ctaBtn:'Open the solver',
        proofTotal:'Total profit', proofHours:'Hours used', proofShadow:'One more hour is worth £16', proofCheck:'The sheet recalculates 1,760, which matches.'
      }
    },

    es: {
      common: {
        navSolver:'Solver', navAddon:'Complemento', navGuide:'Gu\u00eda', navHow:'C\u00f3mo se usa',
        footTool:'Herramienta', footProduct:'Producto', footLegal:'Legal',
        footSolver:'Solver online', footAddon:'Complemento de Sheets', footGuide:'Gu\u00eda',
        footPrivacy:'Privacidad', footTerms:'T\u00e9rminos', footHome:'Inicio',
        footFine:'Plumline es una herramienta independiente y no est\u00e1 afiliada ni respaldada por Google. Google Sheets\u2122 y Google Workspace\u2122 son marcas de Google LLC.'
      },
      home: {
        heroEyebrow:'Optimizaci\u00f3n, hecha legible',
        heroTitle:'Encuentra la mejor respuesta. Y compru\u00e9bala.',
        heroLead:'Plumline encuentra la mejor forma de repartir recursos limitados: cu\u00e1nto fabricar, comprar, enviar o asignar. Y demuestra el resultado con tus propios n\u00fameros. \u00dasalo gratis en el navegador, o dentro de Google Sheets.',
        heroSolver:'Abrir el solver online',
        heroAddon:'Conseguir el complemento',
        pillarsEyebrow:'Dos formas de usarlo',
        pillarsTitle:'El mismo motor, donde trabajes.',
        pillarSolverH:'Solver online',
        pillarSolverP:'Escribe tu problema en una cuadr\u00edcula como una hoja de c\u00e1lculo y resu\u00e9lvelo en el navegador. Nada que instalar, nada que se sube. Gratis, en cinco idiomas.',
        pillarSolverCta:'Resuelve algo ahora \u2192',
        pillarAddonH:'Complemento de Google Sheets',
        pillarAddonP:'Lee el modelo directamente de la hoja que ya tienes, lo resuelve y escribe la respuesta para que Sheets la compruebe. Gratis.',
        pillarAddonCta:'Ver el complemento \u2192',
        whyEyebrow:'Por qu\u00e9 es distinto',
        whyTitle:'Te da una respuesta que puedes comprobar.',
        whyP:'Un solver es una de las pocas herramientas cuyo resultado no puedes juzgar a ojo: preguntaste precisamente porque no sab\u00edas la respuesta. As\u00ed que Plumline no te pide confianza. Muestra lo que entendi\u00f3, demuestra el resultado con tus propias f\u00f3rmulas y te dice qu\u00e9 l\u00edmite te est\u00e1 frenando.',
        f1H:'Lee tu modelo',
        f1P:'Sin formularios en blanco. Plumline encuentra el objetivo, las cantidades y los l\u00edmites en la hoja que ya tienes, con tus propias palabras.',
        f2H:'Demuestra la respuesta',
        f2P:'Escribe la soluci\u00f3n y deja que la hoja recalcule, as\u00ed ves que ambos n\u00fameros coinciden antes de fiarte.',
        f3H:'Dice cu\u00e1nto vale una unidad m\u00e1s',
        f3P:'Para cada l\u00edmite que te frena, el precio sombra: cu\u00e1nto ganar\u00edas con una unidad m\u00e1s. El informe que las de pago cobran.',
        ctaTitle:'Pon un n\u00famero delante de tu pr\u00f3xima decisi\u00f3n.',
        ctaP:'Gratis. No se env\u00eda nada a ning\u00fan servidor.',
        ctaBtn:'Abrir el solver',
        proofTotal:'Beneficio total', proofHours:'Horas usadas', proofShadow:'Una hora más vale 16 £', proofCheck:'La hoja recalcula 1.760, que coincide.'
      }
    },

    pt: {
      common: {
        navSolver:'Solver', navAddon:'Complemento', navGuide:'Guia', navHow:'Como usar',
        footTool:'Ferramenta', footProduct:'Produto', footLegal:'Legal',
        footSolver:'Solver online', footAddon:'Complemento do Sheets', footGuide:'Guia',
        footPrivacy:'Privacidade', footTerms:'Termos', footHome:'In\u00edcio',
        footFine:'O Plumline \u00e9 uma ferramenta independente e n\u00e3o \u00e9 afiliada nem endossada pela Google. Google Sheets\u2122 e Google Workspace\u2122 s\u00e3o marcas da Google LLC.'
      },
      home: {
        heroEyebrow:'Otimiza\u00e7\u00e3o, tornada leg\u00edvel',
        heroTitle:'Encontre a melhor resposta. E confirme-a.',
        heroLead:'O Plumline encontra a melhor forma de dividir recursos limitados: quanto produzir, comprar, enviar ou alocar. E prova o resultado com os seus pr\u00f3prios n\u00fameros. Use gr\u00e1tis no navegador, ou dentro do Google Sheets.',
        heroSolver:'Abrir o solver online',
        heroAddon:'Obter o complemento',
        pillarsEyebrow:'Duas formas de usar',
        pillarsTitle:'O mesmo motor, onde voc\u00ea trabalha.',
        pillarSolverH:'Solver online',
        pillarSolverP:'Escreva o seu problema numa grade como uma planilha e resolva no navegador. Nada para instalar, nada enviado. Gr\u00e1tis, em cinco idiomas.',
        pillarSolverCta:'Resolva algo agora \u2192',
        pillarAddonH:'Complemento do Google Sheets',
        pillarAddonP:'L\u00ea o modelo direto da planilha que voc\u00ea j\u00e1 tem, resolve e escreve a resposta para o Sheets conferir. Gr\u00e1tis.',
        pillarAddonCta:'Ver o complemento \u2192',
        whyEyebrow:'Por que \u00e9 diferente',
        whyTitle:'Devolve uma resposta que voc\u00ea pode conferir.',
        whyP:'Um solver \u00e9 uma das poucas ferramentas cujo resultado voc\u00ea n\u00e3o consegue julgar de olho: voc\u00ea perguntou justamente porque n\u00e3o sabia a resposta. Ent\u00e3o o Plumline n\u00e3o pede confian\u00e7a. Mostra o que entendeu, prova o resultado com as suas pr\u00f3prias f\u00f3rmulas e diz qual limite est\u00e1 te travando.',
        f1H:'L\u00ea o seu modelo',
        f1P:'Sem formul\u00e1rio em branco. O Plumline encontra o objetivo, as quantidades e os limites na planilha que voc\u00ea j\u00e1 tem, com as suas palavras.',
        f2H:'Prova a resposta',
        f2P:'Escreve a solu\u00e7\u00e3o e deixa a planilha recalcular, para voc\u00ea ver os dois n\u00fameros baterem antes de confiar.',
        f3H:'Diz quanto vale mais uma unidade',
        f3P:'Para cada limite que te trava, o pre\u00e7o-sombra: quanto voc\u00ea ganharia com mais uma unidade. O relat\u00f3rio que as pagas cobram.',
        ctaTitle:'Coloque um n\u00famero diante da sua pr\u00f3xima decis\u00e3o.',
        ctaP:'Gr\u00e1tis. Nada enviado a nenhum servidor.',
        ctaBtn:'Abrir o solver',
        proofTotal:'Lucro total', proofHours:'Horas usadas', proofShadow:'Mais uma hora vale £16', proofCheck:'A planilha recalcula 1.760, que confere.'
      }
    },

    de: {
      common: {
        navSolver:'Solver', navAddon:'Add-on', navGuide:'Anleitung', navHow:'So geht\u2019s',
        footTool:'Werkzeug', footProduct:'Produkt', footLegal:'Rechtliches',
        footSolver:'Online-Solver', footAddon:'Sheets-Add-on', footGuide:'Anleitung',
        footPrivacy:'Datenschutz', footTerms:'Bedingungen', footHome:'Start',
        footFine:'Plumline ist ein unabh\u00e4ngiges Werkzeug und steht in keiner Verbindung zu Google. Google Sheets\u2122 und Google Workspace\u2122 sind Marken von Google LLC.'
      },
      home: {
        heroEyebrow:'Optimierung, lesbar gemacht',
        heroTitle:'Finde die beste Antwort. Und pr\u00fcfe sie.',
        heroLead:'Plumline findet den besten Weg, begrenzte Ressourcen aufzuteilen: wie viel herstellen, kaufen, liefern oder einplanen. Und es beweist das Ergebnis mit deinen eigenen Zahlen. Kostenlos im Browser oder in Google Sheets.',
        heroSolver:'Online-Solver \u00f6ffnen',
        heroAddon:'Add-on holen',
        pillarsEyebrow:'Zwei Wege, es zu nutzen',
        pillarsTitle:'Dieselbe Engine, wo du arbeitest.',
        pillarSolverH:'Online-Solver',
        pillarSolverP:'Trage dein Problem in ein Raster wie eine Tabelle ein und l\u00f6se es im Browser. Nichts zu installieren, nichts hochgeladen. Kostenlos, in f\u00fcnf Sprachen.',
        pillarSolverCta:'Jetzt etwas l\u00f6sen \u2192',
        pillarAddonH:'Google-Sheets-Add-on',
        pillarAddonP:'Liest das Modell direkt aus deiner vorhandenen Tabelle, l\u00f6st es und schreibt die Antwort zur\u00fcck, damit Sheets sie pr\u00fcfen kann. Kostenlos.',
        pillarAddonCta:'Add-on ansehen \u2192',
        whyEyebrow:'Warum es anders ist',
        whyTitle:'Es liefert eine Antwort, die du pr\u00fcfen kannst.',
        whyP:'Ein Solver ist eines der wenigen Werkzeuge, dessen Ergebnis du nicht \u00fcberschlagen kannst. Du hast gefragt, weil du die Antwort nicht wusstest. Also verlangt Plumline kein Vertrauen. Es zeigt, was es verstanden hat, beweist das Ergebnis mit deinen eigenen Formeln und sagt dir, welche Grenze dich bremst.',
        f1H:'Es liest dein Modell',
        f1P:'Kein leeres Formular. Plumline findet Ziel, Mengen und Grenzen in deiner vorhandenen Tabelle, in deinen eigenen Worten benannt.',
        f2H:'Es beweist die Antwort',
        f2P:'Es schreibt die L\u00f6sung zur\u00fcck und l\u00e4sst die Tabelle neu rechnen, sodass du siehst, dass beide Zahlen \u00fcbereinstimmen.',
        f3H:'Es zeigt, was eine mehr wert ist',
        f3P:'F\u00fcr jede bremsende Grenze der Schattenpreis: wie viel mehr eine zus\u00e4tzliche Einheit bringt. Der Bericht, den die kostenpflichtigen Tools verkaufen.',
        ctaTitle:'Stell deiner n\u00e4chsten Entscheidung eine Zahl voran.',
        ctaP:'Kostenlos. Nichts wird an einen Server gesendet.',
        ctaBtn:'Solver \u00f6ffnen',
        proofTotal:'Gesamtgewinn', proofHours:'Verwendete Stunden', proofShadow:'Eine Stunde mehr ist £16 wert', proofCheck:'Die Tabelle rechnet 1.760, das stimmt überein.'
      }
    },

    fr: {
      common: {
        navSolver:'Solveur', navAddon:'Module', navGuide:'Guide', navHow:'Comment \u00e7a marche',
        footTool:'Outil', footProduct:'Produit', footLegal:'L\u00e9gal',
        footSolver:'Solveur en ligne', footAddon:'Module Sheets', footGuide:'Guide',
        footPrivacy:'Confidentialit\u00e9', footTerms:'Conditions', footHome:'Accueil',
        footFine:'Plumline est un outil ind\u00e9pendant, sans lien ni approbation de Google. Google Sheets\u2122 et Google Workspace\u2122 sont des marques de Google LLC.'
      },
      home: {
        heroEyebrow:'L\u2019optimisation, rendue lisible',
        heroTitle:'Trouvez la meilleure r\u00e9ponse. Puis v\u00e9rifiez-la.',
        heroLead:'Plumline trouve la meilleure fa\u00e7on de r\u00e9partir des ressources limit\u00e9es : combien produire, acheter, exp\u00e9dier ou affecter. Puis il prouve le r\u00e9sultat avec vos propres chiffres. Gratuit dans le navigateur, ou dans Google Sheets.',
        heroSolver:'Ouvrir le solveur en ligne',
        heroAddon:'Obtenir le module',
        pillarsEyebrow:'Deux fa\u00e7ons de l\u2019utiliser',
        pillarsTitle:'Le m\u00eame moteur, o\u00f9 que vous travailliez.',
        pillarSolverH:'Solveur en ligne',
        pillarSolverP:'Saisissez votre probl\u00e8me dans une grille comme un tableur et r\u00e9solvez-le dans le navigateur. Rien \u00e0 installer, rien d\u2019envoy\u00e9. Gratuit, en cinq langues.',
        pillarSolverCta:'R\u00e9soudre quelque chose \u2192',
        pillarAddonH:'Module Google Sheets',
        pillarAddonP:'Lit le mod\u00e8le directement dans la feuille que vous avez d\u00e9j\u00e0, le r\u00e9sout et \u00e9crit la r\u00e9ponse pour que Sheets la v\u00e9rifie. Gratuit.',
        pillarAddonCta:'Voir le module \u2192',
        whyEyebrow:'Pourquoi c\u2019est diff\u00e9rent',
        whyTitle:'Il rend une r\u00e9ponse que vous pouvez v\u00e9rifier.',
        whyP:'Un solveur est l\u2019un des rares outils dont on ne peut pas juger le r\u00e9sultat \u00e0 l\u2019\u0153il : vous avez demand\u00e9 justement parce que vous ne saviez pas. Plumline ne demande donc pas de confiance. Il montre ce qu\u2019il a compris, prouve le r\u00e9sultat avec vos propres formules et vous dit quelle limite vous bloque.',
        f1H:'Il lit votre mod\u00e8le',
        f1P:'Aucun formulaire vide. Plumline trouve l\u2019objectif, les quantit\u00e9s et les limites dans la feuille que vous avez d\u00e9j\u00e0, nomm\u00e9s avec vos mots.',
        f2H:'Il prouve la r\u00e9ponse',
        f2P:'Il \u00e9crit la solution et laisse la feuille recalculer, pour que vous voyiez les deux chiffres concorder avant de vous y fier.',
        f3H:'Il dit ce que vaut une unit\u00e9 de plus',
        f3P:'Pour chaque limite qui vous bloque, le prix indicatif : ce que rapporterait une unit\u00e9 de plus. Le rapport que les outils payants font payer.',
        ctaTitle:'Mettez un chiffre devant votre prochaine d\u00e9cision.',
        ctaP:'Gratuit. Rien n\u2019est envoy\u00e9 \u00e0 un serveur.',
        ctaBtn:'Ouvrir le solveur',
        proofTotal:'Bénéfice total', proofHours:'Heures utilisées', proofShadow:'Une heure de plus vaut 16 £', proofCheck:'La feuille recalcule 1 760, ce qui concorde.'
      }
    }
  };

  function pick() {
    var url = (location.search.match(/[?&]lang=(\w\w)/) || [])[1];
    var nav = (global.navigator && (navigator.language || 'en')).slice(0, 2);
    var lang = url || nav || 'en';
    return DICT[lang] ? lang : 'en';
  }

  function apply(lang, page) {
    if (!DICT[lang]) lang = 'en';
    document.documentElement.lang = lang;
    var tables = [DICT[lang].common || {}, (DICT[lang][page] || {})];
    var en = [DICT.en.common || {}, (DICT.en[page] || {})];
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var val = tables[0][key] || tables[1][key] || en[0][key] || en[1][key];
      if (val) nodes[i].innerHTML = val;
    }
  }

  // public: Plumline.i18n.init(page) wires everything, incl. the <select id="lang">
  global.Plumline = global.Plumline || {};
  global.Plumline.i18n = {
    dict: DICT,
    t: function (lang, page, key) {
      lang = DICT[lang] ? lang : 'en';
      return (DICT[lang][page] && DICT[lang][page][key]) ||
             (DICT[lang].common && DICT[lang].common[key]) ||
             (DICT.en[page] && DICT.en[page][key]) || key;
    },
    init: function (page) {
      var lang = pick();
      apply(lang, page);
      var sel = document.getElementById('lang');
      if (sel) {
        sel.value = lang;
        sel.addEventListener('change', function () {
          apply(sel.value, page);
          try { history.replaceState(null, '', '?lang=' + sel.value); } catch (e) {}
        });
      }
      return lang;
    }
  };
})(this);
