// terminology-management.ts

export type LangKey =
    | "en" | "de" | "es" | "nl" | "it" | "fr" | "pl" | "ru" | "he" | "zh" | "ar";

export type TerminologyMapRule = {
  forbidden: string;
  preferred: string;
  reason?: string;
  tags?: string[];
};

export type FewShotExample = {
  draft: string;
  polish: string;
  note?: string;
  tags?: string[];
};


export type TerminologyProfile = {
    // soft deterministic mapping - the model should obey but keep grammar/cases/gender/etc.
    mappings?: TerminologyMapRule[];

    // grammar/syntax fixes shown via examples (best for inflections and phrasing)
    examples?: FewShotExample[];
};

export type TerminologyManagement = Record<LangKey, TerminologyProfile>;

// Separation is absolute: each language has its own isolated profile.
// Everything is defined from English intent, but applied in target language output.
export const TERMINOLOGY_MANAGEMENT: TerminologyManagement = {
    en: {
        mappings: [
            { forbidden: "Free", preferred: "Complimentary", reason: "Hospitality standard phrasing." },
            { forbidden: "Reception", preferred: "Front Desk", reason: "Hospitality standard in EN-US." },
        ],
        examples: [
            {
                draft: "Yes, there is a pool.",
                polish: "Yes, the hotel offers a pool.",
                note: "Avoid robotic 'There is'. Keep upscale tone.",
            },
        ],
    },

    es: { mappings: [

       { forbidden: "lo que garantiza asistencia en cualquier momento", preferred: "por lo que siempre hay personal disponible para ayudar", reason: "More natural service phrasing." },
      { forbidden: "facilita el acceso vertical", preferred: "facilita el acceso", reason: "Avoids technical wording that sounds translated." },
      { forbidden: "sirve a todos los pisos de alojamiento", preferred: "da acceso a todas las plantas donde se encuentran las habitaciones", reason: "More natural Spanish syntax." },
      { forbidden: "sigue medidas de sostenibilidad más amplias", preferred: "aplica otras medidas de sostenibilidad", reason: "Simpler and more idiomatic." },
      { forbidden: "set de café y té", preferred: "selección de café y té de cortesía", reason: "Less literal and more natural in hospitality copy." },
      { forbidden: "frigorífico minibar vacío", preferred: "minibar vacío", reason: "Cleaner and more natural." },
      { forbidden: "se suministran rápidamente", preferred: "están disponibles previa solicitud", reason: "More standard hotel phrasing." },
      { forbidden: "dispensados a granel", preferred: "en dispensadores", reason: "Avoids regulatory tone." },
      { forbidden: "favorecen un ambiente silencioso", preferred: "ayudan a crear un ambiente más tranquilo", reason: "More natural and guest-friendly." },
      { forbidden: "caja fuerte electrónica de tamaño para portátil", preferred: "caja fuerte electrónica con espacio para portátil", reason: "Better flow in Spanish." },
      { forbidden: "proporciona café y té de cortesía las 24 horas", preferred: "hay una estación de autoservicio con café y té gratuitos disponible las 24 horas", reason: "More natural structure." },
      { forbidden: "sección apta para niños", preferred: "opciones para niños", reason: "More natural in food and buffet context." },
      { forbidden: "para acomodar a los comensales más pequeños", preferred: "para los más pequeños", reason: "Avoids literal translation." },
      { forbidden: "combinan el alojamiento con el desayuno bufé diario", preferred: "incluyen el alojamiento y el desayuno bufé diario", reason: "Cleaner and simpler." },
      { forbidden: "gastos imprevistos", preferred: "posibles gastos imprevistos", reason: "Softer hospitality phrasing." },
      { forbidden: "sujetas a disponibilidad y a un cargo nominal", preferred: "sujetas a disponibilidad y a un cargo adicional reducido", reason: "Nominal sounds translated and vague." },
      { forbidden: "consigna de equipaje segura", preferred: "consigna de equipaje", reason: "Secure is usually unnecessary unless operationally important." },
      { forbidden: "condiciones de cancelación distintas", preferred: "condiciones de cancelación diferentes", reason: "More standard and neutral." },
      { forbidden: "a un cómodo paseo de tres a cuatro minutos", preferred: "aproximadamente a tres o cuatro minutos a pie", reason: "Avoids promotional English-style phrasing." },
      { forbidden: "traslados puerta a puerta en shuttle", preferred: "traslados al aeropuerto, ya sea en shuttle o en servicio privado", reason: "More natural wording." },
      { forbidden: "servicios de taxi de confianza", preferred: "servicios de taxi fiables", reason: "Better collocation in Spanish." },
      { forbidden: "rodean Leonardo Boutique Hotel Budapest M-Square", preferred: "se encuentran a pocos minutos a pie", reason: "Avoids awkward literal structure." },
      { forbidden: "se encuentran a menos de cinco minutos", preferred: "están a menos de cinco minutos a pie", reason: "More direct and natural." },
      { forbidden: "organiza con gusto", preferred: "puede organizar", reason: "More neutral and professional." },
      { forbidden: "recorridos a pie guiados profesionalmente", preferred: "visitas guiadas a pie", reason: "Less artificial." },
      { forbidden: "asesora a los huéspedes sobre dónde y cómo adquirirlas de forma independiente", preferred: "puede indicar a los huéspedes dónde y cómo comprarlas", reason: "Simpler and more natural." },
      { forbidden: "gestiona con facilidad entradas programadas", preferred: "puede ayudar a reservar entradas con horario", reason: "Natural wording for ticket booking." },
      { forbidden: "itinerarios autoguiados", preferred: "itinerarios para visitar la ciudad por cuenta propia", reason: "Autoguiado is understandable but sometimes stiff; use when a softer tone is preferred." },
      { forbidden: "hotel totalmente para no fumadores", preferred: "hotel para no fumadores", reason: "Shorter and more natural." },
      { forbidden: "todo el establecimiento es libre de humo", preferred: "todo el hotel es para no fumadores", reason: "More idiomatic hospitality language." },
      { forbidden: "bajo ninguna circunstancia", preferred: "no está permitido fumar en el interior", reason: "Less dramatic and more natural." },
      { forbidden: "instalaciones accesibles para huéspedes con movilidad reducida", preferred: "instalaciones adaptadas para personas con movilidad reducida", reason: "Often more idiomatic depending on brand tone." },
      { forbidden: "usuarios de silla de ruedas", preferred: "personas en silla de ruedas", reason: "More natural and person-first wording." },
      { forbidden: "luminarias", preferred: "puntos de luz", reason: "Less technical for guest-facing copy." },
      { forbidden: "estación de metro y tranvía", preferred: "centro de conexiones de metro y tranvía", reason: "Use only if this transport hub meaning is explicit." },
      { forbidden: "a un suplemento", preferred: "por un suplemento", reason: "Correct collocation in Spanish." },
      { forbidden: "bajo petición", preferred: "previa solicitud", reason: "Use one standard form consistently, preferably 'previa solicitud' in hotel FAQs." },

      {
  forbidden: "Grammar mismatch after term replacement",
  preferred: "Gender and number agreement",
  reason: "In Spanish, if a term is replaced (e.g., 'propiedad' to 'hotel'), you must update the surrounding articles (el/la) and adjectives to match the new gender (masculine/feminine). Always ensure 'el hotel' or 'las instalaciones' instead of keeping feminine articles for masculine nouns."
},
    {
      forbidden: "propiedad",
      preferred: "hotel / establecimiento / instalaciones",
      reason: "While 'property' is standard in English hospitality, 'propiedad' in Spanish sounds overly legal or related to real estate. 'Hotel' or 'Instalaciones' is much warmer."
    },
    {
      forbidden: "debe efectuarse antes de / debe realizarse",
      preferred: "es hasta las / se hace antes de",
      reason: "Verbs like 'efectuarse' sound like a formal contract. 'El check-out es hasta las 12:00' is friendlier and matches how people actually speak."
    },
    {
      forbidden: "facilidades para preparar café y té",
      preferred: "set de café y té / hervidor de agua",
      reason: "'Facilidades' is a false friend (anglicism). In Spanish, it refers to 'ease'. For amenities, use 'set', 'kit', or the specific equipment name."
    },
    {
      forbidden: "bolsa de desayuno",
      preferred: "desayuno para llevar / picnic de desayuno",
      reason: "Literal translation of 'breakfast bag'. 'Desayuno para llevar' is the standard term used by travelers and hotel staff."
    },
    {
      forbidden: "cash-free",
      preferred: "no acepta efectivo / solo pagos con tarjeta",
      reason: "'No acepta efectivo' is more direct and natural for a traveler than the corporate buzzword 'cash-free'."
    },
    {
      forbidden: "cortinas opacas",
      preferred: "cortinas blackout / cortinas de oscurecimiento",
      reason: "'Blackout' is the widely accepted industry standard in Spanish-speaking markets to guarantee total darkness."
    },
    {
      forbidden: "cargo moderado / cargo suplementario",
      preferred: "suplemento / pequeño coste adicional",
      reason: "'Suplemento' is the precise professional term for extra hotel fees. 'Cargo moderado' feels like an unnatural literal translation."
    },
    {
      forbidden: "acceso sin escalones",
      preferred: "acceso para personas con movilidad reducida / accesible",
      reason: "'Sin escalones' is a literal translation. The professional term is 'accesibilidad' or 'movilidad reducida'."
    },
    {
      forbidden: "tomar prestados paraguas",
      preferred: "servicio de préstamo de paraguas / paraguas de cortesía",
      reason: "'Tomar prestado' sounds slightly informal or childish. 'Servicio de préstamo' is professional, and 'de cortesía' adds a touch of hospitality."
    },
    {
      forbidden: "proyecta / transmite eventos deportivos",
      preferred: "televisa los partidos / pone los deportes",
      reason: "Guests don't ask about 'broadcasting events'; they ask if the bar 'puts the match on' (pone el partido)."
    },
    {
      forbidden: "identificación oficial con fotografía",
      preferred: "DNI o pasaporte / identificación vigente",
      reason: "Replaced bureaucratic language with terms guests actually use for their ID."
    },
    {
      forbidden: "¿Se da la bienvenida a los niños...?",
      preferred: "¿El hotel es apto para niños? / ¿Se admiten niños...?",
      reason: "'Se da la bienvenida' is a literal translation of 'welcome'. In Spanish, it's more natural to ask about suitability or permission."
    },
      {
        forbidden: "todo el establecimiento es libre de humo",
        preferred: "todo el hotel es para no fumadores",
        reason: "More natural hospitality phrasing."
      },
      {
        forbidden: "estará encantado de ayudar",
        preferred: "puede ayudar",
        reason: "Avoids scripted customer-service tone translated from English."
      },
      {
        forbidden: "para garantizar el confort durante todo el año",
        preferred: "para mayor comodidad durante todo el año",
        reason: "Softer and more natural in Spanish."
      },
      {
        forbidden: "para refrescar habitaciones y baños durante toda la estancia",
        preferred: "durante toda la estancia",
        reason: "Avoids literal translation of 'refresh rooms and bathrooms'."
      },
      {
        forbidden: "caja fuerte electrónica con tamaño para portátil",
        preferred: "caja fuerte electrónica con espacio para portátil",
        reason: "Correct and more idiomatic phrasing."
      },
      {
        forbidden: "servicio de taxi de confianza",
        preferred: "servicio de taxi fiable",
        reason: "Better collocation in Spanish."
      },
      {
        forbidden: "salas dedicadas",
        preferred: "salas para eventos",
        reason: "Avoids literal translation of 'dedicated rooms'."
      },
      {
        forbidden: "mostrador de tours",
        preferred: "servicio de asistencia para excursiones y entradas",
        reason: "Sounds more natural and professional in hotel FAQs."
      },
      {
        forbidden: "áreas para huéspedes",
        preferred: "zonas para huéspedes",
        reason: "More natural choice in Spanish."
      },
      {
        forbidden: "gestionar llegadas, salidas y consultas",
        preferred: "atender llegadas, salidas y consultas",
        reason: "More natural operational wording."
      },
      {
        forbidden: "a unos 2 km, aproximadamente 15 minutos a pie",
        preferred: "a unos 2 km, a unos 15 minutos a pie",
        reason: "Cleaner rhythm and more natural phrasing."
      },
      {
        forbidden: "desde el vestíbulo",
        preferred: "desde el hotel",
        reason: "Usually more natural unless the lobby itself is specifically relevant."
      },
      {
        forbidden: "deberán organizar transporte privado por su cuenta",
        preferred: "deberán organizar su traslado por su cuenta",
        reason: "Smoother and less repetitive."
      },
      {
        forbidden: "in situ",
        preferred: "en las instalaciones",
        reason: "More standard and user-friendly wording."
      },
      {
        forbidden: "área de estacionamiento cerrada",
        preferred: "zona de aparcamiento cerrada",
        reason: "Keeps vocabulary consistent in European Spanish."
      },
      {
        forbidden: "a un radio de una milla",
        preferred: "en un radio de una milla",
        reason: "Correct preposition in Spanish."
      },
      {
        forbidden: "se alcanzan en unos 10 minutos",
        preferred: "se puede llegar en unos 10 minutos",
        reason: "More natural spoken and written Spanish."
      },
      {
        forbidden: "sala de fitness gratuita",
        preferred: "gimnasio gratuito",
        reason: "Simpler and more natural unless brand tone prefers 'fitness'."
      },
      {
        forbidden: "máquinas de cardio y musculación",
        preferred: "máquinas de cardio y musculación modernas",
        reason: "Natural adjective placement for hotel descriptions."
      },
      {
        forbidden: "los vestuarios se ubican junto al gimnasio y la sauna",
        preferred: "los vestuarios están junto al gimnasio y la sauna",
        reason: "Less formal and more natural."
      },
      {
        forbidden: "mantener reuniones",
        preferred: "reunirse",
        reason: "More concise and natural in guest-facing copy."
      },
      {
        forbidden: "salas de conferencias cuentan con",
        preferred: "salas de conferencias están equipadas con",
        reason: "More standard wording for facilities descriptions."
      },
      {
        forbidden: "cualquier asistencia que necesite",
        preferred: "cualquier ayuda que pueda necesitar",
        reason: "More natural and less translated from English."
      },
      {
        forbidden: "para un confort personalizado",
        preferred: "para mayor comodidad",
        reason: "Avoids literal translation of promotional English phrasing."
      },
      {
        forbidden: "facilidades para preparar café y té",
        preferred: "hervidor eléctrico con café y té de cortesía",
        reason: "Sounds more natural in hotel Spanish."
      },
      {
        forbidden: "pequeño refrigerador",
        preferred: "mininevera",
        reason: "More idiomatic in hospitality copy."
      },
      {
        forbidden: "para comer en la habitación",
        preferred: "servicio de habitaciones disponible",
        reason: "Avoids a literal and clunky repetition."
      },
      {
        forbidden: "se ofrecen traslados de pago al aeropuerto",
        preferred: "se ofrecen traslados al aeropuerto por un suplemento",
        reason: "Standard hotel phrasing in Spanish."
      },
      {
        forbidden: "el concierge",
        preferred: "la conserjería",
        reason: "More natural Spanish term."
      },
      {
        forbidden: "según se requiera",
        preferred: "bajo petición",
        reason: "Shorter and more idiomatic."
      },
      {
        forbidden: "asiste con el transporte",
        preferred: "puede ayudar a organizar transporte",
        reason: "More natural service wording."
      },
      {
        forbidden: "invita a los huéspedes a relajarse",
        preferred: "donde los huéspedes pueden relajarse",
        reason: "Less promotional and less translated."
      },
      {
        forbidden: "disfrutan de acceso gratuito",
        preferred: "tienen acceso gratuito",
        reason: "Simpler and more natural."
      },
      {
        forbidden: "otros idiomas",
        preferred: "otros idiomas adicionales",
        reason: "Useful when the sentence needs slightly fuller phrasing without sounding abrupt."
      },
      {
        forbidden: "en pleno centro de Bucarest",
        preferred: "en el centro de Bucarest",
        reason: "More neutral and less promotional."
      },
      {
        forbidden: "a aproximadamente 5,9 km del hotel",
        preferred: "a unos 5,9 km del hotel",
        reason: "Smoother and more natural rhythm."
      },
      {
        forbidden: "cuenta con un centro de negocios que ofrece",
        preferred: "dispone de un centro de negocios con",
        reason: "Cleaner and more concise structure."
      },
       {
        forbidden: "es completamente para no fumadores",
        preferred: "es para no fumadores",
        reason: "More natural and less repetitive in Spanish."
      },
      {
        forbidden: "colección lifestyle",
        preferred: "colección NYX Hotels de Leonardo Hotels",
        reason: "Avoid unnecessary English borrowing unless brand language requires it."
      },
      {
        forbidden: "mininevera abastecida",
        preferred: "minibar surtido",
        reason: "More idiomatic in hotel context."
      },
      {
        forbidden: "se facilitan en recepción bajo petición",
        preferred: "pueden solicitarse en recepción",
        reason: "Cleaner and more natural wording."
      },
      {
        forbidden: "se entregan rápidamente bajo petición",
        preferred: "están disponibles en la habitación o previa solicitud",
        reason: "Avoids translated service phrasing."
      },
      {
        forbidden: "las habitaciones que lo permiten",
        preferred: "según la categoría de habitación",
        reason: "More natural and clearer for hotel policies."
      },
      {
        forbidden: "incluyen servicio de limpieza diario",
        preferred: "cuentan con servicio de limpieza diario",
        reason: "More idiomatic in Spanish."
      },
      {
        forbidden: "con vistas al skyline",
        preferred: "con vistas panorámicas a la ciudad",
        reason: "Avoids English borrowing."
      },
      {
        forbidden: "bocados ligeros",
        preferred: "aperitivos ligeros",
        reason: "Standard hospitality wording."
      },
      {
        forbidden: "goza de una ubicación privilegiada",
        preferred: "está situado en",
        reason: "Less promotional and more FAQ-appropriate."
      },
      {
        forbidden: "impactantes obras",
        preferred: "obras de arte callejero local",
        reason: "Avoids marketing-heavy adjective choice."
      },
      {
        forbidden: "acoge periódicamente exposiciones comisariadas",
        preferred: "organiza periódicamente exposiciones de arte local",
        reason: "Simpler and more natural in hotel FAQ style."
      },
      {
        forbidden: "el hotel puede organizar traslados de pago",
        preferred: "el hotel puede organizar traslados por un suplemento",
        reason: "More standard hotel phrasing."
      },
      {
        forbidden: "a unos 50 m a pie",
        preferred: "a unos 50 m del hotel",
        reason: "Distance already implies location context, so avoid awkward wording."
      },
      {
        forbidden: "accesible a pie",
        preferred: "se puede llegar a pie",
        reason: "More natural phrasing in Spanish."
      },
      {
        forbidden: "sin cargo",
        preferred: "gratuito / gratuita",
        reason: "More natural and guest-friendly than administrative wording."
      },
      {
        forbidden: "tarifas calificadas",
        preferred: "tarifas elegibles",
        reason: "Corrects a literal translation of 'qualifying rates'."
      },
      {
        forbidden: "prestaciones adecuadas para sillas de ruedas",
        preferred: "adaptaciones para personas en silla de ruedas",
        reason: "More natural and human-centered phrasing."
      },
      {
        forbidden: "aislamiento acústico eficaz",
        preferred: "buen aislamiento acústico",
        reason: "Simpler and more idiomatic in hotel copy."
      },
      {
        forbidden: "de tamaño apto para ordenador portátil",
        preferred: "con espacio para portátil",
        reason: "Cleaner and more natural wording."
      },
      {
        forbidden: "provistos diariamente de exclusivos artículos de tocador",
        preferred: "incluyen artículos de aseo ... repuestos a diario",
        reason: "Avoids promotional and stiff phrasing."
      },
      {
        forbidden: "impuestos municipales no incluidos",
        preferred: "sin incluir la tasa turística",
        reason: "More precise and more natural for hotel pricing."
      },
      {
        forbidden: "recibe a los huéspedes",
        preferred: "está abierto",
        reason: "Avoids overly promotional language in factual FAQ content."
      },
      {
        forbidden: "conforme a la legislación francesa",
        preferred: "de acuerdo con la legislación francesa",
        reason: "Smoother and more standard phrasing."
      },
      {
        forbidden: "tarjeta-llave",
        preferred: "tarjeta de acceso",
        reason: "More natural term in Spanish."
      },
      {
        forbidden: "estaciones de cardio y fuerza",
        preferred: "máquinas de cardio y musculación",
        reason: "More idiomatic for gym facilities."
      },
      {
        forbidden: "de modo que se puede llegar a cualquier hora",
        preferred: "por lo que se puede llegar a cualquier hora",
        reason: "Slightly more natural sentence flow."
      },
      {
        forbidden: "domina inglés, francés, español e italiano",
        preferred: "habla inglés, francés, español e italiano",
        reason: "More natural in hotel FAQ tone."
      },
      {
        forbidden: "posee la certificación ecológica internacional Green Key",
        preferred: "cuenta con la certificación ecológica Green Key",
        reason: "Simpler and less heavy phrasing."
      },
      {
        forbidden: "en el establecimiento",
        preferred: "en el hotel",
        reason: "Often sounds more natural in guest-facing content, unless a formal tone is needed."
      }

    ], 
    examples: [
{
      draft: "¿Leonardo Hotel Almere City Center ofrece Wi-Fi gratuito en todo el hotel?",
      polish: "¿El hotel ofrece Wi-Fi gratuito en todas las instalaciones?",
      note: "Simplified brand name and improved flow."
    },
    {
      draft: "¿A qué hora es el check-out en Leonardo Hotel Almere City Center?",
      polish: "¿Hasta qué hora puedo hacer el check-out?",
      note: "Shifted focus to the guest's action for a more natural inquiry."
    },
    {
      draft: "¿Las habitaciones incluyen facilidades para preparar café y té?",
      polish: "¿Tienen las habitaciones hervidor de agua ו-set de café y té?",
      note: "Removed the anglicism 'facilidades'."
    },
    {
      draft: "¿Se exige un depósito de garantía al registrarse?",
      polish: "¿Hay que dejar fianza o depósito al llegar?",
      note: "Used common travel terms like 'fianza' instead of formal 'depósito de garantía'."
    },
    {
      draft: "¿Leonardo Boutique Museumhotel Amsterdam City Center es un establecimiento cash-free?",
      polish: "¿El hotel acepta pagos en efectivo?",
      note: "Replaced business jargon with a practical question about cash."
    },
    {
      draft: "¿Se da la bienvenida a los niños para comer en la Coffee Boutique?",
      polish: "¿Pueden los niños comer en la Coffee Boutique?",
      note: "Turned a stiff greeting into a natural question about permission."
    },
    {
      draft: "¿El sports bar transmite eventos deportivos en directo?",
      polish: "¿Ponen los partidos de fútbol o deportes en el bar?",
      note: "Used conversational language ('ponen los partidos') instead of technical terms."
    },
    {
      draft: "¿Hay un ascensor que ofrezca acceso sin escalones a todos los pisos?",
      polish: "¿Es el hotel accesible para personas con movilidad reducida a través de ascensor?",
      note: "Used professional hospitality terminology for accessibility."
    },
    {
      draft: "¿Leonardo Hotel Almere City Center ofrece una bolsa de desayuno para llevar?",
      polish: "¿Disponen de desayunos para llevar si salgo temprano?",
      note: "Used the natural 'desayuno para llevar' and added conversational context."
    },
    {
      draft: "¿Pueden los huéspedes tomar prestados paraguas?",
      polish: "¿Disponen de paraguas de cortesía para los días de lluvia?",
      note: "Polished the verb and added a hospitality touch ('de cortesía')."
    },
     {
        draft: "Sí, la recepción está abierta las 24 horas, lo que garantiza asistencia en cualquier momento.",
        polish: "Sí, la recepción está abierta las 24 horas, por lo que siempre hay personal disponible para ayudar.",
        note: "Reduced literal English structure and made the sentence sound more hotel-native."
      },
      {
        draft: "Sí, un ascensor para huéspedes sirve a todos los pisos de alojamiento y facilita el acceso vertical.",
        polish: "Sí, hay ascensor con acceso a todas las plantas donde se encuentran las habitaciones.",
        note: "Removed technical and literal phrasing."
      },
      {
        draft: "Sí, todo el establecimiento es libre de humo; no se permite fumar en interiores bajo ninguna circunstancia.",
        polish: "Sí, todo el hotel es para no fumadores y no está permitido fumar en el interior.",
        note: "More natural hospitality wording."
      },
      {
        draft: "Sí, el hotel utiliza bombillas LED en al menos el 80 % de sus luminarias y sigue medidas de sostenibilidad más amplias.",
        polish: "Sí, el hotel utiliza bombillas LED en al menos el 80 % de sus puntos de luz y aplica otras medidas de sostenibilidad.",
        note: "Avoided overly technical and translated wording."
      },
      {
        draft: "Sí, cada habitación dispone de una cafetera espresso, un hervidor eléctrico y un set de café y té de cortesía.",
        polish: "Sí, cada habitación dispone de cafetera espresso, hervidor eléctrico y una selección de café y té de cortesía.",
        note: "Removed the literal 'set de café y té'."
      },
      {
        draft: "No, las habitaciones disponen de un frigorífico minibar vacío que los huéspedes pueden surtir con sus propias compras.",
        polish: "No, las habitaciones disponen de un minibar vacío que los huéspedes pueden llenar con sus propias compras.",
        note: "Simplified and made it sound more natural."
      },
      {
        draft: "Sí, las planchas y tablas de planchar se suministran rápidamente previa solicitud del huésped.",
        polish: "Sí, las planchas y tablas de planchar están disponibles previa solicitud.",
        note: "Standard hotel phrasing is cleaner and more neutral."
      },
      {
        draft: "Sí, los baños cuentan con artículos de tocador con certificación ecológica dispensados a granel y modernas duchas tipo lluvia a ras de suelo.",
        polish: "Sí, los baños cuentan con artículos de aseo ecológicos en dispensadores y modernas duchas tipo lluvia a ras de suelo.",
        note: "Removed a phrase that sounded regulatory rather than guest-facing."
      },
      {
        draft: "Sí, las paredes insonorizadas y las ventanas con doble acristalamiento favorecen un ambiente silencioso en la habitación.",
        polish: "Sí, las paredes insonorizadas y las ventanas con doble acristalamiento ayudan a crear un ambiente más tranquilo en la habitación.",
        note: "More natural customer-facing tone."
      },
      {
        draft: "Sí, cada habitación cuenta con una caja fuerte electrónica de tamaño para portátil para el almacenamiento seguro de objetos personales.",
        polish: "Sí, cada habitación cuenta con una caja fuerte electrónica con espacio para guardar un portátil y otros objetos personales.",
        note: "Smoother and less translated."
      },
      {
        draft: "Sí, Leonardo Boutique Hotel Budapest M-Square ofrece diariamente un desayuno bufé caliente y frío en el restaurante.",
        polish: "Sí, el hotel sirve cada día un desayuno bufé con opciones frías y calientes en el restaurante.",
        note: "Shortened the hotel name and made the buffet description sound more natural."
      },
      {
        draft: "El desayuno se sirve cada mañana entre las 07:30 y las 10:30 para los huéspedes.",
        polish: "El desayuno se sirve cada mañana de 07:30 a 10:30.",
        note: "Removed unnecessary padding."
      },
      {
        draft: "Sí, una estación de autoservicio en el vestíbulo proporciona café y té de cortesía las 24 horas.",
        polish: "Sí, en el vestíbulo hay una estación de autoservicio con café y té gratuitos disponible las 24 horas.",
        note: "More natural Spanish information flow."
      },
      {
        draft: "Sí, el bufé incluye una selección adaptada para niños y tronas para acomodar a los comensales más pequeños.",
        polish: "Sí, el bufé incluye opciones para niños y tronas para los más pequeños.",
        note: "Reduced literal and awkward phrasing."
      },
      {
        draft: "Actualmente no dispone de snack bar; en su lugar, una nevera en el lobby ofrece agua, refrescos y bebidas alcohólicas para llevar.",
        polish: "Actualmente no dispone de snack bar. En su lugar, hay una nevera en el vestíbulo con agua, refrescos y bebidas alcohólicas para llevar.",
        note: "Standardized vocabulary to European Spanish."
      },
      {
        draft: "Sí, existen planes tarifarios flexibles que combinan el alojamiento con el desayuno bufé diario.",
        polish: "Sí, hay tarifas flexibles que incluyen el alojamiento y el desayuno bufé diario.",
        note: "More natural pricing language."
      },
      {
        draft: "No se admiten mascotas; sin embargo, los animales de asistencia certificados son bienvenidos sin recargo.",
        polish: "No se admiten mascotas. Sin embargo, los animales de asistencia certificados son bienvenidos sin coste adicional.",
        note: "Softer punctuation and more natural final phrase."
      },
      {
        draft: "Sí, al hacer el check-in se requiere una tarjeta de crédito válida o un depósito en efectivo para cubrir gastos imprevistos.",
        polish: "Sí, al hacer el check-in se requiere una tarjeta de crédito válida o un depósito en efectivo para cubrir posibles gastos imprevistos.",
        note: "Small tone refinement."
      },
      {
        draft: "Las reservas flexibles pueden cancelarse sin penalización hasta las 18:00 del día de llegada; las cancelaciones posteriores conllevan el cargo de una noche.",
        polish: "Las reservas flexibles pueden cancelarse sin penalización hasta las 18:00 del día de llegada. Después de esa hora, se cobra una noche.",
        note: "More natural sentence rhythm."
      },
      {
        draft: "Sí, la llegada anticipada o la salida tardía pueden organizarse con antelación, sujetas a disponibilidad y a un cargo nominal.",
        polish: "Sí, la llegada anticipada o la salida tardía pueden solicitarse con antelación, sujetas a disponibilidad y a un cargo adicional reducido.",
        note: "Request-based wording sounds more realistic in hotel operations."
      },
      {
        draft: "Sí, se ofrece gratuitamente consigna de equipaje segura tanto antes del check-in como después del check-out.",
        polish: "Sí, el hotel ofrece consigna de equipaje gratuita tanto antes del check-in como después del check-out.",
        note: "Natural hospitality phrasing."
      },
      {
        draft: "Las reservas de grupo de seis o más habitaciones están sujetas a un contrato específico, calendario de depósitos y condiciones de cancelación distintas.",
        polish: "Las reservas de grupo de seis o más habitaciones están sujetas a un contrato específico, un calendario de depósitos y condiciones de cancelación diferentes.",
        note: "Improved coordination and naturalness."
      },
      {
        draft: "Leonardo Boutique Hotel Budapest M-Square se encuentra en Madách Imre tér 2, a pocos pasos de Deák Ferenc tér.",
        polish: "El hotel está situado en Madách Imre tér 2, a pocos pasos de Deák Ferenc tér.",
        note: "Avoids repetitive use of the full hotel name."
      },
      {
        draft: "El hotel se encuentra a unos 260 metros, es decir, a un cómodo paseo de tres a cuatro minutos.",
        polish: "El hotel está a unos 260 metros, aproximadamente a tres o cuatro minutos a pie.",
        note: "Avoided promotional English-like phrasing."
      },
      {
        draft: "Sí, Leonardo Boutique Hotel Budapest M-Square organiza traslados puerta a puerta en shuttle o servicios privados por un suplemento.",
        polish: "Sí, el hotel puede organizar traslados al aeropuerto, ya sea en shuttle o en servicio privado, por un suplemento.",
        note: "More natural word order and better hospitality tone."
      },
      {
        draft: "Sí, la conserjería organiza alquileres de coches y servicios de taxi de confianza bajo petición.",
        polish: "Sí, la conserjería puede organizar alquiler de coches y servicios de taxi fiables bajo petición.",
        note: "Improved collocation and reduced translated feel."
      },
      {
        draft: "Lugares emblemáticos como la Sinagoga de la calle Dohány y la Basílica de San Esteban rodean Leonardo Boutique Hotel Budapest M-Square.",
        polish: "A pocos minutos a pie del hotel se encuentran lugares emblemáticos como la Sinagoga de la calle Dohány y la Basílica de San Esteban.",
        note: "Natural location description in Spanish."
      },
      {
        draft: "Las líneas de metro, tranvía y autobús de Deák Ferenc tér, así como la estación de metro Astoria, se encuentran a menos de cinco minutos.",
        polish: "Las líneas de metro, tranvía y autobús de Deák Ferenc tér, así como la estación de metro Astoria, están a menos de cinco minutos a pie.",
        note: "Added missing walking context and improved naturalness."
      },
      {
        draft: "Sí, se pueden alquilar bicicletas directamente en Leonardo Boutique Hotel Budapest M-Square para explorar la ciudad.",
        polish: "Sí, los huéspedes pueden alquilar bicicletas directamente en el hotel para recorrer la ciudad.",
        note: "Avoided repetitive hotel name and improved flow."
      },
      {
        draft: "Sí, la conserjería organiza con gusto recorridos a pie guiados profesionalmente que cubren los principales atractivos de la ciudad.",
        polish: "Sí, la conserjería puede organizar visitas guiadas a pie por los principales puntos de interés de la ciudad.",
        note: "Much more natural for Spanish hotel copy."
      },
      {
        draft: "No, la recepción no puede vender entradas; el personal solo asesora a los huéspedes sobre dónde y cómo adquirirlas de forma independiente.",
        polish: "No, la recepción no vende entradas, pero el personal puede indicar a los huéspedes dónde y cómo comprarlas.",
        note: "Simplified and removed literal explanatory wording."
      },
      {
        draft: "Sí, la conserjería gestiona con facilidad entradas programadas para baños termales populares como Széchenyi y Gellért.",
        polish: "Sí, la conserjería puede ayudar a reservar entradas con horario para baños termales populares como Széchenyi y Gellért.",
        note: "Corrected awkward literal translation of 'timed tickets'."
      },
      {
        draft: "Sí, en recepción se ofrecen gratuitamente mapas de la ciudad y sugerencias personalizadas de itinerarios autoguiados, previa solicitud.",
        polish: "Sí, en recepción se ofrecen gratuitamente mapas de la ciudad y sugerencias personalizadas para recorrerla por cuenta propia, previa solicitud.",
        note: "Softer and more natural than 'itinerarios autoguiados' in many hotel contexts."
      },
      {
        draft: "Sí, todo el establecimiento es libre de humo; no está permitido fumar en el interior.",
        polish: "Sí, todo el hotel es para no fumadores y no está permitido fumar en el interior.",
        note: "Replaced a literal phrase with a more natural hotel-style formulation."
      },
      {
        draft: "Sí, el personal de recepción habla varios idiomas y estará encantado de ayudar a los huéspedes internacionales.",
        polish: "Sí, el personal de recepción habla varios idiomas y puede ayudar a los huéspedes internacionales.",
        note: "Removed overly scripted hospitality phrasing."
      },
      {
        draft: "Sí, cada habitación dispone de aire acondicionado y calefacción con control individual para garantizar el confort durante todo el año.",
        polish: "Sí, cada habitación dispone de aire acondicionado y calefacción con control individual para mayor comodidad durante todo el año.",
        note: "Made the sentence sound less translated."
      },
      {
        draft: "Sí, se ofrece servicio de limpieza diario completo para refrescar habitaciones y baños durante toda la estancia.",
        polish: "Sí, se ofrece servicio de limpieza diario durante toda la estancia.",
        note: "Removed a literal translation that sounds unnatural in Spanish."
      },
      {
        draft: "Sí, cada habitación dispone de una caja fuerte electrónica con tamaño para portátil para guardar objetos de valor con seguridad.",
        polish: "Sí, cada habitación dispone de una caja fuerte electrónica con espacio para portátil y otros objetos de valor.",
        note: "Improved fluency and removed awkward wording."
      },
      {
        draft: "Sí, el equipo de conserjería estará encantado de reservar, previa solicitud, un traslado privado al aeropuerto o un servicio de taxi de confianza.",
        polish: "Sí, el equipo de conserjería puede organizar, previa solicitud, un traslado privado al aeropuerto o un servicio de taxi fiable.",
        note: "Reduced English-sounding service language."
      },
      {
        draft: "No, Leonardo Hotel Budapest no dispone de mostrador propio de alquiler de coches; el personal puede ayudar a reservar vehículos de alquiler externos para los huéspedes.",
        polish: "No, Leonardo Hotel Budapest no dispone de servicio propio de alquiler de coches, pero el personal puede ayudar a reservar vehículos con proveedores externos.",
        note: "More natural hotel wording than 'mostrador propio'."
      },
      {
        draft: "Sí, hay soportes de aparcamiento seguro para bicicletas dentro del área de estacionamiento cerrada de Leonardo Hotel Budapest.",
        polish: "Sí, hay aparcamiento seguro para bicicletas dentro de la zona de aparcamiento cerrada del hotel.",
        note: "Improved consistency and removed repetitive hotel naming."
      },
      {
        draft: "En un radio de una milla se encuentran: la calle Váci, el Gran Mercado Central, Corvin Plaza, la ribera del Danubio, la Sinagoga de la calle Dohány, el Centro Conmemorativo del Holocausto y MÜPA Budapest.",
        polish: "En un radio de una milla del hotel se encuentran la calle Váci, el Gran Mercado Central, Corvin Plaza, la ribera del Danubio, la Sinagoga de la calle Dohány, el Centro Conmemorativo del Holocausto y MÜPA Budapest.",
        note: "Smoothed punctuation and improved flow."
      },
      {
        draft: "Los Baños Termales Gellért están a unas 1,2 millas (unos 2 km) de Leonardo Hotel Budapest y se alcanzan en unos 10 minutos en taxi o tranvía.",
        polish: "Los Baños Termales Gellért están a unas 1,2 millas (unos 2 km) del hotel y se puede llegar en unos 10 minutos en taxi o tranvía.",
        note: "More natural verb choice and less repetition."
      },
      {
        draft: "Sí, Leonardo Hotel Budapest dispone de una sala de fitness gratuita equipada con modernas máquinas de cardio y musculación.",
        polish: "Sí, Leonardo Hotel Budapest dispone de un gimnasio gratuito equipado con máquinas de cardio y musculación modernas.",
        note: "More natural wording for hotel amenities."
      },
      {
        draft: "Sí, se proporcionan toallas de cortesía y los vestuarios se ubican junto al gimnasio y la sauna.",
        polish: "Sí, se proporcionan toallas de cortesía y los vestuarios están junto al gimnasio y la sauna.",
        note: "Less formal and more natural phrasing."
      },
      {
        draft: "Sí, la recepción de Leonardo Hotel Budapest cuenta con un mostrador de tours que gestiona la compra de entradas y excursiones guiadas.",
        polish: "Sí, la recepción de Leonardo Hotel Budapest ofrece un servicio de asistencia para reservar entradas y excursiones guiadas.",
        note: "Replaced 'mostrador de tours' with more idiomatic wording."
      },
      {
        draft: "Sí, Leonardo Hotel Budapest dispone de una terraza amueblada donde los huéspedes pueden disfrutar de un café, una bebida o mantener reuniones.",
        polish: "Sí, Leonardo Hotel Budapest dispone de una terraza amueblada donde los huéspedes pueden disfrutar de un café, una bebida o reunirse.",
        note: "Shorter and more natural ending."
      },
      {
        draft: "Sí, Leonardo Hotel Budapest organiza reuniones corporativas, jornadas de formación y recepciones sociales en salas dedicadas.",
        polish: "Sí, Leonardo Hotel Budapest organiza reuniones corporativas, jornadas de formación y recepciones sociales en salas para eventos.",
        note: "Avoided literal translation of 'dedicated rooms'."
      },
      {
        draft: "Sí, las salas de conferencias cuentan con tecnología audiovisual moderna y sistemas de proyección para presentaciones profesionales.",
        polish: "Sí, las salas de conferencias están equipadas con tecnología audiovisual moderna y sistemas de proyección para presentaciones profesionales.",
        note: "More standard wording for room features."
      },
      {
        draft: "Sí, la recepción está disponible las 24 horas para el check-in, los servicios de conserjería y cualquier asistencia que necesite.",
        polish: "Sí, la recepción está disponible las 24 horas para el check-in, los servicios de conserjería y cualquier ayuda que pueda necesitar.",
        note: "Replaced a literal phrase with a more natural service expression."
      },
      {
        draft: "Sí, cada habitación dispone de aire acondicionado y calefacción con control individual para un confort personalizado.",
        polish: "Sí, cada habitación dispone de aire acondicionado y calefacción con control individual para mayor comodidad.",
        note: "Removed a direct translation of marketing-style English."
      },
      {
        draft: "¿Se proporcionan facilidades para preparar café y té en las habitaciones de Leonardo Hotel Bucharest City Center?",
        polish: "¿Incluyen las habitaciones de Leonardo Hotel Bucharest City Center hervidor eléctrico con café y té de cortesía?",
        note: "Sounds more natural in hotel FAQ Spanish."
      },
      {
        draft: "¿Cada habitación de Leonardo Hotel Bucharest City Center incluye un minibar o pequeño refrigerador?",
        polish: "¿Cada habitación de Leonardo Hotel Bucharest City Center incluye minibar o mininevera?",
        note: "Replaced a clunky literal phrase with more idiomatic wording."
      },
      {
        draft: "Sí, el servicio de habitaciones está disponible para comer en la habitación.",
        polish: "Sí, hay servicio de habitaciones disponible.",
        note: "Simplified a repetitive sentence."
      },
      {
        draft: "Leonardo Hotel Bucharest City Center se encuentra a 14 km del Aeropuerto Henri Coandă; se ofrecen traslados de pago al aeropuerto.",
        polish: "Leonardo Hotel Bucharest City Center se encuentra a 14 km del Aeropuerto Henri Coandă y ofrece traslados al aeropuerto por un suplemento.",
        note: "More natural hospitality phrasing."
      },
      {
        draft: "¿Puede el concierge de Leonardo Hotel Bucharest City Center organizar servicios de taxi, alquiler de coches o limusina para los huéspedes?",
        polish: "¿Puede la conserjería de Leonardo Hotel Bucharest City Center organizar servicios de taxi, alquiler de coches o limusina para los huéspedes?",
        note: "Replaced English borrowing with natural Spanish."
      },
      {
        draft: "Sí, el concierge puede organizar taxis, alquiler de coches o servicio de limusina según se requiera.",
        polish: "Sí, la conserjería puede organizar taxis, alquiler de coches o servicio de limusina bajo petición.",
        note: "Improved tone and fluency."
      },
      {
        draft: "¿Leonardo Hotel Bucharest City Center asiste con el transporte a Romexpo u otros principales recintos de convenciones?",
        polish: "¿Puede Leonardo Hotel Bucharest City Center ayudar a organizar transporte a Romexpo u otros recintos de convenciones importantes?",
        note: "More natural question structure in Spanish."
      },
      {
        draft: "Sí, la terraza exterior invita a los huéspedes a relajarse con una bebida cuando el tiempo lo permite.",
        polish: "Sí, hay una terraza exterior donde los huéspedes pueden relajarse con una bebida cuando hace buen tiempo.",
        note: "Removed translated promotional wording."
      },
      {
        draft: "Sí, los huéspedes disfrutan de acceso gratuito al gimnasio de Leonardo Hotel Bucharest City Center, abierto diariamente de 08:00 a 22:00.",
        polish: "Sí, los huéspedes tienen acceso gratuito al gimnasio de Leonardo Hotel Bucharest City Center, abierto todos los días de 08:00 a 22:00.",
        note: "More direct and natural rhythm."
      },
      {
        draft: "Leonardo Hotel Bucharest City Center se encuentra en Calea Victoriei 166, Sector 1, en pleno centro de Bucarest.",
        polish: "Leonardo Hotel Bucharest City Center se encuentra en Calea Victoriei 166, Sector 1, en el centro de Bucarest.",
        note: "Less promotional, more neutral location phrasing."
      },
      {
        draft: "Sí, el personal puede ayudar a organizar transporte al centro de exposiciones Romexpo, situado a aproximadamente 5,9 km del hotel.",
        polish: "Sí, el personal puede ayudar a organizar transporte al centro de exposiciones Romexpo, situado a unos 5,9 km del hotel.",
        note: "Improved rhythm and readability."
      },
      {
        draft: "Sí, Leonardo Hotel Bucharest City Center cuenta con un centro de negocios que ofrece servicios de impresión, fotocopiado y otros.",
        polish: "Sí, Leonardo Hotel Bucharest City Center dispone de un centro de negocios con servicios de impresión, fotocopiado y otros.",
        note: "Cleaner and more compact structure."
      },
       {
        draft: "Sí, todo el hotel, incluidas habitaciones y zonas comunes, es completamente para no fumadores.",
        polish: "Sí, todo el hotel, incluidas las habitaciones y las zonas comunes, es para no fumadores.",
        note: "Removed unnatural emphasis and improved article usage."
      },
      {
        draft: "NYX Hotel Prague pertenece a la colección lifestyle NYX Hotels de Leonardo Hotels.",
        polish: "NYX Hotel Prague pertenece a la colección NYX Hotels de Leonardo Hotels.",
        note: "Avoided unnecessary English branding term in a FAQ answer."
      },
      {
        draft: "Sí, en todas las habitaciones se ofrece una mininevera abastecida para la comodidad del huésped.",
        polish: "Sí, todas las habitaciones disponen de minibar surtido para comodidad de los huéspedes.",
        note: "More natural and more hotel-like wording."
      },
      {
        draft: "Sí, cada baño dispone de un secador de pelo mural; los artículos de tocador prémium de cortesía se facilitan en recepción bajo petición.",
        polish: "Sí, cada baño dispone de un secador de pelo mural; los artículos de tocador prémium de cortesía pueden solicitarse en recepción.",
        note: "Simplified and improved fluency."
      },
      {
        draft: "Sí, la plancha y la tabla de planchar están disponibles en la habitación o se entregan rápidamente bajo petición.",
        polish: "Sí, la plancha y la tabla de planchar están disponibles en la habitación o previa solicitud.",
        note: "Removed wording that sounds translated from English."
      },
      {
        draft: "Sí, se ofrecen cunas sin cargo para las habitaciones que lo permiten, previa solicitud.",
        polish: "Sí, se ofrecen cunas sin cargo, según la categoría de habitación y previa solicitud.",
        note: "Much more natural policy phrasing."
      },
      {
        draft: "Sí, todas las habitaciones ocupadas incluyen servicio de limpieza diario.",
        polish: "Sí, todas las habitaciones ocupadas cuentan con servicio de limpieza diario.",
        note: "More idiomatic verb choice."
      },
      {
        draft: "La Heaven Suite, nuestra categoría superior, dispone de una terraza privada con mobiliario exterior y vistas al skyline, exclusiva para sus ocupantes.",
        polish: "La Heaven Suite, nuestra categoría superior, dispone de una terraza privada con mobiliario exterior y vistas panorámicas a la ciudad, exclusiva para sus ocupantes.",
        note: "Replaced English borrowing with natural Spanish."
      },
      {
        draft: "No, el hotel no cuenta con un restaurante completo; el bar solo ofrece bocados ligeros.",
        polish: "No, el hotel no cuenta con un restaurante completo; el bar solo ofrece aperitivos ligeros.",
        note: "Standard hospitality wording."
      },
      {
        draft: "El Aeropuerto Václav Havel se encuentra a unos 10 km de NYX Hotel Prague; el hotel puede organizar traslados de pago.",
        polish: "El Aeropuerto Václav Havel se encuentra a unos 10 km de NYX Hotel Prague; el hotel puede organizar traslados por un suplemento.",
        note: "More natural phrase for paid transfers."
      },
      {
        draft: "La estación de metro más cercana es Můstek, a unos 50 m a pie.",
        polish: "La estación de metro más cercana es Můstek, a unos 50 m del hotel.",
        note: "Avoided awkward walking phrase."
      },
      {
        draft: "Sí, la Estación Central de Praga (Hlavní nádraží) está a unos 450 m, accesible a pie.",
        polish: "Sí, la Estación Central de Praga (Hlavní nádraží) está a unos 450 m y se puede llegar a pie.",
        note: "More natural phrasing in Spanish."
      },
      {
        draft: "Sí, NYX Hotel Prague goza de una ubicación privilegiada en el distrito histórico del centro de Praga.",
        polish: "Sí, NYX Hotel Prague está situado en el centro histórico de Praga.",
        note: "Less promotional, more suitable for FAQ tone."
      },
      {
        draft: "Sí, impactantes obras de arte callejero local decoran los pasillos, el vestíbulo y las zonas lounge.",
        polish: "Sí, obras de arte callejero local decoran los pasillos, el vestíbulo y las zonas comunes.",
        note: "Removed overly promotional adjective and standardized vocabulary."
      },
      {
        draft: "Sí, el hotel acoge periódicamente exposiciones comisariadas que muestran obras de artistas locales contemporáneos.",
        polish: "Sí, el hotel organiza periódicamente exposiciones de arte local con obras de artistas contemporáneos.",
        note: "Smoother and more natural for general hotel communication."
      },
      {
        draft: "¿Ofrece el Leonardo Boutique Hotel Paris Opera Wi-Fi de alta velocidad sin cargo en todas sus instalaciones?",
        polish: "¿Ofrece Leonardo Boutique Hotel Paris Opera Wi-Fi de alta velocidad gratuito en todas sus instalaciones?",
        note: "Replaced administrative phrasing with a more natural hotel wording."
      },
      {
        draft: "Sí, los miembros de AdvantageCLUB acumulan puntos por cada estancia elegible reservada con tarifas calificadas.",
        polish: "Sí, los miembros de AdvantageCLUB acumulan puntos por cada estancia elegible reservada con tarifas elegibles.",
        note: "Corrected a literal translation of 'qualifying rates'."
      },
      {
        draft: "Sí, una habitación Comfort Triple adaptada ofrece acceso para personas con movilidad reducida y prestaciones adecuadas para sillas de ruedas.",
        polish: "Sí, una habitación Comfort Triple adaptada ofrece acceso para personas con movilidad reducida y adaptaciones para personas en silla de ruedas.",
        note: "More natural and human-centered accessibility wording."
      },
      {
        draft: "Sí, cada habitación dispone de control de temperatura individual y un aislamiento acústico eficaz para garantizar noches tranquilas.",
        polish: "Sí, cada habitación dispone de control de temperatura individual y buen aislamiento acústico para disfrutar de noches tranquilas.",
        note: "Softer and more idiomatic phrasing."
      },
      {
        draft: "Sí, en todas las categorías de habitación se ofrece una cafetera Nespresso junto con un set de café y té.",
        polish: "Sí, todas las categorías de habitación incluyen cafetera Nespresso y set de café y té.",
        note: "More compact and natural structure."
      },
      {
        draft: "Sí, los baños están provistos diariamente de exclusivos artículos de tocador L’Occitane para mayor comodidad de los huéspedes.",
        polish: "Sí, los baños incluyen artículos de aseo L’Occitane, repuestos a diario para comodidad de los huéspedes.",
        note: "Reduced overly promotional phrasing."
      },
      {
        draft: "Sí, cada habitación dispone de una caja fuerte de tamaño apto para ordenador portátil y otros objetos de valor.",
        polish: "Sí, cada habitación dispone de una caja fuerte con espacio para portátil y otros objetos de valor.",
        note: "More idiomatic and concise."
      },
      {
        draft: "Sí, cada mañana Leonardo Boutique Hotel Paris Opera sirve un generoso desayuno bufé con opciones calientes y frías en el establecimiento.",
        polish: "Sí, cada mañana Leonardo Boutique Hotel Paris Opera sirve un generoso desayuno bufé con opciones calientes y frías en el hotel.",
        note: "More natural guest-facing wording."
      },
      {
        draft: "El bufé diario cuesta 15 € por persona, impuestos municipales no incluidos.",
        polish: "El bufé diario cuesta 15 € por persona, sin incluir la tasa turística.",
        note: "Used the more precise and natural term for hotel tax."
      },
      {
        draft: "Sí, el acogedor bar del vestíbulo recibe a los huéspedes todos los días de 12:00 a 23:00.",
        polish: "Sí, el bar del vestíbulo está abierto todos los días de 12:00 a 23:00.",
        note: "Removed promotional wording and made the sentence more factual."
      },
      {
        draft: "Sí, es posible organizar una llegada anticipada o una salida tardía, sujeto a disponibilidad y con un suplemento.",
        polish: "Sí, es posible organizar una llegada anticipada o una salida tardía, sujeto a disponibilidad y por un suplemento.",
        note: "More standard collocation in Spanish."
      },
      {
        draft: "Sí, todas las zonas interiores y habitaciones son estrictamente libres de humo conforme a la legislación francesa.",
        polish: "Sí, todas las zonas interiores y habitaciones son estrictamente libres de humo, de acuerdo con la legislación francesa.",
        note: "Smoother and more natural legal phrasing."
      },
      {
        draft: "Sí, hay una sala de fitness bien equipada con estaciones de cardio y fuerza en el establecimiento.",
        polish: "Sí, hay una sala de fitness bien equipada con máquinas de cardio y musculación en el hotel.",
        note: "More idiomatic vocabulary for gym equipment."
      },
      {
        draft: "Sí, la sala de fitness está disponible para los huéspedes registrados las 24 horas mediante tarjeta-llave.",
        polish: "Sí, la sala de fitness está disponible para los huéspedes registrados las 24 horas mediante tarjeta de acceso.",
        note: "Replaced a mechanical calque with a more natural term."
      },
      {
        draft: "Sí, la conserjería puede organizar entradas de teatro, pases de museos y visitas guiadas por la ciudad de París.",
        polish: "Sí, la conserjería puede organizar entradas de teatro, pases para museos y visitas guiadas por París.",
        note: "Smoother rhythm and more natural phrasing."
      }


    ] },

    de: {
        mappings: [
            // === EXISTING MAPPINGS ===
            { forbidden: "Haus", preferred: "Hotel", reason: "Do not refer to the property as 'Haus'." },
            { forbidden: "Hausgäste", preferred: "Hotelgäste", reason: "Avoid 'Hausgäste'." },
            { forbidden: "in ca.", preferred: "in etwa", reason: "Prefer natural German." },
            { forbidden: "Ernährungswünsche", preferred: "Ernährungsbedürfnisse" },
            { forbidden: "eigenes Badezimmer", preferred: "en-suite Badezimmer", reason: "Keep 'en-suite' explicit." },
            { forbidden: "Familienreisende", preferred: "Familien", reason: "Natural German; avoid literal translation of 'family travelers'." },
            { forbidden: "Bügeleisen und brett", preferred: "Bügeleisen und Bügelbrett", reason: "Grammar fix." },
            { forbidden: "Gepäckaufbewahrungsregelung", preferred: "Gepäckaufbewahrung", reason: "Natural phrasing for guests." },
            { forbidden: "aufgeführt", preferred: "angeboten", reason: "Avoid saying 'listed'; act as the provider, not an observer." },
            { forbidden: "Wie lauten die regulären", preferred: "Wann sind die regulären", reason: "Avoid stiff template 'Wie lauten ...?'. Prefer natural 'Wann ...?'" },
            { forbidden: "Wie lautet die Stornierungsregelung", preferred: "Wie sind die Stornierungsbedingungen", reason: "More natural and standard phrasing in hotel FAQs." },
            { forbidden: "steht ... bereit", preferred: "steht ... zur Verfügung", reason: "Prefer standard hospitality phrasing." },
            { forbidden: "auf Wunsch", preferred: "auf Anfrage", reason: "Standard hospitality phrasing for requests." },

            // === NEW MAPPINGS — cover orphaned examples ===
            { forbidden: "Fitnessstudio", preferred: "Fitnessraum", reason: "Prefer hotel-typical 'Fitnessraum' unless official label is 'Fitnessstudio'." },
            { forbidden: "besitzt", preferred: "verfügt über", reason: "Prefer standard hospitality verb 'verfügt über' over 'besitzt'." },
            { forbidden: "mittags", preferred: "", reason: "Remove unnecessary 'mittags' after explicit time like '12:00 Uhr'. The time itself is clear." },
            { forbidden: "Same-Day", preferred: "am selben Tag", reason: "Avoid English terms in German. Use 'mit Rückgabe am selben Tag'." },
            { forbidden: "Mitarbeitenden", preferred: "Personal", reason: "Use 'das Personal' for natural hotel tone; avoids HR-style wording." },
            { forbidden: "Frühstücksangebote", preferred: "Frühstücksoptionen", reason: "More standard hotel phrasing." },
            { forbidden: "In-Room-Dining", preferred: "Zimmerservice", reason: "Use consistent German term; avoid mixed English." },
            { forbidden: "Room-Service", preferred: "Zimmerservice", reason: "Use consistent German term." },
            { forbidden: "engagiert", preferred: "", reason: "Avoid 'engagiert(e)' for reception. Rephrase to 'Rezeptionsteam steht ... zur Verfügung'." },
            { forbidden: "arrangiert", preferred: "bereitgestellt", reason: "Avoid 'arrangiert'; prefer 'bereitgestellt', 'eingerichtet', or 'nach vorheriger Absprache'." },
            { forbidden: "zu Fuß zurückgelegt werden", preferred: "zu Fuß zurücklegen", reason: "Prefer natural active 'lässt sich ... zurücklegen' over passive." },
            { forbidden: "Haustür", preferred: "Hotel", reason: "Avoid metaphorical 'von der Haustür'. Use factual 'vom Hotel'." },
            { forbidden: "durchgehend 24 Stunden", preferred: "rund um die Uhr", reason: "Prefer concise, natural 24/7 phrasing." },
            { forbidden: "Unterstützung gewährleistet", preferred: "steht zur Verfügung", reason: "Prefer guest-focused phrasing over generic 'Unterstützung gewährleistet'." },
            { forbidden: "Wie lautet", preferred: "Wie sind", reason: "Avoid stiff 'Wie lautet/lauten'; prefer natural question forms." },
            // === NEW MAPPINGS — uncovered issues from current DE output ===

{ 
  forbidden: "Early Check-in", 
  preferred: "früher Check-in", 
  reason: "Avoid English hospitality terms; use natural German phrasing." 
},
{
  forbidden: "(Italienisch, Russisch, Spanisch, Kroatisch)",
  preferred: "(Italienisch, Russisch, Spanisch und Kroatisch)",
  reason: "In Aufzählungen im Deutschen vor dem letzten Element 'und' verwenden (statt nur Kommas).",
},
{
  forbidden: "sorgen für Barrierefreiheit und Komfort für Gäste mit eingeschränkter Mobilität",
  preferred: "sorgen für einen barrierefreien und komfortablen Aufenthalt für Gäste mit eingeschränkter Mobilität",
  reason: "Natürlicher und idiomatischer im Hotelkontext, vermeidet das abstrakte Substantiv 'Barrierefreiheit' in dieser Satzstruktur.",
},
{
  forbidden: "Hallenschwimmbad",
  preferred: "Innenpool",
  reason: "Im Hotelkontext ist 'Innenpool' die gängigere Bezeichnung als 'Hallenschwimmbad'.",
},

{ 
  forbidden: "Late Check-out", 
  preferred: "später Check-out", 
  reason: "Avoid English hospitality terms; use natural German phrasing." 
},
{ 
  forbidden: "(Ortszeit)", 
  preferred: "", 
  reason: "Redundant after explicit times; standard hotel German omits it." 
},
{ 
  forbidden: "zu erfolgen", 
  preferred: "", 
  reason: "Overly bureaucratic phrasing; prefer natural forms like 'erfolgt bis'." 
},
{ 
  forbidden: "Anlage", 
  preferred: "Hotel", 
  reason: "Avoid property-style wording; 'Hotel' is the standard hospitality term." 
},
{ 
  forbidden: "Front-Office-Team", 
  preferred: "Rezeptionsteam", 
  reason: "Avoid Denglish; use standard German hotel terminology." 
},
{ 
  forbidden: "Front Office", 
  preferred: "Rezeption", 
  reason: "Avoid English terminology in German hotel copy." 
},
{ 
  forbidden: "Gym", 
  preferred: "Fitnessraum", 
  reason: "Avoid English; 'Fitnessraum' is the typical hotel term." 
},
{ 
  forbidden: "mehrsprachigen Service", 
  preferred: "mehrsprachige Unterstützung", 
  reason: "Avoid generic 'Service'; prefer guest-focused wording." 
},
{ 
  forbidden: " – ", 
  preferred: "-", 
  reason: "Avoid spaced en dashes in numeric ranges; use hyphen without spaces (e.g., 6-25)." 
},
{
  forbidden: "kostenlos",
  preferred: "kostenfrei",
  reason: "Preferred wording in upscale hotel communication."
},
{
  forbidden: "nur Frühstück",
  preferred: "ausschließlich Frühstück",
  reason: "Prefer more polished hospitality tone."
},
{
  forbidden: "warm-kaltes",
  preferred: "warmes und kaltes",
  reason: "Use natural coordinated adjectives in German."
},
{
  forbidden: "muss bis",
  preferred: "erfolgt bis",
  reason: "Avoid regulatory tone; prefer neutral hospitality phrasing."
},
{
  forbidden: "mehrsprachigen Service",
  preferred: "mehrsprachige Unterstützung",
  reason: "Avoid generic 'Service'; prefer natural guest-focused phrasing."
},
{
  forbidden: "Ortszeit",
  preferred: "",
  reason: "Redundant in hotel FAQs; local time is assumed."
},
{
  forbidden: "auf dem Gelände",
  preferred: "vor Ort",
  reason: "More natural hotel phrasing."
},
{
  forbidden: "viel Spaß bereiten",
  preferred: "zur Unterhaltung",
  reason: "Avoid overly colloquial phrases in marketing copy; use professional hospitality tone."
},
{
  forbidden: "Kaffee-und-Kuchen-Pause",
  preferred: "Kaffee- und Kuchenpause",
  reason: "Avoid excessive hyphenation (hyphen monsters) for better readability."
},
{
  forbidden: "nachmittägliche",
  preferred: "am Nachmittag",
  reason: "Avoid clunky adjectives like 'nachmittägliche'. Prefer adding 'am Nachmittag' at the end of the phrase."
}
        ],
        examples: [
            {
                draft: "Gibt es im Haus kostenloses WLAN?",
                polish: "Bietet das Hotel kostenloses WLAN?",
                note: "Avoid 'Haus'. Prefer natural verb like 'bietet'.",
            },
            {
                draft: "Ja, auf Wunsch bereitet das Restaurant vegetarische und vegane Speisen zu.",
                polish: "Ja, auf Anfrage bereitet das Restaurant vegetarische und vegane Gerichte zu.",
                note: "In dietary context, 'Gerichte' often sounds more natural than 'Speisen'. Keep 'auf Anfrage'.",
            },
            {
                draft: "Sind Familienreisende willkommen?",
                polish: "Sind Familien mit Kindern im Hotel herzlich willkommen?",
                note: "Avoid 'Familienreisende'. Use 'Familien mit Kindern' for a warmer tone.",
            },
            {
                draft: "Gibt es im Hotel ein Fitnessstudio?",
                polish: "Gibt es im Hotel einen Fitnessraum?",
                note: "Prefer the more hotel-typical term 'Fitnessraum' unless the official label is 'Fitnessstudio'.",
            },
            {
                draft: "Ja, Kinder dürfen in Begleitung von Erwachsenen die Bar betreten.",
                polish: "Ja, Kinder dürfen die Bar in Begleitung von Erwachsenen betreten.",
                note: "Better word order for natural German flow.",
            },
            {
                draft: "Es sind keine speziellen Kinderaktivitäten aufgeführt.",
                polish: "Nein, es werden derzeit keine speziellen Kinderaktivitäten angeboten.",
                note: "Never use 'not listed'. Speak as the hotel: 'not offered'.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt?",
                polish: "Gibt es im Hotel eine Gepäckaufbewahrung?",
                note: "Rephrase technical terms into natural guest questions.",
            },
            {
                draft: "Das Hotel bietet gegen Gebühr Parkplätze.",
                polish: "Das Hotel bietet Parkplätze direkt am Hotel gegen eine Gebühr an.",
                note: "Be precise about location (vor Ort / direkt am Hotel).",
            },
            {
                draft: "Verfügt jedes Zimmer im Leonardo Hotel Köln über einen Safe?",
                polish: "Gibt es in jedem Zimmer des Leonardo Hotel Köln einen Safe?",
                note: "Prefer direct 'Gibt es ...?' question form in FAQs.",
            },
            {
                draft: "Ja, das Hotel besitzt eine Bar für Gäste (in der Regel abends geöffnet).",
                polish: "Ja, das Hotel verfügt über eine Bar, die in der Regel abends geöffnet ist.",
                note: "Prefer 'verfügt über' and avoid parentheses-heavy phrasing.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt im {HOTEL_NAME} für frühe Ankünfte oder späte Abreisen?",
                polish: "Gibt es im {HOTEL_NAME} eine Gepäckaufbewahrung für frühe Ankünfte oder späte Abreisen?",
                note: "Avoid bureaucratic compounds; use a guest-friendly question form.",
            },
            {
                draft: "Serviert {HOTEL_NAME} Mittag- oder Abendessen und sind Reservierungen erforderlich?",
                polish: "Serviert {HOTEL_NAME} Abendessen, und sind Reservierungen erforderlich?",
                note: "Align the question to what the answer actually covers; do not add facts.",
            },
            {
                draft: "Die Rezeption ist durchgehend 24 Stunden am Tag besetzt.",
                polish: "Die Rezeption ist rund um die Uhr besetzt.",
                note: "Prefer concise, natural 24/7 phrasing; avoid redundancy.",
            },
            {
                draft: "Der Check-out erfolgt bis 12:00 Uhr mittags.",
                polish: "Der Check-out erfolgt bis 12:00 Uhr.",
                note: "Avoid unnecessary 'mittags' in standard time statements.",
            },
            {
                draft: "… steht ein Same-Day-Wäsche- und Trockenreinigungsservice zur Verfügung.",
                polish: "… steht ein Wäsche- und Trockenreinigungsservice mit Rückgabe am selben Tag zur Verfügung.",
                note: "Avoid English 'Same-Day' in German; use a natural equivalent.",
            },
            {
                draft: "Ja, die Rezeption ist rund um die Uhr besetzt, sodass jederzeit Unterstützung gewährleistet ist.",
                polish: "Ja, das Rezeptionsteam steht Hotelgästen rund um die Uhr für alle Anliegen zur Verfügung.",
                note: "Prefer the defined reception tone ('Rezeptionsteam ... zur Verfügung') over generic 'Unterstützung gewährleistet'. Keeps wording guest-focused and premium.",
            },
            {
                draft: "Ja, die Mitarbeitenden an der Rezeption sprechen Deutsch, Englisch sowie weitere Sprachen (Italienisch, Russisch, Spanisch, Kroatisch) und bieten damit einen mehrsprachigen Service.",
                polish: "Ja, das Personal an der Rezeption spricht Deutsch, Englisch sowie weitere Sprachen (Italienisch, Russisch, Spanisch, Kroatisch) und bietet damit einen mehrsprachigen Service.",
                note: "Use 'das Personal' for a more natural hotel tone; avoids HR-style wording while preserving meaning and formality.",
            },
            {
                draft: "Ja, Kinder sind herzlich willkommen; Babybetten, Familienzimmer und kinderfreundliche Frühstücksangebote stehen zur Verfügung.",
                polish: "Ja, Kinder sind herzlich willkommen; Babybetten, Familienzimmer und kinderfreundliche Frühstücksoptionen stehen zur Verfügung.",
                note: "Prefer the more standard hotel phrasing 'Frühstücksoptionen' over 'Frühstücksangebote' for a smoother native feel.",
            },
            {
                draft: "… da kein Room-Service oder In-Room-Dining betrieben wird.",
                polish: "… da kein Zimmerservice angeboten wird.",
                note: "Use one consistent German term; avoid mixed English terms.",
            },
            {
                draft: "Nein, Zimmerservice wird angeboten, steht jedoch nicht durchgehend zur Verfügung.",
                polish: "Nein, Zimmerservice wird angeboten, ist jedoch nicht rund um die Uhr verfügbar.",
                note: "Avoid internal contradiction; keep negation consistent and phrasing natural.",
            },
            {
                draft: "Wie lauten die regulären Check-in- und Check-out-Zeiten?",
                polish: "Wann sind die regulären Check-in- und Check-out-Zeiten?",
                note: "Avoid stiff template 'Wie lauten ...?'. Prefer 'Wann ...?'.",
            },
            {
                draft: "Verfügt das Hotel über einen Safe?",
                polish: "Gibt es im Zimmer einen Safe?",
                note: "Prefer direct 'Gibt es ...?' question form in FAQs.",
            },
            {
                draft: "Verfügt das Hotel über eine Bar vor Ort und wie sind deren Öffnungszeiten?",
                polish: "Gibt es im Hotel eine Bar vor Ort, und wie sind die Öffnungszeiten?",
                note: "Cleaner coordination; prefer 'Gibt es ...?' and avoid 'deren'.",
            },
            {
                draft: "… und kann die Strecke bequem zu Fuß zurückgelegt werden?",
                polish: "… und lässt sich die Strecke bequem zu Fuß zurücklegen?",
                note: "Prefer natural active phrasing over passive construction.",
            },
            {
                draft: "Ja, das engagierte Team an der Rezeption ist rund um die Uhr für alle Anliegen verfügbar.",
                polish: "Ja, das Rezeptionsteam steht Gästen rund um die Uhr für alle Anliegen zur Verfügung.",
                note: "Avoid 'engagiert(e)' for reception; use standard hospitality phrasing.",
            },
            {
                draft: "Steht im Hotel mehrsprachiges Personal zur Unterstützung internationaler Gäste zur Verfügung?",
                polish: "Steht im Hotel mehrsprachiges Personal zur Verfügung, um internationale Gäste zu unterstützen?",
                note: "Avoid repetition ('zur Unterstützung ... zur Verfügung'). Keep flow natural.",
            },
            {
                draft: "Ja, auf Wunsch stellt das Frühstücksteam glutenfreie Produkte bereit.",
                polish: "Ja, auf Anfrage stellt das Frühstücksteam glutenfreie Produkte bereit.",
                note: "Prefer 'auf Anfrage' over 'auf Wunsch' in hotel phrasing.",
            },
            {
                draft: "Berücksichtigt das Hotel vegetarische und vegane Ernährungswünsche?",
                polish: "Berücksichtigt das Hotel vegetarische und vegane Ernährungsbedürfnisse?",
                note: "Prefer 'Ernährungsbedürfnisse' for dietary needs.",
            },
            {
                draft: "Die Sehenswürdigkeit ist in ca. acht Minuten erreichbar.",
                polish: "Die Sehenswürdigkeit ist in etwa acht Minuten erreichbar.",
                note: "Prefer 'in etwa' over 'in ca.' in German prose.",
            },
            {
                draft: "Für größere Gruppen können reservierte Bereiche arrangiert werden.",
                polish: "Für größere Gruppen können reservierte Bereiche eingerichtet werden.",
                note: "Avoid 'arrangiert' here; prefer 'eingerichtet' or 'reserviert' depending on meaning.",
            },
            {
                draft: "Serviert das Hotel Mittag- und Abendessen, und sind Reservierungen erforderlich?",
                polish: "Serviert das Hotel Abendessen, und sind Reservierungen erforderlich?",
                note: "If the answer only covers dinner, align the question without adding facts.",
            },
            {
                draft: "Ja, der Busbahnhof liegt nur einen kurzen Spaziergang entfernt – weniger als fünf Gehminuten von der Haustür.",
                polish: "Ja, der Busbahnhof ist weniger als fünf Gehminuten vom Hotel entfernt.",
                note: "Prefer concise, factual phrasing; avoid metaphorical wording.",
            },
            {
                draft: "Nein, Zimmerservice wird angeboten, steht jedoch nicht durchgehend zur Verfügung.",
                polish: "Nein, Zimmerservice wird angeboten, ist jedoch nicht rund um die Uhr verfügbar.",
                note: "Avoid internal contradiction and keep negation consistent.",
            },
            {
                draft: "Der Check-in ist ab 15:00&nbsp;Uhr möglich; Check-out wird bis 11:00&nbsp;Uhr erbeten.",
                polish: "Der Check-in ist ab 15:00&nbsp;Uhr möglich; der Check-out erfolgt bis 11:00&nbsp;Uhr.",
                note: "Keep HTML entities unchanged. Improve flow: avoid 'wird ... erbeten'.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt für frühe Ankünfte oder späte Abreisen?",
                polish: "Gibt es eine Gepäckaufbewahrung für frühe Ankünfte oder späte Abreisen?",
                note: "Avoid bureaucratic '...regelung'. Use guest-friendly question form.",
            },
            {
                draft: "Bügeleisen und brett sind auf Anfrage erhältlich.",
                polish: "Bügeleisen und Bügelbrett sind auf Anfrage erhältlich.",
                note: "Fix missing compound noun; keep capitalization consistent.",
            },
            {
  draft: "… können ohne Aufpreis ein Babybett, eine Babywanne und einen Flaschenwärmer angefordert werden.",
  polish: "… können ohne Aufpreis ein Babybett, eine Babywanne und ein Flaschenwärmer angefordert werden.",
  note: "Grammar fix: In passive sentences ('können ... angefordert werden'), enumerated subjects must remain in the nominative case ('ein Flaschenwärmer', not accusative 'einen')."
},
{
  draft: "Die All-Inclusive-Plus-Gäste genießen eine nachmittägliche Kaffee-und-Kuchen-Pause.",
  polish: "Die All-Inclusive-Plus-Gäste genießen eine Kaffee- und Kuchenpause am Nachmittag.",
  note: "Avoid excessive hyphenation and clunky adjectives. Rephrase for a more elegant, natural flow."
},
{
  draft: "Im Games Room gibt es Videospiele, die Kindern viel Spaß bereiten.",
  polish: "Im Games Room stehen Videospiele zur Unterhaltung der Kinder zur Verfügung.",
  note: "Replace colloquial phrases like 'viel Spaß bereiten' with upscale, professional hotel phrasing ('zur Unterhaltung ... zur Verfügung')."
}
        ],
    },

    it:
    { mappings: [
  {
    "forbidden": "Quante camere dispone...",
    "preferred": "Di quante camere dispone... / Quante camere ha...",
    "reason": "The verb 'disporre' requires the preposition 'di'. In a question, use 'Di quante...' or the more natural 'Quante camere ha...'."
  },
  {
    "forbidden": "Articoli da toeletta",
    "preferred": "Set di cortesia / Prodotti da bagno",
    "reason": "'Set di cortesia' is the specific luxury hospitality term for guest amenities; 'articoli da toeletta' sounds dated or generic."
  },
  {
    "forbidden": "Accesso senza gradini",
    "preferred": "Accesso facilitato / Senza barriere architettoniche",
    "reason": "'Senza gradini' is a literal translation. The professional Italian standard for accessibility is 'senza barriere architettoniche'."
  },
  {
    "forbidden": "Consegnare le camere",
    "preferred": "Camere disponibili / Disponibilità delle camere",
    "reason": "'Consegnare' (to hand over) sounds transactional. Using 'disponibilità' or 'a disposizione' creates a more welcoming guest experience."
  },
  {
    "forbidden": "Aria condizionata autonoma / individuale",
    "preferred": "Climatizzazione regolabile individualmente",
    "reason": "For central systems, 'climatizzazione' is more precise and sounds higher-end than the basic 'aria condizionata'."
  },
  {
    "forbidden": "Il sports bar",
    "preferred": "Lo sports bar",
    "reason": "Grammatical accuracy: Words starting with 's + consonant' must take the article 'Lo' instead of 'Il'."
  },
  {
    "forbidden": "Sacchetto colazione",
    "preferred": "Colazione al sacco / Breakfast box",
    "reason": "'Sacchetto' sounds like a grocery bag. 'Colazione al sacco' is the proper Italian term for a packed meal."
  },
  {
    "forbidden": "Presso [Hotel Name]",
    "preferred": "Al / All' [Hotel Name]",
    "reason": "Using 'Al' (at the) feels like a destination. Use 'All'' if the name starts with a vowel, and 'Al' if it starts with a consonant."
  },
  {
    "forbidden": "Aliquota della tassa di soggiorno",
    "preferred": "Tassa di soggiorno",
    "reason": "Guests ask 'how much is the tax', not for the 'tax percentage'. Avoid bureaucratic terms like 'aliquota'."
  },
  {
    "forbidden": "Cani educati / Cani ben comportati",
    "preferred": "Cani ben educati / Animali domestici",
    "reason": "Avoid literal translations of 'well-behaved'. 'Ben educati' is the correct Italian expression for pets."
  },
  {
    "forbidden": "Pasti leggeri",
    "preferred": "Snack veloci / Light meal",
    "reason": "'Pasti leggeri' sounds like a clinical diet. 'Snack' or the international 'Light meal' is much more elegant in a lounge context."
  },
  {
    "forbidden": "Punti di ricarica",
    "preferred": "Stazioni di ricarica / Colonnine",
    "reason": "The professional term for EV charging infrastructure is 'stazioni' or 'colonnine', not 'punti'."
  },
  {
    "forbidden": "in tutta la struttura",
    "preferred": "in tutto l’hotel",
    "reason": "More natural and guest-facing in hotel FAQ content."
  },
  {
    "forbidden": "qualsiasi esigenza degli ospiti",
    "preferred": "assistenza agli ospiti",
    "reason": "Less translated and more natural in Italian hospitality language."
  },
  {
    "forbidden": "comfort climatico personalizzato",
    "preferred": "comfort personalizzato",
    "reason": "Avoids a heavy calque from English."
  },
  {
    "forbidden": "a controllo individuale",
    "preferred": "regolabili autonomamente",
    "reason": "More idiomatic in Italian when referring to room temperature controls."
  },
  {
    "forbidden": "un invitante bar",
    "preferred": "un bar",
    "reason": "Avoid unnecessary promotional wording that sounds translated."
  },
  {
    "forbidden": "in riconoscimento delle sue pratiche di sostenibilità",
    "preferred": "per il suo impegno nella sostenibilità",
    "reason": "Simpler and more natural phrasing."
  },
  {
    "forbidden": "accoglie gli ospiti a pranzo",
    "preferred": "è aperto a pranzo",
    "reason": "More natural in restaurant-related FAQ answers."
  },
  {
    "forbidden": "minibar/frigorifero",
    "preferred": "minibar",
    "reason": "Avoid slash constructions unless the distinction is genuinely necessary."
  },
  {
    "forbidden": "cassaforte interna",
    "preferred": "cassaforte in camera",
    "reason": "Standard hotel phrasing in Italian."
  },
  {
    "forbidden": "computer portatile",
    "preferred": "laptop",
    "reason": "More natural in this hotel amenity context."
  },
  {
    "forbidden": "soluzioni familiari o comunicanti",
    "preferred": "camere familiari o comunicanti",
    "reason": "Clearer and less abstract."
  },
  {
    "forbidden": "fornito per la comodità degli ospiti",
    "preferred": "per la comodità degli ospiti",
    "reason": "Removes unnecessary mechanical wording."
  },
  {
    "forbidden": "soggetto a disponibilità ed eventuale supplemento",
    "preferred": "in base alla disponibilità e con eventuale supplemento",
    "reason": "Flows better in Italian."
  },
  {
    "forbidden": "fornisce assistenza per",
    "preferred": "può organizzare",
    "reason": "More direct and natural in concierge-related content."
  },
  {
    "forbidden": "vengono regolarmente proiettati",
    "preferred": "vengono trasmessi",
    "reason": "More idiomatic for live sports on screens."
  },
  {
    "forbidden": "durante la bella stagione",
    "preferred": "quando il tempo lo permette",
    "reason": "More neutral and natural in hotel copy."
  },
  {
    "forbidden": "compresi camere e spazi comuni",
    "preferred": "comprese le camere e le aree comuni",
    "reason": "More idiomatic article usage and more standard hospitality phrasing."
  },
  {
    "forbidden": "hotel al 100 % non fumatori",
    "preferred": "hotel non fumatori",
    "reason": "Italian naturally avoids the literal percentage phrasing."
  },
  {
    "forbidden": "servizi di concierge",
    "preferred": "servizio concierge",
    "reason": "Usually sounds more natural in singular in Italian hotel context."
  },
  {
    "forbidden": "nelle vicinanze al costo di circa 1 € l’ora",
    "preferred": "nelle vicinanze, al costo di circa 1 € l’ora",
    "reason": "Improves rhythm and readability."
  },
  {
    "forbidden": "mette a disposizione Wi-Fi",
    "preferred": "offre il Wi-Fi",
    "reason": "More natural and direct in hotel FAQ language."
  },
  {
    "forbidden": "è rigorosamente non fumatori",
    "preferred": "è un hotel non fumatori",
    "reason": "Avoids an unnatural literal rendering."
  },
  {
    "forbidden": "diverse lingue principali",
    "preferred": "diverse lingue",
    "reason": "The original phrasing sounds translated and unnatural in Italian."
  },
  {
    "forbidden": "categorie e layout",
    "preferred": "tipologie di camere",
    "reason": "Avoid English-like wording such as 'layout' in guest-facing Italian copy."
  },
  {
    "forbidden": "design ricercato",
    "preferred": "design moderno",
    "reason": "Smoother and more natural in this context."
  },
  {
    "forbidden": "rigenerante",
    "preferred": "",
    "reason": "Avoid unnecessary promotional adjectives in FAQ answers."
  },
  {
    "forbidden": "comodamente",
    "preferred": "",
    "reason": "Remove filler adverbs that make the answer sound marketing-driven."
  },
  {
    "forbidden": "comodi distributori automatici",
    "preferred": "distributori automatici",
    "reason": "Avoid unnecessary descriptive adjectives in functional hotel information."
  },
  {
    "forbidden": "un’accurata pulizia giornaliera",
    "preferred": "la pulizia giornaliera",
    "reason": "Cleaner and more natural phrasing."
  },
  {
    "forbidden": "animali domestici ben educati",
    "preferred": "animali domestici",
    "reason": "More natural and standard in hotel policy wording."
  },
  {
    "forbidden": "riservata unicamente agli ospiti di quella suite",
    "preferred": "riservata esclusivamente ai suoi ospiti",
    "reason": "Shorter and more idiomatic."
  },
  {
    "forbidden": "prepara una ricca colazione a buffet servita ogni giorno",
    "preferred": "serve ogni giorno una ricca colazione a buffet",
    "reason": "More natural sentence structure in Italian."
  }

    ], 
    examples: [
      {
                draft: "Quante camere dispone in totale il Leonardo Boutique Museumhotel?",
                polish: "Di quante camere dispone in totale il Leonardo Boutique Museumhotel?",
                note: "Corrects the grammatical omission of the preposition 'di' with the verb 'disporre'."
            },
            {
                draft: "Il Leonardo Boutique Museumhotel fornisce articoli da toeletta ecologici?",
                polish: "Il Leonardo Boutique Museumhotel offre un set di cortesia ecologico in omaggio?",
                note: "Uses 'set di cortesia' for guest amenities and 'in omaggio' for a more premium tone."
            },
            {
                draft: "Jan Luyken Amsterdam dispone di un ascensore che garantisce accesso senza gradini?",
                polish: "Il Jan Luyken Amsterdam dispone di un ascensore che garantisce un accesso privo di barriere?",
                note: "Upgrades 'step-free' to the professional 'privo di barriere'."
            },
            {
                draft: "Le camere vengono consegnate dalle 15:00.",
                polish: "Le camere sono a disposizione degli ospiti dalle 15:00.",
                note: "Replaces the transactional 'delivered/released' with a welcoming guest-centric phrase."
            },
            {
                draft: "Le camere non dispongono di aria condizionata autonoma.",
                polish: "Le camere dispongono di un sistema di climatizzazione centralizzato.",
                note: "Uses 'climatizzazione' for a more sophisticated description of climate control."
            },
            {
                draft: "Il sports bar del Leonardo Hotel Almere...",
                polish: "Lo sports bar del Leonardo Hotel Almere...",
                note: "Corrects the article 'Lo' for words starting with 's + consonant'."
            },
            {
                draft: "È possibile richiedere un sacchetto colazione?",
                polish: "È possibile richiedere una colazione al sacco?",
                note: "Corrects the literal translation of 'breakfast bag'."
            },
            {
                draft: "Presso Jan Luyken Amsterdam il check-in inizia alle 15:00.",
                polish: "Al Jan Luyken Amsterdam il check-in inizia alle 15:00.",
                note: "Uses the destination-oriented 'Al' instead of the bureaucratic 'Presso'."
            },
            {
                draft: "Qual è l'aliquota della tassa di soggiorno?",
                polish: "A quanto ammonta la tassa di soggiorno?",
                note: "Uses natural phrasing for inquiring about costs."
            },
            {
                draft: "I cani educati sono i benvenuti.",
                polish: "I cani ben educati sono i benvenuti.",
                note: "Fixes the literal translation of 'well-behaved'."
            },
            {
    "draft": "Sì, il Leonardo Hotel Bucharest City Center offre connessione Wi-Fi gratuita ad alta velocità in tutte le camere e nelle aree comuni.",
    "polish": "Sì, il Wi-Fi ad alta velocità è gratuito in tutto l’hotel, sia nelle camere sia nelle aree comuni.",
    "note": "More natural sentence flow, less repetitive brand-led structure."
  },
  {
    "draft": "Sì, la reception è operativa 24 ore su 24 per il check-in, i servizi di concierge e qualsiasi esigenza degli ospiti.",
    "polish": "Sì, la reception è aperta 24 ore su 24 per il check-in, il servizio concierge e l’assistenza agli ospiti.",
    "note": "Replaced translated phrasing with more idiomatic hotel language."
  },
  {
    "draft": "Sì, l’intero hotel è al 100 % non-fumatori, comprese camere e spazi comuni.",
    "polish": "Sì, l’intero hotel è non fumatori, comprese le camere e le aree comuni.",
    "note": "Removed an unnatural literal rendering from English."
  },
  {
    "draft": "Sì, ogni camera offre aria condizionata e riscaldamento a controllo individuale per un comfort climatico personalizzato.",
    "polish": "Sì, ogni camera dispone di aria condizionata e riscaldamento regolabili autonomamente per un comfort personalizzato.",
    "note": "More natural terminology for room climate control."
  },
  {
    "draft": "Sì, ogni camera include un bollitore elettrico con forniture gratuite di caffè e tè.",
    "polish": "Sì, ogni camera dispone di un bollitore elettrico con una selezione gratuita di tè e caffè.",
    "note": "Smoother hospitality phrasing."
  },
  {
    "draft": "Sì, tutte le sistemazioni dispongono di un minibar/frigorifero fornito per la comodità degli ospiti.",
    "polish": "Sì, tutte le camere sono dotate di minibar.",
    "note": "Simplified an awkward slash structure and removed mechanical wording."
  },
  {
    "draft": "Sì, i bagni mettono a disposizione un set di cortesia e un asciugacapelli a parete.",
    "polish": "Sì, i bagni sono dotati di set di cortesia e asciugacapelli a parete.",
    "note": "More concise and natural structure."
  },
  {
    "draft": "Sì, alcune camere possono essere collegate per creare soluzioni familiari o comunicanti su richiesta anticipata.",
    "polish": "Sì, alcune camere possono essere comunicanti o adatte alle famiglie, su richiesta anticipata.",
    "note": "Avoided a literal and slightly awkward construction."
  },
  {
    "draft": "Sì, biancheria ipoallergenica e cuscini aggiuntivi sono disponibili su richiesta per un comfort superiore.",
    "polish": "Sì, la biancheria ipoallergenica e i cuscini aggiuntivi sono disponibili su richiesta.",
    "note": "Removed unnecessary promotional ending."
  },
  {
    "draft": "Sì, sono disponibili servizi di lavanderia express e lavaggio a secco professionale con riconsegna nello stesso giorno.",
    "polish": "Sì, sono disponibili servizi di lavanderia express e lavaggio a secco con riconsegna in giornata.",
    "note": "Shorter and more natural in Italian."
  },
  {
    "draft": "Sì, ogni camera è dotata di una cassaforte interna di dimensioni adatte a un computer portatile.",
    "polish": "Sì, ogni camera è dotata di una cassaforte in camera adatta a contenere un laptop.",
    "note": "Uses standard hotel wording and more natural terminology."
  },
  {
    "draft": "Sì, il Victoria Restaurant accoglie gli ospiti a pranzo ogni giorno dalle 12:00 alle 15:00.",
    "polish": "Sì, il Victoria Restaurant è aperto a pranzo tutti i giorni dalle 12:00 alle 15:00.",
    "note": "More natural way to describe restaurant opening hours."
  },
  {
    "draft": "Sì, un invitante bar serve bevande e snack leggeri per tutto il giorno.",
    "polish": "Sì, l’hotel dispone di un bar che serve bevande e snack leggeri durante tutta la giornata.",
    "note": "Removed unnatural promotional adjective."
  },
  {
    "draft": "Sì, è possibile, soggetto a disponibilità ed eventuale supplemento.",
    "polish": "Sì, è possibile richiederli in base alla disponibilità e con eventuale supplemento.",
    "note": "Improved flow and clarified reference."
  },
  {
    "draft": "Sono benvenuti bambini di tutte le età; le culle sono gratuite per 0-2 anni e i letti extra, dai 3 anni, costano 15 € a notte.",
    "polish": "I bambini di tutte le età sono i benvenuti. Le culle da 0 a 2 anni sono gratuite, mentre i letti supplementari a partire dai 3 anni costano 15 € a notte.",
    "note": "More natural rhythm and cleaner sentence structure."
  },
  {
    "draft": "Il Leonardo Hotel Bucharest City Center dista 14 km dall’aeroporto Henri Coandă; sono disponibili transfer a pagamento.",
    "polish": "Il Leonardo Hotel Bucharest City Center si trova a 14 km dall’aeroporto Henri Coandă e offre transfer a pagamento.",
    "note": "Smoother syntax and more natural hospitality phrasing."
  },
  {
    "draft": "È disponibile un parcheggio pubblico nelle vicinanze al costo di circa 1 € l’ora, soggetto a disponibilità.",
    "polish": "È disponibile un parcheggio pubblico nelle vicinanze, al costo di circa 1 € l’ora e soggetto a disponibilità.",
    "note": "Improved sentence rhythm."
  },
  {
    "draft": "Sì, il concierge può organizzare taxi, autonoleggio o servizio limousine su richiesta.",
    "polish": "Sì, il concierge può organizzare taxi, noleggio auto o servizio limousine su richiesta.",
    "note": "Replaced a less natural noun with the more common phrase."
  },
  {
    "draft": "Sì, il concierge fornisce assistenza per tour guidati e biglietti per attrazioni su richiesta.",
    "polish": "Sì, il concierge può organizzare visite guidate e assistere nell’acquisto dei biglietti per le attrazioni.",
    "note": "More natural and service-oriented wording."
  },
  {
    "draft": "Sì, nel bar-lounge vengono regolarmente proiettati eventi sportivi in diretta.",
    "polish": "Sì, nell’area bar e lounge vengono trasmessi regolarmente eventi sportivi in diretta.",
    "note": "More idiomatic for televised sports."
  },
  {
    "draft": "Sì, una terrazza all’aperto consente agli ospiti di rilassarsi con bevande durante la bella stagione.",
    "polish": "Sì, l’hotel dispone di una terrazza all’aperto dove gli ospiti possono rilassarsi con un drink quando il tempo lo permette.",
    "note": "More natural guest-facing tone."
  },
  {
    "draft": "Sì, il Leonardo Hotel Bucharest City Center offre un business centre con servizi di stampa, fotocopie e altro.",
    "polish": "Sì, il Leonardo Hotel Bucharest City Center dispone di un business centre con servizi di stampa e fotocopie.",
    "note": "Removed vague wording like 'e altro'."
  },
  {
    "draft": "Sì, la terrazza del ristorante può essere riservata per ricevimenti privati o eventi sociali previa richiesta.",
    "polish": "Sì, la terrazza del ristorante può essere riservata per ricevimenti privati o eventi sociali, previo accordo.",
    "note": "More polished and idiomatic ending."
  },
  {
    "draft": "Sì, NYX Hotel Prague mette a disposizione Wi-Fi ad alta velocità gratuito in tutte le camere e nelle aree comuni.",
    "polish": "Sì, NYX Hotel Prague offre il Wi-Fi ad alta velocità gratuito in tutte le camere e nelle aree comuni.",
    "note": "More direct and natural than 'mette a disposizione'."
  },
  {
    "draft": "Sì, l’intero hotel, comprese tutte le camere e le aree comuni, è rigorosamente non fumatori.",
    "polish": "Sì, NYX Hotel Prague è un hotel non fumatori, comprese le camere e le aree comuni.",
    "note": "Removes an unnatural literal rendering of 'strictly non-smoking'."
  },
  {
    "draft": "Sì, alla reception è presente personale multilingue che parla fluentemente diverse lingue principali.",
    "polish": "Sì, alla reception è presente personale multilingue che parla fluentemente diverse lingue.",
    "note": "Simplified an unnatural phrase."
  },
  {
    "draft": "NYX Hotel Prague dispone di 91 camere dal design ricercato suddivise in diverse categorie e layout.",
    "polish": "NYX Hotel Prague dispone di 91 camere dal design moderno, disponibili in diverse tipologie.",
    "note": "Avoids English-like wording and sounds more natural in Italian."
  },
  {
    "draft": "Sì, i bagni moderni includono ampie docce a filo pavimento con soffione effetto pioggia rigenerante.",
    "polish": "Sì, i bagni moderni includono ampie docce a filo pavimento con soffione effetto pioggia.",
    "note": "Removed an unnecessary promotional adjective."
  },
  {
    "draft": "Sì, in tutte le camere è presente un minibar per la comodità degli ospiti.",
    "polish": "Sì, tutte le camere sono dotate di minibar.",
    "note": "Shorter, cleaner and more natural."
  },
  {
    "draft": "Sì, un’accurata pulizia giornaliera è inclusa per tutte le camere occupate.",
    "polish": "Sì, la pulizia giornaliera è inclusa per tutte le camere occupate.",
    "note": "Removed unnecessary emphasis."
  },
  {
    "draft": "Sì, la suite di massima categoria Heaven Suite offre una terrazza privata esclusiva con area salotto all’aperto e vista sullo skyline, riservata unicamente agli ospiti di quella suite.",
    "polish": "Sì, la Heaven Suite dispone di una terrazza privata con area salotto all’aperto e vista panoramica sulla città, riservata esclusivamente ai suoi ospiti.",
    "note": "Shorter, more fluid, and less mechanical."
  },
  {
    "draft": "Sì, NYX Hotel Prague prepara una ricca colazione a buffet servita ogni giorno nell’area ristorante.",
    "polish": "Sì, NYX Hotel Prague serve ogni giorno una ricca colazione a buffet nell’area ristorante.",
    "note": "More natural word order."
  },
  {
    "draft": "Sì, gli ospiti possono acquistare la colazione in hotel e addebitarne comodamente il costo sul conto.",
    "polish": "Sì, gli ospiti possono acquistare la colazione in hotel e aggiungerne il costo al conto.",
    "note": "Removed a filler adverb and simplified the phrasing."
  },
  {
    "draft": "Sì, comodi distributori automatici di snack e bevande sono disponibili all’interno dell’hotel.",
    "polish": "Sì, sono disponibili distributori automatici di snack e bevande all’interno dell’hotel.",
    "note": "Avoids unnecessary descriptive language."
  },
  {
    "draft": "Sì, gli animali domestici ben educati sono i benvenuti con un supplemento di 25 € al giorno.",
    "polish": "Sì, gli animali domestici sono ammessi con un supplemento di 25 € al giorno.",
    "note": "More standard hotel policy language."
  }
    ] },

 nl: { mappings: [], examples: [] },
    fr: {
  mappings: [
    {
      forbidden: "L'enregistrement officiel au... commence à",
      preferred: "Les arrivées s'effectuent à partir de",
      reason: "In French hospitality, referring to 'Les arrivées' is more elegant and guest-centric than the technical 'L'enregistrement'."
    },
    {
      forbidden: "Le check-out doit s’effectuer",
      preferred: "Les chambres doivent être libérées",
      reason: "Using the English loanword 'check-out' in a French response is considered low-tier. 'Libérer la chambre' is the professional standard for high-end hotels."
    },
    {
      forbidden: "Offrant un départ détendu",
      preferred: "Pour un départ en toute sérénité",
      reason: "'Détendu' is too casual/literal. 'En toute sérénité' is the standard luxury phrasing for a relaxed experience."
    },
    {
      forbidden: "Garantissant une assistance à tout moment",
      preferred: "Pour vous accompagner à chaque instant",
      reason: "As noted before, 'assistance' implies a problem. 'Accompagner' or 'À votre entière disposition' sounds like proactive service."
    },
    {
      forbidden: "Ventilateurs portatifs",
      preferred: "Ventilateurs d'appoint",
      reason: "'Portatifs' sounds like a gadget (like a phone). 'D'appoint' is the correct professional term for extra equipment provided by a hotel."
    },
    {
      forbidden: "Facilement sollicité via l’application",
      preferred: "Disponible sur simple demande via l’application",
      reason: "The phrase 'sur simple demande' is a staple of French hospitality, making the service sound effortless for the guest."
    },
    {
      forbidden: "Propose des options végétariennes",
      preferred: "Propose une sélection de mets végétariens",
      reason: "Using 'Mets' (dishes) and 'Sélection' adds a culinary, upscale feel compared to the generic 'options'."
    },
    {
      forbidden: "Un environnement maîtrisé en matière d'allergènes",
      preferred: "Un environnement préservé de tout allergène",
      reason: "'Maîtrisé' sounds like a laboratory report. 'Préservé' sounds like a guest benefit and a clean, luxury space."
    }
  ],
  examples: [
    {
      draft: "Le check-out doit s’effectuer avant 12h00, offrant un départ détendu avant midi.",
      polish: "Au Leonardo Hotel Almere City Center, les chambres doivent être libérées avant 12h00, vous permettant un départ en toute sérénité.",
      note: "Replacing anglicisms and literal translations with professional French hospitality idioms."
    },
    {
      draft: "L'enregistrement officiel au Leonardo Hotel Almere City Center commence à 15h00...",
      polish: "Les arrivées au Leonardo Hotel Almere City Center s'effectuent à partir de 15h00...",
      note: "Standardizing the welcome process phrasing."
    },
    {
      draft: "Oui, le Wi-Fi haut débit est offert gratuitement dans l’ensemble des chambres...",
      polish: "Oui, une connexion Wi-Fi haut débit est gracieusement mise à votre disposition dans l'ensemble des chambres du Leonardo Hotel Almere City Center...",
      note: "Using 'gracieusement mise à disposition' instead of just 'offert' for a more prestigious tone."
    },
    {
      draft: "Les clients non résidents peuvent-ils dîner au Bierfabriek Almere...",
      polish: "La clientèle non-résidente peut-elle déjeuner ou dîner au Bierfabriek Almere...",
      note: "Specifying the type of guest (clientèle) and the meals (déjeuner/dîner) for a more complete response."
    }
  ]
},
    pl: { mappings: [], examples: [] },
    ru: { mappings: [], examples: [] },
   he: {
    mappings: [
        { forbidden: "חצות היום", preferred: "צהריים", reason: "Natural Hebrew; 'חצות היום' is a literal translation of midday." },
        { forbidden: "באתר", preferred: "במלון", reason: "Avoid literal 'on-site'. Use 'במלון', 'במקום' or 'בשטח המלון'." },
        { forbidden: "עכשוויים", preferred: "מודרניים", reason: "Context: Hotel design. Use 'מודרניים' or 'מעוצבים'." },
        { forbidden: "או דומה", preferred: "או סוג דומה", reason: "Avoid standalone 'או דומה'. Use 'מותג מקביל' for brands or 'סוג דומה' for general items." },
        { forbidden: "מערכות בקרת אקלים", preferred: "בקרת טמפרטורה", reason: "More guest-friendly and accurate than 'מיזוג אוויר' for central systems with in-room control." },
        { forbidden: "שקית ארוחת בוקר", preferred: "ארוחה ארוזה", reason: "Professional hotel terminology for Grab-and-Go; avoid using 'שקית'." },
        { forbidden: "פיקדון ביטחון", preferred: "פיקדון", reason: "Simpler, more common term in Hebrew." },
        { forbidden: "ספורט חיים", preferred: "שידורי ספורט ישירים", reason: "Natural terminology for live sports broadcasting; avoid literal translation of 'Live'." },
        { forbidden: "ולכן ניתן", preferred: "וניתן", reason: "Remove redundant connectors ('ולכן') for a professional, concise tone." },
        { forbidden: "מוגבלות בתנועה", preferred: "מוגבלויות", reason: "Prefer 'אנשים עם מוגבלויות' for standard professional terminology." },
        { forbidden: "או על פי בקשה", preferred: "או בתיאום מראש", reason: "Clarify availability and service phrasing." },
        { forbidden: "חל תוספת", preferred: "חלה תוספת", reason: "Grammar fix: 'תוספת' is feminine." },
        { forbidden: "נמשך הנסיעה", preferred: "נמשכת הנסיעה", reason: "Grammar fix: 'נסיעה' is feminine." },
        { forbidden: "מבוקרת־אלרגנים", preferred: "נקייה מאלרגנים", reason: "Simplify technical terms for a natural hospitality feel." },
        { forbidden: "לשימוש המשפחה", preferred: "עבור משפחות", reason: "More professional phrasing for hotel amenities." },
        { forbidden: "עומדים לרשותכם", preferred: "זמינים בחדר", reason: "Avoid formal/stiff phrasing for simple amenities like coffee/tea." },
        { forbidden: "הבטחת שנת לילה", preferred: "לשינה שקטה", reason: "Avoid literal 'ensuring a night's sleep'; 'לשינה שקטה' sounds more natural." },
        { forbidden: "כערובה", preferred: "כפיקדון", reason: "Standard financial term in Israeli hotels for CC details is 'פיקדון' or 'ערבון', 'ערובה' is more legal/formal." },
        { forbidden: "נבחרים", preferred: "מגוון", reason: "In food context (Selected items), 'מגוון' is more inviting than 'נבחרים'." },
        { forbidden: "מצויות", preferred: "נמצאות", reason: "When talking about locations (stations/attractions), 'נמצאות' or 'ממוקמות' is more natural than 'מצויות'." },
        { forbidden: "עטור העצים", preferred: "הפסטורלי", reason: "Literal 'tree-lined' (עטור עצים) is poetic; 'פסטורלי' or just 'ירוק' fits better for a marketing tone." },
        { forbidden: "בידור קליל", preferred: "משחקים ופנאי", reason: "Avoid literal 'light entertainment' (בידור קליל) for board games; 'משחקים' is much more common." },
        { forbidden: "ארוחת בוקר מוקדמת לפני", preferred: "ארוחת בוקר לפני השעה", reason: "Natural phrasing for early breakfast requests." },
        { forbidden: "קפה ותה לשירות עצמי", preferred: "עמדת קפה ותה בשירות עצמי", reason: "Standard Hebrew for self-service stations." },
        { forbidden: "קיימת מטבחון", preferred: "יש מטבחון לאורחים", reason: "Grammar fix (masculine/feminine) and natural flow." },
        { forbidden: "להכנת נשנושים עצמאית", preferred: "להכנה עצמית של נשנושים", reason: "Fix syntax: 'עצמאית' was incorrectly attached to 'snack'." },
        { forbidden: "מטבחון ביתי להכנת נשנושים", preferred: "מטבחון ביתי לשימוש האורחים", reason: "Maintain 'homely' (ביתי) while improving the overall structure." },        
        { forbidden: "שירות שיתופי", preferred: "הסעה", reason: "Accurate Hebrew translation for rideshare/shuttle." },
        { forbidden: "מונית אמינה", preferred: "מונית", reason: "Professional terminology; avoids implies other taxis are unreliable." },
        { forbidden: "שירות העברה פרטי", preferred: "הסעה פרטית", reason: "Standard Hebrew for 'private transfer'." },
        { forbidden: "בוטיקי יוקרה", preferred: "חנויות מעצבים", reason: "Natural Hebrew for upscale boutiques." },
        { forbidden: "יישארו יבשים", preferred: "לשימוש האורחים במזג אוויר גשום", reason: "Avoid literal 'stay dry' translation." },
        { forbidden: "נגבה מס עירוני", preferred: "המס העירוני הינו", reason: "Polite phrasing for tax information." },
        { forbidden: "תכנית התעריף", preferred: "סוג התעריף", reason: "Clearer terminology for 'rate plan'." },
        { forbidden: "הזמנת יותר מחמישה חדרים", preferred: "הזמנה של יותר מ-5 חדרים", reason: "Match source 'more than five' exactly." },
        { forbidden: "בהזמנת שישה חדרים", preferred: "בהזמנה של 6 חדרים ומעלה", reason: "Clearer group policy phrasing." },
        { forbidden: "מעניק", preferred: "מציע", reason: "Avoid overly formal 'מעניק' for standard amenities like Wi-Fi." },
        { forbidden: "בכל שטחיו של", preferred: "בכל רחבי", reason: "Smoother and more natural Hebrew phrasing for 'throughout the property'." },
        { forbidden: "באותנטיות", preferred: "בצורה אותנטית", reason: "Fix the clunky adverb 'באותנטיות'; 'בצורה אותנטית' flows better in Hebrew." },
        { forbidden: "בקרי מיזוג", preferred: "שליטה אישית במיזוג", reason: "Avoid overly technical terms for A/C controls." },
        { forbidden: "מבוקרות בנפרד", preferred: "עם שליטה אינדיבידואלית", reason: "Better hospitality term for individual climate control." },
        { forbidden: "טואלטיקה", preferred: "מוצרי טיפוח", reason: "'מוצרי טיפוח' is more common and elegant in hotel contexts than 'טואלטיקה'." },
        { forbidden: "שירות משק בית", preferred: "שירות ניקיון חדרים", reason: "Standard Hebrew translation for 'housekeeping'." },
        { forbidden: "בתחנת Grab’n’Go", preferred: "בעמדת Grab’n’Go", reason: "Use 'עמדת' for grab-and-go or snack stations to avoid confusion with transportation stations." },
        { forbidden: "מכונת מכירה אוטומטית", preferred: "מכונת חטיפים", reason: "Natural translation for 'vending machine'." },
        { forbidden: "מתחם ללא מזומן", preferred: "אינו מקבל מזומן", reason: "Avoid literal translation of 'cashless property'." },
        { forbidden: "פועל ללא מזומן", preferred: "התשלום מתבצע בכרטיסי אשראי בלבד", reason: "Natural way to express cashless policy." },
        { forbidden: "כרטיסי תשלום", preferred: "כרטיסי אשראי", reason: "Standard Hebrew term for payment cards." },
        { forbidden: "עסקאות במזומן אינן מתאפשרות", preferred: "לא ניתן לשלם במזומן", reason: "Avoid heavy, formal phrasing for cashless policy." },
        { forbidden: "הינו ללא עישון לחלוטין", preferred: "העישון אסור", reason: "More natural phrasing for non-smoking questions." },
        { forbidden: "קיימת החרגה לכלבי נחייה מוסמכים", preferred: "מותר להכניס כלבי נחייה", reason: "Avoid overly legal/stiff translations and maintain grammatical structure with the preceding word 'האם'." },
        { forbidden: "אינן מורשות", preferred: "לא ניתן להכניס", reason: "Clearer and more natural phrasing for prohibiting pets." },
        { forbidden: "מבוססי צומח", preferred: "טבעוניים", reason: "Natural translation for 'plant-based'." },
        { forbidden: "והצ'ק-אאוט הרשמיים", preferred: "והצ'ק-אאוט", reason: "Remove redundant 'official' (הרשמיים) in check-in times context." },
        { forbidden: "המחיר הנוכחי", preferred: "המחיר", reason: "Remove redundant word 'current' (הנוכחי)." },
        { forbidden: "עומד כיום", preferred: "עומד", reason: "Remove redundant time words." },
        { forbidden: "14:00 אחר הצוהריים", preferred: "14:00", reason: "Redundant AM/PM equivalent when using 24h format." },
        { forbidden: "הפועל באופן עצמאי", preferred: "הממוקם מתחת למלון", reason: "Avoid clunky literal translation of 'independently operated' for the garage." },
        { forbidden: "ועלולות לגרור תשלום סמלי", preferred: "ועשויות להיות כרוכות בתוספת תשלום סמלית", reason: "Avoid the negative connotation of 'לגרור' (incur/drag) for hotel fees." },
        { forbidden: "רשמית בשעה", preferred: "החל מהשעה", reason: "Avoid formal/stiff 'officially at' for check-in times." },
        { forbidden: "(3 אחר הצהריים)", preferred: "", reason: "Remove redundant 12-hour format clarifications in Hebrew." },
        { forbidden: "יש להשלים צ'ק-אאוט", preferred: "הצ'ק-אאוט הוא עד השעה", reason: "Soften the imperative tone for check-out times." },
        { forbidden: "צוות רב-לשוני", preferred: "צוות הדובר מגוון שפות", reason: "More natural Hebrew phrasing." },
        { forbidden: "שירות רב-לשוני", preferred: "שירות במספר שפות", reason: "More natural Hebrew phrasing." },
        { forbidden: "לולים לתינוקות", preferred: "עריסות תינוק", reason: "Standard hotel terminology." },
        { forbidden: "קטגוריות אירוח", preferred: "סוגי חדרים", reason: "Avoid hotel jargon ('categories'); use 'room types'." },
        { forbidden: "למספר קטגוריות", preferred: "למספר סוגי חדרים", reason: "Avoid hotel jargon ('categories'); use 'room types'." },
        { forbidden: "שירות ההזמנות לחדר", preferred: "שירות חדרים", reason: "Standard Hebrew translation for 'Room Service'." },
        { forbidden: "ישיבה אלפרסקו", preferred: "ישיבה באוויר הפתוח", reason: "Avoid literal translation of 'Alfresco'." },
        { forbidden: "תקליטנים תושבי קבע", preferred: "תקליטנים קבועים", reason: "Natural translation for 'Resident DJs'." },
        { forbidden: "אסור בעישון לחלוטין", preferred: "העישון אסור לחלוטין בכל שטח המלון", reason: "Fix stiff syntax for non-smoking policies." },
        { forbidden: "ניתן לפי דרישה וניתן להזמינו", preferred: "זמין לפי דרישה, וניתן להזמינו", reason: "Avoid repetition of the word 'ניתן'." },
        { forbidden: "מוגבלות ניידות", preferred: "מוגבלויות מוטוריות", reason: "Professional terminology for reduced mobility." },
        { forbidden: "צרכי ניידות", preferred: "מוגבלויות", reason: "Professional terminology." },
        { forbidden: "מבוססות על זמינות", preferred: "בכפוף לזמינות", reason: "Standard hospitality phrasing." },
        { forbidden: "תחנות טעינה", preferred: "עמדות טעינה", reason: "Use 'עמדות' for EV charging stations." },
        { forbidden: "מרכז הרכבת", preferred: "תחנת הרכבת", reason: "Standard Hebrew for train station." },
        { forbidden: "ומחבר אל רשתות האזור", preferred: "ומחברת לרשת התחבורה האזורית", reason: "Better phrasing for transport networks." },
        { forbidden: "שכירת", preferred: "השכרת", reason: "Standard Hebrew term (השכרת סירות)." },
        { forbidden: "אישור מקדמי", preferred: "תפיסת מסגרת", reason: "Standard Israeli hotel terminology for credit card holds." },
        { forbidden: "הרשאה מוקדמת", preferred: "תפיסת מסגרת", reason: "Standard Israeli hotel terminology for credit card holds." },
        { forbidden: "עשר חדרים", preferred: "עשרה חדרים", reason: "Grammar fix: 'חדר' is masculine." },
        { forbidden: "קיים טרסה", preferred: "קיימת טרסה", reason: "Grammar fix: 'טרסה' is feminine." },
        { forbidden: "—", preferred: "-", reason: "Replace long dashes with standard short dashes or commas based on syntax." },
        // === עריכה ופשטות (סופרלטיבים ופעלים נוקשים) ===
        { forbidden: "הסטנדרטיים", preferred: "", reason: "Remove robotic adjective 'standard' from questions about check-in/out times." },
        { forbidden: "כסטנדרט", preferred: "", reason: "Remove robotic hospitality jargon 'as standard'." },
        { forbidden: "מעמיד", preferred: "מציע", reason: "Avoid formal 'מעמיד' (provides/places); use 'מציע' or 'האם יש'." },
        { forbidden: "מצוידת ב", preferred: "כוללת", reason: "Avoid technical 'equipped with' for simple amenities like a mini-fridge." },
        { forbidden: "מצוידים ב", preferred: "כוללים", reason: "Avoid technical 'equipped with' for amenities." },
        { forbidden: "מסופקים", preferred: "ישנם", reason: "Avoid stiff 'provided' for physical items like sunbeds." },
        { forbidden: "מוצבות ב", preferred: "זמינות ב", reason: "Avoid industrial 'placed' for sunbeds." },
        
        // === מינוחים, ילדים, וקהל ===
        { forbidden: "לאורחים בינלאומיים", preferred: "לאורחים מרחבי העולם", reason: "Natural translation for 'international guests'." },
        { forbidden: "לרענון אישי", preferred: "לשימוש אישי", reason: "Avoid clunky literal translation of 'for personal refreshment'." },
        { forbidden: "ללא תשלום בעריסה", preferred: "בעריסה ללא תשלום נוסף", reason: "Fix awkward word order." },
        { forbidden: "בנוגע לחיות מחמד או חיות שירות", preferred: "להכנסת חיות מחמד או חיות שירות", reason: "More natural phrasing for pet policy questions." },
        
        // === מינוחים טכניים ורשמיים ===
        { forbidden: "מקרר-מיני-בר", preferred: "מיני בר", reason: "Use standard Hebrew term." },
        { forbidden: "מוגבלות בניידות", preferred: "מוגבלויות", reason: "Use professional term." },
        { forbidden: "מכונות ממכר אוטומטיות", preferred: "מכונות חטיפים", reason: "Natural translation for vending machines." },
        { forbidden: "מכונות ממכר בשירות עצמי", preferred: "מכונות חטיפים", reason: "Natural translation for vending machines." },
        { forbidden: "מגבות טריות", preferred: "מגבות נקיות", reason: "Avoid literal translation of 'fresh towels'." },
        { forbidden: "כמוסות קפה", preferred: "קפסולות קפה", reason: "Use standard loanword 'קפסולות' for coffee, not medical 'כמוסות'." },
        { forbidden: "מתקני שתייה", preferred: "ציוד להכנת תה וקפה", reason: "Use standard hospitality phrasing for hot beverage amenities." },
        
        // === Syntax and Grammar ===
        { forbidden: "כמה חדרי אירוח כוללים במלון", preferred: "כמה חדרי אירוח יש במלון", reason: "Fix awkward syntax for asking about room count." },
        { forbidden: "יותר מתשע חדרים", preferred: "יותר מתשעה חדרים", reason: "Grammar fix: 'חדר' is masculine." },
        { forbidden: "מתשע חדרים", preferred: "מתשעה חדרים", reason: "Grammar fix: 'חדר' is masculine." },
        // === עריכה ופשטות (מחיקת פלאף שיווקי) ===
        { forbidden: "הרשמיות", preferred: "", reason: "Remove unnecessary formal tone from check-in times." },
        { forbidden: "רשמית ב-", preferred: "ב-", reason: "Remove redundant 'officially' for times." },
        { forbidden: "נכון לעכשיו, ", preferred: "", reason: "Remove filler phrase 'currently'." },
        { forbidden: "המעניקה אפשרויות רחצה מגוונות", preferred: "", reason: "Remove translated marketing fluff about showers." },
        { forbidden: "לשיפור נוחות השינה", preferred: "", reason: "Remove unnecessary marketing fluff about pillows." },
        { forbidden: "להוספת מרחב ופרטיות", preferred: "", reason: "Remove marketing fluff about suites." },
        { forbidden: "כדי לאפשר גמישות למקדימי קום ולמאחרים", preferred: "", reason: "Remove translated fluff about breakfast times." },
        { forbidden: "כדי להבטיח חוויית סעודה נוחה לאורחים הצעירים", preferred: "", reason: "Remove marketing fluff about kids menus." },
        { forbidden: "לזמן איכות משפחתי", preferred: "", reason: "Remove marketing fluff about board games." },
        { forbidden: "בסך הכול.", preferred: ".", reason: "Remove literal translation of 'in total' at the end of sentences." },

        // === מינוחים ותחבורה ===
        { forbidden: "לחקר האזור", preferred: "לסיור באזור", reason: "Better translation for 'exploring the area'." },
        { forbidden: "להשכיר אופניים", preferred: "לשכור אופניים", reason: "Grammar fix: Guests 'rent' (שוכרים), the hotel 'rents out' (משכיר)." },
        { forbidden: "מסדיר הסעות", preferred: "מארגן הסעות", reason: "Natural terminology for arranging transfers." },
        { forbidden: "העברות פרטיות", preferred: "הסעה פרטית", reason: "Standard Hebrew for 'private transfers'." },
        { forbidden: "בכ-שעה", preferred: "בתוך כשעה", reason: "Fix awkward time estimation phrasing." },
        { forbidden: "זמני טי-אוף", preferred: "שעות משחק", reason: "Natural Hebrew term for golf tee times." },
        { forbidden: "יכול לרכוש או להזמין כרטיסים", preferred: "יכול לסייע ברכישת כרטיסים", reason: "Clarify that the hotel assists the guest in buying tickets." },

        // === מסעדות, חדרים ושירותים ===
        { forbidden: "מוקדי קולינריה", preferred: "מסעדות", reason: "Avoid pretentious 'culinary hubs'." },
        { forbidden: "קז'ואלי", preferred: "באווירה קלילה", reason: "Translate 'casual' naturally." },
        { forbidden: "יוכנו מבעוד מועד", preferred: "הצוות ישמח להכין", reason: "More natural and hospitable phrasing for dietary requests." },
        { forbidden: "ניתן לסדר בכל עת", preferred: "ניתן להזמין", reason: "Avoid clunky literal translation of 'can be arranged'." },
        { forbidden: "לדמי משלוח סמליים", preferred: "בתוספת תשלום סמלית", reason: "Natural Hebrew phrasing for delivery fees." },
        { forbidden: "נשלט באופן אישי", preferred: "עם שליטה אישית", reason: "Better phrasing for individual A/C." },
        { forbidden: "הינם ללא עישון לחלוטין", preferred: "העישון בהם אסור לחלוטין", reason: "More natural phrasing for non-smoking areas." },
        { forbidden: "נדרש לכל המאוחר עד", preferred: "הוא עד", reason: "Soften strict check-out phrasing." },
        // === שפה שיווקית ופלאף (Marketing Fluff) ===
        { forbidden: "לנוחות אקלים מותאמת", preferred: "", reason: "Remove excessive marketing fluff at the end of A/C descriptions." },
        { forbidden: "להרגשת יוקרה נוספת", preferred: "", reason: "Remove literal translation of marketing fluff about toiletries." },
        { forbidden: "או כל בקשה נוחה", preferred: "להזמנת אוכל ומשקאות", reason: "Fix literal and nonsensical translation of 'or any convenient request'." },
        { forbidden: "היא המסעדה שבמקום במלון", preferred: "נמצאת במלון", reason: "Avoid clunky literal translation of 'is the on-site restaurant'." },
        { forbidden: "ב-מלון", preferred: "במלון", reason: "Fix incorrect Hebrew prefix spacing." },
        
        // === מינוחים וסגנון (Vocabulary & Style) ===
        { forbidden: "חינמי", preferred: "ללא תשלום", reason: "Avoid slang/casual 'חינמי'; use professional 'ללא תשלום'." },
        { forbidden: "חינמית", preferred: "ללא תשלום", reason: "Avoid slang/casual 'חינמית'; use professional 'ללא תשלום'." },
        { forbidden: "חינם", preferred: "ללא תשלום", reason: "Use upscale 'ללא תשלום' instead of 'חינם'." },
        { forbidden: "אסור בעישון לחלוטין", preferred: "העישון אסור לחלוטין בכל שטח הבניין", reason: "Fix stiff syntax for non-smoking policies." },
        { forbidden: "תכונות חסרות מכשולים", preferred: "מותאמים במלואם לאורחים עם מוגבלויות", reason: "Fix terrible literal translation of 'barrier-free features'." },
        { forbidden: "נופי פנורמה", preferred: "נוף פנורמי", reason: "Use natural Hebrew phrasing." },
        { forbidden: "קטגוריות הדלקס", preferred: "חדרי הדלקס", reason: "Avoid hotel jargon 'categories'." },
        { forbidden: "ללא קנס", preferred: "ללא דמי ביטול", reason: "Use standard hospitality/cancellation terminology." },
        { forbidden: "ממרכז העיר ההיסטורית", preferred: "מהמרכז ההיסטורי של העיר", reason: "Fix word order and adjective attachment." },
        
        // === תחביר ודקדוק (Grammar) ===
        { forbidden: "נמשך בערך הנסיעה", preferred: "נמשכת הנסיעה בערך", reason: "Fix gender agreement: 'נסיעה' is feminine." },
        { forbidden: "מוצעים חבילות", preferred: "מוצעות חבילות", reason: "Fix gender agreement: 'חבילות' is feminine." },
        { forbidden: "מוצבת מכונת", preferred: "יש מכונת", reason: "Soften industrial verbs." },
        { forbidden: "נשלחים במהירות", preferred: "מסופקים", reason: "Soften robotic phrasing for room deliveries." },
        // === עריכה אחרונה של פלאף וניסוחים ===
        { forbidden: "מתחיל החל מהשעה", preferred: "מתחיל בשעה", reason: "Remove redundant wording in check-in times." },
        { forbidden: "מתבקש עד", preferred: "הוא עד", reason: "Soften awkward phrasing for check-out time." },
        { forbidden: "בעיצוב עכשווי", preferred: "בעיצוב מודרני", reason: "Use standard 'מודרני' instead of clunky 'עכשווי'." },
        { forbidden: "מערכת בקרת האקלים המלאה דואגת למיזוג נעים", preferred: "קיימת מערכת בקרת אקלים מרכזית", reason: "Remove marketing fluff about air conditioning." },
        { forbidden: "לנוחות שינה מותאמת אישית", preferred: "", reason: "Remove marketing fluff from pillow menu descriptions." },
        { forbidden: "לנוחות נוספת", preferred: "", reason: "Remove redundant marketing fluff." },
        { forbidden: "המוארת בשמש", preferred: "", reason: "Remove marketing fluff describing the terrace." },
        { forbidden: "המלצות פנימיות", preferred: "המלצות", reason: "Fix literal translation of 'insider tips/recommendations'." },
        { forbidden: "מציג בגאווה את", preferred: "מחזיק ב", reason: "Remove translated marketing fluff about green certifications." },
        
        // === מינוחים ודקדוק קל ===
        { forbidden: "בהם הולנדית", preferred: "בהן הולנדית", reason: "Fix gender agreement ('שפות' is feminine)." },
        { forbidden: "מקרר קטן או מקרר", preferred: "מיני מקרר", reason: "Fix redundant and literal translation." },
        { forbidden: "לול תינוק", preferred: "עריסת תינוק", reason: "Use standard hospitality terminology." },
        { forbidden: "לולים לתינוק", preferred: "עריסות תינוק", reason: "Use standard hospitality terminology." },
        { forbidden: "פיקדון בטחון", preferred: "פיקדון", reason: "Use simpler Hebrew terminology for security deposit." },
        { forbidden: "הניתן להחזר בעת הצ'ק-אין", preferred: "הנגבה בעת הצ'ק-אין ומוחזר בעת העזיבה", reason: "Fix broken literal translation of refundable deposit timeline." },
        { forbidden: "תשלום מקדמה מראש", preferred: "תשלום מקדמה", reason: "Remove redundancy (מקדמה is already 'in advance')." },
        { forbidden: "נגבה תעריף מבוגר", preferred: "חל תעריף מבוגר", reason: "Use more natural phrasing for room rates." },
        { forbidden: "אינו מקיים כעת", preferred: "אינו מקיים כרגע", reason: "Soften the literal translation of 'currently'." },
        { forbidden: "היומי הנוכחי", preferred: "היומי", reason: "Remove redundant word 'current' from parking rate questions." },
        { forbidden: "באופן מלא", preferred: "לחלוטין", reason: "Use more natural phrasing for non-smoking properties." },
        { forbidden: "ללא-עישון", preferred: "ללא עישון", reason: "Remove awkward hyphen." },
        // === עריכות מהותיות (זכר/נקבה, פלאף עקשן ושגיאות תרגום) ===
        { forbidden: "ב-100%", preferred: "לחלוטין", reason: "Avoid literal translation of '100% smoke-free'." },
        { forbidden: "פריסות גמישות", preferred: "אפשרויות סידור גמישות", reason: "Fix literal translation of 'flexible layouts'." },
        { forbidden: "שהוסב בזהירות", preferred: "שהוסב", reason: "Remove literal marketing fluff ('carefully converted')." },
        { forbidden: "מבטיח נוחות בכל עונות השנה", preferred: "", reason: "Remove excessive marketing fluff." },
        { forbidden: "חדרים ללא מכשולים", preferred: "חדרים נגישים", reason: "Fix literal translation of 'barrier-free rooms'." },
        { forbidden: "תואמי דיאטות אחרות", preferred: "לדיאטות מיוחדות", reason: "Fix clunky phrasing for 'other dietary requirements'." },
        { forbidden: "צ'ק-אאוט רגיל מתקיים", preferred: "הצ'ק-אאוט הוא", reason: "Soften robotic phrasing for check-out times." },
        { forbidden: "דקות נעימות", preferred: "דקות", reason: "Remove fluffy adjectives from walking times." },
        { forbidden: "מומלץ בחום", preferred: "מומלץ", reason: "Soften exaggerated translations." },
        { forbidden: "הליכה קלה", preferred: "הליכה קצרה", reason: "More natural phrasing for 'easy walk'." },
        { forbidden: "טיפים מקומיים", preferred: "המלצות", reason: "Fix literal translation of 'local tips'." },
        { forbidden: "בעל האווירה", preferred: "", reason: "Remove literal translation of 'atmospheric'." },
        { forbidden: "ארוזה מוקדמת", preferred: "ארוזה", reason: "Fix awkward 'early packed' phrasing." },
        
        // === שגיאות דקדוק והזיות מודל ===
        { forbidden: "נמשך ההליכה", preferred: "נמשכת ההליכה", reason: "Fix gender agreement ('הליכה' is feminine)." },
        { forbidden: "מתשע חדרים", preferred: "מתשעה חדרים", reason: "Fix gender agreement ('חדר' is masculine) - catch questions too." },
        { forbidden: "למוזיאונים", preferred: "למוזיאונים", reason: "Fix AI hallucination (Arabic letter 'ل' used instead of Hebrew 'ל')." },
        // === מינוחים מילוליים, ביטולים ורווחה ===
        { forbidden: "ביטול חופשי", preferred: "ביטול ללא דמי ביטול", reason: "Standardize translation of 'Free cancellation'." },
        { forbidden: "אזור רווחה", preferred: "מתחם בריאות", reason: "Fix archaic literal translation of 'Wellness area'." },
        { forbidden: "טיפולי רווחה", preferred: "טיפולי בריאות", reason: "Fix archaic literal translation of 'Wellness treatments'." },
        { forbidden: "מוגשת תה", preferred: "מוגש תה", reason: "Gender agreement: 'תה' is masculine." },
        { forbidden: "וטגניות", preferred: "טבעוניות", reason: "Fix AI typo/hallucination." },
        { forbidden: "חניה במקום", preferred: "חניה בשטח המלון", reason: "Avoid literal 'on-site' translation." },
        { forbidden: "המסייע למטיילים בינלאומיים", preferred: "", reason: "Remove marketing fluff about multilingual staff." },
        // === עריכות חדשות (מלון לאונרדו קלן) ===
        { forbidden: "אורחי פנאי", preferred: "תיירים", reason: "Fix literal translation of 'leisure guests'." },
        { forbidden: "שהיות למטרות פנאי", preferred: "חופשות", reason: "Fix literal translation of 'leisure stays'." },
        { forbidden: "בשלב זה", preferred: "כעת", reason: "More concise phrasing for 'at this time'." },
        { forbidden: "טרסה נופית", preferred: "מרפסת נוף", reason: "Fix awkward translation of 'scenic terrace'." },
        { forbidden: "מבקרים חיצוניים", preferred: "אורחים שאינם לנים במלון", reason: "Standardize polite phrasing for non-guests." },
        { forbidden: "ב-מלון", preferred: "במלון", reason: "Fix AI hyphenation glitch with Hebrew prefixes (ב-, ל-, מ-)." },
        { forbidden: "ל-מלון", preferred: "למלון", reason: "Fix AI hyphenation glitch." },
        { forbidden: "מ-מלון", preferred: "ממלון", reason: "Fix AI hyphenation glitch." },
        { forbidden: "ל-Wi-Fi", preferred: "ל-Wi-Fi", reason: "Exception to the prefix rule (keep hyphen for English words)." },
        { forbidden: "מזורזים", preferred: "מהירים", reason: "Use simpler 'מהיר' instead of 'מזורז' for express check-in." },
      { forbidden: "קיימות שקעים", preferred: "קיימים שקעים", reason: "Fix gender agreement ('שקע' is masculine)." },
      { forbidden: "כ-חמש", preferred: "כחמש", reason: "Fix spacing/hyphenation after prefixes." },
        { forbidden: "כ-קילומטר", preferred: "כקילומטר", reason: "Fix spacing/hyphenation after prefixes." },
        
        // תיקוני מינוח ספציפיים
        { forbidden: "ארוחות צוהריים", preferred: "ארוחות צהריים", reason: "Use standard Hebrew spelling." },
        { forbidden: "מכשירי קרדיו וכוח", preferred: "מכשירי אירובי וכוח", reason: "Use natural Hebrew fitness terminology." },
        { forbidden: "טרסת שיזוף", preferred: "מרפסת שמש", reason: "Use natural Hebrew terminology." },
        { forbidden: "נוהלי הקבלה", preferred: "נהלי הקבלה", reason: "Use standard Hebrew spelling." },
        
        // הסרת פלאף שיווקי נקודתי
        { forbidden: "וכך מבטיח תקשורת חלקה עבור אורחים מרחבי העולם", preferred: "", reason: "Remove marketing fluff about languages." },
        { forbidden: "מוארים באור יום, הכוללים טכנולוגיה עדכנית ומאפשרים אירועים של עד כ-200 משתתפים", preferred: "", reason: "Remove aggressive marketing fluff from FAQ answers unless strictly factual." }
      
      ],
    examples: [

      // === Examples for the specific final fixes ===
      // === דוגמאות מורחבות לסגנון מלונאי תקין בעברית ===
        {
            draft: "האם מלון לאונרדו גובה מס עירוני מאורחי פנאי?",
            polish: "האם מלון לאונרדו גובה מס עירוני מתיירים?",
            note: "Fixed literal translation of 'leisure guests'."
        },
        {
            draft: "מס עירוני חל על שהיות למטרות פנאי בעיר.",
            polish: "מס עירוני חל על חופשות בעיר.",
            note: "Fixed clunky translation of 'leisure stays'."
        },
        {
            draft: "האם שירות חדרים פועל 24 שעות ב-מלון לאונרדו קלן?",
            polish: "האם שירות חדרים פועל 24 שעות במלון לאונרדו קלן?",
            note: "Fixed AI glitch adding a hyphen after Hebrew prefixes (ב-מלון -> במלון)."
        },
        {
            draft: "האם קיימת במלון אפשרות לצ'ק-אין מזורז?",
            polish: "האם קיימת במלון אפשרות לצ'ק-אין מהיר?",
            note: "Used natural Hebrew 'מהיר' instead of formal 'מזורז'."
        },
        {
            draft: "האם יש במלון טרסה נופית?",
            polish: "האם יש במלון מרפסת נוף?",
            note: "Replaced awkward 'טרסה נופית' with natural 'מרפסת נוף'."
        },
        {
            draft: "מבקרים חיצוניים מוזמנים לסעוד במסעדה.",
            polish: "אורחים שאינם לנים במלון מוזמנים לסעוד במסעדה.",
            note: "Standardized polite terminology for non-guests."
        },
        {
            draft: "האם מבקרים מזדמנים יכולים להיכנס לבר?",
            polish: "האם אורחים שאינם לנים במלון יכולים להיכנס לבר?",
            note: "Standardized polite terminology for walk-in visitors."
        },
        {
            draft: "המלון מציע מתקני רווחה וטיפולי רווחה.",
            polish: "המלון מציע מתקני ספא ובריאות וטיפולי ספא.",
            note: "Fixed literal translation of 'wellness' (רווחה implies social welfare)."
        },
        {
            draft: "החדרים מצוידים במקלחת מרווחת עם כניסה שטוחה.",
            polish: "החדר כולל מקלחון מרווח.",
            note: "Replaced literal translation of 'walk-in shower' and removed industrial verb 'מצוידים'."
        },
        {
            draft: "זמינים חדרים מחוברים למשפחות.",
            polish: "זמינים חדרים עם דלת מקשרת למשפחות.",
            note: "Replaced literal translation with standard hospitality term 'Interconnecting rooms'."
        },
     
        {
            draft: "בעת ההגעה נלקחת הרשאת אשראי או ערבות בכרטיס אשראי.",
            polish: "בעת ההגעה נלקחת תפיסת מסגרת בכרטיס האשראי לביטחון.",
            note: "Standardized pre-authorization and deposit terminology."
        },
        {
            draft: "ניתן להזמין כרטיסים דרך הקונקורס של המלון.",
            polish: "ניתן להזמין כרטיסים דרך דלפק הקונסיירז'.",
            note: "Fixed hallucinated transliteration."
        },
        {
            draft: "האם מוגשת תה מנחה במלון?",
            polish: "האם מוגש תה מנחה במלון?",
            note: "Fixed masculine/feminine agreement (תה is masculine)."
        },

      {
            draft: "האם מוגשת תה מנחה במלון?",
            polish: "האם מוגש תה מנחה במלון?",
            note: "Fixed masculine/feminine agreement for the word 'תה'."
        },
        {
            draft: "האם קיימים תעריפים הכוללים ביטול חופשי?",
            polish: "האם קיימים תעריפים הכוללים ביטול ללא דמי ביטול?",
            note: "Replaced literal 'Free cancellation' with standard hospitality phrasing."
        },
        {
            draft: "האם המלון מציע אזור רווחה או טיפולי רווחה?",
            polish: "האם המלון מציע מתחם בריאות או טיפולי בריאות?",
            note: "Replaced archaic literal translation of 'Wellness' with natural Hebrew."
        },
      {
            draft: "האם המלון הוא ללא עישון ב-100%?",
            polish: "האם המלון הוא ללא עישון לחלוטין?",
            note: "Replaced literal '100%' with standard Hebrew phrasing."
        },
        {
            draft: "ניתן להזמין חדרים ללא מכשולים...",
            polish: "ניתן להזמין חדרים נגישים...",
            note: "Fixed literal translation of 'barrier-free'."
        },
        {
            draft: "כמה זמן נמשך ההליכה לפארק?",
            polish: "כמה זמן נמשכת ההליכה לפארק?",
            note: "Fixed masculine/feminine agreement for the word 'הליכה'."
        },
        {
            draft: "ההליכה לפארק אורכת כ-10 דקות נעימות.",
            polish: "ההליכה לפארק אורכת כ-10 דקות.",
            note: "Removed unnecessary marketing fluff from directions."
        },
        {
            draft: "דלפק הקבלה ישמח לספק טיפים מקומיים לכל מוקדי העניין בעיר.",
            polish: "דלפק הקבלה ישמח לספק המלצות לכל מוקדי העניין בעיר.",
            note: "Replaced literal 'local tips' with natural 'המלצות'."
        },
        {
            draft: "חלל המסעדה בעל האווירה מארח ארוחות מיוחדות.",
            polish: "חלל המסעדה מארח ארוחות מיוחדות.",
            note: "Removed clunky literal translation of 'atmospheric'."
        },
        {
            draft: "הצ׳ק-אין מתחיל החל מהשעה 15:00, והצ׳ק-אאוט מתבקש עד 12:00 בצוהריים.",
            polish: "הצ'ק-אין מתחיל ב-15:00, והצ'ק-אאוט הוא עד 12:00 בצהריים.",
            note: "Removed redundant phrasing and softened the check-out request."
        },
        {
            draft: "במלון 95 חדרי אירוח וסוויטות בעיצוב עכשווי.",
            polish: "במלון 95 חדרי אירוח וסוויטות בעיצוב מודרני.",
            note: "Replaced 'עכשווי' with 'מודרני'."
        },
        {
            draft: "צוות הדובר מגוון שפות, בהם הולנדית, אנגלית...",
            polish: "צוות הדובר מגוון שפות, בהן הולנדית, אנגלית...",
            note: "Fixed gender agreement for 'שפות'."
        },
        {
            draft: "האם מלון ליאונרדו דורש פיקדון בטחון ניתן להחזר בעת הצ'ק-אין?",
            polish: "האם מלון ליאונרדו גובה פיקדון הנגבה בעת הצ'ק-אין ומוחזר בעת העזיבה?",
            note: "Fixed a broken literal translation regarding deposit timing."
        },
        {
            draft: "האורחים יכולים להתרווח בטרסה החיצונית המוארת בשמש עם משקאות מן הבר.",
            polish: "האורחים יכולים להתרווח בטרסה החיצונית עם משקאות מן הבר.",
            note: "Removed unnecessary marketing fluff ('המוארת בשמש')."
        },
        {
            draft: "צוות הקבלה ישמח לארגן כרטיסים והמלצות פנימיות למוזיאונים...",
            polish: "צוות הקבלה ישמח לארגן כרטיסים והמלצות למוזיאונים...",
            note: "Removed literal translation of 'insider recommendations'."
        },

      // === Examples for Contextual Fixes ===
        {
            draft: "במלון זמינה רשת Wi-Fi מהירה וחינמית בכל שטחי המלון...",
            polish: "במלון זמינה רשת Wi-Fi מהירה ללא תשלום בכל שטחי המלון...",
            note: "Replaced casual 'חינמית' with professional 'ללא תשלום'."
        },
        {
            draft: "שירות חדרים מקיף פועל 24 שעות ביממה להזמנות מזון או כל בקשה נוחה.",
            polish: "שירות חדרים פועל 24 שעות ביממה להזמנת אוכל ומשקאות.",
            note: "Fixed nonsensical literal translation."
        },
        {
            draft: "ניתן להזמין מראש חדרים נגישים הכוללים תכונות חסרות מכשולים.",
            polish: "ניתן להזמין מראש חדרים המותאמים במלואם לאורחים עם מוגבלויות.",
            note: "Fixed literal translation of 'barrier-free features'."
        },
        {
            draft: "מגהצים וקרשי גיהוץ נשלחים במהירות לחדרי האורחים על-פי בקשה.",
            polish: "ניתן לקבל מגהץ וקרש גיהוץ לחדר על פי בקשה.",
            note: "Smoothed out robotic delivery phrasing."
        },
     
        {
            draft: "כן, בשמחה מותאמות ארוחות לצמחונים...",
            polish: "כן, הצוות ישמח להתאים ארוחות לצמחונים...",
            note: "Improved clunky passive phrasing."
        },
        {
            draft: "כדי לבצע צ'ק-אין ולקבל מפתחות ב-מלון לאונרדו...",
            polish: "כדי לבצע צ'ק-אין ולקבל את מפתח החדר במלון לאונרדו...",
            note: "Fixed incorrect prefix dash and translated 'keys' naturally to singular."
        },
        {
            draft: "כמה זמן נמשך בערך הנסיעה במטרו... אורכת כ-11-12 דקות",
            polish: "כמה זמן נמשכת הנסיעה במטרו... אורכת כ-11 עד 12 דקות",
            note: "Fixed grammar (נמשכת) and replaced short hyphen for time ranges."
        },

      {
            draft: "חדרי הרחצה כוללים מוצרי טיפוח אקולוגיים ללא תשלום, מגבות טריות ומקלחון גשם.",
            polish: "חדרי הרחצה כוללים מוצרי טיפוח אקולוגיים ללא תשלום, מגבות נקיות ומקלחון גשם.",
            note: "Fixed literal translation of 'fresh towels'."
        },
        {
            draft: "בכל החדרים יש קומקום חשמלי עם שקיות תה וכמוסות קפה ללא תשלום.",
            polish: "בכל החדרים יש קומקום חשמלי עם שקיות תה וקפסולות קפה ללא תשלום.",
            note: "Replaced medical term 'כמוסות' with standard 'קפסולות'."
        },
        {
            draft: "אילו מתקני שתייה זמינים בחדרי המלון...",
            polish: "איזה ציוד להכנת תה וקפה זמין בחדרי המלון...",
            note: "Replaced awkward 'מתקני שתייה' with natural terminology and adjusted verb agreement."
        },
        {
            draft: "כמה חדרי אירוח כוללים במלון לאונרדו...",
            polish: "כמה חדרי אירוח יש במלון לאונרדו...",
            note: "Fixed awkward syntax."
        },
        {
            draft: "כאשר מזמינים יותר מתשע חדרים חלים תנאים שונים.",
            polish: "כאשר מזמינים יותר מתשעה חדרים חלים תנאים שונים.",
            note: "Fixed masculine/feminine number agreement."
        },
      
      {
            draft: "תינוקות עד גיל שנתיים שוהים ללא תשלום בעריסה.",
            polish: "תינוקות עד גיל שנתיים מתארחים ללא תשלום נוסף (ניתן לקבל עריסה).",
            note: "Improved word order and logical flow for baby cot policy."
        },

        {
            draft: "מהם זמני הצ'ק-אין והצ'ק-אאוט הסטנדרטיים...",
            polish: "מהם זמני הצ'ק-אין והצ'ק-אאוט...",
            note: "Removed unnecessary robotic word 'הסטנדרטיים'."
        },
        {
            draft: "האם דלפק הקבלה במלון פועל 24 שעות ביממה לטובת האורחים?",
            polish: "האם דלפק הקבלה במלון פועל 24 שעות ביממה?",
            note: "Removed redundant phrasing 'לטובת האורחים'."
        },
        {
            draft: "כן, חניה חיצונית מאובטחת זמינה במלון בעלות של €12.50 לרכב, ללילה.",
            polish: "כן, חניה חיצונית מאובטחת זמינה במלון בעלות של €12.50 ללילה, לרכב.",
            note: "Fixed comma placement and word order for pricing."
        },
        {
            draft: "האם המלון מעמיד עמדות טעינה לרכבים חשמליים במגרש החניה?",
            polish: "האם יש במלון עמדות טעינה לרכבים חשמליים במגרש החניה?",
            note: "Replaced formal 'מעמיד' with natural 'יש'."
        },
        {
            draft: "כל המבנה מוגדר ללא-עישון; העישון במקומות סגורים אסור לחלוטין.",
            polish: "כל המבנה מוגדר ללא-עישון. העישון במקומות סגורים אסור לחלוטין.",
            note: "Replaced semicolon with a period for better flow."
        },
        {
            draft: "במלון 86 חדרי אירוח וסוויטות מעוצבים בסך הכול.",
            polish: "במלון ישנם 86 חדרי אירוח וסוויטות מעוצבים.",
            note: "Removed literal 'בסך הכול' from the end of the sentence."
        },
        {
            draft: "האם טלוויזיות מסך שטוח עם ערוצי כבלים כלולות כסטנדרט בכל חדר?",
            polish: "האם כל החדרים כוללים טלוויזיות מסך שטוח עם ערוצי כבלים?",
            note: "Removed 'כסטנדרט' and improved question flow."
        },
        {
            draft: "חדרי האמבטיה מצוידים במוצרי טיפוח...",
            polish: "חדרי האמבטיה כוללים מוצרי טיפוח...",
            note: "Replaced stiff 'מצוידים' with natural 'כוללים'."
        },
        {
            draft: "אילו קטגוריות חדרים במלון מבטיחות נוף ישיר לאגם?",
            polish: "אילו סוגי חדרים במלון מציעים נוף ישיר לאגם?",
            note: "Rooms 'offer' views, they don't 'guarantee' (מבטיחות) them."
        },
        {
            draft: "אחריות מזוודות ללא תשלום זמין לאורחים המגיעים מוקדם או יוצאים מאוחר בדלפק הקבלה.",
            polish: "אחסון מזוודות ללא תשלום זמין בדלפק הקבלה עבור אורחים המגיעים מוקדם או יוצאים מאוחר.",
            note: "Fixed awkward syntax putting 'at the front desk' at the end of the sentence."
        },
        {
            draft: "תינוקות עד גיל שנתיים שוהים ללא תשלום בעריסה.",
            polish: "תינוקות עד גיל שנתיים יכולים לשהות בעריסה ללא תשלום נוסף.",
            note: "Improved word order for clarity."
        },
        {
            draft: "האם מתקני ספורט ימי זמינים במקום במלון?",
            polish: "האם מתקני ספורט ימי זמינים במלון?",
            note: "Removed redundant 'במקום במלון'."
        },
        {
            draft: "האם מסופקים מיטות שיזוף ומטריות...",
            polish: "האם ישנן מיטות שיזוף ומטריות...",
            note: "Fixed gender agreement and avoided stiff 'מסופקים'."
        },
        {
            draft: "יש להשלים את הצ'ק-אאוט עד 12:00 בצהריים לפני חצות היום.",
            polish: "הצ'ק-אאוט הוא עד השעה 12:00 בצהריים.",
            note: "Remove 'חצות היום' and 'יש להשלים'. Use standard hotel time format."
        },
        {
            draft: "האם יש צוות רב-לשוני במלון?",
            polish: "האם יש במלון צוות הדובר מגוון שפות?",
            note: "Use more natural conversational Hebrew."
        },
        {
            draft: "בעת ההגעה מבוצעת הרשאה מוקדמת בכרטיס האשראי...",
            polish: "בעת ההגעה מבוצעת תפיסת מסגרת בכרטיס האשראי...",
            note: "Use standard industry term 'תפיסת מסגרת' for pre-authorization."
        },
        {
            draft: "בימי שישי ושבת מתארחים במקום תקליטנים תושבי קבע...",
            polish: "בימי שישי ושבת מתארחים במקום תקליטנים קבועים...",
            note: "Avoid literal translation of 'resident DJs'."
        },
        {
            draft: "המלון נמצא במרחק של כ-1.1 ק״מ מתחנת הרכבת — כעשר דקות הליכה.",
            polish: "המלון נמצא במרחק של כ-1.1 ק״מ מתחנת הרכבת - כעשר דקות הליכה.",
            note: "Ensure standard dashes (-) are used instead of long dashes (—)."
        },
        {
            draft: "ניתן להשתמש בחניון התת-קרקעי הציבורי הפועל באופן עצמאי מתחת למלון...",
            polish: "ניתן להשתמש בחניון ציבורי הממוקם מתחת למלון...",
            note: "Smoothed out the literal translation of 'independently operated public underground garage'."
        },
        {
            draft: "הגעה מוקדמת או עזיבה מאוחרת אפשריות בכפוף לזמינות ועלולות לגרור תשלום סמלי.",
            polish: "הגעה מוקדמת או עזיבה מאוחרת אפשריות בכפוף לזמינות ועשויות להיות כרוכות בתוספת תשלום סמלית.",
            note: "Replaced negative sounding 'לגרור' with standard hospitality phrasing for extra fees."
        },
        {
            draft: "האם המלון מעניק חיבור Wi-Fi...",
            polish: "האם המלון מציע חיבור Wi-Fi...",
            note: "Replaced overly formal 'מעניק' with 'מציע'."
        },
        {
            draft: "האם שירות משק בית יומי במלון מתבצע רק לפי בקשה?",
            polish: "האם שירות ניקיון החדרים היומי במלון מתבצע רק לפי בקשה?",
            note: "Standard hospitality term for housekeeping. Grammar fixed to form a full sentence."
        },
        {
            draft: "האם המלון פועל כמתחם ללא מזומן...",
            polish: "האם המלון אינו מקבל מזומן...",
            note: "Avoid literal 'cashless property' translation."
        },
        {
            draft: "האם קיימת מכונת מכירה אוטומטית לחטיפים ומשקאות הפועלת 24 שעות במלון?",
            polish: "האם קיימת מכונת חטיפים ומשקאות הפועלת 24 שעות במלון?",
            note: "Use 'מכונת חטיפים' instead of literal 'מכונת מכירה אוטומטית' (vending machine)."
        },
        {
            draft: "חיות מחמד אינן מורשות...",
            polish: "לא ניתן להכניס חיות מחמד...",
            note: "More natural Hebrew phrasing for prohibitions."
        },
        {
            draft: "האם בחדרים יש מכונת קפה נספרסו או דומה?",
            polish: "האם בחדרים יש מכונת קפה של נספרסו או מותג מקביל?",
            note: "Refined 'or similar' to be more natural in a brand context."
        },
        {
            draft: "החדרים מצוידים במערכות בקרת אקלים.",
            polish: "בחדרים קיימת מערכת לבקרת טמפרטורה.",
            note: "Use 'בקרת טמפרטורה' for a less technical, more hospitality-oriented feel."
        },
        {
            draft: "האם המלון מציע חניה באתר?",
            polish: "האם קיימת חניה בשטח המלון?",
            note: "Replace 'באתר' (on-site) with 'בשטח המלון' or 'במקום'."
        },
        {
            draft: "תוכלו לקבל שקית ארוחת בוקר בצאתכם.",
            polish: "ניתן לקבל ארוחת בוקר ארוזה בצאתכם.",
            note: "Replace 'bag' (שקית) with professional 'packed meal' (ארוחה ארוזה) terminology."
        },
        {
            draft: "הבר מקרין משחקי ספורט חיים.",
            polish: "הבר מציע שידורי ספורט ישירים.",
            note: "Avoid literal translation of 'Live'. Use 'שידורים ישירים'."
        },
        {
            draft: "כמה זמן נמשך הנסיעה ברכבת?",
            polish: "כמה זמן נמשכת הנסיעה ברכבת?",
            note: "Grammar correction: 'נמשכת' (feminine) to match 'נסיעה'."
        },
        {
            draft: "האם נדרש פיקדון ביטחון?",
            polish: "האם נדרש פיקדון בעת הצ'ק-אין?",
            note: "Simplify 'פיקדון ביטחון' to 'פיקדון'."
        },
        {
            draft: "האם במלון קיימת מטבחון אורחים להכנת נשנושים עצמאית?",
            polish: "האם במלון יש מטבחון לשימוש האורחים?",
            note: "Fixed gender agreement (קיימת -> יש) and awkward 'independent snacks' syntax."
        },
        {
            draft: "מטריות זמינות כדי שהאורחים יישארו יבשים במזג אוויר גשום.",
            polish: "מטריות זמינות בדלפק הקבלה לשימוש האורחים בימים גשומים.",
            note: "Corrected literal 'stay dry' (יישארו יבשים) to a natural service description."
        },
        {
            draft: "נשמח לארגן מונית אמינה או שירות העברה פרטי.",
            polish: "נשמח להזמין עבורכם מונית או הסעה פרטית.",
            note: "Professional terminology update based on original agent draft."
        },
        {
            draft: "האם ניתן לבקש ארוחת בוקר מוקדמת לפני 07:00?",
            polish: "האם ניתן לקבל ארוחת בוקר לפני השעה 07:00?",
            note: "Natural question structure for early breakfast."
        },
        {
            draft: "נגבה מס עירוני באמסטרדם בשיעור 12.5%.",
            polish: "המס העירוני באמסטרדם הינו בשיעור של 12.5% מעלות הלינה.",
            note: "More professional and less aggressive phrasing."
        },
        {
            draft: "תנאי הביטול תלויים בתכנית התעריף שנבחרה.",
            polish: "תנאי הביטול והתשלום מראש משתנים בהתאם לסוג התעריף שנבחר בעת ההזמנה.",
            note: "Improved clarity for 'rate plan' and 'pre-payment conditions'."
        },
        {
            draft: "נסיעה בשירות שיתופי אורכת לרוב 30 דקות.",
            polish: "נסיעה בהסעה משותפת אורכת לרוב כ-30 דקות.",
            note: "Use 'הסעה משותפת' for rideshare/shuttle services."
        },
        // === Examples for Contextual Fixes ===
        {
            draft: "הצ'ק-אין מתחיל רשמית ב-15:00, ואילו הצ'ק-אאוט נדרש לכל המאוחר עד 12:00 בצהריים.",
            polish: "הצ'ק-אין מתחיל ב-15:00, והצ'ק-אאוט הוא עד 12:00 בצהריים.",
            note: "Removed 'officially' and softened the strict check-out phrasing."
        },
        {
            draft: "אורחים המגיעים בשעות מאוחרות מתבקשים לתאם גישה מראש; אורחים...",
            polish: "אורחים המגיעים בשעות מאוחרות מתבקשים לתאם גישה מראש. אורחים...",
            note: "Replaced semicolon (;) with a period for standard Hebrew punctuation."
        },
        {
            draft: "האם מלון לאונרדו מספק השכרת אופניים לחקר האזור? כן, ניתן להשכיר אופניים...",
            polish: "האם מלון לאונרדו מספק השכרת אופניים לסיור באזור? כן, ניתן לשכור אופניים...",
            note: "Fixed grammar (guests 'שוכרים', not 'משכירים') and replaced literal 'explore the area'."
        },
        {
            draft: "כן, ניתן לארגן העברות פרטיות על פי בקשה, ורכבות סדירות מגיעות לסכיפהול בכ-שעה.",
            polish: "כן, ניתן לארגן הסעה פרטית על פי בקשה, ורכבות סדירות מגיעות לסכיפהול בתוך כשעה.",
            note: "Used natural terminology for private transfers and fixed awkward time formatting."
        },
        {
            draft: "במלון לאונרדו פועלים שלושה מוקדי קולינריה: גריל בינלאומי ובית קפה קז'ואלי.",
            polish: "במלון לאונרדו פועלות שלוש מסעדות: גריל בינלאומי ובית קפה באווירה קלילה.",
            note: "Replaced pretentious 'culinary hubs' and translated 'casual' naturally."
        },
        {
            draft: "ארוחת הבוקר מוגשת בין 07:00 ל-11:00, כדי לאפשר גמישות למקדימי קום ולמאחרים.",
            polish: "ארוחת הבוקר מוגשת מדי יום בין 07:00 ל-11:00.",
            note: "Removed unnecessary marketing fluff."
        },
        
    ]
},
    zh: { mappings: [], examples: [] },
    ar: { mappings: [
{
      forbidden: "عقار",
      preferred: "مكان الإقامة / المنشأة",
      reason: "In Arabic, 'عقار' sounds like real estate/investment. 'مكان الإقامة' is the standard hospitality term for a hotel property."
    },
    {
      forbidden: "دش مشي",
      preferred: "مقصورة دش",
      reason: "Literal translation of 'Walk-in shower'. 'مقصورة دش' describes the physical structure correctly."
    },
    {
      forbidden: "منطقة عافية",
      preferred: "مركز استجمام / سبا",
      reason: "Literal translation of 'Wellness'. 'استجمام' (Relaxation/Rejuvenation) is the industry standard."
    },
    {
      forbidden: "في كل إقامة",
      preferred: "في جميع وحدات الإقامة",
      reason: "As noted in your examples, 'إقامة' refers to the stay (duration), not the room (unit)."
    },
    {
      forbidden: "غرفة نزلاء",
      preferred: "غرف النזلاء",
      reason: "Arabic hospitality phrasing prefers the plural 'غرف' to indicate the feature is available across the entire inventory."
    },
    {
      forbidden: "تجريد بوفيه",
      preferred: "بوفيه مفتوح",
      reason: "AI sometimes mistranslates 'Buffet spread'. 'بوفيه مفتوح' is the most natural term for guests."
    },
    {
      forbidden: "سياسة الأليفة",
      preferred: "سياسة اصطحاب الحيوانات الأليفة",
      reason: "AI often drops the noun 'Animals'. 'الأليفة' alone is just an adjective meaning 'friendly' or 'tame'."
    },
    {
      forbidden: "مكتب تأجير سيارات",
      preferred: "مكتب لتأجير السيارات",
      reason: "Grammatical correction for better flow (Idafa structure) in formal Arabic."
    },
    {
      forbidden: "חובה לעשות",
      preferred: "يرجى العلم بأن / يتعين على الضيوف",
      reason: "AI can be too aggressive/commanding. Luxury hospitality uses 'Please note' or 'Guests are kindly required to'."
    },
    {
      forbidden: "פלאף שיווקי: פשוט מושלם",
      preferred: "خيار مثالي لإقامة مريحة",
      reason: "Removing marketing fluff like 'Simply perfect' and replacing it with grounded, professional descriptions."
    },
    {
      forbidden: "وديعة أمنية",
      preferred: "مبلغ تأمين مسترد",
      reason: "AI often uses 'Security Deposit' in a rental/legal sense. In hotels, 'مبلغ تأمين مسترد' is clearer for guests."
    },
    {
      forbidden: "عرضיות",
      preferred: "النفقات النثرية / المصاريف الإضافية",
      reason: "Literal translation of 'Incidentals'. In a hotel context, we refer to them as extra expenses or 'Nathriyyat'."
    },
    {
      forbidden: "تحت إشراف الكبار",
      preferred: "برفقة ذويهم / تحت إشراف ذويهم",
      reason: "Addressing families: 'Adults' sounds clinical. 'ذويهم' (their kin/guardians) is much warmer and professional."
    },
    {
      forbidden: "فندق صديק للعائلات",
      preferred: "فندق مناسب للعائلات",
      reason: "Literal translation of 'Family-friendly'. 'مناسب' (Suitable) or 'يرحب بالعائلات' (Welcomes families) is more natural."
    },
    {
      forbidden: "تناول الطعام في البحيرة",
      preferred: "تناول الطعام بجانب البحيرة",
      reason: "AI sometimes says 'Dining IN the lake'. 'بجانב' or 'بإطلالة على' (with a view of) is the correct prepositional use."
    },
    {
      forbidden: "نظام مناخ فردי",
      preferred: "تحكم فردي مستقل في درجة الحرارة",
      reason: "Climate control shouldn't be 'Individual Climate'. It should refer to the guest's ability to control their room temperature."
    },
    {
      forbidden: "حافلة המלון המהירה",
      preferred: "حافلة النقل التابعة للفندق",
      reason: "Shuttle is often mistranslated. 'حافلة النقل' is the standard term for hotel transport services."
    },
    {
      forbidden: "במרחק הליכה",
      preferred: "على بُعد مسافة قصيرة سيرًا على الأقدام",
      reason: "The phrase 'Walking distance' needs the full Arabic expression to sound high-end."
    },
    {
      forbidden: "מרכז כושר",
      preferred: "نادي رياضي / صالة لياقة بدنية",
      reason: "AI uses 'Fitness Center'. Most Arab guests look for 'Nadi Riyadi' (Sports Club) or 'Sala' (Gym/Hall)."
    },
    {
      forbidden: "תיירות מודרכת",
      preferred: "جولات سياحية منظمة",
      reason: "Guided tours are 'Organized' (Munazzama) in professional travel Arabic, not just 'Guided' (Mo'awaja)."
    },
    {
      forbidden: "فعاليات تجارية",
      preferred: "فعاليات الأعمال / فعاليات مهنية",
      reason: "'Tijariya' sounds like sales/trading. 'A'mal' or 'Mihniya' covers the broader corporate spectrum of meetings and conferences."
    },
    {
      forbidden: "أرض معارض",
      preferred: "مركز معارض",
      reason: "'Ard' literally means 'land/ground'. 'Markaz' (Center) is the modern professional term for exhibition venues."
    },
    {
      forbidden: "لا، تتوفر خدمة غرف",
      preferred: "تتوفر خدمة الغرف، ولكنها לא تعمل على مدار الساعة",
      reason: "Starting with 'No' is jarring. Acknowledge the service first, then clarify the hours for a better guest experience."
    },
    {
      forbidden: "يتميز بالملاءمة لزيارة",
      preferred: "موقع مثالي لزيارة / يوفر وصولاً سهلاً إلى",
      reason: "The draft phrase is overly formal and 'heavy'. 'Ideal location' or 'Easy access' is much more natural for a tourist."
    },
    {
      forbidden: "آلات البيع",
      preferred: "آلات بيع ذاتية لخدمة الضيوف",
      reason: "Adding 'Self-service' and 'for guest use' makes the amenity sound like a feature rather than just a machine."
    },
    {
      forbidden: "أحجام الحصص",
      preferred: "كمية الوجبات / حجم الوجبة",
      reason: "'Hissas' sounds like 'shares' or 'rations'. 'Hajm al-wajba' is the correct culinary term for portion size."
    },
    {
      forbidden: "الخدمة المجانية للمطار",
      preferred: "حافلة نقل المطار المجانية",
      reason: "AI often misses that 'Shuttle' implies a vehicle (bus/van). Explicitly using 'Hafila' (Bus) is clearer."
    },
    {
      forbidden: "مواقع ترفيهית",
      preferred: "وجهات ترفيهية",
      reason: "'Mawaqi' sounds like 'sites' (often construction or web). 'Wijhat' (Destinations) sounds like travel."
    }

    ], examples: [
{
      draft: "هل يوجد ميني بار في كل إقامة؟",
      polish: "هل يتوفر ميني بار في جميع وحدات الإقامة؟",
      note: "Corrected 'stay' to 'accommodation units' and used 'Available' (يتوفر) which is more professional than 'Exists' (يوجد)."
    },
    {
      draft: "العقار ليس لديه مسبח.",
      polish: "لا تتوفر مرافق مسبح في هذه المنشأة الفندقية.",
      note: "Changed 'Property/Real Estate' to 'Hotel Facility' and improved the negative sentence structure for a luxury tone."
    },
    {
      draft: "نحن نقدم دش مشי לכל החדרים.",
      polish: "تتميز جميع الغرف بوجود مقصورة دش عصرية.",
      note: "Removed literal 'Walk-in' and used 'Features' (تتميز) to elevate the brand voice."
    },
    {
      draft: "هل يسمح للأطفال بالأكل في البار؟",
      polish: "هل يُسمح للأطفال بتناول الطعام في منطقة البار؟",
      note: "Improved 'Eating' to 'Dining' (تناول الطعام) and added 'Area' for a more professional structure."
    },
    {
      draft: "يوجد غابة كبيرة قريبة للركض.",
      polish: "يقع الفندق بجوار مساحات خضراء شاسعة توفر مسارات مثالية للركض.",
      note: "Replaced the dry 'Large forest nearby' with 'Vast green spaces' to enhance the marketing appeal of the Stadtwald location."
    },
    {
      draft: "يجب عليك دفع تأمين عند الدخول.",
      polish: "يرجى العلم بأنه قد يُطلب تفويض مسبق على بطاقة הائتمان عند تسجيل الوصول.",
      note: "Turned a demanding 'You must pay' into a polite 'Please note that a pre-authorization may be requested'."
    },
    {
      draft: "لا توجد قائمة أطفال منفصلة.",
      polish: "لا تتوفر قائمة طعام مخصصة للأطفال، ولكن يسعد مطعمنا بتعديل حجم الوجبات لتناسب صغاركم.",
      note: "Turned a negative 'No menu' into a positive service-oriented offering."
    },
    {
      draft: "الفندق قريب من أرض معارض كولنميسه.",
      polish: "يتمتع الفندق بموقع قريب من مركز معارض كولنميسه الشهير.",
      note: "Used 'Markaz' instead of 'Ard' and added 'Famous/Renowned' (Al-Shahir) to elevate the property's prestige."
    },
    {
      draft: "هل موقع الفندق يتميز במلاءمة לزيارة بون؟",
      polish: "هل يعد موقع الفندق مناسباً لزيارة معالم مدينة بون؟",
      note: "Simplified the syntax to sound like a human-written question rather than a direct translation."
    }


    ] },
};