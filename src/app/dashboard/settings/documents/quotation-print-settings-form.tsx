"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { updateQuotationPrintTemplate } from "./actions";
import type {
  QuotationConditionIcon,
  QuotationConditionSection,
  QuotationNoteTone,
  QuotationPrintNote,
  QuotationPrintTemplate,
  QuotationType,
} from "@/lib/types";

const TONE_ITEMS: { value: QuotationNoteTone; label: string }[] = [
  { value: "normal", label: "ปกติ" },
  { value: "red", label: "สีแดง (ตัวหนา)" },
  { value: "amber", label: "สีส้ม (ตัวหนา)" },
];

const ICON_ITEMS: { value: QuotationConditionIcon; label: string }[] = [
  { value: "check", label: "✔ เครื่องหมายถูก" },
  { value: "person", label: "👤 รูปคน" },
];

let nextKey = 1;

interface NoteRow extends QuotationPrintNote {
  key: number;
}
interface ItemRow {
  key: number;
  icon: QuotationConditionIcon;
  text: string;
}
interface SectionRow {
  key: number;
  heading: string;
  underline: boolean;
  items: ItemRow[];
}

function toNoteRows(notes: QuotationPrintNote[]): NoteRow[] {
  return notes.map((n) => ({ ...n, key: nextKey++ }));
}

function toSectionRows(sections: QuotationConditionSection[]): SectionRow[] {
  return sections.map((s) => ({
    key: nextKey++,
    heading: s.heading,
    underline: s.underline,
    items: s.items.map((it) => ({ ...it, key: nextKey++ })),
  }));
}

function TemplateEditor({ template }: { template: QuotationPrintTemplate }) {
  const [notes, setNotes] = useState<NoteRow[]>(() => toNoteRows(template.notes));
  const [showWhtNote, setShowWhtNote] = useState(template.showWhtNote);
  const [sections, setSections] = useState<SectionRow[]>(() => toSectionRows(template.conditions));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string | null; savedAt: number } | null>(null);

  function addNote() {
    setNotes((prev) => [...prev, { key: nextKey++, text: "", tone: "normal" }]);
  }
  function updateNote(key: number, patch: Partial<NoteRow>) {
    setNotes((prev) => prev.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  }
  function removeNote(key: number) {
    setNotes((prev) => prev.filter((n) => n.key !== key));
  }

  function addSection() {
    setSections((prev) => [...prev, { key: nextKey++, heading: "", underline: true, items: [] }]);
  }
  function updateSection(key: number, patch: Partial<SectionRow>) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function removeSection(key: number) {
    setSections((prev) => prev.filter((s) => s.key !== key));
  }
  function addItem(sectionKey: number) {
    setSections((prev) =>
      prev.map((s) => (s.key === sectionKey ? { ...s, items: [...s.items, { key: nextKey++, icon: "check", text: "" }] } : s)),
    );
  }
  function updateItem(sectionKey: number, itemKey: number, patch: Partial<ItemRow>) {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey ? { ...s, items: s.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it)) } : s,
      ),
    );
  }
  function removeItem(sectionKey: number, itemKey: number) {
    setSections((prev) =>
      prev.map((s) => (s.key === sectionKey ? { ...s, items: s.items.filter((it) => it.key !== itemKey) } : s)),
    );
  }

  function handleSave() {
    const fd = new FormData();
    fd.set(
      "notes_json",
      JSON.stringify(notes.filter((n) => n.text.trim()).map((n) => ({ text: n.text, tone: n.tone }))),
    );
    fd.set("show_wht_note", String(showWhtNote));
    fd.set(
      "conditions_json",
      JSON.stringify(
        sections.map((s) => ({
          heading: s.heading,
          underline: s.underline,
          items: s.items.filter((it) => it.text.trim()).map((it) => ({ icon: it.icon, text: it.text })),
        })),
      ),
    );
    startTransition(async () => {
      const res = await updateQuotationPrintTemplate(template.quotationType, fd);
      setResult({ error: res.error, savedAt: Date.now() });
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">ข้อความมาตรฐาน (Remark)</Label>
          <Button type="button" size="sm" variant="outline" onClick={addNote}>
            <Plus className="h-4 w-4" /> เพิ่มข้อความ
          </Button>
        </div>
        {notes.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีข้อความ</p>}
        {notes.map((n) => (
          <div key={n.key} className="flex items-start gap-2">
            <Input
              value={n.text}
              onChange={(e) => updateNote(n.key, { text: e.target.value })}
              placeholder="ข้อความที่จะพิมพ์"
              className="flex-1"
            />
            <Select value={n.tone} onValueChange={(v) => updateNote(n.key, { tone: v as QuotationNoteTone })} items={TONE_ITEMS}>
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeNote(n.key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showWhtNote} onChange={(e) => setShowWhtNote(e.target.checked)} className="h-4 w-4" />
        แสดงข้อความ &quot;**สามารถหัก ณ ที่จ่ายได้**&quot; ข้าง Price Validity Period
      </label>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">เงื่อนไขการเตรียมพื้นที่ก่อนติดตั้ง</Label>
            <p className="text-xs text-muted-foreground">พิมพ์เฉพาะเมื่อมีอย่างน้อย 1 หมวด — เว้นว่างไว้ถ้าไม่ต้องการให้แสดง</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4" /> เพิ่มหมวด
          </Button>
        </div>
        {sections.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีหมวดเงื่อนไข</p>}
        {sections.map((s) => (
          <div key={s.key} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={s.heading}
                onChange={(e) => updateSection(s.key, { heading: e.target.value })}
                placeholder="หัวข้อหมวด เช่น ผนัง การเตรียมพื้นที่ต้องมีมุมฉาก"
                className="flex-1 font-medium"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={s.underline}
                  onChange={(e) => updateSection(s.key, { underline: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                ขีดเส้นใต้หัวข้อ
              </label>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeSection(s.key)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1.5 pl-4">
              {s.items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  <Select
                    value={it.icon}
                    onValueChange={(v) => updateItem(s.key, it.key, { icon: v as QuotationConditionIcon })}
                    items={ICON_ITEMS}
                  >
                    <SelectTrigger className="w-40 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={it.text}
                    onChange={(e) => updateItem(s.key, it.key, { text: e.target.value })}
                    placeholder="ข้อความของหัวข้อย่อยนี้"
                    className="flex-1"
                  />
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeItem(s.key, it.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => addItem(s.key)}>
                <Plus className="h-3.5 w-3.5" /> เพิ่มหัวข้อย่อย
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
        {result && !result.error && <p className="text-sm text-muted-foreground">บันทึกแล้ว</p>}
      </div>
    </div>
  );
}

export function QuotationPrintSettingsForm({
  templates,
}: {
  templates: Record<QuotationType, QuotationPrintTemplate>;
}) {
  return (
    <div className="rounded-lg border p-4">
      <Tabs defaultValue="ค่าของ">
        <TabsList>
          <TabsTab value="ค่าของ">ค่าของ</TabsTab>
          <TabsTab value="ค่าติดตั้ง">ค่าติดตั้ง</TabsTab>
          <TabsIndicator />
        </TabsList>
        <TabsPanel value="ค่าของ" className="pt-4">
          <TemplateEditor template={templates["ค่าของ"]} />
        </TabsPanel>
        <TabsPanel value="ค่าติดตั้ง" className="pt-4">
          <TemplateEditor template={templates["ค่าติดตั้ง"]} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
