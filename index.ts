import { drawScene, RenderOccludedLinesOption } from "@lib/draw";
import { Camera, ProjectionType } from "@lib/camera";
import { Triangle, Edge, Vertex } from "@lib/geometry";
import { axisAngleToQuaternion, rotateVector } from "@lib/mathExtra";
import { SceneEditor, type AddConstraintInput } from "@lib/editor";
import { projectVertex } from "@lib/renderGeometry";
import { Quat } from "ts-matrix";
import { ConstraintSolver } from "@lib/constraint";

const HEIGHT = 500;
const WIDTH = 500;
const paperElement = document.getElementById("paper") as HTMLElement & SVGElement;
paperElement.setAttribute("width", WIDTH.toString());
paperElement.setAttribute("height", HEIGHT.toString());
paperElement.setAttribute("viewBox", `-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`);

const sceneEditor = new SceneEditor();

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

const pointNameInput = document.getElementById("pointName") as HTMLInputElement;
const pointXInput = document.getElementById("pointX") as HTMLInputElement;
const pointYInput = document.getElementById("pointY") as HTMLInputElement;
const pointZInput = document.getElementById("pointZ") as HTMLInputElement;
const addPointBtn = document.getElementById("addPointBtn") as HTMLButtonElement;

const lineNameInput = document.getElementById("lineName") as HTMLInputElement;
const linePointAInput = document.getElementById("linePointA") as HTMLSelectElement;
const linePointBInput = document.getElementById("linePointB") as HTMLSelectElement;
const addLineBtn = document.getElementById("addLineBtn") as HTMLButtonElement;

const planeNameInput = document.getElementById("planeName") as HTMLInputElement;
const planePointAInput = document.getElementById("planePointA") as HTMLSelectElement;
const planePointBInput = document.getElementById("planePointB") as HTMLSelectElement;
const planePointCInput = document.getElementById("planePointC") as HTMLSelectElement;
const addPlaneBtn = document.getElementById("addPlaneBtn") as HTMLButtonElement;

const polygonNameInput = document.getElementById("polygonName") as HTMLInputElement;
const polygonPointsInput = document.getElementById("polygonPoints") as HTMLSelectElement;
const addPolygonBtn = document.getElementById("addPolygonBtn") as HTMLButtonElement;

const constraintTypeInput = document.getElementById("constraintType") as HTMLSelectElement;
const constraintPointAInput = document.getElementById("constraintPointA") as HTMLSelectElement;
const constraintPointBInput = document.getElementById("constraintPointB") as HTMLSelectElement;
const constraintPointCInput = document.getElementById("constraintPointC") as HTMLSelectElement;
const constraintPointDInput = document.getElementById("constraintPointD") as HTMLSelectElement;
const constraintLineAInput = document.getElementById("constraintLineA") as HTMLSelectElement;
const constraintLineBInput = document.getElementById("constraintLineB") as HTMLSelectElement;
const constraintPlaneInput = document.getElementById("constraintPlane") as HTMLSelectElement;
const constraintPolygonInput = document.getElementById("constraintPolygon") as HTMLSelectElement;
const constraintValueXInput = document.getElementById("constraintValueX") as HTMLInputElement;
const constraintValueYInput = document.getElementById("constraintValueY") as HTMLInputElement;
const constraintValueZInput = document.getElementById("constraintValueZ") as HTMLInputElement;
const constraintLengthInput = document.getElementById("constraintLength") as HTMLInputElement;
const constraintAngleInput = document.getElementById("constraintAngle") as HTMLInputElement;
const addConstraintBtn = document.getElementById("addConstraintBtn") as HTMLButtonElement;

const pointsList = document.getElementById("pointsList") as HTMLUListElement;
const linesList = document.getElementById("linesList") as HTMLUListElement;
const planesList = document.getElementById("planesList") as HTMLUListElement;
const polygonsList = document.getElementById("polygonsList") as HTMLUListElement;
const constraintsList = document.getElementById("constraintsList") as HTMLUListElement;
const editorStatus = document.getElementById("editorStatus") as HTMLParagraphElement;

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

addPointBtn.onclick = () => {
    try {
        sceneEditor.addPoint(pointNameInput.value, parseFloat(pointXInput.value), parseFloat(pointYInput.value), parseFloat(pointZInput.value));
        pointNameInput.value = "";
        pointXInput.value = "0";
        pointYInput.value = "0";
        pointZInput.value = "0";
        refreshEditorUi();
        setStatus("Point added.");
        renderScene();
    } catch (error) {
        setStatus(getErrorMessage(error), true);
    }
};

