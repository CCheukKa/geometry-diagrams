import type { Vertex } from "@lib/geometry";
import { Vector } from "ts-matrix";
import { barycentricCoordinates2D, cross2D, dot3, lerp, orient2D, subtract2D, triangleNormal, type Vector3D } from "./mathExtra";
import { Camera, ProjectionType } from "@lib/camera";

export type ProjectedVertex = {
    x: number;
    y: number;
    depth: number;
    withinRenderFrustrum: boolean;
    colour: string | undefined;
    cameraSpace: Vector3D;
};

export type ProjectedEdge = [ProjectedVertex, ProjectedVertex];
export type ProjectedTriangle = [ProjectedVertex, ProjectedVertex, ProjectedVertex];

export type Interval = {
    start: number;
    end: number;
};

const GEOMETRY_EPSILON = 1e-7;
const DEPTH_EPSILON = 1e-6;

function triangleSignedArea2D(triangle: ProjectedTriangle): number {
    return orient2D(triangle[0], triangle[1], triangle[2]);
}

function isStrictlyInsideTriangle(vertex: { x: number; y: number }, triangle: ProjectedTriangle): boolean {
    const weights = barycentricCoordinates2D(vertex, triangle);
    if (weights === null) {
        return false;
    }

    return weights[0] > GEOMETRY_EPSILON && weights[1] > GEOMETRY_EPSILON && weights[2] > GEOMETRY_EPSILON;
}

function edgeSegmentIntersectionParameter(
    edgeStart: { x: number; y: number },
    edgeEnd: { x: number; y: number },
    segmentStart: { x: number; y: number },
    segmentEnd: { x: number; y: number },
): number | null {
    const edgeVector = subtract2D(edgeEnd, edgeStart);
    const segmentVector = subtract2D(segmentEnd, segmentStart);
    const denominator = cross2D(edgeVector, segmentVector);

    if (Math.abs(denominator) < GEOMETRY_EPSILON) {
        return null;
    }

    const difference = subtract2D(segmentStart, edgeStart);
    const edgeParameter = cross2D(difference, segmentVector) / denominator;
    const segmentParameter = cross2D(difference, edgeVector) / denominator;

    if (edgeParameter < -GEOMETRY_EPSILON || edgeParameter > 1 + GEOMETRY_EPSILON) {
        return null;
    }

    if (segmentParameter < -GEOMETRY_EPSILON || segmentParameter > 1 + GEOMETRY_EPSILON) {
        return null;
    }

    return Math.min(1, Math.max(0, edgeParameter));
}

