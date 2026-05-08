import { drawScene, Edge, RenderOccludedLinesOption, Triangle, Vertex } from "@lib/draw";
import { Camera, ProjectionType } from "@lib/camera";
import { axisAngleToQuaternion, rotateVector } from "@lib/mathExtra";
import { projectVertex } from "@lib/renderGeometry";
import { Quat } from "ts-matrix";
import { ConstraintType, GeometrySolver } from "@lib/geometry";

const HEIGHT = 500;
const WIDTH = 500;
const paperElement = document.getElementById("paper") as HTMLElement & SVGElement;
paperElement.setAttribute("width", WIDTH.toString());
paperElement.setAttribute("height", HEIGHT.toString());
paperElement.setAttribute("viewBox", `-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`);

const cameraRadiusInput = document.getElementById("cameraOrbitRadius") as HTMLInputElement;
const cameraPitchInput = document.getElementById("cameraOrbitPitch") as HTMLInputElement;
const cameraYawInput = document.getElementById("cameraOrbitYaw") as HTMLInputElement;
const cameraFocalLengthInput = document.getElementById("cameraFocalLength") as HTMLInputElement;
const orthographicCheckbox = document.getElementById("orthographic") as HTMLInputElement;
const showAnnotationsCheckbox = document.getElementById("showAnnotations") as HTMLInputElement;
const showAnnotationsOnTopCheckbox = document.getElementById("showAnnotationsOnTop") as HTMLInputElement;
const renderOccludedLinesSelect = document.getElementById("renderOccludedLines") as HTMLSelectElement;
const vertexSizeInput = document.getElementById("vertexSize") as HTMLInputElement;
const triangleOpacityInput = document.getElementById("triangleOpacity") as HTMLInputElement;
const edgeThicknessInput = document.getElementById("edgeThickness") as HTMLInputElement;
const pngExportScaleInput = document.getElementById("pngExportScale") as HTMLInputElement;
const exportSvgBtn = document.getElementById("exportSvgBtn") as HTMLButtonElement;
const exportPngBtn = document.getElementById("exportPngBtn") as HTMLButtonElement;

cameraRadiusInput.oninput = updateCameraPosition;
cameraPitchInput.oninput = updateCameraPosition;
cameraYawInput.oninput = updateCameraPosition;
cameraFocalLengthInput.oninput = () => {
    const focalLength = parseFloat(cameraFocalLengthInput.value);
    camera.focalLengths = { x: focalLength, y: focalLength };
    renderScene();
};
showAnnotationsCheckbox.onchange = renderScene;
showAnnotationsOnTopCheckbox.onchange = renderScene;
renderOccludedLinesSelect.onchange = renderScene;
vertexSizeInput.oninput = renderScene;
triangleOpacityInput.oninput = renderScene;
edgeThicknessInput.oninput = renderScene;
exportSvgBtn.onclick = exportSvg;
exportPngBtn.onclick = exportPng;
orthographicCheckbox.onchange = () => {
    camera.projectionType = orthographicCheckbox.checked ? ProjectionType.ORTHOGRAPHIC : ProjectionType.PERSPECTIVE;
    renderScene();
};

/* -------------------------------------------------------------------------- */

const origin = new Vertex(0, 0, 0, "white");
const xAxisStub = new Edge(origin, new Vertex(100, 0, 0), "red");
const yAxisStub = new Edge(origin, new Vertex(0, 100, 0), "green");
const zAxisStub = new Edge(origin, new Vertex(0, 0, 100), "blue");

