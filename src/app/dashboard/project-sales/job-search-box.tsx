"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JobSearchBox() {
  const router = useRouter();
  const [jobNo, setJobNo] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = jobNo.trim();
    if (!trimmed) return;
    router.push(`/dashboard/project-sales/edit/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={jobNo}
        onChange={(e) => setJobNo(e.target.value)}
        placeholder="ค้นหา JOB NO. เพื่อแก้ไข เช่น JB2607001"
        className="max-w-xs"
      />
      <Button type="submit" variant="outline">
        <Search className="h-4 w-4" />
        ค้นหา
      </Button>
    </form>
  );
}
