import type { Tri, Line, Point } from "@lib/geometry";
import { Matrix, Vector } from "ts-matrix";
import { toVector, toVector3D, vectorLengthSquared, type Matrix3x3, type Matrix3x4, type Vector2D, type Vector3D } from "./mathExtra";

const PALETTE = {
    point: "#ff0000",
    line: "#0000ff",
    tri: "#cccccc",
    annotation: "#000000",
};

export type Annotation = {
    text: string;
    position: Point;
    colour?: string;
}

export enum ProjectionType {
    PERSPECTIVE = "perspective",
    ORTHOGRAPHIC = "orthographic",
}
export class Camera {
    private _projectionType: ProjectionType;
    private _position: Vector3D;
    private _lookAtTarget: Vector3D;
    private _upHint: Vector3D;
    private _focalLengths: Vector2D;
    private _principalPoint: Vector2D
    private _skewCoefficient: number;

    private _intrinsicMatrix: Matrix3x3 = null as any;
    private _extrinsicMatrix: Matrix3x4 = null as any;
    public projectionMatrix: Matrix = null as any;

    constructor(
        projectionType: ProjectionType,
        position: Vector3D,
        lookAtTarget: Vector3D,
        focalLengths: Vector2D,
        principalPoint: Vector2D = { x: 0, y: 0 },
        skewCoefficient: number = 0,
    ) {
        this._position = position;
        this._lookAtTarget = lookAtTarget;
        this._upHint = { x: 0, y: 0, z: 1 };
        this._focalLengths = focalLengths;
        this._principalPoint = principalPoint;
        this._projectionType = projectionType;
        this._skewCoefficient = skewCoefficient;

        this.updateCameraMatrices();
    }

    set position(position: Vector3D) {
        this._position = position;
        this.updateCameraMatrices();
    }

    set upHint(upHint: Vector3D) {
        this._upHint = upHint;
        this.updateCameraMatrices();
    }

    get projectionType(): ProjectionType {
        return this._projectionType;
    }

    set projectionType(projectionType: ProjectionType) {
        this._projectionType = projectionType;
        this.updateCameraMatrices();
    }

    public getForwardDepth(point: Vector3D): number {
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());
        const delta = {
            x: point.x - this._position.x,
            y: point.y - this._position.y,
            z: point.z - this._position.z,
        };
        return forward.x * delta.x + forward.y * delta.y + forward.z * delta.z;
    }
    public toCameraSpace(point: Vector3D): Vector3D {
        const { right, up, negForward } = this.computeCameraFrame();
        const delta = {
            x: point.x - this._position.x,
            y: point.y - this._position.y,
            z: point.z - this._position.z,
        };

        return {
            x: right.x * delta.x + right.y * delta.y + right.z * delta.z,
            y: up.x * delta.x + up.y * delta.y + up.z * delta.z,
            z: negForward.x * delta.x + negForward.y * delta.y + negForward.z * delta.z,
        };
    }

    private updateCameraMatrices(): void {
        this._intrinsicMatrix = this.computeCameraIntrinsicMatrix();
        this._extrinsicMatrix = this.computeCameraExtrinsicMatrix();
        this.projectionMatrix = this.computeCameraProjectionMatrix();
    }
    private computeCameraFrame(): { forward: Vector3D; right: Vector3D; up: Vector3D; negForward: Vector3D } {
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());

        let upReference = toVector3D(toVector(this._upHint).normalize());
        let rightVector = toVector(upReference).cross(toVector(forward));

        if (vectorLengthSquared(toVector3D(rightVector)) < 1e-12) {
            const fallbackUp: Vector3D = { x: 1, y: 0, z: 0 };
            upReference = fallbackUp;
            rightVector = toVector(fallbackUp).cross(toVector(forward));
        }

        const right = toVector3D(rightVector.normalize());
        const up = toVector3D(toVector(forward).cross(toVector(right)).normalize());
        const negForward: Vector3D = { x: -forward.x, y: -forward.y, z: -forward.z };

        return { forward, right, up, negForward };
    }

    private computeCameraIntrinsicMatrix(): Matrix3x3 {
        const focalLengthScalar = this._projectionType === ProjectionType.ORTHOGRAPHIC ? 1 : 800;
        return [
            [this._focalLengths.x * focalLengthScalar, this._skewCoefficient, this._principalPoint.x],
            [0, this._focalLengths.y * focalLengthScalar, this._principalPoint.y],
            [0, 0, 1],
        ];
    }

    private computeCameraExtrinsicMatrix(): Matrix3x4 {
        const { right, up, negForward } = this.computeCameraFrame();

        // Compute translation in camera space: -R * position
        const t_cam_x = -(right.x * this._position.x + right.y * this._position.y + right.z * this._position.z);
        const t_cam_y = -(up.x * this._position.x + up.y * this._position.y + up.z * this._position.z);
        const t_cam_z = -(negForward.x * this._position.x + negForward.y * this._position.y + negForward.z * this._position.z);

        return [
            [right.x, right.y, right.z, t_cam_x],
            [up.x, up.y, up.z, t_cam_y],
            this._projectionType === ProjectionType.ORTHOGRAPHIC
                ? [0, 0, 0, 1]
                : [negForward.x, negForward.y, negForward.z, t_cam_z],
        ];
    }

    private computeCameraProjectionMatrix(): Matrix {
        return new Matrix(3, 3, this._intrinsicMatrix).multiply(new Matrix(3, 4, this._extrinsicMatrix));
    }
};

