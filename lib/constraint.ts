import { barycentricCoordinates2D, cross3, distance3, dot3, length3, type Vector3D } from "@lib/mathExtra";

const TOLERANCE = 1e-6;

const POINT_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LINE_NAMES = "abcdefghijklmnpqrstuvwxyz"; //? removed o
const PLANE_NAMES = "𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵";
const POLYGON_NAMES = "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ";
// const ANGLE_NAMES = "αβγδεζηθικλμνξρστυφχψω"; //? removed ο,π

interface Point {
    readonly x: number | null;
    readonly y: number | null;
    readonly z: number | null;
    readonly name: string;
}

class _Point implements Point {
    public x: number | null;
    public y: number | null;
    public z: number | null;
    public name: string;

    constructor(name: string) {
        this.x = null;
        this.y = null;
        this.z = null;
        this.name = name;
    }
}

interface Line {
    readonly point1: Point;
    readonly point2: Point;
    readonly name: string;
}

class _Line implements Line {
    public point1: Point;
    public point2: Point;
    public name: string;

    constructor(point1: Point, point2: Point, name: string) {
        this.point1 = point1;
        this.point2 = point2;
        this.name = name;
    }
}

interface Plane {
    readonly point1: Point;
    readonly point2: Point;
    readonly point3: Point;
    readonly name: string;
}

class _Plane implements Plane {
    public point1: Point;
    public point2: Point;
    public point3: Point;
    public name: string;

    constructor(point1: Point, point2: Point, point3: Point, name: string) {
        this.point1 = point1;
        this.point2 = point2;
        this.point3 = point3;
        this.name = name;
    }
}

interface Polygon {
    readonly points: Point[];
    readonly name: string;
}

class _Polygon implements Polygon { //! must be coplanar
    public points: Point[];
    public name: string;

