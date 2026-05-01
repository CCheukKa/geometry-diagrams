import { drawScene } from "@lib/draw";
import { Camera, ProjectionType } from "@lib/camera";
import { Triangle, Edge, Vertex } from "@lib/geometry";
import { axisAngleToQuaternion, rotateVector } from "@lib/mathExtra";
import { SceneEditor, type AddConstraintInput, type ConstraintKind } from "@lib/editor";
import { Quat } from "ts-matrix";

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
const orthographicCheckbox = document.getElementById("orthographic") as HTMLInputElement;
const showAnnotationsCheckbox = document.getElementById("showAnnotations") as HTMLInputElement;
const showAnnotationsOnTopCheckbox = document.getElementById("showAnnotationsOnTop") as HTMLInputElement;
const showVerticesCheckbox = document.getElementById("showVertices") as HTMLInputElement;
const triangleOpacityInput = document.getElementById("triangleOpacity") as HTMLInputElement;
const edgeThicknessInput = document.getElementById("edgeThickness") as HTMLInputElement;

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

const constraintKinds: ConstraintKind[] = [
    "position",
    "length",
    "angle",
    "pointOnLine",
    "pointOnLineSegment",
    "pointOnPlane",
    "pointOnPolygon",
    "parallel",
    "perpendicular",
    "collinear",
    "coplanar",
];

cameraRadiusInput.oninput = updateCameraPosition;
cameraPitchInput.oninput = updateCameraPosition;
cameraYawInput.oninput = updateCameraPosition;
showAnnotationsCheckbox.onchange = renderScene;
showAnnotationsOnTopCheckbox.onchange = renderScene;
showVerticesCheckbox.onchange = renderScene;
triangleOpacityInput.oninput = renderScene;
edgeThicknessInput.oninput = renderScene;
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
            renderVertices: showVerticesCheckbox.checked,
            edgeThickness: parseFloat(edgeThicknessInput.value),
            triangleOpacity: parseFloat(triangleOpacityInput.value),
            annotationsAlwaysOnTop: showAnnotationsOnTopCheckbox.checked,
        },
    );
}

/* -------------------------------------------------------------------------- */

const solveBtn = document.getElementById("solveBtn") as HTMLButtonElement;

solveBtn.onclick = () => {
    setStatus(`Ready to solve ${sceneEditor.getConstraints().length} constraints.`);
    console.log("Scene constraints:", sceneEditor.getConstraints());
};

function populateConstraintKinds() {
    constraintTypeInput.innerHTML = constraintKinds
        .map(kind => `<option value="${kind}">${formatConstraintKind(kind)}</option>`)
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
    const type = constraintTypeInput.value as ConstraintKind;

    switch (type) {
        case "position":
            return {
                type,
                pointId: constraintPointAInput.value,
                x: parseNullableNumber(constraintValueXInput.value),
                y: parseNullableNumber(constraintValueYInput.value),
                z: parseNullableNumber(constraintValueZInput.value),
            };
        case "length":
            return {
                type,
                lineId: constraintLineAInput.value,
                length: parseRequiredNumber(constraintLengthInput.value, "Length"),
            };
        case "angle":
            return {
                type,
                point1Id: constraintPointAInput.value,
                vertexId: constraintPointBInput.value,
                point2Id: constraintPointCInput.value,
                angleDegrees: parseRequiredNumber(constraintAngleInput.value, "Angle"),
            };
        case "pointOnLine":
        case "pointOnLineSegment":
            return {
                type,
                pointId: constraintPointAInput.value,
                lineId: constraintLineAInput.value,
            };
        case "pointOnPlane":
            return {
                type,
                pointId: constraintPointAInput.value,
                planeId: constraintPlaneInput.value,
            };
        case "pointOnPolygon":
            return {
                type,
                pointId: constraintPointAInput.value,
                polygonId: constraintPolygonInput.value,
            };
        case "parallel":
        case "perpendicular":
            return {
                type,
                line1Id: constraintLineAInput.value,
                line2Id: constraintLineBInput.value,
            };
        case "collinear":
            return {
                type,
                pointIds: [constraintPointAInput.value, constraintPointBInput.value, constraintPointCInput.value] as [string, string, string],
            };
        case "coplanar":
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

function formatConstraintKind(kind: ConstraintKind): string {
    return kind
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