type ProjectedPoint = {
    x: number;
    y: number;
    depth: number;
    withinRenderFrustrum: boolean;
    colour: string | undefined;
    cameraSpace: Vector3D;
};
type ProjectedLine = [ProjectedPoint, ProjectedPoint];
type ProjectedTri = [ProjectedPoint, ProjectedPoint, ProjectedPoint];

function _project(camera: Camera, point: Point): ProjectedPoint {
    const pointVector = new Vector([point.x, point.y, point.z, 1]);
    const projectedVector = camera.projectionMatrix.multiplyVector(pointVector);
    const depth = camera.getForwardDepth({ x: point.x, y: point.y, z: point.z });
    const cameraSpace = camera.toCameraSpace({ x: point.x, y: point.y, z: point.z });

    // Extract x, y, z from the 3D result
    const x_proj = projectedVector.at(0);
    const y_proj = projectedVector.at(1);

    if (camera.projectionType === ProjectionType.ORTHOGRAPHIC) {
        return {
            x: x_proj,
            y: y_proj,
            depth,
            cameraSpace,
            withinRenderFrustrum: true,
            colour: point.colour,
        };
    }

    if (depth <= 1e-6) {
        return {
            x: x_proj,
            y: y_proj,
            depth,
            cameraSpace,
            withinRenderFrustrum: false,
            colour: point.colour,
        };
    }

    // Perspective divide uses forward depth along the camera view direction.
    return {
        x: x_proj / depth,
        y: y_proj / depth,
        depth,
        cameraSpace,
        withinRenderFrustrum: true,
        colour: point.colour,
    };
}
const GEOMETRY_EPSILON = 1e-7;
const DEPTH_EPSILON = 1e-6;

type Interval = {
    start: number;
    end: number;
};

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function subtract2D(point1: { x: number; y: number }, point2: { x: number; y: number }): { x: number; y: number } {
    return { x: point1.x - point2.x, y: point1.y - point2.y };
}

function cross2D(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    return point1.x * point2.y - point1.y * point2.x;
}

function orient2D(point1: { x: number; y: number }, point2: { x: number; y: number }, point3: { x: number; y: number }): number {
    return cross2D(subtract2D(point2, point1), subtract2D(point3, point1));
}

function triangleSignedArea2D(triangle: ProjectedTri): number {
    return orient2D(triangle[0], triangle[1], triangle[2]);
}

function isStrictlyInsideTriangle(point: { x: number; y: number }, triangle: ProjectedTri): boolean {
    const weights = barycentricCoordinates2D(point, triangle);
    if (weights === null) {
        return false;
    }

    return weights[0] > GEOMETRY_EPSILON && weights[1] > GEOMETRY_EPSILON && weights[2] > GEOMETRY_EPSILON;
}

