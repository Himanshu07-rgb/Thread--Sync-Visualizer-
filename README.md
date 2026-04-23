# Thread Synchronization Visualizer

An interactive educational web project that demonstrates operating system thread synchronization using mutexes, semaphores, and monitors with condition variables.

## Project Structure

```text
thread-sync-visualizer/
|-- index.html
|-- style.css
|-- script.js
|-- server.js
|-- README.md
|-- components/
|   `-- renderer.js
|-- simulation/
|   |-- engine.js
|   |-- primitives.js
|   |-- resource.js
|   `-- thread.js
`-- utils/
    `-- helpers.js
```

## Setup

No package installation is required. The project runs directly in a browser as a static site, and an optional Node.js server is included for local hosting.

## How To Run

1. Open [index.html](D:/c++.cpp/thread-sync-visualizer/index.html) in a modern browser.
2. Or run the included local server:

```bash
node server.js
```

Then open `http://localhost:3000`.

## Modules

- `index.html`: Dashboard layout, visualization areas, controls, and log panel.
- `style.css`: Modern UI design, animations, responsive layout, and thread/resource styling.
- `script.js`: Connects UI controls to the simulation engine.
- `server.js`: Optional zero-dependency static server for local demo hosting.
- `components/renderer.js`: Converts simulation state into DOM updates for threads, queues, resources, logs, and the buffer.
- `simulation/thread.js`: Thread model with state, held resources, and role metadata.
- `simulation/resource.js`: Shared resource model used by synchronization primitives.
- `simulation/primitives.js`: `Mutex`, `Semaphore`, and `Monitor` implementations with queue and condition handling.
- `simulation/engine.js`: Main scheduling loop, step execution, deadlock flow, and producer-consumer simulation.
- `utils/helpers.js`: Shared helpers for timing, mode labels, clamping, and producer/consumer role selection.

## Educational Features

- Mutex mode with FIFO waiting queue
- Semaphore mode with user-defined permit count
- Monitor mode with `notFull` and `notEmpty` condition waits
- Producer-Consumer bounded buffer visualization
- Real-time event log
- Queue visualization
- Adjustable speed
- Step-by-step execution
- Deadlock simulation toggle

## State Colors

- Green: Running
- Yellow: Waiting
- Red: Blocked
