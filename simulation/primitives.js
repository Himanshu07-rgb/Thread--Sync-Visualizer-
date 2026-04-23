import { Resource } from "./resource.js";

export class Mutex {
  constructor(name = "Mutex Lock") {
    this.name = name;
    this.resource = new Resource(name, 1, "mutex");
    this.queue = [];
    this.owner = null;
  }

  request(thread) {
    if (!this.owner) {
      this.owner = thread.id;
      this.resource.holders = [thread.id];
      return { granted: true };
    }

    if (!this.queue.includes(thread.id)) {
      this.queue.push(thread.id);
    }

    return { granted: false };
  }

  release() {
    const released = this.owner;
    this.owner = null;
    this.resource.holders = [];
    const next = this.queue.shift() ?? null;
    if (next) {
      this.owner = next;
      this.resource.holders = [next];
    }

    return { released, next };
  }

  reset() {
    this.queue = [];
    this.owner = null;
    this.resource.clear();
  }
}

export class Semaphore {
  constructor(name = "Semaphore", permits = 2) {
    this.name = name;
    this.permits = permits;
    this.available = permits;
    this.queue = [];
    this.resource = new Resource(name, permits, "semaphore");
  }

  request(thread) {
    if (this.available > 0) {
      this.available -= 1;
      this.resource.holders.push(thread.id);
      return { granted: true };
    }

    if (!this.queue.includes(thread.id)) {
      this.queue.push(thread.id);
    }

    return { granted: false };
  }

  release(threadId) {
    this.resource.holders = this.resource.holders.filter((holder) => holder !== threadId);
    this.available = Math.min(this.available + 1, this.permits);

    let next = null;
    if (this.available > 0 && this.queue.length > 0) {
      next = this.queue.shift();
      this.available -= 1;
      this.resource.holders.push(next);
    }

    return { next };
  }

  setPermits(permits) {
    this.permits = permits;
    this.available = permits;
    this.queue = [];
    this.resource.capacity = permits;
    this.resource.clear();
  }
}

export class Monitor {
  constructor(name = "Bounded Buffer Monitor", bufferSize = 4) {
    this.name = name;
    this.lockedBy = null;
    this.entryQueue = [];
    this.conditions = {
      notFull: [],
      notEmpty: [],
    };
    this.bufferSize = bufferSize;
    this.buffer = Array.from({ length: bufferSize }, () => null);
    this.itemCounter = 0;
    this.resource = new Resource(name, 1, "monitor");
  }

  enter(thread) {
    if (this.lockedBy === thread.id) {
      this.resource.holders = [thread.id];
      return { entered: true };
    }

    if (!this.lockedBy) {
      this.lockedBy = thread.id;
      this.resource.holders = [thread.id];
      return { entered: true };
    }

    if (!this.entryQueue.includes(thread.id)) {
      this.entryQueue.push(thread.id);
    }

    return { entered: false };
  }

  leave() {
    this.lockedBy = null;
    this.resource.holders = [];
    const next = this.entryQueue.shift() ?? null;
    if (next) {
      this.lockedBy = next;
      this.resource.holders = [next];
    }

    return next;
  }

  wait(conditionName, thread) {
    if (!this.conditions[conditionName].includes(thread.id)) {
      this.conditions[conditionName].push(thread.id);
    }
    this.lockedBy = null;
    this.resource.holders = [];
    const next = this.entryQueue.shift() ?? null;
    if (next) {
      this.lockedBy = next;
      this.resource.holders = [next];
    }
    return next;
  }

  signal(conditionName) {
    const awakened = this.conditions[conditionName].shift() ?? null;
    if (awakened) {
      this.entryQueue.unshift(awakened);
    }
    return awakened;
  }

  produceItem(threadId) {
    const freeIndex = this.buffer.findIndex((item) => item === null);
    if (freeIndex === -1) {
      return null;
    }

    this.itemCounter += 1;
    const item = `Item ${this.itemCounter} by ${threadId}`;
    this.buffer[freeIndex] = item;
    return item;
  }

  consumeItem() {
    const itemIndex = this.buffer.findIndex((item) => item !== null);
    if (itemIndex === -1) {
      return null;
    }

    const item = this.buffer[itemIndex];
    this.buffer[itemIndex] = null;
    return item;
  }

  reset() {
    this.lockedBy = null;
    this.entryQueue = [];
    this.conditions.notFull = [];
    this.conditions.notEmpty = [];
    this.buffer = Array.from({ length: this.bufferSize }, () => null);
    this.itemCounter = 0;
    this.resource.clear();
  }
}
