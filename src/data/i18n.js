/**
 * i18n.js — teks antarmuka dan fakta ilmiah, dalam bahasa Indonesia dan Inggris.
 *
 * Fakta ditulis singkat dan konkret: satu baris menjelaskan sesuatu yang tidak
 * bisa dibaca langsung dari gambarnya (suhu, komposisi, jarak, keunikan).
 */
export const UI_TEXT = {
  id: {
    title: 'Tata surya test by hapis',
    subtitle: 'Tarik mundur globe untuk melihat seluruh tata surya',
    loading: 'Menyiapkan tekstur',
    loadingHint: 'Menyiapkan globe Bumi dan tata surya',
    scrollHint: 'Gulir (scroll) untuk menjauh',
    scrollHintDetail: 'Perkecil Bumi perlahan sampai seluruh tata surya terlihat',
    dragHint: 'Seret untuk memutar',
    clickHint: 'Klik planet untuk mendekatinya',
    levelTitle: 'Skala pandang',
    levelGlobe: 'Permukaan planet',
    levelOrbit: 'Orbit planet',
    levelInner: 'Tata surya bagian dalam',
    levelOuter: 'Seluruh tata surya',
    legendTitle: 'Benda langit',
    settingsTitle: 'Pengaturan',
    infoTitle: 'Keterangan',
    close: 'Tutup',
    speed: 'Kecepatan waktu',
    speedPaused: 'Dijeda',
    orbits: 'Garis orbit',
    labels: 'Label nama',
    belts: 'Sabuk asteroid',
    bloom: 'Efek cahaya (bloom)',
    autoRotate: 'Putar otomatis',
    quality: 'Kualitas grafis',
    language: 'Bahasa',
    qualityAuto: 'Otomatis',
    resetView: 'Kembali ke Bumi',
    resetDate: 'Kembali ke hari ini',
    simDate: 'Tanggal simulasi',
    pause: 'Jeda',
    play: 'Jalankan',
    credits: 'Sumber tekstur',
    creditsText:
      'Tekstur planet oleh Solar System Scope (CC BY 4.0). Bulan-bulan kecil digambar secara prosedural.',
    keyboardHelp:
      'Gulir: zoom · Seret: putar · Klik planet: dekati · R: kembali ke Bumi · Spasi: jeda · O: garis orbit · L: label · H: sembunyikan antarmuka · 0-9: pilih benda langit',
    webglError: 'Peramban ini tidak dapat menjalankan WebGL, sehingga tata surya tidak dapat ditampilkan.',
    webglErrorHint: 'Coba peramban lain yang lebih baru, atau aktifkan akselerasi perangkat keras.',
    units: { au: 'SA', days: 'hari' },
  },
  en: {
    title: 'Interactive Solar System',
    subtitle: 'An Earth globe you can pull back into the whole solar system',
    loading: 'Loading textures',
    loadingHint: 'Preparing the Earth globe and solar system',
    scrollHint: 'Scroll to zoom out',
    scrollHintDetail: 'Pull back from Earth until the whole solar system appears',
    dragHint: 'Drag to orbit',
    clickHint: 'Click a planet to fly to it',
    levelTitle: 'View scale',
    levelGlobe: 'Planet surface',
    levelOrbit: 'Planetary orbit',
    levelInner: 'Inner solar system',
    levelOuter: 'The whole solar system',
    legendTitle: 'Celestial bodies',
    settingsTitle: 'Settings',
    infoTitle: 'Details',
    close: 'Close',
    speed: 'Time speed',
    speedPaused: 'Paused',
    orbits: 'Orbit lines',
    labels: 'Name labels',
    belts: 'Asteroid belt',
    bloom: 'Glow (bloom)',
    autoRotate: 'Auto rotate',
    quality: 'Graphics quality',
    language: 'Language',
    qualityAuto: 'Automatic',
    resetView: 'Back to Earth',
    resetDate: 'Back to today',
    simDate: 'Simulated date',
    pause: 'Pause',
    play: 'Play',
    credits: 'Texture source',
    creditsText:
      'Planet textures by Solar System Scope (CC BY 4.0). Small moons are drawn procedurally.',
    keyboardHelp:
      'Scroll: zoom · Drag: orbit · Click a planet: fly to it · R: back to Earth · Space: pause · O: orbits · L: labels · H: hide UI · 0-9: select a body',
    webglError: 'This browser cannot run WebGL, so the solar system cannot be displayed.',
    webglErrorHint: 'Try a newer browser, or enable hardware acceleration.',
    units: { au: 'AU', days: 'days' },
  },
};