    constructor(points: Point[], name: string) {
        if (points.length < 3) {
            throw new Error("Polygon must have at least 3 points");
        }
        this.points = points;
        this.name = name;
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
    DistanceBetweenPointAndLine = "distanceBetweenPointAndLine",
    DistanceBetweenPointAndPlane = "distanceBetweenPointAndPlane",

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
    EqualLength = "equalLength",
}

export type Constraint =
    {
        type: ConstraintType.Position;
        point: _Point;
        position: {
            x: number | null;
            y: number | null;
            z: number | null;
        }
    } | {
        type: ConstraintType.Length;
        line: _Line;
        length: number
    } | {
        type: ConstraintType.AngleBetweenLines;
        point1: _Point;
        vertex: _Point;
        point2: _Point;
        angleRadians: number;
    } | {
        type: ConstraintType.AngleBetweenLineAndPlane;
        line: _Line;
        plane: _Plane;
        angleRadians: number;
    } | {
        type: ConstraintType.AngleBetweenPlanes;
        plane1: _Plane;
        plane2: _Plane;
        angleRadians: number;
    } | {
        type: ConstraintType.DistanceBetweenPointAndLine;
        point: _Point;
        line: _Line;
        distance: number;
    } | {
        type: ConstraintType.DistanceBetweenPointAndPlane;
        point: _Point;
        plane: _Plane;
        distance: number;
    } | {
        type: ConstraintType.PointOnLine;
        point: _Point;
        line: _Line;
    } | {
        type: ConstraintType.PointOnLineSegment;
        point: _Point;
        line: _Line;
    } | {
        type: ConstraintType.PointOnPlane;
        point: _Point;
        plane: _Plane;
    } | {
        type: ConstraintType.PointOnPolygon;
        point: _Point;
        polygon: _Polygon;
    } | {
        type: ConstraintType.Parallel;
        line1: _Line;
        line2: _Line;
    } | {
        type: ConstraintType.Perpendicular;
        line1: _Line;
        line2: _Line;
    } | {
        type: ConstraintType.Collinear;
        point1: _Point;
        point2: _Point;
    } | {
        type: ConstraintType.Coplanar;
        point1: _Point;
        point2: _Point;
    } | {
        type: ConstraintType.EqualLength;
        line1: _Line;
        line2: _Line;
    }

function pointIsNonNull(point: Point): boolean {
    return point.x !== null && point.y !== null && point.z !== null;
}

function isEqualWithinTolerance(value1: number, value2: number): boolean {
    return Math.abs(value1 - value2) < TOLERANCE;
}

function getLineDirection(point1: Point, point2: Point): Vector3D {
    if (!pointIsNonNull(point1) || !pointIsNonNull(point2)) {
        throw new Error("Cannot calculate line direction with null points");
    }
    return {
        x: point2.x! - point1.x!,
        y: point2.y! - point1.y!,
        z: point2.z! - point1.z!,
    };
}

function getPlaneNormal(plane: Plane): Vector3D {
    if (!pointIsNonNull(plane.point1) || !pointIsNonNull(plane.point2) || !pointIsNonNull(plane.point3)) {
        throw new Error("Cannot calculate plane normal with null points");
    }
    const edge1 = getLineDirection(plane.point1, plane.point2);
    const edge2 = getLineDirection(plane.point1, plane.point3);
    return cross3(edge1, edge2);
}

function projectPointOntoLine(point: Point, line: Line): Point {
    if (!pointIsNonNull(point) || !pointIsNonNull(line.point1) || !pointIsNonNull(line.point2)) {
        throw new Error("Cannot project point onto line with null points");
    }
    const lineDir = getLineDirection(line.point1, line.point2);
    const lineLengthSquared = dot3(lineDir, lineDir);
    if (lineLengthSquared === 0) {
        throw new Error("Cannot project onto a line of zero length");
    }
    const t = ((point.x! - line.point1.x!) * lineDir.x + (point.y! - line.point1.y!) * lineDir.y + (point.z! - line.point1.z!) * lineDir.z) / lineLengthSquared;
    return {
        x: line.point1.x! + t * lineDir.x,
        y: line.point1.y! + t * lineDir.y,
        z: line.point1.z! + t * lineDir.z,
        name: `${point.name}_proj_${line.name}`,
    };
}

function projectPointOntoPlane(point: Point, plane: Plane): Point {
    if (!pointIsNonNull(point) || !pointIsNonNull(plane.point1) || !pointIsNonNull(plane.point2) || !pointIsNonNull(plane.point3)) {
        throw new Error("Cannot project point onto plane with null points");
    }
    const planeNormal = getPlaneNormal(plane);
    const planeNormalLengthSquared = dot3(planeNormal, planeNormal);
    if (planeNormalLengthSquared === 0) {
        throw new Error("Cannot project onto a plane with zero normal");
    }
    const t = ((point.x! - plane.point1.x!) * planeNormal.x + (point.y! - plane.point1.y!) * planeNormal.y + (point.z! - plane.point1.z!) * planeNormal.z) / planeNormalLengthSquared;
    return {
        x: point.x! - t * planeNormal.x,
        y: point.y! - t * planeNormal.y,
        z: point.z! - t * planeNormal.z,
        name: `${point.name}_proj_${plane.name}`,
    };
}

function radianAngleDifference(angle1: number, angle2: number): number {
    const diff = angle1 - angle2;
    return ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
}

function constraintIsSatisfied(constraint: Constraint): boolean {
    //! exact constraints should be satisfied exactly, while inexact constraints should be satisfied within a tolerance

    switch (constraint.type) {
        // exact constraints
        case ConstraintType.Position:
        case ConstraintType.PointOnLine:
        case ConstraintType.PointOnLineSegment:
        case ConstraintType.PointOnPlane:
        case ConstraintType.PointOnPolygon:
        case ConstraintType.Parallel:
        case ConstraintType.Perpendicular:
        case ConstraintType.Collinear:
        case ConstraintType.Coplanar: {
            return scaledConstraintSignedLoss(constraint) === 0;
        }
        // inexact constraints
        case ConstraintType.Length:
        case ConstraintType.AngleBetweenLines:
        case ConstraintType.AngleBetweenLineAndPlane:
        case ConstraintType.AngleBetweenPlanes:
        case ConstraintType.DistanceBetweenPointAndLine:
        case ConstraintType.DistanceBetweenPointAndPlane:
        case ConstraintType.EqualLength: {
            return isEqualWithinTolerance(scaledConstraintSignedLoss(constraint), 0);
        }
        default: {
            // @ts-ignore
            throw new Error(`Constraint type ${constraint.type} not implemented yet`);
        }
    }
}

function scaledConstraintSignedLoss(constraint: Constraint): number {
    const scalingFactor: Record<ConstraintType, number> = {
        [ConstraintType.Position]: 1,
        [ConstraintType.Length]: 2,
        [ConstraintType.AngleBetweenLines]: 3,
        [ConstraintType.AngleBetweenLineAndPlane]: 3,
        [ConstraintType.AngleBetweenPlanes]: 3,
        [ConstraintType.DistanceBetweenPointAndLine]: 1,
        [ConstraintType.DistanceBetweenPointAndPlane]: 1,
        [ConstraintType.PointOnLine]: 1,
        [ConstraintType.PointOnLineSegment]: 1,
        [ConstraintType.PointOnPlane]: 1,
        [ConstraintType.PointOnPolygon]: 1,
        [ConstraintType.Parallel]: 0.05,
        [ConstraintType.Perpendicular]: 0.05,
        [ConstraintType.Collinear]: 1,
        [ConstraintType.Coplanar]: 1,
        [ConstraintType.EqualLength]: 1,
    };
    return rawConstraintSignedLoss(constraint) * (scalingFactor[constraint.type] ?? 1);
}

function rawConstraintSignedLoss(constraint: Constraint): number {
    //! exact constraints should have zero loss when satisfied,
    //! inexact constraints should have a loss proportional to how unsatisfied they are,
    //! inexact constraints should give a signed loss indicating the direction of violation

    switch (constraint.type) {
        case ConstraintType.Position: { //$ exact
            const { point, position } = constraint;
            const xSatisfied = position.x === null || point.x === position.x;
            const ySatisfied = position.y === null || point.y === position.y;
            const zSatisfied = position.z === null || point.z === position.z;
            return xSatisfied && ySatisfied && zSatisfied ? 0 : 1;
        }
        case ConstraintType.Length: { //& inexact
            const { line, length } = constraint;
            if (!pointIsNonNull(line.point1) || !pointIsNonNull(line.point2)) { throw new Error("Invalid line points"); }
            const lineDir = getLineDirection(line.point1, line.point2);
            const actualLength = length3(lineDir);
            return actualLength - length;
        }
        case ConstraintType.AngleBetweenLines: { //& inexact
            const { point1, vertex, point2, angleRadians } = constraint;
            if (!pointIsNonNull(point1) || !pointIsNonNull(vertex) || !pointIsNonNull(point2)) { throw new Error("Invalid point values"); }
            const line1Dir = getLineDirection(vertex, point1);
            const line2Dir = getLineDirection(vertex, point2);
            const dotProduct = dot3(line1Dir, line2Dir);
            const magnitudeLine1Dir = length3(line1Dir);
            const magnitudeLine2Dir = length3(line2Dir);
            const actualAngle = Math.acos(dotProduct / (magnitudeLine1Dir * magnitudeLine2Dir));
            return radianAngleDifference(actualAngle, angleRadians);
        }
        case ConstraintType.AngleBetweenLineAndPlane: { //& inexact
            const { line, plane, angleRadians } = constraint;
            if (!pointIsNonNull(line.point1) || !pointIsNonNull(line.point2) || !pointIsNonNull(plane.point1) || !pointIsNonNull(plane.point2) || !pointIsNonNull(plane.point3)) { throw new Error("Invalid plane points"); }
            const lineDir = getLineDirection(line.point1, line.point2);
            const planeNormal = getPlaneNormal(plane);
            const dotProduct = dot3(lineDir, planeNormal);
            const magnitudeLineDir = length3(lineDir);
            const magnitudePlaneNormal = length3(planeNormal);
            const actualAngle = Math.asin(dotProduct / (magnitudeLineDir * magnitudePlaneNormal));
            return radianAngleDifference(actualAngle, angleRadians);
        }
        case ConstraintType.AngleBetweenPlanes: { //& inexact
            const { plane1, plane2, angleRadians } = constraint;
            if (!pointIsNonNull(plane1.point1) || !pointIsNonNull(plane1.point2) || !pointIsNonNull(plane1.point3) || !pointIsNonNull(plane2.point1) || !pointIsNonNull(plane2.point2) || !pointIsNonNull(plane2.point3)) { throw new Error("Invalid plane points"); }
            const plane1Normal = getPlaneNormal(plane1);
            const plane2Normal = getPlaneNormal(plane2);
            const dotProduct = dot3(plane1Normal, plane2Normal);
            const magnitudePlane1Normal = length3(plane1Normal);
            const magnitudePlane2Normal = length3(plane2Normal);
            const actualAngle = Math.acos(dotProduct / (magnitudePlane1Normal * magnitudePlane2Normal));
            return radianAngleDifference(actualAngle, angleRadians);
        }
        case ConstraintType.DistanceBetweenPointAndLine: { //& inexact
            const { point, line, distance } = constraint;
            if (!pointIsNonNull(point) || !pointIsNonNull(line.point1) || !pointIsNonNull(line.point2)) { throw new Error("Invalid point values"); }
            const projectedPoint = projectPointOntoLine(point, line);
            const actualDistance = length3({
                x: point.x! - projectedPoint.x!,
                y: point.y! - projectedPoint.y!,
                z: point.z! - projectedPoint.z!,
            });
            return actualDistance - distance;
        }
        case ConstraintType.DistanceBetweenPointAndPlane: { //& inexact
            const { point, plane, distance } = constraint;
            if (!pointIsNonNull(point) || !pointIsNonNull(plane.point1) || !pointIsNonNull(plane.point2) || !pointIsNonNull(plane.point3)) { throw new Error("Invalid plane points"); }
            const projectedPoint = projectPointOntoPlane(point, plane);
            const actualDistance = length3({
                x: point.x! - projectedPoint.x!,
                y: point.y! - projectedPoint.y!,
                z: point.z! - projectedPoint.z!,
            });
            return actualDistance - distance;
        }
        case ConstraintType.PointOnLine: { //$ exact
            const { point, line } = constraint;
            if (!pointIsNonNull(point) || !pointIsNonNull(line.point1) || !pointIsNonNull(line.point2)) { throw new Error("Invalid point values"); }
            const projectedPoint = projectPointOntoLine(point, line);
            return distance3(point as Vector3D, projectedPoint as Vector3D);
        }
        case ConstraintType.PointOnLineSegment: { //$ exact
            const { point, line } = constraint;
            if (!pointIsNonNull(point) || !pointIsNonNull(line.point1) || !pointIsNonNull(line.point2)) { throw new Error("Invalid point values"); }
            const projectedPoint = projectPointOntoLine(point, line);
            const lineDir = getLineDirection(line.point1, line.point2);
            const projectedPointDir = getLineDirection(line.point1, projectedPoint);
            const dotProduct = dot3(lineDir, projectedPointDir);
            if (dotProduct < 0) {
                return distance3(point as Vector3D, line.point1 as Vector3D);
            }
            const lineLengthSquared = dot3(lineDir, lineDir);
            if (dotProduct > lineLengthSquared) {
                return distance3(point as Vector3D, line.point2 as Vector3D);
            }
            return distance3(point as Vector3D, projectedPoint as Vector3D);
        }
        case ConstraintType.PointOnPlane: { //$ exact
            const { point, plane } = constraint;
            if (!pointIsNonNull(point) || !pointIsNonNull(plane.point1) || !pointIsNonNull(plane.point2) || !pointIsNonNull(plane.point3)) { throw new Error("Invalid point values"); }
            const projectedPoint = projectPointOntoPlane(point, plane);
            return distance3(projectedPoint as Vector3D, point as Vector3D);
        }
        case ConstraintType.PointOnPolygon: { //$ exact
            const { point, polygon } = constraint;
            if (!pointIsNonNull(point) || polygon.points.some(p => !pointIsNonNull(p))) { throw new Error("Invalid point values"); }
            //? check if point is on the same plane as the polygon
            const plane = new _Plane(polygon.points[0]!, polygon.points[1]!, polygon.points[2]!, "tempPlane");
            const projectedPoint = projectPointOntoPlane(point, plane);
            if (distance3(projectedPoint as Vector3D, point as Vector3D) > TOLERANCE) {
                return distance3(projectedPoint as Vector3D, point as Vector3D);
            }
            //? check if the projected point is inside the polygon using barycentric coordinates
            const triangle = [polygon.points[0]!, polygon.points[1]!, polygon.points[2]!];
            const baryCoords = barycentricCoordinates2D({ x: projectedPoint.x!, y: projectedPoint.y! }, triangle.map(p => ({ x: p.x!, y: p.y! })) as [Vector3D, Vector3D, Vector3D]);
            if (baryCoords === null) {
                throw new Error("Failed to calculate barycentric coordinates for polygon");
            }
            const [w1, w2, w3] = baryCoords;
            if (w1 >= -TOLERANCE && w2 >= -TOLERANCE && w3 >= -TOLERANCE) {
                return 0;
            }
            return Math.min(distance3(projectedPoint as Vector3D, polygon.points[0] as Vector3D), distance3(projectedPoint as Vector3D, polygon.points[1] as Vector3D), distance3(projectedPoint as Vector3D, polygon.points[2] as Vector3D));
        }
        case ConstraintType.Parallel: { //$ exact
            const { line1, line2 } = constraint;
            if (!pointIsNonNull(line1.point1) || !pointIsNonNull(line1.point2) || !pointIsNonNull(line2.point1) || !pointIsNonNull(line2.point2)) { throw new Error("Invalid line points"); }
            const line1Dir = getLineDirection(line1.point1, line1.point2);
            const line2Dir = getLineDirection(line2.point1, line2.point2);
            const crossProduct = cross3(line1Dir, line2Dir);
            return length3(crossProduct);
        }
        case ConstraintType.Perpendicular: { //$ exact
            const { line1, line2 } = constraint;
            if (!pointIsNonNull(line1.point1) || !pointIsNonNull(line1.point2) || !pointIsNonNull(line2.point1) || !pointIsNonNull(line2.point2)) { throw new Error("Invalid line points"); }
            const line1Dir = getLineDirection(line1.point1, line1.point2);
            const line2Dir = getLineDirection(line2.point1, line2.point2);
            const dotProduct = dot3(line1Dir, line2Dir);
            return dotProduct;
        }
        case ConstraintType.Collinear: { //$ exact
            const { point1, point2 } = constraint;
            if (!pointIsNonNull(point1) || !pointIsNonNull(point2)) { throw new Error("Invalid point points"); }
            return distance3(point1 as Vector3D, point2 as Vector3D);
        }
        case ConstraintType.Coplanar: { //$ exact
            const { point1, point2 } = constraint;
            if (!pointIsNonNull(point1) || !pointIsNonNull(point2)) { throw new Error("Invalid point points"); }
            return distance3(point1 as Vector3D, point2 as Vector3D);
        }
        case ConstraintType.EqualLength: { //& inexact
            const { line1, line2 } = constraint;
            if (!pointIsNonNull(line1.point1) || !pointIsNonNull(line1.point2) || !pointIsNonNull(line2.point1) || !pointIsNonNull(line2.point2)) { throw new Error("Invalid line points"); }
            const line1Dir = getLineDirection(line1.point1, line1.point2);
            const line2Dir = getLineDirection(line2.point1, line2.point2);
            const lengthLine1 = length3(line1Dir);
            const lengthLine2 = length3(line2Dir);
            return lengthLine1 - lengthLine2;
        }
        default: {
            // @ts-ignore
            throw new Error(`Constraint type ${constraint.type} not implemented yet`);
        }
    }
}

/* -------------------------------------------------------------------------- */

enum SolverStatus {
    UNSOLVED = "unsolved",
    SOLVED = "solved",
    SOLVING = "solving",
    UNSOLVABLE = "unsolvable",
}
export type Solution = {
    points: Point[];
    lines: Line[];
    planes: Plane[];
    polygons: Polygon[];
    constraints: Constraint[];
    status: SolverStatus;
}
export type SolveIterationInfo = {
    iteration: number;
    loss: number;
    learningRate: number;
    gradients: number[];
};
export type SolveOptions = {
    onIteration?: (info: SolveIterationInfo) => void | Promise<void>;
    yieldToBrowser?: boolean;
};
type DegreeOfFreedom = {
    object: Point | Line | Plane | Polygon;
    property: string;
}
export class ConstraintSolver {
    private _points: _Point[] = [];
    private _lines: _Line[] = []
    private _planes: _Plane[] = [];
    private _polygons: _Polygon[] = []
    private _constraints: Constraint[] = [];
    private _status: SolverStatus;
    private _degreesOfFreedom: DegreeOfFreedom[] = [];

