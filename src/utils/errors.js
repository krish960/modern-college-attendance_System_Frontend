/*
 * Turns any error from the API into text that is safe to show on screen.
 */
/**
 * Turn an axios error into { message, fields } for display.
 * Handles Django REST Framework's error shapes: {detail}, {field: [msgs]}, [msgs].
 */
// Returns { message, fields }. message is for a toast or a banner; fields maps a form field
// name to its own error text, so FormModal can show it under that input.
export function parseError(error) {
  if (error instanceof Error && !error.isAxiosError && error.message) {
    return { message: error.message, fields: {} }; // our own check failed (not the network): show its real message
  }
  // No response at all: the server is down or the network is off.
  if (!error?.response) {
    return { message: "Cannot reach the server. Check that the backend is running.", fields: {} };
  }
  const data = error.response.data;
  // A plain string. HTML (starts with '<') is a Django crash page, so do not show it raw.
  if (typeof data === "string") {
    return { message: data.trim().startsWith("<") ? "The server returned an unexpected error." : data, fields: {} };
  }
  if (Array.isArray(data)) return { message: data.join(" "), fields: {} };
  if (data?.detail) return { message: String(data.detail), fields: {} };

  // Field errors look like { email: ["Enter a valid address."] }. non_field_errors is about the whole form.
  const fields = {};
  let message = "";
  for (const [key, value] of Object.entries(data || {})) {
    const text = Array.isArray(value) ? value.map(String).join(" ") : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (key === "non_field_errors") message = text;
    else fields[key] = text;
  }
  if (!message) message = Object.keys(fields).length ? "Fix the highlighted fields and try again." : "Something went wrong.";
  return { message, fields };
}
