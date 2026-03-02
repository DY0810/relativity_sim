# UX Implementation Plan

## 1. Environment & Config Setup
- **Dependencies:** Install `lucide-react` (already active) and any other icon packs needed. Install `@radix-ui/react-slider` or similar if we want ultra-custom sliders, but custom CSS on native ranges is fine and lighter.
- **Tailwind Config (`tailwind.config.mjs` || `tailwind.config.ts`):**
  - Add custom colors for neon accents (`cyan-neon`, `violet-neon`, `emerald-neon`).
  - Add custom drop shadows (`shadow-neon-cyan`, `shadow-neon-violet`).
  - Extend font-family to include `Inter` (sans) and `JetBrains Mono` or `Fira Code` (mono).
  - Add ultra-blur backdrop utilities.

## 2. Global Styling (`index.css`)
- **Body & Base:** Set a deep slate/obsidian gradient background on `body`.
- **CSS Variables:** Define `--brand-cyan`, `--brand-violet` for easy reuse in Plotly configurations (which don't read Tailwind classes directly).
- **Custom Scrollbar:** Style the webkit scrollbar to be thin, trackless, and have a semi-transparent white thumb to match the glass UI.
- **Range Inputs:** Create a `.glass-slider` utility class that styles `input[type="range"]` with a glowing track and thumb.

## 3. Layout Restructuring (`App.tsx`)
- Turn the main container into a `h-screen w-screen overflow-hidden text-slate-100 flex flex-col`.
- **Header:** Add a sleek top navigation/branding bar: "RELATIVITY | KINEMATIC SIMULATOR".
- **Main Content Area:** A `flex-1 flex overflow-hidden p-6 gap-6` to hold the panels.
- **Panels (`ControlPanel.tsx` & Viewport):** 
  - Wrap both the left controls and the right visualization in `bg-slate-900/40 backdrop-blur-2xl border border-white border-opacity-10 rounded-3xl shadow-2xl overflow-hidden`.
  - This immediately gives the "glassmorphic SaaS" look.

## 4. Component Refinement

### 4.1 Control Panel
- **Headers:** Add glowing gradients to text. e.g., `<h2 className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">`.
- **Buttons (Add Particle, Dimensions):** 
  - Change from flat grey boxes to semi-transparent buttons with sharp 1px borders and hover `bg-white/10` with text-shadow glows.
- **Particle Cards:** 
  - Give each particle card a border matched to its `p.color`, but specifically a `border-opacity-20` and a `bg-gradient-to-br from-[p.color]/5 to-transparent`.
- **Vector Inputs (`VectorInput.tsx`):**
  - Make the math inputs look like terminal inputs: dark background, monospace font, glowing cursor or subtle bottom border focus state.

### 4.2 Time Slider
- Detach it from the layout flow and make it a floating, highly blurred pill at the bottom center of the graphing viewport: `absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[80%] max-w-3xl bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 flex items-center gap-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50`.
- Style the inputs as invisible until hovered/clicked, looking like raw glowing text.

### 4.3 Graphing Viewport & Plotly
- Update the layout config in `SpacetimeGraph.tsx` and `Spacetime3DGraph.tsx`.
- Change `plot_bgcolor` and `paper_bgcolor` to `transparent`.
- Restyle the grid lines to `rgba(255, 255, 255, 0.05)` so they fade cleanly into the dark background.
- Change the axis text to the monospace font, sized cleanly.
- Increase the `line.width` of particle traces to `4` or `5` and use `type: 'scatter'` with glow tricks if possible, or just vibrant colors on the dark background.

## 5. Execution Order
1. Update `index.css` and font imports (Google Fonts: Inter & Space Mono).
2. Refactor `App.tsx` layout and apply the global background.
3. Overhaul `ControlPanel.tsx` and `VectorInput.tsx` typography, borders, and glassmorphic panels.
4. Redesign `TimeSlider.tsx` into the floating glass pill.
5. Apply layout & color updates to Plotly charts to match the new dark glass aesthetic perfectly.

This sequence guarantees no broken renders while completely elevating the product's UX layer.
