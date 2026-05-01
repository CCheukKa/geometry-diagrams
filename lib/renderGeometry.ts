import type { Point } from "@lib/geometry";
import { Vector } from "ts-matrix";
import { barycentricCoordinates2D, cross2D, dot3, lerp, orient2D, subtract2D, triangleNormal, type Vector3D } from "./mathExtra";
import { Camera, ProjectionType } from "@lib/camera";

export type ProjectedPoint = {
    x: number;
    y: number;
    depth: number;
    withinRenderFrustrum: boolean;
    colour: string | undefined;
    cameraSpace: Vector3D;
};

export type ProjectedLine = [ProjectedPoint, ProjectedPoint];
export type ProjectedTri = [ProjectedPoint, ProjectedPoint, ProjectedPoint];

export type Interval = {
    start: number;
    end: number;
};

const GEOMETRY_EPSILON = 1e-7;
const DEPTH_EPSILON = 1e-6;

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

export function projectPoint(camera: Camera, point: Point): ProjectedPoint {
    const pointVector = new Vector([point.x, point.y, point.z, 1]);
    const projectedVector = camera.projectionMatrix.multiplyVector(pointVector);
    const depth = camera.getForwardDepth({ x: point.x, y: point.y, z: point.z });
    const cameraSpace = camera.toCameraSpace({ x: point.x, y: point.y, z: point.z });

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

    return {
        x: x_proj / depth,
        y: y_proj / depth,
        depth,
        cameraSpace,
        withinRenderFrustrum: true,
        colour: point.colour,
    };
}

export function interpolateProjectedPoint(point1: ProjectedPoint, point2: ProjectedPoint, t: number): ProjectedPoint {
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

export function getHiddenIntervalsForLine(line: ProjectedLine, triangles: ProjectedTri[], projectionType: ProjectionType): Interval[] {
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
