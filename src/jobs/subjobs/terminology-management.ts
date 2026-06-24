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
    // Stay-master identity - client hard rules

    {
      forbidden: "Was genau ist master St. Paul’s - Hotel, Aparthotel oder Serviced Apartments?",
      preferred: "Was genau ist master St. Paul’s - ein Hotel, Aparthotel oder eine Unterkunft mit Serviced Apartments?",
      reason: "Client-approved question structure.",
    },

    // Apartment / unit wording
    {
      forbidden: "Einheiten",
      preferred: "Wohnungen",
      reason: "Avoid literal 'units'. In stay-master guest-facing German, use 'Wohnungen' for the apartments.",
    },
    {
      forbidden: "Einheit",
      preferred: "Wohnung",
      reason: "Avoid literal 'unit'. Use 'Wohnung' when referring to the guest apartment.",
    },
    {
      forbidden: "alle Apartments",
      preferred: "alle Wohnungen",
      reason: "Client prefers 'Wohnungen' in answers for the apartment units.",
    },
    {
      forbidden: "Die Apartments",
      preferred: "Die Wohnungen",
      reason: "Use 'Wohnungen' in descriptive answers for stay-master.",
    },
    {
      forbidden: "in den Apartments",
      preferred: "in den Wohnungen",
      reason: "Use 'Wohnungen' for the guest units.",
    },
    {
      forbidden: "Apartment-Grundrisse",
      preferred: "großzügigen Apartment-Grundrisse",
      reason: "Client correction for extended-stay answer wording.",
    },
    {
      forbidden: "Apartment-PIN-Code",
      preferred: "Apartment-PIN-Code",
      reason: "Keep this wording unchanged when referring to the access code.",
    },

    // Laundry / housekeeping
    {
      forbidden: "Wäscherei",
      preferred: "Wäschemöglichkeiten",
      reason: "When referring to laundry facilities rather than a laundry service, 'Wäschemöglichkeiten' is more accurate.",
    },
    {
      forbidden: "Wasch-Trockner",
      preferred: "Waschmaschine mit Trocknerfunktion",
      reason: "More natural German for washer-dryer in the apartment.",
    },
    {
      forbidden: "Wasch-Trockner-Einheiten",
      preferred: "eigene Waschmaschine mit Trocknerfunktion",
      reason: "Client correction: avoid literal 'units'.",
    },
    {
      forbidden: "private Wasch-Trockner",
      preferred: "eigene Waschmaschinen mit Trocknerfunktion",
      reason: "Client correction for long-stay answer.",
    },
    {
      forbidden: "Wäscheeinrichtungen",
      preferred: "Waschmöglichkeiten",
      reason: "More natural German for guest laundry facilities.",
    },
    {
      forbidden: "Wie häufig erfolgt die Reinigung",
      preferred: "Wie oft wird bei master St. Paul’s gereinigt?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Reinigung ist inbegriffen",
      preferred: "Ein Reinigungsservice ist inklusive",
      reason: "More natural hospitality phrasing.",
    },
    {
      forbidden: "Zusätzliche Reinigungen können gegen Gebühr gebucht werden.",
      preferred: "",
      reason: "Client correction removed this sentence from the fixed answer. Do not include fee wording unless explicitly required by source.",
    },

    // Guest support / reception / concierge
    {
      forbidden: "Rezeption",
      preferred: "Gästesupport",
      reason: "For master St. Paul’s, avoid implying an on-site reception unless referring to the nearby Leonardo Hotel.",
    },
    {
      forbidden: "24-Stunden-Rezeption",
      preferred: "Gästesupport rund um die Uhr",
      reason: "master St. Paul’s does not have an on-site 24-hour reception.",
    },
    {
      forbidden: "Self-Check-in-System",
      preferred: "kontaktloses Check-in-System",
      reason: "Client-approved wording for the check-in process.",
    },
    {
      forbidden: "Wie erfolgt der Check-in in master St. Paul’s?",
      preferred: "Wie funktioniert der Check-in im master St. Paul’s?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Ein Mitarbeitender überprüft Ihre Buchung und hilft weiter.",
      preferred: "Ein Mitarbeiter unseres Teams überprüft Ihre Buchung und hilft Ihnen weiter.",
      reason: "Client correction for access-code support wording.",
    },
    {
      forbidden: "Guest-Relations-Team",
      preferred: "Guest-Relations-Team",
      reason: "Keep official team label unchanged if already used.",
    },

    // Workspace / business
    {
      forbidden: "arbeitsfreundliche Tische",
      preferred: "Tische, die sich gut zum Arbeiten eignen",
      reason: "Avoid literal phrasing. This sounds more natural in German hospitality copy.",
    },
    {
      forbidden: "Remote-Worker",
      preferred: "Gäste, die remote arbeiten",
      reason: "Avoid unnecessary English terms in German guest-facing copy.",
    },
    {
      forbidden: "Arbeits- oder Co-Working-Bereich",
      preferred: "Arbeitsbereich oder Co-Working-Bereich",
      reason: "More natural phrasing in German FAQ questions.",
    },
    {
      forbidden: "Tisch oder Arbeitsbereich",
      preferred: "Arbeitsbereich mit Arbeitstisch",
      reason: "Client correction for business-travel answer.",
    },
    {
      forbidden: "Tisch bzw. Schreibtisch",
      preferred: "Tisch bzw. Schreibtisch",
      reason: "Keep this wording for remote-work answers when no dedicated co-working area exists.",
    },

    // Utilities / fees / taxes
    {
      forbidden: "Sind Nebenkosten wie WLAN, Strom und Wasser im Übernachtungspreis von master St. Paul’s enthalten?",
      preferred: "Sind WLAN, Strom und Wasser im Übernachtungspreis von master St. Paul’s enthalten?",
      reason: "Client-approved question phrasing. Avoid 'Nebenkosten' here.",
    },
    {
      forbidden: "Gemeindesteuern",
      preferred: "lokale Steuern und Gebühren",
      reason: "'Council taxes' should not be translated literally as 'Gemeindesteuern' in guest-facing copy.",
    },
    {
      forbidden: "ohne Aufpreis in jedem Übernachtungspreis enthalten",
      preferred: "ohne Aufpreis im Übernachtungspreis enthalten",
      reason: "Client-approved smoother wording.",
    },
    {
      forbidden: "kostenlos",
      preferred: "kostenfrei",
      reason: "Preferred wording in polished hospitality communication.",
    },

    // Booking / URL / contact
    {
      forbidden: "https://www.stay-master.com/",
      preferred: "https://www.stay-master.de/",
      reason: "Use the German website URL in German FAQ content when referring to direct booking.",
    },
    {
      forbidden: "info@staymaster.com",
      preferred: "info@stay-master.com",
      reason: "Fix incorrect email address. Official email includes a hyphen.",
    },
    {
      forbidden: "Wie ist die direkte Telefonnummer von master St. Paul’s?",
      preferred: "Wie lautet die Telefonnummer von master St. Paul’s?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "+443308187011",
      preferred: "+44 330 818 7011",
      reason: "Use readable phone formatting in German guest-facing copy.",
    },

    // Location / transport
    {
      forbidden: "wie nah ist es an der St Paul’s Cathedral",
      preferred: "wie weit ist es von der St Paul’s Cathedral entfernt",
      reason: "Client-approved phrasing for distance questions.",
    },
    {
      forbidden: "ab Heathrow",
      preferred: "vom Flughafen Heathrow aus",
      reason: "More natural German for airport-origin directions.",
    },
    {
      forbidden: "Organisiert master St. Paul’s Flughafentransfers für Gäste?",
      preferred: "Bietet master St. Paul’s Flughafentransfers an?",
      reason: "Client-approved concise question phrasing.",
    },
    {
      forbidden: "Taxi-Apps",
      preferred: "Fahrdienst-Apps",
      reason: "More accurate for Uber, Bolt and FreeNow.",
    },
    {
      forbidden: "gegenüber des Flusses",
      preferred: "auf der anderen Seite der Themse",
      reason: "Client-approved wording for Borough Market location.",
    },
    {
      forbidden: "Ein angenehmer Spaziergang über die Millennium Bridge erreicht die Tate Modern in etwa zehn Minuten.",
      preferred: "Die Tate Modern erreichen Sie über die Millennium Bridge in etwa zehn Gehminuten.",
      reason: "Client-approved natural German phrasing.",
    },

    // Parking / local services
    {
      forbidden: "Parkmöglichkeiten vor Ort",
      preferred: "Parkmöglichkeiten vor Ort",
      reason: "Allowed phrasing for parking questions.",
    },
    {
      forbidden: "auf dem Gelände",
      preferred: "vor Ort",
      reason: "More natural location wording.",
    },
    {
      forbidden: "Convenience Stores",
      preferred: "Lebensmittelgeschäfte",
      reason: "Avoid unnecessary English in German copy.",
    },

    // Food / breakfast / delivery
    {
      forbidden: "Serviert master St. Paul’s Frühstück vor Ort?",
      preferred: "Serviert master St. Paul’s Frühstück vor Ort?",
      reason: "Question is acceptable. Answer should begin with 'Nein,' when breakfast is not served on-site.",
    },
    {
      forbidden: "Frühstück wird nicht vor Ort angeboten.",
      preferred: "Nein, Frühstück wird nicht vor Ort angeboten.",
      reason: "Client correction: answer should clearly start with 'Nein,'.",
    },
    {
      forbidden: "Die Apartments sind für Selbstverpflegung ausgelegt",
      preferred: "Die Wohnungen sind für Selbstverpflegung ausgelegt",
      reason: "Use 'Wohnungen' in stay-master answers.",
    },
    {
      forbidden: "in ihrem Apartment kochen",
      preferred: "ihre Mahlzeiten im Apartment selbst zubereiten",
      reason: "Client-approved more natural wording.",
    },
    {
      forbidden: "Kooperiert master St. Paul’s mit örtlichen Restaurants für Essenslieferungen?",
      preferred: "Arbeitet master St. Paul’s mit lokalen Restaurants oder Lieferdiensten zusammen?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Kuriere liefern in der Regel bis zum Haupteingang",
      preferred: "Die Lieferung erfolgt in der Regel bis zum Haupteingang",
      reason: "Client-approved answer phrasing.",
    },
    {
      forbidden: "zu meinem Apartment",
      preferred: "zu meiner Wohnung",
      reason: "Use 'Wohnung' for the guest apartment in direct guest questions.",
    },
    {
      forbidden: "Küchenutensilien, Geschirr und Besteck",
      preferred: "Töpfen, Pfannen, Messern, Schneidebrettern, Geschirr, Gläsern und Besteck",
      reason: "Use concrete kitchen items from the client-approved answer.",
    },

    // Accessibility / facilities
    {
      forbidden: "Gibt es in master St. Paul’s überall Aufzüge?",
      preferred: "Verfügt master St. Paul’s über Aufzüge zu allen Etagen?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "stufenfreien Zugang",
      preferred: "barrierefreien Zugang",
      reason: "Client-approved phrasing for lift access.",
    },
    {
      forbidden: "zu jeder Apartmentetage",
      preferred: "zu allen Bereichen und Apartmentetagen",
      reason: "Client-approved answer wording.",
    },
    {
      forbidden: "Verfügen einige Apartments in master St. Paul’s über barrierefreie Badezimmer?",
      preferred: "Verfügen einige Wohnungen in master St. Paul’s über barrierefreie Badezimmer?",
      reason: "Client-approved wording with 'Wohnungen'.",
    },

    // Check-in / check-out / payment
    {
      forbidden: "Wann sind die regulären Check-in- und Check-out-Zeiten bei master St. Paul’s?",
      preferred: "Wann sind die regulären Check-in- und Check-out-Zeiten im master St. Paul’s?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Können Gäste einen frühen Check-in in master St. Paul’s anfragen?",
      preferred: "Können Gäste einen frühen Check-in im master St. Paul’s anfragen?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Ist ein später Check-out in master St. Paul’s möglich und fällt eine Gebühr an?",
      preferred: "Ist ein später Check-out im master St. Paul’s möglich und fallen dafür Gebühren an?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "kann gebührenpflichtig sein",
      preferred: "kann mit zusätzlichen Gebühren verbunden sein",
      reason: "Client-approved phrasing for late check-out fees.",
    },
    {
      forbidden: "Vorauszahlungen oder Kautionsanforderungen",
      preferred: "Vorauszahlungen oder Kautionen",
      reason: "More natural guest-facing wording.",
    },
    {
      forbidden: "zur Deckung von Schäden oder Nebenkosten vorautorisiert werden kann",
      preferred: "zur Deckung möglicher Schäden oder zusätzlicher Kosten vorübergehend autorisiert werden kann",
      reason: "Client-approved payment wording.",
    },
    {
      forbidden: "über den bereitgestellten sicheren Zahlungslink im Voraus bezahlt werden",
      preferred: "im Voraus über den bereitgestellten sicheren Zahlungslink bezahlt werden",
      reason: "Client-approved word order.",
    },

    // Pets / occupancy / experiences
    {
      forbidden: "Langzeit-Rabatte",
      preferred: "Rabatte für längere Aufenthalte",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Dürfen Hunde in den Apartments von master St. Paul’s übernachten?",
      preferred: "Dürfen Hunde in den Wohnungen von master St. Paul’s übernachten?",
      reason: "Use 'Wohnungen' for stay-master apartment units.",
    },
    {
      forbidden: "Wie hoch ist die maximale Belegung",
      preferred: "Wie viele Gäste können",
      reason: "Client-approved question phrasing for occupancy.",
    },
    {
      forbidden: "Studio-mit-Schlafsofa-Apartments",
      preferred: "Studios mit Schlafsofa",
      reason: "More natural German category wording.",
    },
    {
      forbidden: "Family Apartment für bis zu 5 Gäste",
      preferred: "Family Apartment für bis zu 5 Gäste",
      reason: "Keep official category names if source provides them.",
    },
    {
      forbidden: "Was sind die besten Unternehmungen",
      preferred: "Was kann man unternehmen",
      reason: "Client-approved softer question style for local experiences.",
    },
    {
      forbidden: "St. Paul’s Cathedral erklimmen",
      preferred: "Besuchen Sie die St. Paul’s Cathedral",
      reason: "Client-approved, more natural recommendation wording.",
    },
    {
      forbidden: "Organisiert master St. Paul’s lokale Touren oder Erlebnisse für Gäste?",
      preferred: "Bietet master St. Paul’s Unterstützung bei der Buchung lokaler Touren oder Erlebnisse an?",
      reason: "Client-approved question phrasing.",
    },
    {
      forbidden: "Fitnesscenter",
      preferred: "Fitnessstudios",
      reason: "For nearby external gyms, 'Fitnessstudios' is more natural than 'Fitnesscenter'.",
    },
    {
      forbidden: "Fitnessräume",
      preferred: "Fitnessräume",
      reason: "Allowed when referring to hotel fitness rooms such as the nearby Leonardo Royal Hotel.",
    },

    // General old rules kept because still relevant
    {
      forbidden: "in ca.",
      preferred: "in etwa",
      reason: "Prefer natural German.",
    },
    {
      forbidden: "auf Wunsch",
      preferred: "auf Anfrage",
      reason: "Standard hospitality phrasing for requests.",
    },
    {
      forbidden: "steht ... bereit",
      preferred: "steht ... zur Verfügung",
      reason: "Prefer standard hospitality phrasing.",
    },
    {
      forbidden: "muss bis",
      preferred: "erfolgt bis",
      reason: "Avoid regulatory tone in check-out copy.",
    },
    {
      forbidden: "zu erfolgen",
      preferred: "",
      reason: "Overly bureaucratic phrasing. Prefer natural forms like 'erfolgt bis'.",
    },
    {
      forbidden: "Ortszeit",
      preferred: "",
      reason: "Redundant in hotel FAQs. Local time is assumed.",
    },
    {
      forbidden: "Early Check-in",
      preferred: "früher Check-in",
      reason: "Avoid English hospitality terms where German wording is natural.",
    },
    {
      forbidden: "Late Check-out",
      preferred: "später Check-out",
      reason: "Avoid English hospitality terms where German wording is natural.",
    },
    {
      forbidden: "Bügeleisen und brett",
      preferred: "Bügeleisen und Bügelbrett",
      reason: "Grammar fix.",
    },
    {
      forbidden: "Geschirr und Besteck und Küchenutensilien",
      preferred: "Geschirr, Besteck und Küchenutensilien",
      reason: "Avoid duplicated 'und' in lists.",
    },
    {
      forbidden: "direkte Straßenbahn",
      preferred: "direkte Straßenbahnverbindung",
      reason: "More natural German when describing public transport access.",
    },
  ],

  examples: [
    {
      draft: "master St. Paul’s ist ein luxuriöses Aparthotel, das private Wohnbereiche mit hotelähnlichen Leistungen wie Rezeption, Reinigung und Wäschemöglichkeiten verbindet.",
      polish: "master St. Paul’s bietet hochwertige Serviced Apartments mit privaten Wohnbereichen und den Services eines Hotels wie Reinigung und Wäschemöglichkeiten.",
      note: "Client hard rule: master St. Paul’s is not an Aparthotel. Do not claim an on-site reception.",
    },
    {
      draft: "Was genau ist master St. Paul’s - Hotel, Aparthotel oder Serviced Apartments?",
      polish: "Was genau ist master St. Paul’s - ein Hotel, Aparthotel oder eine Unterkunft mit Serviced Apartments?",
      note: "Use natural German grammar with articles in the accommodation-type list.",
    },
    {
      draft: "master St. Paul’s eignet sich für Geschäftsreisende, Paare, alleinreisende Gäste und Familien, die großzügige Serviced Apartments mit Küche im Zentrum Londons suchen.",
      polish: "master St. Paul’s eignet sich ideal für Geschäftsreisende, Paare, Alleinreisende und Familien, die großzügige Serviced Apartments mit eigener Küche im Zentrum Londons suchen.",
      note: "Client-approved wording. Use 'Alleinreisende' and 'eigene Küche'.",
    },
    {
      draft: "Ja, die voll ausgestatteten Küchen, privaten Wasch-Trockner und Apartment-Grundrisse machen master St. Paul’s komfortabel für längere Aufenthalte.",
      polish: "Ja, die voll ausgestatteten Küchen, eigene Waschmaschinen mit Trocknerfunktion und großzügigen Apartment-Grundrisse machen master St. Paul’s ideal für längere Aufenthalte.",
      note: "Use client-approved washer-dryer wording and stronger extended-stay phrasing.",
    },
    {
      draft: "Die Apartments bieten einen Tisch bzw. Schreibtisch, der sich zum Remote-Arbeiten eignet, sowie zuverlässiges High-Speed-Internet. Einen eigenen Co-Working-Bereich gibt es vor Ort nicht.",
      polish: "Die Wohnungen bieten einen Tisch bzw. Schreibtisch, der sich zum Remote-Arbeiten eignet, sowie zuverlässiges High-Speed-Internet. Einen eigenen Co-Working-Bereich gibt es vor Ort nicht.",
      note: "Use 'Wohnungen' for the apartment units.",
    },
    {
      draft: "Sind Nebenkosten wie WLAN, Strom und Wasser im Übernachtungspreis von master St. Paul’s enthalten?",
      polish: "Sind WLAN, Strom und Wasser im Übernachtungspreis von master St. Paul’s enthalten?",
      note: "Client-approved question. Avoid 'Nebenkosten' in this FAQ question.",
    },
    {
      draft: "Ja, unbegrenztes High-Speed-WLAN, Strom, Heizung, Wasser und Gemeindesteuern sind ohne Aufpreis in jedem Übernachtungspreis enthalten.",
      polish: "Ja, unbegrenztes High-Speed-WLAN, Strom, Heizung, Wasser sowie lokale Steuern und Gebühren sind ohne Aufpreis im Übernachtungspreis enthalten.",
      note: "Client-approved answer. Avoid literal 'Gemeindesteuern'.",
    },
    {
      draft: "Wie häufig erfolgt die Reinigung bei master St. Paul’s?",
      polish: "Wie oft wird bei master St. Paul’s gereinigt?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Reinigung ist inbegriffen; bei längeren Aufenthalten erfolgt ein Standardservice mit Bettwäsche- und Handtuchwechsel einmal pro Woche. Zusätzliche Reinigungen können gegen Gebühr gebucht werden.",
      polish: "Ein Reinigungsservice ist inklusive; bei längeren Aufenthalten erfolgt einmal pro Woche ein Standardservice mit Bettwäsche- und Handtuchwechsel.",
      note: "Client-approved answer. Remove extra-cleaning fee sentence unless the source specifically requires it.",
    },
    {
      draft: "Wie ist die direkte Telefonnummer von master St. Paul’s?",
      polish: "Wie lautet die Telefonnummer von master St. Paul’s?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Gäste erreichen das Team rund um die Uhr per WhatsApp unter +44 330 818 7011 oder per E-Mail an info@staymaster.com.",
      polish: "Gäste erreichen das Team rund um die Uhr per WhatsApp unter +44 330 818 7011 oder per E-Mail an info@stay-master.com.",
      note: "Fix the email address. Keep readable phone formatting.",
    },
    {
      draft: "Wie können Gäste einen Aufenthalt in master St. Paul’s buchen?",
      polish: "Wie können Gäste einen Aufenthalt im master St. Paul’s buchen?",
      note: "Use natural German preposition for the stay.",
    },
    {
      draft: "Gäste können direkt über die Website buchen: https://www.stay-master.com/",
      polish: "Gäste können direkt über die Website buchen: https://www.stay-master.de/",
      note: "Use the German website URL in German content.",
    },
    {
      draft: "Wo genau befindet sich master St. Paul’s und wie nah ist es an der St Paul’s Cathedral?",
      polish: "Wo genau befindet sich master St. Paul’s und wie weit ist es von der St Paul’s Cathedral entfernt?",
      note: "Client-approved distance question phrasing.",
    },
    {
      draft: "Wie erreicht man master St. Paul’s am besten mit öffentlichen Verkehrsmitteln ab Heathrow?",
      polish: "Wie erreicht man master St. Paul’s am besten mit öffentlichen Verkehrsmitteln vom Flughafen Heathrow aus?",
      note: "Client-approved airport-origin phrasing.",
    },
    {
      draft: "Organisiert master St. Paul’s Flughafentransfers für Gäste?",
      polish: "Bietet master St. Paul’s Flughafentransfers an?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Nein, Flughafentransfers werden nicht angeboten. Gäste können jedoch Taxi-Apps wie Uber, Bolt oder FreeNow nutzen.",
      polish: "Nein, Flughafentransfers werden nicht angeboten. Gäste können jedoch Fahrdienst-Apps wie Uber, Bolt oder FreeNow nutzen.",
      note: "Use 'Fahrdienst-Apps' for ride-hailing apps.",
    },
    {
      draft: "Es handelt sich um eine Kollektion zeitgemäßer Serviced Apartments mit privaten Küchen, Wohnbereichen und Self-Check-in, die unabhängigen Wohnkomfort statt klassischer Full-Service-Hotelleistungen bietet.",
      polish: "Es handelt sich um moderne Serviced Apartments mit privaten Küchen, Wohnbereichen und kontaktlosem Check-in, die unabhängiges Wohnen mit komfortablen Services verbinden.",
      note: "Client-approved answer. Avoid over-emphasizing hotel/full-service framing.",
    },
    {
      draft: "Ja, alle Apartments sind mit privaten Wasch-Trockner-Einheiten ausgestattet.",
      polish: "Ja, alle Wohnungen sind mit einer eigenen Waschmaschine mit Trocknerfunktion ausgestattet.",
      note: "Client-approved washer-dryer wording.",
    },
    {
      draft: "Ja, alle Apartments verfügen über eine individuell regelbare Klimaanlage und Heizung.",
      polish: "Ja, alle Wohnungen verfügen über eine individuell regelbare Klimaanlage und Heizung.",
      note: "Use 'Wohnungen' for apartment units.",
    },
    {
      draft: "Gibt es in master St. Paul’s überall Aufzüge?",
      polish: "Verfügt master St. Paul’s über Aufzüge zu allen Etagen?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Ja, Aufzüge gewährleisten einen stufenfreien Zugang in allen Bereichen von master St. Paul’s zu jeder Apartmentetage.",
      polish: "Ja, Aufzüge ermöglichen einen barrierefreien Zugang zu allen Bereichen und Apartmentetagen von master St. Paul’s.",
      note: "Client-approved answer wording.",
    },
    {
      draft: "Verfügen einige Apartments in master St. Paul’s über barrierefreie Badezimmer?",
      polish: "Verfügen einige Wohnungen in master St. Paul’s über barrierefreie Badezimmer?",
      note: "Use 'Wohnungen' for apartment units.",
    },
    {
      draft: "Frühstück wird nicht vor Ort angeboten. Gäste können in nahegelegenen Cafés frühstücken oder gegen Aufpreis den Frühstücksservice im nahegelegenen Leonardo Royal Hotel nutzen.",
      polish: "Nein, Frühstück wird nicht vor Ort angeboten. Gäste können in nahegelegenen Cafés frühstücken oder gegen Aufpreis den Frühstücksservice im nahegelegenen Leonardo Royal Hotel nutzen.",
      note: "Client-approved answer should start with 'Nein,'.",
    },
    {
      draft: "Die Apartments sind für Selbstverpflegung ausgelegt und verfügen weder über ein Restaurant noch über eine Bar. Gäste können in ihrem Apartment kochen, Lieferdienste nutzen oder die umliegenden Cafés, Restaurants sowie das Leonardo Royal Hotel besuchen.",
      polish: "Die Wohnungen sind für Selbstverpflegung ausgelegt und verfügen weder über ein Restaurant noch über eine Bar. Gäste können ihre Mahlzeiten im Apartment selbst zubereiten, Lieferdienste nutzen oder die umliegenden Cafés, Restaurants sowie das Leonardo Royal Hotel besuchen.",
      note: "Client-approved self-catering wording.",
    },
    {
      draft: "Kooperiert master St. Paul’s mit örtlichen Restaurants für Essenslieferungen?",
      polish: "Arbeitet master St. Paul’s mit lokalen Restaurants oder Lieferdiensten zusammen?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Kann Essen von lokalen Liefer-Apps direkt zu meinem Apartment in master St. Paul’s geliefert werden?",
      polish: "Kann Essen von lokalen Liefer-Apps direkt zu meiner Wohnung in master St. Paul’s geliefert werden?",
      note: "Use 'Wohnung' for direct guest wording.",
    },
    {
      draft: "Ja, Gäste können über gängige Apps wie Uber Eats, Deliveroo oder Just Eat bestellen. Die Kuriere liefern in der Regel bis zum Haupteingang, wo die Gäste ihre Bestellung entgegennehmen.",
      polish: "Ja, Gäste können über gängige Apps wie Uber Eats, Deliveroo oder Just Eat bestellen. Die Lieferung erfolgt in der Regel bis zum Haupteingang, wo Gäste ihre Bestellung entgegennehmen können.",
      note: "Client-approved answer phrasing.",
    },
    {
      draft: "Wie erfolgt der Check-in in master St. Paul’s?",
      polish: "Wie funktioniert der Check-in im master St. Paul’s?",
      note: "Client-approved check-in question phrasing.",
    },
    {
      draft: "Die Unterkunft nutzt ein Self-Check-in-System. Ihr individueller Apartment-PIN-Code wird Ihnen am Anreisetag um 09:00 Uhr per WhatsApp und E-Mail zugesandt.",
      polish: "Die Unterkunft nutzt ein kontaktloses Check-in-System. Ihr individueller Apartment-PIN-Code wird Ihnen am Anreisetag um 09:00 Uhr per WhatsApp und E-Mail zugesandt.",
      note: "Client-approved check-in answer wording.",
    },
    {
      draft: "Was ist zu tun, wenn mein Zugangscode für master St. Paul’s bei der Ankunft nicht funktioniert?",
      polish: "Was soll ich tun, wenn mein Zugangscode für master St. Paul’s bei der Ankunft nicht funktioniert?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Bitte kontaktieren Sie umgehend das Guest-Relations-Team per WhatsApp (+44 330 818 7011) oder E-Mail (info@stay-master.com). Ein Mitarbeitender überprüft Ihre Buchung und hilft weiter.",
      polish: "Bitte kontaktieren Sie umgehend das Guest-Relations-Team per WhatsApp (+44 330 818 7011) oder E-Mail (info@stay-master.com). Ein Mitarbeiter unseres Teams überprüft Ihre Buchung und hilft Ihnen weiter.",
      note: "Client-approved support wording.",
    },
    {
      draft: "Sind bei einer Reservierung in master St. Paul’s Vorauszahlungen oder Kautionsanforderungen erforderlich?",
      polish: "Sind bei einer Reservierung im master St. Paul’s Vorauszahlungen oder Kautionen erforderlich?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Es wird keine Kaution erhoben, jedoch ist eine gültige Kreditkarte erforderlich, die zur Deckung von Schäden oder Nebenkosten vorautorisiert werden kann.",
      polish: "Es wird keine Kaution erhoben, jedoch ist eine gültige Kreditkarte erforderlich, die zur Deckung möglicher Schäden oder zusätzlicher Kosten vorübergehend autorisiert werden kann.",
      note: "Client-approved payment wording.",
    },
    {
      draft: "Welche Zahlungsmethoden werden in master St. Paul’s akzeptiert?",
      polish: "Welche Zahlungsmethoden werden im master St. Paul’s akzeptiert?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Alle Aufenthalte müssen über den bereitgestellten sicheren Zahlungslink im Voraus bezahlt werden.",
      polish: "Alle Aufenthalte müssen im Voraus über den bereitgestellten sicheren Zahlungslink bezahlt werden.",
      note: "Client-approved word order.",
    },
    {
      draft: "Bietet master St. Paul’s Langzeit-Rabatte an?",
      polish: "Bietet master St. Paul’s Rabatte für längere Aufenthalte an?",
      note: "Client-approved question phrasing.",
    },
    {
      draft: "Wie hoch ist die maximale Belegung für die einzelnen Apartmentkategorien in master St. Paul’s und gibt es Schlafsofas für zusätzliche Gäste?",
      polish: "Wie viele Gäste können die einzelnen Apartmentkategorien im master St. Paul’s beherbergen und gibt es Schlafsofas für zusätzliche Gäste?",
      note: "Client-approved occupancy question.",
    },
    {
      draft: "Was sind die besten Unternehmungen in London während eines Aufenthalts in master St. Paul’s?",
      polish: "Was kann man während eines Aufenthalts im master St. Paul’s in London unternehmen?",
      note: "Client-approved local-experience question.",
    },
    {
      draft: "St. Paul’s Cathedral erklimmen, über die Millennium Bridge zur Tate Modern gehen und den Borough Market erkunden.",
      polish: "Besuchen Sie die St. Paul’s Cathedral, spazieren Sie über die Millennium Bridge zur Tate Modern und entdecken Sie den Borough Market.",
      note: "Client-approved local-experience answer.",
    },
    {
      draft: "Ja, der Borough Market liegt direkt gegenüber des Flusses, etwa 1,2 km entfernt.",
      polish: "Ja, der Borough Market liegt auf der anderen Seite der Themse, etwa 1,2 km entfernt.",
      note: "Client-approved location phrasing.",
    },
    {
      draft: "Organisiert master St. Paul’s lokale Touren oder Erlebnisse für Gäste?",
      polish: "Bietet master St. Paul’s Unterstützung bei der Buchung lokaler Touren oder Erlebnisse an?",
      note: "Client-approved question phrasing.",
    },
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
    },
    {
      forbidden: "gracieusement mise à disposition",
      preferred: "mise à disposition gratuitement",
      reason: "French FAQ reviewer note: 'gracieusement' sounds too strong for standard complimentary services."
    },
    {
      forbidden: "met gracieusement à disposition",
      preferred: "met à disposition gratuitement",
      reason: "Keeps the benefit factual and natural without over-luxury wording."
    },
    {
      forbidden: "sont proposés gracieusement",
      preferred: "sont proposés gratuitement",
      reason: "Avoids the elevated register of 'gracieusement' for regular hotel amenities."
    },
    {
      forbidden: "gracieusement proposés",
      preferred: "proposés gratuitement",
      reason: "Use clear FAQ wording for free services."
    },
    {
      forbidden: "gracieusement",
      preferred: "gratuitement",
      reason: "Use only when grammar requires an adverb; prefer 'gratuit' or 'sans supplément' when more natural."
    },
    {
      forbidden: "sac petit-déjeuner à emporter",
      preferred: "petit déjeuner à emporter",
      reason: "Reviewer note: 'sac' sounds odd in French here; the service should be named as the takeaway breakfast."
    },
    {
      forbidden: "Breakfast Bag préparé",
      preferred: "petit déjeuner à emporter préparé",
      reason: "Avoid leaving the English product label inside French FAQ copy unless it is an official brand term."
    },
    {
      forbidden: "frais modiques",
      preferred: "petit supplément",
      reason: "Reviewer note: 'modiques' sounds unnatural for hotel fee policy copy."
    },
    {
      forbidden: "donner lieu à des frais modiques",
      preferred: "entraîner un petit supplément",
      reason: "More natural French for small extra-charge policy wording."
    },
    {
      forbidden: "sous réserve de la circulation",
      preferred: "sous réserve des conditions de circulation",
      reason: "Reviewer-preferred French phrasing for traffic-dependent travel times."
    },
    {
      forbidden: "chiens bien éduqués",
      preferred: "chiens",
      reason: "Reviewer note: this implies only especially well-trained dogs are allowed; keep the pet policy neutral."
    },
    {
      forbidden: "remis sur simple demande plutôt que",
      preferred: "remis sur simple demande auprès de la réception plutôt que",
      reason: "For on-request room items, include the reception touchpoint when the source points guests there."
    },
    {
      forbidden: "€15",
      preferred: "15 €",
      reason: "French price formatting puts the euro sign after the number with a space."
    },
    {
      forbidden: "€25",
      preferred: "25 €",
      reason: "French price formatting puts the euro sign after the number with a space."
    },
    {
      forbidden: "1.0 kilomètre",
      preferred: "1 km",
      reason: "Use natural French distance formatting; avoid English decimal punctuation and unnecessary .0."
    },
    {
      forbidden: "1.2 kilomètres",
      preferred: "1,2 km",
      reason: "Use a decimal comma and compact distance unit in French."
    },
    {
      forbidden: "3.0 kilomètres",
      preferred: "3 km",
      reason: "Use natural French distance formatting; avoid unnecessary .0."
    },
    {
      forbidden: "1,0 km",
      preferred: "1 km",
      reason: "Avoid unnecessary decimal zero in French distances."
    },
    {
      forbidden: "3,0 km",
      preferred: "3 km",
      reason: "Avoid unnecessary decimal zero in French distances."
    },
    {
      forbidden: "1 June",
      preferred: "1er juin",
      reason: "Translate English month names and use French date style."
    },
    {
      forbidden: "30 September",
      preferred: "30 septembre",
      reason: "Translate English month names."
    },
    {
      forbidden: "11:00 AM",
      preferred: "11 h 00",
      reason: "Convert AM/PM to French 24-hour hotel style."
    },
    {
      forbidden: "9:00 PM",
      preferred: "21 h 00",
      reason: "Convert AM/PM to French 24-hour hotel style."
    },
    {
      forbidden: "15:00",
      preferred: "15 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "7:00",
      preferred: "7 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "10:30",
      preferred: "10 h 30",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "8:00",
      preferred: "8 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "13:00",
      preferred: "13 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "16:00",
      preferred: "16 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "19:00",
      preferred: "19 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "22:30",
      preferred: "22 h 30",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "23:00",
      preferred: "23 h 00",
      reason: "Prefer French hotel time formatting with spaces around h."
    },
    {
      forbidden: "bar du lobby",
      preferred: "bar du hall",
      reason: "Avoid unnecessary English in French hotel copy."
    },
    {
      forbidden: "buffet petit-déjeuner",
      preferred: "buffet du petit-déjeuner",
      reason: "More natural French collocation for a breakfast buffet."
    },
    {
      forbidden: "buffet international pour le petit-déjeuner dans la salle de petit-déjeuner",
      preferred: "buffet international dans la salle du petit-déjeuner",
      reason: "Avoid repetitive translated wording around breakfast room references."
    },
    {
      forbidden: "café décontracté sur place",
      preferred: "espace café sur place",
      reason: "More natural and less translated for hotel amenity copy."
    },
    {
      forbidden: "clients enregistrés",
      preferred: "clients de l'hôtel",
      reason: "Avoid technical registration wording when the meaning is registered hotel guests."
    },
    {
      forbidden: "dans le parking",
      preferred: "sur le parking",
      reason: "Use the natural French preposition for parking facilities in hotel copy."
    },
    {
      forbidden: "vues panoramiques",
      preferred: "une vue panoramique",
      reason: "In French hotel copy, singular 'une vue panoramique' is usually more natural unless multiple distinct views are meant."
    },
    {
      forbidden: "service d’appel de réveil",
      preferred: "service de réveil",
      reason: "Shorter and more natural hotel terminology."
    },
    {
      forbidden: "lors de l’enregistrement",
      preferred: "à l'arrivée",
      reason: "Guest-facing hotel French usually sounds more natural with 'à l'arrivée' than technical 'enregistrement'."
    },
    {
      forbidden: "avant l’enregistrement",
      preferred: "avant l'arrivée",
      reason: "Use natural guest-facing arrival wording."
    },
    {
      forbidden: "âge minimum requis pour l’arrivée",
      preferred: "âge minimum requis pour s'enregistrer",
      reason: "Arrival can sound like physical arrival; this policy is about check-in/registration."
    }
  ],
  examples: [
    {
      draft: "Le check-out doit s’effectuer avant 12 h 00, offrant un départ détendu avant midi.",
      polish: "Au Leonardo Hotel Almere City Center, les chambres doivent être libérées avant 12 h 00, vous permettant un départ en toute sérénité.",
      note: "Replacing anglicisms and literal translations with professional French hospitality idioms."
    },
    {
      draft: "L'enregistrement officiel au Leonardo Hotel Almere City Center commence à 15 h 00...",
      polish: "Les arrivées au Leonardo Hotel Almere City Center s'effectuent à partir de 15 h 00...",
      note: "Standardizing the welcome process phrasing."
    },
    {
      draft: "Oui, le Wi-Fi haut débit est offert gratuitement dans l’ensemble des chambres...",
      polish: "Oui, une connexion Wi-Fi haut débit est mise à disposition gratuitement dans l'ensemble des chambres du Leonardo Hotel Almere City Center...",
      note: "Use clear complimentary-service wording; avoid over-elevated 'gracieusement'."
    },
    {
      draft: "Les clients non résidents peuvent-ils dîner au Bierfabriek Almere...",
      polish: "La clientèle non-résidente peut-elle déjeuner ou dîner au Bierfabriek Almere...",
      note: "Specifying the type of guest (clientèle) and the meals (déjeuner/dîner) for a more complete response."
    },
    {
      draft: "Oui, le Leonardo Boutique Museumhotel Amsterdam City Center met gracieusement à disposition une connexion Wi-Fi haut débit dans l’ensemble des chambres et des espaces communs.",
      polish: "Oui, le Leonardo Boutique Museumhotel Amsterdam City Center met à disposition gratuitement une connexion Wi-Fi haut débit dans l’ensemble des chambres et des espaces communs.",
      note: "Use clear complimentary-service wording; avoid 'gracieusement'."
    },
    {
      draft: "Oui, des lits bébé sont proposés gracieusement sur réservation préalable et sous réserve de disponibilité.",
      polish: "Oui, des lits bébé sont proposés gratuitement sur réservation préalable et sous réserve de disponibilité.",
      note: "Keep the policy factual and natural."
    },
    {
      draft: "Le Leonardo Hotel Almere City Center propose-t-il un sac petit-déjeuner à emporter pour les départs matinaux ?",
      polish: "Le Leonardo Hotel Almere City Center propose-t-il un petit déjeuner à emporter pour les départs tôt le matin ?",
      note: "Reviewer note: avoid 'sac petit-déjeuner'; phrase the service naturally."
    },
    {
      draft: "Oui, les clients prenant un train ou un vol tôt peuvent demander à la réception un Breakfast Bag préparé à l’avance.",
      polish: "Oui, les clients prenant un train ou un vol tôt peuvent demander à la réception un petit déjeuner à emporter préparé à l’avance.",
      note: "Translate the service label unless it is an official brand name."
    },
    {
      draft: "Oui, une arrivée anticipée ou un départ tardif peut être organisé, sous réserve de disponibilité, et peut donner lieu à des frais modiques.",
      polish: "Oui, une arrivée anticipée ou un départ tardif peut être organisé, sous réserve de disponibilité, et peut entraîner un petit supplément.",
      note: "Use the reviewer-preferred fee wording."
    },
    {
      draft: "Le trajet en taxi depuis Schiphol prend généralement entre 25 et 30 minutes, sous réserve de la circulation.",
      polish: "Le trajet en taxi depuis Schiphol prend généralement entre 25 et 30 minutes, sous réserve des conditions de circulation.",
      note: "Use the more natural travel-time disclaimer."
    },
    {
      draft: "Oui, les chiens bien éduqués sont les bienvenus sans supplément ; il convient simplement de nous en informer à l'avance.",
      polish: "Oui, les chiens sont les bienvenus sans supplément ; il convient simplement de nous en informer à l'avance.",
      note: "Keep the pet policy neutral and avoid implying a stricter training requirement."
    },
    {
      draft: "Le buffet petit-déjeuner est actuellement proposé au tarif de €15 par personne.",
      polish: "Le buffet petit-déjeuner est actuellement proposé au tarif de 15 € par personne.",
      note: "Use French price formatting with the euro sign after the number."
    },
    {
      draft: "La plage d'Ondarreta est accessible à pied, à environ 1.2 kilomètres.",
      polish: "La plage d'Ondarreta est accessible à pied, à environ 1,2 km.",
      note: "Use decimal comma and compact distance units in French."
    },
    {
      draft: "La piscine est ouverte chaque année du 1 June au 30 September.",
      polish: "La piscine est ouverte chaque année du 1er juin au 30 septembre.",
      note: "Translate English month names and keep natural French date style."
    },
    {
      draft: "La piscine saisonnière sur le toit est ouverte tous les jours de 11:00 AM à 9:00 PM.",
      polish: "La piscine saisonnière sur le toit est ouverte tous les jours de 11 h 00 à 21 h 00.",
      note: "Convert AM/PM to French 24-hour hotel style."
    },
    {
      draft: "Oui, un café décontracté sur place sert des boissons et des en-cas légers tout au long de la journée.",
      polish: "Oui, un espace café sur place sert des boissons et des en-cas légers tout au long de la journée.",
      note: "Avoid literal 'casual coffee shop' wording."
    },
    {
      draft: "Oui, une piscine extérieure saisonnière sur le toit est à la disposition des clients enregistrés.",
      polish: "Oui, une piscine extérieure saisonnière sur le toit est à la disposition des clients de l'hôtel.",
      note: "Use natural guest-facing French rather than technical registration wording."
    },
    {
      draft: "Le buffet petit-déjeuner est actuellement proposé au tarif de 15 € par personne.",
      polish: "Le buffet du petit-déjeuner est actuellement proposé au tarif de 15 € par personne.",
      note: "Use the natural French collocation for breakfast buffet."
    },
    {
      draft: "La plage de La Concha se situe à environ 1,0 km.",
      polish: "La plage de La Concha se situe à environ 1 km.",
      note: "Remove unnecessary decimal zero."
    },
    {
      draft: "Oui, une borne de recharge pour véhicules électriques est disponible dans le parking du Leonardo Hotel San Sebastián.",
      polish: "Oui, une borne de recharge pour véhicules électriques est disponible sur le parking du Leonardo Hotel San Sebastián.",
      note: "Use the natural preposition for parking facilities."
    },
    {
      draft: "Oui, les clients peuvent profiter de vues panoramiques depuis la vaste terrasse sur le toit.",
      polish: "Oui, les clients peuvent profiter d'une vue panoramique depuis la vaste terrasse sur le toit.",
      note: "Singular 'vue panoramique' sounds more natural in French hospitality copy."
    },
    {
      draft: "Le Leonardo Hotel San Sebastián sert chaque matin un généreux buffet international pour le petit-déjeuner dans la salle de petit-déjeuner.",
      polish: "Le Leonardo Hotel San Sebastián sert chaque matin un généreux buffet international dans la salle du petit-déjeuner.",
      note: "Avoid repetition and keep breakfast-room phrasing natural."
    },
    {
      draft: "Quel est l’âge minimum requis pour l’arrivée au Leonardo Hotel San Sebastián ? L’âge minimum requis pour l’enregistrement est de 18 ans.",
      polish: "Quel est l’âge minimum requis pour s'enregistrer au Leonardo Hotel San Sebastián ? L’âge minimum requis pour s'enregistrer est de 18 ans.",
      note: "Use check-in/registration wording instead of physical-arrival wording for age policy."
    }
  ]
},
    pl: { mappings: [], examples: [] },
    ru: {
        mappings: [
            {
                forbidden: "отелем на 100 % для некурящих",
                preferred: "полностью некурящим отелем",
                reason: "Natural Russian hotel phrasing for a fully non-smoking hotel."
            },
            {
                forbidden: "полностью является отелем на 100 % для некурящих",
                preferred: "является полностью некурящим отелем",
                reason: "Avoid literal English structure and redundant percentage wording."
            },
            {
                forbidden: "индивидуально регулируемые кондиционирование и отопление",
                preferred: "индивидуально регулируемые системы кондиционирования и отопления",
                reason: "Keeps agreement natural and avoids an awkward compound subject."
            },
            {
                forbidden: "больших компаний",
                preferred: "больших групп",
                reason: "In hotel room-layout context, 'groups' is more accurate than 'companies'."
            },
            {
                forbidden: "мини-бар-холодильник",
                preferred: "мини-бар",
                reason: "Russian hotel copy normally uses 'мини-бар' for a stocked minibar refrigerator."
            },
            {
                forbidden: "любой помощи гостям",
                preferred: "помощи гостям по любым вопросам",
                reason: "More idiomatic Russian service phrasing."
            },
            {
                forbidden: "интернациональных блюд",
                preferred: "блюд международной кухни",
                reason: "More natural Russian hospitality wording for international cuisine."
            },
            {
                forbidden: "07:00 утра",
                preferred: "07:00",
                reason: "24-hour times do not need day-part words in Russian."
            },
            {
                forbidden: "22:00 вечера",
                preferred: "22:00",
                reason: "24-hour times do not need day-part words in Russian."
            },
            {
                forbidden: "с 07:00 утра до 22:00 вечера",
                preferred: "с 07:00 до 22:00",
                reason: "Natural Russian time formatting for hotel operating hours."
            },
            {
                forbidden: "1.6 км",
                preferred: "1,6 км",
                reason: "Russian distance formatting uses a decimal comma."
            },
            {
                forbidden: "5.9 км",
                preferred: "5,9 км",
                reason: "Russian distance formatting uses a decimal comma."
            },
            {
                forbidden: "14 km",
                preferred: "14 км",
                reason: "Do not leave English distance units in Russian copy."
            },
            {
                forbidden: "km",
                preferred: "км",
                reason: "Do not leave English distance units in Russian copy."
            },
            {
                forbidden: "организует такси",
                preferred: "может организовать такси",
                reason: "Matches the source meaning 'can arrange' without overpromising."
            },
            {
                forbidden: "приобрести билеты на достопримечательности",
                preferred: "помочь с покупкой билетов на достопримечательности",
                reason: "More natural concierge-service wording."
            },
            {
                forbidden: "спортивные события",
                preferred: "спортивные трансляции",
                reason: "In a hotel bar context, guests are asking about broadcasts or matches."
            },
            {
                forbidden: "баре-лаундже",
                preferred: "лаунж-баре",
                reason: "More natural Russian term for a bar-lounge area."
            },
            {
                forbidden: "услугами печати, ксерокопирования и другими услугами",
                preferred: "услугами печати, ксерокопирования и другими бизнес-услугами",
                reason: "Avoids repetition and keeps the business-centre context clear."
            },
            {
                forbidden: "официальные время заезда и выезда",
                preferred: "официальные часы заезда и выезда",
                reason: "Natural Russian phrasing for check-in/check-out times."
            },
            {
                forbidden: "для заезда, услуг консьержа и помощи гостям",
                preferred: "для оформления заезда, услуг консьержа и помощи гостям",
                reason: "Use the standard Russian hotel phrase 'оформление заезда'."
            },
            {
                forbidden: "для заезда, услуг консьержа и любой помощи гостям",
                preferred: "для оформления заезда, услуг консьержа и помощи гостям по любым вопросам",
                reason: "More natural service phrasing for front-desk availability."
            },
            {
                forbidden: "кондиционирование и отопление",
                preferred: "системы кондиционирования и отопления",
                reason: "Avoids an awkward pair of abstract nouns in room-amenity questions."
            },
            {
                forbidden: "для персонального комфорта",
                preferred: "для комфортного микроклимата",
                reason: "More idiomatic Russian for personalised climate comfort."
            },
            {
                forbidden: "мини-бар-холодильник, укомплектованный для удобства гостей",
                preferred: "мини-бар с наполнением для удобства гостей",
                reason: "Avoids the unnatural compound 'мини-бар-холодильник'."
            },
            {
                forbidden: "установлен мини-бар-холодильник",
                preferred: "есть мини-бар",
                reason: "Simpler and more natural hotel-room wording."
            },
            {
                forbidden: "экспресс-прачечная",
                preferred: "услуги экспресс-стирки",
                reason: "A laundry facility is not meant here; the service is express laundry."
            },
            {
                forbidden: "парковку на территории Leonardo Hotel Bucharest City Center или поблизости",
                preferred: "парковку на территории отеля или поблизости",
                reason: "Avoids repeating the long hotel name inside the same question."
            },
            {
                forbidden: "зарабатывать баллы",
                preferred: "накапливать баллы",
                reason: "Natural Russian loyalty-program wording."
            },
            {
                forbidden: "подходящее проживание",
                preferred: "проживание по подходящему тарифу",
                reason: "Avoids a literal and vague translation of eligible stay."
            },
            {
                forbidden: "квалифицирующим тарифам",
                preferred: "подходящим тарифам",
                reason: "Avoids legal/corporate calque in loyalty-program copy."
            },
            {
                forbidden: "квалифицирующие тарифы",
                preferred: "подходящие тарифы",
                reason: "Use clear guest-facing Russian."
            },
            {
                forbidden: "последняя полная реновация",
                preferred: "последний полный ремонт",
                reason: "More natural Russian than the loanword 'реновация' for hotel renovation."
            },
            {
                forbidden: "полная реновация",
                preferred: "полный ремонт",
                reason: "Prefer natural Russian for renovation."
            },
            {
                forbidden: "Комплексная реновация",
                preferred: "Масштабное обновление",
                reason: "A smoother Russian hospitality phrase for comprehensive renovation."
            },
            {
                forbidden: "бесступенчатый доступ",
                preferred: "доступ без ступеней",
                reason: "More natural accessibility wording in Russian."
            },
            {
                forbidden: "машина Nespresso для приготовления кофе и чая",
                preferred: "кофемашина Nespresso и принадлежности для чая",
                reason: "A Nespresso machine makes coffee, not tea; keep the tea amenity separate."
            },
            {
                forbidden: "туалетными принадлежностями L’Occitane",
                preferred: "косметическими принадлежностями L’Occitane",
                reason: "More polished Russian hotel phrasing for premium bathroom amenities."
            },
            {
                forbidden: "туалетные принадлежности L’Occitane",
                preferred: "косметические принадлежности L’Occitane",
                reason: "More polished Russian hotel phrasing for premium bathroom amenities."
            },
            {
                forbidden: "премиальные туалетные принадлежности L’Occitane",
                preferred: "премиальные косметические принадлежности L’Occitane",
                reason: "More polished Russian hotel phrasing for premium bathroom amenities."
            },
            {
                forbidden: "туалетные принадлежности премиум-класса",
                preferred: "косметические принадлежности премиум-класса",
                reason: "More natural Russian hotel phrasing for premium bathroom amenities."
            },
            {
                forbidden: "бесплатные туалетные принадлежности премиум-класса",
                preferred: "бесплатные косметические принадлежности премиум-класса",
                reason: "More natural Russian hotel phrasing for premium bathroom amenities."
            },
            {
                forbidden: "каждый день в каждый номер ставят",
                preferred: "ежедневно в каждый номер ставят",
                reason: "Smoother Russian word order."
            },
            {
                forbidden: "ежедневно в каждом номере размещаются",
                preferred: "ежедневно в каждый номер ставят",
                reason: "More natural Russian for bottled-water amenities."
            },
            {
                forbidden: "размещаются две бесплатные бутылки",
                preferred: "ставят две бесплатные бутылки",
                reason: "More natural Russian for bottled-water amenities."
            },
            {
                forbidden: "ежедневного «шведского стола»",
                preferred: "завтрака «шведский стол»",
                reason: "Avoids the clipped noun phrase 'daily buffet'."
            },
            {
                forbidden: "Стоимость ежедневного «шведского стола» составляет",
                preferred: "Завтрак «шведский стол» стоит",
                reason: "More natural, direct Russian FAQ answer."
            },
            {
                forbidden: "не включая применимый городской налог",
                preferred: "без учета городского налога",
                reason: "Avoids legal-sounding calque in Russian price copy."
            },
            {
                forbidden: "применимый городской налог",
                preferred: "городской налог",
                reason: "Simpler and more natural Russian tax wording."
            },
            {
                forbidden: "€40",
                preferred: "40 €",
                reason: "Use Russian currency order in running text."
            },
            {
                forbidden: "от €40",
                preferred: "от 40 €",
                reason: "Use Russian currency order in running text."
            },
            {
                forbidden: "в любую категорию тарифа",
                preferred: "во все тарифы",
                reason: "Fixes an unnatural literal phrase for breakfast-rate inclusion."
            },
            {
                forbidden: "служба хозяйственного обслуживания",
                preferred: "служба уборки",
                reason: "Avoids a stiff literal housekeeping translation."
            },
            {
                forbidden: "профессиональные услуги прачечной",
                preferred: "профессиональную стирку",
                reason: "The service is laundry, not a laundry facility."
            },
            {
                forbidden: "услуги прачечной",
                preferred: "услуги стирки",
                reason: "More natural for guest-facing service copy."
            },
            {
                forbidden: "музейные абонементы",
                preferred: "билеты в музеи",
                reason: "Museum passes in this FAQ context are tickets/passes for museums, not subscriptions."
            },
            {
                forbidden: "с радостью организует",
                preferred: "может организовать",
                reason: "Avoids translated customer-service enthusiasm."
            },
            {
                forbidden: "спортивные мероприятия",
                preferred: "спортивные трансляции",
                reason: "In a bar/lounge context the source means broadcasts."
            },
            {
                forbidden: "зоне отдыха",
                preferred: "лаунж-зоне",
                reason: "More natural for hotel bar/lounge context."
            },
            {
                forbidden: "обеспечивая оформление заезда",
                preferred: "помогая с оформлением заезда",
                reason: "Smoother Russian sentence after 'стойка регистрации работает круглосуточно'."
            },
            {
                forbidden: "он предлагает доступ без ступеней",
                preferred: "в нем предусмотрен доступ без ступеней",
                reason: "Avoids literal English 'offers access' in Russian accessibility wording."
            },
            {
                forbidden: "любую помощь гостям",
                preferred: "помощь гостям по любым вопросам",
                reason: "More idiomatic guest-service phrase."
            },
            {
                forbidden: "воспитанные собаки и кошки",
                preferred: "собаки и кошки",
                reason: "Keep the pet policy neutral unless the source truly imposes a training condition."
            },
            {
                forbidden: "воспитанные собаки и кошки допускаются бесплатно",
                preferred: "собаки и кошки принимаются бесплатно",
                reason: "Natural Russian pet-policy wording."
            },
            {
                forbidden: "по ключ-картам",
                preferred: "по ключ-карте",
                reason: "Natural Russian key-card access wording."
            },
            {
                forbidden: "служебные животные размещаются всегда",
                preferred: "служебные животные принимаются всегда",
                reason: "More natural Russian policy wording."
            },
            {
                forbidden: "lifestyle-коллекцию",
                preferred: "коллекцию lifestyle-отелей",
                reason: "Avoids an awkward mixed English-Russian compound."
            },
            {
                forbidden: "готовит обильный ежедневный завтрак",
                preferred: "ежедневно сервирует обильный завтрак",
                reason: "More natural Russian hotel breakfast wording."
            },
            {
                forbidden: "подаётся в обеденной зоне",
                preferred: "подаётся в зале для завтраков",
                reason: "Use natural hotel wording for a breakfast dining area."
            },
            {
                forbidden: "растительных блюд",
                preferred: "блюд на растительной основе",
                reason: "More natural Russian for plant-based breakfast options."
            },
            {
                forbidden: "по цене 38 € в сутки",
                preferred: "за 38 € в сутки",
                reason: "More natural Russian price phrasing."
            },
            {
                forbidden: "организуется платный трансфер",
                preferred: "можно организовать платный трансфер",
                reason: "Avoids a stiff passive and better matches arrangeable shuttle service."
            },
            {
                forbidden: "это лёгкая прогулка пешком",
                preferred: "до него легко дойти пешком",
                reason: "More natural Russian walking-distance wording."
            },
            {
                forbidden: "видом на городской горизонт",
                preferred: "панорамным видом на город",
                reason: "Avoids a literal skyline calque."
            },
            {
                forbidden: "оригинальные работы местного уличного искусства",
                preferred: "оригинальные работы местного стрит-арта",
                reason: "More natural Russian wording for street art."
            },
            {
                forbidden: "надёжное хранение велосипедов",
                preferred: "охраняемое хранение велосипедов",
                reason: "Use the standard Russian wording for secure storage."
            },
            {
                forbidden: "защищённое хранение велосипедов в помещении",
                preferred: "охраняемое помещение для хранения велосипедов",
                reason: "More natural Russian wording for secure indoor bicycle storage."
            },
            {
                forbidden: "регулярные кураторские выставки местных художников",
                preferred: "регулярные выставки работ местных художников",
                reason: "Less stiff and more guest-facing Russian."
            },
            {
                forbidden: "кураторские выставки работ современных местных художников",
                preferred: "выставки работ современных местных художников",
                reason: "Less stiff and more guest-facing Russian."
            }
        ],
        examples: [
            {
                draft: "Да, Leonardo Hotel Bucharest City Center полностью является отелем на 100 % для некурящих, включая все номера и зоны общего пользования.",
                polish: "Да, Leonardo Hotel Bucharest City Center является полностью некурящим отелем, включая все номера и зоны общего пользования.",
                note: "Keep the non-smoking claim natural and avoid literal percentage wording."
            },
            {
                draft: "Бар Leonardo Hotel Bucharest City Center открыт ежедневно с 07:00 утра до 22:00 вечера.",
                polish: "Бар Leonardo Hotel Bucharest City Center открыт ежедневно с 07:00 до 22:00.",
                note: "Use 24-hour time without redundant day-part words."
            },
            {
                draft: "Leonardo Hotel Bucharest City Center расположен в 14 km от аэропорта имени Анри Коанды; доступен платный трансфер.",
                polish: "Leonardo Hotel Bucharest City Center расположен в 14 км от аэропорта имени Анри Коанды; доступен платный трансфер.",
                note: "Use Russian distance units while preserving the numeric value."
            },
            {
                draft: "Исторический Старый город расположен примерно в 1.6 км, около 20 минут пешком.",
                polish: "Исторический Старый город расположен примерно в 1,6 км, около 20 минут пешком.",
                note: "Use a decimal comma in Russian distance formatting."
            },
            {
                draft: "Да, в Leonardo Hotel Bucharest City Center имеется бизнес-центр с услугами печати, ксерокопирования и другими услугами.",
                polish: "Да, в Leonardo Hotel Bucharest City Center имеется бизнес-центр с услугами печати, ксерокопирования и другими бизнес-услугами.",
                note: "Avoid repeated 'услуги' and keep the business-centre meaning clear."
            },
            {
                draft: "Каковы официальные время заезда и выезда в Leonardo Hotel Bucharest City Center?",
                polish: "Каковы официальные часы заезда и выезда в Leonardo Hotel Bucharest City Center?",
                note: "Use natural Russian phrasing for hotel times."
            },
            {
                draft: "Работает ли стойка регистрации в Leonardo Hotel Bucharest City Center круглосуточно для заезда, услуг консьержа и помощи гостям?",
                polish: "Работает ли стойка регистрации в Leonardo Hotel Bucharest City Center круглосуточно для оформления заезда, услуг консьержа и помощи гостям?",
                note: "Use 'оформление заезда' in front-desk context."
            },
            {
                draft: "Есть ли во всех номерах Leonardo Hotel Bucharest City Center индивидуально регулируемые кондиционирование и отопление?",
                polish: "Есть ли во всех номерах Leonardo Hotel Bucharest City Center индивидуально регулируемые системы кондиционирования и отопления?",
                note: "Keep the amenity phrasing grammatically natural."
            },
            {
                draft: "Да, во всех номерах установлен мини-бар-холодильник, укомплектованный для удобства гостей.",
                polish: "Да, во всех номерах есть мини-бар с наполнением для удобства гостей.",
                note: "Avoid the unnatural compound 'мини-бар-холодильник'."
            },
            {
                draft: "Да, доступны экспресс-прачечная и профессиональная химчистка с возвратом в тот же день.",
                polish: "Да, доступны услуги экспресс-стирки и профессиональной химчистки с возвратом в тот же день.",
                note: "Clarify that this is a laundry service, not a physical laundry room."
            },
            {
                draft: "Предоставляет ли Leonardo Hotel Bucharest City Center парковку на территории Leonardo Hotel Bucharest City Center или поблизости и какова её стоимость?",
                polish: "Предоставляет ли Leonardo Hotel Bucharest City Center парковку на территории отеля или поблизости и какова её стоимость?",
                note: "Avoid repeating the full hotel name in the same sentence when 'отель' is clear."
            },
            {
                draft: "Могут ли участники программы AdvantageCLUB зарабатывать баллы, проживая в Leonardo Boutique Hotel Paris Opera?",
                polish: "Могут ли участники программы AdvantageCLUB накапливать баллы за проживание в Leonardo Boutique Hotel Paris Opera?",
                note: "Use natural loyalty-program phrasing."
            },
            {
                draft: "Да, участники AdvantageCLUB получают бонусные баллы за каждое подходящее проживание, забронированное по квалифицирующим тарифам в этом отеле.",
                polish: "Да, участники AdvantageCLUB получают бонусные баллы за каждое проживание по подходящему тарифу, забронированное в этом отеле.",
                note: "Avoid legal/corporate calques in loyalty copy."
            },
            {
                draft: "Когда в Leonardo Boutique Hotel Paris Opera была проведена последняя полная реновация?",
                polish: "Когда в Leonardo Boutique Hotel Paris Opera был проведён последний полный ремонт?",
                note: "Use natural Russian for renovation."
            },
            {
                draft: "Комплексная реновация Leonardo Boutique Hotel Paris Opera была завершена в 2020 году.",
                polish: "Масштабное обновление Leonardo Boutique Hotel Paris Opera было завершено в 2020 году.",
                note: "Use smoother Russian hotel copy for comprehensive renovation."
            },
            {
                draft: "Да, специально оборудованный номер категории Comfort Triple обеспечивает бесступенчатый доступ и удобства для гостей, пользующихся инвалидной коляской.",
                polish: "Да, специально оборудованный номер категории Comfort Triple предлагает доступ без ступеней и удобства для гостей, пользующихся инвалидной коляской.",
                note: "Accessibility wording should be clear and natural."
            },
            {
                draft: "Да, в каждой категории номеров есть машина Nespresso для приготовления кофе и чая.",
                polish: "Да, в каждой категории номеров есть кофемашина Nespresso и принадлежности для чая.",
                note: "Separate the Nespresso coffee machine from tea-making supplies."
            },
            {
                draft: "Стоимость ежедневного «шведского стола» составляет €15 с человека, не включая возможный городской налог.",
                polish: "Завтрак «шведский стол» стоит 15 € с человека, не включая возможный городской налог.",
                note: "Use direct Russian breakfast-price phrasing and Russian price order."
            },
            {
                draft: "Завтрак «шведский стол» стоит 15 € с человека, не включая применимый городской налог.",
                polish: "Завтрак «шведский стол» стоит 15 € с человека, без учета городского налога.",
                note: "Avoid legal-sounding Russian calques for taxes."
            },
            {
                draft: "Да, через службу хозяйственного обслуживания можно заказать профессиональные услуги прачечной, химчистки и глажки.",
                polish: "Да, через службу уборки можно заказать профессиональную стирку, химчистку и глажку.",
                note: "Avoid stiff housekeeping/laundry calques."
            },
            {
                draft: "Да, ежедневно в каждом номере размещаются две бесплатные бутылки минеральной воды.",
                polish: "Да, ежедневно в каждый номер ставят две бесплатные бутылки минеральной воды.",
                note: "Use natural Russian for bottled-water amenities."
            },
            {
                draft: "Да, воспитанные собаки и кошки допускаются бесплатно; служебные животные размещаются всегда.",
                polish: "Да, собаки и кошки принимаются бесплатно; служебные животные принимаются всегда.",
                note: "Use neutral, natural Russian pet-policy wording."
            },
            {
                draft: "Да, фитнес-зал доступен проживающим гостям круглосуточно по ключ-картам.",
                polish: "Да, фитнес-зал доступен проживающим гостям круглосуточно по ключ-карте.",
                note: "Use natural Russian key-card access wording."
            },
            {
                draft: "NYX Hotel Prague входит в lifestyle-коллекцию NYX Hotels сети Leonardo Hotels.",
                polish: "NYX Hotel Prague входит в коллекцию lifestyle-отелей NYX Hotels сети Leonardo Hotels.",
                note: "Avoid mixed-script compounds that sound machine-translated."
            },
            {
                draft: "Да, NYX Hotel Prague готовит обильный ежедневный завтрак «шведский стол», который подаётся в обеденной зоне.",
                polish: "Да, NYX Hotel Prague ежедневно сервирует обильный завтрак «шведский стол» в зале для завтраков.",
                note: "Use natural Russian breakfast wording."
            },
            {
                draft: "Аэропорт имени Вацлава Гавела расположен примерно в 10 км от NYX Hotel Prague; организуется платный трансфер.",
                polish: "Аэропорт имени Вацлава Гавела расположен примерно в 10 км от NYX Hotel Prague; можно организовать платный трансфер.",
                note: "Avoid stiff passive wording for hotel-arranged services."
            },
            {
                draft: "Да, Главный вокзал Праги расположен примерно в 450 м, это лёгкая прогулка пешком.",
                polish: "Да, Главный вокзал Праги расположен примерно в 450 м, до него легко дойти пешком.",
                note: "Use natural Russian walking-distance wording."
            },
            {
                draft: "Да, для удобства гостей доступно защищённое хранение велосипедов в помещении.",
                polish: "Да, для удобства гостей доступно охраняемое помещение для хранения велосипедов.",
                note: "Use natural Russian for secure bicycle storage."
            },
            {
                draft: "Да, NYX Hotel Prague периодически проводит кураторские выставки работ современных местных художников.",
                polish: "Да, NYX Hotel Prague периодически проводит выставки работ современных местных художников.",
                note: "Keep art-program wording fluent and guest-facing."
            },
            {
                draft: "Да, консьерж с радостью организует билеты в театр, музейные абонементы и экскурсии по Парижу.",
                polish: "Да, консьерж может организовать билеты в театр, билеты в музеи и экскурсии по Парижу.",
                note: "Keep concierge-service wording neutral and natural."
            },
            {
                draft: "Транслируются ли спортивные мероприятия в баре или зоне отдыха Leonardo Boutique Hotel Paris Opera?",
                polish: "Показывают ли спортивные трансляции в баре или лаунж-зоне Leonardo Boutique Hotel Paris Opera?",
                note: "Use natural bar/lounge broadcast wording."
            },
            {
                draft: "Да, спортивные трансляции регулярно показываются в баре и зоне отдыха.",
                polish: "Да, спортивные трансляции регулярно показывают в баре и лаунж-зоне.",
                note: "More natural Russian active phrasing."
            }
        ]
    },
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