// cube centered at (0, 0, 0)
const p1 = new Vertex(-50, -50, -50);
const p2 = new Vertex(50, -50, -50);
const p3 = new Vertex(50, 50, -50);
const p4 = new Vertex(-50, 50, -50);
const p5 = new Vertex(-50, -50, 50);
const p6 = new Vertex(50, -50, 50);
const p7 = new Vertex(50, 50, 50);
const p8 = new Vertex(-50, 50, 50);
const vertices = [origin, p1, p2, p3, p4, p5, p6, p7, p8];
// top edges in yellow, bottom edges in cyan, vertical edges in magenta
const edges = [
    xAxisStub,
    yAxisStub,
    zAxisStub,
    new Edge(p1, p2, "cyan"),
    new Edge(p2, p3, "cyan"),
    new Edge(p3, p4, "cyan"),
    new Edge(p4, p1, "cyan"),
    new Edge(p5, p6, "yellow"),
    new Edge(p6, p7, "yellow"),
    new Edge(p7, p8, "yellow"),
    new Edge(p8, p5, "yellow"),
    new Edge(p1, p5, "magenta"),
    new Edge(p2, p6, "magenta"),
    new Edge(p3, p7, "magenta"),
    new Edge(p4, p8, "magenta"),
];
const triangles = [
    new Triangle(p1, p2, p3, "cyan"),
    new Triangle(p1, p3, p4, "cyan"),
    new Triangle(p5, p6, p7, "yellow"),
    new Triangle(p5, p7, p8, "yellow"),
    new Triangle(p1, p2, p6, "magenta"),
    new Triangle(p1, p6, p5, "magenta"),
    new Triangle(p4, p3, p7, "magenta"),
    new Triangle(p4, p7, p8, "magenta"),
    new Triangle(p1, p4, p8, "magenta"),
    new Triangle(p1, p8, p5, "magenta"),
    new Triangle(p2, p3, p7, "magenta"),
    new Triangle(p2, p7, p6, "magenta"),
];

const annotations = [
    { text: "X", position: xAxisStub.vertices[1], colour: "red" },
    { text: "Y", position: yAxisStub.vertices[1], colour: "green" },
    { text: "Z", position: zAxisStub.vertices[1], colour: "blue" },
];

const camera = new Camera(
    ProjectionType.PERSPECTIVE,
    { x: 500, y: 500, z: 500 },
    {
        x: (Math.min(...vertices.map(p => p.x)) + Math.max(...vertices.map(p => p.x))) / 2,
        y: (Math.min(...vertices.map(p => p.y)) + Math.max(...vertices.map(p => p.y))) / 2,
        z: (Math.min(...vertices.map(p => p.z)) + Math.max(...vertices.map(p => p.z))) / 2,
    },
    { x: 1, y: 1 },
);

updateCameraPosition();
renderScene();

/* -------------------------------------------------------------------------- */

function updateCameraPosition() {
    const r = parseFloat(cameraRadiusInput.value);
    const yaw = parseFloat(cameraYawInput.value) * (Math.PI / 180);
    const pitch = parseFloat(cameraPitchInput.value) * (Math.PI / 180);

    const yawQuat = axisAngleToQuaternion({ x: 0, y: 0, z: 1 }, yaw);
    const rightAfterYaw = rotateVector({ x: 1, y: 0, z: 0 }, yawQuat);
    const pitchQuat = axisAngleToQuaternion(rightAfterYaw, pitch);
    const orbitRotation = Quat.product(pitchQuat, yawQuat);

    // Base orbit vector at distance r, then rotate via quaternion.
    const rotated = rotateVector({ x: 0, y: r, z: 0 }, orbitRotation);
    const upHint = rotateVector({ x: 0, y: 0, z: 1 }, orbitRotation);
    const x = rotated.x;
    const y = rotated.y;
    const z = rotated.z;
    camera.position = { x, y, z };
    camera.upHint = upHint;
    renderScene();
}
function renderScene() {
    drawScene(
        paperElement,
        camera,
        [...vertices],
        [...edges],
        triangles,
        [...annotations],
        {
            renderAnnotations: showAnnotationsCheckbox.checked,
            vertexSize: parseFloat(vertexSizeInput.value),
            edgeThickness: parseFloat(edgeThicknessInput.value),
            triangleOpacity: parseFloat(triangleOpacityInput.value),
            annotationsAlwaysOnTop: showAnnotationsOnTopCheckbox.checked,
            renderOccludedLines: renderOccludedLinesSelect.value as RenderOccludedLinesOption,
        },
    );
}

