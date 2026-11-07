// YDSE Bichromatic Interference Simulator

const state = {
    lambda1: 650,      // nm
    lambda2: 500,      // nm
    d: 0.50,           // slit separation in mm
    D: 1.00,           // screen distance in m
    mode: 'bichromatic', // 'bichromatic' | 'separate'
    hoverY: 0.0,       // inspected position in mm (-10 to +10)
    yMax: 10.0         // half screen span in mm
};

// DOM References
const fringeCanvas = document.getElementById('fringeCanvas');
const plotCanvas = document.getElementById('plotCanvas');
const fCtx = fringeCanvas.getContext('2d');
const pCtx = plotCanvas.getContext('2d');

const sliderW1 = document.getElementById('sliderW1');
const sliderW2 = document.getElementById('sliderW2');
const sliderD = document.getElementById('sliderD');
const sliderScreen = document.getElementById('sliderScreen');

const badgeW1 = document.getElementById('badgeW1');
const badgeW2 = document.getElementById('badgeW2');
const badgeD = document.getElementById('badgeD');
const badgeScreen = document.getElementById('badgeScreen');

const valBeta1 = document.getElementById('valBeta1');
const valBeta2 = document.getElementById('valBeta2');
const subFreq1 = document.getElementById('subFreq1');
const subFreq2 = document.getElementById('subFreq2');
const valCoincide = document.getElementById('valCoincide');
const subRatio = document.getElementById('subRatio');
const valState = document.getElementById('valState');
const subFormula = document.getElementById('subFormula');

const legDot1 = document.getElementById('legDot1');
const legDot2 = document.getElementById('legDot2');

const inspY = document.getElementById('inspY');
const inspDx = document.getElementById('inspDx');
const inspI12 = document.getElementById('inspI12');
const inspItot = document.getElementById('inspItot');
const theoryText = document.getElementById('theoryText');

// Convert visible wavelength (380nm - 750nm) to approximate RGB [0-255]
function wavelengthToRGB(wavelength) {
    let R = 0, G = 0, B = 0, factor = 1;
    if (wavelength >= 380 && wavelength < 440) {
        R = -(wavelength - 440) / (440 - 380);
        G = 0.0;
        B = 1.0;
    } else if (wavelength >= 440 && wavelength < 490) {
        R = 0.0;
        G = (wavelength - 440) / (490 - 440);
        B = 1.0;
    } else if (wavelength >= 490 && wavelength < 510) {
        R = 0.0;
        G = 1.0;
        B = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
        R = (wavelength - 510) / (580 - 510);
        G = 1.0;
        B = 0.0;
    } else if (wavelength >= 580 && wavelength < 645) {
        R = 1.0;
        G = -(wavelength - 645) / (645 - 580);
        B = 0.0;
    } else if (wavelength >= 645 && wavelength <= 750) {
        R = 1.0;
        G = 0.0;
        B = 0.0;
    }

    if (wavelength >= 380 && wavelength < 420) {
        factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    } else if (wavelength >= 420 && wavelength <= 660) {
        factor = 1.0;
    } else if (wavelength > 660 && wavelength <= 750) {
        factor = 0.3 + 0.7 * (750 - wavelength) / (750 - 660);
    }

    const gamma = 0.85;
    return [
        Math.round(255 * Math.pow(R * factor, gamma)),
        Math.round(255 * Math.pow(G * factor, gamma)),
        Math.round(255 * Math.pow(B * factor, gamma))
    ];
}

function rgbString(rgb, alpha = 1) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

//Greatest Common Divisor for finding integer ratio n1*lambda1 = n2*lambda2
function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
        let t = b;
        b = a % b;
        a = t;
    }
    return a;
}

// Compute Fringe Width in mm: beta = (lambda * D) / d
// lambda in nm (1e-6 mm), D in m (1e3 mm), d in mm => beta (mm) = (lambda * D * 1e-3) / d
function getBeta(lambdaNm) {
    return (lambdaNm * state.D * 0.001) / state.d;
}

// Compute normalized intensity (in units of I0, where max single wavelength = 4 I0)
function getIntensitiesAt(yMm) {
    if (state.mode === 'separate') {
        return { I1: 1.0, I2: 1.0, Itotal: 2.0 };
    }
    const beta1 = getBeta(state.lambda1);
    const beta2 = getBeta(state.lambda2);
    const c1 = Math.cos((Math.PI * yMm) / beta1);
    const c2 = Math.cos((Math.PI * yMm) / beta2);
    const I1 = 4.0 * c1 * c1;
    const I2 = 4.0 * c2 * c2;
    return { I1, I2, Itotal: I1 + I2 };
}

