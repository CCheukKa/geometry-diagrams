import { drawScene } from "@lib/draw";
import { Camera, ProjectionType } from "@lib/camera";
import { Triangle, Edge, Vertex } from "@lib/geometry";
import { axisAngleToQuaternion, rotateVector } from "@lib/mathExtra";
import { Quat } from "ts-matrix";

const HEIGHT = 500;
const WIDTH = 500;
const paperElement = document.getElementById("paper") as HTMLElement & SVGElement;
paperElement.setAttribute("width", WIDTH.toString());
paperElement.setAttribute("height", HEIGHT.toString());
paperElement.setAttribute("viewBox", `-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`);

const cameraRadiusInput = document.getElementById("cameraOrbitRadius") as HTMLInputElement;
const cameraPitchInput = document.getElementById("cameraOrbitPitch") as HTMLInputElement;
const cameraYawInput = document.getElementById("cameraOrbitYaw") as HTMLInputElement;
const orthographicCheckbox = document.getElementById("orthographic") as HTMLInputElement;
const showAnnotationsCheckbox = document.getElementById("showAnnotations") as HTMLInputElement;
const showAnnotationsOnTopCheckbox = document.getElementById("showAnnotationsOnTop") as HTMLInputElement;
const showVerticesCheckbox = document.getElementById("showVertices") as HTMLInputElement;
const triangleOpacityInput = document.getElementById("triangleOpacity") as HTMLInputElement;
const edgeThicknessInput = document.getElementById("edgeThickness") as HTMLInputElement;

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
        vertices,
        edges,
        triangles,
        annotations,
        {
            renderAnnotations: showAnnotationsCheckbox.checked,
            renderVertices: showVerticesCheckbox.checked,
            edgeThickness: parseFloat(edgeThicknessInput.value),
            triangleOpacity: parseFloat(triangleOpacityInput.value),
            annotationsAlwaysOnTop: showAnnotationsOnTopCheckbox.checked,
        },
    );
};