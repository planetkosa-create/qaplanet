export type GherkinKeyword = "Given" | "When" | "Then" | "And" | "But";
export type PrimaryGherkinKeyword = "given" | "when" | "then";

export type ParsedFeatureStep = {
  keyword: GherkinKeyword;
  effectiveKeyword: PrimaryGherkinKeyword;
  text: string;
  placeholders: string[];
  hasDataTable: boolean;
};

export type ParsedFeature = {
  title: string;
  tags: string[];
  backgroundSteps: ParsedFeatureStep[];
  scenarioSteps: ParsedFeatureStep[];
  steps: ParsedFeatureStep[];
};

const stepPattern = /^\s*(Given|When|Then|And|But)\s+(.+?)\s*$/;

export function parseGherkinFeature(content: string): ParsedFeature {
  const lines = content.split(/\r?\n/);
  const tags: string[] = [];
  const backgroundSteps: ParsedFeatureStep[] = [];
  const scenarioSteps: ParsedFeatureStep[] = [];
  let title = "QAplanet Generated Behavior";
  let currentSection: "feature" | "background" | "scenario" = "feature";
  let lastPrimaryKeyword: PrimaryGherkinKeyword = "given";

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    if (trimmed.startsWith("@") && currentSection === "feature") {
      tags.push(...trimmed.split(/\s+/).filter(Boolean));
      return;
    }

    if (/^Feature:/i.test(trimmed)) {
      title = trimmed.replace(/^Feature:\s*/i, "").trim() || title;
      currentSection = "feature";
      lastPrimaryKeyword = "given";
      return;
    }

    if (/^Background:/i.test(trimmed)) {
      currentSection = "background";
      lastPrimaryKeyword = "given";
      return;
    }

    if (/^Scenario(?: Outline)?:/i.test(trimmed)) {
      currentSection = "scenario";
      lastPrimaryKeyword = "given";
      return;
    }

    const match = line.match(stepPattern);
    if (!match) {
      return;
    }

    const keyword = match[1] as GherkinKeyword;
    const text = normalizeStepText(match[2] ?? "");
    const effectiveKeyword = toEffectiveKeyword(keyword, lastPrimaryKeyword);
    if (keyword !== "And" && keyword !== "But") {
      lastPrimaryKeyword = effectiveKeyword;
    }

    const step: ParsedFeatureStep = {
      keyword,
      effectiveKeyword,
      text,
      placeholders: extractPlaceholders(text),
      hasDataTable: hasFollowingDataTable(lines, index)
    };

    if (currentSection === "background") {
      backgroundSteps.push(step);
    } else {
      scenarioSteps.push(step);
    }
  });

  const steps = uniqueSteps([...backgroundSteps, ...scenarioSteps]);

  return {
    title,
    tags,
    backgroundSteps,
    scenarioSteps,
    steps
  };
}

function toEffectiveKeyword(keyword: GherkinKeyword, previous: PrimaryGherkinKeyword): PrimaryGherkinKeyword {
  if (keyword === "Given") return "given";
  if (keyword === "When") return "when";
  if (keyword === "Then") return "then";
  return previous;
}

function extractPlaceholders(text: string) {
  return Array.from(text.matchAll(/<([A-Za-z_][A-Za-z0-9_]*)>/g)).flatMap((match) => (match[1] ? [match[1]] : []));
}

function hasFollowingDataTable(lines: string[], index: number) {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const trimmed = lines[cursor]?.trim() ?? "";
    if (!trimmed) {
      continue;
    }
    return trimmed.startsWith("|");
  }
  return false;
}

function normalizeStepText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueSteps(steps: ParsedFeatureStep[]) {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.effectiveKeyword}:${step.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
