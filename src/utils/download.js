/*
 * Saves a file that the API generates (CSV, PDF or ZIP) to the user's computer.
 */
import api from "../api/client";

/** Download a CSV/PDF export. The request carries the JWT, so a plain <a href> would not work. */
export async function downloadExport(url, params, kind) {
  // Ask for the file as a 'blob' (raw bytes). `export` tells the server which format to build.
  const response = await api.get(url, { params: { ...params, export: kind }, responseType: "blob" });
  // The server names the file in the Content-Disposition header. Fall back to report.<kind>.
  const disposition = response.headers["content-disposition"] || "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match ? match[1] : `report.${kind}`;
  // Trick to start a download from code: point a hidden link at the blob, click it, then clean up.
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