function lineSegmentIntersectionParameter(
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number },
): number | null {
    const lineVector = subtract2D(lineEnd, lineStart);
    const segmentVector = subtract2D(segmentEnd, segmentStart);
    const denominator = cross2D(lineVector, segmentVector);

    if (Math.abs(denominator) < GEOMETRY_EPSILON) {
        return null;
    }

    const difference = subtract2D(segmentStart, lineStart);
    const lineParameter = cross2D(difference, segmentVector) / denominator;
    const segmentParameter = cross2D(difference, lineVector) / denominator;

    if (lineParameter < -GEOMETRY_EPSILON || lineParameter > 1 + GEOMETRY_EPSILON) {
        return null;
    }

    if (segmentParameter < -GEOMETRY_EPSILON || segmentParameter > 1 + GEOMETRY_EPSILON) {
        return null;
    }

    return Math.min(1, Math.max(0, lineParameter));
}

function barycentricCoordinates2D(point: { x: number; y: number }, triangle: ProjectedTri): [number, number, number] | null {
    const point1 = triangle[0];
    const point2 = triangle[1];
    const point3 = triangle[2];

    const denominator = orient2D(point1, point2, point3);
    if (Math.abs(denominator) < GEOMETRY_EPSILON) {
        return null;
    }

    const weight1 = orient2D(point, point2, point3) / denominator;
    const weight2 = orient2D(point, point3, point1) / denominator;
    const weight3 = 1 - weight1 - weight2;
    return [weight1, weight2, weight3];
}

function triangleDepthAtProjectedPoint(triangle: ProjectedTri, point: { x: number; y: number }, projectionType: ProjectionType): number | null {
    const weights = barycentricCoordinates2D(point, triangle);
    if (weights === null) {
        return null;
    }

    if (projectionType === ProjectionType.ORTHOGRAPHIC) {
        return weights[0] * triangle[0].depth + weights[1] * triangle[1].depth + weights[2] * triangle[2].depth;
    }

    const reciprocalDepth = weights[0] / triangle[0].depth + weights[1] / triangle[1].depth + weights[2] / triangle[2].depth;
    if (Math.abs(reciprocalDepth) < GEOMETRY_EPSILON) {
        return null;
    }

    return 1 / reciprocalDepth;
}

function interpolateProjectedPoint(point1: ProjectedPoint, point2: ProjectedPoint, t: number): ProjectedPoint {
    return {
        x: lerp(point1.x, point2.x, t),
        y: lerp(point1.y, point2.y, t),
        depth: lerp(point1.depth, point2.depth, t),
        cameraSpace: {
            x: lerp(point1.cameraSpace.x, point2.cameraSpace.x, t),
            y: lerp(point1.cameraSpace.y, point2.cameraSpace.y, t),
            z: lerp(point1.cameraSpace.z, point2.cameraSpace.z, t),
        },
        withinRenderFrustrum: point1.withinRenderFrustrum && point2.withinRenderFrustrum,
        colour: point1.colour ?? point2.colour,
    };
}

function clipLineToTriangleProjection(line: ProjectedLine, triangle: ProjectedTri): Interval | null {
    const signedArea = triangleSignedArea2D(triangle);
    if (Math.abs(signedArea) < GEOMETRY_EPSILON) {
        return null;
    }

    const lineStart = line[0];
    const lineEnd = line[1];
    const splitParameters: number[] = [0, 1];

    for (let index = 0; index < 3; index += 1) {
        const edgeStart = triangle[index]!;
        const edgeEnd = triangle[(index + 1) % 3]!;
        const intersectionParameter = lineSegmentIntersectionParameter(lineStart, lineEnd, edgeStart, edgeEnd);
        if (intersectionParameter !== null && intersectionParameter > GEOMETRY_EPSILON && intersectionParameter < 1 - GEOMETRY_EPSILON) {
            splitParameters.push(intersectionParameter);
        }
    }

    splitParameters.sort((parameter1, parameter2) => parameter1 - parameter2);

    const uniqueParameters: number[] = [];
    for (const parameter of splitParameters) {
        const previousParameter = uniqueParameters[uniqueParameters.length - 1];
        if (previousParameter === undefined || Math.abs(parameter - previousParameter) > GEOMETRY_EPSILON) {
            uniqueParameters.push(parameter);
        }
    }

    let intervalStart: number | null = null;
    let intervalEnd: number | null = null;

    for (let index = 0; index < uniqueParameters.length - 1; index += 1) {
        const startParameter = uniqueParameters[index];
        const endParameter = uniqueParameters[index + 1];
        if (startParameter === undefined || endParameter === undefined) {
            continue;
        }

        if (endParameter - startParameter <= GEOMETRY_EPSILON) {
            continue;
        }

        const midpointParameter = (startParameter + endParameter) / 2;
        const midpoint = {
            x: lerp(lineStart.x, lineEnd.x, midpointParameter),
            y: lerp(lineStart.y, lineEnd.y, midpointParameter),
        };

        if (!isStrictlyInsideTriangle(midpoint, triangle)) {
            continue;
        }

        intervalStart = intervalStart === null ? startParameter : intervalStart;
        intervalEnd = endParameter;
        break;
    }

    if (intervalStart === null || intervalEnd === null || intervalEnd - intervalStart <= GEOMETRY_EPSILON) {
        return null;
    }

    return { start: intervalStart, end: intervalEnd };
}

