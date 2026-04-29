export const POINTS: Point[] = [];
export const LINES: Line[] = [];

export class Point {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number, y: number, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        POINTS.push(this);
    }
}

export class Line {
    public points: [Point, Point];

    constructor(point1: Point, point2: Point) {
        this.points = [point1, point2];
        LINES.push(this);
    }
}