function triangleDepthAtProjectedVertex(triangle: ProjectedTriangle, vertex: { x: number; y: number }, projectionType: ProjectionType): number | null {
    const weights = barycentricCoordinates2D(vertex, triangle);
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

function edgePlaneIntersectionParameter(edge: ProjectedEdge, triangle: ProjectedTriangle): number | null {
    const vertex1 = edge[0].cameraSpace;
    const vertex2 = edge[1].cameraSpace;
    const triangleVertex1 = triangle[0].cameraSpace;
    const triangleVertex2 = triangle[1].cameraSpace;
    const triangleVertex3 = triangle[2].cameraSpace;

    const normal = triangleNormal(triangleVertex1, triangleVertex2, triangleVertex3);
    const normalLengthSquared = dot3(normal, normal);
    if (normalLengthSquared < GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
        return null;
    }

    const direction = {
        x: vertex2.x - vertex1.x,
        y: vertex2.y - vertex1.y,
        z: vertex2.z - vertex1.z,
    };
    const denominator = dot3(normal, direction);
    const distanceFromEdgeStart = dot3(normal, {
        x: triangleVertex1.x - vertex1.x,
        y: triangleVertex1.y - vertex1.y,
        z: triangleVertex1.z - vertex1.z,
    });

    if (Math.abs(denominator) < GEOMETRY_EPSILON || Math.abs(distanceFromEdgeStart) < GEOMETRY_EPSILON) {
        return null;
    }

    return distanceFromEdgeStart / denominator;
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

export function projectVertex(camera: Camera, vertex: Vertex): ProjectedVertex {
    const vertexVector = new Vector([vertex.x, vertex.y, vertex.z, 1]);
    const projectedVector = camera.projectionMatrix.multiplyVector(vertexVector);
    const depth = camera.getForwardDepth({ x: vertex.x, y: vertex.y, z: vertex.z });
    const cameraSpace = camera.toCameraSpace({ x: vertex.x, y: vertex.y, z: vertex.z });

    const x_proj = projectedVector.at(0);
    const y_proj = projectedVector.at(1);

    if (camera.projectionType === ProjectionType.ORTHOGRAPHIC) {
        return {
            x: x_proj,
            y: y_proj,
            depth,
            cameraSpace,
            withinRenderFrustrum: true,
            colour: vertex.colour,
        };
    }

    if (depth <= 1e-6) {
        return {
            x: x_proj,
            y: y_proj,
            depth,
            cameraSpace,
            withinRenderFrustrum: false,
            colour: vertex.colour,
        };
    }

    return {
        x: x_proj / depth,
        y: y_proj / depth,
        depth,
        cameraSpace,
        withinRenderFrustrum: true,
        colour: vertex.colour,
    };
}

export function interpolateProjectedVertex(vertex1: ProjectedVertex, vertex2: ProjectedVertex, t: number): ProjectedVertex {
    return {
        x: lerp(vertex1.x, vertex2.x, t),
        y: lerp(vertex1.y, vertex2.y, t),
        depth: lerp(vertex1.depth, vertex2.depth, t),
        cameraSpace: {
            x: lerp(vertex1.cameraSpace.x, vertex2.cameraSpace.x, t),
            y: lerp(vertex1.cameraSpace.y, vertex2.cameraSpace.y, t),
            z: lerp(vertex1.cameraSpace.z, vertex2.cameraSpace.z, t),
        },
        withinRenderFrustrum: vertex1.withinRenderFrustrum && vertex2.withinRenderFrustrum,
        colour: vertex1.colour ?? vertex2.colour,
    };
}

function clipEdgeToTriangleProjection(edge: ProjectedEdge, triangle: ProjectedTriangle): Interval | null {
    const signedArea = triangleSignedArea2D(triangle);
    if (Math.abs(signedArea) < GEOMETRY_EPSILON) {
        return null;
    }

    const edgeStart = edge[0];
    const edgeEnd = edge[1];
    const splitParameters: number[] = [0, 1];

    for (let index = 0; index < 3; index += 1) {
        const edgeStart = triangle[index]!;
        const edgeEnd = triangle[(index + 1) % 3]!;
        const intersectionParameter = edgeSegmentIntersectionParameter(edgeStart, edgeEnd, edgeStart, edgeEnd);
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

        const midvertexParameter = (startParameter + endParameter) / 2;
        const midvertex = {
            x: lerp(edgeStart.x, edgeEnd.x, midvertexParameter),
            y: lerp(edgeStart.y, edgeEnd.y, midvertexParameter),
        };

        if (!isStrictlyInsideTriangle(midvertex, triangle)) {
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

export function getHiddenIntervalsForEdge(edge: ProjectedEdge, triangles: ProjectedTriangle[], projectionType: ProjectionType): Interval[] {
    const hiddenIntervals: Interval[] = [];

    for (const triangle of triangles) {
        const projectedInterval = clipEdgeToTriangleProjection(edge, triangle);
        if (projectedInterval === null) {
            continue;
        }

        const planeIntersectionParameter = edgePlaneIntersectionParameter(edge, triangle);
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

            const midvertex = (subIntervalStart + subIntervalEnd) / 2;
            const edgeDepth = lerp(edge[0].depth, edge[1].depth, midvertex);
            const edgeVertex = {
                x: lerp(edge[0].x, edge[1].x, midvertex),
                y: lerp(edge[0].y, edge[1].y, midvertex),
            };
            const triangleDepth = triangleDepthAtProjectedVertex(triangle, edgeVertex, projectionType);

            if (triangleDepth === null) {
                continue;
            }

            if (edgeDepth > triangleDepth + DEPTH_EPSILON) {
                hiddenIntervals.push({ start: subIntervalStart, end: subIntervalEnd });
            }
        }
    }

    return mergeIntervals(hiddenIntervals);
}