function triangleNormal(point1: Vector3D, point2: Vector3D, point3: Vector3D): Vector3D {
    const edge1 = {
        x: point2.x - point1.x,
        y: point2.y - point1.y,
        z: point2.z - point1.z,
    };
    const edge2 = {
        x: point3.x - point1.x,
        y: point3.y - point1.y,
        z: point3.z - point1.z,
    };

    return {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x,
    };
}

function dot3(point1: Vector3D, point2: Vector3D): number {
    return point1.x * point2.x + point1.y * point2.y + point1.z * point2.z;
}

function linePlaneIntersectionParameter(line: ProjectedLine, triangle: ProjectedTri): number | null {
    const point1 = line[0].cameraSpace;
    const point2 = line[1].cameraSpace;
    const triPoint1 = triangle[0].cameraSpace;
    const triPoint2 = triangle[1].cameraSpace;
    const triPoint3 = triangle[2].cameraSpace;

    const normal = triangleNormal(triPoint1, triPoint2, triPoint3);
    const normalLengthSquared = dot3(normal, normal);
    if (normalLengthSquared < GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
        return null;
    }

    const direction = {
        x: point2.x - point1.x,
        y: point2.y - point1.y,
        z: point2.z - point1.z,
    };
    const denominator = dot3(normal, direction);
    const distanceFromLineStart = dot3(normal, {
        x: triPoint1.x - point1.x,
        y: triPoint1.y - point1.y,
        z: triPoint1.z - point1.z,
    });

    if (Math.abs(denominator) < GEOMETRY_EPSILON || Math.abs(distanceFromLineStart) < GEOMETRY_EPSILON) {
        return null;
    }

    return distanceFromLineStart / denominator;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
    const sortedIntervals = intervals
        .filter(interval => interval.end - interval.start > GEOMETRY_EPSILON)
        .sort((interval1, interval2) => interval1.start - interval2.start);

    const mergedIntervals: Interval[] = [];

    for (const interval of sortedIntervals) {
        const previousInterval = mergedIntervals[mergedIntervals.length - 1];
        if (previousInterval && interval.start <= previousInterval.end + GEOMETRY_EPSILON) {
            previousInterval.end = Math.max(previousInterval.end, interval.end);
            continue;
        }

        mergedIntervals.push({ start: interval.start, end: interval.end });
    }

    return mergedIntervals;
}

