/**
 * Phone numbers for booking forms: a dialling-code list, normalisation to
 * E.164, and display formatting.
 *
 * Deliberately hand-rolled rather than pulling in libphonenumber-js. That
 * library is 80-145 kB depending on metadata and would ship to every visitor
 * of a public booking page, to buy per-country length and prefix rules we do
 * not need: nothing here dials the number programmatically, a person reads it
 * and calls. So validation stays lenient (plausible digit count) and the value
 * is stored in a single unambiguous format.
 *
 * Pure module — no I/O, no React. See {@link file://./phone.test.ts}.
 */

export interface DiallingCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** country calling code, digits only, no plus */
  dial: string;
}

/** Fallback when a company has not chosen one. Tidetime's own origin is UK. */
export const DEFAULT_DIALLING_COUNTRY = "GB";

/**
 * Countries that keep the trunk "0" when dialled internationally. Almost every
 * country drops it (GB 07… -> +44 7…), so the general rule is to strip it;
 * Italy is the notable exception (+39 06… keeps the zero). Kept as a set so
 * the exception is visible rather than buried in a conditional.
 */
const KEEPS_TRUNK_ZERO = new Set(["IT"]);

/**
 * Several countries share one dialling code (+44 is GB, GG, IM and JE; +1 is
 * US and CA; +7 is RU and KZ). Splitting a number back apart has to pick one,
 * and the list is name-sorted, so without this Guernsey would win +44 purely
 * by alphabet. Names the country a bare code should resolve to.
 */
const PRIMARY_FOR_DIAL: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "44": "GB",
};

/** E.164 allows at most 15 digits including the country code. */
const MAX_E164_DIGITS = 15;
/** Shortest real international number (a few small territories sit at 8). */
const MIN_E164_DIGITS = 8;

