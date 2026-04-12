import L from 'leaflet';
import { getBounds } from '../utils/geo';

export default class ElevationCanvasLayer extends L.CanvasLayer {
    constructor(elevationGridRef, bounds, gridSize) {
        super();
        this.elevationGridRef = elevationGridRef;
        this.bounds = bounds;
        this.gridSize = gridSize;
        this.generateElevationGrid();
    }

    generateElevationGrid() {
        const grid = Array(this.gridSize).fill(0).map(() => Array(this.gridSize).fill(0));
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                const baseAltitude = 200 + Math.sin(i / 20) * 200 + Math.cos(j / 15) * 150;
                const noise = Math.sin(42 + i * 73.156 + j * 191.999) * 50;
                grid[i][j] = Math.max(200, Math.min(950, baseAltitude + noise));
            }
        }
        this.elevationGridRef.current = grid;
    }

    normalizeAltitude(altitude) {
        return (altitude - 200) / (950 - 200);
    }

    getElevationColor(normalizedValue) {
        if (normalizedValue < 0.2) return '#0066cc';
        if (normalizedValue < 0.35) return '#00aaff';
        if (normalizedValue < 0.5) return '#00dd00';
        if (normalizedValue < 0.7) return '#ffdd00';
        return '#ff8800';
    }

    drawLayer() {
        const ctx = this.canvas.getContext('2d');
        const map = this._map;
        if (!map || !this.elevationGridRef.current) return;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 0.4;
        const grid = this.elevationGridRef.current;
        const bounds = L.latLngBounds(this.bounds);
        const nw = map.latLngToContainerPoint(bounds.getNorthWest());
        const se = map.latLngToContainerPoint(bounds.getSouthEast());
        const cellSize = Math.max(1, (se.x - nw.x) / this.gridSize);
        const startLat = bounds.getNorth();
        const startLng = bounds.getWest();
        const latStep = (bounds.getSouth() - bounds.getNorth()) / this.gridSize;
        const lngStep = (bounds.getEast() - bounds.getWest()) / this.gridSize;
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                const altitude = grid[i][j];
                const normalized = this.normalizeAltitude(altitude);
                const color = this.getElevationColor(normalized);
                const lat = startLat + i * latStep;
                const lng = startLng + j * lngStep;
                const point = map.latLngToContainerPoint([lat, lng]);
                ctx.fillStyle = color;
                ctx.fillRect(point.x, point.y, cellSize, cellSize);
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(point.x, point.y, cellSize, cellSize);
            }
        }
    }
}