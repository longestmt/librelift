/**
 * charts.js — Lightweight, accessible Canvas line chart
 */

export function createLineChart(data, { width = 300, height = 150, label = 'Weight' } = {}) {
    const chartData = Array.isArray(data)
        ? data.filter(point => point && Number.isFinite(point.value))
        : [];

    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // retina
    canvas.height = height * 2;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = '100%';
    canvas.style.display = 'block';
    canvas.setAttribute('role', 'img');

    const accessiblePoints = chartData.map(point =>
        `${point.label || 'Session'}: ${Math.round(point.value * 10) / 10}`
    ).join(', ');
    const accessibleLabel = chartData.length
        ? `${label}. ${accessiblePoints}`
        : `${label}. No data yet.`;
    canvas.setAttribute('aria-label', accessibleLabel);
    canvas.textContent = accessibleLabel;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    if (chartData.length < 2) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            chartData.length === 1
                ? 'One session — log another to see a trend'
                : 'Not enough data yet',
            width / 2,
            height / 2
        );
        return canvas;
    }

    const padding = { top: 28, right: 15, bottom: 30, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = chartData.map(point => point.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1 || 1;

    const xScale = index => padding.left + (index / (chartData.length - 1)) * chartW;
    const yScale = value =>
        padding.top + chartH - ((value - minVal) / (maxVal - minVal)) * chartH;

    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue('--accent').trim() || '#d4ccb4';
    const borderColor = styles.getPropertyValue('--border').trim() || '#2a2e34';
    const textColor = styles.getPropertyValue('--text-muted').trim() || '#8b919a';

    ctx.fillStyle = textColor;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, padding.left, 12);

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
        const value = maxVal - ((maxVal - minVal) / gridLines) * i;
        ctx.fillText(Math.round(value), padding.left - 6, y + 3);
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, accentColor + '30');
    gradient.addColorStop(1, accentColor + '00');

    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(values[0]));
    for (let i = 1; i < chartData.length; i++) {
        ctx.lineTo(xScale(i), yScale(values[i]));
    }
    ctx.lineTo(xScale(chartData.length - 1), padding.top + chartH);
    ctx.lineTo(xScale(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(values[0]));
    for (let i = 1; i < chartData.length; i++) {
        ctx.lineTo(xScale(i), yScale(values[i]));
    }
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Dots
    for (let i = 0; i < chartData.length; i++) {
        ctx.beginPath();
        ctx.arc(xScale(i), yScale(values[i]), 3, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
    }

    // X-axis labels (show first, middle, last)
    ctx.fillStyle = textColor;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelIndices = [0, Math.floor(chartData.length / 2), chartData.length - 1];
    for (const index of new Set(labelIndices)) {
        if (chartData[index].label) {
            ctx.fillText(
                chartData[index].label,
                xScale(index),
                padding.top + chartH + 16
            );
        }
    }

    return canvas;
}