// ISO code, display name, calling code. Sorted by name so the picker reads
// alphabetically without sorting at render time.
const COUNTRY_TUPLES: [string, string, string][] = [
  ["AF", "Afghanistan", "93"],
  ["AL", "Albania", "355"],
  ["DZ", "Algeria", "213"],
  ["AD", "Andorra", "376"],
  ["AO", "Angola", "244"],
  ["AI", "Anguilla", "1264"],
  ["AG", "Antigua & Barbuda", "1268"],
  ["AR", "Argentina", "54"],
  ["AM", "Armenia", "374"],
  ["AW", "Aruba", "297"],
  ["AU", "Australia", "61"],
  ["AT", "Austria", "43"],
  ["AZ", "Azerbaijan", "994"],
  ["BS", "Bahamas", "1242"],
  ["BH", "Bahrain", "973"],
  ["BD", "Bangladesh", "880"],
  ["BB", "Barbados", "1246"],
  ["BY", "Belarus", "375"],
  ["BE", "Belgium", "32"],
  ["BZ", "Belize", "501"],
  ["BJ", "Benin", "229"],
  ["BM", "Bermuda", "1441"],
  ["BT", "Bhutan", "975"],
  ["BO", "Bolivia", "591"],
  ["BA", "Bosnia & Herzegovina", "387"],
  ["BW", "Botswana", "267"],
  ["BR", "Brazil", "55"],
  ["BN", "Brunei", "673"],
  ["BG", "Bulgaria", "359"],
  ["BF", "Burkina Faso", "226"],
  ["BI", "Burundi", "257"],
  ["KH", "Cambodia", "855"],
  ["CM", "Cameroon", "237"],
  ["CA", "Canada", "1"],
  ["CV", "Cape Verde", "238"],
  ["KY", "Cayman Islands", "1345"],
  ["CF", "Central African Republic", "236"],
  ["TD", "Chad", "235"],
  ["CL", "Chile", "56"],
  ["CN", "China", "86"],
  ["CO", "Colombia", "57"],
  ["KM", "Comoros", "269"],
  ["CG", "Congo - Brazzaville", "242"],
  ["CD", "Congo - Kinshasa", "243"],
  ["CR", "Costa Rica", "506"],
  ["CI", "Côte d’Ivoire", "225"],
  ["HR", "Croatia", "385"],
  ["CU", "Cuba", "53"],
  ["CY", "Cyprus", "357"],
  ["CZ", "Czechia", "420"],
  ["DK", "Denmark", "45"],
  ["DJ", "Djibouti", "253"],
  ["DM", "Dominica", "1767"],
  ["DO", "Dominican Republic", "1809"],
  ["EC", "Ecuador", "593"],
  ["EG", "Egypt", "20"],
  ["SV", "El Salvador", "503"],
  ["GQ", "Equatorial Guinea", "240"],
  ["ER", "Eritrea", "291"],
  ["EE", "Estonia", "372"],
  ["SZ", "Eswatini", "268"],
  ["ET", "Ethiopia", "251"],
  ["FJ", "Fiji", "679"],
  ["FI", "Finland", "358"],
  ["FR", "France", "33"],
  ["GA", "Gabon", "241"],
  ["GM", "Gambia", "220"],
  ["GE", "Georgia", "995"],
  ["DE", "Germany", "49"],
  ["GH", "Ghana", "233"],
  ["GI", "Gibraltar", "350"],
  ["GR", "Greece", "30"],
  ["GL", "Greenland", "299"],
  ["GD", "Grenada", "1473"],
  ["GT", "Guatemala", "502"],
  ["GG", "Guernsey", "44"],
  ["GN", "Guinea", "224"],
  ["GW", "Guinea-Bissau", "245"],
  ["GY", "Guyana", "592"],
  ["HT", "Haiti", "509"],
  ["HN", "Honduras", "504"],
  ["HK", "Hong Kong SAR China", "852"],
  ["HU", "Hungary", "36"],
  ["IS", "Iceland", "354"],
  ["IN", "India", "91"],
  ["ID", "Indonesia", "62"],
  ["IR", "Iran", "98"],
  ["IQ", "Iraq", "964"],
  ["IE", "Ireland", "353"],
  ["IM", "Isle of Man", "44"],
  ["IL", "Israel", "972"],
  ["IT", "Italy", "39"],
  ["JM", "Jamaica", "1876"],
  ["JP", "Japan", "81"],
  ["JE", "Jersey", "44"],
  ["JO", "Jordan", "962"],
  ["KZ", "Kazakhstan", "7"],
  ["KE", "Kenya", "254"],
  ["KI", "Kiribati", "686"],
  ["KW", "Kuwait", "965"],
  ["KG", "Kyrgyzstan", "996"],
  ["LA", "Laos", "856"],
  ["LV", "Latvia", "371"],
  ["LB", "Lebanon", "961"],
  ["LS", "Lesotho", "266"],
  ["LR", "Liberia", "231"],
  ["LY", "Libya", "218"],
  ["LI", "Liechtenstein", "423"],
  ["LT", "Lithuania", "370"],
  ["LU", "Luxembourg", "352"],
  ["MO", "Macao SAR China", "853"],
  ["MG", "Madagascar", "261"],
  ["MW", "Malawi", "265"],
  ["MY", "Malaysia", "60"],
  ["MV", "Maldives", "960"],
  ["ML", "Mali", "223"],
  ["MT", "Malta", "356"],
  ["MH", "Marshall Islands", "692"],
  ["MR", "Mauritania", "222"],
  ["MU", "Mauritius", "230"],
  ["MX", "Mexico", "52"],
  ["FM", "Micronesia", "691"],
  ["MD", "Moldova", "373"],
  ["MC", "Monaco", "377"],
  ["MN", "Mongolia", "976"],
  ["ME", "Montenegro", "382"],
  ["MS", "Montserrat", "1664"],
  ["MA", "Morocco", "212"],
  ["MZ", "Mozambique", "258"],
  ["MM", "Myanmar (Burma)", "95"],
  ["NA", "Namibia", "264"],
  ["NR", "Nauru", "674"],
  ["NP", "Nepal", "977"],
  ["NL", "Netherlands", "31"],
  ["NZ", "New Zealand", "64"],
  ["NI", "Nicaragua", "505"],
  ["NE", "Niger", "227"],
  ["NG", "Nigeria", "234"],
  ["KP", "North Korea", "850"],
  ["MK", "North Macedonia", "389"],
  ["NO", "Norway", "47"],
  ["OM", "Oman", "968"],
  ["PK", "Pakistan", "92"],
  ["PW", "Palau", "680"],
  ["PS", "Palestine", "970"],
  ["PA", "Panama", "507"],
  ["PG", "Papua New Guinea", "675"],
  ["PY", "Paraguay", "595"],
  ["PE", "Peru", "51"],
  ["PH", "Philippines", "63"],
  ["PL", "Poland", "48"],
  ["PT", "Portugal", "351"],
  ["PR", "Puerto Rico", "1787"],
  ["QA", "Qatar", "974"],
  ["RO", "Romania", "40"],
  ["RU", "Russia", "7"],
  ["RW", "Rwanda", "250"],
  ["WS", "Samoa", "685"],
  ["SM", "San Marino", "378"],
  ["SA", "Saudi Arabia", "966"],
  ["SN", "Senegal", "221"],
  ["RS", "Serbia", "381"],
  ["SC", "Seychelles", "248"],
  ["SL", "Sierra Leone", "232"],
  ["SG", "Singapore", "65"],
  ["SK", "Slovakia", "421"],
  ["SI", "Slovenia", "386"],
  ["SB", "Solomon Islands", "677"],
  ["SO", "Somalia", "252"],
  ["ZA", "South Africa", "27"],
  ["KR", "South Korea", "82"],
  ["SS", "South Sudan", "211"],
  ["ES", "Spain", "34"],
  ["LK", "Sri Lanka", "94"],
  ["KN", "St Kitts & Nevis", "1869"],
  ["LC", "St Lucia", "1758"],
  ["VC", "St Vincent & Grenadines", "1784"],
  ["SD", "Sudan", "249"],
  ["SR", "Suriname", "597"],
  ["SE", "Sweden", "46"],
  ["CH", "Switzerland", "41"],
  ["SY", "Syria", "963"],
  ["TW", "Taiwan", "886"],
  ["TJ", "Tajikistan", "992"],
  ["TZ", "Tanzania", "255"],
  ["TH", "Thailand", "66"],
  ["TL", "Timor-Leste", "670"],
  ["TG", "Togo", "228"],
  ["TO", "Tonga", "676"],
  ["TT", "Trinidad & Tobago", "1868"],
  ["TN", "Tunisia", "216"],
  ["TR", "Türkiye", "90"],
  ["TM", "Turkmenistan", "993"],
  ["TC", "Turks & Caicos Islands", "1649"],
  ["TV", "Tuvalu", "688"],
  ["UG", "Uganda", "256"],
  ["UA", "Ukraine", "380"],
  ["AE", "United Arab Emirates", "971"],
  ["GB", "United Kingdom", "44"],
  ["US", "United States", "1"],
  ["UY", "Uruguay", "598"],
  ["UZ", "Uzbekistan", "998"],
  ["VU", "Vanuatu", "678"],
  ["VA", "Vatican City", "379"],
  ["VE", "Venezuela", "58"],
  ["VN", "Vietnam", "84"],
  ["YE", "Yemen", "967"],
  ["ZM", "Zambia", "260"],
  ["ZW", "Zimbabwe", "263"],
];

