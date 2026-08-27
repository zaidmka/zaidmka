window.zaidTools = window.zaidTools || {};
window.zaidTools = {

    copyText: async function (text) {
        if (!text) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            return true;
        }
        catch {
            return false;
        }
    },

    pasteText: async function () {
        try {
            return await navigator.clipboard.readText();
        }
        catch {
            return null;
        }
    },

    downloadText: function (fileName, content, contentType) {

        const blob = new Blob([content], { type: contentType || "text/plain" });

        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;

        document.body.appendChild(anchor);

        anchor.click();

        anchor.remove();

        URL.revokeObjectURL(url);
    }
};


window.zaidTools.getImageDimensions = function (dataUrl) {
    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = function () {
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
                isPortrait: img.naturalHeight > img.naturalWidth
            });
        };

        img.onerror = reject;

        img.src = dataUrl;
    });
};

window.zaidTools.autoCropDocument = async function (dataUrl) {

    const image = await new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = reject;

        img.src = dataUrl;
    });

    const maxAnalysisSize = 900;

    let width = image.naturalWidth;
    let height = image.naturalHeight;

    const scale =
        Math.min(
            1,
            maxAnalysisSize / Math.max(width, height)
        );

    const analysisWidth = Math.round(width * scale);

    const analysisHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");

    canvas.width = analysisWidth;
    canvas.height = analysisHeight;

    const ctx =
        canvas.getContext("2d", {
            willReadFrequently: true
        });

    ctx.drawImage(
        image,
        0,
        0,
        analysisWidth,
        analysisHeight
    );

    const imageData =
        ctx.getImageData(
            0,
            0,
            analysisWidth,
            analysisHeight
        );

    const data =
        imageData.data;


    // Sample the corners to estimate background color.
    const sampleSize = 12;

    const corners = [
        [0, 0],
        [analysisWidth - sampleSize, 0],
        [0, analysisHeight - sampleSize],
        [
            analysisWidth - sampleSize,
            analysisHeight - sampleSize
        ]
    ];


    let backgroundR = 0;
    let backgroundG = 0;
    let backgroundB = 0;
    let samples = 0;


    for (const [startX, startY] of corners) {

        for (let y = startY;
            y < startY + sampleSize;
            y++) {

            for (let x = startX;
                x < startX + sampleSize;
                x++) {

                const index =
                    (y * analysisWidth + x) * 4;

                backgroundR += data[index];
                backgroundG += data[index + 1];
                backgroundB += data[index + 2];

                samples++;
            }
        }
    }


    backgroundR /= samples;
    backgroundG /= samples;
    backgroundB /= samples;


    // Detect pixels sufficiently different from background.
    const threshold = 45;

    let minX = analysisWidth;
    let minY = analysisHeight;

    let maxX = 0;
    let maxY = 0;

    let detectedPixels = 0;


    for (let y = 0;
        y < analysisHeight;
        y++) {

        for (let x = 0;
            x < analysisWidth;
            x++) {

            const index =
                (y * analysisWidth + x) * 4;

            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const difference =
                Math.sqrt(
                    Math.pow(r - backgroundR, 2) +
                    Math.pow(g - backgroundG, 2) +
                    Math.pow(b - backgroundB, 2)
                );

            if (difference > threshold) {

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);

                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);

                detectedPixels++;
            }
        }
    }


    // Couldn't confidently find a document.
    if (detectedPixels <
        analysisWidth * analysisHeight * 0.05) {

        return {
            success: false,
            dataUrl: dataUrl
        };
    }


    const cropX =
        minX / scale;

    const cropY =
        minY / scale;

    const cropWidth =
        (maxX - minX) / scale;

    const cropHeight =
        (maxY - minY) / scale;


    // Small padding around the detected document.
    const padding =
        Math.max(
            cropWidth,
            cropHeight
        ) * 0.015;


    const sourceX =
        Math.max(
            0,
            cropX - padding
        );

    const sourceY =
        Math.max(
            0,
            cropY - padding
        );

    const sourceWidth =
        Math.min(
            width - sourceX,
            cropWidth + padding * 2
        );

    const sourceHeight =
        Math.min(
            height - sourceY,
            cropHeight + padding * 2
        );


    const output =
        document.createElement("canvas");

    output.width =
        Math.round(sourceWidth);

    output.height =
        Math.round(sourceHeight);

    const outputContext =
        output.getContext("2d");


    outputContext.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        output.width,
        output.height
    );


    return {
        success: true,

        dataUrl:
            output.toDataURL(
                "image/jpeg",
                0.95
            ),

        width:
            output.width,

        height:
            output.height
    };
};

