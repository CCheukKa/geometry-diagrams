export class Point {
    public x: number;
    public y: number;
    public z?: number;
    public colour?: string | undefined;

    constructor(x: number, y: number, z?: number, colour?: string) {
        this.x = x;
        this.y = y;
        this.z = z ?? 0;
        this.colour = colour;
    }
}

export class Line {
    public points: [Point, Point];
    public colour?: string | undefined;

    constructor(point1: Point, point2: Point, colour?: string) {
        this.points = [point1, point2];
        this.colour = colour;
    }
}