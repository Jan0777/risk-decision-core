export interface Job {
  id: string;
  name: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  progress: number;
  startTime: number;
  endTime?: number;
}

let jobs: Job[] = [];
let listeners: (() => void)[] = [];

export const JobStore = {
  getJobs: () => [...jobs],
  
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
  
  emit: () => {
    listeners.forEach(l => l());
  },

  addJob: (name: string) => {
    const job: Job = {
      id: "job_" + Math.random().toString(36).substr(2, 6),
      name,
      status: 'Pending',
      progress: 0,
      startTime: Date.now()
    };
    jobs.unshift(job);
    JobStore.emit();
    return job.id;
  },

  updateJob: (id: string, updates: Partial<Omit<Job, 'id'>>) => {
    const job = jobs.find(j => j.id === id);
    if (job) {
      Object.assign(job, updates);
      if (updates.status === 'Completed' || updates.status === 'Failed') {
         job.endTime = Date.now();
      }
      JobStore.emit();
    }
  }
};