function findCoincidingPositions() {
    if (state.mode === 'separate') return { firstY: null, n1: 0, n2: 0, list: [] };
    // Since slider steps by 5nm, compute integer ratio
    const g = gcd(state.lambda1, state.lambda2);
    const n1 = state.lambda2 / g;
    const n2 = state.lambda1 / g;
    const beta1 = getBeta(state.lambda1);
    const firstY = n1 * beta1;
    const list = [];
    if (firstY > 0.05) {
        for (let k = -20; k <= 20; k++) {
            const pos = k * firstY;
            if (Math.abs(pos) <= state.yMax) {
                list.push({ y: pos, k });
            }
        }
    }
    return { firstY, n1, n2, list };
}

function updateUI() {
    const rgb1 = wavelengthToRGB(state.lambda1);
    const rgb2 = wavelengthToRGB(state.lambda2);

    badgeW1.textContent = `${state.lambda1} nm`;
    badgeW1.style.backgroundColor = rgbString(rgb1);
    badgeW2.textContent = `${state.lambda2} nm`;
    badgeW2.style.backgroundColor = rgbString(rgb2);
    badgeD.textContent = `${state.d.toFixed(2)} mm`;
    badgeScreen.textContent = `${state.D.toFixed(2)} m`;

    legDot1.style.backgroundColor = rgbString(rgb1);
    legDot2.style.backgroundColor = rgbString(rgb2);

    const beta1 = getBeta(state.lambda1);
    const beta2 = getBeta(state.lambda2);
    const f1 = (299792.458 / state.lambda1).toFixed(1);
    const f2 = (299792.458 / state.lambda2).toFixed(1);

    valBeta1.textContent = state.mode === 'bichromatic' ? `${beta1.toFixed(2)} mm` : 'None (Uniform)';
    valBeta2.textContent = state.mode === 'bichromatic' ? `${beta2.toFixed(2)} mm` : 'None (Uniform)';
    subFreq1.textContent = `f₁ = ${f1} THz`;
    subFreq2.textContent = `f₂ = ${f2} THz`;

    const coin = findCoincidingPositions();
    if (state.mode === 'separate') {
        valCoincide.textContent = 'No Fringes';
        subRatio.textContent = 'Time-averaged <cos(Δωt)> = 0';
        valState.textContent = 'Uniform Illumination';
        valState.style.color = '#fbbf24';
        subFormula.innerHTML = 'I<sub>avg</sub> = I<sub>1</sub> + I<sub>2</sub> = 2 I<sub>0</sub>';
        theoryText.textContent = 'Slit 1 passes only f₁ and Slit 2 passes only f₂. The interference term oscillates at beat frequency |f₁ - f₂| (~THz), averaging to zero over detector response time. You see a flat, uniform mixed color.';
    } else {
        valCoincide.innerHTML = `&pm; ${coin.firstY.toFixed(2)} mm`;
        subRatio.innerHTML = `n<sub>1</sub>:n<sub>2</sub> = ${coin.n1}:${coin.n2}`;
        valState.textContent = 'Stationary Fringes';
        valState.style.color = '#38bdf8';
        subFormula.innerHTML = 'I(y) = 4I<sub>01</sub>cos²(&pi;y/&beta;<sub>1</sub>) + 4I<sub>02</sub>cos²(&pi;y/&beta;<sub>2</sub>)';
        theoryText.textContent = 'Both slits receive both frequencies (f₁ and f₂). Each wavelength interferes strictly with itself, creating two superimposed cosine-squared fringe patterns with central maxima aligned at y = 0.';
    }

    updateInspector();
    renderCanvases();
}

function updateInspector() {
    const y = state.hoverY;
    // Path difference dx = y * d / D (in micrometers: y(mm) * d(mm) / D(m) = um)
    const dxUm = (y * state.d) / state.D;
    const { I1, I2, Itotal } = getIntensitiesAt(y);

    inspY.textContent = `${y >= 0 ? '+' : ''}${y.toFixed(2)} mm`;
    inspDx.textContent = `${dxUm >= 0 ? '+' : ''}${dxUm.toFixed(2)} μm`;
    inspI12.innerHTML = `${I1.toFixed(2)} I<sub>0</sub> / ${I2.toFixed(2)} I<sub>0</sub>`;
    inspItot.innerHTML = `${Itotal.toFixed(2)} I<sub>0</sub>`;
}

function resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
    }
    return { width: canvas.width, height: canvas.height, dpr };
}

function renderCanvases() {
    renderFringePattern();
    renderIntensityPlot();
}

function renderFringePattern() {
    const { width, height, dpr } = resizeCanvas(fringeCanvas);
    fCtx.clearRect(0, 0, width, height);

    const rgb1 = wavelengthToRGB(state.lambda1);
    const rgb2 = wavelengthToRGB(state.lambda2);

    // Draw vertical color bars across width
    const imgData = fCtx.createImageData(width, height);
    const data = imgData.data;

    for (let x = 0; x < width; x++) {
        const yMm = ((x / (width - 1)) * 2 - 1) * state.yMax;
        const { I1, I2 } = getIntensitiesAt(yMm);

        // Normalize intensity contribution (max individual is 4.0 in bichromatic)
        const norm1 = state.mode === 'bichromatic' ? I1 / 4.0 : 0.45;
        const norm2 = state.mode === 'bichromatic' ? I2 / 4.0 : 0.45;

        const r = Math.min(255, Math.round(rgb1[0] * norm1 + rgb2[0] * norm2));
        const g = Math.min(255, Math.round(rgb1[1] * norm1 + rgb2[1] * norm2));
        const b = Math.min(255, Math.round(rgb1[2] * norm1 + rgb2[2] * norm2));

        for (let py = 0; py < height; py++) {
            const idx = (py * width + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }
    fCtx.putImageData(imgData, 0, 0);

    // Draw scale ticks and hover marker
    fCtx.save();
    fCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    fCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    fCtx.font = `${11 * dpr}px sans-serif`;
    fCtx.textAlign = 'center';

    for (let m = -10; m <= 10; m += 2) {
        const x = ((m + state.yMax) / (2 * state.yMax)) * width;
        fCtx.beginPath();
        fCtx.moveTo(x, height - 12 * dpr);
        fCtx.lineTo(x, height);
        fCtx.stroke();
        if (m % 5 === 0) {
            fCtx.fillText(`${m}mm`, x, height - 15 * dpr);
        }
    }

    // Hover cursor line
    const hoverX = ((state.hoverY + state.yMax) / (2 * state.yMax)) * width;
    fCtx.strokeStyle = '#ffffff';
    fCtx.lineWidth = 2 * dpr;
    fCtx.beginPath();
    fCtx.moveTo(hoverX, 0);
    fCtx.lineTo(hoverX, height);
    fCtx.stroke();
    fCtx.restore();
}

function renderIntensityPlot() {
    const { width, height, dpr } = resizeCanvas(plotCanvas);
    pCtx.clearRect(0, 0, width, height);

    const padLeft = 36 * dpr;
    const padRight = 16 * dpr;
    const padTop = 20 * dpr;
    const padBottom = 28 * dpr;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const yToX = (yMm) => padLeft + ((yMm + state.yMax) / (2 * state.yMax)) * plotW;
    const iToY = (intensity) => padTop + plotH - (intensity / 8.5) * plotH;

    // Grid lines
    pCtx.save();
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    pCtx.fillStyle = '#94a3b8';
    pCtx.font = `${10 * dpr}px sans-serif`;
    pCtx.lineWidth = 1 * dpr;

    const iLevels = [0, 2, 4, 6, 8];
    iLevels.forEach(lvl => {
        const py = iToY(lvl);
        pCtx.beginPath();
        pCtx.moveTo(padLeft, py);
        pCtx.lineTo(width - padRight, py);
        pCtx.stroke();
        pCtx.textAlign = 'right';
        pCtx.fillText(`${lvl}I₀`, padLeft - 6 * dpr, py + 3 * dpr);
    });

    for (let m = -10; m <= 10; m += 2) {
        const px = yToX(m);
        pCtx.beginPath();
        pCtx.moveTo(px, padTop);
        pCtx.lineTo(px, padTop + plotH);
        pCtx.stroke();
        pCtx.textAlign = 'center';
        pCtx.fillText(`${m}`, px, height - 8 * dpr);
    }

    const rgb1 = wavelengthToRGB(state.lambda1);
    const rgb2 = wavelengthToRGB(state.lambda2);

    // Draw Curve 1 (dashed)
    pCtx.strokeStyle = rgbString(rgb1, 0.85);
    pCtx.lineWidth = 1.8 * dpr;
    pCtx.setLineDash([5 * dpr, 4 * dpr]);
    pCtx.beginPath();
    for (let i = 0; i <= plotW; i += 2) {
        const yMm = ((i / plotW) * 2 - 1) * state.yMax;
        const { I1 } = getIntensitiesAt(yMm);
        const px = padLeft + i;
        const py = iToY(I1);
        if (i === 0) pCtx.moveTo(px, py);
        else pCtx.lineTo(px, py);
    }
    pCtx.stroke();

    // Draw Curve 2 (dashed)
    pCtx.strokeStyle = rgbString(rgb2, 0.85);
    pCtx.beginPath();
    for (let i = 0; i <= plotW; i += 2) {
        const yMm = ((i / plotW) * 2 - 1) * state.yMax;
        const { I2 } = getIntensitiesAt(yMm);
        const px = padLeft + i;
        const py = iToY(I2);
        if (i === 0) pCtx.moveTo(px, py);
        else pCtx.lineTo(px, py);
    }
    pCtx.stroke();

    // Draw Total Intensity Curve (solid)
    pCtx.setLineDash([]);
    pCtx.strokeStyle = '#ffffff';
    pCtx.lineWidth = 2.4 * dpr;
    pCtx.beginPath();
    for (let i = 0; i <= plotW; i++) {
        const yMm = ((i / plotW) * 2 - 1) * state.yMax;
        const { Itotal } = getIntensitiesAt(yMm);
        const px = padLeft + i;
        const py = iToY(Itotal);
        if (i === 0) pCtx.moveTo(px, py);
        else pCtx.lineTo(px, py);
    }
    pCtx.stroke();

    // Coinciding Maxima Markers
    const coin = findCoincidingPositions();
    coin.list.forEach(item => {
        const cx = yToX(item.y);
        const cy = iToY(8.0);
        pCtx.fillStyle = item.k === 0 ? '#38bdf8' : '#fbbf24';
        pCtx.beginPath();
        pCtx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
        pCtx.fill();
    });

    // Hover Vertical Indicator
    const hx = yToX(state.hoverY);
    const { Itotal } = getIntensitiesAt(state.hoverY);
    const hy = iToY(Itotal);

    pCtx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    pCtx.lineWidth = 1.5 * dpr;
    pCtx.beginPath();
    pCtx.moveTo(hx, padTop);
    pCtx.lineTo(hx, padTop + plotH);
    pCtx.stroke();

    pCtx.fillStyle = '#ffffff';
    pCtx.strokeStyle = '#38bdf8';
    pCtx.lineWidth = 2.5 * dpr;
    pCtx.beginPath();
    pCtx.arc(hx, hy, 5 * dpr, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.stroke();

    pCtx.restore();
}

// Pointer / Touch Inspection Handlers
function handlePointer(e, canvas, isPlot = false) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let normX;

    if (isPlot) {
        const padLeft = 36;
        const padRight = 16;
        const plotW = rect.width - padLeft - padRight;
        normX = (clientX - rect.left - padLeft) / plotW;
    } else {
        normX = (clientX - rect.left) / rect.width;
    }

    normX = Math.max(0, Math.min(1, normX));
    state.hoverY = (normX * 2 - 1) * state.yMax;
    updateInspector();
    renderCanvases();
}

['mousemove', 'touchstart', 'touchmove'].forEach(evt => {
    fringeCanvas.addEventListener(evt, (e) => {
        if (e.cancelable && evt.startsWith('touch')) e.preventDefault();
        handlePointer(e, fringeCanvas, false);
    }, { passive: false });

    plotCanvas.addEventListener(evt, (e) => {
        if (e.cancelable && evt.startsWith('touch')) e.preventDefault();
        handlePointer(e, plotCanvas, true);
    }, { passive: false });
});

// Controls Listeners
sliderW1.addEventListener('input', (e) => {
    state.lambda1 = parseFloat(e.target.value);
    updateUI();
});

sliderW2.addEventListener('input', (e) => {
    state.lambda2 = parseFloat(e.target.value);
    updateUI();
});

sliderD.addEventListener('input', (e) => {
    state.d = parseFloat(e.target.value);
    updateUI();
});

sliderScreen.addEventListener('input', (e) => {
    state.D = parseFloat(e.target.value);
    updateUI();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        updateUI();
    });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.lambda1 = parseFloat(btn.dataset.w1);
        state.lambda2 = parseFloat(btn.dataset.w2);
        sliderW1.value = state.lambda1;
        sliderW2.value = state.lambda2;
        updateUI();
    });
});

window.addEventListener('resize', () => {
    renderCanvases();
});

// Initial Render
updateUI();