const MASTER_ST_PAULS_TERMINOLOGY: Pick<TerminologyManagement, "es" | "it" | "fr" | "he"> = {
    es: {
        mappings: [
            { forbidden: "apartamentos servidos", preferred: "apartamentos con servicios", reason: "Calco literal de serviced apartments; suena poco natural en web hotelera.", tags: ["master", "serviced-apartments"] },
            { forbidden: "aparthotel", preferred: "Aparthotel", reason: "Stay Master uses Aparthotel as the official Trevi property type.", tags: ["master", "positioning"] },
            { forbidden: "soporte virtual de huéspedes", preferred: "atención virtual al huésped", reason: "Más cercano, claro y natural para atención al cliente.", tags: ["master", "guest-support"] },
            { forbidden: "servicio doméstico", preferred: "limpieza", reason: "Evita un tono doméstico extraño; en alojamiento funciona mejor como servicio de limpieza.", tags: ["master", "housekeeping"] },
            { forbidden: "facilidades de lavandería", preferred: "zona de lavandería", reason: "Evita el calco de facilities.", tags: ["master", "amenities"] },
            { forbidden: "viajeros empresariales", preferred: "viajeros de negocios", reason: "Más idiomático y menos rígido.", tags: ["master", "audience"] },
            { forbidden: "trabajadores remotos", preferred: "personas que trabajan en remoto", reason: "Suena más humano y menos etiquetado.", tags: ["master", "audience"] },
            { forbidden: "en sitio", preferred: "en el alojamiento", reason: "Para amenities, en el alojamiento es más natural que un calco de on-site.", tags: ["master", "amenities"] },
            { forbidden: "auto check-in", preferred: "check-in autónomo", reason: "Más claro para usuarios hispanohablantes sin sonar técnico.", tags: ["master", "arrival"] },
            { forbidden: "check-in propio", preferred: "check-in autónomo", reason: "Evita una traducción literal poco habitual.", tags: ["master", "arrival"] },
            { forbidden: "tarifa nocturna", preferred: "tarifa por noche", reason: "Uso estándar en alojamiento.", tags: ["master", "booking"] },
            { forbidden: "duchas roll-in", preferred: "duchas accesibles a ras de suelo", reason: "Lenguaje claro y útil para accesibilidad.", tags: ["master", "accessibility"] },
            { forbidden: "rieles de agarre", preferred: "barras de apoyo", reason: "Término natural en accesibilidad.", tags: ["master", "accessibility"] },
            { forbidden: "lavabos bajos", preferred: "lavabos a menor altura", reason: "Suena más cuidado y menos brusco.", tags: ["master", "accessibility"] },
            { forbidden: "autoabastecimiento", preferred: "cocina equipada para uso propio", reason: "Self-catering no debe sonar técnico ni económico.", tags: ["master", "food"] },
            { forbidden: "incidentes", preferred: "gastos adicionales", reason: "Incidentals en hotelería son cargos, no incidentes.", tags: ["master", "payments"] },
            { forbidden: "preautorizado por daños", preferred: "preautorizada para posibles daños o gastos adicionales", reason: "Más preciso y menos alarmante.", tags: ["master", "payments"] },
            { forbidden: "complementario", preferred: "gratuito", reason: "Complimentary en hotelería significa gratuito/incluido.", tags: ["master", "amenities"] }
        ],
        examples: [
            {
                draft: "master St. Paul's ofrece apartamentos servidos con soporte virtual de huéspedes y facilidades de lavandería.",
                polish: "master St. Paul's ofrece apartamentos con servicios, atención virtual al huésped y zona de lavandería.",
                note: "Keep the product clear and web-friendly without literal English calques.",
                tags: ["master", "serviced-apartments"]
            },
            {
                draft: "El auto check-in usa un código PIN y la tarjeta puede ser preautorizada por incidentes.",
                polish: "El check-in autónomo funciona con un código PIN y la tarjeta puede quedar preautorizada para posibles daños o gastos adicionales.",
                note: "Arrival and payment language should feel clear, calm, and guest-friendly.",
                tags: ["master", "arrival", "payments"]
            }
        ]
    },

    it: {
        mappings: [
            { forbidden: "appartamenti con servizi", preferred: "appartamenti serviti", reason: "Stay Master uses Appartamenti serviti as the official Italian label for serviced apartments.", tags: ["master", "serviced-apartments"] },
            { forbidden: "aparthotel", preferred: "Aparthotel", reason: "Stay Master uses Aparthotel as the official Trevi property type.", tags: ["master", "positioning"] },
            { forbidden: "supporto virtuale agli ospiti", preferred: "assistenza virtuale agli ospiti", reason: "Più naturale e più vicino al tono hospitality.", tags: ["master", "guest-support"] },
            { forbidden: "governo della casa", preferred: "pulizie", reason: "Evita una resa letterale inadatta al contesto hotel.", tags: ["master", "housekeeping"] },
            { forbidden: "facilità di lavanderia", preferred: "area lavanderia", reason: "Evita il calco di facilities.", tags: ["master", "amenities"] },
            { forbidden: "viaggiatori business", preferred: "viaggiatori d'affari", reason: "Più scorrevole e meno ibrido.", tags: ["master", "audience"] },
            { forbidden: "lavoratori remoti", preferred: "chi lavora da remoto", reason: "Più naturale per una frase rivolta agli ospiti.", tags: ["master", "audience"] },
            { forbidden: "sul sito", preferred: "in struttura", reason: "Per amenities e servizi, in struttura è la formula naturale.", tags: ["master", "amenities"] },
            { forbidden: "auto check-in", preferred: "self check-in", reason: "Formula più comune in contesto hotel italiano.", tags: ["master", "arrival"] },
            { forbidden: "check-in automatico", preferred: "self check-in", reason: "Evita un tono tecnico e impersonale.", tags: ["master", "arrival"] },
            { forbidden: "tariffa notturna", preferred: "tariffa per notte", reason: "Uso standard per prenotazioni e soggiorni.", tags: ["master", "booking"] },
            { forbidden: "docce roll-in", preferred: "docce accessibili a filo pavimento", reason: "Più chiaro e corretto per accessibilità.", tags: ["master", "accessibility"] },
            { forbidden: "rotaie di presa", preferred: "maniglioni di sostegno", reason: "Termine naturale per bagni accessibili.", tags: ["master", "accessibility"] },
            { forbidden: "lavabi bassi", preferred: "lavabi ribassati", reason: "Più preciso e adatto a una descrizione accessibile.", tags: ["master", "accessibility"] },
            { forbidden: "self-catering", preferred: "cucina attrezzata per uso autonomo", reason: "Spiega il beneficio senza lasciare inglese non necessario.", tags: ["master", "food"] },
            { forbidden: "incidenti", preferred: "spese extra", reason: "Incidentals sono costi extra, non incidenti.", tags: ["master", "payments"] },
            { forbidden: "preautorizzata per danni", preferred: "preautorizzata per eventuali danni o spese extra", reason: "Più preciso e meno brusco.", tags: ["master", "payments"] },
            { forbidden: "accesso complementare", preferred: "accesso gratuito", reason: "Complimentary in hospitality significa gratuito/incluso.", tags: ["master", "amenities"] }
        ],
        examples: [
            {
                draft: "master St. Paul's offre appartamenti con servizi, supporto virtuale agli ospiti e facilità di lavanderia.",
                polish: "master St. Paul's offre appartamenti serviti, assistenza virtuale agli ospiti e area lavanderia.",
                note: "Keep the copy natural and aligned with Italian hotel websites.",
                tags: ["master", "serviced-apartments"]
            },
            {
                draft: "Il check-in automatico usa un codice PIN e la carta può essere preautorizzata per incidenti.",
                polish: "Il self check-in funziona con un codice PIN e la carta può essere preautorizzata per eventuali danni o spese extra.",
                note: "Arrival and payment language should be clear without sounding machine-translated.",
                tags: ["master", "arrival", "payments"]
            }
        ]
    },

    fr: {
        mappings: [
            { forbidden: "appartements desservis", preferred: "appartements avec services hôteliers", reason: "Calque littéral de serviced apartments; évoque plutôt les transports.", tags: ["master", "serviced-apartments"] },
            { forbidden: "appart'hôtel", preferred: "appartements avec services hôteliers", reason: "Décrit mieux le produit sans le réduire à une catégorie générique.", tags: ["master", "positioning"] },
            { forbidden: "support invité virtuel", preferred: "assistance clients à distance", reason: "Plus naturel et plus professionnel pour une page web hôtelière.", tags: ["master", "guest-support"] },
            { forbidden: "support virtuel aux clients", preferred: "assistance clients à distance", reason: "Évite une formulation traduite trop littéralement.", tags: ["master", "guest-support"] },
            { forbidden: "ménage domestique", preferred: "service de ménage", reason: "Plus adapté au contexte hôtelier.", tags: ["master", "housekeeping"] },
            { forbidden: "installations de blanchisserie", preferred: "espace laverie", reason: "Plus simple et plus naturel pour des appartements.", tags: ["master", "amenities"] },
            { forbidden: "voyageurs business", preferred: "voyageurs d'affaires", reason: "Formulation française plus soignée.", tags: ["master", "audience"] },
            { forbidden: "travailleurs à distance", preferred: "personnes en télétravail", reason: "Plus idiomatique et moins calqué.", tags: ["master", "audience"] },
            { forbidden: "sur le site", preferred: "sur place", reason: "Pour les services d'un établissement, sur place est la formule naturelle.", tags: ["master", "amenities"] },
            { forbidden: "check-in automatique", preferred: "arrivée autonome", reason: "Plus chaleureux et plus clair que le vocabulaire technique.", tags: ["master", "arrival"] },
            { forbidden: "auto check-in", preferred: "arrivée autonome", reason: "Évite un anglicisme inutile.", tags: ["master", "arrival"] },
            { forbidden: "tarif nocturne", preferred: "tarif par nuit", reason: "Usage standard pour l'hébergement.", tags: ["master", "booking"] },
            { forbidden: "douches roll-in", preferred: "douches accessibles de plain-pied", reason: "Formulation claire pour l'accessibilité.", tags: ["master", "accessibility"] },
            { forbidden: "rails de prise", preferred: "barres d'appui", reason: "Terme naturel pour les équipements accessibles.", tags: ["master", "accessibility"] },
            { forbidden: "éviers de salle de bain plus bas", preferred: "lavabos abaissés", reason: "Plus précis et plus élégant.", tags: ["master", "accessibility"] },
            { forbidden: "auto-restauration", preferred: "avec cuisine équipée pour préparer vos repas", reason: "Self-catering doit être expliqué de façon accueillante.", tags: ["master", "food"] },
            { forbidden: "frais incidentels", preferred: "frais annexes", reason: "Évite un calque financier de l'anglais.", tags: ["master", "payments"] },
            { forbidden: "complémentaire", preferred: "gratuit", reason: "Complimentary en hôtellerie signifie gratuit/inclus.", tags: ["master", "amenities"] }
        ],
        examples: [
            {
                draft: "master St. Paul's propose des appartements desservis avec support invité virtuel et installations de blanchisserie.",
                polish: "master St. Paul's propose des appartements avec services hôteliers, une assistance clients à distance et un espace laverie.",
                note: "Avoid literal English structure and keep French hospitality copy fluent.",
                tags: ["master", "serviced-apartments"]
            },
            {
                draft: "Le check-in automatique utilise un code PIN et la carte peut être préautorisée pour des frais incidentels.",
                polish: "L'arrivée autonome fonctionne avec un code PIN et la carte peut faire l'objet d'une préautorisation pour couvrir d'éventuels dommages ou frais annexes.",
                note: "Make arrival/payment instructions calm, clear, and guest-facing.",
                tags: ["master", "arrival", "payments"]
            }
        ]
    },

    he: {
        mappings: [
            { forbidden: "דירות שירות", preferred: "דירות אירוח עם שירותים מלונאיים", reason: "תרגום מילולי ולא ברור בעברית ישראלית.", tags: ["master", "serviced-apartments"] },
            { forbidden: "מלון דירות", preferred: "דירות אירוח עם שירותים מלונאיים", reason: "מדויק יותר למוצר של master ומונע ציפייה למלון מלא.", tags: ["master", "positioning"] },
            { forbidden: "תמיכת אורחים וירטואלית", preferred: "תמיכת אורחים מרחוק", reason: "נשמע טבעי יותר ופחות מתורגם.", tags: ["master", "guest-support"] },
            { forbidden: "שירות משק בית", preferred: "שירות ניקיון", reason: "באתר מלונאי בעברית זה נשמע ברור ונעים יותר.", tags: ["master", "housekeeping"] },
            { forbidden: "מתקני כביסה באתר", preferred: "מתקני כביסה במקום", reason: "מונע תרגום מילולי של on-site.", tags: ["master", "amenities"] },
            { forbidden: "נוסעי עסקים", preferred: "נוסעים עסקיים", reason: "ניסוח טבעי יותר לקהל יעד.", tags: ["master", "audience"] },
            { forbidden: "עובדים מרוחקים", preferred: "אורחים שעובדים מרחוק", reason: "נשמע אנושי יותר ומתאים להקשר של אירוח.", tags: ["master", "audience"] },
            { forbidden: "שהייה ארוכת טווח", preferred: "שהייה לטווח ארוך", reason: "ידידותי יותר לקופי באתר.", tags: ["master", "booking"] },
            { forbidden: "אינטרנט אלחוטי במהירות גבוהה", preferred: "Wi-Fi מהיר", reason: "קצר, טבעי ושימושי יותר באתרי מלונות.", tags: ["master", "amenities"] },
            { forbidden: "קבלה 24 שעות", preferred: "קבלה 24/7", reason: "ניסוח קצר ומוכר יותר.", tags: ["master", "service"] },
            { forbidden: "בדיקה עצמית", preferred: "צ׳ק-אין עצמי", reason: "מונע תרגום שגוי של check-in.", tags: ["master", "arrival"] },
            { forbidden: "צ׳ק אין עצמי", preferred: "צ׳ק-אין עצמי", reason: "אחידות כתיב עם מקף.", tags: ["master", "arrival"] },
            { forbidden: "קוד גישה", preferred: "קוד כניסה", reason: "במוצר הזה מדובר בכניסה לדירה, ולכן זה ברור יותר לאורח.", tags: ["master", "arrival"] },
            { forbidden: "מקלחוני רול-אין", preferred: "מקלחות נגישות ללא מדרגה", reason: "שפת נגישות ברורה וטבעית יותר.", tags: ["master", "accessibility"] },
            { forbidden: "פסי אחיזה", preferred: "מאחזי יד", reason: "מונח טבעי יותר לתיאור נגישות.", tags: ["master", "accessibility"] },
            { forbidden: "כיורים נמוכים", preferred: "כיורים מונמכים בחדר הרחצה", reason: "ניסוח מדויק ומכבד יותר.", tags: ["master", "accessibility"] },
            { forbidden: "קייטרינג עצמי", preferred: "עם אפשרות להכנת ארוחות באופן עצמאי", reason: "קייטרינג עצמי נשמע לא טבעי בהקשר של דירה.", tags: ["master", "food"] },
            { forbidden: "הוצאות נלוות", preferred: "חיובים נלווים", reason: "מתאים יותר להקשר של כרטיס אשראי ותשלום במלון.", tags: ["master", "payments"] },
            { forbidden: "אישור מראש", preferred: "אישור מסגרת זמני באשראי", reason: "מבהיר את המשמעות של pre-authorisation ולא נשאר עמום.", tags: ["master", "payments"] },
            { forbidden: "גישה משלימה לחדר כושר", preferred: "כניסה חינם לחדר הכושר", reason: "מונע תרגום מילולי של complimentary.", tags: ["master", "amenities"] }
        ],
        examples: [
            {
                draft: "master St. Paul's מציע דירות שירות עם תמיכת אורחים וירטואלית ומתקני כביסה באתר.",
                polish: "master St. Paul's מציע דירות אירוח עם שירותים מלונאיים, תמיכת אורחים מרחוק ומתקני כביסה במקום.",
                note: "Keep Hebrew natural, clear, and suitable for hotel web copy.",
                tags: ["master", "serviced-apartments"]
            },
            {
                draft: "הבדיקה העצמית מתבצעת עם קוד גישה והכרטיס עשוי לעבור אישור מראש עבור הוצאות נלוות.",
                polish: "הצ׳ק-אין העצמי מתבצע עם קוד כניסה, והכרטיס עשוי לקבל אישור מסגרת זמני באשראי לכיסוי נזקים או חיובים נלווים.",
                note: "Arrival and payment copy should sound human and precise, not literal.",
                tags: ["master", "arrival", "payments"]
            }
        ]
    }
};

