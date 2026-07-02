export type AssignmentGroupingFields = {
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  archived_at?: string | null;
};

export type AssignmentGroup<T extends AssignmentGroupingFields> = {
  id: string;
  assignments: T[];
  archivedAt: string | null;
};

export function getAssignmentGroupKey(assignment: AssignmentGroupingFields) {
  return [
    assignment.classroom_id,
    assignment.title.trim().toLowerCase(),
    (assignment.description ?? "").trim().toLowerCase(),
    assignment.due_date ?? "",
  ].join("::");
}

function latestDate(values: Array<string | null | undefined>) {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest;
    if (!latest) return value;
    return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
  }, null);
}

export function groupAssignmentRows<T extends AssignmentGroupingFields>(
  assignments: T[],
): AssignmentGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const assignment of assignments) {
    const groupKey = getAssignmentGroupKey(assignment);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), assignment]);
  }

  return [...groups.entries()].map(([id, groupAssignments]) => ({
    id,
    assignments: groupAssignments,
    archivedAt: groupAssignments.every((assignment) => Boolean(assignment.archived_at))
      ? latestDate(groupAssignments.map((assignment) => assignment.archived_at))
      : null,
  }));
}
