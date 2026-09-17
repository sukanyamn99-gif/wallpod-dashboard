// Shared between the server-only data layer (src/lib/data/data-documents.ts)
// and the client-side upload dialog — kept in its own file with no
// server-only imports so a "use client" component can import it safely.
export const DATA_DOCUMENTS_BUCKET = "data-documents";
