import type { Tri, Line, Point } from "@lib/geometry";
import { Camera, ProjectionType } from "@lib/camera";
import {
    getHiddenIntervalsForLine,
    interpolateProjectedPoint,
    projectPoint,
    type ProjectedLine,
    type ProjectedPoint,
    type ProjectedTri,
} from "@lib/renderGeometry";

const SVG_NS = "http://www.w3.org/2000/svg";

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
};

export type DrawOptions = {
    renderPoints?: boolean;
    renderAnnotations?: boolean;
    triOpacity?: number;
    annotationsAlwaysOnTop?: boolean;
    lineThickness?: number;
};

type Drawable =
    | { type: "point"; depth: number; colour: string | undefined; data: ProjectedPoint }
    | { type: "line"; depth: number; colour: string | undefined; data: ProjectedLine; dashPattern?: DashPattern }
    | { type: "tri"; depth: number; colour: string | undefined; data: ProjectedTri }
    | { type: "annotation"; depth: number; data: { annotation: Annotation; projectedPosition: ProjectedPoint } };

type DashPattern = {
    dashLength: number;
    gapLength: number;
    dashOffset: number;
};

type Interval1D = [number, number];

function createSvgElement(tagName: string): SVGElement {
    return document.createElementNS(SVG_NS, tagName) as SVGElement;
}

