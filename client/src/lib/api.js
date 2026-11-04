const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.API_URL || "").replace(/\/+$/, "");

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("You appear to be offline. HerWell needs an internet connection for this action.");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      credentials: "include",
      headers: isFormData ? options.headers : { "Content-Type": "application/json", ...options.headers },
      ...options,
      body: options.body && !isFormData ? JSON.stringify(options.body) : options.body,
    });
  } catch (networkError) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You are currently offline. Please reconnect to the internet and try again.");
    }
    throw new Error("Network request failed. Please check your connection or try again shortly.");
  }

  if (options.download) {
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || "Download failed.");
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}
