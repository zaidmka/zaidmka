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

        const blob = new Blob(
            [content],
            { type: contentType || "text/plain" }
        );

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

    const analysisWidth =
        Math.round(width * scale);

    const analysisHeight =
        Math.round(height * scale);

    const canvas =
        document.createElement("canvas");

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

    pdf.addImage(
        imageData,
        "JPEG",
        0,
        0,
        pageWidth,
        pageHeight
    );

    pdf.save(
        fileName || "document-a4.pdf"
    );

    return true;
};