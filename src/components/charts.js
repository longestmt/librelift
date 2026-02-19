/**
 * charts.js — Lightweight Canvas line chart
 */

export function createLineChart(data, { width = 300, height = 150, label = 'Weight' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // retina
    canvas.height = height * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    if (!data || data.length < 2) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough data yet', width / 2, height / 2);
        return canvas;
    }

    const padding = { top: 20, right: 15, bottom: 30, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1 || 1;

    const xScale = (i) => padding.left + (i / (data.length - 1)) * chartW;
    const yScale = (v) => padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue('--accent').trim() || '#d4ccb4';
    const borderColor = styles.getPropertyValue('--border').trim() || '#2a2e34';
    const textColor = styles.getPropertyValue('--text-muted').trim() || '#8b919a';

    // Grid lines
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        const val = maxVal - ((maxVal - minVal) / gridLines) * i;
        ctx.fillText(Math.round(val), padding.left - 6, y + 3);
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, accentColor + '30');
    gradient.addColorStop(1, accentColor + '00');

    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(values[0]));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(i), yScale(values[i]));
    }
    ctx.lineTo(xScale(data.length - 1), padding.top + chartH);
    ctx.lineTo(xScale(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(values[0]));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(i), yScale(values[i]));
    }
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Dots
    for (let i = 0; i < data.length; i++) {
        ctx.beginPath();
        ctx.arc(xScale(i), yScale(values[i]), 3, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
    }

    // X-axis labels (show first, middle, last)
    ctx.fillStyle = textColor;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];
    for (const i of new Set(labelIndices)) {
        if (data[i].label) {
            ctx.fillText(data[i].label, xScale(i), padding.top + chartH + 16);
        }
    }

    return canvas;
}
