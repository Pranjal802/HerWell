export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: isFormData ? options.headers : { "Content-Type": "application/json", ...options.headers },
    ...options,
    body: options.body && !isFormData ? JSON.stringify(options.body) : options.body,
  });
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
