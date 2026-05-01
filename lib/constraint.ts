export namespace ConstraintSolver {
    const POINT_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const LINE_NAMES = "abcdefghijklmnpqrstuvwxyz"; //? removed o
    const PLANE_NAMES = "𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵";
    const POLYGON_NAMES = "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ";
    // const ANGLE_NAMES = "αβγδεζηθικλμνξρστυφχψω"; //? removed ο,π


    export class ConstraintSolver {
        private points: Point[] = [];
        private lines: Line[] = []
        private planes: Plane[] = [];
        private polygons: Polygon[] = []
        private constraints: Constraint[] = [];

        public addPoint(x: number, y: number, z: number, name?: string): Point {
            const getPointName = (): string => {
                const usedNames = new Set(this.points.map(p => p.name));
                const availableNames = POINT_NAMES.split("").filter(name => !usedNames.has(name));
                if (availableNames.length === 0) {
                    throw new Error("Ran out of point names");
                }
                return availableNames[0]!;
            }

            const point = new Point(name ?? getPointName());
            point.x = x;
            point.y = y;
            point.z = z;
            this.points.push(point);
            return point;
        }

        public addLine(point1: Point, point2: Point, name?: string): Line {
            const getLineName = (): string => {
                const usedNames = new Set(this.lines.map(l => l.name));
                const availableNames = LINE_NAMES.split("").filter(name => !usedNames.has(name));
                if (availableNames.length === 0) {
                    throw new Error("Ran out of line names");
                }
                return availableNames[0]!;
            }

            const line = new Line(point1, point2, name ?? getLineName());
            this.lines.push(line);
            return line;
        }

        public addPlane(point1: Point, point2: Point, point3: Point, name?: string): Plane {
            const getPlaneName = (): string => {
                const usedNames = new Set(this.planes.map(p => p.name));
                const availableNames = PLANE_NAMES.split("").filter(name => !usedNames.has(name));
                if (availableNames.length === 0) {
                    throw new Error("Ran out of plane names");
                }
                return availableNames[0]!;
            }

            const plane = new Plane(point1, point2, point3, name ?? getPlaneName());
            this.planes.push(plane);
            return plane;
        }

        public addPolygon(points: Point[], name?: string): Polygon {
            const getPolygonName = (): string => {
                const usedNames = new Set(this.polygons.map(p => p.name));
                const availableNames = POLYGON_NAMES.split("").filter(name => !usedNames.has(name));
                if (availableNames.length === 0) {
                    throw new Error("Ran out of polygon names");
                }
                return availableNames[0]!;
            }

            const polygon = new Polygon(points, name ?? getPolygonName());
            this.polygons.push(polygon);
            return polygon;
        }

        public addConstraint(constraint: Constraint) {
            this.constraints.push(constraint);
        }
    }

    class Point {
        private _x: number | undefined;
        private _y: number | undefined;
        private _z: number | undefined;
        private _name: string;

        constructor(name: string) {
            this._name = name;
        }

        get x() {
            if (this._x === undefined) {
                throw new Error("Point is not initialised");
            }
            return this._x;
        }
        get y() {
            if (this._y === undefined) {
                throw new Error("Point is not initialised");
            }
            return this._y;
        }
        get z() {
            if (this._z === undefined) {
                throw new Error("Point is not initialised");
            }
            return this._z;
        }
        get name() {
            return this._name;
        }

        set x(value: number) {
            this._x = value;
        }
        set y(value: number) {
            this._y = value;
        }
        set z(value: number) {
            this._z = value;
        }
    }

    class Line {
        private _point1: Point | undefined;
        private _point2: Point | undefined;
        private _name: string;

        constructor(point1: Point, point2: Point, name: string) {
            this._point1 = point1;
            this._point2 = point2;
            this._name = name;
        }

        get point1() {
            if (this._point1 === undefined) {
                throw new Error("Line is not initialised");
            }
            return this._point1;
        }
        get point2() {
            if (this._point2 === undefined) {
                throw new Error("Line is not initialised");
            }
            return this._point2;
        }
        get name() {
            return this._name;
        }
    }

    class Plane {
        private _point1: Point | undefined;
        private _point2: Point | undefined;
        private _point3: Point | undefined;
        private _name: string;

        constructor(point1: Point, point2: Point, point3: Point, name: string) {
            this._point1 = point1;
            this._point2 = point2;
            this._point3 = point3;
            this._name = name;
        }

        get point1() {
            if (this._point1 === undefined) {

                throw new Error("Plane is not initialised");
            }
            return this._point1;
        }
        get point2() {
            if (this._point2 === undefined) {
                throw new Error("Plane is not initialised");
            }
            return this._point2;
        }
        get point3() {
            if (this._point3 === undefined) {
                throw new Error("Plane is not initialised");
            }
            return this._point3;
        }
        get name() {
            return this._name;
        }
    }

    class Polygon { //! must be coplanar
        private _points: Point[] | undefined;
        private _name: string;

        constructor(points: Point[], name: string) {
            if (points.length < 3) {
                throw new Error("Polygon must have at least 3 points");
            }
            this._points = points;
            this._name = name;
        }

        get points() {
            if (this._points === undefined) {
                throw new Error("Polygon is not initialised");
            }
            return this._points;
        }
        get name() {
            return this._name;
        }
    }

    /* -------------------------------------------------------------------------- */

    export enum ConstraintType {
        // Quantitative constraints
        Position = "position",
        Length = "length",
        AngleBetweenLines = "angleBetweenLines",
        AngleBetweenLineAndPlane = "angleBetweenLineAndPlane",
        AngleBetweenPlanes = "angleBetweenPlanes",

        // Qualitative constraints
        PointOnLine = "pointOnLine",
        PointOnLineSegment = "pointOnLineSegment",
        PointOnPlane = "pointOnPlane",
        PointOnPolygon = "pointOnPolygon",

        // Relational constraints
        Parallel = "parallel",
        Perpendicular = "perpendicular",
        Collinear = "collinear",
        Coplanar = "coplanar",
    }

    export type Constraint =
        {
            type: ConstraintType.Position;
            point: Point;
            position: {
                x: number | null;
                y: number | null;
                z: number | null;
            }
        } | {
            type: ConstraintType.Length;
            line: Line;
            length: number
        } | {
            type: ConstraintType.AngleBetweenLines;
            point1: Point;
            vertex: Point;
            point2: Point;
            angleRadians: number;
        } | {
            type: ConstraintType.AngleBetweenLineAndPlane;
            line: Line;
            plane: Plane;
            angleRadians: number;
        } | {
            type: ConstraintType.AngleBetweenPlanes;
            plane1: Plane;
            plane2: Plane;
            angleRadians: number;
        } | {
            type: ConstraintType.PointOnLine;
            point: Point;
            line: Line;
        } | {
            type: ConstraintType.PointOnLineSegment;
            point: Point;
            line: Line;
        } | {
            type: ConstraintType.PointOnPlane;
            point: Point;
            plane: Plane;
        } | {
            type: ConstraintType.PointOnPolygon;
            point: Point;
            polygon: Polygon;
        } | {
            type: ConstraintType.Parallel;
            line1: Line;
            line2: Line;
        } | {
            type: ConstraintType.Perpendicular;
            line1: Line;
            line2: Line;
        }
}