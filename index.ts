import { Camera, draw3D, ProjectionType } from "@lib/draw";
import { Face, Line, Point } from "@lib/geometry";
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
const showPointsCheckbox = document.getElementById("showPoints") as HTMLInputElement;
const faceOpacityInput = document.getElementById("faceOpacity") as HTMLInputElement;

const renderScene = () => {
    draw3D(
        paperElement,
        camera,
        points,
        lines,
        faces,
        annotations,
        {
            renderAnnotations: showAnnotationsCheckbox.checked,
            renderPoints: showPointsCheckbox.checked,
            faceOpacity: parseFloat(faceOpacityInput.value),
        },
    );
};

orthographicCheckbox.onchange = () => {
    camera.projectionType = orthographicCheckbox.checked ? ProjectionType.ORTHOGRAPHIC : ProjectionType.PERSPECTIVE;
    renderScene();
}

const updateCameraPosition = () => {
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
    console.log(`Camera position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    camera.position = { x, y, z };
    camera.upHint = upHint;
    renderScene();
}

cameraRadiusInput.oninput = updateCameraPosition;
cameraPitchInput.oninput = updateCameraPosition;
cameraYawInput.oninput = updateCameraPosition;
showAnnotationsCheckbox.onchange = renderScene;
showPointsCheckbox.onchange = renderScene;
faceOpacityInput.oninput = renderScene;

const origin = new Point(0, 0, 0, "white");
const xAxisStub = new Line(origin, new Point(100, 0, 0), "red");
const yAxisStub = new Line(origin, new Point(0, 100, 0), "green");
const zAxisStub = new Line(origin, new Point(0, 0, 100), "blue");

// cube centered at (0, 0, 0)
const p1 = new Point(-50, -50, -50);
const p2 = new Point(50, -50, -50);
const p3 = new Point(50, 50, -50);
const p4 = new Point(-50, 50, -50);
const p5 = new Point(-50, -50, 50);
const p6 = new Point(50, -50, 50);
const p7 = new Point(50, 50, 50);
const p8 = new Point(-50, 50, 50);
const points = [origin, p1, p2, p3, p4, p5, p6, p7, p8];
// top edges in yellow, bottom edges in cyan, vertical edges in magenta
const lines = [
    xAxisStub,
    yAxisStub,
    zAxisStub,
    new Line(p1, p2, "cyan"),
    new Line(p2, p3, "cyan"),
    new Line(p3, p4, "cyan"),
    new Line(p4, p1, "cyan"),
    new Line(p5, p6, "yellow"),
    new Line(p6, p7, "yellow"),
    new Line(p7, p8, "yellow"),
    new Line(p8, p5, "yellow"),
    new Line(p1, p5, "magenta"),
    new Line(p2, p6, "magenta"),
    new Line(p3, p7, "magenta"),
    new Line(p4, p8, "magenta"),
];
const faces: Face[] = [
    // bottom face
    { points: [p1, p2, p3], colour: "cyan" },
    { points: [p1, p3, p4], colour: "cyan" },
    // top face
    { points: [p5, p6, p7], colour: "yellow" },
    { points: [p5, p7, p8], colour: "yellow" },
    // front face
    { points: [p1, p2, p6], colour: "magenta" },
    { points: [p1, p6, p5], colour: "magenta" },
    // back face
    { points: [p4, p3, p7], colour: "magenta" },
    { points: [p4, p7, p8], colour: "magenta" },
    // left face
    { points: [p1, p4, p8], colour: "magenta" },
    { points: [p1, p8, p5], colour: "magenta" },
    // right face
    { points: [p2, p3, p7], colour: "magenta" },
    { points: [p2, p7, p6], colour: "magenta" },
];

const annotations = [
    { text: "X", position: xAxisStub.points[1], colour: "red" },
    { text: "Y", position: yAxisStub.points[1], colour: "green" },
    { text: "Z", position: zAxisStub.points[1], colour: "blue" },
];

const camera = new Camera(
    ProjectionType.PERSPECTIVE,
    { x: 500, y: 500, z: 500 },
    {
        x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
        y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2,
        z: (Math.min(...points.map(p => p.z ?? 0)) + Math.max(...points.map(p => p.z ?? 0))) / 2,
    },
    { x: 1, y: 1 },
);
updateCameraPosition();
renderScene();