function exportSvg() {
    const { svg } = createCroppedExportSvg();
    const serializedSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
    downloadBlob(new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" }), "geometry-diagrams.svg");
}

async function exportPng() {
    const { svg, width, height } = createCroppedExportSvg();
    const exportScale = parseFloat(pngExportScaleInput.value) || 4;
    const serializedSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
    const blob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(blob);

    try {
        const image = new Image();
        image.decoding = "async";
        image.src = svgUrl;
        await image.decode();

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(width * exportScale));
        canvas.height = Math.max(1, Math.ceil(height * exportScale));

        const context = canvas.getContext("2d");
        if (context === null) {
            throw new Error("Unable to create canvas context");
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pngBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(result => {
                if (result === null) {
                    reject(new Error("Unable to export PNG"));
                    return;
                }

                resolve(result);
            }, "image/png");
        });

        downloadBlob(pngBlob, "geometry-diagrams.png");
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

function createCroppedExportSvg(): { svg: SVGSVGElement; width: number; height: number } {
    const bounds = getSvgContentBounds();
    const focusPoint = projectVertex(camera, new Vertex(camera.lookAtTarget.x, camera.lookAtTarget.y, camera.lookAtTarget.z));
    const padding = Math.max(12, parseFloat(edgeThicknessInput.value) * 3);
    const halfWidth = Math.max(focusPoint.x - bounds.x, bounds.x + bounds.width - focusPoint.x, 0);
    const halfHeight = Math.max(focusPoint.y - bounds.y, bounds.y + bounds.height - focusPoint.y, 0);
    const exportWidth = Math.max(halfWidth * 2 + padding * 2, 1);
    const exportHeight = Math.max(halfHeight * 2 + padding * 2, 1);
    const exportX = focusPoint.x - halfWidth - padding;
    const exportY = focusPoint.y - halfHeight - padding;

    const exportedSvg = paperElement.cloneNode(true) as SVGSVGElement;
    exportedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    exportedSvg.setAttribute("viewBox", `${exportX} ${exportY} ${exportWidth} ${exportHeight}`);
    exportedSvg.setAttribute("width", exportWidth.toFixed(2));
    exportedSvg.setAttribute("height", exportHeight.toFixed(2));
    exportedSvg.removeAttribute("style");

    return {
        svg: exportedSvg,
        width: exportWidth,
        height: exportHeight,
    };
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");

    downloadLink.href = url;
    downloadLink.download = fileName;
    downloadLink.click();

    URL.revokeObjectURL(url);
}

function getSvgContentBounds(): { x: number; y: number; width: number; height: number } {
    const graphicsElements = Array.from(paperElement.children).filter((element): element is SVGGraphicsElement =>
        typeof (element as SVGGraphicsElement).getBBox === "function",
    );

    if (graphicsElements.length === 0) {
        const fallbackWidth = WIDTH;
        const fallbackHeight = HEIGHT;
        return {
            x: -fallbackWidth / 2,
            y: -fallbackHeight / 2,
            width: fallbackWidth,
            height: fallbackHeight,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const element of graphicsElements) {
        const box = element.getBBox();
        const strokeWidth = parseFloat(element.getAttribute("stroke-width") ?? "0") || 0;
        const strokePadding = strokeWidth / 2;
        minX = Math.min(minX, box.x - strokePadding);
        minY = Math.min(minY, box.y - strokePadding);
        maxX = Math.max(maxX, box.x + box.width + strokePadding);
        maxY = Math.max(maxY, box.y + box.height + strokePadding);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return {
            x: -WIDTH / 2,
            y: -HEIGHT / 2,
            width: WIDTH,
            height: HEIGHT,
        };
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/* -------------------------------------------------------------------------- */

const solver = new GeometrySolver();
const A = solver.addPoint("A");
const B = solver.addPoint("B");
solver.addConstraint({
    type: ConstraintType.Position,
    point: A,
    position: { x: 0, y: 0, z: 0 },
});
solver.addConstraint({
    type: ConstraintType.Position,
    point: B,
    position: { x: null, y: 0, z: 0 },
});
solver.addConstraint({
    type: ConstraintType.Length,
    line: solver.addLine(A, B),
    length: 10,
});
const solution = solver.solve();
console.log(solution);