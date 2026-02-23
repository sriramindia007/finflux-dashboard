import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import React from 'react';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// ─── saveFile ────────────────────────────────────────────────────────────────
export function saveFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// ─── sliceCanvas ─────────────────────────────────────────────────────────────
// Slices a tall canvas into page-height chunks at natural seam boundaries.
export function sliceCanvas(
    canvas: HTMLCanvasElement,
    targetHeight = 810
): { data: string; w: number; h: number }[] {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const slices: { data: string; w: number; h: number }[] = [];
    if (!ctx) return slices;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const isRowSolid = (y: number) => {
        const start = y * canvas.width * 4;
        const r = data[start], g = data[start + 1], b = data[start + 2];
        for (let x = 10; x < canvas.width; x += 10) {
            const idx = start + x * 4;
            if (
                Math.abs(data[idx] - r) > 3 ||
                Math.abs(data[idx + 1] - g) > 3 ||
                Math.abs(data[idx + 2] - b) > 3
            ) return false;
        }
        return true;
    };

    let startY = 0;
    while (startY < canvas.height) {
        let h = Math.min(targetHeight, canvas.height - startY);
        let endY = startY + h;

        if (endY < canvas.height) {
            const limitUp = Math.max(startY + 50, endY - targetHeight * 0.4);
            let found = false;
            for (let y = endY; y >= limitUp; y--) {
                if (isRowSolid(y)) { endY = y; h = endY - startY; found = true; break; }
            }
            if (!found) {
                const limitDown = Math.min(canvas.height, endY + targetHeight * 0.4);
                for (let y = endY; y <= limitDown; y++) {
                    if (isRowSolid(y)) { endY = y; h = endY - startY; break; }
                }
            }
        }

        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = h;
        const tCtx = tmp.getContext('2d');
        if (tCtx) {
            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, tmp.width, h);
            tCtx.drawImage(canvas, 0, startY, canvas.width, h, 0, 0, tmp.width, h);
            slices.push({ data: tmp.toDataURL('image/jpeg', 0.85), w: tmp.width, h });
        }
        startY = endY;
    }
    return slices;
}

// ─── captureNode ─────────────────────────────────────────────────────────────
// Captures the FULL content of a DOM node — including content hidden by
// overflow:hidden / overflow:auto / fixed height constraints.
// We temporarily lift all those constraints, capture, then restore.
export async function captureNode(node: HTMLElement): Promise<HTMLCanvasElement> {
    const h2cModule = await import('html2canvas');
    const h2c = h2cModule.default || (h2cModule as any).html2canvas || (h2cModule as any);

    type Saved = {
        el: HTMLElement;
        width: string; minWidth: string;
        height: string; maxHeight: string; minHeight: string;
        overflow: string; overflowX: string; overflowY: string;
    };
    const saved: Saved[] = [];

    // Walk node + all descendants, override any overflow / height clipping
    const allEls = [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))];

    // Also walk up the tree to the body to prevent any ancestor from clipping the 1440px width
    let currentAncestor = node.parentElement;
    while (currentAncestor) {
        allEls.push(currentAncestor);
        currentAncestor = currentAncestor.parentElement;
    }

    for (const el of allEls) {
        const cs = window.getComputedStyle(el);
        const hasClip =
            cs.overflow === 'hidden' || cs.overflow === 'auto' || cs.overflow === 'scroll' ||
            cs.overflowY === 'hidden' || cs.overflowY === 'auto' || cs.overflowY === 'scroll' ||
            cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll';
        const hasFixedH = cs.height !== 'auto' && cs.height !== '' && cs.height !== '0px';

        if (hasClip || el === node || hasFixedH) {
            saved.push({
                el,
                width: el.style.width,
                minWidth: el.style.minWidth,
                height: el.style.height,
                maxHeight: el.style.maxHeight,
                minHeight: el.style.minHeight,
                overflow: el.style.overflow,
                overflowX: el.style.overflowX,
                overflowY: el.style.overflowY,
            });
            el.style.overflow = 'visible';
            el.style.overflowX = 'visible';
            el.style.overflowY = 'visible';
            if (el === node) {
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
                el.style.minHeight = '0';
            } else if (hasFixedH) {
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
            }
        }
    }

    // Wait for the browser to reflow after style changes
    await new Promise(r => setTimeout(r, 150));

    const canvas = await h2c(node, {
        scale: 1.5, // lowered from 2 to reduce memory footprint and file size
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
    });

    // Restore all overridden styles
    for (const s of saved) {
        s.el.style.width = s.width;
        s.el.style.minWidth = s.minWidth;
        s.el.style.height = s.height;
        s.el.style.maxHeight = s.maxHeight;
        s.el.style.minHeight = s.minHeight;
        s.el.style.overflow = s.overflow;
        s.el.style.overflowX = s.overflowX;
        s.el.style.overflowY = s.overflowY;
    }

    return canvas;
}