    constructor() {
        this._status = SolverStatus.UNSOLVED;
    }

    get points() { return this._points; }
    get lines() { return this._lines; }
    get planes() { return this._planes; }
    get polygons() { return this._polygons; }
    get constraints() { return this._constraints; }
    get status() { return this._status; }

    public addPoint(name?: string): Point {
        const getPointName = (): string => {
            const usedNames = new Set(this._points.map(p => p.name));
            const availableNames = POINT_NAMES.split("").filter(name => !usedNames.has(name));
            if (availableNames.length === 0) {
                throw new Error("Ran out of point names");
            }
            return availableNames[0]!;
        }

        const point = new _Point(name ?? getPointName());
        this._points.push(point);
        return point;
    }

    public addLine(point1: Point, point2: Point, name?: string): Line {
        const getLineName = (): string => {
            const usedNames = new Set(this._lines.map(l => l.name));
            const availableNames = LINE_NAMES.split("").filter(name => !usedNames.has(name));
            if (availableNames.length === 0) {
                throw new Error("Ran out of line names");
            }
            return availableNames[0]!;
        }

        const line = new _Line(point1, point2, name ?? getLineName());
        this._lines.push(line);
        return line;
    }

    public addPlane(point1: Point, point2: Point, point3: Point, name?: string): Plane {
        const getPlaneName = (): string => {
            const usedNames = new Set(this._planes.map(p => p.name));
            const availableNames = PLANE_NAMES.split("").filter(name => !usedNames.has(name));
            if (availableNames.length === 0) {
                throw new Error("Ran out of plane names");
            }
            return availableNames[0]!;
        }

        const plane = new _Plane(point1, point2, point3, name ?? getPlaneName());
        this._planes.push(plane);
        return plane;
    }