/**
 * Fakta per benda langit. `stats` ditampilkan sebagai daftar angka ringkas,
 * `facts` sebagai poin-poin yang menjelaskan hal yang tidak terlihat langsung
 * dari gambarnya.
 */
export const BODY_FACTS = {
  sun: {
    id: {
      tagline: 'Bintang induk: 99,86% massa tata surya ada di sini.',
      stats: [
        ['Diameter', '1.392.700 km'],
        ['Suhu permukaan', '5.500 °C'],
        ['Suhu inti', '15.000.000 °C'],
        ['Umur', '4,6 miliar tahun'],
      ],
      facts: [
        'Setiap detiknya Matahari mengubah sekitar 600 juta ton hidrogen menjadi helium.',
        'Cahaya Matahari butuh 8 menit 20 detik untuk sampai ke Bumi.',
        'Permukaannya bukan padat: yang terlihat adalah plasma yang mendidih dan mengalir.',
      ],
    },
    en: {
      tagline: 'The host star: 99.86% of the solar system’s mass is here.',
      stats: [
        ['Diameter', '1,392,700 km'],
        ['Surface temperature', '5,500 °C'],
        ['Core temperature', '15,000,000 °C'],
        ['Age', '4.6 billion years'],
      ],
      facts: [
        'The Sun fuses about 600 million tonnes of hydrogen into helium every second.',
        'Sunlight takes 8 minutes 20 seconds to reach Earth.',
        'Its surface is not solid: what you see is boiling, flowing plasma.',
      ],
    },
  },
  mercury: {
    id: {
      tagline: 'Planet terkecil dan tercepat, tanpa atmosfer yang berarti.',
      stats: [
        ['Jarak dari Matahari', '0,39 SA'],
        ['Suhu', '−173 °C sampai 427 °C'],
        ['Satu tahun', '88 hari Bumi'],
        ['Satu hari', '176 hari Bumi'],
      ],
      facts: [
        'Perbedaan suhu siang dan malamnya paling ekstrem di antara semua planet.',
        'Permukaannya penuh kawah dan hampir tidak berubah selama miliaran tahun.',
        'Satu kali putaran pada porosnya hampir dua kali lebih lama daripada satu tahunnya.',
      ],
    },
    en: {
      tagline: 'The smallest and fastest planet, with almost no atmosphere.',
      stats: [
        ['Distance from Sun', '0.39 AU'],
        ['Temperature', '−173 °C to 427 °C'],
        ['One year', '88 Earth days'],
        ['One day', '176 Earth days'],
      ],
      facts: [
        'Its day-to-night temperature swing is the most extreme of any planet.',
        'The surface is cratered and has barely changed in billions of years.',
        'One spin on its axis takes nearly two of its years.',
      ],
    },
  },
  venus: {
    id: {
      tagline: 'Kembaran Bumi yang berubah menjadi rumah kaca terpanas.',
      stats: [
        ['Jarak dari Matahari', '0,72 SA'],
        ['Suhu permukaan', '465 °C'],
        ['Tekanan permukaan', '92 kali Bumi'],
        ['Satu tahun', '225 hari Bumi'],
      ],
      facts: [
        'Awan asam sulfatnya memantulkan cahaya, sehingga Venus tampak paling terang di langit malam.',
        'Atmosfernya 96% karbon dioksida; efek rumah kacanya membuat Venus lebih panas daripada Merkurius.',
        'Venus berputar mundur, dan satu hari di sana lebih lama daripada satu tahunnya.',
      ],
    },
    en: {
      tagline: 'Earth’s twin that turned into the hottest greenhouse world.',
      stats: [
        ['Distance from Sun', '0.72 AU'],
        ['Surface temperature', '465 °C'],
        ['Surface pressure', '92x Earth'],
        ['One year', '225 Earth days'],
      ],
      facts: [
        'Its sulphuric acid clouds reflect so much light that Venus is the brightest planet in our sky.',
        'The atmosphere is 96% carbon dioxide, and its greenhouse effect makes it hotter than Mercury.',
        'Venus spins backwards, and one day there lasts longer than its year.',
      ],
    },
  },
  earth: {
    id: {
      tagline: 'Satu-satunya tempat yang diketahui memiliki kehidupan.',
      stats: [
        ['Jarak dari Matahari', '1,00 SA'],
        ['Suhu rata-rata', '15 °C'],
        ['Permukaan air', '71%'],
        ['Satu tahun', '365,25 hari'],
      ],
      facts: [
        'Atmosfernya 78% nitrogen dan 21% oksigen — komposisi yang hanya mungkin dengan adanya kehidupan.',
        'Sisi malam Bumi menunjukkan cahaya kota: pola permukiman manusia terlihat dari angkasa.',
        'Bulan mengorbit pada jarak sekitar 384.400 km dan rotasinya terkunci, jadi satu sisi selalu menghadap Bumi.',
      ],
    },
    en: {
      tagline: 'The only place known to have life.',
      stats: [
        ['Distance from Sun', '1.00 AU'],
        ['Average temperature', '15 °C'],
        ['Water surface', '71%'],
        ['One year', '365.25 days'],
      ],
      facts: [
        'Its atmosphere is 78% nitrogen and 21% oxygen — a mix only possible with life.',
        'The night side shows city lights: human settlement patterns are visible from space.',
        'The Moon orbits at about 384,400 km with locked rotation, so the same face always points at Earth.',
      ],
    },
  },
  moon: {
    id: {
      tagline: 'Satelit alam terbesar kelima, dan satu-satunya yang pernah dikunjungi manusia.',
      stats: [
        ['Jarak dari Bumi', '384.400 km'],
        ['Diameter', '3.475 km'],
        ['Satu orbit', '27,3 hari'],
        ['Gravitasi', '1/6 Bumi'],
      ],
      facts: [
        'Sisi jauhnya baru bisa dilihat manusia setelah wahana antariksa memutari Bulan.',
        'Pasang-surut laut di Bumi terutama digerakkan oleh gravitasi Bulan.',
        'Karena rotasinya terkunci, dari Bumi kita selalu melihat sisi yang sama.',
      ],
    },
    en: {
      tagline: 'The fifth-largest natural satellite, and the only one humans have visited.',
      stats: [
        ['Distance from Earth', '384,400 km'],
        ['Diameter', '3,475 km'],
        ['One orbit', '27.3 days'],
        ['Gravity', '1/6 of Earth'],
      ],
      facts: [
        'No human saw the far side until spacecraft flew around it.',
        'Ocean tides on Earth are driven mostly by the Moon’s gravity.',
        'Because its rotation is locked, we only ever see one side from Earth.',
      ],
    },
  },
  mars: {
    id: {
      tagline: 'Planet merah, target utama eksplorasi berawak.',
      stats: [
        ['Jarak dari Matahari', '1,52 SA'],
        ['Suhu rata-rata', '−63 °C'],
        ['Satu tahun', '687 hari Bumi'],
        ['Jumlah bulan', '2'],
      ],
      facts: [
        'Warna merahnya berasal dari besi oksida — karat — pada debu permukaannya.',
        'Olympus Mons adalah gunung tertinggi di tata surya, hampir tiga kali tinggi Everest.',
        'Phobos mengorbit begitu cepat sehingga terbit dua kali dalam sehari Mars.',
      ],
    },
    en: {
      tagline: 'The red planet, primary target for crewed exploration.',
      stats: [
        ['Distance from Sun', '1.52 AU'],
        ['Average temperature', '−63 °C'],
        ['One year', '687 Earth days'],
        ['Moons', '2'],
      ],
      facts: [
        'Its red colour comes from iron oxide — rust — in the surface dust.',
        'Olympus Mons is the tallest volcano in the solar system, nearly three times Everest.',
        'Phobos orbits so fast that it rises twice in a single Martian day.',
      ],
    },
  },
  jupiter: {
    id: {
      tagline: 'Raksasa gas dengan massa lebih dari dua kali semua planet lain digabung.',
      stats: [
        ['Jarak dari Matahari', '5,20 SA'],
        ['Diameter', '139.820 km'],
        ['Satu hari', '9,9 jam'],
        ['Jumlah bulan', '95+'],
      ],
      facts: [
        'Bintik Merah Besar adalah badai yang sudah berlangsung lebih dari satu abad, dan bisa memuat satu Bumi.',
        'Pitanya bukan permukaan: yang terlihat adalah puncak awan amonia yang bergerak dengan kecepatan berbeda.',
        'Empat bulan terbesarnya — Io, Europa, Ganymede, Callisto — ditemukan Galileo pada 1610.',
      ],
    },
    en: {
      tagline: 'A gas giant more massive than twice all other planets combined.',
      stats: [
        ['Distance from Sun', '5.20 AU'],
        ['Diameter', '139,820 km'],
        ['One day', '9.9 hours'],
        ['Moons', '95+'],
      ],
      facts: [
        'The Great Red Spot is a storm that has raged for over a century and could swallow Earth.',
        'Its bands are not a surface: you are seeing ammonia cloud tops moving at different speeds.',
        'The four largest moons were found by Galileo in 1610.',
      ],
    },
  },
  saturn: {
    id: {
      tagline: 'Cincin paling megah, dan planet paling ringan.',
      stats: [
        ['Jarak dari Matahari', '9,54 SA'],
        ['Diameter', '116.460 km'],
        ['Massa jenis', '0,69 gram/cm³'],
        ['Jumlah bulan', '146+'],
      ],
      facts: [
        'Kepadatan Saturnus lebih kecil daripada air — secara teori ia bisa terapung.',
        'Cincinnya terbentang 280.000 km tetapi rata-rata hanya belasan meter tebalnya.',
        'Celah Cassini, yang terlihat jelas di antara cincin, lebarnya sekitar 4.800 km.',
      ],
    },
    en: {
      tagline: 'The grandest rings, and the lightest planet.',
      stats: [
        ['Distance from Sun', '9.54 AU'],
        ['Diameter', '116,460 km'],
        ['Density', '0.69 g/cm³'],
        ['Moons', '146+'],
      ],
      facts: [
        'Saturn is less dense than water — in theory it would float.',
        'The rings span 280,000 km but average only tens of metres thick.',
        'The Cassini Division is about 4,800 km wide.',
      ],
    },
  },
  uranus: {
    id: {
      tagline: 'Planet yang menggelinding: porosnya nyaris rebah.',
      stats: [
        ['Jarak dari Matahari', '19,19 SA'],
        ['Kemiringan poros', '97,8°'],
        ['Suhu', '−224 °C'],
        ['Satu tahun', '84 tahun Bumi'],
      ],
      facts: [
        'Uranus mengorbit sambil menggelinding, sehingga tiap kutub mengalami 42 tahun siang lalu 42 tahun malam.',
        'Warna birunya berasal dari metana yang menyerap cahaya merah.',
        'Ia planet pertama yang ditemukan lewat teleskop, pada tahun 1781.',
      ],
    },
    en: {
      tagline: 'The planet that rolls: its axis lies nearly on its side.',
      stats: [
        ['Distance from Sun', '19.19 AU'],
        ['Axial tilt', '97.8°'],
        ['Temperature', '−224 °C'],
        ['One year', '84 Earth years'],
      ],
      facts: [
        'Uranus rolls along its orbit, so each pole gets 42 years of daylight then 42 of darkness.',
        'Its blue-green colour comes from methane absorbing red light.',
        'It was the first planet found by telescope, in 1781.',
      ],
    },
  },
  neptune: {
    id: {
      tagline: 'Planet terjauh, dengan angin tercepat di tata surya.',
      stats: [
        ['Jarak dari Matahari', '30,07 SA'],
        ['Kecepatan angin', '2.100 km/jam'],
        ['Satu tahun', '165 tahun Bumi'],
        ['Jumlah bulan', '16'],
      ],
      facts: [
        'Neptunus ditemukan lewat perhitungan matematika sebelum benar-benar terlihat.',
        'Angin di sana bisa mencapai 2.100 km/jam — tercepat di tata surya.',
        'Triton, bulan terbesarnya, mengorbit mundur dan kemungkinan benda langit yang tertangkap.',
      ],
    },
    en: {
      tagline: 'The farthest planet, with the fastest winds in the solar system.',
      stats: [
        ['Distance from Sun', '30.07 AU'],
        ['Wind speed', '2,100 km/h'],
        ['One year', '165 Earth years'],
        ['Moons', '16'],
      ],
      facts: [
        'Neptune was found by mathematics before anyone saw it.',
        'Winds there reach 2,100 km/h — the fastest in the solar system.',
        'Triton orbits backwards and is probably a captured object.',
      ],
    },
  },
};

