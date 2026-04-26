const lineageParentByJob = new Map<string, string | undefined>();
const lineageRootByJob = new Map<string, string>();

export const registerLineage = (jobId: string, parentJobId?: string) => {
  lineageParentByJob.set(jobId, parentJobId);
  if (!parentJobId) {
    lineageRootByJob.set(jobId, jobId);
    return jobId;
  }

  const parentRoot = lineageRootByJob.get(parentJobId) ?? parentJobId;
  lineageRootByJob.set(parentJobId, parentRoot);
  lineageRootByJob.set(jobId, parentRoot);
  return parentRoot;
};

export const getLineageRoot = (jobId: string): string => lineageRootByJob.get(jobId) ?? registerLineage(jobId);

export const assertLineageRoot = (jobId: string, expectedLineageRootJobId: string): boolean => {
  const knownRoot = getLineageRoot(jobId);
  return knownRoot === expectedLineageRootJobId;
};

export const resetLineageRegistry = () => {
  lineageParentByJob.clear();
  lineageRootByJob.clear();
};