function getHiddenIntervalsForLine(line: ProjectedLine, triangles: ProjectedTri[], projectionType: ProjectionType): Interval[] {
    const hiddenIntervals: Interval[] = [];

    for (const triangle of triangles) {
        const projectedInterval = clipLineToTriangleProjection(line, triangle);
        if (projectedInterval === null) {
            continue;
        }

        const planeIntersectionParameter = linePlaneIntersectionParameter(line, triangle);
        const splitParameters: number[] = [projectedInterval.start, projectedInterval.end];

        if (planeIntersectionParameter !== null && planeIntersectionParameter > projectedInterval.start + GEOMETRY_EPSILON && planeIntersectionParameter < projectedInterval.end - GEOMETRY_EPSILON) {
            splitParameters.push(planeIntersectionParameter);
        }

        splitParameters.sort((parameter1, parameter2) => parameter1 - parameter2);

        for (let index = 0; index < splitParameters.length - 1; index += 1) {
            const subIntervalStart = splitParameters[index];
            const subIntervalEnd = splitParameters[index + 1];
            if (subIntervalStart === undefined || subIntervalEnd === undefined) {
                continue;
            }
            if (subIntervalEnd - subIntervalStart <= GEOMETRY_EPSILON) {
                continue;
            }

            const midpoint = (subIntervalStart + subIntervalEnd) / 2;
            const lineDepth = lerp(line[0].depth, line[1].depth, midpoint);
            const linePoint = {
                x: lerp(line[0].x, line[1].x, midpoint),
                y: lerp(line[0].y, line[1].y, midpoint),
            };
            const triangleDepth = triangleDepthAtProjectedPoint(triangle, linePoint, projectionType);

            if (triangleDepth === null) {
                continue;
            }

            if (lineDepth > triangleDepth + DEPTH_EPSILON) {
                hiddenIntervals.push({ start: subIntervalStart, end: subIntervalEnd });
            }
        }
    }

    return mergeIntervals(hiddenIntervals);
}

/* -------------------------------------------------------------------------- */

export type DrawOptions = {
    renderPoints?: boolean;
    renderAnnotations?: boolean;
    triOpacity?: number;
    annotationsAlwaysOnTop?: boolean;
    lineThickness?: number;
}