// ─── exportToPDF ─────────────────────────────────────────────────────────────
// Renders ref(s) to A4-landscape PDF. Splits tall content into multiple pages.
const PDF_W = 297; // mm — A4 landscape width
const PDF_H = 210; // mm — A4 landscape height

export async function exportToPDF(
    refs: React.RefObject<HTMLElement>[],
    filename: string
) {
    const jspdfModule = await import('jspdf');
    const JsPDF = jspdfModule.jsPDF || jspdfModule.default || (jspdfModule as any);
    let pdf: InstanceType<typeof JsPDF> | null = null;

    for (const ref of refs) {
        if (!ref.current) continue;
        const canvas = await captureNode(ref.current);

        const pageHeightPx = Math.round(canvas.width * (PDF_H / PDF_W));
        const slices =
            canvas.height <= pageHeightPx
                ? [{ data: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height }]
                : sliceCanvas(canvas, pageHeightPx);

        for (const slice of slices) {
            const imgH = Math.min((slice.h / slice.w) * PDF_W, PDF_H);
            if (!pdf) {
                pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            } else {
                pdf.addPage('a4', 'landscape');
            }
            pdf.addImage(slice.data, 'JPEG', 0, 0, PDF_W, imgH, undefined, 'FAST');
        }
    }

    if (!pdf) return;

    // jsPDF: use pdf.save() for a proper named download with correct .pdf extension.
    // Avoids UUID-named files from the arraybuffer+blob approach.
    pdf.save(filename);
}

// ─── exportToPPT ─────────────────────────────────────────────────────────────
// Renders ref(s) to 16:9 PPTX, one slide per page-height slice.
export async function exportToPPT(
    refs: React.RefObject<HTMLElement>[],
    filename: string
) {
    const pptxgenModule = await import('pptxgenjs');
    const PptxGenJS = pptxgenModule.default || pptxgenModule;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    for (const ref of refs) {
        if (!ref.current) continue;
        const canvas = await captureNode(ref.current);

        const slideHeightPx = Math.round(canvas.width * (9 / 16));
        const slices =
            canvas.height <= slideHeightPx * 1.15
                ? [{ data: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height }]
                : sliceCanvas(canvas, slideHeightPx);

        for (const slice of slices) {
            const slide = pptx.addSlide();
            // Use numeric inch values scaled proportionally so they do not stretch
            const inchH = Math.min((slice.h / slice.w) * 10, 5.625);
            slide.addImage({
                data: slice.data,
                x: 0, y: 0,
                w: 10, h: inchH,
            });
        }
    }

    // pptxgenjs: writeFile() triggers a proper named download with the correct
    // .pptx extension — avoids UUID-named files caused by write()+blob approach.
    // Strip .pptx extension from filename if present (writeFile adds it automatically)
    const baseName = filename.replace(/\.pptx$/i, '');
    await pptx.writeFile({ fileName: baseName });
}