export const DIALLING_COUNTRIES: DiallingCountry[] = COUNTRY_TUPLES.map(
  ([code, name, dial]) => ({ code, name, dial }),
);

const BY_CODE = new Map(DIALLING_COUNTRIES.map((c) => [c.code, c]));

/** Look up a country by ISO code, falling back to the default. */
export function countryFor(code: string | null | undefined): DiallingCountry {
  return BY_CODE.get((code ?? "").toUpperCase()) ?? BY_CODE.get(DEFAULT_DIALLING_COUNTRY)!;
}

/** Validate a stored country choice, falling back to the default. */
export function normalizeDiallingCountry(code: string | null | undefined): string {
  return BY_CODE.has((code ?? "").toUpperCase())
    ? (code as string).toUpperCase()
    : DEFAULT_DIALLING_COUNTRY;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalise user input to E.164 (`+447700900123`), or null when it cannot be
 * read as a phone number.
 *
 * Accepts what people actually type: `07700 900123`, `+44 7700 900123`,
 * `0044 7700 900123`, `(01727) 123456`. A leading `+` or `00` means the
 * number already carries its country code and `country` is ignored; anything
 * else is treated as a national number for `country`.
 */
export function toE164(input: string, country: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // Reject text: letters anywhere mean this isn't a number we should guess at.
  if (/[A-Za-z]/.test(raw)) return null;

  const iso = normalizeDiallingCountry(country);
  let digits: string;

  if (raw.startsWith("+")) {
    digits = digitsOnly(raw);
  } else if (raw.startsWith("00")) {
    digits = digitsOnly(raw).replace(/^00/, "");
  } else {
    let national = digitsOnly(raw);
    if (!national) return null;
    // Drop the trunk prefix, which is not dialled internationally.
    if (!KEEPS_TRUNK_ZERO.has(iso)) national = national.replace(/^0+/, "");
    if (!national) return null;
    digits = countryFor(iso).dial + national;
  }

  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) return null;
  return `+${digits}`;
}

