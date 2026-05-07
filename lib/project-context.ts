import type { Project } from "@/lib/types";
import { appStorageKeys, readJson } from "@/lib/storage";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && uuidPattern.test(value));
}

export function sanitizeProject(project: Project): Project {
  if (!isUuid(project.id)) {
    const { id: _id, ...safeProject } = project;
    return safeProject;
  }

  return project;
}

export function getStoredProjectId() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const project = sanitizeProject(
    readJson<Project>(appStorageKeys.project, {
      name: "Customer portal QA initiative",
      description: "Sample project for requirements analysis and automation generation."
    })
  );

  return isUuid(project.id) ? project.id : undefined;
}