addLineBtn.onclick = () => {
    try {
        sceneEditor.addLine(lineNameInput.value, linePointAInput.value, linePointBInput.value);
        lineNameInput.value = "";
        refreshEditorUi();
        setStatus("Line added.");
        renderScene();
    } catch (error) {
        setStatus(getErrorMessage(error), true);
    }
};

addPlaneBtn.onclick = () => {
    try {
        sceneEditor.addPlane(planeNameInput.value, [planePointAInput.value, planePointBInput.value, planePointCInput.value]);
        planeNameInput.value = "";
        refreshEditorUi();
        setStatus("Plane added.");
        renderScene();
    } catch (error) {
        setStatus(getErrorMessage(error), true);
    }
};

addPolygonBtn.onclick = () => {
    try {
        const pointIds = Array.from(polygonPointsInput.selectedOptions).map(option => option.value);
        sceneEditor.addPolygon(polygonNameInput.value, pointIds);
        polygonNameInput.value = "";
        refreshEditorUi();
        setStatus("Polygon added.");
        renderScene();
    } catch (error) {
        setStatus(getErrorMessage(error), true);
    }
};

addConstraintBtn.onclick = () => {
    try {
        const constraint = buildConstraintInput();
        sceneEditor.addConstraint(constraint);
        refreshEditorUi();
        setStatus("Constraint added.");
    } catch (error) {
        setStatus(getErrorMessage(error), true);
    }
};

