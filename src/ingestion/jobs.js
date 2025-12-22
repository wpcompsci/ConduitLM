// Ingestion Job Store (persistent)
(function (scope) {
  const STORAGE_KEY = 'conduit_jobs_v1';
  const STALE_MS = 10 * 60 * 1000;

  async function loadJobs() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const jobs = data[STORAGE_KEY];
    return Array.isArray(jobs) ? jobs : [];
  }

  async function saveJobs(jobs) {
    await browser.storage.local.set({ [STORAGE_KEY]: jobs });
  }

  function createJobId() {
    const rand = Math.floor(Math.random() * 900000 + 100000);
    return `job_${Date.now()}_${rand}`;
  }

  async function createJob(data) {
    const jobs = await loadJobs();
    const job = {
      id: createJobId(),
      status: 'created',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: data || {},
    };
    jobs.push(job);
    await saveJobs(jobs);
    return job;
  }

  async function updateJob(jobId, patch) {
    const jobs = await loadJobs();
    const updated = jobs.map((job) => {
      if (job.id !== jobId) return job;
      return {
        ...job,
        ...patch,
        updatedAt: Date.now(),
      };
    });
    await saveJobs(updated);
  }

  async function completeJob(jobId, result) {
    await updateJob(jobId, { status: 'completed', result });
  }

  async function failJob(jobId, error) {
    await updateJob(jobId, { status: 'failed', error });
  }

  async function sweepStaleJobs() {
    const jobs = await loadJobs();
    const now = Date.now();
    let changed = false;
    const updated = jobs.map((job) => {
      if (job.status === 'in_progress' && now - job.updatedAt > STALE_MS) {
        changed = true;
        return {
          ...job,
          status: 'failed',
          error: { code: 'interrupted', message: 'Background interrupted during send' },
          updatedAt: now,
        };
      }
      return job;
    });
    if (changed) await saveJobs(updated);
  }

  scope.JobStore = {
    createJob,
    updateJob,
    completeJob,
    failJob,
    sweepStaleJobs,
  };
})(globalThis);
