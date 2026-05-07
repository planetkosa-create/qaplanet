"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge, ReadinessBadge, StatusBadge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import type { TestCase, TestCaseStatus } from "@/lib/types";

export function TestCaseTable({
  testCases,
  onChange,
  selectable = false,
  selectedIds = [],
  onSelectedChange
}: {
  testCases: TestCase[];
  onChange?: (testCases: TestCase[]) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function updateStatus(id: string, status: TestCaseStatus) {
    onChange?.(testCases.map((testCase) => (testCase.id === id ? { ...testCase, status } : testCase)));
  }

  function saveDescription(id: string) {
    onChange?.(
      testCases.map((testCase) => (testCase.id === id ? { ...testCase, description: draftDescription } : testCase))
    );
    setEditingId(null);
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedChange?.([...next]);
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {selectable ? <th className="w-12 px-4 py-3">Pick</th> : null}
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expected Result</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {testCases.map((testCase) => (
              <tr key={testCase.id} className="align-top">
                {selectable ? (
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${testCase.testCaseId}`}
                      checked={selectedSet.has(testCase.id)}
                      disabled={testCase.readiness === "Manual Only"}
                      onChange={() => toggleSelection(testCase.id)}
                      className="size-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    />
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-brand-blue">{testCase.testCaseId}</td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-950">{testCase.name}</div>
                  {editingId === testCase.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={4} />
                      <Button className="min-h-9 px-3 py-1.5" onClick={() => saveDescription(testCase.id)} icon={<Check className="size-4" aria-hidden />}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 max-w-md text-slate-600">{testCase.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">{testCase.requirementReference}</p>
                </td>
                <td className="px-4 py-4"><PriorityBadge value={testCase.priority} /></td>
                <td className="px-4 py-4 text-slate-700">{testCase.type}</td>
                <td className="px-4 py-4"><ReadinessBadge value={testCase.readiness} /></td>
                <td className="px-4 py-4"><StatusBadge value={testCase.status} /></td>
                <td className="px-4 py-4 text-slate-600">{testCase.expectedResult}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5"
                      onClick={() => {
                        setEditingId(testCase.id);
                        setDraftDescription(testCase.description);
                      }}
                      icon={<Pencil className="size-4" aria-hidden />}
                    >
                      Edit
                    </Button>
                    <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={() => updateStatus(testCase.id, "Approved")} icon={<Check className="size-4" aria-hidden />}>
                      Approve
                    </Button>
                    <Button variant="secondary" className="min-h-9 px-3 py-1.5" onClick={() => updateStatus(testCase.id, "Rejected")} icon={<X className="size-4" aria-hidden />}>
                      Reject
                    </Button>
                    <Button variant="ghost" className="min-h-9 px-3 py-1.5" onClick={() => updateStatus(testCase.id, "Draft")} icon={<RefreshCw className="size-4" aria-hidden />}>
                      Regenerate
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
