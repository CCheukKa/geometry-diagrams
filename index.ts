import { Camera, draw3D, ProjectionType } from "@lib/draw";
import { Line, LINES, Point, POINTS } from "@lib/geometry";

const HEIGHT = 500;
const WIDTH = 500;
const paperElement = document.getElementById("paper") as HTMLElement & SVGElement;
// ! Set (0, 0) to the center of the paper
paperElement.setAttribute("width", WIDTH.toString());
paperElement.setAttribute("height", HEIGHT.toString());
paperElement.setAttribute("viewBox", `-${WIDTH / 2} -${HEIGHT / 2} ${WIDTH} ${HEIGHT}`);

new Point(0, 0, 0); //? origin

// cube
const p1 = new Point(-100, -100, -100);
const p2 = new Point(100, -100, -100);
const p3 = new Point(100, 100, -100);
const p4 = new Point(-100, 100, -100);
const p5 = new Point(-100, -100, 100);
const p6 = new Point(100, -100, 100);
const p7 = new Point(100, 100, 100);
const p8 = new Point(-100, 100, 100);
new Line(p1, p2);
new Line(p2, p3);
new Line(p3, p4);
new Line(p4, p1);
new Line(p5, p6);
new Line(p6, p7);
new Line(p7, p8);
new Line(p8, p5);
new Line(p1, p5);
new Line(p2, p6);
new Line(p3, p7);
new Line(p4, p8);

const camera = new Camera(
    ProjectionType.PERSPECTIVE,
    { x: 500, y: 500, z: 300 },
    { x: 0, y: 0, z: 0 },
    { x: 500, y: 500 },
);
draw3D(paperElement, camera, POINTS, LINES);