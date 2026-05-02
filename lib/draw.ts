import type { Triangle, Edge, Vertex } from "@lib/geometry";
import { Camera, ProjectionType } from "@lib/camera";
import {
    getHiddenIntervalsForEdge,
    interpolateProjectedVertex,
    projectVertex,
    type ProjectedEdge,
    type ProjectedVertex,
    type ProjectedTriangle,
} from "@lib/renderGeometry";

const SVG_NS = "http://www.w3.org/2000/svg";

const PALETTE = {
    vertex: "#ff0000",
    edge: "#0000ff",
    triangle: "#cccccc",
    annotation: "#000000",
};

export type Annotation = {
    text: string;
    position: Vertex;
    colour?: string;
};

export enum RenderOccludedLinesOption {
    DASHED = "dashed",
    SOLID = "solid",
    HIDDEN = "hidden",
}

export type DrawOptions = {
    vertexSize?: number;
    renderAnnotations?: boolean;
    triangleOpacity?: number;
    annotationsAlwaysOnTop?: boolean;
    edgeThickness?: number;
    renderOccludedLines?: RenderOccludedLinesOption;
};

const DEFAULT_DRAW_OPTIONS: DrawOptions = {
    vertexSize: 5,
    renderAnnotations: true,
    triangleOpacity: 0.1,
    annotationsAlwaysOnTop: true,
    edgeThickness: 2,
    renderOccludedLines: RenderOccludedLinesOption.DASHED,
};

type Drawable =
    | { type: "vertex"; depth: number; colour: string | undefined; data: ProjectedVertex & { size: number } }
    | { type: "edge"; depth: number; colour: string | undefined; data: ProjectedEdge; dashPattern?: DashPattern }
    | { type: "triangle"; depth: number; colour: string | undefined; data: ProjectedTriangle }
    | { type: "annotation"; depth: number; data: { annotation: Annotation; projectedPosition: ProjectedVertex } };

type DashPattern = {
    dashLength: number;
    gapLength: number;
    dashOffset: number;
};

type Interval1D = [number, number];

function createSvgElement(tagName: string): SVGElement {
    return document.createElementNS(SVG_NS, tagName) as SVGElement;
}

