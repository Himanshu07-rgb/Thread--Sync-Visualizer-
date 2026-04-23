export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const pickThreadRole = (index) => (index % 2 === 0 ? "Producer" : "Consumer");

export const formatModeLabel = (mode) => {
  const labels = {
    mutex: "Mutex",
    semaphore: "Semaphore",
    monitor: "Monitor",
  };

  return labels[mode] ?? mode;
};

export const queueToIds = (queue) => queue.map((item) => item.id);
