import en from "./json/en.json" with { type: "json" }

// Merged over the dashboard's own strings, so these replace the Medusa
// wording on the sign-in and invite pages. enGB is what UK browsers get.
export default {
  en: { translation: en },
  enGB: { translation: en },
}