window.zaidTools.downloadElementAsPng = async function (elementId, fileName) {
    const element = document.getElementById(elementId);

    if (!element) {
        return false;
    }

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true
    });

    const dataUrl = canvas.toDataURL("image/png");

    const link = document.createElement("a");

    link.href = dataUrl;
    link.download = fileName || "document-a4.png";

    document.body.appendChild(link);

    link.click();

    link.remove();

    return true;
};


window.zaidTools.downloadElementAsPdf = async function (
    elementId,
    fileName,
    landscape
) {
    const element = document.getElementById(elementId);

    if (!element) {
        return false;
    }

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true
    });

    const imageData =
        canvas.toDataURL(
            "image/jpeg",
            0.95
        );

    const { jsPDF } =
        window.jspdf;

    const orientation =
        landscape
            ? "landscape"
            : "portrait";

    const pdf =
        new jsPDF({
            orientation: orientation,
            unit: "mm",
            format: "a4"
        });

    const pageWidth =
        landscape
            ? 297
            : 210;

    const pageHeight =
        landscape
            ? 210
            : 297;

    pdf.addImage(imageData,"JPEG",0,0, pageWidth, pageHeight );

    pdf.save( fileName || "document-a4.pdf");

    return true;
};


window.zaidTools.autoCropDocumentOpenCv = async function (dataUrl) {
    await window.zaidTools.loadOpenCv();

    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
    });

    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));

    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    let bestContour = null;
    let bestApprox = null;

    try {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // First attempt: edge detection
        cv.Canny(blurred, edges, 30, 120);

        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
        kernel.delete();

        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const imageArea = width * height;
        let bestArea = 0;

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area < imageArea * 0.05 || area > imageArea * 0.95) {
                contour.delete();
                continue;
            }

            const perimeter = cv.arcLength(contour, true);
            const approx = new cv.Mat();

            cv.approxPolyDP(contour, approx, 0.035 * perimeter, true);

            if (approx.rows === 4 && area > bestArea) {
                if (bestContour) bestContour.delete();
                if (bestApprox) bestApprox.delete();

                bestContour = contour;
                bestApprox = approx;
                bestArea = area;
            }
            else {
                approx.delete();
                contour.delete();
            }
        }

        // Found a four-corner document
        if (bestApprox) {
            const points = [];

            for (let i = 0; i < 4; i++) {
                points.push({
                    x: bestApprox.intPtr(i, 0)[0],
                    y: bestApprox.intPtr(i, 0)[1]
                });
            }

            const ordered = orderCorners(points);

            const originalPoints = ordered.map(p => ({
                x: p.x / scale,
                y: p.y / scale
            }));

            const cropped = perspectiveCrop(img, originalPoints);

            return {
                success: true,
                method: "perspective",
                dataUrl: cropped.dataUrl,
                width: cropped.width,
                height: cropped.height,
                corners: originalPoints
            };
        }

        // ------------------------------------------------
        // FALLBACK:
        // Detect a bright document against darker background
        // ------------------------------------------------

        const threshold = new cv.Mat();
        cv.threshold(blurred, threshold, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

        const fallbackKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 11));
        cv.morphologyEx(threshold, threshold, cv.MORPH_CLOSE, fallbackKernel);
        cv.morphologyEx(threshold, threshold, cv.MORPH_OPEN, fallbackKernel);
        fallbackKernel.delete();

        const fallbackContours = new cv.MatVector();
        const fallbackHierarchy = new cv.Mat();

        cv.findContours(threshold, fallbackContours, fallbackHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let bestCandidate = null;
        let bestScore = -1;

        const imageCenterX = width / 2;
        const imageCenterY = height / 2;

        for (let i = 0; i < fallbackContours.size(); i++) {
            const contour = fallbackContours.get(i);
            const area = cv.contourArea(contour);

            if (area < imageArea * 0.05 || area > imageArea * 0.70) {
                contour.delete();
                continue;
            }

            const rect = cv.boundingRect(contour);
            const rectArea = rect.width * rect.height;

            if (rectArea <= 0) {
                contour.delete();
                continue;
            }

            const rectangularity = area / rectArea;
            const aspectRatio = rect.width / rect.height;

            if (rectangularity < 0.45) {
                contour.delete();
                continue;
            }

            if (aspectRatio < 0.40 || aspectRatio > 2.50) {
                contour.delete();
                continue;
            }

            const centerX = rect.x + rect.width / 2;
            const centerY = rect.y + rect.height / 2;

            const distanceX = Math.abs(centerX - imageCenterX) / imageCenterX;
            const distanceY = Math.abs(centerY - imageCenterY) / imageCenterY;

            const centerScore = 1 - Math.min(1, (distanceX + distanceY) / 2);
            const areaScore = area / imageArea;

            const score = rectangularity * 2 + centerScore + areaScore;

            if (score > bestScore) {
                if (bestCandidate) bestCandidate.delete();

                bestCandidate = contour;
                bestScore = score;
            }
            else {
                contour.delete();
            }
        }

        if (!bestCandidate) {
            threshold.delete();
            fallbackContours.delete();
            fallbackHierarchy.delete();

            return {
                success: false,
                reason: "No clear document area found."
            };
        }

        const rect = cv.boundingRect(bestCandidate);
        const rectArea = rect.width * rect.height;
        const rectRatio = rectArea / imageArea;


        const padding = Math.round(Math.max(rect.width, rect.height) * 0.025);

        const x = Math.max(0, rect.x - padding);
        const y = Math.max(0, rect.y - padding);

        const cropWidth = Math.min(width - x, rect.width + padding * 2);
        const cropHeight = Math.min(height - y, rect.height + padding * 2);

        const originalX = Math.round(x / scale);
        const originalY = Math.round(y / scale);
        const originalWidth = Math.round(cropWidth / scale);
        const originalHeight = Math.round(cropHeight / scale);

        const outputCanvas = document.createElement("canvas");

        outputCanvas.width = originalWidth;
        outputCanvas.height = originalHeight;

        const outputContext = outputCanvas.getContext("2d");

        outputContext.drawImage(
            img,
            originalX,
            originalY,
            originalWidth,
            originalHeight,
            0,
            0,
            originalWidth,
            originalHeight
        );

        bestCandidate.delete();
        threshold.delete();
        fallbackContours.delete();
        fallbackHierarchy.delete();

        return {
            success: true,
            method: "bounding",
            dataUrl: outputCanvas.toDataURL("image/jpeg", 0.95),
            width: originalWidth,
            height: originalHeight
        };
    }
    finally {
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();

        if (bestContour) bestContour.delete();
        if (bestApprox) bestApprox.delete();
    }
};

