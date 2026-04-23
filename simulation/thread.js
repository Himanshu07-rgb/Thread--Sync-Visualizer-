export class Thread {
  constructor(id, role = "Worker") {
    this.id = id;
    this.role = role;
    this.state = "idle";
    this.position = "pool";
    this.progress = 0;
    this.holding = [];
    this.waitingFor = null;
    this.monitorAction = role === "Producer" ? "produce" : "consume";
    this.cyclesCompleted = 0;
    this.deadlocked = false;
  }

  setState(state, position = this.position) {
    this.state = state;
    this.position = position;
  }

  acquire(resourceName) {
    if (!this.holding.includes(resourceName)) {
      this.holding.push(resourceName);
    }
  }

  release(resourceName) {
    this.holding = this.holding.filter((name) => name !== resourceName);
  }

  reset(role = this.role) {
    this.role = role;
    this.state = "idle";
    this.position = "pool";
    this.progress = 0;
    this.holding = [];
    this.waitingFor = null;
    this.monitorAction = role === "Producer" ? "produce" : "consume";
    this.cyclesCompleted = 0;
    this.deadlocked = false;
  }
}
