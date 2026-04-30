import { Camera, draw3D, ProjectionType } from "@lib/draw";
import { Line, Point } from "@lib/geometry";
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
orthographicCheckbox.onchange = () => {
    camera.projectionType = orthographicCheckbox.checked ? ProjectionType.ORTHOGRAPHIC : ProjectionType.PERSPECTIVE;
    draw3D(paperElement, camera, points, lines, annotations);
}

const updateCameraPosition = () => {
    const r = parseFloat(cameraRadiusInput.value);
    const yaw = parseFloat(cameraYawInput.value) * (Math.PI / 180);
    const pitch = parseFloat(cameraPitchInput.value) * (Math.PI / 180);

    const yawQuat = axisAngleToQuaternion({ x: 0, y: 1, z: 0 }, yaw);
    const rightAfterYaw = rotateVector({ x: 1, y: 0, z: 0 }, yawQuat);
    const pitchQuat = axisAngleToQuaternion(rightAfterYaw, pitch);
    const orbitRotation = Quat.product(pitchQuat, yawQuat);

    // Base orbit vector at distance r, then rotate via quaternion.
    const rotated = rotateVector({ x: 0, y: 0, z: r }, orbitRotation);
    const upHint = rotateVector({ x: 0, y: 1, z: 0 }, orbitRotation);
    const x = rotated.x;
    const y = rotated.y;
    const z = rotated.z;
    console.log(`Camera position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    camera.position = { x, y, z };
    camera.upHint = upHint;
    draw3D(paperElement, camera, points, lines, annotations);
}

cameraRadiusInput.oninput = updateCameraPosition;
cameraPitchInput.oninput = updateCameraPosition;
cameraYawInput.oninput = updateCameraPosition;

const origin = new Point(0, 0, 0, "white");
const xAxisStub = new Line(origin, new Point(100, 0, 0), "red");
const yAxisStub = new Line(origin, new Point(0, 100, 0), "green");
const zAxisStub = new Line(origin, new Point(0, 0, 100), "blue");

// triangular prism
const p1 = new Point(0, 0, 0);
const p2 = new Point(100, 0, 0);
const p3 = new Point(50, 86.6, 0);
const p4 = new Point(0, 0, 100);
const p5 = new Point(100, 0, 100);
const p6 = new Point(50, 86.6, 100);
const points = [origin, p1, p2, p3, p4, p5, p6];
const lines = [
    xAxisStub,
    yAxisStub,
    zAxisStub,
    new Line(p1, p2),
    new Line(p2, p3),
    new Line(p3, p1),
    new Line(p4, p5),
    new Line(p5, p6),
    new Line(p6, p4),
    new Line(p1, p4),
    new Line(p2, p5),
    new Line(p3, p6),
];
const annotations = [
    { text: "X", position: xAxisStub.points[1], colour: "red" },
    { text: "Y", position: yAxisStub.points[1], colour: "green" },
    { text: "Z", position: zAxisStub.points[1], colour: "blue" },
];

const camera = new Camera(
    ProjectionType.PERSPECTIVE,
    { x: 500, y: 500, z: 500 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1 },
);
updateCameraPosition();
draw3D(paperElement, camera, points, lines, annotations);