# Translations

Tidetime ships with **English as the source of truth** and a registry of
community translations. Adding or improving a language is a small, self-contained
change — no build config, no wiring.

## Contribute a language

1. Open [`messages.ts`](./messages.ts).
2. Copy an existing block (e.g. `es`) and rename the key to your BCP-47 locale
   code — `pt`, `pt-BR`, `zh-TW`, `nb`, etc.
3. Translate the values. **You may omit any key you're unsure about** — missing
   keys fall back to English, so partial translations are valid and ship safely.
4. Open a PR. The locale is auto-registered everywhere: browser
   `Accept-Language` negotiation, the `t()` helper, and the admin locale picker.

That's it. There is no separate "register the locale" step.

## Plurals (ICU MessageFormat)

Count-aware strings use [ICU MessageFormat](https://formatjs.io/docs/core-concepts/icu-syntax/#plural-format):

```
{count, plural, =0 {No guests} one {# guest} other {# guests}}
```

Provide the plural **categories your language uses** — `one`/`other` for most
European languages, plus `=0` for a special "none" message, and `few`/`many`/
`two` where your language needs them (e.g. `pl`, `ru`, `ar`). ICU falls back to
`other` for any category you don't supply, so it is always safe to provide
fewer. `#` is replaced with the number.

## Validation

`messages.test.ts` compiles every template in every locale and renders the
plural keys for several counts. Run `npm test` — a malformed ICU string fails
the suite, so a broken translation can't reach production.

## Keys

The full key list (and the English source text) lives in `en` inside
[`src/lib/i18n.ts`](../lib/i18n.ts). When a new key is added there, every locale
automatically falls back to English until a translation is contributed.