function renderDrawable(paper: HTMLElement & SVGElement, drawable: Drawable, options: Required<DrawOptions>): void {
    switch (drawable.type) {
        case "vertex": {
            const projectedVertex = drawable.data as ProjectedVertex & { size: number };
            const circle = createSvgElement("circle");
            circle.setAttribute("cx", projectedVertex.x.toString());
            circle.setAttribute("cy", projectedVertex.y.toString());
            circle.setAttribute("r", projectedVertex.size.toString());
            circle.setAttribute("fill", projectedVertex.colour ?? PALETTE.vertex);
            paper.appendChild(circle);
            break;
        }
        case "edge": {
            const [projectedVertex1, projectedVertex2] = drawable.data;
            const edgeElement = createSvgElement("line");
            edgeElement.setAttribute("x1", projectedVertex1.x.toString());
            edgeElement.setAttribute("y1", projectedVertex1.y.toString());
            edgeElement.setAttribute("x2", projectedVertex2.x.toString());
            edgeElement.setAttribute("y2", projectedVertex2.y.toString());
            edgeElement.setAttribute("stroke", drawable.colour ?? PALETTE.edge);
            edgeElement.setAttribute("stroke-width", (options.edgeThickness).toString());
            if (drawable.dashPattern !== undefined) {
                edgeElement.setAttribute("stroke-dasharray", `${drawable.dashPattern.dashLength} ${drawable.dashPattern.gapLength}`);
                edgeElement.setAttribute("stroke-dashoffset", drawable.dashPattern.dashOffset.toString());
            }
            edgeElement.setAttribute("stroke-linecap", "round");
            edgeElement.setAttribute("stroke-linejoin", "round");
            edgeElement.setAttribute("shape-rendering", "geometricPrecision");
            paper.appendChild(edgeElement);
            break;
        }
        case "triangle": {
            const [projectedVertex1, projectedVertex2, projectedVertex3] = drawable.data;
            const polygon = createSvgElement("polygon");
            polygon.setAttribute(
                "points",
                `${projectedVertex1.x},${projectedVertex1.y} ${projectedVertex2.x},${projectedVertex2.y} ${projectedVertex3.x},${projectedVertex3.y}`,
            );
            polygon.setAttribute("fill", drawable.colour ?? PALETTE.triangle);
            polygon.setAttribute("fill-opacity", options.triangleOpacity.toString());
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

function appendEdgeSegments(
    drawables: Drawable[],
    edge: Edge,
    projectedVertex1: ProjectedVertex,
    projectedVertex2: ProjectedVertex,
    projectedTriangles: ProjectedTriangle[],
    projectionType: ProjectionType,
    edgeThickness: number,
    renderOccludedLines: RenderOccludedLinesOption,
): void {
    const hiddenIntervals = getHiddenIntervalsForEdge([projectedVertex1, projectedVertex2], projectedTriangles, projectionType);
    let currentStart = 0;

    function pushSegment(startT: number, endT: number): void {
        if (endT - startT <= 1e-7) {
            return;
        }

        const startVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, startT);
        const endVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, endT);
        drawables.push({
            type: "edge",
            colour: edge.colour,
            data: [startVertex, endVertex],
            depth: (startVertex.depth + endVertex.depth) / 2,
        });
    }

    function computeDashPattern(segmentStart: ProjectedVertex, segmentEnd: ProjectedVertex): DashPattern | undefined {
        const segmentLength = Math.hypot(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y);
        if (segmentLength <= 1e-7) {
            return undefined;
        }

        const strokeWidth = Math.min(Math.max(edgeThickness, 1), 4);
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

    function getDashPhaseWindows(vertexPosition: number, dashLength: number, patternLength: number, capMargin: number): Interval1D[] {
        const safeStart = capMargin;
        const safeEnd = Math.max(capMargin, dashLength - capMargin);
        if (safeEnd <= safeStart + 1e-7) {
            return [];
        }

        const phase = ((vertexPosition % patternLength) + patternLength) % patternLength;
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
        if (renderOccludedLines === RenderOccludedLinesOption.HIDDEN) {
            currentStart = interval.end;
            continue;
        }

        const startT = interval.start;
        const endT = interval.end;
        const startVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, startT);
        const endVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, endT);
        const dashPattern = computeDashPattern(startVertex, endVertex);

        if (dashPattern === undefined) {
            // no dash pattern found -> render solid hidden interval
            pushSegment(startT, endT);
            currentStart = interval.end;
            continue;
        }

        const segmentLength = Math.hypot(endVertex.x - startVertex.x, endVertex.y - startVertex.y);
        const dashLen = dashPattern.dashLength;

        // If the interval is too short to contain a full leading+trailing dash,
        // just render it solid to guarantee endvertices are fully drawn.
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
        const middleStartVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, midStartT);
        const middleEndVertex = interpolateProjectedVertex(projectedVertex1, projectedVertex2, midEndT);
        let middlePattern = computeDashPattern(middleStartVertex, middleEndVertex);
        if (middlePattern === undefined) {
            middlePattern = dashPattern;
        }

        const middleDrawable: Drawable = {
            type: "edge",
            colour: edge.colour,
            data: [middleStartVertex, middleEndVertex],
            depth: (middleStartVertex.depth + middleEndVertex.depth) / 2,
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
    vertices: Vertex[],
    edges: Edge[],
    triangles: Triangle[],
    annotations: Annotation[],
    userOptions: DrawOptions = DEFAULT_DRAW_OPTIONS,
): void {
    const options = {
        ...DEFAULT_DRAW_OPTIONS,
        ...userOptions,
    } as Required<DrawOptions>;

    const projectCache = new Map<Vertex, ProjectedVertex>();

    function project(vertex: Vertex): ProjectedVertex {
        const cachedProjection = projectCache.get(vertex);
        if (cachedProjection !== undefined) {
            return cachedProjection;
        }

        const projectedVertex = projectVertex(camera, vertex);
        projectCache.set(vertex, projectedVertex);
        return projectedVertex;
    }

    const drawables: Drawable[] = [];
    const projectedTriangles: ProjectedTriangle[] = [];

    if (options.triangleOpacity > 0 || options.renderOccludedLines !== RenderOccludedLinesOption.SOLID) {
        for (const triangle of triangles) {
            const [vertex1, vertex2, vertex3] = triangle.vertices;
            const projectedVertex1 = project(vertex1);
            const projectedVertex2 = project(vertex2);
            const projectedVertex3 = project(vertex3);

            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedVertex1.withinRenderFrustrum || !projectedVertex2.withinRenderFrustrum || !projectedVertex3.withinRenderFrustrum)) {
                continue;
            }

            const vertices: ProjectedTriangle = [projectedVertex1, projectedVertex2, projectedVertex3];
            if (options.renderOccludedLines !== RenderOccludedLinesOption.SOLID) {
                projectedTriangles.push(vertices);
            }

            if (options.triangleOpacity > 0) {
                drawables.push({
                    type: "triangle",
                    colour: triangle.colour,
                    data: vertices,
                    depth: (projectedVertex1.depth + projectedVertex2.depth + projectedVertex3.depth) / 3,
                });
            }
        }
    }

    if (options.edgeThickness > 0) {
        for (const edge of edges) {
            const [vertex1, vertex2] = edge.vertices;
            const projectedVertex1 = project(vertex1);
            const projectedVertex2 = project(vertex2);

            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedVertex1.withinRenderFrustrum || !projectedVertex2.withinRenderFrustrum)) {
                continue;
            }

            switch (options.renderOccludedLines) {
                case RenderOccludedLinesOption.SOLID: {
                    drawables.push({
                        type: "edge",
                        colour: edge.colour,
                        data: [projectedVertex1, projectedVertex2],
                        depth: (projectedVertex1.depth + projectedVertex2.depth) / 2,
                    });
                    break;
                }
                case RenderOccludedLinesOption.DASHED:
                case RenderOccludedLinesOption.HIDDEN: {
                    appendEdgeSegments(drawables, edge, projectedVertex1, projectedVertex2, projectedTriangles, camera.projectionType, options.edgeThickness, options.renderOccludedLines);
                    break;
                }
            }
        }
    }

    if (options.vertexSize > 0) {
        for (const vertex of vertices) {
            const projectedVertex = project(vertex);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedVertex.withinRenderFrustrum) {
                continue;
            }

            drawables.push({
                type: "vertex",
                depth: projectedVertex.depth,
                colour: projectedVertex.colour,
                data: { ...projectedVertex, size: options.vertexSize },
            });
        }
    }

    if (options.renderAnnotations) {
        for (const annotation of annotations) {
            const projectedVertex = project(annotation.position);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedVertex.withinRenderFrustrum) {
                continue;
            }

            drawables.push({
                type: "annotation",
                depth: options.annotationsAlwaysOnTop ? -Infinity : projectedVertex.depth,
                data: {
                    annotation,
                    projectedPosition: projectedVertex,
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
