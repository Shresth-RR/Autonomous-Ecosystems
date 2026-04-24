# Autonomous-Ecosystems
# Autonomous Ecosystems (p5.js)

A high-performance **agent-based ecosystem simulation** featuring emergent behavior, evolution under constraints, and real-time optimization using spatial partitioning.

---

## 🌱 Overview

This project simulates an evolving ecosystem of:

* **Herbivores** (seek food, flee predators)
* **Predators** (hunt herbivores)
* **Food sources** (energy supply)

Agents evolve over time using a **DNA-based system**, leading to emergent strategies such as:

* “Small and Fast” survival traits
* Predator-prey population cycles
* Self-organized safe zones

---

## ⚙️ Key Features

### 🧠 Autonomous Behaviors

* **Seek** (food / prey)
* **Flee** (predators)
* **Wander** (exploration)
* Hybrid arbitration:

  * **Priority Switching** (panic mode)
  * **Weighted Blending** (normal decisions)

---

### 🧬 Evolution System

* DNA traits:

  * Size
  * Speed
  * Agility
  * Perception
  * Behavioral weights (food, fear, hunt)
* Mutation-based reproduction
* Natural selection via:

  * Energy efficiency
  * Survival success

---

### 🌍 Emergent Dynamics

* Predator-prey oscillations (Lotka–Volterra-like)
* Herd clustering in low-risk regions
* Predator fatigue (energy-driven behavior collapse)
* Dynamic equilibrium over time

---

### 🌗 Day/Night Cycle

* Sinusoidal cycle (~60s full loop)
* Night reduces metabolic drain
* Affects survival and reproduction rates

---

### ⚡ Performance Optimization

* **Uniform Grid Spatial Partitioning**

  * Reduces neighbor search from **O(n²) → O(n)**
* Swap removal (no array filtering)
* Batched canvas rendering

---

## 📊 Performance

| Mode             | Complexity | FPS @ ~800 entities |
| ---------------- | ---------- | ------------------- |
| Grid (Optimized) | O(n)       | ~55–60 FPS          |
| Naive            | O(n²)      | ~12–20 FPS          |

### 🔍 Profiling Insight

* **Naive Mode:** `Herbivore.update()` dominates (logic-heavy)
* **Optimized Mode:** `drawHerbivores()` / `drawPredators()` dominate (rendering-heavy)

→ Indicates successful optimization: bottleneck shifts from computation to rendering.

---

## 🧪 Controls

| Key     | Action                   |
| ------- | ------------------------ |
| `P`     | Toggle perception radius |
| `G`     | Toggle spatial grid      |
| `B`     | Toggle behavior colors   |
| `T`     | Toggle trails            |
| `E`     | Toggle energy bars       |
| `D`     | Toggle day/night cycle   |
| `M`     | Toggle Naive / Grid mode |
| `H`     | Hide HUD                 |
| `R`     | Reset simulation         |
| `F`     | Spawn food burst         |
| `+ / -` | Add/remove herbivores    |
| Click   | Inspect agent            |

---

## 🧩 System Architecture

### Core Components

* `Agent.js` → Base class + Herbivore/Predator logic
* `Food.js` → Energy entities
* `Grid.js` → Spatial partitioning
* `sketch.js` → Main loop, rendering, HUD

---

### DNA → Physics Mapping

| Trait       | Effect                   |
| ----------- | ------------------------ |
| Size        | Mass, energy consumption |
| Speed       | Movement capability      |
| Agility     | Turning force            |
| Perception  | Detection radius         |
| Food Weight | Food-seeking priority    |
| Fear Weight | Escape intensity         |
| Hunt Weight | Predator aggression      |

---

## 🧠 Emergence Highlights

* **Refugium Formation:** Herbivores cluster in low-risk zones
* **Pursuit Fatigue:** Predators abandon long chases
* **Population Oscillations:** Stable predator-prey cycles

---

## 🚀 Getting Started

1. Clone the repo:

```bash
git clone https://github.com/your-username/autonomous-ecosystems.git
```

2. Open `index.html` in a browser

3. Interact using keyboard controls

---

## 📸 Screenshots (Add yours)

* Simulation overview
* Evolution chart
* DevTools performance profile

---

## 🔬 Future Improvements

* WebGL rendering (reduce draw bottleneck)
* Quadtree instead of uniform grid
* More complex ecosystems (omnivores, disease, terrain)
* Genetic crossover (not just mutation)

---

## 📜 License

MIT License

---

## ✨ Summary

This project demonstrates how:

* Simple local rules → complex global behavior
* Evolution emerges from constraints
* Optimization shifts bottlenecks rather than removing them

A balance of **biology, physics, and computer science** in real-time simulation.