function renderDrawable(paper: HTMLElement & SVGElement, drawable: Drawable, options: DrawOptions): void {
    switch (drawable.type) {
        case "point": {
            const projectedPoint = drawable.data;
            const circle = createSvgElement("circle");
            circle.setAttribute("cx", projectedPoint.x.toString());
            circle.setAttribute("cy", projectedPoint.y.toString());
            circle.setAttribute("r", "5");
            circle.setAttribute("fill", projectedPoint.colour ?? PALETTE.point);
            paper.appendChild(circle);
            break;
        }
        case "line": {
            const [projectedPoint1, projectedPoint2] = drawable.data;
            const lineElement = createSvgElement("line");
            lineElement.setAttribute("x1", projectedPoint1.x.toString());
            lineElement.setAttribute("y1", projectedPoint1.y.toString());
            lineElement.setAttribute("x2", projectedPoint2.x.toString());
            lineElement.setAttribute("y2", projectedPoint2.y.toString());
            lineElement.setAttribute("stroke", drawable.colour ?? PALETTE.line);
            lineElement.setAttribute("stroke-width", (options.lineThickness ?? 2).toString());
            if (drawable.dashPattern !== undefined) {
                lineElement.setAttribute("stroke-dasharray", `${drawable.dashPattern.dashLength} ${drawable.dashPattern.gapLength}`);
                lineElement.setAttribute("stroke-dashoffset", drawable.dashPattern.dashOffset.toString());
            }
            lineElement.setAttribute("stroke-linecap", "round");
            lineElement.setAttribute("stroke-linejoin", "round");
            lineElement.setAttribute("shape-rendering", "geometricPrecision");
            paper.appendChild(lineElement);
            break;
        }
        case "tri": {
            const [projectedPoint1, projectedPoint2, projectedPoint3] = drawable.data;
            const polygon = createSvgElement("polygon");
            polygon.setAttribute(
                "points",
                `${projectedPoint1.x},${projectedPoint1.y} ${projectedPoint2.x},${projectedPoint2.y} ${projectedPoint3.x},${projectedPoint3.y}`,
            );
            polygon.setAttribute("fill", drawable.colour ?? PALETTE.tri);
            polygon.setAttribute("fill-opacity", options.triOpacity?.toString() ?? "0.1");
            polygon.setAttribute("stroke-linejoin", "round");
            polygon.setAttribute("shape-rendering", "geometricPrecision");
            paper.appendChild(polygon);
            break;
        }
        case "annotation": {
            const { annotation, projectedPosition } = drawable.data;
            const textElement = createSvgElement("text");
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

function appendLineSegments(
    drawables: Drawable[],
    line: Line,
    projectedPoint1: ProjectedPoint,
    projectedPoint2: ProjectedPoint,
    projectedTriangles: ProjectedTri[],
    projectionType: ProjectionType,
    lineThickness: number,
): void {
    const hiddenIntervals = getHiddenIntervalsForLine([projectedPoint1, projectedPoint2], projectedTriangles, projectionType);
    let currentStart = 0;

    function pushSegment(startT: number, endT: number): void {
        if (endT - startT <= 1e-7) {
            return;
        }

        const startPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, startT);
        const endPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, endT);
        drawables.push({
            type: "line",
            colour: line.colour,
            data: [startPoint, endPoint],
            depth: (startPoint.depth + endPoint.depth) / 2,
        });
    }

    function computeDashPattern(segmentStart: ProjectedPoint, segmentEnd: ProjectedPoint): DashPattern | undefined {
        const segmentLength = Math.hypot(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y);
        if (segmentLength <= 1e-7) {
            return undefined;
        }

        const strokeWidth = Math.min(Math.max(lineThickness, 1), 4);
        const capMargin = strokeWidth / 2;
        const preferredDash = strokeWidth * 4;
        const preferredGap = strokeWidth * 3;
        const minDash = strokeWidth * 2.5;
        const maxDash = strokeWidth * 6.0;
        const minGap = strokeWidth * 1.0;
        const maxGap = strokeWidth * 4.5;
        const step = strokeWidth * 0.25;

        let bestPattern: DashPattern | undefined;
        let bestScore = Number.POSITIVE_INFINITY;

        for (let dashLength = minDash; dashLength <= maxDash + 1e-7; dashLength += step) {
            if (dashLength <= capMargin * 2) {
                continue;
            }

            for (let gapLength = minGap; gapLength <= maxGap + 1e-7; gapLength += step) {
                const patternLength = dashLength + gapLength;
                const startWindows = getDashPhaseWindows(0, dashLength, patternLength, capMargin);
                const endWindows = getDashPhaseWindows(segmentLength, dashLength, patternLength, capMargin);
                const overlapWindow = intersectWindows(startWindows, endWindows);

                if (overlapWindow === null) {
                    continue;
                }

                const [offsetStart, offsetEnd] = overlapWindow;
                const dashOffset = -(offsetStart + offsetEnd) / 2;
                const score = Math.abs(dashLength - preferredDash) + Math.abs(gapLength - preferredGap);

                if (score < bestScore) {
                    bestScore = score;
                    bestPattern = {
                        dashLength,
                        gapLength,
                        dashOffset,
                    };
                }
            }
        }

        return bestPattern;
    }

    function getDashPhaseWindows(pointPosition: number, dashLength: number, patternLength: number, capMargin: number): Interval1D[] {
        const safeStart = capMargin;
        const safeEnd = Math.max(capMargin, dashLength - capMargin);
        if (safeEnd <= safeStart + 1e-7) {
            return [];
        }

        const phase = ((pointPosition % patternLength) + patternLength) % patternLength;
        const start = (phase - safeEnd + patternLength) % patternLength;
        const end = (phase - safeStart + patternLength) % patternLength;

        if (start <= end) {
            return [[start, end]];
        }

        return [[start, patternLength], [0, end]];
    }

    function intersectWindows(windowsA: Interval1D[], windowsB: Interval1D[]): Interval1D | null {
        let best: Interval1D | null = null;

        for (const [startA, endA] of windowsA) {
            for (const [startB, endB] of windowsB) {
                const overlapStart = Math.max(startA, startB);
                const overlapEnd = Math.min(endA, endB);
                if (overlapEnd <= overlapStart + 1e-7) {
                    continue;
                }

                if (best === null || overlapEnd - overlapStart > best[1] - best[0]) {
                    best = [overlapStart, overlapEnd];
                }
            }
        }

        return best;
    }

    for (const interval of hiddenIntervals) {
        pushSegment(currentStart, interval.start);
        const startT = interval.start;
        const endT = interval.end;
        const startPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, startT);
        const endPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, endT);
        const dashPattern = computeDashPattern(startPoint, endPoint);

        if (dashPattern === undefined) {
            // no dash pattern found -> render solid hidden interval
            pushSegment(startT, endT);
            currentStart = interval.end;
            continue;
        }

        const segmentLength = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        const dashLen = dashPattern.dashLength;

        // If the interval is too short to contain a full leading+trailing dash,
        // just render it solid to guarantee endpoints are fully drawn.
        if (segmentLength <= dashLen * 1.05) {
            pushSegment(startT, endT);
            currentStart = interval.end;
            continue;
        }

        // Compute param t-length for a dash at the ends along this interval
        const tDash = dashLen / segmentLength;
        const midStartT = startT + (endT - startT) * tDash;
        const midEndT = endT - (endT - startT) * tDash;

        // Leading full dash (solid)
        pushSegment(startT, midStartT);

        // Middle: dashed body. Recompute a dash pattern for the middle piece so
        // the dash/gap sizing is appropriate for its length (fallback to the
        // original pattern if recompute fails).
        const middleStartPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, midStartT);
        const middleEndPoint = interpolateProjectedPoint(projectedPoint1, projectedPoint2, midEndT);
        let middlePattern = computeDashPattern(middleStartPoint, middleEndPoint);
        if (middlePattern === undefined) {
            middlePattern = dashPattern;
        }

        const middleDrawable: Drawable = {
            type: "line",
            colour: line.colour,
            data: [middleStartPoint, middleEndPoint],
            depth: (middleStartPoint.depth + middleEndPoint.depth) / 2,
            dashPattern: middlePattern,
        };
        drawables.push(middleDrawable);

        // Trailing full dash (solid)
        pushSegment(midEndT, endT);

        currentStart = interval.end;
    }

    pushSegment(currentStart, 1);
}

