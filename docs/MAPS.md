# Maps

Drop a PNG, JPG, WebP, GIF, or SVG image into `Library/Assets/` or another vault folder. Open a world or location note and run **Open map**, or use **Open map** on its Look up card or Home world entry. Choose **Choose map image** to attach an image to that note. The image is linked in the note's `map` field.

Use the mouse wheel or **Zoom in** and **Zoom out** to change scale; in a map embedded in a note, hold Ctrl (Cmd on macOS) while scrolling so the note still scrolls normally. Drag to pan, double click to zoom, and use **Fit** to show the whole image. Pins open their note cards. **Open map** on a pinned location's card opens its own map; the breadcrumb above the image returns to parent maps. **Show on map** on a Look up card finds a map that pins that note.

Click an empty spot to choose **Attach note** for an existing note or **New location here** to create and pin a location; nothing is written until you choose. Click elsewhere or press Escape to close the menu. Drag a pin to move it. To remove a pin, use **Remove pin** on its card or right-click the pin. A pin whose note no longer exists opens the same menu when clicked. Pins are stored on the map owner's note as image fractions, so they stay in place when the image is resized. The full map opens in a main tab.

To embed a map in a note, use a fenced `gmvault-map` code block. It shows the map of the note containing the block. To show another note's map, put `note: [[Worlds/Example/World]]` inside the block. The inline map also offers **Open map** for the full view.
