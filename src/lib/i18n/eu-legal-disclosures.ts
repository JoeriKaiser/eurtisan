import type { EuLocale } from './eu-locales'

export const CRD_NON_TRADER_RIGHTS_NOTICE: Record<EuLocale, string> = {
  en: 'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
  nl: 'De consumentenrechtenbescherming die uit het Unierecht voortvloeit, is niet van toepassing op de overeenkomst.',
  fr: "Les droits des consommateurs découlant du droit de l'Union en matière de protection des consommateurs ne s'appliquent pas au contrat.",
  bg: 'Правата на потребителите, произтичащи от правото на Съюза за защита на потребителите, не се прилагат към договора.',
  cs: 'Spotřebitelská práva vyplývající z práva Unie na ochranu spotřebitele se na smlouvu nevztahují.',
  da: 'Forbrugerrettigheder, der følger af EU-forbrugerbeskyttelseslovgivningen, finder ikke anvendelse på aftalen.',
  de: 'Die sich aus dem Verbraucherschutzrecht der Union ergebenden Verbraucherrechte finden auf den Vertrag keine Anwendung.',
  el: 'Τα δικαιώματα των καταναλωτών που απορρέουν από το δίκαιο της Ένωσης για την προστασία των καταναλωτών δεν εφαρμόζονται στη σύμβαση.',
  es: 'Los derechos de los consumidores derivados del Derecho de la Unión en materia de protección de los consumidores no son de aplicación al contrato.',
  et: 'Liidu tarbijakaitseõigusest tulenevad tarbija õigused lepingule ei kohaldu.',
  fi: 'Unionin kuluttajansuojalainsäädännöstä johtuvia kuluttajan oikeuksia ei sovelleta sopimukseen.',
  ga: 'Ní bhaineann cearta tomhaltóirí a eascraíonn as dlí an Aontais um chosaint tomhaltóirí leis an gconradh.',
  hr: 'Prava potrošača koja proizlaze iz prava Unije o zaštiti potrošača ne primjenjuju se na ugovor.',
  hu: 'Az uniós fogyasztóvédelmi jogból eredő fogyasztói jogok nem alkalmazandók a szerződésre.',
  it: "I diritti dei consumatori derivanti dal diritto dell'Unione in materia di tutela dei consumatori non si applicano al contratto.",
  lt: 'Vartotojų teisės, kylančios iš Sąjungos vartotojų teisių apsaugos teisės, sutarčiai netaikomos.',
  lv: 'Patērētāju tiesības, kas izriet no Savienības patērētāju tiesību aizsardzības tiesību aktiem, līgumam netiek piemērotas.',
  mt: 'Id-drittijiet tal-konsumatur li joħorġu mil-liġi tal-Unjoni dwar il-protezzjoni tal-konsumatur ma japplikawx għall-kuntratt.',
  pl: 'Prawa konsumentów wynikające z prawa Unii dotyczącego ochrony konsumentów nie mają zastosowania do tej umowy.',
  pt: 'Os direitos dos consumidores decorrentes do direito da União em matéria de defesa dos consumidores não se aplicam ao contrato.',
  ro: 'Drepturile consumatorilor care decurg din dreptul Uniunii în materie de protecție a consumatorilor nu se aplică contractului.',
  sk: 'Práva spotrebiteľov vyplývajúce z práva Únie v oblasti ochrany spotrebiteľa sa na zmluvu nevzťahujú.',
  sl: 'Pravice potrošnikov, ki izhajajo iz prava Unije o varstvu potrošnikov, se ne uporabljajo za pogodbo.',
  sv: 'Konsumenträttigheter som följer av unionens konsumentskyddslagstiftning är inte tillämpliga på avtalet.',
}

export const RANKING_ATTRIBUTE_PHRASES: Record<
  'name' | 'shopName' | 'categoryName' | 'description',
  Record<EuLocale, string>
> = {
  name: {
    en: 'product name',
    nl: 'productnaam',
    fr: 'nom du produit',
    bg: 'име на продукта',
    cs: 'název produktu',
    da: 'produktnavn',
    de: 'produktname',
    el: 'όνομα προϊόντος',
    es: 'nombre del producto',
    et: 'toote nimi',
    fi: 'tuotteen nimi',
    ga: 'ainm an táirge',
    hr: 'naziv proizvoda',
    hu: 'termék neve',
    it: 'nome del prodotto',
    lt: 'produkto pavadinimas',
    lv: 'produkta nosaukums',
    mt: 'isem tal-prodott',
    pl: 'nazwa produktu',
    pt: 'nome do produto',
    ro: 'numele produsului',
    sk: 'názov produktu',
    sl: 'ime izdelka',
    sv: 'produktnamn',
  },
  shopName: {
    en: 'shop name',
    nl: 'winkelnaam',
    fr: 'nom de la boutique',
    bg: 'име на магазина',
    cs: 'název obchodu',
    da: 'butiksnavn',
    de: 'shop-name',
    el: 'όνομα καταστήματος',
    es: 'nombre de la tienda',
    et: 'poe nimi',
    fi: 'kaupan nimi',
    ga: 'ainm an tsiopa',
    hr: 'naziv trgovine',
    hu: 'bolt neve',
    it: 'nome del negozio',
    lt: 'parduotuvės pavadinimas',
    lv: 'veikala nosaukums',
    mt: 'isem tal-ħanut',
    pl: 'nazwa sklepu',
    pt: 'nome da loja',
    ro: 'numele magazinului',
    sk: 'názov obchodu',
    sl: 'ime trgovine',
    sv: 'butiksnamn',
  },
  categoryName: {
    en: 'category',
    nl: 'categorie',
    fr: 'catégorie',
    bg: 'категория',
    cs: 'kategorie',
    da: 'kategori',
    de: 'kategorie',
    el: 'κατηγορία',
    es: 'categoría',
    et: 'kategooria',
    fi: 'kategoria',
    ga: 'catagóir',
    hr: 'kategorija',
    hu: 'kategória',
    it: 'categoria',
    lt: 'kategorija',
    lv: 'kategorija',
    mt: 'kategorija',
    pl: 'kategoria',
    pt: 'categoria',
    ro: 'categorie',
    sk: 'kategória',
    sl: 'kategorija',
    sv: 'kategori',
  },
  description: {
    en: 'description',
    nl: 'beschrijving',
    fr: 'description',
    bg: 'описание',
    cs: 'popis',
    da: 'beskrivelse',
    de: 'beschreibung',
    el: 'περιγραφή',
    es: 'descripción',
    et: 'kirjeldus',
    fi: 'kuvaus',
    ga: 'cur síos',
    hr: 'opis',
    hu: 'leírás',
    it: 'descrizione',
    lt: 'aprašymas',
    lv: 'apraksts',
    mt: 'deskrizzjoni',
    pl: 'opis',
    pt: 'descrição',
    ro: 'descriere',
    sk: 'popis',
    sl: 'opis',
    sv: 'beskrivning',
  },
}

export const RANKING_NEWEST_PHRASES: Record<EuLocale, string> = {
  en: 'newest',
  nl: 'nieuwste',
  fr: 'plus récent',
  bg: 'най-новите',
  cs: 'nejnovější',
  da: 'nyeste',
  de: 'neueste',
  el: 'νεότερα',
  es: 'más recientes',
  et: 'uusimad',
  fi: 'uusimmat',
  ga: 'is déanaí',
  hr: 'najnovije',
  hu: 'legújabbak',
  it: 'più recenti',
  lt: 'naujausi',
  lv: 'jaunākie',
  mt: 'l-aktar reċenti',
  pl: 'najnowsze',
  pt: 'mais recentes',
  ro: 'cele mai noi',
  sk: 'najnovšie',
  sl: 'najnovejše',
  sv: 'nyaste',
}

export const REVIEW_DELIVERED_DAYS_PHRASES: Record<EuLocale, (days: string) => string> = {
  en: (d) => `${d} days`,
  nl: (d) => `${d} dagen`,
  fr: (d) => `${d} jours`,
  bg: (d) => `${d} дни`,
  cs: (d) => `${d} dní`,
  da: (d) => `${d} dage`,
  de: (d) => `${d} Tage`,
  el: (d) => `${d} ημέρες`,
  es: (d) => `${d} días`,
  et: (d) => `${d} päeva`,
  fi: (d) => `${d} päivää`,
  ga: (d) => `${d} lá`,
  hr: (d) => `${d} dana`,
  hu: (d) => `${d} nap`,
  it: (d) => `${d} giorni`,
  lt: (d) => `${d} dienų`,
  lv: (d) => `${d} dienas`,
  mt: (d) => `${d}-il ġurnata`,
  pl: (d) => `${d} dni`,
  pt: (d) => `${d} dias`,
  ro: (d) => `${d} de zile`,
  sk: (d) => `${d} dní`,
  sl: (d) => `${d} dni`,
  sv: (d) => `${d} dagar`,
}

export const REVIEW_MODERATION_REPORT_PHRASES: Record<EuLocale, string> = {
  en: 'reporting alone changes nothing',
  nl: 'melden alleen verandert niets',
  fr: 'un signalement seul ne change rien',
  bg: 'само подаването на сигнал не променя нищо',
  cs: 'samotné nahlášení nic nemění',
  da: 'en anmeldelse alene ændrer ingenting',
  de: 'eine meldung allein ändert nichts',
  el: 'η αναφορά από μόνη της δεν αλλάζει τίποτα',
  es: 'una denuncia por sí sola no cambia nada',
  et: 'üksnes teatamine ei muuda midagi',
  fi: 'pelkkä ilmoitus ei muuta mitään',
  ga: 'ní athraíonn tuairisciú amháin aon rud',
  hr: 'sama prijava ne mijenja ništa',
  hu: 'a bejelentés önmagában semmin nem változtat',
  it: 'una segnalazione da sola non cambia nulla',
  lt: 'vien pranešimas nieko nepakeičia',
  lv: 'ziņojums pats par sevi neko nemaina',
  mt: 'ir-rappurtar waħdu ma jibdel xejn',
  pl: 'samo zgłoszenie niczego nie zmienia',
  pt: 'uma denúncia por si só não altera nada',
  ro: 'o simplă raportare nu schimbă nimic',
  sk: 'samotné nahlásenie nič nemení',
  sl: 'sama prijava ne spremeni ničesar',
  sv: 'en anmälan ensam ändrar ingenting',
}

export const REVIEW_SORT_ORDER_PATTERNS: Record<EuLocale, RegExp> = {
  en: /newest first.*highest rating.*lowest rating.*helpful/,
  nl: /nieuw naar oud.*hoogste beoordeling.*laagste beoordeling.*nuttige stemmen/,
  fr: /plus récentes d'abord.*note la plus élevée.*note la plus basse.*votes utiles/,
  bg: /най-новите първо.*най-висока оценка.*най-ниска оценка.*полезни гласове/,
  cs: /nejnovější jako první.*nejvyšší hodnocení.*nejnižší hodnocení.*užitečné hlasy/,
  da: /nyeste først.*højeste vurdering.*laveste vurdering.*nyttige stemmer/,
  de: /neueste zuerst.*höchste bewertung.*niedrigste bewertung.*hilfreiche/,
  el: /νεότερα πρώτα.*υψηλότερη βαθμολογία.*χαμηλότερη βαθμολογία.*χρήσιμες ψήφοι/,
  es: /más recientes primero.*calificación más alta.*calificación más baja.*votos útiles/,
  et: /uusimad esimesena.*kõrgeim hinnang.*madalaim hinnang.*kasulikud hääled/,
  fi: /uusimmat ensin.*korkein arvosana.*matalin arvosana.*hyödylliset äänet/,
  ga: /is déanaí ar dtús.*rátáil is airde.*rátáil is ísle.*vótaí cabhracha/,
  hr: /najnovije prvo.*najviša ocjena.*najniža ocjena.*korisni glasovi/,
  hu: /legújabbak elöl.*legmagasabb értékelés.*legalacsonyabb értékelés.*hasznos szavazatok/,
  it: /più recenti per prime.*valutazione più alta.*valutazione più bassa.*voti utili/,
  lt: /naujausi pirma.*aukščiausias įvertinimas.*žemiausias įvertinimas.*naudingi balsai/,
  lv: /jaunākie vispirms.*augstākais vērtējums.*zemākais vērtējums.*noderīgas balsis/,
  mt: /l-aktar reċenti l-ewwel.*l-ogħla klassifikazzjoni.*l-inqas klassifikazzjoni.*voti utli/,
  pl: /najnowsze jako pierwsze.*najwyższa ocena.*najniższa ocena.*pomocne głosy/,
  pt: /mais recentes primeiro.*classificação mais alta.*classificação mais baixa.*votos úteis/,
  ro: /cele mai noi primele.*cea mai mare notă.*cea mai mică notă.*voturi utile/,
  sk: /najnovšie ako prvé.*najvyššie hodnotenie.*najnižšie hodnotenie.*užitočné hlasy/,
  sl: /najnovejše najprej.*najvišja ocena.*najnižja ocena.*koristni glasovi/,
  sv: /nyaste först.*högsta betyg.*lägsta betyg.*användbara röster/,
}

export const LEGAL_DISCLOSURE_OVERRIDES: Record<
  Exclude<EuLocale, 'en' | 'nl' | 'fr'>,
  Record<string, string>