export function draw3D(
    paper: HTMLElement & SVGElement,
    camera: Camera,
    points: Point[],
    lines: Line[],
    tris: Tri[],
    annotations: Annotation[],
    options: DrawOptions = {
        renderPoints: true,
        renderAnnotations: true,
        triOpacity: 0.1,
        annotationsAlwaysOnTop: true,
        lineThickness: 2,
    },
): void {
    enum DrawableType {
        POINT = "point",
        LINE = "line",
        TRI = "tri",
        ANNOTATION = "annotation",
    }

    type Drawable = {
        depth: number;
        colour?: string | undefined;
    } & (
            | { type: DrawableType.POINT; data: ProjectedPoint }
            | { type: DrawableType.LINE; data: ProjectedLine, dashed?: boolean }
            | { type: DrawableType.TRI; data: ProjectedTri }
            | { type: DrawableType.ANNOTATION; data: Annotation }
        );

    /* -------------------------------------------------------------------------- */

    const projectCache = new Map<Point, ProjectedPoint>();
    function project(point: Point): ProjectedPoint {
        if (projectCache.has(point)) {
            return projectCache.get(point)!;
        }
        const projected = _project(camera, point);
        projectCache.set(point, projected);
        return projected;
    }

    /* -------------------------------------------------------------------------- */

    paper.innerHTML = "";
    drawGeometry();

    /* -------------------------------------------------------------------------- */

    function drawGeometry() {
        const drawables: Drawable[] = [];
        const projectedTriangles: ProjectedTri[] = [];

        for (const tri of tris) {
            const [point1, point2, point3] = tri.points;
            const projectedPoint1 = project(point1);
            const projectedPoint2 = project(point2);
            const projectedPoint3 = project(point3);
            const averageDepth = (projectedPoint1.depth + projectedPoint2.depth + projectedPoint3.depth) / 3;
            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum || !projectedPoint3.withinRenderFrustrum)) { continue; }
            projectedTriangles.push([projectedPoint1, projectedPoint2, projectedPoint3]);
            drawables.push({
                type: DrawableType.TRI,
                colour: tri.colour,
                data: [projectedPoint1, projectedPoint2, projectedPoint3],
                depth: averageDepth,
            });
        }

        for (const line of lines) {
            const [point1, point2] = line.points;
            const projectedPoint1 = project(point1);
            const projectedPoint2 = project(point2);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum)) { continue; }

            const lineSegments = getHiddenIntervalsForLine([projectedPoint1, projectedPoint2], projectedTriangles, camera.projectionType);
            const segmentBoundaries: Interval[] = lineSegments.length > 0 ? lineSegments : [];
            let currentStart = 0;

            const pushSegment = (startT: number, endT: number, dashed: boolean): void => {
                if (endT - startT <= GEOMETRY_EPSILON) {
                    return;
                }

                const startPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, startT);
                const endPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, endT);
                drawables.push({
                    type: DrawableType.LINE,
                    colour: line.colour,
                    data: [startPoint, endPoint],
                    depth: (startPoint.depth + endPoint.depth) / 2,
                    dashed,
                });
            };

            for (const interval of segmentBoundaries) {
                pushSegment(currentStart, interval.start, false);
                pushSegment(interval.start, interval.end, true);
                currentStart = interval.end;
            }

            pushSegment(currentStart, 1, false);
        }

        if (options.renderPoints) {
            for (const point of points) {
                const projectedPoint = project(point);
                if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPoint.withinRenderFrustrum) { continue; }
                drawables.push({
                    type: DrawableType.POINT,
                    depth: projectedPoint.depth,
                    colour: projectedPoint.colour,
                    data: projectedPoint,
                });
            }
        }

        if (options.renderAnnotations) {
            for (const annotation of annotations) {
                const projectedPosition = project(annotation.position);
                if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPosition.withinRenderFrustrum) { continue; }
                drawables.push({
                    type: DrawableType.ANNOTATION,
                    depth: options.annotationsAlwaysOnTop ? -Infinity : projectedPosition.depth,
                    data: annotation,
                });
            }
        }

        drawables.sort((a, b) => b.depth - a.depth);
        for (const drawable of drawables) {
            switch (drawable.type) {
                case DrawableType.POINT: {
                    const projectedPoint = drawable.data;
                    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", projectedPoint.x.toString());
                    circle.setAttribute("cy", projectedPoint.y.toString());
                    circle.setAttribute("r", "5");
                    circle.setAttribute("fill", projectedPoint.colour ?? PALETTE.point);
                    paper.appendChild(circle);
                    break;
                }
                case DrawableType.LINE: {
                    const [projectedPoint1, projectedPoint2] = drawable.data;
                    const lineElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    lineElement.setAttribute("x1", projectedPoint1.x.toString());
                    lineElement.setAttribute("y1", projectedPoint1.y.toString());
                    lineElement.setAttribute("x2", projectedPoint2.x.toString());
                    lineElement.setAttribute("y2", projectedPoint2.y.toString());
                    lineElement.setAttribute("stroke", drawable.colour ?? PALETTE.line);
                    lineElement.setAttribute("stroke-width", (options.lineThickness ?? 2).toString());
                    if (drawable.dashed) {
                        lineElement.setAttribute("stroke-dasharray", `${Math.max(options.lineThickness ?? 2, 1) * 4} ${Math.max(options.lineThickness ?? 2, 1) * 3}`);
                    }
                    lineElement.setAttribute("stroke-linecap", "round");
                    lineElement.setAttribute("stroke-linejoin", "round");
                    lineElement.setAttribute("shape-rendering", "geometricPrecision");
                    paper.appendChild(lineElement);
                    break;
                }
                case DrawableType.TRI: {
                    const [projectedPoint1, projectedPoint2, projectedPoint3] = drawable.data;
                    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    polygon.setAttribute("points", `${projectedPoint1.x},${projectedPoint1.y} ${projectedPoint2.x},${projectedPoint2.y} ${projectedPoint3.x},${projectedPoint3.y}`);
                    polygon.setAttribute("fill", drawable.colour ?? PALETTE.tri);
                    polygon.setAttribute("fill-opacity", options.triOpacity?.toString() ?? "0.1");
                    polygon.setAttribute("stroke-linejoin", "round");
                    polygon.setAttribute("shape-rendering", "geometricPrecision");
                    paper.appendChild(polygon);
                    break;
                }
                case DrawableType.ANNOTATION: {
                    const annotation = drawable.data;
                    const projectedPosition = project(annotation.position);
                    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    textElement.setAttribute("x", projectedPosition.x.toString());
                    textElement.setAttribute("y", projectedPosition.y.toString());
                    textElement.setAttribute("fill", annotation.colour ?? PALETTE.annotation);
                    textElement.setAttribute("dominant-baseline", "middle");
                    textElement.setAttribute("text-anchor", "middle");
                    textElement.textContent = annotation.text;
                    paper.appendChild(textElement);
                    break;
                }
            }
        }
    }
}