constraintTypeInput.onchange = () => {
    setStatus(`Constraint type: ${constraintTypeInput.value}.`);
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

populateConstraintKinds();
refreshEditorUi();
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
    const editorVertices = sceneEditor.getRenderableVertices();
    const editorEdges = sceneEditor.getRenderableEdges();
    const editorAnnotations = sceneEditor.getRenderableAnnotations();

    drawScene(
        paperElement,
        camera,
        [...vertices, ...editorVertices],
        [...edges, ...editorEdges],
        triangles,
        [...annotations, ...editorAnnotations],
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

const solveBtn = document.getElementById("solveBtn") as HTMLButtonElement;

solveBtn.onclick = () => {
    setStatus(`Ready to solve ${sceneEditor.getConstraints().length} constraints.`);
    console.log("Scene constraints:", sceneEditor.getConstraints());
};

function populateConstraintKinds() {
    constraintTypeInput.innerHTML = Object.values(ConstraintSolver.ConstraintType)
        .map(type => `<option value="${type}">${formatConstraintKind(type)}</option>`)
        .join("");
}

function refreshEditorUi() {
    populateSelect(sceneEditor.getPointOptions(), [
        linePointAInput,
        linePointBInput,
        planePointAInput,
        planePointBInput,
        planePointCInput,
        constraintPointAInput,
        constraintPointBInput,
        constraintPointCInput,
        constraintPointDInput,
        polygonPointsInput,
    ]);
    populateSelect(sceneEditor.getLineOptions(), [constraintLineAInput, constraintLineBInput]);
    populateSelect(sceneEditor.getPlaneOptions(), [constraintPlaneInput]);
    populateSelect(sceneEditor.getPolygonOptions(), [constraintPolygonInput]);

    renderList(pointsList, sceneEditor.getPoints().map(point => `${point.name}: (${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(point.z)})`));
    renderList(linesList, sceneEditor.getLines().map(line => `${line.name}: ${getLabelForPoint(line.pointAId)} - ${getLabelForPoint(line.pointBId)}`));
    renderList(planesList, sceneEditor.getPlanes().map(plane => `${plane.name}: ${plane.pointIds.map(pointId => getLabelForPoint(pointId)).join(", ")}`));
    renderList(polygonsList, sceneEditor.getPolygons().map(polygon => `${polygon.name}: ${polygon.pointIds.map(pointId => getLabelForPoint(pointId)).join(", ")}`));
    renderList(constraintsList, sceneEditor.getConstraints().map(constraint => `${constraint.label}: ${constraint.summary}`));
}

function populateSelect(options: { id: string; label: string }[], selects: HTMLSelectElement[]) {
    const markup = options.length === 0
        ? `<option value="">Add items first</option>`
        : [`<option value="">Select one</option>`, ...options.map(option => `<option value="${option.id}">${option.label}</option>`)].join("");

    for (const select of selects) {
        const selectedValue = select.value;
        select.innerHTML = markup;
        if (options.some(option => option.id === selectedValue)) {
            select.value = selectedValue;
        }
    }
}

function renderList(listElement: HTMLUListElement, items: string[]) {
    listElement.innerHTML = items.length === 0
        ? `<li>Nothing yet</li>`
        : items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
}

function buildConstraintInput(): AddConstraintInput {
    const type = constraintTypeInput.value as ConstraintSolver.ConstraintType;

    switch (type) {
        case ConstraintSolver.ConstraintType.Position:
            return {
                type,
                pointId: constraintPointAInput.value,
                x: parseNullableNumber(constraintValueXInput.value),
                y: parseNullableNumber(constraintValueYInput.value),
                z: parseNullableNumber(constraintValueZInput.value),
            };
        case ConstraintSolver.ConstraintType.Length:
            return {
                type,
                lineId: constraintLineAInput.value,
                length: parseRequiredNumber(constraintLengthInput.value, "Length"),
            };
        case ConstraintSolver.ConstraintType.AngleBetweenLines:
            return {
                type,
                point1Id: constraintPointAInput.value,
                vertexId: constraintPointBInput.value,
                point2Id: constraintPointCInput.value,
                angleDegrees: parseRequiredNumber(constraintAngleInput.value, "Angle"),
            };
        case ConstraintSolver.ConstraintType.AngleBetweenLineAndPlane:
            return {
                type,
                lineId: constraintLineAInput.value,
                planeId: constraintPlaneInput.value,
                angleDegrees: parseRequiredNumber(constraintAngleInput.value, "Angle"),
            };
        case ConstraintSolver.ConstraintType.AngleBetweenPlanes:
            return {
                type,
                planeId: constraintPlaneInput.value,
                planeId2: constraintPlaneInput.value,
                angleDegrees: parseRequiredNumber(constraintAngleInput.value, "Angle"),
            };
        case ConstraintSolver.ConstraintType.PointOnLine:
        case ConstraintSolver.ConstraintType.PointOnLineSegment:
            return {
                type,
                pointId: constraintPointAInput.value,
                lineId: constraintLineAInput.value,
            };
        case ConstraintSolver.ConstraintType.PointOnPlane:
            return {
                type,
                pointId: constraintPointAInput.value,
                planeId: constraintPlaneInput.value,
            };
        case ConstraintSolver.ConstraintType.PointOnPolygon:
            return {
                type,
                pointId: constraintPointAInput.value,
                polygonId: constraintPolygonInput.value,
            };
        case ConstraintSolver.ConstraintType.Parallel:
        case ConstraintSolver.ConstraintType.Perpendicular:
            return {
                type,
                line1Id: constraintLineAInput.value,
                line2Id: constraintLineBInput.value,
            };
        case ConstraintSolver.ConstraintType.Collinear:
            return {
                type,
                pointIds: [constraintPointAInput.value, constraintPointBInput.value, constraintPointCInput.value] as [string, string, string],
            };
        case ConstraintSolver.ConstraintType.Coplanar:
            return {
                type,
                pointIds: [constraintPointAInput.value, constraintPointBInput.value, constraintPointCInput.value, constraintPointDInput.value] as [string, string, string, string],
            };
    }
}

function getLabelForPoint(pointId: string): string {
    return sceneEditor.getPoints().find(point => point.id === pointId)?.name ?? pointId;
}

function parseNullableNumber(value: string): number | null {
    return value.trim() === "" ? null : Number.parseFloat(value);
}

function parseRequiredNumber(value: string, fieldName: string): number {
    const parsedValue = Number.parseFloat(value);
    if (Number.isNaN(parsedValue)) {
        throw new Error(`${fieldName} is required`);
    }
    return parsedValue;
}

function formatNumber(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatConstraintKind(type: ConstraintSolver.ConstraintType): string {
    return type
        .replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`)
        .replace(/^./, firstLetter => firstLetter.toUpperCase())
        .trim();
}

function setStatus(message: string, isError: boolean = false) {
    editorStatus.textContent = message;
    editorStatus.classList.toggle("error", isError);
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unexpected error";
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}