"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import { formatTHB } from "@/lib/format";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import {
  createBillingDocument,
  fetchBillableBillingNoteItems,
  fetchBillableQuotations,
  fetchBillableTaxInvoices,
  fetchUnbilledInvoices,
  updateBillingDocument,
} from "./actions";
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type {
  BillableBillingNoteItem,
  BillableQuotation,
  BillableTaxInvoice,
  BillingDocumentDetail,
  BillingDocumentType,
  Customer,
  FinishedGood,
  PaymentMethod,
  SalesRep,
  UnbilledInvoice,
} from "@/lib/types";
import type { JobLookupEntry } from "@/lib/data/reference";

const NONE_VALUE = "__none__";
const initialState = { error: null as string | null };
const CREDIT_DAYS_ITEMS = [
  { value: "0", label: "เงินสด" },
  { value: "15", label: "15 วัน" },
  { value: "30", label: "30 วัน" },
];
// The company's own receiving account — printed identically on quotations
// (see print-quotation-view.tsx's "ชื่อบัญชี : บริษัท คูนเว จำกัด
// ธนาคารกรุงศรี : 403-0-00726-8"). Auto-filled when โอนเงิน is picked so
// staff don't have to retype the same account every time; only fills
// currently-empty fields, so a deliberately different account isn't
// overwritten.
const DEFAULT_BANK_NAME = "กรุงศรีอยุธยา";
const DEFAULT_BANK_ACCOUNT_NO = "403-0-00726-8";
const PAYMENT_METHODS: PaymentMethod[] = ["เงินสด", "เช็ค", "โอนเงิน", "บัตรเครดิต"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  // DateInput reports every keystroke while the user is still typing a
  // date (e.g. an incomplete day/month), which briefly produces a string
  // Date can't parse — this is computed on every render, so returning the
  // original text instead of throwing keeps the form usable mid-typing
  // rather than crashing the whole page.
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A third source of line items, alongside invoices/quotations: typed
// directly into the document. `key` is a local React key only, never sent
// to the server (the parsed amount is computed fresh there too — never
// trust a client-computed number for what feeds the summary math).
interface ManualItemRow {
  key: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  applyWht: boolean;
  // Set when this row was copied from an issued ใบวางบิล's own manual line
  // (see BillableBillingNoteItem/toggleBillingNoteItem below) — lets the
  // checkbox that added it be un-toggled cleanly, and tells the server
  // which source line to mark as already receipted.
  sourceItemId?: string;
  // The source document's own doc_date, carried over so "เอกสารวันที่"
  // on the printed document isn't blank for a copied line — a plain typed
  // manual row has no natural date of its own, so this stays unset there.
  sourceDate?: string;
  // The source document's own doc_no (e.g. its ใบกำกับภาษี number), shown
  // in "เลขที่เอกสาร" instead of the raw typed description for a copied
  // line — staff want the real document number there, not the free text.
  sourceDocNo?: string;
}

// The row's own pre-VAT line total (qty × ราคาต่อหน่วย) — shown next to the
// row itself, same convention as a normal invoice line (VAT is broken out
// once in the document summary, not baked into every line's own figure).
function manualItemAmount(row: ManualItemRow): number {
  const qty = Number(row.qty) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  return Math.round(qty * unitPrice * 100) / 100;
}

// What actually feeds the running total/summary — computeBillingDocumentSummary
// (and every other item source: invoices/quotations/tax invoices) treats
// `amount` as VAT-inclusive, so the pre-VAT row total above needs VAT added
// on top here before it's bundled in alongside them.
function manualItemVatInclusiveAmount(row: ManualItemRow): number {
  return Math.round(manualItemAmount(row) * 1.07 * 100) / 100;
}

export function BillingDocumentForm({
  docType,
  customers,
  salesReps,
  jobNoSuggestions = [],
  jobNoLookup = {},
  finishedGoods = [],
  listPath,
  mode = "create",
  docId,
  initialData,
}: {
  docType: BillingDocumentType;
  customers: Customer[];
  salesReps: SalesRep[];
  // Only used in create mode (edit mode fixes the customer, so the JOB NO.
  // picker isn't rendered there) — optional so the edit route doesn't need
  // to fetch data its form usage never reads.
  jobNoSuggestions?: string[];
  jobNoLookup?: Record<string, JobLookupEntry>;
  // Only meaningful (and only rendered) when docType === "tax_invoice" —
  // ออกใบกำกับภาษี is the one document type that automatically deducts
  // finished-goods stock, per the user's explicit "ตัดกับบิลขาย...ตอนออก
  // ใบกำกับภาษี...ตัดอัตโนมัติ" requirement.
  finishedGoods?: FinishedGood[];
  listPath: string;
  mode?: "create" | "edit";
  docId?: string;
  initialData?: BillingDocumentDetail;
}) {
  const router = useRouter();
  // ใบวางบิล and ใบเสร็จรับเงิน both browse issued ใบกำกับภาษี directly
  // instead of the quotations behind them (per the user's explicit
  // "ไม่ต้องผ่านใบเสนอราคา" request, extended from ใบวางบิล to ใบเสร็จรับเงิน) —
  // every other doc type keeps billing from quotations directly, since a
  // tax invoice may not exist yet for those.
  const usesTaxInvoiceSource = docType === "billing_note" || docType === "receipt";
  const [jobNo, setJobNo] = useState("");
  const [docNo, setDocNo] = useState(initialData?.docNo ?? "");
  const [customerId, setCustomerId] = useState(initialData?.customerId ?? "");
  const [customerName, setCustomerName] = useState(initialData?.customerName ?? "");
  const [invoices, setInvoices] = useState<UnbilledInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialData?.items ?? []).map((it) => it.paymentId).filter((id): id is string => !!id)),
  );
  const [quotations, setQuotations] = useState<BillableQuotation[]>([]);
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(
    () => new Set((initialData?.items ?? []).map((it) => it.quotationId).filter((id): id is string => !!id)),
  );
  // ใบกำกับภาษี/ใบแจ้งหนี้ only — lets staff bill less than a quotation's
  // full total (e.g. a 50% deposit), keyed by quotationId. Blank means "no
  // override, bill the full amount" — the pre-existing default. Pre-filled
  // in edit mode from whatever was actually billed last time.
  const [quotationAmountOverrides, setQuotationAmountOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initialData?.items ?? [])
        .filter((it): it is typeof it & { quotationId: string } => !!it.quotationId)
        .map((it) => [it.quotationId, String(it.amount)]),
    ),
  );
  // ใบวางบิล only — browsed/selected by tax-invoice id, but each one maps
  // to the same underlying quotationId that createBillingDocument already
  // knows how to bill from (see fetchBillableTaxInvoices).
  const [taxInvoices, setTaxInvoices] = useState<BillableTaxInvoice[]>([]);
  const [selectedTaxInvoices, setSelectedTaxInvoices] = useState<Set<string>>(new Set());
  // ใบเสร็จรับเงิน only — manually-typed ใบวางบิล lines with no
  // quotation/payment to browse by otherwise (see fetchBillableBillingNoteItems).
  // Selecting one copies it into manualItems below, tagged by sourceItemId.
  const [billingNoteItems, setBillingNoteItems] = useState<BillableBillingNoteItem[]>([]);
  const [selectedBillingNoteItems, setSelectedBillingNoteItems] = useState<Set<string>>(new Set());
  const [manualItems, setManualItems] = useState<ManualItemRow[]>(() =>
    (initialData?.items ?? [])
      .filter((it) => it.manualDescription)
      .map((it, i) => ({
        key: `initial-${i}`,
        description: it.manualDescription ?? "",
        qty: String(it.manualQty ?? 1),
        unit: it.manualUnit ?? "หน่วย",
        unitPrice: String(it.manualUnitPrice ?? 0),
        applyWht: it.applyWht,
      })),
  );
  // Which selected invoices/quotations (keyed by paymentId, or quotationId
  // for both the quotations list and the ใบกำกับภาษี-picked-by-tax-invoice
  // list, since both submit as item_quotation_id) count toward the WHT
  // deduction — default is everything included, matching this app's
  // existing behavior before per-line control existed. Manual items track
  // their own applyWht directly on the row instead, since they have no
  // shared id space with the other two lists.
  const [whtExcluded, setWhtExcluded] = useState<Set<string>>(
    () =>
      new Set(
        (initialData?.items ?? [])
          .filter((it) => !it.applyWht && (it.paymentId || it.quotationId))
          .map((it) => (it.paymentId ?? it.quotationId) as string),
      ),
  );
  function toggleWht(key: string) {
    setWhtExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  // productId -> quantity to deduct, only ever populated/submitted when
  // docType === "tax_invoice" (see the section below).
  const [finishedGoodQty, setFinishedGoodQty] = useState<Record<string, string>>({});
  const [loadingInvoices, setLoadingInvoices] = useState(mode === "edit");
  const [docDate, setDocDate] = useState(initialData?.docDate ?? new Date().toISOString().slice(0, 10));
  const [creditDays, setCreditDays] = useState(String(initialData?.creditDays ?? 0));
  const [salesRepId, setSalesRepId] = useState(initialData?.salesRepId ?? "");
  const [discountAmount, setDiscountAmount] = useState(String(initialData?.discountAmount ?? 0));
  const [whtPercent, setWhtPercent] = useState(String(initialData?.whtPercent ?? 0));
  const [retentionPercent, setRetentionPercent] = useState(String(initialData?.retentionPercent ?? 0));
  // ใบเสร็จรับเงิน-only — printed in its payment-method + bank-details footer.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(initialData?.paymentMethod ?? "");
  const [bankName, setBankName] = useState(initialData?.bankName ?? "");
  const [paymentReferenceNo, setPaymentReferenceNo] = useState(initialData?.paymentReferenceNo ?? "");
  const [paymentDate, setPaymentDate] = useState(initialData?.paymentDate ?? "");
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    if (mode === "edit" && docId) {
      const result = await updateBillingDocument(docType, docId, formData);
      if (!result.error) router.push(`/dashboard/billing-documents/${docType.replace("_", "-")}/view/${docId}`);
      return { error: result.error };
    }
    const result = await createBillingDocument(docType, formData);
    if (!result.error && result.id) {
      router.push(`/dashboard/billing-documents/${docType.replace("_", "-")}/view/${result.id}`);
    }
    return { error: result.error };
  }, initialState);

  // Shared by both entry points into picking a customer — searching by name
  // (CustomerAutocomplete) or by JOB NO. (handleJobNoChange below). `preselectJobNo`
  // pre-checks that one job's own invoice(s) once loaded, since picking a
  // specific job is a strong signal that's the one being billed — the
  // customer's other open invoices still show up, just unchecked, so more
  // can be added to the same bundle if wanted.
  async function pickCustomer(id: string, name: string, preselectJobNo?: string) {
    setCustomerId(id);
    setCustomerName(name);
    setSelected(new Set());
    setSelectedQuotations(new Set());
    setSelectedTaxInvoices(new Set());
    setSelectedBillingNoteItems(new Set());
    setLoadingInvoices(true);
    try {
      const [rows, billableQuotations, billableTaxInvoices, billableBillingNoteItems] = await Promise.all([
        fetchUnbilledInvoices(id),
        usesTaxInvoiceSource ? Promise.resolve([]) : fetchBillableQuotations(name),
        usesTaxInvoiceSource ? fetchBillableTaxInvoices(id, docType as "billing_note" | "receipt") : Promise.resolve([]),
        usesTaxInvoiceSource ? fetchBillableBillingNoteItems(id, docType as "billing_note" | "receipt") : Promise.resolve([]),
      ]);
      setInvoices(rows);
      setQuotations(billableQuotations);
      setTaxInvoices(billableTaxInvoices);
      setBillingNoteItems(billableBillingNoteItems);
      if (preselectJobNo) {
        setSelected(new Set(rows.filter((r) => r.jobNo === preselectJobNo).map((r) => r.paymentId)));
      }
    } finally {
      setLoadingInvoices(false);
    }
  }

  function handleCustomerSelect(customer: Customer) {
    setJobNo("");
    void pickCustomer(customer.id, customer.name);
  }

  function handleJobNoChange(value: string) {
    setJobNo(value);
    const match = jobNoLookup[value];
    if (match?.customerId) {
      void pickCustomer(match.customerId, match.customerName, value);
      // A JOB has exactly one assigned sales rep — a stronger, unambiguous
      // signal than the customer alone (who can have deals across several
      // reps), so this is the one path that auto-fills ผู้ขาย too.
      setSalesRepId(match.salesRepId ?? "");
    }
    // Picking a JOB is a strong signal this invoice is selling everything
    // that JOB produced — pre-fill the deduction quantity for that JOB's
    // finished goods with their full quantity on hand, same "no need to
    // add manually" pattern already used when creating a finished good.
    // Still just a starting number in an editable field, not a commitment.
    if (docType === "tax_invoice" && value) {
      const jobFinishedGoods = finishedGoods.filter((fg) => fg.jobNo === value);
      if (jobFinishedGoods.length > 0) {
        setFinishedGoodQty((prev) => {
          const next = { ...prev };
          for (const fg of jobFinishedGoods) next[fg.id] = String(fg.quantityOnHand);
          return next;
        });
      }
    }
  }

  // Edit mode: customer is fixed (changing it would invalidate the whole
  // invoice bundle), so fetch its open invoices once on mount instead of
  // waiting for a CustomerAutocomplete selection that will never happen.
  useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    let cancelled = false;
    (async () => {
      // Edit mode always keeps the quotation picker available too (unlike
      // create mode, where it's hidden for ใบวางบิล/ใบเสร็จรับเงิน) — a
      // pre-existing item may reference a quotation with no tax invoice
      // issued yet, and that needs somewhere to still show up as selected
      // so saving the form doesn't silently drop it.
      const [rows, billableQuotations, billableTaxInvoices, billableBillingNoteItems] = await Promise.all([
        fetchUnbilledInvoices(initialData.customerId),
        fetchBillableQuotations(initialData.customerName),
        usesTaxInvoiceSource
          ? fetchBillableTaxInvoices(initialData.customerId, docType as "billing_note" | "receipt", docId)
          : Promise.resolve([]),
        usesTaxInvoiceSource
          ? fetchBillableBillingNoteItems(initialData.customerId, docType as "billing_note" | "receipt", docId)
          : Promise.resolve([]),
      ]);
      if (!cancelled) {
        setInvoices(rows);
        setQuotations(billableQuotations);
        setTaxInvoices(billableTaxInvoices);
        setBillingNoteItems(billableBillingNoteItems);
        // The item only stores quotationId — match it back to whichever
        // tax invoice shares that same quotation so its checkbox starts
        // checked, since a tax invoice isn't itself what's persisted.
        const existingQuotationIds = new Set(
          (initialData.items ?? []).map((it) => it.quotationId).filter((id): id is string => !!id),
        );
        const matchedQuotationIds = new Set(
          billableTaxInvoices.filter((ti) => existingQuotationIds.has(ti.quotationId)).map((ti) => ti.quotationId),
        );
        setSelectedTaxInvoices(
          new Set(billableTaxInvoices.filter((ti) => matchedQuotationIds.has(ti.quotationId)).map((ti) => ti.id)),
        );
        // Un-check the raw quotation entry once a tax invoice takes over
        // representing it — otherwise both checkboxes stay checked and
        // submit would append the same quotationId twice, saving the same
        // line item twice.
        if (matchedQuotationIds.size > 0) {
          setSelectedQuotations((prev) => {
            const next = new Set(prev);
            for (const qId of matchedQuotationIds) next.delete(qId);
            return next;
          });
        }
        setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the fixed initialData.customerId
  }, []);

  function toggleInvoice(paymentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }

  function toggleQuotation(quotationId: string) {
    setSelectedQuotations((prev) => {
      const next = new Set(prev);
      if (next.has(quotationId)) next.delete(quotationId);
      else next.add(quotationId);
      return next;
    });
  }

  function toggleTaxInvoice(taxInvoiceId: string) {
    setSelectedTaxInvoices((prev) => {
      const next = new Set(prev);
      const adding = !next.has(taxInvoiceId);
      if (adding) next.add(taxInvoiceId);
      else next.delete(taxInvoiceId);
      return next;
    });
    // Carry the tax invoice's own WHT rate onto this document automatically
    // — otherwise staff have to remember and re-type a rate that's already
    // on file, and a missed 0% silently drops the deduction entirely (the
    // exact mistake that prompted this). Only when the field is still at
    // its untouched default, so a deliberately different rate for a mixed
    // bundle is never overwritten.
    if (!selectedTaxInvoices.has(taxInvoiceId) && whtPercent === "0") {
      const ti = taxInvoices.find((t) => t.id === taxInvoiceId);
      if (ti && ti.whtPercent > 0) setWhtPercent(String(ti.whtPercent));
    }
  }

  // Copies a ใบวางบิล's manual line onto this document as its own editable
  // manual item, tagged by sourceItemId — un-toggling removes that same
  // tagged row again rather than any manual item the user typed themselves.
  function toggleBillingNoteItem(item: BillableBillingNoteItem) {
    setSelectedBillingNoteItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        setManualItems((rows) => rows.filter((r) => r.sourceItemId !== item.id));
      } else {
        next.add(item.id);
        setManualItems((rows) => [
          ...rows,
          {
            key: `bn-item-${item.id}`,
            description: item.description,
            qty: String(item.qty),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
            applyWht: item.applyWht,
            sourceItemId: item.id,
            sourceDate: item.billingNoteDate,
            sourceDocNo: item.billingNoteDocNo,
          },
        ]);
      }
      return next;
    });
  }

  function addManualItem() {
    setManualItems((prev) => [
      ...prev,
      { key: `manual-${Date.now()}-${prev.length}`, description: "", qty: "1", unit: "หน่วย", unitPrice: "0", applyWht: true },
    ]);
  }

  function updateManualItem(key: string, field: keyof Omit<ManualItemRow, "key" | "applyWht">, value: string) {
    setManualItems((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function toggleManualItemWht(key: string) {
    setManualItems((prev) => prev.map((row) => (row.key === key ? { ...row, applyWht: !row.applyWht } : row)));
  }

  function removeManualItem(key: string) {
    setManualItems((prev) => {
      // If this row came from the ใบวางบิล picker, un-check it there too —
      // otherwise the checkbox stays checked for a row that no longer exists.
      const row = prev.find((r) => r.key === key);
      if (row?.sourceItemId) {
        setSelectedBillingNoteItems((ids) => {
          const next = new Set(ids);
          next.delete(row.sourceItemId!);
          return next;
        });
      }
      return prev.filter((r) => r.key !== key);
    });
  }

  // Shows automatically whenever a customer is picked — whether via the
  // JOB NO. picker, CustomerAutocomplete, or (edit mode) already fixed —
  // same as the customer name itself already does, so staff can confirm
  // the contact details that will print on the document before issuing it.
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  // Once a JOB is picked, narrow the deduction picker to only that JOB's
  // own finished goods — otherwise every finished good in the system would
  // clutter the list, most of them irrelevant to this invoice. Falls back
  // to showing everything when no JOB is picked (e.g. customer chosen
  // directly), so staff can still deduct manually in that case.
  const relevantFinishedGoods = useMemo(
    () => (jobNo ? finishedGoods.filter((fg) => fg.jobNo === jobNo) : finishedGoods),
    [finishedGoods, jobNo],
  );

  const selectedItems = useMemo(
    () => [
      ...invoices
        .filter((inv) => selected.has(inv.paymentId))
        .map((inv) => ({ amount: inv.amount, applyWht: !whtExcluded.has(inv.paymentId) })),
      ...quotations
        .filter((q) => selectedQuotations.has(q.id))
        .map((q) => ({
          amount: Number(quotationAmountOverrides[q.id]) > 0 ? Number(quotationAmountOverrides[q.id]) : q.total,
          applyWht: !whtExcluded.has(q.id),
        })),
      // Estimate for the preview — the actual saved amount is always the
      // underlying quotation's live total (createBillingDocument re-fetches
      // it fresh), which matches netPayable exactly unless the tax invoice
      // itself carried its own discount/WHT/retention.
      ...taxInvoices
        .filter((ti) => selectedTaxInvoices.has(ti.id))
        .map((ti) => ({ amount: ti.netPayable, applyWht: !whtExcluded.has(ti.quotationId) })),
      ...manualItems
        .filter((row) => row.description.trim())
        .map((row) => ({ amount: manualItemVatInclusiveAmount(row), applyWht: row.applyWht })),
    ],
    [
      invoices,
      selected,
      quotations,
      selectedQuotations,
      quotationAmountOverrides,
      taxInvoices,
      selectedTaxInvoices,
      manualItems,
      whtExcluded,
    ],
  );
  const summary = useMemo(
    () => computeBillingDocumentSummary(selectedItems, Number(discountAmount) || 0, Number(whtPercent) || 0, Number(retentionPercent) || 0),
    [selectedItems, discountAmount, whtPercent, retentionPercent],
  );

  const dueDate = addDays(docDate, Number(creditDays) || 0);
  const salesRepItems = [
    { value: NONE_VALUE, label: "— ไม่ระบุ —" },
    ...salesReps.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // The Select's own hidden input mirrors its displayed value
        // (NONE_VALUE when unset), so new FormData(form) would submit that
        // sentinel literally — overwrite with the real state, which is
        // already "" when no sales rep is picked.
        fd.set("sales_rep_id", salesRepId);
        // Only meaningful in create mode (edit mode doesn't render the JOB
        // NO. picker at all) — printed as "เลขที่ Job" on the document.
        if (jobNo) fd.set("job_no_ref", jobNo);
        for (const paymentId of selected) {
          fd.append("item_payment_id", paymentId);
          fd.append("item_payment_apply_wht", String(!whtExcluded.has(paymentId)));
        }
        for (const quotationId of selectedQuotations) {
          fd.append("item_quotation_id", quotationId);
          fd.append("item_quotation_apply_wht", String(!whtExcluded.has(quotationId)));
          // Partial-billing override — blank/0 means "bill the full amount",
          // the existing default behavior (see quotationAmountOverrides).
          fd.append("item_quotation_amount", quotationAmountOverrides[quotationId] ?? "");
        }
        // Each selected tax invoice submits as its underlying quotationId —
        // createBillingDocument already knows how to bill from that — plus
        // the tax invoice's own id, so the backend can tell WHICH
        // installment this specific tax invoice owns once a quotation can
        // be split across several partial tax invoices.
        for (const taxInvoiceId of selectedTaxInvoices) {
          const quotationId = taxInvoices.find((ti) => ti.id === taxInvoiceId)?.quotationId;
          if (quotationId) {
            fd.append("item_quotation_id", quotationId);
            fd.append("item_quotation_apply_wht", String(!whtExcluded.has(quotationId)));
            fd.append("item_quotation_tax_invoice_ref_id", taxInvoiceId);
          }
        }
        for (const row of manualItems) {
          if (!row.description.trim()) continue;
          fd.append("item_manual_description", row.description);
          fd.append("item_manual_qty", row.qty);
          fd.append("item_manual_unit", row.unit);
          fd.append("item_manual_unit_price", row.unitPrice);
          fd.append("item_manual_apply_wht", String(row.applyWht));
          fd.append("item_manual_source_id", row.sourceItemId ?? "");
          fd.append("item_manual_date", row.sourceDate ?? "");
          fd.append("item_manual_doc_no", row.sourceDocNo ?? "");
        }
        if (docType === "tax_invoice") {
          for (const [productId, qty] of Object.entries(finishedGoodQty)) {
            if ((Number(qty) || 0) <= 0) continue;
            fd.append("item_finished_good_id", productId);
            fd.append("item_finished_good_qty", qty);
          }
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div className="space-y-4">
        {mode === "edit" && initialData && (
          <div className="space-y-2">
            <Label htmlFor="doc_no">เลขที่เอกสาร</Label>
            <Input id="doc_no" name="doc_no" value={docNo} onChange={(e) => setDocNo(e.target.value)} className="max-w-xs" />
          </div>
        )}

        {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="job_no_picker">เลขที่ Job</Label>
            <JobNoSelect id="job_no_picker" value={jobNo} onChange={handleJobNoChange} jobNos={jobNoSuggestions} />
            <p className="text-xs text-muted-foreground">
              เลือก JOB เพื่อดึงลูกค้าและรายการใบแจ้งหนี้ของ JOB นั้นมาให้อัตโนมัติ (หรือค้นหาลูกค้าด้านล่างแทนก็ได้)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="customer_id">ลูกค้า</Label>
          <input type="hidden" name="customer_id" value={customerId} />
          {mode === "edit" ? (
            // Fixed on edit — changing the customer would invalidate the
            // whole open-invoices bundle, so this isn't an editable field.
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{customerName}</p>
          ) : (
            <CustomerAutocomplete
              id="customer_id"
              name="_customer_name_display"
              value={customerName}
              onChange={setCustomerName}
              onSelect={handleCustomerSelect}
              customers={customers}
              placeholder="ค้นหาลูกค้า"
              required
            />
          )}
          {selectedCustomer && (
            <p className="text-xs text-muted-foreground">
              {selectedCustomer.address ?? "ไม่มีที่อยู่ในระบบ"}
              {" • "}
              เลขผู้เสียภาษี: {selectedCustomer.taxId ?? "—"}
              {" • "}
              โทร. {selectedCustomer.phone ?? "—"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="doc_date">วันที่</Label>
            <DateInput id="doc_date" name="doc_date" value={docDate} onChange={setDocDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_days">เครดิต</Label>
            <Select
              name="credit_days"
              items={CREDIT_DAYS_ITEMS}
              value={creditDays}
              onValueChange={(v) => setCreditDays((v as string) ?? "0")}
            >
              <SelectTrigger id="credit_days" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_DAYS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>ครบกำหนด</Label>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{new Date(dueDate).toLocaleDateString("th-TH")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sales_rep_id">ผู้ขาย</Label>
          <Select
            name="sales_rep_id"
            items={salesRepItems}
            value={salesRepId || NONE_VALUE}
            onValueChange={(v) => setSalesRepId(v === NONE_VALUE ? "" : ((v as string) ?? ""))}
          >
            <SelectTrigger id="sales_rep_id" className="w-full">
              <SelectValue placeholder="— ไม่ระบุ —" />
            </SelectTrigger>
            <SelectContent>
              {salesRepItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="discount_amount">ส่วนลด (บาท)</Label>
            <NumberInput
              id="discount_amount"
              name="discount_amount"
              min={0}
              step={0.01}
              value={discountAmount}
              onChange={setDiscountAmount}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wht_percent">หัก ณ ที่จ่าย (%)</Label>
            <NumberInput id="wht_percent" name="wht_percent" min={0} step={0.01} value={whtPercent} onChange={setWhtPercent} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention_percent">หักประกันผลงาน (%)</Label>
            <NumberInput
              id="retention_percent"
              name="retention_percent"
              min={0}
              step={0.01}
              value={retentionPercent}
              onChange={setRetentionPercent}
            />
          </div>
        </div>

        {docType === "receipt" && (
          <div className="space-y-4 rounded-lg border p-3">
            <div className="space-y-2">
              <Label>การชำระเงิน</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m === "โอนเงิน") {
                        setBankName((prev) => prev || DEFAULT_BANK_NAME);
                        setPaymentReferenceNo((prev) => prev || DEFAULT_BANK_ACCOUNT_NO);
                      }
                    }}
                    className={
                      paymentMethod === m
                        ? "rounded-md border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                        : "rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input type="hidden" name="payment_method" value={paymentMethod} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">ธนาคาร</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  placeholder="เช่น กรุงศรีอยุธยา กระแสรายวัน"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_reference_no">เลขที่ (เช็ค/รายการโอน)</Label>
                <Input
                  id="payment_reference_no"
                  name="payment_reference_no"
                  value={paymentReferenceNo}
                  onChange={(e) => setPaymentReferenceNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">วันที่ชำระ</Label>
                <DateInput id="payment_date" name="payment_date" value={paymentDate} onChange={setPaymentDate} />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="ข้อมูลเพิ่มเติม..." defaultValue={initialData?.note ?? undefined} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>รายการใบแจ้งหนี้ที่ยังไม่ได้ชำระ</Label>
          {!customerId ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">เลือกลูกค้าก่อนเพื่อดูรายการใบแจ้งหนี้</p>
            </div>
          ) : loadingInvoices ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                ลูกค้ารายนี้ไม่มีใบแจ้งหนี้ค้างชำระ
                {quotations.length > 0 && " — เลือกจากใบเสนอราคาด้านล่างแทนได้"}
                {usesTaxInvoiceSource && taxInvoices.length > 0 && (docType === "receipt" ? " — เลือกจากใบกำกับภาษี/ใบวางบิลด้านล่างแทนได้" : " — เลือกจากใบกำกับภาษีด้านล่างแทนได้")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <label
                  key={inv.paymentId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(inv.paymentId)}
                    onChange={() => toggleInvoice(inv.paymentId)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {inv.invoiceNo} {inv.jobNo && <span className="text-muted-foreground">— {inv.jobNo}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.projectName} {inv.invoiceDate && `• ${new Date(inv.invoiceDate).toLocaleDateString("th-TH")}`}
                    </p>
                  </div>
                  {selected.has(inv.paymentId) && Number(whtPercent) > 0 && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={!whtExcluded.has(inv.paymentId)}
                        onChange={() => toggleWht(inv.paymentId)}
                        className="h-3.5 w-3.5"
                      />
                      หัก {whtPercent}%
                    </span>
                  )}
                  <p className="shrink-0 text-sm font-medium">{formatTHB(inv.amount)}</p>
                </label>
              ))}
            </div>
          )}
        </div>

        {customerId && !loadingInvoices && quotations.length > 0 && (
          <div className="space-y-2">
            <Label>ใบเสนอราคาที่ลูกค้าตอบตกลง (ยังไม่บันทึกเป็นงานจริง)</Label>
            <p className="text-xs text-muted-foreground">
              ใช้เมื่อยังไม่มีใบแจ้งหนี้จาก WALLPOD Project Sales — เลือกแล้วจะดึงยอดและรายการสินค้าทั้งใบมาให้
            </p>
            <div className="space-y-2">
              {quotations.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedQuotations.has(q.id)}
                    onChange={() => toggleQuotation(q.id)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.docNo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.projectName} • {new Date(q.quoteDate).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  {selectedQuotations.has(q.id) && Number(whtPercent) > 0 && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={!whtExcluded.has(q.id)}
                        onChange={() => toggleWht(q.id)}
                        className="h-3.5 w-3.5"
                      />
                      หัก {whtPercent}%
                    </span>
                  )}
                  {selectedQuotations.has(q.id) ? (
                    <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <NumberInput
                        className="w-28"
                        placeholder={String(q.total)}
                        min={0}
                        step={0.01}
                        value={quotationAmountOverrides[q.id] ?? ""}
                        onChange={(v) => setQuotationAmountOverrides((prev) => ({ ...prev, [q.id]: v }))}
                      />
                      <span className="text-xs text-muted-foreground">/ {formatTHB(q.total)}</span>
                    </span>
                  ) : (
                    <p className="shrink-0 text-sm font-medium">{formatTHB(q.total)}</p>
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              แก้ไขจำนวนเงินได้หากต้องการออกเอกสารบางส่วน (เช่น มัดจำ) — เว้นว่างเพื่อออกเต็มจำนวน
            </p>
          </div>
        )}

        {usesTaxInvoiceSource && customerId && !loadingInvoices && (
          <div className="space-y-2">
            <Label>
              {docType === "receipt" ? "ใบกำกับภาษี/ใบวางบิลที่ยังไม่ได้ออกใบเสร็จ" : "ใบกำกับภาษีที่ยังไม่ได้วางบิล"}
            </Label>
            <p className="text-xs text-muted-foreground">
              {docType === "receipt"
                ? "เลือกใบกำกับภาษีหรือใบวางบิลที่ต้องการออกใบเสร็จโดยตรง"
                : "เลือกใบกำกับภาษีที่ต้องการวางบิลโดยตรง"}
            </p>
            {taxInvoices.length === 0 && billingNoteItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {docType === "receipt"
                    ? "ลูกค้ารายนี้ไม่มีใบกำกับภาษีหรือใบวางบิลที่ยังไม่ได้ออกใบเสร็จ"
                    : "ลูกค้ารายนี้ไม่มีใบกำกับภาษีที่ยังไม่ได้วางบิล"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {taxInvoices.map((ti) => (
                  <label key={ti.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selectedTaxInvoices.has(ti.id)}
                      onChange={() => toggleTaxInvoice(ti.id)}
                      className="h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ti.docNo}</p>
                      <p className="truncate text-xs text-muted-foreground">{new Date(ti.docDate).toLocaleDateString("th-TH")}</p>
                    </div>
                    {selectedTaxInvoices.has(ti.id) && Number(whtPercent) > 0 && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={!whtExcluded.has(ti.quotationId)}
                          onChange={() => toggleWht(ti.quotationId)}
                          className="h-3.5 w-3.5"
                        />
                        หัก {whtPercent}%
                      </span>
                    )}
                    <p className="shrink-0 text-sm font-medium">{formatTHB(ti.netPayable)}</p>
                  </label>
                ))}
                {billingNoteItems.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selectedBillingNoteItems.has(item.id)}
                      onChange={() => toggleBillingNoteItem(item)}
                      className="h-4 w-4"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.billingNoteDocNo} <span className="text-muted-foreground">— {item.description}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(item.billingNoteDate).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium">{formatTHB(item.amount)}</p>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>รายการที่พิมพ์เอง</Label>
            <Button type="button" size="sm" variant="outline" onClick={addManualItem}>
              <Plus className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </Button>
          </div>
          {manualItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              ใช้เมื่อไม่มีใบแจ้งหนี้หรือใบเสนอราคาให้ดึง — พิมพ์ชื่อสินค้า/บริการ จำนวน และราคาต่อหน่วยเอง
            </p>
          ) : (
            <div className="space-y-2">
              {manualItems.map((row) => (
                <div key={row.key} className="flex items-start gap-2 rounded-lg border p-2">
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    <Input
                      className="col-span-4 sm:col-span-1"
                      placeholder="ชื่อสินค้า/บริการ"
                      value={row.description}
                      onChange={(e) => updateManualItem(row.key, "description", e.target.value)}
                    />
                    <NumberInput
                      placeholder="จำนวน"
                      min={0}
                      step={0.01}
                      value={row.qty}
                      onChange={(v) => updateManualItem(row.key, "qty", v)}
                    />
                    <Input
                      placeholder="หน่วย"
                      value={row.unit}
                      onChange={(e) => updateManualItem(row.key, "unit", e.target.value)}
                    />
                    <NumberInput
                      placeholder="ราคาต่อหน่วย"
                      min={0}
                      step={0.01}
                      value={row.unitPrice}
                      onChange={(v) => updateManualItem(row.key, "unitPrice", v)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    {row.description.trim() && Number(whtPercent) > 0 && (
                      <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={row.applyWht}
                          onChange={() => toggleManualItemWht(row.key)}
                          className="h-3.5 w-3.5"
                        />
                        หัก {whtPercent}%
                      </label>
                    )}
                    <span className="w-20 shrink-0 text-right text-sm font-medium">
                      {formatTHB(manualItemAmount(row))}
                    </span>
                    <Button type="button" size="icon-sm" variant="outline" onClick={() => removeManualItem(row.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {docType === "tax_invoice" && relevantFinishedGoods.length > 0 && (
          <div className="space-y-2">
            <Label>หักสต๊อกสินค้าสำเร็จรูป</Label>
            <p className="text-xs text-muted-foreground">
              เมื่อออกใบกำกับภาษีนี้ ระบบจะตัดสต๊อกสินค้าสำเร็จรูปที่เลือกไว้ให้อัตโนมัติ (ไม่บังคับ — เว้นว่างได้ถ้าไม่ต้องการตัดสต๊อก)
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {relevantFinishedGoods.map((fg) => (
                <div key={fg.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      <span className="text-muted-foreground">{fg.sku}</span> {fg.name}{" "}
                      {fg.jobNo && <span className="text-muted-foreground">— {fg.jobNo}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      คงเหลือ {fg.quantityOnHand} {[fg.thickness, fg.size, fg.color].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <NumberInput
                    className="w-24 shrink-0"
                    placeholder="0"
                    min={0}
                    step={0.01}
                    value={finishedGoodQty[fg.id] ?? ""}
                    onChange={(v) => setFinishedGoodQty((prev) => ({ ...prev, [fg.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">รวมเป็นเงิน</span>
            <span>{formatTHB(summary.subtotal)}</span>
          </div>
          {summary.discountAmount > 0 && (
            <>
              <div className="flex justify-between text-destructive">
                <span>หักส่วนลด</span>
                <span>{formatTHB(summary.discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนเงินรวมหลังหักส่วนลด</span>
                <span>{formatTHB(summary.afterDiscount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
            <span>{formatTHB(summary.vat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">จำนวนเงินรวม</span>
            <span>{formatTHB(summary.totalAfterVat)}</span>
          </div>
          {Number(whtPercent) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>หัก ณ ที่จ่าย {whtPercent}%</span>
              <span>{formatTHB(summary.whtAmount)}</span>
            </div>
          )}
          {Number(retentionPercent) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>หักประกันผลงาน {retentionPercent}%</span>
              <span>{formatTHB(summary.retentionAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>จำนวนเงินรวมทั้งสิ้น</span>
            <span>{formatTHB(summary.netPayable)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                mode === "edit" && docId
                  ? `/dashboard/billing-documents/${docType.replace("_", "-")}/view/${docId}`
                  : listPath,
              )
            }
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              (selected.size === 0 &&
                selectedQuotations.size === 0 &&
                selectedTaxInvoices.size === 0 &&
                !manualItems.some((row) => row.description.trim()))
            }
          >
            {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : `ออก${BILLING_DOCUMENT_LABELS[docType]}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
