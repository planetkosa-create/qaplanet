import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { GeneratedScript, RequirementAnalysis } from "@/lib/types";
import { appStorageKeys, writeJson } from "@/lib/storage";

export async function resetProjectWorkflow(projectId: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    throw new Error("Sign in before resetting project workflow data.");
  }

  const project = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.data.user.id)
    .single();

  if (project.error) {
    throw new Error(`Project ownership could not be verified: ${project.error.message}`);
  }

  const deleteSteps = [
    { table: "exports", label: "exports" },
    { table: "generated_automation", label: "generated automation" },
    { table: "test_cases", label: "test cases" },
    { table: "analysis_items", label: "analysis items" },
    { table: "requirement_sources", label: "requirement sources" }
  ];

  for (const step of deleteSteps) {
    const { error } = await supabase.from(step.table).delete().eq("project_id", projectId);

    if (error) {
      throw new Error(`Failed to delete ${step.label}: ${error.message}`);
    }
  }

  return true;
}

export function clearProjectWorkflowStorage() {
  const emptyAnalysis: RequirementAnalysis = {
    summary: "",
    businessRules: [],
    userStories: [],
    acceptanceCriteria: [],
    risks: [],
    gaps: [],
    assumptions: [],
    actors: [],
    systems: [],
    dataRequirements: []
  };

  const emptyScript: GeneratedScript = {
    id: "",
    testCaseIds: [],
    name: "No generated script",
    code: "",
    createdAt: new Date().toISOString(),
    language: "typescript",
    framework: "Playwright"
  };

  writeJson(appStorageKeys.requirements, "");
  writeJson(appStorageKeys.analysis, emptyAnalysis);
  writeJson(appStorageKeys.documents, []);
  writeJson(appStorageKeys.requirementSources, []);
  writeJson(appStorageKeys.analysisItems, []);
  writeJson(appStorageKeys.testCases, []);
  writeJson(appStorageKeys.automationAssessments, []);
  writeJson(appStorageKeys.generatedAutomations, []);
  writeJson(appStorageKeys.traceabilityRows, []);
  writeJson(appStorageKeys.selectedTestCases, []);
  writeJson(appStorageKeys.generatedScript, emptyScript);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("qaplanet:workflow-reset"));
  }
}
