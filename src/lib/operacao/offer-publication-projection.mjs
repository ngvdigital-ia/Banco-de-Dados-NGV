// Projeção pura e conservadora de site_urls. Registro local não comprova
// publicação externa: nenhum estado deste módulo declara deploy/live/verified.
export const OFFER_PUBLICATION_SCHEMA_VERSION = 1;

const TARGETS = Object.freeze(["domain", "vsl", "quiz", "whites", "custom"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validHttpUrl(value) {
  if (typeof value !== "string" || !value || /\s/.test(value) || !/^https?:\/\/[^/?#@\s]+/i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !url.port;
  } catch {
    return false;
  }
}

/**
 * Resume apenas a existência de endereços registrados em offer_tracking.siteUrls.
 * URLs não saem no retorno porque o contrato é de cockpit, não de publicação.
 */
export function projectOfferPublicationFromSiteUrls(siteUrls) {
  const urls = isPlainObject(siteUrls) ? siteUrls : {};
  const registered = [];
  if (typeof urls.domain === "string" && urls.domain.trim()) registered.push("domain");
  if (validHttpUrl(urls.vsl)) registered.push("vsl");
  if (validHttpUrl(urls.quiz)) registered.push("quiz");
  if (Array.isArray(urls.whites) && urls.whites.some(validHttpUrl)) registered.push("whites");
  if (Array.isArray(urls.custom) && urls.custom.some((entry) => isPlainObject(entry) && validHttpUrl(entry.url))) registered.push("custom");

  const registeredTargets = TARGETS.filter((target) => registered.includes(target));
  return Object.freeze({
    schema_version: OFFER_PUBLICATION_SCHEMA_VERSION,
    source: "offer_tracking.site_urls",
    mode: "read-only",
    local_registration_state: registeredTargets.length > 0 ? "REGISTERED" : "PENDING",
    external_verification_state: "PENDING",
    registered_targets: registeredTargets,
    registered_target_count: registeredTargets.length,
  });
}