/** True when the value is already a well-formed E.164 number. */
export function isE164(value: string): boolean {
  return new RegExp(`^\\+\\d{${MIN_E164_DIGITS},${MAX_E164_DIGITS}}$`).test(value);
}

/**
 * Split an E.164 number back into a country choice and the national part, so
 * an existing answer can repopulate the picker on reschedule. Prefers the
 * longest matching dialling code (so +1268 beats +1), and among equal-length
 * matches prefers `preferred` when it is one of them.
 */
export function splitE164(
  value: string,
  preferred?: string,
): { country: string; national: string } | null {
  if (!isE164(value)) return null;
  const digits = value.slice(1);

  const want = preferred?.toUpperCase();
  let best: DiallingCountry | null = null;
  for (const candidate of DIALLING_COUNTRIES) {
    if (!digits.startsWith(candidate.dial)) continue;
    if (!best || candidate.dial.length > best.dial.length) {
      best = candidate;
      continue;
    }
    if (candidate.dial.length !== best.dial.length) continue;
    // Equal-length codes: the caller's preference wins, then the primary.
    if (want && candidate.code === want) best = candidate;
    else if (
      !(want && best.code === want) &&
      PRIMARY_FOR_DIAL[candidate.dial] === candidate.code
    ) {
      best = candidate;
    }
  }
  // The first match may itself have lost the tie-break above.
  if (best && !(want && best.code === want)) {
    const primary = PRIMARY_FOR_DIAL[best.dial];
    if (primary && primary !== best.code) best = countryFor(primary);
  }
  if (!best) return null;
  return { country: best.code, national: digits.slice(best.dial.length) };
}

/**
 * Group an E.164 number for reading: `+447700900123` -> `+44 7700 900123`.
 * Grouping is cosmetic — no attempt at per-country formats. Anything that
 * isn't E.164 (a legacy free-text answer) is returned unchanged.
 */
export function formatPhoneDisplay(value: string, preferred?: string): string {
  const parts = splitE164(value, preferred);
  if (!parts) return value;
  const country = countryFor(parts.country);
  const n = parts.national;
  // Split the national part into readable chunks without inventing a format:
  // 4+rest for longer numbers, halves for short ones.
  const grouped = n.length > 7 ? `${n.slice(0, 4)} ${n.slice(4)}` : n;
  return `+${country.dial} ${grouped}`.trim();
}