> = {
  bg: {
    trader_status_trader: 'Този продавач е декларирал, че е търговец.',
    trader_status_non_trader: 'Този продавач е декларирал, че не е търговец.',
    trader_status_undeclared:
      'Този продавач не е декларирал дали е търговец. Покупките са недостъпни, докато не бъде предоставена декларацията.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.bg,
    ranking_disclosure_title: 'Как се подреждат резултатите',
    ranking_disclosure_no_payment:
      'Продавачите не могат да плащат за по-висока позиция. Нито една обява в Eurtisan не е спонсорирана или популяризирана срещу заплащане.',
    ranking_disclosure_category_body:
      'Продуктите се показват в реда, който изберете с контрола за сортиране. По подразбиране най-новите обяви се показват първи. Филтрите само премахват продукти от списъка; те никога не променят реда на оставащите.',
    ranking_disclosure_search_body:
      'При търсене резултатите се подреждат според това колко добре съответстват на вашите думи, по следния ред на важност:',
    ranking_disclosure_search_1: 'Колко от думите ви за търсене съдържа обявата.',
    ranking_disclosure_search_2:
      'Точността на изписване на думите: обява с точно съвпадение се класира над такава с корекция на правописа.',
    ranking_disclosure_search_3: 'Колко близо една до друга се намират думите ви в обявата.',
    ranking_disclosure_search_4:
      'Коя част от обявата съвпада, в следния ред: име на продукта, име на магазина, категория, след това описание.',
    ranking_disclosure_search_5:
      'Избраното от вас сортиране, ако сте го променили от Релевантност.',
    ranking_disclosure_search_6: 'Дали съвпадението е пълно или частично.',
    ranking_disclosure_search_7:
      'Дали продуктът е в наличност: наличните продукти се показват първи.',
    ranking_disclosure_search_8:
      'Оценката от отзиви за продукта, претеглена според броя отзиви, така че продукт с добри отзиви изпреварва такъв без история.',
    ranking_disclosure_search_note:
      'Прилагат се корекция на правописа и синоними, и всички официални езици на Европейския съюз се разпознават. Скорошността умишлено не е част от оценката на отзивите: използвайте сортирането Най-нови за това.',
    review_disclosure_title: 'Как управляваме отзивите',
    review_disclosure_verified_body:
      'Всеки отзив в Eurtisan идва от потребител, закупил продукта тук. Ние проверяваме това автоматично преди написването на отзив:',
    review_disclosure_check_purchase:
      'Акаунтът на автора на отзива е направил поръчката, съдържаща продукта.',
    review_disclosure_check_delivered:
      'Поръчката е отбелязана като доставена и оттогава са изминали 14 дни, така отзивът отразява опита с продукта, а не само разопаковането му.',
    review_disclosure_check_once:
      'Един отзив за продукт на поръчка, така че една покупка не може да бъде оценена два пъти.',
    review_disclosure_check_own:
      'Занаятчиите не могат да оценяват продукти от собствения си магазин.',
    review_disclosure_order:
      'Отзивите се показват по подразбиране от най-новите първо. Можете също да ги подредите по най-висока оценка, най-ниска оценка или полезни гласове и да филтрирате по звезди.',
    review_disclosure_dates:
      'Всеки отзив показва датата на публикуване и датата, на която купувачът е получил продукта.',
    review_disclosure_moderation:
      'Ние не редактираме отзиви. Всеки може да подаде сигнал: само подаването на сигнал не променя нищо. Модератор може да скрие отзив, който е незаконен или нарушава нашите условия, и авторът винаги се уведомява за решението и причините.',
    review_disclosure_retention:
      'Ние пазим отзивите, докато продуктът е в списъка. Ако занаятчията премахне продукта или закриете акаунта си, отзивът се премахва.',
    review_disclosure_no_payment:
      'Никой не получава възнаграждение за написване на отзив и занаятчиите не могат да платят за премахване на такъв.',
    terms_section_11_text:
      'Не можете да използвате Платформата за:\n\n- Публикуване или продажба на фалшифицирани, откраднати, незаконни или опасни стоки.\n- Публикуване или продажба на храни, напитки или всякакви други продукти, предназначени за консумация. Eurtisan не е пригодена да показва информация за съставките, алергените и произхода, която правото на ЕС в областта на храните, по-специално Регламент (ЕС) № 1169/2011, изисква да се показва преди покупка.\n- Тормоз, заплахи или дискриминация спрямо други потребители.\n- Заобикаляне на таксите или правилата на Платформата.\n- Измамни дейности.\n- Качване на зловреден код или намеса в сигурността на Платформата.\n- Нарушаване на права върху интелектуална собственост.\n- Събиране на лични данни на други потребители без съгласие.',
    terms_section_16_text:
      'При въпроси относно тези Условия, моля, свържете се с нас на {email}. За да ни уведомите за незаконно съдържание съгласно чл. 16 от Законодателния акт за цифровите услуги (DSA), използвайте бутона за сигнал към обява или магазин. Записваме сигнала и ви уведомяваме за решението.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Тази фактура представлява комисионата за такса на платформата, начислена от {operator} на занаятчията. Сумите се уреждат автоматично чрез трансакции с разделено плащане.',
  },
  cs: {
    trader_status_trader: 'Tento prodejce prohlásil, že je obchodníkem.',
    trader_status_non_trader: 'Tento prodejce prohlásil, že není obchodníkem.',
    trader_status_undeclared:
      'Tento prodejce neprohlásil, zda je obchodníkem. Nákupy nejsou dostupné, dokud prohlášení nebude poskytnuto.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.cs,
    ranking_disclosure_title: 'Jak jsou výsledky řazeny',
    ranking_disclosure_no_payment:
      'Prodejci nemohou platit za vyšší umístění. Žádná nabídka na Eurtisan není sponzorována ani propagována za úplatu.',
    ranking_disclosure_category_body:
      'Produkty jsou zobrazeny v pořadí, které zvolíte pomocí řazení. Ve výchozím nastavení jsou nejnovější položky na prvním místě. Filtry pouze odstraňují produkty ze seznamu; nikdy nemění pořadí těch zbývajících.',
    ranking_disclosure_search_body:
      'Při vyhledávání jsou výsledky seřazeny podle toho, jak dobře odpovídají vašim slovům, v tomto pořadí důležitosti:',
    ranking_disclosure_search_1: 'Kolik z vašich hledaných slov nabídka obsahuje.',
    ranking_disclosure_search_2:
      'Přesnost pravopisu slov: nabídka s přesnou shodou je řazena před nabídkou vyžadující opravu překlepu.',
    ranking_disclosure_search_3: 'Jak blízko u sebe se vaše slova v nabídce nacházejí.',
    ranking_disclosure_search_4:
      'Která část nabídky se shodovala, v tomto pořadí: název produktu, název obchodu, kategorie, poté popis.',
    ranking_disclosure_search_5: 'Zvolené řazení, pokud jste jej změnili z Relevance.',
    ranking_disclosure_search_6: 'Zda je shoda přesná, nebo pouze částečná.',
    ranking_disclosure_search_7: 'Zda je produkt skladem: produkty skladem mají přednost.',
    ranking_disclosure_search_8:
      'Hodnocení produktu v recenzích vážené jejich počtem, takže dobře hodnocený produkt předčí produkt bez historie.',
    ranking_disclosure_search_note:
      'Na vaše slova se vztahuje oprava pravopisu a synonyma a jsou rozpoznávány všechny úřední jazyky Evropské unie. Aktuálnost záměrně není součástí hodnocení recenzí: k tomu použijte řazení Nejnovější.',
    review_disclosure_title: 'Jak nakládáme s recenzemi',
    review_disclosure_verified_body:
      'Každá recenze na Eurtisan pochází od někoho, kdo si zde produkt zakoupil. To automaticky ověřujeme předtím, než může být recenze napsána:',
    review_disclosure_check_purchase: 'Účet recenzenta zadal objednávku, která produkt obsahuje.',
    review_disclosure_check_delivered:
      'Objednávka byla označena jako doručená a od té doby uplynulo 14 dní – recenze tedy odráží skutečné užívání produktu, nejen jeho vybalení.',
    review_disclosure_check_once:
      'Jedna recenze na produkt na objednávku, takže jeden nákup nelze hodnotit dvakrát.',
    review_disclosure_check_own: 'Tvůrci nemohou hodnotit produkty z vlastního obchodu.',
    review_disclosure_order:
      'Recenze se ve výchozím nastavení zobrazují od nejnovější jako první. Můžete je také seřadit podle nejvyšší hodnocení, nejnižší hodnocení nebo užitečné hlasy a filtrovat podle počtu hvězdiček.',
    review_disclosure_dates:
      'Každá recenze uvádí datum zveřejnění a datum, kdy kupující produkt obdržel.',
    review_disclosure_moderation:
      'Recenze neupravujeme. Kdokoli může recenzi nahlásit: samotné nahlášení nic nemění. Moderátor může skrýt recenzi, která je nezákonná nebo porušuje naše podmínky, a autor je vždy informován o rozhodnutí a důvodech.',
    review_disclosure_retention:
      'Recenze uchováváme po dobu, po kterou je produkt v nabídce. Pokud tvůrce produkt odstraní nebo zrušíte svůj účet, recenze bude smazána.',
    review_disclosure_no_payment:
      'Nikdo nedostává za napsání recenze platbu ani odměnu a tvůrci nemohou platit za její odstranění.',
    terms_section_11_text:
      'Platformu nesmíte používat k:\n\n- Nabízení nebo prodeji padělaného, kradeného, nelegálního či nebezpečného zboží.\n- Nabízení nebo prodeji potravin, nápojů nebo jakýchkoli jiných produktů určených ke konzumaci. Eurtisan není uzpůsoben k uvádění informací o složkách, alergenech a původu, které potravinové právo EU, zejména nařízení (EU) č. 1169/2011, vyžaduje zobrazit před nákupem.\n- Obtěžování, vyhrožování či diskriminaci jiných uživatelů.\n- Obcházení poplatků či zásad platformy.\n- Podvodnému jednání.\n- Nahrávání škodlivého kódu či narušování bezpečnosti platformy.\n- Porušování práv duševního vlastnictví.\n- Shromažďování osobních údajů ostatních uživatelů bez souhlasu.',
    terms_section_16_text:
      'V případě dotazů k těmto podmínkám nás kontaktujte na adrese {email}. K nahlášení nezákonného obsahu podle článku 16 nařízení DSA použijte tlačítko nahlášení u nabídky nebo obchodu. Oznámení zaevidujeme a sdělíme vám rozhodnutí.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Tato faktura představuje provizi za poplatek platformy účtovaný společností {operator} řemeslníkovi. Částky jsou automaticky vypořádány prostřednictvím rozdělených plateb.',
  },
  da: {
    trader_status_trader: 'Denne sælger har erklæret, at vedkommende er en erhvervsdrivende.',
    trader_status_non_trader:
      'Denne sælger har erklæret, at vedkommende ikke er en erhvervsdrivende.',
    trader_status_undeclared:
      'Denne sælger har ikke erklæret, om vedkommende er en erhvervsdrivende. Køb er utilgængelige, indtil erklæringen er afgivet.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.da,
    ranking_disclosure_title: 'Hvordan resultater ordnes',
    ranking_disclosure_no_payment:
      'Sælgere kan ikke betale for en højere placering. Ingen fortegnelse på Eurtisan er sponsoreret eller fremmet mod betaling.',
    ranking_disclosure_category_body:
      'Produkter vises i den rækkefølge, du vælger med sorteringen. Som standard vises de nyeste annoncer først. Filtre fjerner kun produkter fra listen; de ændrer aldrig rækkefølgen af de resterende.',
    ranking_disclosure_search_body:
      'Når du søger, ordnes resultaterne efter, hvor godt de matcher dine ord, i denne prioritetsrækkefølge:',
    ranking_disclosure_search_1: 'Hvor mange af dine søgeord en annonce indeholder.',
    ranking_disclosure_search_2:
      'Hvor nøjagtigt ordene er stavet: en annonce uden slåfejl placeres over en, der krævede korrektur.',
    ranking_disclosure_search_3: 'Hvor tæt dine ord optræder på hinanden i annoncen.',
    ranking_disclosure_search_4:
      'Hvilken del af annoncen der matchede, i denne rækkefølge: produktnavn, butiksnavn, kategori, derefter beskrivelse.',
    ranking_disclosure_search_5: 'Den valgte sortering, hvis du ændrede den fra Relevans.',
    ranking_disclosure_search_6: 'Om matchet er nøjagtigt frem for delvist.',
    ranking_disclosure_search_7: 'Om produktet er på lager: varer på lager kommer først.',
    ranking_disclosure_search_8:
      'Produktets anmeldelsesscore, vægtet efter antallet af anmeldelser, så et velanmeldt produkt overgår et uprøvet.',
    ranking_disclosure_search_note:
      'Stavekorrektur og synonymer anvendes på dine ord, og alle officielle EU-sprog genkendes. Aktualitet er bevidst ikke en del af anmeldelsesscoren: brug sorteringen Nyeste til dette formål.',
    review_disclosure_title: 'Hvordan vi håndterer anmeldelser',
    review_disclosure_verified_body:
      'Hver anmeldelse på Eurtisan kommer fra en køber, der har købt produktet her. Vi tjekker dette automatisk, før en anmeldelse kan skrives:',
    review_disclosure_check_purchase:
      'Anmelderens konto har afgivet den ordre, der indeholder produktet.',
    review_disclosure_check_delivered:
      'Ordren blev markeret som leveret, og der er gået 14 dage siden, så anmeldelsen afspejler brugen af produktet og ikke kun udpakningen.',
    review_disclosure_check_once:
      'Én anmeldelse pr. produkt pr. ordre, så et enkelt køb ikke kan anmeldes to gange.',
    review_disclosure_check_own:
      'Kunsthåndværkere kan ikke anmelde produkter fra deres egen butik.',
    review_disclosure_order:
      'Anmeldelser vises med nyeste først som standard. Du kan også sortere efter højeste vurdering, laveste vurdering eller nyttige stemmer samt filtrere efter stjerner.',
    review_disclosure_dates:
      'Hver anmeldelse viser datoen for offentliggørelse og datoen for køberens modtagelse af produktet.',
    review_disclosure_moderation:
      'Vi redigerer ikke anmeldelser. Enhver kan anmelde en anmeldelse: en anmeldelse alene ændrer ingenting. En moderator kan skjule en anmeldelse, der er ulovlig eller overtræder vores vilkår, og forfatteren informeres altid om afgørelsen og begrundelsen.',
    review_disclosure_retention:
      'Vi gemmer anmeldelser, så længe produktet er opført. Hvis en kunsthåndværker fjerner produktet, eller du lukker din konto, slettes anmeldelsen.',
    review_disclosure_no_payment:
      'Ingen betales eller belønnes for at skrive en anmeldelse, og skabere kan ikke betale for at få en fjernet.',
    terms_section_11_text:
      "Du må ikke bruge platformen til at:\n\n- Oprette eller sælge forfalskede, stjålne, ulovlige eller farlige varer.\n- Oprette eller sælge mad, drikkevarer eller andre produkter beregnet til forbrug. Eurtisan er ikke indrettet til at indeholde de oplysninger om ingredienser, allergener og oprindelse, som EU's fødevarelovgivning, herunder forordning (EU) nr. 1169/2011, kræver vist før et køb gennemføres.\n- Chikanere, true eller diskriminere mod andre brugere.\n- Omgå platformens gebyrer eller politikker.\n- Udføre svigagtige handlinger.\n- Uploade ondsindet kode eller forstyrre platformens sikkerhed.\n- Krænke immaterielle rettigheder.\n- Indsamle personoplysninger om andre brugere uden samtykke.",
    terms_section_16_text:
      'Ved spørgsmål om disse vilkår kan du kontakte os på {email}. For at anmelde ulovligt indhold i henhold til DSA artikel 16 skal du bruge anmeldelsesfunktionen på en annonce eller butik. Vi registrerer meddelelsen og giver dig besked om afgørelsen.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Denne faktura repræsenterer platformsgebyrkommissionen opkrævet af {operator} over for kunsthåndværkeren. Beløbene afregnes automatisk via opdelte betalingstransaktioner.',
  },
  de: {
    trader_status_trader: 'Dieser Verkäufer hat erklärt, dass er ein Unternehmer ist.',
    trader_status_non_trader: 'Dieser Verkäufer hat erklärt, dass er kein Unternehmer ist.',
    trader_status_undeclared:
      'Dieser Verkäufer hat nicht erklärt, ob er ein Unternehmer ist. Käufe sind erst möglich, wenn die Erklärung vorliegt.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.de,
    ranking_disclosure_title: 'Wie Ergebnisse geordnet werden',
    ranking_disclosure_no_payment:
      'Verkäufer können nicht für eine höhere Platzierung bezahlen. Kein Angebot auf Eurtisan wird gegen Bezahlung gesponsert oder beworben.',
    ranking_disclosure_category_body:
      'Produkte werden in der von Ihnen gewählten Reihenfolge angezeigt. Standardmäßig stehen die neueste Angebote an erster Stelle. Filter entfernen nur Produkte aus der Liste; sie ändern nie die Reihenfolge der verbleibenden Produkte.',
    ranking_disclosure_search_body:
      'Bei der Suche werden die Ergebnisse danach geordnet, wie gut sie zu Ihren Begriffen passen, in dieser Reihenfolge der Bedeutung:',
    ranking_disclosure_search_1: 'Wie viele Ihrer Suchbegriffe in einem Angebot enthalten sind.',
    ranking_disclosure_search_2:
      'Wie genau die Wörter geschrieben sind – ein passendes Angebot ohne Tippfehler wird vor einem platziert, das korrigiert werden musste.',
    ranking_disclosure_search_3: 'Wie nah Ihre Suchbegriffe im Angebot beieinander stehen.',
    ranking_disclosure_search_4:
      'Welcher Teil des Angebots übereinstimmt, in dieser Reihenfolge: Produktname, Shop-Name, Kategorie, dann Beschreibung.',
    ranking_disclosure_search_5:
      'Die von Ihnen gewählte Sortierung, falls Sie diese von Relevanz geändert haben.',
    ranking_disclosure_search_6: 'Ob die Übereinstimmung exakt statt partiell ist.',
    ranking_disclosure_search_7:
      'Ob das Produkt vorrätig ist – vorrätige Produkte stehen an erster Stelle.',
    ranking_disclosure_search_8:
      'Die Bewertungspunktzahl des Produkts, gewichtet nach der Anzahl der Bewertungen, sodass ein gut bewertetes Produkt vor einem unbewiesenen rangiert.',
    ranking_disclosure_search_note:
      'Rechtschreibkorrektur und Synonyme werden auf Ihre Begriffe angewendet, und alle offiziellen Sprachen der Europäischen Union werden erkannt. Aktualität ist bewusst nicht Teil der Bewertungspunktzahl – nutzen Sie dafür die Sortierung Neueste.',
    review_disclosure_title: 'Wie wir mit Bewertungen umgehen',
    review_disclosure_verified_body:
      'Jede Bewertung auf Eurtisan stammt von jemandem, der das Produkt hier gekauft hat. Wir prüfen dies automatisch, bevor eine Bewertung verfasst werden kann:',
    review_disclosure_check_purchase:
      'Über das Konto des Verfassers wurde die Bestellung aufgegeben, die das Produkt enthält.',
    review_disclosure_check_delivered:
      'Die Bestellung wurde als zugestellt markiert und seitdem sind 14 Tage vergangen – so spiegelt die Bewertung die tatsächliche Nutzung wider, nicht nur das Auspacken.',
    review_disclosure_check_once:
      'Eine Bewertung pro Produkt und Bestellung, damit ein Kauf nicht doppelt bewertet werden kann.',
    review_disclosure_check_own:
      'Kunsthandwerker können Produkte aus dem eigenen Shop nicht bewerten.',
    review_disclosure_order:
      'Bewertungen werden standardmäßig mit neueste zuerst angezeigt. Sie können sie auch nach höchste Bewertung, niedrigste Bewertung oder hilfreiche Stimmen sortieren und nach Sternen filtern.',
    review_disclosure_dates:
      'Jede Bewertung zeigt das Veröffentlichungsdatum und das Datum, an dem der Käufer das Produkt erhalten hat.',
    review_disclosure_moderation:
      'Wir bearbeiten keine Bewertungen. Jeder kann eine Bewertung melden – eine meldung allein ändert nichts. Ein Moderator kann eine Bewertung ausblenden, wenn sie rechtswidrig ist oder gegen unsere Bedingungen verstößt, und der Verfasser wird stets über Entscheidung und Begründung informiert.',
    review_disclosure_retention:
      'Wir bewahren Bewertungen auf, solange das Produkt gelistet ist. Wenn ein Kunsthandwerker das Produkt entfernt oder Sie Ihr Konto schließen, wird die Bewertung gelöscht.',
    review_disclosure_no_payment:
      'Niemand wird für das Schreiben einer Bewertung bezahlt oder belohnt, und Kunsthandwerker können nicht dafür bezahlen, eine entfernen zu lassen.',
    terms_section_11_text:
      'Sie dürfen die Plattform nicht nutzen, um:\n\n- Gefälschte, gestohlene, illegale oder gefährliche Waren anzubieten oder zu verkaufen.\n- Lebensmittel, Getränke oder andere zum Verzehr bestimmte Produkte anzubieten oder zu verkaufen. Eurtisan ist nicht darauf eingerichtet, die nach dem EU-Lebensmittelrecht, insbesondere der Verordnung (EU) Nr. 1169/2011, vor dem Kauf erforderlichen Angaben zu Zutaten, Allergenen und Herkunft bereitzustellen.\n- Andere Nutzer zu belästigen, zu bedrohen oder zu diskriminieren.\n- Plattformgebühren oder -richtlinien zu umgehen.\n- Betrügerische Handlungen vorzunehmen.\n- Schadcode hochzuladen oder die Plattformsicherheit zu beeinträchtigen.\n- Geistige Eigentumsrechte zu verletzen.\n- Personenbezogene Daten ohne Einwilligung zu erfassen.',
    terms_section_16_text:
      'Bei Fragen zu diesen Bedingungen kontaktieren Sie uns bitte unter {email}. Um uns rechtswidrige Inhalte gemäß DSA Artikel 16 zu melden, nutzen Sie die Meldefunktion bei einem Angebot oder Shop. Wir erfassen die Meldung und teilen Ihnen die Entscheidung mit.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Diese Rechnung weist die von {operator} an den Kunsthandwerker berechnete Plattformgebühr aus. Die Beträge werden automatisch über Split-Payment-Transaktionen abgewickelt.',
  },
  el: {
    trader_status_trader: 'Αυτός ο πωλητής έχει δηλώσει ότι είναι έμπορος.',
    trader_status_non_trader: 'Αυτός ο πωλητής έχει δηλώσει ότι δεν είναι έμπορος.',
    trader_status_undeclared:
      'Αυτός ο πωλητής δεν έχει δηλώσει εάν είναι έμπορος. Οι αγορές δεν είναι διαθέσιμες έως ότου παρασχεθεί η δήλωση.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.el,
    ranking_disclosure_title: 'Πώς ταξινομούνται τα αποτελέσματα',
    ranking_disclosure_no_payment:
      'Οι πωλητές δεν μπορούν να πληρώσουν για υψηλότερη κατάταξη. Καμία καταχώριση στο Eurtisan δεν είναι χορηγούμενη ή προωθούμενη έναντι πληρωμής.',
    ranking_disclosure_category_body:
      'Τα προϊόντα εμφανίζονται με τη σειρά που επιλέγετε με το στοιχείο ελέγχου ταξινόμησης. Από προεπιλογή, τα νεότερα καταχωρίσεις εμφανίζονται πρώτα. Τα φίλτρα αφαιρούν μόνο προϊόντα από τη λίστα, δεν αλλάζουν ποτέ τη σειρά αυτών που παραμένουν.',
    ranking_disclosure_search_body:
      'Όταν κάνετε αναζήτηση, τα αποτελέσματα ταξινομούνται ανάλογα με το πόσο καλά ταιριάζουν με τις λέξεις σας, με την εξής σειρά σπουδαιότητας:',
    ranking_disclosure_search_1: 'Πόσες από τις λέξεις αναζήτησής σας περιέχει μια καταχώριση.',
    ranking_disclosure_search_2:
      'Πόσο ακριβής είναι η ορθογραφία των λέξεων: μια καταχώριση χωρίς τυπογραφικά λάθη κατατάσσεται πάνω από μία που χρειάστηκε διόρθωση.',
    ranking_disclosure_search_3:
      'Πόσο κοντά βρίσκονται οι λέξεις σας η μία στην άλλη μέσα στην καταχώριση.',
    ranking_disclosure_search_4:
      'Ποιο μέρος της καταχώρισης ταίριαξε, με την εξής σειρά: όνομα προϊόντος, όνομα καταστήματος, κατηγορία, στη συνέχεια περιγραφή.',
    ranking_disclosure_search_5: 'Η ταξινόμηση που επιλέξατε, εάν την αλλάξατε από Σχετικότητα.',
    ranking_disclosure_search_6: 'Εάν η αντιστοίχιση είναι ακριβής και όχι μερική.',
    ranking_disclosure_search_7:
      'Εάν το προϊόν είναι σε απόθεμα: τα διαθέσιμα προϊόντα προηγούνται.',
    ranking_disclosure_search_8:
      'Η βαθμολογία κριτικών του προϊόντος, σταθμισμένη με τον αριθμό των κριτικών, ώστε ένα προϊόν με πολλές θετικές κριτικές να υπερτερεί ενός αδοκίμαστου.',
    ranking_disclosure_search_note:
      'Εφαρμόζεται διόρθωση ορθογραφίας και συνώνυμα στις λέξεις σας, και αναγνωρίζονται όλες οι επίσημες γλώσσες της Ευρωπαϊκής Ένωσης. Η πρόσφατη ημερομηνία σκοπίμως δεν αποτελεί μέρος της βαθμολογίας: χρησιμοποιήστε την ταξινόμηση Νεότερα για αυτό.',
    review_disclosure_title: 'Πώς διαχειριζόμαστε τις κριτικές',
    review_disclosure_verified_body:
      'Κάθε κριτική στο Eurtisan προέρχεται από κάποιον που αγόρασε το προϊόν εδώ. Το ελέγχουμε αυτόματα προτού γραφτεί μια κριτική:',
    review_disclosure_check_purchase:
      'Ο λογαριασμός του αξιολογητή πραγματοποίησε την παραγγελία που περιέχει το προϊόν.',
    review_disclosure_check_delivered:
      'Η παραγγελία επισημάνθηκε ως παραδοθείσα και έχουν περάσει 14 ημέρες από τότε, ώστε η αξιολόγηση να αντικατοπτρίζει τη χρήση του προϊόντος και όχι μόνο το άνοιγμα της συσκευασίας.',
    review_disclosure_check_once:
      'Μία κριτική ανά προϊόν ανά παραγγελία, ώστε μία αγορά να μην μπορεί να αξιολογηθεί δύο φορές.',
    review_disclosure_check_own:
      'Οι τεχνίτες δεν μπορούν να αξιολογούν προϊόντα από το δικό τους κατάστημα.',
    review_disclosure_order:
      'Οι αξιολογήσεις εμφανίζονται από προεπιλογή με σειρά νεότερα πρώτα. Μπορείτε επίσης να τις ταξινομήσετε κατά υψηλότερη βαθμολογία, χαμηλότερη βαθμολογία ή χρήσιμες ψήφοι και να φιλτράρετε κατά αστέρια.',
    review_disclosure_dates:
      'Κάθε κριτική δείχνει την ημερομηνία δημοσίευσης και την ημερομηνία κατά την οποία ο αγοραστής παρέλαβε το προϊόν.',
    review_disclosure_moderation:
      'Δεν τροποποιούμε τις κριτικές. Οποιοσδήποτε μπορεί να υποβάλει αναφορά: η αναφορά από μόνη της δεν αλλάζει τίποτα. Ένας συντονιστής μπορεί να αποκρύψει μια κριτική εάν είναι παράνομη ή παραβιάζει τους όρους μας, και ο συντάκτης ενημερώνεται πάντα για την απόφαση και την αιτιολογία.',
    review_disclosure_retention:
      'Διατηρούμε τις αξιολογήσεις για όσο διάστημα το προϊόν παραμένει καταχωρισμένο. Εάν ένας δημιουργός αφαιρέσει το προϊόν ή κλείσετε τον λογαριασμό σας, η αξιολόγηση διαγράφεται.',
    review_disclosure_no_payment:
      'Κανείς δεν πληρώνεται ούτε ανταμείβεται για τη συγγραφή κριτικής και οι δημιουργοί δεν μπορούν να πληρώσουν για να αφαιρεθεί κάποια.',
    terms_section_11_text:
      'Δεν επιτρέπεται να χρησιμοποιείτε την Πλατφόρμα για:\n\n- Καταχώριση ή πώληση παραποιημένων, κλεμμένων, παράνομων ή επικίνδυνων αγαθών.\n- Καταχώριση ή πώληση τροφίμων, ποτών ή οποιουδήποτε άλλου προϊόντος που προορίζεται για κατανάλωση. Το Eurtisan δεν έχει σχεδιαστεί για να φέρει τις πληροφορίες συστατικών, αλλεργιογόνων και προέλευσης που απαιτεί η νομοθεσία της ΕΕ για τα τρόφιμα, ιδίως ο Κανονισμός (ΕΕ) αριθ. 1169/2011, να εμφανίζονται πριν από την πραγματοποίηση αγοράς.\n- Παρενόχληση, απειλή ή διακριτική μεταχείριση άλλων χρηστών.\n- Καταστρατήγηση των τελών ή των πολιτικών της Πλατφόρμας.\n- Δόλιες δραστηριότητες.\n- Μεταφόρτωση κακόβουλου κώδικα ή παρέμβαση στην ασφάλεια της Πλατφόρμας.\n- Παραβίαση δικαιωμάτων πνευματικής ιδιοκτησίας.\n- Συλλογή προσωπικών δεδομένων άλλων χρηστών χωρίς συγκατάθεση.',
    terms_section_16_text:
      'Για ερωτήσεις σχετικά με αυτούς τους Όρους, επικοινωνήστε μαζί μας στο {email}. Για να μας κοινοποιήσετε παράνομο περιεχόμενο βάσει του άρθρου 16 της Πράξης για τις Ψηφιακές Υπηρεσίες (DSA), χρησιμοποιήστε την ενέργεια αναφοράς σε μια καταχώριση ή κατάστημα. Καταγράφουμε την ειδοποίηση και σας ενημερώνουμε για την απόφαση.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Το παρόν τιμολόγιο αντιπροσωπεύει την προμήθεια τέλους πλατφόρμας που χρεώνεται από την {operator} στον τεχνίτη. Τα ποσά διακανονίζονται αυτόματα μέσω συναλλαγών διαχωρισμένης πληρωμής.',
  },
  es: {
    trader_status_trader: 'Este vendedor ha declarado que es un comerciante.',
    trader_status_non_trader: 'Este vendedor ha declarado que no es un comerciante.',
    trader_status_undeclared:
      'Este vendedor no ha declarado si es un comerciante. Las compras no están disponibles hasta que se proporcione la declaración.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.es,
    ranking_disclosure_title: 'Cómo se ordenan los resultados',
    ranking_disclosure_no_payment:
      'Los vendedores no pueden pagar para mejorar su posición. Ningún anuncio en Eurtisan está patrocinado ni promocionado a cambio de pago.',
    ranking_disclosure_category_body:
      'Los productos se muestran en el orden que elija con el control de ordenación. Por defecto, los anuncios más recientes aparecen primero. Los filtros solo eliminan productos de la lista; nunca cambian el orden de los que permanecen.',
    ranking_disclosure_search_body:
      'Al buscar, los resultados se ordenan según su grado de coincidencia con sus palabras, en este orden de importancia:',
    ranking_disclosure_search_1: 'Cuántas de sus palabras de búsqueda contiene un anuncio.',
    ranking_disclosure_search_2:
      'La precisión ortográfica de las palabras: un anuncio sin erratas se clasifica por delante de uno que necesitó corrección.',
    ranking_disclosure_search_3: 'La proximidad de las palabras entre sí en el anuncio.',
    ranking_disclosure_search_4:
      'Qué parte del anuncio coincidió, en este orden: nombre del producto, nombre de la tienda, categoría, luego descripción.',
    ranking_disclosure_search_5:
      'La ordenación que eligió, si la cambió con respecto a Relevancia.',
    ranking_disclosure_search_6: 'Si la coincidencia es exacta en lugar de parcial.',
    ranking_disclosure_search_7:
      'Si el producto está en stock: los productos en stock aparecen primero.',
    ranking_disclosure_search_8:
      'La puntuación de opiniones del producto, ponderada por el número de valoraciones, de modo que un producto con buenas opiniones supera a uno sin historial.',
    ranking_disclosure_search_note:
      'Se aplican correcciones ortográficas y sinónimos a sus palabras, y se reconocen todos los idiomas oficiales de la Unión Europea. La novedad no forma parte deliberadamente de la puntuación de opiniones; utilice la ordenación Más recientes para ello.',
    review_disclosure_title: 'Cómo gestionamos las opiniones',
    review_disclosure_verified_body:
      'Cada opinión en Eurtisan procede de alguien que compró el producto aquí. Lo verificamos automáticamente antes de permitir escribir una opinión:',
    review_disclosure_check_purchase:
      'La cuenta del autor realizó el pedido que contiene el producto.',
    review_disclosure_check_delivered:
      'El pedido se marcó como entregado y han pasado 14 días desde entonces, de modo que la opinión refleja el uso del producto y no solo su desembalaje.',
    review_disclosure_check_once:
      'Una opinión por producto y pedido, para que una misma compra no pueda valorarse dos veces.',
    review_disclosure_check_own:
      'Los artesanos no pueden opinar sobre productos de su propia tienda.',
    review_disclosure_order:
      'Las opiniones se muestran con las más recientes primero por defecto. También puede ordenarlas por calificación más alta, calificación más baja o votos útiles, y filtrarlas por estrellas.',
    review_disclosure_dates:
      'Cada opinión muestra la fecha en que se publicó y la fecha en que el comprador recibió el producto.',
    review_disclosure_moderation:
      'No editamos las opiniones. Cualquiera puede denunciar una opinión: una denuncia por sí sola no cambia nada. Un moderador puede ocultar una opinión ilícita o que incumpla nuestras condiciones, y siempre se informa al autor de la decisión y sus motivos.',
    review_disclosure_retention:
      'Conservamos las opiniones mientras el producto esté publicado. Si un artesano retira el producto o usted cierra su cuenta, la opinión se elimina con él.',
    review_disclosure_no_payment:
      'Nadie cobra ni recibe recompensas por escribir una opinión, y los artesanos no pueden pagar para que se elimine ninguna.',
    terms_section_11_text:
      'No puede utilizar la Plataforma para:\n\n- Publicar o vender productos falsificados, robados, ilícitos o peligrosos.\n- Publicar o vender alimentos, bebidas o cualquier otro producto destinado al consumo. Eurtisan no está diseñada para incluir la información sobre ingredientes, alérgenos y origen que la legislación alimentaria de la UE, en particular el Reglamento (UE) n.º 1169/2011, exige mostrar antes de la compra.\n- Acosar, amenazar o discriminar a otros usuarios.\n- Eludir o intentar eludir las tarifas o políticas de la Plataforma.\n- Realizar actividades fraudulentas.\n- Cargar código malicioso o interferir con la seguridad de la Plataforma.\n- Infringir derechos de propiedad intelectual.\n- Recopilar datos personales de otros usuarios sin su consentimiento.',
    terms_section_16_text:
      'Para preguntas sobre estas Condiciones, contáctenos en {email}. Para notificarnos contenidos ilegales en virtud del Artículo 16 de la DSA, utilice la opción de denuncia en un anuncio o tienda. Registramos la notificación y le comunicamos la decisión.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Esta factura representa la comisión de la tarifa de plataforma cobrada por {operator} al artesano. Los importes se liquidan automáticamente mediante transacciones de pago dividido.',
  },
  et: {
    trader_status_trader: 'See müüja on deklareerinud, et ta on kaupleja.',
    trader_status_non_trader: 'See müüja on deklareerinud, et ta ei ole kaupleja.',
    trader_status_undeclared:
      'See müüja ei ole deklareerinud, kas ta on kaupleja. Ostud ei ole kättesaadavad enne deklaratsiooni esitamist.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.et,
    ranking_disclosure_title: 'Kuidas tulemused järjestatakse',
    ranking_disclosure_no_payment:
      'Müüjad ei saa maksta kõrgema positsiooni eest. Ükski Eurtisani kuulutus ei ole tasu eest sponsoreeritud ega esile tõstetud.',
    ranking_disclosure_category_body:
      'Tooted kuvatakse teie valitud sortimisjärjestuses. Vaikimisi kuvatakse uusimad kuulutused esimesena. Filtrid eemaldavad tooteid loendist; need ei muuda kunagi allesjäänud toodete järjekorda.',
    ranking_disclosure_search_body:
      'Otsimisel järjestatakse tulemused vastavalt sellele, kui hästi need teie sõnadega sobivad, järgmises tähtsuse järjekorras:',
    ranking_disclosure_search_1: 'Kui mitut teie otsingusõna kuulutus sisaldab.',
    ranking_disclosure_search_2:
      'Sõnade kirjapildi täpsus: ilma trükivigadeta kuulutus seatakse parandust vajanust ettepoole.',
    ranking_disclosure_search_3: 'Kui lähestikku teie sõnad kuulutuses asuvad.',
    ranking_disclosure_search_4:
      'Milline kuulutuse osa vastas otsingule, järgmises järjekorras: toote nimi, poe nimi, kategooria, seejärel kirjeldus.',
    ranking_disclosure_search_5:
      'Teie valitud sortimine, kui muutsite selle asjakohasusest erinevaks.',
    ranking_disclosure_search_6: 'Kas vaste on täpne või osaline.',
    ranking_disclosure_search_7: 'Kas toode on laos: laotooted kuvatakse esimesena.',
    ranking_disclosure_search_8:
      'Toote arvustuste hinne, kaalutud arvustuste arvuga, nii et hea tagasisidega toode edestab tõestamata toodet.',
    ranking_disclosure_search_note:
      'Teie sõnadele rakendatakse õigekirjakorrektsiooni ja sünonüüme ning tuvastatakse kõik Euroopa Liidu ametlikud keeled. Värskus ei kuulu teadlikult arvustuste skoori hulka: selleks kasutage sortimist Uusimad.',
    review_disclosure_title: 'Kuidas me arvustusi haldame',
    review_disclosure_verified_body:
      'Iga Eurtisani arvustus pärineb kelleltki, kes ostis toote siit. Kontrollime seda automaatselt enne arvustuse kirjutamist:',
    review_disclosure_check_purchase: 'Arvustaja konto tegi tellimuse, mis sisaldab toodet.',
    review_disclosure_check_delivered:
      'Tellimus märgiti kohaletoimetatuks ja sellest on möödunud 14 päeva, seega peegeldab arvustus toote kasutamist, mitte pelgalt lahtipakkimist.',
    review_disclosure_check_once:
      'Üks arvustus toote kohta tellimuse kohta, nii et ühte ostu ei saa kaks korda arvustada.',
    review_disclosure_check_own: 'Käsitöölised ei saa arvustada oma poe tooteid.',
    review_disclosure_order:
      'Arvustused kuvatakse vaikimisi järjekorras uusimad esimesena. Samuti saate neid järjestada kriteeriumide kõrgeim hinnang, madalaim hinnang või kasulikud hääled järgi ja filtreerida tärnide alusel.',
    review_disclosure_dates:
      'Iga arvustus näitab avaldamise kuupäeva ja kuupäeva, millal ostja toote kätte sai.',
    review_disclosure_moderation:
      'Me ei muuda arvustusi. Igaüks saab arvustusest teatada: üksnes teatamine ei muuda midagi. Moderaator võib ebaseadusliku või tingimusi rikkuva arvustuse peita ning autorit teavitatakse alati otsusest ja põhjustest.',
    review_disclosure_retention:
      'Säilitame arvustusi seni, kuni toode on müügis. Kui käsitööline toote eemaldab või sulgete oma konto, kustutatakse ka arvustus.',
    review_disclosure_no_payment:
      'Keegi ei saa arvustuse kirjutamise eest tasu ega hüvesid ning käsitöölised ei saa maksta arvustuse eemaldamise eest.',
    terms_section_11_text:
      'Te ei tohi platvormi kasutada järgmisteks tegevusteks:\n\n- Võltsitud, varastatud, ebaseaduslike või ohtlike kaupade müümine või müügiks pakkumine.\n- Toidu, joogi või mis tahes muude tarbimiseks mõeldud toodete müümine või müügiks pakkumine. Eurtisan ei ole ette nähtud koostisosade, allergeenide ja päritolu teabe esitamiseks, mida ELi toidualased õigusaktid, eriti määrus (EL) nr 1169/2011, nõuavad enne ostu sooritamist.\n- Teiste kasutajate ahistamine, ähvardamine või diskrimineerimine.\n- Platvormi tasude või reeglite eiramine.\n- Petturlik tegevus.\n- Pahavara üleslaadimine või platvormi turvalisuse kahjustamine.\n- Intellektuaalomandi õiguste rikkumine.\n- Teiste kasutajate isikuandmete kogumine ilma nõusolekuta.',
    terms_section_16_text:
      'Nende tingimuste kohta tekkivate küsimuste korral võtke meiega ühendust aadressil {email}. Ebaseaduslikust sisust teatamiseks digiteenuste määruse (DSA) artikli 16 alusel kasutage toote või poe juures olevat teatamisfunktsiooni. Salvestame teate ja anname teile otsusest teada.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'See arve kajastab platvormitasu vahendustasu, mida {operator} küsib käsitööliselt. Summad arveldatakse automaatselt jagatud maksete kaudu.',
  },
  fi: {
    trader_status_trader: 'Tämä myyjä on ilmoittanut olevansa elinkeinonharjoittaja.',
    trader_status_non_trader: 'Tämä myyjä on ilmoittanut, ettei hän ole elinkeinonharjoittaja.',
    trader_status_undeclared:
      'Tämä myyjä ei ole ilmoittanut, onko hän elinkeinonharjoittaja. Ostot eivät ole mahdollisia ennen ilmoituksen antamista.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.fi,
    ranking_disclosure_title: 'Miten tulokset järjestetään',
    ranking_disclosure_no_payment:
      'Myyjät eivät voi maksaa paremmasta sijoituksesta. Mitään Eurtisanin ilmoitusta ei sponsoroida tai edistetä maksua vastaan.',
    ranking_disclosure_category_body:
      'Tuotteet näytetään valitsemassasi lajittelujärjestyksessä. Oletuksena uusimmat ilmoitukset näytetään ensin. Suodattimet poistavat vain tuotteita listalta; ne eivät koskaan muuta jäljellä olevien järjestystä.',
    ranking_disclosure_search_body:
      'Haettaessa tulokset järjestetään sen mukaan, miten hyvin ne vastaavat hakusanojasi, seuraavassa tärkeysjärjestyksessä:',
    ranking_disclosure_search_1: 'Kuinka montaa hakusanaasi ilmoitus sisältää.',
    ranking_disclosure_search_2:
      'Sanojen kirjoitusasun tarkkuus: ilmoitus ilman kirjoitusvirheitä sijoittuu korjausta vaatineen edelle.',
    ranking_disclosure_search_3: 'Kuinka lähellä toisiaan hakusanasi esiintyvät ilmoituksessa.',
    ranking_disclosure_search_4:
      'Mikä ilmoituksen osa vastasi hakua, seuraavassa järjestyksessä: tuotteen nimi, kaupan nimi, kategoria, sitten kuvaus.',
    ranking_disclosure_search_5: 'Valitsemasi lajittelu, jos muutit sen Osuvuudesta.',
    ranking_disclosure_search_6: 'Onko osuma tarkka vai osittainen.',
    ranking_disclosure_search_7:
      'Onko tuotetta varastossa: varastossa olevat tuotteet näytetään ensin.',
    ranking_disclosure_search_8:
      'Tuotteen arvostelupisteet suhteutettuna arvostelujen määrään, joten hyvän palautteen saanut tuote ohittaa todentamattoman.',
    ranking_disclosure_search_note:
      'Sanoihisi sovelletaan oikeinkirjoituksen korjausta ja synonyymejä, ja kaikki Euroopan unionin viralliset kielet tunnistetaan. Tuoreus ei tarkoituksella ole osa arvostelupisteitä: käytä siihen Uusimmat-lajittelua.',
    review_disclosure_title: 'Miten käsittelemme arvosteluja',
    review_disclosure_verified_body:
      'Jokainen Eurtisanin arvostelu on peräisin henkilöltä, joka osti tuotteen täältä. Tarkistamme tämän automaattisesti ennen arvostelun kirjoittamista:',
    review_disclosure_check_purchase: 'Arvostelijan tili teki tilauksen, joka sisältää tuotteen.',
    review_disclosure_check_delivered:
      'Tilaus merkittiin toimitetuksi ja siitä on kulunut 14 päivää, joten arvostelu heijastaa tuotteen käyttöä eikä vain pakkauksen avaamista.',
    review_disclosure_check_once:
      'Yksi arvostelu tuotetta kohti tilausta kohden, joten samaa ostosta ei voi arvostella kahdesti.',
    review_disclosure_check_own: 'Käsityöläiset eivät voi arvostella oman kauppansa tuotteita.',
    review_disclosure_order:
      'Arvostelut näytetään oletuksena järjestyksessä uusimmat ensin. Voit myös järjestää ne kriteereillä korkein arvosana, matalin arvosana tai hyödylliset äänet ja suodattaa tähtien mukaan.',
    review_disclosure_dates:
      'Jokaisessa arvostelussa näkyy julkaisupäivämäärä ja päivämäärä, jolloin ostaja vastaanotti tuotteen.',
    review_disclosure_moderation:
      'Emme muokkaa arvosteluja. Kuka tahansa voi ilmoittaa arvostelusta: pelkkä ilmoitus ei muuta mitään. Moderaattori voi piilottaa laittoman tai ehtojemme vastaisen arvostelun, ja tekijälle kerrotaan aina päätöksestä ja sen perusteluista.',
    review_disclosure_retention:
      'Säilytämme arvosteluja niin kauan kuin tuote on listattuna. Jos käsityöläinen poistaa tuotteen tai suljet tilisi, arvostelu poistuu sen mukana.',
    review_disclosure_no_payment:
      'Kenellekään ei makseta tai anneta palkkioita arvostelun kirjoittamisesta, eivätkä käsityöläiset voi maksaa arvostelun poistamisesta.',
    terms_section_11_text:
      'Et saa käyttää alustaa seuraaviin tarkoituksiin:\n\n- Väärennettyjen, varastettujen, laittomien tai vaarallisten tuotteiden listaaminen tai myyminen.\n- Ruoan, juoman tai muiden nautittavaksi tarkoitettujen tuotteiden listaaminen tai myyminen. Eurtisania ei ole suunniteltu esittämään ainesosia, allergeeneja ja alkuperää koskevia tietoja, joita EU:n elintarvikelainsäädäntö, erityisesti asetus (EU) N:o 1169/2011, edellyttää esitettäväksi ennen ostopäätöksen tekemistä.\n- Muiden käyttäjien häiritseminen, uhkailu tai syrjiminen.\n- Alustan maksujen tai käytäntöjen kiertäminen.\n- Petollinen toiminta.\n- Haitallisen koodin lataaminen tai alustan turvallisuuden häiritseminen.\n- Immateriaalioikeuksien loukkaaminen.\n- Muiden käyttäjien henkilötietojen kerääminen ilman suostumusta.',
    terms_section_16_text:
      'Jos sinulla on kysyttävää näistä ehdoista, ota yhteyttä osoitteeseen {email}. Voit ilmoittaa laittomasta sisällöstä digipalvelusäädöksen (DSA) 16 artiklan mukaisesti ilmoitustoiminnolla tuotteessa tai kaupassa. Kirjaamme ilmoituksen ja kerromme sinulle päätöksestä.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Tämä lasku edustaa palvelumaksua, jonka {operator} veloittaa käsityöläiseltä. Summat tilitetään automaattisesti jaetun maksun kautta.',
  },
  ga: {
    trader_status_trader: 'Dhearbhaigh an díoltóir seo gur trádálaí é/í.',
    trader_status_non_trader: 'Dhearbhaigh an díoltóir seo nach trádálaí é/í.',
    trader_status_undeclared:
      'Níl sé dearbhaithe ag an díoltóir seo an trádálaí é/í. Níl ceannacháin ar fáil go dtí go gcuirtear an dearbhú ar fáil.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.ga,
    ranking_disclosure_title: 'Conas a dhéantar torthaí a ordú',
    ranking_disclosure_no_payment:
      'Ní féidir le díoltóirí íoc as rangú níos airde. Níl aon liostú ar Eurtisan urraithe ná curtha chun cinn mar mhalairt ar íocaíocht.',
    ranking_disclosure_category_body:
      'Taispeántar táirgí san ord a roghnaíonn tú leis an rialtán sórtála. De réir réamhshocraithe, tagann na liostaí is déanaí ar dtús. Ní bhaineann scagairí ach táirgí den liosta; ní athraíonn siad ord na dtáirgí a fhanann choíche.',
    ranking_disclosure_search_body:
      'Nuair a dhéanann tú cuardach, déantar torthaí a ordú de réir mar a mheaitseálann siad do chuid focal, san ord tábhachta seo:',
    ranking_disclosure_search_1: "Cé mhéad de d'fhocail chuardaigh a mheaitseálann liostú.",
    ranking_disclosure_search_2:
      'Cé chomh cruinn agus a litrítear na focail: rangaítear liostú gan earráidí cló os cionn ceann a raibh ceartú ag teastáil uaidh.',
    ranking_disclosure_search_3:
      'Cé chomh gar agus a fheictear do chuid focal dá chéile sa liostú.',
    ranking_disclosure_search_4:
      'Cén chuid den liostú a mheaitseáil, san ord seo: ainm an táirge, ainm an tsiopa, catagóir, ansin cur síos.',
    ranking_disclosure_search_5: "An sórtáil a roghnaigh tú, má d'athraigh tú ó Ábharthacht é.",
    ranking_disclosure_search_6: 'Cibé an bhfuil an meaitseáil cruinn seachas páirteach.',
    ranking_disclosure_search_7:
      'Cibé an bhfuil an táirge i stoc: tagann táirgí atá i stoc ar dtús.',
    ranking_disclosure_search_8:
      'Scór léirmheasa an táirge, ualaithe de réir líon na léirmheasanna, ionas go mbíonn táirge a bhfuil dea-léirmheasanna air níos airde ná ceann gan cruthú.',
    ranking_disclosure_search_note:
      "Cuirtear ceartú litrithe agus comhchiallaigh i bhfeidhm ar d'fhocail, agus aithnítear gach teanga oifigiúil de chuid an Aontais Eorpaigh. Ní cuid de scór an léirmheasa é an t-am go hintinneach: bain úsáid as an sórtáil Is déanaí chuige sin.",
    review_disclosure_title: 'Conas a láimhseálaimid léirmheasanna',
    review_disclosure_verified_body:
      'Tagann gach léirmheas ar Eurtisan ó dhuine a cheannaigh an táirge anseo. Seiceálaimid é seo go huathoibríoch sular féidir léirmheas a scríobh:',
    review_disclosure_check_purchase:
      'Chuir cuntas an léirmheastóra an t-ordú ina bhfuil an táirge isteach.',
    review_disclosure_check_delivered:
      'Marcáladh an t-ordú mar ordú seachadta, agus tá 14 lá caite ó shin, ionas go léiríonn an léirmheas úsáid an táirge, ní hamháin é a dhíphacáil.',
    review_disclosure_check_once:
      'Léirmheas amháin in aghaidh an táirge in aghaidh an ordaithe, ionas nach féidir athbhreithniú a dhéanamh ar aon cheannachán faoi dhó.',
    review_disclosure_check_own:
      'Ní féidir le déantóirí léirmheas a dhéanamh ar tháirgí óna siopa féin.',
    review_disclosure_order:
      'Taispeántar léirmheasanna leis na cinn is déanaí ar dtús de réir réamhshocraithe. Is féidir leat iad a ordú de réir rátáil is airde, rátáil is ísle nó vótaí cabhracha agus scagadh de réir réaltaí.',
    review_disclosure_dates:
      'Léiríonn gach léirmheas an dáta a foilsíodh é agus an dáta a fuair an ceannaitheoir an táirge.',
    review_disclosure_moderation:
      'Ní dhéanaimid léirmheasanna a chur in eagar. Is féidir le duine ar bith ceann a thuairisciú: ní athraíonn tuairisciú amháin aon rud. Is féidir le modhnóir léirmheas atá neamhdhleathach nó a bhriseann ár dtéarmaí a chur i bhfolach, agus cuirtear an cinneadh agus na cúiseanna in iúl don údar i gcónaí.',
    review_disclosure_retention:
      'Coinnímid léirmheasanna fad atá an táirge liostaithe. Má bhaineann déantóir an táirge nó má dhúnann tú do chuntas, baintear an léirmheas leis.',
    review_disclosure_no_payment:
      "Ní íoctar ná ní thugtar luach saothair d'aon duine as léirmheas a scríobh, agus ní féidir le déantóirí íoc as ceann a bhaint.",
    terms_section_11_text:
      'Ní féidir leat an tArdán a úsáid chun:\n\n- Earraí góchumtha, goidte, neamhdhleathacha nó contúirteacha a liostú nó a dhíol.\n- Bia, deoch nó aon táirge eile atá beartaithe lena chaitheamh a liostú nó a dhíol. Níl Eurtisan socraithe chun an fhaisnéis faoi chomhábhair, ailléirginí agus tionscnamh a éilíonn dlí bia an AE, go háirithe Rialachán (AE) Uimh. 1169/2011, a thaispeáint sula ndéantar ceannachán.\n- Ciapadh, bagairt nó idirdhealú a dhéanamh ar úsáideoirí eile.\n- Táillí nó beartais an Ardáin a sheachaint.\n- Dul i mbun gníomhaíochtaí calaoiseacha.\n- Cód mailíseach a uaslódáil nó cur isteach ar shlándáil an Ardáin.\n- Cearta maoine intleachtúla a shárú.\n- Sonraí pearsanta úsáideoirí eile a bhailiú gan toiliú.',
    terms_section_16_text:
      'Le haghaidh ceisteanna faoi na Téarmaí seo, déan teagmháil linn ag {email}. Chun ábhar neamhdhleathach a chur in iúl dúinn faoi Airteagal 16 den Ghníomh um Sheirbhísí Digiteacha (DSA), bain úsáid as an ngníomh tuairiscithe ar liostú nó siopa. Taifeadaimid an fógra agus cuirimid an cinneadh in iúl duit.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Léiríonn an sonrasc seo coimisiún táille an ardáin a ghearrann {operator} ar an gceardaí. Socraítear méideanna go huathoibríoch trí idirbhearta íocaíochta scoilte.',
  },
  hr: {
    trader_status_trader: 'Ovaj prodavatelj je izjavio da je trgovac.',
    trader_status_non_trader: 'Ovaj prodavatelj je izjavio da nije trgovac.',
    trader_status_undeclared:
      'Ovaj prodavatelj nije izjavio je li trgovac. Kupnje nisu dostupne dok se ne dostavi izjava.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.hr,
    ranking_disclosure_title: 'Kako se rezultati razvrstavaju',
    ranking_disclosure_no_payment:
      'Prodavatelji ne mogu platiti za viši rang. Nijedan oglas na Eurtisanu nije sponzoriran niti promoviran u zamjenu za plaćanje.',
    ranking_disclosure_category_body:
      'Proizvodi se prikazuju redoslijedom koji odaberete pomoću kontrole razvrstavanja. Prema zadanim postavkama najnovije ponude prikazuju se prve. Filtri samo uklanjaju proizvode s popisa; nikada ne mijenjaju redoslijed preostalih.',
    ranking_disclosure_search_body:
      'Prilikom pretraživanja rezultati se razvrstavaju prema tome koliko dobro odgovaraju vašim riječima, sljedećim redoslijedom važnosti:',
    ranking_disclosure_search_1: 'Koliko vaših riječi za pretraživanje ponuda sadrži.',
    ranking_disclosure_search_2:
      'Točnost pravopisa riječi: ponuda bez tipfelera rangira se iznad one koja je trebala ispravak.',
    ranking_disclosure_search_3: 'Koliko su vaše riječi blizu jedna drugoj u ponudi.',
    ranking_disclosure_search_4:
      'Koji se dio ponude podudarao, ovim redoslijedom: naziv proizvoda, naziv trgovine, kategorija, zatim opis.',
    ranking_disclosure_search_5:
      'Poredak koji ste odabrali, ako ste ga promijenili u odnosu na Relevantnost.',
    ranking_disclosure_search_6: 'Je li podudaranje točno, a ne djelomično.',
    ranking_disclosure_search_7: 'Je li proizvod na zalihi: proizvodi na zalihi prikazuju se prvi.',
    ranking_disclosure_search_8:
      'Ocjena recenzija proizvoda, ponderirana brojem recenzija, tako da dobro ocijenjen proizvod nadmašuje nedokazani.',
    ranking_disclosure_search_note:
      'Ispravak pravopisa i sinonimi primjenjuju se na vaše riječi, a prepoznaju se svi službeni jezici Europske unije. Vremenska svježina namjerno nije dio ocjene recenzija: za to upotrijebite razvrstavanje Najnovije.',
    review_disclosure_title: 'Kako upravljamo recenzijama',
    review_disclosure_verified_body:
      'Svaka recenzija na Eurtisanu dolazi od nekoga tko je ovdje kupio proizvod. To automatski provjeravamo prije nego što se recenzija može napisati:',
    review_disclosure_check_purchase: 'Račun recenzenta izvršio je narudžbu koja sadrži proizvod.',
    review_disclosure_check_delivered:
      'Narudžba je označena kao isporučena i od tada je prošlo 14 dana, tako da recenzija odražava stvarno korištenje proizvoda, a ne samo raspakiranje.',
    review_disclosure_check_once:
      'Jedna recenzija po proizvodu po narudžbi, tako da se jedna kupnja ne može dvaput ocijeniti.',
    review_disclosure_check_own: 'Obrtnici ne mogu recenzirati proizvode iz vlastite trgovine.',
    review_disclosure_order:
      'Recenzije se prema zadanim postavkama prikazuju od najnovije prvo. Također ih možete poredati prema najviša ocjena, najniža ocjena ili korisni glasovi te filtrirati prema zvjezdicama.',
    review_disclosure_dates:
      'Svaka recenzija prikazuje datum objave i datum kada je kupac primio proizvod.',
    review_disclosure_moderation:
      'Ne uređujemo recenzije. Svatko može prijaviti recenziju: sama prijava ne mijenja ništa. Moderator može sakriti recenziju koja je nezakonita ili krši naše uvjete, a autor je uvijek obaviješten o odluci i razlozima.',
    review_disclosure_retention:
      'Recenzije čuvamo sve dok je proizvod u ponudi. Ako obrtnik ukloni proizvod ili zatvorite račun, recenzija se briše.',
    review_disclosure_no_payment:
      'Nitko nije plaćen niti nagrađen za pisanje recenzije, a obrtnici ne mogu platiti za uklanjanje recenzije.',
    terms_section_11_text:
      'Platformu ne smijete koristiti za:\n\n- Oglašavanje ili prodaju krivotvorene, ukradene, nezakonite ili opasne robe.\n- Oglašavanje ili prodaju hrane, pića ili bilo kojeg drugog proizvoda namijenjenog konzumaciji. Eurtisan nije prilagođen za prikazivanje podataka o sastojcima, alergenima i podrijetlu koje zakonodavstvo EU-a o hrani, posebno Uredba (EU) br. 1169/2011, zahtijeva prije kupnje.\n- Uznemiravanje, prijetnje ili diskriminaciju drugih korisnika.\n- Zaobilaženje naknada ili pravila Platforme.\n- Prijevarne aktivnosti.\n- Prijenos zlonamjernog koda ili narušavanje sigurnosti Platforme.\n- Povredu prava intelektualnog vlasništva.\n- Prikupljanje osobnih podataka drugih korisnika bez privole.',
    terms_section_16_text:
      'Za pitanja o ovim Uvjetima obratite nam se na {email}. Da biste prijavili nezakonit sadržaj prema članku 16. Akta o digitalnim uslugama (DSA), upotrijebite radnju prijave na ponudi ili trgovini. Bilježimo prijavu i obavještavamo vas o odluci.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Ovaj račun predstavlja proviziju naknade platforme koju {operator} naplaćuje obrtniku. Iznosi se automatski namiruju putem transakcija podijeljenog plaćanja.',
  },
  hu: {
    trader_status_trader: 'Ez az eladó kijelentette, hogy kereskedő.',
    trader_status_non_trader: 'Ez az eladó kijelentette, hogy nem kereskedő.',
    trader_status_undeclared:
      'Ez az eladó nem nyilatkozott arról, hogy kereskedő-e. A vásárlás a nyilatkozat megadásáig nem lehetséges.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.hu,
    ranking_disclosure_title: 'Hogyan rendeződnek az eredmények',
    ranking_disclosure_no_payment:
      'Az eladók nem fizethetnek a jobb helyezésért. Az Eurtisanon egyetlen hirdetés sem szponzorált vagy fizetés ellenében népszerűsített.',
    ranking_disclosure_category_body:
      'A termékek a rendezésvezérlővel kiválasztott sorrendben jelennek meg. Alapértelmezés szerint a legújabbak hirdetések szerepelnek elöl. A szűrők csak eltávolítanak termékeket a listáról; a megmaradók sorrendjét soha nem módosítják.',
    ranking_disclosure_search_body:
      'Kereséskor a találatok aszerint rendeződnek, hogy mennyire felelnek meg a keresőszavaknak, a fontossági sorrend a következő:',
    ranking_disclosure_search_1: 'Hány keresett szót tartalmaz a hirdetés.',
    ranking_disclosure_search_2:
      'Milyen pontos a szavak helyesírása – az elírás nélküli hirdetés előrébb szerepel a javítást igénylőnél.',
    ranking_disclosure_search_3: 'Milyen közel állnak a szavak egymáshoz a hirdetésben.',
    ranking_disclosure_search_4:
      'A hirdetés melyik része egyezett, a következő sorrendben: termék neve, bolt neve, kategória, majd leírás.',
    ranking_disclosure_search_5:
      'A kiválasztott rendezés, ha megváltoztatta a Relevanciához képest.',
    ranking_disclosure_search_6: 'Hogy az egyezés pontos-e vagy részleges.',
    ranking_disclosure_search_7:
      'Hogy a termék raktáron van-e – a raktáron lévő termékek jelennek meg elöl.',
    ranking_disclosure_search_8:
      'A termék értékelési pontszáma, az értékelések számával súlyozva, így a jól értékelt termék megelőzi a még bizonyítatlant.',
    ranking_disclosure_search_note:
      'A helyesírási javítás és a szinonimák érvényesülnek a szavakra, és az Európai Unió összes hivatalos nyelvét felismeri a rendszer. Az időbeli közelség szándékosan nem része az értékelési pontszámnak – ehhez használja a Legújabbak rendezést.',
    review_disclosure_title: 'Hogyan kezeljük az értékeléseket',
    review_disclosure_verified_body:
      'Az Eurtisanon minden értékelés olyan személytől származik, aki itt vásárolta a terméket. Ezt automatikusan ellenőrizzük az értékelés megírása előtt:',
    review_disclosure_check_purchase: 'Az értékelő fiókja adta le a terméket tartalmazó rendelést.',
    review_disclosure_check_delivered:
      'A rendelést kézbesítettként jelölték meg, és azóta 14 nap telt el – így az értékelés a termék tényleges használatát tükrözi, nem csupán a kicsomagolást.',
    review_disclosure_check_once:
      'Rendelésenként és termékenként egy értékelés, így egy vásárlás nem értékelhető kétszer.',
    review_disclosure_check_own: 'A készítők nem értékelhetik saját boltjuk termékeit.',
    review_disclosure_order:
      'Az értékelések alapértelmezés szerint legújabbak elöl sorrendben jelennek meg. Rendezheti őket legmagasabb értékelés, legalacsonyabb értékelés vagy hasznos szavazatok szerint is, és szűrheti csillagok alapján.',
    review_disclosure_dates:
      'Minden értékelés tartalmazza a közzététel dátumát és azt a napot, amikor a vásárló átvette a terméket.',
    review_disclosure_moderation:
      'Nem szerkesztjük az értékeléseket. Bárki jelenthet egy értékelést – a bejelentés önmagában semmin nem változtat. A moderátor elrejtheti a jogellenes vagy a feltételeinkbe ütköző értékelést, és a szerző mindig tájékoztatást kap a döntésről és az indokokról.',
    review_disclosure_retention:
      'Az értékeléseket mindaddig megőrizzük, amíg a termék szerepel a kínálatban. Ha az alkotó eltávolítja a terméket, vagy törli fiókját, az értékelés törlődik.',
    review_disclosure_no_payment:
      'Senki sem kap díjazást vagy jutalmat értékelés írásáért, és a készítők sem fizethetnek az értékelés eltávolításáért.',
    terms_section_11_text:
      'Nem használhatja a Platformot a következőkre:\n\n- Hamisított, lopott, illegális vagy veszélyes áruk feltöltése vagy értékesítése.\n- Élelmiszerek, italok vagy bármely más fogyasztásra szánt termék feltöltése vagy értékesítése. Az Eurtisan nincs felkészítve az uniós élelmiszerjog, különösen az 1169/2011/EU rendelet által a vásárlás előtt előírt összetevők, allergének és eredetinformációk megjelenítésére.\n- Más felhasználók zaklatása, fenyegetése vagy hátrányos megkülönböztetése.\n- A Platform díjainak vagy szabályzatainak megkerülése.\n- Csalárd tevékenységek folytatása.\n- Rosszindulatú kód feltöltése vagy a Platform biztonságának veszélyeztetése.\n- Szellemi tulajdonjogok megsértése.\n- Más felhasználók személyes adatainak beleegyezés nélküli gyűjtése.',
    terms_section_16_text:
      'A jelen Feltételekkel kapcsolatos kérdéseivel kérjük, forduljon hozzánk a(z) {email} címen. Jogellenes tartalom bejelentéséhez a DSA 16. cikke alapján használja a hirdetésnél vagy boltnál található bejelentési lehetőséget. A bejelentést rögzítjük és tájékoztatjuk döntésünkről.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Ez a számla a(z) {operator} által a kézművesnek felszámított platformdíj-jutalékot tartalmazza. Az összegek elszámolása automatikusan, osztott fizetési tranzakciókon keresztül történik.',
  },
  it: {
    trader_status_trader: 'Questo venditore ha dichiarato di essere un professionista.',
    trader_status_non_trader: 'Questo venditore ha dichiarato di non essere un professionista.',
    trader_status_undeclared:
      'Questo venditore non ha dichiarato se è un professionista. Gli acquisti non sono disponibili finché la dichiarazione non viene fornita.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.it,
    ranking_disclosure_title: 'Come vengono ordinati i risultati',
    ranking_disclosure_no_payment:
      'I venditori non possono pagare per ottenere una posizione più alta. Nessuna inserzione su Eurtisan è sponsorizzata o promossa a pagamento.',
    ranking_disclosure_category_body:
      "I prodotti vengono mostrati nell'ordine scelto con il controllo di ordinamento. Per impostazione predefinita, le inserzioni più recenti appaiono per prime. I filtri rimuovono solo i prodotti dall'elenco; non cambiano mai l'ordine di quelli rimanenti.",
    ranking_disclosure_search_body:
      'Quando effettui una ricerca, i risultati vengono ordinati in base alla corrispondenza con le tue parole, nel seguente ordine di importanza:',
    ranking_disclosure_search_1:
      "Quante delle tue parole di ricerca sono presenti in un'inserzione.",
    ranking_disclosure_search_2:
      "La precisione ortografica delle parole: un'inserzione senza errori di battitura si posiziona prima di una che ha richiesto correzioni.",
    ranking_disclosure_search_3: "Quanto le tue parole sono vicine tra loro nell'inserzione.",
    ranking_disclosure_search_4:
      "Quale parte dell'inserzione corrisponde, in questo ordine: nome del prodotto, nome del negozio, categoria, poi descrizione.",
    ranking_disclosure_search_5:
      "L'ordinamento che hai scelto, se lo hai modificato rispetto a Rilevanza.",
    ranking_disclosure_search_6: 'Se la corrispondenza è esatta anziché parziale.',
    ranking_disclosure_search_7:
      'Se il prodotto è disponibile: i prodotti disponibili compaiono per primi.',
    ranking_disclosure_search_8:
      'Il punteggio delle recensioni del prodotto, ponderato in base al numero di recensioni, in modo che un prodotto ben recensito superi uno senza storico.',
    ranking_disclosure_search_note:
      "La correzione ortografica e i sinonimi vengono applicati alle tue parole e vengono riconosciute tutte le lingue ufficiali dell'Unione europea. La recenza non fa deliberatamente parte del punteggio delle recensioni: usa l'ordinamento Più recenti a tale scopo.",
    review_disclosure_title: 'Come gestiamo le recensioni',
    review_disclosure_verified_body:
      'Ogni recensione su Eurtisan proviene da qualcuno che ha acquistato il prodotto qui. Lo verifichiamo automaticamente prima che una recensione possa essere scritta:',
    review_disclosure_check_purchase:
      "L'account dell'autore ha effettuato l'ordine che contiene il prodotto.",
    review_disclosure_check_delivered:
      "L'ordine è stato contrassegnato come consegnato e sono trascorsi 14 giorni da allora, così che la recensione rifletta l'uso del prodotto e non solo l'apertura della confezione.",
    review_disclosure_check_once:
      'Una recensione per prodotto per ordine, affinché un singolo acquisto non possa essere recensito due volte.',
    review_disclosure_check_own:
      'Gli artigiani non possono recensire prodotti del proprio negozio.',
    review_disclosure_order:
      'Le recensioni vengono mostrate con le più recenti per prime per impostazione predefinita. Puoi anche ordinarle per valutazione più alta, valutazione più bassa o voti utili e filtrarle per stelle.',
    review_disclosure_dates:
      "Ogni recensione indica la data di pubblicazione e la data in cui l'acquirente ha ricevuto il prodotto.",
    review_disclosure_moderation:
      "Non modifichiamo le recensioni. Chiunque può segnalarne una: una segnalazione da sola non cambia nulla. Un moderatore può nascondere una recensione illecita o contraria ai nostri termini e l'autore viene sempre informato della decisione e delle motivazioni.",
    review_disclosure_retention:
      'Conserviamo le recensioni finché il prodotto rimane in vendita. Se un artigiano rimuove il prodotto o chiudi il tuo account, la recensione viene rimossa di conseguenza.',
    review_disclosure_no_payment:
      'Nessuno viene pagato o ricompensato per aver scritto una recensione e gli artigiani non possono pagare per farne rimuovere una.',
    terms_section_11_text:
      "Non è consentito utilizzare la Piattaforma per:\n\n- Pubblicare o vendere merci contraffatte, rubate, illegali o pericolose.\n- Pubblicare o vendere alimenti, bevande o qualsiasi altro prodotto destinato al consumo. Eurtisan non è predisposta per ospitare le informazioni su ingredienti, allergeni e origine richieste dalla legislazione alimentare dell'UE, in particolare il Regolamento (UE) n. 1169/2011, prima che sia effettuato l'acquisto.\n- Molestare, minacciare o discriminare altri utenti.\n- Eludere le commissioni o le norme della Piattaforma.\n- Compiere attività fraudolente.\n- Caricare codice dannoso o interferire con la sicurezza della Piattaforma.\n- Violare diritti di proprietà intellettuale.\n- Raccogliere dati personali di altri utenti senza consenso.",
    terms_section_16_text:
      "Per domande su questi Termini, contattaci all'indirizzo {email}. Per segnalare contenuti illegali ai sensi dell'Articolo 16 del DSA, utilizza l'azione di segnalazione su un'inserzione o un negozio. Registriamo la segnalazione e ti comunichiamo la decisione.",
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      "Questa fattura rappresenta la commissione della piattaforma addebitata da {operator} all'artigiano. Gli importi vengono regolati automaticamente tramite transazioni di pagamento frazionato.",
  },
  lt: {
    trader_status_trader: 'Šis pardavėjas deklaravo, kad yra prekybininkas.',
    trader_status_non_trader: 'Šis pardavėjas deklaravo, kad nėra prekybininkas.',
    trader_status_undeclared:
      'Šis pardavėjas nedeklaravo, ar yra prekybininkas. Pirkiniai negalimi, kol nepateikta deklaracija.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.lt,
    ranking_disclosure_title: 'Kaip rikiuojami rezultatai',
    ranking_disclosure_no_payment:
      'Pardavėjai negali mokėti už aukštesnę poziciją. Joks skelbimas „Eurtisan“ nėra remiamas ar reklamuojamas už užmokestį.',
    ranking_disclosure_category_body:
      'Produktai rodomi jūsų pasirinkta tvarka naudojant rikiavimo valdiklį. Pagal numatytuosius nustatymus naujausi skelbimai rodomi pirmi. Filtrai tik pašalina produktus iš sąrašo; jie niekada nekeičia likusiųjų tvarkos.',
    ranking_disclosure_search_body:
      'Atliekant paiešką, rezultatai rikiuojami pagal tai, kaip gerai jie atitinka jūsų žodžius, šia svarbos tvarka:',
    ranking_disclosure_search_1: 'Kiek jūsų paieškos žodžių atitinka skelbimas.',
    ranking_disclosure_search_2:
      'Žodžių rašybos tikslumas: skelbimas be rašybos klaidų rikiuojamas aukščiau už tą, kurį reikėjo taisyti.',
    ranking_disclosure_search_3: 'Kaip arti vienas kito jūsų žodžiai yra skelbime.',
    ranking_disclosure_search_4:
      'Kuri skelbimo dalis atitiko, šia tvarka: produkto pavadinimas, parduotuvės pavadinimas, kategorija, tada aprašymas.',
    ranking_disclosure_search_5: 'Jūsų pasirinktas rikiavimas, jei pakeitėte jį iš Tinkamumas.',
    ranking_disclosure_search_6: 'Ar atitiktis yra tiksli, o ne dalinė.',
    ranking_disclosure_search_7: 'Ar prekė yra sandėlyje: turimos prekės rodomos pirmos.',
    ranking_disclosure_search_8:
      'Produkto atsiliepimų įvertinimas, įvertintas pagal atsiliepimų skaičių, todėl gerai įvertintas produktas lenkia nepatikrintą.',
    ranking_disclosure_search_note:
      'Jūsų žodžiams taikomas rašybos taisymas ir sinonimai, atpažįstamos visos oficialios Europos Sąjungos kalbos. Naujumas sąmoningai nėra atsiliepimų balo dalis: tam naudokite rikiavimą Naujausi.',
    review_disclosure_title: 'Kaip tvarkome atsiliepimus',
    review_disclosure_verified_body:
      'Kiekvienas „Eurtisan“ atsiliepimas yra parašytas asmens, kuris čia įsigijo produktą. Tai automatiškai patikriname prieš leidžiant parašyti atsiliepimą:',
    review_disclosure_check_purchase:
      'Atsiliepimą pateikusio asmens paskyra pateikė užsakymą, kuriame yra produktas.',
    review_disclosure_check_delivered:
      'Užsakymas buvo pažymėtas kaip pristatytas ir nuo to laiko praėjo 14 dienų, tad atsiliepimas atspindi produkto naudojimą, o ne vien išpakavimą.',
    review_disclosure_check_once:
      'Vienas atsiliepimas apie produktą vienam užsakymui, todėl vienas pirkinys negali būti įvertintas du kartus.',
    review_disclosure_check_own: 'Kūrėjai negali vertinti produktų iš savo parduotuvės.',
    review_disclosure_order:
      'Atsiliepimai pagal numatytuosius nustatymus rodomi tvarka naujausi pirma. Taip pat galite juos rikiuoti pagal aukščiausias įvertinimas, žemiausias įvertinimas arba naudingi balsai ir filtruoti pagal žvaigždutes.',
    review_disclosure_dates:
      'Kiekviename atsiliepime nurodoma jo paskelbimo data ir data, kada pirkėjas gavo produktą.',
    review_disclosure_moderation:
      'Mes neredaguojame atsiliepimų. Kiekvienas gali pranešti apie atsiliepimą: vien pranešimas nieko nepakeičia. Moderatorius gali paslėpti neteisėtą ar sąlygas pažeidžiantį atsiliepimą, o autoriui visada pranešama apie sprendimą ir motyvus.',
    review_disclosure_retention:
      'Atsiliepimus saugome tol, kol produktas yra pateiktas prekybai. Jei kūrėjas pašalina produktą arba uždarote savo paskyrą, atsiliepimas pašalinamas kartu.',
    review_disclosure_no_payment:
      'Niekam nemokama ir neatlyginama už atsiliepimo rašymą, o kūrėjai negali sumokėti už atsiliepimo pašalinimą.',
    terms_section_11_text:
      'Negalite naudoti Platformos siekdami:\n\n- Skelbti ar parduoti suklastotas, vogtas, neteisėtas ar pavojingas prekes.\n- Skelbti ar parduoti maistą, gėrimus ar bet kokius kitus vartojimui skirtus produktus. „Eurtisan“ nėra pritaikyta pateikti informaciją apie sudedamąsias dalis, alergenus ir kilmę, kurią pagal ES maisto teisę, ypač Reglamentą (ES) Nr. 1169/2011, reikalaujama pateikti prieš perkant.\n- Priekabiauti, grasinti ar diskriminuoti kitus naudotojus.\n- Apeiti Platformos mokesčius ar taisykles.\n- Vykdyti sukčiavimo veiklą.\n- Įkelti kenkėjišką kodą ar trikdyti Platformos saugumą.\n- Pažeisti intelektinės nuosavybės teises.\n- Rinkti kitų naudotojų asmens duomenis be sutikimo.',
    terms_section_16_text:
      'Jei turite klausimų apie šias Sąlygas, susisiekite su mumis el. paštu {email}. Norėdami pranešti apie neteisėtą turinį pagal Skaitmeninių paslaugų akto (DSA) 16 straipsnį, naudokite pranešimo funkciją prie skelbimo ar parduotuvės. Mes užregistruojame pranešimą ir informuojame apie sprendimą.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Ši sąskaita faktūra atspindi platformos mokesčio komisinius, kuriuos {operator} taiko amatininkui. Sumos automatiškai apmokamos atliekant padalinto mokėjimo sandorius.',
  },
  lv: {
    trader_status_trader: 'Šis pārdevējs ir paziņojis, ka ir tirgotājs.',
    trader_status_non_trader: 'Šis pārdevējs ir paziņojis, ka nav tirgotājs.',
    trader_status_undeclared:
      'Šis pārdevējs nav paziņojis, vai ir tirgotājs. Pirkumi nav pieejami, kamēr nav sniegts paziņojums.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.lv,
    ranking_disclosure_title: 'Kā rezultāti tiek sakārtoti',
    ranking_disclosure_no_payment:
      'Pārdevēji nevar maksāt par augstāku vietu. Neviens sludinājums vietnē Eurtisan netiek sponsorēts vai reklamēts par samaksu.',
    ranking_disclosure_category_body:
      'Produkti tiek rādīti secībā, kuru izvēlaties ar kārtošanas vadīklu. Pēc noklusējuma jaunākie sludinājumi parādās vispirms. Filtri tikai noņem produktus no saraksta; tie nekad nemaina atlikušo produktu secību.',
    ranking_disclosure_search_body:
      'Meklējot rezultāti tiek sakārtoti pēc tā, cik labi tie atbilst jūsu vārdiem, šādā svarīguma secībā:',
    ranking_disclosure_search_1: 'Cik daudz jūsu meklēto vārdu ietver sludinājums.',
    ranking_disclosure_search_2:
      'Cik precīzi vārdi ir uzrakstīti: sludinājums bez drukas kļūdām tiek ierindots augstāk par to, kuram bija nepieciešams labojums.',
    ranking_disclosure_search_3: 'Cik tuvu cits citam jūsu vārdi atrodas sludinājumā.',
    ranking_disclosure_search_4:
      'Kura sludinājuma daļa atbilda, šādā secībā: produkta nosaukums, veikala nosaukums, kategorija, pēc tam apraksts.',
    ranking_disclosure_search_5: 'Jūsu izvēlētā kārtošana, ja mainījāt to no Atbilstība.',
    ranking_disclosure_search_6: 'Vai atbilstība ir precīza, nevis daļēja.',
    ranking_disclosure_search_7: 'Vai prece ir noliktavā: preces noliktavā parādās vispirms.',
    ranking_disclosure_search_8:
      'Produkta atsauksmju vērtējums, kas svērts pēc atsauksmju skaita, tādējādi labi novērtēts produkts pārspēj nepārbaudītu.',
    ranking_disclosure_search_note:
      'Jūsu vārdiem tiek piemērots pareizrakstības labojums un sinonīmi, un tiek atpazītas visas Eiropas Savienības oficiālās valodas. Aktualitāte apzināti nav daļa no atsauksmju rādītāja: šim nolūkam izmantojiet kārtošanu Jaunākie.',
    review_disclosure_title: 'Kā mēs apstrādājam atsauksmes',
    review_disclosure_verified_body:
      'Katra atsauksme vietnē Eurtisan nāk no pircēja, kurš šeit iegādājies produktu. Pirms atsauksmes rakstīšanas mēs to automātiski pārbaudām:',
    review_disclosure_check_purchase:
      'Atsauksmes autora konts veica pasūtījumu, kurā ietilpst produkts.',
    review_disclosure_check_delivered:
      'Pasūtījums tika atzīmēts kā piegādāts, un kopš tā laika ir pagājušas 14 dienas, tāpēc atsauksme atspoguļo produkta lietošanu, nevis tikai izpakošanu.',
    review_disclosure_check_once:
      'Viena atsauksme par produktu katrā pasūtījumā, lai vienu pirkumu nevarētu novērtēt divreiz.',
    review_disclosure_check_own: 'Amatnieki nevar novērtēt produktus no sava veikala.',
    review_disclosure_order:
      'Atsauksmes pēc noklusējuma tiek rādītas no jaunākie vispirms. Varat tās kārtot arī pēc augstākais vērtējums, zemākais vērtējums vai noderīgas balsis un filtrēt pēc zvaigznēm.',
    review_disclosure_dates:
      'Katrā atsauksmē ir norādīts tās publicēšanas datums un datums, kad pircējs saņēma preci.',
    review_disclosure_moderation:
      'Mēs nerediģējam atsauksmes. Ikviens var ziņot par atsauksmi: ziņojums pats par sevi neko nemaina. Moderators var paslēpt atsauksmi, kas ir nelikumīga vai pārkāpj mūsu noteikumus, un autoram vienmēr tiek paziņots lēmums un tā pamatojums.',
    review_disclosure_retention:
      'Mēs glabājam atsauksmes tik ilgi, kamēr produkts ir piedāvājumā. Ja amatnieks preci noņem vai jūs slēdzat kontu, atsauksme tiek dzēsta.',
    review_disclosure_no_payment:
      'Nevienam netiek maksāts vai piešķirtas atlīdzības par atsauksmes rakstīšanu, un amatnieki nevar maksāt par atsauksmes noņemšanu.',
    terms_section_11_text:
      'Jūs nedrīkstat izmantot Platformu, lai:\n\n- Piedāvātu vai pārdotu viltotas, zagtas, nelikumīgas vai bīstamas preces.\n- Piedāvātu vai pārdotu pārtiku, dzērienus vai citus patēriņam paredzētus produktus. Eurtisan nav pielāgots, lai sniegtu informāciju par sastāvdaļām, alergēniem un izcelsmi, ko pirms pirkuma veikšanas pieprasa ES pārtikas aprites tiesību akti, jo īpaši Regula (ES) Nr. 1169/2011.\n- Uzmāktos, draudētu vai diskriminētu citus lietotājus.\n- Apietu Platformas maksas vai noteikumus.\n- Veiktu krāpnieciskas darbības.\n- Augšupielādētu ļaunprātīgu kodu vai traucētu Platformas drošību.\n- Pārkāptu intelektuālā īpašuma tiesības.\n- Vāktu citu lietotāju personas datus bez piekrišanas.',
    terms_section_16_text:
      'Ja jums ir jautājumi par šiem Noteikumiem, lūdzu, sazinieties ar mums: {email}. Lai ziņotu par nelikumīgu saturu saskaņā ar Digitālo pakalpojumu akta (DSA) 16. pantu, izmantojiet ziņošanas funkciju pie sludinājuma vai veikala. Mēs reģistrējam paziņojumu un informējam par lēmumu.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Šis rēķins atspoguļo platformas maksas komisiju, ko {operator} iekasē no amatnieka. Summas tiek automātiski nokārtotas, izmantojot sadalīto maksājumu darījumus.',
  },
  mt: {
    trader_status_trader: 'Dan il-bejjiegħ iddikjara li huwa kummerċjant.',
    trader_status_non_trader: 'Dan il-bejjiegħ iddikjara li mhuwiex kummerċjant.',
    trader_status_undeclared:
      'Dan il-bejjiegħ ma ddikjarax jekk huwiex kummerċjant. Ix-xiri mhux disponibbli sakemm tiġi pprovduta d-dikjarazzjoni.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.mt,
    ranking_disclosure_title: 'Kif ir-riżultati jiġu ordnati',
    ranking_disclosure_no_payment:
      'Il-bejjiegħa ma jistgħux iħallsu għal pożizzjoni ogħla. L-ebda elenku fuq Eurtisan mhu sponsorjat jew promoss bi ħlas.',
    ranking_disclosure_category_body:
      "Il-prodotti jintwerew fl-ordni li tagħżel bil-kontroll tal-għażla. B'mod awtomatiku l-aktar reċenti listi jiġu l-ewwel. Il-filtri jneħħu biss prodotti mil-lista; qatt ma jibdlu l-ordni ta' dawk li jibqgħu.",
    ranking_disclosure_search_body:
      "Meta tfittex, ir-riżultati jiġu ordnati skont kemm jaqblu mal-kliem tiegħek, f'din l-ordni ta' importanza:",
    ranking_disclosure_search_1: "Kemm mill-kliem tat-tfittxija tiegħek jinsab f'elenku.",
    ranking_disclosure_search_2:
      "Kemm il-kliem huwa miktub b'mod preċiż: elenku mingħajr żbalji jikklassifika qabel wieħed li kellu bżonn korrezzjoni.",
    ranking_disclosure_search_3: 'Kemm il-kliem tiegħek jinsab qrib xulxin fl-elenku.',
    ranking_disclosure_search_4:
      "Liema parti tal-elenku qablet, f'din l-ordni: isem tal-prodott, isem tal-ħanut, kategorija, imbagħad deskrizzjoni.",
    ranking_disclosure_search_5: 'L-ordni li għażilt, jekk biddiltha minn Rilevanza.',
    ranking_disclosure_search_6: 'Jekk it-tqabbil huwiex eżatt minflok parzjali.',
    ranking_disclosure_search_7: 'Jekk il-prodott hux fl-istokk: prodotti fl-istokk jiġu l-ewwel.',
    ranking_disclosure_search_8:
      "Il-punteġġ tar-reviżjonijiet tal-prodott, peżat bin-numru ta' reviżjonijiet, sabiex prodott b'reviżjonijiet tajbin jikklassifika qabel wieħed mhux ippruvat.",
    ranking_disclosure_search_note:
      'Il-korrezzjoni tal-ortografija u sinonimi huma applikati għall-kliem tiegħek, u l-lingwi uffiċjali kollha tal-Unjoni Ewropea huma rikonoxxuti. Ir-reċenza deliberatament mhijiex parti mill-punteġġ tar-reviżjonijiet: uża l-għażla L-aktar reċenti għal dan.',
    review_disclosure_title: 'Kif nittrattaw ir-reviżjonijiet',
    review_disclosure_verified_body:
      "Kull reviżjoni fuq Eurtisan ġejja minn xi ħadd li xtara l-prodott hawnhekk. Aħna nivverifikaw dan awtomatikament qabel ma tkun tista' tinkiteb reviżjoni:",
    review_disclosure_check_purchase: 'Il-kont tar-reviżur għamel l-ordni li fiha l-prodott.',
    review_disclosure_check_delivered:
      'L-ordni ġiet immarkata bħala kkonsenjata u għaddew 14-il ġurnata minn dakinhar, biex ir-reviżjoni tirrifletti l-użu tal-prodott, mhux biss il-ftuħ tiegħu.',
    review_disclosure_check_once:
      "Reviżjoni waħda għal kull prodott għal kull ordni, sabiex xirja waħda ma tkunx tista' tiġi riveduta darbtejn.",
    review_disclosure_check_own:
      'L-artiġjani ma jistgħux jirrevedu prodotti mill-ħanut tagħhom stess.',
    review_disclosure_order:
      "Ir-reviżjonijiet jintwerew l-aktar reċenti l-ewwel b'mod awtomatiku. Tista' wkoll tordnahom skont l-ogħla klassifikazzjoni, l-inqas klassifikazzjoni jew voti utli u tiffiltrahom skont l-istilel.",
    review_disclosure_dates:
      'Kull reviżjoni turi d-data meta ġiet ippubblikata u d-data meta x-xerrej irċieva l-prodott.',
    review_disclosure_moderation:
      "Aħna ma neditjawx reviżjonijiet. Kulħadd jista' jirrapporta waħda: ir-rappurtar waħdu ma jibdel xejn. Moderatur jista' jaħbi reviżjoni li tkun illegali jew li tikser it-termini tagħna, u l-awtur dejjem jiġi infurmat b'dak li ġie deċiż u għaliex.",
    review_disclosure_retention:
      'Aħna nżommu r-reviżjonijiet sakemm il-prodott ikun elenkat. Jekk artiġjan ineħħi l-prodott jew tagħlaq il-kont tiegħek, ir-reviżjoni titneħħa miegħu.',
    review_disclosure_no_payment:
      'Ħadd ma jitħallas jew jiġi ppremjat talli jikteb reviżjoni, u l-artiġjani ma jistgħux iħallsu biex titneħħa waħda.',
    terms_section_11_text:
      "Ma tistax tuża l-Pjattaforma biex:\n\n- Telenka jew tbigħ oġġetti ffalsifikati, misruqa, illegali jew perikolużi.\n- Telenka jew tbigħ ikel, xorb jew kwalunkwe prodott ieħor maħsub għall-konsum. Eurtisan mhijiex mgħammra biex iġġorr l-informazzjoni dwar ingredjenti, allerġeni u oriġini li l-liġi tal-UE dwar l-ikel, b'mod partikolari r-Regolament (UE) Nru 1169/2011, teħtieġ qabel ma jsir xiri.\n- Tħabbat, thedded jew tiddiskrimina kontra utenti oħra.\n- Tevadi t-tariffi jew il-politiki tal-Pjattaforma.\n- Tieħu sehem f'attivitajiet qarrieqa.\n- Ttella' kodiċi malizzjuż jew tinterferixxi mas-sigurtà tal-Pjattaforma.\n- Tikser id-drittijiet tal-proprjetà intellettwali.\n- Tiġbor data personali ta' utenti oħra mingħajr kunsens.",
    terms_section_16_text:
      "Għal mistoqsijiet dwar dawn it-Termini, jekk jogħġbok ikkuntattjana fuq {email}. Biex tavżana dwar kontenut illegali taħt l-Artikolu 16 tad-DSA, uża l-azzjoni ta' rapport fuq prodott jew ħanut. Aħna nirreġistraw l-avviż u ninfurmawk bid-deċiżjoni.",
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      "Din il-fattura tirrappreżenta l-kummissjoni tat-tariffa tal-pjattaforma mitluba minn {operator} lill-artiġjan. L-ammonti jiġu saldati awtomatikament permezz ta' tranżazzjonijiet ta' ħlas maqsum.",
  },
  pl: {
    trader_status_trader: 'Ten sprzedawca oświadczył, że jest przedsiębiorcą.',
    trader_status_non_trader: 'Ten sprzedawca oświadczył, że nie jest przedsiębiorcą.',
    trader_status_undeclared:
      'Ten sprzedawca nie zadeklarował, czy jest przedsiębiorcą. Zakupy są niedostępne do momentu złożenia oświadczenia.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.pl,
    ranking_disclosure_title: 'Jak porządkowane są wyniki',
    ranking_disclosure_no_payment:
      'Sprzedawcy nie mogą zapłacić za wyższą pozycję. Żadna oferta na Eurtisan nie jest sponsorowana ani promowana za opłatą.',
    ranking_disclosure_category_body:
      'Produkty są wyświetlane w kolejności wybranej za pomocą sortowania. Domyślnie najnowsze oferty pojawiają się jako pierwsze. Filtry jedynie usuwają produkty z listy; nigdy nie zmieniają kolejności tych, które pozostają.',
    ranking_disclosure_search_body:
      'Podczas wyszukiwania wyniki są porządkowane według tego, jak dobrze pasują do Twoich słów, w następującej kolejności ważności:',
    ranking_disclosure_search_1: 'Ile ze słów wyszukiwania zawiera oferta.',
    ranking_disclosure_search_2:
      'Dokładność pisowni słów: oferta bez literówek plasuje się wyżej niż ta, która wymagała poprawki.',
    ranking_disclosure_search_3: 'Jak blisko siebie znajdują się Twoje słowa w ofercie.',
    ranking_disclosure_search_4:
      'Która część oferty pasuje, w następującej kolejności: nazwa produktu, nazwa sklepu, kategoria, a następnie opis.',
    ranking_disclosure_search_5: 'Wybrane sortowanie, jeśli zostało zmienione z Trafność.',
    ranking_disclosure_search_6: 'Czy dopasowanie jest dokładne, a nie częściowe.',
    ranking_disclosure_search_7:
      'Czy produkt jest dostępny: produkty w magazynie są wyświetlane w pierwszej kolejności.',
    ranking_disclosure_search_8:
      'Ocena produktu w opiniach, ważona liczbą opinii, dzięki czemu dobrze oceniony produkt wyprzedza niesprawdzony.',
    ranking_disclosure_search_note:
      'Korekta pisowni i synonimy są stosowane do Twoich słów, a wszystkie oficjalne języki Unii Europejskiej są rozpoznawane. Świeżość celowo nie jest częścią oceny opinii: użyj sortowania Najnowsze w tym celu.',
    review_disclosure_title: 'Jak postępujemy z opiniami',
    review_disclosure_verified_body:
      'Każda opinia na Eurtisan pochodzi od osoby, która kupiła produkt tutaj. Sprawdzamy to automatycznie, zanim opinia zostanie napisana:',
    review_disclosure_check_purchase: 'Konto recenzenta złożyło zamówienie zawierające produkt.',
    review_disclosure_check_delivered:
      'Zamówienie zostało oznaczone jako doręczone i minęło od tego momentu 14 dni, dzięki temu opinia odzwierciedla korzystanie z produktu, a nie tylko jego rozpakowanie.',
    review_disclosure_check_once:
      'Jedna opinia na produkt na zamówienie, więc pojedynczy zakup nie może być oceniony dwukrotnie.',
    review_disclosure_check_own: 'Twórcy nie mogą oceniać produktów z własnego sklepu.',
    review_disclosure_order:
      'Opinie są domyślnie wyświetlane od najnowsze jako pierwsze. Możesz je również uporządkować według najwyższa ocena, najniższa ocena lub pomocne głosy oraz filtrować według liczby gwiazdek.',
    review_disclosure_dates:
      'Każda opinia zawiera datę publikacji oraz datę otrzymania produktu przez kupującego.',
    review_disclosure_moderation:
      'Nie edytujemy opinii. Każdy może zgłosić opinię: samo zgłoszenie niczego nie zmienia. Moderator może ukryć opinię, która jest nielegalna lub narusza nasz regulamin, a autor jest zawsze informowany o decyzji i jej uzasadnieniu.',
    review_disclosure_retention:
      'Przechowujemy opinie tak długo, jak długo produkt jest wystawiony na sprzedaż. Jeśli twórca usunie produkt lub zamkniesz konto, opinia zostanie usunięta.',
    review_disclosure_no_payment:
      'Nikt nie otrzymuje wynagrodzenia ani nagród za napisanie opinii, a twórcy nie mogą zapłacić za jej usunięcie.',
    terms_section_11_text:
      'Nie wolno korzystać z Platformy w celu:\n\n- Wystawiania lub sprzedaży towarów podrobionych, kradzionych, nielegalnych lub niebezpiecznych.\n- Wystawiania lub sprzedaży żywności, napojów ani żadnych innych produktów przeznaczonych do spożycia. Eurtisan nie jest przystosowany do prezentowania informacji o składnikach, alergenach i pochodzeniu, których podania przed zakupem wymaga prawo żywnościowe UE, w szczególności Rozporządzenie (UE) nr 1169/2011.\n- Nękania, grożenia lub dyskryminowania innych użytkowników.\n- Omijania opłat lub zasad Platformy.\n- Prowadzenia działalności oszukańczej.\n- Wgrywania złośliwego kodu lub naruszania bezpieczeństwa Platformy.\n- Naruszania praw własności intelektualnej.\n- Gromadzenia danych osobowych innych użytkowników bez zgody.',
    terms_section_16_text:
      'W przypadku pytań dotyczących niniejszego Regulaminu prosimy o kontakt pod adresem {email}. Aby zgłosić nielegalne treści na mocy art. 16 aktu o usługach cyfrowych (DSA), skorzystaj z opcji zgłoszenia przy ofercie lub sklepie. Rejestrujemy zgłoszenie i informujemy o podjętej decyzji.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Niniejsza faktura stanowi prowizję z tytułu opłaty platformowej pobieraną przez {operator} od rzemieślnika. Kwoty są automatycznie rozliczane w ramach transakcji płatności dzielonej.',
  },
  pt: {
    trader_status_trader: 'Este vendedor declarou que é um comerciante.',
    trader_status_non_trader: 'Este vendedor declarou que não é um comerciante.',
    trader_status_undeclared:
      'Este vendedor não declarou se é um comerciante. As compras estão indisponíveis até que a declaração seja fornecida.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.pt,
    ranking_disclosure_title: 'Como os resultados são ordenados',
    ranking_disclosure_no_payment:
      'Os vendedores não podem pagar para obter uma classificação superior. Nenhum anúncio no Eurtisan é patrocinado ou promovido em troca de pagamento.',
    ranking_disclosure_category_body:
      'Os produtos são apresentados na ordem escolhida no controlo de ordenação. Por defeito, os anúncios mais recentes surgem primeiro. Os filtros apenas removem produtos da lista; nunca alteram a ordem dos restantes.',
    ranking_disclosure_search_body:
      'Ao pesquisar, os resultados são ordenados de acordo com a correspondência com as suas palavras, por esta ordem de importância:',
    ranking_disclosure_search_1: 'Quantas das suas palavras de pesquisa um anúncio contém.',
    ranking_disclosure_search_2:
      'O rigor ortográfico das palavras: um anúncio sem erros ortográficos classifica-se à frente de um que necessitou de correção.',
    ranking_disclosure_search_3: 'A proximidade das suas palavras entre si no anúncio.',
    ranking_disclosure_search_4:
      'Qual a parte do anúncio que correspondeu, pela seguinte ordem: nome do produto, nome da loja, categoria e depois descrição.',
    ranking_disclosure_search_5: 'A ordenação que escolheu, se a alterou a partir de Relevância.',
    ranking_disclosure_search_6: 'Se a correspondência é exata em vez de parcial.',
    ranking_disclosure_search_7:
      'Se o produto está em stock: os produtos em stock aparecem primeiro.',
    ranking_disclosure_search_8:
      'A pontuação de avaliações do produto, ponderada pelo número de avaliações, de modo que um produto bem avaliado supere um sem histórico.',
    ranking_disclosure_search_note:
      'A correção ortográfica e os sinónimos são aplicados às suas palavras e são reconhecidas todas as línguas oficiais da União Europeia. A atualidade não faz deliberadamente parte da pontuação de avaliação: utilize a ordenação Mais recentes para esse efeito.',
    review_disclosure_title: 'Como gerimos as avaliações',
    review_disclosure_verified_body:
      'Cada avaliação no Eurtisan provém de alguém que comprou o produto aqui. Verificamos isto automaticamente antes de uma avaliação poder ser escrita:',
    review_disclosure_check_purchase: 'A conta do avaliador fez a encomenda que contém o produto.',
    review_disclosure_check_delivered:
      'A encomenda foi marcada como entregue e passaram 14 dias desde então, para que a avaliação reflita a utilização do produto e não apenas a abertura da embalagem.',
    review_disclosure_check_once:
      'Uma avaliação por produto por encomenda, para que uma compra não possa ser avaliada duas vezes.',
    review_disclosure_check_own: 'Os artesãos não podem avaliar produtos da sua própria loja.',
    review_disclosure_order:
      'As avaliações são apresentadas com as mais recentes primeiro por defeito. Também pode ordená-las por classificação mais alta, classificação mais baixa ou votos úteis e filtrá-las por estrelas.',
    review_disclosure_dates:
      'Cada avaliação indica a data de publicação e a data em que o comprador recebeu o produto.',
    review_disclosure_moderation:
      'Não editamos avaliações. Qualquer pessoa pode denunciar uma avaliação: uma denúncia por si só não altera nada. Um moderador pode ocultar uma avaliação ilícita ou que viole os nossos termos, e o autor é sempre informado sobre a decisão e os motivos.',
    review_disclosure_retention:
      'Guardamos as avaliações enquanto o produto estiver listado. Se um artesão remover o produto ou se encerrar a sua conta, a avaliação é eliminada em conformidade.',
    review_disclosure_no_payment:
      'Ninguém é pago ou recompensado por escrever uma avaliação, e os artesãos não podem pagar para que uma seja removida.',
    terms_section_11_text:
      'Não pode utilizar a Plataforma para:\n\n- Listar ou vender artigos contrafeitos, roubados, ilegais ou perigosos.\n- Listar ou vender alimentos, bebidas ou qualquer outro produto destinado a consumo. O Eurtisan não está preparado para suportar as informações sobre ingredientes, alergénios e origem exigidas pela legislação alimentar da UE, em particular o Regulamento (UE) n.º 1169/2011, antes da realização da compra.\n- Assediar, ameaçar ou discriminar outros utilizadores.\n- Contornar ou tentar contornar taxas ou políticas da Plataforma.\n- Praticar atos fraudulentos.\n- Carregar código malicioso ou interferir com a segurança da Plataforma.\n- Violar direitos de propriedade intelectual.\n- Recolher dados pessoais de outros utilizadores sem consentimento.',
    terms_section_16_text:
      'Para dúvidas sobre estes Termos, contacte-nos através de {email}. Para nos notificar sobre conteúdos ilegais nos termos do Artigo 16 do Regulamento dos Serviços Digitais (DSA), utilize a opção de denúncia num anúncio ou loja. Registamos a notificação e informamos sobre a decisão tomada.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Esta fatura representa a comissão da taxa de plataforma cobrada por {operator} ao artesão. Os montantes são liquidados automaticamente através de transações de pagamento dividido.',
  },
  ro: {
    trader_status_trader: 'Acest vânzător a declarat că este un comerciant.',
    trader_status_non_trader: 'Acest vânzător a declarat că nu este un comerciant.',
    trader_status_undeclared:
      'Acest vânzător nu a declarat dacă este un comerciant. Achizițiile nu sunt disponibile până la furnizarea declarației.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.ro,
    ranking_disclosure_title: 'Cum sunt ordonate rezultatele',
    ranking_disclosure_no_payment:
      'Vânzătorii nu pot plăti pentru o poziție mai înaltă. Niciun anunț pe Eurtisan nu este sponsorizat sau promovat în schimbul unei plăți.',
    ranking_disclosure_category_body:
      'Produsele sunt afișate în ordinea pe care o alegeți cu ajutorul controlului de sortare. În mod prestabilit, cele mai noi anunțuri apar primele. Filtrele doar elimină produse din listă; nu modifică niciodată ordinea celor rămase.',
    ranking_disclosure_search_body:
      'Când căutați, rezultatele sunt ordonate în funcție de cât de bine se potrivesc cu cuvintele dvs., în această ordine de importanță:',
    ranking_disclosure_search_1: 'Câte dintre cuvintele dvs. de căutare conține un anunț.',
    ranking_disclosure_search_2:
      'Cât de corect sunt scrise cuvintele: un anunț fără greșeli de tipar este clasat înaintea unuia care a necesitat o corecție.',
    ranking_disclosure_search_3: 'Cât de aproape apar cuvintele dvs. unul de celălalt în anunț.',
    ranking_disclosure_search_4:
      'Ce parte a anunțului s-a potrivit, în această ordine: numele produsului, numele magazinului, categorie, apoi descriere.',
    ranking_disclosure_search_5: 'Sortarea aleasă de dvs., dacă ați schimbat-o din Relevanță.',
    ranking_disclosure_search_6: 'Dacă potrivirea este exactă și nu parțială.',
    ranking_disclosure_search_7:
      'Dacă produsul este în stoc: produsele din stoc sunt afișate primele.',
    ranking_disclosure_search_8:
      'Scorul recenziilor produsului, ponderat cu numărul de recenzii, astfel încât un produs bine evaluat să depășească unul fără istoric.',
    ranking_disclosure_search_note:
      'Corectarea ortografică și sinonimele se aplică cuvintelor dvs. și sunt recunoscute toate limbile oficiale ale Uniunii Europene. Noutatea nu face parte în mod deliberat din scorul recenziilor: utilizați sortarea Cele mai noi pentru aceasta.',
    review_disclosure_title: 'Cum gestionăm recenziile',
    review_disclosure_verified_body:
      'Fiecare recenzie de pe Eurtisan provine de la cineva care a cumpărat produsul de aici. Verificăm acest lucru automat înainte ca o recenzie să poată fi scrisă:',
    review_disclosure_check_purchase:
      'Contul recenzentului a plasat comanda care conține produsul.',
    review_disclosure_check_delivered:
      'Comanda a fost marcată ca livrată și au trecut 14 de zile de atunci, astfel încât recenzia să reflecte utilizarea produsului, nu doar despachetarea lui.',
    review_disclosure_check_once:
      'O singură recenzie per produs per comandă, astfel încât o achiziție unică să nu poată fi evaluată de două ori.',
    review_disclosure_check_own: 'Meșteșugarii nu pot evalua produse din propriul magazin.',
    review_disclosure_order:
      'Recenziile sunt afișate implicit cu cele mai noi primele. De asemenea, le puteți ordona după cea mai mare notă, cea mai mică notă sau voturi utile și le puteți filtra după stele.',
    review_disclosure_dates:
      'Fiecare recenzie indică data publicării și data la care cumpărătorul a primit produsul.',
    review_disclosure_moderation:
      'Nu edităm recenziile. Oricine poate raporta o recenzie: o simplă raportare nu schimbă nimic. Un moderator poate ascunde o recenzie ilegală sau care încalcă termenii noștri, iar autorul este întotdeauna informat despre decizie și motive.',
    review_disclosure_retention:
      'Păstrăm recenziile atâta timp cât produsul este listat. Dacă un meșteșugar retrage produsul sau vă închideți contul, recenzia este ștearsă.',
    review_disclosure_no_payment:
      'Nimeni nu este plătit sau recompensat pentru scrierea unei recenzii, iar meșteșugarii nu pot plăti pentru a elimina una.',
    terms_section_11_text:
      'Nu aveți voie să utilizați Platforma pentru a:\n\n- Lista sau vinde bunuri contrafăcute, furate, ilegale sau periculoase.\n- Lista sau vinde alimente, băuturi sau orice alt produs destinat consumului. Eurtisan nu este conceput pentru a include informațiile privind ingredientele, alergenii și originea cerute de legislația alimentară a UE, în special Regulamentul (UE) nr. 1169/2011, înainte de efectuarea achiziției.\n- Hărțui, amenința sau discrimina alți utilizatori.\n- Eluda sau încerca să eludați comisioanele sau politicile Platformei.\n- Desfășura activități frauduloase.\n- Încărca cod malițios sau interfera cu securitatea Platformei.\n- Încălca drepturile de proprietate intelectuală.\n- Colecta date cu caracter personal ale altor utilizatori fără consimțământ.',
    terms_section_16_text:
      'Pentru întrebări privind acești Termeni, vă rugăm să ne contactați la {email}. Pentru a notifica conținut ilegal în temeiul articolului 16 din Regulamentul privind serviciile digitale (DSA), utilizați opțiunea de raportare a unui anunț sau magazin. Înregistrăm notificarea și vă comunicăm decizia.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Această factură reprezintă comisionul de platformă perceput de {operator} meșteșugarului. Sumele sunt decontate automat prin tranzacții de plată divizată.',
  },
  sk: {
    trader_status_trader: 'Tento predajca vyhlásil, že je obchodníkom.',
    trader_status_non_trader: 'Tento predajca vyhlásil, že nie je obchodníkom.',
    trader_status_undeclared:
      'Tento predajca nevyhlásil, či je obchodníkom. Nákupy nie sú dostupné, kým nebude vyhlásenie poskytnuté.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.sk,
    ranking_disclosure_title: 'Ako sú zoradené výsledky',
    ranking_disclosure_no_payment:
      'Predajcovia nemôžu platiť za vyššie umiestnenie. Žiadna ponuka na Eurtisan nie je sponzorovaná ani propagovaná za platbu.',
    ranking_disclosure_category_body:
      'Produkty sa zobrazujú v poradí zvolenom pomocou radenia. V predvolenom nastavení sa najnovšie položky zobrazujú ako prvé. Filtre iba odstraňujú produkty zo zoznamu; nikdy nemenia poradie tých zostávajúcich.',
    ranking_disclosure_search_body:
      'Pri vyhľadávaní sa výsledky zoradia podľa toho, ako dobre zodpovedajú vašim slovám, v tomto poradí dôležitosti:',
    ranking_disclosure_search_1: 'Koľko z vašich hľadaných slov ponuka obsahuje.',
    ranking_disclosure_search_2:
      'Presnosť pravopisu slov: ponuka bez preklepov sa umiestni pred tou, ktorá vyžadovala opravu.',
    ranking_disclosure_search_3: 'Ako blízko pri sebe sa vaše slová v ponuke nachádzajú.',
    ranking_disclosure_search_4:
      'Ktorá časť ponuky sa zhodovala, v tomto poradí: názov produktu, názov obchodu, kategória, potom popis.',
    ranking_disclosure_search_5: 'Zvolené radenie, ak ste ho zmenili z Relevantnosť.',
    ranking_disclosure_search_6: 'Či je zhoda presná alebo čiastočná.',
    ranking_disclosure_search_7:
      'Či je produkt na sklade: produkty na sklade sa zobrazujú ako prvé.',
    ranking_disclosure_search_8:
      'Hodnotenie produktu v recenziách, vážené počtom recenzií, takže dobre hodnotený produkt predstihne neoverený.',
    ranking_disclosure_search_note:
      'Na vaše slová sa vzťahuje oprava pravopisu a synonymá a rozpoznávajú sa všetky úradné jazyky Európskej únie. Aktuálnosť zámerne nie je súčasťou hodnotenia recenzií: použite na to radenie Najnovšie.',
    review_disclosure_title: 'Ako zaobchádzame s recenziami',
    review_disclosure_verified_body:
      'Každá recenzia na Eurtisan pochádza od niekoho, kto si tu produkt kúpil. Toto automaticky kontrolujeme predtým, ako je možné recenziu napísať:',
    review_disclosure_check_purchase: 'Účet recenzenta zadal objednávku, ktorá obsahuje produkt.',
    review_disclosure_check_delivered:
      'Objednávka bola označená ako doručená a odvtedy uplynulo 14 dní – recenzia teda odráža skutočné používanie produktu, nielen jeho vybalenie.',
    review_disclosure_check_once:
      'Jedna recenzia na produkt na objednávku, takže jeden nákup nie je možné hodnotiť dvakrát.',
    review_disclosure_check_own: 'Tvorcovia nemôžu hodnotiť produkty z vlastného obchodu.',
    review_disclosure_order:
      'Recenzie sa v predvolenom nastavení zobrazujú od najnovšie ako prvé. Môžete ich tiež zoradiť podľa najvyššie hodnotenie, najnižšie hodnotenie alebo užitočné hlasy a filtrovať podľa hviezdičiek.',
    review_disclosure_dates:
      'Každá recenzia uvádza dátum jej zverejnenia a dátum, kedy kupujúci produkt prevzal.',
    review_disclosure_moderation:
      'Recenzie neupravujeme. Ktokoľvek môže nahlásiť recenziu: samotné nahlásenie nič nemení. Moderátor môže skryť recenziu, ktorá je nezákonná alebo porušuje naše podmienky, a autor je vždy informovaný o rozhodnutí a dôvodoch.',
    review_disclosure_retention:
      'Recenzie uchovávame po dobu, počas ktorej je produkt v ponuke. Ak tvorca produkt odstráni alebo zrušíte svoj účet, recenzia sa vymaže.',
    review_disclosure_no_payment:
      'Nikto nedostáva platbu ani odmenu za napísanie recenzie a tvorcovia nemôžu platiť za jej odstránenie.',
    terms_section_11_text:
      'Platformu nesmiete používať na:\n\n- Ponúkanie alebo predaj falšovaného, kradnutého, nelegálneho alebo nebezpečného tovaru.\n- Ponúkanie alebo predaj potravín, nápojov ani akýchkoľvek iných produktov určených na konzumáciu. Eurtisan nie je prispôsobený na uvádzanie informácií o zložkách, alergénoch a pôvode, ktoré potravinové právo EÚ, najmä nariadenie (EÚ) č. 1169/2011, vyžaduje zobraziť pred uskutočnením nákupu.\n- Obťažovanie, vyhrážanie sa alebo diskrimináciu iných používateľov.\n- Obchádzanie poplatkov alebo pravidiel platformy.\n- Podvodnú činnosť.\n- Nahrávanie škodlivého kódu alebo narúšanie bezpečnosti platformy.\n- Porušovanie práv duševného vlastníctva.\n- Zhromažďovanie osobných údajov iných používateľov bez súhlasu.',
    terms_section_16_text:
      'V prípade otázok k týmto podmienkam nás kontaktujte na adrese {email}. Na nahlásenie nezákonného obsahu podľa článku 16 nariadenia DSA použite funkciu nahlásenia pri ponuke alebo obchode. Oznámenie zaevidujeme a oznámime vám rozhodnutie.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Táto faktúra predstavuje províziu z poplatku platformy, ktorú účtuje {operator} remeselníkovi. Sumy sa automaticky vysporiadavajú prostredníctvom rozdelených platieb.',
  },
  sl: {
    trader_status_trader: 'Ta prodajalec je izjavil, da je trgovec.',
    trader_status_non_trader: 'Ta prodajalec je izjavil, da ni trgovec.',
    trader_status_undeclared:
      'Ta prodajalec ni izjavil, ali je trgovec. Nakupi niso na voljo, dokler ni predložena izjava.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.sl,
    ranking_disclosure_title: 'Kako so razvrščeni rezultati',
    ranking_disclosure_no_payment:
      'Prodajalci ne morejo plačati za višjo uvrstitev. Nobena ponudba na Eurtisanu ni sponzorirana ali promovirana v zameno za plačilo.',
    ranking_disclosure_category_body:
      'Izdelki so prikazani v vrstnem redu, ki ga izberete z možnostjo razvrščanja. Privzeto so najnovejše objave prikazane na prvem mestu. Filtri le odstranijo izdelke s seznama; nikoli ne spremenijo vrstnega reda preostalih.',
    ranking_disclosure_search_body:
      'Pri iskanju se rezultati razvrstijo glede na to, kako dobro se ujemajo z vašimi besedami, po naslednjem vrstnem redu pomembnosti:',
    ranking_disclosure_search_1: 'Koliko vaših iskalnih besed vsebuje ponudba.',
    ranking_disclosure_search_2:
      'Točnost črkovanja besed: ponudba brez tipkarskih napak se uvrsti pred tisto, ki je potrebovala popravek.',
    ranking_disclosure_search_3: 'Kako blizu skupaj so vaše besede v ponudbi.',
    ranking_disclosure_search_4:
      'Kateri del ponudbe se je ujemal, v naslednjem vrstnem redu: ime izdelka, ime trgovine, kategorija, nato opis.',
    ranking_disclosure_search_5:
      'Razvrstitev, ki ste jo izbrali, če ste jo spremenili glede na Ustreznost.',
    ranking_disclosure_search_6: 'Ali je ujem natančen ali le delen.',
    ranking_disclosure_search_7: 'Ali je izdelek na zalogi: izdelki na zalogi so prikazani prvi.',
    ranking_disclosure_search_8:
      'Ocena mnenj o izdelku, ponderirana s številom ocen, tako da dobro ocenjen izdelek prehiti nedokazanega.',
    ranking_disclosure_search_note:
      'Za vaše besede veljajo popravki črkovanja in sopomenke, prepoznani pa so vsi uradni jeziki Evropske unije. Časovna svežina namerno ni del ocene mnenj: za to uporabite razvrščanje Najnovejše.',
    review_disclosure_title: 'Kako ravnamo z mnenji',
    review_disclosure_verified_body:
      'Vsako mnenje na Eurtisanu prihaja od nekoga, ki je izdelek kupil tukaj. To samodejno preverimo, preden je mogoče napisati mnenje:',
    review_disclosure_check_purchase:
      'Z računom ocenjevalca je bilo oddano naročilo, ki vsebuje izdelek.',
    review_disclosure_check_delivered:
      'Naročilo je bilo označeno kot dostavljeno in od takrat je minilo 14 dni, tako da ocena odraža uporabo izdelka in ne le odpiranja paketa.',
    review_disclosure_check_once:
      'Eno mnenje na izdelek na naročilo, tako da posameznega nakupa ni mogoče oceniti dvakrat.',
    review_disclosure_check_own: 'Ustvarjalci ne morejo ocenjevati izdelkov iz svoje trgovine.',
    review_disclosure_order:
      'Mnenja so privzeto prikazana od najnovejše najprej. Razvrstite jih lahko tudi glede na najvišja ocena, najnižja ocena ali koristni glasovi ter filtrirate po zvezdicah.',
    review_disclosure_dates:
      'Vsako mnenje prikazuje datum objave in datum, ko je kupec prejel izdelek.',
    review_disclosure_moderation:
      'Mnenj ne urejamo. Vsakdo lahko prijavi mnenje: sama prijava ne spremeni ničesar. Moderator lahko skrije mnenje, ki je nezakonito ali krši naše pogoje, avtor pa je vedno obveščen o odločitvi in razlogih.',
    review_disclosure_retention:
      'Mnenja hranimo tako dolgo, dokler je izdelek v ponudbi. Če ustvarjalec izdelek odstrani ali zaprete svoj račun, se mnenje izbriše.',
    review_disclosure_no_payment:
      'Nihče ni plačan ali nagrajen za pisanje mnenja, ustvarjalci pa ne morejo plačati za odstranitev mnenja.',
    terms_section_11_text:
      'Platforme ne smete uporabljati za:\n\n- Ponujanje ali prodajo ponarejenega, ukradenega, nezakonitega ali nevarnega blaga.\n- Ponujanje ali prodajo hrane, pijače ali katerega koli drugega izdelka, namenjenega zaužitju. Eurtisan ni zasnovan za prikaz podatkov o sestavinah, alergenih in poreklu, ki jih zakonodaja EU o živilih, zlasti Uredba (EU) št. 1169/2011, zahteva pred nakupom.\n- Nadlegovanje, grožnje ali diskriminacijo drugih uporabnikov.\n- Izogibanje pristojbinam ali pravilom Platforme.\n- Goljufiva dejanja.\n- Nalaganje zlonamerne kode ali ogrožanje varnosti Platforme.\n- Kršenje pravic intelektualne lastnine.\n- Zbiranje osebnih podatkov drugih uporabnikov brez soglasja.',
    terms_section_16_text:
      'Za vprašanja o teh Pogojih se obrnite na nas prek {email}. Če želite prijaviti nezakonito vsebino po 16. členu Akta o digitalnih storitvah (DSA), uporabite možnost prijave pri ponudbi ali trgovini. Prijavo zabeležimo in vas obvestimo o odločitvi.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Ta račun predstavlja provizijo za storitve platforme, ki jo {operator} zaračuna obrtniku. Zneski se samodejno poravnajo prek deljenih plačilnih transakcij.',
  },
  sv: {
    trader_status_trader: 'Denna säljare har intygat att denne är en näringsidkare.',
    trader_status_non_trader: 'Denna säljare har intygat att denne inte är en näringsidkare.',
    trader_status_undeclared:
      'Denna säljare har inte angett om denne är en näringsidkare. Köp är inte tillgängliga förrän deklarationen har lämnats.',
    trader_status_non_trader_rights_notice: CRD_NON_TRADER_RIGHTS_NOTICE.sv,
    ranking_disclosure_title: 'Hur resultat ordnas',
    ranking_disclosure_no_payment:
      'Säljare kan inte betala för att rankas högre. Ingen annons på Eurtisan är sponsrad eller marknadsförd mot betalning.',
    ranking_disclosure_category_body:
      'Produkter visas i den ordning du väljer med sorteringskontrollen. Som standard visas de nyaste annonserna först. Filter tar bara bort produkter från listan; de ändrar aldrig ordningen på dem som är kvar.',
    ranking_disclosure_search_body:
      'När du söker ordnas resultaten efter hur väl de matchar dina ord, i denna prioritetsordning:',
    ranking_disclosure_search_1: 'Hur många av dina sökord en annons matchar.',
    ranking_disclosure_search_2:
      'Hur noggrant orden är stavade: en annons utan stavfel rankas högre än en som behövde korrigeras.',
    ranking_disclosure_search_3: 'Hur nära dina ord förekommer varandra i annonsen.',
    ranking_disclosure_search_4:
      'Vilken del av annonsen som matchade, i denna ordning: produktnamn, butiksnamn, kategori, sedan beskrivning.',
    ranking_disclosure_search_5: 'Den sortering du valde, om du ändrade den från Relevans.',
    ranking_disclosure_search_6: 'Huruvida matchningen är exakt snarare än partiell.',
    ranking_disclosure_search_7: 'Huruvida produkten finns i lager: produkter i lager visas först.',
    ranking_disclosure_search_8:
      'Produktens recensionsbetyg, vägt efter hur många recensioner som stödjer det, så att en välrecenserad produkt rankas före en oprövad.',
    ranking_disclosure_search_note:
      'Stavningskorrigering och synonymer tillämpas på dina ord, och alla officiella språk inom Europeiska unionen identifieras. Aktualitet är medvetet inte en del av recensionsbetyget: använd sorteringen Nyaste för det.',
    review_disclosure_title: 'Hur vi hanterar recensioner',
    review_disclosure_verified_body:
      'Varje recension på Eurtisan kommer från någon som har köpt produkten här. Vi kontrollerar detta automatiskt innan en recension kan skrivas:',
    review_disclosure_check_purchase:
      'Recensentens konto gjorde den beställning som innehåller produkten.',
    review_disclosure_check_delivered:
      'Beställningen markerades som levererad och 14 dagar har passerat sedan dess – så att recensionen speglar användningen av produkten, inte bara uppackningen.',
    review_disclosure_check_once:
      'En recension per produkt per beställning, så att ett enskilt köp inte kan recenseras två gånger.',
    review_disclosure_check_own: 'Skapare kan inte recensera produkter från sin egen butik.',
    review_disclosure_order:
      'Recensioner visas med nyaste först som standard. Du kan även sortera efter högsta betyg, lägsta betyg eller användbara röster och filtrera efter stjärnor.',
    review_disclosure_dates:
      'Varje recension visar datumet då den publicerades och datumet då köparen tog emot produkten.',
    review_disclosure_moderation:
      'Vi redigerar inte recensioner. Vem som helst kan anmäla en recension: en anmälan ensam ändrar ingenting. En moderator kan dölja en recension som är olaglig eller bryter mot våra villkor, och författaren meddelas alltid om beslutet och skälen.',
    review_disclosure_retention:
      'Vi behåller recensioner så länge produkten finns i sortimentet. Om en hantverkare tar bort produkten eller om du avslutar ditt konto försvinner recensionen.',
    review_disclosure_no_payment:
      'Ingen får betalt eller belönas för att skriva en recension, och skapare kan inte betala för att få en borttagen.',
    terms_section_11_text:
      'Du får inte använda plattformen för att:\n\n- Lägga upp eller sälja förfalskade, stulna, olagliga eller farliga varor.\n- Lägga upp eller sälja mat, dryck eller andra produkter avsedda för konsumtion. Eurtisan är inte anpassat för att tillhandahålla information om ingredienser, allergener och ursprung som EU:s livsmedelslagstiftning, särskilt förordning (EU) nr 1169/2011, kräver att annonser visar innan ett köp genomförs.\n- Trakassera, hota eller diskriminera andra användare.\n- Kringgå plattformsavgifter eller policyer.\n- Utföra bedrägliga handlingar.\n- Ladda upp skadlig kod eller störa plattformens säkerhet.\n- Göra intrång i immateriella rättigheter.\n- Samla in personuppgifter om andra användare utan samtycke.',
    terms_section_16_text:
      'För frågor om dessa villkor, kontakta oss på {email}. För att anmäla olagligt innehåll enligt artikel 16 i DSA använder du anmälningsåtgärden på en annons eller butik. Vi registrerar anmälan och meddelar dig beslutet.',
    legal_operator_name: 'Eurtisan',
    legal_contact_email: 'legal@eurtisan.eu',
    legal_vat_number: 'FR00000000000',
    invoice_disclosure_platform_fee_desc:
      'Denna faktura avser plattformsavgiften som debiteras av {operator} till hantverkaren. Beloppen regleras automatiskt via delade betalningstransaktioner.',
  },
}