export function drawScene(
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
    const projectCache = new Map<Point, ProjectedPoint>();

    function project(point: Point): ProjectedPoint {
        const cachedProjection = projectCache.get(point);
        if (cachedProjection !== undefined) {
            return cachedProjection;
        }

        const projectedPoint = projectPoint(camera, point);
        projectCache.set(point, projectedPoint);
        return projectedPoint;
    }

    const drawables: Drawable[] = [];
    const projectedTriangles: ProjectedTri[] = [];

    for (const tri of tris) {
        const [point1, point2, point3] = tri.points;
        const projectedPoint1 = project(point1);
        const projectedPoint2 = project(point2);
        const projectedPoint3 = project(point3);

        if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum || !projectedPoint3.withinRenderFrustrum)) {
            continue;
        }

        const triDrawable: Drawable = {
            type: "tri",
            colour: tri.colour,
            data: [projectedPoint1, projectedPoint2, projectedPoint3],
            depth: (projectedPoint1.depth + projectedPoint2.depth + projectedPoint3.depth) / 3,
        };
        projectedTriangles.push(triDrawable.data as ProjectedTri);
        drawables.push(triDrawable);
    }

    for (const line of lines) {
        const [point1, point2] = line.points;
        const projectedPoint1 = project(point1);
        const projectedPoint2 = project(point2);

        if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum)) {
            continue;
        }

        appendLineSegments(drawables, line, projectedPoint1, projectedPoint2, projectedTriangles, camera.projectionType, options.lineThickness ?? 2);
    }

    if (options.renderPoints) {
        for (const point of points) {
            const projectedPoint = project(point);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPoint.withinRenderFrustrum) {
                continue;
            }

            drawables.push({
                type: "point",
                depth: projectedPoint.depth,
                colour: projectedPoint.colour,
                data: projectedPoint,
            });
        }
    }

    if (options.renderAnnotations) {
        for (const annotation of annotations) {
            const projectedPoint = project(annotation.position);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPoint.withinRenderFrustrum) {
                continue;
            }

            drawables.push({
                type: "annotation",
                depth: options.annotationsAlwaysOnTop ? -Infinity : projectedPoint.depth,
                data: {
                    annotation,
                    projectedPosition: projectedPoint,
                },
            });
        }
    }

    paper.innerHTML = "";
    drawables.sort((drawable1, drawable2) => drawable2.depth - drawable1.depth);
    for (const drawable of drawables) {
        renderDrawable(paper, drawable, options);
    }
}
