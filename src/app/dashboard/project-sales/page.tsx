import { Download, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFullProjectReport } from "@/lib/data/project-sales";
import { JobSearchBox } from "./job-search-box";
import { ProjectsTable } from "./projects-table";

export default async function ProjectSalesPage() {
  const projects = await getFullProjectReport();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">WALLPOD Project Sales</h1>
          <p className="text-sm text-muted-foreground">
            รายงานงานขายทั้งหมด — ข้อมูลนี้เชื่อมกับ Sales Dashboard โดยตรง
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<a href="/api/export-projects" download />}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
          <Button nativeButton={false} render={<a href="/dashboard/project-sales/new" />}>
            <Plus className="h-4 w-4" />
            เพิ่ม Project
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ค้นหางานเดิมเพื่อแก้ไข</CardTitle>
        </CardHeader>
        <CardContent>
          <JobSearchBox />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>งานขายทั้งหมด ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsTable projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
