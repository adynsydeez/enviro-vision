import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

// Mock elevation data generator function
generateElevationGrid(gridSize = 100, seed = 42) {
    const grid = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const baseAltitude = 200 + Math.sin(i / 20) * 200 + Math.cos(j / 15) * 150;
            const noise = Math.sin(seed + i * 73.156 + j * 191.999) * 50;
            grid[i][j] = Math.max(200, Math.min(950, baseAltitude + noise));
        }
    }
    return grid;
}

// Convert altitude (200-950m) to 0-1 normalized value
function normalizeAltitude(altitude) {
    return (altitude - 200) / (950 - 200);
}

// Map normalized altitude to color gradient
function getElevationColor(normalizedValue) {
    if (normalizedValue < 0.2) return "#0066cc";
    if (normalizedValue < 0.35) return "#00aaff";
    if (normalizedValue < 0.5) return "#00dd00";
    if (normalizedValue < 0.7) return "#ffdd00";
    return "#ff8800";
}

export function ElevationLayer() {
    const map = useMap();
    const canvasRef = useRef(null);
    const elevationGridRef = useRef(null);
    const gridSizeRef = useRef(100);
    const cellSizeRef = useRef(0);

    // Generate elevation data on mount
    useEffect(() => {
        if (!elevationGridRef.current) {
            elevationGridRef.current = generateElevationGrid(gridSizeRef.current);
        }
    }, []);

    // Draw elevation overlay on map
    const drawElevationOverlay = () => {
        if (!map || !elevationGridRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bounds = map.getBounds();
        const northWest = map.latLngToContainerPoint([bounds.getNorth(), bounds.getWest()]);
        const southEast = map.latLngToContainerPoint([bounds.getSouth(), bounds.getEast()]);

        canvas.width = map.getContainer().clientWidth;
        canvas.height = map.getContainer().clientHeight;
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.zIndex = "200";
        canvas.style.pointerEvents = "none";

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.4;

        const grid = elevationGridRef.current;
        const cellSize = Math.max(1, (southEast.x - northWest.x) / gridSizeRef.current);
        cellSizeRef.current = cellSize;
        const startLat = bounds.getNorth();
        const startLng = bounds.getWest();
        const latStep = (bounds.getSouth() - bounds.getNorth()) / gridSizeRef.current;
        const lngStep = (bounds.getEast() - bounds.getWest()) / gridSizeRef.current;

        for (let i = 0; i < gridSizeRef.current; i++) {
            for (let j = 0; j < gridSizeRef.current; j++) {
                const altitude = grid[i][j];
                const normalized = normalizeAltitude(altitude);
                const color = getElevationColor(normalized);
                const lat = startLat + i * latStep;
                const lng = startLng + j * lngStep;
                const point = map.latLngToContainerPoint([lat, lng]);
                ctx.fillStyle = color;
                ctx.fillRect(point.x, point.y, cellSize, cellSize);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
                ctx.lineWidth = 0.5;
                ctx.strokeRect(point.x, point.y, cellSize, cellSize);
            }
        }
    };

    // Redraw on map events (pan, zoom)
    useEffect(() => {
        if (!map) return;
        map.on("moveend", drawElevationOverlay);
        map.on("zoomend", drawElevationOverlay);
        drawElevationOverlay();
        return () => {
            map.off("moveend", drawElevationOverlay);
            map.off("zoomend", drawElevationOverlay);
        };
    }, [map]);

    return <canvas ref={canvasRef} />;
}