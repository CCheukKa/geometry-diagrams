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
    | { type: "line"; depth: number; colour: string | undefined; data: ProjectedLine; dashed?: boolean }
    | { type: "tri"; depth: number; colour: string | undefined; data: ProjectedTri }
    | { type: "annotation"; depth: number; data: { annotation: Annotation; projectedPosition: ProjectedPoint } };

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
            if (drawable.dashed) {
                const thickness = Math.max(options.lineThickness ?? 2, 1);
                lineElement.setAttribute("stroke-dasharray", `${thickness * 4} ${thickness * 3}`);
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
): void {
    const hiddenIntervals = getHiddenIntervalsForLine([projectedPoint1, projectedPoint2], projectedTriangles, projectionType);
    let currentStart = 0;

    function pushSegment(startT: number, endT: number, dashed: boolean): void {
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
            dashed,
        });
    }

    for (const interval of hiddenIntervals) {
        pushSegment(currentStart, interval.start, false);
        pushSegment(interval.start, interval.end, true);
        currentStart = interval.end;
    }

    pushSegment(currentStart, 1, false);
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

        appendLineSegments(drawables, line, projectedPoint1, projectedPoint2, projectedTriangles, camera.projectionType);
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