const STAY_MASTER_TERMINOLOGY: Pick<TerminologyManagement, "es" | "it"> = {
    es: {
        mappings: [
            { forbidden: "apartotel", preferred: "Aparthotel", reason: "The Stay Master Spanish site labels master Trevi as Aparthotel.", tags: ["stay-master", "trevi", "property-type"] },
            { forbidden: "hotel de apartamentos", preferred: "Aparthotel", reason: "Use the brand's official Trevi property type instead of a generic paraphrase.", tags: ["stay-master", "trevi", "property-type"] },
            { forbidden: "apartamentos servidos", preferred: "Apartamentos con servicios", reason: "The Stay Master Spanish site uses Apartamentos con servicios for serviced-apartment locations.", tags: ["stay-master", "serviced-apartments"] },
            { forbidden: "servicio de estilo hotel", preferred: "servicios de hotel", reason: "Shorter, more natural and closer to the brand copy.", tags: ["stay-master", "brand-voice"] },
            { forbidden: "habitaciones de master Trevi", preferred: "apartamentos de master Trevi", reason: "Trevi sells apartments/studios, not hotel rooms, when the copy refers to units.", tags: ["stay-master", "trevi", "rooms"] },
            { forbidden: "habitaciones de huéspedes", preferred: "apartamentos", reason: "For Stay Master apartment inventory, avoid hotel-room wording unless the source explicitly says room.", tags: ["stay-master", "rooms"] },
            { forbidden: "servicio de refrescos diario", preferred: "servicio ligero diario de repaso", reason: "In the Trevi questionnaire this refers to a light apartment refresh, not drinks.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "servicio diario de refrigerios", preferred: "servicio ligero diario de repaso", reason: "Avoid confusing housekeeping refresh with lobby refreshments.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "limpieza de habitaciones", preferred: "limpieza del apartamento", reason: "Use apartment wording for Stay Master units.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "front desk", preferred: "recepción", reason: "Keep Spanish output free of unnecessary English for reception/front desk.", tags: ["stay-master", "service"] },
            { forbidden: "mostrador de recepción", preferred: "recepción", reason: "Reception is more natural in Stay Master Spanish copy.", tags: ["stay-master", "service"] },
            { forbidden: "documento de identidad emitido por el gobierno con foto", preferred: "documento de identidad válido con fotografía", reason: "Less bureaucratic and clearer for guests.", tags: ["stay-master", "check-in"] },
            { forbidden: "tarjeta preautorizada por incidentes", preferred: "tarjeta preautorizada para posibles daños o gastos adicionales", reason: "Incidentals are charges, not incidents.", tags: ["stay-master", "payments"] },
            { forbidden: "tasa municipal de Roma", preferred: "tasa turística de Roma", reason: "Use the standard traveller-facing city-tax term.", tags: ["stay-master", "tax"] },
            { forbidden: "plataformas de terceras partes", preferred: "plataformas de terceros", reason: "More natural Spanish for booking channels.", tags: ["stay-master", "booking"] },
            { forbidden: "se recoge separadamente al llegar", preferred: "se cobra por separado a la llegada", reason: "Use natural payment wording for city tax.", tags: ["stay-master", "tax"] },
            { forbidden: "perros entrenados", preferred: "perros adiestrados", reason: "More natural Spanish for trained dogs in hotel policy text.", tags: ["stay-master", "pets"] },
            { forbidden: "sin atender", preferred: "sin supervisión", reason: "Natural phrasing for pets not being left unattended.", tags: ["stay-master", "pets"] },
            { forbidden: "áreas exteriores designadas", preferred: "zonas exteriores habilitadas", reason: "More native Spanish for smoking-policy areas.", tags: ["stay-master", "policy"] }
        ],
        examples: [
            {
                draft: "master Trevi es un hotel de apartamentos de lujo con habitaciones, servicio de estilo hotel y servicio de refrescos diario.",
                polish: "master Trevi es un Aparthotel con apartamentos, servicios de hotel y un servicio ligero diario de repaso.",
                note: "Trevi should keep the official Aparthotel/apartment positioning and avoid confusing refresh service with drinks.",
                tags: ["stay-master", "trevi", "property-type", "housekeeping"]
            },
            {
                draft: "La tarjeta puede ser preautorizada por incidentes y la tasa municipal de Roma se recoge separadamente al llegar.",
                polish: "La tarjeta puede quedar preautorizada para posibles daños o gastos adicionales, y la tasa turística de Roma se cobra por separado a la llegada.",
                note: "Payment and tax copy should be calm, clear and guest-facing.",
                tags: ["stay-master", "payments", "tax"]
            }
        ]
    },
    it: {
        mappings: [
            { forbidden: "appartamenti con servizi", preferred: "appartamenti serviti", reason: "The Stay Master Italian site uses Appartamenti serviti.", tags: ["stay-master", "serviced-apartments"] },
            { forbidden: "hotel appartamento", preferred: "Aparthotel", reason: "The Stay Master Italian site labels master Trevi as Aparthotel.", tags: ["stay-master", "trevi", "property-type"] },
            { forbidden: "servizi in stile hotel", preferred: "servizi da hotel", reason: "Closer to the brand wording Appartamenti con servizi da hotel.", tags: ["stay-master", "brand-voice"] },
            { forbidden: "camere di master Trevi", preferred: "appartamenti di master Trevi", reason: "Trevi sells apartments/studios, not hotel rooms, when the copy refers to units.", tags: ["stay-master", "trevi", "rooms"] },
            { forbidden: "camere degli ospiti", preferred: "appartamenti", reason: "For Stay Master apartment inventory, avoid hotel-room wording unless the source explicitly says room.", tags: ["stay-master", "rooms"] },
            { forbidden: "servizio quotidiano di rinfresco", preferred: "riassetto leggero quotidiano", reason: "In the Trevi questionnaire this refers to light housekeeping, not refreshments.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "servizio di rinfresco leggero quotidiano", preferred: "riassetto leggero quotidiano", reason: "Avoid confusing housekeeping refresh with lobby refreshments.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "pulizia delle camere", preferred: "pulizia dell'appartamento", reason: "Use apartment wording for Stay Master units.", tags: ["stay-master", "housekeeping"] },
            { forbidden: "scrivania frontale", preferred: "reception", reason: "Avoid literal front-desk translation.", tags: ["stay-master", "service"] },
            { forbidden: "documento d'identità rilasciato dal governo con foto", preferred: "documento d'identità valido con foto", reason: "Less bureaucratic and clearer for guests.", tags: ["stay-master", "check-in"] },
            { forbidden: "carta preautorizzata per incidenti", preferred: "carta preautorizzata per eventuali danni o spese extra", reason: "Incidentals are charges, not incidents.", tags: ["stay-master", "payments"] },
            { forbidden: "tassa cittadina di Roma", preferred: "tassa di soggiorno di Roma", reason: "Use the standard traveller-facing city-tax term.", tags: ["stay-master", "tax"] },
            { forbidden: "piattaforme di terze parti", preferred: "piattaforme di terzi", reason: "More natural Italian for booking channels.", tags: ["stay-master", "booking"] },
            { forbidden: "viene raccolta separatamente all'arrivo", preferred: "viene riscossa separatamente all'arrivo", reason: "Use natural payment wording for city tax.", tags: ["stay-master", "tax"] },
            { forbidden: "cani allenati", preferred: "cani addestrati", reason: "Correct Italian for trained dogs in hotel policy text.", tags: ["stay-master", "pets"] },
            { forbidden: "lasciati non sorvegliati", preferred: "lasciati incustoditi", reason: "Natural Italian for pets not being left unattended.", tags: ["stay-master", "pets"] },
            { forbidden: "aree esterne designate", preferred: "aree esterne dedicate", reason: "More fluent Italian for smoking-policy areas.", tags: ["stay-master", "policy"] }
        ],
        examples: [
            {
                draft: "master Trevi è un hotel appartamento di lusso con camere, servizi in stile hotel e servizio quotidiano di rinfresco.",
                polish: "master Trevi è un Aparthotel con appartamenti, servizi da hotel e un riassetto leggero quotidiano.",
                note: "Trevi should keep the official Aparthotel/apartment positioning and avoid confusing refresh service with drinks.",
                tags: ["stay-master", "trevi", "property-type", "housekeeping"]
            },
            {
                draft: "La carta può essere preautorizzata per incidenti e la tassa cittadina di Roma viene raccolta separatamente all'arrivo.",
                polish: "La carta può essere preautorizzata per eventuali danni o spese extra, e la tassa di soggiorno di Roma viene riscossa separatamente all'arrivo.",
                note: "Payment and tax copy should be calm, clear and guest-facing.",
                tags: ["stay-master", "payments", "tax"]
            }
        ]
    }
};

(["es", "it", "fr", "he"] as const).forEach((lang) => {
    const baseProfile = TERMINOLOGY_MANAGEMENT[lang];
    const masterProfile = MASTER_ST_PAULS_TERMINOLOGY[lang];

    TERMINOLOGY_MANAGEMENT[lang] = {
        mappings: [
            ...(baseProfile.mappings ?? []),
            ...(masterProfile.mappings ?? [])
        ],
        examples: [
            ...(baseProfile.examples ?? []),
            ...(masterProfile.examples ?? [])
        ]
    };
});

(["es", "it"] as const).forEach((lang) => {
    const baseProfile = TERMINOLOGY_MANAGEMENT[lang];
    const stayMasterProfile = STAY_MASTER_TERMINOLOGY[lang];

    TERMINOLOGY_MANAGEMENT[lang] = {
        mappings: [
            ...(baseProfile.mappings ?? []),
            ...(stayMasterProfile.mappings ?? [])
        ],
        examples: [
            ...(baseProfile.examples ?? []),
            ...(stayMasterProfile.examples ?? [])
        ]
    };
});
