// Action constructors — pure descriptors (capture no state), so CLI, web and bots
// all build identical Action objects that GameSession.apply() consumes.

export const measure = (substanceId, measureId) => ({ type: "measure", substanceId, measureId });
export const measureAll = (substanceId) => ({ type: "measureAll", substanceId });
export const mix = (aId, bId, lambda = 0.5) => ({ type: "mix", aId, bId, lambda });
export const cook = (substanceId, opId = "cook") => ({ type: "cook", substanceId, opId });
export const name = (substanceId, label) => ({ type: "name", substanceId, label });
export const tag = (substanceId, tagName) => ({ type: "tag", substanceId, tagName });
export const note = (text, substanceId = null) => ({ type: "note", text, substanceId });
export const submit = (substanceId) => ({ type: "submit", substanceId });