function orderCorners(points) {
    const sum = p => p.x + p.y;
    const diff = p => p.x - p.y;

    const topLeft = points.reduce((a, b) => sum(a) < sum(b) ? a : b);
    const bottomRight = points.reduce((a, b) => sum(a) > sum(b) ? a : b);
    const topRight = points.reduce((a, b) => diff(a) > diff(b) ? a : b);
    const bottomLeft = points.reduce((a, b) => diff(a) < diff(b) ? a : b);

    return [topLeft, topRight, bottomRight, bottomLeft];
}


function perspectiveCrop(image, points) {
    const [tl, tr, br, bl] = points;

    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const maxWidth = Math.round(Math.max(widthTop, widthBottom));

    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
    const maxHeight = Math.round(Math.max(heightLeft, heightRight));

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;

    const sourceCtx = sourceCanvas.getContext("2d");
    sourceCtx.drawImage(image, 0, 0);

    const src = cv.imread(sourceCanvas);
    const dst = new cv.Mat();

    const srcPoints = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        [
            tl.x, tl.y,
            tr.x, tr.y,
            br.x, br.y,
            bl.x, bl.y
        ]
    );

    const dstPoints = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        [
            0, 0,
            maxWidth, 0,
            maxWidth, maxHeight,
            0, maxHeight
        ]
    );

    try {
        const matrix = cv.getPerspectiveTransform(srcPoints, dstPoints);

        cv.warpPerspective(
            src,
            dst,
            matrix,
            new cv.Size(maxWidth, maxHeight),
            cv.INTER_LINEAR,
            cv.BORDER_CONSTANT,
            new cv.Scalar()
        );

        const outputCanvas = document.createElement("canvas");
        cv.imshow(outputCanvas, dst);

        return {
            dataUrl: outputCanvas.toDataURL("image/jpeg", 0.95),
            width: maxWidth,
            height: maxHeight
        };
    }
    finally {
        src.delete();
        dst.delete();
        srcPoints.delete();
        dstPoints.delete();
    }
}

window.zaidTools.loadOpenCv = function () {
    return new Promise((resolve, reject) => {
        if (window.cv && window.cv.Mat) {
            resolve(true);
            return;
        }

        if (window.__opencvLoading) {
            const wait = setInterval(() => {
                if (window.cv && window.cv.Mat) {
                    clearInterval(wait);
                    resolve(true);
                }
            }, 150);

            return;
        }

        window.__opencvLoading = true;

        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.x/opencv.js";
        script.async = true;

        script.onload = () => {
            const wait = setInterval(() => {
                if (window.cv && window.cv.Mat) {
                    clearInterval(wait);
                    window.__opencvLoading = false;
                    resolve(true);
                }
            }, 150);
        };

        script.onerror = () => {
            window.__opencvLoading = false;
            reject("OpenCV failed to load.");
        };

        document.head.appendChild(script);
    });
};