/** Keterangan singkat untuk bulan-bulan kecil, karena tempatnya terbatas. */
export const MOON_FACTS = {
  io: {
    id: 'Bulan paling aktif secara vulkanik di tata surya.',
    en: 'The most volcanically active body in the solar system.',
  },
  europa: {
    id: 'Di bawah kerak esnya tersimpan samudra air asin.',
    en: 'A salty ocean hides beneath its icy crust.',
  },
  ganymede: {
    id: 'Bulan terbesar di tata surya, lebih besar daripada Merkurius.',
    en: 'The largest moon in the solar system, bigger than Mercury.',
  },
  callisto: {
    id: 'Permukaannya paling penuh kawah di tata surya.',
    en: 'The most heavily cratered surface in the solar system.',
  },
  titan: {
    id: 'Punya atmosfer tebal dan danau metana cair.',
    en: 'It has a thick atmosphere and lakes of liquid methane.',
  },
  enceladus: {
    id: 'Geyser di kutubnya menyemburkan air dari samudra bawah es.',
    en: 'Geysers at its pole spray water from a subsurface ocean.',
  },
  rhea: {
    id: 'Bulan terbesar kedua Saturnus, hampir seluruhnya es.',
    en: 'Saturn’s second-largest moon, almost entirely ice.',
  },
  titania: {
    id: 'Bulan terbesar Uranus, penuh lembah dan ngarai.',
    en: 'The largest moon of Uranus, scarred by valleys and canyons.',
  },
  oberon: {
    id: 'Bulan terjauh Uranus, gelap dan penuh kawah tua.',
    en: 'The outermost major moon of Uranus, dark and heavily cratered.',
  },
  triton: {
    id: 'Mengorbit mundur dan punya geyser nitrogen.',
    en: 'It orbits backwards and has nitrogen geysers.',
  },
  phobos: {
    id: 'Bentuknya seperti kentang dan perlahan jatuh ke Mars.',
    en: 'Potato-shaped, and slowly spiralling into Mars.',
  },
  deimos: {
    id: 'Bulan kecil Mars, lebarnya hanya sekitar 12 km.',
    en: 'A tiny moon of Mars, only about 12 km across.',
  },
};

/**
 * Ambil teks fakta untuk sebuah benda langit pada bahasa tertentu.
 * @param {object} def definisi dari data/bodies.js
 * @param {'id'|'en'} language
 */
export function factsFor(def, language = 'id') {
  if (def.kind === 'moon') {
    return {
      tagline: MOON_FACTS[def.id]?.[language] ?? '',
      stats: [
        ['Diameter', `${(def.radiusKm * 2).toLocaleString('id-ID')} km`],
        [
          language === 'id' ? 'Periode orbit' : 'Orbital period',
          `${Math.abs(def.periodDays ?? 0).toFixed(2)} ${UI_TEXT[language].units.days}`,
        ],
        [
          language === 'id' ? 'Rotasi' : 'Rotation',
          def.tidallyLocked
            ? language === 'id'
              ? 'Terkunci pasang-surut'
              : 'Tidally locked'
            : `${Math.abs(def.rotationHours ?? 0).toFixed(1)} jam`,
        ],
      ],
      facts: [],
    };
  }
  return BODY_FACTS[def.id]?.[language] ?? { tagline: '', stats: [], facts: [] };
}
