import { Camera, draw3D, ProjectionType } from "@lib/draw";
import { Line, Point } from "@lib/geometry";

const HEIGHT = 500;
const WIDTH = 500;
const paperElement = document.getElementById("paper") as HTMLElement & SVGElement;
paperElement.setAttribute("width", WIDTH.toString());
paperElement.setAttribute("height", HEIGHT.toString());
paperElement.setAttribute("viewBox", `-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`);

const cameraXInput = document.getElementById("cameraX") as HTMLInputElement;
const cameraYInput = document.getElementById("cameraY") as HTMLInputElement;
const cameraZInput = document.getElementById("cameraZ") as HTMLInputElement;

const updateCameraPosition = () => {
    const x = parseFloat(cameraXInput.value);
    const y = parseFloat(cameraYInput.value);
    const z = parseFloat(cameraZInput.value);
    camera.position = { x, y, z };
    draw3D(paperElement, camera, points, lines);
}

cameraXInput.oninput = updateCameraPosition;
cameraYInput.oninput = updateCameraPosition;
cameraZInput.oninput = updateCameraPosition;

const origin = new Point(0, 0, 0, "white");
const xAxisStub = new Line(origin, new Point(100, 0, 0), "red");
const yAxisStub = new Line(origin, new Point(0, 100, 0), "green");
const zAxisStub = new Line(origin, new Point(0, 0, 100), "blue");

// cube
const p1 = new Point(-100, -100, -100);
const p2 = new Point(100, -100, -100);
const p3 = new Point(100, 100, -100);
const p4 = new Point(-100, 100, -100);
const p5 = new Point(-100, -100, 100);
const p6 = new Point(100, -100, 100);
const p7 = new Point(100, 100, 100);
const p8 = new Point(-100, 100, 100);

const points: Point[] = [origin, p1, p2, p3, p4, p5, p6, p7, p8];

const lines: Line[] = [
    xAxisStub,
    yAxisStub,
    zAxisStub,
    new Line(p1, p2),
    new Line(p2, p3),
    new Line(p3, p4),
    new Line(p4, p1),
    new Line(p5, p6),
    new Line(p6, p7),
    new Line(p7, p8),
    new Line(p8, p5),
    new Line(p1, p5),
    new Line(p2, p6),
    new Line(p3, p7),
    new Line(p4, p8),
]

const camera = new Camera(
    ProjectionType.PERSPECTIVE,
    { x: 500, y: 500, z: 500 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1 },
);
draw3D(paperElement, camera, points, lines);