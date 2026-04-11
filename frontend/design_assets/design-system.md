# Design System Specification: Tactical Intelligence & Atmospheric Depth

## 1. Overview & Creative North Star: "The Tactical Sentinel"
The Creative North Star for this design system is **"The Tactical Sentinel."** We are not building a generic dashboard; we are crafting a high-stakes, mission-critical environment that feels like an advanced command-and-control interface. 

To move beyond the "template" look, this system utilizes **Atmospheric Layering**. Instead of rigid grids and harsh lines, we use intentional asymmetry and overlapping glass panels to create a sense of deep, digital space. The interface should feel like a transparent HUD (Heads-Up Display) overlaid on a chaotic environment, providing clarity, authority, and calm in the face of a wildfire emergency.

---

## 2. Color Theory & Surface Logic
The palette is rooted in the "Abyssal Navy" of a night sky, contrasted against the "Incendiary Orange" of active fire zones.

### Surface Hierarchy & Nesting
We reject the flat UI. Depth is achieved through **Tonal Layering**, stacking containers like sheets of specialized optic glass.
- **Base Layer:** `surface` (#0b1326) – The infinite void of the map or background.
- **Sectional Layer:** `surface_container_low` (#131b2e) – Used for large logical groupings.
- **Interactive Layer:** `surface_container_high` (#222a3d) – For cards and active tactical modules.
- **Peak Layer:** `surface_bright` (#31394d) – For ephemeral elements like tooltips or active pop-overs.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are prohibited for sectioning. Boundaries must be defined solely through background color shifts. A `surface_container_low` card sitting on a `surface` background creates a sophisticated, "borderless" edge that feels integrated, not boxed in.

### The "Glass & Gradient" Rule
To achieve the "Tactical Feel," floating panels must use **Glassmorphism**.
- **Recipe:** Apply `surface_container_highest` at 60% opacity with a `24px` backdrop blur.
- **Signature Texture:** Use a subtle linear gradient on primary CTAs transitioning from `primary` (#ffb690) to `primary_container` (#f97316). This adds a "glow" that mimics the light of a fire without losing professional utility.

---

## 3. Typography: Editorial Authority
We use a dual-typeface system to balance technical data with command-level readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric, modern structure. Use `display-lg` for critical status alerts and `headline-md` for tactical section headers. The wide apertures of Manrope convey a sense of "Open Intelligence."
*   **Body & Labels (Inter):** The industry standard for high-density data. Use `body-md` for simulation logs and `label-sm` for map coordinates. Inter provides the "Technical Rigor" required for rapid information processing.

**Hierarchy Tip:** Use `title-lg` in `primary` (#ffb690) to draw immediate attention to critical simulation metrics, contrasting against `on_surface_variant` for secondary metadata.

---

## 4. Elevation & Depth: Tonal Stacking
Shadows in this system are not "black drops." They are atmospheric occlusions.

*   **The Layering Principle:** Stacking `surface_container_lowest` objects on a `surface_container_low` base creates a "soft lift."
*   **Ambient Shadows:** When an element must float (e.g., a modal), use a diffused shadow: `blur: 40px`, `spread: -5px`, `color: #000000` at 12% opacity.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke, use `outline_variant` at 15% opacity. This creates a "shimmer" effect rather than a hard cage.
*   **Tactical Glow:** Active states should use a soft outer glow of the `primary` color (4px blur, 10% opacity) to simulate a backlit control panel.

---

## 5. Component Strategy

### Buttons & Interaction
*   **Primary Action:** A solid `primary_container` (#f97316) fill with `on_primary_container` text. Apply a 2px "inner glow" using a lighter orange to give it a tactile, physical button feel.
*   **Secondary/Tactical:** A glass-based button using `surface_container_highest` at 40% opacity with a `Ghost Border`.

### Input Fields & Data Entry
*   **Text Inputs:** Forgo the 4-sided box. Use a `surface_container_lowest` background with a 2px bottom-accent in `outline`. When focused, the bottom accent transitions to `secondary` (Emergency Blue).

### Cards & Information Modules
*   **Constraint:** **Forbid dividers.** Use `1.5rem` (24px) of vertical white space to separate content.
*   **Visual Soul:** Incorporate a 4px vertical "Status Stripe" on the left edge of cards (e.g., `error` for high-intensity fire zones, `secondary` for containment lines).

### Custom Simulation Components
*   **The HUD Compass:** A semi-transparent circular overlay using `label-sm` for degree markings, utilizing `backdrop-blur`.
*   **The Fire Intensity Gauge:** A gradient-fill bar transitioning from `secondary` (Blue/Water) to `primary` (Orange/Heat) to `tertiary_container` (Deep Red/Danger).

---

## 6. Do’s and Don’ts

### Do:
*   **Use Intentional Asymmetry:** Align primary simulation data to the left, but allow auxiliary "Intelligence" panels to float on the right with varying heights.
*   **Embrace the Dark:** Keep 90% of the UI in the `surface` and `surface_container` range. Let the `primary` orange act as a true "warning" light.
*   **Use Motion for Hierarchy:** Elements should fade in with a slight "lift" (y-axis shift) to reinforce the layering logic.

### Don't:
*   **Don't use 100% white text:** Use `on_surface` (#dae2fd) to reduce eye strain in dark environments.
*   **Don't use rounded corners everywhere:** Stick to the `md` (0.375rem) or `sm` (0.125rem) for a more "military-spec" and "technical" appearance. Only use `full` for status chips.
*   **Don't clutter the map:** Ensure all UI panels have a 60-80% transparency so the simulation remains the hero of the experience.
