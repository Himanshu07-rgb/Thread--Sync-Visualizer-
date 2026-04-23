import { Thread } from "./thread.js";
import { Mutex, Semaphore, Monitor } from "./primitives.js";
import { clamp, delay, formatModeLabel, pickThreadRole } from "../utils/helpers.js";

export class SimulationEngine {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.mode = "mutex";
    this.speed = 950;
    this.stepMode = false;
    this.running = false;
    this.stepPending = false;
    this.deadlockEnabled = false;
    this.tick = 0;
    this.logs = [];
    this.threads = [];
    this.threadCounter = 0;
    this.roundRobinIndex = 0;
    this.mutex = new Mutex();
    this.deadlockMutexA = new Mutex("Resource A");
    this.deadlockMutexB = new Mutex("Resource B");
    this.semaphore = new Semaphore("Semaphore Gate", 2);
    this.monitor = new Monitor();
    this.addThread();
    this.addThread();
    this.addThread();
    this.addThread();
    this.emit();
  }

  emit() {
    this.onUpdate(this.getSnapshot());
  }

  getSnapshot() {
    return {
      tick: this.tick,
      mode: this.mode,
      modeLabel: formatModeLabel(this.mode),
      speed: this.speed,
      running: this.running,
      stepMode: this.stepMode,
      deadlockEnabled: this.deadlockEnabled,
      logs: [...this.logs].slice(-80).reverse(),
      threads: this.threads.map((thread) => ({ ...thread })),
      queue: this.getQueueState(),
      resources: this.getResourceState(),
      primitiveDetails: this.getPrimitiveDetails(),
      conditionState: this.getConditionState(),
      buffer: [...this.monitor.buffer],
    };
  }

  getQueueState() {
    if (this.mode === "mutex") {
      if (this.deadlockEnabled) {
        return {
          entry: [],
          mutexA: [...this.deadlockMutexA.queue],
          mutexB: [...this.deadlockMutexB.queue],
        };
      }
      return { entry: [...this.mutex.queue] };
    }

    if (this.mode === "semaphore") {
      return { entry: [...this.semaphore.queue] };
    }

    return {
      entry: [...this.monitor.entryQueue],
      notFull: [...this.monitor.conditions.notFull],
      notEmpty: [...this.monitor.conditions.notEmpty],
    };
  }

  getResourceState() {
    if (this.mode === "mutex") {
      return this.deadlockEnabled
        ? [
            { name: "Resource A", holders: [...this.deadlockMutexA.resource.holders], capacity: 1 },
            { name: "Resource B", holders: [...this.deadlockMutexB.resource.holders], capacity: 1 },
          ]
        : [{ name: this.mutex.name, holders: [...this.mutex.resource.holders], capacity: 1 }];
    }

    if (this.mode === "semaphore") {
      return [{
        name: this.semaphore.name,
        holders: [...this.semaphore.resource.holders],
        capacity: this.semaphore.permits,
        available: this.semaphore.available,
      }];
    }

    return [{
      name: this.monitor.name,
      holders: [...this.monitor.resource.holders],
      capacity: 1,
    }];
  }

  getPrimitiveDetails() {
    if (this.mode === "mutex") {
      if (this.deadlockEnabled) {
        return [
          "Deadlock toggle is enabled.",
          `Resource A owner: ${this.deadlockMutexA.owner ?? "None"}`,
          `Resource B owner: ${this.deadlockMutexB.owner ?? "None"}`,
          "T1 holds A and waits for B while T2 holds B and waits for A.",
        ];
      }

      return [
        `Mutex owner: ${this.mutex.owner ?? "None"}`,
        "Queue discipline: FIFO waiting queue",
        "Only one thread may enter the critical section at a time.",
      ];
    }

    if (this.mode === "semaphore") {
      return [
        `Semaphore permits: ${this.semaphore.permits}`,
        `Available permits: ${this.semaphore.available}`,
        `Threads inside: ${this.semaphore.resource.holders.length}`,
        "Blocked threads wait until a permit is released.",
      ];
    }

    return [
      `Monitor lock owner: ${this.monitor.lockedBy ?? "None"}`,
      `notFull waiters: ${this.monitor.conditions.notFull.length}`,
      `notEmpty waiters: ${this.monitor.conditions.notEmpty.length}`,
      "Monitor serializes entry and coordinates wake-ups with condition variables.",
    ];
  }

  getConditionState() {
    if (this.mode !== "monitor") {
      return [];
    }

    return [
      { name: "Entry Queue", ids: [...this.monitor.entryQueue] },
      { name: "notFull", ids: [...this.monitor.conditions.notFull] },
      { name: "notEmpty", ids: [...this.monitor.conditions.notEmpty] },
    ];
  }

  addLog(message, type = "info") {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    this.logs.push({ time, message, type });
  }

  addThread() {
    this.threadCounter += 1;
    const role = this.mode === "monitor" ? pickThreadRole(this.threadCounter - 1) : "Worker";
    const thread = new Thread(`T${this.threadCounter}`, role);
    this.threads.push(thread);
    this.addLog(`${thread.id} created and added to the thread pool.`, "success");
    this.emit();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset(false);
    this.addLog(`Mode changed to ${formatModeLabel(mode)}.`, "success");
    this.emit();
  }

  setSemaphorePermits(value) {
    const permits = clamp(Number(value) || 1, 1, 6);
    this.semaphore.setPermits(permits);
    if (this.mode === "semaphore") {
      this.addLog(`Semaphore limit updated to ${permits} permits.`, "success");
    }
    this.emit();
  }

  setSpeed(speed) {
    this.speed = Number(speed);
    this.emit();
  }

  toggleStepMode() {
    this.stepMode = !this.stepMode;
    this.running = false;
    this.stepPending = false;
    this.addLog(`Step mode ${this.stepMode ? "enabled" : "disabled"}.`, "success");
    this.emit();
  }

  toggleDeadlock(enabled) {
    this.deadlockEnabled = enabled;
    this.reset(false);
    this.addLog(
      enabled ? "Deadlock mode enabled. Mutex simulation will show circular wait."
        : "Deadlock mode disabled. Normal mutex scheduling restored.",
      enabled ? "warning" : "success",
    );
    this.emit();
  }

  async start() {
    if (this.stepMode) {
      this.addLog("Step mode is active. Use Next Step to advance the simulation.", "warning");
      this.emit();
      return;
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.addLog(`Simulation started in ${formatModeLabel(this.mode)} mode.`, "success");
    this.emit();

    while (this.running) {
      await this.executeStep();
      await delay(this.speed);
    }
  }

  stop() {
    this.running = false;
    this.emit();
  }

  async nextStep() {
    if (!this.stepMode) {
      this.addLog("Enable step mode to use Next Step.", "warning");
      this.emit();
      return;
    }

    if (this.stepPending) {
      return;
    }

    this.stepPending = true;
    await this.executeStep();
    this.stepPending = false;
  }

  reset(keepLogs = true) {
    this.stop();
    this.tick = 0;
    this.roundRobinIndex = 0;
    this.mutex.reset();
    this.deadlockMutexA.reset();
    this.deadlockMutexB.reset();
    this.semaphore.setPermits(this.semaphore.permits);
    this.monitor.reset();

    this.threads.forEach((thread, index) => {
      const role = this.mode === "monitor" ? pickThreadRole(index) : "Worker";
      thread.reset(role);
    });

    if (!keepLogs) {
      this.logs = [];
    }

    this.emit();
  }

  getNextThread() {
    if (this.threads.length === 0) {
      return null;
    }

    const thread = this.threads[this.roundRobinIndex % this.threads.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.threads.length;
    return thread;
  }

  async executeStep() {
    this.tick += 1;

    if (this.mode === "mutex") {
      if (this.deadlockEnabled) {
        this.runDeadlockStep();
      } else {
        this.runMutexStep();
      }
    } else if (this.mode === "semaphore") {
      this.runSemaphoreStep();
    } else {
      this.runMonitorStep();
    }

    this.emit();
  }

  runMutexStep() {
    const activeThread = this.threads.find((thread) => thread.position === "resource");
    if (activeThread) {
      activeThread.cyclesCompleted += 1;
      activeThread.release(this.mutex.name);
      const { next } = this.mutex.release();
      this.addLog(`${activeThread.id} released the mutex after leaving the critical section.`, "success");
      activeThread.setState("idle", "pool");
      activeThread.waitingFor = null;

      if (next) {
        const nextThread = this.findThread(next);
        nextThread.acquire(this.mutex.name);
        nextThread.setState("running", "resource");
        nextThread.waitingFor = null;
        this.addLog(`${nextThread.id} acquired the mutex from the waiting queue.`, "success");
      }
      return;
    }

    const thread = this.getNextThread();
    if (!thread) {
      return;
    }

    const result = this.mutex.request(thread);
    if (result.granted) {
      thread.acquire(this.mutex.name);
      thread.setState("running", "resource");
      thread.waitingFor = null;
      this.addLog(`${thread.id} acquired lock and entered the critical section.`, "success");
      this.resetNonActiveThreads([thread.id]);
    } else {
      thread.waitingFor = this.mutex.name;
      thread.setState("waiting", "queue");
      this.addLog(`${thread.id} is waiting because the mutex is already locked.`, "warning");
    }
  }

  runDeadlockStep() {
    const t1 = this.threads[0];
    const t2 = this.threads[1];
    const others = this.threads.slice(2);

    if (this.tick === 1 && t1) {
      this.deadlockMutexA.request(t1);
      t1.acquire("Resource A");
      t1.setState("running", "resourceA");
      this.addLog("T1 acquired Resource A.", "success");
      return;
    }

    if (this.tick === 2 && t2) {
      this.deadlockMutexB.request(t2);
      t2.acquire("Resource B");
      t2.setState("running", "resourceB");
      this.addLog("T2 acquired Resource B.", "success");
      return;
    }

    if (this.tick === 3 && t1) {
      t1.waitingFor = "Resource B";
      t1.deadlocked = true;
      t1.setState("blocked", "queue");
      this.deadlockMutexB.request(t1);
      this.addLog("T1 requests Resource B and becomes blocked.", "error");
      return;
    }

    if (this.tick === 4 && t2) {
      t2.waitingFor = "Resource A";
      t2.deadlocked = true;
      t2.setState("blocked", "queue");
      this.deadlockMutexA.request(t2);
      this.addLog("T2 requests Resource A and becomes blocked.", "error");
      this.addLog("Deadlock formed: circular wait detected between T1 and T2.", "error");
      others.forEach((thread) => {
        thread.waitingFor = "Deadlock resolution";
        thread.setState("blocked", "condition");
      });
      this.stop();
      return;
    }

    others.forEach((thread) => {
      thread.setState("blocked", "condition");
      thread.waitingFor = "Deadlock resolution";
    });
  }

  runSemaphoreStep() {
    const active = this.threads.filter((thread) => thread.position === "resource");
    if (active.length > 0 && this.tick % 2 === 0) {
      const threadToRelease = active[0];
      threadToRelease.cyclesCompleted += 1;
      threadToRelease.release(this.semaphore.name);
      const { next } = this.semaphore.release(threadToRelease.id);
      threadToRelease.setState("idle", "pool");
      threadToRelease.waitingFor = null;
      this.addLog(`${threadToRelease.id} released a semaphore permit.`, "success");

      if (next) {
        const awakened = this.findThread(next);
        awakened.acquire(this.semaphore.name);
        awakened.setState("running", "resource");
        awakened.waitingFor = null;
        this.addLog(`${awakened.id} was unblocked and entered through the semaphore.`, "success");
      }
    }

    const thread = this.getNextThread();
    if (!thread || thread.position === "resource") {
      return;
    }

    const result = this.semaphore.request(thread);
    if (result.granted) {
      thread.acquire(this.semaphore.name);
      thread.setState("running", "resource");
      thread.waitingFor = null;
      this.addLog(`${thread.id} entered because a semaphore permit was available.`, "success");
    } else {
      thread.waitingFor = this.semaphore.name;
      thread.setState("blocked", "queue");
      this.addLog(`${thread.id} is blocked because no semaphore permits are available.`, "error");
    }
  }

  runMonitorStep() {
    const thread = this.monitor.lockedBy ? this.findThread(this.monitor.lockedBy) : this.getNextThread();
    if (!thread) {
      return;
    }

    if (thread.position === "condition") {
      thread.setState("waiting", "condition");
    }

    const { entered } = this.monitor.enter(thread);
    if (!entered) {
      thread.setState("waiting", "queue");
      thread.waitingFor = "Monitor lock";
      this.addLog(`${thread.id} is waiting to enter the monitor.`, "warning");
      return;
    }

    thread.setState("running", "resource");
    thread.waitingFor = null;
    this.addLog(`${thread.id} entered the monitor and obtained the implicit lock.`, "success");

    if (thread.monitorAction === "produce") {
      const item = this.monitor.produceItem(thread.id);
      if (!item) {
        const nextOwner = this.monitor.wait("notFull", thread);
        thread.setState("waiting", "condition");
        thread.waitingFor = "notFull";
        this.addLog(`${thread.id} waits on condition notFull because the buffer is full.`, "warning");
        if (nextOwner) {
          this.findThread(nextOwner).setState("running", "resource");
        }
        return;
      }

      thread.cyclesCompleted += 1;
      this.addLog(`${thread.id} produced ${item}.`, "success");
      const awakened = this.monitor.signal("notEmpty");
      if (awakened) {
        this.findThread(awakened).setState("waiting", "queue");
        this.addLog(`${thread.id} signaled notEmpty and woke ${awakened}.`, "success");
      }
    } else {
      const item = this.monitor.consumeItem();
      if (!item) {
        const nextOwner = this.monitor.wait("notEmpty", thread);
        thread.setState("waiting", "condition");
        thread.waitingFor = "notEmpty";
        this.addLog(`${thread.id} waits on condition notEmpty because the buffer is empty.`, "warning");
        if (nextOwner) {
          this.findThread(nextOwner).setState("running", "resource");
        }
        return;
      }

      thread.cyclesCompleted += 1;
      this.addLog(`${thread.id} consumed ${item}.`, "success");
      const awakened = this.monitor.signal("notFull");
      if (awakened) {
        this.findThread(awakened).setState("waiting", "queue");
        this.addLog(`${thread.id} signaled notFull and woke ${awakened}.`, "success");
      }
    }

    const next = this.monitor.leave();
    thread.setState("idle", "pool");
    if (next) {
      this.findThread(next).setState("running", "resource");
      this.addLog(`${next} received the monitor lock and will execute next.`, "success");
    }
  }

  resetNonActiveThreads(activeIds) {
    this.threads.forEach((thread) => {
      if (!activeIds.includes(thread.id) && thread.position !== "queue") {
        thread.setState("idle", "pool");
      }
    });
  }

  findThread(id) {
    return this.threads.find((thread) => thread.id === id);
  }
}