    public addPolygon(points: Point[], name?: string): Polygon {
        const getPolygonName = (): string => {
            const usedNames = new Set(this._polygons.map(p => p.name));
            const availableNames = POLYGON_NAMES.split("").filter(name => !usedNames.has(name));
            if (availableNames.length === 0) {
                throw new Error("Ran out of polygon names");
            }
            return availableNames[0]!;
        }

        const polygon = new _Polygon(points, name ?? getPolygonName());
        this._polygons.push(polygon);
        return polygon;
    }

    public addConstraint(constraint: Constraint) {
        this._constraints.push(constraint);
    }

    public async solve(options: SolveOptions = {}): Promise<Solution> {
        this._status = SolverStatus.SOLVING;
        this._degreesOfFreedom = [];

        // reset all points to null
        for (const point of this._points) {
            point.x = null;
            point.y = null;
            point.z = null;
        }

        // fixed positions
        for (const constraint of this._constraints) {
            if (constraint.type === ConstraintType.Position) {
                constraint.point.x = constraint.position.x;
                constraint.point.y = constraint.position.y;
                constraint.point.z = constraint.position.z;
            }
        }

        // get degrees of freedom
        const RANDOM_RANGE = { min: -500, max: 500 };
        for (const point of this._points) {
            if (point.x === null) {
                this._degreesOfFreedom.push({ object: point, property: "x" });
                point.x = Math.random() * (RANDOM_RANGE.max - RANDOM_RANGE.min) + RANDOM_RANGE.min;
            }
            if (point.y === null) {
                this._degreesOfFreedom.push({ object: point, property: "y" });
                point.y = Math.random() * (RANDOM_RANGE.max - RANDOM_RANGE.min) + RANDOM_RANGE.min;
            }
            if (point.z === null) {
                this._degreesOfFreedom.push({ object: point, property: "z" });
                point.z = Math.random() * (RANDOM_RANGE.max - RANDOM_RANGE.min) + RANDOM_RANGE.min;
            }
        }

        // gradient descent
        const MAX_ITERATIONS = 10000;
        const LOSS_TOLERANCE = 1e-2;
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const loss = this.getTotalLoss();
            console.log(`Iteration ${iteration}: loss = ${loss}`);
            const learningRate = this.getLearningRate(iteration);
            const gradients: number[] = this._degreesOfFreedom.map(dof => this.getGradient(dof));

            await options.onIteration?.({
                iteration,
                loss,
                learningRate,
                gradients,
            });

            if (loss < LOSS_TOLERANCE) { break; }

            this._degreesOfFreedom.forEach((dof, index) => {
                (dof.object as any)[dof.property] -= learningRate * gradients[index]! * this.getTemperature(iteration);
            });

            if (options.yieldToBrowser !== false) {
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
        }

        this._status = this.constraints.every(constraintIsSatisfied) ? SolverStatus.SOLVED : SolverStatus.UNSOLVABLE;
        return {
            points: this._points,
            lines: this._lines,
            planes: this._planes,
            polygons: this._polygons,
            constraints: this._constraints,
            status: this._status,
        };
    }

