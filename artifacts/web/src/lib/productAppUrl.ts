const DEFAULT_PRODUCT_APP_URL = "/arsredovisningar";

function normalizeBaseUrl(rawBaseUrl?: string) {
  const baseUrl = (rawBaseUrl?.trim() || DEFAULT_PRODUCT_APP_URL).replace(/\/+$/, "");
  return baseUrl || DEFAULT_PRODUCT_APP_URL;
}

function normalizePath(path?: string) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getProductAppUrl(path?: string) {
  return `${normalizeBaseUrl(import.meta.env.VITE_PRODUCT_APP_URL)}${normalizePath(path)}`;
}

export function getProductLoginUrl() {
  return getProductAppUrl("/login");
}

export function getProductRegisterUrl(options?: { fromDemo?: boolean }) {
  const registerUrl = new URL(
    getProductAppUrl("/register"),
    window.location.origin,
  );

  if (options?.fromDemo) {
    registerUrl.searchParams.set("from", "demo");
  }

  return registerUrl.origin === window.location.origin
    ? `${registerUrl.pathname}${registerUrl.search}${registerUrl.hash}`
    : registerUrl.toString();
}
