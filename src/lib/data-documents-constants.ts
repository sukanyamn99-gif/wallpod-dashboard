// Shared between the server-only data layer (src/lib/data/data-documents.ts)
// and the client-side upload dialog/filter UI — kept in its own file with
// no server-only imports so a "use client" component can import it safely.
export const DATA_DOCUMENTS_BUCKET = "data-documents";

export const DATA_DOCUMENT_CATEGORIES = ["Catalog", "Price List", "Certificates", "Specification"] as const;
