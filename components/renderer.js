const threadPositionsDesktop = {
  pool: (index) => ({ left: 58, top: 72 + index * 96 }),
  queue: (index) => ({ left: 280, top: 76 + index * 88 }),
  resource: (index) => ({ left: 520 + (index % 2) * 160, top: 122 + Math.floor(index / 2) * 170 }),
  resourceA: () => ({ left: 540, top: 150 }),
  resourceB: () => ({ left: 710, top: 150 }),
  condition: (index) => ({ left: 280 + (index % 3) * 120, top: 480 + Math.floor(index / 3) * 100 }),
};

const threadPositionsMobile = {
  pool: (index) => ({ left: 40 + index * 82, top: 54 }),
  queue: (index) => ({ left: 40 + index * 82, top: 218 }),
  resource: (index) => ({ left: 70 + (index % 2) * 150, top: 405 + Math.floor(index / 2) * 120 }),
  resourceA: () => ({ left: 74, top: 430 }),
  resourceB: () => ({ left: 240, top: 430 }),
  condition: (index) => ({ left: 44 + (index % 3) * 98, top: 640 + Math.floor(index / 3) * 96 }),
};

export class UIRenderer {
  constructor() {
    this.elements = {
      modeStat: document.getElementById("modeStat"),
      simStatusStat: document.getElementById("simStatusStat"),
      threadCountStat: document.getElementById("threadCountStat"),
      primitiveDetails: document.getElementById("primitiveDetails"),
      queueList: document.getElementById("queueList"),
      conditionList: document.getElementById("conditionList"),
      roleList: document.getElementById("roleList"),
      logPanel: document.getElementById("logPanel"),
      threadLayer: document.getElementById("threadLayer"),
      resourceZone: document.getElementById("resourceZone"),
      bufferZone: document.getElementById("bufferZone"),
      bufferSlots: document.getElementById("bufferSlots"),
      stepModeToggle: document.getElementById("stepModeToggle"),
    };
  }

  render(snapshot) {
    this.renderStats(snapshot);
    this.renderPrimitiveDetails(snapshot.primitiveDetails);
    this.renderQueue(snapshot);
    this.renderConditions(snapshot);
    this.renderRoles(snapshot.threads);
    this.renderLogs(snapshot.logs);
    this.renderResources(snapshot.resources, snapshot.mode, snapshot.deadlockEnabled);
    this.renderThreads(snapshot.threads);
    this.renderBuffer(snapshot.mode, snapshot.buffer);
    this.elements.stepModeToggle.textContent = snapshot.stepMode ? "On" : "Off";
  }

  renderStats(snapshot) {
    this.elements.modeStat.textContent = snapshot.modeLabel;
    this.elements.simStatusStat.textContent = snapshot.running ? "Running" : snapshot.stepMode ? "Step Mode" : "Idle";
    this.elements.threadCountStat.textContent = String(snapshot.threads.length);
  }

  renderPrimitiveDetails(lines) {
    this.elements.primitiveDetails.innerHTML = lines.map((line) => `<div>${line}</div>`).join("");
  }

  renderQueue(snapshot) {
    const pills = [];
    Object.entries(snapshot.queue).forEach(([name, ids]) => {
      if (!ids.length) {
        return;
      }
      pills.push(`<span class="pill">${name}: ${ids.join(" -> ")}</span>`);
    });

    this.elements.queueList.innerHTML = pills.length ? pills.join("") : `<span class="pill">No queued threads</span>`;
  }

  renderConditions(snapshot) {
    if (snapshot.mode !== "monitor") {
      this.elements.conditionList.innerHTML = `<span class="pill">Condition variables are used in Monitor mode</span>`;
      return;
    }

    const pills = snapshot.conditionState
      .map((condition) => `<span class="pill">${condition.name}: ${condition.ids.length ? condition.ids.join(", ") : "empty"}</span>`)
      .join("");

    this.elements.conditionList.innerHTML = pills;
  }

  renderRoles(threads) {
    this.elements.roleList.innerHTML = threads
      .map((thread) => `<span class="pill">${thread.id}: ${thread.role}</span>`)
      .join("");
  }

  renderLogs(logs) {
    this.elements.logPanel.innerHTML = logs
      .map(
        (entry) => `
          <div class="log-entry ${entry.type}">
            <div class="log-time">${entry.time}</div>
            <div class="log-message">${entry.message}</div>
          </div>
        `,
      )
      .join("");
  }

  renderResources(resources, mode, deadlockEnabled) {
    this.elements.resourceZone.innerHTML = `<span class="zone-title">Resource Area</span>`;
    resources.forEach((resource, index) => {
      const box = document.createElement("div");
      box.className = "resource-box";
      const isMobile = window.innerWidth <= 780;
      const left = deadlockEnabled && mode === "mutex" ? (index === 0 ? (isMobile ? 50 : 510) : isMobile ? 220 : 680) : isMobile ? 92 + index * 170 : 550 + index * 180;
      const top = deadlockEnabled && mode === "mutex" ? (isMobile ? 420 : 128) : isMobile ? 425 : 138 + (index % 2) * 170;
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.innerHTML = `
        <strong>${resource.name}</strong>
        <small>Holders: ${resource.holders.length ? resource.holders.join(", ") : "None"}</small>
        <small>Capacity: ${resource.capacity}${resource.available !== undefined ? ` | Available: ${resource.available}` : ""}</small>
      `;
      this.elements.resourceZone.appendChild(box);
    });
  }

  renderThreads(threads) {
    this.elements.threadLayer.innerHTML = "";
    const counters = {
      pool: 0,
      queue: 0,
      resource: 0,
      resourceA: 0,
      resourceB: 0,
      condition: 0,
    };

    threads.forEach((thread) => {
      const node = document.createElement("div");
      node.className = `thread-node ${thread.state === "idle" ? "" : thread.state}`;
      if (thread.state === "running") {
        node.classList.add("pulse");
      }
      const positionMap = window.innerWidth <= 780 ? threadPositionsMobile : threadPositionsDesktop;
      const key = positionMap[thread.position] ? thread.position : "pool";
      const coords = positionMap[key](counters[key] ?? 0);
      counters[key] += 1;
      node.style.left = `${coords.left}px`;
      node.style.top = `${coords.top}px`;
      node.innerHTML = `
        <span>${thread.id}</span>
        <span class="role-tag">${thread.role}</span>
      `;
      node.title = `${thread.id} | ${thread.role} | ${thread.state}${thread.waitingFor ? ` | waiting for ${thread.waitingFor}` : ""}`;
      this.elements.threadLayer.appendChild(node);
    });
  }

  renderBuffer(mode, buffer) {
    if (mode !== "monitor") {
      this.elements.bufferZone.classList.add("hidden");
      return;
    }

    this.elements.bufferZone.classList.remove("hidden");
    this.elements.bufferSlots.innerHTML = buffer
      .map((item, index) => `<div class="buffer-slot ${item ? "filled" : ""}">Slot ${index + 1}<br>${item ?? "Empty"}</div>`)
      .join("");
  }
}
