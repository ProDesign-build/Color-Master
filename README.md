# Colour Master: Artisan Pigment Tool

**Colour Master** is a professional Progressive Web App (PWA) designed for leather artisans, painters, and dye masters. It streamlines the process of digitizing real-world colors, formulating mixing recipes, and visualizing finishes on textured surfaces.

Built with a focus on offline capability, data persistence, and precise color manipulation.

---

## 🌟 Core Features

### 1. Color Studio & Visualization (`Preview` Tab)
The central hub for defining and visualizing colors.
* **Advanced Color Wheel:** A custom-built HSB (Hue, Saturation, Brightness) selector optimized for touch. Includes specific sliders for RGB channels and direct Hex input.
* **Material Simulation:** Visualizes the selected color on a leather texture using CSS `mix-blend-mode: multiply` to accurately simulate how dye penetrates grain rather than just sitting on top.
* **Custom Textures:** Users can upload photos of their own raw materials (leather, canvas, wood) to see how the color interacts with specific grain patterns.
* **Duplicate Detection:** Before saving, the app checks the local database for existing colors with identical Hex codes or names, preventing library clutter.

### 2. Live Color Sampler (`Scan` Tab)
A powerful tool to digitize colors from the physical world.
* **Camera Integration:** Accesses the device's environment-facing camera with high-resolution constraints.
* **White Balance Calibration:** A critical feature for color accuracy. Users can tap a white reference object (like a sheet of paper) in the frame to neutralize lighting conditions before sampling.
* **Touch Loupe:** Touching the screen creates a magnified "loupe" reticle, allowing for pixel-perfect inspection and sampling.
* **Image Upload:** Supports analyzing existing photos from the device gallery.

### 3. Mixing Calculator (`Mix` Tab)
A laboratory tool for calculating precise pigment ratios.
* **Two Mixing Modes:** * *Percentage Mode:* Validates that ingredients sum to exactly 100%.
    * *Parts Mode:* Perfect for relative ratios (e.g., "3 parts Red, 1 part Blue").
* **Batch Sizing:** Automatically calculates the exact volume (ml) or weight needed for every ingredient based on a target total batch size.
* **Dynamic Recipe Building:** Add, remove, and rename pigments on the fly.
* **Auto-Save:** Formulas are validated and saved to the local database with auto-backup support.

### 4. Digital Library (`Library` Tab)
A persistent database powered by **IndexedDB** (via Dexie.js).
* **Swatch Management:** View, rename, or delete saved colors.
* **Swatch Cards:** Generates a downloadable `.png` "Swatch Card" on the fly via HTML5 Canvas, including visual samples and technical color values (Hex, RGB, HSL).
* **Formula Management:** View saved mixing recipes with expandable ingredient lists.
* **Smart Search:** Filter swatches by name or hex code; filter formulas by name.

---

## 🛠 Technical Stack

* **Framework:** Next.js / React
* **Database:** IndexedDB (Dexie.js)
* **Styling:** Tailwind CSS
* **PWA:** Offline-first architecture

---

## 🚀 Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up environment:**
    Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key.
3.  **Run the app:**
    ```bash
    npm run dev
    ```

---

## 📱 PWA Installation
For the best experience on mobile:
* **iOS:** Open in Safari > Share > **Add to Home Screen**.
* **Android:** Tap the three dots > **Install App**.
