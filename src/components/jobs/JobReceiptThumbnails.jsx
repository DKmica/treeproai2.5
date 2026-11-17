import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";

export default function JobReceiptThumbnails({ jobId }) {
  const { data: expenses = [] } = useQuery({
    queryKey: ["job_expenses", jobId],
    queryFn: () => base44.entities.JobExpense.filter({ job_id: jobId }, "-created_date"),
    enabled: !!jobId,
  });
  const receipts = expenses.filter((e) => e.receipt_url);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let active = true;
    const uris = receipts.map((r) => r.receipt_url);
    if (uris.length === 0) return;
    Promise.all(
      uris.map(async (uri) => {
        try {
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 600 });
          return [uri, signed_url];
        } catch {
          return [uri, null];
        }
      })
    ).then((entries) => {
      if (!active) return;
      const map = {};
      entries.forEach(([uri, url]) => {
        if (url) map[uri] = url;
      });
      setUrls(map);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(receipts.map((r) => r.receipt_url))]);

  if (receipts.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Camera className="w-3 h-3 text-muted-foreground shrink-0" />
      {receipts.map((r) => (
        <a
          key={r.id}
          href={urls[r.receipt_url] || "#"}
          target="_blank"
          rel="noreferrer"
          className="block h-10 w-10 rounded overflow-hidden border bg-muted shrink-0"
          title={`${r.category || "Receipt"} — $${(r.amount || 0).toFixed(2)}`}
        >
          {urls[r.receipt_url] ? (
            <img src={urls[r.receipt_url]} alt="Receipt" className="h-full w-full object-cover" />
          ) : (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground m-auto mt-3.5" />
          )}
        </a>
      ))}
    </div>
  );
}