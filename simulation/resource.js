export class Resource {
  constructor(name, capacity = 1, type = "critical") {
    this.name = name;
    this.capacity = capacity;
    this.type = type;
    this.holders = [];
  }

  clear() {
    this.holders = [];
  }
}
