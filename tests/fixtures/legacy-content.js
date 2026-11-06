// Contingut de les captures C01–C13 i de la còpia original de Canva O01.
// Un camp `pending` indica text absent, retallat o una associació no confirmada.
export const cell = (text = '', pending = false) => ({ text, pending });
export const pickup = '*Preu sense IVA. No incloem transport. Els productes s’han d’arreplegar a l’obrador.';

export const contact = {
  phone: '649656652', email: 'lafigueravlc@gmail.com', handle: '@lafigueravlc',
  website: 'www.lafigueravlc.com',
};

export const introduction = {
  greeting: 'Primer que res… ENHORABONA!',
  text: 'Ací teniu una relació de possibilitats de tortades meravelloses per tal que el vostre dia siga el més dolç possible, així com opcions de bufets de tartes per quedar-vos amb tota la vostra gent o taules dolces figtàstiques.',
  source: ['C01', 'C02'],
};

const weddingColumns = [
  { key: 'name', role: 'name', label: cell('Tarta:') },
  { key: 'description', role: 'detail', label: cell('Què du?') },
  { key: 'two', role: 'option', label: cell('2 pisos (35/37 porcions)') },
  { key: 'three', role: 'option', label: cell('3 pisos (85/87 porcions)') },
];

export const tables = {
  classics: {
    title: 'Les clàssiques:', source: ['C02', 'C03', 'O01'], columns: weddingColumns.map(c => ({ ...c })),
    rows: [
      { id: 'carrot', source: ['C02'], cells: {
        name: cell('Carrot cake'), description: cell('Biscuit de carlota espècies amb crema de tormatge fruits secs.'),
        two: cell('165€*'), three: cell('390€*'),
      } },
      { id: 'xocolate', source: ['O01'], cells: {
        name: cell('Pastís de xocolate'),
        description: cell('biscuit de vainilla mullat amb café, crema de xoco amb llet (o xoco pur, vosaltres trieu!)'),
        two: cell('165€*'), three: cell('390€*'),
      } },
      { id: 'llima', source: ['O01'], cells: {
        name: cell('Pastís de llima'),
        description: cell('biscuit de llima humit amb crema de formatge i xoco blanc i coulis de fruita (trieu la vostra preferida!)'),
        two: cell('165€*'), three: cell('390€*'),
      } },
      { id: 'lotus', source: ['C03'], cells: {
        name: cell('Pastís de lotus'), description: cell('Biscuit de xocolata banyat amb café buttercream de la famosa galeta lotus.'),
        two: cell('165€*'), three: cell('390€*'),
      } },
    ],
  },
  premium: {
    title: 'Les premium:', source: ['C03', 'C04', 'O01'], columns: weddingColumns.map(c => ({ ...c })),
    rows: [
      { id: 'premium-1', source: ['C03', 'O01'], cells: {
        name: cell('Fruits secs i dulce de leche'),
        description: cell("Tarta de biscuit de xoco banyat amb café, buttercream de dulce de leche, fruits secs i crunch d'avellana."),
        two: cell('185€*'), three: cell('435€*'),
      } },
      { id: 'praline-avellanes', source: ['O01'], cells: {
        name: cell('Praliné d’avellanes'),
        description: cell('Biscuit de vainilla, crema de xocolate amb llet, praliné d’avellanes casolà, crunch avellana.'),
        two: cell('185€*'), three: cell('435€*'),
      } },
      { id: 'premium-2', source: ['C04', 'O01'], cells: {
        name: cell('Macadàmia'),
        description: cell('Biscuit llima humit, crema de formatge i xoco blanc, anous de macadàmia caramelitzades.'),
        two: cell('185€*'), three: cell('435€*'),
      } },
    ],
  },
  marquesa: {
    title: 'Tartes marquesa:', source: ['C04', 'O01'], columns: weddingColumns.map(c => ({ ...c })),
    rows: [{ id: 'carabassa', source: ['C04', 'O01'], cells: {
      name: cell('Carabassa i pistatxo'),
      description: cell('Biscuit de carabassa, buttercream de pistatxo, crunch de pistatxo caramelitzat.'),
      two: cell('200€*'), three: cell('475€*'),
    } },
    { id: 'gerds-formatge-pistatxo', source: ['O01'], cells: {
      name: cell('Gerds, formatge i pistatxo'),
      description: cell('Biscuit de vainilla, buttecream de formatge i xoco blanc, coulis casolà de frambueses, crunch de pistatxo caramelitzat.'),
      two: cell('200€*'), three: cell('475€*'),
    } },
    { id: 'personalitzada', source: ['O01'], cells: {
      name: cell('Personalitzada'),
      description: cell('Acorda una cita amb nosaltres i dissenyem la teua tarta ideal basada en les teues postres preferides!'),
      two: cell('Contacta’ns i et fem preu!'), three: cell('Contacta’ns i et fem preu!'),
    } }],
  },
  buffet: {
    title: 'Bufet de tortades', source: ['C08', 'C09', 'O01'],
    columns: [
      { key: 'name', role: 'name', label: cell('Tarta:') },
      { key: 'description', role: 'detail', label: cell('Què du?') },
      { key: 'normal', role: 'option', label: cell('Decoració normal (12/15 racions)') },
      { key: 'flowers', role: 'option', label: cell('Flors de boda (12/15 racions)') },
    ],
    rows: [
      { id: 'favorita', source: ['C08', 'O01'], note: 'SAP A FORMATGE', cells: {
        name: cell('LA FAVORITA'),
        description: cell('Amb un toc de formatge blau d’Auvergne DOP, base de galeta lotus, figues i mel, pistatxos (adaptable a la fruita de temporada).'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'parmigiana', source: ['C08', 'O01'], note: 'SAP A FORMATGE', cells: {
        name: cell('PARMIGIANA'),
        description: cell('De parmesà, base de galeta maria i fruits secs caramelitzats, raïm fresc (adaptable a la fruita de temporada).'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'mato-mel', source: ['O01'], cells: {
        name: cell('MATÓ I MEL'),
        description: cell('SUAU I CREMOSA:\n\nDe mató, llima, base de galeta maria, fruita de temporada fresca, mel.'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'valenciana', source: ['O01'], cells: {
        name: cell('LA VALENCIANA'),
        description: cell('SUAU I CREMOSA:\nBase de galeta maria amb llima, crema casolana de llima de la terreta, merenga suuuperlleugera i cremosa.'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'xoco-blanc', source: ['O01'], cells: {
        name: cell('XOCO BLANC'),
        description: cell('LES DE XOCO:\n\nBase de galeta maria, alfàbega, ratlladura de llima, xocolate blanc belga, gerds i pistatxos (adaptable a la fruita de temporada).'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'xoco-llet', source: ['O01'], cells: {
        name: cell('XOCO AMB LLET:'),
        description: cell('LES DE XOCO:\nBase de galeta maria, praliné d’avellana i xocolate belga amb llet, decorada amb fruita de temporada.'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'cafe-fragment', source: ['C09', 'O01'], cells: {
        name: cell('XOCO PUR:'),
        description: cell('LES DE XOCO:\nBase de galeta maria mullada amb café d’especialitat, xocolate 85%, fruita de temporada.'),
        normal: cell('45€*'), flowers: cell('50€*'),
      } },
      { id: 'pistatxo-fragment', source: ['C09', 'O01'], cells: {
        name: cell('PISTATXO:'),
        description: cell('PREMIUM:\n\nBase de galeta maria i pistatxos, amb crema de pistatxo casolana, decorada amb més pistatxo i fruita de temporada.'),
        normal: cell('50€*'), flowers: cell('55€*'),
      } },
    ],
  },
  cookies: {
    title: 'Micotetes', source: ['C11', 'O01'],
    columns: [
      { key: 'description', role: 'detail', label: cell('De què son?') },
      { key: 'twentyfive', role: 'option', label: cell('25 micotetes (1,8€ ud)') },
      { key: 'fifty', role: 'option', label: cell('50 micotetes (1,6€ ud)') },
      { key: 'seventyfive', role: 'option', label: cell('75 micotetes (1,4€ud)') },
      { key: 'hundred', role: 'option', label: cell('100 micotetes 1,2€ ud)') },
      { key: 'overhundred', role: 'option', label: cell('+100') },
    ],
    rows: [{ id: 'micotetes', source: ['C11', 'O01'], cells: {
      description: cell('Sabors variats (xoco negre i sal, cacahuet fregit amb mel, 3 xocolates…)'),
      twentyfive: cell('45€*'), fifty: cell('80€*'),
      seventyfive: cell('105€*'), hundred: cell('120€*'),
      overhundred: cell('Contacta’ns i et fem preu!'),
    } }],
  },
};

const transportAnswer = 'Pel moment no tenim un transport adaptat al transport dels nostres productes, pel que caldria arreplegar-los a l’obrador. Sí podem posar-nos en contacte amb la sala per veure si podem buscar una solució i oferim el servei de muntatge tant de taula com de decoració dels pastissos in situ per un suplement. Pregunteu-nos i ho aclarim!';

export const sections = [
  {
    id: 'la-carta', label: 'La carta', title: 'LA FIGUERA EVENTS', pageTitle: 'La Figuera Events', number: '01', kind: 'home',
  },
  {
    id: 'tartes-nupcials', label: 'Tartes nupcials', title: 'Tartes nupcials:', pageTitle: 'La Figuera Events · Nupcials', number: '02',
    intro: 'Totes les nostres tartes són 100% artesanals, (no usem cap crema ni preparació industrial) utilitzem productes de proximitat i de temporada i decorem amb tot l’amor mundial cada pastís utilitzant elements naturals, flors i fruita fresca coherent cromàticament amb la decoració de tot l’event, pel que la vostra tortada va a ser única i irrepetible. I, com que som un obrador familiar, NO AGAFEM MÉS D’UN EVENT PER DATA per poder dedicar tot el nostre temps al vostre dia.',
    source: ['C02'], tableIds: ['classics', 'premium', 'marquesa'],
    questions: [
      { q: 'Què inclou el preu?', source: ['C05'], a: 'El preu inclou una reunió presencial o per telemàtica per tal de coneixer-nos i veure quines són les vostres preferències/gustos, assessorament personal i la tortada nupcial. No inclou el muntatge de cap taula dolça ni el transport. Es pot fer una prova amb dos sabors distints del mateix preu o gama abans de la cerimònia que inclouria dues tartes (cadascuna del seu sabor corresponent) d’unes 6/8 racions per 50€. (Els preus es presenten sense el 21% d’IVA)' },
      { q: "Com es decoren?", source: ['C05', 'O01'], a: "Totes les tartes es poden decorar amb fruita, flors, o una combinació de les dues. Podem posar-nos en contacte amb la persona encarregada de les flors per tal que el pastís tinga la mateixa decoració que la resta de la celebració. Ens podem reunir i veure diferents dissenys per trobar la vostra tortada ideal. Contacta’ns i ho organitzem! (Hi haurà un recàrrec si hem de fer-nos càrrec de comprar flors a conjunt amb l’event, tot i que moltes vegades es pot demanar de manera gratuïta que la persona encarregada deixe una bossa amb flors per tal de decorar el pastís)." },
      { q: 'Feu tartes de fondant?', source: ['C06'], a: 'No. No és la nostra especialitat. Nosaltres ens centrem en un tipus de tarta natural, amb fruita fresca, fruits secs, brots, fulles i flors comestibles. Tot i això, podem adaptar el disseny a les vostres preferències.' },
      { q: 'La tarta pot ser blanca encara que triem una de xocolata o lotus?', source: ['C06'], a: 'Sense problema. Tot i què algunes cremes siguen obscures, podem fer una crema distinta per a l’exterior de la tarta i que quede del color que trieu :)' },
      { q: 'Teniu opcions adaptades per a intoleràncies?', source: ['C06'], a: 'Sí! Es poden adaptar pastissos sense gluten, sense lactosa, vegans, sense sucre... Contacta’ns per veure quines necessitats teniu i quines possibilitats podem oferir-vos.' },
      { q: "Els 3 pisos de la tortada han de ser iguals?", source: ['C06', 'O01'], a: "No cal. Les tortades nupcials es poden fer combinant sabors (que cada pis de la tarta tinga un sabor destint) per un suplement de 20€. No es podran fer combinacions de sabors de tartes de diferent preu (per exemple, es pot fer una tarta de tres pisos amb carrot cake, tarta de xoco i tarta de llima, però no es podría incloure a aquest pastís una de pistatxo i carabassa)." },
      { q: 'Què passa si som més de 85 persones?', source: ['C07'], a: 'Fem una tortada nupcial per a les fotografies i el record de tallar-la, però després oferim tartes d’uns 20cm de diàmetre i uns 10/12cm d’altura (4 capes de biscuit) que donen unes 25 porcions fins que tothom tinga pastís. El preu de cada tarta extra és de 50€.' },
      { q: 'Ens porteu vosaltres les tortades?', source: ['C07'], a: transportAnswer },
    ],
  },
  {
    id: 'bufet-de-tortades', label: 'Bufet de tortades', title: 'Bufet de tortades:', pageTitle: 'La Figuera Events · Bufet', number: '03',
    intro: 'Com ja sabeu, som un obrador especialitzat en tartes de formatge, pel que oferim l’opció de montar, en compte d’una taula dolça, una taula de tartes de formatge dels sabors que trieu i que vos adjuntem a continuació. Aquesta és una opció perfecta perquè la vostra gent puga triar i servir-se el que vulga quan vulga (com entra un tros de pastís de resopó…?)',
    source: ['C07', 'C08'], tableIds: ['buffet'],
    questions: [
      { q: 'Quantes tortades inclou el bufet?', source: ['C09'], a: 'Les que vulgueu, així de simple! Pagueu per les que contracteu a preus normals de carta 🙂' },
      { q: 'Com es decoren?', source: ['C10'], a: 'Com veieu a la taula, teniu l’opció de que les decorem com de normal a l’obrador, amb fruita de temporada, o de decorar-les amb les flors de la vostra boda. Contacteu-nos i ho parlem!' },
      { q: 'Es poden combinar les dues coses?', source: ['C10'], a: 'Clar que sí! Entenem que moltes parelles volen una tortada especial per a les fotos, però també és cert que, moltes vegades, aplegat el moment de servir el pastís, la gent ja té ganes de ballar i es tira molt de menjar. Amb aquesta opció, és un win win. Podeu agafar una tortada de dos o tres pisos (el que preferiu) i després fer una taula dolça combinant tortades i altres dolcets o simplement de pastissos de formatge per a tots els gustos i sabors!' },
      { q: 'Adapteu per a intoleràncies, celiaquies...?', source: ['C10'], a: 'Sempre sí! Intentem que tothom puga gaudir del dia. Pregunta’ns i et donem opcions!' },
      { q: "Monteu vosaltres la taula amb el bufet?", source: ['C10', 'O01'], a: "Pel moment no tenim un transport adaptat al transport dels nostres productes, pel que caldria arreplegar-los a l’obrador. Sí podem posar-nos en contacte amb la sala per veure si podem buscar una solució i oferim el servei de muntatge tant de taula com de decoració dels pastissos in situ per un suplement. Pregunteu-nos i ho aclarim!" },
    ],
  },
  {
    id: 'taules-dolces', label: 'Taules dolces', title: 'Taules dolces:', pageTitle: 'La Figuera Events · Taules', number: '04',
    intro: 'L’última opció que vos podem donar és la de la taula dolça completa, en la que podeu tenir tant tartes de distints sabors (que podeu triar de la taula de dalt), com micotetes (mini cookies de 30gr casolanes) de sabors variats embossades de manera individual perquè les vostres personetes preferides se les puguen endur o menjar fresques al moment.',
    source: ['C11'], tableIds: ['cookies'],
    questions: [
      { q: 'Es poden triar els sabors?', source: ['C11', 'C12'], a: 'Els sabors es posen en funció de disponibilitat a l’obrador, ja que tenim un espai molt limitat, però sí atenem a preferències i adaptacions.' },
      { q: 'Es poden combinar tartes i cookies?', source: ['C12'], a: 'Clar que sí! Podem fer una taula amb les tartes i cookies que vulgueu. Amb tota la informació al document, es podeu organitzar i decidir què vos va millor. Nosaltres estem sempre ahí per assessorar-vos. Hem fet bodes en les que hem posat una tarta nupcial de dos pisos al centre de la taula, vàries tartes de formatge i pots amb micotetes, i han sigut una sensació! :)' },
      { q: 'Monteu vosaltres la taula dolça?', source: ['C12', 'C13'], a: transportAnswer },
    ],
  },
  {
    id: 'contacte', label: 'Contacte', title: 'Contacte:', pageTitle: 'La Figuera Events · Contacte', number: '05', kind: 'contact',
    intro: 'Moltes gràcies per pensar amb nosaltres! Si teniu qualsevol dubte, contacteu-nos per qualsevol d’aquests mitjans:',
    source: ['C13'],
  },
];
