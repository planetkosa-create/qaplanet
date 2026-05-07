"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getStoredProjectId } from "@/lib/project-context";
import { clearProjectWorkflowStorage, resetProjectWorkflow } from "@/lib/workflow-reset";

type ResetProjectWorkflowProps = {
  projectId?: string;
  onReset?: () => void;
  compact?: boolean;
};

const confirmationText =
  "Resetting this workflow will permanently delete uploaded requirement sources, AI analysis items, generated test cases, automation scripts, and export records for this project. The project name and description will be kept. This action cannot be undone.";

export function ResetProjectWorkflow({ projectId, onReset, compact = false }: ResetProjectWorkflowProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function confirmReset() {
    const activeProjectId = projectId ?? getStoredProjectId();

    if (!activeProjectId) {
      setMessage("Save the project first so QAplanet has a valid project ID to reset.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await resetProjectWorkflow(activeProjectId);
      clearProjectWorkflowStorage();
      onReset?.();
      setMessage(onReset ? "" : "Project workflow has been reset successfully.");
      setConfirmation("");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project workflow reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "secondary" : "danger"}
        className={compact ? "border-rose-200 text-rose-700 hover:bg-rose-50" : undefined}
        onClick={() => {
          setOpen(true);
          setMessage("");
          setConfirmation("");
        }}
        disabled={loading}
        icon={<RotateCcw className="size-4" aria-hidden />}
      >
        Reset Project Workflow
      </Button>

      {message && !open ? <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="card w-full max-w-xl p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-rose-50 p-2 text-rose-700">
                <AlertTriangle className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Reset Project Workflow</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{confirmationText}</p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Type RESET to confirm</span>
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET" />
            </label>

            {message ? <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{message}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmReset}
                disabled={loading || confirmation !== "RESET"}
                icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
              >
                {loading ? "Resetting Workflow" : "Confirm Reset"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