    private getGradient(dof: DegreeOfFreedom): number {
        const originalValue = (dof.object as any)[dof.property];
        const delta = 1e-5;
        (dof.object as any)[dof.property] = originalValue + delta;
        const lossPlus = this._constraints.reduce((totalLoss, constraint) => totalLoss + Math.abs(scaledConstraintSignedLoss(constraint)), 0);
        (dof.object as any)[dof.property] = originalValue - delta;
        const lossMinus = this._constraints.reduce((totalLoss, constraint) => totalLoss + Math.abs(scaledConstraintSignedLoss(constraint)), 0);
        (dof.object as any)[dof.property] = originalValue;
        return (lossPlus - lossMinus) / (2 * delta);
    }

    private getTotalLoss(): number {
        return this._constraints.reduce((totalLoss, constraint) => {
            const constraintLoss = scaledConstraintSignedLoss(constraint);
            console.log(`Constraint ${constraint.type} loss: ${constraintLoss}`);
            return totalLoss + Math.abs(constraintLoss);
        }, 0);
    }

    private getLearningRate(_iteration: number): number {
        // return 0.05;
        const MAX_LEARNING_RATE = 0.05;
        const MIN_LEARNING_RATE = 0.001;
        const DECAY_RATE = 0.001;
        return Math.max(MIN_LEARNING_RATE, MAX_LEARNING_RATE * Math.exp(-DECAY_RATE * _iteration));
    }

    private getTemperature(iteration: number): number {
        // return 10;
        const MAX_TEMPERATURE = 10;
        const MIN_TEMPERATURE = 0.01;
        const DECAY_RATE = 0.001;
        return Math.max(MIN_TEMPERATURE, MAX_TEMPERATURE * Math.exp(-DECAY_RATE * iteration));
    }
}