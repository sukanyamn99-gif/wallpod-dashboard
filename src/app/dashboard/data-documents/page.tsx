import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getDataDocuments, getSignedDataDocumentUrls } from "@/lib/data/data-documents";
import { DataDocumentsView } from "./data-documents-view";

export default async function DataDocumentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const documents = await getDataDocuments();
  const paths = documents.flatMap((d) => [d.filePath, ...(d.thumbnailPath ? [d.thumbnailPath] : [])]);
  const signedUrls = await getSignedDataDocumentUrls(paths);
  const canManage = profile.role === "owner" || profile.role === "manager" || profile.role === "support_sale";

  return <DataDocumentsView documents={documents} signedUrls={signedUrls} canManage={canManage} />;
}
